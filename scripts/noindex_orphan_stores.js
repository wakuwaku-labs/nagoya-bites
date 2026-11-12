#!/usr/bin/env node
'use strict';
/**
 * 項目14: 旧店舗ページ（孤児）に「検索に出さない」印を足す／外す。通信しない・削除しない・冪等。
 *
 *   node scripts/noindex_orphan_stores.js            # 件数だけ表示（書き換えなし）
 *   node scripts/noindex_orphan_stores.js --apply    # data/store_page_orphans.json の orphanSlugs に印を足す
 *   node scripts/noindex_orphan_stores.js --revert   # stores/*.html の印をすべて外す（元の内容に戻る）
 *
 * 毎日の自動処理（gen-store-pages.js --redirect-orphans）が同じ処理を新しい孤児にも行う。
 * 判定器と印の書式は scripts/lib/store_orphans.js（addOrphanNoindex / removeOrphanNoindex）。
 */
const fs = require('fs');
const path = require('path');
const SO = require('./lib/store_orphans');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'stores');

function listOrphans() {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'store_page_orphans.json'), 'utf8'));
  return j.orphanSlugs || [];
}

function run({ apply = false, revert = false } = {}) {
  let changed = 0, already = 0, skipped = 0, total = 0;
  if (revert) {
    for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.html'))) {
      const p = path.join(DIR, f);
      const b = fs.readFileSync(p, 'utf8');
      const a = SO.removeOrphanNoindex(b);
      total++;
      if (a !== b) { fs.writeFileSync(p, a, 'utf8'); changed++; }
    }
    return { mode: 'revert', total, changed };
  }
  for (const s of listOrphans()) {
    const p = path.join(DIR, `${s}.html`);
    if (!fs.existsSync(p)) { skipped++; continue; }
    const b = fs.readFileSync(p, 'utf8');
    total++;
    if (SO.isOrphanNoindexed(b)) { already++; continue; }
    const a = SO.addOrphanNoindex(b);
    if (a === b) { skipped++; continue; } // 既に noindex の案内ページなど
    if (apply) fs.writeFileSync(p, a, 'utf8');
    changed++;
  }
  return { mode: apply ? 'apply' : 'dry-run', total, changed, already, skipped };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  console.log(JSON.stringify(run({ apply: args.includes('--apply'), revert: args.includes('--revert') })));
}
module.exports = { run };
