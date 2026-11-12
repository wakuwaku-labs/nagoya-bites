'use strict';
/**
 * scripts/lib/image_sitemap.js — sitemap-images.xml を sitemap.xml から作る部品（P3-21）
 *
 * 旧実装は build_features.js の末尾（CI では動かない旧スクリプト）で、2026-10-15 の手動実行を最後に止まっていた。
 * そのため存在しないページの行が残り、新しい店舗ページは入らなかった。
 * 今は sitemap.xml（正本）に載っている店舗・特集ページの og:image から、毎日の生成の流れで作る。
 *   ・載せるページ = sitemap.xml の /stores/<ID>.html と /features/*.html（選び方は sitemap.xml に従う）
 *   ・載せる画像   = そのページの og:image。絶対 URL の https のみ
 *   ・載せない画像 = Google Places の写真 URL（判断記録 0045・失効するため）、サイト共通のアイコン・代替図
 * ネットワーク不要・決定的（同じ入力なら同じ出力）。
 */
const fs = require('fs');
const path = require('path');
const { isPlacesPhotoUrl } = require('./places_photo_url');

const BASE_URL = 'https://nagoya-bites.com';

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function extractOgImage(html) {
  const m = String(html || '').match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  return m ? m[1].replace(/&amp;/g, '&') : '';
}

/** サイト共通のアイコン・代替図は、その店・記事の画像ではないので載せない */
function isGenericImage(url) {
  return /\/icons\/icon-\d+\.png$/i.test(url) || /_fallback\.svg$/i.test(url);
}

/** sitemap.xml から画像 sitemap の対象ページ（店舗・特集）の loc を順に返す */
function targetLocs(sitemapXml) {
  const out = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(String(sitemapXml || '')))) {
    const loc = m[1].trim();
    if (loc.startsWith(`${BASE_URL}/stores/`) && /\/stores\/[^/]+\.html$/.test(loc)) out.push(loc);
    else if (/^https:\/\/nagoya-bites\.com\/features\/[^/]+\.html$/.test(loc)) out.push(loc);
  }
  return out;
}

/**
 * @param {string} sitemapXml sitemap.xml の中身
 * @param {(relPath:string)=>string|null} readPage 公開ページの HTML を返す（無ければ null）
 */
function buildImageSitemap(sitemapXml, readPage) {
  const entries = [];
  const skipped = { noPage: 0, noImage: 0, places: 0, generic: 0, notHttps: 0 };
  for (const loc of targetLocs(sitemapXml)) {
    const html = readPage(loc.slice(BASE_URL.length + 1));
    if (html == null) { skipped.noPage++; continue; }
    const img = extractOgImage(html);
    if (!img) { skipped.noImage++; continue; }
    if (isPlacesPhotoUrl(img)) { skipped.places++; continue; }
    if (isGenericImage(img)) { skipped.generic++; continue; }
    if (!/^https:\/\//.test(img)) { skipped.notHttps++; continue; }
    entries.push({ loc, image: img });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.map(e => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <image:image>
      <image:loc>${escapeXml(e.image)}</image:loc>
    </image:image>
  </url>`).join('\n')}
</urlset>
`;
  return { xml, entries, skipped };
}

function readPageFromRoot(root) {
  return rel => {
    try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch (_) { return null; }
  };
}

module.exports = { buildImageSitemap, targetLocs, extractOgImage, isGenericImage, readPageFromRoot, escapeXml };
