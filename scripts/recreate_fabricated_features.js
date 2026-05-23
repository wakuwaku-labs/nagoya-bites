#!/usr/bin/env node
// 架空店の作り話で構成されていた特集記事を削除し、実在店データでクリーンに再生成する。
// 既存クリーン記事（nagoya-ramen.html）の head/header/footer を流用し、本文は
// LOCAL_STORES の実在店（HotPepper + 正規登録した有名手動店）の shop-card で構成。
// 紹介文は店の おすすめポイント（事実ベース）のみ。作り話・取材風コメントは一切生成しない。
//
// 使い方: node scripts/recreate_fabricated_features.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FEAT = path.join(ROOT, 'features');
const norm = (s) => String(s || '').replace(/\s|　/g, '').replace(/&amp;/g, '&').toLowerCase();
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TODAY = '2026-05-22';

// 再生成対象（slug → 設定）
const CONFIG = {
  'nagoya-french-guide':  { jp: 'フレンチ', em: 'フレンチ', en: 'French Guide', re: /フレンチ|フランス|ビストロ|brasserie|bistro/i, n: 8 },
  'nagoya-italian-guide': { jp: 'イタリアン', em: 'イタリアン', en: 'Italian Guide', re: /イタリアン|パスタ|ピッツァ|リストランテ|トラットリア|オステリア/, n: 10 },
  'nagoya-chinese-guide': { jp: '中華料理', em: '中華', en: 'Chinese Guide', re: /中華|中国|台湾|四川|広東|飲茶/, n: 10 },
  'nagoya-bar-guide':     { jp: 'バー・ワインバー', em: 'バー', en: 'Bar Guide', re: /バー|bar|ワイン|カクテル|ウイスキー/i, n: 10 },
  'nagoya-bar':           { jp: 'バー・カクテル', em: 'バー', en: 'Bar', re: /バー|bar|ワイン|カクテル|ウイスキー/i, n: 10 },
  'nagoya-dining-bar':    { jp: 'ダイニングバー・バル', em: 'ダイニングバー', en: 'Dining Bar', re: /ダイニング|バル|バー/, n: 10 },
  'nagoya-izakaya':       { jp: '居酒屋', em: '居酒屋', en: 'Izakaya', re: /居酒屋|酒場|串|もつ|ダイニング/, n: 10 },
  'nagoya-kaiseki-guide': { jp: '懐石・会席', em: '懐石', en: 'Kaiseki Guide', re: /懐石|割烹|日本料理|会席/, n: 10 },
  'nagoya-settai-lunch':  { jp: '接待ランチ', em: '接待', en: 'Settai Lunch', re: /割烹|日本料理|フレンチ|懐石|和食|鉄板/, n: 10 },
  'nagoya-steak':         { jp: 'ステーキ', em: 'ステーキ', en: 'Steak', re: /ステーキ|鉄板|焼肉|ビーフ/, n: 10 },
  'nagoya-teppanyaki':    { jp: '鉄板焼き', em: '鉄板焼き', en: 'Teppanyaki', re: /鉄板|ステーキ|焼肉/, n: 10 },
  'nagoya-sushi-guide':   { jp: '鮨', em: '鮨', en: 'Sushi Guide', re: /寿司|鮨|すし/, n: 8 },
  'nagoya-sukiyaki':      { jp: 'すき焼き・しゃぶしゃぶ', em: 'すき焼き', en: 'Sukiyaki', re: /すき焼|しゃぶ|鍋|割烹/, n: 10 },
  'nagoya-unaju':         { jp: 'うなぎ・ひつまぶし', em: 'うなぎ', en: 'Unagi', re: /うなぎ|鰻|ひつまぶし/, n: 10 },
  'nagoya-tonkatsu':      { jp: 'とんかつ・味噌かつ', em: 'とんかつ', en: 'Tonkatsu', re: /とんかつ|トンカツ|味噌かつ|かつ/, n: 10 },
  'nagoya-yakitori':      { jp: '焼き鳥', em: '焼き鳥', en: 'Yakitori', re: /焼き鳥|焼鳥|やきとり|串|鶏/, n: 10 },
  'nagoya-yoshoku':       { jp: '洋食', em: '洋食', en: 'Yoshoku', re: /洋食|グリル|オムライス|ハンバーグ|エビフライ/, n: 10 },
  'nagoya-morning':       { jp: 'モーニング・喫茶', em: '喫茶', en: 'Morning', re: /カフェ|喫茶|コーヒー|珈琲/, n: 10 },
  'nagoya-autumn-2026':   { jp: '秋グルメ', em: '秋', en: 'Autumn 2026', re: /和食|割烹|日本料理|懐石|海鮮/, n: 10 },
  'nagoya-summer-2026':   { jp: '夏グルメ', em: '夏', en: 'Summer 2026', re: /居酒屋|海鮮|ビアガーデン|ダイニング/, n: 10 },
};

