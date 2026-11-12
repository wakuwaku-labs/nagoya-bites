'use strict';
// P3-21: sitemap-images.xml の生成と、lastmod の指紋（機械的な差で更新日を動かさない）の検査
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../scripts/lib/image_sitemap');
const L = require('../scripts/lib/sitemap_lastmod');

const B = 'https://nagoya-bites.com';
const sm = `<urlset><url><loc>${B}/</loc></url><url><loc>${B}/stores/A.html</loc></url><url><loc>${B}/stores/B.html</loc></url>
<url><loc>${B}/stores/C.html</loc></url><url><loc>${B}/stores/D.html</loc></url><url><loc>${B}/stores/area/x.html</loc></url>
<url><loc>${B}/features/f.html</loc></url><url><loc>${B}/journal/j.html</loc></url><url><loc>${B}/stores/GONE.html</loc></url></urlset>`;
const og = u => `<meta property="og:image" content="${u}">`;
const pages = {
  'stores/A.html': og('https://imgfp.hotp.jp/IMGH/1/a.jpg'),
  'stores/B.html': og('https://lh3.googleusercontent.com/grass-cs/xyz=s1600'),
  'stores/C.html': og('https://nagoya-bites.com/icons/icon-512.png'),
  'stores/D.html': og('https://wsrv.nl/?url=a&amp;output=png'),
  'features/f.html': og('https://imgfp.hotp.jp/IMGH/2/f.jpg'),
};

test('画像 sitemap: sitemap.xml の店舗・特集だけ。Places・共通アイコン・存在しないページは載せない', () => {
  const r = I.buildImageSitemap(sm, rel => (rel in pages ? pages[rel] : null));
  assert.deepStrictEqual(r.entries.map(e => e.loc), [`${B}/stores/A.html`, `${B}/stores/D.html`, `${B}/features/f.html`]);
  assert.deepStrictEqual(r.skipped, { noPage: 1, noImage: 0, places: 1, generic: 1, notHttps: 0 });
  assert.ok(!/googleusercontent|places\.googleapis/.test(r.xml));
  assert.ok(r.xml.includes('url=a&amp;output=png') && !r.xml.includes('&amp;amp;'), '& は1回だけエスケープする');
});

test('画像 sitemap: 同じ入力なら同じ出力（べき等）', () => {
  const f = rel => (rel in pages ? pages[rel] : null);
  assert.strictEqual(I.buildImageSitemap(sm, f).xml, I.buildImageSitemap(sm, f).xml);
});

test('公開されている sitemap-images.xml: Places を含まず、sitemap.xml に無いページを含まない', () => {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'sitemap-images.xml'), 'utf8');
  const smx = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
  assert.ok(!/googleusercontent\.com|places\.googleapis\.com/.test(xml));
  const locs = new Set([...smx.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
  const bad = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map(m => m[1]).filter(l => !locs.has(l));
  assert.deepStrictEqual(bad, []);
});

test('lastmod の指紋: 取得日・クレジット・計測 script・Places URL だけの差は同じ、中身の差は違う', () => {
  const base = '<p class="trust-meta-line">検証 3/9項目 ・ Google口コミ取得日 2026-11-11</p><h1>店</h1><img src="https://lh3.googleusercontent.com/a=s1">';
  const mech = '<p class="trust-meta-line">検証 3/9項目 ・ Google口コミ取得日 2026-11-12</p><h1>店</h1><img src="https://lh3.googleusercontent.com/b=s2">'
    + '<p class="nb-footer-credit">Powered by <a href="x">HP</a></p>\n<script defer src="../assets/js/store-link-tracking.js"></script>\n';
  assert.strictEqual(L.lastmodFingerprint(base), L.lastmodFingerprint(mech));
  assert.notStrictEqual(L.lastmodFingerprint(base), L.lastmodFingerprint(base.replace('<h1>店</h1>', '<h1>別の店</h1>')));
  assert.notStrictEqual(L.lastmodFingerprint(base), L.lastmodFingerprint(base.replace('3/9項目', '4/9項目')));
});

// 2026-10-15 に画像 sitemap が止まったのは、作る処理が毎日のビルドに乗っていなかったため。
// 生成の手順と、生成物のコミットが build.yml から外れたら落とす（項目20 の構造化データの手順も同じ）
test('毎日のビルドが画像 sitemap と構造化データの画像を作り直し、コミットする', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/build.yml'), 'utf8');
  assert.match(yml, /run: node scripts\/gen_image_sitemap\.js/);
  assert.match(yml, /run: node scripts\/apply_schema_image\.js/);
  const addLine = yml.split('\n').find((l) => /git add index\.html /.test(l));
  assert.ok(addLine && /\bsitemap-images\.xml\b/.test(addLine), 'sitemap-images.xml が git add に無い');
  assert.ok(yml.indexOf('gen_image_sitemap.js') > yml.indexOf('gen_area_genre_pages.js'), 'sitemap.xml が確定する前に画像 sitemap を作っている');
});
