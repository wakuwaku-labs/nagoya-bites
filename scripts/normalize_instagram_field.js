#!/usr/bin/env node
// manual_stores.json の Instagram フィールドが「ハンドル」のみ（例: "atutamiso_brew_menu"）
// になっているエントリを「完全URL」（https://www.instagram.com/{handle}/）に正規化する。
//
// これによりフロント render の instagramSearchUrl(r) は URL をそのまま使えるが、
// 既にビルド済み index.html / data/stores.json でも独立して動くデータが残せる。

'use strict';
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'manual_stores.json');

function main() {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const stores = raw.stores || [];
  let n = 0;
  for (const s of stores) {
    const ig = (s['Instagram'] || '').trim();
    if (!ig) continue;
    if (/^https?:\/\//i.test(ig)) continue;
    const handle = ig.replace(/^@/, '').replace(/^instagram\.com\//, '').replace(/\/$/, '');
    if (/^[A-Za-z0-9_.]+$/.test(handle)) {
      s['Instagram'] = 'https://www.instagram.com/' + handle + '/';
      n++;
    }
  }
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  console.log(`Instagram フィールド正規化: ${n}件 (handle → URL)`);
}
main();
