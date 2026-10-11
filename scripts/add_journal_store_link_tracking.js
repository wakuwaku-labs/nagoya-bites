#!/usr/bin/env node
/**
 * add_journal_store_link_tracking.js  (I-08)
 *
 * 公開済みのジャーナル記事に、店舗ページへのクリックの計測（journal_store_click）を後追いで入れる。
 * 新しい記事は journal/_template.html に入っているので、このスクリプトは既存の記事のためのもの。
 * 計測の文字列は scripts/lib/journal_store_link_tracking.js の1本。
 *
 * 冪等: class="nb-journal-store-link" がある記事は変えない。
 *   node scripts/add_journal_store_link_tracking.js            # journal/20*.html すべてに入れる
 *   node scripts/add_journal_store_link_tracking.js --check    # 入っていない記事があれば exit 1（書き換えない）
 *   node scripts/add_journal_store_link_tracking.js journal/2026-10-*.html   # 指定した記事だけ
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { applyToHtml, hasTracking } = require('./lib/journal_store_link_tracking');

const ROOT = path.resolve(__dirname, '..');
const JOURNAL_DIR = path.join(ROOT, 'journal');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const given = args.filter(a => a.endsWith('.html'));
const files = (given.length
  ? given.map(f => path.resolve(f))
  : fs.readdirSync(JOURNAL_DIR).filter(f => /^20\d\d-.*\.html$/.test(f)).map(f => path.join(JOURNAL_DIR, f))
).sort();

let modified = 0, skipped = 0, missing = 0, errored = 0;
for (const f of files) {
  try {
    const html = fs.readFileSync(f, 'utf8');
    if (hasTracking(html)) { skipped++; continue; }
    if (CHECK) { missing++; console.log(`[未適用] ${path.relative(ROOT, f)}`); continue; }
    const next = applyToHtml(html);
    if (next === null) { errored++; console.error(`ERROR (</body> が無い): ${path.relative(ROOT, f)}`); continue; }
    fs.writeFileSync(f, next, 'utf8');
    modified++;
  } catch (e) {
    errored++;
    console.error(`ERROR: ${f}: ${e.message}`);
  }
}
console.log(`add_journal_store_link_tracking: ${CHECK ? `未適用=${missing}` : `書き換え=${modified}`} 済み=${skipped} エラー=${errored} （対象 ${files.length} 本）`);
if (errored > 0 || (CHECK && missing > 0)) process.exit(1);
