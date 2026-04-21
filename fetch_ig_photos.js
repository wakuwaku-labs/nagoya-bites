'use strict';

/**
 * fetch_ig_photos.js
 * 各店舗のInstagramプロフィールから写真投稿(/p/)を最大3枚取得し
 * スプレッドシートのU列(内観写真URL)・V列(料理写真URL1)・W列(料理写真URL2)に書き込む
 */

const { google } = require('googleapis');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ';
const COOKIE_FILE    = path.join(__dirname, '.ig_cookies.json');
const PROGRESS_FILE  = path.join(__dirname, '.ig_photos_progress.json');
const BATCH_SIZE     = 20;
const DELAY_MS       = 4000;

// 列インデックス（0始まり）
const COL_NAME    = 0;   // A: 店名
const COL_IG      = 10;  // K: Instagram
const COL_PHOTO1  = 20;  // U: 内観写真URL
const COL_PHOTO2  = 21;  // V: 料理写真URL1
const COL_PHOTO3  = 22;  // W: 料理写真URL2

async function main() {
  if (!fs.existsSync(COOKIE_FILE)) {
    console.error('先に ig_login.js を実行してください');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // A〜W列を取得
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A:W',
  });
  const rows = res.data.values || [];
  console.log(`総行数: ${rows.length}`);

  console.log('ブラウザ起動中...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });

  const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
  await page.setCookie(...cookies);

  let progress = loadProgress();
  let startRow = progress.lastRow || 1;
  console.log(`開始行: ${startRow + 1}`);

  let processed = 0;
  let found = 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const storeName  = (row[COL_NAME]   || '').trim();
    const igProfile  = (row[COL_IG]     || '').trim();
    const existing1  = (row[COL_PHOTO1] || '').trim();
    const existing2  = (row[COL_PHOTO2] || '').trim();
    const existing3  = (row[COL_PHOTO3] || '').trim();

    if (!storeName) continue;

    // Instagramアカウントがない場合はスキップ
    if (!igProfile || !igProfile.match(/instagram\.com\/[a-zA-Z0-9_.]+\/?$/) || igProfile.includes('search')) {
      continue;
    }

    // 3枚すでに取得済みならスキップ
    if (existing1 && existing2 && existing3) {
      continue;
    }

    if (processed >= BATCH_SIZE) {
      saveProgress({ lastRow: i });
      await browser.close();
      console.log(`\n${BATCH_SIZE}件処理しました。`);
      console.log(`次回は: node fetch_ig_photos.js`);
      return;
    }

    process.stdout.write(`[${i + 1}] ${storeName.slice(0, 20)} ... `);

    const photos = await getPhotoUrls(page, igProfile);

    if (photos.length > 0) {
      const updateValues = [
        photos[0] || existing1 || '',
        photos[1] || existing2 || '',
        photos[2] || existing3 || '',
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `U${i + 1}:W${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [updateValues] },
      });
      console.log(`${photos.length}枚取得`);
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

async function getPhotoUrls(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    // ログイン確認
    const isLoggedIn = await page.evaluate(() => !document.querySelector('input[name="username"]'));
    if (!isLoggedIn) return [];

    // 写真投稿（/p/）のサムネイルCDN URLとalt（キャプション）を最大9件取得
    const posts = await page.evaluate(() => {
      const anchors = [...document.querySelectorAll('a[href*="/p/"]')];
      const seen = new Set();
      const results = [];
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        const match = href.match(/\/p\/([A-Za-z0-9_-]+)/);
        if (match && !seen.has(match[1])) {
          seen.add(match[1]);
          const img = a.querySelector('img');
          const alt = img ? (img.getAttribute('alt') || '') : '';
          // img.src はCDN画像URL（ログイン不要でアクセス可能）
          const thumbnailUrl = img ? (img.src || img.getAttribute('src') || '') : '';
          if (!thumbnailUrl || !thumbnailUrl.startsWith('http')) continue;
          results.push({ url: thumbnailUrl, caption: alt });
          if (results.length >= 9) break;
        }
      }
      return results;
    });

    // キーワードで内観／料理を分類
    const interiorKeywords = ['内観', '店内', '席', '座席', 'カウンター', 'テーブル', '個室', '空間', '雰囲気', 'お席', '店舗内'];
    const foodKeywords = ['料理', 'ランチ', 'ディナー', 'メニュー', '食べ', '美味', 'うまい', '旨い', 'おいしい', '美味しい',
      '丼', 'ラーメン', '焼き', '刺身', 'お肉', '海鮮', 'ステーキ', 'パスタ', 'ピザ', 'カレー',
      'そば', 'うどん', '寿司', '鍋', '串', '揚げ', 'サラダ', 'デザート', 'スイーツ'];

    function classify(caption) {
      const intScore = interiorKeywords.filter(k => caption.includes(k)).length;
      const foodScore = foodKeywords.filter(k => caption.includes(k)).length;
      if (intScore > foodScore && intScore > 0) return 'interior';
      if (foodScore > 0) return 'food';
      return 'unknown';
    }

    let interior = null;
    const foods = [];
    const unknowns = [];

    for (const post of posts) {
      const type = classify(post.caption);
      if (type === 'interior' && !interior) {
        interior = post.url;
      } else if (type === 'food' && foods.length < 2) {
        foods.push(post.url);
      } else {
        unknowns.push(post.url);
      }
    }

    // 不足分はunknownで補填（順序: 内観URL, 料理URL1, 料理URL2）
    return [
      interior || unknowns.shift() || '',
      foods[0] || unknowns.shift() || '',
      foods[1] || unknowns.shift() || '',
    ].filter(Boolean);
  } catch (e) {
    return [];
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

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
