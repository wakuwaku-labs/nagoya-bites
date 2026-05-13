'use strict';
/**
 * patch_store_og_images.js
 *
 * 既存の stores/*.html の og:image / twitter:image メタタグを
 * NAGOYA BITES オリジナル SVG（assets/og/{slug}.svg）に書き換える。
 * 配信は wsrv.nl 経由で SVG→PNG 変換:
 *   https://wsrv.nl/?url=https://nagoya-bites.com/assets/og/{slug}.svg&output=png&w=1200&h=630
 *
 * gen-store-pages.js を完全再実行せずに、in-place で og:image 系の行だけを置換する。
 *
 * 実行: node scripts/patch_store_og_images.js [--limit=N] [--dryrun]
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const STORES_DIR = path.join(ROOT, 'stores');
const OG_DIR     = path.join(ROOT, 'assets', 'og');
const SITE_URL   = 'https://nagoya-bites.com';

function makeOgUrl(slug) {
  // wsrv.nl による SVG → PNG 変換。w/h を明示指定して 1200×630 を強制
  return `https://wsrv.nl/?url=${encodeURIComponent(SITE_URL + '/assets/og/' + slug + '.svg')}&output=png&w=1200&h=630`;
}

function patchHtml(html, slug) {
  const ogUrl = makeOgUrl(slug);
  let modified = false;
  let out = html;

  // og:image
  out = out.replace(
    /(<meta property="og:image" content=")[^"]+(">)/,
    (m, p1, p2) => { modified = true; return p1 + ogUrl + p2; }
  );
  // twitter:image
  out = out.replace(
    /(<meta name="twitter:image" content=")[^"]+(">)/,
    (m, p1, p2) => p1 + ogUrl + p2
  );
  // og:image:width
  out = out.replace(
    /<meta property="og:image:width" content="[^"]+">/,
    '<meta property="og:image:width" content="1200">'
  );
  // og:image:height
  out = out.replace(
    /<meta property="og:image:height" content="[^"]+">/,
    '<meta property="og:image:height" content="630">'
  );
  // og:image:alt — 「{店名} の店舗写真」→「{店名} | NAGOYA BITES（業界人推薦）」
  out = out.replace(
    /(<meta property="og:image:alt" content=")([^"]+?) の店舗写真(">)/,
    '$1$2 | NAGOYA BITES（業界人運営の名古屋グルメガイド）$3'
  );
  out = out.replace(
    /(<meta name="twitter:image:alt" content=")([^"]+?) の店舗写真(">)/,
    '$1$2 | NAGOYA BITES（業界人運営の名古屋グルメガイド）$3'
  );

  return { html: out, modified };
}

function main() {
  const args = process.argv.slice(2);
  const dryrun = args.includes('--dryrun');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  if (!fs.existsSync(STORES_DIR)) {
    console.error(`stores/ ディレクトリが見つかりません: ${STORES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(STORES_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');
  console.log(`対象 stores/*.html: ${files.length}件`);

  const subset = LIMIT ? files.slice(0, LIMIT) : files;
  let patched = 0;
  let skipped = 0;
  let noSvg = 0;

  for (const f of subset) {
    const slug = f.replace(/\.html$/, '');
    const svgPath = path.join(OG_DIR, `${slug}.svg`);
    if (!fs.existsSync(svgPath)) {
      noSvg++;
      continue;
    }
    const fp = path.join(STORES_DIR, f);
    const html = fs.readFileSync(fp, 'utf8');
    const { html: newHtml, modified } = patchHtml(html, slug);
    if (!modified) { skipped++; continue; }
    if (!dryrun) fs.writeFileSync(fp, newHtml, 'utf8');
    patched++;
    if (patched <= 3 && dryrun) {
      console.log(`(dryrun) ${f}: og:image → wsrv.nl/.../${slug}.svg`);
    }
  }

  console.log(`patched=${patched} skipped=${skipped} noSvg=${noSvg}${dryrun ? ' (dryrun)' : ''}`);
}

main();
