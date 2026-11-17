'use strict';
// S7-1: 信頼の指標を自動で数える。手で数えた標本と一致すること・悪化の見張りが鳴る／鳴らない／静かになること・週のレポートの段落。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const T = require('../scripts/trust_metrics');
const H = require('../scripts/check_trust_metrics_health');
const policy = T.loadPolicy(ROOT);
const TODAY = new Date('2026-11-17T03:00:00Z'); // JST 2026-11-17

const page = (rel, body, date = null) => ({ rel, kind: rel.startsWith('features/') ? 'feature' : 'journal', slug: rel.startsWith('journal/') ? path.basename(rel, '.html') : null, date, html: `<html><body><nav>ほかの記事: 差額5,000円の読み方</nav><main><article><h1 class="art-title">題</h1>${body}</article></main></body></html>` });

// 手で数えた標本（5本）:
//   A 計算の式あり・「確認できなかった」の札あり   B 表（比較）あり   C 一般則の言い回し   D 何も無い（特集）   E 比べる言い回し・見出し「確認できなかったこと」
const PAGES = [
  page('journal/2026-11-10-a.html', '<p>コース3,850円＋飲み放題2,200円＝6,050円です。</p><span class="nb-check-state">確認できなかった</span>', '2026-11-10'),
  page('journal/2026-11-12-b.html', '<table><tr><th>店</th><th>価格</th></tr><tr><td>甲</td><td>5,000円</td></tr></table>', '2026-11-12'),
  page('journal/2026-10-01-c.html', '<p>一般に、件数が少ないと評価は振れやすい。</p>', '2026-10-01'),
  page('features/d.html', '<p>名古屋の居酒屋を紹介します。</p>'),
  page('journal/2026-11-15-e.html', '<h2>確認できなかったこと</h2><p>大衆酒場より1,050円安い。</p>', '2026-11-15'),
];

test('未確認の明示率: 札か見出しがある記事だけ数える（手で数えて 2/5。ナビの文言は数えない）', () => {
  const r = T.computeUnconfirmed({ pages: PAGES, today: '2026-11-17', policy });
  assert.strictEqual(r.numerator, 2);
  assert.strictEqual(r.denominator, 5);
  assert.strictEqual(r.value, 0.4);
  assert.deepStrictEqual({ n: r.recent.numerator, d: r.recent.denominator }, { n: 2, d: 3 }); // 30日以内のジャーナル: A・B・E
});

test('独自分析の充実度: 計算・比較・一般則のどれか（手で数えて 4/5・内訳は計算1・比較2・一般則1）。ナビの「差額」では数えない', () => {
  const r = T.computeAnalysis({ pages: PAGES, policy });
  assert.strictEqual(r.numerator, 4);
  assert.strictEqual(r.denominator, 5);
  assert.deepStrictEqual(r.breakdown, { calculation: 1, comparison: 2, general_rule: 1 });
  // D はナビに「差額」があっても本文に無いので数えない
  assert.deepStrictEqual(T.analysisFlags(PAGES[3].html, policy), { calculation: false, comparison: false, general_rule: false });
});

test('誤情報の発生率: 公開90日のうち訂正・取り下げがある記事（restore だけは数えない）。90日より古い記事の見直しは events に出る', () => {
  const published = { entries: [
    { slug: 'a', date: '2026-11-10', corrections: [{ kind: 'correction', at: '2026-11-16T01:00:00Z' }] },
    { slug: 'b', date: '2026-11-12', corrections: [{ kind: 'restore', at: '2026-11-13T01:00:00Z' }] },
    { slug: 'c', date: '2026-10-01', status: 'withdrawn', corrections: [{ kind: 'withdrawal', at: '2026-10-20T01:00:00Z' }] },
    { slug: 'e', date: '2026-11-15' },
    { slug: 'f', date: '2026-06-01', corrections: [{ kind: 'correction', at: '2026-11-01T01:00:00Z' }] },
  ] };
  const r = T.computeMisinformation({ published, today: '2026-11-17', policy });
  assert.deepStrictEqual({ n: r.numerator, d: r.denominator, v: r.value }, { n: 2, d: 4, v: 0.5 });
  assert.strictEqual(r.events_in_window, 3); // a・c・f
});

test('更新鮮度: 検索に出ている記事のうち確認日が90日以内（確認日なしは鮮度なし。表示0の記事は数えない）', () => {
  const rows = [
    { path: 'a', searchImpressions28d: 10, lastFactCheckedDate: '2026-10-20' },
    { path: 'b', searchImpressions28d: 5, lastFactCheckedDate: '2026-05-01' },
    { path: 'c', searchImpressions28d: 3, lastFactCheckedDate: null },
    { path: 'd', searchImpressions28d: 0, lastFactCheckedDate: '2026-11-01' },
  ];
  const r = T.computeFreshness({ rows, today: '2026-11-17', policy });
  assert.deepStrictEqual({ n: r.numerator, d: r.denominator, noDate: r.no_confirm_date }, { n: 1, d: 3, noDate: 1 });
});

