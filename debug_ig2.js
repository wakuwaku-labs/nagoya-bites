'use strict';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const COOKIE_FILE = path.join(__dirname, '.ig_cookies.json');

async function main() {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = await browser.newPage();

  const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
  await page.setCookie(...cookies);

  // 実際にある店舗のInstagramプロフィール
  await page.goto('https://www.instagram.com/kirakuya_nagoya/', {
    waitUntil: 'networkidle2',
    timeout: 20000,
  });

  await new Promise(r => setTimeout(r, 4000));

  // ログイン状態確認
  const isLoggedIn = await page.evaluate(() => {
    return !document.querySelector('input[name="username"]');
  });
  console.log('ログイン状態:', isLoggedIn ? 'ログイン済み' : '未ログイン');

  // 投稿リンク取得
  const posts = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')];
    return links.slice(0, 3).map(l => 'https://www.instagram.com' + l.getAttribute('href'));
  });
  console.log('投稿URL:', posts);

  console.log('\nブラウザを確認してください。30秒後に閉じます...');
  await new Promise(r => setTimeout(r, 30000));
  await browser.close();
}

main().catch(console.error);
