'use strict';
/**
 * fill_recommendations.js
 * Google SheetsのT列「おすすめポイント」が空の店舗に
 * Claude APIで30〜50文字のおすすめポイントを生成して書き込む
 *
 * 使い方:
 *   1. ANTHROPIC_API_KEY=sk-ant-... node fill_recommendations.js
 *   2. または .env ファイルに ANTHROPIC_API_KEY=sk-ant-... と書いて実行
 */

const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// .envファイルがあれば読み込む
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const SPREADSHEET_ID = '1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ';
const SHEET_NAME = 'シート1';
const KEY_FILE = path.join(__dirname, 'service-account.json');
const BATCH_SIZE = 30; // 1リクエストに何店舗まとめるか

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function readSheet(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:T`,
  });
  return res.data.values || [];
}

function buildPrompt(stores) {
  const list = stores.map((s, i) =>
    `${i + 1}. 店名:${s['店名']} ジャンル:${s['ジャンル'] || ''} エリア:${s['エリア'] || ''} 価格帯:${s['価格帯'] || ''} タグ:${s['タグ'] || ''} Google評価:${s['Google評価'] || ''}`
  ).join('\n');

  return `以下の飲食店それぞれについて、来店を後押しする「おすすめポイント」を30〜50文字で生成してください。

ルール：
- 日本語のみ
- 体言止めOK
- 記号（！？）は使わない
- 各店の特徴（ジャンル・エリア・タグ・価格帯・評価）を活かす
- 番号順に1行ずつ、テキストだけ出力（番号・記号・説明不要）

店舗リスト：
${list}`;
}

async function generateRecommendations(stores) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(stores);

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const lines = msg.content[0].text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  return lines;
}

async function writeColumn(sheets, rowIndexes, values) {
  // 各セルを個別に更新（バッチwrite）
  const data = rowIndexes.map((rowIdx, i) => ({
    range: `${SHEET_NAME}!T${rowIdx + 1}`,
    values: [[values[i] || '']],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data,
    },
  });
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('エラー: ANTHROPIC_API_KEY が設定されていません');
    console.error('実行方法: ANTHROPIC_API_KEY=sk-ant-... node fill_recommendations.js');
    process.exit(1);
  }

  console.log('スプレッドシートを読み込み中...');
  const sheets = await getSheets();
  const rows = await readSheet(sheets);

  if (rows.length < 2) {
    console.error('データが見つかりません');
    process.exit(1);
  }

  const headers = rows[0];
  const colIndex = headers.indexOf('おすすめポイント');
  if (colIndex === -1) {
    console.error('T列「おすすめポイント」が見つかりません');
    process.exit(1);
  }

  // おすすめポイントが空の行を抽出
  const targets = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const store = {};
    headers.forEach((h, j) => { store[h] = (row[j] || '').trim(); });
    if (!store['店名']) continue;
    if (!store['おすすめポイント']) {
      targets.push({ rowIdx: i, store });
    }
  }

  console.log(`未入力の店舗: ${targets.length}件`);
  if (targets.length === 0) {
    console.log('全店舗入力済みです');
    return;
  }

  // バッチ処理
  let done = 0;
  for (let start = 0; start < targets.length; start += BATCH_SIZE) {
    const batch = targets.slice(start, start + BATCH_SIZE);
    const stores = batch.map(t => t.store);

    process.stdout.write(`生成中... ${done + 1}〜${done + batch.length}件目 / ${targets.length}件`);

    let recommendations;
    try {
      recommendations = await generateRecommendations(stores);
    } catch (e) {
      console.error('\nAPI エラー:', e.message);
      process.exit(1);
    }

    // 件数が合わない場合は空文字で埋める
    while (recommendations.length < batch.length) recommendations.push('');

    const rowIndexes = batch.map(t => t.rowIdx);
    await writeColumn(sheets, rowIndexes, recommendations.slice(0, batch.length));

    done += batch.length;
    console.log(' → 書き込み完了');

    // レート制限対策（0.5秒待機）
    if (start + BATCH_SIZE < targets.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n完了: ${done}件のおすすめポイントを書き込みました`);
  console.log('ビルド&反映: node build.js && git add index.html sitemap.xml && git commit -m "chore: update" && git push');
}

main().catch(e => { console.error(e.message); process.exit(1); });
