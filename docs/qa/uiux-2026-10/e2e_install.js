// I-13（スプラッシュをやめる・ホーム画面への追加の案内を控えめにする）の実ブラウザ確認。
// index.html をローカルで配信し、headless Chrome（puppeteer）で、訪問の順（1回目・2回目・3回目）に確かめる。
// 使い方: node docs/qa/uiux-2026-10/e2e_install.js [--root <フォルダ>] [--viewport mobile|desktop|both] [--label <名前>] [--json <出力先>] [--shots <フォルダ>] [--headless auto|shell|new]
// - --root: 配信するフォルダ（既定: このリポジトリの直下）。改修前の index.html を置いたフォルダを渡すと、同じ確認が「前」でどうなるかを比べられる
// - --viewport: mobile = 390x844（タッチ）／desktop = 1280x900（既定は両方）。iOS の案内は iPhone の UA にして mobile だけで確かめる
// - --shots: 画面の写真（PNG）を残すフォルダ。無ければ撮らない
// - --only: シナリオ名の一部（例: sizes・ios）。指定したものだけ動かす
// 確かめること:
//   Android の案内は、実機では beforeinstallprompt で出る。headless Chrome では出ないので、同じ名前のイベントをページに送って確かめる（prompt()・userChoice は偽物）。
//   「訪問」は、同じブラウザの中で新しいタブを開くこと（localStorage は残り、sessionStorage は新しくなる）。
//   「サイトデータを拒否した端末」は、localStorage・sessionStorage の読み取りが例外を投げるようにして再現する。
// 外部への通信はすべて中断する（ローカルの配信だけで動く）。ページのエラー（pageerror）は全シナリオで見る。
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
const SHOTS = getOpt('--shots', '');
const HEADLESS = getOpt('--headless', 'auto');
const ONLY = getOpt('--only', ''); // シナリオ名の一部（例: sizes）。指定したものだけ動かす

const VIEWPORTS = {
  mobile: { name: 'mobile-390', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { name: 'desktop-1280', width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// 案内の大きさの目安（「小さな帯」）。Android の帯は1行〜2行、iOS は手順の2つを見せるので少し大きい
const LIMITS = { barHeight: 72, barHeightNarrow: 116, iosHeight: 240, desktopBarWidth: 520 };

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
async function waitFn(page, fn, arg, timeout) {
  try { await page.waitForFunction(fn, { timeout: timeout || 8000, polling: 50 }, arg); return true; } catch (e) { return false; }
}
const waitCatalog = page => waitFn(page, () => window.FULL_CATALOG_LOADED === true && window.ALL_STORES && window.ALL_STORES.length > 1000, null, 30000);

const results = [];
function check(vp, id, name, ok, detail) { results.push({ viewport: vp.name, id, name, ok: !!ok, detail: detail || '' }); }

// ── ページの開き方 ──
// o.ua: UA を替える／o.width・o.height: 画面の大きさを替える／o.deny: サイトデータを拒否した端末にする／o.standalone: ホーム画面から開いた状態（iOS）にする
async function openPage(ctx, base, vp, o) {
  o = o || {};
  const page = await ctx.newPage();
  await page.setViewport({ width: o.width || vp.width, height: o.height || vp.height, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  if (o.ua) await page.setUserAgent(o.ua);
  const log = { pageErrors: [], blocked: 0 };
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith(base) && /\/(sw\.js|manifest\.(json|webmanifest))(\?|$)/.test(u)) return req.respond({ status: 404, contentType: 'text/plain', body: 'not found' });
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') return req.continue();
    log.blocked++;
    return req.abort();
  });
  page.on('pageerror', e => log.pageErrors.push(String((e && e.message) || e).slice(0, 300)));
  page.__log = log;
  if (o.deny) {
    await page.evaluateOnNewDocument(() => {
      ['localStorage', 'sessionStorage'].forEach(k => {
        Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('Access is denied for this document.', 'SecurityError'); } });
      });
    });
  }
  if (o.standalone) {
    await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
  }
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  return page;
}

