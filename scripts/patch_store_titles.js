#!/usr/bin/env node
'use strict';
/**
 * patch_store_titles.js
 *
 * 既存 stores/*.html の <title> と og:title / twitter:title を、
 * gen-store-pages.js と同一ロジック（エリアを titleAreaLabel で簡潔化）で再生成・上書きする。
 * ISSUE-072（GSC 実データ: 店舗タイトルが冗長エリア群で長すぎ・CTR 低下）への対処。
 *
 * 冪等: 既に正規化済みのタイトルは変化ゼロ。
 * 安全: 店名・ジャンルは原文維持。エリアの短縮のみ。データ（stores.json）は触らない。
 *
 * 実行: node scripts/patch_store_titles.js
 */

const fs   = require('fs');
const path = require('path');
const { titleAreaLabel } = require('./lib/area_label');
const { loadStores } = require('./lib/load_stores');

const ROOT       = path.join(__dirname, '..');
const STORES_DIR = path.join(ROOT, 'stores');

function escAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function escText(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildTitle(s) {
  const name  = s['店名'] || '';
  const genre = s['ジャンル'] || '';
  const area  = s['エリア'] || '';
  const areaLabel = titleAreaLabel(area);
  const ctx = [areaLabel, genre].filter(Boolean).join('・');
  return `${name}（${ctx}）| NAGOYA BITES`;
}

function patchHtml(html, title) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escText(title)}</title>`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escAttr(title)}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escAttr(title)}">`);
  return html;
}

function main() {
  const stores = loadStores();
  console.log(`${stores.length} 件のストアデータを取得`);

  // ホットペッパーID / 店名+エリア で照合するためのマップ
  const byHpId = new Map();
  for (const s of stores) {
    const hpId = s['ホットペッパーID'] || '';
    if (hpId) byHpId.set(hpId, s);
  }

  let patched = 0, skipped = 0, nomatch = 0;
  for (const file of fs.readdirSync(STORES_DIR)) {
    if (!file.endsWith('.html')) continue;
    // ファイル名 JXXXXXX.html の J コード = ホットペッパーID
    const jcode = file.replace(/\.html$/, '');
    const s = byHpId.get(jcode);
    if (!s) { nomatch++; continue; }
    const fp = path.join(STORES_DIR, file);
    const before = fs.readFileSync(fp, 'utf8');
    const after = patchHtml(before, buildTitle(s));
    if (after !== before) { fs.writeFileSync(fp, after); patched++; }
    else skipped++;
  }
  console.log(`タイトル更新: ${patched} / 変更なし: ${skipped} / データ未照合: ${nomatch}`);
}

main();
