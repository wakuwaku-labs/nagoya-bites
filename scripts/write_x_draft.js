#!/usr/bin/env node
'use strict';
/**
 * X 用の文面をジャーナルの公開と同じ回に書いて保存する（P-476・docs/decisions/0047-x-post-drafts.md）。
 *
 * scripts/run_journal_local.sh の 5i が呼ぶ。Claude（claude --print・ツールなし・フックなし）に
 * docs/x-post-prompt.md と今日の記事の本文を渡し、返ってきた JSON を scripts/lib/x_post.js の
 * checkDraft と validatePost（投稿のときと同じ検査）にかけて、通ったものだけを
 * data/x_post_drafts/<date>.json に書く。落ちたら理由を添えて書き直させ（policy の draft.attempts 回まで）、
 * それでも駄目なら何も書かない（投稿は題名＋ポイントの定型に戻る）。
 *
 * 文面は記事と同じコミットに入れる。x-post.yml は data/journal_published.json の push で動くので、
 * 後から別に push すると、先に定型の投稿が出てしまう。
 *
 * 公開を止めない: 終了コードは常に 0（引数の誤りだけ 2）。Claude の応答待ちは draft.timeoutSec で打ち切る。
 *
 * 使い方:
 *   node scripts/write_x_draft.js [--date YYYY-MM-DD] [--claude-bin PATH] [--dry-run] [--force] [--json]
 *     --dry-run  検査まで行い、ファイルは書かない
 *     --force    その日の文面が既にあっても書き直す
 *     --long     手動の追加の長いポスト用の文面を data/x_post_drafts/<date>-long.json に書く（題材の実験は使わない）
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const X = require('./lib/x_post');
const { findEntry, todayJst } = require('./post_journal_to_x');
const S = require('./lib/sns_analyzer');
const PT = require('./lib/journal_plan_topic');
const BP = require('./lib/brand_policy');

const PROMPT_REL = 'docs/x-post-prompt.md';

function parseArgs(argv) {
  const a = { date: null, claudeBin: process.env.CLAUDE_BIN || 'claude', dryRun: false, force: false, json: false, long: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--date') a.date = argv[++i];
    else if (k === '--claude-bin') a.claudeBin = argv[++i];
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--force') a.force = true;
    // 手動の追加の長いポスト用（post_journal_to_x.js --extra-long が読む <date>-long.json に書く）。
    // その日の題材の実験（スレッドなし等）は使わず、長いポストの節を必ず付ける
    else if (k === '--long') a.long = true;
    else if (k === '--json') a.json = true;
    else throw new Error(`知らない引数: ${k}`);
  }
  if (a.date && !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error('--date は YYYY-MM-DD');
  if (!a.claudeBin) throw new Error('--claude-bin が空');
  return a;
}

/** 記事の本文（<article> の中。無ければ <body>）を読める文字にする。 */
function articleMaterial(html) {
  const s = String(html || '');
  const m = s.match(/<article[\s\S]*?<\/article>/i) || s.match(/<body[\s\S]*?<\/body>/i);
  return X.htmlToText(m ? m[0] : s).trim().slice(0, 15000);
}

/** docs/x-post-prompt.md の「---」より後（人向けの前置きを除く）。 */
function promptBody(root) {
  const md = fs.readFileSync(path.join(root, PROMPT_REL), 'utf8');
  const i = md.indexOf('\n---\n');
  return (i >= 0 ? md.slice(i + 5) : md).trim();
}

function wordingList(root) {
  const { loadPolicy: loadWording, compilePolicy } = require('./audit_selection_wording');
  return compilePolicy(loadWording(root)).terms.filter((t) => t.severity === 'error').map((t) => t.label || t.pattern);
}


// ── SNS分析ツールの割り当て（判断記録 0059）─────────────────────────────────
const FIRST_LINE_JA = {
  question: '本文の1行目を、読んだ人が「自分のことだ」と思う問いかけ（疑問形）にする。',
  number: '本文の1行目に、記事の数字（evidence の引用の中にあるもの）を置く。',
  assertion: '本文の1行目を、記事の事実をそのまま言い切る一文にする（煽りの言葉は使わない）。',
};
const LENGTH_JA = {
  short: '本文は全角で50字までの短さにする。',
  mid: '本文は全角で51〜80字にする。',
  long: '本文は全角で81〜110字にする（使い切らなくてよい。足りない事実を水増ししない）。',
};

