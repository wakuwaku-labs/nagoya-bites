// UI・UX 改修計画の現状確認用。本番サイトを開いて画面を撮る（GA4 などの計測は遮断）。
// 使い方: node capture.js <出力ディレクトリ> [シナリオ名...]
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
const ONLY = process.argv.slice(3);
const BASE = process.env.BASE || 'https://nagoya-bites.com';
const BLOCKED = ['*googletagmanager.com*', '*google-analytics.com*', '*analytics.google.com*', '*doubleclick.net*'];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

async function newPage(browser, { w = 390, h = 844, mobile = true } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  if (mobile) await page.setUserAgent(IPHONE_UA);
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  await client.send('Network.setBlockedURLs', { urls: BLOCKED });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('pwa-banner-dismissed', String(Date.now())); } catch (e) {}
    // インストール案内（全面の暗幕）は撮影の邪魔なので止める（初回表示に出ることは別途記録済み）
    window.addEventListener('beforeinstallprompt', e => { e.stopImmediatePropagation(); e.preventDefault(); }, true);
  });
  return page;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
}

// ウィンドウを1画面ずつ送って撮る
async function windowSlices(page, name, n, startY = 0) {
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewport().height;
  for (let i = 0; i < n; i++) {
    const y = startY + i * vh;
    if (y >= H) break;
    await page.evaluate(y => window.scrollTo(0, y), y);
    await sleep(500);
    await shot(page, `${name}-${String(i).padStart(2, '0')}`);
  }
  return H;
}

// 要素（モーダル等）の中を1画面ずつ送って撮る
async function elementSlices(page, selector, name, n) {
  const info = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return { sh: el.scrollHeight, ch: el.clientHeight };
  }, selector);
  if (!info) return null;
  for (let i = 0; i < n; i++) {
    const y = i * Math.max(info.ch - 40, 200);
    if (i > 0 && y >= info.sh) break;
    await page.evaluate((sel, y) => { document.querySelector(sel).scrollTop = y; }, selector, y);
    await sleep(500);
    await shot(page, `${name}-${String(i).padStart(2, '0')}`);
  }
  return info;
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.error('goto', url, e.message));
  await sleep(3000);
}

// 画面の要素を数える（区画の並び・高さ）
async function sectionMap(page) {
  return page.evaluate(() => {
    const out = [];
    const main = document.querySelector('#main-content') || document.body;
    for (const el of main.children) {
      const r = el.getBoundingClientRect();
      if (r.height < 4) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const h = el.querySelector('h1,h2,h3');
      out.push({ tag: el.tagName.toLowerCase(), id: el.id || '', cls: (el.className && String(el.className).slice(0, 60)) || '', top: Math.round(r.top + scrollY), h: Math.round(r.height), heading: h ? h.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) : '' });
    }
    return out;
  });
}

