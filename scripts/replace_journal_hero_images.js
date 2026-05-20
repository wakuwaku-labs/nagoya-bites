#!/usr/bin/env node
// journal/*.html の hero画像 / og:image / twitter:image / JSON-LD image の
// 汎用ストック写真（Unsplash/Pexels/loremflickr）を、
// 各記事固有の SVG イメージ図（assets/journal-figures/<slug>.svg）へ置換する。
//
// art-hero-ig（Instagram embed）を持つ記事は触らない（既に実写）。
//
// 使い方: node scripts/replace_journal_hero_images.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JOURNAL_DIR = path.join(ROOT, 'journal');
const FIGURE_DIR = path.join(ROOT, 'assets', 'journal-figures');
const SITE_ORIGIN = 'https://nagoya-bites.com';

const { makeSvg, classifyGenre } = require('./replace_feature_card_images.js');

const STOCK_HOST_RE = /https?:\/\/(?:images\.|cdn\.)?(?:unsplash|pexels|loremflickr|pixabay)\.com[^"\s]*/g;

function pickTitleAndEyebrow(html) {
  const ogt = (html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/) || [])[1] || '';
  const t = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
  const headline = (html.match(/"headline"\s*:\s*"([^"]+)"/) || [])[1] || '';
  // 第一候補: og:title / headline / <title> から「｜NAGOYA BITES」を除いたもの
  const raw = ogt || headline || t;
  const cleaned = raw.replace(/\s*[｜|]\s*NAGOYA BITES.*$/i, '').replace(/\s*— NAGOYA BITES.*$/i, '').trim();
  const eyebrow = (html.match(/class="art-eyebrow"[^>]*>([^<]+)</) || [])[1]
                || (html.match(/class="eyebrow"[^>]*>([^<]+)</) || [])[1]
                || '';
  return { title: cleaned, eyebrow };
}

