/**
 * claude_tagging.js
 * Claude APIがウェブ検索で店舗情報を収集しタグを自動判定してスプレッドシートに書き込む
 *
 * 実行前に必要なもの：
 *   1. npm install @anthropic-ai/sdk googleapis
 *   2. credentials.json（サービスアカウントキー）を同じフォルダに配置
 *   3. ANTHROPIC_API_KEY 環境変数を設定（または下記 ANTHROPIC_KEY に直接記載）
 *   4. 下記「設定」セクションを自分の環境に合わせて変更
 *
 * 実行方法：
 *   ANTHROPIC_API_KEY=sk-ant-xxxx node claude_tagging.js
 */

'use strict';

const fs      = require('fs');
const { google } = require('googleapis');
const Anthropic  = require('@anthropic-ai/sdk');

// ================================================================
// 設定（ここを自分の環境に合わせて変更してください）
// ================================================================
const ANTHROPIC_KEY    = process.env.ANTHROPIC_API_KEY || 'YOUR_ANTHROPIC_API_KEY';
const SPREADSHEET_ID   = 'YOUR_SPREADSHEET_ID';   // ← スプレッドシートIDに変更
const SHEET_NAME       = 'シート1';               // ← シート名に変更
const CREDENTIALS_FILE = './credentials.json';
const UNFOUND_FILE     = './未取得店舗リスト.txt';
const MANUAL_FILE      = './手動確認リスト.txt';

// スプレッドシートの列名
const COL_NAME = '店名';
const COL_AREA = 'エリア';
const COL_TAG  = 'タグ';

// APIコール間のウェイト（ミリ秒）
const WAIT_MS = 1000;

// ================================================================
// Anthropic クライアント
// ================================================================
const anthropic = new Anthropic.default({ apiKey: ANTHROPIC_KEY });

