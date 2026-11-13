'use strict';
// G3（2026-11-13）: 空の画像枠・写真なしの割合の検査。基準値（data/image_frames_baseline.json）より悪化したら落とす。
const test = require('node:test');
const assert = require('node:assert');
const A = require('../scripts/audit_empty_image_frames');

test('特集一覧: 写真の無いカードを数え、空の枠を畳む CSS を確かめる', () => {
  const card = (img) => `<a class="article-card" href="a.html"><div class="card-badge">${img ? '<img class="card-img" src="x.jpg">' : ''}</div><div class="card-body"></div></a>`;
  const r = A.featureCards(card(true) + card(false) + card(false));
  assert.deepStrictEqual([r.total, r.noImage, r.collapsesEmptyFrame], [3, 2, false]);
  assert.strictEqual(A.featureCards('<style>.card-badge:not(:has(img)){aspect-ratio:auto;}</style>' + card(false)).collapsesEmptyFrame, true);
});

test('検索カード: 再生ボタンは写真がある店にだけ出す（写真なしの枠の上に出さない）', () => {
  assert.strictEqual(A.reelOnlyWithPhoto(`+ (reel && photo ?'<button class="reel-play" x>`), true);
  assert.strictEqual(A.reelOnlyWithPhoto(`+ (reel ?'<button class="reel-play" x>`), false);
});

test('compare: 基準より悪化（写真なしの店・写真なしの特集カードが増える／空の枠が畳まれない）で不合格', () => {
  const base = { features: { noImage: 4 }, stores: { noPhotoRatio: 0.03 }, journalIndex: { entries: 10, images: 0 } };
  const ok = { reelOnlyWithPhoto: true, features: { noImage: 4, collapsesEmptyFrame: true }, stores: { noPhotoRatio: 0.03 }, journalIndex: { entries: 10, images: 0 } };
  assert.deepStrictEqual(A.compare(ok, base), []);
  assert.ok(A.compare({ ...ok, stores: { noPhotoRatio: 0.05 } }, base).length === 1);
  assert.ok(A.compare({ ...ok, features: { noImage: 5, collapsesEmptyFrame: true } }, base).length === 1);
  assert.ok(A.compare({ ...ok, features: { noImage: 4, collapsesEmptyFrame: false } }, base).length === 1);
  assert.ok(A.compare({ ...ok, reelOnlyWithPhoto: false }, base).length === 1);
});

test('実際のサイト: 基準値より悪化していない（新しく増えたら落とす）', () => {
  const problems = A.compare(A.measure(), A.loadBaseline());
  assert.deepStrictEqual(problems, []);
});
