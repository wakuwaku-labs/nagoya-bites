/**
 * hotpepper_fetch.js
 * HotpepperAPIから店舗情報を取得してスプレッドシートのタグ列に書き込む
 *
 * 実行前に必要なもの：
 *   1. Node.js がインストールされていること
 *   2. npm install googleapis node-fetch@2
 *   3. credentials.json（サービスアカウントキー）を同じフォルダに配置
 *   4. 下記「設定」セクションを自分の環境に合わせて変更
 */

'use strict';

const fs    = require('fs');
const https = require('https');
const { google } = require('googleapis');

// ================================================================
// 設定（ここを自分の環境に合わせて変更してください）
// ================================================================
const HOTPEPPER_KEY   = 'c4b06501b849309a';
const SPREADSHEET_ID  = 'YOUR_SPREADSHEET_ID';  // ← スプレッドシートのIDに変更
const SHEET_NAME      = 'シート1';               // ← シート名に変更（例：Sheet1）
const CREDENTIALS_FILE = './credentials.json';  // サービスアカウントのJSONファイル
const UNFOUND_FILE    = './未取得店舗リスト.txt';

// スプレッドシートの列名（1行目のヘッダー）
const COL_NAME = '店名';
const COL_AREA = 'エリア';
const COL_TAG  = 'タグ';

// ================================================================
// Hotpepper API 検索
// ================================================================
function searchHotpepper(storeName) {
  return new Promise(function(resolve, reject) {
    var url = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/?key='
      + HOTPEPPER_KEY
      + '&name=' + encodeURIComponent(storeName)
      + '&count=1&format=json';

    https.get(url, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          var json = JSON.parse(data);
          var shops = json.results && json.results.shop;
          if (shops && shops.length > 0) {
            resolve(shops[0]);
          } else {
            resolve(null);
          }
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ================================================================
// タグ生成ロジック
// ================================================================
function generateTags(shop) {
  var tags = [];

  // 個室
  if (shop.private_room === '1') {
    tags.push('個室');
  }

  // 宴会最大人数
  var capacity = parseInt(shop.party_capacity, 10);
  if (!isNaN(capacity)) {
    if (capacity >= 20)     tags.push('20名以上');
    else if (capacity >= 10) tags.push('10〜20名');
    else if (capacity >= 5)  tags.push('5〜10名');
    else if (capacity >= 2)  tags.push('2〜4名');
  }

  // 平均予算（文字列から数値を抽出）
  var budgetStr = (shop.budget && shop.budget.average) ? shop.budget.average : '';
  var budgetNum = parseInt(budgetStr.replace(/[^0-9]/g, ''), 10);
  if (!isNaN(budgetNum) && budgetNum > 0) {
    if      (budgetNum < 1000) tags.push('〜1000円');
    else if (budgetNum < 2000) tags.push('1000〜2000円');
    else if (budgetNum < 3000) tags.push('2000〜3000円');
    else if (budgetNum < 5000) tags.push('3000〜5000円');
    else                       tags.push('5000円以上');
  } else {
    // budget.name から判定（例：「2001～3000円」）
    var budgetName = (shop.budget && shop.budget.name) ? shop.budget.name : '';
    if      (budgetName.indexOf('1000') === -1 && budgetName.match(/[1-9]\d{2}円/)) tags.push('〜1000円');
    else if (budgetName.indexOf('1001') === 0 || budgetName.match(/1[0-9]{3}[〜～]/)) tags.push('1000〜2000円');
    else if (budgetName.match(/2[0-9]{3}[〜～]/)) tags.push('2000〜3000円');
    else if (budgetName.match(/3[0-9]{3}[〜～]/) || budgetName.match(/4[0-9]{3}[〜～]/)) tags.push('3000〜5000円');
    else if (budgetName.match(/5[0-9]{3}/))        tags.push('5000円以上');
  }

  // ランチ
  if (shop.lunch === '1') {
    tags.push('ランチ');
  }

  // 深夜営業
  if (shop.midnight_meal === '1') {
    tags.push('深夜');
  }

  // 子供同伴可
  if (shop.child === '1') {
    tags.push('家族・子連れ');
  }

  return tags;
}

// ================================================================
// スプレッドシート操作
// ================================================================
async function getSheets() {
  var auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  var client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

async function readSheet(sheets) {
  var res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_NAME
  });
  return res.data.values || [];
}

async function writeCell(sheets, rowIndex, colIndex, value) {
  var col = colIndexToLetter(colIndex);
  var range = SHEET_NAME + '!' + col + (rowIndex + 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: range,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] }
  });
}

