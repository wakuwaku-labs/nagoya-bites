'use strict';

const { google } = require('googleapis');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID  = '1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ';
const COOKIE_FILE     = path.join(__dirname, '.ig_cookies.json');
const PROGRESS_FILE   = path.join(__dirname, '.ig_progress.json');
const BATCH_SIZE      = 15;
const DELAY_MS        = 7000;

// ================================================================
// メイン
// ================================================================
async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // データ取得（A列=店名, K列=Instagram）
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A:K',
  });
  const rows = res.data.values || [];
  console.log(`総行数: ${rows.length}`);

  // ブラウザ起動
  console.log('ブラウザ起動中...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // 進捗読み込み
  let progress = loadProgress();
  let startRow = progress.lastRow || 1;
  console.log(`開始行: ${startRow + 1}`);

  let processed = 0;
  let found = 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const storeName = (row[0] || '').trim();
    const currentIG = (row[10] || '').trim();

    if (!storeName) continue;

    // すでにInstagramプロフィールURLがあればスキップ
    if (currentIG.includes('instagram.com') && !currentIG.includes('search')) {
      continue;
    }

    if (processed >= BATCH_SIZE) {
      saveProgress({ lastRow: i });
      await browser.close();
      console.log(`\n${BATCH_SIZE}件処理しました。再実行で続きから再開できます。`);
      console.log(`次回開始: ${i + 1}行目`);
      return;
    }

    process.stdout.write(`[${i + 1}] ${storeName} ... `);

    const igUrl = await searchInstagramAccount(page, storeName);
    if (igUrl) {
      // K列に書き込み
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `K${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[igUrl]] },
      });
      console.log(igUrl);
      found++;
    } else {
      console.log('見つからず');
    }

    processed++;
    await sleep(DELAY_MS);
  }

  await browser.close();
  fs.existsSync(PROGRESS_FILE) && fs.unlinkSync(PROGRESS_FILE);
  console.log(`\n完了: ${processed}件処理、${found}件取得`);
}

// ================================================================
// Instagram アカウント検索（Google経由）
// ================================================================
const IG_RESERVED = new Set([
  'reels','reel','explore','accounts','p','stories','direct',
  'tv','audio','tags','places','ar','challenge','about','privacy',
  'legal','help','press','api','blog','jobs','ads','developer',
  'lite','creator','business','safety','terms','login','signup',
  'web','graphql','static','embed','favicon.ico','shoppingdirect',
  'about','_n','_u','popular','trending','featured','suggested',
  'directory','hashtag','location','music','search','store','checkout',
]);

async function searchInstagramAccount(page, storeName) {
  try {
    // Yahoo Japan で site:instagram.com 検索
    const query = encodeURIComponent(`site:instagram.com ${storeName} 名古屋`);
    await page.goto(`https://search.yahoo.co.jp/search?p=${query}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await sleep(2000);

    const igUrl = await page.evaluate((reservedArr) => {
      const reserved = new Set(reservedArr);
      // Yahoo検索結果のHTMLから instagram.com/username/ を正規表現で抽出
      const html = document.body.innerHTML;
      const matches = html.matchAll(/instagram\.com\/([a-zA-Z0-9_.]{3,30})\//g);
      for (const m of matches) {
        const username = m[1].toLowerCase();
        if (reserved.has(username)) continue;
        return 'https://www.instagram.com/' + m[1] + '/';
      }
      return null;
    }, [...IG_RESERVED]);

    return igUrl;
  } catch (e) {
    return null;
  }
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return {}; }
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
