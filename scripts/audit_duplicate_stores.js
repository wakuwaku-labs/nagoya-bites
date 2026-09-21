#!/usr/bin/env node
/**
 * audit_duplicate_stores.js
 *
 * stores.json の重複レコードを検出・統合する。
 * 重複の判定: placeId 一致 + namesMatch() による店名確認（両方が必要）。
 * placeId だけでは Places 解決の誤り（例: うなぎのしろむら 泉店/本店/丸の内店が同一 placeId）
 * を取り込んでしまうため。
 *
 * 使い方:
 *   node scripts/audit_duplicate_stores.js          # 重複一覧を表示
 *   node scripts/audit_duplicate_stores.js --fix    # 安全に統合して stores.json を更新
 *   node scripts/audit_duplicate_stores.js --check  # 重複があれば exit 1（CI 向け）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { namesMatch } = require('./lib/store_name_match');

const ROOT = path.resolve(__dirname, '..');
const STORES_PATH = path.join(ROOT, 'data', 'stores.json');

const args = process.argv.slice(2);
const FIX = args.includes('--fix');
const CHECK = args.includes('--check');

function fieldRichness(store) {
  let score = 0;
  if (store['食べログURL']) score += 3;
  if (store['Instagram']) score += 2;
  if (store['写真URL'] && !store['写真URL'].includes('no-image')) score += 2;
  if (store['おすすめポイント']) score += 2;
  if (store['タグ']) score += 1;
  if (store['ホットペッパーID']) score += 2;
  if (store['編集部推薦']) score += 1;
  if (store['話題フラグ']) score += 1;
  return score;
}

function mergeFields(primary, secondary) {
  const merged = Object.assign({}, primary);
  // secondary の情報で primary の空欄を補完
  for (const key of ['食べログURL', 'Instagram', '写真URL', 'おすすめポイント', 'タグ',
                      '編集部推薦', '話題フラグ', '話題スコア', '話題コメント', 'トレンド情報源',
                      '選定理由', 'おすすめシーン', '価格帯目安', '食べログ評価', 'Google評価']) {
    if (!merged[key] && secondary[key]) merged[key] = secondary[key];
  }
  if (secondary['話題フラグ'] === true) merged['話題フラグ'] = true;
  if (secondary['編集部推薦'] === true) merged['編集部推薦'] = true;
  return merged;
}

function main() {
  const stores = JSON.parse(fs.readFileSync(STORES_PATH, 'utf8'));

  // placeId ごとにグループ化
  const byPlaceId = {};
  for (const s of stores) {
    if (!s['placeId']) continue;
    if (!byPlaceId[s['placeId']]) byPlaceId[s['placeId']] = [];
    byPlaceId[s['placeId']].push(s);
  }

  const groups = Object.entries(byPlaceId).filter(([, arr]) => arr.length > 1);

  // 各グループを namesMatch で確認し、真の重複と誤 placeId を分ける
  const truedupes = [];
  const falseDupes = [];
  for (const [placeId, arr] of groups) {
    const firstName = arr[0]['店名'];
    const allMatch = arr.every(s => namesMatch(firstName, s['店名']).ok);
    if (allMatch) truedupes.push({ placeId, stores: arr });
    else falseDupes.push({ placeId, stores: arr });
  }

  if (!FIX && !CHECK) {
    console.log(`stores.json: ${stores.length}件`);
    console.log(`placeId重複グループ: ${groups.length}組`);
    console.log(`  真の重複（namesMatch一致）: ${truedupes.length}組`);
    console.log(`  Places誤解決の疑い（namesMatch不一致）: ${falseDupes.length}組`);
    console.log('');
    if (truedupes.length > 0) {
      console.log('--- 真の重複（統合対象）---');
      for (const g of truedupes.slice(0, 20)) {
        console.log(`  [${g.placeId}]`);
        for (const s of g.stores) {
          console.log(`    ${s['店名']} / エリア: ${s['エリア']} / HPID: ${s['ホットペッパーID'] || '-'}`);
        }
      }
    }
    if (falseDupes.length > 0) {
      console.log('--- Places誤解決の疑い（統合しない）---');
      for (const g of falseDupes.slice(0, 10)) {
        console.log(`  [${g.placeId}]`);
        for (const s of g.stores) {
          console.log(`    ${s['店名']} / エリア: ${s['エリア']}`);
        }
      }
    }
  }

  if (CHECK) {
    if (truedupes.length > 0) {
      console.error(`重複検出: ${truedupes.length}組の真の重複が存在します`);
      process.exit(1);
    }
    console.log('重複なし');
    process.exit(0);
  }

  if (!FIX) return;

  if (truedupes.length === 0) {
    console.log('統合対象の重複なし');
    return;
  }

  // 統合: placeId ごとに情報が最も豊富なレコードを primary にして他を吸収
  const toRemove = new Set();
  let mergeCount = 0;
  for (const g of truedupes) {
    const sorted = [...g.stores].sort((a, b) => fieldRichness(b) - fieldRichness(a));
    const primary = sorted[0];
    for (const secondary of sorted.slice(1)) {
      const idx = stores.indexOf(secondary);
      if (idx === -1) continue;
      // primary に欠けているフィールドを secondary から補完
      const merged = mergeFields(primary, secondary);
      Object.assign(primary, merged);
      toRemove.add(idx);
      mergeCount++;
    }
  }

  const deduped = stores.filter((_, i) => !toRemove.has(i));
  fs.writeFileSync(STORES_PATH, JSON.stringify(deduped), 'utf8');
  console.log(`統合完了: ${mergeCount}件を削除 (${stores.length} → ${deduped.length}件)`);
}

main();
