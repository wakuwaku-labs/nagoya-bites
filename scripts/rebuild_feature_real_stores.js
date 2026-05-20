#!/usr/bin/env node
// 架空店で構成された特集記事の shop-card を、実在の HotPepper 店（実写付き）に 1:1 置換する。
// 記事のセクション構造と、既に実在する shop-card は保持する。
// JSON-LD ItemList 内の架空店名も実在店名へ差し替える。
//
// 使い方: node scripts/rebuild_feature_real_stores.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const removeNames = new Set(JSON.parse(fs.readFileSync('/tmp/remove_names.json', 'utf8')).map(n => n.replace(/\s|　/g, '')));
const norm = (s) => String(s || '').replace(/\s|　/g, '');

function loadStores() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return JSON.parse(html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/)[1]);
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// 記事ごとのジャンル選定
const POOLS = {
  'nagoya-ramen':    s => /ラーメン|らーめん|つけ麺|担々麺|担担麺|台湾まぜそば|中華そば/.test(s['ジャンル'] || ''),
  'nagoya-gyoza':    s => /餃子/.test((s['ジャンル'] || '') + (s['店名'] || '') + (s['おすすめポイント'] || '')) || /中華|中国/.test(s['ジャンル'] || ''),
  'nagoya-cafe':     s => /カフェ|喫茶|コーヒー|珈琲/.test(s['ジャンル'] || ''),
  'nagoya-sweets':   s => /スイーツ|パティスリー|ケーキ|甘味|デザート|パフェ|大福|プリン|ジェラート|かき氷/.test((s['ジャンル'] || '') + (s['店名'] || '')) || /カフェ|喫茶/.test(s['ジャンル'] || ''),
  'nagoya-kakuozan': s => /覚王山|本山|池下|今池/.test((s['エリア'] || '') + (s['アクセス'] || '')),
  'fathers-day-2026': s => /焼肉|うなぎ|鰻|寿司|鮨|割烹|ステーキ|鉄板|日本料理|懐石/.test(s['ジャンル'] || ''),
};

function pickPool(stores, slug) {
  const f = POOLS[slug];
  return stores
    .filter(s => s['ホットペッパーID'] && (s['写真URL'] || '').includes('imgfp.hotp.jp') && f(s))
    .filter(s => fs.existsSync(path.join(ROOT, 'stores', s['ホットペッパーID'] + '.html')))
    .sort((a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0));
}

function makeCard(store, num) {
  const name = esc(store['店名']);
  const area = esc(store['エリア'] || '');
  const genre = esc((store['ジャンル'] || '').split('・')[0].split('/')[0].trim());
  const photo = esc(store['写真URL']);
  const hpid = esc(store['ホットペッパーID']);
  let desc = (store['editorReason'] || store['おすすめポイント'] || '').trim();
  if (desc.length > 120) desc = desc.slice(0, 118) + '…';
  desc = esc(desc);
  const tags = (store['タグ'] || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 2);
  const score = store['Google評価'] ? `<span class="tag">★${esc(store['Google評価'])}</span>` : '';
  const tagsHtml = tags.map(t => `<span class="tag">${esc(t)}</span>`).join('\n        ');
  return `<div class="shop-card">
      <img class="shop-card-photo" src="${photo}" alt="${name}" loading="lazy" decoding="async">
      <div class="shop-num">${num}</div>
      <div class="shop-name">${name}</div>
      <div class="shop-area">${area}${genre ? ' / ' + genre : ''}</div>
      <p class="shop-desc">${desc}</p>
      <div class="shop-tags">
        ${tagsHtml}${tagsHtml ? '\n        ' : ''}${score}
      </div>
          <a href="../stores/${hpid}.html" class="shop-detail-link">詳細ページを見る</a>
    </div>`;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const stores = loadStores();
  const report = {};

  for (const slug of Object.keys(POOLS)) {
    const file = path.join(ROOT, 'features', slug + '.html');
    if (!fs.existsSync(file)) continue;
    let src = fs.readFileSync(file, 'utf8');
    const pool = pickPool(stores, slug);
    let pi = 0;
    const usedHpid = new Set();
    const nameMap = []; // {from, to}

    // shop-card ブロックを順に処理（src 内の各 <div class="shop-card"> ... 詳細リンク ... </div>）
    src = src.replace(/<div class="shop-card">[\s\S]*?<a href="[^"]*" class="shop-detail-link">[^<]*<\/a>\s*<\/div>/g, (block) => {
      const nameM = block.match(/class="shop-name">([^<]+)</);
      const numM = block.match(/class="shop-num">([^<]+)</);
      const name = nameM ? nameM[1] : '';
      const num = numM ? numM[1] : '';
      if (!removeNames.has(norm(name))) return block; // 実在カードは保持
      // 次の未使用実在店を採用
      let store = null;
      while (pi < pool.length) { const c = pool[pi++]; if (!usedHpid.has(c['ホットペッパーID'])) { store = c; usedHpid.add(c['ホットペッパーID']); break; } }
      if (!store) return block; // プール枯渇時はそのまま（後で警告）
      nameMap.push({ from: name, to: store['店名'] });
      return makeCard(store, num);
    });

    // JSON-LD / 本文中の架空店名を実在店名へ置換
    for (const { from, to } of nameMap) {
      src = src.split(from).join(to);
    }

    if (!dryRun) fs.writeFileSync(file, src, 'utf8');
    report[slug] = { replaced: nameMap.length, poolSize: pool.length };
  }

  console.log(`(dry-run: ${dryRun})`);
  console.log(JSON.stringify(report, null, 2));
}

main();