/**
 * 今日（date・JST）の割り当て。policy.planExperiment.enabled が true で、iCloud の next.json が使える状態のときだけ
 * { plan } を返す。使えないときは { plan: null, reason }＝今までどおり（指定なし）。例外は投げない。
 */
function loadPlan(date, policy, now = new Date()) {
  const cfg = policy.planExperiment;
  if (!cfg || cfg.enabled !== true) return { plan: null, reason: 'off' };
  let r;
  try { r = S.readFresh('next.json', { schema: 'x-next/1', maxAgeDays: Number(cfg.maxAgeDays) || 8, now }); } catch (e) { return { plan: null, reason: `error:${e.message}` }; }
  if (!r.ok) return { plan: null, reason: r.reason };
  let p;
  try { p = S.pickSlot(r.data, date); } catch (e) { return { plan: null, reason: `error:${e.message}` }; }
  return p.ok ? { plan: p.plan } : { plan: null, reason: p.reason };
}

/** 題名が「おすすめ◯選」「5選」の記事か（docs/decisions/0080 の◯選の柱）。 */
function isPicksTitle(title) {
  return /[0-9０-９一二三四五六七八九十]+選/.test(String(title || ''));
}

/**
 * ◯選の記事の日は、週の型の割り当て（nb_kind）より picks を優先する（ADR 0080 決定4。2026-11-21 に
 * 「名駅で鍋のおすすめ5選」が割り当ての number で投稿され、◯選の形にならなかった）。
 * 割り当ての記録は残し、followed=false＋kind_overridden で「指定に従わなかった日」と分かるようにする。
 */
function applyPicksOverride(plan, title) {
  if (!plan || !plan.nb_kind || plan.nb_kind === 'picks' || !isPicksTitle(title)) return plan;
  return { ...plan, nb_kind: null, kind_overridden: { requested: plan.nb_kind, reason: 'picks_article' } };
}

/** 文面づくりの指示に足す節（指定が1つも無ければ空）。 */
function planSection(plan, title) {
  if (!plan) return [];
  const lines = [];
  if (plan.kind_overridden) lines.push('- この記事は「おすすめ◯選」の記事なので、型は `picks` で書く（今週の型の割り当てより優先）。');
  // 題材は、記事の題名が予定の題材に明確に一致するときだけ。無理に話題を変えない
  if (plan.topic && title && PT.matchesTopic({ title_draft: title }, plan.topic)) lines.push(`- 今週の予定の題材は「${plan.topic}」。この記事はその題材に当たるので、読む人がその場面で使える点を前に出してよい（記事にない事実は足さない）。`);
  if (plan.nb_kind) lines.push(`- 型は \`${plan.nb_kind}\` で書く。記事の事実がどうしてもその型に合わないときだけ、いちばん合う別の型にしてよい。`);
  if (plan.first_line) lines.push(`- ${FIRST_LINE_JA[plan.first_line]}`);
  if (plan.length) lines.push(`- ${LENGTH_JA[plan.length]}`);
  if (!lines.length) return [];
  return ['', '## 今日の指定', '次の指定は、上の「書き方の決まり」を破らない範囲で守る（決まりが優先）。', ...lines];
}

/** 保存する割り当ての記録。followed = 指定の型で書けたか（型の指定が無ければ null）。 */
function planRecord(plan, type) {
  return {
    week: plan.week, slot: plan.slot, role: plan.role, experiment_id: plan.experiment_id, cell_id: plan.cell_id,
    topic: plan.topic ?? null, url_variant: plan.url_variant ?? null,
    requested: { nb_kind: plan.kind_overridden ? plan.kind_overridden.requested : plan.nb_kind, first_line: plan.first_line, length: plan.length },
    ...(plan.kind_overridden ? { followed: false, kind_overridden: plan.kind_overridden.reason } : plan.nb_kind ? { followed: type === plan.nb_kind } : {}),
  };
}

