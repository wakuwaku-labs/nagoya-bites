#!/usr/bin/env node
'use strict';
/**
 * scripts/recheck_due_articles.js — 公開後の鮮度を見張る（媒体方針 計画 S5-5・ADR 0069）
 *
 * 公開した記事の中の事実が、公開後に古くなっていないかを、毎日少しずつ取り直して確かめる。
 *   拾う: 事実台帳（data/journal_claims）の「見直す日」（recheck_after）が来た記事。
 *         台帳の無い過去の記事は、本文から機械で取り出した事実の文に同じ規則（claims.recheckAfter）で見直す日をつけ、
 *         「開店前に書いたもの」「期間限定を扱ったもの」を先に、検索の表示が多い順に拾う。
 *   確かめる: 出典欄の URL を取り直し、本文の数字・日付・価格を照合する（verify_article_claims と同じ照合。台帳の無い記事の簡易版も同じ）。
 *   変わっていたら:
 *     軽い変更（題でない数字1か所が、出典のたった1つの値に変わった）… S4-4 の訂正の道具（journal_correct.js）で履歴つきの訂正案を作る。
 *     核心の変更（閉店・予定の言い切り・題の事実の食い違い・期間の終了・直し方が1つに決まらない）… 保留の課題（GitHub Issue）にする。
 *
 * 既定は「記録だけ」: 本番の記事は書き換えない。訂正案と保留の課題は data/article_recheck_log.json と Issue の材料（--report）に出すだけ。
 * 軽い訂正を自動で書くのは設定 recheck.mode=apply_light のときだけ（決定6: 本番の自動公開の条件は本人の再承認まで変えない）。
 * 設定は data/trust_metrics_policy.json の recheck。
 *
 *   node scripts/recheck_due_articles.js [--mode record|apply_light] [--max N] [--report <path>] [--no-write] [--slug <記事のパス>]
 * 終了コード: 0=動いた（見つけた変更の有無に関わらず）／1=見直す日が来た記事があるのに1本も見直せなかった・例外
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/claims');
const T = require('./trust_metrics');
const J = require('./journal_correct');

const ROOT = C.ROOT;
const LOG_REL = T.RECHECK_LOG_REL;

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 記事の基準日（見直す日の起点）。ジャーナルは日付つきのファイル名、特集は本文の確認日か構造化データの公開日 */
function baseDateOf(page, row) {
  if (page.date) return page.date;
  if (row && row.lastFactCheckedDate) return row.lastFactCheckedDate;
  const m = String(page.html).match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * 期間のある文の終わりの日（YYYY-MM-DD）。期間の言い回しが無ければ null。
 * 終わりと読むのは「◯月◯日（曜）まで／限定／終了／締切」の日と、「〜◯日」の範囲の終わりの日だけ（文中の日付すべてではない）。
 * 年は基準日の年（基準日の30日より前なら翌年）。
 */
function periodEnd(sentence, baseYmd) {
  const s = C.normText(sentence);
  const re = /(?:(\d{1,2})月)?(\d{1,2})日(?:[（(][^）)]{1,3}[）)])?/g;
  let month = null;
  let best = null;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m[1]) month = Number(m[1]);
    if (!month) continue;
    const before = s.slice(Math.max(0, m.index - 2), m.index);
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 6);
    const isEnd = /^\s*(?:まで|限定|終了(?!が早)|締切|締め切り|〆)/.test(after) || /[〜～~]\s*$/.test(before);
    if (isEnd) best = { month, day: Number(m[2]) };
  }
  if (!best) return null;
  const y = Number(baseYmd.slice(0, 4));
  let c = new Date(Date.UTC(y, best.month - 1, best.day));
  if (c.getTime() < Date.parse(`${baseYmd}T00:00:00Z`) - 30 * 86400000) c = new Date(Date.UTC(y + 1, best.month - 1, best.day));
  return c.toISOString().slice(0, 10);
}

/** 数字の見た目（桁区切りがあれば付ける） */
function formatLike(original, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return /,/.test(original) ? n.toLocaleString('en-US') : String(n);
}

/**
 * 食い違いの文から、訂正の道具に渡せる1か所の置き換えを作る。作れなければ null（核心の変更として保留へ）。
 * 条件: 食い違う札が1つだけ・整数の価格や数・出典の同じ項目の値がただ1つ・記事の HTML の中でその数字が1か所だけ。
 */
