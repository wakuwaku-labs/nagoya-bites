// P-475 の確かめ（判断の記録 0048）: トップが URL の # の後ろに書いた絞り込み（「現在地」で選んだエリア名・店の ID）が、
// gtag.js が Google へ送る通信そのものに入るかを、実ブラウザで確かめる。
// index.html をローカルで配信し、本物の gtag.js を読み込んで「現在地」を押し、店の詳細を 1 つ開き、画面を隠す。
// gtag.js の送信の口（fetch・sendBeacon・XHR・画像）をページの中で横取りして中身だけを記録し、GA4 へは何も送らない。
// gtag.js の読み込み以外の外部への通信もすべて止める（横取りから漏れた送信もここで止まる）。
// 確かめること:
//   - URL に # の後ろがある状態で送った回がある（無ければ判定できない）
//   - どの送信のページの URL（dl）にも # が無い
//   - どの送信にも「q=<エリア名>」と「#」の後ろの文字列が無い
//   - geo_search の値は result だけ
// 店の詳細（modal_open）は店名・店のエリアを送る。これは店の情報で、利用者の位置ではないので数えない。
// gtag.js は送信が成功したと読めないと別の口・別の宛先で同じ 1 件を送り直すので、_p と _s が同じものは 1 件に数える。
// 使い方: node docs/qa/meo-2026-10/e2e_gtag_fragment.js [--json <出力先>]
// 終了コード: 失敗があれば 1、なければ 0。判定できない（puppeteer が無い・gtag.js を読めない・送信が無い）ときは 2。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) {
  console.error('puppeteer が見つかりません（puppeteer のある node_modules から実行してください）');
  process.exit(2);
}

