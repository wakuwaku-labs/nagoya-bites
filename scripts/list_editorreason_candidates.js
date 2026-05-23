#!/usr/bin/env node
/**
 * scripts/list_editorreason_candidates.js
 *
 * ISSUE-045 editorReason 収集の優先順リストを生成する。
 *
 * 優先度（高 → 低）:
 *   1. GA4 閲覧上位（実際にお客様が見ている店）
 *   2. 編集部推薦（manual_stores / 一覧フラグ）
 *   3. editor_picks 既登録（より深い insiderNote を追記する余地あり）
 *   4. Google評価 4.3 以上 × 口コミ多い
 *
 * 出力: docs/editorreason-todo.md（人間 Editor が記入する作業表）
 *
 * 使い方:
 *   node scripts/list_editorreason_candidates.js          # 上位 100 件
 *   node scripts/list_editorreason_candidates.js --top 30 # 上位 30 件
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let TOP = 100;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--top') TOP = parseInt(args[++i], 10) || 100;
}

// データ読み込み
const stores = loadStores();
let viewCounts = {};
try {
  const vc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'view_counts.json'), 'utf8'));
  viewCounts = vc.counts || {};
} catch (_) { /* GA4 データなし */ }

let editorPicks = [];
try {
  const ep = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'editor_picks.json'), 'utf8'));
  editorPicks = ep.picks || ep.stores || ep;
  if (!Array.isArray(editorPicks)) editorPicks = Object.values(editorPicks);
} catch (_) { /* picks なし */ }

// 既に editorReason 有の店名集合（追加対象から外す）
const norm = s => String(s || '').replace(/\s|　/g, '').toLowerCase();
const haveReason = new Set();
for (const s of stores) {
  if (s.editorReason && String(s.editorReason).trim()) haveReason.add(norm(s['店名']));
}
const inPicks = new Map();
for (const p of editorPicks) {
  if (p['店名']) inPicks.set(norm(p['店名']), p);
}

// スコアリング
function priorityScore(s) {
  let v = 0;
  // 1) GA4 閲覧（実需の証拠・最強シグナル）
  const vw = parseInt(viewCounts[s['店名']] || 0, 10);
  if (vw > 0) v += 100000 + vw * 1000;
  // 2) 編集部推薦
  if (s['編集部推薦'] === true || s['編集部推薦'] === 'TRUE') v += 50000;
  // 3) 話題フラグ
  if (s['話題フラグ'] === true || s['話題フラグ'] === 'TRUE') v += 20000;
  // 4) editor_picks 既登録（深掘りの余地）
  if (inPicks.has(norm(s['店名']))) v += 10000;
  // 5) Google評価 × 口コミ数
  const rating = parseFloat(s['Google評価']) || 0;
  const reviews = parseInt(s['口コミ数'] || 0, 10);
  if (rating >= 4.5 && reviews >= 100) v += 5000;
  else if (rating >= 4.3 && reviews >= 50) v += 3000;
  else if (rating >= 4.0 && reviews >= 30) v += 1000;
  // 6) crossCheckScore
  if (typeof s.crossCheckScore === 'number') v += s.crossCheckScore * 10;
  return v;
}

