#!/usr/bin/env node
/**
 * scripts/approve_editorreason_drafts.js
 *
 * docs/editorreason-drafts.md を読み、`[approved]` 印が付いた draft を
 * data/editor_picks.json に取り込む。捏造禁止の安全策:
 *   - draft の sources_used を sources フィールドとして保存（監査証跡）
 *   - source: 'industry_automation' 識別子で後から取消可能
 *   - automation.confidence と reviewed_by/reviewed_at を記録
 *
 * 使い方:
 *   node scripts/approve_editorreason_drafts.js                    # 反映
 *   node scripts/approve_editorreason_drafts.js --dry-run          # 件数だけ報告
 *   node scripts/approve_editorreason_drafts.js --auto-high-conf   # confidence>=0.85 を一括承認
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores');

const ROOT = path.resolve(__dirname, '..');
const DRAFTS_MD = path.join(ROOT, 'docs', 'editorreason-drafts.md');
const DRAFTS_DIR = path.join(ROOT, 'data', 'editorreason_drafts');
const PICKS_PATH = path.join(ROOT, 'data', 'editor_picks.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const autoHighConf = args.includes('--auto-high-conf');
const AUTO_THRESHOLD = 0.85;
const REVIEWER = process.env.USER || 'unknown';

const norm = s => String(s || '').replace(/\s|　/g, '').replace(/&amp;/g, '&').toLowerCase();

if (!fs.existsSync(DRAFTS_MD)) {
  console.error(`${DRAFTS_MD} なし。先に build_editorreason_drafts.js を実行`);
  process.exit(1);
}

const md = fs.readFileSync(DRAFTS_MD, 'utf8');

// draft の store_id を抽出（コメント行から）
// 採用形式: <!-- review: approved   ... store_id: J000123 -->
//          <!-- review: reject     ... store_id: J000123 -->
//          <!-- review: pending    ... store_id: J000123 -->  ← 未レビュー
const approvedIds = new Set();
const rejectedIds = new Set();
const re = /<!--\s*review:\s*(approved|reject|pending)\b[^>]*store_id:\s*([^\s-]+)\s*-->/g;
let m;
while ((m = re.exec(md)) !== null) {
  const verdict = m[1];
  const id = m[2].trim();
  if (verdict === 'approved') approvedIds.add(id);
  else if (verdict === 'reject') rejectedIds.add(id);
}

console.log(`docs から [approved]: ${approvedIds.size} 件 / [reject]: ${rejectedIds.size} 件`);

// auto-high-conf モード: 全 draft をスキャンし confidence>=AUTO_THRESHOLD を承認扱い
if (autoHighConf) {
  const drafts = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.json'));
  let added = 0;
  for (const f of drafts) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, f), 'utf8'));
      if (d.status === 'OK' && (d.confidence || 0) >= AUTO_THRESHOLD && d.store_id) {
        if (!approvedIds.has(d.store_id)) { approvedIds.add(d.store_id); added++; }
      }
    } catch (_) {}
  }
  console.log(`--auto-high-conf: confidence>=${AUTO_THRESHOLD} の draft を ${added} 件追加で承認扱い`);
}

if (approvedIds.size === 0) {
  console.log('approved なし。終了。');
  process.exit(0);
}

// 既存 picks 読込
const picksData = JSON.parse(fs.readFileSync(PICKS_PATH, 'utf8'));
let picksArr = picksData.picks || picksData.stores || picksData;
if (!Array.isArray(picksArr)) picksArr = Object.values(picksArr);
const picksByName = new Map();
picksArr.forEach((p, idx) => { if (p['店名']) picksByName.set(norm(p['店名']), idx); });

// LOCAL_STORES 照合（実在検証）
const stores = loadStores();
const storesByName = new Map();
for (const s of stores) if (s['店名']) storesByName.set(norm(s['店名']), s);

const today = new Date().toISOString().slice(0, 10);
const expiry = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

let added = 0, updated = 0, skippedNoMatch = 0, skippedNoSources = 0, skippedRejected = 0;

for (const id of approvedIds) {
  const draftPath = path.join(DRAFTS_DIR, `${id}.json`);
  if (!fs.existsSync(draftPath)) {
    console.warn(`[skip] draft cache なし: ${id}`);
    continue;
  }
  const d = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  if (rejectedIds.has(id)) { skippedRejected++; continue; }
  if (d.status !== 'OK') { console.warn(`[skip] status=${d.status}: ${d.store_name}`); continue; }
  if (!d.sources_used || d.sources_used.length === 0) {
    console.warn(`[skip] sources_used 空: ${d.store_name}`);
    skippedNoSources++; continue;
  }

  // LOCAL_STORES 実在検証
  const storeMatch = storesByName.get(norm(d.store_name));
  if (!storeMatch) {
    console.warn(`[skip] LOCAL_STORES 未マッチ: ${d.store_name}`);
    skippedNoMatch++; continue;
  }

  const entry = {
    '店名': storeMatch['店名'],
    'エリア': storeMatch['エリア'] || d.area || '',
    'editorReason': d.editorReason,
    'mediaFeatures': [],
    'insiderNote': d.insiderNote || '',
    'visitStatus': 'desk_automated',
    '検出日': today,
    '有効期限': expiry,
    'source': 'industry_automation',
    'sources': d.sources_used.map(src => ({
      url: src.url,
      snippet: src.snippet_quote || '',
      supports: src.supports || '',
      fetched_at: d.generated_at || today
    })),
    'automation': {
      method: 'google_cse+claude',
      confidence: d.confidence ?? 0,
      generated_at: d.generated_at || new Date().toISOString(),
      reviewed_by: REVIEWER,
      reviewed_at: new Date().toISOString()
    }
  };

  const nn = norm(d.store_name);
  if (picksByName.has(nn)) {
    const idx = picksByName.get(nn);
    picksArr[idx] = Object.assign({}, picksArr[idx], entry);
    updated++;
  } else {
    picksArr.push(entry);
    added++;
  }
}

console.log(`--- 結果 ---`);
console.log(`追加: ${added} / 更新: ${updated} / reject 除外: ${skippedRejected} / sources 不足: ${skippedNoSources} / 未マッチ: ${skippedNoMatch}`);
console.log(`editor_picks 合計: ${picksArr.length}`);

if (dryRun) { console.log('(--dry-run のため書き込み skip)'); process.exit(0); }
if (added === 0 && updated === 0) { console.log('反映対象なし'); process.exit(0); }

// 元構造で書き戻し
let out;
if (picksData.picks) { picksData.picks = picksArr; out = picksData; }
else if (picksData.stores) { picksData.stores = picksArr; out = picksData; }
else { out = picksArr; }
fs.writeFileSync(PICKS_PATH, JSON.stringify(out, null, 2), 'utf8');
console.log(`→ ${PICKS_PATH} 更新。次は \`node build.js\` で反映 → \`git push\``);
