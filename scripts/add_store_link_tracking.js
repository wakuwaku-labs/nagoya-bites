#!/usr/bin/env node
/**
 * add_store_link_tracking.js
 *
 * 既存の店舗ページ（stores/*.html）に、内部リンクのクリック計測（internal_link_click）の読み込みタグを後追いで入れる。
 * 新しく生成するページは gen-store-pages.js が同じ1行を入れる。タグの文字列は scripts/lib/store_link_tracking.js の1本。
 * sitemap・本文・他の箇所は変えない（</body> の直前に1行足すだけ）。
 *
 * 冪等: すでにタグがあるページは変えない。
 *   node scripts/add_store_link_tracking.js            # stores/*.html すべてに入れる
 *   node scripts/add_store_link_tracking.js --check    # 入っていないページがあれば exit 1（書き換えない）。件数も出す
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { hasTracking, hasBlocks, applyToHtml } = require('./lib/store_link_tracking');

const ROOT = path.resolve(__dirname, '..');
const STORES_DIR = path.join(ROOT, 'stores');
const CHECK = process.argv.includes('--check');

const files = fs.readdirSync(STORES_DIR).filter(f => f.endsWith('.html')).sort();
let modified = 0, skipped = 0, missing = 0, errored = 0, withBlocks = 0, withBlocksTracked = 0, redirects = 0;
for (const f of files) {
  const file = path.join(STORES_DIR, f);
  try {
    const html = fs.readFileSync(file, 'utf8');
    const blocks = hasBlocks(html);
    if (blocks) withBlocks++;
    if (!blocks) { redirects++; continue; } // 移動先への転送だけのページ（store_orphans.js の stub）。クリックして動く内部リンクが無いので入れない
    if (hasTracking(html)) { skipped++; withBlocksTracked++; continue; }
    if (CHECK) { missing++; continue; }
    const next = applyToHtml(html);
    if (next === null) { errored++; console.error(`ERROR (</body> が無い): stores/${f}`); continue; }
    fs.writeFileSync(file, next, 'utf8');
    modified++;
    withBlocksTracked++;
  } catch (e) {
    errored++;
    console.error(`ERROR: stores/${f}: ${e.message}`);
  }
}
console.log(`add_store_link_tracking: ${CHECK ? `未適用=${missing}` : `書き換え=${modified}`} 済み=${skipped} ブロック無し（転送ページ）=${redirects} エラー=${errored} （対象 ${files.length} 本）`);
console.log(`  内部リンクのブロックがあるページ=${withBlocks}  うち計測タグあり=${withBlocksTracked}`);
if (errored > 0 || (CHECK && missing > 0)) process.exit(1);
