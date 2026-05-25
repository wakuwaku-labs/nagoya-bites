#!/usr/bin/env node
// data/manual_stores.json の各エントリで、フロントの店舗詳細モーダルから飛ぶ
// 外部リンク（Hotpepper / 食べログ / Instagram / Google Maps）が
// 「実在する具体的な店舗ページ」に到達できるかを静的監査する。
//
// - 食べログURL: tabelog.com/... の固有店舗URL（rstdtl 形式）になっているか
// - Instagram: ハンドル or URL があるか
// - ホットペッパーID or 公式URLで具体店舗にたどり着く手段があるか
// - 写真URL: 空でなく、SVG プレースホルダーまたは実画像URLを指しているか
// - アクセス: 名古屋市XX区... の住所部分が含まれていて Google Maps 検索ヒット精度が高いか
//
// 使い方: node scripts/audit_manual_stores_links.js
// 退場コード: 重大な欠陥（食べログURL 無し AND ホットペッパーID 無し AND 住所無し）が
//          1件でもあれば 1、それ以外は 0。

'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'manual_stores.json');

function classifyTabelog(url) {
  if (!url || !url.trim()) return 'missing';
  if (/tabelog\.com\/[a-z]+\/[A-Z0-9]+\/[A-Z0-9]+\/\d{8}\/?$/i.test(url)) return 'direct';
  if (/tabelog\.com\/.*rstLst|tabelog\.com\/keywords|tabelog\.com\/matome/i.test(url)) return 'search';
  if (/tabelog\.com/i.test(url)) return 'other';
  return 'invalid';
}

function classifyInstagram(ig) {
  if (!ig || !ig.trim()) return 'missing';
  if (/^https?:\/\/(www\.)?instagram\.com\//i.test(ig)) return 'url';
  if (/^[A-Za-z0-9_.@]+$/.test(ig.replace(/^@/, ''))) return 'handle';
  return 'invalid';
}

function classifyPhoto(url) {
  if (!url || !url.trim()) return 'missing';
  if (/^\/assets\/store-figures\//.test(url)) return 'svg-placeholder';
  if (/^https:\/\/lh3\.googleusercontent\.com/.test(url)) return 'gmaps-real';
  if (/^https?:\/\//.test(url)) return 'external';
  return 'invalid';
}

function hasAddressInAccess(access) {
  if (!access) return false;
  return /名古屋市[^\s（）()【】「」]+/.test(access);
}

function main() {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const stores = raw.stores || [];

  const stats = {
    total: stores.length,
    tabelog: { missing: 0, direct: 0, search: 0, other: 0, invalid: 0 },
    ig: { missing: 0, url: 0, handle: 0, invalid: 0 },
    photo: { missing: 0, 'svg-placeholder': 0, 'gmaps-real': 0, external: 0, invalid: 0 },
    hpId: 0,
    addressInAccess: 0,
    critical: []
  };
  const warnings = [];

  for (const s of stores) {
    const name = s['店名'] || '(無名)';
    const tb = classifyTabelog(s['食べログURL']);
    const ig = classifyInstagram(s['Instagram']);
    const ph = classifyPhoto(s['写真URL']);
    const hpId = !!(s['ホットペッパーID'] && s['ホットペッパーID'].trim());
    const addr = hasAddressInAccess(s['アクセス']);

    stats.tabelog[tb]++;
    stats.ig[ig]++;
    stats.photo[ph]++;
    if (hpId) stats.hpId++;
    if (addr) stats.addressInAccess++;

    // 重大: 個別店舗に到達できる手段が全くない
    if (tb !== 'direct' && !hpId && !addr) {
      stats.critical.push(`${name}: 食べログ直接URL/ホットペッパーID/住所のいずれも無し`);
    }
    // 警告: 食べログがディレクトリ/検索URL
    if (tb === 'search' || tb === 'other') {
      warnings.push(`${name}: 食べログURLが個別店舗ページではない (${s['食べログURL']})`);
    }
    // 警告: Instagram が invalid 形式
    if (ig === 'invalid') {
      warnings.push(`${name}: Instagram フィールドが invalid (${s['Instagram']})`);
    }
    // 警告: 写真 invalid
    if (ph === 'invalid') {
      warnings.push(`${name}: 写真URL が invalid (${s['写真URL']})`);
    }
  }

  console.log('=== manual_stores.json リンク監査 ===');
  console.log(`総店舗数: ${stats.total}`);
  console.log('');
  console.log('【食べログURL】');
  console.log(`  direct (個別ページ直リンク): ${stats.tabelog.direct}`);
  console.log(`  search (検索URL):           ${stats.tabelog.search}`);
  console.log(`  missing (未設定):            ${stats.tabelog.missing}`);
  if (stats.tabelog.invalid + stats.tabelog.other > 0) {
    console.log(`  other/invalid:              ${stats.tabelog.other + stats.tabelog.invalid}`);
  }
  console.log('');
  console.log('【Instagram】');
  console.log(`  url (完全URL):  ${stats.ig.url}`);
  console.log(`  handle (ハンドル): ${stats.ig.handle}`);
  console.log(`  missing:        ${stats.ig.missing}`);
  if (stats.ig.invalid > 0) console.log(`  invalid:        ${stats.ig.invalid}`);
  console.log('');
  console.log('【写真URL】');
  console.log(`  gmaps-real (Places API実写): ${stats.photo['gmaps-real']}`);
  console.log(`  external (公式サイト等):     ${stats.photo.external}`);
  console.log(`  svg-placeholder (フォールバック): ${stats.photo['svg-placeholder']}`);
  console.log(`  missing:                     ${stats.photo.missing}`);
  if (stats.photo.invalid > 0) console.log(`  invalid:                     ${stats.photo.invalid}`);
  console.log('');
  console.log(`【その他】 ホットペッパーID付き: ${stats.hpId} / アクセス欄に住所: ${stats.addressInAccess}`);
  console.log('');

  if (warnings.length) {
    console.log(`⚠️  警告 (${warnings.length}件):`);
    warnings.slice(0, 30).forEach(w => console.log('  ' + w));
    if (warnings.length > 30) console.log(`  ... (+${warnings.length - 30} more)`);
    console.log('');
  }
  if (stats.critical.length) {
    console.log(`❌ 重大: 個別店舗到達不能 (${stats.critical.length}件):`);
    stats.critical.forEach(c => console.log('  ' + c));
    console.log('');
    process.exit(1);
  } else {
    console.log('✅ 全店で「個別店舗に到達する手段（食べログ直接URL or ホットペッパーID or 住所）」が確保されています');
    process.exit(0);
  }
}

main();
