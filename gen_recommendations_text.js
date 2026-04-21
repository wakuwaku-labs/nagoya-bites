'use strict';
/**
 * gen_recommendations_text.js
 * おすすめポイントが空の店舗を抽出し、ルールベースで文章を生成して
 * デスクトップに TSV ファイルとして出力する
 * 出力: ~/Desktop/おすすめポイント_一覧.txt
 *   列1: 店名
 *   列2: おすすめポイント（30〜50文字）
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ/export?format=csv&gid=415662614';
const OUT     = path.join(require('os').homedir(), 'Desktop', 'おすすめポイント_一覧.txt');

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

// ---- おすすめポイント生成ロジック ----
function generate(s) {
  const tags   = (s['タグ'] || '').split(',').map(t => t.trim());
  const genre  = s['ジャンル'] || '';
  const area   = s['エリア'] || '';
  const price  = s['価格帯'] || '';
  const rating = parseFloat(s['Google評価']) || 0;

  const features = [];

  // ジャンル特徴
  if (genre.includes('焼肉'))        features.push('こだわり食材の焼肉が楽しめる');
  else if (genre.includes('寿司'))   features.push('鮮度抜群のネタが揃う本格寿司');
  else if (genre.includes('天ぷら')) features.push('サクサク揚げたての天ぷらが絶品');
  else if (genre.includes('ラーメン'))features.push('名古屋ならではのスープが自慢');
  else if (genre.includes('焼き鳥')) features.push('備長炭で焼き上げる香ばしい焼き鳥');
  else if (genre.includes('海鮮') || genre.includes('魚介')) features.push('新鮮な海の幸が堪能できる');
  else if (genre.includes('イタリアン') || genre.includes('イタリア')) features.push('本格イタリアンをカジュアルに楽しめる');
  else if (genre.includes('フレンチ')) features.push('本格フレンチをリーズナブルに');
  else if (genre.includes('中華'))   features.push('本格中華料理が揃う');
  else if (genre.includes('鍋'))     features.push('旬の食材をたっぷり使った鍋が自慢');
  else if (genre.includes('しゃぶしゃぶ')) features.push('上質な肉のしゃぶしゃぶが人気');
  else if (genre.includes('すき焼き')) features.push('厳選和牛のすき焼きが堪能できる');
  else if (genre.includes('居酒屋')) features.push('料理もドリンクも充実した居酒屋');
  else if (genre.includes('バル') || genre.includes('バー')) features.push('こだわりのお酒と料理が楽しめる');
  else if (genre.includes('カフェ') || genre.includes('喫茶')) features.push('落ち着いた空間でひと息つける');
  else features.push(`${genre || 'グルメ'}が楽しめる人気店`);

  // 個室
  if (tags.includes('個室')) features.push('個室あり');

  // 宴会用途
  if (tags.includes('歓送迎会') && tags.includes('忘年会・新年会')) features.push('歓送迎会・忘年会に最適');
  else if (tags.includes('歓送迎会'))    features.push('歓送迎会にぴったり');
  else if (tags.includes('忘年会・新年会')) features.push('忘年会・新年会に人気');

  // 人数
  if (tags.some(t => t.includes('100名以上')))    features.push('100名以上の大宴会も対応');
  else if (tags.some(t => t.includes('70〜80名') || t.includes('80〜90名') || t.includes('90〜100名'))) features.push('大人数の宴会にも対応');
  else if (tags.some(t => t.includes('50〜60名') || t.includes('60〜70名'))) features.push('大人数の宴会OK');
  else if (tags.some(t => t.includes('10〜20名') || t.includes('20〜30名'))) features.push('少人数の会食に最適');

  // 女子会・記念日
  if (tags.includes('女子会'))          features.push('女子会におすすめ');
  if (tags.includes('誕生日・記念日'))  features.push('誕生日・記念日プランあり');

  // 評価
  if (rating >= 4.5)      features.push(`Google評価${rating}の高評価店`);
  else if (rating >= 4.0) features.push(`Google評価${rating}と好評`);

  // エリア補足
  const areaLabel = area.replace('名古屋駅','名駅');
  if (areaLabel) features.push(`${areaLabel}エリアで人気`);

  // 組み合わせて30〜50文字になるよう調整
  let text = features[0] || '名古屋で人気の一軒';
  for (let i = 1; i < features.length; i++) {
    const next = text + '。' + features[i];
    if (next.length <= 50) text = next;
    else break;
  }

  // 長すぎる場合はカット
  if (text.length > 50) text = text.slice(0, 49) + '。';

  return text;
}

async function main() {
  console.log('CSVを取得中...');
  const csv    = await fetchUrl(CSV_URL);
  const stores = parseCSV(csv).filter(s => s['公開フラグ'] !== 'FALSE');
  const empty  = stores.filter(s => !s['おすすめポイント']);
  console.log(`未入力: ${empty.length}件`);

  const lines = ['店名\tおすすめポイント'];
  for (const s of empty) {
    const point = generate(s);
    lines.push(`${s['店名']}\t${point}`);
  }

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`\n出力完了: ${OUT}`);
  console.log('スプレッドシートへの貼り付け手順:');
  console.log('  1. ファイルをテキストエディタで開いてコピー');
  console.log('  2. スプレッドシートのA1などに一旦貼り付けてT列に対応する値を確認');
  console.log('  3. または VLOOKUP で店名をキーにT列へ転記');
}

main().catch(e => { console.error(e.message); process.exit(1); });
