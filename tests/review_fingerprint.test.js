'use strict';

/**
 * scripts/lib/review_fingerprint.js（口コミ信頼度 S9・クロス店舗指紋照合）の単体テスト。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeText, textFingerprint, authorFingerprint,
  buildFingerprintIndex, evaluateStoreFingerprint,
  MIN_NORMALIZED_TEXT_LEN, MIN_DISTINCT_STORES_FOR_REVIEWER, REVIEWER_WINDOW_DAYS
} = require('../scripts/lib/review_fingerprint.js');

test('textFingerprint: 生の文字列は返さず非可逆ハッシュのみを返す', () => {
  const text = 'このお店は本当に美味しくて、接客も丁寧で大満足でした。';
  const hash = textFingerprint(text);
  assert.equal(typeof hash, 'string');
  assert.ok(!hash.includes('美味'));
  assert.equal(hash.length, 16);
});

test('textFingerprint: 正規化後の長さがしきい値未満なら null（短文の偶然一致を除外）', () => {
  assert.equal(normalizeText('美味しかった').length < MIN_NORMALIZED_TEXT_LEN, true);
  assert.equal(textFingerprint('美味しかった'), null);
});

test('textFingerprint: 同一文面は同一ハッシュ、別文面は別ハッシュ', () => {
  const a = 'ランチのパスタが絶品で、店員さんの対応も気持ちよかったです。';
  const b = 'ディナーの魚料理が絶品で、店員さんの対応も気持ちよかったです。';
  assert.equal(textFingerprint(a), textFingerprint(a));
  assert.notEqual(textFingerprint(a), textFingerprint(b));
});

test('authorFingerprint: 投稿者名は保存せずハッシュのみ返す', () => {
  const h = authorFingerprint('山田太郎');
  assert.equal(typeof h, 'string');
  assert.ok(!h.includes('山田'));
});

test('evaluateStoreFingerprint: 指紋データが無い店は判定保留(observed:false)', () => {
  const idx = buildFingerprintIndex({});
  const r = evaluateStoreFingerprint('J_TEST', { latestReviews: [] }, idx);
  assert.equal(r.observed, false);
});

test('evaluateStoreFingerprint: 同一文面が別店舗にもあれば duplicateReviewAcrossStores を検出', () => {
  const longText = 'この店の看板メニューは本当に絶品で、友人にも強くおすすめしたいと思いました。';
  const hash = textFingerprint(longText);
  assert.notEqual(hash, null);
  const history = {
    'store-A': { latestReviews: [{ rating: 5, time: 1000, textHash: hash }] },
    'store-B': { latestReviews: [{ rating: 5, time: 2000, textHash: hash }] }
  };
  const idx = buildFingerprintIndex(history);
  const r = evaluateStoreFingerprint('store-A', history['store-A'], idx);
  assert.equal(r.observed, true);
  assert.equal(r.duplicateReviewAcrossStores, true);
});

test('evaluateStoreFingerprint: 自店のみに存在する文面は重複扱いしない', () => {
  const longText = '駅から少し歩きますが、それでも通いたくなる隠れ家的な名店だと思います。';
  const hash = textFingerprint(longText);
  const history = { 'store-A': { latestReviews: [{ rating: 5, time: 1000, textHash: hash }] } };
  const idx = buildFingerprintIndex(history);
  const r = evaluateStoreFingerprint('store-A', history['store-A'], idx);
  assert.equal(r.duplicateReviewAcrossStores, false);
});

test(`evaluateStoreFingerprint: 同一投稿者名で★4.5以上が${MIN_DISTINCT_STORES_FOR_REVIEWER}店舗以上・${REVIEWER_WINDOW_DAYS}日以内なら sameReviewerAcrossStores を検出`, () => {
  const hash = authorFingerprint('田中花子');
  const t0 = 1_700_000_000;
  const history = {
    'store-A': { latestReviews: [{ rating: 5, time: t0, authorNameHash: hash }] },
    'store-B': { latestReviews: [{ rating: 5, time: t0 + 10 * 86400, authorNameHash: hash }] },
    'store-C': { latestReviews: [{ rating: 4.5, time: t0 + 20 * 86400, authorNameHash: hash }] }
  };
  const idx = buildFingerprintIndex(history);
  const r = evaluateStoreFingerprint('store-A', history['store-A'], idx);
  assert.equal(r.observed, true);
  assert.equal(r.sameReviewerAcrossStores, true);
});

test('evaluateStoreFingerprint: 2店舗のみの一致では sameReviewerAcrossStores を立てない（ありふれた氏名の偶然一致を抑制）', () => {
  const hash = authorFingerprint('鈴木一郎');
  const t0 = 1_700_000_000;
  const history = {
    'store-A': { latestReviews: [{ rating: 5, time: t0, authorNameHash: hash }] },
    'store-B': { latestReviews: [{ rating: 5, time: t0, authorNameHash: hash }] }
  };
  const idx = buildFingerprintIndex(history);
  const r = evaluateStoreFingerprint('store-A', history['store-A'], idx);
  assert.equal(r.sameReviewerAcrossStores, false);
});

test('evaluateStoreFingerprint: 一致が180日を超えて分散していれば sameReviewerAcrossStores を立てない（長期の実在利用者と区別）', () => {
  const hash = authorFingerprint('佐藤次郎');
  const t0 = 1_700_000_000;
  const history = {
    'store-A': { latestReviews: [{ rating: 5, time: t0, authorNameHash: hash }] },
    'store-B': { latestReviews: [{ rating: 5, time: t0 + 300 * 86400, authorNameHash: hash }] },
    'store-C': { latestReviews: [{ rating: 5, time: t0 + 600 * 86400, authorNameHash: hash }] }
  };
  const idx = buildFingerprintIndex(history);
  const r = evaluateStoreFingerprint('store-A', history['store-A'], idx);
  assert.equal(r.sameReviewerAcrossStores, false);
});
