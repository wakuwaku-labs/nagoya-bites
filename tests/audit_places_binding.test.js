'use strict';

/**
 * scripts/audit_places_binding.js（Google Places の紐付けの監査・P-142）の判定を固定する。
 * 実データの件数は日々変わるので見ない。合成データで、外す条件・外さない条件・帯の分け方を確かめる。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { audit, summarize, applyRejects, REJECT_REASON } = require('../scripts/audit_places_binding.js');

const addr = (rest) => `日本、〒460-0003 愛知県名古屋市中区${rest}`;
function store(name, address, id) { return { '店名': name, '住所': `愛知県名古屋市中区${address}`, 'ホットペッパーID': id }; }
function entry(name, address) {
  return { fetchedAt: '2026-05-22T00:00:00.000Z', placeId: 'P_' + name, name, formatted_address: addr(address), rating: 4, user_ratings_total: 100 };
}

test('住所が別の場所で屋号が似ていない紐付けは外す対象', () => {
  const stores = [store('麺屋えび蔵', '錦２-13-24', 'J1')];
  const places = { J1: entry('海老麺や', '錦３丁目１３−４') };
  const rows = audit(stores, places, null);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].decision, 'reject');
  assert.equal(rows[0].rejectBasis, 'address-different');
});

test('住所が同じで屋号が一部重なる紐付けは外さない（決められない）', () => {
  const stores = [store('咲夜島 さくやじま 丸の内 伏見', '錦３丁目14-3', 'J2')];
  const places = { J2: entry('咲夜島', '錦３丁目１４−３') };
  const rows = audit(stores, places, null);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].decision, 'undecided');
});

test('住所が同じで屋号が重ならない候補は、人が確かめた記録があるときだけ外す', () => {
  const stores = [store('台北館', '錦３-11-15 錦101ビル4階', 'J3')];
  const places = { J3: entry('古式蕎麦 玄水', '錦３丁目１１−１５ 錦101ビル') };
  const none = audit(stores, places, null);
  assert.equal(none[0].decision, 'undecided');
  const rv = { entries: [{ key: 'J3', googleName: '古式蕎麦 玄水', decision: 'reject', reason: '別の店' }] };
  const done = audit(stores, places, rv);
  assert.equal(done[0].decision, 'reject');
  assert.equal(done[0].rejectBasis, 'same-building-reviewed');
});

test('名前が一致する紐付け・rejected・notFound は対象にしない', () => {
  const stores = [store('魚虎', '中村町８-39', 'J4'), store('A店', '錦１-1-1', 'J5'), store('B店', '錦１-1-1', 'J6')];
  const places = { J4: entry('魚虎', '錦３丁目１−１'), J5: { rejected: true }, J6: { notFound: true } };
  assert.equal(audit(stores, places, null).length, 0);
});

test('Google 側の住所が標準の形でないときは住所で外さない', () => {
  const stores = [store('インドネパール料理&居酒屋 ラッソ', '栄４-1-21', 'J7')];
  const places = { J7: { ...entry('ラッソー', ''), formatted_address: 'メゾン神宮 103号, ４丁目-１-21 神宮 熱田区 名古屋市 愛知県' } };
  const rows = audit(stores, places, null);
  assert.equal(rows[0].addressVerdict, 'unknown');
  assert.notEqual(rows[0].decision, 'reject');
});

test('applyRejects は rejected・rejectReason・証跡を書き、評価と口コミを残さない', () => {
  const stores = [store('麺屋えび蔵', '錦２-13-24', 'J1')];
  const places = { J1: entry('海老麺や', '錦３丁目１３−４') };
  places.J1.latestReviews = [{ rating: 5 }];
  const rows = audit(stores, places, null);
  assert.equal(applyRejects(rows, places), 1);
  assert.equal(places.J1.rejected, true);
  assert.equal(places.J1.rejectReason, REJECT_REASON);
  assert.equal(places.J1.previousPlaceId, 'P_海老麺や');
  assert.equal(places.J1.rating, undefined);
  assert.equal(places.J1.latestReviews, undefined);
  assert.equal(audit(stores, places, null).length, 0);
});

test('summarize は帯ごとに住所の判定を数える', () => {
  const sum = summarize([
    { band: 'sim-0', addressVerdict: 'same' }, { band: 'sim-0', addressVerdict: 'different' },
    { band: 'branch-conflict', addressVerdict: 'unknown' }
  ]);
  assert.deepEqual(sum['sim-0'], { total: 2, same: 1, different: 1, unknown: 0 });
  assert.equal(sum['branch-conflict'].unknown, 1);
});

// ---------------------------------------------------------------- MEO-003（A1・A2）: 状態ごとの数と標本

const { states, sample, SAMPLE_BANDS } = require('../scripts/audit_places_binding.js');
const POLICY = { features: { phone: { show: true, allowReviewBands: ['sim-0.3-0.6', 'sim-ge-0.6', 'branch-conflict'] } } };
const OPTS = { policy: POLICY, reviewed: { entries: [] } };

function bound(name, address, id, placeName, extra) {
  return { ...store(name, address, id), placeId: 'P_' + placeName, ...(extra || {}) };
}

test('states: 状態ごとの店の数と、電話・評価・口コミ信頼度がどの状態の紐付けを使っているかを数える', () => {
  const stores = [
    bound('麺屋えび蔵', '錦２-13-24', 'J1', '麺屋えび蔵', { '電話確認': '住所', 'Google評価': '4.1', reviewTrust: { t: 'A', d: '2026-10-01' } }),
    bound('咲夜島 さくやじま 丸の内 伏見', '錦３丁目14-3', 'J2', '咲夜島', { '電話確認': '住所', 'Google評価': '3.9', reviewTrust: { t: 'B', d: '2026-05-22' } }),
    bound('別館', '栄１-1-1', 'J3', '麺屋えび蔵', { 'Google評価': '0', reviewTrust: { t: '—' } }),
    { '店名': '紐付けなし', '住所': '愛知県名古屋市中区栄2-2-2', 'ホットペッパーID': 'J4' },
  ];
  const places = {
    J1: entry('麺屋えび蔵', '錦２丁目１３−２４'),
    J2: entry('咲夜島', '錦３丁目１４−３'),
    J3: entry('麺屋えび蔵', '錦２丁目１３−２４'),
  };
  const r = states(stores, places, OPTS, '2026-10-15');
  assert.equal(r.total, 4);
  assert.equal(r.byState.confirmed, 1);
  assert.equal(r.byState['review:sim-lt-0.3'], 1);
  assert.equal(r.byState['mismatch:address-different'], 1, '別館は住所が別の場所');
  assert.equal(r.byState['none:no-place-id'], 1);
  assert.deepEqual(r.features.phone, { confirmed: 1, 'review:sim-lt-0.3': 1 });
  assert.deepEqual(r.notConfirmed, { phone: 1, rating: 1, trust: 1 }, '評価が 0 の店と段階「—」は数えない');
  assert.equal(r.staleRating, 1, '取得日が 90 日より古い評価（2026-05-22）');
});

test('sample: 帯ごとに決まった種で選び、同じ種なら同じ標本。不一致・紐付けなしは選ばない', () => {
  const stores = [];
  const places = {};
  // 店名の一致率が 0.3 未満になるよう、掲載と Google で文字の重ならない名前にする
  const ours = '甲乙丙丁戊己庚辛壬癸子丑';
  const theirs = '春夏秋冬東西南北松竹梅桜';
  for (let i = 0; i < 12; i++) {
    stores.push(bound(`麺処${ours[i]}`, `錦２-1-${i + 1}`, `J1${i}`, `鮨屋${theirs[i]}`));
    places[`J1${i}`] = entry(`鮨屋${theirs[i]}`, `錦２丁目１−${i + 1}`);
  }
  stores.push(bound('麺屋えび蔵', '錦２-13-24', 'J9', '麺屋えび蔵'));
  places.J9 = entry('麺屋えび蔵', '錦２丁目１３−２４');
  const a = sample(stores, places, 5, 42, OPTS);
  const b = sample(stores, places, 5, 42, OPTS);
  assert.deepEqual(Object.keys(a), SAMPLE_BANDS);
  assert.deepEqual(a, b, '同じ種なら同じ標本');
  assert.equal(a['lt-0.3'].poolSize, 12);
  assert.equal(a['lt-0.3'].picked.length, 5);
  assert.equal(new Set(a['lt-0.3'].picked.map((x) => x.key)).size, 5, '同じ組を 2 回選ばない');
  assert.equal(a.confirmed.picked[0].storeUrl, 'https://www.hotpepper.jp/strJ9/');
  assert.match(a.confirmed.picked[0].googleUrl, /place_id:P_麺屋えび蔵$/);
  const c = sample(stores, places, 5, 43, OPTS);
  assert.notDeepEqual(c['lt-0.3'].picked.map((x) => x.key), a['lt-0.3'].picked.map((x) => x.key), '種を変えれば別の標本');
});
