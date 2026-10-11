// I-21（URL と「戻る」）の実ブラウザ確認。index.html をローカルで配信し、headless Chrome（puppeteer）で操作して、履歴と URL の動きを確かめる。
// 使い方: node docs/qa/uiux-2026-10/e2e_history.js [--root <フォルダ>] [--viewport mobile|desktop|both] [--label <名前>] [--json <出力先>] [--ga4-history] [--headless auto|shell|new]
// - --root: 配信するフォルダ（既定: このリポジトリの直下）。改修前の index.html を置いたフォルダを渡すと、同じ確認が「前」でどうなるかを比べられる
// - --viewport: mobile = 390x844（タッチ）／desktop = 1280x900（既定は両方）
// - --only <名前>: 場面の名前（deeplink・backforward・idless・scroll・close・swap・filters・bad）に含まれる語で絞る
// - --headless: auto（既定）= chrome-headless-shell があればそれを使い、無ければ新しいヘッドレス（フル版 Chrome）／shell／new。
//   新しいヘッドレスは、画面が眠っている・ロックされているときなどに、タッチ操作（Input.dispatchTouchEvent）が応答しなくなることがある（2026-10-11 夜、単純なページでも起きた）。
//   画面に依存しない chrome-headless-shell なら起きない
// - --ga4-history: GA4 の計測（gtag.js）を読み込み、履歴の変更（pushState・replaceState・戻る・進む）で page_view が出るかを見る。
//   計測の送信（/g/collect など）は記録して中断する＝本番の GA4 には何も送らない。gtag.js の読み込み（GET）以外の外部への通信は、すべて中断する
// 既定では GA4 を含む外部への通信をすべて中断する（ローカルの配信だけで動く）。
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
const getOpt = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const ROOT = path.resolve(getOpt('--root', path.join(__dirname, '..', '..', '..')));
const WHICH = getOpt('--viewport', 'both');
const LABEL = getOpt('--label', 'after');
const JSON_OUT = getOpt('--json', '');
const GA4_HISTORY = argv.includes('--ga4-history');
const ONLY = getOpt('--only', '').toLowerCase();
const HEADLESS = getOpt('--headless', 'auto');

const VIEWPORTS = {
  mobile: { name: 'mobile-390', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { name: 'desktop-1280', width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

// 50店の外にある店（共有リンクで開くとき、全店のデータを読み終えるまで見つからない店）と、50店の中にある店
const FAR_STORE = 'J004660861';
const NEAR_STORE = 'J004558109';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json',
};

async function launchBrowser() {
  const modes = HEADLESS === 'shell' ? ['shell'] : HEADLESS === 'new' ? [true] : ['shell', true];
  let lastErr;
  for (const m of modes) {
    try {
      const b = await puppeteer.launch({ headless: m, protocolTimeout: 30000 });
      console.log(`ブラウザ: ${await b.version()}（headless: ${m}）`);
      return b;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
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

const sleep = ms => new Promise(r => setTimeout(r, ms));
const goBack = page => page.goBack({ timeout: 8000 }).catch(() => null);
const goForward = page => page.goForward({ timeout: 8000 }).catch(() => null);

// GA4 に送る通信の見分け方。URL の en（イベント名）と dl（ページの URL）だけを残す（計測 ID・クライアント ID は残さない）
const COLLECT_RE = /\/g\/collect|\/j\/collect|\/collect\?|google-analytics\.com|analytics\.google\.com|doubleclick\.net/;
function parseCollect(u, post) {
  const out = [];
  let q = {};
  try { q = Object.fromEntries(new URL(u).searchParams); } catch (e) { /* 読めない URL は空で数える */ }
  if (q.en) out.push({ en: q.en, dl: q.dl || '' });
  if (post) {
    String(post).split('\n').filter(Boolean).forEach(line => {
      const p = Object.fromEntries(new URLSearchParams(line));
      if (p.en) out.push({ en: p.en, dl: p.dl || q.dl || '' });
    });
  }
  if (!out.length) out.push({ en: '(en なし)', dl: q.dl || '' });
  return out;
}
const GTAG_ALLOW = [/^https:\/\/www\.googletagmanager\.com\/gtag\/(js|destination)\b/];

async function newPage(browser, base, vp, opts) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  await page.bringToFront();
  // 初回訪問のスプラッシュ（約1秒・全面）と、ホーム画面追加の案内（iOS は3秒後に全面の背景つき）は、見終えた・閉じた人の状態にする。出たままだと×ボタンを覆い、
  // 確認したい動きが見えなくなる（どちらも I-13 の範囲）
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('pwa-banner-dismissed', String(Date.now())); } catch (e) { /* 保存できない環境では案内が出るだけ */ }
    try { sessionStorage.setItem('nb_splash', '1'); } catch (e) { /* 同上 */ }
    // Android Chrome の「追加できる」の合図（beforeinstallprompt）は、タイミング次第で全面の暗い背景つきの案内を出す。この確認では受け取らない
    const orig = window.addEventListener;
    window.addEventListener = function (type, fn, o) { if (type === 'beforeinstallprompt') return undefined; return orig.call(this, type, fn, o); };
  });
  const log = { pageErrors: [], consoleErrors: [], blocked: 0, collect: [], collectRequests: 0, netCollect: 0 };
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith(base) && /\/(sw\.js|manifest\.(json|webmanifest))(\?|$)/.test(u)) return req.respond({ status: 404, contentType: 'text/plain', body: 'not found' });
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') return req.continue();
    if (opts && opts.ga4 && req.method() === 'GET' && GTAG_ALLOW.some(re => re.test(u))) return req.continue();
    // GA4 を読み込む実行では、計測の送信は通信の層（下の Network.setBlockedURLs）で先に遮断され、ここには届かない。記録はそちらで取る。ここに届いた分は中断する
    if (COLLECT_RE.test(u)) { log.collectRequests++; if (!(opts && opts.ga4)) parseCollect(u, req.postData()).forEach(h => log.collect.push(h)); }
    log.blocked++;
    return req.abort();
  });
  // 二重の守り: 計測の送信先は、通信の層でも遮断する（中断の処理を漏れた通信が出ても本番に届かない）
  if (opts && opts.ga4) {
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*google-analytics.com*', '*analytics.google.com*', '*doubleclick.net*', '*/g/collect*', '*/j/collect*'] });
    cdp.on('Network.requestWillBeSent', ev => {
      if (!COLLECT_RE.test(ev.request.url)) return;
      log.netCollect++;
      parseCollect(ev.request.url, ev.request.postData).forEach(h => log.collect.push(h));
    });
  }
  page.on('pageerror', e => log.pageErrors.push(String((e && e.message) || e).slice(0, 300)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR_/.test(t)) return; // 遮断した通信の失敗は数えない
    log.consoleErrors.push(t.slice(0, 300));
  });
  page.__log = log;
  return page;
}