test('根拠確認率: 台帳の「確認済みの事実」だけを数える・台帳の無い記事は数えない・公開後の見直しが新しければそちらを使う', () => {
  const led = (slug, claims, at = '2026-11-10T00:00:00Z') => ({ slug, date: at.slice(0, 10), generated_at: at, claims });
  const c = (kind, status) => ({ kind, status });
  const ledgers = [
    led('2026-11-10-a', [c('確認済みの事実', '照合できた'), c('確認済みの事実', '照合できた'), c('確認済みの事実', '照合できた'), c('確認済みの事実', '食い違い'), c('編集部の分析', '照合できた')]),
    led('2026-11-12-b', [c('確認済みの事実', '照合できた'), c('確認済みの事実', '取得できず照合不能'), c('未確認', '取得できず照合不能')]),
    led('2026-10-01-withdrawn', [c('確認済みの事実', '食い違い')]), // 公開中の記事に無い（取り下げ）ので数えない
  ];
  const r = T.computeEvidence({ ledgers, pages: PAGES, policy });
  assert.deepStrictEqual({ n: r.numerator, d: r.denominator, m: r.measured_articles, mis: r.mismatch_facts }, { n: 4, d: 6, m: 2, mis: 1 });
  assert.strictEqual(r.value, 0.6667);
  assert.strictEqual(r.article_mean, 0.625); // (3/4 + 1/2) / 2
  // 台帳の無い記事 E を公開後の見直しが数えた（5 件中 5 件）→ 合計 9/11
  const r2 = T.computeEvidence({ ledgers, pages: PAGES, policy, recheckArticles: { 'journal/2026-11-15-e.html': { facts: 5, verified: 5, mismatch: 0, last_checked_at: '2026-11-16T00:00:00Z' } } });
  assert.deepStrictEqual({ n: r2.numerator, d: r2.denominator, m: r2.measured_articles }, { n: 9, d: 11, m: 3 });
  // 台帳より古い見直しは使わない
  const r3 = T.computeEvidence({ ledgers, pages: PAGES, policy, recheckArticles: { 'journal/2026-11-10-a.html': { facts: 9, verified: 0, last_checked_at: '2026-11-01T00:00:00Z' } } });
  assert.strictEqual(r3.numerator, 4);
  // 台帳がまだ無いときは 0 とも 100 とも言わない
  const r0 = T.computeEvidence({ ledgers: [], pages: PAGES, policy });
  assert.strictEqual(r0.value, null);
  assert.strictEqual(r0.measured_articles, 0);
});

test('実記事の標本（2026-11-10〜17 の8本）: 手で読んで数えた結果と一致する', () => {
  // 手で本文を読んだ結果: 比較あり=10・12・14・15・17、計算＋一般則=11、どれも無し=13・16。未確認の明示はどれにも無い
  const expected = { '2026-11-10': true, '2026-11-11': true, '2026-11-12': true, '2026-11-13': false, '2026-11-14': true, '2026-11-15': true, '2026-11-16': false, '2026-11-17': true };
  const files = fs.readdirSync(path.join(ROOT, 'journal')).filter((f) => /^2026-11-1[0-7]/.test(f) && f.endsWith('.html'));
  assert.strictEqual(files.length, 8);
  let analysis = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(ROOT, 'journal', f), 'utf8');
    const fl = T.analysisFlags(html, policy);
    const any = fl.calculation || fl.comparison || fl.general_rule;
    assert.strictEqual(any, expected[f.slice(0, 10)], `${f}: ${JSON.stringify(fl)}`);
    assert.strictEqual(T.hasUnconfirmedDisclosure(html, policy.unconfirmed.markers), false, f);
    if (any) analysis++;
  }
  assert.strictEqual(analysis, 6);
});

test('compute: 5指標と事実の文の数がそろい、履歴は7日ごとに足す', () => {
  const m = T.compute({ root: ROOT, now: TODAY, pages: PAGES, ledgers: [], reviewRows: PAGES.map((p) => ({ path: p.rel, searchImpressions28d: 1, lastFactCheckedDate: '2026-11-01' })), published: { entries: [] }, recheckLog: null, policy });
  assert.deepStrictEqual(Object.keys(m.indicators), ['evidence_rate', 'unconfirmed_disclosure_rate', 'misinformation_rate', 'freshness_rate', 'analysis_rate']);
  assert.strictEqual(m.indicators.freshness_rate.value, 1);
  assert.ok(m.fact_sentences.total >= 1 && m.fact_sentences.per_article_avg > 0);
  const w1 = T.withHistory(m, null, policy);
  assert.strictEqual(w1.history.length, 1);
  assert.strictEqual(T.withHistory({ ...m, date: '2026-11-20' }, w1, policy).history.length, 1); // 3日後は足さない
  assert.strictEqual(T.withHistory({ ...m, date: '2026-11-24' }, w1, policy).history.length, 2); // 7日後は足す
});

