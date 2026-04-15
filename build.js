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
// 方針：
//   - 短い単語の部分一致に頼らず、「駅」「線」などの接尾辞を含む具体的な鉄道・駅名で判定
//   - ポジティブ（名古屋確定）とネガティブ（他都市確定）を独立して評価
//   - ネガティブ優先（他都市の明確なシグナルがあれば即除外）

// 他都市の「◯◯駅」「◯◯線」レベルの明確なキーワード（access欄で照合）
const ACCESS_HARD_NEGATIVE = [
  // 東京23区の駅
  '上野駅','新宿駅','渋谷駅','池袋駅','品川駅','東京駅','秋葉原駅',
  '浅草駅','銀座駅','六本木駅','恵比寿駅','原宿駅','表参道駅',
  '有楽町駅','赤坂駅','代官山駅','中目黒駅','自由が丘駅','二子玉川駅',
  '豊洲駅','月島駅','門前仲町駅','錦糸町駅','蒲田駅','五反田駅','目黒駅',
  '大崎駅','御徒町駅','新橋駅','虎ノ門駅','神田(東京)','JR神田','京成上野',
  '浅草橋駅','水道橋駅','お茶の水駅','御茶ノ水駅','後楽園駅','押上駅',
  '北千住駅','武蔵小杉駅','上井草駅','JR山手線','JR中央線(東京)',
  '東京都','東京メトロ','都営地下鉄','都営新宿線','都営浅草線','都営三田線',
  '都営大江戸線','東西線','千代田線','日比谷線','半蔵門線','銀座線',
  '丸ノ内線','南北線','有楽町線','副都心線',
  '西武新宿線','西武池袋線','京王線','小田急線','京成線','京急',
  // 東京多摩
  '立川駅','吉祥寺駅','町田駅','府中駅','調布駅','久米川駅','東村山駅',
  '国分寺駅','八王子駅','三鷹駅','武蔵境駅',
  // 神奈川
  '横浜駅','川崎駅','桜木町駅','みなとみらい駅','関内駅','戸塚駅','大船駅',
  '藤沢駅','新横浜駅','相鉄',
  // 大阪・京都・神戸
  '梅田駅','難波駅','心斎橋駅','天王寺駅','京橋駅','江坂駅','堺駅',
  '大阪駅','大阪市','阪急','阪神','大阪メトロ','御堂筋線','四つ橋線',
  '四条河原町','烏丸御池','祇園四条','京都市','京阪','叡山電鉄','嵐電',
  '三宮駅','元町駅','神戸市','神戸線',
  // 福岡・札幌・仙台
  '博多駅','天神駅','中洲川端','西鉄福岡','福岡市',
  '札幌駅','大通駅','さっぽろ駅','札幌市','仙台駅','仙台市',
  // 三重・岐阜・静岡
  '四日市駅','近鉄四日市','津駅','鈴鹿市','松阪駅','伊勢市駅','桑名駅',
  '岐阜駅','大垣駅','多治見駅','高山駅','各務原駅',
  '静岡駅','浜松駅','沼津駅','富士駅','磐田駅','藤枝駅',
  // 愛知県内だが名古屋市外
  '岡崎駅','豊田市駅','新豊田駅','豊橋駅','一宮駅','春日井駅','刈谷駅',
  '知立駅','安城駅','碧南駅','瀬戸市駅','新瀬戸駅','小牧駅','犬山駅',
  '稲沢駅','半田駅','西尾駅','蒲郡駅','常滑駅','東海市駅','大府駅',
  '尾張旭駅','日進駅','豊川駅','長久手'
];

// 価格帯欄・備考欄に紛れ込むSEO地名スタッフィングを検出
const PRICE_NOTES_NEGATIVE = [
  '東村山','久米川','四日市','津市','鈴鹿','松阪','伊勢市','桑名',
  '岡崎市','豊田市','豊橋市','一宮市','春日井市','刈谷市',
  '横浜市','川崎市','大阪市','京都市','神戸市','福岡市','札幌市'
];

// 店名の末尾に他都市名+店がくるパターン（SEO目当ての偽装を排除）
const NAME_NEGATIVE_PATTERNS = [
  /上野店/,/新宿店/,/渋谷店/,/池袋店/,/品川店/,/秋葉原店/,/浅草店/,
  /銀座店/,/六本木店/,/恵比寿店/,/赤坂店/,/横浜店/,/川崎店/,
  /大阪店/,/京都店/,/神戸店/,/梅田店/,/難波店/,/心斎橋店/,/天王寺店/,
  /福岡店/,/博多店/,/天神店/,/札幌店/,/仙台店/,
  /四日市駅前店/,/四日市店/,/津駅前店/,/松阪店/,/伊勢店/,/桑名店/,
  /岡崎店/,/豊田店/,/豊橋店/,/一宮店/,/春日井店/,/刈谷店/,/安城店/,
  /岐阜店/,/大垣店/,/静岡店/,/浜松店/
];

// 名古屋確定のアクセス欄キーワード
const ACCESS_NAGOYA_POSITIVE = [
  '名鉄','名市交','名古屋市営','あおなみ線','リニモ','ゆとりーとライン',
  '地下鉄東山線','地下鉄名城線','地下鉄名港線','地下鉄鶴舞線',
  '地下鉄桜通線','地下鉄上飯田線',
  '東山線','名城線','名港線','鶴舞線','桜通線','上飯田線',
  '栄駅','伏見駅','丸の内駅','久屋大通駅','矢場町駅','大須観音駅',
  '上前津駅','金山駅','熱田駅','神宮前駅','堀田駅','今池駅','千種駅',
  '鶴舞駅','新栄町駅','本山駅','覚王山駅','池下駅','藤が丘駅','星ヶ丘駅',
  '八事駅','御器所駅','吹上駅','大曽根駅','岩塚駅','八田駅','近鉄八田',
  'ささしまライブ','名城公園駅','東山公園駅','国際センター駅','尾頭橋'
];

