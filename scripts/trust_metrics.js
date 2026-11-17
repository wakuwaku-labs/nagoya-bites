#!/usr/bin/env node
'use strict';
/**
 * scripts/trust_metrics.js — 信頼の指標を自動で数える（媒体方針 計画 S7-1・ADR 0069）
 *
 * 計画 1-7 の上から5つを、台帳と記事の構造から機械で数える。自己申告値は使わない（CLAUDE.md 制約10）。
 *   1 根拠確認率        照合できた事実の文 ÷ 事実の文（事実台帳 data/journal_claims・公開後の見直し data/article_recheck_log.json）
 *   2 未確認の明示率    「確認できなかったこと」を書いている記事 ÷ 公開記事（記事の構造）
 *   3 誤情報の発生率    公開から90日の記事のうち、訂正・取り下げがある記事 ÷ その記事（data/journal_published.json の corrections）
 *   4 更新鮮度          検索に出ている記事のうち、本文の確認日が90日以内の割合（棚卸し台帳 S5-1 と同じ読み方）
 *   5 独自分析の充実度  比較・計算・一般則のどれかを持つ記事の割合（記事の構造）
 * あわせて「事実の文の数」そのものも並べる。率を良くするために事実の文を減らす動機を作らないため（計画 S7-1 ⑨）。
 *
 * 台帳の無い記事は 0 とも 100 とも数えず、数えた記事の数（measured）を並べる。
 * 設定（期間・型・悪化の線）は data/trust_metrics_policy.json。結果は data/trust_metrics.json（週のレポートが読む）。
 *
 *   node scripts/trust_metrics.js            # 数えて表示だけ
 *   node scripts/trust_metrics.js --write    # data/trust_metrics.json を更新（履歴は週1回足す）
 *   node scripts/trust_metrics.js --json     # 結果の JSON を標準出力へ
 */
const fs = require('fs');
const path = require('path');
const { listPublishedPages } = require('./lib/published_pages');
const { isPublic } = require('./lib/journal_category');
const C = require('./lib/claims');

const ROOT = path.resolve(__dirname, '..');
const OUT_REL = 'data/trust_metrics.json';
const POLICY_REL = 'data/trust_metrics_policy.json';
const RECHECK_LOG_REL = 'data/article_recheck_log.json';
// 来店前に重要でない文など、出典で確かめる対象にしない文（claims.js・S4-5）。分母に入れない
const NA_STATUS = '照合対象外';

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function loadPolicy(root = ROOT) { return readJson(path.join(root, POLICY_REL), {}); }

/** JST の YYYY-MM-DD */
function jstDate(now = new Date()) { return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10); }

function daysBetween(fromYmd, toYmd) {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : null;
}

const ratio = (n, d) => (d > 0 ? Math.round((n / d) * 10000) / 10000 : null);

/** 本文の見える部分（script・style・コメントを除く） */
function visibleText(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/** 記事の本文のHTML（題の見出し〜記事の終わり）。ほかの記事への案内・フッターは含めない（claims.articleBodyText と同じ範囲） */
function bodyHtml(html) {
  let s = String(html || '');
  const a = s.search(/<h1[^>]*class="art-title"/);
  if (a >= 0) s = s.slice(a);
  const b = s.search(/<!-- NB_X_FOLLOW_START -->|<\/article>/);
  return b >= 0 ? s.slice(0, b) : s;
}

// ── 入力の読み込み ────────────────────────────────────────────────────
/** 公開中の記事（特集・ジャーナル）。取り下げた記事は数えない。 */
function loadPages(root = ROOT) {
  const pub = readJson(path.join(root, 'data', 'journal_published.json'), { entries: [] });
  const bySlug = new Map((pub.entries || []).map((e) => [e.slug, e]));
  const out = [];
  for (const p of listPublishedPages({ root })) {
    if ((p.type !== 'feature' && p.type !== 'journal') || /\/index\.html$/.test(p.rel)) continue;
    const slug = p.type === 'journal' ? path.basename(p.rel, '.html') : null;
    const entry = slug ? bySlug.get(slug) : null;
    if (entry && !isPublic(entry)) continue;
    const dateM = p.rel.match(/(\d{4}-\d{2}-\d{2})/);
    out.push({ rel: p.rel, kind: p.type, slug, date: dateM ? dateM[1] : null, html: fs.readFileSync(p.abs, 'utf8') });
  }
  return out;
}

/** 事実台帳（<日付>.json）。<日付>.ledger.json（書き手の入力）と <日付>.review.json（読み手の所見）は台帳ではない。 */
function loadLedgers(root = ROOT) {
  const dir = path.join(root, 'data', 'journal_claims');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => readJson(path.join(dir, f), null))
    .filter((l) => l && Array.isArray(l.claims));
}