function proposeFix(html, claim, pool) {
  if (!claim || claim.status !== '食い違い' || !Array.isArray(claim.missing) || claim.missing.length !== 1) return null;
  const tok = C.claimTokens(claim.text).find((t) => t.raw === claim.missing[0]);
  if (!tok || tok.kind !== 'num' || !/^\d+$/.test(tok.key)) return null;
  const ctx = C.contextWord(claim.text, tok);
  const unit = C.unitAfter(claim.text, tok);
  if (ctx.length < 3 || !unit) return null;
  const found = new Set();
  for (const p of pool.filter((x) => x.ok && x.text)) C.numbersAfterContext(ctx, tok, p.text, unit).forEach((v) => found.add(v));
  if (found.size !== 1) return null;
  const next = [...found][0];
  if (!/^\d+$/.test(next) || next === tok.key) return null;
  const numPat = tok.key.split('').join(',?');
  const re = new RegExp(`(${esc(ctx)}[^<>。\\d]{0,8})(${numPat})(${esc(unit)})`, 'g');
  const hits = [...String(html).matchAll(re)];
  if (hits.length !== 1) return null;
  const m = hits[0];
  const find = m[0];
  if (String(html).split(find).length - 1 !== 1) return null;
  const replace = `${m[1]}${formatLike(m[2], next)}${m[3]}`;
  return { find, replace, from: m[2] + m[3], to: formatLike(m[2], next) + m[3], ctx, source_url: claim.source ? claim.source.url : null };
}

/** 次の見直す日。事実の文ごとの見直す日（claims.recheckAfter）の一番早い日。最短でも min_interval_days 先。 */
function nextDueFor(sentences, baseYmd, today, rc) {
  const ds = sentences.map((s) => C.recheckAfter(s, today)).filter(Boolean).sort();
  const floor = addDays(today, rc.min_interval_days || 30);
  return ds.length && ds[0] > floor ? ds[0] : floor;
}

/** 候補（見直す日が来た記事）を数え、優先の順に並べる */
function collectCandidates({ root, today, pages, ledgers, state, rows, rc }) {
  const rowBy = new Map(rows.map((r) => [r.path, r]));
  const ledgerBy = new Map();
  for (const l of ledgers) if (l.slug) ledgerBy.set(`journal/${l.slug}.html`, l);
  const preOpen = new RegExp(rc.legacy_pre_open || '(?!)');
  const limited = new RegExp(rc.legacy_limited || '(?!)');
  const out = [];
  let noBase = 0;
  for (const p of pages) {
    const st = state[p.rel] || null;
    const l = ledgerBy.get(p.rel) || null;
    let due = null;
    let sentences = [];
    const base = baseDateOf(p, rowBy.get(p.rel));
    if (st && st.next_due) {
      due = st.next_due;
    } else if (l) {
      const cl = (l.claims || []).filter((c) => c.kind !== '未確認');
      sentences = cl.map((c) => c.text);
      const ds = cl.map((c) => c.recheck_after).filter(Boolean).sort();
      due = ds[0] || null;
    } else {
      if (!base) { noBase++; continue; }
      sentences = C.extractClaimSentences(p.html);
      const ds = sentences.map((s) => C.recheckAfter(s, base)).filter(Boolean).sort();
      due = ds[0] || null;
    }
    if (!due || due > today) continue;
    const text = T.visibleText(p.html);
    let reason = l ? 'ledger_due' : 'due';
    if (!l && preOpen.test(text)) reason = 'pre_open';
    else if (!l && limited.test(text)) reason = 'limited';
    const rank = { pre_open: 0, limited: 1, ledger_due: 2, due: 3 }[reason];
    out.push({ page: p, due, reason, rank, ledger: l, impressions: (rowBy.get(p.rel) || {}).searchImpressions28d || 0, base: base || today });
  }
  out.sort((a, b) => a.rank - b.rank || b.impressions - a.impressions || a.due.localeCompare(b.due) || a.page.rel.localeCompare(b.page.rel));
  return { list: out, noBase };
}