// Android の案内を出す合図（beforeinstallprompt）を送る。返り値: イベントの既定の動き（ブラウザ標準の案内）を止めたか
async function fireInstallEvent(page) {
  return page.evaluate(() => {
    const ev = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = () => { window.__promptCalled = (window.__promptCalled || 0) + 1; return Promise.resolve(); };
    ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
}

// 案内（#pwa-banner・#pwa-banner-ios）の今の状態
const barProbe = id => {
  const e = document.getElementById(id);
  if (!e) return null;
  const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  const text = e.querySelector('.pwa-banner-text');
  const tr = text ? text.getBoundingClientRect() : null;
  return {
    shown: cs.display !== 'none' && r.width > 0 && r.height > 0,
    x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    textH: tr ? Math.round(tr.height) : 0,
    vw: innerWidth, vh: innerHeight,
    overflowX: e.scrollWidth > e.clientWidth + 1,
    z: cs.zIndex,
  };
};
const barState = (page, id) => page.evaluate(barProbe, id);

// 全面をおおうものと、画面が固定されていないか
function overlayProbe() {
  const vw = innerWidth, vh = innerHeight, overlays = [];
  for (const el of document.querySelectorAll('body, body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (w * h >= 0.5 * vw * vh) overlays.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : '')) + ' ' + Math.round(w) + 'x' + Math.round(h));
  }
  const body = getComputedStyle(document.body), html = getComputedStyle(document.documentElement);
  return { splash: !!document.getElementById('nb-splash'), backdrop: !!document.getElementById('pwa-install-backdrop'), overlays, locked: body.overflow === 'hidden' || html.overflow === 'hidden', htmlClass: document.documentElement.className };
}

const rectOf = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s);
  if (!e) return null;
  const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) return null;
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, sel);
const overlap = (a, b) => (a && b) ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0;

