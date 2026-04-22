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

// アクセス欄で照合する非名古屋キーワード（駅名＋裸の地名を網羅）
// 店名に「博多焼肉」等あっても、アクセス欄に「船橋」等あれば除外する
const ACCESS_HARD_NEGATIVE = [
  // ── 関東（駅名＋裸の地名） ──
  '上野','新宿','渋谷','池袋','品川','秋葉原','浅草','銀座','六本木',
  '恵比寿','原宿','表参道','有楽町','赤坂','代官山','中目黒','自由が丘',
  '二子玉川','豊洲','月島','門前仲町','錦糸町','蒲田','五反田','目黒',
  '大崎','御徒町','新橋','虎ノ門','水道橋','御茶ノ水','後楽園','押上',
  '北千住','武蔵小杉','浅草橋',
  '立川','吉祥寺','町田','府中','調布','久米川','東村山','国分寺','八王子','三鷹','武蔵境',
  '船橋','千葉','松戸','柏','市川','浦安','佐倉','成田','幕張','舞浜','本八幡','西船橋',
  '大宮','浦和','川口','所沢','和光','春日部','川越','草加','越谷','蕨','戸田','朝霞',
  '横浜','川崎','桜木町','みなとみらい','関内','戸塚','大船','藤沢','新横浜','小田原','鎌倉',
  // ── 東京の鉄道 ──
  'JR山手線','JR中央線(東京)','東京都','東京メトロ',
  '都営地下鉄','都営新宿線','都営浅草線','都営三田線','都営大江戸線',
  '東西線','千代田線','日比谷線','半蔵門線','銀座線','丸ノ内線','南北線','有楽町線','副都心線',
  '西武','京王線','小田急線','京成','京急','東急','相鉄','つくばエクスプレス',
  '東武','千葉都市ﾓﾉﾚｰﾙ','千葉都市モノレール',
  'JR京浜東北','京浜東北線','JR武蔵野線','JR総武線','JR常磐線',
  // ── 関西 ──
  '梅田','難波','心斎橋','天王寺','京橋','江坂','堺','天満','福島','天六',
  '天神橋筋','堺筋線','谷町線','御堂筋線','四つ橋線',
  '大阪','阪急','阪神','大阪メトロ','南海','近鉄奈良線',
  '四条','烏丸','祇園','河原町','嵐山','京都市','京阪','叡山',
  '三宮','元町','神戸','姫路','尼崎','西宮','宝塚','川西','芦屋',
  // ── 九州・沖縄 ──
  '博多','天神','中洲','小倉','西鉄','福岡',
  '長崎','熊本','鹿児島','大分','佐賀','宮崎',
  '那覇','沖縄','美栄橋','おもろまち','モノレール','ﾓﾉﾚｰﾙ',
  // ── 北海道・東北 ──
  '札幌','旭川','函館','帯広','北広島',
  '仙台','盛岡','青森','秋田','山形','福島','郡山','会津','いわき',
  // ── 中国・四国 ──
  '広島','岡山','倉敷','福山',
  '松山','高松','高知','徳島','阿波',
  // ── 北陸・甲信越 ──
  '金沢','富山','福井','新潟','長野','松本','甲府',
  // ── 東海（名古屋市外） ──
  '四日市','近鉄四日市','津','鈴鹿','松阪','伊勢','桑名','亀山',
  '岐阜','大垣','多治見','高山','各務原','可児',
  '静岡','浜松','沼津','富士','磐田','藤枝','焼津','三島','掛川',
  // ── 愛知県内だが名古屋市外 ──
  '岡崎','豊田','豊橋','一宮','春日井','刈谷','知立','安城','碧南','瀬戸',
  '小牧','犬山','稲沢','半田','西尾','蒲郡','常滑','東海','大府',
  '尾張旭','日進','豊川','長久手','愛知環状','三河','尾張一宮',
  // ── その他 ──
  '高崎','前橋','水戸','宇都宮','奈良','和歌山','滋賀','大津','彦根',
  '鳥取','島根','山口','佐世保','宮古島','石垣'
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

// 半角カナ→全角カナ等を統一（ﾉ→ノ, ｾﾝﾀｰ→センター 等）
function norm(str) { return (str || '').normalize('NFKC'); }

function isNagoyaStore(s) {
  const access = norm(s['アクセス']);
  const price = norm(s['価格帯']);
  const name = norm(s['店名']);
  const notes = norm(s['備考']);
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

// ────────────────────────────────────────────────────
// 価格帯の正規化
// ────────────────────────────────────────────────────
// 入力の「価格帯」欄には店舗ごとに様々な表記が混在する（マーケティングコピー、
// 平均予算の注釈、全角/半角の混在、価格帯なしの誘導文など）。
// 表示とソートを安定させるため、一貫した14種類の標準バケットに寄せる。
// 数値が特定できないマーケティングコピーは空文字にクリアする。

const PRICE_BUCKETS = [
  { max: 500,   label: '～500円' },
  { max: 1000,  label: '501～1000円' },
  { max: 1500,  label: '1001～1500円' },
  { max: 2000,  label: '1501～2000円' },
  { max: 3000,  label: '2001～3000円' },
  { max: 4000,  label: '3001～4000円' },
  { max: 5000,  label: '4001～5000円' },
  { max: 7000,  label: '5001～7000円' },
  { max: 10000, label: '7001～10000円' },
  { max: 15000, label: '10001～15000円' },
  { max: 20000, label: '15001～20000円' },
  { max: 30000, label: '20001～30000円' }
];
const PRICE_BUCKET_LABELS = new Set(PRICE_BUCKETS.map(b => b.label).concat(['30001円～']));
const PRICE_RANGE_DASH = '[~\\-–—―ー〜～]';

function priceBucketOf(n) {
  for (const b of PRICE_BUCKETS) if (n <= b.max) return b.label;
  return '30001円～';
}

function normalizePrice(raw) {
  if (!raw) return '';
  const original = String(raw).trim();
  if (!original) return '';
  if (PRICE_BUCKET_LABELS.has(original)) return original;

  // NFKC で全角/半角の差を吸収（全角コロン・空白・チルダ・数字）
  let s = original.normalize('NFKC');
  // WAVE DASH (U+301C) を半角チルダへ
  s = s.replace(/[〜]/g, '~');
  // 数字中のカンマを除去
  s = s.replace(/(\d),(\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1$2');

  function maxYenIn(str) {
    const nums = [];
    let m;
    const r1 = /(\d{2,6})\s*円/g;
    while ((m = r1.exec(str)) !== null) {
      const n = parseInt(m[1], 10);
      if (n >= 100 && n <= 100000) nums.push(n);
    }
    const r2 = /[¥￥](\d{2,6})/g;
    while ((m = r2.exec(str)) !== null) {
      const n = parseInt(m[1], 10);
      if (n >= 100 && n <= 100000) nums.push(n);
    }
    return nums.length ? Math.max(...nums) : null;
  }

  function rangeMidpointIn(str) {
    const r = new RegExp('(\\d{2,6})\\s*円?\\s*' + PRICE_RANGE_DASH + '\\s*(\\d{2,6})\\s*円');
    const m = str.match(r);
    if (m) {
      const lo = parseInt(m[1], 10), hi = parseInt(m[2], 10);
      if (lo >= 100 && hi <= 100000 && hi >= lo) return Math.round((lo + hi) / 2);
    }
    return null;
  }

  // Priority 1: ディナー系のラベルがあればその直後の価格を優先
  const dinnerLabels = [
    /ディナー[^ランチ昼]*/,
    /夜[:：／\/][^ランチ昼]*/,
    /dinner[^a-zA-Z]*/i,
    /宴会[^ランチ昼]*/,
    /通常[:：／\/][^ランチ昼]*/
  ];
  for (const lbl of dinnerLabels) {
    const m = s.match(lbl);
    if (m) {
      const seg = m[0];
      const mid = rangeMidpointIn(seg);
      if (mid != null) return priceBucketOf(mid);
      const n = maxYenIn(seg);
      if (n != null) return priceBucketOf(n);
    }
  }

  // Priority 2: 明示的な範囲は中央値で丸める
  const mid = rangeMidpointIn(s);
  if (mid != null) return priceBucketOf(mid);

  const noYenRange = s.match(new RegExp('^(\\d{2,6})\\s*' + PRICE_RANGE_DASH + '\\s*(\\d{2,6})$'));
  if (noYenRange) {
    const lo = parseInt(noYenRange[1], 10), hi = parseInt(noYenRange[2], 10);
    if (lo >= 100 && hi <= 100000 && hi >= lo) return priceBucketOf(Math.round((lo + hi) / 2));
  }

  // Priority 3: 「円」付き数値の最大値を採用
  const maxN = maxYenIn(s);
  if (maxN != null) {
    // 500円未満かつ長文はメニュー単品のキャッチコピーと判定してクリア
    if (maxN < 500 && original.length >= 15) return '';
    return priceBucketOf(maxN);
  }

  // 数字のみの文字列
  if (/^\d{2,6}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 100 && n <= 100000) return priceBucketOf(n);
  }

  // 価格に該当する数値が取れない=マーケティングコピー → クリア
  return '';
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
  // 価格帯の曖昧表記を14種類の標準バケットに正規化
  s['価格帯'] = normalizePrice(s['価格帯']);
  return s;
}

// ────────────────────────────────────────────────────
// ISSUE-015-P1: index.html 書き込み時のフィールド間引き
// ────────────────────────────────────────────────────
// 以下のキーは LOCAL_STORES に含める必要がないため除外する:
//   - TikTok検索 / X検索 / Instagram検索: ランタイムで tiktokSearchUrl(r) 等で再生成される
//   - Instagram / Instagram投稿URL / 内観写真URL / 料理写真URL1 / 料理写真URL2:
//     sanitizeStore() により全件 '' にクリアされている
//   - 公開フラグ: build時点で FALSE 除外済み
// 併せて、値が空文字・null・undefined のキーも出力から除外する（runtimeは
// `r['foo'] || ''` パターンで参照しているため undefined でも同じ挙動になる）
const STORE_OUTPUT_OMIT_KEYS = new Set([
  'TikTok検索', 'X検索', 'Instagram検索',
  'Instagram', 'Instagram投稿URL',
  '内観写真URL', '料理写真URL1', '料理写真URL2',
  '公開フラグ'
]);
function slimStoreForOutput(s) {
  const out = {};
  for (const k of Object.keys(s)) {
    if (STORE_OUTPUT_OMIT_KEYS.has(k)) continue;
    const v = s[k];
    if (v === '' || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
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
  const localityMatch = address.match(/[都道府県](.+?[市区町村])/);
  const locality = localityMatch ? localityMatch[1] : '';
  const budget = (shop.budget && shop.budget.name) || '';
  const photo = (shop.photo && shop.photo.pc && (shop.photo.pc.l || shop.photo.pc.m || shop.photo.pc.s)) || '';
  const searchQ = encodeURIComponent(name + ' 名古屋');
  return {
    '店名': name,
    '英語名': '',
    'ジャンル': genre,
    'エリア': areaName,
    '都道府県': pref,
    '市区町村': locality,
    '住所': address,
    '緯度': shop.lat != null ? String(shop.lat) : '',
    '経度': shop.lng != null ? String(shop.lng) : '',
    '電話': shop.tel || '',
    '価格帯': budget,
    '営業時間': shop.open || '',
    'アクセス': shop.access || '',
    'ホットペッパーID': shop.id || '',
    '写真URL': photo,
    'Instagram': '',
    '食べログURL': '',
    'TikTok検索': `https://www.tiktok.com/search?q=${searchQ}`,
    'X検索': `https://x.com/search?q=${searchQ}`,
    'Instagram検索': `https://www.instagram.com/explore/search/keyword/?q=${searchQ}`,
    '公開フラグ': 'TRUE',
    '備考': '',
    'タグ': '',
    'Google評価': '',
    'Instagram投稿URL': '',
    'おすすめポイント': '',
    '内観写真URL': '',
    '料理写真URL1': '',
    '料理写真URL2': '',
    '口コミ数': ''
  };
}

// ────────────────────────────────────────────────────
// 手動キュレーション店舗（data/manual_stores.json）
// ────────────────────────────────────────────────────

// JSON の1エントリを LOCAL_STORES の26フィールドスキーマへ射影
function manualStoreToRecord(m) {
  const searchQ = encodeURIComponent((m['店名'] || '') + ' 名古屋');
  let score = parseInt(m['話題スコア']);
  if (!Number.isFinite(score) || score < 0 || score > 100) score = 85;
  const sources = Array.isArray(m['トレンド情報源']) && m['トレンド情報源'].length
    ? m['トレンド情報源']
    : ['手動キュレーション'];
  return {
    '店名': m['店名'] || '',
    '英語名': m['英語名'] || '',
    'ジャンル': m['ジャンル'] || '',
    'エリア': m['エリア'] || '',
    '都道府県': m['都道府県'] || '',
    '価格帯': m['価格帯'] || '',
    '営業時間': m['営業時間'] || '',
    'アクセス': m['アクセス'] || '',
    'ホットペッパーID': m['ホットペッパーID'] || '',
    '写真URL': m['写真URL'] || '',
    'Instagram': m['Instagram'] || '',
    '食べログURL': m['食べログURL'] || '',
    'TikTok検索': `https://www.tiktok.com/search?q=${searchQ}`,
    'X検索': `https://x.com/search?q=${searchQ}`,
    'Instagram検索': `https://www.instagram.com/explore/search/keyword/?q=${searchQ}`,
    '公開フラグ': 'TRUE',
    '備考': m['備考'] || '',
    'タグ': m['タグ'] || '',
    'Google評価': m['Google評価'] != null ? String(m['Google評価']) : '',
    'Instagram投稿URL': '',
    'おすすめポイント': m['おすすめポイント'] || '',
    '内観写真URL': '',
    '料理写真URL1': '',
    '料理写真URL2': '',
    '口コミ数': '',
    // フラグ類（manual 側で焼き込み）
    '話題フラグ': m['話題フラグ'] === true,
    '編集部推薦': m['編集部推薦'] === true,
    '話題スコア': score,
    '話題コメント': m['コメント'] || '',
    'トレンド情報源': sources,
    'キュレーター': m['キュレーター'] || '',
    '追加日': m['追加日'] || '',
    // サニタイゼーション迂回用の一時フラグ（LOCAL_STORES 書き込み前に削除）
    '__manual': true
  };
}

// manual_stores.json を読み込みバリデーション付きで返す
function loadManualStores() {
  const result = { stores: [], invalid: 0, warnings: 0, enriched: 0 };
  const manualPath = path.join(__dirname, 'data/manual_stores.json');
  if (!fs.existsSync(manualPath)) {
    console.log('手動キュレーション: data/manual_stores.json なし（スキップ）');
    return result;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
  } catch (e) {
    console.error(`[manual] JSON構文エラー: ${e.message}（手動追加ゼロ件で build 継続）`);
    return result;
  }
  const list = Array.isArray(raw.stores) ? raw.stores : [];
  if (!list.length) {
    console.log('手動キュレーション: stores 配列が空（スキップ）');
    return result;
  }
  const today = new Date().toISOString().slice(0, 10);
  const required = ['店名', 'エリア', '都道府県', 'ジャンル', 'アクセス', 'キュレーター', '追加日', 'おすすめポイント'];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') { result.invalid++; continue; }
    // 必須欠如チェック
    const missing = required.filter(k => !entry[k] || !String(entry[k]).trim());
    if (missing.length) {
      console.warn(`[manual] 必須欠如: ${entry['店名'] || '(店名なし)'} — 欠如: ${missing.join(', ')}`);
      result.invalid++;
      continue;
    }
    let m = entry;
    // 有効期限切れ
    if (m['有効期限'] && m['有効期限'] < today) {
      console.warn(`[manual] 有効期限切れ: ${m['店名']} (${m['有効期限']}) — フラグ類を落として投入`);
      m = { ...m, '話題フラグ': false, '編集部推薦': false };
      result.warnings++;
    }
    // 日付形式チェック（警告のみ）
    if (m['追加日'] && !/^\d{4}-\d{2}-\d{2}$/.test(m['追加日'])) {
      console.warn(`[manual] 追加日がYYYY-MM-DD形式でない: ${m['店名']} (${m['追加日']})`);
      result.warnings++;
    }
    // 愛知県外の警告
    if (m['都道府県'] && m['都道府県'] !== '愛知県') {
      console.warn(`[manual] 都道府県が愛知県でない: ${m['店名']} (${m['都道府県']})`);
      result.warnings++;
    }
    // アクセス欄に名古屋シグナルがあるかの軽チェック
    const access = m['アクセス'] || '';
    if (!/名古屋/.test(access)) {
      console.warn(`[manual] アクセス欄に「名古屋」を含まない: ${m['店名']} — isNagoyaStoreで弾かれる可能性あり`);
      result.warnings++;
    }
    result.stores.push(manualStoreToRecord(m));
  }
  return result;
}

// mergedStores に合流。衝突は上書き拡充、新規は return
function mergeManualStores(mergedStores, manualStores, existingHpIds) {
  const newRecords = [];
  for (const m of manualStores) {
    // 衝突キー1: ホットペッパーID
    let hit = null;
    if (m['ホットペッパーID']) {
      hit = mergedStores.find(s => s['ホットペッパーID'] && s['ホットペッパーID'] === m['ホットペッパーID']);
    }
    // 衝突キー2: 店名＋エリア
    if (!hit) {
      hit = mergedStores.find(s => s['店名'] === m['店名'] && s['エリア'] === m['エリア']);
    }
    if (hit) {
      // 上書き拡充（店名は既存優先、Instagram/写真URL/おすすめポイント/フラグは manual 優先）
      if (m['Instagram']) hit['Instagram'] = m['Instagram'];
      if (m['写真URL']) hit['写真URL'] = m['写真URL'];
      if (m['食べログURL']) hit['食べログURL'] = m['食べログURL'];
      if (m['Google評価']) hit['Google評価'] = m['Google評価'];
      if (m['タグ']) hit['タグ'] = m['タグ'];
      if (m['おすすめポイント']) hit['おすすめポイント'] = m['おすすめポイント'];
      if (m['話題フラグ'] === true) hit['話題フラグ'] = true;
      if (m['編集部推薦'] === true) hit['編集部推薦'] = true;
      if (typeof m['話題スコア'] === 'number') hit['話題スコア'] = m['話題スコア'];
      if (m['話題コメント']) hit['話題コメント'] = m['話題コメント'];
      if (m['トレンド情報源']) hit['トレンド情報源'] = m['トレンド情報源'];
      hit['__manual'] = true;  // サニタイゼーション迂回
      continue;
    }
    // 新規追加
    if (m['ホットペッパーID']) existingHpIds.add(m['ホットペッパーID']);
    newRecords.push(m);
  }
  return newRecords;
}

// ────────────────────────────────────────────────────
// トレンドスコア算出
// ────────────────────────────────────────────────────
function calcTrendScore(store, isNew) {
  let score = 0;
  // Google評価（35%）— 高評価ほどスコアが高い。3.5以上で加速
  const rating = parseFloat(store['Google評価']) || 0;
  if (rating >= 4.5) score += 35;
  else if (rating >= 4.0) score += 28;
  else if (rating >= 3.5) score += 20;
  else if (rating > 0) score += (rating / 5.0) * 15;
  // データ充実度（25%）— タグ・おすすめポイント・食べログURL等
  let richness = 0;
  if ((store['タグ'] || '').split(',').filter(Boolean).length >= 3) richness += 8;
  else if ((store['タグ'] || '').trim()) richness += 4;
  if (store['おすすめポイント'] && store['おすすめポイント'].trim()) richness += 8;
  if (store['食べログURL'] && store['食べログURL'].trim()) richness += 5;
  if (store['ホットペッパーID'] && store['ホットペッパーID'].trim()) richness += 4;
  score += Math.min(richness, 25);
  // SNS検索リンクの充実度（10%）
  const socialCount = [store['TikTok検索'], store['X検索'], store['Instagram']]
    .filter(u => u && u !== '#' && u !== '').length;
  score += (socialCount / 3) * 10;
  // 新着ボーナス — 単なる新着は魅力担保にならないため +10 に抑制（旧: +30）
  if (isNew) score += 10;
  // 話題フラグ（外部シグナル）— メディア露出・食べログ高順位等。+40 加点、かつ話題スコアがあれば反映
  if (store['話題フラグ'] === true) {
    score += 40;
    const buzz = parseInt(store['話題スコア']) || 0;
    if (buzz > 0) score = Math.max(score, buzz);
  }
  // 編集部推薦（業界人目利きシグナル）— 話題フラグと同格で +40。両方 true でも二重加点はしない
  if (store['編集部推薦'] === true && store['話題フラグ'] !== true) {
    score += 40;
    const buzz = parseInt(store['話題スコア']) || 0;
    if (buzz > 0) score = Math.max(score, buzz);
  }
  return Math.round(Math.min(score, 100));
}

function getTrendLabel(score) {
  if (score >= 80) return '話題沸騰';
  if (score >= 60) return '注目上昇中';
  if (score >= 40) return 'じわじわ人気';
  return '';
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
  // 名古屋以外の誤掲載店舗を永続的に除外（Google Sheetsデータを修正するまでの対処）
  const EXCLUDED_HP_IDS = new Set([
    'J004469034', // サザンクラウン（沖縄・竹富町）
  ]);
  const gsStores = parseCSV(csv)
    .filter(s => s['公開フラグ'] !== 'FALSE')
    .filter(s => !EXCLUDED_HP_IDS.has(s['ホットペッパーID']));
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
  let mergedStores = gsStores.concat(newStores);
  console.log(`結合後: ${mergedStores.length}件`);

  // pending_stores.json (journal 経由で追加された外部媒体由来の話題店) をマージ
  try {
    const { mergePendingStores } = require('./scripts/merge_pending_stores.js');
    const pendingResult = mergePendingStores(mergedStores);
    mergedStores = pendingResult.merged;
    console.log(`pending_stores: ${pendingResult.addedCount}件追加 / ${pendingResult.skippedCount}件既存`);
  } catch (e) {
    console.warn(`pending_stores マージ失敗: ${e.message}`);
  }

  // 手動キュレーション店の合流（Hot Pepper/GSheetsに載っていない高品質店）
  const manualResult = loadManualStores();
  const manualNew = mergeManualStores(mergedStores, manualResult.stores, existingHpIds);
  mergedStores.push(...manualNew);
  const manualEnriched = manualResult.stores.length - manualNew.length;
  console.log(`手動キュレーション: 新規${manualNew.length}件 / 既存拡充${manualEnriched}件 / 無効${manualResult.invalid}件 (警告${manualResult.warnings}件)`);

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
  // 手動キュレーション店（__manual=true）はバイパス（公式URLが手動指定されているため）
  let sanitizedPoints = 0;
  let manualBypassed = 0;
  for (const s of stores) {
    if (s.__manual) {
      // 価格帯の正規化のみ実施
      s['価格帯'] = normalizePrice(s['価格帯']);
      manualBypassed++;
      continue;
    }
    const hadPoint = !!s['おすすめポイント'];
    sanitizeStore(s);
    if (hadPoint && !s['おすすめポイント']) sanitizedPoints++;
  }
  // 一時フラグ __manual を LOCAL_STORES から除去
  for (const s of stores) { delete s.__manual; }
  console.log(`サニタイゼーション: Instagram/写真URL=全件クリア / おすすめポイント=${sanitizedPoints}件自動生成パターンをクリア / 手動キュレーション${manualBypassed}件はバイパス`);

  // Instagram 検索URL バックフィル — 全店に Instagram検索 を付与（既存 TikTok検索/X検索 と同パターン）
  // エリアは複数連結（"栄ｷﾀ錦/伏見丸の内/..."）でクエリに含めると一致しないため、店名＋名古屋に固定
  let igBackfilled = 0;
  for (const s of stores) {
    if (!s['Instagram検索']) {
      const q = encodeURIComponent((s['店名'] || '') + ' 名古屋');
      s['Instagram検索'] = `https://www.instagram.com/explore/search/keyword/?q=${q}`;
      igBackfilled++;
    }
  }
  console.log(`Instagram検索URL: ${igBackfilled}件をバックフィル`);

  // Instagram 公式アカウントURL 事前解決の結果をマージ
  // scripts/resolve_instagram.js が data/instagram_resolved.json に書き出したキャッシュを読み込み、
  // ホットペッパーIDで一致した店の Instagram フィールドに公式プロフィールURLを焼き付ける。
  // index.html の instagramSearchUrl(r) が r['Instagram'] を最優先するため、render時に直リンとして使われる。
  const resolvedPath = path.join(__dirname, 'data/instagram_resolved.json');
  let igResolved = 0, igResolvedSkipped = 0;
  if (fs.existsSync(resolvedPath)) {
    try {
      const resolvedMap = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      for (const s of stores) {
        const id = s['ホットペッパーID'];
        if (!id) continue;
        const entry = resolvedMap[id];
        if (!entry || !entry.instagram || entry.failed) continue;
        // Instagram フィールドに既に手動設定がある場合は尊重（上書きしない）
        if (s['Instagram'] && s['Instagram'].trim()) { igResolvedSkipped++; continue; }
        s['Instagram'] = entry.instagram;
        igResolved++;
      }
      console.log(`Instagram公式URL: ${igResolved}件をマージ（手動設定済み ${igResolvedSkipped}件はスキップ）`);
    } catch (e) {
      console.warn(`Instagram公式URLマージ失敗: ${e.message}`);
    }
  } else {
    console.log(`Instagram公式URL: ${resolvedPath} がないためマージスキップ（node scripts/resolve_instagram.js で生成）`);
  }

  // 話題店JSONをマージ（店名＋エリアで既存店舗にマッチングさせ、話題フラグを付与）
  const trendingPath = path.join(__dirname, 'data/trending_stores.json');
  let buzzApplied = 0, buzzMissing = [];
  if (fs.existsSync(trendingPath)) {
    try {
      const trendingRaw = JSON.parse(fs.readFileSync(trendingPath, 'utf8'));
      const buzzList = (trendingRaw.stores || []).filter(t => t['話題フラグ'] === true);
      const today = new Date().toISOString().slice(0, 10);
      for (const buzz of buzzList) {
        // 有効期限切れはスキップ
        if (buzz['有効期限'] && buzz['有効期限'] < today) continue;
        const hit = stores.find(s =>
          s['店名'] === buzz['店名'] &&
          (buzz['エリア'] ? s['エリア'] === buzz['エリア'] : true)
        );
        if (hit) {
          hit['話題フラグ'] = true;
          hit['トレンド情報源'] = buzz['トレンド情報源'] || [];
          hit['話題スコア'] = buzz['話題スコア'] || 0;
          hit['話題コメント'] = buzz['コメント'] || '';
          // おすすめポイントが空の場合のみ、trending_stores.json の手動キュレーション文で補完
          if (buzz['おすすめポイント'] && (!hit['おすすめポイント'] || !hit['おすすめポイント'].trim())) {
            hit['おすすめポイント'] = buzz['おすすめポイント'];
          }
          buzzApplied++;
        } else {
          buzzMissing.push(buzz['店名']);
        }
      }
      console.log(`話題フラグ付与: ${buzzApplied}件 / マッチ失敗: ${buzzMissing.length}件`);
      if (buzzMissing.length) {
        console.log('  マッチ失敗の店名（要確認）:', buzzMissing.slice(0, 10).join(' / '));
      }
    } catch (e) {
      console.error(`data/trending_stores.json の読み込み失敗: ${e.message}`);
    }
  } else {
    console.log('data/trending_stores.json なし（話題フラグスキップ）');
  }

  // 編集部ピックJSONをマージ（店名＋エリアで既存店舗にマッチングさせ、編集部フィールドを付与）
  const editorPicksPath = path.join(__dirname, 'data/editor_picks.json');
  if (fs.existsSync(editorPicksPath)) {
    try {
      const editorRaw = JSON.parse(fs.readFileSync(editorPicksPath, 'utf8'));
      const picks = editorRaw.stores || [];
      const today = new Date().toISOString().slice(0, 10);
      let epApplied = 0, epMissing = [];
      for (const p of picks) {
        // 有効期限切れはスキップ
        if (p['有効期限'] && p['有効期限'] < today) continue;
        const hit = stores.find(s =>
          s['店名'] === p['店名'] &&
          (p['エリア'] ? s['エリア'] === p['エリア'] : true)
        );
        if (hit) {
          if (p.editorReason) hit.editorReason = p.editorReason;
          if (p.mediaFeatures) hit.mediaFeatures = p.mediaFeatures;
          if (p.insiderNote) hit.insiderNote = p.insiderNote;
          if (p.visitStatus) hit.visitStatus = p.visitStatus;
          epApplied++;
        } else {
          epMissing.push(p['店名']);
        }
      }
      console.log(`編集部ピック付与: ${epApplied}件 / マッチ失敗: ${epMissing.length}件`);
      if (epMissing.length) {
        console.log('  マッチ失敗の店名（要確認）:', epMissing.slice(0, 10).join(' / '));
      }
    } catch (e) {
      console.error(`data/editor_picks.json の読み込み失敗: ${e.message}`);
    }
  } else {
    console.log('data/editor_picks.json なし（編集部ピックスキップ）');
  }

  // トレンドスコア算出
  const newHpIds = new Set(newStores.map(s => s['ホットペッパーID']).filter(Boolean));
  let trendHot = 0, trendRising = 0, trendWarm = 0;
  for (const s of stores) {
    const isNew = newHpIds.has(s['ホットペッパーID']);
    const score = calcTrendScore(s, isNew);
    s['トレンドスコア'] = String(score);
    s['トレンドラベル'] = getTrendLabel(score);
    if (score >= 80) trendHot++;
    else if (score >= 60) trendRising++;
    else if (score >= 40) trendWarm++;
  }
  console.log(`トレンドスコア: 🔥話題沸騰=${trendHot} / 📈注目上昇中=${trendRising} / ✨じわじわ人気=${trendWarm}`);

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
  //    ISSUE-015-P1: 出力時に不要フィールド・空値を除去して serialize 量を削減
  let html = fs.readFileSync(HTML, 'utf8');
  const slimStores = stores.map(slimStoreForOutput);
  const jsonStr = JSON.stringify(slimStores);
  console.log(`LOCAL_STORES serialize: ${stores.length}件, ${(jsonStr.length / 1024 / 1024).toFixed(2)}MB`);
  html = html.replace(
    /var LOCAL_STORES = \[[\s\S]*?\];/,
    `var LOCAL_STORES = ${jsonStr};`
  );

  // 2. SEOクロール用の内部リンク集は scripts/inject_store_links.js が
  //    stores/*.html を元に正規リンク（stores/{slug}.html）で生成・挿入する。
  //    ここでは仮埋めせず、ファイル書き込み後に呼び出す（以前の実装は全リンクが
  //    トップページURLになっていたため、スラグへの直リンクに修正）。

  // 3. lastmod を今日の日付に更新
  const today = new Date().toISOString().slice(0, 10);
  html = html.replace(
    /<meta name="revised" content="[^"]*">/,
    `<meta name="revised" content="${today}">`
  );

  fs.writeFileSync(HTML, html, 'utf8');
  console.log('index.html 更新完了');

  // 2b. 内部リンク集（noscript#seo-store-list + section#store-index）を再生成
  try {
    const { execSync } = require('child_process');
    execSync('node ' + JSON.stringify(path.join(__dirname, 'scripts', 'inject_store_links.js')), { stdio: 'inherit' });
  } catch (e) {
    console.warn('inject_store_links.js の実行に失敗しました:', e.message);
  }

  // 2c. GAS の LINE レポート用 page-names.json を再生成
  try {
    const { execSync } = require('child_process');
    execSync('node ' + JSON.stringify(path.join(__dirname, 'scripts', 'generate_page_names.js')), { stdio: 'inherit' });
  } catch (e) {
    console.warn('generate_page_names.js の実行に失敗しました:', e.message);
  }

  // 4. sitemap.xml を更新
  //    トップ + 静的ページ + features/ 全件 + stores/ 全件 を列挙
  const featuresDir = path.join(__dirname, 'features');
  const journalDir = path.join(__dirname, 'journal');
  const storesDir = path.join(__dirname, 'stores');
  const baseUrl = 'https://wakuwaku-labs.github.io/nagoya-bites';

  const sitemapUrls = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${baseUrl}/about.html`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${baseUrl}/contact.html`, priority: '0.6', changefreq: 'monthly' },
    { loc: `${baseUrl}/faq.html`, priority: '0.7', changefreq: 'monthly' },
  ];

  // features/ インデックス + 個別特集ページ
  if (fs.existsSync(featuresDir)) {
    sitemapUrls.push({ loc: `${baseUrl}/features/`, priority: '0.9', changefreq: 'weekly' });
    const featureFiles = fs.readdirSync(featuresDir)
      .filter(f => f.endsWith('.html') && f !== 'index.html')
      .sort();
    for (const f of featureFiles) {
      sitemapUrls.push({
        loc: `${baseUrl}/features/${f}`,
        priority: '0.8',
        changefreq: 'monthly'
      });
    }
  }

  // journal/ インデックス + 個別日次記事 (drafts/ と _template.html は除外)
  if (fs.existsSync(journalDir)) {
    sitemapUrls.push({ loc: `${baseUrl}/journal/`, priority: '0.9', changefreq: 'daily' });
    const journalFiles = fs.readdirSync(journalDir)
      .filter(f => f.endsWith('.html') && f !== 'index.html' && f !== '_template.html')
      .sort();
    for (const f of journalFiles) {
      sitemapUrls.push({
        loc: `${baseUrl}/journal/${f}`,
        priority: '0.7',
        changefreq: 'monthly'
      });
    }
  }

  // stores/*.html を全件登録（P0-B: 店舗ページをクロール対象に）
  let storeCount = 0;
  if (fs.existsSync(storesDir)) {
    const storeFiles = fs.readdirSync(storesDir)
      .filter(f => f.endsWith('.html') && f !== 'index.html')
      .sort();
    for (const f of storeFiles) {
      sitemapUrls.push({
        loc: `${baseUrl}/stores/${f}`,
        priority: '0.6',
        changefreq: 'monthly'
      });
    }
    storeCount = storeFiles.length;
  }

  const sitemapEntries = sitemapUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>
`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap, 'utf8');
  console.log(`sitemap.xml 更新完了（URL数: ${sitemapUrls.length}、うち店舗: ${storeCount}）`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