// ================================================================
// Claude API でタグを判定
// ================================================================
async function fetchTagsFromClaude(storeName, area) {
  const prompt = `以下の飲食店について調べて、該当するタグをリストから選んでJSON形式で返してください。

店舗名：${storeName}
住所：名古屋市${area || ''}

選択できるタグ一覧：
シーン：デート,女子会,接待,誕生日・記念日,歓送迎会,忘年会・新年会,家族・子連れ
人数：1人OK,2〜4名,5〜10名,10〜20名,20名以上,貸切
席：個室,半個室,カウンター,テラス席,座敷,貸切可,隠れ家
予算：〜1000円,1000〜2000円,2000〜3000円,3000〜5000円,5000円以上

確信が持てないタグは含めないでください。
返答はJSON形式のみで返してください。
例：{"tags": ["個室","デート","3000〜5000円"]}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    tools: [{
      type: 'web_search_20260209',
      name: 'web_search'
    }],
    messages: [{ role: 'user', content: prompt }]
  });

  // レスポンスからテキストブロックを抽出
  var textContent = '';
  for (var i = 0; i < response.content.length; i++) {
    if (response.content[i].type === 'text') {
      textContent += response.content[i].text;
    }
  }

  // JSONを抽出してパース
  var match = textContent.match(/\{[\s\S]*?"tags"[\s\S]*?\}/);
  if (!match) return null;

  try {
    var parsed = JSON.parse(match[0]);
    return Array.isArray(parsed.tags) ? parsed.tags : null;
  } catch(e) {
    return null;
  }
}

// ================================================================
// Google Sheets 操作
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
  console.log('=== Claude タグ自動判定スクリプト ===\n');

  // 未取得店舗リストを読み込む
  if (!fs.existsSync(UNFOUND_FILE)) {
    console.error('❌ ' + UNFOUND_FILE + ' が見つかりません。');
    console.error('   先に hotpepper_fetch.js を実行してください。');
    process.exit(1);
  }

  var unfoundLines = fs.readFileSync(UNFOUND_FILE, 'utf8')
    .split('\n')
    .map(function(l){ return l.trim(); })
    .filter(function(l){ return l && !l.startsWith('#'); });

  // 店舗名のみ抽出（「[通信エラー]」などのサフィックスを除去）
  var storeNames = unfoundLines.map(function(l){
    return l.replace(/\s*\[.*?\]$/, '').trim();
  }).filter(function(n){ return n; });

  if (storeNames.length === 0) {
    console.log('✅ 未取得店舗リストに処理対象がありません。');
    return;
  }

  console.log('📋 対象店舗数: ' + storeNames.length + '件');
  console.log('');

  // Google Sheetsに接続
  console.log('📊 スプレッドシートに接続中...');
  var sheets;
  try {
    sheets = await getSheets();
  } catch(e) {
    console.error('❌ Sheets接続エラー:', e.message);
    process.exit(1);
  }

  var rows = await readSheet(sheets);
  if (rows.length === 0) {
    console.error('❌ シートにデータがありません。');
    process.exit(1);
  }

  // ヘッダー解析
  var headers    = rows[0];
  var nameColIdx = headers.indexOf(COL_NAME);
  var areaColIdx = headers.indexOf(COL_AREA);
  var tagColIdx  = headers.indexOf(COL_TAG);

  if (nameColIdx < 0) {
    console.error('❌ 「' + COL_NAME + '」列が見つかりません。');
    process.exit(1);
  }
  if (tagColIdx < 0) {
    tagColIdx = headers.length;
    console.log('ℹ️  「タグ」列が見つからないため新規作成します。');
    await writeCell(sheets, 0, tagColIdx, 'タグ');
  }

  console.log('✅ スプレッドシート接続完了\n');

  var successCount = 0;
  var failCount    = 0;
  var manualList   = [];

  // 各店舗を処理
  for (var i = 0; i < storeNames.length; i++) {
    var storeName = storeNames[i];
    process.stdout.write('[' + (i + 1) + '/' + storeNames.length + '] ' + storeName + ' ... ');

    // スプレッドシートから該当行を探す
    var rowIndex = -1;
    var area = '';
    for (var r = 1; r < rows.length; r++) {
      if ((rows[r][nameColIdx] || '').trim() === storeName) {
        rowIndex = r;
        area = (rows[r][areaColIdx] || '').trim();
        break;
      }
    }

    if (rowIndex < 0) {
      console.log('⚠️  シートに該当行なし（スキップ）');
      manualList.push(storeName + ' [シートに未登録]');
      failCount++;
      continue;
    }

    // Claude APIでタグ判定
    var tags = null;
    try {
      tags = await fetchTagsFromClaude(storeName, area);
    } catch(e) {
      console.log('❌ APIエラー: ' + e.message);
      manualList.push(storeName + ' [APIエラー]');
      failCount++;
      await new Promise(function(r){ setTimeout(r, WAIT_MS); });
      continue;
    }

    if (!tags || tags.length === 0) {
      console.log('❓ タグ判定不可');
      manualList.push(storeName + ' [タグ判定不可]');
      await writeCell(sheets, rowIndex, tagColIdx, '手動確認');
      failCount++;
      await new Promise(function(r){ setTimeout(r, WAIT_MS); });
      continue;
    }

    // 既存タグとマージ（重複除去）
    var existing = (rows[rowIndex][tagColIdx] || '').trim();
    if (existing && existing !== '要確認' && existing !== '手動確認') {
      var existingArr = existing.split(',').map(function(t){ return t.trim(); });
      tags.forEach(function(t){
        if (existingArr.indexOf(t) < 0) existingArr.push(t);
      });
      tags = existingArr;
    }

    var tagStr = tags.join(',');
    await writeCell(sheets, rowIndex, tagColIdx, tagStr);
    console.log('✅ ' + tagStr);
    successCount++;

    // レート制限対策
    await new Promise(function(r){ setTimeout(r, WAIT_MS); });
  }

  // 結果サマリー
  console.log('\n=== 処理完了 ===');
  console.log('✅ 成功: ' + successCount + '店舗');
  console.log('❌ 手動確認: ' + failCount + '店舗');

  // 手動確認リストを書き出し
  if (manualList.length > 0) {
    fs.writeFileSync(MANUAL_FILE, manualList.join('\n'), 'utf8');
    console.log('\n手動確認リストを保存しました: ' + MANUAL_FILE);
    console.log(manualList.map(function(n){ return '  - ' + n; }).join('\n'));
  }
}

main().catch(function(e) {
  console.error('\n❌ 予期しないエラー:', e.message);
  process.exit(1);
});
