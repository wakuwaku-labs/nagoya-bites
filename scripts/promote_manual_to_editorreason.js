#!/usr/bin/env node
/**
 * scripts/promote_manual_to_editorreason.js
 *
 * data/manual_stores.json 内の「編集部推薦 ∩ おすすめポイント 40字以上」店を、
 * 既存の「おすすめポイント」を **editorReason として** data/editor_picks.json に
 * 昇格させる。捏造ゼロ（編集部が既に書いた文章のカテゴリ昇格）。
 *
 * 使い方:
 *   node scripts/promote_manual_to_editorreason.js              # 反映
 *   node scripts/promote_manual_to_editorreason.js --dry-run    # 確認のみ
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANUAL_PATH = path.join(ROOT, 'data', 'manual_stores.json');
const PICKS_PATH = path.join(ROOT, 'data', 'editor_picks.json');
const dryRun = process.argv.includes('--dry-run');
const MIN_REASON_LEN = 40;
const norm = s => String(s || '').replace(/\s|　/g, '').replace(/&amp;/g, '&').toLowerCase();

const manualData = JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf8'));
const manualArr = manualData.stores || manualData;
const picksData = JSON.parse(fs.readFileSync(PICKS_PATH, 'utf8'));
let picksArr = picksData.picks || picksData.stores || picksData;
if (!Array.isArray(picksArr)) picksArr = Object.values(picksArr);

const picksNames = new Set(picksArr.map(p => norm(p['店名'])));

const today = new Date().toISOString().slice(0, 10);
const expiry = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

const candidates = manualArr.filter(s =>
  s['編集部推薦'] === true
  && s['おすすめポイント']
  && String(s['おすすめポイント']).trim().length >= MIN_REASON_LEN
  && !picksNames.has(norm(s['店名']))
);

console.log(`=== 昇格候補: ${candidates.length} 件 ===\n`);
const promoted = [];
for (const s of candidates) {
  const entry = {
    '店名': s['店名'],
    'エリア': s['エリア'] || '',
    'editorReason': String(s['おすすめポイント']).trim(),
    'mediaFeatures': [],
    'insiderNote': '',
    'visitStatus': 'industry_known',
    '検出日': today,
    '有効期限': expiry,
    'source': 'manual_stores promotion (ISSUE-045)'
  };
  promoted.push(entry);
  console.log(`+ ${s['店名']}（${s['エリア']}・${s['ジャンル'] || ''}）`);
  console.log(`  → ${entry.editorReason.slice(0, 80)}${entry.editorReason.length > 80 ? '…' : ''}`);
}

if (dryRun) {
  console.log(`\n(--dry-run のため書き込み skip)`);
  console.log(`実行で editor_picks ${picksArr.length} → ${picksArr.length + promoted.length} 件になります`);
  process.exit(0);
}

if (promoted.length === 0) {
  console.log('追加なし');
  process.exit(0);
}

picksArr.push(...promoted);

// 元の構造に応じて書き戻す
let out;
if (picksData.picks) { picksData.picks = picksArr; out = picksData; }
else if (picksData.stores) { picksData.stores = picksArr; out = picksData; }
else { out = picksArr; }

fs.writeFileSync(PICKS_PATH, JSON.stringify(out, null, 2), 'utf8');
console.log(`\n→ ${PICKS_PATH} に ${promoted.length} 件追加（合計 ${picksArr.length} 件）`);
console.log('次は \`node build.js\` で反映 → \`git push origin main\`');
