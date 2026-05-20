#!/usr/bin/env node
// 手動キュレーション店（data/manual_stores.json）に Google Maps の実写真を取得して
// 写真URL に設定する。Google が見つけられない店だけ既存の店舗固有SVGを維持する。
//
// Google Places API（findplacefromtext → place/details → place/photo CDN URL）を使用。
// 要 GOOGLE_MAPS_API_KEY（または GOOGLE_PLACES_API_KEY）環境変数。
// place/photo が返す lh3.googleusercontent.com の CDN URL を保存（APIキーはHTMLに埋め込まない）。
//
// 使い方:
//   GOOGLE_MAPS_API_KEY=xxxx node scripts/fetch_manual_store_photos.js [--force] [--limit N]
// 取得後:
//   node build.js && node scripts/patch_static_store_photos.js
//   （features/ stores/ に実写を反映）

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const MANUAL_JSON = path.join(ROOT, 'data', 'manual_stores.json');
const KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';

if (!KEY) {
  console.error('❌ GOOGLE_MAPS_API_KEY（または GOOGLE_PLACES_API_KEY）が未設定です。');
  console.error('   例: GOOGLE_MAPS_API_KEY=AIza... node scripts/fetch_manual_store_photos.js');
  process.exit(2);
}

function getJson(url) {
  return new Promise((resolve) => {
    let body = '';
    const req = https.get(url, { timeout: 8000 }, (res) => {
      res.on('data', d => { body += d; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// place/photo はリダイレクトで CDN URL を返す（本文は取らず Location を拾う）
function resolveCdnUrl(photoApiUrl) {
  return new Promise((resolve) => {
    const req = https.get(photoApiUrl, { timeout: 8000 }, (res) => {
      res.resume();
      const loc = res.headers.location;
      resolve(loc || null);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// 店名照合用の正規化（空白・記号・一般ジャンル語を除去）
const GENRE_WORDS = /専門店?|本格|個室|炭火焼?き?|焼き?鳥|焼肉|餃子|ラーメン|拉麺|らーめん|居酒屋|酒場|バー|カフェ|喫茶|鮨|寿司|うなぎ|鰻|天ぷら|割烹|会席|懐石|中華|中国料理|イタリアン|フレンチ|ビストロ|スイーツ|大福|プリン|チーズケーキ|パフェ|ジェラート|クレープ|トースト|フレンチトースト|サンド|カレー|ビュッフェ|ランチ|鉄板焼き?|ホルモン|和牛|神戸牛|名古屋コーチン|おまかせ|カウンター|コース|店|名古屋/g;
function norm(s) {
  return String(s || '').replace(/[\s　・,，、。\-—–|｜()（）【】「」『』:：]/g, '').toLowerCase();
}
function core(s) {
  return norm(String(s || '').replace(GENRE_WORDS, ''));
}
// 文字bigram Dice係数
function dice(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  if (a.length < 2 || b.length < 2) return a === b ? 1 : (a.includes(b) || b.includes(a) ? 0.7 : 0);
  const A = bg(a), B = bg(b); let inter = 0, total = 0;
  for (const [g, c] of A) { total += c; if (B.has(g)) inter += Math.min(c, B.get(g)); }
  for (const [, c] of B) total += c;
  return (2 * inter) / total;
}
// 店名 vs マッチ店名 の一致判定
function namesMatch(storeName, matchedName) {
  const sn = norm(storeName), mn = norm(matchedName);
  if (!mn) return { ok: false, sim: 0 };
  if (sn === mn || sn.includes(mn) || mn.includes(sn)) return { ok: true, sim: 1 };
  const sc = core(storeName), mc = core(matchedName);
  // コア（ジャンル語除去後）の包含 or 高Dice
  if (sc.length >= 2 && mc.length >= 2 && (mc.includes(sc) || sc.includes(mc))) return { ok: true, sim: 0.9 };
  const sim = Math.max(dice(sn, mn), dice(sc, mc));
  return { ok: sim >= 0.85, sim: Math.round(sim * 100) / 100 };
}

// 飲食店業態か（よもぎ蒸しサロン等の非飲食を弾く）
const FOOD_TYPES = ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'meal_takeaway', 'meal_delivery'];
function isFoodPlace(types) {
  if (!Array.isArray(types) || types.length === 0) return true; // types 取得不可なら通す
  return types.some(t => FOOD_TYPES.includes(t));
}

// 名古屋市・愛知県内かを住所で検証（別都市の同名店を弾く）
function isInNagoyaArea(addr) {
  const a = String(addr || '');
  return /名古屋市|愛知県/.test(a) && !/東京都|横浜市|大阪市|京都市|福岡市|札幌市/.test(a);
}

async function tryOneQuery(queryStr) {
  const query = encodeURIComponent(queryStr);
  const findRes = await getJson(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id&language=ja&key=${KEY}`
  );
  const placeId = findRes?.candidates?.[0]?.place_id;
  if (!placeId) return null;
  const detailRes = await getJson(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos,name,formatted_address,types&language=ja&key=${KEY}`
  );
  return {
    matchedName: detailRes?.result?.name || '',
    address: detailRes?.result?.formatted_address || '',
    types: detailRes?.result?.types || [],
    photo: detailRes?.result?.photos?.[0] || null,
  };
}

async function fetchPhoto(name, area) {
  // 「名古屋」を含むクエリのみ（別都市の同名店を避ける）。店名一致＋名古屋/愛知の住所を満たす候補を採用
  const queries = [
    `${name} ${area} 名古屋`,
    `${name} 名古屋`,
  ];
  let best = null; // {matchedName, address, photo, sim}
  let lastMatchedName = '', lastReason = 'name-mismatch';
  for (const q of queries) {
    const r = await tryOneQuery(q);
    await new Promise(res => setTimeout(res, 150));
    if (!r || !r.matchedName) continue;
    lastMatchedName = r.matchedName;
    const m = namesMatch(name, r.matchedName);
    if (!m.ok) continue;
    if (!isInNagoyaArea(r.address)) { lastReason = 'out-of-area'; lastMatchedName = `${r.matchedName} @ ${r.address.slice(0, 24)}`; continue; }
    if (!isFoodPlace(r.types)) { lastReason = 'not-food'; lastMatchedName = `${r.matchedName} (${(r.types||[]).slice(0,2).join(',')})`; continue; }
    if (r.photo?.photo_reference) { best = { ...r, sim: m.sim }; break; }
  }
  if (!best) return { reason: lastReason, matchedName: lastMatchedName, sim: 0 };

  const attribution = best.photo.html_attributions?.[0]
    ? best.photo.html_attributions[0].replace(/<[^>]+>/g, '')
    : 'Google Maps';
  const cdnUrl = await resolveCdnUrl(
    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${best.photo.photo_reference}&key=${KEY}`
  );
  if (!cdnUrl) return { reason: 'no-cdn', matchedName: best.matchedName };
  return { url: cdnUrl, attribution, matchedName: best.matchedName, sim: best.sim };
}

const isSvgOrEmpty = (u) => !u || u.includes('/assets/store-figures/');

async function main() {
  const force = process.argv.includes('--force');
  const limIdx = process.argv.indexOf('--limit');
  const limit = limIdx >= 0 ? parseInt(process.argv[limIdx + 1], 10) : Infinity;

  const data = JSON.parse(fs.readFileSync(MANUAL_JSON, 'utf8'));
  let done = 0, ok = 0, miss = 0;

  for (const s of data.stores) {
    if (done >= limit) break;
    const cur = s['写真URL'] || '';
    // 既に実写（http かつ SVG/ストックでない）ならスキップ（--force で再取得）
    if (!force && cur.startsWith('http') && !/unsplash|pexels|loremflickr/i.test(cur)) continue;
    if (!force && !isSvgOrEmpty(cur) && cur.startsWith('http')) continue;

    done++;
    const name = s['店名'] || '';
    const area = s['エリア'] || '';
    const r = await fetchPhoto(name, area);
    if (r && r.url) {
      s['写真URL'] = r.url;
      s['写真クレジット'] = r.attribution;
      ok++;
      console.log(`✅ ${name} (一致度${r.sim}) → 実写採用 [${r.matchedName}]`);
    } else {
      miss++;
      const why = r?.reason === 'name-mismatch'
        ? `別店マッチのため不採用（候補:「${r.matchedName}」一致度${r.sim}）→ SVG維持`
        : `Google で実写取得できず（${r?.reason || 'unknown'}）→ SVG維持`;
      console.log(`— ${name}: ${why}`);
    }
    await new Promise(r => setTimeout(r, 200)); // レート配慮
  }

  fs.writeFileSync(MANUAL_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\n処理 ${done}件 / 実写採用 ${ok}件 / 不採用(SVG維持) ${miss}件`);
  console.log('次に: node build.js && node scripts/patch_static_store_photos.js');
}

main();
