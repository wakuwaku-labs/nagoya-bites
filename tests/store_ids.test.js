'use strict';
/**
 * tests/store_ids.test.js — P-246（I-21c）。ホットペッパーIDの無い店の共有用 ID（店舗ID）。
 * 判断の記録: docs/decisions/0041-store-share-id.md
 * 生成済みページや data/stores.json の件数には縛らない（npm test は再生成より前に走る）。
 */
const test = require('node:test');
const assert = require('node:assert');
const { storeShareId, assignStoreShareIds, shareIdKey } = require('../scripts/lib/store_ids');

test('形式: E + 英小文字と数字 10 文字。ホットペッパーID（J+数字）・古い M+6桁と重ならない', () => {
  const id = storeShareId({ '店名': '鮨うおのたな', 'エリア': '丸の内', placeId: 'ChIJabc' });
  assert.match(id, /^E[0-9a-f]{10}$/);
  assert.ok(!/^[JM]\d/.test(id));
});

test('ホットペッパーIDのある店には付けない（外す）', () => {
  assert.strictEqual(storeShareId({ '店名': 'x', 'ホットペッパーID': 'J001' }), '');
  const s = [{ '店名': 'x', 'ホットペッパーID': 'J001', '店舗ID': 'Eold' }];
  assignStoreShareIds(s);
  assert.ok(!('店舗ID' in s[0]));
});

test('安定: placeId があれば店名・エリア・並び順が変わっても同じ。無ければ 店名+エリア', () => {
  const a = storeShareId({ '店名': '旧名', 'エリア': '栄', placeId: 'P1' });
  const b = storeShareId({ '店名': '新名', 'エリア': '名駅', placeId: 'P1' });
  assert.strictEqual(a, b);
  assert.strictEqual(storeShareId({ '店名': 'A', 'エリア': '栄' }), storeShareId({ '店名': 'A', 'エリア': '栄' }));
  assert.notStrictEqual(storeShareId({ '店名': 'A', 'エリア': '栄' }), storeShareId({ '店名': 'A', 'エリア': '名駅' }));
  assert.ok(shareIdKey({ '店名': 'A', 'エリア': '栄' }).startsWith('name:'));
  // 並び順に依存しない
  const x = [{ '店名': 'A', 'エリア': '栄' }, { '店名': 'B', 'エリア': '栄' }];
  const y = [x[1], x[0]].map((s) => Object.assign({}, s));
  assignStoreShareIds(x); assignStoreShareIds(y);
  assert.strictEqual(x[0]['店舗ID'], y[1]['店舗ID']);
  assert.strictEqual(x[1]['店舗ID'], y[0]['店舗ID']);
});

test('同名・同エリア・placeId 無しの 2 件は別の ID になる（共有リンクが別の店を指さない）', () => {
  const s = [{ '店名': 'A', 'エリア': '栄' }, { '店名': 'A', 'エリア': '栄' }];
  const r = assignStoreShareIds(s);
  assert.strictEqual(r.collisions, 1);
  assert.notStrictEqual(s[0]['店舗ID'], s[1]['店舗ID']);
});

test('実データ: 付けた ID は重ならず、ホットペッパーIDとも重ならない（件数には縛らない）', () => {
  const fs = require('fs');
  const path = require('path');
  const all = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'stores.json'), 'utf8')).map((s) => Object.assign({}, s));
  assignStoreShareIds(all);
  const seen = new Set(all.map((s) => s['ホットペッパーID']).filter(Boolean));
  for (const s of all) {
    if (s['ホットペッパーID']) { assert.ok(!s['店舗ID']); continue; }
    assert.match(s['店舗ID'], /^E[0-9a-f]{10}$/, s['店名']);
    assert.ok(!seen.has(s['店舗ID']), '重複: ' + s['店名']);
    seen.add(s['店舗ID']);
  }
});

test('build.js は ID 採番を並べ替え・書き出しの前に呼ぶ', () => {
  const fs = require('fs');
  const path = require('path');
  const b = fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8');
  const i = b.indexOf("assignStoreShareIds(slimStores)");
  assert.ok(i > 0);
  assert.ok(i < b.indexOf('slimStores.sort('), '並べ替えより前');
  assert.ok(i < b.indexOf("fs.writeFileSync(storesJsonPath, fullJsonStr"), 'stores.json の書き出しより前');
});
