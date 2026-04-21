'use strict';
const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: false }); // ブラウザを表示
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });

  // テスト店舗のInstagramプロフィール
  const profileUrl = 'https://www.instagram.com/explore/search/keyword/?q=%E5%B1%85%E9%85%92%E5%B1%8B%20%E3%83%92%E3%83%8E%E3%82%AB%E3%83%9F%20%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85%E5%89%8D%E5%BA%97%20%E5%90%8D%E5%8F%A4%E5%B1%8B';

  console.log('Instagramを開きます...');
  await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 20000 });

  // ログイン画面が出るか確認
  const loginForm = await page.$('input[name="username"]');
  if (loginForm) {
    console.log('→ ログイン画面が表示されました');
  } else {
    console.log('→ ログインなしでアクセスできました');
  }

  // 最初の投稿URLを取得
  await page.waitForTimeout(3000);
  const postUrl = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')];
    return links.length > 0 ? 'https://www.instagram.com' + links[0].getAttribute('href') : null;
  });

  console.log('最初の投稿URL:', postUrl);
  await browser.close();
}

main().catch(console.error);
