// 動き（アニメーション）の計画 段階 0 の測る道具（docs/animation-plan-2026-10.md の 7 章・8.2 節）。
// 使い方: node docs/qa/uiux-2026-10/e2e_motion.js [--runs 5] [--out FILE.json] [--report] [--only taps,reduced,skeleton]
//   --runs N     各操作・各回数（既定 5）
//   --out FILE   結果を JSON で保存（電源 pmset -g batt の ac/battery と、低電力モードも残す）
//   --report     不合格でも終了コード 0（記録だけ取りたいとき）。付けないと、不合格があれば 1
//   --only 語    taps（押してから変わるまで）/ reduced（動きを減らす設定）/ skeleton（スケルトンの時間）を絞る
//   --root DIR   配信するフォルダ（既定: この木のルート）
// 本番には繋がない。この木を手元（127.0.0.1）で配信し、外部への通信（GA4・画像・フォントなど）はすべて中断する。puppeteer と Chrome が要る。
//
// 1. taps: 押してから画面が変わるまで。Event Timing（PerformanceObserver type 'event'・durationThreshold 16）の interaction（interactionId が同じイベントの最大 duration）。
//    操作 ① 店のカードの保存（♡ .fav-btn）② 絞り込みシートを開く ③ シートの中のチップを 1 つ選ぶ ④ 店のカードを押してクイックビューを開く。
//    390x823（タッチ）と 1280x800 の両方で CPU 4 倍遅く。各操作 N 回の中央値と最大。目安 200ms（INP の「良い」）。中央値が超えれば不合格、最大だけが超えれば印（over）だけ。
//    Event Timing は 16ms 未満の操作は報告しない（durationThreshold の下限）。その回は「押す直前（pointerdown）から次の rAF 2 回目まで」の時間（method: raf）を残す。
//    各回に method（event / raf）を残し、集計は回ごとに event があればそれ、なければ raf を使う。操作ごとに状態を戻す（シート・クイックビューを閉じる・保存を外す・localStorage を消す）。
// 2. reduced: prefers-reduced-motion: reduce にして、読み込み後・シートを開いた後・クイックビューを開いた後に、実行中で 1ms を超える長さの
//    document.getAnimations() を数える（0 が合格）。さらに JS の smooth スクロール（#scroll-top・scrollToMagazine・scrollToResults）が、押してから rAF 1 回後に
//    もう目的の位置か（即時か）を見る。今のコードは behavior:'smooth' を明示するので、CSS の scroll-behavior:auto を上書きして不合格になるのが正しい（直す前の記録）。
// 3. skeleton: トップを読み込んでから .skel が DOM に出ている時間（perf.js と同じ 遅延 150ms・下り 1.6Mbps・CPU 4 倍）。DOM に出た時間と、実際に見えた時間（display:none でない）を分けて残す。トップの既定の状態と、条件つき（#q=…）の両方。合否には使わない（記録）。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');

const argv = process.argv.slice(2);
const getOpt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const RUNS = Math.max(1, Number(getOpt('--runs', 5)) || 5);
const OUT = getOpt('--out', '');
const REPORT = argv.includes('--report');
const ONLY = getOpt('--only', 'taps,reduced,skeleton').split(',');
const ROOT = path.resolve(getOpt('--root', path.join(__dirname, '..', '..', '..')));
const TARGET_MS = 200;
// 店のカードの一覧（#grid）は、条件が入った状態（body.search-active）でだけ見える。トップの既定の状態では display:none なので、検索語つきで開く
const LIST_HASH = '#q=%E5%B1%85%E9%85%92%E5%B1%8B';

