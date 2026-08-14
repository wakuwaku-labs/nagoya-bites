'use strict';

/**
 * scripts/lib/cross_check_v3.js（TRUST SCORE v3.0・未活性化）の単体テスト。
 * v2.0 と同じ8キー構成・合計100点であることに加え、新設シグナル
 * （S7d同日クラスタ / S8-2本文実在性 / S8-3インセンティブ誘導）と
 * フラグ再定義（mediaDiscrepancy→highRatingNoFootprint）を検証する。
 *
 * 本モジュールは build.js にはまだ接続されていない（活性化の前提ゲートは
 * scripts/lib/cross_check_v3.js 冒頭コメント参照）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeCrossCheckScore } = require('../scripts/lib/cross_check_v3.js');

function baseStore(overrides) {
  return Object.assign({
    'Google評価': '', '口コミ数': '', 'ホットペッパーID': 'J_TEST',
    'タグ': '', 'Instagram': '', '食べログURL': '', 'おすすめポイント': '', '写真URL': '',
    'Instagram投稿URL': '', mediaFeatures: []
  }, overrides);
}

test('cross_check_v3: 配点合計は100・scoreVersionは3.0', () => {
  const store = baseStore({ 'Google評価': '4.2', '口コミ数': '80' });
  const r = computeCrossCheckScore(store, null);
  const maxSum = Object.values(r.crossCheckBreakdown).reduce((a, b) => a + b.max, 0);
  assert.equal(maxSum, 100);
  assert.equal(r.crossCheckScoreVersion, '3.0');
  const sum = Object.values(r.crossCheckBreakdown).reduce((a, b) => a + b.score, 0);
  assert.equal(sum, r.crossCheckScore);
});

test('cross_check_v3: v2 と同じ8キーを維持する（index.html 無改修で動く前提）', () => {
  const r = computeCrossCheckScore(baseStore({}), null);
  const keys = [
    's1_googleRatingVsCount', 's2_reviewCountAbs', 's3_dataCompleteness', 's4_mediaCrossCheck',
    's5_operationContinuity', 's6_instagramPresence', 's7_reviewTimeseries', 's8_reviewDistribution'
  ];
  assert.deepEqual(Object.keys(r.crossCheckBreakdown).sort(), keys.sort());
  assert.equal(r.crossCheckBreakdown.s7_reviewTimeseries.max, 25);
  assert.equal(r.crossCheckBreakdown.s8_reviewDistribution.max, 20);
});

test('cross_check_v3: 未取得データ（新規店）は例外を投げず中立帯を返す', () => {
  assert.doesNotThrow(() => computeCrossCheckScore(baseStore({}), null));
});

test('cross_check_v3: 旧形式 latestReviews（textLen/incentiveHit なし）は中立点で後方互換', () => {
  const store = baseStore({ 'Google評価': '4.0' });
  const history = {
    latestReviews: [
      { rating: 4, time: 1000 }, { rating: 5, time: 1001 }, { rating: 4, time: 1002 }
    ]
  };
  assert.doesNotThrow(() => computeCrossCheckScore(store, history));
});

test('cross_check_v3: S7a はスナップショット間隔を30日換算レートに正規化する', () => {
  const store = baseStore({});
  // 90日間隔で total が 10→40（30日換算で+10/月）→安定ペース扱いになるはず
  const history = {
    snapshots: [
      { ts: '2026-01-01T00:00:00Z', total: 10 },
      { ts: '2026-04-01T00:00:00Z', total: 40 }, // 90日で+30 -> 30日換算+10
      { ts: '2026-07-01T00:00:00Z', total: 70 }  // 91日で+30 -> ほぼ同レート
    ]
  };
  const r = computeCrossCheckScore(store, history);
  assert.equal(r.crossCheckBreakdown.s7_reviewTimeseries.reason.includes('30日換算'), true);
});

test('cross_check_v3: S7d 同日クラスタ検出（低ペース店 かつ 7日以内3件以上）でフラグが立つ', () => {
  const store = baseStore({ '口コミ数': '20' }); // count<100 => low pace
  const day = 86400;
  const t0 = 1700000000;
  const history = {
    latestReviews: [
      { rating: 5, time: t0 }, { rating: 5, time: t0 + day }, { rating: 5, time: t0 + 2 * day },
      { rating: 4, time: t0 + 200 * day }, { rating: 4, time: t0 + 300 * day }
    ]
  };
  const r = computeCrossCheckScore(store, history);
  assert.equal(r.crossCheckFlags.reviewBurstCluster, true);
});

test('cross_check_v3: S7d は人気店（高ペース）の自然な集中を誤検知しない', () => {
  const store = baseStore({ '口コミ数': '500' }); // count>=100 => not low pace
  const day = 86400;
  const t0 = 1700000000;
  const history = {
    latestReviews: [
      { rating: 5, time: t0 }, { rating: 5, time: t0 + day }, { rating: 5, time: t0 + 2 * day },
      { rating: 4, time: t0 + 3 * day }, { rating: 4, time: t0 + 4 * day }
    ]
  };
  const r = computeCrossCheckScore(store, history);
  assert.equal(r.crossCheckFlags.reviewBurstCluster, undefined);
});

test('cross_check_v3: S8-2 本文実在性 — 高評価×本文なしが3件以上でフラグ', () => {
  const store = baseStore({});
  const history = {
    latestReviews: [
      { rating: 5, time: 1, textLen: 0, lang: 'ja', incentiveHit: false },
      { rating: 5, time: 2, textLen: 0, lang: 'ja', incentiveHit: false },
      { rating: 4.5, time: 3, textLen: 0, lang: 'ja', incentiveHit: false },
      { rating: 4, time: 4, textLen: 50, lang: 'ja', incentiveHit: false }
    ]
  };
  const r = computeCrossCheckScore(store, history);
  assert.equal(r.crossCheckFlags.emptyFiveStarPattern, true);
});

test('cross_check_v3: S8-2 高評価レビューの本文が十分長ければ満点', () => {
  const store = baseStore({});
  const history = {
    latestReviews: [
      { rating: 5, time: 1, textLen: 80, lang: 'ja', incentiveHit: false },
      { rating: 4.8, time: 2, textLen: 60, lang: 'ja', incentiveHit: false }
    ]
  };
  const r = computeCrossCheckScore(store, history);
  assert.equal(r.crossCheckFlags.emptyFiveStarPattern, undefined);
  assert.equal(r.crossCheckBreakdown.s8_reviewDistribution.reason.includes('実在感あり'), true);
});

test('cross_check_v3: S8-3 インセンティブ誘導語検出でフラグが立つ', () => {
  const store = baseStore({});
  const history = {
    latestReviews: [
      { rating: 5, time: 1, textLen: 20, lang: 'ja', incentiveHit: true },
      { rating: 4, time: 2, textLen: 20, lang: 'ja', incentiveHit: false }
    ]
  };
  const r = computeCrossCheckScore(store, history);
  assert.equal(r.crossCheckFlags.incentiveReviewSuspicion, true);
});

test('cross_check_v3: mediaDiscrepancy は廃止され highRatingNoFootprint に置換される', () => {
  const store = baseStore({ 'Google評価': '4.8', '口コミ数': '15', '食べログURL': 'https://tabelog.com/x' });
  const r = computeCrossCheckScore(store, null);
  assert.equal(r.crossCheckFlags.mediaDiscrepancy, undefined);
  assert.equal(r.crossCheckFlags.highRatingNoFootprint, true);
});

test('cross_check_v3: highRatingNoFootprint は媒体掲載やIGがあれば立たない', () => {
  const store = baseStore({ 'Google評価': '4.8', '口コミ数': '15', 'Instagram': 'https://instagram.com/x' });
  const r = computeCrossCheckScore(store, null);
  assert.equal(r.crossCheckFlags.highRatingNoFootprint, undefined);
});
