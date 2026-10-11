'use strict';
// I-36（P-273）: 電話のボタンを出してよい店の判定。
// - 紐付け先の Google の住所と掲載の住所を比べる（同じ→出す／別の場所→出さない）
// - 住所で比べられない店だけ店名で比べる（合うときだけ出す）
// - 別の店と確かめて外した紐付け（rejected）・placeId なし・記録なしは出さない
// - 結果は「電話確認」の欄に根拠として持たせ、確かめられない店からは外す（冪等）
// - build.js が重複統合の後・出力の間引きの前に呼び、欄が LOCAL_STORES と data/stores.json に届く
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const {
  FIELD, REASONS, buildPlaceIndex, phoneLinkVerdict, annotatePhoneLinks, canShowCallButton,
} = require(path.join(ROOT, 'scripts', 'lib', 'phone_link.js'));

const GOOGLE_ADDR = '日本、〒450-0002 愛知県名古屋市中村区名駅４丁目４−１８ 泰生ビル 3F';
const places = {
  J000000001: { fetchedAt: '2026-05-22T06:41:02.407Z', placeId: 'P_HINOKAMI', name: '炭火焼き 居酒屋 ヒノカミ 名駅店', formatted_address: GOOGLE_ADDR, business_status: 'OPERATIONAL' },
  J000000002: { fetchedAt: '2026-05-22T06:41:03.000Z', placeId: 'P_AWAYUKI', name: 'かき氷専門店 awayuki', formatted_address: '日本、〒460-0008 愛知県名古屋市中区栄３丁目５−１ マルエイガレリア', business_status: 'OPERATIONAL' },
  'manual:カフェ チカク|名古屋市中区': { fetchedAt: '2026-05-22T06:41:04.000Z', placeId: 'P_CHIKAKU', name: 'チカク', formatted_address: '日本、〒460-0003 愛知県名古屋市中区錦２丁目', business_status: 'OPERATIONAL' },
  J000000009: { fetchedAt: '2026-05-22T06:43:18.331Z', rejected: true, rejectReason: 'address-mismatch', candidateName: '魚々路 ととろ 釧路栄町店', candidateAddress: '日本、〒085-0013 北海道釧路市栄町５丁目４' },
};
const index = buildPlaceIndex(places);

const store = (over) => ({
  '店名': '炭火焼き 居酒屋 ヒノカミ 名駅店',
  '住所': '愛知県名古屋市中村区名駅4-4-18 泰生ビル3F',
  'ホットペッパーID': 'J000000001',
  placeId: 'P_HINOKAMI',
  ...over,
});

// ---------------------------------------------------------------- 1店の判定

test('住所が同じ場所なら出す（根拠は住所）', () => {
  const v = phoneLinkVerdict(store(), index, places);
  assert.deepEqual(v, { ok: true, basis: '住所', reason: 'address-same' });
});

test('住所が別の場所なら出さない。店名が同じ（チェーンの別の支店）でも出さない', () => {
  const v = phoneLinkVerdict(store({ '住所': '愛知県名古屋市中区栄3-5-1' }), index, places);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'address-different');
  assert.equal(v.basis, undefined);
});

test('住所で比べられないときだけ店名で比べる。合えば出す（根拠は店名）', () => {
  assert.deepEqual(phoneLinkVerdict(store({ '住所': '' }), index, places), { ok: true, basis: '店名', reason: 'address-unknown-name-ok' });
  assert.deepEqual(phoneLinkVerdict(store({ '住所': '名古屋駅前' }), index, places), { ok: true, basis: '店名', reason: 'address-unknown-name-ok' });
  const noAddr = store({ '住所': undefined });
  delete noAddr['住所'];
  assert.equal(phoneLinkVerdict(noAddr, index, places).reason, 'address-unknown-name-ok');
});

test('住所で比べられず店名も合わなければ出さない（ISSUE-147: かき氷 うと の紐付け先は awayuki）', () => {
  const s = store({ '店名': 'かき氷 うと（栄マルエイガレリア店）', '住所': '', 'ホットペッパーID': 'J000000002', placeId: 'P_AWAYUKI' });
  const v = phoneLinkVerdict(s, index, places);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'address-unknown-name-ng');
});

test('住所が比べられるときは店名の表記が違っても出す（店名だけで決めない）', () => {
  // 「カフェ チカク」と Google の「チカク」は店名の判定では合わないが、住所が同じ場所なら同じ店
  const s = store({ '店名': 'カフェ チカク', '住所': '愛知県名古屋市中区錦2-3-4', 'ホットペッパーID': '', 'エリア': '名古屋市中区', placeId: 'P_CHIKAKU' });
  assert.deepEqual(phoneLinkVerdict(s, index, places), { ok: true, basis: '住所', reason: 'address-same' });
});