const scenarios = {
  async topMobile(browser) {
    const page = await newPage(browser);
    await goto(page, BASE + '/');
    const map = await sectionMap(page);
    const H = await windowSlices(page, 'top-m', 14);
    fs.writeFileSync(path.join(OUT, 'top-m-sections.json'), JSON.stringify({ H, map }, null, 1));
    console.log('topMobile H', H, 'sections', map.length);
    await page.close();
  },
  async topDesktop(browser) {
    const page = await newPage(browser, { w: 1280, h: 800, mobile: false });
    await goto(page, BASE + '/');
    const H = await windowSlices(page, 'top-d', 5);
    console.log('topDesktop H', H);
    await page.close();
  },
  async searchAndModal(browser) {
    const page = await newPage(browser);
    await goto(page, BASE + '/');
    // 検索: 「焼肉」を入れて送信
    await page.focus('#si').catch(() => {});
    await page.type('#si', '焼肉', { delay: 60 }).catch(e => console.error('type', e.message));
    await sleep(800);
    await shot(page, 'search-typing');
    await page.keyboard.press('Enter');
    await sleep(2000);
    const resTop = await page.evaluate(() => { const el = document.querySelector('#results-block'); return el ? Math.round(el.getBoundingClientRect().top + scrollY) : -1; });
    const H = await windowSlices(page, 'search-res', 4, Math.max(resTop - 60, 0));
    console.log('search resultsTop', resTop, 'H', H, 'url', page.url());
    // 最初のカードを開く
    const clicked = await page.evaluate(() => {
      const card = document.querySelector('#grid .card') || document.querySelector('#grid > *');
      if (!card) return 'no-card';
      const nameEl = card.querySelector('h3, .card-name, .cn, .name') || card;
      nameEl.click();
      return (card.className || card.tagName) + ' / clicked ' + (nameEl.className || nameEl.tagName);
    });
    await sleep(2500);
    console.log('clicked', clicked, 'url after', page.url());
    const ovScroll = await page.evaluate(() => {
      const cands = ['#ov', '#ov .modal'];
      for (const s of cands) { const el = document.querySelector(s); if (el && el.scrollHeight > el.clientHeight + 10) return s; }
      return '#ov';
    });
    const info = await elementSlices(page, ovScroll, 'modal', 8);
    console.log('modal scroller', ovScroll, JSON.stringify(info));
    // 戻るボタンで閉じるか
    await page.goBack({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
    await sleep(1200);
    const afterBack = await page.evaluate(() => ({ url: location.href, ovOpen: !!document.querySelector('#ov.open, #ov.show, #ov[style*="flex"], #ov[style*="block"]') }));
    console.log('afterBack', JSON.stringify(afterBack));
    await page.close();
  },
  async filterPanel(browser) {
    const page = await newPage(browser);
    await goto(page, BASE + '/');
    const y = await page.evaluate(() => { const el = document.querySelector('#filter-toggle-btn'); if (!el) return -1; el.scrollIntoView({ block: 'center' }); return Math.round(el.getBoundingClientRect().top + scrollY); });
    await sleep(600);
    await shot(page, 'filter-before');
    await page.click('#filter-toggle-btn').catch(e => console.error('filter click', e.message));
    await sleep(1200);
    await shot(page, 'filter-open-0');
    await page.evaluate(() => window.scrollBy(0, 700));
    await sleep(600);
    await shot(page, 'filter-open-1');
    console.log('filter btn y', y);
    await page.close();
  },
  async pages(browser) {
    const list = [
      ['store', '/stores/J004660861.html', 5],
      ['feature', '/features/nagoya-solo-dining.html', 6],
      ['journal', '/journal/2026-10-11-hoshigaoka-afros-bbq-enkai.html', 5],
      ['hub', '/stores/area/sakae/izakaya.html', 4],
      ['features-index', '/features/', 3],
      ['journal-index', '/journal/', 3],
      ['stores-index', '/stores/', 2],
      ['area-index', '/stores/area/', 2],
    ];
    for (const [name, url, n] of list) {
      if (process.env.ONLYPAGE && !process.env.ONLYPAGE.split(',').includes(name)) continue;
      const page = await newPage(browser);
      try {
        await goto(page, BASE + url);
        const H = await windowSlices(page, 'p-' + name, n);
        console.log(name, url, 'H', H);
      } catch (e) { console.error('page failed', name, e.message); }
      await page.close().catch(() => {});
    }
    const d = await newPage(browser, { w: 1280, h: 800, mobile: false });
    await goto(d, BASE + '/stores/J004660861.html');
    await windowSlices(d, 'p-store-d', 2);
    await d.close();
  },
};

(async () => {
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 180000, args: ['--lang=ja-JP'] });
  try {
    for (const [name, fn] of Object.entries(scenarios)) {
      if (ONLY.length && !ONLY.includes(name)) continue;
      try { await fn(browser); } catch (e) { console.error('scenario failed', name, e.message); }
    }
  } finally {
    await browser.close();
  }
})();
