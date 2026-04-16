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
// 共通ヘルパー
// ─────────────────────────────────────────────

/** 名古屋市内エリアか判定（アクセス欄も含めた二重チェック） */
function isNagoyaArea(area, access) {
  if (!area) return false;
  const ngKeywords = ['名古屋','栄','錦','金山','大須','伏見','名駅','新栄',
    '千種','今池','池下','本山','覚王山','藤が丘','八事','鶴舞','御器所',
    '丸の内','熱田','神宮','瑞穂','天白','緑区','南区','中川','港区','守山',
    '大曽根','桜山','矢場町','上前津'];
  if (!ngKeywords.some(k => area.includes(k))) return false;
  // アクセス欄に他都市の鉄道名があれば偽データとして除外
  if (access) {
    const badAccess = ['東武','西武','京王','小田急','京急','京成','相鉄',
      'JR山手線','東京メトロ','都営','阪急','阪神','大阪メトロ','西鉄',
      'スカイツリー','獨協','川西能勢口','近鉄四日市'];
    if (badAccess.some(b => access.includes(b))) return false;
  }
  return true;
}

/** 居酒屋系ジャンルか */
function isIzakaya(genre) {
  return genre === '居酒屋';
}

/** おしゃれ・デート向きジャンルか（焼肉・ホルモンを明確に除外） */
function isFancyGenre(genre) {
  if (/焼肉|ホルモン|ラーメン|カラオケ|お好み焼き/.test(genre)) return false;
  return /イタリアン|フレンチ|ダイニングバー|バル|創作料理|バー・カクテル|カフェ|洋食/.test(genre);
}

/** 記念日・特別な日向きジャンルか */
function isCelebrationGenre(genre) {
  if (/焼肉|ホルモン|ラーメン|カラオケ|お好み焼き|中華/.test(genre)) return false;
  return /イタリアン|フレンチ|ダイニングバー|バル|創作料理|和食|カフェ|洋食/.test(genre);
}

/** 大箱チェーン店っぽいか（100名以上対応 = 大衆向け大箱の可能性高） */
function isMassMarket(tags) {
  return tags.includes('100名以上');
}

/** 価格帯から数値を推定 */
function estimatePrice(priceStr) {
  if (!priceStr) return 0;
  const nums = priceStr.match(/(\d{3,6})/g);
  if (!nums) return 0;
  return Math.max(...nums.map(Number));
}

/** 重複排除（店名の類似度で判定） */
function dedup(stores) {
  const seen = new Set();
  return stores.filter(s => {
    const name = (s['店名'] || '').replace(/\s+/g, '').replace(/　/g, '');
    // 完全一致チェック
    if (seen.has(name)) return false;
    seen.add(name);
    // ホットペッパーID重複チェック
    const hpid = s['ホットペッパーID'];
    if (hpid && seen.has('hp:' + hpid)) return false;
    if (hpid) seen.add('hp:' + hpid);
    return true;
  });
}