/** 1本を見直す。返り値: { facts, verified, unverifiable, mismatch, findings[], sources:{ok,total} } */
async function recheckOne(cand, { root, today, fetcher, rc, gate }) {
  const { page, ledger } = cand;
  const sources = C.extractSources(page.html).slice(0, gate.maxSources);
  const pool = [];
  for (const s of sources) {
    const r = await fetcher(s.url);
    pool.push({ ...s, ok: !!r.ok, text: r.ok ? r.text : '', fetched_at: new Date().toISOString(), reason: r.ok ? null : r.reason || 'unknown' });
  }
  const useLedger = ledger && Array.isArray(ledger.claims) && ledger.claims.length ? { claims: ledger.claims.map((c) => ({ text: c.text, kind: c.kind })) } : null;
  const v = C.verifyArticle(page.html, { date: today, pool, root, ledger: useLedger });
  const eligible = v.claims.filter((c) => c.kind === '確認済みの事実');
  const res = {
    facts: eligible.length,
    verified: eligible.filter((c) => c.status === '照合できた').length,
    unverifiable: eligible.filter((c) => c.status === '取得できず照合不能').length,
    mismatch: eligible.filter((c) => c.status === '食い違い').length,
    sources: { ok: pool.filter((p) => p.ok).length, total: pool.length },
    findings: [],
    sentences: v.claims.filter((c) => c.kind !== '未確認').map((c) => c.text),
  };
  const core = new Set(rc.core_types || []);
  const push = (f) => { if (f.severity === 'light' || core.has(f.type)) res.findings.push(f); };
  for (const i of v.issues) {
    if (['store_closed', 'source_says_closed', 'hedge_dropped'].includes(i.type)) push({ type: i.type, severity: 'core', detail: i.detail });
  }
  for (const c of v.claims.filter((x) => x.status === '食い違い')) {
    if (c.pillar) { push({ type: 'number_mismatch_pillar', severity: 'core', detail: `題にある事実が出典と食い違う: ${(c.contradictions || []).join(' ／ ')}: ${c.text.slice(0, 60)}`, claim: c.text.slice(0, 120) }); continue; }
    const fix = page.kind === 'journal' ? proposeFix(page.html, c, pool) : null;
    if (fix) {
      const dry = J.run({ slug: page.slug, summary: `公開後の再確認で、出典の「${fix.ctx}」が${fix.to}に変わっていたため、${fix.from}から修正`, edits: [{ find: fix.find, replace: fix.replace }], yes: false, rebuild: false, root, now: new Date(`${today}T03:00:00Z`), by: 'recheck' });
      if (dry.ok) { push({ type: 'number_light', severity: 'light', detail: `出典の「${fix.ctx}」が ${fix.from} → ${fix.to}`, proposal: { slug: page.slug, summary: dry.record.summary, find: fix.find, replace: fix.replace, source_url: fix.source_url } }); continue; }
    }
    push({ type: 'number_mismatch_ambiguous', severity: 'core', detail: `出典と数字が違うが、直し方が1つに決まらない（${(c.contradictions || []).join(' ／ ')}）: ${c.text.slice(0, 60)}`, claim: c.text.slice(0, 120) });
  }
  for (const s of new Set(res.sentences)) {
    const end = periodEnd(s, cand.base);
    if (end && end < today) push({ type: 'period_ended', severity: 'core', detail: `期間の終わり（${end}）を過ぎた記述: ${s.slice(0, 60)}`, claim: s.slice(0, 120) });
  }
  return res;
}

function overdueSummary(list, today, processedRels) {
  const left = list.filter((c) => !processedRels.has(c.page.rel));
  const oldest = (xs) => xs.map((c) => T.daysBetween(c.due, today)).filter((n) => n !== null).sort((a, b) => b - a)[0] || 0;
  const led = left.filter((c) => c.ledger);
  const legacy = left.filter((c) => !c.ledger);
  // 台帳のある記事（毎日追いつける量）は古さを見張る。台帳の無い過去の記事（初回は約200本）は消化の進みとして数える
  return { overdue: left.length, overdue_ledger: led.length, oldest_overdue_ledger_days: led.length ? oldest(led) : 0, overdue_legacy: legacy.length, oldest_overdue_legacy_days: legacy.length ? oldest(legacy) : 0 };
}

