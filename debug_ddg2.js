'use strict';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });

  // 伍味酉 本店 でテスト（DuckDuckGo）
  const query = encodeURIComponent('site:instagram.com 伍味酉 名古屋');
  await page.goto(`https://html.duckduckgo.com/html/?q=${query}`, {
    waitUntil: 'domcontentloaded', timeout: 15000,
  });
  await new Promise(r => setTimeout(r, 2000));

  const result = await page.evaluate(() => {
    const title = document.title;
    const igLinks = [...document.querySelectorAll('a[href]')]
      .map(a => ({ href: a.href, text: (a.innerText||'').slice(0,50) }))
      .filter(l => l.href.includes('instagram'))
      .slice(0, 5);
    const bodySnippet = document.body.innerText.slice(0, 300);
    return { title, igLinks, bodySnippet };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
main().catch(console.error);
