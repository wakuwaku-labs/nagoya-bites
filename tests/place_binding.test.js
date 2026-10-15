'use strict';
// MEO-003 / MEO-004: 店と Google の店舗情報の紐付けの状態（確認済み・要確認・不一致）と、電話のボタンの関門。
// 例は計画書 docs/meo-plan-2026-10.md の 1.3 節・6.1 節の実例から作った。

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const binding = require(path.join(ROOT, 'scripts', 'lib', 'place_binding.js'));
const { FIELD, annotatePhoneLinks } = require(path.join(ROOT, 'scripts', 'lib', 'phone_link.js'));

const POLICY = {
  features: { phone: { show: true, allowReviewBands: ['sim-0.3-0.6', 'sim-ge-0.6', 'branch-conflict'] } },
};
const NO_REVIEW = { entries: [] };

// Google 側の記録（data/places_resolved.json の形）
const places = {
  // 屋上酒場ホシノシタ（名駅4-17-4）が紐付いていた先。住所は丁目まで同じなので、以前は電話確認が「住所」で通った
  J000000001: { fetchedAt: '2026-05-22T06:41:02.407Z', placeId: 'P_HINOKAMI', name: '炭火焼き 居酒屋 ヒノカミ 名駅店', formatted_address: '日本、〒450-0002 愛知県名古屋市中村区名駅４丁目４−１８ 泰生ビル 3F' },
  J000000002: { fetchedAt: '2026-05-22T06:41:02.407Z', placeId: 'P_HINOKAMI', name: '炭火焼き 居酒屋 ヒノカミ 名駅店', formatted_address: '日本、〒450-0002 愛知県名古屋市中村区名駅４丁目４−１８ 泰生ビル 3F' },
  J000000003: { fetchedAt: '2026-05-22T06:41:02.407Z', placeId: 'P_KIYOHIRA', name: 'きよひら', formatted_address: '日本、〒451-0025 愛知県名古屋市西区上名古屋３丁目１３−３０' },
  J000000004: { fetchedAt: '2026-05-22T06:41:02.407Z', placeId: 'P_ISOMARU', name: '磯丸水産 栄三丁目店', formatted_address: '日本、〒460-0008 愛知県名古屋市中区栄３丁目１１−３１' },
  J000000005: { fetchedAt: '2026-05-22T06:41:02.407Z', placeId: 'P_GOMI', name: 'メゾン神宮 103号, ４丁目-１-21 神宮 熱田区', formatted_address: 'メゾン神宮 103号, ４丁目-１-21 神宮 熱田区' },
  J000000006: { fetchedAt: '2026-05-22T06:41:02.407Z', rejected: true, candidateName: '別の店' },
};

const hinokami = { '店名': '炭火焼き 居酒屋 ヒノカミ 名駅店', '住所': '愛知県名古屋市中村区名駅4-4-18 泰生ビル3F', 'ホットペッパーID': 'J000000001', placeId: 'P_HINOKAMI' };
const hoshinoshita = { '店名': '屋上酒場ホシノシタ', '住所': '愛知県名古屋市中村区名駅4-17-4', 'ホットペッパーID': 'J000000002', placeId: 'P_HINOKAMI' };
const kiyohira = { '店名': '清平', '住所': '愛知県名古屋市西区上名古屋3-13-30', 'ホットペッパーID': 'J000000003', placeId: 'P_KIYOHIRA' };
const isomaru = { '店名': '磯丸水産 栄女子大店', '住所': '愛知県名古屋市中区栄4-1-1', 'ホットペッパーID': 'J000000004', placeId: 'P_ISOMARU' };

function ctxOf(stores, opts) {
  return binding.buildContext(stores, places, { policy: POLICY, reviewed: NO_REVIEW, ...(opts || {}) });
}

test('店名が合えば確認済み', () => {
  const ctx = ctxOf([hinokami]);
  const b = binding.bindingOf(hinokami, ctx);
  assert.equal(b.state, 'confirmed');
  assert.equal(b.reason, 'name-match');
});

test('同じ placeId を店名の合う別の掲載店が使っていれば、店名の合わない方は不一致（ホシノシタ → ヒノカミ）', () => {
  const ctx = ctxOf([hinokami, hoshinoshita]);
  assert.equal(binding.bindingOf(hoshinoshita, ctx).state, 'mismatch');
  assert.equal(binding.bindingOf(hoshinoshita, ctx).reason, 'place-owned-by-other');
  assert.equal(binding.bindingOf(hinokami, ctx).state, 'confirmed', '店名の合う方は確認済みのまま');
});

test('店名が合わず、ほかに持ち主もいなければ要確認。帯は店名の一致率で決まる', () => {
  const ctx = ctxOf([hoshinoshita]);
  const b = binding.bindingOf(hoshinoshita, ctx);
  assert.equal(b.state, 'review');
  assert.equal(b.band, 'sim-0');
  assert.equal(binding.bindingOf(kiyohira, ctxOf([kiyohira])).band, 'sim-0');
});

