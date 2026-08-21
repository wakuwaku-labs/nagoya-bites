'use strict';

/**
 * scripts/lib/trust_display.js（口コミ信頼度の判定器）の単体テスト。
 * 基準は data/trust_display_policy.json。閾値・最小観測数・分母の扱い・語彙の一致・
 * index.html への注入を固定する。全店再計算の禁止語検査も兼ねる。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const td = require('../scripts/lib/trust_display.js');
const { computeCrossCheckScore } = require('../scripts/lib/cross_check_v22.js');
const { buildFingerprintIndex, evaluateStoreFingerprint } = require('../scripts/lib/review_fingerprint.js');

const ROOT = path.join(__dirname, '..');
const P = td.loadPolicy();

function axis(score, max, observed, reason) { return { score, max, observed, reason: reason || '' }; }
function bd(o) {
  return Object.assign({
    s1_googleRatingVsCount: axis(15, 15, true, 'ok'),
    s2_reviewCountAbs:      axis(10, 10, true, 'ok'),
    s3_dataCompleteness:    axis(3, 15, true, 'meta'),
    s4_mediaCrossCheck:     axis(3, 10, false, '中立'),
    s5_operationContinuity: axis(5, 5, true, 'meta'),
    s6_instagramPresence:   axis(0, 10, true, 'meta'),
    s7_reviewTimeseries:    { score: 15, max: 20, observed: true, reason: '', parts: [
      { id: 's7a', score: 4, max: 8, observed: false, reason: '未蓄積' },
      { id: 's7b', score: 6, max: 6, observed: true, reason: '≒' },
      { id: 's7c', score: 6, max: 6, observed: true, reason: '自然' }
    ] },
    s8_reviewDistribution:  axis(15, 15, true, '自然'),
    s7d_reviewBurstCluster:   axis(3, 3, true, '分散'),
    s9_crossStoreFingerprint: axis(4, 4, true, '一致なし')
  }, o);
}
const store = { 'Google評価': '4.3', '口コミ数': '182' };

test('trust_display: policy の基本形（段階5つ＋na・検証9項目・meta3項目・禁止語）', () => {
  assert.equal(P.name, '口コミ信頼度');
  assert.deepEqual(P.tiers.map(t => t.id), ['SS', 'A', 'B', 'C', 'D']);
  assert.deepEqual(P.tiers.map(t => t.min), [97, 90, 75, 60, 0]);
  assert.equal(P.checks.length, 9);
  assert.deepEqual(P.meta.map(m => m.axis), ['s3_dataCompleteness', 's5_operationContinuity', 's6_instagramPresence']);
  assert.ok(P.bannedWords.length >= 5);
  assert.equal(P.minObserved, 3);
});

test('trust_display: 段階の境界（96→A, 97→SS, 89→B, 90→A, 74→C, 75→B, 59→D, 60→C, null→—）', () => {
  assert.equal(td.tierOf(100).id, 'SS'); assert.equal(td.tierOf(97).id, 'SS');
  assert.equal(td.tierOf(96).id, 'A');   assert.equal(td.tierOf(90).id, 'A'); assert.equal(td.tierOf(89).id, 'B');
  assert.equal(td.tierOf(75).id, 'B'); assert.equal(td.tierOf(74).id, 'C');
  assert.equal(td.tierOf(60).id, 'C'); assert.equal(td.tierOf(59).id, 'D');
  assert.equal(td.tierOf(0).id, 'D');  assert.equal(td.tierOf(null).id, '—');
});

test('trust_display: 未観測の項目は分母に入らない／S3・S5・S6 は採点に入らない', () => {
  // 観測: s1 15/15, s2 10/10, s7b 6/6, s7c 6/6, s8 15/15, s7d 3/3, s9 4/4 = 59/59 → 100（s4, s7a は未観測）
  const r = td.evaluate(store, { crossCheckBreakdown: bd() });
  assert.equal(r.score, 100);
  assert.equal(r.tier, 'SS');
  assert.deepEqual(r.coverage, { observed: 7, total: 9 });
  // S6 を 10/10 にしても score は変わらない
  const r2 = td.evaluate(store, { crossCheckBreakdown: bd({ s6_instagramPresence: axis(10, 10, true) }) });
  assert.equal(r2.score, 100);
  assert.equal(r2.meta.find(m => m.axis === 's6_instagramPresence').score, 10);
  // s4 を観測 5/10 にすると分母が増える
  const r3 = td.evaluate(store, { crossCheckBreakdown: bd({ s4_mediaCrossCheck: axis(5, 10, true) }) });
  assert.equal(r3.score, Math.round(64 / 69 * 100));
  assert.equal(r3.coverage.observed, 8);
});

test('trust_display: 観測項目が minObserved 未満なら「—」判定材料不足（score は null）', () => {
  const b = bd({
    s1_googleRatingVsCount: axis(5, 15, false), s2_reviewCountAbs: axis(6, 10, false),
    s8_reviewDistribution: axis(7, 15, false),
    s7d_reviewBurstCluster: axis(3, 3, false), s9_crossStoreFingerprint: axis(4, 4, false),
    s7_reviewTimeseries: { score: 10, max: 20, observed: false, parts: [
      { id: 's7a', score: 4, max: 8, observed: false }, { id: 's7b', score: 3, max: 6, observed: false }, { id: 's7c', score: 3, max: 6, observed: false }
    ] }
  });
  const r = td.evaluate({ 'Google評価': '', '口コミ数': '' }, { crossCheckBreakdown: b });
  assert.equal(r.score, null);
  assert.equal(r.tier, '—');
  assert.equal(r.coverage.observed, 0);
  assert.equal(r.headline.includes(P.na.advice), true);
  // ちょうど minObserved（3）なら数値が出る
  const b3 = bd({
    s4_mediaCrossCheck: axis(3, 10, false), s8_reviewDistribution: axis(7, 15, false),
    s7d_reviewBurstCluster: axis(3, 3, false), s9_crossStoreFingerprint: axis(4, 4, false)
  });
  b3.s7_reviewTimeseries.parts[1].observed = false; b3.s7_reviewTimeseries.parts[2].observed = false;
  // 観測: s1, s2 のみ → 2 → —
  assert.equal(td.evaluate(store, { crossCheckBreakdown: b3 }).tier, '—');
  b3.s7_reviewTimeseries.parts[1].observed = true; // 3 つ目
  assert.equal(typeof td.evaluate(store, { crossCheckBreakdown: b3 }).score, 'number');
});

test('trust_display: 見出し文は policy の headline テンプレと助言語で組み立てる（ハードコードなし）', () => {
  const r = td.evaluate(store, { crossCheckBreakdown: bd() });
  const tierSS = P.tiers.find(t => t.id === 'SS');
  assert.equal(r.headline, P.headline.replace('{rating}', '4.3').replace('{count}', '182').replace('{advice}', tierSS.advice));
  assert.equal(r.advice, tierSS.advice);
  assert.equal(r.tierLabel, tierSS.label);
});

test('trust_display: toSlim / toCompact / fromCompact の往復', () => {
  const full = td.evaluate(store, { crossCheckBreakdown: bd() }, { lastChecked: '2026-05-22' });
  const slim = td.toSlim(full);
  assert.deepEqual(slim, { s: 100, t: 'SS', c: '7/9', d: '2026-05-22' });
  const compact = td.toCompact(full);
  assert.equal(compact.k.length, 9);
  const back = td.fromCompact(compact);
  assert.equal(back.score, 100); assert.equal(back.tier, 'SS'); assert.equal(back.advice, full.advice);
  assert.deepEqual(back.checks.map(c => c.id), P.checks.map(c => c.id));
});

test('trust_display: lastCheckedFrom は snapshots 末尾 ts → 無ければ buildDate', () => {
  assert.equal(td.lastCheckedFrom({ snapshots: [{ ts: '2026-05-22T03:00:00.000Z' }, { ts: '2026-08-18T03:00:00.000Z' }] }, '2026-08-20'), '2026-08-18');
  assert.equal(td.lastCheckedFrom({ snapshots: [] }, '2026-08-20'), '2026-08-20');
  assert.equal(td.lastCheckedFrom(null, '2026-08-20'), '2026-08-20');
});

test('trust_display: index.html に TRUST_POLICY プレースホルダが1つだけあり、注入はラウンドトリップする', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const matches = html.match(new RegExp(td.TRUST_POLICY_RE.source, 'gm')) || [];
  assert.equal(matches.length, 1, 'var TRUST_POLICY = {...}; が index.html にちょうど1つ必要');
  const out = td.injectTrustPolicy('x\nvar TRUST_POLICY = {};\ny', P);
  const m = out.match(/^var TRUST_POLICY = (\{.*\});$/m);
  assert.ok(m);
  assert.deepEqual(JSON.parse(m[1]), td.publicPolicy(P));
  assert.equal(JSON.stringify(td.publicPolicy(P)).includes('</'), false);
});

test('trust_display: 全店再計算で公開 reason と見出しに禁止語が無く、分布が想定の桁に収まる', () => {
  const storesPath = path.join(ROOT, 'data', 'stores.json');
  const histPath = path.join(ROOT, 'data', 'places_history.json');
  if (!fs.existsSync(storesPath) || !fs.existsSync(histPath)) return; // 未ビルド環境ではスキップ
  const { loadStores } = require('../scripts/lib/load_stores.js');
  const { placesKey } = require('../scripts/lib/places_key.js');
  const stores = loadStores();
  const hist = JSON.parse(fs.readFileSync(histPath, 'utf8'));
  const fpIndex = buildFingerprintIndex(hist);
  const dist = {};
  for (const s of stores) {
    const key = s['店名'] ? placesKey(s) : '';
    const historyEntry = key && hist[key] ? hist[key] : null;
    const fp = key ? evaluateStoreFingerprint(key, historyEntry, fpIndex) : null;
    const cc = computeCrossCheckScore(s, historyEntry, fp);
    const r = td.evaluate(s, cc, { lastChecked: td.lastCheckedFrom(historyEntry, '2026-08-20') });
    dist[r.tier] = (dist[r.tier] || 0) + 1;
    for (const w of P.bannedWords) {
      assert.equal(r.headline.includes(w), false, `見出しに禁止語「${w}」: ${r.headline}`);
      for (const [k, a] of Object.entries(cc.crossCheckBreakdown)) {
        assert.equal((a.reason || '').includes(w), false, `${s['店名']} ${k}: ${a.reason}`);
      }
    }
  }
  const n = stores.length;
  // 公開前ゲート（品質ゲート原則5）: 2026-08-20 実測 A14% B36% C22% D19% —9%。大きく外れたら閾値でなく原因を見る
  assert.ok((dist.A || 0) / n > 0.05, `A が少なすぎる: ${JSON.stringify(dist)}`);
  assert.ok((dist['—'] || 0) / n < 0.25, `— が多すぎる: ${JSON.stringify(dist)}`);
  assert.ok((dist.D || 0) / n < 0.40, `D が多すぎる: ${JSON.stringify(dist)}`);
});
