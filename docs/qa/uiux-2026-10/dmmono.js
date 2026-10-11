// 日本語の文字を DM Mono（欧文用の等幅書体）で出している所を数える（UI・UX 改修計画 U-86。2026-10-12）。
// デザインシステムは「等幅は数字と3語以内の欧文のみ。日本語には使わない」とする。
// 使い方: node dmmono.js [リポジトリの直下=今のディレクトリ]
//   手元のファイルを静的サーバで配り（外部への通信は止める）、トップを 390px と 1280px の幅で、初期・フィルターを開いた状態・最初のカードのモーダルを開いた状態の3つで見る。
//   `getComputedStyle` の fontFamily が DM Mono で、自分の文字に日本語を持つ要素を、セレクター（id・class・タグ）ごとに数え、どの画面で見えていたかを出す。
//   Web フォントは止めているので、書体の指定だけを見る（実際に使われた書体ではない）。0軒の検索など、この3つの状態に出ない画面は数えない。
// 2026-10-12 に origin/main（8041f61369）で数えた結果: 15のセレクター（`docs/uiux-overhaul-plan-2026-10.md` の U-86）。
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const ROOT = require('path').resolve(process.argv[2] || process.cwd());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('nf'); } else { res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const collect = () => {
  const JA = /[぀-ヿ一-鿿]/;
  const out = {};
  const all = document.querySelectorAll('body *');
  for (const e of all) {
    const cs = getComputedStyle(e);
    if (!/DM Mono/i.test(cs.fontFamily)) continue;
    let own = '';
    for (const n of e.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.trim();
    if (!own || !JA.test(own)) continue;
    const r = e.getBoundingClientRect();
    const key = (e.id ? '#' + e.id : '') + '.' + (e.className && e.className.baseVal === undefined ? String(e.className).split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '') + ' <' + e.tagName.toLowerCase() + '>';
    if (!out[key]) out[key] = { n: 0, visible: 0, sample: own.slice(0, 16) };
    out[key].n++;
    if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none') out[key].visible++;
  }
  return out;
};
server.listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'shell' });
  const total = {};
  for (const vp of [{ name: 'm390', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { name: 'd1280', width: 1280, height: 900 }]) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('pwa-banner-dismissed', String(Date.now())); sessionStorage.setItem('nb_splash', '1'); } catch (e) {} });
    await page.setRequestInterception(true);
    page.on('request', req => { const u = req.url(); if (u.startsWith(base) || u.startsWith('data:')) return req.continue(); return req.abort(); });
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await sleep(3500);
    const states = {};
    states.initial = await page.evaluate(collect);
    await page.evaluate(() => { const b = document.getElementById('filter-toggle-btn'); if (b) b.click(); });
    await sleep(600);
    states.filter = await page.evaluate(collect);
    await page.evaluate(() => { const c = document.querySelector('.card, .store-card'); if (c) c.click(); });
    await sleep(1200);
    states.modal = await page.evaluate(collect);
    for (const [st, o] of Object.entries(states)) for (const [k, v] of Object.entries(o)) {
      const t = total[k] || (total[k] = { visibleIn: new Set(), sample: v.sample });
      if (v.visible > 0) t.visibleIn.add(vp.name + ':' + st);
    }
    await page.close();
  }
  const rows = Object.entries(total).map(([k, v]) => ({ k, vis: [...v.visibleIn], sample: v.sample }));
  const shown = rows.filter(r => r.vis.length);
  console.log('日本語の文字を DM Mono で出しているセレクタ（どれかの画面で見えているもの）:', shown.length, '／ 見えなかったもの:', rows.length - shown.length);
  for (const r of shown.sort((a, b) => a.k.localeCompare(b.k))) console.log(' ', r.k, '|', r.sample, '|', r.vis.join(','));
  await browser.close(); server.close();
});
