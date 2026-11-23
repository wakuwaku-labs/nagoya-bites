'use strict';
// ADR 0083: 記事のリンク画像（og:image）は、記事の店のいちばん大きいホットペッパー写真にする。
const test = require('node:test');
const assert = require('node:assert');
const { pickOgPhoto, widest } = require('../scripts/lib/og_photo_pick');

const hp = (id, suf = '') => `https://imgfp.hotp.jp/IMGH/21/65/${id}/${id}${suf}.jpg`;

test('同じ写真の _480 が広ければ、そちらを選ぶ（11/23 の 358px → 480px）', () => {
  const sizes = { P049252165: { s: 480, l: 358 } };
  const r = pickOgPhoto({ og_image: hp('P049252165'), stores: [] }, { sizes });
  assert.deepStrictEqual([r.url, r.w, r.from, r.changed], [hp('P049252165', '_480'), 480, 'hero', true]);
});

test('主役が 640px 未満なら、記事の別の店のいちばん広い写真に替える', () => {
  const sizes = { P049252165: { s: 480, l: 358 }, P051513384: { s: 480, l: 1280 }, P042719736: { s: 480, l: 878 } };
  const input = {
    og_image: hp('P049252165'),
    stores: [{ photo_url: hp('P049252165') }, { photo_url: hp('P042719736', '_480') }, { photo_url: hp('P051513384') }],
  };
  const r = pickOgPhoto(input, { sizes });
  assert.deepStrictEqual([r.url, r.w, r.from], [hp('P051513384'), 1280, 'store']);
});

test('主役が 640px 以上なら、別の店の写真が広くても主役のまま', () => {
  const sizes = { P034839552: { s: 480, l: 720 }, P051513384: { s: 480, l: 1280 } };
  const input = { og_image: hp('P034839552'), stores: [{ photo_url: hp('P051513384') }] };
  const r = pickOgPhoto(input, { sizes });
  assert.deepStrictEqual([r.url, r.from, r.changed], [hp('P034839552'), 'hero', false]);
});

test('ホットペッパーでない og:image（プレス写真・図）は触らない', () => {
  assert.strictEqual(pickOgPhoto({ og_image: 'https://prcdn.freetls.fastly.net/release_image/1/2/a.jpg', stores: [] }), null);
  assert.strictEqual(pickOgPhoto({ og_image: '', stores: [] }), null);
});

test('幅が無ければ測り、測った結果を sizes に足す。測れなければそのまま', () => {
  const sizes = {};
  const measured = [];
  const measure = (u) => { measured.push(u); return u.endsWith('_480.jpg') ? 480 : 1016; };
  const r = pickOgPhoto({ og_image: hp('P012197781', '_480'), stores: [] }, { sizes, measure });
  assert.deepStrictEqual([r.url, r.w], [hp('P012197781'), 1016]);
  assert.deepStrictEqual(sizes.P012197781, { s: 480, l: 1016 });
  assert.strictEqual(measured.length, 2);
  assert.strictEqual(widest(hp('P000000001'), {}, () => null), null);
  assert.strictEqual(pickOgPhoto({ og_image: hp('P000000001'), stores: [] }, { sizes: {}, measure: () => null }), null);
});

test('店の写真 URL が無ければ、店のデータ（写真URL）から引く。記事の外の店は使わない', () => {
  const sizes = { P049252165: { s: 480, l: 358 }, P051513384: { s: 480, l: 1280 } };
  const input = { og_image: hp('P049252165'), stores: [{ name: 'A' }, { name: 'B' }] };
  const findRecord = (st) => (st.name === 'B' ? { 写真URL: hp('P051513384', '_480') } : {});
  assert.strictEqual(pickOgPhoto(input, { sizes, findRecord }).url, hp('P051513384'));
  assert.strictEqual(pickOgPhoto(input, { sizes }).url, hp('P049252165', '_480'));
});

test('題に店の名前が入る記事は、その店の写真だけ（1店が主役の記事のカードに別の店を出さない）', () => {
  const sizes = { P037723043: { s: 480, l: 182 }, P024155808: { s: 480, l: 960 } };
  const input = {
    title: '栄の地下「鉄板屋大吉」10席で朝5時まで、一人飲み・二軒目の少席店が回る理由',
    og_image: hp('P037723043'),
    stores: [{ name: '鉄板屋 大吉', photo_url: hp('P037723043') }, { name: '鉄板 はちろく', photo_url: hp('P024155808') }],
  };
  const r = pickOgPhoto(input, { sizes });
  assert.deepStrictEqual([r.url, r.w, r.from], [hp('P037723043', '_480'), 480, 'hero']);
  // 題に店名が無い「5選」なら、記事の店から広い写真を選ぶ
  const list = { ...input, title: '今池で一人飲みできる居酒屋おすすめ5選' };
  assert.strictEqual(pickOgPhoto(list, { sizes }).url, hp('P024155808'));
});
