'use strict';
/**
 * inject_store_links.js
 *
 * stores/*.html を読み、index.html にエリア別の内部リンク集を挿入する。
 *
 * 目的：
 *   - 既存の <noscript><ul id="seo-store-list">…</ul></noscript>（全リンクがトップページを指す不具合）を
 *     正しい stores/{slug}.html を指す正規リンクに置き換える
 *   - さらに可視（<details> で折り畳み）な <section id="store-index"> をフッター直前に挿入し、
 *     1,095 店舗すべてに対して index.html から内部リンクで PageRank を伝搬させる
 *
 * 冪等: マーカー <!-- STORE-INDEX:START --> / <!-- STORE-INDEX:END --> で囲まれたブロックを置換。
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const HTML_PATH  = path.join(ROOT, 'index.html');
const STORES_DIR = path.join(ROOT, 'stores');

// <title>居酒屋 きくや（栄・居酒屋）| NAGOYA BITES</title>
const RE_TITLE = /<title>([^<]+?)<\/title>/;

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseStorePage(filePath) {
  const slug = path.basename(filePath, '.html');
  const data = fs.readFileSync(filePath, 'utf8');
  const m = RE_TITLE.exec(data);
  if (!m) return null;
  const title = decodeEntities(m[1]).trim();
  // 期待形式: "店名（エリア・ジャンル）| NAGOYA BITES"
  // 例外形式はそのまま名前として扱う
  let name = title, area = '', genre = '';
  const mm = /^(.+?)（([^・）]+)・([^）]+)）\s*\|\s*NAGOYA BITES\s*$/.exec(title);
  if (mm) {
    name  = mm[1].trim();
    area  = mm[2].trim();
    genre = mm[3].trim();
  } else {
    // フォールバック: " | NAGOYA BITES" を取り除いて店名扱い
    name = title.replace(/\s*\|\s*NAGOYA BITES\s*$/, '').trim();
  }
  return { slug, name, area, genre };
}

function collectStores() {
  const files = fs.readdirSync(STORES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .sort();
  const out = [];
  for (const f of files) {
    const s = parseStorePage(path.join(STORES_DIR, f));
    if (s) out.push(s);
  }
  return out;
}

function groupByArea(stores) {
  const map = new Map();
  for (const s of stores) {
    const key = s.area || 'その他';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  // 各エリア内は店名の50音順ではなく、現状のファイル名（HP IDまたは英語名）順でOK
  // キーは店舗数降順 → 主要エリアを上に
  return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
}

function renderIndexBlock(grouped, total) {
  const today = new Date().toISOString().slice(0, 10);
  const sections = grouped.map(([area, list]) => {
    const items = list.map(s => {
      const labelArea  = s.area  ? `（${escapeHtml(s.area)}` : '';
      const labelGenre = s.genre ? `・${escapeHtml(s.genre)}）` : (s.area ? '）' : '');
      return `<li><a href="stores/${encodeURIComponent(s.slug)}.html">${escapeHtml(s.name)}${labelArea}${labelGenre}</a></li>`;
    }).join('\n');
    return `<details class="store-index-area">
<summary>${escapeHtml(area)}（${list.length}店）</summary>
<ul class="store-index-list">
${items}
</ul>
</details>`;
  }).join('\n');

  return `<!-- STORE-INDEX:START ${today} -->
<section id="store-index" class="store-index" aria-label="エリア別 全店舗一覧">
<h2 class="store-index-title">エリア別 全店舗一覧（${total}店）</h2>
<p class="store-index-lead">各エリアをタップで展開。掲載全店舗の詳細ページへリンクします。</p>
${sections}
</section>
<!-- STORE-INDEX:END -->`;
}

function renderNoscriptBlock(stores) {
  // 既存の <noscript><ul id="seo-store-list">…</ul></noscript> を正しいリンクで再生成
  const items = stores.map(s => {
    const areaGenre = [s.area, s.genre].filter(Boolean).join(' ');
    const label = areaGenre ? `${escapeHtml(s.name)}（${escapeHtml(areaGenre)}）` : escapeHtml(s.name);
    return `<li><a href="stores/${encodeURIComponent(s.slug)}.html">${label}</a></li>`;
  }).join('\n');
  return `<noscript><ul id="seo-store-list">\n${items}\n</ul></noscript>`;
}

function main() {
  const stores = collectStores();
  if (stores.length === 0) {
    console.error('stores/ 配下に店舗ページが見つかりませんでした。');
    process.exit(1);
  }
  console.log(`店舗ページ ${stores.length} 件を検出`);

  const grouped    = groupByArea(stores);
  const storeIndex = renderIndexBlock(grouped, stores.length);
  const noscript   = renderNoscriptBlock(stores);

  let html = fs.readFileSync(HTML_PATH, 'utf8');

  // 1. noscript の seo-store-list を置換
  const noscriptRe = /<noscript><ul id="seo-store-list">[\s\S]*?<\/ul><\/noscript>/;
  if (noscriptRe.test(html)) {
    html = html.replace(noscriptRe, noscript);
    console.log('noscript#seo-store-list を置換しました');
  } else {
    // 無ければ #grid の直前に挿入（属性順を問わず）
    const gridRe = /<div\b[^>]*id=["']grid["'][^>]*>/;
    if (gridRe.test(html)) {
      html = html.replace(gridRe, function(m){ return noscript + '\n' + m; });
      console.log('noscript#seo-store-list を新規挿入しました');
    } else {
      console.warn('grid 要素が見つからず、noscript の新規挿入をスキップ');
    }
  }

  // 2. store-index ブロックを <footer> 直前に挿入／置換
  const indexRe = /<!-- STORE-INDEX:START[^>]*-->[\s\S]*?<!-- STORE-INDEX:END -->/;
  if (indexRe.test(html)) {
    html = html.replace(indexRe, storeIndex);
    console.log('section#store-index を置換しました');
  } else if (html.includes('<footer>')) {
    html = html.replace('<footer>', storeIndex + '\n\n<footer>');
    console.log('section#store-index を <footer> 直前に挿入しました');
  } else {
    html = html.replace('</body>', storeIndex + '\n</body>');
    console.log('section#store-index を </body> 直前に挿入しました');
  }

  fs.writeFileSync(HTML_PATH, html, 'utf8');
  console.log(`index.html を更新完了（合計 ${stores.length} 件の内部リンクを埋め込み）`);
}

main();