const candidates = stores
  .filter(s => s['店名'] && !haveReason.has(norm(s['店名'])))
  .map(s => ({
    name: s['店名'],
    genre: s['ジャンル'] || '',
    area: s['エリア'] || '',
    rating: s['Google評価'] || '',
    reviews: s['口コミ数'] || '',
    views: viewCounts[s['店名']] || 0,
    editorPick: s['編集部推薦'] === true || s['編集部推薦'] === 'TRUE',
    inPicks: inPicks.has(norm(s['店名'])),
    score: priorityScore(s)
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, TOP);

// ── 出力 1: コンソール（要約） ──
console.log(`\n=== editorReason 未登録の優先順候補 TOP ${TOP} ===`);
console.log(`(現状: ${haveReason.size} / ${stores.length} = ${(haveReason.size / stores.length * 100).toFixed(1)}%)`);
console.log(`(目標: 30% = ${Math.ceil(stores.length * 0.30)} 件 → 残 ${Math.ceil(stores.length * 0.30) - haveReason.size} 件)\n`);

const top10 = candidates.slice(0, 10);
console.log('--- TOP 10 プレビュー ---');
top10.forEach((c, i) => {
  const tag = [];
  if (c.views > 0) tag.push(`👁${c.views}`);
  if (c.editorPick) tag.push('★編集部推薦');
  if (c.inPicks) tag.push('📌picks登録');
  console.log(`${String(i + 1).padStart(3)}. ${c.name}（${c.area}・${c.genre}）★${c.rating} ${tag.join(' ')}`);
});

// ── 出力 2: Markdown 作業表 ──
const outPath = path.join(ROOT, 'docs', 'editorreason-todo.md');
const lines = [];
lines.push('# editorReason 収集作業表（ISSUE-045）');
lines.push('');
lines.push(`> **目標**: editorReason カバー率 2.2% → 30%（残 ${Math.ceil(stores.length * 0.30) - haveReason.size} 件）`);
lines.push(`> **作成**: 自動生成（\`node scripts/list_editorreason_candidates.js\`）`);
lines.push('');
lines.push('## 記入ルール（必読）');
lines.push('');
lines.push('- **捏造禁止**: 自分が知らない店は空欄でスキップ。AI に書かせない。');
lines.push('- **業界人視点**: 一般のグルメライターには書けない「なぜこの店が良いか」の裏側（仕入れ・人・運営・差別化）を 60〜120 字程度で。');
lines.push('- **insiderNote**: より具体的な内部情報（オーナー経歴・調達ルート・予約困難の理由・業界人が頼むメニュー等）を入れたい場合。空欄可。');
lines.push('- **visitStatus**: `visited` / `recommended_by_peer` / `industry_known` のいずれか。空欄なら `industry_known` 扱い。');
lines.push('');
lines.push('## 記入後の取り込み手順');
lines.push('');
lines.push('1. 下の表の editorReason / insiderNote 欄にメモを書く（音声入力 OK）');
lines.push('2. `node scripts/import_editorreason_todo.js` で `data/editor_picks.json` に反映');
lines.push('3. `node build.js` → `git push origin main` で公開');
lines.push('');
lines.push('## 優先順 TOP ' + TOP + ' 候補');
lines.push('');
lines.push('| # | 店名 | エリア | ジャンル | ★ | 口コミ | 👁 GA4閲覧 | editorReason（記入欄） | insiderNote（任意） | visitStatus |');
lines.push('|---|------|--------|----------|---|--------|------------|------------------------|---------------------|-------------|');
candidates.forEach((c, i) => {
  const tags = [];
  if (c.editorPick) tags.push('★編');
  if (c.inPicks) tags.push('📌');
  const nameCell = `${c.name}${tags.length ? ' ' + tags.join('') : ''}`;
  lines.push(`| ${i + 1} | ${nameCell} | ${c.area} | ${c.genre} | ${c.rating} | ${c.reviews} | ${c.views || '-'} | | | |`);
});
lines.push('');
lines.push('---');
lines.push('');
lines.push('## 凡例');
lines.push('- **★編** = 既に「編集部推薦」フラグ付き');
lines.push('- **📌** = 既に editor_picks.json に登録済み（editorReason の追加・深掘りが可能）');
lines.push('- **👁 N** = 直近30日の GA4 modal_open 回数（実需の証拠）');
lines.push('');
lines.push('## 30% 達成までのペース目安');
lines.push('');
lines.push(`- 残 ${Math.ceil(stores.length * 0.30) - haveReason.size} 件`);
lines.push('- 週 50 件ペース → 約 6 ヶ月で達成');
lines.push('- 週 100 件ペース → 約 3 ヶ月で達成');
lines.push('');

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`\n→ ${outPath} に作業表を書き出しました（${candidates.length}件）`);