// ── 指標 ──────────────────────────────────────────────────────────────
/**
 * 1 根拠確認率。記事ごとに（台帳と、公開後の見直しの新しい方）から数え、全体は事実の文の合計で割る。
 * 事実の文が0の記事は率を持たない（測定の対象に入れない）。
 */
function computeEvidence({ ledgers, recheckArticles = {}, pages, policy }) {
  const ev = (policy && policy.evidence) || {};
  const kind = ev.eligible_kind || '確認済みの事実';
  const okStatus = ev.verified_status || '照合できた';
  const pageSet = new Set(pages.map((p) => p.rel));
  const per = new Map(); // rel -> { facts, verified, mismatch, at, basis }
  for (const l of ledgers) {
    const rel = l.slug ? `journal/${l.slug}.html` : null;
    if (!rel || !pageSet.has(rel)) continue;
    const el = (l.claims || []).filter((c) => c.kind === kind && c.status !== NA_STATUS);
    per.set(rel, { facts: el.length, verified: el.filter((c) => c.status === okStatus).length, mismatch: el.filter((c) => c.status === '食い違い').length, at: l.generated_at || l.date || '', basis: 'ledger' });
  }
  for (const [rel, r] of Object.entries(recheckArticles)) {
    if (!pageSet.has(rel) || !r || !Number.isFinite(r.facts)) continue;
    const cur = per.get(rel);
    if (!cur || String(r.last_checked_at || r.last_checked || '') > String(cur.at)) {
      per.set(rel, { facts: r.facts, verified: r.verified || 0, mismatch: r.mismatch || 0, at: r.last_checked_at || r.last_checked || '', basis: 'recheck' });
    }
  }
  const rows = [...per.values()].filter((r) => r.facts > 0);
  const facts = rows.reduce((n, r) => n + r.facts, 0);
  const verified = rows.reduce((n, r) => n + r.verified, 0);
  const perRates = rows.map((r) => r.verified / r.facts);
  return {
    value: ratio(verified, facts),
    numerator: verified,
    denominator: facts,
    measured_articles: rows.length,
    public_articles: pages.length,
    article_mean: perRates.length ? Math.round((perRates.reduce((a, b) => a + b, 0) / perRates.length) * 10000) / 10000 : null,
    mismatch_facts: rows.reduce((n, r) => n + r.mismatch, 0),
    facts_per_article: rows.length ? Math.round((facts / rows.length) * 10) / 10 : null,
    note: rows.length ? '台帳のある記事だけ。台帳の無い記事は数えていない（measured_articles が数えた本数）' : '台帳のある記事がまだ無い（事実台帳は新しい記事から貯まる）',
  };
}

/** 記事に「確認できなかったこと」の明示があるか（札のクラス、または見出しの語） */
function hasUnconfirmedDisclosure(html, markers) {
  const text = visibleText(bodyHtml(html));
  return (markers || []).some((m) => (/^[a-z][\w-]*$/.test(m)
    ? new RegExp(`class="[^"]*\\b${m}\\b`).test(bodyHtml(html))
    : text.includes(m)));
}

function computeUnconfirmed({ pages, today, policy }) {
  const markers = (policy.unconfirmed && policy.unconfirmed.markers) || [];
  const recentDays = (policy.windows && policy.windows.recent_days) || 30;
  const flags = pages.map((p) => ({ p, has: hasUnconfirmedDisclosure(p.html, markers) }));
  const n = flags.filter((f) => f.has).length;
  const recent = flags.filter((f) => f.p.date && daysBetween(f.p.date, today) !== null && daysBetween(f.p.date, today) <= recentDays);
  return {
    value: ratio(n, pages.length),
    numerator: n,
    denominator: pages.length,
    measured_articles: pages.length,
    public_articles: pages.length,
    recent: { days: recentDays, numerator: recent.filter((f) => f.has).length, denominator: recent.length, value: ratio(recent.filter((f) => f.has).length, recent.length) },
    note: '「確認できなかったこと」の札または見出しがある記事。全項目を確認できた記事も「なし」になる（計画 1-7 の数え方のまま）',
  };
}

