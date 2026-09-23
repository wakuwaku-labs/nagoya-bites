#!/usr/bin/env node
/**
 * audit_duplicate_stores.js
 *
 * data/stores.json から重複レコードを検出する。
 * 重複の定義（どちらかを満たせば「確定重複」）:
 *   A) 店名が完全一致するレコードが2件以上
 *   B) placeId が同じ ＆ namesMatch() で同一店と判定される
 *
 * placeId 一致だけでは不十分 — チェーン店が共有 placeId を持つ例（うなぎのしろむら各店）が
 * あるため、名前ゲート（namesMatch）を必ず通す（CLAUDE.md 制約10・acceptance①）。
 *
 * 使い方:
 *   node scripts/audit_duplicate_stores.js          # サマリを表示
 *   node scripts/audit_duplicate_stores.js --check  # 確定重複が前回より増えていたら exit 1
 *   node scripts/audit_duplicate_stores.js --save   # 現在の件数をベースラインとして保存
 *   node scripts/audit_duplicate_stores.js --report # 重複詳細を data/store_duplicate_report.json に出力
 *
 * このスクリプトはデータを一切書き換えない（読み取り専用）。
 * 統合操作は acceptance②③ に従い人手で行う。
 *
 * ISSUE-132 の acceptance④: CI に重複検知を追加し、新たな重複が増えたら検出できるようにする
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { namesMatch } = require('./lib/store_name_match');

const ROOT = path.resolve(__dirname, '..');
const STORES_PATH = path.join(ROOT, 'data', 'stores.json');
const BASELINE_PATH = path.join(ROOT, 'data', 'store_duplicate_baseline.json');
const REPORT_PATH = path.join(ROOT, 'data', 'store_duplicate_report.json');

const args = new Set(process.argv.slice(2));

function loadStores() {
  return JSON.parse(fs.readFileSync(STORES_PATH, 'utf8'));
}

function detectDuplicates(stores) {
  const confirmed = [];  // 確定重複グループ
  const uncertain = [];  // placeId 一致だが名前が違う（チェーン店等）

  // A) 店名完全一致
  const byName = new Map();
  for (const s of stores) {
    const name = s['店名'];
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(s);
  }
  for (const [name, group] of byName) {
    if (group.length > 1) {
      confirmed.push({
        reason: 'name_exact',
        names: group.map(s => s['店名']),
        placeIds: group.map(s => s.placeId || ''),
        hpIds: group.map(s => s['ホットペッパーID'] || ''),
        areas: group.map(s => s['エリア'] || ''),
      });
    }
  }

  // 店名完全一致で既にグループ化された店のキーセット（placeId重複の二重カウントを防ぐ）
  const alreadyGrouped = new Set(
    confirmed.flatMap(g => g.hpIds.filter(Boolean))
  );

  // B) placeId 一致 ＋ namesMatch
  const byPlaceId = new Map();
  for (const s of stores) {
    if (!s.placeId) continue;
    if (!byPlaceId.has(s.placeId)) byPlaceId.set(s.placeId, []);
    byPlaceId.get(s.placeId).push(s);
  }
  for (const [placeId, group] of byPlaceId) {
    if (group.length < 2) continue;
    // すでに店名完全一致でカバーされているものはスキップ
    if (group.every(s => alreadyGrouped.has(s['ホットペッパーID'] || ''))) continue;

    // 全ペアで namesMatch を検査
    const isConfirmed = group.every((s, i) => {
      if (i === 0) return true;
      const r = namesMatch(group[0]['店名'], s['店名']);
      return r && r.ok;
    });

    const entry = {
      reason: 'placeid_match',
      placeId,
      names: group.map(s => s['店名']),
      hpIds: group.map(s => s['ホットペッパーID'] || ''),
      areas: group.map(s => s['エリア'] || ''),
    };

    if (isConfirmed) {
      confirmed.push(entry);
    } else {
      uncertain.push(entry);
    }
  }

  return { confirmed, uncertain };
}

function main() {
  const stores = loadStores();
  const { confirmed, uncertain } = detectDuplicates(stores);

  console.log(`対象店舗数: ${stores.length}`);
  console.log(`確定重複グループ: ${confirmed.length}件`);
  console.log(`  うち 店名完全一致: ${confirmed.filter(g => g.reason === 'name_exact').length}件`);
  console.log(`  うち placeId一致＋名前ゲート通過: ${confirmed.filter(g => g.reason === 'placeid_match').length}件`);
  console.log(`不確定（placeId一致・名前が違う＝チェーン店等）: ${uncertain.length}件`);

  if (args.has('--report')) {
    const report = { generated: new Date().toISOString(), confirmed, uncertain };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nレポートを保存: ${path.relative(ROOT, REPORT_PATH)}`);
  }

  if (args.has('--save')) {
    const baseline = {
      savedAt: new Date().toISOString(),
      confirmedCount: confirmed.length,
      storeCount: stores.length,
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2), 'utf8');
    console.log(`\nベースライン保存: 確定重複=${confirmed.length}件（${path.relative(ROOT, BASELINE_PATH)}）`);
    return;
  }

  if (args.has('--check')) {
    let baseline;
    try {
      baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    } catch (e) {
      console.warn('ベースラインファイルが未生成です（初回は --save で作成してください）');
      process.exit(0);
    }
    const prev = baseline.confirmedCount;
    const curr = confirmed.length;
    if (curr > prev) {
      console.error(`\n⚠ 確定重複が増加しています: ${prev}件 → ${curr}件 (+${curr - prev}件)`);
      console.error('新たに重複が追加された可能性があります。data/store_duplicate_report.json を確認してください。');
      console.error('  node scripts/audit_duplicate_stores.js --report');
      process.exit(1);
    }
    console.log(`\n✅ 重複件数は前回比変化なし（${curr}件 / ベースライン ${prev}件）`);
  }
}

main();
