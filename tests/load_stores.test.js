'use strict';

/**
 * scripts/lib/load_stores.js の単体テスト。
 * 全件読込ヘルパーが canonical データを正しく返すこと、最低限のスキーマを満たすことを確認。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadStores } = require('../scripts/lib/load_stores.js');

test('loadStores: 非空の配列を返す', () => {
  const stores = loadStores();
  assert.ok(Array.isArray(stores), '配列であるべき');
  assert.ok(stores.length > 100, `件数が極端に少ない (${stores.length}) — データ破損の疑い`);
});

test('loadStores: 各店が店名/ジャンル/エリアを持つ（必須フィールド）', () => {
  const stores = loadStores();
  const sample = stores.slice(0, 200);
  for (const s of sample) {
    assert.ok(s['店名'] && String(s['店名']).trim(), `店名欠落: ${JSON.stringify(s).slice(0, 120)}`);
    assert.ok('ジャンル' in s, '"ジャンル" キーが無い');
    assert.ok('エリア' in s, '"エリア" キーが無い');
  }
});

test('loadStores: 店名の重複が異常に多くない（< 5%）', () => {
  const stores = loadStores();
  const names = stores.map(s => `${s['店名']}@@${s['エリア'] || ''}`);
  const uniq = new Set(names);
  const dupRate = 1 - uniq.size / names.length;
  assert.ok(dupRate < 0.05, `店名+エリアの重複率が高すぎる: ${(dupRate * 100).toFixed(1)}%`);
});