const VPS = [
  { name: 'mobile-390', width: 390, height: 823, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'desktop-1280', width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = x => (x === null || x === undefined ? null : Math.round(x * 10) / 10);

function powerSource() {
  try {
    const out = execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8', timeout: 3000 });
    if (/AC Power/.test(out)) return 'ac';
    if (/Battery Power/.test(out)) return 'battery';
  } catch (e) { /* 取れなければ null */ }
  return null;
}
function lowPowerMode() {
  try {
    const m = /lowpowermode\s+(\d)/.exec(execFileSync('pmset', ['-g'], { encoding: 'utf8', timeout: 3000 }));
    if (m) return Number(m[1]);
  } catch (e) { /* 取れなければ null */ }
  return null;
}

function startServer() {
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end('bad'); }
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    let ok = false;
    try { ok = f.startsWith(ROOT) && fs.statSync(f).isFile(); } catch (e) { ok = false; }
    if (!ok) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function launchBrowser() {
  let lastErr;
  for (const m of ['shell', true]) {
    try { return await puppeteer.launch({ headless: m, args: ['--no-sandbox', '--disable-gpu'], protocolTimeout: 60000 }); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// 手元の木だけ通す。それ以外（GA4・画像・フォント・外部）は中断。sw.js / manifest は 404 にして、サービスワーカーの影響を除く
async function openPage(browser, base, vp, o) {
  o = o || {};
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  await page.setRequestInterception(true);
  const log = { blocked: 0, pageErrors: [] };
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith(base) && /\/(sw\.js|manifest\.(json|webmanifest))(\?|$)/.test(u)) return req.respond({ status: 404, contentType: 'text/plain', body: 'not found' });
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') return req.continue();
    log.blocked++;
    return req.abort();
  });
  page.on('pageerror', e => log.pageErrors.push(String((e && e.message) || e).slice(0, 200)));
  page.__log = log;
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  if (o.network) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  if (o.reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (o.init) await page.evaluateOnNewDocument(o.init);
  return { ctx, page, cdp };
}

async function waitFn(page, fn, arg, timeout) {
  try { await page.waitForFunction(fn, { timeout: timeout || 10000, polling: 50 }, arg); return true; } catch (e) { return false; }
}
const waitCatalog = page => waitFn(page, () => window.FULL_CATALOG_LOADED === true && window.ALL_STORES && window.ALL_STORES.length > 1000, null, 60000);

// ── 1. 押してから画面が変わるまで ──
const TAP_INIT = () => {
  window.__ev = [];       // Event Timing: [name, startTime, duration, interactionId]
  window.__t0 = 0;        // 押す直前（capture の pointerdown / mousedown / touchstart）の時刻
  window.__et = true;
  try {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) { window.__ev.push([e.name, e.startTime, e.duration, e.interactionId || 0]); });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch (e) { window.__et = false; }
  ['pointerdown', 'mousedown', 'touchstart'].forEach(function (t) {
    window.addEventListener(t, function (e) { if (!window.__t0Armed) return; if (!window.__t0Set) { window.__t0 = e.timeStamp; window.__t0Set = true; } }, true);
  });
};

// 要素を画面の中央に即時スクロールして、その中心座標を返す（シートの中は動かさない）
async function centerOf(page, sel, within) {
  return page.evaluate((sel, within) => {
    const root = within ? document.querySelector(within) : document;
    const els = (root || document).querySelectorAll(sel);
    let el = null;
    for (let i = 0; i < els.length; i++) { const r = els[i].getBoundingClientRect(); const cs = getComputedStyle(els[i]); if (r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none') { el = els[i]; break; } }
    if (!el) return null;
    if (!el.closest('#filter-sheet-wrap')) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel, within || '');
}

async function tapAt(page, vp, pt) {
  // 押す直前の印を立ててから入力する。以降の rAF 2 回までを fallback として測る
  await page.evaluate(() => { window.__ev = []; window.__t0Set = false; window.__t0Armed = true; });
  if (vp.hasTouch) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
  const raf = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - (window.__t0Set ? window.__t0 : performance.now()))))));
  await sleep(450); // Event Timing は次の描画の後に届く
  const got = await page.evaluate(() => { window.__t0Armed = false; return { ev: window.__ev.slice(), et: window.__et }; });
  // interaction = 同じ interactionId の中の最大 duration。interactionId が付いたもののうち、いちばん大きい interaction を取る
  const byId = {};
  got.ev.forEach(e => { if (e[3]) byId[e[3]] = Math.max(byId[e[3]] || 0, e[2]); });
  const ids = Object.keys(byId);
  if (ids.length) return { method: 'event', ms: Math.max.apply(null, ids.map(k => byId[k])), rafMs: raf, etSupported: got.et };
  return { method: 'raf', ms: raf, rafMs: raf, etSupported: got.et };
}

async function closeSheet(page) {
  await page.evaluate(() => { if (typeof nbCloseFilterSheet === 'function' && NB_SHEET.open) nbCloseFilterSheet(); });
  await waitFn(page, () => !NB_SHEET.open && !NB_SHEET.leaving, null, 4000);
  await sleep(300);
}

