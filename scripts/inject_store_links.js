'use strict';
/**
 * inject_store_links.js
 *
 * index.html のトップページに、検索エンジンと読者のための「入口」の区画を生成・差し込む。
 *   ・section#store-index   … エリア別の店舗一覧ページ（stores/area/ のハブ）への入口。
 *                              同じ区画の中に、カードの題名を店舗ページへつなぐ例外の表（NB_STORE_PAGES）も書く
 *   ・section#scene-index   … シーン/エリア/ジャンル特集への発見導線
 *   ・ItemList の JSON-LD   … トップの構造化データの店の一覧。1 本だけ・URL は実在する店舗ページ
 *
 * ── 全店の索引をやめた理由（I-25・判断の記録 0039）──
 *   かつて section#store-index には掲載全店（5,005 店）の店舗ページへのリンクを 1 本ずつ書いていた。
 *   トップの HTML 1.32MB のうち 718KB（54%）で、店舗ページへの入口は GSC で見ても検索から使われていなかった。
 *   エリア×ジャンルの一覧ページ（ハブ）は、1 ページに最大 592 店の店舗ページへのリンクを持つ。
 *   トップからは ハブ（2026-10 時点で エリア 10 + エリア×ジャンル 90 + 入口 1）にリンクすれば、店舗ページへはハブを 1 つはさんで届く。
 *   トップに店のリンクを並べ直すことはしない（全店 5,005 本のリンクが戻ると、また重くなる）。
 *
 * リンク先の決定（店舗ページの href の組み立て）:
 *   - 現役の stores/{ホットペッパーID}.html が存在 → そのページへ
 *   - 誘導ページなら、その誘導先が現役ページのときだけ直接リンク
 *   - どちらも無い                            → index.html#q={店名} の検索ディープリンク
 *   この規則（buildHrefFor）は、カードの店舗ページへのリンクの例外の表と ItemList の URL が使う。
 *
 * 冪等: マーカー <!-- STORE-INDEX:START --> / <!-- STORE-INDEX:END --> で囲まれたブロックを置換。
 *       <!-- SCENE-INDEX:START --> / <!-- SCENE-INDEX:END -->、<!-- STORE-ITEMLIST:START --> / <!-- STORE-ITEMLIST:END --> も同様。
 *
 * ── noscript#seo-store-list を廃止した理由（SEO-050 / 2026-08-05 GSC 実測）──
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
const { isRedirectStub, stubTarget } = require('./lib/store_orphans');

const ROOT       = path.join(__dirname, '..');
const HTML_PATH  = path.join(ROOT, 'index.html');
const SITE_ORIGIN = 'https://nagoya-bites.com';

// トップの ItemList に載せる店の数。トップに最初から埋め込んである店（LOCAL_STORES・先頭 50 件）と同じ数にする
const ITEMLIST_MAX = 50;

// 店のホットペッパーID として組み立てに使ってよい文字。index.html の nbStoreHref の検査と同じ形にそろえる
const STORE_ID_RE = /^[A-Za-z0-9_-]+$/;

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

function loadDetailPageSet(root = ROOT) {
  const dir = path.join(root, 'stores');
  const active = new Set();
  const redirects = new Map();
  if (!fs.existsSync(dir)) return { active, redirects };
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.html') && f !== 'index.html') {
      const slug = f.slice(0, -5); // strip .html
      const html = fs.readFileSync(path.join(dir, f), 'utf8');
      if (isRedirectStub(html)) redirects.set(slug, stubTarget(html));
      else active.add(slug);
    }
  }
  return { active, redirects };
}

function buildHrefFor(store, detailPages) {
  const id = store['ホットペッパーID'];
  if (id && detailPages.active.has(id)) {
    return `stores/${encodeURIComponent(id)}.html`;
  }
  if (id && detailPages.redirects.has(id)) {
    const target = detailPages.redirects.get(id);
    if (target && detailPages.active.has(target)) {
      return `stores/${encodeURIComponent(target)}.html`;
    }
  }
  // 検索ディープリンク：index.html 側の readHash() が #q=... を拾って applyFilters() する
  const name = store['店名'] || '';
  return `index.html#q=${encodeURIComponent(name)}`;
}

/** buildHrefFor の結果が店舗ページ（stores/….html）のときだけ、そのスラグ（デコード済み）を返す。検索ディープリンクなら null */
function storePageSlug(href) {
  const m = String(href).match(/^stores\/([^#?/]+)\.html$/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch (e) { return null; }
}

// ── エリア別の店舗一覧ページ（ハブ）への入口 ─────────────────────────────
// 唯一の情報源は data/area_genre_pages_manifest.json（scripts/gen_area_genre_pages.js の生成物）と
// data/area_genre_pages_policy.json（エリア・ジャンルの名前）。
// 載せるのは「active のハブで、ファイルが実在するもの」だけ（閾値割れの stub・まだ書かれていないハブにはリンクしない）。
// 条件（個室あり・深夜営業など）のハブは載せない: ジャンルのハブから辿れ、ジャンルのハブが持つ店のリンクの部分集合なので、
// トップに並べても店舗ページへの入口は増えない（実測は判断の記録 0039）。
function loadHubManifest(root = ROOT) {
  const p = path.join(root, 'data', 'area_genre_pages_manifest.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

/** ハブのリンク文。エリアのハブは「{エリア}の飲食店」（そのページの見出しと同じ）、ジャンルのハブは「{エリア}の{ジャンル}」 */
function hubLinkText(kind, area, genre) {
  return kind === 'area' ? `${area.label}の飲食店` : `${area.label}の${genre.label}`;
}

/**
 * トップに載せるハブのリンクを決める（純粋関数）。
 * @param {{manifest:object|null, policy:object|null, exists:(rel:string)=>boolean}} deps
 * @returns {{root:object|null, areas:Array<{slug,label,path,count,genres:Array<{slug,label,path,count,text}>}>, skipped:number}}
 *   areas は店の多い順。ジャンルも店の多い順（同数ならポリシーの並び）
 */
function planHubLinks({ manifest, policy, exists }) {
  const empty = { root: null, areas: [], skipped: 0 };
  if (!manifest || !Array.isArray(manifest.pages) || !policy) return empty;
  const live = (p) => p && p.status === 'active' && typeof p.path === 'string' && exists(p.path);
  const order = (list) => new Map(list.map((x, i) => [x.slug, i]));
  const areaOrder = order(policy.areas || []);
  const genreOrder = order(policy.genres || []);
  const byCount = (orderMap) => (a, b) => (b.count || 0) - (a.count || 0) || (orderMap.get(a.slug) - orderMap.get(b.slug));

  let skipped = 0;
  const rootPage = manifest.pages.find((p) => p.type === 'root' && live(p)) || null;
  const areas = [];
  for (const p of manifest.pages) {
    if (p.type !== 'area' || !live(p)) continue;
    const m = p.path.match(/^stores\/area\/([^/]+)\/index\.html$/);
    const area = m && (policy.areas || []).find((a) => a.slug === m[1]);
    if (!area) { skipped++; continue; }
    areas.push({ slug: area.slug, label: area.label, path: p.path, count: p.count || 0, genres: [] });
  }
  for (const p of manifest.pages) {
    if (p.type !== 'genre' || !live(p)) continue;
    const m = p.path.match(/^stores\/area\/([^/]+)\/([^/]+)\.html$/);
    const area = m && areas.find((a) => a.slug === m[1]);
    const genre = m && (policy.genres || []).find((g) => g.slug === m[2]);
    if (!area || !genre) { skipped++; continue; }
    area.genres.push({ slug: genre.slug, label: genre.label, path: p.path, count: p.count || 0, text: hubLinkText('genre', { label: area.label }, genre) });
  }
  areas.sort(byCount(areaOrder));
  for (const a of areas) a.genres.sort(byCount(genreOrder));
  return { root: rootPage ? { path: rootPage.path } : null, areas, skipped };
}

function renderStoreIndexBlock(plan) {
  const sections = plan.areas.map((a) => {
    // 件数「（N軒）」は 1 つの span に入れる（折り返しのとき「（93」と「軒）」に割れない。リンク文の全体は変わらない）
    const item = (href, text, count) => `<li><a href="${escapeHtml(href)}">${escapeHtml(text)}<span class="store-index-n">（${count}軒）</span></a></li>`;
    const items = [
      item(a.path, hubLinkText('area', a), a.count),
      ...a.genres.map((g) => item(g.path, g.text, g.count)),
    ].join('\n');
    return `<details class="store-index-area">
<summary><span class="store-index-name">${escapeHtml(a.label)}</span><span class="store-index-count">${a.count}軒</span></summary>
<ul class="store-index-list">
${items}
</ul>
</details>`;
  }).join('\n');
  const more = plan.root
    ? `\n<p class="store-index-more"><a href="${escapeHtml(plan.root.path)}">エリア×ジャンルをすべて見る →</a></p>`
    : '';
  return `<section id="store-index" class="store-index" aria-label="エリア別 店舗一覧">
<h2 class="store-index-title">エリア別 店舗一覧</h2>
<p class="store-index-lead">エリアをタップすると、ジャンル別の店舗一覧ページへのリンクが開きます。</p>
${sections}${more}
</section>`;
}

// ── カードの題名の店舗ページへのリンク（index.html の nbStoreHref が読む表）─────────────
// 店舗ページの href は、店のホットペッパーID から stores/<ID>.html と組み立てる（ID が無い店はリンクを付けない）。
// 例外だけをここで表にする:
//   none … ID はあるが現役の店舗ページが無い店（リンクを付けない）
//   to   … 誘導ページ（古い ID）を経て別の ID の現役ページへ移った店（移り先のスラグ）
// 全店が自分の ID の現役ページを持つ日は、どちらも空になる。
function buildStorePageTable(stores, detailPages) {
  const none = {};
  const to = {};
  for (const s of stores) {
    const id = s['ホットペッパーID'];
    if (!id || !STORE_ID_RE.test(id)) continue;
    const slug = storePageSlug(buildHrefFor(s, detailPages));
    if (slug === null) none[id] = 1;
    else if (slug !== id) to[id] = slug;
  }
  const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  return { none: sorted(none), to: sorted(to) };
}

function renderStorePagesScript(table) {
  return `<script>var NB_STORE_PAGES = ${JSON.stringify(table).replace(/</g, '\\u003c')};</script>`;
}

// ── ItemList（構造化データ）──────────────────────────────────────────────
// トップの ItemList はここで 1 本だけ書く。以前は、静的な WebPage の about（検索条件のハッシュ URL・3 件）と、
// 読み込み後に JS が head へ足す ItemList（HotPepper の外部 URL・LOCAL_STORES の読み込みと全件の読み込みで 2 本）が重なって、
// 最大 3 本が出ていた。url は実在する店舗ページ（現役のページだけ。誘導ページ・検索ディープリンクは載せない）。
function buildItemList(stores, detailPages, limit = ITEMLIST_MAX) {
  const items = [];
  const seen = new Set(); // 古い ID の店と移り先の店が同じページを指すとき、同じ URL を 2 回並べない
  for (const s of stores) {
    if (items.length >= limit) break;
    const slug = storePageSlug(buildHrefFor(s, detailPages));
    if (slug === null || !s['店名'] || seen.has(slug)) continue;
    seen.add(slug);
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: s['店名'],
      url: `${SITE_ORIGIN}/stores/${encodeURIComponent(slug)}.html`,
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '名古屋グルメ掲載店舗一覧',
    numberOfItems: items.length,
    itemListElement: items,
  };
}

function renderItemListBlock(itemList) {
  if (!itemList.itemListElement.length) return '<!-- STORE-ITEMLIST:START -->\n<!-- STORE-ITEMLIST:END -->';
  return `<!-- STORE-ITEMLIST:START -->
<script type="application/ld+json">${JSON.stringify(itemList).replace(/</g, '\\u003c')}</script>
<!-- STORE-ITEMLIST:END -->`;
}

// ── 発見導線（シーン / エリア / ジャンル特集）──────────────────────────
// data/journal_seo_keywords.json を唯一の情報源にする。同ファイルの KW は
// scripts/journal_seo_kw.js --verify で「特集ファイルが実在し、そのタイトルに
// その語が実際に使われている」ことを機械検証済み（自己申告値を使わない担保）。
// ここで生成するのは、トップページから discovery 意図（シーン語×エリア語）の
// 特集へ渡す静的な内部リンク。指名検索ではなく取りに行く面を厚くするのが目的。
// リンク文。既定は「名古屋の<kw>」。kw は検索語の対応づけ（採点・GSC の分類）に使う語なので変えない。
// 画面に出す文だけ替えたい語は、語彙表（scripts/journal_seo_kw.js）の label で指定する。
// 例: 人が選んだと読めるリンク文を、ページの実態に合う言い方に替える（P-330・判断の記録 0032）。
function sceneLinkText(x) {
  return x.label ? x.label : `名古屋の${x.kw}`;
}

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
      .map(x => `<li><a href="${escapeHtml(x.feature)}">${escapeHtml(sceneLinkText(x))}</a></li>`);
    if (!items.length) return '';
    return `<div class="scene-index-group">
<h3 class="scene-index-group-title">${escapeHtml(label)}</h3>
<ul class="scene-index-list">
${items.join('\n')}
</ul>
</div>`;
  }).filter(Boolean).join('\n');

  // SEO-094: 4群目「エリア×ジャンルで探す」。エリア×ジャンル一覧ページ（stores/area/）の
  // 唯一の情報源は data/area_genre_pages_manifest.json（scripts/gen_area_genre_pages.js の生成物）。
  // 上位12件を店舗数の多い順に載せる。トップページから discovery 意図の面を厚くする目的は
  // シーン/エリア/ジャンル群と同じ（SEO-011 の効果指標＝gsc_query_intent.js の discovery で測る）。
  // 下の section#store-index は、エリアごとにジャンルのハブをすべて並べる（ここは、よく使われる上位だけ）。
  const hubGroupHtml = (() => {
    const manifest = loadHubManifest();
    if (!manifest) return '';
    const hubs = (manifest.pages || [])
      .filter(p => p.type === 'genre' && p.status === 'active' && fs.existsSync(path.join(ROOT, p.path)))
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 12);
    if (!hubs.length) return '';
    const rootPage = (manifest.pages || []).find(p => p.type === 'root' && p.status === 'active');
    let agPolicy = null;
    try { agPolicy = require('./lib/area_genre_pages').loadPolicy(); } catch (e) { /* ポリシー未整備なら slug をそのまま使う */ }
    const areaLabelOf = slug => (agPolicy && agPolicy.areas.find(a => a.slug === slug) || {}).label || slug;
    const genreLabelOf = slug => (agPolicy && agPolicy.genres.find(g => g.slug === slug) || {}).label || slug;
    const items = hubs.map(h => {
      const m = h.path.match(/^stores\/area\/([^/]+)\/([^/.]+)\.html$/);
      const label = m ? `${areaLabelOf(m[1])}の${genreLabelOf(m[2])}` : h.path;
      return `<li><a href="${escapeHtml(h.path)}">${escapeHtml(label)}（${h.count}軒）</a></li>`;
    });
    const moreLink = rootPage ? `<li><a href="${escapeHtml(rootPage.path)}">エリア×ジャンルをすべて見る →</a></li>` : '';
    return `<div class="scene-index-group">
<h3 class="scene-index-group-title">エリア×ジャンルで探す</h3>
<ul class="scene-index-list">
${items.join('\n')}
${moreLink}
</ul>
</div>`;
  })();

  const rendered2 = [rendered, hubGroupHtml].filter(Boolean).join('\n');
  if (!rendered2) return null;

  return `<!-- SCENE-INDEX:START -->
<section id="scene-index" class="scene-index" aria-label="目的から探す">
<h2 class="scene-index-title">目的から探す</h2>
<p class="scene-index-lead">シーン・エリア・ジャンルごとの特集をまとめています。</p>
${rendered2}
</section>
<!-- SCENE-INDEX:END -->`;
}

function main() {
  let html = fs.readFileSync(HTML_PATH, 'utf8');
  const stores = loadLocalStores(html);
  const visibleStores = stores.filter(s => s['公開フラグ'] !== 'FALSE');
  console.log(`LOCAL_STORES から ${stores.length} 件読込（公開 ${visibleStores.length} 件）`);

  const detailPages = loadDetailPageSet();
  const detailHits = visibleStores.filter(s => s['ホットペッパーID'] && detailPages.active.has(s['ホットペッパーID'])).length;
  console.log(`詳細ページ stores/*.html: ${detailPages.active.size} 件（うち LOCAL_STORES 一致 ${detailHits} 件）`);

  // 1. 旧 noscript#seo-store-list を除去（冪等・ファイル冒頭の廃止理由コメント参照）
  const noscriptRe = /\s*<noscript><ul id="seo-store-list">[\s\S]*?<\/ul><\/noscript>/;
  const legacy = html.match(noscriptRe);
  if (legacy) {
    html = html.replace(noscriptRe, '');
    console.log(`旧 noscript#seo-store-list を除去しました（${Math.round(legacy[0].length / 1024)}KB 削減）`);
  }

  // 2. store-index ブロック（エリア別のハブへの入口 + 店舗ページへのリンクの例外の表）を <footer> 直前に挿入／置換
  //    ハブが 1 つも読めない日（manifest が無い等）は、前の区画をそのまま残す（空の区画で入口を消さない）
  const policy = (() => { try { return require('./lib/area_genre_pages').loadPolicy(); } catch (e) { return null; } })();
  const plan = planHubLinks({
    manifest: loadHubManifest(),
    policy,
    exists: (rel) => fs.existsSync(path.join(ROOT, rel)),
  });
  const today = new Date().toISOString().slice(0, 10);
  const indexRe = /<!-- STORE-INDEX:START[^>]*-->[\s\S]*?<!-- STORE-INDEX:END -->/;
  if (!plan.areas.length) {
    console.warn('エリア別の店舗一覧ページ（stores/area/）が読めず、section#store-index をスキップ（前の区画を残します）');
  } else {
    const table = buildStorePageTable(visibleStores, detailPages);
    const storeIndex = `<!-- STORE-INDEX:START ${today} -->\n${renderStoreIndexBlock(plan)}\n${renderStorePagesScript(table)}\n<!-- STORE-INDEX:END -->`;
    if (indexRe.test(html)) {
      html = html.replace(indexRe, () => storeIndex);
      console.log('section#store-index を置換しました');
    } else if (html.includes('<footer>')) {
      html = html.replace('<footer>', () => storeIndex + '\n\n<footer>');
      console.log('section#store-index を <footer> 直前に挿入しました');
    } else {
      html = html.replace('</body>', () => storeIndex + '\n</body>');
      console.log('section#store-index を </body> 直前に挿入しました');
    }
    const hubLinks = plan.areas.reduce((n, a) => n + 1 + a.genres.length, 0) + (plan.root ? 1 : 0);
    console.log(`  エリア ${plan.areas.length} 件・ハブへのリンク ${hubLinks} 本（店舗ページへのリンクの例外: 店舗ページ無し ${Object.keys(table.none).length} 件・移り先あり ${Object.keys(table.to).length} 件）`);
    if (plan.skipped) console.warn(`  名前を引けず載せなかったハブ: ${plan.skipped} 件（data/area_genre_pages_policy.json を確認）`);
  }

  // 3. 発見導線（section#scene-index）を store-index の直前に挿入／置換
  const sceneIndex = renderSceneIndexBlock();
  if (sceneIndex) {
    const sceneRe = /<!-- SCENE-INDEX:START -->[\s\S]*?<!-- SCENE-INDEX:END -->/;
    if (sceneRe.test(html)) {
      html = html.replace(sceneRe, () => sceneIndex);
      console.log('section#scene-index を置換しました');
    } else {
      html = html.replace('<!-- STORE-INDEX:START', () => sceneIndex + '\n\n<!-- STORE-INDEX:START');
      console.log('section#scene-index を store-index の直前に挿入しました');
    }
  } else {
    console.warn('data/journal_seo_keywords.json が読めず、scene-index をスキップ');
  }

  // 4. ItemList（構造化データ）を head の中に 1 本だけ置く
  const itemList = buildItemList(visibleStores, detailPages);
  const itemListBlock = renderItemListBlock(itemList);
  const itemListRe = /<!-- STORE-ITEMLIST:START -->[\s\S]*?<!-- STORE-ITEMLIST:END -->/;
  if (itemListRe.test(html)) {
    html = html.replace(itemListRe, () => itemListBlock);
  } else {
    html = html.replace('</head>', () => itemListBlock + '\n</head>');
  }
  console.log(`ItemList を ${itemList.itemListElement.length} 件で置換しました`);

  fs.writeFileSync(HTML_PATH, html, 'utf8');
  console.log(`index.html を更新完了（公開 ${visibleStores.length} 件）`);
}

if (require.main === module) main();
module.exports = {
  loadDetailPageSet, buildHrefFor, sceneLinkText, renderSceneIndexBlock,
  planHubLinks, renderStoreIndexBlock, buildStorePageTable, renderStorePagesScript, buildItemList, renderItemListBlock,
  storePageSlug, hubLinkText, loadHubManifest,
};
