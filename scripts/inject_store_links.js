'use strict';
/**
 * inject_store_links.js
 *
 * index.html 内 var LOCAL_STORES を真正データとして、
 * エリア別の全店舗内部リンク集（section#store-index）と
 * シーン/エリア/ジャンル特集への発見導線（section#scene-index）を生成・差し込む。
 *
 * リンク先の決定：
 *   - stores/{ホットペッパーID}.html が存在 → そのページへ
 *   - 存在しない                            → index.html#q={店名} の検索ディープリンクへ
 *     （index.html 側の readHash() が #q=... を拾って検索を実行する）
 *
 * 冪等: マーカー <!-- STORE-INDEX:START --> / <!-- STORE-INDEX:END --> で囲まれたブロックを置換。
 *       <!-- SCENE-INDEX:START --> / <!-- SCENE-INDEX:END --> も同様。
 *
 * ── noscript#seo-store-list を廃止した理由（SEO-048 / 2026-08-05 GSC 実測）──
 *   かつて同じ 5,017 店を noscript リストにも重複出力していたが、
 *     ・href は section#store-index と完全に同一 → クロール上の増分ゼロ
 *     ・トップページ本文に店名 5,017 件が載る → `/` が全店の指名検索に出てしまう
 *   実測（2026-07-08〜08-04 GSC）: `/` は 表示2,326 / 掲載順位25.2 / CTR 0.6%。
 *   出ているクエリは「bar & kitchen life size」等ほぼ全部が店名の指名検索で、
 *   同じクエリで stores/*.html は 8〜10位・CTR 1.5〜2.5%。つまりトップページが
 *   自社の店舗ページを共食い（cannibalize）しながら、自身は 26位で取りこぼしていた。
 *   さらに 415KB（index.html の 36%）を占め、クリックの74%を占めるモバイルの
 *   初期表示を重くしていた。よって生成を止め、既存ブロックは除去する。
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

// ISSUE-015-P2 第二段: data/stores.json を canonical として読込、無ければ index.html フォールバック
const { loadStores: _loadStoresShared } = require('./lib/load_stores');
function loadLocalStores(_html) {
  return _loadStoresShared();
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
    return `<details class="store-index-area" data-area="${escapeHtml(area)}">
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

// ── 発見導線（シーン / エリア / ジャンル特集）──────────────────────────
// data/journal_seo_keywords.json を唯一の情報源にする。同ファイルの KW は
// scripts/journal_seo_kw.js --verify で「特集ファイルが実在し、そのタイトルに
// その語が実際に使われている」ことを機械検証済み（自己申告値を使わない担保）。
// ここで生成するのは、トップページから discovery 意図（シーン語×エリア語）の
// 特集へ渡す静的な内部リンク。指名検索ではなく取りに行く面を厚くするのが目的。
function renderSceneIndexBlock() {
  const kwPath = path.join(ROOT, 'data', 'journal_seo_keywords.json');
  if (!fs.existsSync(kwPath)) return null;
  const kw = JSON.parse(fs.readFileSync(kwPath, 'utf8'));

  const groups = [
    ['シーンで探す',   kw.scenes || []],
    ['エリアで探す',   kw.areas  || []],
    ['ジャンルで探す', kw.genres || []],
  ];

  const rendered = groups.map(([label, list]) => {
    const items = list
      // 実在する特集ファイルにしかリンクしない（リンク切れをビルド時に防ぐ）
      .filter(x => x.feature && fs.existsSync(path.join(ROOT, x.feature)))
      .map(x => `<li><a href="${escapeHtml(x.feature)}">名古屋の${escapeHtml(x.kw)}</a></li>`);
    if (!items.length) return '';
    return `<div class="scene-index-group">
<h3 class="scene-index-group-title">${escapeHtml(label)}</h3>
<ul class="scene-index-list">
${items.join('\n')}
</ul>
</div>`;
  }).filter(Boolean).join('\n');

  if (!rendered) return null;

  return `<!-- SCENE-INDEX:START -->
<section id="scene-index" class="scene-index" aria-label="目的から探す">
<h2 class="scene-index-title">目的から探す</h2>
<p class="scene-index-lead">シーン・エリア・ジャンルごとに、現役の飲食店経営者が選び直した特集をまとめています。</p>
${rendered}
</section>
<!-- SCENE-INDEX:END -->`;
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

  // 1. 旧 noscript#seo-store-list を除去（冪等・ファイル冒頭の廃止理由コメント参照）
  const noscriptRe = /\s*<noscript><ul id="seo-store-list">[\s\S]*?<\/ul><\/noscript>/;
  const legacy = html.match(noscriptRe);
  if (legacy) {
    html = html.replace(noscriptRe, '');
    console.log(`旧 noscript#seo-store-list を除去しました（${Math.round(legacy[0].length / 1024)}KB 削減）`);
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

  // 3. 発見導線（section#scene-index）を store-index の直前に挿入／置換
  const sceneIndex = renderSceneIndexBlock();
  if (sceneIndex) {
    const sceneRe = /<!-- SCENE-INDEX:START -->[\s\S]*?<!-- SCENE-INDEX:END -->/;
    if (sceneRe.test(html)) {
      html = html.replace(sceneRe, sceneIndex);
      console.log('section#scene-index を置換しました');
    } else {
      html = html.replace('<!-- STORE-INDEX:START', sceneIndex + '\n\n<!-- STORE-INDEX:START');
      console.log('section#scene-index を store-index の直前に挿入しました');
    }
  } else {
    console.warn('data/journal_seo_keywords.json が読めず、scene-index をスキップ');
  }

  fs.writeFileSync(HTML_PATH, html, 'utf8');
  console.log(`index.html を更新完了（合計 ${visibleStores.length} 件の内部リンクを埋め込み）`);
}

main();
