#!/usr/bin/env node
/**
 * 既存HTMLの <img> タグに不足している loading / decoding / fetchpriority を補完する。
 *
 * ルール:
 *  - stores/*.html の <img class="hero-img">: loading="eager" decoding="async" fetchpriority="high"
 *  - features/*.html の <img>（loading が無いもの）: 既存維持＋ decoding="async" 追加
 *  - features/*.html の <img>（loading="lazy"）: decoding="async" を追加
 *
 * 既に属性があれば変更しない（冪等）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function listFiles(dir, re) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => re.test(f)).map(f => path.join(d, f));
}

function ensureAttr(imgTag, attr, value) {
  // 既存 attr があればそのまま
  const re = new RegExp(`\\b${attr}=["'][^"']*["']`);
  if (re.test(imgTag)) return imgTag;
  // 末尾 > / /> の直前に挿入
  return imgTag.replace(/(\s*\/?>)$/, ` ${attr}="${value}"$1`);
}

function patchStoreHeroImg(html) {
  return html.replace(/<img\s+class="hero-img"[^>]*>/g, (tag) => {
    let t = tag;
    t = ensureAttr(t, 'loading', 'eager');
    t = ensureAttr(t, 'decoding', 'async');
    t = ensureAttr(t, 'fetchpriority', 'high');
    return t;
  });
}

function patchFeatureImgs(html) {
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    return ensureAttr(tag, 'decoding', 'async');
  });
}

let totalFiles = 0;

console.log('=== stores/*.html (hero-img patch) ===');
for (const fp of listFiles('stores', /\.html$/)) {
  const before = fs.readFileSync(fp, 'utf8');
  const after = patchStoreHeroImg(before);
  if (after !== before) {
    fs.writeFileSync(fp, after);
    totalFiles++;
  }
}
console.log(`  更新: ${totalFiles}件`);
const storeCount = totalFiles;

totalFiles = 0;
console.log('\n=== features/*.html (decoding=async patch) ===');
for (const fp of listFiles('features', /\.html$/)) {
  const before = fs.readFileSync(fp, 'utf8');
  const after = patchFeatureImgs(before);
  if (after !== before) {
    fs.writeFileSync(fp, after);
    totalFiles++;
  }
}
console.log(`  更新: ${totalFiles}件`);
const featureCount = totalFiles;

totalFiles = 0;
console.log('\n=== journal/*.html (decoding=async patch) ===');
for (const fp of listFiles('journal', /^2\d{3}-.+\.html$/)) {
  const before = fs.readFileSync(fp, 'utf8');
  const after = patchFeatureImgs(before);
  if (after !== before) {
    fs.writeFileSync(fp, after);
    totalFiles++;
  }
}
console.log(`  更新: ${totalFiles}件`);

console.log(`\n完了: stores ${storeCount} / features ${featureCount} / journal ${totalFiles}`);
