'use strict';
// S5-5: 公開後の鮮度の見張り。見直す日を過去にした試験の記事で「拾う → 出典を取り直す → 直す（訂正案・保留）」の流れを確かめる。
// 既定は記録だけ（本番の記事を書き換えない）。apply_light のときだけ訂正の道具で書く。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = require('../scripts/recheck_due_articles');
const T = require('../scripts/trust_metrics');

const NOW = new Date('2026-11-17T03:00:00Z'); // JST 2026-11-17
const SLUG = '2026-11-01-sample-bonenkai';
const SRC = 'https://example.test/shop/course';

const ARTICLE = (body, { title = '見本の店の忘年会コース' } = {}) => `<!doctype html>
<html lang="ja"><head><meta charset="UTF-8"><title>${title}｜NAGOYA BITES</title>
<script type="application/ld+json">{"datePublished":"2026-11-01","dateModified":"2026-11-01"}</script></head><body><main id="main-content">
<article class="nb-article">
<h1 class="art-title">${title}</h1>
<p class="art-lead">忘年会の使い方を整理する。</p>
${body}
<details class="nb-jbox nb-corrections" data-correction-log hidden><summary>訂正の履歴</summary><ul></ul></details>
<div class="source-note"><a href="${SRC}">見本の店 公式</a> <span class="source-date">11月1日掲載</span></div>
</article></main></body></html>
`;

function sandbox({ body, ledgerClaims = null, published = true, extraFiles = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recheck-'));
  for (const d of ['journal', 'features', 'data/journal_claims']) fs.mkdirSync(path.join(root, d), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'data', 'trust_metrics_policy.json'), path.join(root, 'data', 'trust_metrics_policy.json'));
  fs.writeFileSync(path.join(root, 'journal', `${SLUG}.html`), ARTICLE(body));
  if (published) {
    fs.writeFileSync(path.join(root, 'data', 'journal_published.json'), JSON.stringify({ description: 'x', schema: {}, entries: [{ slug: SLUG, date: '2026-11-01', theme: 'seasonal', category: 'topic', title: '見本', description: 'd' }] }, null, 2) + '\n');
  }
  if (ledgerClaims) {
    fs.writeFileSync(path.join(root, 'data', 'journal_claims', '2026-11-01.json'), JSON.stringify({ date: '2026-11-01', slug: SLUG, generated_at: '2026-11-01T00:00:00Z', claims: ledgerClaims }));
  }
  for (const [rel, content] of Object.entries(extraFiles)) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), content); }
  return root;
}
const rd = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fetcherOf = (text) => async () => ({ ok: true, status: 200, text });
const SOURCE_PRICE_CHANGED = '見本の店 忘年会 飲み放題付きコース 5,500円（税込） 個室は最大20名 ご予約はお電話から 営業時間 17:00〜23:00 ラストオーダー 22:00 定休日 日曜日 ※内容は変更になる場合があります';
const BODY = '<p>飲み放題付きコースは5,000円です。個室は最大20名まで使えます。</p>';
const LEDGER = [{ text: '飲み放題付きコースは5,000円です。', kind: '確認済みの事実', status: '照合できた', recheck_after: '2026-11-10' }];
const base = { root: null, now: NOW, rebuild: false, reviewRows: [] };

test('見直す日が来た記事を拾い、出典の数字が変わっていれば訂正案を作る（既定は記録だけ・記事は書き換えない）', async () => {
  const root = sandbox({ body: BODY, ledgerClaims: LEDGER });
  const before = rd(root, `journal/${SLUG}.html`);
  const r = await R.run({ ...base, root, fetcher: fetcherOf(SOURCE_PRICE_CHANGED) });
  assert.strictEqual(r.mode, 'record');
  assert.strictEqual(r.due, 1);
  assert.deepStrictEqual(r.processed, [`journal/${SLUG}.html`]);
  assert.strictEqual(r.alerts.length, 1);
  const a = r.alerts[0];
  assert.strictEqual(a.type, 'number_light');
  assert.ok(a.body.includes('訂正案') && a.body.includes('journal_correct.js') && a.body.includes('5,500円'));
  // 本番の記事・台帳は書き換えない
  assert.strictEqual(rd(root, `journal/${SLUG}.html`), before);
  assert.ok(!JSON.parse(rd(root, 'data/journal_published.json')).entries[0].corrections);
  // 記録は残る: 次の見直す日・照合の件数・見つけた変更
  const st = JSON.parse(rd(root, 'data/article_recheck_log.json')).articles[`journal/${SLUG}.html`];
  assert.strictEqual(st.outcome, 'findings');
  assert.strictEqual(st.mismatch, 1);
  assert.strictEqual(st.findings[0].proposal.replace.includes('5,500円'), true);
  assert.strictEqual(st.next_due, '2026-12-01'); // 14日の待ち
  // 同じ変更を毎日は起票しない（報告済み・待ちの間は拾わない）
  const again = await R.run({ ...base, root, fetcher: fetcherOf(SOURCE_PRICE_CHANGED) });
  assert.strictEqual(again.due, 0);
  assert.strictEqual(again.alerts.length, 0);
});

