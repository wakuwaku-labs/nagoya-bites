'use strict';

/**
 * scripts/lib/cross_check.js（口コミ信頼度の採点器・内部合成点 crossCheckScore）の単体テスト。
 * 合成フィクスチャで各シグナルの境界値・後方互換（旧形式データ）を固定する。
 * v3.0 移行時はここに S7d/S8-2/S8-3 のテストを追加してから切り替える（実装計画 Phase 3 前提ゲート）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeCrossCheckScore } = require('../scripts/lib/cross_check.js');

function baseStore(overrides) {
  return Object.assign({
    'Google評価': '', '口コミ数': '', 'ホットペッパーID': 'J_TEST',
    'タグ': '', 'Instagram': '', '食べログURL': '', 'おすすめポイント': '', '写真URL': '',
    'Instagram投稿URL': '', mediaFeatures: []
  }, overrides);
}

test('cross_check: 8キー全てが breakdown に存在し合計が crossCheckScore と一致する', () => {
  const store = baseStore({ 'Google評価': '4.2', '口コミ数': '80' });
  const r = computeCrossCheckScore(store, null);
  const keys = [
    's1_googleRatingVsCount', 's2_reviewCountAbs', 's3_dataCompleteness', 's4_mediaCrossCheck',
    's5_operationContinuity', 's6_instagramPresence', 's7_reviewTimeseries', 's8_reviewDistribution'
  ];
  for (const k of keys) assert.ok(k in r.crossCheckBreakdown, `${k} が breakdown に無い`);
  const sum = keys.reduce((a, k) => a + r.crossCheckBreakdown[k].score, 0);
  assert.equal(sum, r.crossCheckScore);
  assert.equal(r.crossCheckScoreVersion, '2.1');
});

test('cross_check: 履歴データなし（新規店）は破綻せず中立帯のスコアを返す', () => {
  const store = baseStore({});
  const r = computeCrossCheckScore(store, null);
  assert.ok(r.crossCheckScore >= 0 && r.crossCheckScore <= 100);
  assert.equal(r.crossCheckBreakdown.s7_reviewTimeseries.reason.includes('月次履歴未蓄積'), true);
});

test('cross_check: gachaReviewSuspicion フラグ（★4.6+ かつ 件数<50）', () => {
  const store = baseStore({ 'Google評価': '4.8', '口コミ数': '20' });
  const r = computeCrossCheckScore(store, null);
  assert.equal(r.crossCheckFlags.gachaReviewSuspicion, true);
  assert.equal(r.crossCheckBreakdown.s1_googleRatingVsCount.score, 3);
});

test('cross_check: S7a 投稿ペース安定（CV<=0.5・snapshots>=3）は満点8点', () => {
  const store = baseStore({});
  const history = {
    snapshots: [
      { ts: '2026-01-01T00:00:00Z', total: 10 },
      { ts: '2026-02-01T00:00:00Z', total: 20 },
      { ts: '2026-03-01T00:00:00Z', total: 30 }
    ]
  };
  const r = computeCrossCheckScore(store, history);
  // deltas = [10,10] -> CV=0 -> s7a=8
  assert.equal(r.crossCheckBreakdown.s7_reviewTimeseries.reason.includes('投稿ペース安定'), true);
});

test('cross_check: openingBurstPattern（初回急増→直近停滞）を検出しフラグを立てる', () => {
  const store = baseStore({});
  const history = {
    snapshots: [
      { ts: '2026-01-01T00:00:00Z', total: 5 },
      { ts: '2026-02-01T00:00:00Z', total: 30 }, // +25
      { ts: '2026-03-01T00:00:00Z', total: 31 }  // +1
    ]
  };
  const r = computeCrossCheckScore(store, history);
  assert.equal(r.crossCheckFlags.openingBurstPattern, true);
  assert.equal(r.crossCheckBreakdown.s7_reviewTimeseries.reason.includes('投稿急増'), true);
});

test('cross_check: uShapedDistribution（★5系2件以上・★1系2件以上・中間1件以下）', () => {
  const store = baseStore({ 'Google評価': '3.0' });
  const history = {
    latestReviews: [
      { rating: 5, time: 1000 }, { rating: 5, time: 1001 },
      { rating: 1, time: 1002 }, { rating: 1, time: 1003 },
      { rating: 3, time: 1004 }
    ]
  };
  const r = computeCrossCheckScore(store, history);
  assert.equal(r.crossCheckFlags.uShapedDistribution, true);
  assert.equal(r.crossCheckBreakdown.s8_reviewDistribution.score, 2);
});

test('cross_check: 中間評価3件以上の自然分布は満点15点', () => {
  const store = baseStore({ 'Google評価': '4.0' });
  const history = {
    latestReviews: [
      { rating: 4, time: 1 }, { rating: 3.5, time: 2 }, { rating: 4.2, time: 3 },
      { rating: 5, time: 4 }, { rating: 3.8, time: 5 }
    ]
  };
  const r = computeCrossCheckScore(store, history);
  assert.equal(r.crossCheckBreakdown.s8_reviewDistribution.score, 15);
  assert.equal(r.crossCheckFlags.uShapedDistribution, undefined);
});

test('cross_check: latestReviews が旧形式（textLen 等なし）でも例外を投げない（後方互換）', () => {
  const store = baseStore({ 'Google評価': '4.0' });
  const history = {
    latestReviews: [
      { rating: 4, time: 1, relativeTime: '1か月前' }, // textLen/lang/incentiveHit なし
      { rating: 5, time: 2, relativeTime: '2か月前' }
    ]
  };
  assert.doesNotThrow(() => computeCrossCheckScore(store, history));
});

test('cross_check: S3 データ充実度は5要素×3点で最大15点', () => {
  const store = baseStore({
    'タグ': '居酒屋,和食,個室', 'Instagram': 'https://instagram.com/x',
    '食べログURL': 'https://tabelog.com/x', 'おすすめポイント': '推薦文',
    '写真URL': 'https://example.com/a.jpg'
  });
  const r = computeCrossCheckScore(store, null);
  assert.equal(r.crossCheckBreakdown.s3_dataCompleteness.score, 15);
});

test('cross_check: S4 他媒体クロスチェックは異なる媒体名の数でカウント（記事数ではない）', () => {
  const store = baseStore({
    mediaFeatures: [
      { name: 'PR TIMES', url: 'a' }, { name: 'PR TIMES', url: 'b' }, // 同一媒体2記事
      { name: 'note', url: 'c' }
    ]
  });
  const r = computeCrossCheckScore(store, null);
  assert.equal(r.crossCheckBreakdown.s4_mediaCrossCheck.score, 8); // mfCount=2 -> 8点
});

// ── 2.1: observed / parts / S7c 判定保留 / 公開文言の禁止語 ──
const POLICY = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'trust_display_policy.json'), 'utf8'));

test('cross_check 2.1: 8軸すべてに observed(boolean) があり、S7 は parts[s7a,s7b,s7c] を持つ', () => {
  const r = computeCrossCheckScore(baseStore({ 'Google評価': '4.2', '口コミ数': '80' }), null);
  for (const k of Object.keys(r.crossCheckBreakdown)) {
    assert.equal(typeof r.crossCheckBreakdown[k].observed, 'boolean', `${k}.observed が boolean でない`);
  }
  const parts = r.crossCheckBreakdown.s7_reviewTimeseries.parts;
  assert.deepEqual(parts.map(p => p.id), ['s7a', 's7b', 's7c']);
  assert.equal(parts.reduce((a, p) => a + p.score, 0), r.crossCheckBreakdown.s7_reviewTimeseries.score);
  assert.deepEqual(parts.map(p => p.max), [8, 6, 6]);
  // 履歴なし・件数あり → S1/S2 観測、S4/S7/S8 は未観測
  assert.equal(r.crossCheckBreakdown.s1_googleRatingVsCount.observed, true);
  assert.equal(r.crossCheckBreakdown.s2_reviewCountAbs.observed, true);
  assert.equal(r.crossCheckBreakdown.s4_mediaCrossCheck.observed, false);
  assert.equal(r.crossCheckBreakdown.s7_reviewTimeseries.observed, false);
  assert.equal(r.crossCheckBreakdown.s8_reviewDistribution.observed, false);
});

test('cross_check 2.1: 直近5件が全て★5（stddev<0.5）は S7c 判定保留＝3点・observed:false', () => {
  const store = baseStore({ 'Google評価': '4.8', '口コミ数': '120' });
  const history = { snapshots: [], latestReviews: [5, 5, 5, 5, 5].map(rating => ({ rating })) };
  const r = computeCrossCheckScore(store, history);
  const s7c = r.crossCheckBreakdown.s7_reviewTimeseries.parts.find(p => p.id === 's7c');
  assert.equal(s7c.score, 3);
  assert.equal(s7c.observed, false);
  assert.equal(s7c.reason.includes('評価できません'), true);
  // 自然な分布（stddev 0.5〜1.5）は観測＝6点
  const r2 = computeCrossCheckScore(store, { snapshots: [], latestReviews: [5, 4, 5, 3, 4].map(rating => ({ rating })) });
  const s7c2 = r2.crossCheckBreakdown.s7_reviewTimeseries.parts.find(p => p.id === 's7c');
  assert.equal(s7c2.score, 6);
  assert.equal(s7c2.observed, true);
});

test('cross_check 2.1: 公開される reason に禁止語（policy.bannedWords）を含まない', () => {
  const fixtures = [
    [baseStore({ 'Google評価': '4.8', '口コミ数': '20' }), null],                                         // 少件数高評価
    [baseStore({ 'Google評価': '4.0', '口コミ数': '200' }), { snapshots: [], latestReviews: [5,5,5,5,5].map(rating => ({ rating })) }], // 揃っている
    [baseStore({ 'Google評価': '3.0', '口コミ数': '200' }), { snapshots: [], latestReviews: [5,5,5,5,5].map(rating => ({ rating })) }], // 最新が全体より高い
    [baseStore({ 'Google評価': '4.8', '口コミ数': '200' }), { snapshots: [], latestReviews: [1,1,1,1,2].map(rating => ({ rating })) }], // 最新が全体より低い
    [baseStore({ 'Google評価': '3.5', '口コミ数': '200' }), { snapshots: [], latestReviews: [5,5,1,1,3].map(rating => ({ rating })) }], // 両極
    [baseStore({ 'Google評価': '4.0', '口コミ数': '100' }), { snapshots: [
      { ts: '2026-01-01T00:00:00Z', total: 10 }, { ts: '2026-02-01T00:00:00Z', total: 40 }, { ts: '2026-03-01T00:00:00Z', total: 41 }
    ] }], // 急増→失速
    [baseStore({}), null]
  ];
  for (const [store, history] of fixtures) {
    const r = computeCrossCheckScore(store, history);
    for (const [k, axis] of Object.entries(r.crossCheckBreakdown)) {
      for (const w of POLICY.bannedWords) {
        assert.equal(axis.reason.includes(w), false, `${k} の reason に禁止語「${w}」: ${axis.reason}`);
      }
      for (const p of (axis.parts || [])) {
        for (const w of POLICY.bannedWords) assert.equal(p.reason.includes(w), false, `${k}.${p.id} に禁止語「${w}」: ${p.reason}`);
      }
    }
  }
});