// ─────────────────────────────────────────────
// 特集記事の設定
// ─────────────────────────────────────────────
const FEATURE_CONFIGS = [
  {
    file: 'meieki.html',
    label: '名駅エリア',
    count: 15,
    filter: s => {
      const area = s['エリア'] || '';
      return area === '名古屋駅' || area.includes('名古屋駅') || area.includes('名駅')
        || area.includes('中村区') || area.includes('西区');
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    descGenerator: s => s['おすすめポイント'] || `名駅エリアの${s['ジャンル']}。`,
  },
  {
    file: 'sakae.html',
    label: '栄・錦エリア',
    count: 15,
    filter: s => {
      const area = s['エリア'] || '';
      return area === '栄' || area.includes('錦') || area.includes('栄')
        || area.includes('矢場町') || area.includes('東桜') || area.includes('新栄');
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    descGenerator: s => s['おすすめポイント'] || `栄エリアの${s['ジャンル']}。`,
  },
  {
    file: 'banquet.html',
    label: '宴会・忘年会',
    count: 15,
    filter: s => {
      const tags = s['タグ'] || '';
      // 大人数対応 or 宴会系タグ
      return (tags.includes('100名') || tags.includes('50〜') ||
              tags.includes('60〜') || tags.includes('70〜') ||
              tags.includes('80〜') || tags.includes('90〜') ||
              tags.includes('忘年会') || tags.includes('歓送迎会')) &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    descGenerator: s => s['おすすめポイント'] || `宴会対応の${s['ジャンル']}。`,
  },
  {
    file: 'private-room.html',
    label: '個室グルメ',
    count: 10,
    filter: s => {
      const tags = s['タグ'] || '';
      const score = parseFloat(s['Google評価']) || 0;
      // 厳格基準: 個室タグ + 評価4.0以上 + 大箱除外
      return tags.includes('個室') &&
             score >= 4.0 &&
             !isMassMarket(tags) &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    descGenerator: s => s['おすすめポイント'] || `個室完備の${s['ジャンル']}。`,
  },
  {
    file: 'birthday.html',
    label: '誕生日・記念日',
    count: 10,
    filter: s => {
      const tags = s['タグ'] || '';
      const genre = s['ジャンル'] || '';
      const score = parseFloat(s['Google評価']) || 0;
      const price = estimatePrice(s['価格帯']);
      const rec = (s['おすすめポイント'] || '').toLowerCase();
      // 厳格基準:
      // 1. 記念日ジャンル（イタリアン/フレンチ/ダイニング/和食/洋食/カフェ）のみ
      // 2. 焼肉・ホルモン・ラーメン・大衆系は完全除外
      // 3. 誕生日タグ or おすすめに「誕生日/記念日/サプライズ/ケーキ」含む
      // 4. 大箱チェーン店は除外
      // 5. Google評価3.5以上
      const hasAnniversarySignal = tags.includes('誕生日・記念日') ||
        /誕生日|記念日|サプライズ|ケーキ|anniversary|お祝い/.test(rec);
      return isCelebrationGenre(genre) &&
             hasAnniversarySignal &&
             !isMassMarket(tags) &&
             score >= 3.5 &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => {
      const sa = parseFloat(a['Google評価']) || 0;
      const sb = parseFloat(b['Google評価']) || 0;
      if (sb !== sa) return sb - sa;
      return estimatePrice(b['価格帯']) - estimatePrice(a['価格帯']);
    },
    descGenerator: s => s['おすすめポイント'] || `記念日におすすめの${s['ジャンル']}。`,
  },
  {
    file: 'date.html',
    label: 'デートディナー',
    count: 10,
    filter: s => {
      const genre = s['ジャンル'] || '';
      const tags = s['タグ'] || '';
      const price = estimatePrice(s['価格帯']);
      const score = parseFloat(s['Google評価']) || 0;
      // 厳格基準:
      // 1. おしゃれジャンルのみ（焼肉・ホルモン・ラーメン等は完全除外）
      // 2. Google評価4.0以上
      // 3. 価格帯4,000円以上（安すぎる店はデートに不向き）
      // 4. 大箱チェーン店は除外
      // 5. 個室 or 隠れ家 or 記念日タグがあると加点
      return isFancyGenre(genre) &&
             score >= 4.0 &&
             price >= 4000 &&
             !isMassMarket(tags) &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => {
      // スコアリング: 評価 + ジャンルボーナス + 特別な要素
      function dateScore(s) {
        let sc = (parseFloat(s['Google評価']) || 0) * 10;
        const tags = s['タグ'] || '';
        const rec = s['おすすめポイント'] || '';
        // 個室・隠れ家はデートに最適
        if (tags.includes('個室') || tags.includes('隠れ家')) sc += 3;
        // 記念日対応は加点
        if (tags.includes('誕生日・記念日')) sc += 2;
        // おすすめに雰囲気系ワードがあれば加点
        if (/雰囲気|おしゃれ|隠れ家|特別|デート|カップル|大人/.test(rec)) sc += 2;
        // 高級感のある価格帯は加点
        if (estimatePrice(s['価格帯']) >= 6000) sc += 1;
        return sc;
      }
      return dateScore(b) - dateScore(a);
    },
    descGenerator: s => s['おすすめポイント'] || `デートにおすすめの${s['ジャンル']}。`,
  },
  {
    file: 'girls-party.html',
    label: '女子会',
    count: 10,
    filter: s => {
      const tags = s['タグ'] || '';
      const genre = s['ジャンル'] || '';
      const score = parseFloat(s['Google評価']) || 0;
      // 厳格基準:
      // 1. 焼肉・ホルモン・ラーメン・大衆系は完全除外
      // 2. おしゃれジャンル or 女子会タグ
      // 3. 大箱チェーン店は除外
      // 4. Google評価4.0以上
      return (isFancyGenre(genre) || (tags.includes('女子会') && isCelebrationGenre(genre))) &&
             !isMassMarket(tags) &&
             score >= 4.0 &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    descGenerator: s => s['おすすめポイント'] || `女子会におすすめの${s['ジャンル']}。`,
  },
  {
    file: 'large-group.html',
    label: '大人数宴会',
    count: 10,
    filter: s => {
      const tags = s['タグ'] || '';
      return (tags.includes('100名') || tags.includes('80〜') ||
              tags.includes('90〜') || tags.includes('70〜')) &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    descGenerator: s => s['おすすめポイント'] || `大人数対応の${s['ジャンル']}。`,
  },
];

// ─────────────────────────────────────────────
// 店舗カード生成（写真付き）
// ─────────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getStoreUrl(store) {
  const hpid = store['ホットペッパーID'];
  if (hpid) return `https://www.hotpepper.jp/str${hpid}/`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store['店名'] + ' 名古屋')}`;
}

function getPhotoUrl(store) {
  // ホットペッパーの写真URLを優先（安定してる）
  const hp = store['写真URL'] || '';
  if (hp && hp.startsWith('https://imgfp.hotp.jp')) return hp;
  if (hp && hp.startsWith('http')) return hp;
  // 料理写真（IGベースは不安定なので避ける）
  return '';
}

function generateStoreCard(store, index, config) {
  const num = String(index + 1).padStart(2, '0');
  const name = escapeHtml(store['店名']);
  const genre = escapeHtml(store['ジャンル'] || '');
  const area = escapeHtml(store['エリア'] || '');
  const score = store['Google評価'];
  const price = escapeHtml(store['価格帯'] || '');
  const desc = escapeHtml(config.descGenerator(store));
  const tags = (store['タグ'] || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 3);
  const url = getStoreUrl(store);
  const photo = getPhotoUrl(store);

  const scoreMeta = score ? `<span class="score">★ ${escapeHtml(score)}</span>` : '';
  const priceMeta = price ? `<span>${price}</span>` : '';
  const tagsHtml = tags.map(t => `<span class="store-tag">${escapeHtml(t)}</span>`).join('');

  const photoHtml = photo
    ? `<div class="store-photo"><img src="${escapeHtml(photo)}" alt="${name}" loading="lazy" width="160" height="120"></div>`
    : '';

  return `      <div class="store-card">
        <div class="store-num">${num}</div>
        ${photoHtml}
        <div class="store-info">
          <div class="store-name">${name}</div>
          <div class="store-meta"><span>${area}</span><span>${genre}</span>${scoreMeta}${priceMeta}</div>
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
// CSS追加: 写真表示用スタイル
// ─────────────────────────────────────────────
const PHOTO_CSS = `
.store-photo{flex-shrink:0;width:160px;height:120px;border-radius:4px;overflow:hidden;background:var(--bg2);}
.store-photo img{width:100%;height:100%;object-fit:cover;}
@media(max-width:640px){.store-photo{width:100%;height:180px;}}`;

function ensurePhotoCSS(html) {
  if (html.includes('.store-photo')) return html;
  // </style> の直前に挿入
  return html.replace('</style>', PHOTO_CSS + '\n</style>');
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

  // 1. フィルタ・重複排除・ソート
  const filtered = dedup(stores.filter(config.filter)).sort(config.sort).slice(0, config.count);
  if (filtered.length === 0) {
    console.log(`  ⚠ ${config.file}: 該当店舗0件（スキップ）`);
    return null;
  }

  // 2. 写真CSS追加
  html = ensurePhotoCSS(html);

  // 3. 店舗カードHTML生成
  const cardsHtml = filtered.map((s, i) => generateStoreCard(s, i, config)).join('\n\n');

  // 4. store-list を差し替え（汎用: store-listの開始タグから、最後のstore-cardの閉じタグまで）
  const storeListStart = html.indexOf('<div class="store-list">');
  if (storeListStart === -1) {
    console.log(`    ⚠ store-list が見つかりません`);
    return null;
  }
  // store-list 開始タグの次の行から、最後の store-card 閉じdivの後の </div>（= store-list閉じ）まで
  // store-list の閉じタグを探す: store-list開始後、store-card を全部含んだ最初の </div>\n    </div> or </div>\n  </div>
  const afterStart = storeListStart + '<div class="store-list">'.length;
  // store-list内の最後の </div> を見つける: 次の section-label, tips-box, related, </article>, </div>\n</article> のいずれかの前
  const endMarkers = ['<div class="tips-box" style', '<div class="related">', '</article>', '<div class="tips-box">'];
  let storeListEnd = -1;
  for (const marker of endMarkers) {
    const idx = html.indexOf(marker, afterStart);
    if (idx !== -1 && (storeListEnd === -1 || idx < storeListEnd)) {
      storeListEnd = idx;
    }
  }
  if (storeListEnd === -1) storeListEnd = html.length;
  // storeListEndの手前にある </div> の位置を見つける（store-listの閉じタグ）
  const beforeEnd = html.lastIndexOf('</div>', storeListEnd);
  if (beforeEnd > afterStart) {
    // store-list 開始タグ + 中身 + 閉じタグ を差し替え
    const closingDiv = html.lastIndexOf('</div>', beforeEnd - 1);
    // シンプルに: store-list開始から endMarker直前の空白まで丸ごと差し替え
    const replaceEnd = storeListEnd;
    const prefix = html.substring(0, storeListStart);
    const suffix = html.substring(replaceEnd);
    html = prefix + `<div class="store-list">\n\n${cardsHtml}\n\n    </div>\n  </div>\n\n` + suffix;
  }

  // 5. ItemList JSON-LD を差し替え
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
  for (const [file, count] of Object.entries(results)) {
    if (count === null) continue;
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
  const urls = [
    { loc: `${baseUrl}/`, priority: '1.0', freq: 'weekly' },
    { loc: `${baseUrl}/faq.html`, priority: '0.7', freq: 'monthly' },
  ];
  urls.push({ loc: `${baseUrl}/features/`, priority: '0.9', freq: 'weekly' });
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
  console.log('完了!');
}

main();