async function waitFn(page, fn, arg, timeout) {
  try { await page.waitForFunction(fn, { timeout: timeout || 8000, polling: 50 }, arg); return true; } catch (e) { return false; }
}
const waitCatalog = page => waitFn(page, () => window.FULL_CATALOG_LOADED === true && window.ALL_STORES && window.ALL_STORES.length > 1000, null, 30000);
const waitModal = (page, open, timeout) => waitFn(page, o => { const ov = document.getElementById('ov'); return !!ov && ov.classList.contains('open') === o; }, open, timeout || 8000);

// いまの履歴の位置・URL・モーダルの状態
async function navState(page) {
  return page.evaluate(() => {
    const nav = window.navigation;
    const ov = document.getElementById('ov');
    const mn = document.getElementById('mn');
    return {
      index: nav && nav.currentEntry ? nav.currentEntry.index : null,
      length: nav ? nav.entries().length : history.length,
      hash: location.hash,
      state: history.state,
      modalOpen: !!ov && ov.classList.contains('open'),
      title: mn ? mn.textContent : '',
      bodyOverflow: document.body.style.overflow,
    };
  });
}
const waitIndex = (page, idx) => waitFn(page, i => (window.navigation && window.navigation.currentEntry ? window.navigation.currentEntry.index : -1) === i, idx, 6000);

// dataLayer に積まれたイベント（gtag.js を読み込まない既定の実行でも、trackEvent が積んだ内容を読める）
async function events(page) {
  return page.evaluate(() => Array.from(window.dataLayer || [])
    .filter(a => a && a[0] === 'event')
    .map(a => ({ name: a[1], source: a[2] && a[2].source ? a[2].source : '', store: a[2] && a[2].store_name ? a[2].store_name : '' })));
}
const modalOpens = evs => evs.filter(e => e.name === 'modal_open');