test('apply_light のときだけ、訂正の道具で履歴つきに書き換える（訂正の履歴・dateModified・台帳の記録）', async () => {
  const root = sandbox({ body: BODY, ledgerClaims: LEDGER });
  const r = await R.run({ ...base, root, mode: 'apply_light', fetcher: fetcherOf(SOURCE_PRICE_CHANGED) });
  assert.strictEqual(r.applied.length, 1);
  const html = rd(root, `journal/${SLUG}.html`);
  assert.ok(html.includes('飲み放題付きコースは5,500円です') && !html.includes('コースは5,000円です'));
  assert.ok(/訂正: 公開後の再確認で/.test(html) && html.includes('"dateModified":"2026-11-17"'));
  const e = JSON.parse(rd(root, 'data/journal_published.json')).entries[0];
  assert.strictEqual(e.corrections.length, 1);
  assert.strictEqual(e.corrections[0].by, 'recheck');
  // 書いたあとは課題にしない
  assert.strictEqual(r.alerts.length, 0);
});

test('出典と食い違いが無ければ訂正も課題も作らない。次の見直す日は先に延びる', async () => {
  const root = sandbox({ body: BODY, ledgerClaims: LEDGER });
  const same = SOURCE_PRICE_CHANGED.replace('5,500円', '5,000円');
  const r = await R.run({ ...base, root, fetcher: fetcherOf(same) });
  assert.strictEqual(r.alerts.length, 0);
  const st = JSON.parse(rd(root, 'data/article_recheck_log.json')).articles[`journal/${SLUG}.html`];
  assert.strictEqual(st.outcome, 'ok');
  assert.ok(st.next_due > '2026-11-17');
  assert.strictEqual(st.verified, 1);
});

test('題にある事実が食い違うときは核心の変更として保留の課題にする（訂正案は作らない）', async () => {
  const body = '<p>飲み放題付きコースは5,000円です。</p>';
  const root = sandbox({ body, ledgerClaims: LEDGER });
  fs.writeFileSync(path.join(root, 'journal', `${SLUG}.html`), ARTICLE(body, { title: '飲み放題付きコース5,000円の忘年会' }));
  const r = await R.run({ ...base, root, fetcher: fetcherOf(SOURCE_PRICE_CHANGED) });
  assert.strictEqual(r.alerts.length, 1);
  assert.strictEqual(r.alerts[0].type, 'number_mismatch_pillar');
  assert.ok(r.alerts[0].body.includes('保留'));
  assert.ok(!rd(root, `journal/${SLUG}.html`).includes('5,500円'));
});

test('台帳の無い過去の記事も、本文から取り出した事実の文で簡易に照合する（開店前に書いた記事を先に）', async () => {
  const root = sandbox({ body: BODY }); // 2026-11-01 の記事は見直す日（90日後）がまだ先
  const add = (slug, date, body, src) => {
    fs.writeFileSync(path.join(root, 'journal', `${slug}.html`), ARTICLE(body).replace(SRC, src));
    const pub = JSON.parse(rd(root, 'data/journal_published.json'));
    pub.entries.push({ slug, date, theme: 'seasonal', category: 'topic', title: 'x', description: 'd' });
    fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify(pub));
  };
  // 台帳なしの過去記事2本: 開店前に書いたもの（2026-07-01）と普通のもの（2026-06-01・こちらの方が古い）。どちらも見直す日は過ぎている
  add('2026-07-01-pre-open', '2026-07-01', '<p>来月の開店予定で、コースは4,000円からと発表されている。</p>', 'https://example.test/pre');
  add('2026-06-01-plain', '2026-06-01', '<p>個室は最大20名まで使える。コースは5,000円です。</p>', 'https://example.test/plain');
  const r = await R.run({ ...base, root, maxPerRun: 1, fetcher: fetcherOf(SOURCE_PRICE_CHANGED) });
  assert.strictEqual(r.due, 2);
  assert.deepStrictEqual(r.processed, ['journal/2026-07-01-pre-open.html']); // 古さより「開店前に書いた」を先に
  assert.strictEqual(r.summary.overdue, 1);
  assert.strictEqual(r.summary.overdue_legacy, 1);
  assert.strictEqual(r.summary.overdue_ledger, 0);
  const st = JSON.parse(rd(root, 'data/article_recheck_log.json')).articles['journal/2026-07-01-pre-open.html'];
  assert.strictEqual(st.basis, 'machine');
  assert.strictEqual(st.reason, 'pre_open');
  // 翌日は残りの1本を見直す
  const r2 = await R.run({ ...base, root, now: new Date('2026-11-18T03:00:00Z'), maxPerRun: 1, fetcher: fetcherOf(SOURCE_PRICE_CHANGED) });
  assert.deepStrictEqual(r2.processed, ['journal/2026-06-01-plain.html']);
  assert.strictEqual(r2.summary.overdue, 0);
});