// エリア欄の名古屋確定ワード（完全一致または前方一致で判定）
const NAGOYA_AREA_WORDS = [
  '栄','大須','金山','名古屋駅','名駅','伏見','丸の内','矢場町',
  '久屋大通','今池','千種','鶴舞','本山','藤が丘','星ヶ丘','覚王山',
  '池下','八事','御器所','吹上','新栄','東桜','大曽根','神宮前','堀田',
  '上前津','尾頭橋','名東','守山','天白','熱田','中村','中区','東区',
  '西区','北区','南区','港区','中川区','緑区','昭和区','瑞穂区','千種区'
];

// 店名の名古屋確定パターン（末尾「◯◯店」）
const NAME_NAGOYA_PATTERNS = [
  /名古屋/,/名駅/,/栄店$/,/栄 店/,/大須店/,/金山店/,/伏見店/,
  /矢場町店/,/丸の内店/,/藤が丘店/,/本山店/,/覚王山店/,/今池店/,
  /千種店/,/鶴舞店/,/星ヶ丘店/,/新栄店/,/東桜店/,/大曽根店/,/神宮前店/
];

function isNagoyaStore(s) {
  const access = s['アクセス'] || '';
  const price = s['価格帯'] || '';
  const name = s['店名'] || '';
  const notes = s['備考'] || '';
  const area = s['エリア'] || '';
  const pref = s['都道府県'] || '';

  // STEP 1: アクセス欄に他都市の駅/路線があれば即除外
  for (const bad of ACCESS_HARD_NEGATIVE) {
    if (access.includes(bad)) return false;
  }
  // STEP 2: 価格帯・備考に他都市名があれば即除外（SEOスタッフィング対策）
  const priceNotes = price + ' ' + notes;
  for (const bad of PRICE_NOTES_NEGATIVE) {
    if (priceNotes.includes(bad)) return false;
  }
  // STEP 3: 店名が他都市+店の形式なら除外
  for (const re of NAME_NEGATIVE_PATTERNS) {
    if (re.test(name)) return false;
  }

  // ここまで通過 = 他都市の明確なシグナルなし

  // STEP 4: アクセス欄に「名古屋」が含まれていれば確定
  if (access.includes('名古屋')) return true;
  // STEP 5: アクセス欄に名古屋固有の鉄道/駅があれば確定
  for (const good of ACCESS_NAGOYA_POSITIVE) {
    if (access.includes(good)) return true;
  }
  // STEP 6: エリア欄が名古屋確定ワードなら確定
  for (const a of NAGOYA_AREA_WORDS) {
    if (area === a || area.startsWith(a)) return true;
  }
  // STEP 7: 店名に「名古屋店」「栄店」等の名古屋確定パターンがあれば確定
  for (const re of NAME_NAGOYA_PATTERNS) {
    if (re.test(name)) return true;
  }
  // STEP 8: 都道府県=愛知県 かつ ここまでの他都市シグナルなし → 名古屋市と推定して通す
  //   （STEP 1〜3で愛知県内他市は除外済みなので、残りは名古屋市の可能性が高い）
  if (pref === '愛知県') return true;

  // STEP 9: どれにも該当しなければ除外
  return false;
}

// ────────────────────────────────────────────────────
// データ品質サニタイゼーション
// ────────────────────────────────────────────────────
// 以前の週次エージェントが不適切に自動生成/流用した情報をクリアする。
// 検証不能な Instagram/写真URL は一律クリアして安全な検索フォールバックに委ねる。
// おすすめポイントは自動生成パターンにマッチした場合のみクリア。

const AUTOGEN_POINT_PATTERNS = [
  /が楽しめる.*。.*空間で.*最適/,
  /が楽しめる.*居酒屋.*活気ある/,
  /広々とした.*空間.*お楽しみ/,
  /な雰囲気の.*店.*おすすめ/,
  /活気ある空間/,
  /落ち着いた雰囲気.*空間/,
  /^[\s\S]{1,20}円～?$/
];

function isAutoGenPoint(text) {
  if (!text) return false;
  return AUTOGEN_POINT_PATTERNS.some(re => re.test(text));
}

function sanitizeStore(s) {
  // Instagram 関連は検証不能なため全件クリア
  s['Instagram'] = '';
  s['Instagram投稿URL'] = '';
  s['内観写真URL'] = '';
  s['料理写真URL1'] = '';
  s['料理写真URL2'] = '';
  // おすすめポイントが自動生成パターンに該当するならクリア
  if (isAutoGenPoint(s['おすすめポイント'])) {
    s['おすすめポイント'] = '';
  }
  return s;
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

  // データサニタイゼーション（検証不能なInstagram/写真URL・自動生成推薦文のクリア）
  let sanitizedPoints = 0;
  for (const s of stores) {
    const hadPoint = !!s['おすすめポイント'];
    sanitizeStore(s);
    if (hadPoint && !s['おすすめポイント']) sanitizedPoints++;
  }
  console.log(`サニタイゼーション: Instagram/写真URL=全件クリア / おすすめポイント=${sanitizedPoints}件自動生成パターンをクリア`);
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