/**
 * 投稿日（date・JST の YYYY-MM-DD）の曜日に割り当てたシリーズ名（Ondine #1808・policy.series）。
 * 割り当てが無い・無効なら null。忘年会幹事のような期間限定のシリーズは、月が外れたら fallbackByMonth の名前に替える。
 */
function seriesFor(date, policy) {
  const cfg = policy && policy.series;
  if (!cfg || cfg.enabled !== true || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return null;
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const month = Number(String(date).slice(5, 7));
  let name = cfg.weekdays && cfg.weekdays[String(dow)];
  if (!name) return null;
  const months = cfg.monthsOnly && cfg.monthsOnly[name];
  if (Array.isArray(months) && !months.includes(month)) name = cfg.fallbackByMonth && cfg.fallbackByMonth[name];
  if (!name) return null;
  return { name, hint: (cfg.seriesHints && cfg.seriesHints[name]) || '' };
}

/** 文面づくりの指示に足す「今日のシリーズ」の節（割り当てが無ければ空） */
function seriesSection(date, policy) {
  const s = seriesFor(date, policy);
  if (!s) return [];
  return ['', '## 今日のシリーズ',
    `今日はシリーズ「${s.name}」の日。${s.hint}`,
    '- 記事の事実がこのシリーズに合うときだけ、シリーズ名を本文の中に自然な形で一度だけ入れ、シリーズの書き方に寄せる。合わないときは使わず、いつもどおり書く（事実を曲げない・無理に当てはめない）。',
    '- シリーズ名を入れても、本文の長さの上限・書き方の決まり（数字は evidence の引用の中だけ・煽りと根拠のないランキングを書かない）は変わらない。',
    '- シリーズ名の「◯」は記事の数字（evidence の引用の中にあるもの）で埋める。埋められないときは名前を入れない。'];
}

// ── 題材の実験（Ondine #2025・docs/decisions/0067）─────────────────────────
function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** date と同じ ISO 週（JST の月〜日）の、date より前の日に保存した文面のうち、題材の実験を使った本数。 */
function topicExperimentCountThisWeek(date, root) {
  const wd = S.weekdayJst(date);
  let n = 0;
  for (let k = 1; k <= wd; k++) {
    try {
      const d = JSON.parse(fs.readFileSync(X.draftPath(addDays(date, -k), root), 'utf8'));
      if (d && d.topic_experiment && d.topic_experiment.followed !== false) n++;
    } catch (_) { /* 無い・壊れている日は数えない */ }
  }
  return n;
}

/**
 * 今日（date・JST）の題材の実験。policy.topicExperiment が有効で期間内、next.json の candidates に使えるものがあり、
 * 記事の題材に当たるときだけ { exp } を返す。使えないときは { exp: null, reason }。例外は投げない。
 * 特定の題材（記事の題名に当たるとき）は上限なし。anyTopics（どの記事にも当たる）は週 weeklyTarget 本まで。
 */
function loadTopicExperiment(date, policy, entry, root = X.ROOT, now = new Date()) {
  try {
    const cfg = policy && policy.topicExperiment;
    if (!cfg || cfg.enabled !== true) return { exp: null, reason: 'off' };
    if (cfg.since && date < cfg.since) return { exp: null, reason: 'before_since' };
    if (cfg.until && date > cfg.until) return { exp: null, reason: 'after_until' };
    const r = S.readFresh('next.json', { schema: 'x-next/1', maxAgeDays: Number(cfg.maxAgeDays) || 8, now });
    if (!r.ok) return { exp: null, reason: r.reason };
    const skip = Array.isArray(cfg.skip) ? cfg.skip : [];
    const anyTopics = Array.isArray(cfg.anyTopics) ? cfg.anyTopics : [];
    const usable = (Array.isArray(r.data.candidates) ? r.data.candidates : []).filter((c) => c && typeof c.experiment_id === 'string'
      && !skip.includes(c.experiment_id) && c.format && typeof c.format === 'object' && (c.format.media === 'none' || c.format.media == null));
    if (!usable.length) return { exp: null, reason: 'no_usable_candidate' };
    const pack = (c) => ({ experiment_id: c.experiment_id, topic: c.topic ?? null, format: c.format });
    const specific = usable.find((c) => !anyTopics.includes(c.topic) && PT.matchesTopic({ title_draft: entry.title }, c.topic));
    if (specific) return { exp: pack(specific) };
    const any = usable.find((c) => anyTopics.includes(c.topic));
    if (!any) return { exp: null, reason: 'no_topic_match' };
    const target = Number(cfg.weeklyTarget) || 0;
    if (topicExperimentCountThisWeek(date, root) >= target) return { exp: null, reason: 'weekly_target_reached' };
    return { exp: pack(any) };
  } catch (e) {
    return { exp: null, reason: `error:${e.message}` };
  }
}

/** 文面づくりの指示に足す節（実験が無ければ空）。 */
function topicExperimentSection(exp) {
  if (!exp) return [];
  const f = exp.format || {};
  const lines = [];
  if (exp.topic) lines.push(`- 題材は「${exp.topic}」。記事の事実のうち、この題材で読む人の役に立つ点を前に出してよい（記事にない事実は足さない）。`);
  if (f.thread === false) lines.push('- 返信（続き）は付けない（replies は空の配列にする）。');
  if (f.first_line && FIRST_LINE_JA[f.first_line]) lines.push(`- ${FIRST_LINE_JA[f.first_line]}`);
  if (!lines.length) return [];
  return ['', '## 今日の題材の実験', '次の指定は、上の「書き方の決まり」を破らない範囲で守る（決まりが優先）。記事に無い事実は足さない。', ...lines];
}

/** 1行目の書き方（問いかけ・数字）を守れたか。確かめられない指定（言い切りなど）は守れた扱い。 */
function firstLineFollowed(body, firstLine) {
  const line = String(body || '').split('\n')[0] || '';
  if (firstLine === 'question') return /[？?]/.test(line);
  if (firstLine === 'number') return /[0-9０-９]/.test(line);
  return true;
}

/** 長いポストの日の指示（data/x_post_policy.json の longPost。スレッドなしの実験の日は付けない）。 */
function longPostSection(policy, topicExp) {
  const lp = (policy && policy.longPost) || {};
  if (lp.enabled !== true || (topicExp && topicExp.format && topicExp.format.thread === false)) return [];
  const n = X.maxDraftReplies(policy);
  return [
    '',
    '## 今日は長いポストで出す',
    `本文（body）と続き（replies）を、空行で区切って1つの長いポストにまとめて出す（X プレミアム）。続きは最大${n}件まで書いてよい（記事に足せる事実が無ければ少なくてよい。水増しをしない）。`,
    '- タイムラインで見えるのは本文（body）だけで、続きは「さらに表示」を押した人が読む。本文に、いちばん伝えたいことと「続きを読みたくなる」中身を入れる。',
    '- 続きは1件を1つのまとまりにし、1行目を【】の小見出しにする（例「【どんな店か】」「【こんな時に合う】」「【行く前に】」「【予算の目安】」）。小見出しは毎回同じにせず、記事に合わせて変える。',
    '- 記事が複数の店を紹介している日は、続き1件を1店にし、下の「店ごとの続きの形」で書く（店名が一目で分かり、並べた情報が何の情報か分かるように。2026-11-23 本人「どこが店舗名か、羅列している情報がどんな情報か分からない」）。',
    '  - 1行目は【店名】（記事の店名を短く。例「【青二才 今池本店】」）。「こんな時に合う」は小見出しにせず、3行目に書く。',
    '  - 2行目: どんな店かを1行（料理・業態・名物）。',
    '  - 3行目: 「こんな時に：」で始めて、合う使い方を1行（記事にあるものだけ）。',
    '  - 4行目から: 「・見出し：中身」の箇条書き。見出しは「場所」「営業」「休み」「予算」「席」「たばこ」「支払い」「名物」「予約」から記事にあるものを選ぶ（同じ店で同じ見出しを2回使わない）。',
    '  - 注意点は「※」で始まる最後の1行にしてよい。',
    '  - 本文（body）には、店名を「・「店名」：ひとこと」の形で並べ、タイムラインだけで何店のどんな店かが分かるようにする。',
    '  - 例（型だけ。事実は記事にあるものだけで埋める）: 「【◯◯ ◯◯店】\\n豚の串焼き「やきとん」の居酒屋\\nこんな時に：安く短く飲みたい日\\n・場所：◯◯駅から徒歩◯分\\n・営業：◯時〜◯時（年中無休）\\n・予算：1人◯◯円ほど\\n・たばこ：全席で吸える\\n※席料あり」',
    '- 長いポストが使えない日は、本文と続きの最初の3件をスレッドで送る。大事な続きほど前に置く。',
    '- 見やすさの決まり・事実の決まり・続き1件の長さの上限は変わらない。',
  ];
}

function buildPrompt({ root, entry, material, previous, plan, topicExp }) {
  const parts = [
    promptBody(root),
    ...planSection(plan, entry.title),
    ...topicExperimentSection(topicExp),
    ...seriesSection(entry.date, X.loadPolicy(root)),
    ...longPostSection(X.loadPolicy(root), topicExp),
    '',
    '## 使わない言い方',
    wordingList(root).map((w) => `- ${w}`).join('\n'),
    '',
    '## 名古屋バイツの基本方針で避ける言い回し（出たら投稿前の検査で止まる）',
    ...BP.brandNgLines(root),
    '',
    '## 記事',
    `題名: ${entry.title}`,
    '',
    material,
  ];
  if (previous) {
    parts.push('', '## 前の案は検査に落ちました', `落ちた理由: ${previous.reason}`, `前の案: ${previous.raw}`,
      '理由を直した案を、同じ形の JSON だけで返してください。');
  }
  return parts.join('\n');
}

/** Claude を呼ぶ。打ち切ったときも待たずに返す（子が残っても呼び出し側は先へ進む）。 */
function callClaude(bin, prompt, timeoutMs) {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let done = false;
    let child;
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ...r, out, err });
    };
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch (_) { /* 既に終わっている */ }
      setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) { /* 同上 */ } }, 5000).unref();
      finish({ ok: false, reason: 'timeout' });
    }, timeoutMs);
    try {
      child = spawn(bin, ['--print', '--safe-mode', '--tools', '', '--no-session-persistence', prompt], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      finish({ ok: false, reason: `spawn:${e.code || e.message}` });
      return;
    }
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => finish({ ok: false, reason: `spawn:${e.code || e.message}` }));
    child.on('close', (code) => finish(code === 0 ? { ok: true } : { ok: false, reason: `exit:${code}` }));
  });
}

