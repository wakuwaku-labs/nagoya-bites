'use strict';

/**
 * fetch_scores.js
 * Google Maps から店舗の評価を取得して、スプレッドシートのR列に書き込む
 *
 * 実行方法:
 *   node fetch_scores.js <スプレッドシートID>
 *
 * 中断・再開: 進捗は .scores_progress.json に保存される
 *   再実行すると途中から再開します
 */

const { google } = require('googleapis');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ================================================================
// 設定
// ================================================================
const SPREADSHEET_ID  = process.argv[2] || '';
const SHEET_NAME      = '';           // 空欄 = 1枚目のシート
const NAME_COL        = 0;            // A列 (0始まり)
const RATING_COL      = 17;           // R列 (0始まり)
const SEARCH_AREA     = '名古屋';
const DELAY_MS        = 1200;         // リクエスト間隔（ミリ秒）
const BATCH_SIZE      = 50;           // 1回の実行で処理する件数
const PROGRESS_FILE   = path.join(__dirname, '.scores_progress.json');

let browser, page;

// ================================================================
// メイン
// ================================================================
async function main() {
  if (!SPREADSHEET_ID) {
    console.error('使い方: node fetch_scores.js <スプレッドシートID>');
    process.exit(1);
  }

  // Google 認証（サービスアカウント）
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // ブラウザ起動
  console.log('ブラウザを起動中...');
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });

  // スプレッドシートの情報を取得
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetTitle = SHEET_NAME || meta.data.sheets[0].properties.title;
  console.log(`シート: ${sheetTitle}`);

  // データ取得
  const range = `${sheetTitle}!A:R`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  const rows = res.data.values || [];
  console.log(`総行数: ${rows.length}`);

  // 進捗を読み込む
  let progress = loadProgress();
  let startRow = progress.lastRow || 1; // 0行目はヘッダーのためスキップ
  console.log(`開始行: ${startRow + 1}行目`);

  let processed = 0;
  let updated = 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const storeName = (row[NAME_COL] || '').trim();

    // 店名が空ならスキップ
    if (!storeName) continue;

    // すでにR列が埋まっていたらスキップ
    const existing = (row[RATING_COL] || '').trim();
    if (existing) continue;

    if (processed >= BATCH_SIZE) {
      saveProgress({ lastRow: i });
      await browser.close();
      console.log(`\n${BATCH_SIZE}件処理しました。再実行で続きから再開できます。`);
      console.log(`次回開始: ${i + 1}行目`);
      return;
    }

    process.stdout.write(`[${i + 1}] ${storeName} ... `);

    const rating = await fetchGoogleRating(storeName);
    if (rating) {
      // R列に書き込み
      const cellRange = `${sheetTitle}!R${i + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: cellRange,
        valueInputOption: 'RAW',
        requestBody: { values: [[rating]] },
      });
      console.log(rating);
      updated++;
    } else {
      console.log('見つからず');
    }

    processed++;
    await sleep(DELAY_MS);
  }

  // 全件完了
  fs.existsSync(PROGRESS_FILE) && fs.unlinkSync(PROGRESS_FILE);
  console.log(`\n完了: ${processed}件処理、${updated}件更新しました`);
  await browser.close();
}

// ================================================================
// Google Maps スクレイピング（Puppeteer）
// ================================================================
async function fetchGoogleRating(storeName) {
  try {
    const query = encodeURIComponent(storeName + ' ' + SEARCH_AREA);
    await page.goto(`https://www.google.com/maps/search/${query}`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    // 評価テキストを取得（aria-label または span）
    const rating = await page.evaluate(() => {
      // パターン1: aria-label="4.2 stars" 形式
      const ariaEl = document.querySelector('[aria-label*="stars"], [aria-label*="つ星"]');
      if (ariaEl) {
        const m = ariaEl.getAttribute('aria-label').match(/([\d.]+)/);
        if (m) return m[1];
      }
      // パターン2: 評価数値のspan
      const spans = [...document.querySelectorAll('span')];
      for (const s of spans) {
        const t = s.textContent.trim();
        if (/^\d\.\d$/.test(t)) {
          const v = parseFloat(t);
          if (v >= 1 && v <= 5) return t;
        }
      }
      return null;
    });

    return rating;
  } catch (e) {
    return null;
  }
}

// ================================================================
// 進捗管理
// ================================================================
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data), 'utf8');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(e => {
  console.error('エラー:', e.message);
  process.exit(1);
});