// 画面に見えていて押せる、店を開く入口（トップの「話題」カード）
async function realClick(page, handle) {
  let why = '';
  // 動いている最中（スクロール・アニメーション）に測って外さないよう、数回やり直す
  for (let attempt = 0; attempt < 4; attempt++) {
    // ページは滑らかなスクロール（scroll-behavior: smooth）なので、instant で一気に動かす
    await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
    await sleep(120 + attempt * 200);
    const box = await handle.boundingBox();
    if (!box) { why = '見えない（大きさが無い）'; continue; }
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const probe = await handle.evaluate((el, px, py) => {
      const t = document.elementFromPoint(px, py);
      const name = t ? t.tagName + (t.id ? '#' + t.id : '') + (t.className && typeof t.className === 'string' ? '.' + t.className.split(' ')[0] : '') : '';
      return { hit: !!t && (el.contains(t) || t.contains(el)), name: name, vw: window.innerWidth, vh: window.innerHeight };
    }, x, y);
    if (probe.hit) {
      await page.mouse.click(x, y);
      return { ok: true, why: '' };
    }
    why = probe.name ? '別の要素が覆っている: ' + probe.name : `画面の外（${Math.round(x)},${Math.round(y)} / 画面 ${probe.vw}x${probe.vh}）`;
  }
  return { ok: false, why: why };
}
async function clickSel(page, selector) {
  const h = await page.$(selector);
  if (!h) return { ok: false, why: selector + ' が無い' };
  return realClick(page, h);
}
// 入口が開く店のホットペッパーID（編集部の店など、持たない店は ''・入口から店が分からないときは null）
async function openerStoreId(h) {
  return h.evaluate(el => {
    const m = /openM\((\d+)/.exec(el.getAttribute('onclick') || '');
    if (!m) return null;
    const s = window.ALL_STORES[Number(m[1])];
    return s ? (s['ホットペッパーID'] || '') : null;
  });
}
// idMode: 'with' = ID のある店だけ（URL に store= を載せられる）／'without' = ID の無い店だけ／'any'。skip = 条件に合う入口を先頭から何個飛ばすか
async function firstVisibleOpener(page, selector, idMode, skip) {
  const handles = await page.$$(selector || '[onclick*="openM("]');
  let seen = 0;
  for (const h of handles) {
    const box = await h.boundingBox();
    if (!(box && box.width > 20 && box.height > 20)) continue;
    const id = await openerStoreId(h);
    if (idMode === 'with' && !id) continue;
    if (idMode === 'without' && id !== '') continue;
    if (seen++ < (skip || 0)) continue;
    return h;
  }
  return null;
}
async function openByClick(page, selector, idMode, skip) {
  let h = null;
  for (let i = 0; i < 60 && !h; i++) { h = await firstVisibleOpener(page, selector, idMode || 'with', skip); if (!h) await sleep(250); }
  if (!h) return false;
  const c = await realClick(page, h);
  page.__lastOpenWhy = c.why;
  if (!c.ok) return false;
  return waitModal(page, true);
}
// 「似たお店」が出る店を探して開く（出ない店は閉じて次の店へ）
async function openWithRelated(page, tries) {
  for (let skip = 0; skip < (tries || 8); skip++) {
    const opened = await openByClick(page, null, 'with', skip);
    if (!opened) return false;
    if (await waitFn(page, () => !!document.querySelector('#ov .modal-rsc'), null, 1500)) return true;
    await page.keyboard.press('Escape');
    await waitModal(page, false);
    await sleep(300);
  }
  return false;
}
async function freshTop(browser, base, vp, hash, opts) {
  const page = await newPage(browser, base, vp, opts);
  await page.goto(base + '/' + (hash || ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitCatalog(page);
  return page;
}

const results = [];
function check(vp, id, name, ok, detail) { results.push({ viewport: vp.name, id, name, ok: !!ok, detail: detail || '' }); }

async function closeBy(page, vp, how) {
  if (how === '×ボタン') { const c = await clickSel(page, '.mcl-close'); return c.ok ? '' : '（×が押せない: ' + c.why + '）'; }
  if (how === 'Esc') { await page.keyboard.press('Escape'); return ''; }
  if (how === '背景') {
    const hit = await page.evaluate(() => document.elementFromPoint(2, 2) === document.getElementById('ov'));
    if (hit) { await page.mouse.click(2, 2); return ''; }
    await page.evaluate(() => document.getElementById('ov').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    return '（背景が見えないので合成クリック）';
  }
  if (how === '下スワイプ') {
    const real = vp.hasTouch;
    await page.evaluate(() => { const m = document.querySelector('.modal'); if (m) m.scrollTop = 0; });
    if (real) {
      const touch = await page.touchscreen.touchStart(Math.round(vp.width / 2), 200);
      await touch.move(Math.round(vp.width / 2), 260);
      await touch.move(Math.round(vp.width / 2), 340);
      await touch.end();
      return '（実タッチ）';
    }
    const done = await page.evaluate(() => {
      const m = document.querySelector('.modal');
      if (!m || typeof Touch === 'undefined' || typeof TouchEvent === 'undefined') return false;
      const mk = (y) => new Touch({ identifier: 1, target: m, clientX: 200, clientY: y });
      m.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(200)], targetTouches: [mk(200)], changedTouches: [mk(200)], bubbles: true }));
      m.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [mk(340)], bubbles: true }));
      return true;
    });
    return done ? '（合成タッチ）' : '（TouchEvent が無く未実行）';
  }
  return '';
}

