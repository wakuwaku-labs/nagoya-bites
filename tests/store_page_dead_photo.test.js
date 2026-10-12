'use strict';
// P-270（I-10b）: 配信が終わった写真を、店舗ページのヒーロー・JSON-LD・OG 画像に出さない。
//
// data/stores.json では、配信終了が確定した HotPepper の写真（data/dead_photo_urls.json の台帳）は
// 写真URL が空になっている。ところが店舗ページを作る gen-store-pages.js は、スプレッドシート（CSV）の行を
// { ...csvMatch, ...ls } で重ねるため、店の記録が 写真URL を持たないと、CSV に残った古い URL がそのまま戻ってきた
// （2026-10-12 の実測: 写真の無い147店のうち143店。ヒーローが壊れた画像になる）。
// 取り込みの規則は mergeStoreWithCsv に集めてある。ここでは、台帳の写真を引き継がないことと、
// それ以外の取り込み（CSV の補完・店の記録の優先）が変わっていないことを確かめる。
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { mergeStoreWithCsv, renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
const { loadRegistry, hotpepperPhotoId, isDeadPhotoUrl } = require(path.join(ROOT, 'scripts', 'lib', 'dead_photo_urls.js'));

const registry = loadRegistry();
const DEAD_URL = registry.entries[0].url;
const DEAD_ID = hotpepperPhotoId(DEAD_URL);
const ALIVE_URL = 'https://imgfp.hotp.jp/IMGH/00/00/P000000000/P000000000_480.jpg';

const STORE = { '店名': 'テスト酒場', 'ホットペッパーID': 'J000000001', 'エリア': '栄', 'ジャンル': '居酒屋', 'おすすめポイント': '炭火の焼き鳥が看板。' };
const CSV_ROW = { '店名': 'テスト酒場', 'ホットペッパーID': 'J000000001', '住所': '愛知県名古屋市中区栄1-1-1', '電話': '052-000-0000' };

test('前提: 台帳に実在のエントリがあり、その写真は台帳の判定に当たる', () => {
  assert.ok(registry.entries.length > 0);
  assert.match(DEAD_ID, /^P\d{6,}$/);
  assert.ok(isDeadPhotoUrl(DEAD_URL));
  assert.ok(!isDeadPhotoUrl(ALIVE_URL));
});

test('店の記録に写真URLが無く、CSV が台帳の写真を持つ店は、その写真を引き継がない', () => {
  const merged = mergeStoreWithCsv({ ...STORE }, { ...CSV_ROW, '写真URL': DEAD_URL });
  assert.equal(merged['写真URL'], undefined);
});

test('サイズ違い（_238 など）の台帳の写真も、同じ写真として引き継がない', () => {
  for (const url of [DEAD_URL.replace(/_480\.jpg$/, '_238.jpg'), DEAD_URL.replace(/_480\.jpg$/, '.jpg')]) {
    const merged = mergeStoreWithCsv({ ...STORE }, { ...CSV_ROW, '写真URL': url });
    assert.equal(merged['写真URL'], undefined, url);
  }
});

test('台帳に無い CSV の写真は、これまでどおり引き継ぐ（取り込みの規則は変えない）', () => {
  const merged = mergeStoreWithCsv({ ...STORE }, { ...CSV_ROW, '写真URL': ALIVE_URL });
  assert.equal(merged['写真URL'], ALIVE_URL);
});

test('店の記録が写真URLを持つときは、それが優先される', () => {
  const own = 'https://imgfp.hotp.jp/IMGH/11/11/P111111111/P111111111_480.jpg';
  const merged = mergeStoreWithCsv({ ...STORE, '写真URL': own }, { ...CSV_ROW, '写真URL': ALIVE_URL });
  assert.equal(merged['写真URL'], own);
});

test('住所などのリッチ項目: 店の記録に無ければ CSV から補い、あれば店の記録を優先する。公開フラグは公開', () => {
  const m1 = mergeStoreWithCsv({ ...STORE }, { ...CSV_ROW });
  assert.equal(m1['住所'], CSV_ROW['住所']);
  assert.equal(m1['電話'], CSV_ROW['電話']);
  assert.equal(m1['公開フラグ'], '公開');
  const m2 = mergeStoreWithCsv({ ...STORE, '住所': '愛知県名古屋市中区錦3-3-3' }, { ...CSV_ROW });
  assert.equal(m2['住所'], '愛知県名古屋市中区錦3-3-3');
});

test('取り込みは CSV の行を書き換えない（同じ行を別の店が使っても影響しない）', () => {
  const row = Object.freeze({ ...CSV_ROW, '写真URL': DEAD_URL });
  assert.doesNotThrow(() => mergeStoreWithCsv({ ...STORE }, row));
  assert.equal(row['写真URL'], DEAD_URL);
});

test('描画: 台帳の写真を持つ CSV の店でも、ヒーロー・JSON-LD・OG 画像に配信終了のURLが出ない', () => {
  const merged = mergeStoreWithCsv({ ...STORE }, { ...CSV_ROW, '写真URL': DEAD_URL });
  const html = renderStorePage(merged, 'J-test', [], []);
  assert.ok(!html.includes(DEAD_ID), '配信終了の写真のIDがページに残っている');
  // I-10c: 写真の無い店は、ヒーローの位置に汎用の画像を出さない（写真の無い店と同じ表示）
  assert.ok(!/<img class="hero-img"/.test(html), '写真の無い店と同じ表示（ヒーローを出さない）');
});

test('描画: 台帳に無い写真の店は、これまでどおりヒーローに写真が出る', () => {
  const merged = mergeStoreWithCsv({ ...STORE }, { ...CSV_ROW, '写真URL': ALIVE_URL });
  const html = renderStorePage(merged, 'J-test', [], []);
  assert.ok(html.includes('P000000000'), '生きている写真が消えている');
  assert.ok(!/<img class="hero-img" src="\/assets\/store-figures\/_fallback\.svg"/.test(html));
});