test('placeId が無い店・記録が無い店・別の店と確かめて外した紐付けは出さない', () => {
  assert.equal(phoneLinkVerdict(store({ placeId: '' }), index, places).reason, 'no-place-id');
  const noKey = store();
  delete noKey.placeId;
  assert.equal(phoneLinkVerdict(noKey, index, places).reason, 'no-place-id');
  assert.equal(phoneLinkVerdict(store({ placeId: 'P_UNKNOWN' }), index, places).reason, 'no-record');
  // rejected: その店のキーの記録が却下されている（別の出どころの placeId が付いていても使わない）
  const rejected = store({ 'ホットペッパーID': 'J000000009' });
  assert.equal(phoneLinkVerdict(rejected, index, places).reason, 'rejected');
  assert.equal(phoneLinkVerdict(rejected, index, places).ok, false);
  // places を渡さなければ rejected は確かめない（索引だけで判定する）
  assert.equal(phoneLinkVerdict(rejected, index).reason, 'address-same');
});

// ---------------------------------------------------------------- 索引

test('索引: 同じ placeId が複数のキーに付いていれば、取得が新しい方を使う。順番に依らない', () => {
  const older = { fetchedAt: '2026-01-01T00:00:00.000Z', placeId: 'P_X', name: '旧店名', formatted_address: '愛知県名古屋市中区錦1-1-1' };
  const newer = { fetchedAt: '2026-06-01T00:00:00.000Z', placeId: 'P_X', name: '新店名', formatted_address: '愛知県名古屋市中区栄1-1-1' };
  assert.equal(buildPlaceIndex({ a: older, b: newer }).get('P_X').name, '新店名');
  assert.equal(buildPlaceIndex({ b: newer, a: older }).get('P_X').name, '新店名');
});

test('索引: placeId か名前の無い記録（rejected・notFound・error）は入らない', () => {
  const idx = buildPlaceIndex({
    a: { rejected: true, candidateName: 'x' },
    b: { notFound: true },
    c: { error: 'x' },
    d: { placeId: 'P_D' },
    e: null,
    f: { placeId: 'P_F', name: 'ok', formatted_address: '' },
  });
  assert.deepEqual([...idx.keys()], ['P_F']);
});

// ---------------------------------------------------------------- 全店への反映

test('annotatePhoneLinks: 確かめられた店に根拠を入れ、そうでない店と古い欄を外す。placeId は触らない。冪等', () => {
  const stores = [
    store(),                                                                                   // 住所が同じ
    store({ '店名': 'ヒノカミ別館', '住所': '愛知県名古屋市中区栄3-5-1', 'ホットペッパーID': 'J000000003' }), // 別の場所
    store({ '住所': '', 'ホットペッパーID': 'J000000004' }),                                    // 店名が合う
    { '店名': 'placeId なし', '住所': '愛知県名古屋市中区栄1-1-1' },
    store({ [FIELD]: '住所', '住所': '愛知県名古屋市中区栄3-5-1', 'ホットペッパーID': 'J000000005' }), // 古い欄（今は別の場所）
  ];
  const counts = annotatePhoneLinks(stores, places);
  assert.deepEqual(stores.map((s) => s[FIELD]), ['住所', undefined, '店名', undefined, undefined]);
  assert.equal(Object.keys(stores[4]).includes(FIELD), false, '古い欄はキーごと外す');
  assert.deepEqual(stores.map((s) => s.placeId), ['P_HINOKAMI', 'P_HINOKAMI', 'P_HINOKAMI', undefined, 'P_HINOKAMI']);
  assert.equal(counts['address-same'], 1);
  assert.equal(counts['address-unknown-name-ok'], 1);
  assert.equal(counts['address-different'], 2);
  assert.equal(counts['no-place-id'], 1);
  assert.deepEqual(Object.keys(counts), REASONS, '理由は全部数える（0 でも出す）');
  const again = annotatePhoneLinks(stores, places);
  assert.deepEqual(again, counts);
  assert.deepEqual(stores.map((s) => s[FIELD]), ['住所', undefined, '店名', undefined, undefined]);
});