// ── 悪化の見張り ──────────────────────────────────────────────────────
const metrics = (over = {}) => ({
  generated_at: '2026-11-17T01:00:00.000Z',
  indicators: {
    evidence_rate: { value: 0.9, measured_articles: 20 },
    unconfirmed_disclosure_rate: { value: 0.3, measured_articles: 50 },
    misinformation_rate: { value: 0.01, measured_articles: 90 },
    freshness_rate: { value: 0.5, measured_articles: 60 },
    analysis_rate: { value: 0.6, measured_articles: 266 },
  },
  fact_sentences: { per_article_avg: 30 },
  history: [{ date: '2026-11-08', evidence_rate: 0.9, unconfirmed_disclosure_rate: 0.3, misinformation_rate: 0.01, freshness_rate: 0.5, analysis_rate: 0.6, fact_per_article_avg: 30 }],
  ...over,
});
const ev = (m, extra = {}) => H.evaluate({ metrics: m, recheckLog: null, policy, today: '2026-11-17', ...extra });

test('見張り: 変わらなければ健全。前の週から許容を超えて下がる・誤情報が増える・事実の文が減ると知らせる', () => {
  assert.strictEqual(ev(metrics()).ok, true);
  const worse = metrics();
  worse.indicators.evidence_rate.value = 0.8; // 10ポイント減（許容5）
  worse.indicators.misinformation_rate.value = 0.04; // 3ポイント増（許容2）
  worse.fact_sentences.per_article_avg = 22; // 26% 減（許容20%）
  const r = ev(worse);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(r.problems.map((p) => p.kind).sort(), ['facts_shrinking', 'worse_evidence_rate', 'worse_misinformation_rate']);
  // 許容の範囲内の悪化は鳴らさない
  const small = metrics();
  small.indicators.evidence_rate.value = 0.86;
  assert.strictEqual(ev(small).ok, true);
});

test('見張り: まだ数えていない指標・数えた記事が少ない指標では鳴らさない（オオカミ少年にしない）。比べる記録が無くても鳴らさない', () => {
  const m = metrics();
  m.indicators.evidence_rate = { value: null, measured_articles: 0 };
  m.indicators.freshness_rate = { value: 0.01, measured_articles: 3 }; // 5本未満
  assert.strictEqual(ev(m).ok, true);
  const noHist = metrics({ history: [] });
  noHist.indicators.evidence_rate.value = 0.1;
  const r = ev(noHist);
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.includes('前の週の記録')));
});

test('見張り: 数え役が止まったら知らせる／復旧したら問題が0に戻る（Issue の自動クローズの条件）', () => {
  assert.deepStrictEqual(H.evaluate({ metrics: null, policy, today: '2026-11-17' }).problems.map((p) => p.kind), ['no_metrics']);
  const stale = ev(metrics({ generated_at: '2026-11-01T00:00:00.000Z' }));
  assert.deepStrictEqual(stale.problems.map((p) => p.kind), ['stale_metrics']);
  assert.strictEqual(ev(metrics()).problems.length, 0);
});

test('見張り: 公開後の見直しが止まった・台帳のある記事の見直しが滞った・見直す日が来たのに0本のとき知らせる。初回の過去記事の山では鳴らさない', () => {
  const log = (over) => ({ last_run: { date: '2026-11-17', due: 5, processed: 3 }, summary: { overdue: 2, overdue_ledger: 0, oldest_overdue_ledger_days: 0, overdue_legacy: 200, oldest_overdue_legacy_days: 197 }, ...over });
  assert.strictEqual(ev(metrics(), { recheckLog: log() }).ok, true); // 台帳の無い過去記事が200本たまっていても鳴らさない
  assert.deepStrictEqual(ev(metrics(), { recheckLog: log({ last_run: { date: '2026-11-10', due: 0, processed: 0 } }) }).problems.map((p) => p.kind), ['recheck_stale']);
  assert.deepStrictEqual(ev(metrics(), { recheckLog: log({ summary: { overdue_ledger: 2, oldest_overdue_ledger_days: 20 } }) }).problems.map((p) => p.kind), ['recheck_backlog']);
  assert.deepStrictEqual(ev(metrics(), { recheckLog: log({ last_run: { date: '2026-11-17', due: 4, processed: 0 } }) }).problems.map((p) => p.kind), ['recheck_zero']);
});

