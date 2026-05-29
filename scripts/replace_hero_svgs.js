#!/usr/bin/env node
/**
 * Replace SVG hero images in feature articles with real HotPepper food photos.
 * Uses the first suitable HotPepper photo found within each article itself.
 */

const fs = require('fs');
const path = require('path');

const FEATURES_DIR = path.join(__dirname, '../features');
const AVOID_PHOTOS = new Set([
  'P047849240', // みかん branded logo — inappropriate for hero
]);

function extractHotpepperPhotos(html) {
  const photos = [];
  const re = /src="(https:\/\/imgfp\.hotp\.jp\/IMGH\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    photos.push(m[1]);
  }
  return photos;
}

function normalize480(url) {
  return url.replace(/_238\.jpg$/, '_480.jpg');
}

function getSuitablePhoto(html) {
  const photos = extractHotpepperPhotos(html);
  for (const photo of photos) {
    const id = photo.match(/\/(P\d+)\//)?.[1];
    if (id && AVOID_PHOTOS.has(id)) continue;
    return normalize480(photo);
  }
  return null;
}

// Override mapping for articles where the auto-selected photo is wrong
const OVERRIDES = {
  'nagoya-industry-pick-izakaya.html': 'https://imgfp.hotp.jp/IMGH/83/45/P045928345/P045928345_480.jpg',
  'nagoya-gourmet-guide.html': 'https://imgfp.hotp.jp/IMGH/77/22/P048887722/P048887722_480.jpg',
};

// Articles to skip (no food content, or text-only policy pages)
const SKIP = new Set([
  'editorial-policy.html',
  'integrity-method.html',
  'no-fake-reviews.html',
  'become-reviewer.html',
]);

const files = fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.html'));
let updated = 0;
let skipped = 0;

for (const file of files) {
  if (SKIP.has(file)) { skipped++; continue; }

  const filePath = path.join(FEATURES_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');

  // Only process files that have an SVG art-hero-image
  const heroSvgMatch = html.match(/(class="art-hero-image"[\s\S]*?)<img([^>]*?)src="([^"]*feature-figures[^"]*\.svg)"([^>]*?)>/);
  if (!heroSvgMatch) { skipped++; continue; }

  const oldSrc = heroSvgMatch[3];
  const newSrc = OVERRIDES[file] || getSuitablePhoto(html);

  if (!newSrc) {
    console.log(`SKIP (no photo): ${file}`);
    skipped++;
    continue;
  }

  // Replace hero image src
  html = html.replace(
    /(<div class="art-hero-image"[\s\S]*?<img[^>]*?)src="[^"]*feature-figures[^"]*\.svg"/,
    `$1src="${newSrc}"`
  );

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✓ ${file}  →  ${newSrc.split('/').slice(-1)[0]}`);
  updated++;
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