const argv = process.argv.slice(2);
const JSON_OUT = (() => { const i = argv.indexOf('--json'); return i >= 0 ? argv[i + 1] : ''; })();
const ROOT = path.resolve(__dirname, '..', '..', '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const GA_HIT = /google-analytics\.com|analytics\.google\.com|\/g\/collect|doubleclick\.net/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end('bad'); }
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    let ok = false;
    try { ok = f.startsWith(ROOT) && fs.statSync(f).isFile(); } catch (e) { ok = false; }
    if (!ok) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// 1 回の送信（URL と本文）を、イベントごとの値の一覧にする。本文は 1 行に 1 イベント（URL の値はすべてのイベントに共通）
function parseHit(url, body) {
  const q = url.indexOf('?');
  const shared = new URLSearchParams(q >= 0 ? url.slice(q + 1) : '');
  const lines = String(body || '').split('\n').filter((l) => l.includes('='));
  const events = (lines.length ? lines : ['']).map((line) => {
    const ev = new URLSearchParams(shared);
    for (const [k, v] of new URLSearchParams(line)) ev.set(k, v);
    return Object.fromEntries(ev);
  });
  return events;
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 60000 });
  const raw = [];
  let phase = 'load';
  let gtagLoaded = false;
  let hash = '';
  try {
    const ctx = await browser.createBrowserContext();
    await ctx.overridePermissions(base, ['geolocation']);
    const page = await ctx.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.evaluateOnNewDocument((gaSource) => {
      try { localStorage.setItem('pwa-banner-dismissed', String(Date.now())); sessionStorage.setItem('nb_splash', '1'); } catch (e) { /* 保存できない環境 */ }
      const isGa = (u) => new RegExp(gaSource).test(String(u));
      const rec = (how, u, b) => console.log('NB_HIT ' + JSON.stringify({ how, url: String(u), body: b == null ? '' : String(b) }));
      const realFetch = window.fetch;
      window.fetch = function (input, init) {
        const u = typeof input === 'string' ? input : (input && input.url) || String(input);
        if (isGa(u)) { rec('fetch', u, init && init.body); return Promise.resolve(new Response('', { status: 204 })); }
        return realFetch.apply(this, arguments);
      };
      navigator.sendBeacon = function (u, b) { if (isGa(u)) { rec('beacon', u, b); return true; } return false; };
      const realOpen = XMLHttpRequest.prototype.open;
      const realSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, u) { this.__nbUrl = u; return realOpen.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function (b) { if (isGa(this.__nbUrl)) { rec('xhr', this.__nbUrl, b); return undefined; } return realSend.apply(this, arguments); };
      const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) { if (isGa(v)) { rec('img', v, ''); return; } d.set.call(this, v); } });
    }, GA_HIT.source);
    await page.setGeolocation({ latitude: 35.1709, longitude: 136.8815, accuracy: 10 });
    page.on('console', (m) => {
      const t = m.text();
      if (!t.startsWith('NB_HIT ')) return;
      try { raw.push({ phase, ...JSON.parse(t.slice(7)) }); } catch (e) { /* 読めない行は数えない */ }
    });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (u.startsWith(base) && /\/(sw\.js|manifest\.(json|webmanifest))(\?|$)/.test(u)) return req.respond({ status: 404, body: '' });
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
      if (/^https:\/\/www\.googletagmanager\.com\/gtag\/js/.test(u)) return req.continue();
      if (GA_HIT.test(u)) { raw.push({ phase, how: 'network', url: u, body: req.postData() || '' }); return req.respond({ status: 204, body: '' }); }
      return req.abort();
    });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#geo-btn', { timeout: 30000 });
    await sleep(6000);
    gtagLoaded = await page.evaluate(() => typeof window.google_tag_manager !== 'undefined');
    phase = 'geo';
    await page.evaluate(() => document.getElementById('geo-btn').click());
    await sleep(4000);
    phase = 'modal';
    await page.evaluate(() => { const c = document.querySelector('.card, .store-card, [data-store-id]'); if (c) c.click(); });
    await sleep(12000);
    hash = await page.evaluate(() => { try { return decodeURIComponent(location.hash || ''); } catch (e) { return location.hash || ''; } });
    phase = 'hidden';
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
      Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
    });
    await sleep(4000);
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }

  const area = (hash.match(/[#&]q=([^&]+)/) || [])[1] || '';
  const fragment = hash.replace(/^#/, '');
  const seen = new Set();
  const hits = [];
  for (const r of raw) {
    for (const ev of parseHit(r.url, r.body)) {
      const key = `${ev._p || ''}/${ev._s || ''}/${ev.en || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ phase: r.phase, how: r.how, ev });
    }
  }
  const afterHash = hits.filter((h) => h.phase !== 'load');
  const geo = hits.filter((h) => h.ev.en === 'geo_search');
  const withHashInDl = hits.filter((h) => String(h.ev.dl || '').includes('#'));
  const withFragment = hits.filter((h) => {
    const text = JSON.stringify(h.ev);
    return (area && text.includes(`q=${area}`)) || (fragment && text.includes(fragment));
  });
  const geoParams = geo.map((h) => Object.keys(h.ev).filter((k) => /^epn?\./.test(k)).sort().join(','));

  if (!gtagLoaded || !afterHash.length || !area) {
    console.log(`判定できません: gtag.js の読み込み=${gtagLoaded} / # を書いた後の送信=${afterHash.length} 件 / URL の #=${hash || '（なし）'}`);
    process.exit(2);
  }
  const checks = [
    ['URL に # の後ろがある状態で送った回がある', afterHash.length > 0],
    ['どの送信のページの URL（dl）にも # が無い', withHashInDl.length === 0],
    ['どの送信にも q=<エリア名> と # の後ろの文字列が無い', withFragment.length === 0],
    ['geo_search の値は result だけ', geo.length > 0 && geoParams.every((p) => p === 'ep.result')],
  ];
  let failed = 0;
  for (const [name, ok] of checks) { if (!ok) failed++; console.log(`${ok ? '✅' : '❌'} ${name}`); }
  console.log(`   URL の #: ${hash}  送信（同じ 1 件の送り直しを除く）: ${hits.length} 件`);
  for (const h of hits) console.log(`   [${h.phase}] ${h.ev.en || '-'} dl=${h.ev.dl || '-'}`);
  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({
      date: new Date().toISOString(), failed, hash, area,
      checks: checks.map(([name, ok]) => ({ name, ok })),
      hits: hits.map((h) => ({ phase: h.phase, how: h.how, en: h.ev.en || '', dl: h.ev.dl || '', params: Object.keys(h.ev).filter((k) => /^epn?\./.test(k)) })),
    }, null, 2));
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