/** 応答から JSON を取り出す（前後の文やコードブロックの記号は無視する）。 */
function parseReply(text) {
  const s = String(text || '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    const j = JSON.parse(s.slice(a, b + 1));
    return j && typeof j === 'object' && !Array.isArray(j) ? j : null;
  } catch (_) {
    return null;
  }
}

/** 投稿のときと同じ検査（文面そのもの＋URL・ハッシュタグを付けた全体）。返り値は落ちた理由の配列。 */
function checkAll(draft, { entry, policy, articleText, root }) {
  const failures = X.checkDraft(draft, { entry, policy, articleText });
  if (failures.length) return failures;
  const b = X.buildDraftPost(draft, entry, policy);
  if (!b.ok) return [b.reason];
  const rf = X.validateReplies(b.replies, { policy, articleText, root });
  if (rf.length) return rf;
  return X.validatePost(b.text, {
    entry, policy, articleText, root,
    recentTexts: X.recentTexts(X.readLog(root), entry.date, policy.duplicateWindowDays || 30),
  });
}

async function run(args, { root = X.ROOT, now = new Date(), call = callClaude } = {}) {
  const policy = X.loadPolicy(root);
  const cfg = policy.draft || {};
  const date = args.date || todayJst(now);
  const out = { date, attempts: [] };
  if (!cfg.generate) return { ...out, result: 'off' };

  const entry = findEntry(date, root);
  if (!entry) return { ...out, result: 'no_journal' };
  out.slug = entry.slug;
  const file = X.draftPath(args.long ? `${date}-long` : date, root);
  if (fs.existsSync(file) && !args.force) return { ...out, result: 'exists' };

  const articlePath = path.join(root, 'journal', `${entry.slug}.html`);
  if (!fs.existsSync(articlePath)) return { ...out, result: 'failed', reason: 'article_html_missing' };
  const html = fs.readFileSync(articlePath, 'utf8');
  const articleText = X.htmlToText(html);
  const material = articleMaterial(html);

  let { plan, reason: planReason } = loadPlan(date, policy, now);
  const { exp: topicExp, reason: topicReason } = args.long ? { exp: null, reason: 'long' } : loadTopicExperiment(date, policy, entry, root, now);
  if (topicExp) out.topic_experiment = topicExp; else if (topicReason !== 'off') out.topic_experiment_skipped = topicReason;
  // 型の割り当ての1行目と実験の1行目が食い違うときは、実験を優先して型の割り当ては使わない
  if (plan && topicExp && plan.first_line && topicExp.format.first_line && plan.first_line !== topicExp.format.first_line) {
    plan = null;
    planReason = 'topic_experiment';
  }
  plan = applyPicksOverride(plan, entry.title);
  if (plan) out.plan = plan; else if (planReason !== 'off') out.plan_skipped = planReason;

  const attempts = Math.max(1, Number(cfg.attempts) || 1);
  const timeoutMs = Math.max(10, Number(cfg.timeoutSec) || 150) * 1000;
  let previous = null;
  for (let i = 1; i <= attempts; i++) {
    const started = Date.now();
    const r = await call(args.claudeBin, buildPrompt({ root, entry, material, previous, plan, topicExp }), timeoutMs);
    const seconds = Math.round((Date.now() - started) / 1000);
    if (!r.ok) {
      // 応答が無い・認証切れ・利用上限は、書き直させても直らない
      out.attempts.push({ i, seconds, reason: r.reason, detail: String(r.out || r.err || '').trim().slice(0, 200) });
      return { ...out, result: 'failed', reason: r.reason };
    }
    const reply = parseReply(r.out);
    if (!reply) {
      out.attempts.push({ i, seconds, reason: 'no_json', detail: String(r.out || '').trim().slice(0, 200) });
      if (/authenticate|OAuth|usage limit|rate limit/i.test(r.out)) return { ...out, result: 'failed', reason: 'no_json' };
      previous = { reason: 'JSON が見つからない', raw: String(r.out || '').trim().slice(0, 600) };
      continue;
    }
    const noThread = !!topicExp && topicExp.format.thread === false;
    const draft = {
      version: 1,
      date,
      slug: entry.slug,
      type: reply.type,
      body: typeof reply.body === 'string' ? reply.body.trim() : reply.body,
      evidence: reply.evidence,
      ...(reply.replies !== undefined && !noThread ? { replies: Array.isArray(reply.replies) ? reply.replies.map((x) => (typeof x === 'string' ? x.trim() : x)) : reply.replies } : {}),
      generated_at: now.toISOString(),
      generator: `claude --print（${PROMPT_REL}）`,
      ...(plan ? { plan: planRecord(plan, reply.type) } : {}),
      ...(topicExp ? { topic_experiment: { ...topicExp, followed: firstLineFollowed(reply.body, topicExp.format.first_line) } } : {}),
    };
    const failures = checkAll(draft, { entry, policy, articleText, root });
    out.attempts.push({ i, seconds, reason: failures.join(' / ') || null });
    // 指定の型と違う型で通ったときは、最後の回でなければ1回書き直させる（最後の回は通った案を使い、followed:false で残す）
    if (!failures.length && plan && plan.nb_kind && reply.type !== plan.nb_kind && i < attempts) {
      out.attempts[out.attempts.length - 1].reason = `plan_kind_differs:${reply.type}`;
      previous = { reason: `指定の型 ${plan.nb_kind} と違う型（${reply.type}）で書かれた。記事に合う限り ${plan.nb_kind} で書き直す`, raw: JSON.stringify({ type: reply.type, body: reply.body, replies: reply.replies, evidence: reply.evidence }) };
      continue;
    }
    if (!failures.length && topicExp && !draft.topic_experiment.followed && i < attempts) {
      out.attempts[out.attempts.length - 1].reason = `topic_first_line_differs:${topicExp.format.first_line}`;
      previous = { reason: `題材の実験の指定（1行目: ${topicExp.format.first_line}）を守っていない。${FIRST_LINE_JA[topicExp.format.first_line]}`, raw: JSON.stringify({ type: reply.type, body: reply.body, replies: reply.replies, evidence: reply.evidence }) };
      continue;
    }
    // 見やすさ（改行・1行の長さ）が守れていなければ、最後の回でなければ書き直させる。
    // 最後の回は通った案を使い、直せなかった点を layout_issues に残す（定型に戻すより読みやすいため）
    const layout = failures.length ? [] : X.draftLayoutIssues(draft, policy);
    if (layout.length && i < attempts) {
      out.attempts[out.attempts.length - 1].reason = `layout:${layout.join(',')}`;
      previous = { reason: `見やすさの決まりを守っていない（${layout.join(', ')}）。layout_long_line は1行が長すぎる行、layout_two_sentences は1行に2つの文がある行、layout_bullet_no_label は「・」が3行以上並ぶのに頭に「予算：」「営業：」のような見出しが無い行（行番号は1から）。1文ごとに改行し、1行は全角25字前後（長くても32字）に収め、並べる事実は「・」の箇条書きにする。事実と数字は変えない`, raw: JSON.stringify({ type: reply.type, body: reply.body, replies: reply.replies, evidence: reply.evidence }) };
      continue;
    }
    if (layout.length) draft.layout_issues = layout;
    if (!failures.length) {
      out.draft = draft;
      out.post = X.buildDraftPost(draft, entry, policy).text;
      if (!args.dryRun) {
        // 最初の日は保存先のフォルダがまだ無い
        fs.mkdirSync(path.dirname(file), { recursive: true });
        X.writeJson(path.relative(root, file), draft, root);
      }
      return { ...out, result: args.dryRun ? 'dry_run_ok' : 'written' };
    }
    previous = { reason: failures.join(' / '), raw: JSON.stringify({ type: reply.type, body: reply.body, replies: reply.replies, evidence: reply.evidence }) };
  }
  return { ...out, result: 'rejected', reason: out.attempts[out.attempts.length - 1].reason };
}

