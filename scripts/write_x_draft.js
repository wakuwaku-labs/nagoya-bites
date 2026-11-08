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
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const X = require('./lib/x_post');
const { findEntry, todayJst } = require('./post_journal_to_x');
const S = require('./lib/sns_analyzer');

const PROMPT_REL = 'docs/x-post-prompt.md';

function parseArgs(argv) {
  const a = { date: null, claudeBin: process.env.CLAUDE_BIN || 'claude', dryRun: false, force: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--date') a.date = argv[++i];
    else if (k === '--claude-bin') a.claudeBin = argv[++i];
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--force') a.force = true;
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

/** 文面づくりの指示に足す節（指定が1つも無ければ空）。 */
function planSection(plan) {
  if (!plan) return [];
  const lines = [];
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
    requested: { nb_kind: plan.nb_kind, first_line: plan.first_line, length: plan.length },
    ...(plan.nb_kind ? { followed: type === plan.nb_kind } : {}),
  };
}

function buildPrompt({ root, entry, material, previous, plan }) {
  const parts = [
    promptBody(root),
    ...planSection(plan),
    '',
    '## 使わない言い方',
    wordingList(root).map((w) => `- ${w}`).join('\n'),
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
  const file = X.draftPath(date, root);
  if (fs.existsSync(file) && !args.force) return { ...out, result: 'exists' };

  const articlePath = path.join(root, 'journal', `${entry.slug}.html`);
  if (!fs.existsSync(articlePath)) return { ...out, result: 'failed', reason: 'article_html_missing' };
  const html = fs.readFileSync(articlePath, 'utf8');
  const articleText = X.htmlToText(html);
  const material = articleMaterial(html);

  const { plan, reason: planReason } = loadPlan(date, policy, now);
  if (plan) out.plan = plan; else if (planReason !== 'off') out.plan_skipped = planReason;

  const attempts = Math.max(1, Number(cfg.attempts) || 1);
  const timeoutMs = Math.max(10, Number(cfg.timeoutSec) || 150) * 1000;
  let previous = null;
  for (let i = 1; i <= attempts; i++) {
    const started = Date.now();
    const r = await call(args.claudeBin, buildPrompt({ root, entry, material, previous, plan }), timeoutMs);
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
    const draft = {
      version: 1,
      date,
      slug: entry.slug,
      type: reply.type,
      body: typeof reply.body === 'string' ? reply.body.trim() : reply.body,
      evidence: reply.evidence,
      ...(reply.replies !== undefined ? { replies: Array.isArray(reply.replies) ? reply.replies.map((x) => (typeof x === 'string' ? x.trim() : x)) : reply.replies } : {}),
      generated_at: now.toISOString(),
      generator: `claude --print（${PROMPT_REL}）`,
      ...(plan ? { plan: planRecord(plan, reply.type) } : {}),
    };
    const failures = checkAll(draft, { entry, policy, articleText, root });
    out.attempts.push({ i, seconds, reason: failures.join(' / ') || null });
    // 指定の型と違う型で通ったときは、最後の回でなければ1回書き直させる（最後の回は通った案を使い、followed:false で残す）
    if (!failures.length && plan && plan.nb_kind && reply.type !== plan.nb_kind && i < attempts) {
      out.attempts[out.attempts.length - 1].reason = `plan_kind_differs:${reply.type}`;
      previous = { reason: `指定の型 ${plan.nb_kind} と違う型（${reply.type}）で書かれた。記事に合う限り ${plan.nb_kind} で書き直す`, raw: JSON.stringify({ type: reply.type, body: reply.body, replies: reply.replies, evidence: reply.evidence }) };
      continue;
    }
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

module.exports = { loadPlan, planSection, planRecord, run, parseArgs, parseReply, articleMaterial, buildPrompt, checkAll, summary, callClaude };
