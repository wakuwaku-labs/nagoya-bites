'use strict';
/**
 * build.js
 * Google SheetsのCSVを取得してindex.htmlにデータを静的埋め込みし、
 * SEOクロール用の店舗リストHTMLも生成する
 *
 * 2026-04-15 追加: Hot Pepper Gourmet API から名古屋の店舗を自動取得
 *   - Google Sheetsを優先し、ホットペッパーIDで重複排除
 *   - 重複していない新規店舗のみを追加
 *   - HOTPEPPER_API_KEY 環境変数が未設定の場合はスキップ
 */
const https = require('https');
const fs   = require('fs');
const path = require('path');

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ/export?format=csv&gid=415662614';
const HTML    = path.join(__dirname, 'index.html');
const HP_API_KEY = process.env.HOTPEPPER_API_KEY || '';
const HP_BASE = 'https://webservice.recruit.co.jp/hotpepper';

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

async function fetchJson(url) {
  const text = await fetchUrl(url);
  return JSON.parse(text);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = [];
  let cur = '', inQ = false;
  for (const ch of lines[0]) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { headers.push(cur.trim().replace(/^"|"$/g,'')); cur = ''; }
    else { cur += ch; }
  }
  headers.push(cur.trim().replace(/^"|"$/g,''));

  const stores = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = []; cur = ''; inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim().replace(/^"|"$/g,'')); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim().replace(/^"|"$/g,''));
    if (!cols[0]) continue;
    const store = {};
    headers.forEach((h, j) => { store[h] = (cols[j] || '').trim(); });
    stores.push(store);
  }
  return stores;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ────────────────────────────────────────────────────
// Hot Pepper Gourmet API 連携
// ────────────────────────────────────────────────────

// 名古屋市内判定に使うmiddle_area名キーワード
const NAGOYA_KEYWORDS = [
  '名古屋','栄','大須','金山','伏見','熱田','今池','新栄','千種','鶴舞',
  '丸の内','藤が丘','八事','星ヶ丘','本山','御器所','一社','上社','桜山',
  '矢場町','覚王山','池下','吹上','名東','昭和','瑞穂','守山','中川','港','中村'
];

async function fetchNagoyaMiddleAreas() {
  const url = `${HP_BASE}/middle_area/v1/?key=${HP_API_KEY}&service_area=SA22&format=json`;
  const data = await fetchJson(url);
  const areas = (data.results && data.results.middle_area) || [];
  return areas.filter(ma => NAGOYA_KEYWORDS.some(k => (ma.name || '').includes(k)));
}

async function fetchShopsByMiddleArea(middleAreaCode, middleAreaName) {
  const shops = [];
  // Hot Pepper APIは1リクエスト最大100件、startで最大1000件までページング可能
  for (let start = 1; start <= 901; start += 100) {
    const url = `${HP_BASE}/gourmet/v1/?key=${HP_API_KEY}&middle_area=${middleAreaCode}&format=json&count=100&start=${start}`;
    try {
      const data = await fetchJson(url);
      const arr = (data.results && data.results.shop) || [];
      shops.push(...arr);
      if (arr.length < 100) break;
    } catch (e) {
      console.error(`  ${middleAreaName} start=${start} エラー: ${e.message}`);
      break;
    }
  }
  return shops;
}

function hpShopToStoreRecord(shop) {
  const name = shop.name || '';
  const areaName = (shop.middle_area && shop.middle_area.name) || (shop.small_area && shop.small_area.name) || '';
  const genre = (shop.genre && shop.genre.name) || '';
  const address = shop.address || '';
  const prefMatch = address.match(/^(.+?[都道府県])/);
  const pref = prefMatch ? prefMatch[1] : '愛知県';
  const budget = (shop.budget && shop.budget.name) || '';
  const photo = (shop.photo && shop.photo.pc && (shop.photo.pc.l || shop.photo.pc.m || shop.photo.pc.s)) || '';
  const searchQ = encodeURIComponent(name + ' ' + (areaName || '名古屋'));
  return {
    '店名': name,
    '英語名': '',
    'ジャンル': genre,
    'エリア': areaName,
    '都道府県': pref,
    '価格帯': budget,
    '営業時間': shop.open || '',
    'アクセス': shop.access || '',
    'ホットペッパーID': shop.id || '',
    '写真URL': photo,
    'Instagram': '',
    '食べログURL': '',
    'TikTok検索': `https://www.tiktok.com/search?q=${searchQ}`,
    'X検索': `https://x.com/search?q=${searchQ}`,
    '公開フラグ': 'TRUE',
    '備考': '',
    'タグ': '',
    'Google評価': '',
    'Instagram投稿URL': '',
    'おすすめポイント': '',
    '内観写真URL': '',
    '料理写真URL1': '',
    '料理写真URL2': ''
  };
}

