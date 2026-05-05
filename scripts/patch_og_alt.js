#!/usr/bin/env node
/**
 * stores/*.html に og:image:alt と twitter:image:alt を補完する。
 * <title> から店名を抽出（{店名}（エリア・ジャンル）| NAGOYA BITES）。
 */
const fs = require('fs');
const path = require('path');

const STORES = path.join(__dirname, '..', 'stores');

let updated = 0;
let skipped = 0;
for (const f of fs.readdirSync(STORES)) {
  if (!/\.html$/.test(f)) continue;
  const fp = path.join(STORES, f);
  let html = fs.readFileSync(fp, 'utf8');
  if (/og:image:alt/.test(html)) { skipped++; continue; }

  const titleMatch = html.match(/<title>([^（]+)（/);
  if (!titleMatch) { skipped++; continue; }
  const name = titleMatch[1].trim().replace(/"/g, '&quot;');
  const ogAlt = `<meta property="og:image:alt" content="${name} の店舗写真">`;
  const twAlt = `<meta name="twitter:image:alt" content="${name} の店舗写真">`;

  // og:image の直後に og:image:alt を、twitter:image の直後に twitter:image:alt を
  html = html.replace(
    /(<meta property="og:image" content="[^"]+">)/,
    `$1\n${ogAlt}`
  );
  html = html.replace(
    /(<meta name="twitter:image" content="[^"]+">)/,
    `$1\n${twAlt}`
  );
  fs.writeFileSync(fp, html);
  updated++;
}
console.log(`og:image:alt 追加: ${updated}件 / スキップ: ${skipped}件`);
