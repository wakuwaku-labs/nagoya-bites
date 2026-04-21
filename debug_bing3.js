'use strict';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });

  const query = encodeURIComponent('site:instagram.com 伍味酉 名古屋');
  await page.goto(`https://www.bing.com/search?q=${query}&setlang=ja&cc=JP`, {
    waitUntil: 'networkidle2', timeout: 20000,
  });
  await new Promise(r => setTimeout(r, 3000));

  const result = await page.evaluate(() => {
    return {
      title: document.title,
      bodyText: document.body.innerText.slice(0, 500),
      allLinks: [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith('http')).slice(0, 20),
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
main().catch(console.error);
