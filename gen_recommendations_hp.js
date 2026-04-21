'use strict';
/**
 * gen_recommendations_hp.js
 * ホットペッパーAPIからキャッチコピー・PR文・料理情報を取得し
 * 各店に特化したおすすめポイントを生成してデスクトップに出力する
 *
 * 実行: node gen_recommendations_hp.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const HOTPEPPER_KEY = 'c4b06501b849309a';
const CSV_URL = 'https://docs.google.com/spreadsheets/d/1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ/export?format=csv&gid=415662614';
const OUT = path.join(os.homedir(), 'Desktop', 'おすすめポイント_一覧.txt');

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

function fetchHotpepperById(id) {
  const url = `https://webservice.recruit.co.jp/hotpepper/gourmet/v1/?key=${HOTPEPPER_KEY}&id=${encodeURIComponent(id)}&count=1&format=json`;
  return fetchUrl(url).then(data => {
    const json = JSON.parse(data);
    const shops = json.results && json.results.shop;
    return (shops && shops.length > 0) ? shops[0] : null;
  });
}

// ホットペッパーデータからおすすめポイントを生成
function buildPoint(shop, fallbackStore) {
  const catchCopy  = (shop.catch || '').trim();
  const prShort    = (shop.pr && shop.pr.pr_short ? shop.pr.pr_short : '').trim();
  const prLong     = (shop.pr && shop.pr.pr_long  ? shop.pr.pr_long  : '').trim();
  const genreName  = (shop.genre && shop.genre.name) || '';
  const subGenre   = (shop.sub_genre && shop.sub_genre.name) || '';
  const food       = (shop.food && shop.food.name) || '';
  const privateRoom = shop.private_room === '1';
  const lunch      = shop.lunch === '1';
  const midnight   = shop.midnight_meal === '1';
  const child      = shop.child === '1';
  const freeDrink  = shop.free_drink === '1';
  const freeFood   = shop.free_food === '1';
  const open_air   = shop.open_air === '1';
  const tatami     = shop.tatami === '1';
  const horigotatsu = shop.horigotatsu === '1';

  // 優先順位: キャッチコピー → PR短文 → PR長文の冒頭 → 自動生成
  let base = '';

  if (catchCopy && catchCopy.length >= 10) {
    base = catchCopy;
  } else if (prShort && prShort.length >= 10) {
    base = prShort;
  } else if (prLong && prLong.length >= 10) {
    // PR長文の最初の文（句点まで）を使用
    const firstSentence = prLong.split(/[。！？\n]/)[0];
    if (firstSentence.length >= 10) base = firstSentence;
  }

  // ベース文がある場合は50文字に収める
  if (base) {
    // 句点・感嘆符を除去してクリーンに
    base = base.replace(/[！!]/g, '').trim();
    if (base.length > 50) {
      // 最後の句点か読点で切る
      const cut = base.slice(0, 50);
      const lastPunct = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('、'), cut.lastIndexOf(' '));
      base = lastPunct > 30 ? cut.slice(0, lastPunct + 1) : cut.slice(0, 48) + '。';
    }
    return base;
  }

  // ベースがない場合はパーツから組み立て
  const parts = [];

  if (food && food !== genreName) parts.push(`${food}が自慢`);
  else if (subGenre && subGenre !== genreName) parts.push(`${subGenre}の専門店`);
  else if (genreName) parts.push(`こだわりの${genreName}`);

  if (privateRoom) parts.push('個室あり');
  if (freeDrink && freeFood) parts.push('食べ飲み放題プランあり');
  else if (freeDrink) parts.push('飲み放題プランあり');
  if (tatami || horigotatsu) parts.push('座敷・掘りごたつ完備');
  if (lunch) parts.push('ランチ営業あり');
  if (midnight) parts.push('深夜まで営業');
  if (child) parts.push('お子様連れも歓迎');
  if (open_air) parts.push('開放的なオープンエア席あり');

  // タグから補足
  const tags = (fallbackStore['タグ'] || '').split(',').map(t => t.trim());
  if (tags.includes('女子会') && !parts.includes('女子会')) parts.push('女子会にも最適');
  if (tags.includes('誕生日・記念日')) parts.push('誕生日・記念日プランあり');

  let text = parts[0] || `${genreName || fallbackStore['ジャンル'] || '料理'}が楽しめる人気店`;
  for (let i = 1; i < parts.length; i++) {
    const next = text + '。' + parts[i];
    if (next.length <= 50) text = next;
    else break;
  }
  if (text.length > 50) text = text.slice(0, 49) + '。';
  return text;
}

// ホットペッパーIDなしの場合のフォールバック
function buildFallback(s) {
  const tags   = (s['タグ'] || '').split(',').map(t => t.trim());
  const genre  = s['ジャンル'] || '';
  const rating = parseFloat(s['Google評価']) || 0;
  const parts  = [];

  if (genre) parts.push(`${genre}の人気店`);
  if (tags.includes('個室')) parts.push('個室あり');
  if (tags.includes('女子会')) parts.push('女子会におすすめ');
  if (tags.includes('誕生日・記念日')) parts.push('記念日プランあり');
  if (tags.some(t => t.includes('100名以上'))) parts.push('大宴会も対応可');
  if (rating >= 4.3) parts.push(`Google評価${rating}の高評価店`);

  let text = parts[0] || `${s['エリア'] || '名古屋'}エリアで人気の${genre || '飲食店'}`;
  for (let i = 1; i < parts.length; i++) {
    const next = text + '。' + parts[i];
    if (next.length <= 50) text = next;
    else break;
  }
  return text;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('CSVを取得中...');
  const csv = await fetchUrl(CSV_URL);
  const all = parseCSV(csv).filter(s => s['公開フラグ'] !== 'FALSE');
  const targets = all.filter(s => !s['おすすめポイント']);
  console.log(`未入力: ${targets.length}件\n`);

  const lines = ['店名\tおすすめポイント'];
  let done = 0, hpHit = 0, fallback = 0;

  for (const s of targets) {
    const hpId = s['ホットペッパーID'];
    let point = '';

    if (hpId) {
      try {
        const shop = await fetchHotpepperById(hpId);
        if (shop) {
          point = buildPoint(shop, s);
          hpHit++;
        } else {
          point = buildFallback(s);
          fallback++;
        }
      } catch (e) {
        point = buildFallback(s);
        fallback++;
      }
      await sleep(300); // API レート制限対策
    } else {
      point = buildFallback(s);
      fallback++;
    }

    lines.push(`${s['店名']}\t${point}`);
    done++;
    if (done % 50 === 0) {
      process.stdout.write(`\r${done}/${targets.length}件 処理中...`);
    }
  }

  console.log(`\n\nホットペッパーから取得: ${hpHit}件 / フォールバック: ${fallback}件`);
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`\n出力完了: ${OUT}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
