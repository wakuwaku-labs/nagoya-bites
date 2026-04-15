'use strict';
/**
 * build_features.js
 * index.html の LOCAL_STORES から最新データを読み込み、
 * 特集記事の店舗リスト・JSON-LD・sitemapを自動更新する。
 *
 * 使い方: node build.js && node build_features.js
 *
 * 各特集記事の「店舗リスト部分」だけを最新データで差し替える。
 * 記事の導入文・Tips・関連リンクなどの編集コンテンツはそのまま維持。
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, 'index.html');
const FEATURES_DIR = path.join(__dirname, 'features');

// ─────────────────────────────────────────────
// 特集記事の設定（ここに追加すれば記事が自動更新対象になる）
// ─────────────────────────────────────────────
const FEATURE_CONFIGS = [
  {
    file: 'meieki.html',
    label: '名駅エリア',
    count: 15,
    filter: s => s['エリア'] === '名古屋駅',
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    tagExtractor: defaultTagExtractor,
    descGenerator: meiekiDesc,
  },
  {
    file: 'sakae.html',
    label: '栄・錦エリア',
    count: 15,
    filter: s => s['エリア'] === '栄',
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    tagExtractor: defaultTagExtractor,
    descGenerator: sakaeDesc,
  },
  {
    file: 'banquet.html',
    label: '宴会・忘年会',
    count: 15,
    filter: s => {
      const tags = (s['タグ'] || '').toLowerCase();
      return tags.includes('宴会') || tags.includes('忘年会') ||
             tags.includes('100名') || tags.includes('50〜') ||
             tags.includes('60〜') || tags.includes('70〜') ||
             tags.includes('80〜') || tags.includes('90〜');
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    tagExtractor: defaultTagExtractor,
    descGenerator: banquetDesc,
  },
  {
    file: 'private-room.html',
    label: '個室グルメ',
    count: 10,
    filter: s => {
      const tags = (s['タグ'] || '').toLowerCase();
      return tags.includes('個室');
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    tagExtractor: defaultTagExtractor,
    descGenerator: defaultDesc,
  },
  {
    file: 'birthday.html',
    label: '誕生日・記念日',
    count: 10,
    filter: s => {
      const tags = (s['タグ'] || '').toLowerCase();
      return tags.includes('誕生日') || tags.includes('記念日');
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    tagExtractor: defaultTagExtractor,
    descGenerator: defaultDesc,
  },
  {
    file: 'date.html',
    label: 'デートディナー',
    count: 10,
    filter: s => {
      const tags = (s['タグ'] || '');
      const genre = (s['ジャンル'] || '');
      // デート向き: 個室・隠れ家・記念日対応 + イタリアン/フレンチ/ダイニング系
      return (tags.includes('隠れ家') || tags.includes('誕生日・記念日') ||
              genre.includes('イタリアン') || genre.includes('フレンチ') ||
              genre.includes('ダイニング')) &&
             tags.includes('個室');
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    tagExtractor: defaultTagExtractor,
    descGenerator: defaultDesc,
  },
  {
    file: 'girls-party.html',
    label: '女子会',
    count: 10,
    filter: s => {
      const tags = (s['タグ'] || '').toLowerCase();
      return tags.includes('女子会');
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    tagExtractor: defaultTagExtractor,
    descGenerator: defaultDesc,
  },
  {
    file: 'large-group.html',
    label: '大人数宴会',
    count: 10,
    filter: s => {
      const tags = (s['タグ'] || '').toLowerCase();
      return tags.includes('100名') || tags.includes('80〜') ||
             tags.includes('90〜') || tags.includes('70〜');
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    tagExtractor: defaultTagExtractor,
    descGenerator: defaultDesc,
  },
];

// ─────────────────────────────────────────────
// 店舗カード生成用のヘルパー関数
// ─────────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function defaultTagExtractor(store) {
  const tags = (store['タグ'] || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 3);
  return tags;
}

function getStoreUrl(store) {
  const hpid = store['ホットペッパーID'];
  if (hpid) return `https://www.hotpepper.jp/str${hpid}/`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store['店名'] + ' 名古屋')}`;
}

function defaultDesc(store) {
  return store['おすすめポイント'] || `${store['ジャンル']}の人気店。`;
}

function meiekiDesc(store) {
  const rec = store['おすすめポイント'];
  if (rec) return rec;
  return `名古屋駅エリアの${store['ジャンル']}。`;
}

function sakaeDesc(store) {
  const rec = store['おすすめポイント'];
  if (rec) return rec;
  return `栄エリアの${store['ジャンル']}。`;
}

function banquetDesc(store) {
  const rec = store['おすすめポイント'];
  if (rec) return rec;
  return `宴会対応の${store['ジャンル']}。`;
}

function generateStoreCard(store, index, config) {
  const num = String(index + 1).padStart(2, '0');
  const name = escapeHtml(store['店名']);
  const genre = escapeHtml(store['ジャンル'] || '');
  const score = store['Google評価'];
  const price = escapeHtml(store['価格帯'] || '');
  const desc = escapeHtml(config.descGenerator(store));
  const tags = config.tagExtractor(store);
  const url = getStoreUrl(store);

  const scoreMeta = score ? `<span class="score">★ ${escapeHtml(score)}</span>` : '';
  const priceMeta = price ? `<span>${price}</span>` : '';
  const tagsHtml = tags.map(t => `<span class="store-tag">${escapeHtml(t)}</span>`).join('');

  return `      <div class="store-card">
        <div class="store-num">${num}</div>
        <div class="store-info">
          <div class="store-name">${name}</div>
          <div class="store-meta"><span>${genre}</span>${scoreMeta}${priceMeta}</div>
          <p class="store-desc">${desc}</p>
          <div class="store-tags">${tagsHtml}</div>
          <a class="store-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">予約・詳細を見る →</a>
        </div>
      </div>`;
}

function generateItemListJsonLd(stores, config) {
  const items = stores.map((s, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: s['店名'],
    url: getStoreUrl(s),
  }));
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${config.label}おすすめ${config.count}選`,
    numberOfItems: stores.length,
    itemListElement: items,
  });
}

// ─────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────
function readStores() {
  const html = fs.readFileSync(HTML, 'utf8');
  const match = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!match) throw new Error('LOCAL_STORES が見つかりません');
  return JSON.parse(match[1]);
}

function updateFeatureArticle(stores, config) {
  const filePath = path.join(FEATURES_DIR, config.file);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⏭ ${config.file}: ファイルなし（スキップ）`);
    return null;
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // 1. フィルタ & ソート
  const filtered = stores.filter(config.filter).sort(config.sort).slice(0, config.count);
  if (filtered.length === 0) {
    console.log(`  ⚠ ${config.file}: 該当店舗0件（スキップ）`);
    return null;
  }

  // 2. 店舗カードHTML生成
  const cardsHtml = filtered.map((s, i) => generateStoreCard(s, i, config)).join('\n\n');

  // 3. store-list を差し替え
  const storeListRe = /(<div class="store-list">)([\s\S]*?)(<\/div>\s*(?:<div class="tips-box"|<\/div>\s*<\/article>))/;
  const storeListMatch = html.match(storeListRe);
  if (storeListMatch) {
    // store-list の中身だけ置換（後続の要素は保持）
    html = html.replace(
      /(<div class="store-list">)[\s\S]*?(<\/div>\s*<\/div>\s*(?:<div class="tips-box" style|<\/article>))/,
      `$1\n\n${cardsHtml}\n\n    </div>\n  </div>\n  $2`.replace('$2', '')
    );
  }

  // より安全な置換: store-list 開始タグから閉じタグまで
  // store-card を含む store-list div の中身を丸ごと差し替える
  const safeRe = /<div class="store-list">([\s\S]*?)<\/div>\s*\n\s*<div class="tips-box" style/;
  const safeMatch = html.match(safeRe);
  if (safeMatch) {
    html = html.replace(safeRe, `<div class="store-list">\n\n${cardsHtml}\n\n    </div>\n\n    <div class="tips-box" style`);
  } else {
    // tips-box style がない場合（</article> 前）
    const altRe = /<div class="store-list">([\s\S]*?)<\/div>\s*\n\s*<\/div>\s*\n<\/article>/;
    const altMatch = html.match(altRe);
    if (altMatch) {
      html = html.replace(altRe, `<div class="store-list">\n\n${cardsHtml}\n\n    </div>\n  </div>\n</article>`);
    }
  }

  // 4. ItemList JSON-LD を差し替え
  const itemListRe = /<script type="application\/ld\+json">\s*\{[^}]*"@type"\s*:\s*"ItemList"[\s\S]*?<\/script>/;
  if (html.match(itemListRe)) {
    html = html.replace(itemListRe,
      `<script type="application/ld+json">\n${generateItemListJsonLd(filtered, config)}\n</script>`
    );
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  ✅ ${config.file}: ${filtered.length}件更新`);
  return filtered.length;
}

function updateFeaturesIndex(results) {
  const indexPath = path.join(FEATURES_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  let html = fs.readFileSync(indexPath, 'utf8');

  // 各カードの「X店掲載」の数を更新
  for (const [file, count] of Object.entries(results)) {
    if (count === null) continue;
    // href="meieki.html" を含むカード内の card-count を更新
    const cardRe = new RegExp(
      `(href="${file}"[\\s\\S]*?<span class="card-count">)\\d+店掲載(<\\/span>)`,
    );
    html = html.replace(cardRe, `$1${count}店掲載$2`);
  }

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('  ✅ features/index.html: 店舗数を更新');
}

function updateSitemap(stores) {
  const today = new Date().toISOString().slice(0, 10);
  const baseUrl = 'https://wakuwaku-labs.github.io/nagoya-bites';

  // メインページ
  const urls = [
    { loc: `${baseUrl}/`, priority: '1.0', freq: 'weekly' },
  ];

  // 特集一覧
  urls.push({ loc: `${baseUrl}/features/`, priority: '0.9', freq: 'weekly' });

  // 各特集記事
  const featureFiles = fs.readdirSync(FEATURES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html');
  for (const f of featureFiles) {
    urls.push({ loc: `${baseUrl}/features/${f}`, priority: '0.8', freq: 'monthly' });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), xml, 'utf8');
  console.log(`  ✅ sitemap.xml: ${urls.length}ページ登録`);
}

// ─────────────────────────────────────────────
function main() {
  console.log('特集記事を自動更新中...');
  console.log('');

  const stores = readStores();
  console.log(`データ読み込み: ${stores.length}件`);
  console.log('');

  const results = {};
  for (const config of FEATURE_CONFIGS) {
    results[config.file] = updateFeatureArticle(stores, config);
  }

  console.log('');
  updateFeaturesIndex(results);
  updateSitemap(stores);

  console.log('');
  console.log('完了! 特集記事が最新データで更新されました。');
}

main();
