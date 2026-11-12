#!/usr/bin/env node
/**
 * 日次記事（journal/*.html）の1枚目の画像（<figure class="art-hero-img"> / <div class="hero-image"> の中の <img>）の
 * loading="lazy" を外して eager にし、fetchpriority="high" を付ける（最初に見える画像を遅らせない）。
 * 2枚目以降は遅延読み込みのまま。幅・高さは、画像の縦横比が元データに無いので付けない
 * （表示枠は CSS の aspect-ratio で確保済み）。何度流しても結果は同じ（べき等）。
 *
 * 使い方: node scripts/patch_journal_hero_eager.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function patchHtml(html) {
  const m = html.match(/<img\b[^>]*>/);
  if (!m) return html;
  const idx = m.index;
  // 1枚目の <img> の直前がヒーロー枠の開始タグであるときだけ対象
  const before = html.slice(Math.max(0, idx - 200), idx);
  if (!/(?:<figure\s+class="art-hero-img"[^>]*>|<div\s+class="hero-image"[^>]*>)\s*$/.test(before)) return html;
  let tag = m[0];
  tag = tag.replace(/\bloading="lazy"/, 'loading="eager"');
  if (!/\bfetchpriority=/.test(tag)) tag = tag.replace(/\s*\/?>$/, (e) => ` fetchpriority="high"${e}`);
  return html.slice(0, idx) + tag + html.slice(idx + m[0].length);
}

module.exports = { patchHtml };

if (require.main === module) {
  const dry = process.argv.includes('--dry');
  const dir = path.join(ROOT, 'journal');
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}-.*\.html$/.test(f)) continue;
    const fp = path.join(dir, f);
    const before = fs.readFileSync(fp, 'utf8');
    const after = patchHtml(before);
    if (after !== before) { n++; if (!dry) fs.writeFileSync(fp, after); }
  }
  console.log(`${dry ? '(dry) ' : ''}更新: ${n}件`);
}