/** 3 誤情報の発生率。公開から correction_days 日以内の記事のうち、公開後に訂正・取り下げがある記事。 */
function computeMisinformation({ published, today, policy }) {
  const days = (policy.windows && policy.windows.correction_days) || 90;
  const entries = (published && published.entries) || [];
  const isFix = (c) => c && (c.kind === 'correction' || c.kind === 'withdrawal');
  const fixed = (e) => e.status === 'withdrawn' || (e.corrections || []).some(isFix);
  const cohort = entries.filter((e) => e.date && daysBetween(e.date, today) !== null && daysBetween(e.date, today) >= 0 && daysBetween(e.date, today) <= days);
  const hit = cohort.filter(fixed);
  const events = entries.filter((e) => (e.corrections || []).some((c) => isFix(c) && c.at && daysBetween(String(c.at).slice(0, 10), today) !== null && daysBetween(String(c.at).slice(0, 10), today) <= days));
  return {
    value: ratio(hit.length, cohort.length),
    numerator: hit.length,
    denominator: cohort.length,
    measured_articles: cohort.length,
    public_articles: entries.length,
    window_days: days,
    events_in_window: events.length,
    note: `公開から${days}日以内のジャーナル記事のうち、訂正・取り下げの記録がある記事。events_in_window は直近${days}日に訂正・取り下げの記録がついた記事の本数（古い記事の見直しで見つけたものも入る）。特集は訂正の台帳が無く対象外`,
  };
}

/** 4 更新鮮度。検索に出ている（直近28日の表示が1以上）記事のうち、確認日が fresh_days 日以内。 */
function computeFreshness({ rows, today, policy }) {
  const fresh = (policy.windows && policy.windows.fresh_days) || 90;
  const shown = rows.filter((r) => r.searchImpressions28d > 0);
  const ok = shown.filter((r) => r.lastFactCheckedDate && daysBetween(r.lastFactCheckedDate, today) !== null && daysBetween(r.lastFactCheckedDate, today) <= fresh);
  return {
    value: ratio(ok.length, shown.length),
    numerator: ok.length,
    denominator: shown.length,
    measured_articles: shown.length,
    public_articles: rows.length,
    window_days: fresh,
    no_confirm_date: shown.filter((r) => !r.lastFactCheckedDate).length,
    note: `検索に出ている記事のうち、本文の確認日が${fresh}日以内の割合。確認日の無い記事は鮮度なしとして数える（棚卸し台帳 S5-1 と同じ読み方）`,
  };
}

/** 5 独自分析の充実度 */
function analysisFlags(html, policy) {
  const oa = policy.original_analysis || {};
  const body = bodyHtml(html);
  const text = visibleText(body);
  const re = (s, f) => (s ? new RegExp(s, f) : null);
  const calc = re(oa.calculation);
  const phrase = re(oa.comparison_phrase);
  const table = re(oa.comparison_table, 'i');
  const rule = re(oa.general_rule);
  return {
    calculation: !!(calc && calc.test(text)),
    comparison: !!((table && table.test(body)) || (phrase && phrase.test(text))),
    general_rule: !!(rule && rule.test(text)),
  };
}

function computeAnalysis({ pages, policy }) {
  const per = pages.map((p) => analysisFlags(p.html, policy));
  const any = per.filter((f) => f.calculation || f.comparison || f.general_rule).length;
  return {
    value: ratio(any, pages.length),
    numerator: any,
    denominator: pages.length,
    measured_articles: pages.length,
    public_articles: pages.length,
    breakdown: {
      calculation: per.filter((f) => f.calculation).length,
      comparison: per.filter((f) => f.comparison).length,
      general_rule: per.filter((f) => f.general_rule).length,
    },
    note: '式・比較（表または比べる言い回し）・一般則の言い回しのどれかがある記事。機械が見つけられる形だけを数え、質は毎月10本の読み手の所見で見る',
  };
}