const RESULT_JA = {
  off: '停止中（draft.generate=false）', no_journal: '今日のジャーナルが無い', exists: '今日の文面は保存済み（書き直すなら --force）',
  failed: '書けなかった（投稿は定型に戻る）', rejected: '検査に通る文面が書けなかった（投稿は定型に戻る）',
  dry_run_ok: '試し: 検査を通過（保存していない）', written: '保存した',
};

function summary(r) {
  const lines = [`X 用の文面 ${r.date}: ${RESULT_JA[r.result] || r.result}${r.reason ? `（${r.reason}）` : ''}`];
  for (const a of r.attempts) lines.push(`  試行${a.i}（${a.seconds}秒）: ${a.reason || '通過'}${a.detail ? ` … ${a.detail}` : ''}`);
  if (r.topic_experiment) {
    const d = r.draft && r.draft.topic_experiment;
    lines.push(`  題材の実験: ${r.topic_experiment.experiment_id}${d ? (d.followed ? '（守れた）' : '（守れず・followed=false）') : ''}`);
  } else if (r.topic_experiment_skipped) lines.push(`  題材の実験: 使わない（${r.topic_experiment_skipped}）`);
  if (r.post) lines.push('---', r.post, '---');
  ((r.draft && r.draft.replies) || []).forEach((t, i) => lines.push(`返信${i + 1}:`, t, '---'));
  return lines.join('\n') + '\n';
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  let r;
  try {
    r = await run(args);
  } catch (e) {
    r = { date: args.date, attempts: [], result: 'failed', reason: `error:${e.message}` };
  }
  if (args.json) console.log(JSON.stringify(r, null, 2));
  else process.stdout.write(summary(r));
  // 打ち切った Claude が残っていても待たない（公開を止めない）
  process.exit(0);
}

if (require.main === module) main();

module.exports = { isPicksTitle, applyPicksOverride, loadTopicExperiment, topicExperimentSection, firstLineFollowed, seriesFor, seriesSection, loadPlan, planSection, planRecord, run, parseArgs, parseReply, articleMaterial, buildPrompt, checkAll, summary, callClaude };
