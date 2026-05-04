'use strict';
/**
 * inject_store_links.js
 *
 * index.html 内 var LOCAL_STORES を真正データとして、
 * エリア別の全店舗内部リンク集（section#store-index）と
 * SEO クロール用 noscript リスト（noscript#seo-store-list）を生成・差し込む。
 *
 * リンク先の決定：
 *   - stores/{ホットペッパーID}.html が存在 → そのページへ
 *   - 存在しない                            → index.html#q={店名} の検索ディープリンクへ
 *     （index.html 側の readHash() が #q=... を拾って検索を実行する）
 *
 * 冪等: マーカー <!-- STORE-INDEX:START --> / <!-- STORE-INDEX:END --> で囲まれたブロックを置換。
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const HTML_PATH  = path.join(ROOT, 'index.html');
const STORES_DIR = path.join(ROOT, 'stores');

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadLocalStores(html) {
  const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('var LOCAL_STORES が index.html に見つかりません');
  return JSON.parse(m[1]);
}

function loadDetailPageSet() {
  const set = new Set();
  if (!fs.existsSync(STORES_DIR)) return set;
  for (const f of fs.readdirSync(STORES_DIR)) {
    if (f.endsWith('.html') && f !== 'index.html') {
      set.add(f.slice(0, -5)); // strip .html
    }
  }
  return set;
}

function buildHrefFor(store, detailSet) {
  const id = store['ホットペッパーID'];
  if (id && detailSet.has(id)) {
    return `stores/${encodeURIComponent(id)}.html`;
  }
  // 検索ディープリンク：index.html 側の readHash() が #q=... を拾って applyFilters() する
  const name = store['店名'] || '';
  return `index.html#q=${encodeURIComponent(name)}`;
}

function groupByArea(stores) {
  const map = new Map();
  for (const s of stores) {
    if (s['公開フラグ'] === 'FALSE') continue;
    const key = (s['エリア'] || '').trim() || 'その他';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  // 主要エリアを上に：店舗数降順
  return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
}

function renderIndexBlock(grouped, total) {
  const today = new Date().toISOString().slice(0, 10);
  const detailSet = loadDetailPageSet();
  const sections = grouped.map(([area, list]) => {
    // エリア内は店名昇順（ロケール）
    const sorted = list.slice().sort((a, b) =>
      String(a['店名'] || '').localeCompare(String(b['店名'] || ''), 'ja')
    );
    const items = sorted.map(s => {
      const href  = buildHrefFor(s, detailSet);
      const name  = escapeHtml(s['店名'] || '(無名店)');
      const genre = s['ジャンル'] ? `・${escapeHtml(s['ジャンル'])}` : '';
      return `<li><a href="${href}">${name}（${escapeHtml(area)}${genre}）</a></li>`;
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
<p class="store-index-lead">各エリアをタップで展開。掲載全店舗のページへリンクします。</p>
${sections}
</section>
<!-- STORE-INDEX:END -->`;
}

function renderNoscriptBlock(stores, detailSet) {
  const items = stores
    .filter(s => s['公開フラグ'] !== 'FALSE')
    .map(s => {
      const href  = buildHrefFor(s, detailSet);
      const area  = s['エリア']  || '';
      const genre = s['ジャンル'] || '';
      const tail  = [area, genre].filter(Boolean).join(' ');
      const label = tail
        ? `${escapeHtml(s['店名'] || '')}（${escapeHtml(tail)}）`
        : escapeHtml(s['店名'] || '');
      return `<li><a href="${href}">${label}</a></li>`;
    }).join('\n');
  return `<noscript><ul id="seo-store-list">\n${items}\n</ul></noscript>`;
}

function main() {
  let html = fs.readFileSync(HTML_PATH, 'utf8');
  const stores = loadLocalStores(html);
  const visibleStores = stores.filter(s => s['公開フラグ'] !== 'FALSE');
  console.log(`LOCAL_STORES から ${stores.length} 件読込（公開 ${visibleStores.length} 件）`);

  const detailSet = loadDetailPageSet();
  const detailHits = visibleStores.filter(s => s['ホットペッパーID'] && detailSet.has(s['ホットペッパーID'])).length;
  console.log(`詳細ページ stores/*.html: ${detailSet.size} 件（うち LOCAL_STORES 一致 ${detailHits} 件）`);

  const grouped    = groupByArea(visibleStores);
  const storeIndex = renderIndexBlock(grouped, visibleStores.length);
  const noscript   = renderNoscriptBlock(visibleStores, detailSet);

  // 1. noscript の seo-store-list を置換
  const noscriptRe = /<noscript><ul id="seo-store-list">[\s\S]*?<\/ul><\/noscript>/;
  if (noscriptRe.test(html)) {
    html = html.replace(noscriptRe, noscript);
    console.log('noscript#seo-store-list を置換しました');
  } else {
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
  console.log(`index.html を更新完了（合計 ${visibleStores.length} 件の内部リンクを埋め込み）`);
}

main();