test('人の確認の記録: keep は確認済み・reject は不一致（キーと Google 側の名前の組で引く）', () => {
  const reviewed = { entries: [
    { key: 'J000000003', googleName: 'きよひら', decision: 'keep', reason: '同じ番地。読みの違い' },
    { key: 'J000000002', googleName: '炭火焼き 居酒屋 ヒノカミ 名駅店', decision: 'reject', reason: '別の店' },
  ] };
  assert.equal(binding.bindingOf(kiyohira, ctxOf([kiyohira], { reviewed })).state, 'confirmed');
  assert.equal(binding.bindingOf(hoshinoshita, ctxOf([hoshinoshita], { reviewed })).reason, 'reviewed-reject');
  // Google 側の名前が変われば記録は効かない（確かめ直す）
  const renamed = { ...places, J000000003: { ...places.J000000003, name: '清平 本店' } };
  const ctx = binding.buildContext([kiyohira], renamed, { policy: POLICY, reviewed });
  assert.notEqual(binding.bindingOf(kiyohira, ctx).reason, 'reviewed-keep');
});

test('住所が別の場所なら不一致。Google 側の住所が標準の形（〒）でなければ比べない', () => {
  assert.equal(binding.bindingOf(isomaru, ctxOf([isomaru])).reason, 'address-different');
  const odd = { '店名': '五味', '住所': '愛知県名古屋市熱田区神宮4-1-21', 'ホットペッパーID': 'J000000005', placeId: 'P_GOMI' };
  assert.notEqual(binding.bindingOf(odd, ctxOf([odd])).reason, 'address-different');
});

test('紐付けが無い・却下済みの店', () => {
  assert.equal(binding.bindingOf({ '店名': 'x' }, ctxOf([])).state, 'none');
  assert.equal(binding.bindingOf({ '店名': 'x', placeId: 'P_NONE', 'ホットペッパーID': 'J9' }, ctxOf([])).reason, 'no-record');
  assert.equal(binding.bindingOf({ '店名': 'x', placeId: 'P_X', 'ホットペッパーID': 'J000000006' }, ctxOf([])).reason, 'rejected');
});

test('allowedFor: 確認済みは出す・不一致は出さない・要確認は許した帯だけ・スイッチを切れば全部出さない', () => {
  const f = (b, pol) => binding.allowedFor('phone', b, pol || POLICY).ok;
  assert.equal(f({ state: 'confirmed' }), true);
  assert.equal(f({ state: 'mismatch' }), false);
  assert.equal(f({ state: 'review', band: 'sim-0' }), false);
  assert.equal(f({ state: 'review', band: 'sim-lt-0.3' }), false);
  assert.equal(f({ state: 'review', band: 'sim-0.3-0.6' }), true);
  assert.equal(f({ state: 'none', reason: 'no-record' }), false);
  const off = { features: { phone: { show: false, allowReviewBands: [] } } };
  assert.equal(binding.allowedFor('phone', { state: 'confirmed' }, off).reason, 'switched-off');
  // 設定の書き忘れで全店が消えないよう、機能の設定が無いときは不一致だけ止める
  assert.equal(binding.allowedFor('rating', { state: 'review', band: 'sim-0' }, POLICY).ok, true);
  assert.equal(binding.allowedFor('rating', { state: 'mismatch' }, POLICY).ok, false);
});

test('data/place_binding_policy.json: 電話は一致率 0.3 未満の帯を許していない（オーナーの判断 2=A）', () => {
  const pol = binding.loadPolicy();
  const phone = pol.features.phone;
  assert.equal(phone.show, true);
  for (const band of phone.allowReviewBands) assert.ok(binding.BANDS.includes(band), `知らない帯: ${band}`);
  assert.equal(phone.allowReviewBands.includes('sim-0'), false);
  assert.equal(phone.allowReviewBands.includes('sim-lt-0.3'), false);
});

test('annotatePhoneLinks: 住所は丁目まで同じでも、紐付けの状態で止めた店には電話確認の欄を付けない', () => {
  const stores = [{ ...hinokami }, { ...hoshinoshita, [FIELD]: '住所' }, { ...kiyohira }];
  const counts = annotatePhoneLinks(stores, places, { policy: POLICY, reviewed: NO_REVIEW });
  assert.deepEqual(stores.map((s) => s[FIELD]), ['住所', undefined, undefined]);
  assert.equal(counts['binding-mismatch'], 1, 'ホシノシタは不一致（同じ placeId をヒノカミが使う）');
  assert.equal(counts['binding-review'], 1, '清平は要確認の sim-0 帯');
  // 人が同じ店と記録すれば戻る
  const reviewed = { entries: [{ key: 'J000000003', googleName: 'きよひら', decision: 'keep' }] };
  annotatePhoneLinks(stores, places, { policy: POLICY, reviewed });
  assert.equal(stores[2][FIELD], '住所');
  // スイッチを切れば全店で出さない
  const off = annotatePhoneLinks(stores, places, { policy: { features: { phone: { show: false } } }, reviewed: NO_REVIEW });
  assert.equal(off['switched-off'], 3, '住所か店名では出せる 3 店がすべてスイッチで止まる');
  assert.deepEqual(stores.map((s) => s[FIELD]), [undefined, undefined, undefined]);
});
