'use strict';
// 特集の見出し「N選」と実際の掲載数（ItemList・店カード）の一致を固定する（ISSUE-141）。
const test = require('node:test');
const assert = require('node:assert');
const { inspect, inspectAll } = require('../scripts/lib/feature_counts');

test('全特集で h1 の N選 = ItemList numberOfItems = 要素数 = 店カード枚数', () => {
  const bad = inspectAll();
  assert.deepStrictEqual(bad, [], JSON.stringify(bad, null, 1));
});

test('inspect: 不一致を検出できる', () => {
  const html = '<h1>名古屋の店10選</h1>' +
    '<script type="application/ld+json">{"@type":"ItemList","numberOfItems":2,"itemListElement":[{},{}]}</script>' +
    '<div class="shop-card"></div><div class="shop-card"></div>';
  const r = inspect(html);
  assert.strictEqual(r.n, 10);
  assert.strictEqual(r.problems.length, 2);
});

test('inspect: 一致していれば問題なし', () => {
  const html = '<h1>名古屋の店<em>2選</em></h1>' +
    '<script type="application/ld+json">{"@type":"ItemList","numberOfItems":2,"itemListElement":[{},{}]}</script>' +
    '<div class="store-card"></div><div class="store-card"></div>';
  assert.deepStrictEqual(inspect(html).problems, []);
});
