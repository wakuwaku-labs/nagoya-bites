# 内部リンクの本数の集計（2026-11-16 追補）

- 目的: 現状監査（①D-5）で「未集計」だった、記事への内部リンクの本数を数える。読み取りだけ。
- 対象: `index.html`・`features/*.html`・`journal/*.html`・`stores/**/*.html`（`_template` を除く）。
- 数え方: HTML に書かれた `<a href>` のうち、サイト内の実在するページを指すもの。`<script>`・`<style>`・コメントの中は数えない。1ページから同じ先へのリンクは1本と数える（単位は「リンク元のページ数」）。**画面で後から描かれるリンク（トップの店カードなど）は含まない。**

## 結果

| 項目 | 特集（72本・一覧を除く） | 日次ジャーナル（193本） |
|---|---|---|
| ほかの記事からのリンク（中央値） | 7ページ | 1ページ |
| ほかの記事からのリンクが0 | 1本 | 96本（50%） |
| 店舗ページ・エリア一覧からのリンクが0 | 6本 | 62本（32%） |
| 記事の一覧を除くと、どこからもリンクが無い | 1本 | 44本（23%） |
| 一覧からも無い | 1本（`features/fathers-day-2026.html`） | 3本（04-23・05-20 の2本） |
| 記事から店舗ページへのリンク（中央値） | 10店 | 1店 |
| 店舗ページへのリンクが0 | 7本 | 54本（28%） |

- 店舗ページ 5,288本: ジャーナルの記事へリンクしているのは **180本（3.4%）**。特集へのリンクは中央値7本（全ページ共通の下部リンクを含む）。
- ジャーナルが店舗ページへリンクした店は 189店（139本の記事から）。そのうち **179店（95%）の店舗ページが、ジャーナルの記事へ戻るリンクを持つ**（記事で扱った店と記事の行き来は出来ている）。
- エリア一覧 805本: 記事へのリンクがあるのは 787本（同じく共通の下部リンクを含む）。
- トップ（HTML に書かれた部分）: エリア一覧 108本・特集 47本・店舗 5本・ジャーナル 3本。

## 取れなかったこと

- リンクが実際に押された回数（GA4 は 11-11 以降の直接流入の急増で使えない）。
- 「その店を扱った記事へのリンク」と「全ページ共通の下部リンク」の区別（特集について）。

## 道具

```js
'use strict';
// 読み取りだけ。記事（features・journal）への内部リンクを数える。
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2];
const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : (e.name.endsWith('.html') ? [path.join(d, e.name)] : []));
const pages = ['index.html', ...walk('features'), ...walk('journal'), ...walk('stores')].filter(p => !/_template/.test(p));
const kind = (p) => p === 'index.html' ? 'top' : p.startsWith('features/') ? (p === 'features/index.html' ? 'featIndex' : 'feature')
  : p.startsWith('journal/') ? (/journal\/(index|archive)/.test(p) ? 'jrnIndex' : 'journal')
  : p.startsWith('stores/area/') ? 'hub' : 'store';
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
const norm = (from, href) => {
  href = href.replace(/[#?].*$/, '');
  if (!href) return null;
  let m = href.match(/^https?:\/\/(?:www\.)?nagoya-bites\.com(\/.*)?$/);
  let p;
  if (m) p = (m[1] || '/').slice(1);
  else if (/^[a-z]+:/i.test(href) || href.startsWith('//')) return null;
  else if (href.startsWith('/')) p = href.slice(1);
  else p = path.posix.normalize(path.posix.join(path.posix.dirname(from), href));
  if (p === '' ) return 'index.html';
  if (p.endsWith('/')) p += 'index.html';
  if (!/\.html$/.test(p)) p += '.html';
  return p;
};
const inbound = {}; const outbound = {};
const set = new Set(pages);
for (const p of pages) {
  const h = strip(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const k = kind(p);
  const seen = new Set();
  for (const m of h.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const t = norm(p, m[1]);
    if (!t || t === p || !set.has(t) || seen.has(t)) continue;
    seen.add(t);
    const tk = kind(t);
    (outbound[p] = outbound[p] || {})[tk] = ((outbound[p] || {})[tk] || 0) + 1;
    if (tk === 'feature' || tk === 'journal') { (inbound[t] = inbound[t] || {})[k] = ((inbound[t] || {})[k] || 0) + 1; }
  }
}
const med = (a) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const out = {};
for (const K of ['feature', 'journal']) {
  const arts = pages.filter(p => kind(p) === K);
  const sum = (p, keys) => keys.reduce((s, k) => s + ((inbound[p] || {})[k] || 0), 0);
  const fromArticles = arts.map(p => sum(p, ['feature', 'journal']));
  const fromStores = arts.map(p => sum(p, ['store', 'hub']));
  const fromLists = arts.map(p => sum(p, ['top', 'featIndex', 'jrnIndex']));
  out[K] = {
    count: arts.length,
    inbound_from_other_articles: { median: med(fromArticles), zero: fromArticles.filter(n => n === 0).length, max: Math.max(...fromArticles) },
    inbound_from_store_or_hub_pages: { median: med(fromStores), zero: fromStores.filter(n => n === 0).length, max: Math.max(...fromStores) },
    inbound_from_top_or_index_lists: { zero: fromLists.filter(n => n === 0).length },
    no_inbound_except_lists: arts.filter((p, i) => fromArticles[i] === 0 && fromStores[i] === 0).length,
    no_inbound_at_all: arts.filter((p, i) => fromArticles[i] === 0 && fromStores[i] === 0 && fromLists[i] === 0).map(p => p),
    outbound_median: Object.fromEntries(['store', 'feature', 'journal', 'hub'].map(t => [t, med(arts.map(p => (outbound[p] || {})[t] || 0))])),
    outbound_zero_to_store: arts.filter(p => !((outbound[p] || {}).store)).length,
  };
  const top = arts.map((p, i) => [p, fromArticles[i] + fromStores[i]]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  out[K].top5_inbound = top;
}
const storePages = pages.filter(p => kind(p) === 'store');
out.store = { count: storePages.length, linking_to_journal: storePages.filter(p => (outbound[p] || {}).journal).length, feature_targets_median: med(storePages.map(p => (outbound[p] || {}).feature || 0)), linking_to_any_article: storePages.filter(p => (outbound[p] || {}).feature || (outbound[p] || {}).journal).length };
const hubs = pages.filter(p => kind(p) === 'hub');
out.hub = { count: hubs.length, linking_to_any_article: hubs.filter(p => (outbound[p] || {}).feature || (outbound[p] || {}).journal).length };
out.top = { to_feature: (outbound['index.html'] || {}).feature || 0, to_journal: (outbound['index.html'] || {}).journal || 0, to_store: (outbound['index.html'] || {}).store || 0, to_hub: (outbound['index.html'] || {}).hub || 0 };
console.log(JSON.stringify(out, null, 1));
```

使い方: `node internal_links_count.js <リポジトリの直下>`（何も書き換えない）。
