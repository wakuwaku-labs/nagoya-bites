'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { pickShop, toEntry } = require('../scripts/enrich_hotpepper_details');
const { mergeHotpepperTrending } = require('../scripts/lib/hotpepper_trending_merge');

const store = { 店名: '昼だけうなぎ屋 栄本店', 住所: '愛知県名古屋市中区栄３丁目１３−６ オー・ド・ヴィー 栄 ２Ｆ' };
const good = { id: 'J1', name: '昼だけうなぎ屋 栄本店', address: '愛知県名古屋市中区栄3-13-6 オー・ド・ヴィー栄2F', open: '11:00～14:00', close: '不定休', urls: { pc: 'https://www.hotpepper.jp/strJ1/' } };
const otherBranch = { id: 'J2', name: '昼だけうなぎ屋 栄本店', address: '愛知県名古屋市千種区今池1-12-2' };

test('店名と住所の両方が合う1件だけ選ぶ', () => {
  assert.strictEqual(pickShop(store, [otherBranch, good]).id, 'J1');
  assert.strictEqual(pickShop(store, [otherBranch]), null);
  assert.strictEqual(pickShop(store, [good, Object.assign({}, good, { id: 'J3' })]), null);
});

test('載せるのは営業時間・定休日・掲載URLだけで、ホットペッパーIDは入れず既存値を上書きしない', () => {
  const s = [{ 店名: 'A', 営業時間: '既存' }, { 店名: 'B', ホットペッパーID: 'J9' }, { 店名: 'C' }];
  const d = { A: toEntry(good, 'x'), B: toEntry(good, 'x'), C: { id: '', checkedAt: 'x' } };
  assert.strictEqual(mergeHotpepperTrending(s, d), 1);
  assert.strictEqual(s[0].営業時間, '既存');
  assert.strictEqual(s[0].定休日, '不定休');
  assert.strictEqual(s[0].ホットペッパー掲載URL, 'https://www.hotpepper.jp/strJ1/');
  assert.strictEqual(s[0].ホットペッパーID, undefined);
  assert.strictEqual(s[1].ホットペッパー掲載URL, undefined);
  assert.strictEqual(s[2].ホットペッパー掲載URL, undefined);
});
