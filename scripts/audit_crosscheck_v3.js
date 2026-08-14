#!/usr/bin/env node
/**
 * audit_crosscheck_v3.js
 *
 * TRUST SCORE（crossCheckScore）の v2.0 → v3.0 移行前に、全店舗へ両バージョンを
 * 適用した場合の分布差・フラグ件数差・移動幅上位店を可視化するシャドー比較器。
 * 読み取り専用（データは一切書き換えない）。
 *
 * 使い方:
 *   node scripts/audit_crosscheck_v3.js              # 分布サマリのみ
 *   node scripts/audit_crosscheck_v3.js --top 30      # 移動幅上位の表示件数を変更（既定20）
 *   node scripts/audit_crosscheck_v3.js --store J1234 # 1店の内訳を詳細表示
 *
 * v3.0 実装前（Phase 2 時点）は v2 のみでの分布出力に留め、v3 モジュールが
 * 用意でき次第 requireV3() を実装して両バージョン比較に切り替える。
 * Phase 3 切替前に、この出力を agent-backlog.md の ISSUE に記録すること
 * （実装計画 §3「監視・効果測定」/ Inspector Step C の事前版）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores');
const { computeCrossCheckScore: computeV2 } = require('./lib/cross_check');

const ROOT = path.resolve(__dirname, '..');
const HISTORY_PATH = path.join(ROOT, 'data', 'places_history.json');

const args = process.argv.slice(2);
const opts = { top: 20, store: null };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--top') opts.top = parseInt(args[++i], 10);
  else if (a === '--store') opts.store = args[++i];
}

// v3.0 モジュールが実装されたら、動的 require に切り替える。
// 未実装の間は v2 を「v3 と同一」として扱い、配管とレポート形式だけを先に固める。
function loadV3() {
  const v3Path = path.join(__dirname, 'lib', 'cross_check_v3.js');
  if (fs.existsSync(v3Path)) return require(v3Path).computeCrossCheckScore;
  return null;
}

function tier(score) {
  if (score >= 90) return 't90';
  if (score >= 70) return 't70';
  if (score >= 50) return 't50';
  return 'lt50';
}

function main() {
  const stores = loadStores();
  let history = {};
  try { history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')); }
  catch (e) { console.warn(`places_history.json 読込失敗: ${e.message}（中立スコアで継続）`); }

  const computeV3 = loadV3();
  const v3Ready = typeof computeV3 === 'function';
  if (!v3Ready) {
    console.log('scripts/lib/cross_check_v3.js が未実装のため v2 分布のみ出力します。');
    console.log('（Phase 3 で v3.0 実装後、このスクリプトが自動的に両バージョン比較に切り替わります）\n');
  }

  const distV2 = { t90: 0, t70: 0, t50: 0, lt50: 0 };
  const distV3 = { t90: 0, t70: 0, t50: 0, lt50: 0 };
  const flagCountsV2 = {};
  const flagCountsV3 = {};
  const moves = [];

  for (const s of stores) {
    const hpId = s['ホットペッパーID'] || '';
    const historyEntry = hpId && history[hpId] ? history[hpId] : null;
    const r2 = computeV2(s, historyEntry);
    distV2[tier(r2.crossCheckScore)]++;
    for (const f of Object.keys(r2.crossCheckFlags)) flagCountsV2[f] = (flagCountsV2[f] || 0) + 1;

    if (v3Ready) {
      const r3 = computeV3(s, historyEntry);
      distV3[tier(r3.crossCheckScore)]++;
      for (const f of Object.keys(r3.crossCheckFlags)) flagCountsV3[f] = (flagCountsV3[f] || 0) + 1;
      const delta = r3.crossCheckScore - r2.crossCheckScore;
      if (delta !== 0) moves.push({ name: s['店名'], hpId, v2: r2.crossCheckScore, v3: r3.crossCheckScore, delta });
    }

    if (opts.store && hpId === opts.store) {
      console.log(`\n=== ${s['店名']} (${hpId}) ===`);
      console.log('v2.0:', JSON.stringify(r2, null, 2));
      if (v3Ready) console.log('v3.0:', JSON.stringify(computeV3(s, historyEntry), null, 2));
    }
  }

  const total = stores.length;
  const pct = n => (n / total * 100).toFixed(1) + '%';
  console.log(`対象店舗数: ${total}`);
  console.log(`\n--- 分布 v2.0 ---`);
  console.log(`  90+: ${distV2.t90} (${pct(distV2.t90)}) / 70-89: ${distV2.t70} (${pct(distV2.t70)}) / 50-69: ${distV2.t50} (${pct(distV2.t50)}) / <50: ${distV2.lt50} (${pct(distV2.lt50)})`);
  console.log(`  フラグ件数: ${JSON.stringify(flagCountsV2)}`);

  if (v3Ready) {
    console.log(`\n--- 分布 v3.0（シャドー計算） ---`);
    console.log(`  90+: ${distV3.t90} (${pct(distV3.t90)}) / 70-89: ${distV3.t70} (${pct(distV3.t70)}) / 50-69: ${distV3.t50} (${pct(distV3.t50)}) / <50: ${distV3.lt50} (${pct(distV3.lt50)})`);
    console.log(`  フラグ件数: ${JSON.stringify(flagCountsV3)}`);

    const upperGuide = total * 0.10;
    console.log(`\n--- ±10%ガイドライン確認（1階級以上の移動 = ${moves.length}件 / 目安上限 ${Math.round(upperGuide)}件） ---`);
    if (moves.length > upperGuide) {
      console.log('  ⚠ 移動幅が目安を超えています。Phase 3 切替前に配点・閾値を見直してください。');
    }

    moves.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    console.log(`\n--- 移動幅 上位${opts.top}店 ---`);
    for (const m of moves.slice(0, opts.top)) {
      console.log(`  ${m.name} (${m.hpId}): v2=${m.v2} → v3=${m.v3} (${m.delta > 0 ? '+' : ''}${m.delta})`);
    }
  }
}

main();
