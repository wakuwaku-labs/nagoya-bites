#!/usr/bin/env node
// 架空店で構成された特集記事の shop-card を実在店に作り直す。
//   - LOCAL_STORES に実在する店（HotPepper店・正規登録した有名手動店）→ 正しい写真・店舗ページで再生成
//   - LOCAL_STORES に無い店（架空・他都市）→ ジャンル一致の実在 HotPepper 店に 1:1 置換
//   - JSON-LD ItemList の架空店名も実在店名へ差し替え
//
// 使い方: node scripts/rebuild_feature_real_stores.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const norm = (s) => String(s || '').replace(/\s|　/g, '').replace(/&amp;/g, '&').toLowerCase();
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function loadStores() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return JSON.parse(html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/)[1]);
}
const manualPageId = fs.existsSync('/tmp/manual_pageid_map.json')
  ? JSON.parse(fs.readFileSync('/tmp/manual_pageid_map.json', 'utf8')) : {};

// 店の店舗ページID（HotPepper→HPID / 手動→M-id）
function pageIdFor(store) {
  if (store['ホットペッパーID']) return store['ホットペッパーID'];
  return manualPageId[norm(store['店名'])] || null;
}

// 記事 → ジャンル判定（ジャンル+店名+おすすめポイント を広域マッチ）
const GENRE = {
  'nagoya-autumn-2026':  /和食|割烹|日本料理|懐石|居酒屋|海鮮/,
  'nagoya-summer-2026':  /居酒屋|ビアガーデン|ビアホール|海鮮|ダイニング/,
  'nagoya-bar-guide':    /バー|bar|ワイン|カクテル|ウイスキー/i,
  'nagoya-bar':          /バー|bar|ワイン|カクテル|ウイスキー|スタンド/i,
  'nagoya-dining-bar':   /ダイニング|バル|バー|居酒屋/,
  'nagoya-chinese-guide':/中華|中国|台湾|四川|広東|飲茶|餃子/,
  'nagoya-french-guide': /フレンチ|フランス|ビストロ|brasserie|bistro/i,
  'nagoya-italian-guide':/イタリアン|パスタ|ピッツァ|リストランテ|トラットリア|オステリア/,
  'nagoya-izakaya':      /居酒屋|酒場|ダイニング|串|もつ/,
  'nagoya-kaiseki-guide':/懐石|割烹|日本料理|会席|和食/,
  'nagoya-settai-lunch': /割烹|日本料理|フレンチ|懐石|和食|鉄板/,
  'nagoya-steak':        /ステーキ|鉄板|焼肉|肉|ビーフ/,
  'nagoya-teppanyaki':   /鉄板|ステーキ|焼肉/,
  'nagoya-sushi-guide':  /寿司|鮨|すし/,
  'nagoya-sukiyaki':     /すき焼|しゃぶ|鍋|和食|割烹/,
  'nagoya-unaju':        /うなぎ|鰻|ひつまぶし/,
  'nagoya-tonkatsu':     /とんかつ|トンカツ|味噌かつ|カツ/,
  'nagoya-yakitori':     /焼き鳥|焼鳥|やきとり|串|鶏/,
  'nagoya-yoshoku':      /洋食|グリル|オムライス|ハンバーグ|エビフライ/,
  'nagoya-morning':      /カフェ|喫茶|コーヒー|珈琲|モーニング/,
  'osu-food-walk':       /大須|食べ歩き|テイクアウト|串|スイーツ/,
};

function makeCard(store, num, pageId) {
  const name = esc(store['店名']);
  const area = esc(store['エリア'] || '');
  const genre = esc((store['ジャンル'] || '').split('・')[0].split('/')[0].trim());
  const photo = esc(store['写真URL'] || '/assets/store-figures/_fallback.svg');
  let desc = (store['editorReason'] || store['おすすめポイント'] || '').trim();
  if (desc.length > 120) desc = desc.slice(0, 118) + '…';
  desc = esc(desc);
  const tags = (store['タグ'] || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 2);
  const score = store['Google評価'] ? `<span class="tag">★${esc(store['Google評価'])}</span>` : '';
  const tagsHtml = tags.map(t => `<span class="tag">${esc(t)}</span>`).join('\n        ');
  const link = pageId ? `\n          <a href="../stores/${esc(pageId)}.html" class="shop-detail-link">詳細ページを見る</a>` : '';
  return `<div class="shop-card">
      <img class="shop-card-photo" src="${photo}" alt="${name}" loading="lazy" decoding="async">
      <div class="shop-num">${num}</div>
      <div class="shop-name">${name}</div>
      <div class="shop-area">${area}${genre ? ' / ' + genre : ''}</div>
      <p class="shop-desc">${desc}</p>
      <div class="shop-tags">
        ${tagsHtml}${tagsHtml ? '\n        ' : ''}${score}
      </div>${link}
    </div>`;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const stores = loadStores();
  const byName = new Map();
  for (const s of stores) byName.set(norm(s['店名']), s);
  const hpPhoto = stores.filter(s => s['ホットペッパーID'] && (s['写真URL'] || '').includes('imgfp.hotp.jp')
    && fs.existsSync(path.join(ROOT, 'stores', s['ホットペッパーID'] + '.html')));
  const report = {};

  for (const [slug, re] of Object.entries(GENRE)) {
    const file = path.join(ROOT, 'features', slug + '.html');
    if (!fs.existsSync(file)) continue;
    let src = fs.readFileSync(file, 'utf8');
    if (!/class="shop-card"/.test(src)) continue;

    const pool = hpPhoto
      .filter(s => re.test((s['ジャンル'] || '') + (s['店名'] || '') + (s['おすすめポイント'] || '')))
      .sort((a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0));
    let pi = 0;
    const used = new Set();
    const nameMap = [];
    let regen = 0, replaced = 0;

    src = src.replace(/<div class="shop-card">[\s\S]*?(?:<a href="[^"]*" class="shop-detail-link">[^<]*<\/a>\s*)?<\/div>/g, (block) => {
      const nameM = block.match(/class="shop-name">([^<]+)</);
      const numM = block.match(/class="shop-num">([^<]+)</);
      if (!nameM) return block;
      const name = nameM[1].trim();
      const num = numM ? numM[1] : '01';
      const real = byName.get(norm(name));
      if (real) { regen++; return makeCard(real, num, pageIdFor(real)); } // 実在店→正しい写真/ページで再生成
      // 架空店→ジャンル一致の実在HP店に置換
      let store = null;
      while (pi < pool.length) { const c = pool[pi++]; if (!used.has(c['ホットペッパーID'])) { used.add(c['ホットペッパーID']); store = c; break; } }
      if (!store) return block;
      nameMap.push({ from: name, to: store['店名'] });
      replaced++;
      return makeCard(store, num, store['ホットペッパーID']);
    });

    for (const { from, to } of nameMap) src = src.split(from).join(to);

    if (!dryRun) fs.writeFileSync(file, src, 'utf8');
    report[slug] = { regen, replaced, poolSize: pool.length };
  }

  console.log(`(dry-run: ${dryRun})`);
  console.log(JSON.stringify(report, null, 2));
}

main();