const OPS = [
  {
    id: 'fav', name: '店のカードの保存（♡）',
    async find(page) { return centerOf(page, '#grid .fav-btn'); },
    async check(page) { return page.evaluate(() => !!document.querySelector('#grid .fav-btn.faved')); },
    async reset(page) { await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* なし */ } document.querySelectorAll('.fav-btn.faved').forEach(b => b.classList.remove('faved')); }); },
  },
  {
    id: 'sheet-open', name: '絞り込みシートを開く',
    async find(page) { return centerOf(page, '#tb-filter-btn, #filter-toggle-btn, .cta-filter'); },
    async check(page) { return page.evaluate(() => document.getElementById('filter-sheet-wrap').classList.contains('open')); },
    async reset(page) { await closeSheet(page); },
  },
  {
    id: 'chip', name: 'シートの中のチップを選ぶ',
    async prepare(page) {
      await page.evaluate(() => { nbOpenFilterSheet(null); });
      await waitFn(page, () => document.getElementById('filter-sheet-wrap').classList.contains('open') && document.querySelector('#filter-sheet .fs-chip'), null, 5000);
      await sleep(500);
    },
    async find(page) { return centerOf(page, '#filter-sheet .fs-chip', '#filter-sheet'); },
    async check(page) { return page.evaluate(() => !!document.querySelector('#filter-sheet .fs-chip[aria-pressed="true"]')); },
    async reset(page) { await closeSheet(page); },
  },
  {
    id: 'quick-view', name: '店のカードを押してクイックビューを開く',
    async find(page) {
      // カードの中の、保存・予約・地図・特集・リールのボタンでない所（写真の真ん中）を押す（カード全体のクリックで開く）
      return page.evaluate(() => {
        const cards = document.querySelectorAll('#grid .card');
        for (let i = 0; i < cards.length; i++) {
          const ci = cards[i].querySelector('.ci') || cards[i];
          ci.scrollIntoView({ block: 'center', behavior: 'instant' });
          const r = ci.getBoundingClientRect();
          if (r.width > 40 && r.height > 40) {
            const x = r.left + r.width / 2, y = r.top + r.height / 2;
            const hit = document.elementFromPoint(x, y);
            if (hit && cards[i].contains(hit) && !hit.closest('button, .card-cta, .card-actions, .card-featured, .reel-play')) return { x, y };
          }
        }
        return null;
      });
    },
    async check(page) { return page.evaluate(() => document.getElementById('ov').classList.contains('open')); },
    async reset(page) {
      await page.evaluate(() => { if (document.getElementById('ov').classList.contains('open')) closeM(); });
      await waitFn(page, () => !document.getElementById('ov').classList.contains('open'), null, 3000);
      await sleep(400);
    },
  },
];

async function measureTaps(browser, base, vp) {
  const { ctx, page } = await openPage(browser, base, vp, { init: TAP_INIT });
  const out = { viewport: vp.name, ops: [], notes: [] };
  try {
    await page.goto(base + '/index.html' + LIST_HASH, { waitUntil: 'load', timeout: 60000 });
    const loaded = await waitCatalog(page);
    if (!loaded) out.notes.push('全店のデータ（FULL_CATALOG_LOADED）が時間内に届かなかった。先頭 50 店で測った');
    await waitFn(page, () => document.querySelectorAll('#grid .fav-btn').length > 0, null, 20000);
    await sleep(1500);
    for (const op of OPS) {
      const rec = { id: op.id, name: op.name, runs: [], failed: 0 };
      for (let i = 0; i < RUNS; i++) {
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* なし */ } window.scrollTo({ top: 0, behavior: 'instant' }); });
        await sleep(250);
        if (op.prepare) await op.prepare(page);
        const pt = await op.find(page, vp);
        if (!pt) { rec.failed++; rec.runs.push({ error: 'target-not-found' }); continue; }
        await sleep(200);
        const r = await tapAt(page, vp, pt);
        r.worked = await op.check(page);
        if (!r.worked) rec.failed++;
        rec.runs.push(r);
        await op.reset(page);
      }
      const ok = rec.runs.filter(r => !r.error && r.worked);
      const ms = ok.map(r => r.ms);
      rec.n = ok.length;
      rec.medianMs = r1(median(ms));
      rec.maxMs = r1(ms.length ? Math.max.apply(null, ms) : null);
      rec.methods = { event: ok.filter(r => r.method === 'event').length, raf: ok.filter(r => r.method === 'raf').length };
      rec.rafMedianMs = r1(median(ok.map(r => r.rafMs)));
      rec.over = rec.maxMs !== null && rec.maxMs > TARGET_MS;
      rec.pass = rec.n > 0 && rec.failed === 0 && rec.medianMs <= TARGET_MS;
      out.ops.push(rec);
    }
    out.pageErrors = page.__log.pageErrors.slice(0, 5);
  } finally { await ctx.close().catch(() => {}); }
  return out;
}