/** 事実の文の数そのもの（率を良くするために事実の文を減らす動機を作らない）。全記事を機械で数える。 */
function computeFactSentences({ pages, evidence }) {
  const counts = pages.map((p) => C.extractClaimSentences(p.html).length);
  const total = counts.reduce((a, b) => a + b, 0);
  return {
    articles: pages.length,
    total,
    per_article_avg: pages.length ? Math.round((total / pages.length) * 10) / 10 : null,
    ledger_facts: evidence.denominator,
    ledger_articles: evidence.measured_articles,
    note: '数字・日付・価格を含む文の数（記事の本文から機械で取り出す。台帳の事実の文とは別の数え方で、記事ごとの増減を見る）',
  };
}

/**
 * 読者の声（S7-2）。記事の末尾の部品から届いた声（data/feedback_log.json の source=article-widget）を数える。
 * 率は成果の条件にしない（回答が少ない）。「情報の誤り」の指摘は、公開後の誤りを見つける経路の1つなので件数だけ並べる。無ければ 0。
 */
function computeReaderVoice({ feedbackLog, today, policy }) {
  const days = (policy.windows && policy.windows.correction_days) || 90;
  const entries = ((feedbackLog && feedbackLog.entries) || []).filter((e) => e && e.source === 'article-widget' && e.date && daysBetween(e.date, today) !== null && daysBetween(e.date, today) <= days);
  return {
    window_days: days,
    recorded: entries.length,
    error_reports: entries.filter((e) => e.article_answer === 'error').length,
    could_not_decide: entries.filter((e) => e.article_answer === 'no').length,
    note: '記事の末尾の部品から届いて台帳に残った声（Formspree に届くのは ひとこと／誤りの指摘 があるときだけ）。はい／いいえの数は GA4 の article_feedback。率は成果の条件にしない',
  };
}

function summarizeRecheck(log) {
  if (!log) return null;
  return { last_run: log.last_run || null, summary: log.summary || null };
}

function compute({ root = ROOT, now = new Date(), pages = null, ledgers = null, reviewRows = null, published = null, recheckLog = null, feedbackLog = null, policy = null } = {}) {
  const pol = policy || loadPolicy(root);
  const today = jstDate(now);
  const pg = pages || loadPages(root);
  const lg = ledgers || loadLedgers(root);
  const pub = published || readJson(path.join(root, 'data', 'journal_published.json'), { entries: [] });
  const rlog = recheckLog || readJson(path.join(root, RECHECK_LOG_REL), null);
  const fblog = feedbackLog || readJson(path.join(root, 'data', 'feedback_log.json'), { entries: [] });
  let rows = reviewRows;
  if (!rows) {
    rows = require('./build_article_review_ledger').build({ root, today: now }).articles;
  }
  const pageSet = new Set(pg.map((p) => p.rel));
  rows = rows.filter((r) => pageSet.has(r.path)).map((r) => ({ ...r }));
  const evidence = computeEvidence({ ledgers: lg, recheckArticles: (rlog && rlog.articles) || {}, pages: pg, policy: pol });
  const indicators = {
    evidence_rate: evidence,
    unconfirmed_disclosure_rate: computeUnconfirmed({ pages: pg, today, policy: pol }),
    misinformation_rate: computeMisinformation({ published: pub, today, policy: pol }),
    freshness_rate: computeFreshness({ rows, today, policy: pol }),
    analysis_rate: computeAnalysis({ pages: pg, policy: pol }),
  };
  return {
    date: today,
    generated_at: now.toISOString(),
    policy_version: pol.version || null,
    indicators,
    fact_sentences: computeFactSentences({ pages: pg, evidence }),
    reader_voice: computeReaderVoice({ feedbackLog: fblog, today, policy: pol }),
    recheck: summarizeRecheck(rlog),
  };
}