async function scenarioDeepLink(browser, base, vp) {
  for (const [label, id] of [['50店の外', FAR_STORE], ['50店の中', NEAR_STORE]]) {
    const page = await freshTop(browser, base, vp, '#store=' + id);
    const opened = await waitModal(page, true, 20000);
    const st = await navState(page);
    const info = await page.evaluate(sid => { const s = (window.ALL_STORES || []).find(x => x['ホットペッパーID'] === sid); return s ? s['店名'] : ''; }, id);
    check(vp, 'S1-' + label, `共有リンク #store=（${label}）でモーダルが開く`, opened, opened ? '' : '開かなかった');
    check(vp, 'S1-' + label + '-title', `共有リンク（${label}）で開いた店が、リンクの店と一致する`, opened && info && st.title.indexOf(info.split(' ')[0]) >= 0, `モーダル「${st.title}」/ データ「${info}」`);
    check(vp, 'S1-' + label + '-hist', `共有リンク（${label}）で開いても履歴を足さない`, st.index === 0 && st.length === 1 && !st.state, `index=${st.index} length=${st.length} state=${JSON.stringify(st.state)}`);
    check(vp, 'S1-' + label + '-url', `共有リンク（${label}）の URL が #store=${id} のまま`, st.hash === '#store=' + id, `hash=${st.hash}`);
    const evs = modalOpens(await events(page));
    check(vp, 'S1-' + label + '-ga', `共有リンク（${label}）で modal_open が1回・source=deeplink`, evs.length === 1 && evs[0].source === 'deeplink', JSON.stringify(evs));
    const xc = await clickSel(page, '.mcl-close');
    await sleep(400);
    const st2 = await navState(page);
    check(vp, 'S1-' + label + '-x-reach', `共有リンク（${label}）のモーダルの×が押せる（ほかの要素に覆われていない）`, xc.ok, xc.why);
    check(vp, 'S1-' + label + '-close', `共有リンク（${label}）のモーダルを×で閉じると、履歴は増えず URL から store= が消える`, !st2.modalOpen && st2.index === 0 && st2.length === 1 && st2.hash.indexOf('store=') < 0, `modalOpen=${st2.modalOpen} index=${st2.index} length=${st2.length} hash=${st2.hash}`);
    check(vp, 'S1-' + label + '-scroll', `閉じたあと、背景のスクロール固定が戻る`, st2.bodyOverflow === '', `overflow="${st2.bodyOverflow}"`);
    await goBack(page);
    await sleep(300);
    check(vp, 'S1-' + label + '-leave', `閉じたあと「戻る」を1回押すと、このサイトを離れる（余分な履歴が無い）`, page.url() === 'about:blank', `url=${page.url()}`);
    check(vp, 'S1-' + label + '-errors', `共有リンク（${label}）の読み込みで例外が出ない`, page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' | '));
    await page.close();
  }
}

async function scenarioBackForward(browser, base, vp) {
  const page = await freshTop(browser, base, vp, '');
  const before = await navState(page);
  const opened = await openByClick(page);
  const st = await navState(page);
  check(vp, 'S2-open', '一覧のカードを押すとモーダルが開く', opened, opened ? '' : '開く入口が見つからない／開かなかった ' + (page.__lastOpenWhy || ''));
  check(vp, 'S2-push', '開くと履歴が1つ増え、URL に store= が載り、印（nbM）が付く', st.index === before.index + 1 && st.length === before.length + 1 && /store=/.test(st.hash) && st.state && st.state.nbM === 1, `index ${before.index}→${st.index} length ${before.length}→${st.length} hash=${st.hash} state=${JSON.stringify(st.state)}`);
  const evs1 = modalOpens(await events(page));
  check(vp, 'S2-ga1', '開いたときの modal_open は1回で、source が押した場所（ranking・trend_today など）になる（unknown でない）', evs1.length === 1 && !!evs1[0].source && evs1[0].source !== 'unknown', JSON.stringify(evs1));
  const title1 = st.title;
  await goBack(page);
  const closedByBack = await waitModal(page, false);
  await waitIndex(page, before.index);
  const st2 = await navState(page);
  check(vp, 'S2-back', '「戻る」1回でモーダルが閉じ、URL から store= が消える', closedByBack && st2.index === before.index && st2.hash.indexOf('store=') < 0 && page.url().startsWith(base), `modalOpen=${st2.modalOpen} index=${st2.index} hash=${st2.hash}`);
  check(vp, 'S2-back-scroll', '「戻る」で閉じたあと、背景のスクロール固定が戻る', st2.bodyOverflow === '', `overflow="${st2.bodyOverflow}"`);
  await goForward(page);
  const reopened = await waitModal(page, true);
  const st3 = await navState(page);
  check(vp, 'S2-forward', '「進む」で同じ店のモーダルがもう一度開く', reopened && st3.title === title1 && /store=/.test(st3.hash), `title「${st3.title}」/ 最初「${title1}」 hash=${st3.hash}`);
  const evs2 = modalOpens(await events(page));
  check(vp, 'S2-ga2', '「進む」で開いたときは modal_open を足さない（数が増えない）', evs2.length === 1, JSON.stringify(evs2));
  const xc2 = await clickSel(page, '.mcl-close');
  await waitIndex(page, before.index);
  const closed = await waitModal(page, false);
  const st4 = await navState(page);
  check(vp, 'S2-x', '「進む」で開いたモーダルを×で閉じると、履歴が1つ戻る', closed && st4.index === before.index && st4.hash.indexOf('store=') < 0, `index=${st4.index} hash=${st4.hash}`);
  check(vp, 'S2-errors', '操作の間に例外が出ない', page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' | '));
  await page.close();
}

