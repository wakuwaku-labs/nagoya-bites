'use strict';
// I-11b（P-268）: 外部媒体採用の店（data/pending_stores.json）を店の一覧に合流するとき、写真の出所を落とさない。
// 落とすと、利用者の投稿が「記録の無い客投稿」に見え（audit_photo_policy.js の違反）、
// トップのカードに撮影者も出なかった（2026-10-12 時点で27店・店のビジネスプロフィールの写真39店も出所が空）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { toLocalStoreShape, mergePendingStores } = require(path.join(ROOT, 'scripts', 'merge_pending_stores.js'));
const { isPlacesPhotoUrl, isOwnerAttribution } = require(path.join(ROOT, 'scripts', 'lib', 'photo_policy.js'));

const PLACES = 'https://lh3.googleusercontent.com/place-photos/AAAA=s1600-w1200';
const BASE = { '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋' };

test('pending の写真出所（places-user / places-owner）を、合流した店へ引き継ぐ', () => {
  for (const origin of ['places-user', 'places-owner']) {
    const s = toLocalStoreShape({ ...BASE, '写真URL': PLACES, '写真クレジット': '山田太郎', '写真出所': origin });
    assert.equal(s['写真出所'], origin);
    assert.equal(s['写真URL'], PLACES);
    assert.equal(s['写真クレジット'], '山田太郎');
  }
});

test('出所が無い pending は空文字（キーは常にある）', () => {
  const s = toLocalStoreShape({ ...BASE });
  assert.equal(s['写真出所'], '');
  assert.ok(Object.prototype.hasOwnProperty.call(s, '写真出所'));
  assert.equal(toLocalStoreShape({ ...BASE, '写真URL': PLACES, '写真クレジット': 'x' })['写真出所'], '');
});

test('実データ: pending の写真出所は、合流の前後で1店も変わらない', () => {
  const pending = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pending_stores.json'), 'utf8')).pending || [];
  assert.ok(pending.length > 0);
  for (const p of pending) {
    if (!p['店名']) continue;
    assert.equal(toLocalStoreShape(p)['写真出所'], p['写真出所'] || '', `${p['店名']}: 写真出所が変わった`);
  }
});

test('実データ: 合流した Google マップの写真は、店の名義の写真か、出所を記録した利用者の写真だけ（記録の無い客投稿が残らない）', () => {
  const { merged } = mergePendingStores([]);
  let places = 0;
  for (const s of merged) {
    if (!isPlacesPhotoUrl(s['写真URL'])) continue;
    places++;
    const credit = String(s['写真クレジット'] || '').trim();
    assert.ok(credit, `${s['店名']}: 判定の根拠（クレジット）が無い`);
    const owner = isOwnerAttribution(credit, s['店名'], s['英語名']).owner;
    assert.ok(owner || s['写真出所'] === 'places-user', `${s['店名']}: 客投稿なのに出所の記録が無い（credit=${credit}）`);
  }
  assert.ok(places >= 50, `Google マップの写真の店が少なすぎる: ${places}`);
});
