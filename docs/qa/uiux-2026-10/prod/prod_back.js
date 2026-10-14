'use strict';
// P-428 本番確認: 絞り込みシートが「戻る」で閉じる（ページから離れない）
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'https://nagoya-bites.com/';
(async () => {
  const browser = await puppeteer.launch({ headless: 'shell' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const out = [];
  const isOpen = () => page.evaluate(() => document.getElementById('filter-sheet-wrap').classList.contains('open') || getComputedStyle(document.getElementById('filter-sheet')).visibility === 'visible' && document.getElementById('filter-sheet-wrap').className);
  await page.goto('about:blank');
  await page.goto(URL, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1500));
  const startLen = await page.evaluate(() => history.length);
  const cls = () => page.evaluate(() => document.getElementById('filter-sheet-wrap').className);
  await page.evaluate(() => { const b = document.getElementById('tb-filter-btn'); b.scrollIntoView(); b.click(); });
  await new Promise(r => setTimeout(r, 600));
  out.push(['open class', await cls()]);
  out.push(['history grew', await page.evaluate(() => history.length) - startLen]);
  await page.goBack();
  await new Promise(r => setTimeout(r, 600));
  out.push(['after back class', await cls()]);
  out.push(['still on page', page.url()]);
  // 開閉を繰り返しても履歴が積み上がらない（×で閉じる）
  await page.evaluate(() => { const b = document.getElementById('tb-filter-btn'); b.scrollIntoView(); b.click(); }); await new Promise(r => setTimeout(r, 500));
  await page.keyboard.press('Escape'); await new Promise(r => setTimeout(r, 600));
  out.push(['after Esc class', await cls()]);
  out.push(['history delta after open+Esc', await page.evaluate(() => history.length) - startLen]);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