async function shot(page, vp, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${vp.name}-${name}.png`) });
}

// 保存した店を作る（保存の中身は店名の配列。実物の getFavs が読む形）
const seedFavs = (page, n) => page.evaluate(n => { localStorage.setItem('nb_favs', JSON.stringify(Array.from({ length: n }, (_, i) => '確認用の店' + (i + 1)))); }, n);
const readKey = (page, k) => page.evaluate(k => { try { return localStorage.getItem(k); } catch (e) { return 'ERR'; } }, k);

// 案内が出る条件（2回目以降の訪問・保存が1件以上）まで進めて、2回目の訪問のページを返す。favs は1回目に保存した件数
async function secondVisit(browser, base, vp, favs, o) {
  const ctx = await browser.createBrowserContext();
  const p1 = await openPage(ctx, base, vp, o);
  if (favs) await seedFavs(p1, favs);
  await p1.close();
  const p2 = await openPage(ctx, base, vp, o);
  p2.__ctx = ctx;
  return p2;
}

// ── 1 初回の訪問: 全面をおおうものが無い・案内が出ない ──
async function scenarioFirst(browser, base, vp) {
  const ctx = await browser.createBrowserContext();
  const page = await openPage(ctx, base, vp);
  const o1 = await page.evaluate(overlayProbe);
  check(vp, 'I1-no-splash', `初回の最初の表示に、スプラッシュ・全面をおおうものが無い（スプラッシュ ${o1.splash ? 'あり' : 'なし'}・全面 ${o1.overlays.length}件・画面の固定 ${o1.locked ? 'あり' : 'なし'}）`,
    !o1.splash && o1.overlays.length === 0 && !o1.locked, JSON.stringify(o1));
  await sleep(300);
  const o2 = await page.evaluate(overlayProbe);
  check(vp, 'I1-no-splash-300ms', `300ms 後も同じ（全面 ${o2.overlays.length}件）`, !o2.splash && o2.overlays.length === 0 && !o2.locked, JSON.stringify(o2));
  await shot(page, vp, 'first-visit');
  const visits1 = await readKey(page, 'nb_visits');
  check(vp, 'I3-count-first', '1回目の訪問で、訪問回数（nb_visits）が 1', visits1 === '1', 'nb_visits=' + visits1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const visitsReload = await readKey(page, 'nb_visits');
  check(vp, 'I3-count-reload', '再読み込みでは訪問回数が増えない（同じタブのセッション）', visitsReload === '1', 'nb_visits=' + visitsReload);
  await waitCatalog(page);
  const prevented = await fireInstallEvent(page);
  await sleep(300);
  const st = await barState(page, 'pwa-banner');
  check(vp, 'I2-first-android', '初回は、Android の合図が来ても案内を出さない（標準の案内は今までどおり止める）', st && !st.shown && prevented === true, JSON.stringify({ st, prevented }));
  const o3 = await page.evaluate(overlayProbe);
  check(vp, 'I2-first-no-backdrop', '初回は、暗幕も出ない', !o3.backdrop && o3.overlays.length === 0, JSON.stringify(o3));
  check(vp, 'I2-first-error', '初回: ページのエラーが出ていない', page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' / '));
  await ctx.close();
}

// ── 2 2回目の訪問（Android）: 保存が無ければ出さない／あれば小さな帯で出す ──
async function scenarioSecondAndroid(browser, base, vp) {
  // 保存0件
  let page = await secondVisit(browser, base, vp, 0);
  const visits = await readKey(page, 'nb_visits');
  await waitCatalog(page);
  await fireInstallEvent(page);
  await sleep(300);
  let st = await barState(page, 'pwa-banner');
  check(vp, 'I4-second-no-saves', `2回目でも、保存が0件なら出さない（nb_visits=${visits}）`, visits === '2' && st && !st.shown, JSON.stringify(st));
  await page.__ctx.close();

  // 保存1件
  page = await secondVisit(browser, base, vp, 1);
  await waitCatalog(page);
  const prevented = await fireInstallEvent(page);
  await sleep(400);
  st = await barState(page, 'pwa-banner');
  const o = await page.evaluate(overlayProbe);
  await shot(page, vp, 'second-visit-android');
  const sane = st && st.shown && st.h <= LIMITS.barHeight && st.x >= 0 && st.x + st.w <= st.vw && st.y + st.h <= st.vh && !st.overflowX;
  check(vp, 'I5-show-bar', `2回目・保存1件で、小さな帯が出る（幅 ${st && st.w}・高さ ${st && st.h}。高さ ${LIMITS.barHeight}px 以内・画面の中・はみ出さない）`, sane && prevented === true, JSON.stringify(st));
  if (vp.isMobile) {
    check(vp, 'I5-bar-width-mobile', `スマホでは、画面の幅いっぱいに近い帯（幅 ${st && st.w}。縦長の箱にならない）`, st && st.w >= vp.width - 48, JSON.stringify(st));
  } else {
    check(vp, 'I5-bar-width-desktop', `広い画面では、1行に収まる（幅 ${st && st.w} ≤ ${LIMITS.desktopBarWidth}・文の高さ ${st && st.textH}）`, st && st.w <= LIMITS.desktopBarWidth && st.textH <= 30, JSON.stringify(st));
  }
  check(vp, 'I5-no-backdrop', '暗幕が無く、全面をおおうものが無い', !o.backdrop && o.overlays.length === 0, JSON.stringify(o));
  const cta = await rectOf(page, '.mobile-cta-bar'), fab = await rectOf(page, '#fb-fab'), top = await rectOf(page, '#scroll-top');
  const me = { x: st.x, y: st.y, w: st.w, h: st.h };
  check(vp, 'I5-no-overlap', '下の固定検索バー・ご意見ボタンに重ならない', overlap(me, cta) === 0 && overlap(me, fab) === 0 && overlap(me, top) === 0, JSON.stringify({ me, cta, fab, top }));
  const btnInstall = await rectOf(page, '#pwa-install-btn'), btnLater = await rectOf(page, '#pwa-dismiss');
  check(vp, 'I5-tap-targets', `「追加する」「後で」は、押しやすい大きさ（高さ ${btnInstall && Math.round(btnInstall.h)}・${btnLater && Math.round(btnLater.h)} ≥ 44px）`, btnInstall && btnLater && btnInstall.h >= 44 && btnLater.h >= 44, JSON.stringify({ btnInstall, btnLater }));
  const stored = await readKey(page, 'pwa-banner-dismissed');
  check(vp, 'I8-recorded-on-show', '出した時点で記録が残る（閉じずに離れても、2回目は出さない）', /^\d+$/.test(stored || ''), 'pwa-banner-dismissed=' + stored);

  // 案内が出ている間も、ページを操作できる
  await page.click('#si');
  await page.keyboard.type('焼肉');
  const typed = await page.evaluate(() => ({ v: document.getElementById('si').value, active: document.activeElement && document.activeElement.id }));
  check(vp, 'I6-operable-search', '案内が出ている間も、検索欄を押して文字を入れられる', typed.v === '焼肉' && typed.active === 'si', JSON.stringify(typed));
  await page.evaluate(() => { const si = document.getElementById('si'); si.value = ''; });

  // モーダル（店の詳細）は案内より上に出る（案内が予約ボタンをふさがない）
  await page.evaluate(() => { openM(0, 'grid'); });
  await sleep(900);
  const hit = await page.evaluate(() => {
    const b = document.getElementById('pwa-banner'), r = b.getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { inBar: !!(e && e.closest && e.closest('#pwa-banner')), tag: e ? e.tagName + '#' + e.id + '.' + e.className : null };
  });
  check(vp, 'I6-modal-above', '店の詳細（モーダル）を開くと、案内はその下に回る（予約ボタンをふさがない）', !hit.inBar, JSON.stringify(hit));
  await page.evaluate(() => { closeM(); });
  await sleep(400);

  if (vp.isMobile) {
    await page.evaluate(() => { if (typeof toggleNav === 'function') toggleNav(); });
    await sleep(500);
    const hit2 = await page.evaluate(() => {
      const b = document.getElementById('pwa-banner'), r = b.getBoundingClientRect();
      const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { inBar: !!(e && e.closest && e.closest('#pwa-banner')), tag: e ? e.tagName + '#' + e.id + '.' + e.className : null };
    });
    check(vp, 'I6-nav-above', 'メニュー（ナビ）を開くと、案内はその暗幕の下に回る', !hit2.inBar, JSON.stringify(hit2));
  }
  check(vp, 'I5-error', '2回目の訪問: ページのエラーが出ていない', page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' / '));
  await page.__ctx.close();
}

// ── 3 「後で」・追加する・出すのは1回 ──
async function scenarioButtons(browser, base, vp) {
  // 「後で」→ 記録 → 3回目は、合図が来ても出ない（Android の経路が記録を見る）
  const ctx = await browser.createBrowserContext();
  const p1 = await openPage(ctx, base, vp);
  await seedFavs(p1, 1);
  await p1.close();
  const p2 = await openPage(ctx, base, vp);
  await fireInstallEvent(p2);
  await sleep(300);
  let st = await barState(p2, 'pwa-banner');
  if (st && st.shown) {
    await p2.click('#pwa-dismiss');
    await sleep(200);
    st = await barState(p2, 'pwa-banner');
  }
  const rec = await readKey(p2, 'pwa-banner-dismissed');
  check(vp, 'I7-dismiss', '「後で」を押すと、案内が閉じて記録が残る', st && !st.shown && /^\d+$/.test(rec || ''), JSON.stringify({ st, rec }));
  await p2.close();
  const p3 = await openPage(ctx, base, vp);
  const v3 = await readKey(p3, 'nb_visits');
  await fireInstallEvent(p3);
  await sleep(300);
  const st3 = await barState(p3, 'pwa-banner');
  check(vp, 'I7-dismiss-honored-android', `3回目の訪問（nb_visits=${v3}）では、「後で」の記録を見て、合図が来ても出さない（Android の経路）`, v3 === '3' && st3 && !st3.shown, JSON.stringify(st3));
  await ctx.close();

  // 昔に「後で」を押した人（記録だけが残っている）にも出さない
  const ctx2 = await browser.createBrowserContext();
  const q1 = await openPage(ctx2, base, vp);
  await q1.evaluate(() => { localStorage.setItem('pwa-banner-dismissed', String(Date.now() - 30 * 24 * 3600 * 1000)); localStorage.setItem('nb_visits', '5'); localStorage.setItem('nb_favs', JSON.stringify(['確認用の店1'])); });
  await q1.close();
  const q2 = await openPage(ctx2, base, vp);
  await fireInstallEvent(q2);
  await sleep(300);
  const sq = await barState(q2, 'pwa-banner');
  check(vp, 'I7-old-record', '30日前に「後で」を押した記録がある人には、訪問が増えても出さない', sq && !sq.shown, JSON.stringify(sq));
  await ctx2.close();

  // 「追加する」: 標準の案内を呼び、帯を閉じる
  const p = await secondVisit(browser, base, vp, 1);
  await fireInstallEvent(p);
  await sleep(300);
  const shown = await barState(p, 'pwa-banner');
  if (shown && shown.shown) { await p.click('#pwa-install-btn'); await sleep(300); }
  const after = await barState(p, 'pwa-banner');
  const called = await p.evaluate(() => window.__promptCalled || 0);
  check(vp, 'I7-install-button', '「追加する」で標準の案内（prompt）を呼び、帯を閉じる', shown && shown.shown && called === 1 && after && !after.shown, JSON.stringify({ shown, called, after }));
  await p.__ctx.close();

  // 出すのは1回: 出しただけ（閉じずに離れた）でも、次の訪問では出さない
  const ctx3 = await browser.createBrowserContext();
  const r1 = await openPage(ctx3, base, vp);
  await seedFavs(r1, 1);
  await r1.close();
  const r2 = await openPage(ctx3, base, vp);
  await fireInstallEvent(r2);
  await sleep(300);
  const s2 = await barState(r2, 'pwa-banner');
  await r2.close();
  const r3 = await openPage(ctx3, base, vp);
  await fireInstallEvent(r3);
  await sleep(300);
  const s3 = await barState(r3, 'pwa-banner');
  check(vp, 'I8-once', '2回目に出して閉じずに離れても、3回目は出さない（出すのは1回）', s2 && s2.shown && s3 && !s3.shown, JSON.stringify({ second: s2 && s2.shown, third: s3 && s3.shown }));
  await ctx3.close();
}

// ── 4 実際の操作で: 1回目にカードを保存 → 2回目に案内 ──
async function scenarioJourney(browser, base, vp) {
  const ctx = await browser.createBrowserContext();
  const p1 = await openPage(ctx, base, vp);
  await waitCatalog(p1);
  await p1.evaluate(() => { const si = document.getElementById('si'); si.value = '焼肉'; applyFilters(); });
  const hasBtn = await waitFn(p1, () => !!document.querySelector('.card .fav-btn'), null, 8000);
  let favs = null;
  if (hasBtn) {
    await p1.evaluate(() => document.querySelector('.card .fav-btn').scrollIntoView({ block: 'center' }));
    await sleep(200);
    await p1.click('.card .fav-btn');
    await sleep(300);
    favs = await readKey(p1, 'nb_favs');
  }
  check(vp, 'I12-save-by-click', '1回目: カードのハートを押して、店を保存できる', !!favs && JSON.parse(favs).length === 1, 'nb_favs=' + favs);
  await p1.close();
  const p2 = await openPage(ctx, base, vp);
  await waitCatalog(p2);
  await fireInstallEvent(p2);
  await sleep(400);
  const st = await barState(p2, 'pwa-banner');
  check(vp, 'I12-journey', '2回目: 保存した店があるので、案内が出る', st && st.shown, JSON.stringify(st));
  await ctx.close();
}

// ── 5 サイトデータを拒否した端末 ──
async function scenarioDenied(browser, base, vp) {
  const ctx = await browser.createBrowserContext();
  const page = await openPage(ctx, base, vp, { deny: true });
  const okInit = await waitFn(page, () => document.querySelectorAll('.scene-tile, .card').length > 0, null, 10000);
  await fireInstallEvent(page);
  await sleep(400);
  const st = await barState(page, 'pwa-banner');
  check(vp, 'I10-denied-android', 'サイトデータを拒否した端末: 案内を出さない（覚えられないので）・ページは最後まで動く', okInit && st && !st.shown, JSON.stringify({ okInit, st }));
  const pwaErrors = page.__log.pageErrors.filter(m => /pwa|visit|Prompt|Banner|beforeinstall/i.test(m));
  check(vp, 'I10-denied-error', 'サイトデータを拒否した端末: 案内の部品がエラーを出さない', pwaErrors.length === 0, page.__log.pageErrors.join(' / '));
  await ctx.close();
}

// ── 6 iOS（iPhone の UA）。スマホだけ ──
async function scenarioIos(browser, base, vp) {
  const wait3 = () => sleep(3800);
  // 1回目: 3秒たっても出ない
  let ctx = await browser.createBrowserContext();
  let page = await openPage(ctx, base, vp, { ua: IOS_UA });
  await wait3();
  let st = await barState(page, 'pwa-banner-ios');
  let o = await page.evaluate(overlayProbe);
  check(vp, 'I9-ios-first', '初回は、3秒たっても案内を出さない（暗幕も出ない）', st && !st.shown && !o.backdrop && o.overlays.length === 0, JSON.stringify({ st, o }));
  await ctx.close();

  // 2回目・保存0件: 出さない
  page = await secondVisit(browser, base, vp, 0, { ua: IOS_UA });
  await wait3();
  st = await barState(page, 'pwa-banner-ios');
  check(vp, 'I9-ios-no-saves', '2回目でも、保存が0件なら出さない', st && !st.shown, JSON.stringify(st));
  await page.__ctx.close();

  // 2回目・保存1件: 出る
  page = await secondVisit(browser, base, vp, 1, { ua: IOS_UA });
  const appeared = await waitFn(page, () => getComputedStyle(document.getElementById('pwa-banner-ios')).display !== 'none', null, 6000);
  await sleep(300);
  st = await barState(page, 'pwa-banner-ios');
  o = await page.evaluate(overlayProbe);
  await shot(page, vp, 'second-visit-ios');
  const cta = await rectOf(page, '.mobile-cta-bar'), fab = await rectOf(page, '#fb-fab');
  const me = st ? { x: st.x, y: st.y, w: st.w, h: st.h } : null;
  check(vp, 'I9-ios-show', `2回目・保存1件で、3秒後に出る（高さ ${st && st.h} ≤ ${LIMITS.iosHeight}・画面の中）`, appeared && st && st.shown && st.h <= LIMITS.iosHeight && st.x >= 0 && st.x + st.w <= st.vw && st.y >= 0 && st.y + st.h <= st.vh, JSON.stringify(st));
  check(vp, 'I9-ios-no-backdrop', 'iOS も、暗幕が無く、全面をおおうものが無い', !o.backdrop && o.overlays.length === 0, JSON.stringify(o));
  check(vp, 'I9-ios-no-overlap', 'iOS も、下の固定検索バー・ご意見ボタンに重ならない', overlap(me, cta) === 0 && overlap(me, fab) === 0, JSON.stringify({ me, cta, fab }));
  const dr = await rectOf(page, '#pwa-banner-ios .dismiss');
  check(vp, 'I9-ios-dismiss-tap', `iOS の「後で」は、押しやすい大きさ（高さ ${dr && Math.round(dr.h)} ≥ 44px）`, dr && dr.h >= 44, JSON.stringify(dr));
  await page.click('#pwa-banner-ios .dismiss');
  await sleep(200);
  const st2 = await barState(page, 'pwa-banner-ios');
  const rec = await readKey(page, 'pwa-banner-dismissed');
  check(vp, 'I9-ios-dismiss', 'iOS の「後で」で閉じて、記録が残る', st2 && !st2.shown && /^\d+$/.test(rec || ''), JSON.stringify({ st2, rec }));
  const ctxD = page.__ctx;
  await page.close();
  const p3 = await openPage(ctxD, base, vp, { ua: IOS_UA });
  await wait3();
  const st3 = await barState(p3, 'pwa-banner-ios');
  check(vp, 'I9-ios-dismiss-honored', '3回目は、「後で」の記録を見て出さない（7日後の再表示もしない）', st3 && !st3.shown, JSON.stringify(st3));
  await ctxD.close();

  // 出すのは1回（iOS）
  ctx = await browser.createBrowserContext();
  const a1 = await openPage(ctx, base, vp, { ua: IOS_UA });
  await seedFavs(a1, 1);
  await a1.close();
  const a2 = await openPage(ctx, base, vp, { ua: IOS_UA });
  const shown2 = await waitFn(a2, () => getComputedStyle(document.getElementById('pwa-banner-ios')).display !== 'none', null, 6000);
  await a2.close();
  const a3 = await openPage(ctx, base, vp, { ua: IOS_UA });
  await wait3();
  const s3 = await barState(a3, 'pwa-banner-ios');
  check(vp, 'I9-ios-once', '2回目に出して閉じずに離れても、3回目は出さない', shown2 && s3 && !s3.shown, JSON.stringify({ shown2, third: s3 && s3.shown }));
  await ctx.close();

  // ホーム画面から開いたとき（standalone）は出さない
  const sp = await secondVisit(browser, base, vp, 1, { ua: IOS_UA, standalone: true });
  await wait3();
  const ss = await barState(sp, 'pwa-banner-ios');
  check(vp, 'I11-ios-standalone', 'ホーム画面から開いたとき（standalone）は、条件を満たしても出さない', ss && !ss.shown, JSON.stringify(ss));
  await sp.__ctx.close();

  // サイトデータを拒否した iOS
  ctx = await browser.createBrowserContext();
  const dp = await openPage(ctx, base, vp, { ua: IOS_UA, deny: true });
  await wait3();
  const ds = await barState(dp, 'pwa-banner-ios');
  const initOk = await dp.evaluate(() => document.querySelectorAll('.scene-tile, .card').length > 0);
  check(vp, 'I10-denied-ios', 'サイトデータを拒否した iOS: 案内を出さない・ページは最後まで動く', ds && !ds.shown && initOk, JSON.stringify({ ds, initOk }));
  await ctx.close();
}

// ── 7 いろいろな画面の大きさ（スマホだけ）。案内が画面の中に収まり、文が文節の途中で割れない ──
async function scenarioSizes(browser, base, vp) {
  const sizes = [{ w: 320, h: 568 }, { w: 360, h: 640 }, { w: 375, h: 667 }, { w: 414, h: 896 }, { w: 430, h: 932 }, { w: 844, h: 390 }];
  for (const s of sizes) {
    const page = await secondVisit(browser, base, vp, 1, { width: s.w, height: s.h });
    await fireInstallEvent(page);
    await sleep(400);
    const st = await barState(page, 'pwa-banner');
    const phrases = await page.evaluate(() => Array.from(document.querySelectorAll('#pwa-banner .pwa-banner-text > span')).map(e => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height) }; }));
    const cta = await rectOf(page, '.mobile-cta-bar'), fab = await rectOf(page, '#fb-fab');
    const me = st ? { x: st.x, y: st.y, w: st.w, h: st.h } : null;
    const brokenPhrase = phrases.some(p => p.h > 24); // 1つの文節が2行になっていたら、途中で割れている
    // 幅が 360px 以上なら1行（高さ 72px 以内）。それより狭いと、ボタンが次の行に回る（2行ぶん）
    const maxH = s.w >= 360 ? LIMITS.barHeight + 4 : LIMITS.barHeightNarrow;
    const inside = st && st.shown && st.x >= 0 && st.x + st.w <= st.vw && st.y >= 0 && st.y + st.h <= st.vh && !st.overflowX && st.h <= maxH;
    check(vp, `I13-size-${s.w}x${s.h}`, `${s.w}x${s.h}: 帯が画面の中に収まり（高さ ${st && st.h}）・文節の途中で割れず・固定検索バー/ご意見ボタンに重ならない`,
      inside && !brokenPhrase && overlap(me, cta) === 0 && overlap(me, fab) === 0, JSON.stringify({ st, phrases, cta, fab }));
    await shot(page, vp, `size-${s.w}x${s.h}`);
    await page.__ctx.close();
  }
  // iOS の案内も、小さい画面で画面の中に収まる
  for (const s of [{ w: 320, h: 568 }, { w: 844, h: 390 }]) {
    const page = await secondVisit(browser, base, vp, 1, { width: s.w, height: s.h, ua: IOS_UA });
    await waitFn(page, () => getComputedStyle(document.getElementById('pwa-banner-ios')).display !== 'none', null, 6000);
    await sleep(300);
    const st = await barState(page, 'pwa-banner-ios');
    const reach = await page.evaluate(() => { const b = document.querySelector('#pwa-banner-ios .dismiss'); if (!b) return null; const r = b.getBoundingClientRect(); const box = document.getElementById('pwa-banner-ios').getBoundingClientRect(); return { dismissInside: r.top >= box.top - 1 && r.bottom <= box.bottom + 1 || document.getElementById('pwa-banner-ios').scrollHeight > document.getElementById('pwa-banner-ios').clientHeight }; });
    check(vp, `I13-ios-size-${s.w}x${s.h}`, `iOS の案内 ${s.w}x${s.h}: 画面の中に収まる（収まらなければ中でスクロールできる）`,
      st && st.shown && st.x >= 0 && st.x + st.w <= st.vw && st.y >= 0 && st.y + st.h <= st.vh && reach && reach.dismissInside, JSON.stringify({ st, reach }));
    await page.__ctx.close();
  }
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  console.log(`配信: ${ROOT} → ${base}（ラベル: ${LABEL}）`);
  const browser = await launchBrowser();
  const vps = WHICH === 'mobile' ? [VIEWPORTS.mobile] : WHICH === 'desktop' ? [VIEWPORTS.desktop] : [VIEWPORTS.mobile, VIEWPORTS.desktop];
  try {
    for (const vp of vps) {
      console.log(`\n── ${vp.name} ──`);
      const fns = [scenarioFirst, scenarioSecondAndroid, scenarioButtons, scenarioJourney, scenarioDenied];
      if (vp.isMobile) fns.push(scenarioIos, scenarioSizes);
      for (const fn of fns.filter(f => !ONLY || f.name.toLowerCase().includes(ONLY.toLowerCase()))) {
        const before = results.length;
        try { await fn(browser, base, vp); } catch (e) { check(vp, 'EXC-' + fn.name, fn.name + ' で例外', false, String((e && e.stack) || e).slice(0, 400)); }
        for (const r of results.slice(before)) console.log(`${r.ok ? '✅' : '❌'} ${r.id} ${r.name}${r.ok ? '' : '\n     ' + r.detail}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n合計 ${results.length} 件中 ${pass} 件通過・${fail} 件失敗（${LABEL}）`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ label: LABEL, root: ROOT, results }, null, 1));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(2); });
