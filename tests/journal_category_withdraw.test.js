'use strict';
// S3-3（記事の3分類・題材の配分・一覧の切り替え）と S4-4（取り下げ・訂正の道具）の試験
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { categoryOf, CATEGORIES, isPublic } = require('../scripts/lib/journal_category');
const { pickTrending, simulateDistribution, pickDailyTopic } = require('../scripts/pick_daily_topic');
const { buildList, buildFilterBar } = require('../scripts/build_journal_index');
const W = require('../scripts/journal_withdraw');
const R = require('../scripts/journal_correct');

// ── S3-3 ────────────────────────────────────────────────
test('台帳の全記事に3分類のどれかが付いている（theme からの導出と一致）', () => {
  const pub = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/journal_published.json'), 'utf8'));
  assert.ok(pub.entries.length > 100);
  for (const e of pub.entries) {
    assert.ok(CATEGORIES[e.category], `category が無い・不正: ${e.slug}`);
    assert.strictEqual(e.category, categoryOf({ theme: e.theme, title: e.title }), e.slug);
  }
});

test('categoryOf: category が無い行は theme から、未知の theme でも必ず3つのどれか', () => {
  assert.strictEqual(categoryOf({ theme: 'today_one' }), 'topic');
  assert.strictEqual(categoryOf({ theme: 'industry_insider' }), 'guide');
  assert.strictEqual(categoryOf({ theme: 'weekly_digest' }), 'compare');
  assert.strictEqual(categoryOf({ theme: 'new_theme', title: '居酒屋の選び方' }), 'guide');
  assert.strictEqual(categoryOf({ theme: 'new_theme', title: 'なにか' }), 'topic');
  assert.strictEqual(categoryOf({ category: 'compare', theme: 'today_one' }), 'compare');
  assert.strictEqual(categoryOf({ category: 'bogus', theme: 'today_one' }), 'topic');
  assert.strictEqual(categoryOf(null), 'topic');
});

test('30日分の題材配分が、話題4・ガイド2・比較1の目安（1週あたり）に収まる', () => {
  const r = simulateDistribution('2026-11-18', 30);
  const w = (k) => r.counts[k] / 30 * 7;
  assert.ok(Math.abs(w('topic') - 4) <= 0.6, `topic ${w('topic')}`);
  assert.ok(Math.abs(w('guide') - 2) <= 0.6, `guide ${w('guide')}`);
  assert.ok(Math.abs(w('compare') - 1) <= 0.6, `compare ${w('compare')}`);
  // 忘年会の長い季節の上書き期間でも、ガイド・比較の日は季節短信に塗りつぶされない
  assert.ok(r.rows.some((x) => x.category === 'guide' && x.source !== 'seasonal_override'));
});

test('ガイド・比較の回には話題紹介への逃げ道(fallback_theme)がある。話題の回は null', () => {
  const sun = pickDailyTopic('2026-11-22'); // 日: ガイド
  assert.strictEqual(sun.category, 'guide');
  assert.strictEqual(sun.fallback_theme, 'today_one');
  const tue = pickDailyTopic('2026-11-17');
  assert.strictEqual(tue.category, 'topic');
  assert.strictEqual(tue.fallback_theme, null);
});

test('話題店の上書き: 実データの項目名（話題スコア・検出日・有効期限・出典URL）で働く', () => {
  const store = { 店名: '試験の店', 話題スコア: 95, 検出日: '2026-11-15', 有効期限: '2026-12-15', 出典URL: ['https://a.example/1', 'https://b.example/2'] };
  const none = { entries: [] };
  assert.strictEqual(pickTrending({ stores: [store] }, none, '2026-11-17').店名, '試験の店');
  // 古い検出日・期限切れ・出典1件・スコア不足・直近の記事で扱い済みは対象外
  assert.strictEqual(pickTrending({ stores: [{ ...store, 検出日: '2026-10-01' }] }, none, '2026-11-17'), null);
  assert.strictEqual(pickTrending({ stores: [{ ...store, 有効期限: '2026-11-16' }] }, none, '2026-11-17'), null);
  assert.strictEqual(pickTrending({ stores: [{ ...store, 出典URL: ['https://a.example/1'] }] }, none, '2026-11-17'), null);
  assert.strictEqual(pickTrending({ stores: [{ ...store, 話題スコア: 80 }] }, none, '2026-11-17'), null);
  const done = { entries: [{ date: '2026-11-10', title: '試験の店に行く', description: '' }] };
  assert.strictEqual(pickTrending({ stores: [store] }, done, '2026-11-17'), null);
});

