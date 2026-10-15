// MEO-006 の確かめ（計画書 docs/meo-plan-2026-10.md の 8.2 節）: トップの「現在地」ボタンが GA4 へ送る値を、実ブラウザで確かめる。
// index.html をローカルで配信し、headless Chrome（puppeteer）で、位置の許可・拒否・使えない端末の 3 つの場面でボタンを押す。
// サイトが gtag に渡した値（window.dataLayer）を読み、次を確かめる:
//   - 押下ごとに geo_search がちょうど 1 回、値は { result } だけ（granted・denied・unsupported）
//   - ボタンを押した後にサイトが送った値のどこにも、緯度・経度・エリア名が無い
// 外部への通信はすべて中断する（gtag.js も読まない＝GA4 へは何も届かない）。GA4 の自動の page_view が URL の #q=<エリア> を
// 送るかは gtag.js の設定次第で、この確かめの範囲の外（結果に「URL の書き換え」として事実だけを残す）。
// 使い方: node docs/qa/meo-2026-10/e2e_geo_search.js [--json <出力先>]
// 終了コード: 失敗した確認があれば 1、なければ 0（puppeteer が無いときは 2）。
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
const LAT = 35.1709;
const LNG = 136.8815;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scenario(browser, base, mode) {
  const ctx = await browser.createBrowserContext();
  if (mode === 'granted') await ctx.overridePermissions(base, ['geolocation']);
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((m) => {
    try { localStorage.setItem('pwa-banner-dismissed', String(Date.now())); sessionStorage.setItem('nb_splash', '1'); } catch (e) { /* 保存できない環境 */ }
    if (m === 'unsupported') Object.defineProperty(Navigator.prototype, 'geolocation', { get() { return undefined; }, configurable: true });
  }, mode);
  if (mode === 'granted') await page.setGeolocation({ latitude: LAT, longitude: LNG, accuracy: 10 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String((e && e.message) || e).slice(0, 200)));
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.startsWith(base) && /\/(sw\.js|manifest\.(json|webmanifest))(\?|$)/.test(u)) return req.respond({ status: 404, body: '' });
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
    return req.abort();
  });
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#geo-btn', { timeout: 30000 });
  await sleep(1500);
  const before = await page.evaluate(() => (window.dataLayer || []).length);
  await page.evaluate(() => document.getElementById('geo-btn').click());
  await sleep(2500);
  const out = await page.evaluate((n) => {
    const toPlain = (a) => { try { return JSON.parse(JSON.stringify(Array.prototype.slice.call(a))); } catch (e) { return ['(読めない)']; } };
    return { sent: (window.dataLayer || []).slice(n).map(toPlain), hash: decodeURIComponent(location.hash || '') };
  }, before);
  await ctx.close();
  return { mode, ...out, errors };
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 60000 });
  const expect = { granted: 'granted', denied: 'denied', unsupported: 'unsupported' };
  const results = [];
  let failed = 0;
  try {
    for (const mode of Object.keys(expect)) {
      const r = await scenario(browser, base, mode);
      const geo = r.sent.filter((a) => a[0] === 'event' && a[1] === 'geo_search');
      // 位置から選ばれたエリア名（URL の #q= に書かれたもの）も、送った値に無いことを見る
      const area = (r.hash.match(/[#&]q=([^&]+)/) || [])[1] || '';
      const text = JSON.stringify(r.sent);
      const leaks = (text.match(/35\.\d|136\.\d|"lat|"lng|latitude|longitude/g) || []).concat(area && text.includes(area) ? [area] : []);
      const checks = [
        ['geo_search がちょうど 1 回', geo.length === 1],
        [`値は { result: "${expect[mode]}" } だけ`, geo.length === 1 && JSON.stringify(geo[0][2]) === JSON.stringify({ result: expect[mode] })],
        ['押した後に送った値に、緯度・経度・エリア名が無い', leaks.length === 0],
        ['ページのエラーが無い', r.errors.length === 0],
      ];
      for (const [name, ok] of checks) { if (!ok) failed++; console.log(`${ok ? '✅' : '❌'} [${mode}] ${name}`); }
      console.log(`   送った値: ${JSON.stringify(r.sent)}  URL の書き換え: ${r.hash || '（なし）'}${r.errors.length ? '  エラー: ' + r.errors.join(' / ') : ''}`);
      results.push({ ...r, checks: checks.map(([name, ok]) => ({ name, ok })) });
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ date: new Date().toISOString(), failed, results }, null, 2));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
