'use strict';
// SEO-139: Google のレビュー スニペットの方針（他のサイトの評価を集めて載せない）に合わせ、
// Google 口コミ由来の aggregateRating を構造化データに出さない。終了した SearchAction も出さない。
// 判断の記録: docs/decisions/0009-structured-data-third-party-ratings.md
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const v = JSON.parse(m[1]);
    out.push(...(Array.isArray(v) ? v : [v]));
  }
  return out;
}

test('店舗ページの JSON-LD に aggregateRating を出さない（画面の★表示は残す）', () => {
  const s = { '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋', 'Google評価': '4.3', '口コミ数': '120' };
  const html = renderStorePage(s, 'J-test', [], []);
  const blocks = jsonLdBlocks(html);
  const restaurant = blocks.find(b => b['@type'] === 'Restaurant');
  assert.ok(restaurant, 'Restaurant の JSON-LD はある');
  assert.equal(restaurant.aggregateRating, undefined);
  assert.ok(!JSON.stringify(blocks).includes('AggregateRating'));
  assert.match(html, /<div class="score"[^>]*>[\s\S]*?4\.3<\/div>/, '★の表示は残す');
});

test('index.html: JSON-LD に SearchAction と AggregateRating が無く、WebSite の名前は残す', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const blocks = jsonLdBlocks(html);
  const text = JSON.stringify(blocks);
  assert.ok(!text.includes('SearchAction'));
  assert.ok(!text.includes('AggregateRating'));
  const site = blocks.find(b => b['@type'] === 'WebSite');
  assert.ok(site && site.name && site.url, 'サイト名の構造化データは残す');
});

test('index.html: モーダルで差し込む Restaurant の JSON-LD に aggregateRating を入れない', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = html.indexOf("el.id = 'modal-store-jsonld'");
  assert.ok(i > 0, 'モーダルの JSON-LD 差し込みがある');
  const block = html.slice(html.lastIndexOf('var schema = {', i), i);
  assert.ok(block.includes("'@type': 'Restaurant'"));
  assert.ok(!/'aggregateRating'\s*:/.test(block));
});