// ── 2. 動きを減らす設定 ──
const RUNNING_ANIMS = () => document.getAnimations().filter(a => {
  if (a.playState !== 'running') return false;
  let d = 0;
  try { d = a.effect.getComputedTiming().duration; } catch (e) { d = 0; }
  return d === Infinity || Number(d) > 1;
}).map(a => (a.animationName || a.transitionProperty || 'anim') + '@' + ((a.effect && a.effect.target && (a.effect.target.id || String(a.effect.target.className))) || ''));

async function measureReduced(browser, base, vp) {
  const { ctx, page } = await openPage(browser, base, vp, { reduced: true });
  const out = { viewport: vp.name, running: {}, scroll: [], notes: [] };
  try {
    await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 60000 });
    await waitCatalog(page);
    await sleep(1500);
    const count = async (label) => { const names = await page.evaluate(RUNNING_ANIMS); out.running[label] = { count: names.length, names: names.slice(0, 10) }; };
    await count('after-load');
    await page.evaluate(() => nbOpenFilterSheet(null));
    await sleep(500);
    await count('sheet-open');
    await closeSheet(page);
    await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); openM(0, 'grid'); });
    await sleep(500);
    await count('quick-view');
    await page.evaluate(() => closeM());
    await sleep(400);
    out.reducedMatches = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);

    // JS の smooth スクロール。押してから rAF 1 回後に、もう目的の位置か
    const probe = async (id, setup, expectFn, act) => {
      await page.evaluate(setup);
      await sleep(500);
      const r = await page.evaluate((expectSrc, actSrc) => new Promise(res => {
        const expected = (new Function('return (' + expectSrc + ')()'))();
        const y0 = window.scrollY;
        (new Function('return (' + actSrc + ')()'))();
        const yNow = window.scrollY;
        requestAnimationFrame(() => {
          const y1 = window.scrollY;
          const max = document.documentElement.scrollHeight - window.innerHeight;
          const target = Math.max(0, Math.min(expected, max));
          res({ y0: Math.round(y0), target: Math.round(target), yRightAfter: Math.round(yNow), yAfter1Frame: Math.round(y1) });
        });
      }), expectFn.toString(), act.toString());
      // 始めから目的の位置の近く（50px 以内）なら、即時かどうかは確かめられない。合格にも不合格にも数えない（vacuous）
      r.id = id; r.vacuous = Math.abs(r.y0 - r.target) <= 50; r.instant = r.vacuous ? null : Math.abs(r.yAfter1Frame - r.target) <= 2;
      out.scroll.push(r);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await sleep(300);
    };
    await probe('scroll-top（#scroll-top を押す）',
      () => { window.scrollTo({ top: 1800, behavior: 'instant' }); window.dispatchEvent(new Event('scroll')); },
      () => 0,
      () => document.getElementById('scroll-top').click());
    await probe('scrollToMagazine（雑誌面の先頭へ戻る）',
      () => window.scrollTo({ top: 2500, behavior: 'instant' }),
      () => { var t = document.querySelector('.feature-strip') || document.getElementById('main-content'); if (!t) return 0; var top = t.getBoundingClientRect().top + window.pageYOffset - 70; return top < 0 ? 0 : top; },
      () => scrollToMagazine());
    await probe('scrollToResults（絞り込み確定後の結果へ）',
      () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
      () => { var t = document.getElementById('results-summary'); if (!t || t.offsetParent === null) t = document.getElementById('results-block'); return t.getBoundingClientRect().top + window.pageYOffset - 110; },
      () => scrollToResults());
    out.pageErrors = page.__log.pageErrors.slice(0, 5);
  } finally { await ctx.close().catch(() => {}); }
  const anim = Object.values(out.running).reduce((a, x) => a + x.count, 0);
  out.animationsPass = anim === 0;
  const checked = out.scroll.filter(s => !s.vacuous);
  out.scrollPass = checked.length > 0 && checked.every(s => s.instant);
  out.pass = out.animationsPass && out.scrollPass && out.reducedMatches === true;
  return out;
}

