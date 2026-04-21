'use strict';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });

  // 伍味酉 本店 でテスト
  const query = encodeURIComponent('site:instagram.com 伍味酉 名古屋');
  await page.goto(`https://www.bing.com/search?q=${query}&setlang=ja&cc=JP`, {
    waitUntil: 'domcontentloaded', timeout: 15000,
  });
  await new Promise(r => setTimeout(r, 2000));

  const result = await page.evaluate(() => {
    const title = document.title;
    const igLinks = [...document.querySelectorAll('a[href]')]
      .map(a => a.href)
      .filter(h => h.includes('instagram.com'))
      .slice(0, 5);
    return { title, igLinks };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
main().catch(console.error);