async function scenarioIdLess(browser, base, vp) {
  const page = await freshTop(browser, base, vp, '');
  const before = await navState(page);
  const opened = await openByClick(page, null, 'without');
  const st = await navState(page);
  check(vp, 'S7-open', 'ホットペッパーIDの無い店（編集部の店・全体の約3%）でもモーダルが開く', opened, opened ? '' : '入口が見つからない／開かなかった ' + (page.__lastOpenWhy || ''));
  check(vp, 'S7-push', '開くと履歴が1つ増え（印 nbM）、URL は変わらない（ID が無いので store= を付けられない）', opened && st.index === before.index + 1 && st.state && st.state.nbM === 1 && st.hash.indexOf('store=') < 0, `index ${before.index}→${st.index} hash=${st.hash} state=${JSON.stringify(st.state)}`);
  await goBack(page);
  const closedByBack = await waitModal(page, false);
  await waitIndex(page, before.index);
  const st2 = await navState(page);
  check(vp, 'S7-back', '「戻る」1回でモーダルが閉じる', closedByBack && st2.index === before.index && page.url().startsWith(base), `modalOpen=${st2.modalOpen} index=${st2.index}`);
  await goForward(page);
  await sleep(600);
  const st3 = await navState(page);
  check(vp, 'S7-forward', '（制約）「進む」では開き直さない。URL に店の ID が無く、どの店か分からないため。画面は壊れない', !st3.modalOpen && page.__log.pageErrors.length === 0, `modalOpen=${st3.modalOpen} index=${st3.index}`);
  const reopened = await openByClick(page, null, 'without');
  const st4 = await navState(page);
  check(vp, 'S7-reopen', '「進む」で着いた履歴の上で開き直しても、履歴は増えない（置き換える）', reopened && st4.index === st3.index && st4.length === st3.length, `index ${st3.index}→${st4.index} length ${st3.length}→${st4.length}`);
  const xc = await clickSel(page, '.mcl-close');
  await waitIndex(page, before.index);
  const closed = await waitModal(page, false);
  const st5 = await navState(page);
  check(vp, 'S7-x', '×で閉じると履歴が1つ戻る', xc.ok && closed && st5.index === before.index, `index=${st5.index} ${xc.why}`);
  check(vp, 'S7-errors', '操作の間に例外が出ない', page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' | '));
  await page.close();
}

async function scenarioScroll(browser, base, vp) {
  const page = await freshTop(browser, base, vp, '');
  // 読み込み直後はページの高さがまだ動く（フォント・画像）。落ち着いてから測る（履歴の動きとは関係しない揺れを避ける）
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await sleep(300);
  const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
  const opened = await openByClick(page);
  const y1 = await scrollY();
  const s1 = await navState(page);
  await goBack(page);
  await waitModal(page, false);
  await sleep(500);
  const y2 = await scrollY();
  const s2 = await navState(page);
  check(vp, 'S8-scroll-back', '一覧を下げて店を開き、「戻る」で閉じても、一覧のスクロール位置が変わらない', opened && Math.abs(y2 - y1) <= 2,
    `opened=${opened} 開いたとき ${y1}px（index ${s1.index}）→ 戻ったあと ${y2}px（index ${s2.index}・modalOpen ${s2.modalOpen}）url=${page.url()}`);
  const opened2 = await openByClick(page);
  const y3 = await scrollY();
  await clickSel(page, '.mcl-close');
  await waitModal(page, false);
  await sleep(500);
  const y4 = await scrollY();
  check(vp, 'S8-scroll-x', '×で閉じても、一覧のスクロール位置が変わらない', opened2 && Math.abs(y4 - y3) <= 2, `opened=${opened2} 開いたとき ${y3}px → 閉じたあと ${y4}px`);
  check(vp, 'S8-errors', '操作の間に例外が出ない', page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' | '));
  await page.close();
}

