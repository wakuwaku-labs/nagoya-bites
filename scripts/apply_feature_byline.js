#!/usr/bin/env node
/**
 * 特集の「公開日・更新日・書き手」の部品を全特集に当てる（SEO-145・冪等）。
 * 部品と判定は scripts/lib/feature_byline.js の1本。日付の正本は各記事の JSON-LD。
 *
 *   node scripts/apply_feature_byline.js            # 書き込む
 *   node scripts/apply_feature_byline.js --dry-run  # 変わるファイルを表示するだけ
 *   node scripts/apply_feature_byline.js --check    # 当て漏れ・古い部品があれば exit 1（CI 向け）
 *   node scripts/apply_feature_byline.js --only <語> # ファイル名にその語を含む特集だけ
 *
 * build.yml が、特集を書き換えるステップ（build_featured / refresh_feature_rosters /
 * add_feature_top_cta / add_feature_journal_links）の後に日次で回す。
 * refresh_feature_rosters.js が dateModified を進めた日は、ここで画面の更新日も進む。
 */
const fs = require('fs');
const path = require('path');
const { applyByline, readJsonLdDates } = require('./lib/feature_byline');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'features');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const check = args.includes('--check');
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? args[onlyAt + 1] || '' : '';

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html') && (!only || f.includes(only))).sort();
const changed = [];
let skipped = 0;
for (const file of files) {
  const full = path.join(DIR, file);
  const html = fs.readFileSync(full, 'utf8');
  if (!readJsonLdDates(html)) { skipped++; continue; }
  const next = applyByline(html, { selfFile: file });
  if (next === html) continue;
  changed.push(file);
  if (!dryRun && !check) fs.writeFileSync(full, next);
}

const verb = check || dryRun ? '要更新' : '更新';
console.log(`特集の公開日・更新日・書き手: 対象 ${files.length - skipped} 本 / ${verb} ${changed.length} 本 / 日付なし ${skipped} 本`);
for (const f of changed) console.log(`  ${f}`);
if (check && changed.length) process.exit(1);
