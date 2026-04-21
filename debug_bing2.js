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
    waitUntil: 'domcontentloaded', timeout: 15000,
  });
  await new Promise(r => setTimeout(r, 2000));

  const result = await page.evaluate(() => {
    // cite タグ（結果のURL表示）
    const cites = [...document.querySelectorAll('cite')].map(c => c.innerText).slice(0, 10);
    // h2 > a（タイトルリンク）のデータ属性
    const resultLinks = [...document.querySelectorAll('#b_results li.b_algo h2 a')].map(a => ({
      href: a.href,
      text: (a.innerText||'').slice(0,50),
    })).slice(0, 5);
    // instagram含むテキスト
    const igText = document.body.innerHTML.match(/instagram\.com\/[a-zA-Z0-9_.]{3,30}\//g) || [];
    return { cites, resultLinks, igText: [...new Set(igText)].slice(0, 10) };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
main().catch(console.error);
