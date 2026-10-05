'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { hotpepperPhotoId, isDeadPhotoUrl } = require('../scripts/lib/dead_photo_urls');
const { normalizePhotoUrl } = require('../build.js');

test('hotpepperPhotoId はサイズ違いでも同じ写真アセットIDを返す', () => {
  assert.strictEqual(hotpepperPhotoId('https://imgfp.hotp.jp/IMGH/45/80/P048954580/P048954580_480.jpg'), 'P048954580');
  assert.strictEqual(hotpepperPhotoId('https://imgfp.hotp.jp/IMGH/45/80/P048954580/P048954580_238.jpg'), 'P048954580');
  assert.strictEqual(hotpepperPhotoId('https://example.com/a.jpg'), '');
});

test('isDeadPhotoUrl は台帳のアセットIDだけを真とする', () => {
  const ids = new Set(['P048954580']);
  assert.ok(isDeadPhotoUrl('https://imgfp.hotp.jp/IMGH/45/80/P048954580/P048954580_238.jpg', ids));
  assert.ok(!isDeadPhotoUrl('https://imgfp.hotp.jp/IMGH/00/00/P000000001/P000000001_480.jpg', ids));
  assert.ok(!isDeadPhotoUrl('', ids));
});

test('normalizePhotoUrl は台帳の配信終了写真を空にし、生きている写真は触らない', () => {
  assert.strictEqual(normalizePhotoUrl('https://imgfp.hotp.jp/IMGH/45/80/P048954580/P048954580_238.jpg'), '');
  const live = 'https://imgfp.hotp.jp/IMGH/00/00/P000000001/P000000001_480.jpg';
  assert.strictEqual(normalizePhotoUrl(live), live);
});
