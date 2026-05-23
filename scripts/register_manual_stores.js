#!/usr/bin/env node
// manual_stores.json の店のうち、LOCAL_STORES（index.html）に未登録のものを登録する:
//   1) M番号を採番して stores/M*.html を生成（gen-store-pages.js の renderStorePage を再利用）
//   2) index.html の LOCAL_STORES に追記（build.js と同じ compact JSON 形式で再書き込み）
//   3) 店名→店舗ページID のマップを /tmp/manual_pageid_map.json に出力（記事再構築で使用）
//
// build.js（HP API キー必須）をローカルで回せない環境向けの精密登録。
// 使い方: node scripts/register_manual_stores.js [--dry-run]

const fs = require('fs');
const path = require('path');
const { renderStorePage } = require('../gen-store-pages.js');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const STORES_DIR = path.join(ROOT, 'stores');
const norm = (s) => String(s || '').replace(/\s|　/g, '');

function nextMid() {
  let max = 0;
  for (const f of fs.readdirSync(STORES_DIR)) {
    const m = f.match(/^M(\d+)\.html$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const manual = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'manual_stores.json'), 'utf8')).stores;
  let html = fs.readFileSync(INDEX, 'utf8');
  const stores = JSON.parse(html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/)[1]);
  const localNames = new Set(stores.map(s => norm(s['店名'])));

  // 既存 LOCAL_STORES 手動店の 店名→ページID（HP IDなし＝M-page）を先に拾う
  const pageIdMap = {};
  for (const f of fs.readdirSync(STORES_DIR)) {
    const m = f.match(/^M\d+\.html$/);
    if (!m) continue;
    const c = fs.readFileSync(path.join(STORES_DIR, f), 'utf8');
    const nameM = c.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (nameM) pageIdMap[norm(nameM[1].replace(/&amp;/g, '&'))] = f.replace(/\.html$/, '');
  }

  let mid = nextMid();
  const added = [];
  for (const s of manual) {
    const nm = norm(s['店名']);
    if (localNames.has(nm)) { continue; } // 既に LOCAL_STORES にある（12 keepers）
    const id = 'M' + String(mid++).padStart(6, '0');
    // 店舗詳細ページ生成
    const pageStore = Object.assign({ 都道府県: '愛知県' }, s);
    if (!dryRun) fs.writeFileSync(path.join(STORES_DIR, id + '.html'), renderStorePage(pageStore, id), 'utf8');
    // LOCAL_STORES 用レコード（必要最小フィールド）
    stores.push({
      '店名': s['店名'], 'ジャンル': s['ジャンル'] || '', 'エリア': s['エリア'] || '',
      '都道府県': '愛知県', 'アクセス': s['アクセス'] || '', '写真URL': s['写真URL'] || '',
      'おすすめポイント': s['おすすめポイント'] || '', 'タグ': s['タグ'] || '',
      'Google評価': s['Google評価'] || '', '編集部推薦': s['編集部推薦'] === true,
    });
    pageIdMap[nm] = id;
    added.push(`${s['店名']} → ${id}`);
  }

  if (!dryRun) {
    const storesJson = JSON.stringify(stores);
    html = html.replace(/var LOCAL_STORES = \[[\s\S]*?\];/, 'var LOCAL_STORES = ' + storesJson + ';');
    fs.writeFileSync(INDEX, html, 'utf8');
    // ISSUE-015-P2 第二段: data/stores.json も同期更新（canonical を最新化）
    fs.writeFileSync(path.join(ROOT, 'data', 'stores.json'), storesJson, 'utf8');
    fs.writeFileSync('/tmp/manual_pageid_map.json', JSON.stringify(pageIdMap, null, 2));
  }

  console.log(`(dry-run: ${dryRun}) 新規登録: ${added.length}店 / LOCAL_STORES計: ${stores.length}`);
  added.forEach(a => console.log('  ' + a));
  if (!dryRun) console.log('→ /tmp/manual_pageid_map.json 出力');
}

main();
