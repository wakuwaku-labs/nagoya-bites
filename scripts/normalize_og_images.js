#!/usr/bin/env node
/**
 * journal/*.html と features/*.html の OGP メタタグを整える。
 *  1. HotPepper の _238.jpg は _480.jpg に格上げ（同URLで存在する大判）
 *  2. og:image / twitter:image の現値からサイズを推定し、og:image:width / og:image:height を必ず付ける
 *
 * 推定ルール:
 *   - Unsplash with w=1200&h=630 ⇒ 1200x630
 *   - imgfp.hotp.jp .../P*_480.jpg ⇒ 480x320 (HotPepperの_480系の典型比3:2)
 *   - icon-512.png ⇒ 512x512
 *   - 不明 ⇒ そのままスキップ
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET_DIRS = ['journal', 'features'];

function listHtml(dir) {
  return fs.readdirSync(path.join(ROOT, dir))
    .filter(f => f.endsWith('.html') && f !== '_template.html')
    .map(f => path.join(ROOT, dir, f));
}

function inferDims(url) {
  if (!url) return null;
  // HTMLエンコードされた &amp; も & として扱う
  const decoded = url.replace(/&amp;/g, '&');
  const m1 = decoded.match(/[?&]w=(\d+)&h=(\d+)/);
  if (m1) return { w: parseInt(m1[1],10), h: parseInt(m1[2],10) };
  if (/icon-512\.png/.test(decoded)) return { w: 512, h: 512 };
  if (/imgfp\.hotp\.jp\/.+_480\.jpg/.test(decoded)) return { w: 480, h: 320 };
  if (/imgfp\.hotp\.jp\/.+_238\.jpg/.test(decoded)) return { w: 238, h: 158 };
  return null;
}

function upgradeHotpepperUrl(url) {
  return url.replace(/(imgfp\.hotp\.jp\/.+?)_238(\.jpg)/g, '$1_480$2');
}

function ensureOgDims(html, prop, dims) {
  // 既存の og:image:width / og:image:height がある場合は値を更新、無ければ og:image の直後に挿入
  const widthRe = new RegExp(`<meta\\s+property="${prop}:width"\\s+content="\\d+">`);
  const heightRe = new RegExp(`<meta\\s+property="${prop}:height"\\s+content="\\d+">`);
  const widthMeta = `<meta property="${prop}:width" content="${dims.w}">`;
  const heightMeta = `<meta property="${prop}:height" content="${dims.h}">`;

  if (widthRe.test(html)) html = html.replace(widthRe, widthMeta);
  else {
    const baseRe = new RegExp(`(<meta\\s+property="${prop}"\\s+content="[^"]+">)`);
    if (baseRe.test(html)) html = html.replace(baseRe, `$1\n${widthMeta}`);
  }
  if (heightRe.test(html)) html = html.replace(heightRe, heightMeta);
  else {
    const widthMetaRe = new RegExp(`(<meta\\s+property="${prop}:width"\\s+content="\\d+">)`);
    if (widthMetaRe.test(html)) html = html.replace(widthMetaRe, `$1\n${heightMeta}`);
  }
  return html;
}

function processFile(fp) {
  let html = fs.readFileSync(fp, 'utf8');
  const before = html;

  // 1) HotPepper _238 → _480
  html = upgradeHotpepperUrl(html);

  // 2) og:image dims
  const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)">/);
  if (ogMatch) {
    const dims = inferDims(ogMatch[1]);
    if (dims) html = ensureOgDims(html, 'og:image', dims);
  }
  // twitter:image はサイズメタが標準でないので width/height は付けない（Twitterは og:image:width/height も読む）

  if (html !== before) {
    fs.writeFileSync(fp, html);
    return true;
  }
  return false;
}

function main() {
  const files = TARGET_DIRS.flatMap(listHtml);
  let changed = 0;
  for (const f of files) {
    if (processFile(f)) changed++;
  }
  console.log(`Updated ${changed}/${files.length} files`);
}

main();
