'use strict';
// SEO-121: sitemap.xml の lastmod を実際に内容が変わった日にすることの検査
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const L = require('../scripts/lib/sitemap_lastmod');

const ROOT = path.resolve(__dirname, '..');
const url = (loc, lastmod) => `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n    <changefreq>monthly</changefreq>\n  </url>`;
const sitemap = urls => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;

test('日付の正規化: 暦として正しい日付だけを通し、未来日は当日に丸める', () => {
  assert.strictEqual(L.normDate('2026-10-08T19:16:07Z'), '2026-10-08');
  assert.strictEqual(L.normDate('2026-02-30'), null);
  assert.strictEqual(L.normDate(''), null);
  assert.strictEqual(L.clampToday('2026-12-01', '2026-10-09'), '2026-10-09');
  assert.strictEqual(L.clampToday('2026-05-01', '2026-10-09'), '2026-05-01');
});

test('前回の sitemap から loc → lastmod を読む', () => {
  const m = L.readSitemapLastmods(sitemap([url('https://x/a.html', '2026-09-01'), url('https://x/b.html')]));
  assert.strictEqual(m.get('https://x/a.html'), '2026-09-01');
  assert.ok(!m.has('https://x/b.html'), 'lastmod の無い URL は入れない');
});

test('特集・記事: dateModified → datePublished → ファイル名の日付の順に使う', () => {
  assert.strictEqual(L.articleLastmod('{"datePublished":"2025-04-15","dateModified":"2026-05-25"}'), '2026-05-25');
  assert.strictEqual(L.articleLastmod('{"datePublished":"2025-04-15"}'), '2025-04-15');
  assert.strictEqual(L.articleLastmod('<p>日付なし</p>', '2026-10-08'), '2026-10-08');
  assert.strictEqual(L.articleLastmod('<p>日付なし</p>'), null, '取れなければ書かない（推測しない）');
});

test('監査: 全件同じ日・形式不正・未来日を検出し、ばらついた日付は通す', () => {
  const same = sitemap(Array.from({ length: 20 }, (_, i) => url(`https://x/${i}.html`, '2026-10-08')));
  const r = L.lastmodHealth(same, '2026-10-09');
  assert.strictEqual(r.singleDate, '2026-10-08');
  assert.strictEqual(r.ok, false);
  const mixed = sitemap([...Array.from({ length: 15 }, (_, i) => url(`https://x/${i}.html`, '2026-10-08')), url('https://x/f.html', '2026-05-25'), url('https://x/about.html')]);
  assert.strictEqual(L.lastmodHealth(mixed, '2026-10-09').ok, true);
  const bad = sitemap([url('https://x/a.html', '2026-13-01'), url('https://x/b.html', '2027-01-01'), url('https://x/c.html', '2026-10-01')]);
  const rb = L.lastmodHealth(bad, '2026-10-09');
  assert.deepStrictEqual(rb.invalid, ['https://x/a.html']);
  assert.deepStrictEqual(rb.future, ['https://x/b.html']);
  assert.strictEqual(L.lastmodHealth(sitemap([url('https://x/a.html', '2026-10-10')]), '2026-10-09').future.length, 0, '時差の1日は許す');
});

test('生成器: 店舗は渡した日付、特集は dateModified、一覧は配下の最大値を lastmod に書く', () => {
  const { buildSitemap } = require('../gen-store-pages');
  const xml = buildSitemap(['J000000001', 'J000000002'], new Map([['J000000001', '2026-09-01'], ['J000000002', '2026-10-01']]));
  const m = L.readSitemapLastmods(xml);
  assert.strictEqual(m.get('https://nagoya-bites.com/stores/J000000001.html'), '2026-09-01');
  assert.strictEqual(m.get('https://nagoya-bites.com/stores/J000000002.html'), '2026-10-01');
  assert.strictEqual(m.get('https://nagoya-bites.com/stores/'), '2026-10-01');
  const dateHtml = fs.readFileSync(path.join(ROOT, 'features/date.html'), 'utf8');
  assert.strictEqual(m.get('https://nagoya-bites.com/features/date.html'), L.articleLastmod(dateHtml));
  assert.ok(L.lastmodHealth(xml, new Date().toISOString().slice(0, 10)).distinctDates > 1, '全件同じ日にならない');
});

test('robots.txt は毎日更新される sitemap.xml を指し、止まった sitemap-news.xml を参照しない', () => {
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assert.match(robots, /^Sitemap: https:\/\/nagoya-bites\.com\/sitemap\.xml$/m);
  assert.ok(!fs.existsSync(path.join(ROOT, 'sitemap-news.xml')));
  assert.ok(!/sitemap-news/.test(fs.readFileSync(path.join(ROOT, 'sitemap-index.xml'), 'utf8')));
});