async function scenarioCloseMethods(browser, base, vp) {
  const page = await freshTop(browser, base, vp, '');
  const before = await navState(page);
  const methods = ['×ボタン', '背景', 'Esc', '下スワイプ'];
  for (const how of methods) {
    const opened = await openByClick(page);
    const st = await navState(page);
    let note = '';
    if (opened) note = await closeBy(page, vp, how);
    const closed = await waitModal(page, false, 4000);
    await waitIndex(page, before.index);
    const st2 = await navState(page);
    const ok = opened && closed && st2.index === before.index && st2.length === before.length + 1 && st2.hash.indexOf('store=') < 0 && page.url().startsWith(base);
    check(vp, 'S3-' + how, `${how}で閉じると、足した履歴が1つ戻って消える${note}`, ok, `opened=${opened} closed=${closed} index ${st.index}→${st2.index} length=${st2.length} hash=${st2.hash} url=${page.url().slice(0, 60)}`);
    check(vp, 'S3-' + how + '-scroll', `${how}で閉じたあと、背景のスクロール固定が戻る`, st2.bodyOverflow === '', `overflow="${st2.bodyOverflow}"`);
  }
  // 閉じた直後にもう一度開いても、履歴は増え続けない（進む側の履歴を置き換える）
  const opened = await openByClick(page);
  const st = await navState(page);
  check(vp, 'S3-repeat', '開いて閉じるのを4回繰り返したあとも、履歴の数は増え続けない', opened && st.length === before.length + 1 && st.index === before.index + 1, `index=${st.index} length=${st.length}`);
  // 二重に閉じても履歴は1つしか戻らない（このサイトを離れない）
  await page.evaluate(() => { closeM(); closeM(); });
  await sleep(600);
  const st2 = await navState(page);
  check(vp, 'S3-double', '閉じる処理が2回続いても、履歴は1つしか戻らない（サイトを離れない）', page.url().startsWith(base) && st2.index === before.index, `url=${page.url().slice(0, 60)} index=${st2.index}`);
  check(vp, 'S3-errors', '操作の間に例外が出ない', page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' | '));
  await page.close();
}

async function scenarioSwap(browser, base, vp) {
  const page = await freshTop(browser, base, vp, '');
  const before = await navState(page);
  const opened = await openWithRelated(page);
  const st = await navState(page);
  const rs = await page.$('.modal-rsc');
  check(vp, 'S4-has-related', '店のモーダルに「似たお店」が出る', opened && !!rs, `opened=${opened} related=${!!rs}`);
  if (rs) {
    const rc = await realClick(page, rs);
    check(vp, 'S4-related-reach', '「似たお店」が押せる', rc.ok, rc.why);
    await waitFn(page, t => document.getElementById('mn').textContent !== t, st.title, 6000);
    await sleep(300);
    const st2 = await navState(page);
    check(vp, 'S4-swap', '「似たお店」へ切り替えても、履歴は増えない（置き換わる）', st2.modalOpen && st2.title !== st.title && st2.index === before.index + 1 && st2.length === before.length + 1, `タイトル「${st.title}」→「${st2.title}」 index=${st2.index} length=${st2.length}`);
    check(vp, 'S4-url', '切り替えたあとの URL は、新しい店の store= になる', st2.hash !== st.hash && /store=/.test(st2.hash) && st2.state && st2.state.nbM === 1, `${st.hash} → ${st2.hash}`);
    const evs = modalOpens(await events(page));
    check(vp, 'S4-ga', '切り替えの modal_open は source=modal_reco で1回増える', evs.length === 2 && evs[1].source === 'modal_reco', JSON.stringify(evs));
    await goBack(page);
    const closed = await waitModal(page, false);
    await waitIndex(page, before.index);
    const st3 = await navState(page);
    check(vp, 'S4-back', '切り替えたあとの「戻る」1回で、モーダルが閉じて一覧に戻る', closed && st3.index === before.index && st3.hash.indexOf('store=') < 0, `modalOpen=${st3.modalOpen} index=${st3.index} hash=${st3.hash}`);
  }
  check(vp, 'S4-errors', '操作の間に例外が出ない', page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' | '));
  await page.close();
}

