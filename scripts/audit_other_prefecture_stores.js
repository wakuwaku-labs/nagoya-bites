#!/usr/bin/env node
/**
 * ISSUE-103 再発防止監査: places_resolved.json の rejected 分析で
 * 「除外リスト未登録の」他都道府県 rejected 店舗が一定数を超えていないか検査する。
 *
 * 使い方:
 *   node scripts/audit_other_prefecture_stores.js          # 件数表示
 *   node scripts/audit_other_prefecture_stores.js --check  # CI向け（新規汚染で exit 1）
 *   node scripts/audit_other_prefecture_stores.js --list   # 詳細一覧表示
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const RESOLVED_PATH = path.join(__dirname, '../data/places_resolved.json');
const BUILD_PATH    = path.join(__dirname, '../build.js');
const THRESHOLD     = 5; // 未除外の他都道府県 rejected がこれを超えたら新規汚染として警報

const args      = process.argv.slice(2);
const checkMode = args.includes('--check');
const listMode  = args.includes('--list');

if (!fs.existsSync(RESOLVED_PATH)) {
  if (checkMode) { process.exit(0); }
  console.log('places_resolved.json が存在しません（スキップ）');
  process.exit(0);
}

// build.js から EXCLUDED_HP_IDS を正規表現で抽出
let excludedIds = new Set();
if (fs.existsSync(BUILD_PATH)) {
  const buildSrc = fs.readFileSync(BUILD_PATH, 'utf8');
  const match = buildSrc.match(/const EXCLUDED_HP_IDS = new Set\(\[([\s\S]*?)\]\)/);
  if (match) {
    const idMatches = match[1].matchAll(/'(J\d+)'/g);
    for (const m of idMatches) excludedIds.add(m[1]);
  }
}

const resolved = JSON.parse(fs.readFileSync(RESOLVED_PATH, 'utf8'));

const all = Object.entries(resolved);
const totalRejected = all.filter(([, info]) => info.rejected).length;

const nonAichi = all.filter(([, info]) => {
  if (!info.rejected) return false;
  const addr = info.candidateAddress || '';
  return !addr.includes('愛知県') && !/nagoya-shi/i.test(addr);
});

// 除外リスト未登録の新規汚染候補
const newContamination = nonAichi.filter(([hpid]) => !excludedIds.has(hpid));

const aichiNotNagoya = all.filter(([, info]) => {
  if (!info.rejected) return false;
  const addr = info.candidateAddress || '';
  return addr.includes('愛知県') && !addr.includes('名古屋市') && !/nagoya-shi/i.test(addr);
});

// 都道府県別集計（新規汚染のみ）
const byPref = {};
newContamination.forEach(([, info]) => {
  const addr  = info.candidateAddress || '';
  const match = addr.match(/〒\S+ (\S+?[都道府県])/);
  const pref  = match ? match[1] : '不明';
  byPref[pref] = (byPref[pref] || 0) + 1;
});

console.log(`places_resolved.json 件数: ${all.length}件`);
console.log(`  rejected 合計              : ${totalRejected}件`);
console.log(`  他都道府県の rejected 全件  : ${nonAichi.length}件`);
console.log(`  うち build.js 除外済み      : ${nonAichi.length - newContamination.length}件`);
console.log(`  うち未除外（新規汚染候補）  : ${newContamination.length}件 （閾値: ${THRESHOLD}件）`);
console.log(`  愛知県内・名古屋市外        : ${aichiNotNagoya.length}件 （掲載方針はオーナー判断）`);

if (newContamination.length > 0 && (listMode || !checkMode)) {
  console.log('\n未除外 他都道府県 rejected 一覧:');
  newContamination.forEach(([hpid, info]) => {
    console.log(`  ${hpid} | ${info.candidateName} | ${info.candidateAddress}`);
  });
  if (Object.keys(byPref).length > 0) {
    console.log('\n都道府県別内訳:');
    Object.entries(byPref)
      .sort((a, b) => b[1] - a[1])
      .forEach(([pref, cnt]) => console.log(`  ${pref}: ${cnt}件`));
  }
}

if (checkMode && newContamination.length > THRESHOLD) {
  console.error(
    `\n[FAIL] 未除外の他都道府県 rejected が ${newContamination.length}件 > 閾値 ${THRESHOLD}件。` +
    '\nfetch_places.js の地名寄せ誤りで新しい他都市店舗が混入している可能性があります。' +
    '\nbuild.js の EXCLUDED_HP_IDS に追加し、カタログから除外してください（ISSUE-103）。'
  );
  process.exit(1);
}

if (checkMode) {
  console.log('\n[PASS] 未除外の他都道府県 rejected は閾値以内です。');
}