function entry(over) {
  return { slug: '2026-11-01-a', date: '2026-11-01', theme: 'today_one', title: 'T', description: 'D', ...over };
}

test('一覧: 切り替えの部品が出て、各記事に data-category が付く。JS が無ければ hidden のまま', () => {
  const html = buildList([entry({}), entry({ slug: '2026-11-02-b', date: '2026-11-02', theme: 'industry_insider' }), entry({ slug: '2026-11-03-c', date: '2026-11-03', theme: 'weekly_digest' })]);
  assert.match(html, /<div class="journal-filter" id="journal-filter"[^>]* hidden>/);
  for (const k of ['all', 'topic', 'guide', 'compare']) assert.ok(html.includes(`data-filter="${k}"`), k);
  for (const k of ['topic', 'guide', 'compare']) assert.ok(html.includes(`data-category="${k}"`), k);
  assert.ok(buildFilterBar([entry({})]).includes('<span class="jf-count">1</span>'));
  // URL は変えない
  assert.ok(html.includes('href="2026-11-01-a.html"'));
});

test('実物の journal/index.html: 切り替えの CSS とスクリプトがあり、記事が全件並ぶ', () => {
  const src = fs.readFileSync(path.join(ROOT, 'journal/index.html'), 'utf8');
  assert.ok(src.includes('class="journal-filter-script"'));
  assert.ok(src.includes('.jf-chip'));
  const n = (src.match(/class="journal-entry"/g) || []).length;
  const pub = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/journal_published.json'), 'utf8'));
  assert.ok(n > 100 && n <= pub.entries.length);
});

// ── S4-4 ────────────────────────────────────────────────
const SLUG = '2026-11-01-sample-article';
const ARTICLE = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>見本の記事</title>
<style>[data-correction-log]{margin:0}</style>
<script type="application/ld+json">{"dateModified":"2026-11-01"}</script>
</head><body><main id="main-content">
<article class="nb-article">
  <h1 class="art-title">見本の題</h1>
  <p class="art-lead">冒頭の文。営業時間は17時です。</p>
  <p>本文。ランチは11時から14時までです。</p>
