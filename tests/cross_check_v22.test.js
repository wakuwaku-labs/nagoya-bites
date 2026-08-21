'use strict';

/**
 * scripts/lib/cross_check_v22.js（口コミ信頼度 v2.2・未活性化）の単体テスト。
 * S1〜S8/S7a〜S7cはv2.1と完全に同じロジックであることを健全性チェックし、
 * 新設の S7d（投稿タイミング短期集中）・S9（クロス店舗指紋照合）だけを検証する。
 * 本モジュールは build.js にはまだ接続されていない（活性化の前提は
 * scripts/lib/cross_check_v22.js 冒頭コメント・scripts/audit_crosscheck_v22.js 参照）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeCrossCheckScore } = require('../scripts/lib/cross_check_v22.js');

function baseStore(overrides) {
  return Object.assign({
    'Google評価': '', '口コミ数': '', 'ホットペッパーID': 'J_TEST',
    'タグ': '', 'Instagram': '', '食べログURL': '', 'おすすめポイント': '', '写真URL': '',
    'Instagram投稿URL': '', mediaFeatures: []
  }, overrides);
}

test('cross_check_v22: v2.1の8キー+新設2キー(s7d/s9)を持ち、scoreVersionは2.2', () => {
  const r = computeCrossCheckScore(baseStore({}), null, null);
  const keys = [
    's1_googleRatingVsCount', 's2_reviewCountAbs', 's3_dataCompleteness', 's4_mediaCrossCheck',
    's5_operationContinuity', 's6_instagramPresence', 's7_reviewTimeseries',
    's7d_reviewBurstCluster', 's8_reviewDistribution', 's9_crossStoreFingerprint'
  ];
  assert.deepEqual(Object.keys(r.crossCheckBreakdown).sort(), keys.sort());
  assert.equal(r.crossCheckScoreVersion, '2.2');
});

test('cross_check_v22: S1〜S8はv2.1のmax配点・ロジックと完全一致（低ブラスト半径の担保）', () => {
  const store = baseStore({ 'Google評価': '4.2', '口コミ数': '80' });
  const r = computeCrossCheckScore(store, null, null);
  assert.equal(r.crossCheckBreakdown.s1_googleRatingVsCount.max, 15);
  assert.equal(r.crossCheckBreakdown.s2_reviewCountAbs.max, 10);
  assert.equal(r.crossCheckBreakdown.s7_reviewTimeseries.max, 20);
  assert.equal(r.crossCheckBreakdown.s8_reviewDistribution.max, 15);

  const { computeCrossCheckScore: computeV21 } = require('../scripts/lib/cross_check.js');
  const r21 = computeV21(store, null);
  for (const k of ['s1_googleRatingVsCount', 's2_reviewCountAbs', 's3_dataCompleteness',
    's4_mediaCrossCheck', 's5_operationContinuity', 's6_instagramPresence', 's8_reviewDistribution']) {
    assert.equal(r.crossCheckBreakdown[k].score, r21.crossCheckBreakdown[k].score, `${k} score should match v2.1`);
  }
});

test('cross_check_v22: 未取得データ（新規店）は例外を投げない', () => {
  assert.doesNotThrow(() => computeCrossCheckScore(baseStore({}), null, null));
});

test('cross_check_v22: S7d は投稿日時が5件未満なら判定保留(observed:false)', () => {
  const r = computeCrossCheckScore(baseStore({ '口コミ数': '10' }), { latestReviews: [{ rating: 5, time: 1000 }] }, null);
  assert.equal(r.crossCheckBreakdown.s7d_reviewBurstCluster.observed, false);
});

test('cross_check_v22: S7d は低ペース店で7日以内に3件以上集中していれば reviewBurstCluster を検出', () => {
  const t0 = 1_700_000_000;
  const history = {
    latestReviews: [
      { rating: 5, time: t0 }, { rating: 5, time: t0 + 86400 }, { rating: 5, time: t0 + 2 * 86400 },
      { rating: 5, time: t0 + 200 * 86400 }, { rating: 5, time: t0 + 400 * 86400 }
    ]
  };
  const r = computeCrossCheckScore(baseStore({ '口コミ数': '20' }), history, null);
  assert.equal(r.crossCheckBreakdown.s7d_reviewBurstCluster.observed, true);
  assert.equal(r.crossCheckFlags.reviewBurstCluster, true);
  assert.equal(r.crossCheckBreakdown.s7d_reviewBurstCluster.score, 0);
});

test('cross_check_v22: S7d は人気店（口コミ数>=100）の自然な集中を誤検知しない', () => {
  const t0 = 1_700_000_000;
  const history = {
    latestReviews: [
      { rating: 5, time: t0 }, { rating: 5, time: t0 + 86400 }, { rating: 5, time: t0 + 2 * 86400 },
      { rating: 5, time: t0 + 3 * 86400 }, { rating: 5, time: t0 + 4 * 86400 }
    ]
  };
  const r = computeCrossCheckScore(baseStore({ '口コミ数': '500' }), history, null);
  assert.equal(r.crossCheckFlags.reviewBurstCluster, undefined);
});

test('cross_check_v22: S9 は fingerprintResult 未指定なら判定保留(observed:false)で例外を投げない', () => {
  const r = computeCrossCheckScore(baseStore({}), null, null);
  assert.equal(r.crossCheckBreakdown.s9_crossStoreFingerprint.observed, false);
});

test('cross_check_v22: S9 は duplicateReviewAcrossStores を渡すとフラグと減点に反映する', () => {
  const fp = { observed: true, duplicateReviewAcrossStores: true, sameReviewerAcrossStores: false, reason: '同一の口コミ文面を他店舗でも検出' };
  const r = computeCrossCheckScore(baseStore({}), null, fp);
  assert.equal(r.crossCheckBreakdown.s9_crossStoreFingerprint.observed, true);
  assert.equal(r.crossCheckBreakdown.s9_crossStoreFingerprint.score, 1);
  assert.equal(r.crossCheckFlags.duplicateReviewAcrossStores, true);
});

test('cross_check_v22: 全breakdownの reason に禁止語（疑い/サクラ/ガチャ/化粧/評価操作）を含まない', () => {
  const banned = /疑い|サクラ|ガチャ|化粧|評価操作/;
  const t0 = 1_700_000_000;
  const store = baseStore({ 'Google評価': '4.7', '口コミ数': '20' });
  const history = {
    latestReviews: [
      { rating: 5, time: t0 }, { rating: 5, time: t0 + 86400 }, { rating: 1, time: t0 + 2 * 86400 },
      { rating: 1, time: t0 + 200 * 86400 }, { rating: 5, time: t0 + 400 * 86400 }
    ]
  };
  const fp = { observed: true, duplicateReviewAcrossStores: true, sameReviewerAcrossStores: true, reason: 'テスト理由' };
  const r = computeCrossCheckScore(store, history, fp);
  for (const [key, axis] of Object.entries(r.crossCheckBreakdown)) {
    assert.equal(banned.test(axis.reason || ''), false, `${key}: "${axis.reason}"`);
    if (Array.isArray(axis.parts)) {
      for (const part of axis.parts) assert.equal(banned.test(part.reason || ''), false, `${key}.${part.id}: "${part.reason}"`);
    }
  }
});
