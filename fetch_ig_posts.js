'use strict';

const { google } = require('googleapis');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ';
const COOKIE_FILE    = path.join(__dirname, '.ig_cookies.json');
const PROGRESS_FILE  = path.join(__dirname, '.ig_posts_progress.json');
const BATCH_SIZE     = 20;
const DELAY_MS       = 4000;

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

  // A列・K列・S列を取得
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A:S',
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
    const storeName = (row[0] || '').trim();
    const igProfile = (row[10] || '').trim();  // K列: Instagramプロフィール
    const currentPost = (row[18] || '').trim(); // S列: Instagram投稿URL

    if (!storeName) continue;

    // Instagram URLがない、またはプロフィールURLでない場合はスキップ
    if (!igProfile || !igProfile.match(/instagram\.com\/[a-zA-Z0-9_.]+\/?$/) || igProfile.includes('search')) {
      continue;
    }

    // リールがすでにある場合はスキップ。/p/ のみの場合は再試行してリールを探す
    if (currentPost && currentPost.includes('/reel/')) {
      continue;
    }

    if (processed >= BATCH_SIZE) {
      saveProgress({ lastRow: i });
      await browser.close();
      console.log(`\n${BATCH_SIZE}件処理しました。`);
      console.log(`次回開始: ${i + 1}行目`);
      return;
    }

    process.stdout.write(`[${i + 1}] ${storeName.slice(0, 20)} ... `);

    const postUrl = await getFirstPost(page, igProfile);
    if (postUrl) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `S${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[postUrl]] },
      });
      console.log(postUrl);
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

async function getFirstPost(page, profileUrl) {
  try {
    // まずリールタブに直接アクセス
    const reelsUrl = profileUrl.replace(/\/?$/, '/reels/');
    await page.goto(reelsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    // ログイン確認
    const isLoggedIn = await page.evaluate(() => !document.querySelector('input[name="username"]'));
    if (!isLoggedIn) return null;

    // リールタブからリールURLを取得
    let postUrl = await page.evaluate(() => {
      const reels = [...document.querySelectorAll('a[href*="/reel/"]')];
      if (reels.length > 0) {
        return 'https://www.instagram.com' + reels[0].getAttribute('href').replace(/\?.*$/, '');
      }
      return null;
    });

    // リールが見つからなければプロフィールトップから通常投稿を取得
    if (!postUrl) {
      await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(1500);
      postUrl = await page.evaluate(() => {
        const posts = [...document.querySelectorAll('a[href*="/p/"]')];
        return posts.length > 0
          ? 'https://www.instagram.com' + posts[0].getAttribute('href').replace(/\?.*$/, '')
          : null;
      });
    }

    return postUrl;
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

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