function colIndexToLetter(index) {
  var letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

// ================================================================
// メイン処理
// ================================================================
async function main() {
  console.log('=== Hotpepper タグ自動取得スクリプト ===\n');

  // Google Sheetsに接続
  console.log('📊 スプレッドシートに接続中...');
  var sheets;
  try {
    sheets = await getSheets();
  } catch(e) {
    console.error('❌ Sheets接続エラー:', e.message);
    console.error('   credentials.json が正しく配置されているか確認してください。');
    process.exit(1);
  }

  // シートを読み込む
  var rows = await readSheet(sheets);
  if (rows.length === 0) {
    console.error('❌ シートにデータがありません。');
    process.exit(1);
  }

  // ヘッダー行を解析
  var headers = rows[0];
  var nameColIdx = headers.indexOf(COL_NAME);
  var areaColIdx = headers.indexOf(COL_AREA);
  var tagColIdx  = headers.indexOf(COL_TAG);

  if (nameColIdx < 0) {
    console.error('❌ 「' + COL_NAME + '」列が見つかりません。ヘッダー行を確認してください。');
    process.exit(1);
  }
  if (tagColIdx < 0) {
    // タグ列がなければ末尾に追加
    tagColIdx = headers.length;
    console.log('ℹ️  「タグ」列が見つからないため、列' + colIndexToLetter(tagColIdx) + 'に新規作成します。');
    await writeCell(sheets, 0, tagColIdx, 'タグ');
  }

  console.log('✅ ヘッダー確認完了');
  console.log('   店名列: ' + colIndexToLetter(nameColIdx));
  console.log('   タグ列: ' + colIndexToLetter(tagColIdx));
  console.log('   総行数: ' + (rows.length - 1) + '店舗\n');

  var unfound = [];
  var successCount = 0;
  var skipCount = 0;

  // 1店舗ずつ処理
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var storeName = (row[nameColIdx] || '').trim();
    if (!storeName) continue;

    process.stdout.write('[' + i + '/' + (rows.length - 1) + '] ' + storeName + ' ... ');

    // Hotpepper APIで検索
    var shop = null;
    try {
      shop = await searchHotpepper(storeName);
    } catch(e) {
      console.log('⚠️  API通信エラー（スキップ）');
      unfound.push(storeName + ' [通信エラー]');
      skipCount++;
      continue;
    }

    if (!shop) {
      console.log('❓ 見つからず');
      unfound.push(storeName);
      await writeCell(sheets, i, tagColIdx, '要確認');
      skipCount++;
      continue;
    }

    // タグ生成
    var tags = generateTags(shop);
    var tagStr = tags.join(',');

    // 既存タグがあればマージ（重複除去）
    var existingTag = (row[tagColIdx] || '').trim();
    if (existingTag && existingTag !== '要確認') {
      var existing = existingTag.split(',').map(function(t){ return t.trim(); });
      tags.forEach(function(t){ if (existing.indexOf(t) < 0) existing.push(t); });
      tagStr = existing.join(',');
    }

    // スプレッドシートに書き込み
    await writeCell(sheets, i, tagColIdx, tagStr);
    console.log('✅ ' + (tagStr || '（タグなし）'));
    successCount++;

    // API制限対策：0.5秒待機
    await new Promise(function(r){ setTimeout(r, 500); });
  }

  // 結果サマリー
  console.log('\n=== 処理完了 ===');
  console.log('✅ 成功: ' + successCount + '店舗');
  console.log('❌ 未取得: ' + skipCount + '店舗');

  // 未取得リストをファイルに書き出し
  if (unfound.length > 0) {
    fs.writeFileSync(UNFOUND_FILE, unfound.join('\n'), 'utf8');
    console.log('\n未取得店舗リストを保存しました: ' + UNFOUND_FILE);
    console.log(unfound.map(function(n){ return '  - ' + n; }).join('\n'));
  }
}

main().catch(function(e) {
  console.error('\n❌ 予期しないエラー:', e.message);
  process.exit(1);
});
