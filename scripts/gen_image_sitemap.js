#!/usr/bin/env node
'use strict';
/**
 * sitemap-images.xml を sitemap.xml と公開ページから作り直す（P3-21）。
 * 通信しない・同じ入力なら同じ出力（べき等）。CI は gen_area_genre_pages.js の後に毎日回す（build.yml）。
 *   node scripts/gen_image_sitemap.js           # 書き込む
 *   node scripts/gen_image_sitemap.js --dry-run # 件数だけ表示
 */
const fs = require('fs');
const path = require('path');
const { buildImageSitemap, readPageFromRoot } = require('./lib/image_sitemap');

const ROOT = path.resolve(__dirname, '..');
const dry = process.argv.includes('--dry-run');
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const { xml, entries, skipped } = buildImageSitemap(sitemap, readPageFromRoot(ROOT));
if (!dry) fs.writeFileSync(path.join(ROOT, 'sitemap-images.xml'), xml, 'utf8');
console.log(`sitemap-images.xml: ${entries.length} 件${dry ? '（書き込まない）' : ''}（外した: ページなし ${skipped.noPage}・画像なし ${skipped.noImage}・Places ${skipped.places}・共通画像 ${skipped.generic}・非https ${skipped.notHttps}）`);