async function fetchHotPepperNagoyaStores() {
  if (!HP_API_KEY) {
    console.log('HOTPEPPER_API_KEY未設定のためHot Pepper取得をスキップ');
    return [];
  }
  console.log('Hot Pepper API: 名古屋エリアのmiddle_area一覧を取得中...');
  const middleAreas = await fetchNagoyaMiddleAreas();
  console.log(`  対象middle_area: ${middleAreas.length}件`);
  const allShops = [];
  for (const ma of middleAreas) {
    const shops = await fetchShopsByMiddleArea(ma.code, ma.name);
    console.log(`  ${ma.name} (${ma.code}): ${shops.length}件`);
    allShops.push(...shops);
  }
  console.log(`Hot Pepper 合計: ${allShops.length}件取得`);
  return allShops;
}

// ────────────────────────────────────────────────────
// main
// ────────────────────────────────────────────────────

async function main() {
  console.log('CSVを取得中...');
  const csv = await fetchUrl(CSV_URL);
  const gsStores = parseCSV(csv).filter(s => s['公開フラグ'] !== 'FALSE');
  console.log(`Google Sheets: ${gsStores.length}件`);

  // Hot Pepperから名古屋店舗取得
  let hpShops = [];
  try {
    hpShops = await fetchHotPepperNagoyaStores();
  } catch (e) {
    console.error(`Hot Pepper取得エラー: ${e.message}`);
  }

  // 重複排除（Google Sheets優先、ホットペッパーIDで照合）
  const existingHpIds = new Set(
    gsStores.map(s => s['ホットペッパーID']).filter(Boolean)
  );
  const seen = new Set(existingHpIds);
  const newStores = [];
  let dupCount = 0;
  let outsideCount = 0;
  for (const shop of hpShops) {
    if (!shop.id) continue;
    if (seen.has(shop.id)) { dupCount++; continue; }
    // 名古屋市外は除外（「名古屋」を含むmiddle_areaでも周辺市を含む場合あり）
    if (!(shop.address || '').includes('名古屋市')) { outsideCount++; continue; }
    seen.add(shop.id);
    newStores.push(hpShopToStoreRecord(shop));
  }
  console.log(`Hot Pepper 新規: ${newStores.length}件（重複除外:${dupCount} / 名古屋市外除外:${outsideCount}）`);

  // 結合（Google Sheets → Hot Pepper新規の順）
  const stores = gsStores.concat(newStores);
  console.log(`合計: ${stores.length}件`);

  // 1. LOCAL_STORESを全店舗データで置き換え
  let html = fs.readFileSync(HTML, 'utf8');
  const jsonStr = JSON.stringify(stores);
  html = html.replace(
    /var LOCAL_STORES = \[[\s\S]*?\];/,
    `var LOCAL_STORES = ${jsonStr};`
  );

  // 2. SEOクロール用の隠しリスト（noscript内に店舗名・エリア・ジャンルを列挙）
  const noscriptItems = stores.map(s =>
    `<li><a href="${escapeHtml('https://wakuwaku-labs.github.io/nagoya-bites/')}">${escapeHtml(s['店名'])}（${escapeHtml(s['エリア'] || '')} ${escapeHtml(s['ジャンル'] || '')}）</a></li>`
  ).join('\n');
  const noscriptHtml = `<noscript><ul id="seo-store-list">\n${noscriptItems}\n</ul></noscript>`;

  // 既存のnoscriptブロックを置き換え or 挿入
  if (html.includes('<noscript><ul id="seo-store-list">')) {
    html = html.replace(/<noscript><ul id="seo-store-list">[\s\S]*?<\/ul><\/noscript>/, noscriptHtml);
  } else {
    html = html.replace('<div id="grid">', noscriptHtml + '\n<div id="grid">');
  }

  // 3. lastmod を今日の日付に更新
  const today = new Date().toISOString().slice(0, 10);
  html = html.replace(
    /<meta name="revised" content="[^"]*">/,
    `<meta name="revised" content="${today}">`
  );

  fs.writeFileSync(HTML, html, 'utf8');
  console.log('index.html 更新完了');

  // 4. sitemap.xmlの lastmod を更新
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://wakuwaku-labs.github.io/nagoya-bites/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap, 'utf8');
  console.log('sitemap.xml 更新完了');
}

main().catch(e => { console.error(e.message); process.exit(1); });