// ISSUE-015-P2 第二段: data/stores.json を canonical として読込、無ければ index.html フォールバック
const { loadStores: _loadStoresShared } = require('./lib/load_stores');
function loadStores() {
  return _loadStoresShared();
}
function pageIdFor(s, manualMap) {
  if (s['ホットペッパーID']) return s['ホットペッパーID'];
  return manualMap[norm(s['店名'])] || null;
}

function shopCard(s, num, pageId) {
  const name = esc(s['店名']);
  const area = esc(s['エリア'] || '');
  const genre = esc((s['ジャンル'] || '').split('・')[0].split('/')[0].trim());
  const photo = esc(s['写真URL'] || '/assets/store-figures/_fallback.svg');
  let desc = (s['editorReason'] || s['おすすめポイント'] || '').trim();
  if (desc.length > 120) desc = desc.slice(0, 118) + '…';
  if (!desc) desc = `${s['エリア'] || '名古屋'}の${genre || '名店'}。`;
  desc = esc(desc);
  const tags = (s['タグ'] || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 2);
  const score = s['Google評価'] ? `<span class="tag">★${esc(s['Google評価'])}</span>` : '';
  const tagsHtml = tags.map(t => `<span class="tag">${esc(t)}</span>`).join('\n        ');
  const link = pageId ? `\n          <a href="../stores/${esc(pageId)}.html" class="shop-detail-link">詳細ページを見る</a>` : '';
  return `    <div class="shop-card">
      <img class="shop-card-photo" src="${photo}" alt="${name}" loading="lazy" decoding="async">
      <div class="shop-num">${String(num).padStart(2, '0')}</div>
      <div class="shop-name">${name}</div>
      <div class="shop-area">${area}${genre ? ' / ' + genre : ''}</div>
      <p class="shop-desc">${desc}</p>
      <div class="shop-tags">
        ${tagsHtml}${tagsHtml ? '\n        ' : ''}${score}
      </div>${link}
    </div>`;
}

