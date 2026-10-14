'use strict';
// 書いた後に取り直さない面へ Places の写真 URL を書かない（P-29・ADR 0045）。fixture のみ。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { isPlacesPhotoUrl, staticPhotoUrl, findPlacesPhotoUrls } = require('../scripts/lib/places_photo_url');

test('Places の写真 URL を判定する（HotPepper・自ホストは対象外）', () => {
  assert.ok(isPlacesPhotoUrl('https://lh3.googleusercontent.com/place-photos/AAA=s1600-w1200'));
  assert.ok(isPlacesPhotoUrl('https://lh5.googleusercontent.com/p/AF1Q'));
  assert.ok(isPlacesPhotoUrl('https://places.googleapis.com/v1/places/x/photos/y/media'));
  assert.ok(isPlacesPhotoUrl('https://maps.googleapis.com/maps/api/place/photo?photo_reference=x'));
  assert.ok(!isPlacesPhotoUrl('https://imgfp.hotp.jp/IMGH/1/2/P1/P1_480.jpg'));
  assert.ok(!isPlacesPhotoUrl('/assets/journal-figures/x.svg'));
  assert.ok(!isPlacesPhotoUrl('https://www.google.com/maps/place/?q=place_id:abc'));
  assert.ok(!isPlacesPhotoUrl(''));
});

test('staticPhotoUrl は Places なら空、それ以外はそのまま', () => {
  assert.strictEqual(staticPhotoUrl('https://lh3.googleusercontent.com/place-photos/AAA'), '');
  assert.strictEqual(staticPhotoUrl('https://imgfp.hotp.jp/a.jpg'), 'https://imgfp.hotp.jp/a.jpg');
  assert.strictEqual(staticPhotoUrl(undefined), '');
});

test('findPlacesPhotoUrls は HTML から Places の URL だけを拾う', () => {
  const html = '<meta property="og:image" content="https://lh3.googleusercontent.com/place-photos/AAA">' +
    '<img src="https://imgfp.hotp.jp/a.jpg"><a href="https://www.google.com/maps/place/?q=place_id:x">m</a>';
  assert.deepStrictEqual(findPlacesPhotoUrls(html), ['https://lh3.googleusercontent.com/place-photos/AAA']);
});

test('生成器は Places の写真 URL を書く経路を持たない', () => {
  const root = path.resolve(__dirname, '..');
  const gen = fs.readFileSync(path.join(root, 'scripts/generate_daily_draft.js'), 'utf8');
  assert.ok(!/tryGoogleMapsPhoto/.test(gen), 'ジャーナルのヒーローに Places を戻さない');
  const jp = fs.readFileSync(path.join(root, 'scripts/lib/journal_photos.js'), 'utf8');
  assert.ok(!/photo_reference=\$\{/.test(jp), '本文写真の候補に Places を戻さない');
});
