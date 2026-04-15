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
// ロケーション品質フィルタ（全データ共通）
// ────────────────────────────────────────────────────

// 明らかに他都市の駅名・地名（これが含まれたら名古屋ではない）
const NON_NAGOYA_BLACKLIST = [
  // 東京23区
  '上野','新宿','渋谷','池袋','品川','秋葉原','浅草','銀座','六本木',
  '恵比寿','原宿','表参道','神田','有楽町','日比谷','赤坂','青山','代官山',
  '中目黒','自由が丘','二子玉川','お台場','豊洲','月島','門前仲町','錦糸町',
  '蒲田','五反田','目黒','大崎','御徒町','新橋','虎ノ門','霞ヶ関','永田町',
  '水道橋','御茶ノ水','後楽園','押上','北千住','上井草','武蔵小杉',
  // 東京多摩
  '立川','吉祥寺','町田','府中','調布','久米川','東村山','国分寺','八王子',
  '多摩センター','拝島','三鷹','武蔵境',
  // 東京の鉄道
  '西武新宿線','西武池袋線','京王線','小田急線','京成','都営','東京メトロ',
  '東西線','千代田線','日比谷線','半蔵門線','銀座線','丸ノ内線','南北線',
  '有楽町線','副都心線','浅草線','三田線','大江戸線','新宿線',
  // 神奈川
  '横浜','川崎','武蔵','桜木町','みなとみらい','関内','戸塚','大船','藤沢',
  '川崎駅','鶴見','新横浜','相鉄',
  // 大阪・京都・神戸・福岡・札幌
  '大阪','梅田','難波','心斎橋','天王寺','京橋','本町','江坂','堺',
  '京都市','四条河原町','四条烏丸','烏丸御池','祇園','嵐山',
  '神戸','三宮','元町','福岡','博多','天神','中洲','札幌','大通','仙台',
  // 埼玉・千葉
  '大宮','浦和','川口','所沢','和光','春日部','川越',
  '千葉','船橋','柏','松戸','市川','幕張','舞浜',
  // 愛知県内だが名古屋市外（名古屋限定を維持するため除外）
  '岡崎','豊田','豊橋','一宮','春日井','刈谷','知立','安城','碧南','瀬戸',
  '小牧','犬山','稲沢','半田','西尾','蒲郡','新城','田原','常滑','東海',
  '大府','尾張旭','日進','豊川','長久手',
  // 三重県
  '四日市','津市','鈴鹿','松阪','伊勢','桑名','名張','熊野','近鉄四日市',
  // 岐阜県
  '岐阜','大垣','多治見','高山','各務原','可児','土岐','中津川','飛騨','美濃',
  // 静岡県
  '静岡','浜松','沼津','富士','磐田','藤枝','焼津','三島','掛川','御殿場',
  // その他地方都市
  '広島','岡山','熊本','鹿児島','那覇','金沢','新潟','長野','富山','盛岡','青森','秋田'
];

// 名古屋市内であると確信できるキーワード
const NAGOYA_POSITIVE = [
  '名古屋','名駅','栄駅','栄ﾋﾞﾙ','栄ビル',
  '大須','金山','伏見','矢場町','久屋大通','今池','千種','鶴舞','本山',
  '藤が丘','星ヶ丘','覚王山','池下','八事','御器所','吹上','新栄','東桜',
  'ささしまライブ','大曽根','神宮前','堀田','上前津','尾頭橋','新守山',
  '東山公園','名城公園','岩塚','八田','中村区','中村公園','近鉄八田',
  '名鉄','名市交','地下鉄東山線','東山線','名城線','鶴舞線','桜通線',
  '名港線','上飯田線','名古屋市','熱田区','中区','中村区','西区',
  '北区','守山区','千種区','昭和区','瑞穂区','天白区','緑区','南区','港区',
  '中川区','名東区','東区'
];

// 名古屋市内の鉄道・地下鉄・駅名の強力な正例（アクセス欄で最優先に確認）
const NAGOYA_STRONG_POSITIVE = [
  '名古屋', '名鉄', '地下鉄東山線', '地下鉄名城線', '地下鉄名港線',
  '地下鉄鶴舞線', '地下鉄桜通線', '地下鉄上飯田線',
  '東山線', '名城線', '名港線', '鶴舞線', '桜通線', '上飯田線',
  '名市交', '名古屋市営地下鉄', 'あおなみ線', 'リニモ', 'ゆとりーとライン',
  '伏見駅', '栄駅', '久屋大通駅', '矢場町駅', '大須観音駅', '上前津駅',
  '金山駅', '熱田駅', '神宮前駅', '堀田駅', '今池駅', '千種駅', '鶴舞駅',
  '新栄町駅', '東桜', '本山駅', '覚王山駅', '池下駅', '藤が丘駅', '星ヶ丘駅',
  '八事駅', '御器所駅', '吹上駅', '大曽根駅', '尾頭橋', '岩塚駅', '八田駅',
  'ささしまライブ', '名城公園駅', '東山公園駅', '国際センター駅', '丸の内駅'
];

function isNagoyaStore(s) {
  const access = s['アクセス'] || '';
  const price = s['価格帯'] || '';
  const name = s['店名'] || '';
  const notes = s['備考'] || '';
  const area = s['エリア'] || '';
  const combined = [access, price, name, notes, area].join(' ');

  // ① 最優先：アクセス欄に名古屋固有の鉄道・駅名があれば問答無用で通す
  //    （店名に「博多」等が入っていても、アクセスが名古屋なら名古屋店舗）
  for (const good of NAGOYA_STRONG_POSITIVE) {
    if (access.includes(good)) return true;
  }

  // ② 明らかな他都市キーワードがあれば除外
  for (const bad of NON_NAGOYA_BLACKLIST) {
    if (combined.includes(bad)) return false;
  }

  // ③ 弱いポジティブ（エリア欄・価格帯欄での名古屋キーワード）
  for (const good of NAGOYA_POSITIVE) {
    if (combined.includes(good)) return true;
  }

  // ④ どれにも該当しない曖昧な行は安全側に倒して除外
  return false;
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
  const mergedStores = gsStores.concat(newStores);
  console.log(`結合後: ${mergedStores.length}件`);

  // 品質フィルタ：名古屋市内と確信できるものだけ残す
  const stores = [];
  const rejected = [];
  for (const s of mergedStores) {
    if (isNagoyaStore(s)) {
      stores.push(s);
    } else {
      rejected.push(s);
    }
  }
  console.log(`品質フィルタ: ${stores.length}件通過 / ${rejected.length}件除外`);
  if (rejected.length > 0 && rejected.length <= 30) {
    console.log('除外された店舗（最大30件）:');
    rejected.slice(0, 30).forEach(s => {
      console.log(`  - ${s['店名']} | アクセス:${(s['アクセス']||'').slice(0,40)}`);
    });
  } else if (rejected.length > 30) {
    console.log(`除外された店舗（先頭5件のみ表示）:`);
    rejected.slice(0, 5).forEach(s => {
      console.log(`  - ${s['店名']} | アクセス:${(s['アクセス']||'').slice(0,40)}`);
    });
  }
  console.log(`最終: ${stores.length}件`);

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
