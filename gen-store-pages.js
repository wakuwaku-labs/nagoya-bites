'use strict';
/**
 * gen-store-pages.js
 * Google Sheets CSV から各店舗の静的HTMLページを生成する
 *
 * 出力先: stores/{hotpepper-id}.html  (HP IDがない場合は sanitized-name)
 * 実行方法: node gen-store-pages.js
 *
 * これにより Google が 1 ページではなく 1000+ ページとしてインデックスできる
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const CSV_URL     = 'https://docs.google.com/spreadsheets/d/1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ/export?format=csv&gid=415662614';
const BASE_URL    = 'https://wakuwaku-labs.github.io/nagoya-bites';
const OUT_DIR     = path.join(__dirname, 'stores');
const SITEMAP_OUT = path.join(__dirname, 'sitemap.xml');

// ================================================================
// HTTP 取得
// ================================================================
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ================================================================
// CSV パース
// ================================================================
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = parseLine(lines[0]);
  const stores = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseLine(lines[i]);
    if (!cols[0]) continue;
    const store = {};
    headers.forEach((h, j) => { store[h] = (cols[j] || '').trim(); });
    stores.push(store);
  }
  return stores;
}

function parseLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { cols.push(cur.trim().replace(/^"|"$/g, '')); cur = ''; }
    else { cur += ch; }
  }
  cols.push(cur.trim().replace(/^"|"$/g, ''));
  return cols;
}

// ================================================================
// スラグ生成
// ================================================================
function toSlug(store) {
  if (store['ホットペッパーID']) return store['ホットペッパーID'];
  // 英語名があればそれを使う
  if (store['英語名']) {
    return store['英語名'].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  // 店名をローマ字風に変換（ASCII文字だけ抽出 + ホットペッパーIDでフォールバック）
  const ascii = store['店名'].replace(/[^\x00-\x7F]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (ascii.length >= 3) return ascii;
  // 最終手段: 店名のUnicode codepoint
  return 'store-' + Buffer.from(store['店名'], 'utf8').toString('hex').slice(0, 16);
}

// ================================================================
// 価格帯を Schema.org priceRange シンボルにマップ
// ================================================================
function mapPriceToSchemaRange(price) {
  if (!price) return '';
  const nums = price.match(/(\d{3,6})/g);
  if (!nums) return '';
  const max = Math.max(...nums.map(Number));
  if (max >= 15000) return '¥¥¥¥';
  if (max >= 8000)  return '¥¥¥';
  if (max >= 3500)  return '¥¥';
  return '¥';
}

// ================================================================
// タグ/エリア → 関連特集ページの逆引きマッピング
// ================================================================
const TAG_TO_FEATURES = [
  { match: s => (s['タグ']||'').includes('個室'),           file: 'private-room.html', label: '個室のある名古屋グルメ10選' },
  { match: s => (s['タグ']||'').includes('接待'),           file: 'private-room.html', label: '個室のある名古屋グルメ10選' },
  { match: s => /30〜|40〜|50〜|60〜|70〜|80〜|90〜|100名/.test(s['タグ']||'') || (s['タグ']||'').includes('忘年会') || (s['タグ']||'').includes('歓送迎会') || (s['タグ']||'').includes('飲み放題'), file: 'banquet.html', label: '名古屋の宴会・忘年会15選' },
  { match: s => (s['タグ']||'').includes('100名') || /70〜|80〜|90〜/.test(s['タグ']||''), file: 'large-group.html', label: '名古屋・大人数宴会20人以上10選' },
  { match: s => (s['タグ']||'').includes('誕生日・記念日') || /誕生日|記念日|サプライズ/.test(s['おすすめポイント']||''), file: 'birthday.html', label: '名古屋・誕生日/記念日ディナー10選' },
  { match: s => (s['タグ']||'').includes('女子会'),         file: 'girls-party.html', label: '名古屋・女子会ランチ&ディナー10選' },
  { match: s => /イタリアン|フレンチ|ダイニングバー|バル|創作料理/.test(s['ジャンル']||''), file: 'date.html', label: '名古屋・デートディナー10選' },
  { match: s => /名古屋駅|名駅|中村区/.test(s['エリア']||''), file: 'meieki.html', label: '名駅グルメ15選' },
  { match: s => /栄|錦|矢場町|東桜|新栄/.test(s['エリア']||''), file: 'sakae.html', label: '栄グルメ15選' },
];

function buildRelatedFeatures(store) {
  const hits = [];
  const seen = new Set();
  for (const entry of TAG_TO_FEATURES) {
    if (seen.has(entry.file)) continue;
    if (entry.match(store)) {
      hits.push(entry);
      seen.add(entry.file);
    }
    if (hits.length >= 3) break;
  }
  return hits;
}

// ================================================================
// メタ説明文生成
// ================================================================
function buildDescription(s) {
  const point = s['おすすめポイント'] || '';
  const genre = s['ジャンル'] || '';
  const area  = s['エリア'] || '';
  const price = s['価格帯'] || '';
  if (point) return `${point}。${area}の${genre}（${price}）。Instagram・ホットペッパー・食べログをまとめてチェック。`;
  return `${area}の${genre}「${s['店名']}」の情報まとめ。${price}。Instagram・ホットペッパー・食べログ・Googleマップをワンクリックで確認。NAGOYA BITES掲載。`;
}

// ================================================================
// HTML テンプレート
// ================================================================
function renderStorePage(s, slug) {
  const name     = s['店名'] || '';
  const genre    = s['ジャンル'] || '';
  const area     = s['エリア'] || '';
  const pref     = s['都道府県'] || '愛知県';
  const locality = s['市区町村'] || '';
  const street   = s['住所'] || '';
  const lat      = s['緯度'] || '';
  const lng      = s['経度'] || '';
  const tel      = s['電話'] || '';
  const price    = s['価格帯'] || '';
  const hours    = s['営業時間'] || '';
  const access   = s['アクセス'] || '';
  const score    = s['Google評価'] || '';
  const reviewCountRaw = parseInt(s['口コミ数'] || '', 10);
  const reviewCount    = Number.isFinite(reviewCountRaw) && reviewCountRaw > 0 ? reviewCountRaw : 0;
  const point    = s['おすすめポイント'] || '';
  const tags     = (s['タグ'] || '').split(',').map(t => t.trim()).filter(Boolean);
  const photo    = s['写真URL'] || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80';
  const hpId     = s['ホットペッパーID'] || '';
  const hpUrl    = hpId ? `https://www.hotpepper.jp/str${hpId}/` : '';
  const igUrl    = s['Instagram'] || '';
  const tbUrl    = s['食べログURL'] || '';
  const tkUrl    = s['TikTok検索'] || '';
  const xUrl     = s['X検索'] || '';
  const gmUrl    = `https://www.google.com/maps/search/${encodeURIComponent(name + ' ' + area)}`;
  const pageUrl  = `${BASE_URL}/stores/${slug}.html`;
  const title    = `${name}（${area}・${genre}）| NAGOYA BITES`;
  const desc     = buildDescription(s);
  const priceRangeSym = mapPriceToSchemaRange(price);

  // Restaurant JSON-LD — aggregateRating は実データ(口コミ数が正の整数)のみ出力
  const address = {
    '@type': 'PostalAddress',
    'addressRegion': pref,
    'addressCountry': 'JP'
  };
  if (locality) address.addressLocality = locality;
  else if (area) address.addressLocality = area;
  if (street) address.streetAddress = street;
  if (area && locality && area !== locality) address.addressArea = area;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    'name': name,
    'servesCuisine': genre,
    'address': address,
    'image': photo,
    'url': pageUrl,
    'description': point || `${area}の${genre}。${access}`
  };
  if (priceRangeSym) jsonLd.priceRange = priceRangeSym;
  else if (price) jsonLd.priceRange = price;
  if (hours) jsonLd.openingHours = hours;
  if (tel) jsonLd.telephone = tel;
  if (lat && lng) {
    jsonLd.geo = { '@type': 'GeoCoordinates', 'latitude': lat, 'longitude': lng };
  }
  if (hpUrl) jsonLd.acceptsReservations = true;
  const sameAs = [];
  if (igUrl) sameAs.push(igUrl);
  if (tbUrl) sameAs.push(tbUrl);
  if (hpUrl) sameAs.push(hpUrl);
  if (sameAs.length) jsonLd.sameAs = sameAs;
  if (score) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      'ratingValue': score,
      'bestRating': '5',
      ...(reviewCount > 0 ? { 'ratingCount': String(reviewCount) } : {})
    };
  }

  // BreadcrumbList JSON-LD
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'NAGOYA BITES', 'item': BASE_URL + '/' },
      ...(genre ? [{ '@type': 'ListItem', 'position': 2, 'name': genre, 'item': `${BASE_URL}/#genre=${encodeURIComponent(genre)}` }] : []),
      ...(area  ? [{ '@type': 'ListItem', 'position': genre ? 3 : 2, 'name': area + 'エリア', 'item': `${BASE_URL}/#area=${encodeURIComponent(area)}` }] : []),
      { '@type': 'ListItem', 'position': (genre ? 1 : 0) + (area ? 1 : 0) + 2, 'name': name, 'item': pageUrl }
    ]
  };

  // 関連特集(最大3本)
  const relatedFeatures = buildRelatedFeatures(s);
  const relatedHtml = relatedFeatures.length ? `
  <div class="related-features">
    <h2>この店舗が登場する特集</h2>
    <ul>
      ${relatedFeatures.map(f => `<li><a href="../features/${f.file}">${f.label}</a></li>`).join('\n      ')}
    </ul>
  </div>` : '';

  const tagPills = tags.map(t => `<span class="tag">${t}</span>`).join('');
  const linksHtml = [
    hpUrl && `<a class="link-btn hp" href="${hpUrl}" target="_blank" rel="noopener">🌶 ホットペッパーで予約</a>`,
    gmUrl && `<a class="link-btn gm" href="${gmUrl}" target="_blank" rel="noopener">📍 Googleマップ</a>`,
    igUrl && `<a class="link-btn ig" href="${igUrl}" target="_blank" rel="noopener">📸 Instagram</a>`,
    tbUrl && `<a class="link-btn tb" href="${tbUrl}" target="_blank" rel="noopener">🍽 食べログ</a>`,
    tkUrl && tkUrl !== '#' && `<a class="link-btn tk" href="${tkUrl}" target="_blank" rel="noopener">🎵 TikTok</a>`,
    xUrl  && xUrl  !== '#' && `<a class="link-btn xx" href="${xUrl}" target="_blank" rel="noopener">𝕏 X</a>`,
  ].filter(Boolean).join('\n    ');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-3LCZNGZPWJ"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-3LCZNGZPWJ');
function trackEvent(name,params){if(typeof gtag==='function')gtag('event',name,params||{});}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href')||'';if(!/^https?:\/\//i.test(href))return;try{var h=new URL(href,location.href).hostname;if(h===location.hostname)return;trackEvent('outbound_click',{link_url:href,link_domain:h,link_text:(a.innerText||a.textContent||'').trim().slice(0,80)});}catch(err){}},true);
</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc.replace(/"/g, '&quot;')}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc.replace(/"/g, '&quot;')}">
<meta property="og:type" content="restaurant">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${photo}">
<meta property="og:site_name" content="NAGOYA BITES">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc.replace(/"/g, '&quot;')}">
<meta name="twitter:image" content="${photo}">
<link rel="manifest" href="../manifest.json">
<meta name="theme-color" content="#7a5c10">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Noto+Sans+JP:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify([jsonLd, breadcrumbLd], null, 2)}</script>
<style>
:root{--bg:#f7f5f1;--bg2:#eeebe5;--surface:#e5e2db;--border:rgba(0,0,0,0.1);--border-h:rgba(0,0,0,0.28);--text:#1c1c1a;--muted:rgba(28,28,26,0.6);--dim:rgba(28,28,26,0.38);--gold:#7a5c10;--gold2:#96720f;--white:#0a0a08;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Noto Sans JP',sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;min-height:100vh;}
header{position:sticky;top:0;z-index:100;padding:0 1.5rem;height:56px;display:flex;align-items:center;justify-content:space-between;background:rgba(247,245,241,.97);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);}
.logo{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:1.1rem;letter-spacing:.3em;color:var(--white);text-decoration:none;text-transform:uppercase;}
.logo em{font-style:italic;color:var(--gold);}
.back-link{font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.14em;color:var(--muted);text-decoration:none;text-transform:uppercase;transition:color .2s;}
.back-link:hover{color:var(--gold);}
.hero-img{width:100%;height:260px;object-fit:cover;filter:brightness(.88) saturate(.85);display:block;}
@media(min-width:768px){.hero-img{height:380px;}}
.container{max-width:720px;margin:0 auto;padding:2rem 1.5rem 4rem;}
.breadcrumb{font-family:'DM Mono',monospace;font-size:.55rem;letter-spacing:.1em;color:var(--dim);margin-bottom:1.6rem;display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;}
.breadcrumb a{color:var(--dim);text-decoration:none;transition:color .2s;}
.breadcrumb a:hover{color:var(--gold);}
.breadcrumb span{color:var(--dim);opacity:.5;}
.genre-badge{display:inline-block;font-family:'DM Mono',monospace;font-size:.54rem;letter-spacing:.14em;color:var(--gold);border:1px solid rgba(201,169,110,.4);padding:.2rem .55rem;text-transform:uppercase;background:rgba(122,92,16,.06);margin-bottom:.9rem;}
h1{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(1.8rem,5vw,2.8rem);line-height:1.15;color:var(--white);margin-bottom:.6rem;}
.score{display:inline-flex;align-items:center;gap:.3rem;font-size:.85rem;font-weight:600;color:#d4a017;margin-bottom:1.2rem;}
.score svg{width:14px;height:14px;fill:#d4a017;}
.point-box{background:rgba(122,92,16,.07);border-left:3px solid var(--gold);border-radius:0 4px 4px 0;padding:.9rem 1.1rem;margin-bottom:1.6rem;}
.point-box p{font-size:.85rem;line-height:1.9;color:var(--text);}
.info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin-bottom:1.6rem;padding:1.2rem;background:var(--bg2);border:1px solid var(--border);}
@media(max-width:480px){.info-grid{grid-template-columns:1fr;}}
.info-cell label{font-family:'DM Mono',monospace;font-size:.5rem;letter-spacing:.18em;color:var(--dim);text-transform:uppercase;display:block;margin-bottom:.3rem;}
.info-cell span{font-size:.8rem;color:var(--text);line-height:1.5;}
.tags{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1.6rem;}
.tag{font-size:.62rem;letter-spacing:.06em;color:var(--muted);border:1px solid var(--border);padding:.2rem .55rem;border-radius:2px;background:var(--surface);}
.links-section{margin-bottom:2rem;}
.links-section h2{font-family:'DM Mono',monospace;font-size:.56rem;letter-spacing:.2em;color:var(--dim);text-transform:uppercase;margin-bottom:.9rem;}
.link-btn{display:inline-flex;align-items:center;gap:.4rem;padding:.65rem 1.1rem;font-size:.72rem;letter-spacing:.05em;text-decoration:none;border:1px solid var(--border);border-radius:2px;color:var(--text);background:var(--bg2);transition:all .2s;margin:.25rem .3rem .25rem 0;}
.link-btn:hover{border-color:var(--border-h);background:var(--surface);}
.link-btn.hp{background:#e6002d;color:#fff;border-color:#e6002d;}
.link-btn.hp:hover{background:#c0001f;border-color:#c0001f;}
.related-features{margin:2rem 0 1.8rem;padding:1.3rem 1.1rem;background:var(--bg2);border:1px solid var(--border);border-radius:3px;}
.related-features h2{font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.18em;color:var(--dim);text-transform:uppercase;margin-bottom:.9rem;}
.related-features ul{list-style:none;padding:0;margin:0;}
.related-features li{margin:.5rem 0;}
.related-features a{font-size:.82rem;color:var(--gold);text-decoration:none;border-bottom:1px solid rgba(122,92,16,.25);padding-bottom:2px;transition:color .2s;}
.related-features a:hover{color:var(--gold2);border-bottom-color:var(--gold2);}
.back-section{border-top:1px solid var(--border);padding-top:1.8rem;text-align:center;}
.back-section a{font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.16em;color:var(--muted);text-decoration:none;text-transform:uppercase;transition:color .2s;}
.back-section a:hover{color:var(--gold);}
footer{border-top:1px solid var(--border);padding:1.5rem;text-align:center;}
.fc{font-family:'DM Mono',monospace;font-size:.54rem;letter-spacing:.1em;color:var(--dim);}
</style>
</head>
<body>
<header>
  <a class="logo" href="../">Nagoya <em>Bites</em></a>
  <a class="back-link" href="../">← 店舗一覧に戻る</a>
</header>

<img class="hero-img" src="${photo}" alt="${name}" onerror="this.src='https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80'">

<div class="container">
  <nav class="breadcrumb" aria-label="パンくずリスト">
    <a href="../">NAGOYA BITES</a>
    ${genre ? `<span>›</span><a href="../#genre=${encodeURIComponent(genre)}">${genre}</a>` : ''}
    ${area  ? `<span>›</span><a href="../#area=${encodeURIComponent(area)}">${area}</a>` : ''}
    <span>›</span>
    <span>${name}</span>
  </nav>

  <div class="genre-badge">${genre}</div>
  <h1>${name}</h1>
  ${score ? `<div class="score"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${score}</div>` : ''}

  ${point ? `<div class="point-box"><p>${point}</p></div>` : ''}

  <div class="info-grid">
    ${area ? `<div class="info-cell"><label>エリア</label><span>${pref}${locality ? ' ' + locality : ''} ${area}</span></div>` : ''}
    ${street ? `<div class="info-cell"><label>住所</label><span>${street}</span></div>` : ''}
    ${price ? `<div class="info-cell"><label>価格帯</label><span>${price}</span></div>` : ''}
    ${hours ? `<div class="info-cell"><label>営業時間</label><span>${hours}</span></div>` : ''}
    ${tel ? `<div class="info-cell"><label>電話</label><span><a href="tel:${tel.replace(/[^0-9+]/g,'')}" style="color:var(--gold);text-decoration:none;">${tel}</a></span></div>` : ''}
    ${access ? `<div class="info-cell"><label>アクセス・特徴</label><span>${access}</span></div>` : ''}
  </div>

  ${tagPills ? `<div class="tags">${tagPills}</div>` : ''}

  <div class="links-section">
    <h2>予約・情報を確認</h2>
    ${linksHtml}
  </div>

  ${relatedHtml}

  <div class="back-section">
    <a href="../?area=${encodeURIComponent(area)}&genre=${encodeURIComponent(genre)}">← ${area}の${genre}をもっと見る</a>
  </div>
</div>

<footer>
  <p class="fc">© <span id="yr"></span> NAGOYA BITES — 現役飲食店経営者監修 名古屋グルメガイド</p>
</footer>
<script>document.getElementById('yr').textContent = new Date().getFullYear();</script>
</body>
</html>`;
}

// ================================================================
// sitemap.xml 生成
// ================================================================
function buildSitemap(slugs) {
  const today = new Date().toISOString().slice(0, 10);
  const storeUrls = slugs.map(slug =>
    `  <url>\n    <loc>${BASE_URL}/stores/${slug}.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/about.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
${storeUrls}
</urlset>`;
}

// ================================================================
// メイン
// ================================================================
async function main() {
  console.log('Google Sheets からデータ取得中...');
  const csv = await fetchUrl(CSV_URL);
  const stores = parseCSV(csv);
  // 公開フラグが「非公開」や「0」のものを除外
  const visible = stores.filter(s => {
    const flag = (s['公開フラグ'] || '').trim();
    return flag !== '非公開' && flag !== '0' && flag !== 'false';
  });
  console.log(`取得: ${stores.length}件 → 公開対象: ${visible.length}件`);

  // stores/ ディレクトリ作成
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const slugs = [];
  const slugsSeen = new Set();
  let generated = 0;
  let skipped = 0;

  for (const s of visible) {
    if (!s['店名']) { skipped++; continue; }
    let slug = toSlug(s);
    // 重複スラグ対策
    let uniqueSlug = slug;
    let counter = 2;
    while (slugsSeen.has(uniqueSlug)) {
      uniqueSlug = `${slug}-${counter++}`;
    }
    slugsSeen.add(uniqueSlug);
    slugs.push(uniqueSlug);

    const html = renderStorePage(s, uniqueSlug);
    fs.writeFileSync(path.join(OUT_DIR, `${uniqueSlug}.html`), html, 'utf8');
    generated++;
    if (generated % 100 === 0) process.stdout.write(`\r  ${generated}件生成済み...`);
  }

  console.log(`\n\n店舗ページ生成完了: ${generated}件 (スキップ: ${skipped}件)`);

  // sitemap.xml 更新
  const sitemapXml = buildSitemap(slugs);
  fs.writeFileSync(SITEMAP_OUT, sitemapXml, 'utf8');
  console.log(`sitemap.xml 更新完了: ${slugs.length + 2}件のURL`);
  console.log(`\n次のステップ:`);
  console.log(`  git add stores/ sitemap.xml && git commit -m "店舗別SEOページを生成 (${generated}件)" && git push`);
}

main().catch(err => { console.error('エラー:', err); process.exit(1); });
