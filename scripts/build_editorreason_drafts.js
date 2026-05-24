#!/usr/bin/env node
/**
 * scripts/build_editorreason_drafts.js
 *
 * ISSUE-045 自動化メインエントリ:
 *   1. 優先順候補（list_editorreason_candidates のロジック）を上位 N 件抽出
 *   2. 各店に対し Google CSE で業界系エビデンスを検索
 *   3. Claude API で「引用ベースの editorReason draft」を生成
 *   4. confidence >= AUTO_THRESHOLD は data/editorreason_drafts/ にキャッシュ
 *   5. すべての draft を docs/editorreason-drafts.md に追記（人手レビュー用）
 *
 * 必要シークレット: GOOGLE_CSE_KEY / GOOGLE_CSE_CX / ANTHROPIC_API_KEY
 *   未設定の場合は exit 0（CI 失敗扱いにしない・ISSUE-041 と同じパターン）
 *
 * 使い方:
 *   node scripts/build_editorreason_drafts.js              # 上位 30 件
 *   node scripts/build_editorreason_drafts.js --top 100    # 上位 100 件
 *   node scripts/build_editorreason_drafts.js --dry-run    # 検索のみ・LLM 呼ばない
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores');
const cse = require('./lib/google_cse');
const llm = require('./lib/anthropic_extractor');

const ROOT = path.resolve(__dirname, '..');
const SOURCES_DIR = path.join(ROOT, 'data', 'industry_sources');
const DRAFTS_DIR = path.join(ROOT, 'data', 'editorreason_drafts');
const DRAFTS_MD = path.join(ROOT, 'docs', 'editorreason-drafts.md');

const args = process.argv.slice(2);
let TOP = 30;
let DRY = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--top') TOP = parseInt(args[++i], 10) || 30;
  if (args[i] === '--dry-run') DRY = true;
}

const AUTO_CONFIDENCE_THRESHOLD = 0.85;

// 環境チェック
if (!cse.isConfigured()) {
  console.error('GOOGLE_CSE_KEY / GOOGLE_CSE_CX 未設定 — exit 0 でスキップ');
  console.error('セットアップ: docs/editorreason-automation-setup.md');
  process.exit(0);
}
if (!DRY && !llm.isConfigured()) {
  console.error('ANTHROPIC_API_KEY 未設定 — exit 0 でスキップ');
  console.error('セットアップ: docs/editorreason-automation-setup.md');
  process.exit(0);
}

fs.mkdirSync(SOURCES_DIR, { recursive: true });
fs.mkdirSync(DRAFTS_DIR, { recursive: true });

// ── 優先順候補抽出（list_editorreason_candidates.js と同じロジック） ──
const stores = loadStores();
let viewCounts = {};
try {
  const vc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'view_counts.json'), 'utf8'));
  viewCounts = vc.counts || {};
} catch (_) {}
const norm = s => String(s || '').replace(/\s|　/g, '').toLowerCase();
const haveReason = new Set();
for (const s of stores) {
  if (s.editorReason && String(s.editorReason).trim()) haveReason.add(norm(s['店名']));
}
function priorityScore(s) {
  let v = 0;
  const vw = parseInt(viewCounts[s['店名']] || 0, 10);
  if (vw > 0) v += 100000 + vw * 1000;
  if (s['編集部推薦'] === true || s['編集部推薦'] === 'TRUE') v += 50000;
  if (s['話題フラグ'] === true || s['話題フラグ'] === 'TRUE') v += 20000;
  const rating = parseFloat(s['Google評価']) || 0;
  const reviews = parseInt(s['口コミ数'] || 0, 10);
  if (rating >= 4.5 && reviews >= 100) v += 5000;
  else if (rating >= 4.3 && reviews >= 50) v += 3000;
  if (typeof s.crossCheckScore === 'number') v += s.crossCheckScore * 10;
  return v;
}
const candidates = stores
  .filter(s => s['店名'] && !haveReason.has(norm(s['店名'])))
  .map(s => ({ ...s, _score: priorityScore(s) }))
  .sort((a, b) => b._score - a._score)
  .slice(0, TOP);

console.log(`=== editorReason 自動 draft 生成: ${candidates.length} 件 ===`);

// ── メインループ ──
(async () => {
  const allDrafts = [];
  let okCount = 0, insufficientCount = 0, warnCount = 0, errCount = 0;
  let autoMergeCount = 0, reviewQueueCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const s = candidates[i];
    const id = s['ホットペッパーID'] || `manual_${norm(s['店名'])}`;
    const sourcePath = path.join(SOURCES_DIR, `${id}.json`);
    const draftPath = path.join(DRAFTS_DIR, `${id}.json`);

    process.stdout.write(`[${i + 1}/${candidates.length}] ${s['店名']} ... `);

    // 1) Source discovery（キャッシュ優先）
    let evidence;
    if (fs.existsSync(sourcePath)) {
      try { evidence = JSON.parse(fs.readFileSync(sourcePath, 'utf8')); }
      catch (_) { evidence = null; }
    }
    if (!evidence) {
      try {
        evidence = await cse.discoverIndustryEvidence(
          { name: s['店名'], area: s['エリア'], genre: s['ジャンル'] },
          { perQuery: 3 }
        );
        fs.writeFileSync(sourcePath, JSON.stringify(evidence, null, 2), 'utf8');
      } catch (e) {
        console.log(`source discovery ERR: ${e.message}`);
        errCount++;
        continue;
      }
    }

    if (DRY) { console.log(`(dry-run: evidence ${evidence.length} queries cached)`); continue; }

    // 2) Draft 生成（キャッシュ優先）
    let draft;
    if (fs.existsSync(draftPath)) {
      try { draft = JSON.parse(fs.readFileSync(draftPath, 'utf8')); }
      catch (_) { draft = null; }
    }
    if (!draft) {
      try {
        draft = await llm.extractEditorReason(s, evidence);
        draft.store_id = id;
        draft.store_name = s['店名'];
        draft.area = s['エリア'] || '';
        draft.genre = s['ジャンル'] || '';
        draft.rating = s['Google評価'] || '';
        draft.generated_at = new Date().toISOString();
        fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2), 'utf8');
      } catch (e) {
        console.log(`LLM ERR: ${e.message}`);
        errCount++;
        continue;
      }
    }

    if (draft.status === 'OK') okCount++;
    else if (draft.status === 'INSUFFICIENT_EVIDENCE') insufficientCount++;
    else if (draft.status === 'WARN_RISK') warnCount++;

    if (draft.status === 'OK' && (draft.confidence || 0) >= AUTO_CONFIDENCE_THRESHOLD) autoMergeCount++;
    else if (draft.status === 'OK') reviewQueueCount++;

    allDrafts.push(draft);
    console.log(`${draft.status} (confidence ${draft.confidence ?? '?'})`);

    // レート対策
    await new Promise(r => setTimeout(r, 500));
  }

  // ── 3) docs/editorreason-drafts.md を生成（人手レビュー用） ──
  const lines = [];
  lines.push('# editorReason 自動生成 draft レビュー（ISSUE-045）');
  lines.push('');
  lines.push(`> **生成**: ${new Date().toISOString()}`);
  lines.push(`> **対象**: 上位 ${candidates.length} 候補 / 生成 ${allDrafts.length} 件`);
  lines.push(`> **結果**: OK ${okCount} / INSUFFICIENT ${insufficientCount} / WARN ${warnCount} / ERR ${errCount}`);
  lines.push(`> **自動マージ候補** (confidence ≥ ${AUTO_CONFIDENCE_THRESHOLD}): ${autoMergeCount} 件`);
  lines.push(`> **人手レビュー要**: ${reviewQueueCount} 件`);
  lines.push('');
  lines.push('## レビュー手順');
  lines.push('');
  lines.push('1. 各 draft の editorReason / sources_used を確認');
  lines.push('2. 採用する draft は `[approved]` 行を追加（または `[reject]`）');
  lines.push('3. `node scripts/approve_editorreason_drafts.js` を実行 → editor_picks.json に反映');
  lines.push('4. `node build.js` → `git push origin main` で公開');
  lines.push('');
  lines.push('## draft 一覧');
  lines.push('');

  for (const d of allDrafts) {
    const tag = d.status === 'OK'
      ? (d.confidence >= AUTO_CONFIDENCE_THRESHOLD ? '🟢 high-conf (自動マージ候補)' : '🟡 review-required')
      : (d.status === 'WARN_RISK' ? '🔴 WARN_RISK' : '⚪ INSUFFICIENT');
    lines.push(`### ${d.store_name}（${d.area} / ${d.genre}・★${d.rating}）`);
    lines.push('');
    lines.push(`- **status**: ${d.status} ${tag}`);
    lines.push(`- **confidence**: ${d.confidence ?? '-'}`);
    lines.push(`- **editorReason**: ${d.editorReason || '(なし)'}`);
    if (d.insiderNote) lines.push(`- **insiderNote**: ${d.insiderNote}`);
    if (d.sources_used && d.sources_used.length) {
      lines.push('- **sources_used**:');
      d.sources_used.forEach((src, i) => {
        lines.push(`  ${i + 1}. [${src.supports || ''}](${src.url})`);
        if (src.snippet_quote) lines.push(`     > ${src.snippet_quote.slice(0, 200)}`);
      });
    }
    if (d.warnings && d.warnings.length) {
      lines.push(`- **warnings**: ${d.warnings.join(' / ')}`);
    }
    lines.push('');
    lines.push(`<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: ${d.store_id} -->`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  fs.writeFileSync(DRAFTS_MD, lines.join('\n'), 'utf8');
  console.log(`\n=== 完了 ===`);
  console.log(`OK ${okCount} / INSUFFICIENT ${insufficientCount} / WARN ${warnCount} / ERR ${errCount}`);
  console.log(`→ ${DRAFTS_MD}`);
  console.log(`→ data/industry_sources/ にエビデンスキャッシュ`);
  console.log(`→ data/editorreason_drafts/ に draft キャッシュ`);
  console.log(`\n次は: docs/editorreason-drafts.md で [approved] を付け、\`node scripts/approve_editorreason_drafts.js\` で反映`);
})().catch(e => { console.error(e); process.exit(1); });
