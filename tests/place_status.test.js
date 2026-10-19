'use strict';
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../scripts/lib/place_status');

const policy = { dailyLimit: 2, monthlyCap: 10 };
const now = new Date('2026-10-19T00:00:00Z');
const mk = (id, name) => ({ ホットペッパーID: id, 店名: name, 住所: '愛知県名古屋市中村区名駅4-4-18', placeId: 'P' + id });
const places = (stores) => Object.fromEntries(stores.map((s) => [s['ホットペッパーID'], { placeId: s.placeId, name: s['店名'], formatted_address: '日本、〒450-0002 愛知県名古屋市中村区名駅４丁目４−１８', fetchedAt: '2026-05-22T00:00:00Z' }]));

test('古い順・未取得が先・1日の上限まで', () => {
  const st = [mk('J1', '焼肉太郎'), mk('J2', '寿司花子'), mk('J3', '蕎麦次郎')];
  const status = { usage: {}, entries: { J1: { placeId: 'PJ1', checkedAt: '2026-10-18T00:00:00Z' }, J2: { placeId: 'PJ2', checkedAt: '2026-10-01T00:00:00Z' } } };
  const t = lib.pickTargets(st, places(st), status, policy, now);
  assert.deepStrictEqual(t.map((s) => s['店名']), ['蕎麦次郎', '寿司花子']);
});
test('月の残り枠が尽きたら選ばない', () => {
  const st = [mk('J1', '焼肉太郎')];
  const t = lib.pickTargets(st, places(st), { usage: { '2026-10': 10 }, entries: {} }, policy, now);
  assert.strictEqual(t.length, 0);
});
test('紐付けが確認済みでない店は取り直さない', () => {
  const st = [mk('J1', '焼肉太郎')];
  const p = places(st); p.J1.name = '全く別の店名ABC';
  assert.strictEqual(lib.pickTargets(st, p, { usage: {}, entries: {} }, policy, now).length, 0);
});
test('judge: 名前と住所が合えば根拠にできる・住所が別なら根拠にしない', () => {
  const s = mk('J1', '焼肉太郎');
  const a = lib.judge(s, { name: '焼肉太郎', formatted_address: '日本、〒450-0002 愛知県名古屋市中村区名駅４丁目４−１８', business_status: 'CLOSED_PERMANENTLY' }, now);
  assert.strictEqual(a.usable, true);
  const b = lib.judge(s, { name: '焼肉太郎', formatted_address: '日本、〒460-0008 愛知県名古屋市中区栄３丁目１−１', business_status: 'CLOSED_PERMANENTLY' }, now);
  assert.strictEqual(b.usable, false);
});
test('closures: 根拠にできる閉業だけ数える', () => {
  const s = mk('J1', '焼肉太郎'); s['エリア'] = '名駅';
  const c = lib.closures({ entries: { J1: { status: 'CLOSED_PERMANENTLY', usable: true, checkedAt: '2026-10-19T00:00:00Z' }, J2: { status: 'CLOSED_PERMANENTLY', usable: false } } }, [s]);
  assert.strictEqual(c.permanent.length, 1);
  assert.strictEqual(c.unusable, 1);
});
