#!/usr/bin/env node
// 出典URL / トレンド情報源 に含まれる Hot Pepper 公式店舗URL (str{ID}/) から
// ホットペッパーID を抽出し、manual_stores.json の各エントリに「ホットペッパーID」を補完する。
//
// これによりフロント詳細モーダルの「Hotpepper」「ホットペッパーで予約」ボタンが
// 検索URLではなく「個別店舗ページ」へ直接遷移するようになる。
//
// 既に「ホットペッパーID」が設定されている店は上書きしない。
//
// 使い方: node scripts/extract_hpid_from_sources.js [--dry-run]

'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'manual_stores.json');

// https://www.hotpepper.jp/strJ001234567/ または https://www.hotpepper.jp/strXXXXXXX/
const HP_RE = /hotpepper\.jp\/str([A-Z0-9]+)\/?/i;

function extractFromArray(arr) {
  if (!Array.isArray(arr)) return null;
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const m = item.match(HP_RE);
    if (m) return m[1];
  }
  return null;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const stores = raw.stores || [];

  let updated = 0;
  let already = 0;
  let notFound = 0;
  const updates = [];

  for (const s of stores) {
    const existing = (s['ホットペッパーID'] || '').trim();
    if (existing) { already++; continue; }
    // 出典URL 配列を最優先で探す
    let hpid = extractFromArray(s['出典URL']);
    // 食べログURL 等の単一フィールドも一応見る
    if (!hpid && s['食べログURL']) {
      const m = s['食べログURL'].match(HP_RE);
      if (m) hpid = m[1];
    }
    if (hpid) {
      s['ホットペッパーID'] = hpid;
      updates.push(`${s['店名']} → ${hpid}`);
      updated++;
    } else {
      notFound++;
    }
  }

  if (!dryRun && updated > 0) {
    fs.writeFileSync(FILE, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  }

  console.log(`manual stores: ${stores.length}`);
  console.log(`  既設 ホットペッパーID: ${already}`);
  console.log(`  新規抽出: ${updated} (dry-run=${dryRun})`);
  console.log(`  出典URLに HP URL 無し: ${notFound}`);
  if (updates.length) {
    console.log('');
    console.log('抽出された ID:');
    updates.slice(0, 30).forEach(u => console.log('  ' + u));
    if (updates.length > 30) console.log(`  ... (+${updates.length - 30} more)`);
  }
}

main();
