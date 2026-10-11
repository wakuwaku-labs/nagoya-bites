// 表示速度の実測（本番・スマホ相当: 412x823・CPU 4倍遅く・150ms/1.6Mbps）。GA4 などの計測は遮断。
// 使い方: node perf.js [回数]
const puppeteer = require('puppeteer');
const BASE = process.env.BASE || 'https://nagoya-bites.com';
const RUNS = Number(process.argv[2] || 1);
const BLOCKED = ['*googletagmanager.com*', '*google-analytics.com*', '*analytics.google.com*', '*doubleclick.net*'];
const URLS_ALL = [
  ['top', '/'],
  ['store', '/stores/J004660861.html'],
  ['feature', '/features/nagoya-solo-dining.html'],
  ['journal', '/journal/2026-10-11-hoshigaoka-afros-bbq-enkai.html'],
  ['hub', '/stores/area/sakae/izakaya.html'],
  ['features-index', '/features/'],
  ['journal-index', '/journal/'],
];
const URLS = process.env.ONLY ? URLS_ALL.filter(([n]) => process.env.ONLY.split(',').includes(n)) : URLS_ALL;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function measure(browser, url) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  await client.send('Network.setBlockedURLs', { urls: BLOCKED });
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0, reqs = 0;
  const byType = {}, idType = {}, kbType = {}, hosts = {}, big = [];
  client.on('Network.responseReceived', e => { const t = e.type || 'Other'; byType[t] = (byType[t] || 0) + 1; idType[e.requestId] = [t, e.response.url]; try { const h = new URL(e.response.url).host; hosts[h] = (hosts[h] || 0) + 1; } catch (x) {} });
  client.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; reqs++; const [t, u] = idType[e.requestId] || ['?', '']; kbType[t] = (kbType[t] || 0) + e.encodedDataLength / 1024; if (e.encodedDataLength > 150000) big.push([Math.round(e.encodedDataLength / 1024), u.slice(0, 110)]); });
  await page.evaluateOnNewDocument(() => {
    window.__p = { lcp: 0, lcpEl: '', cls: 0, lt: [] };
    try { localStorage.setItem('pwa-banner-dismissed', String(Date.now())); } catch (e) {}
    window.addEventListener('beforeinstallprompt', e => { e.stopImmediatePropagation(); e.preventDefault(); }, true);
    new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__p.lcp = e.startTime; window.__p.lcpEl = (e.element && (e.element.tagName + '.' + String(e.element.className).slice(0, 40))) || e.url || ''; } }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__p.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__p.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 120000 }).catch(e => console.error('goto', url, e.message));
  const loadWall = Date.now() - t0;
  await sleep(5000);
  const r = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0;
    const tbt = window.__p.lt.filter(([s]) => s > fcp).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    return {
      ttfb: Math.round(nav.responseStart || 0), fcp: Math.round(fcp), lcp: Math.round(window.__p.lcp), lcpEl: window.__p.lcpEl,
      dcl: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0),
      cls: Number(window.__p.cls.toFixed(3)), tbt: Math.round(tbt), longTasks: window.__p.lt.length,
      htmlBytes: nav.encodedBodySize || 0, dom: document.getElementsByTagName('*').length,
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    };
  });
  await ctx.close();
  for (const k in kbType) kbType[k] = Math.round(kbType[k]);
  return { ...r, totalKB: Math.round(bytes / 1024), reqs, byType, kbType, hosts, big, loadWall };
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: ['--lang=ja-JP'] });
  try {
    for (const [name, url] of URLS) {
      for (let i = 0; i < RUNS; i++) {
        try { const r = await measure(browser, url); console.log(JSON.stringify({ name, run: i, ...r })); }
        catch (e) { console.error('fail', name, e.message); }
      }
    }
  } finally { await browser.close(); }
})();