// ── 3. スケルトンが見えている時間 ──
// .skel は #grid の中に作られる。#grid は条件が入っていない既定のトップでは display:none（実際には見えない）ので、DOM に出た時間（dom）と、
// 実際に見えた時間（visible: getClientRects が空でない）を分けて残す。条件つきの URL（#q=…）でも測る。
// 同じタスクの中で作って消した場合もあるので、MutationObserver の records の追加・削除で数える。
const SKEL_INIT = () => {
  window.__sk = { domAdd: [], domRemove: [], visible: [], vis: null, seen: false, visSeen: false, fcp: null };
  const hasVisible = () => { const e = document.querySelectorAll('.skel'); for (let i = 0; i < e.length; i++) if (e[i].getClientRects().length) return true; return false; };
  const tick = () => {
    const v = hasVisible(), t = performance.now();
    if (v && window.__sk.vis === null) { window.__sk.vis = t; window.__sk.visSeen = true; }
    if (!v && window.__sk.vis !== null) { window.__sk.visible.push([window.__sk.vis, t]); window.__sk.vis = null; }
  };
  const isSkel = n => n.nodeType === 1 && (n.classList.contains('skel') || !!n.querySelector('.skel'));
  new MutationObserver(recs => {
    const t = performance.now();
    recs.forEach(r => {
      r.addedNodes.forEach(n => { if (n.nodeType === 1 && (n.classList.contains('skel') || (n.querySelector && n.querySelector('.skel')))) { window.__sk.domAdd.push(t); window.__sk.seen = true; } });
      r.removedNodes.forEach(n => { if (isSkel(n)) window.__sk.domRemove.push(t); });
    });
    tick();
  }).observe(document, { childList: true, subtree: true });
  (function loop() { tick(); requestAnimationFrame(loop); })();
  try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.name === 'first-contentful-paint') window.__sk.fcp = e.startTime; })).observe({ type: 'paint', buffered: true }); } catch (e) { /* なし */ }
};

async function measureSkeleton(browser, base, vp, scenario) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const { ctx, page } = await openPage(browser, base, vp, { network: true, init: SKEL_INIT });
    try {
      await page.goto(base + '/index.html' + scenario.hash, { waitUntil: 'load', timeout: 90000 });
      const loaded = await waitCatalog(page);
      await sleep(600);
      const sk = await page.evaluate(() => {
        const s = window.__sk; const t = performance.now();
        const vis = s.visible.slice(); if (s.vis !== null) vis.push([s.vis, t]);
        return { seen: s.seen, visSeen: s.visSeen, domAdd: s.domAdd, domRemove: s.domRemove, vis, stillVisible: s.vis !== null, fcp: s.fcp, skelNow: document.querySelectorAll('.skel').length };
      });
      const visTotal = sk.vis.reduce((a, x) => a + (x[1] - x[0]), 0);
      const visSpan = sk.vis.length ? sk.vis[sk.vis.length - 1][1] - sk.vis[0][0] : 0;
      const domSpan = sk.domAdd.length && sk.domRemove.length ? Math.max.apply(null, sk.domRemove) - Math.min.apply(null, sk.domAdd) : 0;
      runs.push({ domSeen: sk.seen, visibleSeen: sk.visSeen, fcpMs: r1(sk.fcp), domAddCount: sk.domAdd.length, domSpanMs: r1(domSpan), visibleTotalMs: r1(visTotal), visibleSpanMs: r1(visSpan), stillVisible: sk.stillVisible, skelLeft: sk.skelNow, catalogLoaded: loaded });
    } finally { await ctx.close().catch(() => {}); }
  }
  const vs = runs.filter(r => r.visibleSeen);
  return {
    viewport: vp.name, scenario: scenario.id, runs,
    domSeenRuns: runs.filter(r => r.domSeen).length, visibleSeenRuns: vs.length,
    visibleTotalMedianMs: r1(median(vs.map(r => r.visibleTotalMs))), visibleTotalMaxMs: r1(vs.length ? Math.max.apply(null, vs.map(r => r.visibleTotalMs)) : null),
    domSpanMedianMs: r1(median(runs.filter(r => r.domSeen).map(r => r.domSpanMs))),
  };
}