/** 1本の記事・1種類の変更ごとに1件の課題（同じ種類の複数の箇所は1件にまとめる） */
function alertFor(rel, type, fs_, today) {
  const url = `https://nagoya-bites.com/${rel}`;
  const key = `recheck:${rel}:${type}`;
  const light = fs_.every((f) => f.proposal);
  const lines = [`公開後の鮮度の見直し（${today}）で、記事の事実が古くなっている可能性を見つけました。`, '', `- 記事: ${url}（\`${rel}\`）`, `- 種類: \`${type}\`（${fs_.length}件）`];
  for (const f of fs_) {
    lines.push(`- 内容: ${f.detail}`);
    if (f.claim) lines.push(`  - 該当の文: ${f.claim}`);
  }
  lines.push('');
  if (light) {
    lines.push('## 訂正案（軽い変更・まだ書いていません）');
    for (const { proposal: p } of fs_) {
      lines.push(`- 訂正の履歴に残す文: ${p.summary}`);
      lines.push(`- 置き換え: 「${p.find}」→「${p.replace}」${p.source_url ? `（出典: ${p.source_url}）` : ''}`);
    }
    lines.push('', '出典を目で確かめ、合っていれば次を実行すると、訂正の履歴つきで書き換わります（本番の記事の自動書き換えは、本人の再承認まで入れていません）。', '```bash');
    for (const { proposal: p } of fs_) lines.push(`node scripts/journal_correct.js --slug ${p.slug} --summary ${JSON.stringify(p.summary)} --find ${JSON.stringify(p.find)} --replace ${JSON.stringify(p.replace)} --yes`);
    lines.push('```');
  } else {
    lines.push('## 対処（核心の変更・保留）', '1. 出典を開いて、記事の内容が今も合っているか確かめる。', '2. 直せるなら訂正の道具で履歴つきに直す: `node scripts/journal_correct.js --slug <slug> --summary "…" --find "…" --replace "…" --yes`（特集は手で直し、記事に確認日を足す）。', '3. 公開を続けられない内容なら取り下げる: `node scripts/journal_withdraw.js --slug <slug> --reason "…" --yes`。', '4. 直したあと、この Issue を閉じる（次の見直しは14日以降）。');
  }
  lines.push('', '---', 'この Issue は `scripts/recheck_due_articles.js`（夜間の検査に相乗り）が起票しました。人が見ないと直らない内容だけを出しています。');
  return { key, rel, type, severity: light ? 'light' : 'core', title: `🟡 公開後の見直し: ${light ? '訂正案' : '保留'}（${rel}・${type}）`, body: lines.join('\n') };
}

