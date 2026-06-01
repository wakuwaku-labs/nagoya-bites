'use strict';

/**
 * data/stores.json（canonical 店舗カタログ）のデータ整合性テスト。
 * build.js やデータ更新の事故（評価値の桁化け・必須欠落・件数急減）を検知する。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadStores } = require('../scripts/lib/load_stores.js');

const stores = loadStores();

test('stores.json: 件数が妥当な範囲（> 1000）', () => {
  assert.ok(stores.length > 1000, `件数が少なすぎる: ${stores.length}`);
});

test('stores.json: Google評価は 0〜5 の数値 or 空', () => {
  const bad = [];
  for (const s of stores) {
    const r = s['Google評価'];
    if (r === '' || r == null) continue;
    const n = Number(r);
    if (!Number.isFinite(n) || n < 0 || n > 5) bad.push({ 店名: s['店名'], 評価: r });
  }
  assert.equal(bad.length, 0, `Google評価が範囲外: ${JSON.stringify(bad.slice(0, 10))}`);
});

test('stores.json: 全店に店名がある', () => {
  const missing = stores.filter(s => !s['店名'] || !String(s['店名']).trim());
  assert.equal(missing.length, 0, `店名欠落が ${missing.length} 件`);
});

test('stores.json: 都道府県は主に愛知（地域フィルタの健全性）', () => {
  const withPref = stores.filter(s => s['都道府県']);
  if (withPref.length === 0) return; // フィールド未使用なら検査しない
  const aichi = withPref.filter(s => String(s['都道府県']).includes('愛知')).length;
  const rate = aichi / withPref.length;
  assert.ok(rate > 0.8, `愛知県比率が低い: ${(rate * 100).toFixed(1)}% — 他都市データ混入の疑い`);
});

test('stores.json: 話題フラグ/編集部推薦は真偽値として解釈可能', () => {
  const ok = v => v === undefined || typeof v === 'boolean' || v === '' || v === 'true' || v === 'false' || v === true || v === false;
  const bad = stores.filter(s => !ok(s['話題フラグ']) || !ok(s['編集部推薦']));
  assert.equal(bad.length, 0, `フラグ値が不正: ${JSON.stringify(bad.slice(0, 5).map(s => s['店名']))}`);
});