const SKEL_SCENARIOS = [{ id: 'top', hash: '' }, { id: 'with-query', hash: LIST_HASH }];

(async () => {
  const startedAt = new Date().toISOString();
  const host = { power: powerSource(), lowPowerMode: lowPowerMode(), loadAvg1: Number(os.loadavg()[0].toFixed(2)), cpus: os.cpus().length, node: process.version };
  if (host.power === 'battery') console.log('警告: バッテリー駆動。押してから変わるまでの時間は電源で割れうる。前後の比較は同じ電源どうしで行う（結果に power: battery を残す）');
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await launchBrowser();
  const result = { tool: 'e2e_motion.js', startedAt, base: 'local-static-server', runs: RUNS, targetMs: TARGET_MS, host, browser: await browser.version(), throttle: { cpu: 4, network: 'skeleton のみ 遅延150ms・下り1.6Mbps' } };
  try {
    if (ONLY.includes('taps')) { result.taps = []; for (const vp of VPS) result.taps.push(await measureTaps(browser, base, vp)); }
    if (ONLY.includes('reduced')) { result.reduced = []; for (const vp of VPS) result.reduced.push(await measureReduced(browser, base, vp)); }
    if (ONLY.includes('skeleton')) { result.skeleton = []; for (const vp of VPS) for (const sc of SKEL_SCENARIOS) result.skeleton.push(await measureSkeleton(browser, base, vp, sc)); }
  } finally { await browser.close().catch(() => {}); server.close(); }
  host.powerAtEnd = powerSource();

  const fails = [];
  console.log(`\n== e2e_motion  電源 ${host.power}（低電力モード ${host.lowPowerMode}）  各 ${RUNS} 回 ==`);
  (result.taps || []).forEach(t => {
    console.log(`[押してから変わるまで ${t.viewport}]（目安 ${TARGET_MS}ms）`);
    t.ops.forEach(o => {
      console.log(`  ${o.pass ? 'PASS' : 'FAIL'}  ${o.name}: 中央値 ${o.medianMs}ms / 最大 ${o.maxMs}ms${o.over ? '  [最大が目安超え]' : ''}  (n=${o.n}, 失敗 ${o.failed}, 測り方 event ${o.methods.event}/raf ${o.methods.raf}, raf 中央値 ${o.rafMedianMs}ms)`);
      if (!o.pass) fails.push(`taps ${t.viewport} ${o.name}`);
    });
    t.notes.forEach(n => console.log('  注: ' + n));
  });
  (result.reduced || []).forEach(r => {
    console.log(`[動きを減らす ${r.viewport}] 設定が効いている: ${r.reducedMatches}`);
    Object.keys(r.running).forEach(k => console.log(`  実行中のアニメーション ${k}: ${r.running[k].count} ${r.running[k].count ? JSON.stringify(r.running[k].names) : ''}`));
    r.scroll.forEach(s => console.log(`  ${s.instant ? 'PASS' : 'FAIL'}  ${s.id}: 開始 ${s.y0} → 目的 ${s.target} / 直後 ${s.yRightAfter} / 1フレーム後 ${s.yAfter1Frame}`));
    if (!r.pass) fails.push(`reduced ${r.viewport}`);
  });
  (result.skeleton || []).forEach(s => {
    console.log(`[スケルトン ${s.viewport} ${s.scenario}] DOM に出た ${s.domSeenRuns}/${RUNS} 回・実際に見えた ${s.visibleSeenRuns}/${RUNS} 回・見えた時間の中央値 ${s.visibleTotalMedianMs}ms・最大 ${s.visibleTotalMaxMs}ms・DOM に出てから消えるまでの中央値 ${s.domSpanMedianMs}ms`);
  });
  result.pass = fails.length === 0;
  result.fails = fails;
  console.log(fails.length ? `\n不合格 ${fails.length} 件: ${fails.join(' / ')}` : '\n全部合格');
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n'); console.log('保存: ' + OUT); }
  process.exit(REPORT ? 0 : (fails.length ? 1 : 0));
})().catch(e => { console.error(e); process.exit(2); });