// ── 週のレポート（GAS）──────────────────────────────────────────────
function loadGas() {
  const src = fs.readFileSync(path.join(ROOT, '.gas-deploy', 'Code.js'), 'utf8');
  const ctx = {
    Logger: { log() {} },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{}' }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    AnalyticsData: { Properties: { runReport: () => ({}) } },
    GmailApp: { sendEmail() {} },
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(`${src}\n;globalThis.__gas = { formatTrustMetrics, trustPct, formatWeeklyReport };`, ctx);
  return ctx.__gas;
}

test('週のレポート: 5指標と事実の文の数が1段落で出る。値が無い・壊れているときは段落ごと出さない', () => {
  const gas = loadGas();
  const m = T.compute({ root: ROOT, now: TODAY, pages: PAGES, ledgers: [], reviewRows: [], published: { entries: [] }, recheckLog: null, policy });
  const out = gas.formatTrustMetrics(m, '2026-11-17');
  for (const label of ['【信頼の指標】', '根拠の確認率', '確認できなかったこと', '公開後の訂正・取り下げ', '確認日が90日以内', '比較・計算・一般則', '事実の文の数']) assert.ok(out.includes(label), label);
  assert.ok(out.includes('40%'), '未確認の明示率 2/5'); // 未確認の明示
  assert.ok(out.includes('事実台帳のある記事がまだ無い'));
  assert.strictEqual(gas.formatTrustMetrics(null, '2026-11-17'), '');
  assert.strictEqual(gas.formatTrustMetrics({ indicators: { evidence_rate: {} } }, '2026-11-17'), '');
  assert.ok(gas.formatTrustMetrics({ ...m, date: '2026-10-01' }, '2026-11-17').includes('日前のままです'));
  assert.strictEqual(gas.trustPct(null), '未計測');
});

test('Issue の本文: 原因つきで、見る場所と対処が入る。健全なら本文は付かない', () => {
  const worse = metrics();
  worse.indicators.evidence_rate.value = 0.7;
  const r = ev(worse);
  const body = H.issueBody(r);
  assert.ok(body.includes('worse_evidence_rate') && body.includes('90%') && body.includes('70%'));
  assert.ok(body.includes('data/trust_metrics.json') && body.includes('自動でクローズ'));
});

test('夜間の検査と見張りの workflow がつながっている（相乗り・毎朝の計測・Issue の自動クローズ・通知テスト）', () => {
  const nightly = fs.readFileSync(path.join(ROOT, '.github/workflows/nightly-qa.yml'), 'utf8');
  assert.ok(nightly.includes('recheck_due_articles.js') && nightly.includes('continue-on-error: true') && nightly.includes("labels: label"));
  const wd = fs.readFileSync(path.join(ROOT, '.github/workflows/trust-metrics-watchdog.yml'), 'utf8');
  assert.ok(wd.includes('trust_metrics.js --write') && wd.includes('check_trust_metrics_health.js') && wd.includes('自動でクローズ') && wd.includes('test_close'));
  assert.ok(/\[skip actions\]/.test(wd), 'デプロイを誘発しない');
});

test('根拠確認率: 出典で確かめる対象にしない文（照合対象外）は分母に入れない', () => {
  const ledgers = [{ slug: '2026-11-10-a', date: '2026-11-10', claims: [
    { kind: '確認済みの事実', status: '照合できた' },
    { kind: '確認済みの事実', status: '取得できず照合不能' },
    { kind: '確認済みの事実', status: T.NA_STATUS },
    { kind: '確認済みの事実', status: T.NA_STATUS },
  ] }];
  const r = T.computeEvidence({ ledgers, pages: PAGES, policy });
  assert.strictEqual(r.denominator, 2);
  assert.strictEqual(r.numerator, 1);
});

test('読者の声: 記事の末尾の部品から届いた声だけを90日の窓で数える（無ければ0）', () => {
  const feedbackLog = { entries: [
    { source: 'article-widget', date: '2026-11-10', article_answer: 'error' },
    { source: 'article-widget', date: '2026-11-11', article_answer: 'no' },
    { source: 'article-widget', date: '2026-01-01', article_answer: 'error' },
    { source: 'site-feedback', date: '2026-11-12', article_answer: 'error' },
  ] };
  const r = T.computeReaderVoice({ feedbackLog, today: '2026-11-17', policy });
  assert.strictEqual(r.recorded, 2);
  assert.strictEqual(r.error_reports, 1);
  assert.strictEqual(r.could_not_decide, 1);
  assert.strictEqual(T.computeReaderVoice({ feedbackLog: null, today: '2026-11-17', policy }).recorded, 0);
});
