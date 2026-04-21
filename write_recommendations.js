'use strict';
/**
 * write_recommendations.js
 * Desktop/おすすめポイント_一覧.txt を読み込んで
 * Google Sheets の T列に書き込む（行数上限対応済み）
 */

const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const https = require('https');

const SPREADSHEET_ID = '1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ';
const SHEET_GID      = 415662614; // 店舗データシートのID（名前の文字コード問題を回避）
const KEY_FILE       = path.join(__dirname, 'service-account.json');
const TSV_FILE       = path.join(os.homedir(), 'Desktop', 'おすすめポイント_一覧.txt');
const CSV_URL = 'https://docs.google.com/spreadsheets/d/1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ/export?format=csv&gid=415662614';

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

async function main() {
  // TSVファイルを読み込む
  console.log('TSVファイルを読み込み中...');
  const tsv = fs.readFileSync(TSV_FILE, 'utf8');
  const tsvLines = tsv.trim().split('\n').slice(1);
  const pointMap = {};
  for (const line of tsvLines) {
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    const name  = line.slice(0, tab).trim();
    const point = line.slice(tab + 1).trim();
    if (name && point) pointMap[name] = point;
  }
  console.log(`TSV: ${Object.keys(pointMap).length}件`);

  // スプレッドシートを読み込む
  console.log('スプレッドシートを読み込み中...');
  const csv = await fetchUrl(CSV_URL);
  const stores = parseCSV(csv);

  // Sheets API 認証
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // シートのメタデータを取得してシートIDと現在行数を確認
  console.log('シート情報を確認中...');
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetInfo = meta.data.sheets.find(s => s.properties.sheetId === SHEET_GID);
  if (!sheetInfo) { console.error('シートが見つかりません'); process.exit(1); }
  const sheetId    = sheetInfo.properties.sheetId;
  const sheetTitle = sheetInfo.properties.title; // 実際のタイトルを使用
  const currentRows = sheetInfo.properties.gridProperties.rowCount;
  console.log(`シート名: ${sheetTitle}`);
  const neededRows  = stores.length + 2; // ヘッダー + データ + 余裕

  console.log(`現在の行数: ${currentRows} / 必要行数: ${neededRows}`);

  // 行数が足りなければ追加
  if (currentRows < neededRows) {
    console.log(`行を ${neededRows - currentRows} 行追加します...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          appendDimension: {
            sheetId,
            dimension: 'ROWS',
            length: neededRows - currentRows,
          }
        }]
      }
    });
    console.log('行追加完了');
  }

  // 書き込みデータを組み立て（未入力のみ）
  const data = [];
  for (let i = 0; i < stores.length; i++) {
    const s = stores[i];
    if (!s['店名']) continue;
    if (!s['おすすめポイント'] && pointMap[s['店名']]) {
      const rowNum = i + 2;
      data.push({
        range: `'${sheetTitle}'!T${rowNum}`,
        values: [[pointMap[s['店名']]]],
      });
    }
  }

  console.log(`書き込み対象: ${data.length}件`);

  // 100件ずつバッチ送信
  const CHUNK = 100;
  for (let start = 0; start < data.length; start += CHUNK) {
    const chunk = data.slice(start, start + CHUNK);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: chunk },
    });
    process.stdout.write(`\r${Math.min(start + CHUNK, data.length)}/${data.length}件 書き込み中...`);
  }

  console.log('\nスプレッドシートへの書き込み完了');
}

main().catch(e => { console.error(e.message); process.exit(1); });
