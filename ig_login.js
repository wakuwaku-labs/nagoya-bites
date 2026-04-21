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

  // テスト：投稿URLを取得してみる
  console.log('\nテスト中...');
  await page.goto('https://www.instagram.com/nagoya-bites-ig-scraper/', {
    waitUntil: 'networkidle2',
    timeout: 20000,
  });

  await new Promise(r => setTimeout(r, 3000));


  const postUrl = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')];
    return links.length > 0 ? 'https://www.instagram.com' + links[0].getAttribute('href') : null;
  });

  console.log('取得した投稿URL:', postUrl);
  await browser.close();
}

main().catch(console.error);