/** 履歴に残す1行（値だけ。記事の中身は持たない） */
function snapshot(m) {
  const v = (k) => m.indicators[k].value;
  return {
    date: m.date,
    evidence_rate: v('evidence_rate'),
    unconfirmed_disclosure_rate: v('unconfirmed_disclosure_rate'),
    misinformation_rate: v('misinformation_rate'),
    misinformation_events: m.indicators.misinformation_rate.events_in_window,
    freshness_rate: v('freshness_rate'),
    analysis_rate: v('analysis_rate'),
    fact_per_article_avg: m.fact_sentences.per_article_avg,
    evidence_measured: m.indicators.evidence_rate.measured_articles,
  };
}

/** 既存の出力と合わせて書く内容を作る。履歴は、最後の記録から7日以上たったときに1行足す。 */
function withHistory(m, prev, policy) {
  const keep = (policy.alert && policy.alert.history_keep) || 26;
  const history = Array.isArray(prev && prev.history) ? prev.history.slice() : [];
  const last = history[history.length - 1];
  if (!last || (daysBetween(last.date, m.date) !== null && daysBetween(last.date, m.date) >= 7)) history.push(snapshot(m));
  return { _README: 'S7-1 信頼の指標（scripts/trust_metrics.js が毎日作る。週のレポート GAS が読む）。設定は data/trust_metrics_policy.json。history は7日ごとの記録（悪化の見張りが前の週と比べるのに使う）。', ...m, history: history.slice(-keep) };
}

const pct = (v) => (v === null || v === undefined ? '未計測' : `${Math.round(v * 1000) / 10}%`);

function summaryLines(m) {
  const i = m.indicators;
  return [
    `根拠確認率: ${pct(i.evidence_rate.value)}（事実の文 ${i.evidence_rate.numerator}/${i.evidence_rate.denominator}・台帳のある記事 ${i.evidence_rate.measured_articles}/${i.evidence_rate.public_articles}本）`,
    `未確認の明示率: ${pct(i.unconfirmed_disclosure_rate.value)}（${i.unconfirmed_disclosure_rate.numerator}/${i.unconfirmed_disclosure_rate.denominator}本）`,
    `誤情報の発生率: ${pct(i.misinformation_rate.value)}（公開${i.misinformation_rate.window_days}日の ${i.misinformation_rate.numerator}/${i.misinformation_rate.denominator}本・直近の訂正取り下げ ${i.misinformation_rate.events_in_window}本）`,
    `更新鮮度: ${pct(i.freshness_rate.value)}（検索に出ている ${i.freshness_rate.numerator}/${i.freshness_rate.denominator}本）`,
    `独自分析の充実度: ${pct(i.analysis_rate.value)}（${i.analysis_rate.numerator}/${i.analysis_rate.denominator}本）`,
    `読者の声: 情報の誤りの指摘 ${m.reader_voice.error_reports}件・決められなかった ${m.reader_voice.could_not_decide}件（${m.reader_voice.window_days}日）`,
    `事実の文の数: 全記事 ${m.fact_sentences.total}・1本あたり平均 ${m.fact_sentences.per_article_avg}`,
  ];
}

function main() {
  const argv = process.argv.slice(2);
  const root = ROOT;
  const policy = loadPolicy(root);
  const m = compute({ root, policy });
  if (argv.includes('--write')) {
    const prev = readJson(path.join(root, OUT_REL), null);
    const out = withHistory(m, prev, policy);
    fs.writeFileSync(path.join(root, OUT_REL), `${JSON.stringify(out, null, 1)}\n`);
    console.log(`信頼の指標を書きました: ${OUT_REL}（${m.date}）`);
  }
  if (argv.includes('--json')) console.log(JSON.stringify(m, null, 1));
  else for (const l of summaryLines(m)) console.log(l);
}

if (require.main === module) main();

module.exports = {
  ROOT, OUT_REL, POLICY_REL, RECHECK_LOG_REL, readJson, loadPolicy, jstDate, daysBetween, visibleText, loadPages, loadLedgers,
  computeEvidence, computeUnconfirmed, computeMisinformation, computeFreshness, computeAnalysis, computeFactSentences,
  hasUnconfirmedDisclosure, analysisFlags, bodyHtml, computeReaderVoice, NA_STATUS, compute, snapshot, withHistory, summaryLines, pct,
};