async function run({ root = ROOT, now = new Date(), mode = null, maxPerRun = null, fetcher = null, pages = null, ledgers = null, reviewRows = null, write = true, only = null, rebuild = true } = {}) {
  const policy = T.loadPolicy(root);
  const rc = policy.recheck || {};
  const runMode = mode || rc.mode || 'record';
  const today = T.jstDate(now);
  const max = maxPerRun || rc.max_per_run || 3;
  const gate = require('./verify_article_claims').loadGate(root);
  const fetchImpl = fetcher || ((u) => C.fetchSourceLive(u, { timeoutMs: gate.fetchTimeoutSec * 1000 }));
  const logFile = path.join(root, LOG_REL);
  const log = T.readJson(logFile, null) || { version: 1, articles: {} };
  if (!log.articles) log.articles = {};
  const pg = pages || T.loadPages(root);
  const lg = ledgers || T.loadLedgers(root);
  const rows = reviewRows || require('./build_article_review_ledger').build({ root, today: now }).articles;
  const { list, noBase } = collectCandidates({ root, today, pages: pg, ledgers: lg, state: log.articles, rows, rc });
  const targets = only ? list.filter((c) => c.page.rel === only) : list;
  const picked = targets.slice(0, max);
  const done = new Set();
  const applied = [];
  for (const cand of picked) {
    const rel = cand.page.rel;
    let r;
    try {
      r = await recheckOne(cand, { root, today, fetcher: fetchImpl, rc, gate });
    } catch (e) {
      log.articles[rel] = { ...(log.articles[rel] || {}), last_checked: today, outcome: 'error', error: String(e.message).slice(0, 200), next_due: addDays(today, rc.cooldown_days || 14) };
      done.add(rel);
      continue;
    }
    const prev = log.articles[rel] || {};
    const prevFindings = (prev.findings || []);
    const findings = r.findings.map((f) => {
      const old = prevFindings.find((p) => p.type === f.type && p.detail === f.detail);
      return { ...f, reported_at: old ? old.reported_at || null : null };
    });
    if (runMode === 'apply_light') {
      for (const f of findings.filter((x) => x.severity === 'light' && x.proposal)) {
        const p = f.proposal;
        const res = J.run({ slug: p.slug, summary: p.summary, edits: [{ find: p.find, replace: p.replace }], yes: true, rebuild, root, now, by: 'recheck' });
        f.applied = res.ok ? res.code : `failed:${res.code}`;
        if (res.ok) applied.push({ rel, slug: p.slug, summary: p.summary });
      }
    }
    const hasFinding = findings.length > 0;
    const sentences = r.sentences;
    log.articles[rel] = {
      last_checked: today,
      last_checked_at: now.toISOString(),
      outcome: hasFinding ? 'findings' : (r.sources.total === 0 ? 'no_sources' : (r.sources.ok === 0 ? 'sources_unreachable' : 'ok')),
      reason: cand.reason,
      basis: cand.ledger ? 'ledger' : 'machine',
      facts: r.facts, verified: r.verified, unverifiable: r.unverifiable, mismatch: r.mismatch,
      sources: r.sources,
      findings,
      next_due: hasFinding || r.sources.ok === 0 ? addDays(today, rc.cooldown_days || 14) : nextDueFor(sentences, cand.base, today, rc),
    };
    done.add(rel);
  }
  // 課題にする材料: まだ報告していない核心の変更・訂正案を、検索の表示が多い順に max_issues_per_run 件まで
  const impr = new Map(rows.map((r) => [r.path, r.searchImpressions28d || 0]));
  const groups = new Map();
  for (const [rel, st] of Object.entries(log.articles)) {
    for (const f of st.findings || []) {
      if (f.reported_at || f.applied) continue;
      const k = `${rel}\u0000${f.type}`;
      if (!groups.has(k)) groups.set(k, { rel, type: f.type, items: [] });
      groups.get(k).items.push(f);
    }
  }
  const pending = [...groups.values()].sort((a, b) => (impr.get(b.rel) || 0) - (impr.get(a.rel) || 0) || a.rel.localeCompare(b.rel) || a.type.localeCompare(b.type));
  const alerts = [];
  for (const g of pending.slice(0, rc.max_issues_per_run || 3)) {
    alerts.push(alertFor(g.rel, g.type, g.items, today));
    for (const f of g.items) f.reported_at = today;
  }
  const od = overdueSummary(list, today, done);
  const summary = { ...od, due_total: list.length, no_base_date: noBase, pending_findings: Math.max(0, pending.length - alerts.length) };
  log.summary = summary;
  log.last_run = { date: today, at: now.toISOString(), mode: runMode, due: list.length, processed: done.size, alerts: alerts.length, applied: applied.length };
  log._README = '公開後の鮮度の見直し（S5-5）の記録。scripts/recheck_due_articles.js が毎日の夜間の検査で更新する。articles は記事のパスごとの直近の結果（次の見直す日・照合の件数・見つけた変更）。根拠確認率（trust_metrics）はここの facts/verified も読む。';
  if (write) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, `${JSON.stringify(log, null, 1)}\n`);
  }
  const problem = list.length > 0 && done.size === 0 ? `見直す日が来た記事が ${list.length} 本あるのに、1本も見直せませんでした` : null;
  return { today, mode: runMode, due: list.length, processed: [...done], alerts, applied, summary, problem, log };
}

function parseArgs(argv) {
  const a = { write: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--mode') a.mode = argv[++i];
    else if (k === '--max') a.maxPerRun = parseInt(argv[++i], 10);
    else if (k === '--report') a.report = argv[++i];
    else if (k === '--no-write') a.write = false;
    else if (k === '--slug') a.only = argv[++i];
  }
  return a;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const r = await run({ mode: a.mode, maxPerRun: a.maxPerRun, write: a.write, only: a.only });
  if (a.report) fs.writeFileSync(a.report, `${JSON.stringify({ today: r.today, mode: r.mode, due: r.due, processed: r.processed, alerts: r.alerts, applied: r.applied, summary: r.summary, problem: r.problem }, null, 1)}\n`);
  console.log(`公開後の鮮度の見直し（${r.mode}）: 見直す日が来た記事 ${r.due} 本・見直した ${r.processed.length} 本・課題の材料 ${r.alerts.length} 件・書き換え ${r.applied.length} 件／期限切れの残り ${r.summary.overdue} 本`);
  for (const al of r.alerts) console.log(`  [課題] ${al.title}`);
  if (r.problem) { console.error(r.problem); process.exit(1); }
}

if (require.main === module) {
  main().catch((e) => { console.error(`recheck_due_articles 失敗: ${e.stack || e.message}`); process.exit(1); });
}

module.exports = { run, collectCandidates, recheckOne, proposeFix, periodEnd, nextDueFor, alertFor, baseDateOf, parseArgs };
