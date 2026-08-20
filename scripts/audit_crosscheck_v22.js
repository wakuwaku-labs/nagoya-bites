#!/usr/bin/env node
/**
 * audit_crosscheck_v22.js
 *
 * 口コミ信頼度 v2.1 → v2.2（S7d 投稿タイミング集中検出・S9 クロス店舗指紋照合を
 * 加算のみで追加）の移行前シャドー比較器。読み取り専用（データは一切書き換えない）。
 * audit_crosscheck_v3.js と同じ ±10% ガイドライン形式で出力する。
 *
 * v2.2 は v3.0 と異なり S1〜S8 の重み・observed 条件を一切変更していないため、
 * S7d/S9 のどちらも observed:false のままの店（大多数）はスコアが完全に不変になる。
 * 移動が出るのは「S7d でバースト検出」「S9 で店舗横断ハッシュ一致」のいずれかが
 * 実際に observed になった店だけ。
 *
 * 使い方:
 *   node scripts/audit_crosscheck_v22.js
 *   node scripts/audit_crosscheck_v22.js --top 30
 *   node scripts/audit_crosscheck_v22.js --store J1234
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores');
const { placesKey } = require('./lib/places_key');
const { computeCrossCheckScore: computeV21 } = require('./lib/cross_check');
const { computeCrossCheckScore: computeV22 } = require('./lib/cross_check_v22');
const { buildFingerprintIndex, evaluateStoreFingerprint } = require('./lib/review_fingerprint');
const trustDisplay = require('./lib/trust_display');

const ROOT = path.resolve(__dirname, '..');
const HISTORY_PATH = path.join(ROOT, 'data', 'places_history.json');

// 消費者向け「口コミ信頼度」を比較するための v2.2 用ポリシー（本番の
// data/trust_display_policy.json は書き換えず、checks[] に s7d/s9 を追加した
// クローンだけをこのスクリプト内で使う。表示文言は本番投入時に別途確定する仮ラベル）
function buildV22Policy(basePolicy) {
  const p = JSON.parse(JSON.stringify(basePolicy));
  p.checks.push({ id: 's7d', axis: 's7d_reviewBurstCluster', label: '口コミの投稿日が短期間に集中していないか' });
  p.checks.push({ id: 's9', axis: 's9_crossStoreFingerprint', label: '同一文面・同一投稿者名が他店舗と重複していないか' });
  return p;
}

const args = process.argv.slice(2);
const opts = { top: 20, store: null };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--top') opts.top = parseInt(args[++i], 10);
  else if (a === '--store') opts.store = args[++i];
}

function main() {
  const stores = loadStores();
  let history = {};
  try { history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')); }
  catch (e) { console.warn(`places_history.json 読込失敗: ${e.message}（中立スコアで継続）`); }

  const fingerprintIndex = buildFingerprintIndex(history);
  const hashedReviewCount = [...fingerprintIndex.textIndex.values()].reduce((a, s) => a + s.size, 0)
    + [...fingerprintIndex.authorIndex.values()].reduce((a, arr) => a + arr.length, 0);
  console.log(`指紋インデックス: textHash種類=${fingerprintIndex.textIndex.size} / authorNameHash種類=${fingerprintIndex.authorIndex.size} / 延べ一致候補=${hashedReviewCount}`);
  if (hashedReviewCount === 0) {
    console.log('（textHash/authorNameHash付きデータがまだ蓄積されていません。--refresh 再開後に効きはじめます）\n');
  }

  const basePolicy = trustDisplay.loadPolicy();
  const v22Policy = buildV22Policy(basePolicy);

  const distV21 = { SS: 0, A: 0, B: 0, C: 0, D: 0, '—': 0 };
  const distV22 = { SS: 0, A: 0, B: 0, C: 0, D: 0, '—': 0 };
  const flagCountsV21 = {};
  const flagCountsV22 = {};
  const moves = [];

  for (const s of stores) {
    const key = s['店名'] ? placesKey(s) : '';
    const historyEntry = key && history[key] ? history[key] : null;

    const r21 = computeV21(s, historyEntry);
    const rt21 = trustDisplay.evaluate(s, r21, { policy: basePolicy });
    distV21[rt21.tier] = (distV21[rt21.tier] || 0) + 1;
    for (const f of Object.keys(r21.crossCheckFlags)) flagCountsV21[f] = (flagCountsV21[f] || 0) + 1;

    const fp = key ? evaluateStoreFingerprint(key, historyEntry, fingerprintIndex) : { observed: false };
    const r22 = computeV22(s, historyEntry, fp);
    const rt22 = trustDisplay.evaluate(s, r22, { policy: v22Policy });
    distV22[rt22.tier] = (distV22[rt22.tier] || 0) + 1;
    for (const f of Object.keys(r22.crossCheckFlags)) flagCountsV22[f] = (flagCountsV22[f] || 0) + 1;

    if (rt21.tier !== rt22.tier) {
      moves.push({ name: s['店名'], key, v21: `${rt21.tier}(${rt21.score})`, v22: `${rt22.tier}(${rt22.score})` });
    }

    if (opts.store && key === opts.store) {
      console.log(`\n=== ${s['店名']} (${key}) ===`);
      console.log('v2.1 reviewTrust:', JSON.stringify(rt21, null, 2));
      console.log('v2.2 reviewTrust:', JSON.stringify(rt22, null, 2));
    }
  }

  const total = stores.length;
  const pct = n => (n / total * 100).toFixed(1) + '%';
  const fmtDist = d => ['SS', 'A', 'B', 'C', 'D', '—'].map(t => `${t}=${d[t] || 0}(${pct(d[t] || 0)})`).join(' / ');
  console.log(`\n対象店舗数: ${total}`);
  console.log(`\n--- 口コミ信頼度 v2.1（現行本番） ---`);
  console.log(`  ${fmtDist(distV21)}`);
  console.log(`  内部フラグ件数: ${JSON.stringify(flagCountsV21)}`);

  console.log(`\n--- 口コミ信頼度 v2.2（シャドー計算） ---`);
  console.log(`  ${fmtDist(distV22)}`);
  console.log(`  内部フラグ件数: ${JSON.stringify(flagCountsV22)}`);

  const upperGuide = total * 0.10;
  console.log(`\n--- ±10%ガイドライン確認（段階(SS〜D/—)が変わった店 = ${moves.length}件 / 目安上限 ${Math.round(upperGuide)}件） ---`);
  if (moves.length > upperGuide) {
    console.log('  ⚠ 移動幅が目安を超えています。本番投入前に閾値を見直してください。');
  } else {
    console.log('  ✓ 目安の範囲内です。');
  }

  console.log(`\n--- 段階が変わった店（上位${opts.top}件） ---`);
  for (const m of moves.slice(0, opts.top)) {
    console.log(`  ${m.name} (${m.key}): v2.1=${m.v21} → v2.2=${m.v22}`);
  }
}

main();