test('annotatePhoneLinks: 記録が空・places が無いときは、どの店にも欄を付けない（ボタンを出さない側に倒れる）', () => {
  const stores = [store(), store({ [FIELD]: '住所' })];
  const counts = annotatePhoneLinks(stores, {});
  assert.equal(counts['no-record'], 2);
  assert.deepEqual(stores.map((s) => s[FIELD]), [undefined, undefined]);
  assert.doesNotThrow(() => annotatePhoneLinks([store()], null));
});

test('canShowCallButton: 欄のある店だけ', () => {
  assert.equal(canShowCallButton({ [FIELD]: '住所' }), true);
  assert.equal(canShowCallButton({ [FIELD]: '店名' }), true);
  assert.equal(canShowCallButton({ placeId: 'P' }), false);
  assert.equal(canShowCallButton({ [FIELD]: '' }), false);
  assert.equal(canShowCallButton(null), false);
});

// ---------------------------------------------------------------- build.js への組み込み

test('build.js: 重複統合の後・出力の間引きの前に呼ぶ。失敗してもビルドは止めない', () => {
  const src = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
  const dedupe = src.indexOf('dedupeStores(stores');
  const call = src.indexOf('annotatePhoneLinks(stores');
  const slim = src.indexOf('stores.map(slimStoreForOutput)');
  assert.ok(dedupe > 0 && call > 0 && slim > 0, '3つの位置が見つかる');
  assert.ok(dedupe < call, '重複統合（残る側が決まる）の後に判定する');
  assert.ok(call < slim, '出力の間引き（LOCAL_STORES・data/stores.json）の前に判定する');
  // 呼び出しを囲む try の catch は、その直後（同じ文）にある。後ろの別の try/catch を取り違えない
  const tryStart = src.lastIndexOf('try {', call);
  const catchAt = src.indexOf('} catch (e) {', call);
  assert.ok(tryStart > 0 && catchAt > call, '呼び出しは try { … } catch (e) { … } の中にある');
  assert.ok(!/try \{|catch|finally/.test(src.slice(call, catchAt)), '呼び出しと catch のあいだに別の try/catch を挟まない');
  assert.ok(catchAt - call < 1500, 'catch は呼び出しの直後（同じ文）にある');
  const handler = src.slice(catchAt, src.indexOf('\n  }\n', catchAt) + 5);
  assert.match(handler, /電話ボタンの判定をスキップ/, 'catch は理由をログに出す');
  assert.ok(!/throw |process\.exit/.test(handler), 'catch は投げ直さない（ビルドを止めない）');
  assert.ok(!/finally/.test(src.slice(tryStart, catchAt + handler.length)), 'finally に置き換えない');
});

test('build.js: 電話確認の欄は LOCAL_STORES と data/stores.json の出力に残る（間引きの対象外）', () => {
  const { slimStoreForOutput } = require(path.join(ROOT, 'build.js'));
  assert.equal(slimStoreForOutput({ '店名': 'a', [FIELD]: '住所' })[FIELD], '住所');
  assert.equal(slimStoreForOutput({ '店名': 'a', placeId: 'P', [FIELD]: '店名' })[FIELD], '店名');
  assert.equal(FIELD in slimStoreForOutput({ '店名': 'a', placeId: 'P' }), false, '欄が無い店は欄なしのまま');
});

test('nightly_qa: 電話のボタンの判定と欄のずれを soft で数える', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'nightly_qa.js'), 'utf8');
  assert.match(src, /id: 'phone-links'[\s\S]{0,300}hard: false[\s\S]{0,200}audit_phone_links\.js', '--check'/);
});

test('実データの桁: 確かめられる店は placeId のある店の大半で、別の場所を指す店は出ない', { skip: !fs.existsSync(path.join(ROOT, 'data', 'places_resolved.json')) }, () => {
  const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
  const realPlaces = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'places_resolved.json'), 'utf8'));
  const withPlaceId = stores.filter((s) => s.placeId).length;
  const copy = stores.map((s) => ({ ...s }));
  const counts = annotatePhoneLinks(copy, realPlaces);
  const shown = copy.filter((s) => s[FIELD]).length;
  // 日々の取り込みで数は動く。ここでは「大半に出る」「別の場所の店には出ない」という性質だけを見る
  assert.ok(shown > withPlaceId * 0.8, `placeId のある ${withPlaceId} 店のうち ${shown} 店に出る`);
  assert.ok(shown <= withPlaceId);
  assert.equal(shown, counts['address-same'] + counts['address-unknown-name-ok']);
  const idx = buildPlaceIndex(realPlaces);
  for (const s of copy) {
    if (!s[FIELD]) continue;
    assert.notEqual(phoneLinkVerdict(s, idx, realPlaces).reason, 'address-different', s['店名']);
  }
});