async function scenarioFilters(browser, base, vp) {
  const page = await freshTop(browser, base, vp, '');
  const before = await navState(page);
  // 絞り込み（ジャンル）: 履歴は足さず、URL だけが変わる
  const genre = await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('.ft')).filter(x => x.dataset.f && x.dataset.f !== 'All');
    if (!chips.length) return '';
    chips[0].click();
    return chips[0].dataset.f;
  });
  await sleep(500);
  const st = await navState(page);
  check(vp, 'S5-filter', '絞り込みは履歴を足さず、URL に genre= を載せる', !!genre && st.length === before.length && st.hash.indexOf('genre=') >= 0, `genre=${genre} length ${before.length}→${st.length} hash=${st.hash}`);
  // 検索語: 履歴は足さず、URL に q= を載せる。結果の一覧から店を開く
  await page.evaluate(g => { const si = document.getElementById('si'); si.value = g; }, genre);
  await page.evaluate(() => doSearch());
  await sleep(800);
  const st2 = await navState(page);
  check(vp, 'S5-search', '検索も履歴を足さず、URL に q= を載せる', st2.length === before.length && st2.hash.indexOf('q=') >= 0, `length=${st2.length} hash=${st2.hash}`);
  const opened = await openByClick(page, '#grid [onclick*="openM("], #grid .card');
  const st3 = await navState(page);
  check(vp, 'S5-open', '検索結果のカードからモーダルを開くと、絞り込みの URL の末尾に store= が付く', opened && /q=/.test(st3.hash) && /store=/.test(st3.hash) && st3.hash.indexOf('genre=') >= 0, `opened=${opened} hash=${st3.hash}`);
  await goBack(page);
  const closed = await waitModal(page, false);
  await waitIndex(page, st2.index);
  const st4 = await navState(page);
  const stillResults = await page.evaluate(() => document.body.classList.contains('search-active') && document.querySelectorAll('#grid .card').length > 0);
  check(vp, 'S5-back', '「戻る」で閉じたあと、絞り込みの URL と検索結果の一覧が残る', closed && st4.hash === st2.hash && stillResults, `hash=${st4.hash}（検索前の結果表示=${stillResults}）`);
  check(vp, 'S5-errors', '操作の間に例外が出ない', page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' | '));
  await page.close();
}

const BAD_HASHES = [
  ['#q=%E0%A4%A', '壊れた % の検索語'],
  ['#pref=a%22b', '" を含む地域'],
  ['#genre=%', '壊れた % のジャンル'],
  ['#tag=%E0%A4%A,x', '壊れた % のタグ'],
  ['#ward=%22', '" を含むエリア'],
  ['#cap=%', '壊れた % の人数'],
  ['#store=%', '壊れた % の店 ID'],
  ['#store=' + FAR_STORE + '&q=%E0%A4%A', '店 ID は正しく、検索語が壊れている'],
  ['#=&&=', '名前の無い値だけ'],
  ['#__proto__=1&store=' + NEAR_STORE, '__proto__ を含む'],
];
async function scenarioBadHashes(browser, base, vp) {
  for (const [hash, label] of BAD_HASHES) {
    const page = await freshTop(browser, base, vp, hash);
    await sleep(500);
    const info = await page.evaluate(() => ({ n: window.ALL_STORES ? window.ALL_STORES.length : -1, full: window.FULL_CATALOG_LOADED === true, cards: document.querySelectorAll('.card, .trend-rank-card').length }));
    const wantsStore = /store=J/.test(hash);
    let storeOk = true;
    if (wantsStore) storeOk = await waitModal(page, true, 20000);
    check(vp, 'S6-' + hash, `壊れたハッシュ ${hash}（${label}）でも初期化が止まらない`, page.__log.pageErrors.length === 0 && info.full && info.n > 1000 && info.cards > 0 && storeOk, `pageerror=${page.__log.pageErrors.length} stores=${info.n} cards=${info.cards}${wantsStore ? ' store-modal=' + storeOk : ''} ${page.__log.pageErrors.join(' | ')}`);
    await page.close();
  }
  // 存在しない店 ID: 全店のデータを読み終えたら、URL から外れる（モーダルは開かない）
  const page = await freshTop(browser, base, vp, '#store=ZZZ999&genre=' + encodeURIComponent('居酒屋'));
  await sleep(1200);
  const st = await navState(page);
  check(vp, 'S6-unknown-id', '存在しない店 ID は、全店を探したあと URL から外れ、ほかの条件は残る', !st.modalOpen && st.hash.indexOf('store=') < 0 && st.hash.indexOf('genre=') >= 0 && page.__log.pageErrors.length === 0, `modalOpen=${st.modalOpen} hash=${st.hash}`);
  await page.close();
  // 店舗ページの口コミ導線（../index.html#store=ID&review=1）の形
  const page2 = await freshTop(browser, base, vp, '#store=' + NEAR_STORE + '&review=1');
  const op = await waitModal(page2, true, 20000);
  check(vp, 'S6-review', '#store=ID&review=1（店舗ページからの導線）でも開く', op && page2.__log.pageErrors.length === 0, `pageerror=${page2.__log.pageErrors.length}`);
  await page2.close();
}

