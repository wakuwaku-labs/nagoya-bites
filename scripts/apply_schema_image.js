#!/usr/bin/env node
'use strict';
/**
 * 日次(journal/*.html)・特集(features/*.html)の JSON-LD に、og:image が使えるときだけ image を足す（項目20・冪等）。
 * 判定は scripts/lib/schema_image.js。差分が無ければ書かない。--check は書かずに、足せる件数があれば exit 1。
 *   node scripts/apply_schema_image.js [--check]
 */
const fs = require('fs');
const path = require('path');
const { addImage } = require('./lib/schema_image');

const ROOT = path.join(__dirname, '..');
const check = process.argv.includes('--check');
let changed = 0;
for (const dir of ['journal', 'features']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
    if (!f.endsWith('.html') || f === '_template.html' || f === 'index.html') continue;
    const p = path.join(ROOT, dir, f);
    const html = fs.readFileSync(p, 'utf8');
    const r = addImage(html);
    if (!r.changed) continue;
    changed++;
    if (!check) fs.writeFileSync(p, r.html);
  }
}
console.log(`${check ? '足せる' : '足した'}: ${changed} 本`);
process.exit(check && changed ? 1 : 0);