test('期間のある記述の終わりを過ぎていれば保留にする（日付だけで確かめられる）。文中の別の日付では反応しない', async () => {
  assert.strictEqual(R.periodEnd('期間限定コースは11月30日まで。', '2026-11-01'), '2026-11-30');
  assert.strictEqual(R.periodEnd('10月11日（日）〜22日（木）は17時から営業。', '2026-10-10'), '2026-10-22');
  assert.strictEqual(R.periodEnd('7月26日を軸にした鰻メニュー、受付終了が早まる', '2026-07-23'), null);
  const root = sandbox({ body: '<p>期間限定の特別コースは11月10日まで提供している。価格は3,000円です。</p>', ledgerClaims: [{ text: '期間限定の特別コースは11月10日まで提供している。価格は3,000円です。', kind: '確認済みの事実', status: '照合できた', recheck_after: '2026-11-11' }] });
  const r = await R.run({ ...base, root, fetcher: fetcherOf('見本の店 特別コース 3,000円 11月10日まで 営業時間 17:00〜23:00 定休日 日曜日 ご予約はお電話から ご来店をお待ちしています') });
  assert.deepStrictEqual(r.alerts.map((a) => a.type), ['period_ended']);
});

test('見直す日がまだ先の記事は拾わない。見直しの結果は根拠確認率が読む', async () => {
  const root = sandbox({ body: BODY, ledgerClaims: [{ ...LEDGER[0], recheck_after: '2027-03-01' }] });
  const r = await R.run({ ...base, root, fetcher: fetcherOf(SOURCE_PRICE_CHANGED) });
  assert.strictEqual(r.due, 0);
  assert.strictEqual(r.processed.length, 0);
  assert.strictEqual(r.problem, null);
  // 見直した結果（facts/verified）が trust_metrics の根拠確認率に入る
  const root2 = sandbox({ body: BODY, ledgerClaims: [{ ...LEDGER[0], status: '食い違い' }] }); // 台帳は古い食い違い。見直しの結果が新しいので、そちらを数える
  await R.run({ ...base, root: root2, fetcher: fetcherOf(SOURCE_PRICE_CHANGED.replace('5,500円', '5,000円')) });
  const log = JSON.parse(rd(root2, 'data/article_recheck_log.json'));
  const pages = T.loadPages(root2);
  const ev = T.computeEvidence({ ledgers: [], recheckArticles: log.articles, pages, policy: T.loadPolicy(root2) });
  assert.deepStrictEqual({ n: ev.numerator, d: ev.denominator, m: ev.measured_articles }, { n: 1, d: 1, m: 1 });
});

test('毎日の枠: 1回に見直すのは max_per_run 本まで・見直す日が来たのに0本なら問題として返す', async () => {
  const root = sandbox({ body: BODY });
  const r = await R.run({ ...base, root, fetcher: fetcherOf('x'), maxPerRun: 1 });
  assert.ok(r.processed.length <= 1);
  assert.strictEqual(r.problem, null);
  assert.strictEqual(JSON.parse(rd(root, 'data/article_recheck_log.json')).last_run.mode, 'record');
});

test('既定の設定は「記録だけ」。軽い訂正を自動で書く設定は入っていない', () => {
  const p = T.loadPolicy(ROOT);
  assert.strictEqual(p.recheck.mode, 'record');
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/nightly-qa.yml'), 'utf8');
  assert.ok(wf.includes('recheck_due_articles.js'));
  assert.ok(!/recheck_due_articles\.js[^\n]*--mode\s+apply/.test(wf), '夜間の検査から apply を呼ばない');
});

test('同じ記事の同じ種類の変更は1件の課題にまとめる（Issue を増やさない）。1回の課題の数には上限がある', async () => {
  const body = '<p>期間限定コースは11月3日まで提供。価格は3,000円です。</p><p>限定デザートは11月5日まで提供。価格は800円です。</p>';
  const root = sandbox({ body, ledgerClaims: [{ text: '期間限定コースは11月3日まで提供。価格は3,000円です。', kind: '確認済みの事実', status: '照合できた', recheck_after: '2026-11-04' }, { text: '限定デザートは11月5日まで提供。価格は800円です。', kind: '確認済みの事実', status: '照合できた', recheck_after: '2026-11-06' }] });
  const r = await R.run({ ...base, root, fetcher: fetcherOf('見本の店 特別コース 3,000円 デザート 800円 営業時間 17:00〜23:00 定休日 日曜日 ご予約はお電話から ご来店をお待ちしています') });
  const periods = r.alerts.filter((a) => a.type === 'period_ended');
  assert.strictEqual(periods.length, 1);
  assert.strictEqual((periods[0].body.match(/- 内容:/g) || []).length, 2);
  assert.ok(r.alerts.length <= 3);
});
