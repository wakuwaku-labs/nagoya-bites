'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { backfillStoreDetails, cleanAddress } = require('../scripts/lib/store_detail_backfill');

const places = {
  'manual:A|栄': { placeId: 'P1', formatted_address: '日本、〒460-0008 愛知県名古屋市中区栄３丁目１３−６ オー・ド・ヴィー 栄 ２Ｆ' },
  'manual:B|栄': { placeId: 'P2', formatted_address: '日本、〒150-0001 東京都渋谷区神宮前1-1' },
};

test('cleanAddress は日本・郵便番号を落とす', () => {
  assert.strictEqual(cleanAddress(places['manual:A|栄'].formatted_address), '愛知県名古屋市中区栄３丁目１３−６ オー・ド・ヴィー 栄 ２Ｆ');
});

test('紐付けが確認できた店だけ住所を補い、既存の値・ホットペッパーIDは触らない', () => {
  const stores = [
    { 店名: 'A', placeId: 'P1', 電話確認: '住所' },
    { 店名: 'A2', placeId: 'P1' },                       // 未確認 → 見送り
    { 店名: 'B', placeId: 'P2', 地図確認: true },         // 愛知県でない → 書かない
    { 店名: 'C', placeId: 'P1', 電話確認: '店名', 住所: '既存' },
  ];
  const c = backfillStoreDetails(stores, places);
  assert.strictEqual(stores[0].住所, '愛知県名古屋市中区栄３丁目１３−６ オー・ド・ヴィー 栄 ２Ｆ');
  assert.strictEqual(stores[1].住所, undefined);
  assert.strictEqual(stores[2].住所, undefined);
  assert.strictEqual(stores[3].住所, '既存');
  assert.strictEqual(stores[0].ホットペッパーID, undefined);
  assert.strictEqual(c.address, 1);
});
