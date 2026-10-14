'use strict';
// 失効した Places 写真の除去（P-29）。ネットワークにも生成済みページにも触れない（fixture のみ）。
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../scripts/lib/expired_place_photos');
const gate = require('../scripts/lib/hero_photo_gate');

const DEAD = 'https://lh3.googleusercontent.com/place-photos/AAAA=s1600-w1200';
const LIVE = 'https://lh3.googleusercontent.com/place-photos/BBBB=s1600-w1200';
const HP = 'https://imgfp.hotp.jp/IMGH/1/2/P1/P1_480.jpg';
const dead = new Set([DEAD]);

test('特集カード: 失効は同じ店の写真に差し替え、無ければ要素ごと外す', () => {
  const html = `<div class="shop-card">\n  <img class="shop-card-photo" src="${DEAD}" alt="店A" loading="lazy">\n  <h3>店A</h3></div>`;
  const a = lib.repairHtml(html, { kind: 'features', dead, resolve: (n) => (n === '店A' ? HP : null) });
  assert.ok(a.html.includes(`src="${HP}"`));
  const b = lib.repairHtml(html, { kind: 'features', dead, resolve: () => null });
  assert.ok(!b.html.includes('shop-card-photo'));
  assert.ok(b.html.includes('<h3>店A</h3>'));
});

test('生きている URL は触らない・冪等', () => {
  const html = `<img class="shop-card-photo" src="${LIVE}" alt="店B">`;
  const r = lib.repairHtml(html, { kind: 'features', dead, resolve: () => HP });
  assert.strictEqual(r.html, html);
  assert.deepStrictEqual(r.changes, []);
  const d = `<img class="shop-card-photo" src="${DEAD}" alt="店B">`;
  const once = lib.repairHtml(d, { kind: 'features', dead, resolve: () => null }).html;
  assert.deepStrictEqual(lib.repairHtml(once, { kind: 'features', dead, resolve: () => null }).changes, []);
});

test('店舗ページ: og/twitter は既定画像、JSON-LD は有効なまま、hero は既定図', () => {
  const html = `<meta property="og:image" content="${DEAD}">
<meta name="twitter:image" content="${DEAD}">
<script type="application/ld+json">
{
  "name": "x",
  "image": "${DEAD}"
}
</script>
<script type="application/ld+json">
{
  "image": "${DEAD}",
  "name": "y"
}
</script>
<img class="hero-img" src="${DEAD}" alt="店C" loading="eager">`;
  const r = lib.repairHtml(html, { kind: 'stores', dead, resolve: () => null });
  assert.ok(!r.html.includes('place-photos'));
  assert.ok(r.html.includes(lib.DEFAULT_OG));
  assert.ok(r.html.includes('og:image:width" content="512"'));
  assert.deepStrictEqual(lib.jsonLdValid(r.html), []);
  assert.ok(r.html.includes(lib.FALLBACK_FIGURE));
});

test('ジャーナルのヒーロー: 差し替えできなければ figure を外して印を残し、judgePhoto は警告に留める', () => {
  const html = `<meta property="og:image" content="${DEAD}">
<figure class="art-hero-img" data-hero-source="places" data-hero-store="店D">
  <img src="${DEAD}" alt="題">
  <figcaption class="art-img-credit">写真</figcaption>
</figure>`;
  const r = lib.repairHtml(html, { kind: 'journal', dead, resolve: () => null });
  assert.ok(!r.html.includes('art-hero-img'));
  assert.ok(r.html.includes(lib.HERO_EXPIRED_MARK));
  const hero = gate.extractHeroFromHtml(r.html, '2026-09-14-x', '2026-09-14');
  assert.strictEqual(hero.heroExpired, true);
  const j = gate.judgePhoto(hero);
  assert.strictEqual(j.ok, true);
});

test('sitemap-images.xml: 失効 URL の image ブロックだけ外す', () => {
  const xml = `<url><loc>a</loc>\n    <image:image>\n      <image:loc>${DEAD}</image:loc>\n    </image:image>\n  </url>\n<url><loc>b</loc>\n    <image:image>\n      <image:loc>${LIVE}</image:loc>\n    </image:image>\n  </url>`;
  const r = lib.repairSitemapImages(xml, dead);
  assert.strictEqual(r.removed, 1);
  assert.ok(r.xml.includes(LIVE) && !r.xml.includes('AAAA'));
});
