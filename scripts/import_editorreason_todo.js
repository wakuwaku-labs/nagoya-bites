#!/usr/bin/env node
/**
 * scripts/import_editorreason_todo.js
 *
 * docs/editorreason-todo.md の記入済み行を読み取り、
 * data/editor_picks.json に反映する（ISSUE-045）。
 *
 * 動作:
 *   - editorReason 欄が空でない行を抽出
 *   - 該当店が editor_picks にあれば updated、なければ append
 *   - LOCAL_STORES（data/stores.json）の店名と norm 一致しないものは skip + 警告
 *   - editor_picks.json の _schema を尊重（url 必須・捏造禁止）
 *
 * 使い方:
 *   node scripts/import_editorreason_todo.js              # 反映実行
 *   node scripts/import_editorreason_todo.js --dry-run    # 反映せずに件数だけ報告
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores');

const ROOT = path.resolve(__dirname, '..');
const TODO_PATH = path.join(ROOT, 'docs', 'editorreason-todo.md');
const PICKS_PATH = path.join(ROOT, 'data', 'editor_picks.json');
const dryRun = process.argv.includes('--dry-run');

const norm = s => String(s || '').replace(/\s|　/g, '').replace(/&amp;/g, '&').toLowerCase();

if (!fs.existsSync(TODO_PATH)) {
  console.error(`${TODO_PATH} が見つかりません。先に list_editorreason_candidates.js を実行してください。`);
  process.exit(1);
}

const stores = loadStores();
const byNormName = new Map();
for (const s of stores) {
  if (s['店名']) byNormName.set(norm(s['店名']), s);
}

const picksData = JSON.parse(fs.readFileSync(PICKS_PATH, 'utf8'));
let picksArr = picksData.picks || picksData.stores || picksData;
if (!Array.isArray(picksArr)) {
  console.error('editor_picks.json の構造が想定外（配列ではありません）');
  process.exit(1);
}
const picksByName = new Map();
picksArr.forEach((p, idx) => { if (p['店名']) picksByName.set(norm(p['店名']), idx); });

// Markdown のテーブル行を解析
const md = fs.readFileSync(TODO_PATH, 'utf8');
const rows = md.split('\n').filter(l => l.startsWith('| ') && !/^\|\s*#\s*\|/.test(l) && !/^\|\s*---/.test(l));

let updated = 0, appended = 0, skippedNoMatch = 0, skippedEmpty = 0;
const today = new Date().toISOString().slice(0, 10);

for (const row of rows) {
  const cols = row.split('|').map(c => c.trim());
  // cols[0]='', cols[1]='#'/N, cols[2]=店名, cols[3]=エリア, cols[4]=ジャンル,
  // cols[5]=★, cols[6]=口コミ, cols[7]=👁, cols[8]=editorReason, cols[9]=insiderNote, cols[10]=visitStatus
  if (cols.length < 9) continue;
  const rawName = cols[2].replace(/\s*[★編📌]+\s*$/g, '').trim();
  const editorReason = cols[8] || '';
  const insiderNote = cols[9] || '';
  const visitStatus = cols[10] || 'industry_known';
  if (!rawName) continue;
  if (!editorReason) { skippedEmpty++; continue; }

  const nn = norm(rawName);
  const storeMatch = byNormName.get(nn);
  if (!storeMatch) {
    console.warn(`[skip] LOCAL_STORES 未マッチ: ${rawName}`);
    skippedNoMatch++;
    continue;
  }

  const entry = {
    '店名': storeMatch['店名'],
    'エリア': storeMatch['エリア'] || '',
    'editorReason': editorReason,
    'mediaFeatures': [],
    'insiderNote': insiderNote,
    'visitStatus': visitStatus,
    '検出日': today,
    '有効期限': new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  };

  if (picksByName.has(nn)) {
    const idx = picksByName.get(nn);
    const old = picksArr[idx];
    // 既存の mediaFeatures / 既存項目を保持しつつ追記
    picksArr[idx] = Object.assign({}, old, {
      editorReason: editorReason,
      insiderNote: insiderNote || old.insiderNote || '',
      visitStatus: visitStatus || old.visitStatus || 'industry_known',
      '検出日': old['検出日'] || today
    });
    updated++;
  } else {
    picksArr.push(entry);
    appended++;
  }
}

console.log('--- 取り込み結果 ---');
console.log(`新規追加: ${appended} 件`);
console.log(`既存更新: ${updated} 件`);
console.log(`未記入スキップ: ${skippedEmpty} 件`);
console.log(`未マッチスキップ: ${skippedNoMatch} 件`);
console.log(`editor_picks 合計: ${picksArr.length} 件`);

if (!dryRun && (appended > 0 || updated > 0)) {
  // 元の構造を尊重して書き戻す
  let out;
  if (picksData.picks) { picksData.picks = picksArr; out = picksData; }
  else if (picksData.stores) { picksData.stores = picksArr; out = picksData; }
  else if (Array.isArray(picksData)) { out = picksArr; }
  else { out = picksArr; }
  fs.writeFileSync(PICKS_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\n→ ${PICKS_PATH} を更新しました。次は \`node build.js\` で反映 → \`git push\`。`);
} else if (dryRun) {
  console.log('\n(--dry-run のため書き込み skip)');
}
