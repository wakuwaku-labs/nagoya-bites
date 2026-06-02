'use strict';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const COOKIE_FILE = path.join(__dirname, '.ig_cookies.json');

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: null,
  });
  const page = await browser.newPage();

  console.log('Instagramのログインページを開きます...');
  await page.goto('https://www.instagram.com/accounts/login/', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  console.log('\nブラウザウィンドウでInstagramにログインしてください。');
  console.log('ログイン完了後、ホーム画面が表示されたら Enter を押してください...');

  await new Promise(resolve => process.stdin.once('data', resolve));

  // クッキーを保存
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
  console.log(`クッキーを保存しました: ${COOKIE_FILE}`);

  console.log('\nログイン・cookie 保存完了。');
  console.log('次のステップ: node scripts/fetch_ig_posts_resolved.js で投稿URLを一括取得してください。');
  await browser.close();
}

main().catch(console.error);