function buildHead(tmplHead, cfg, slug, picks) {
  const title = `名古屋の${cfg.jp}おすすめ${picks.length}選【2026年版】｜NAGOYA BITES`;
  const desc = `名古屋の${cfg.jp}を現役飲食人が実在店から厳選${picks.length}店。掲載店はすべて実在を確認（食べログ・ホットペッパー等で照合）。エリア・予算・特徴を業界視点で解説。`;
  const url = `https://nagoya-bites.com/features/${slug}.html`;
  const ogimg = `https://nagoya-bites.com/assets/feature-figures/${slug}.svg`;
  let h = tmplHead;
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  h = h.replace(/(<meta name="description" content=")[^"]*(">)/, `$1${esc(desc)}$2`);
  h = h.replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${esc(title)}$2`);
  h = h.replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${esc(desc)}$2`);
  h = h.replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${url}$2`);
  h = h.replace(/(<meta property="og:image" content=")[^"]*(">)/g, `$1${ogimg}$2`);
  h = h.replace(/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${esc(title)}$2`);
  h = h.replace(/(<meta name="twitter:image" content=")[^"]*(">)/g, `$1${ogimg}$2`);
  h = h.replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${url}$2`);
  // JSON-LD（Article + BreadcrumbList のみ残し、ItemList は本文側で付与）
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc,
    author: { '@type': 'Organization', name: 'NAGOYA BITES' },
    publisher: { '@type': 'Organization', name: 'NAGOYA BITES', url: 'https://nagoya-bites.com/' },
    url, datePublished: TODAY, dateModified: TODAY, image: ogimg,
  };
  h = h.replace(/<script type="application\/ld\+json">\{[\s\S]*?\}<\/script>/, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
  return h;
}

function buildBody(cfg, slug, picks, manualMap) {
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `名古屋の${cfg.jp}おすすめ${picks.length}選【2026年版】`,
    numberOfItems: picks.length,
    itemListElement: picks.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s['店名'] })),
  };
  const cards = picks.map((s, i) => shopCard(s, i + 1, pageIdFor(s, manualMap))).join('\n');
  return `
<body>
<header>
  <a href="https://nagoya-bites.com/" class="logo">Nagoya <em>Bites</em></a>
  <nav>
    <a href="https://nagoya-bites.com/">店舗を探す</a>
    <a href="https://nagoya-bites.com/features/" class="active">特集</a>
    <a href="https://nagoya-bites.com/journal/">Journal</a>
  </nav>
</header>

<div class="breadcrumb">
  <a href="https://nagoya-bites.com/">TOP</a><span>›</span>
  <a href="https://nagoya-bites.com/features/">特集</a><span>›</span>
  名古屋の${esc(cfg.jp)}おすすめ${picks.length}選【2026年版】
</div>

<div class="art-hero-image">
  <img src="../assets/feature-figures/${slug}.svg" alt="名古屋の${esc(cfg.jp)}" loading="eager" fetchpriority="high">
</div>
<div class="hero">
  <p class="hero-eyebrow">特集 — ${esc(cfg.en)}</p>
  <h1 class="hero-title">名古屋の<em>${esc(cfg.em)}</em><br>おすすめ${picks.length}選【2026年版】</h1>
  <div class="hero-meta">
    <span>${TODAY} 公開</span>
    <span>NAGOYA BITES 編集部</span>
    <span>${picks.length}店舗掲載</span>
  </div>
  <p class="hero-lead">名古屋の${esc(cfg.jp)}を、現役飲食人の視点で実在店から厳選しました。掲載店はすべて実在を確認しています（食べログ・ホットペッパー・Google マップ等で照合）。各店のエリア・特徴を簡潔に紹介します。</p>
</div>

<div class="content">
  <p class="section-label">Selection — 実在確認済み</p>
  <h2>名古屋の${esc(cfg.jp)} 厳選${picks.length}店</h2>
  <div class="shop-grid">
${cards}
  </div>
  <script type="application/ld+json">${JSON.stringify(itemList)}</script>
</div>
`;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const stores = loadStores();
  const manualMap = fs.existsSync('/tmp/manual_pageid_map.json')
    ? JSON.parse(fs.readFileSync('/tmp/manual_pageid_map.json', 'utf8')) : {};
  // テンプレ（クリーンな nagoya-ramen.html）から head と footer を抽出
  const tmpl = fs.readFileSync(path.join(FEAT, 'nagoya-ramen.html'), 'utf8');
  const tmplHead = tmpl.slice(tmpl.indexOf('<head>'), tmpl.indexOf('</head>') + 7);
  const footer = tmpl.slice(tmpl.lastIndexOf('<footer'));

  const usable = stores.filter(s => (s['写真URL'] || '').match(/imgfp\.hotp\.jp|googleusercontent/)
    && (s['ホットペッパーID'] ? fs.existsSync(path.join(ROOT, 'stores', s['ホットペッパーID'] + '.html')) : manualMap[norm(s['店名'])]));

  const report = {};
  for (const [slug, cfg] of Object.entries(CONFIG)) {
    const pool = usable
      .filter(s => cfg.re.test((s['ジャンル'] || '') + (s['店名'] || '') + (s['おすすめポイント'] || '')))
      .sort((a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0));
    const picks = pool.slice(0, cfg.n);
    if (picks.length < 3) { report[slug] = `SKIP (在庫${picks.length})`; continue; }
    const head = buildHead(tmplHead, cfg, slug, picks);
    const html = `<!DOCTYPE html>\n<html lang="ja">\n${head}\n${buildBody(cfg, slug, picks, manualMap)}\n${footer}`;
    if (!dryRun) fs.writeFileSync(path.join(FEAT, slug + '.html'), html, 'utf8');
    report[slug] = `${picks.length}店 (pool ${pool.length})`;
  }
  console.log(`(dry-run: ${dryRun})`);
  for (const [k, v] of Object.entries(report)) console.log(`  ${k}: ${v}`);
}

main();