// GA4: 履歴の変更で page_view が出るか。gtag.js だけ読み込み、計測の送信は記録して中断する（本番には何も送らない）
async function scenarioGa4(browser, base, vp) {
  const page = await freshTop(browser, base, vp, '', { ga4: true });
  await sleep(4000);
  const log = page.__log;
  // 遮断された送信を gtag.js はやり直すので、同じイベントが2回以上記録される（dataLayer への push は1回）。イベント名とページの URL が同じものは1件に数える
  const uniq = list => {
    const seen = new Set();
    return list.filter(h => { const k = h.en + '|' + h.dl; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(h => ({ en: h.en, dl: h.dl.replace(/^https?:\/\/[^/]+/, '') }));
  };
  const snapshot = name => { const hits = uniq(log.collect); return { phase: name, hits: hits, pageViews: hits.filter(h => h.en === 'page_view').length }; };
  const phase = async (name, fn) => {
    log.collect.length = 0;
    await fn();
    await sleep(3500);
    return snapshot(name);
  };
  const report = [];
  report.push(snapshot('読み込み直後'));
  report.push(await phase('絞り込み（replaceState）', async () => { await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.ft')).filter(x => x.dataset.f && x.dataset.f !== 'All'); if (c[0]) c[0].click(); }); }));
  report.push(await phase('モーダルを開く（pushState）', async () => { await openByClick(page); }));
  report.push(await phase('「戻る」（popstate）', async () => { await goBack(page); }));
  report.push(await phase('「進む」（popstate）', async () => { await goForward(page); }));
  report.push(await phase('×で閉じる（history.back）', async () => { await clickSel(page, '.mcl-close'); }));
  const loaded = await page.evaluate(() => typeof window.google_tag_manager !== 'undefined' || !!document.querySelector('script[src*="googletagmanager.com/gtag/js"]'));
  console.log(`\n[GA4 ${vp.name}] gtag.js の読み込み=${loaded}（送信は遮断・計測 ID は出さない）／計測の送信先への通信 ${log.netCollect} 件（すべて遮断・記録）・中断の処理まで届いた通信 ${log.collectRequests} 件`);
  report.forEach(r => console.log(`  - ${r.phase}: page_view ${r.pageViews} 件 / 送ろうとしたイベント: ${r.hits.map(h => h.en).join(', ') || '（なし）'}`));
  results.push({ viewport: vp.name, id: 'GA4', name: 'GA4 の page_view（履歴の変更ごと）', ok: true, detail: JSON.stringify(report), ga4: report });
  await page.close();
}

(async () => {
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  console.log(`E2E（${LABEL}）: root=${ROOT}`);
  const browser = await launchBrowser();
  const vps = WHICH === 'both' ? [VIEWPORTS.mobile, VIEWPORTS.desktop] : [VIEWPORTS[WHICH]];
  try {
    for (const vp of vps) {
      console.log(`\n== ${vp.name} ==`);
      const before = results.length;
      if (GA4_HISTORY) {
        await scenarioGa4(browser, base, vp);
      } else {
        const scenarios = [scenarioDeepLink, scenarioBackForward, scenarioIdLess, scenarioScroll, scenarioCloseMethods, scenarioSwap, scenarioFilters, scenarioBadHashes]
          .filter(fn => !ONLY || fn.name.toLowerCase().includes(ONLY));
        for (const fn of scenarios) {
          try { await fn(browser, base, vp); } catch (e) { check(vp, fn.name, `${fn.name} が最後まで動いた`, false, String(e && e.stack || e).split('\n').slice(0, 3).join(' / ')); }
        }
      }
      results.slice(before).filter(r => r.id !== 'GA4').forEach(r => console.log(`${r.ok ? '✅' : '❌'} ${r.id} ${r.name}${r.ok ? '' : '\n     ' + r.detail}`));
    }
  } finally {
    await browser.close();
    server.close();
  }
  const checks = results.filter(r => r.id !== 'GA4');
  const failed = checks.filter(r => !r.ok);
  console.log(`\n合計 ${checks.length} 件中 ${checks.length - failed.length} 件通過・${failed.length} 件失敗（${LABEL}）`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ label: LABEL, root: path.basename(ROOT), results }, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