</article>
</main></body></html>
`;

function sandbox({ template = false, xlog = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jw-'));
  fs.mkdirSync(path.join(root, 'journal'));
  fs.mkdirSync(path.join(root, 'data'));
  const html = template
    ? ARTICLE.replace('</article>', '<section class="correction-log" data-correction-log hidden><h2>訂正の履歴</h2><ul></ul></section>\n</article>')
    : ARTICLE;
  fs.writeFileSync(path.join(root, 'journal', SLUG + '.html'), html);
  const pub = { description: 'x', schema: {}, entries: [{ slug: SLUG, date: '2026-11-01', theme: 'today_one', category: 'topic', title: '見本の題', description: 'd' }] };
  fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify(pub, null, 2) + '\n');
  if (xlog) fs.writeFileSync(path.join(root, 'data/x_post_log.json'), JSON.stringify({ posts: [{ slug: SLUG, tweet_id: '2111111111111111111' }] }));
  return root;
}
const rd = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const NOW = new Date('2026-11-17T03:00:00Z');

test('取り下げ: 予行（--yes なし）は何も書かない', () => {
  const root = sandbox();
  const before = rd(root, 'journal/' + SLUG + '.html');
  const r = W.run({ slug: SLUG, reason: '誤り', root, now: NOW, rebuild: false });
  assert.strictEqual(r.code, 'dry_run');
  assert.ok(r.steps.length >= 3 && r.steps.some((s) => s.includes('X:')));
  assert.strictEqual(rd(root, 'journal/' + SLUG + '.html'), before);
  assert.ok(!JSON.parse(rd(root, 'data/journal_published.json')).entries[0].status);
});

test('取り下げ → 元に戻す の往復（目印なしの記事・本文の末尾に履歴を足す）', () => {
  const root = sandbox();
  const original = rd(root, 'journal/' + SLUG + '.html');
  const w = W.run({ slug: SLUG, reason: '価格の誤り', yes: true, root, now: NOW, rebuild: false });
  assert.strictEqual(w.code, 'withdrawn');
  let html = rd(root, 'journal/' + SLUG + '.html');
  assert.ok(html.includes(W.NOINDEX) && html.includes('data-withdrawn role="note"') && html.includes('価格の誤り'));
  assert.ok(/<aside class="correction-log" data-correction-log>[\s\S]*取り下げ: 価格の誤り/.test(html));
  let e = JSON.parse(rd(root, 'data/journal_published.json')).entries[0];
  assert.strictEqual(e.status, 'withdrawn');
  assert.strictEqual(e.corrections.length, 1);
  assert.ok(!require('../scripts/lib/journal_category').isPublic(e));
  // 二重の取り下げは止まる
  assert.strictEqual(W.run({ slug: SLUG, reason: 'again', yes: true, root, now: NOW, rebuild: false }).code, 'already_withdrawn');

  const b = W.run({ slug: SLUG, reason: '確認できた', restore: true, yes: true, root, now: NOW, rebuild: false });
  assert.strictEqual(b.code, 'restored');
  html = rd(root, 'journal/' + SLUG + '.html');
  assert.ok(!html.includes(W.NOINDEX) && !html.includes('withdrawn-notice'));
  // 取り下げと復元の注記以外は、元のまま（履歴の欄だけが増える）
  const stripped = html.replace(/<aside class="correction-log"[\s\S]*?<\/aside>\n/, '');
  assert.strictEqual(stripped, original);
  e = JSON.parse(rd(root, 'data/journal_published.json')).entries[0];
  assert.ok(!e.status && isPublic(e));
  assert.deepStrictEqual(e.corrections.map((c) => c.kind), ['withdrawal', 'restore']);
  assert.strictEqual(W.run({ slug: SLUG, reason: 'x', restore: true, yes: true, root, now: NOW, rebuild: false }).code, 'not_withdrawn');
});

test('履歴の欄（目印 data-correction-log）があれば、そこへ足し、hidden を外す', () => {
  const root = sandbox({ template: true });
  W.run({ slug: SLUG, reason: '誤り', yes: true, root, now: NOW, rebuild: false });
  const html = rd(root, 'journal/' + SLUG + '.html');
  assert.strictEqual((html.match(/data-correction-log(?=[\s>])/g) || []).length, 1); // 欄は増えない（CSS の [data-correction-log] は数えない）
  assert.ok(/<section class="correction-log" data-correction-log><h2>訂正の履歴<\/h2><ul><li><time datetime="2026-11-17">2026年11月17日<\/time> 取り下げ: 誤り<\/li>/.test(html));
});

test('訂正: 本文を1か所だけ置き換え、履歴と dateModified を更新する。題・冒頭は --force-head なしでは変えない', () => {
  const root = sandbox({ template: true });
  const dry = R.run({ slug: SLUG, summary: '昼の営業時間を修正', edits: [{ find: '11時から14時', replace: '11時30分から14時' }], root, now: NOW, rebuild: false });
  assert.strictEqual(dry.code, 'dry_run');
  assert.ok(rd(root, 'journal/' + SLUG + '.html').includes('11時から14時'));
  const r = R.run({ slug: SLUG, summary: '昼の営業時間を修正', edits: [{ find: '11時から14時', replace: '11時30分から14時' }], yes: true, root, now: NOW, rebuild: false });
  assert.strictEqual(r.code, 'corrected');
  const html = rd(root, 'journal/' + SLUG + '.html');
  assert.ok(html.includes('11時30分から14時') && !html.includes('11時から14時'));
  assert.ok(html.includes('訂正: 昼の営業時間を修正'));
  assert.ok(html.includes('"dateModified":"2026-11-17"'));
  assert.strictEqual(JSON.parse(rd(root, 'data/journal_published.json')).entries[0].corrections[0].kind, 'correction');
  // 冒頭・題には触れない
  assert.strictEqual(R.run({ slug: SLUG, summary: 'x', edits: [{ find: '17時', replace: '18時' }], yes: true, root, now: NOW, rebuild: false }).code, 'touches_head');
  assert.strictEqual(R.run({ slug: SLUG, summary: 'x', edits: [{ find: '17時', replace: '18時' }], yes: true, forceHead: true, root, now: NOW, rebuild: false }).code, 'corrected');
});

test('訂正: 当たりが0件・2件以上・理由なし・取り下げ済みは何も書かずに止まる', () => {
  const root = sandbox();
  const before = rd(root, 'journal/' + SLUG + '.html');
  assert.strictEqual(R.run({ slug: SLUG, summary: 'x', edits: [{ find: '存在しない', replace: 'y' }], yes: true, root, rebuild: false }).code, 'find_not_found');
  assert.strictEqual(R.run({ slug: SLUG, summary: 'x', edits: [{ find: '時', replace: 'y' }], yes: true, root, rebuild: false }).code, 'find_ambiguous');
  assert.strictEqual(R.run({ slug: SLUG, summary: '', edits: [], yes: true, root, rebuild: false }).code, 'no_summary');
  assert.strictEqual(rd(root, 'journal/' + SLUG + '.html'), before);
  W.run({ slug: SLUG, reason: 'r', yes: true, root, now: NOW, rebuild: false });
  assert.strictEqual(R.run({ slug: SLUG, summary: 'x', edits: [], yes: true, root, rebuild: false }).code, 'withdrawn_article');
  assert.strictEqual(W.run({ slug: '../etc', reason: 'r', root }).code, 'bad_slug');
});

test('取り下げの途中で失敗したら、記事と台帳を元に戻す', () => {
  const root = sandbox();
  const html0 = rd(root, 'journal/' + SLUG + '.html');
  const pub0 = rd(root, 'data/journal_published.json');
  const boom = () => { throw new Error('作り直しに失敗'); };
  assert.throws(() => W.run({ slug: SLUG, reason: 'r', yes: true, root, now: NOW, rebuild: true, exec: boom }), /作り直しに失敗/);
  assert.strictEqual(rd(root, 'journal/' + SLUG + '.html'), html0);
  assert.strictEqual(rd(root, 'data/journal_published.json'), pub0);
});

test('X の削除は --delete-x と --yes のときだけ。乾いた実行では起動しない', () => {
  const root = sandbox();
  const calls = [];
  const gh = (args) => { calls.push(args); return ''; };
  W.run({ slug: SLUG, reason: 'r', yes: true, root, now: NOW, rebuild: false, ghExec: gh });
  assert.strictEqual(calls.length, 0);
  const root2 = sandbox();
  W.run({ slug: SLUG, reason: 'r', root: root2, now: NOW, rebuild: false, deleteX: true, ghExec: gh });
  assert.strictEqual(calls.length, 0); // --yes なし
  const root3 = sandbox();
  const r = W.run({ slug: SLUG, reason: 'r', yes: true, deleteX: true, root: root3, now: NOW, rebuild: false, ghExec: gh });
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].includes('tweet_id=2111111111111111111'));
  assert.deepStrictEqual(r.x_delete, [{ id: '2111111111111111111', started: true }]);
});

test('取り下げた記事は一覧・フィード・トップの元データに載らない（実物の台帳を写して往復）', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'scripts/build_journal_index.js'), 'utf8');
  assert.ok(/isPublic\(e\)/.test(idx));
});

test('x-delete.yml: slug 指定・dry_run・失敗の原因の要約がある（11-13 の失敗は月額上限 spend cap）', () => {
  const y = fs.readFileSync(path.join(ROOT, '.github/workflows/x-delete.yml'), 'utf8');
  for (const s of ['slug:', 'dry_run:', 'GITHUB_STEP_SUMMARY', 'spend cap', '"kind":"payment"']) assert.ok(y.includes(s), s);
  assert.ok(/tweet_id:[\s\S]*?required: false/.test(y));
});

test('曜日は端末の時間帯に依らない（UTC の CI でも日曜は日曜）', () => {
  const { execFileSync } = require('child_process');
  const out = execFileSync(process.execPath, ['-e', "process.stdout.write(require('./scripts/pick_daily_topic').pickDailyTopic('2026-11-22').weekday)"], { cwd: require('path').join(__dirname, '..'), env: { ...process.env, TZ: 'UTC' } }).toString();
  assert.strictEqual(out, '日');
});
