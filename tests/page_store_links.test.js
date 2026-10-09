'use strict';
// ISSUE-156: 特集・ジャーナルに手で書かれた店舗リンクが別の店を指していないかの判定器
const test = require('node:test');
const assert = require('node:assert');
const { normalizeStoreUrl, extractStoreLinks, buildVerdictIndex, isWrongStoreUrl, auditPages, listPages } = require('../scripts/lib/page_store_links');

const TB = 'https://tabelog.com/aichi/A2301/A230103/23067853/';

test('店舗ページの URL を照合キャッシュと同じ形にそろえる', () => {
  assert.strictEqual(normalizeStoreUrl('http://tabelog.com/aichi/A2301/A230103/23067853'), TB);
  assert.strictEqual(normalizeStoreUrl('https://s.tabelog.com/aichi/A2301/A230103/23067853/dtlmenu/?x=1'), TB);
  assert.strictEqual(normalizeStoreUrl('https://www.hotpepper.jp/strJ003985167/map/?vos=1'), 'https://www.hotpepper.jp/strJ003985167/');
  assert.strictEqual(normalizeStoreUrl('https://hotpepper.jp/strJ003985167'), 'https://www.hotpepper.jp/strJ003985167/');
  // 店舗ページでないもの（食べログアワード・地域の一覧・ほかのサイト）は対象外
  assert.strictEqual(normalizeStoreUrl('https://tabelog.com/award/2021/'), null);
  assert.strictEqual(normalizeStoreUrl('https://tabelog.com/aichi/A2301/A230103/'), null);
  assert.strictEqual(normalizeStoreUrl('https://restaurant.ikyu.com/104571/'), null);
});

test('HTML の href から店舗ページの URL を重複なく集める', () => {
  const html = `<a href="${TB}">食べログ</a><a href='${TB}dtlrvwlst/'>口コミ</a>
    <a href="https://tabelog.com/award/2021/">アワード</a><a href="../stores/J004026266.html">店舗</a>`;
  assert.deepStrictEqual(extractStoreLinks(html), [TB]);
});

test('判定がすべて「別の店」のときだけ数える', () => {
  const v = (o) => ({ url: TB, ...o });
  assert.strictEqual(isWrongStoreUrl([v({ ok: false, reason: 'name-mismatch', sim: 0 })]), true);
  assert.strictEqual(isWrongStoreUrl([v({ ok: false, reason: 'confirmed-404' })]), true);
  // sim>0 は同じ店のことが多い（ふりがな併記・題名の付け足し）。人の確認に残す
  assert.strictEqual(isWrongStoreUrl([v({ ok: false, reason: 'name-mismatch', sim: 0.33 })]), false);
  // 取得できなかった・同じ店が閉店・判定が無い は数えない
  assert.strictEqual(isWrongStoreUrl([v({ ok: false, reason: 'fetch-error' })]), false);
  assert.strictEqual(isWrongStoreUrl([v({ ok: false, reason: 'closed' })]), false);
  assert.strictEqual(isWrongStoreUrl(undefined), false);
  assert.strictEqual(isWrongStoreUrl([]), false);
  // ほかの店名では一致している URL は数えない（ページ側の使い方は正しいことがある）
  assert.strictEqual(isWrongStoreUrl([v({ ok: false, reason: 'name-mismatch', sim: 0 }), v({ ok: true })]), false);
});

test('ページ群の監査は、別の店と判定済みのリンクだけを返す', () => {
  const index = buildVerdictIndex({
    a: { url: TB, ok: false, reason: 'name-mismatch', sim: 0, storeName: 'うなぎのしろむら 泉店', matchedName: 'くらや', title: 'くらや - 栄（名古屋）/居酒屋 | 食べログ' },
    b: { url: 'https://tabelog.com/aichi/A2301/A230103/23056889/', ok: true, storeName: 'うなぎのしろむら 泉本店' },
    c: { url: 'https://www.hotpepper.jp/strJ003985167/', ok: false, reason: 'name-mismatch', sim: 0.44, storeName: 'とりやき酒場 鶏ん家 名古屋新栄店' },
  });
  const pages = [
    { file: 'features/x.html', html: `<a href="${TB}">食べログで詳細・予約を確認</a>` },
    { file: 'features/y.html', html: '<a href="https://tabelog.com/aichi/A2301/A230103/23056889/">食べログ</a><a href="https://www.hotpepper.jp/strJ003985167/">HP</a>' },
    { file: 'journal/z.html', html: '<a href="https://tabelog.com/aichi/A2301/A230101/99999999/">キャッシュに無い</a>' },
  ];
  const f = auditPages(pages, index);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].file, 'features/x.html');
  assert.deepStrictEqual(f[0].storeNames, ['うなぎのしろむら 泉店']);
  assert.match(f[0].title, /くらや/);
});

test('監査の対象はテンプレートを除く公開ページ', () => {
  const files = listPages(require('path').join(__dirname, '..'));
  assert.ok(files.some((f) => f.startsWith('features/')));
  assert.ok(files.some((f) => f.startsWith('journal/')));
  assert.ok(!files.some((f) => /\/_/.test(f)), 'journal/_template.html などは対象外');
});
