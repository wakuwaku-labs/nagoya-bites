#!/usr/bin/env node
/**
 * apply_resolved_to_index.js
 *
 * data/instagram_resolved.json の解決済み公式IGアカウントURLを、
 * index.html 内の LOCAL_STORES の Instagram フィールドにマージする。
 *
 * build.js は Hotpepper API key が必要なため、本スクリプトは
 * 既に出来ている index.html に対して直接マージを適用する用途で使う。
 * 次回 build.js を走らせる際にも同じロジックが build.js に組み込まれているので、
 * そちらが正規の流れ。これはオフライン用ヘルパー。
 *
 * 使い方:
 *   node scripts/apply_resolved_to_index.js                  # 適用
 *   node scripts/apply_resolved_to_index.js --dry-run        # 適用せず差分のみ表示
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const RESOLVED = path.join(ROOT, 'data', 'instagram_resolved.json');

const dryRun = process.argv.includes('--dry-run');

function loadStoresWithRange() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const m = html.match(/LOCAL_STORES\s*=\s*(\[)/);
  if (!m) throw new Error('LOCAL_STORES not found');
  const start = m.index + m[0].length - 1;
  let depth = 0, i = start, inStr = false, esc = false;
  while (i < html.length) {
    const c = html[i];
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === '"') inStr = !inStr;
    else if (!inStr) {
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) break; }
    }
    i++;
  }
  const arrText = html.slice(start, i + 1);
  return { html, arrStart: start, arrEnd: i + 1, stores: JSON.parse(arrText) };
}

function main() {
  if (!fs.existsSync(RESOLVED)) {
    console.error(`キャッシュが存在しない: ${RESOLVED}`);
    console.error('先に node scripts/resolve_instagram.js を走らせてください');
    process.exit(1);
  }
  const resolved = JSON.parse(fs.readFileSync(RESOLVED, 'utf8'));
  const { html, arrStart, arrEnd, stores } = loadStoresWithRange();
  console.log(`store count: ${stores.length}`);
  console.log(`resolved cache entries: ${Object.keys(resolved).length}`);

  let applied = 0, skippedManual = 0, noResolve = 0, missingId = 0;
  for (const s of stores) {
    const id = s['ホットペッパーID'];
    if (!id) { missingId++; continue; }
    const entry = resolved[id];
    if (!entry || !entry.instagram || entry.failed) { noResolve++; continue; }
    if (s['Instagram'] && s['Instagram'].trim()) { skippedManual++; continue; }
    if (dryRun) {
      console.log(`  [${id}] ${s['店名']} → ${entry.instagram}`);
    }
    s['Instagram'] = entry.instagram;
    applied++;
  }
  console.log(`適用予定: ${applied}件 / 手動既設(尊重): ${skippedManual}件 / 未解決: ${noResolve}件 / IDなし: ${missingId}件`);
  if (dryRun) {
    console.log('--dry-run のため index.html は更新しない');
    return;
  }
  if (applied === 0) {
    console.log('適用対象なし。index.html は変更しない');
    return;
  }
  // LOCAL_STORES 配列だけ書き換え（前後はそのまま）
  const newArrJson = JSON.stringify(stores);
  const newHtml = html.slice(0, arrStart) + newArrJson + html.slice(arrEnd);
  fs.writeFileSync(INDEX_HTML, newHtml);
  console.log(`✓ index.html を更新（${applied}件のInstagram公式URLを焼き付け）`);
}

main();
