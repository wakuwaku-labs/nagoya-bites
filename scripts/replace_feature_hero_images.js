#!/usr/bin/env node
// 各 features/*.html の hero（記事先頭の大きな画像）、og:image、twitter:image、
// JSON-LD image の汎用ストック写真を、対応する記事固有 SVG（assets/feature-figures/<slug>.svg）
// または既存実写JPG（assets/features/<slug>.jpg / <slug>-600.jpg）へ置換する。
//
// 個別店舗写真（shop-card-photo）は本スクリプトの対象外（別タスク）。
//
// 使い方: node scripts/replace_feature_hero_images.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const REAL_PHOTO_DIR = path.join(ROOT, 'assets', 'features');
const FIGURE_DIR = path.join(ROOT, 'assets', 'feature-figures');
const SITE_ORIGIN = 'https://nagoya-bites.com';

const STOCK_HOST_RE = /https?:\/\/(?:images\.|cdn\.)?(?:unsplash|pexels|loremflickr|pixabay)\.com[^"\s]*/g;

function pickReplacement(slug) {
  const realJpgFull = path.join(REAL_PHOTO_DIR, `${slug}.jpg`);
  const realJpg600 = path.join(REAL_PHOTO_DIR, `${slug}-600.jpg`);
  const figureSvg = path.join(FIGURE_DIR, `${slug}.svg`);

  if (fs.existsSync(realJpgFull)) return { rel: `assets/features/${slug}.jpg`, source: 'real-photo' };
  if (fs.existsSync(realJpg600)) return { rel: `assets/features/${slug}-600.jpg`, source: 'real-photo-600' };
  if (fs.existsSync(figureSvg))  return { rel: `assets/feature-figures/${slug}.svg`, source: 'figure-svg' };
  return null;
}

function processFile(file, dryRun) {
  const slug = path.basename(file, '.html');
  const replacement = pickReplacement(slug);
  if (!replacement) {
    return { slug, status: 'no-replacement-available' };
  }
  const absUrl = `${SITE_ORIGIN}/${replacement.rel}`;
  const relUrl = `../${replacement.rel}`;

  const original = fs.readFileSync(file, 'utf8');
  let out = original;
  let heroCount = 0, metaCount = 0;

  // 1. <meta property="og:image" content="STOCK"> / twitter:image  / JSON-LD "image": "STOCK"
  //    → SITE_ORIGIN を含む絶対URL に置換
  out = out.replace(/(<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content=")([^"]+)(")/g,
    (m, pre, url, post) => {
      if (STOCK_HOST_RE.test(url)) { STOCK_HOST_RE.lastIndex = 0; metaCount++; return pre + absUrl + post; }
      STOCK_HOST_RE.lastIndex = 0;
      return m;
    });

  out = out.replace(/("image"\s*:\s*")([^"]+)(")/g,
    (m, pre, url, post) => {
      if (STOCK_HOST_RE.test(url)) { STOCK_HOST_RE.lastIndex = 0; metaCount++; return pre + absUrl + post; }
      STOCK_HOST_RE.lastIndex = 0;
      return m;
    });

  // 2. ヒーロー画像（記事先頭の大画像）
  //    パターン例: <img src="STOCK" alt="..." loading="eager" fetchpriority="high">
  //    eager / fetchpriority="high" / class="hero" / class="art-hero-img" のいずれかを持つ <img> のみ対象
  out = out.replace(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g, (tag, src) => {
    if (!STOCK_HOST_RE.test(src)) { STOCK_HOST_RE.lastIndex = 0; return tag; }
    STOCK_HOST_RE.lastIndex = 0;
    const isHero = /loading="eager"|fetchpriority="high"|class="[^"]*(?:hero|art-hero-img|article-hero)[^"]*"/i.test(tag);
    if (!isHero) return tag; // 店舗カード画像等はスキップ
    heroCount++;
    return tag.replace(src, relUrl);
  });

  if (out === original) return { slug, status: 'no-change', replacement: replacement.source };
  if (!dryRun) fs.writeFileSync(file, out, 'utf8');
  return { slug, status: 'updated', replacement: replacement.source, hero: heroCount, meta: metaCount };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const files = fs.readdirSync(FEATURES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .map(f => path.join(FEATURES_DIR, f));

  const results = files.map(f => processFile(f, dryRun));
  const updated = results.filter(r => r.status === 'updated');
  const missing = results.filter(r => r.status === 'no-replacement-available');
  const noChange = results.filter(r => r.status === 'no-change');

  console.log(`Files: ${results.length}  updated: ${updated.length}  noChange: ${noChange.length}  missing: ${missing.length}`);
  if (missing.length) {
    console.log('\nMissing replacement (no .jpg, no -600.jpg, no .svg figure exists):');
    missing.forEach(r => console.log(`  - ${r.slug}`));
  }
  console.log('\nUpdated sample:');
  updated.slice(0, 8).forEach(r => console.log(`  ${r.slug} → ${r.replacement} (hero:${r.hero} meta:${r.meta})`));
  if (updated.length > 8) console.log(`  ... (+${updated.length - 8} more)`);
}

if (require.main === module) main();