function processFile(file, dryRun) {
  const slug = path.basename(file, '.html');
  const original = fs.readFileSync(file, 'utf8');

  // art-hero-ig を持つ → 既に Instagram embed なのでスキップ（hero部分は触らない）
  // ただし og:image が stock の場合は SVG figure へ差し替え（OG プレビューも実写化）
  const hasIgHero = /class="art-hero-ig"/.test(original);

  const { title, eyebrow } = pickTitleAndEyebrow(original);
  if (!title) return { slug, status: 'no-title' };

  const genre = classifyGenre(`${title} ${eyebrow}`);
  const figurePath = path.join(FIGURE_DIR, `${slug}.svg`);
  const figureRel = `../assets/journal-figures/${slug}.svg`;
  const figureAbs = `${SITE_ORIGIN}/assets/journal-figures/${slug}.svg`;

  let out = original;
  let metaCount = 0, heroCount = 0;
  let svgWritten = false;

  // og:image / twitter:image / JSON-LD "image": 置換
  out = out.replace(/(<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content=")([^"]+)(")/g,
    (m, pre, url, post) => {
      if (STOCK_HOST_RE.test(url)) { STOCK_HOST_RE.lastIndex = 0; metaCount++; return pre + figureAbs + post; }
      STOCK_HOST_RE.lastIndex = 0;
      return m;
    });
  out = out.replace(/("image"\s*:\s*")([^"]+)(")/g,
    (m, pre, url, post) => {
      if (STOCK_HOST_RE.test(url)) { STOCK_HOST_RE.lastIndex = 0; metaCount++; return pre + figureAbs + post; }
      STOCK_HOST_RE.lastIndex = 0;
      return m;
    });

  // hero <img>（art-hero-img / hero-img クラスを持つ <img> の src）を置換
  // IGヒーローを持つ場合はスキップ（既に実写）
  if (!hasIgHero) {
    // ケース1: img タグ自体に class が付いている
    out = out.replace(/<img\b[^>]*\b(?:class="(?:[^"]*\b(?:art-hero-img|hero-img)\b[^"]*)")[^>]*>/g, (tag) => {
      const src = (tag.match(/\bsrc="([^"]+)"/) || [])[1];
      if (!src) return tag;
      if (!STOCK_HOST_RE.test(src)) { STOCK_HOST_RE.lastIndex = 0; return tag; }
      STOCK_HOST_RE.lastIndex = 0;
      heroCount++;
      return tag.replace(src, figureRel);
    });

    // ケース1b: <div class="hero-image"> 内の img
    out = out.replace(
      /<div\s+class="hero-image"[^>]*>([\s\S]*?)<\/div>/g,
      (block, inner) => {
        const imgMatch = inner.match(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/);
        if (!imgMatch) return block;
        const src = imgMatch[1];
        if (!STOCK_HOST_RE.test(src)) { STOCK_HOST_RE.lastIndex = 0; return block; }
        STOCK_HOST_RE.lastIndex = 0;
        heroCount++;
        const alt = (inner.match(/\balt="([^"]+)"/) || [, ''])[1] || title;
        return `<div class="hero-image">\n      <img src="${figureRel}" alt="${alt}" loading="lazy">\n    </div>`;
      }
    );

    // ケース2: <figure class="art-hero-img">\n  <img src="STOCK"...>\n  <figcaption>...</figcaption>\n</figure>
    // → figcaption（外部クレジット）も削除して構造を簡素化
    out = out.replace(
      /<figure\s+class="art-hero-img"[^>]*>([\s\S]*?)<\/figure>/g,
      (block, inner) => {
        const imgMatch = inner.match(/<img\b([^>]*)\bsrc="([^"]+)"([^>]*)>/);
        if (!imgMatch) return block;
        const [, pre, src, post] = imgMatch;
        if (!STOCK_HOST_RE.test(src)) { STOCK_HOST_RE.lastIndex = 0; return block; }
        STOCK_HOST_RE.lastIndex = 0;
        heroCount++;
        const alt = (inner.match(/\balt="([^"]+)"/) || [, ''])[1] || title;
        return `<figure class="art-hero-img">\n  <img src="${figureRel}" alt="${alt}" loading="lazy" decoding="async">\n</figure>`;
      }
    );
  }

  if (out === original) return { slug, status: 'no-change', genre, hasIgHero };

  // SVG ファイル生成
  const svg = makeSvg({ title, category: eyebrow || '', genre });
  if (!dryRun) {
    fs.writeFileSync(figurePath, svg, 'utf8');
    fs.writeFileSync(file, out, 'utf8');
  }
  svgWritten = true;
  return { slug, status: 'updated', genre, meta: metaCount, hero: heroCount, hasIgHero, svgWritten };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!fs.existsSync(FIGURE_DIR)) fs.mkdirSync(FIGURE_DIR, { recursive: true });

  const files = fs.readdirSync(JOURNAL_DIR)
    .filter(f => f.endsWith('.html') && !['index.html', 'rss.xml'].includes(f))
    .map(f => path.join(JOURNAL_DIR, f));

  const results = files.map(f => processFile(f, dryRun));
  const updated = results.filter(r => r.status === 'updated');
  const skipped = results.filter(r => r.status === 'no-change');
  const noTitle = results.filter(r => r.status === 'no-title');

  console.log(`Journals: ${results.length}  updated: ${updated.length}  noChange: ${skipped.length}  noTitle: ${noTitle.length}  (dry-run: ${dryRun})`);

  const byGenre = updated.reduce((acc, r) => { acc[r.genre] = (acc[r.genre] || 0) + 1; return acc; }, {});
  console.log('Top genres:', Object.entries(byGenre).sort((a,b)=>b[1]-a[1]).slice(0,10));
  console.log('\nSample (first 6):');
  updated.slice(0, 6).forEach(r => console.log(`  ${r.slug} → ${r.genre} (hero:${r.hero} meta:${r.meta} ig:${r.hasIgHero})`));
}

if (require.main === module) main();
