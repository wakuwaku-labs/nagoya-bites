'use strict';
/**
 * scripts/fetch_hotpepper_popular.js
 *
 * Hot Pepper Gourmet API の「人気順（order=4）」で名古屋エリアの上位店を取得し、
 * data/trending_stores.json の candidates セクションに追記する。
 *
 * 使い方:
 *   export HOTPEPPER_API_KEY=xxxxx
 *   node scripts/fetch_hotpepper_popular.js
 *
 * 仕様:
 *   - 既存 LOCAL_STORES（index.html）にホットペッパーID一致で存在する店のみ「話題候補」として記録。
 *   - 新規店舗は candidates 側に記録（自動で LOCAL_STORES には追加しない）。
 *   - 人間レビューを経て話題フラグ: true に昇格させる運用。
 *   - スコア算出: 人気順の順位をもとに 話題スコア = 100 - rank*2（下限 50）
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const HP_API_KEY = process.env.HOTPEPPER_API_KEY || '';
const HP_BASE = 'https://webservice.recruit.co.jp/hotpepper';
const TRENDING_PATH = path.join(__dirname, '..', 'data', 'trending_stores.json');
const INDEX_PATH = path.join(__dirname, '..', 'index.html');

const NAGOYA_KEYWORDS = [
  '名古屋', '栄', '大須', '金山', '伏見', '熱田', '今池', '新栄', '千種', '鶴舞',
  '丸の内', '藤が丘', '八事', '星ヶ丘', '本山', '御器所', '一社', '上社', '桜山',
  '矢場町', '覚王山', '池下', '吹上', '名東', '昭和', '瑞穂', '守山', '中川', '港', '中村'
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function fetchJson(url) {
  const t = await fetchUrl(url);
  return JSON.parse(t);
}

async function fetchNagoyaMiddleAreas() {
  const url = `${HP_BASE}/middle_area/v1/?key=${HP_API_KEY}&service_area=SA22&format=json`;
  const data = await fetchJson(url);
  const areas = (data.results && data.results.middle_area) || [];
  return areas.filter((ma) => NAGOYA_KEYWORDS.some((k) => (ma.name || '').includes(k)));
}

async function fetchPopularShopsInMiddleArea(maCode, maName, count = 30) {
  // Hot Pepper API order=4 = 人気順
  const url = `${HP_BASE}/gourmet/v1/?key=${HP_API_KEY}&middle_area=${maCode}&format=json&count=${count}&order=4`;
  try {
    const data = await fetchJson(url);
    const arr = (data.results && data.results.shop) || [];
    console.log(`  ${maName} (${maCode}): 人気順 ${arr.length}件`);
    return arr;
  } catch (e) {
    console.error(`  ${maName} 人気順取得エラー: ${e.message}`);
    return [];
  }
}

function loadLocalStores() {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('LOCAL_STORES not found in index.html');
  return JSON.parse(m[1]);
}

function loadTrending() {
  if (!fs.existsSync(TRENDING_PATH)) {
    return { stores: [], candidates: [] };
  }
  return JSON.parse(fs.readFileSync(TRENDING_PATH, 'utf8'));
}

function saveTrending(data) {
  fs.writeFileSync(TRENDING_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function main() {
  if (!HP_API_KEY) {
    console.error('HOTPEPPER_API_KEY 未設定。export してから再実行してください。');
    process.exit(1);
  }
  console.log('名古屋エリア middle_area 取得中...');
  const middleAreas = await fetchNagoyaMiddleAreas();
  console.log(`対象 middle_area: ${middleAreas.length}件`);

  const today = new Date().toISOString().slice(0, 10);
  const expireDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 既存 LOCAL_STORES を読み込んで、HPID 一致する店に話題候補を紐付け
  const localStores = loadLocalStores();
  const hpIdMap = new Map();
  for (const s of localStores) {
    if (s['ホットペッパーID']) hpIdMap.set(s['ホットペッパーID'], s);
  }

  const trending = loadTrending();
  const existingNames = new Set((trending.stores || []).map((t) => t['店名']));
  const candidateNames = new Set((trending.candidates || []).map((c) => c['店名']).filter(Boolean));

  let matchedCount = 0;
  let newCandidateCount = 0;

  for (const ma of middleAreas) {
    const shops = await fetchPopularShopsInMiddleArea(ma.code, ma.name);
    for (let i = 0; i < shops.length; i++) {
      const shop = shops[i];
      const rank = i + 1;
      const score = Math.max(50, 100 - rank * 2);
      const existingLocal = hpIdMap.get(shop.id);
      if (existingLocal) {
        // 既に LOCAL_STORES にあれば stores に昇格候補として追加（重複スキップ）
        if (existingNames.has(existingLocal['店名'])) continue;
        trending.stores = trending.stores || [];
        trending.stores.push({
          '店名': existingLocal['店名'],
          'エリア': existingLocal['エリア'],
          '話題フラグ': false, // 自動追加は false スタート。人間レビュー後に true に昇格させる
          'トレンド情報源': ['Hot Pepper人気'],
          '出典URL': [`https://www.hotpepper.jp/strJ${shop.id.slice(1)}/`],
          '話題スコア': score,
          '検出日': today,
          '有効期限': expireDate,
          'コメント': `${ma.name} 人気順 ${rank}位`,
          '_auto': true
        });
        existingNames.add(existingLocal['店名']);
        matchedCount++;
      } else {
        // LOCAL_STORES に存在しない → candidates 側
        if (candidateNames.has(shop.name)) continue;
        trending.candidates = trending.candidates || [];
        trending.candidates.push({
          '店名': shop.name,
          'エリア': (shop.middle_area && shop.middle_area.name) || ma.name,
          'ジャンル': (shop.genre && shop.genre.name) || '',
          'アクセス': shop.access || '',
          'ホットペッパーID': shop.id,
          '写真URL': (shop.photo && shop.photo.pc && (shop.photo.pc.l || shop.photo.pc.m)) || '',
          'トレンド情報源': ['Hot Pepper人気'],
          '話題スコア': score,
          '検出日': today,
          'コメント': `${ma.name} 人気順 ${rank}位（既存DB未登録）`
        });
        candidateNames.add(shop.name);
        newCandidateCount++;
      }
    }
  }

  saveTrending(trending);
  console.log(`\n既存店マッチ（stores追加・話題フラグ=false）: ${matchedCount}件`);
  console.log(`新規候補（candidatesに記録）: ${newCandidateCount}件`);
  console.log(`\n人間レビュー次のステップ:`);
  console.log(`  1. data/trending_stores.json を開く`);
  console.log(`  2. stores[] の _auto:true エントリーを確認し、妥当なものは 話題フラグ を true に変更`);
  console.log(`  3. candidates[] は Google Sheets に追加するか判断`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
