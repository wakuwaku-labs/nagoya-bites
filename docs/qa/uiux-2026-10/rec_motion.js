// 動きの前後を動画（mp4・GIF）に撮る道具（動きの計画 8.3 節）。
// 使い方: node docs/qa/uiux-2026-10/rec_motion.js --root <配信するフォルダ> --label before|after --out-dir <出力先> [--only load,hover,sheet,quickview,fav,scroll,press,presslist,wait,count,sheetwait,sheetclose,qvclose,landed,viewmode]
// 場面: load（読み込み直後 3 秒）/ hover（1280 のみ・カードにマウス）/ sheet（絞り込みシート）/ quickview / fav（♡）/ scroll（下へ→上へ戻るボタン）。
// 段階 2・3a の場面（--only で選ぶ。既定には入れない）: press（トップの押せる物を押したまま 0.7 秒→外で離す）/ presslist（一覧のカード・♡・予約・条件の札・ページ番号）/
//   wait（現在地。位置の返事を 2.5 秒遅らせる）/ count（シートでチップ→「N軒を見る」→条件の札の × で件数が変わる。指で操作する）/
//   sheetwait（全店のデータ data/stores.json の返事を止めたままシートを開き、3 秒後に返す）。
// 段階 3b の場面（--only で選ぶ。既定には入れない・判断の記録 0050）: sheetclose（シートを開く→×→開く→背景で閉じる）/ qvclose（クイックビューを開く→×→開く→Esc）/
//   landed（シートで条件を選び「N軒を見る」→結果の先頭が光る→「次へ」で先頭の店が光る）/ viewmode（グリッド⇄リスト）。
// 出力: <label>-<幅>-<場面>.{webm,mp4,gif} と index-<label>.json。外部の画像は読み込む。GA4 だけ中断。「動きを減らす」は付けない。
// puppeteer の page.screencast（ffmpeg 要）で録画し、ffmpeg で mp4（H.264・yuv420p）と GIF（15fps・390 は幅 390・1280 は幅 800）にする。
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');

const argv = process.argv.slice(2);
const getOpt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const ROOT = path.resolve(getOpt('--root', path.join(__dirname, '..', '..', '..')));
const LABEL = getOpt('--label', 'before');
const OUT = path.resolve(getOpt('--out-dir', path.join(__dirname, 'motion-rec')));
const ONLY = getOpt('--only', 'load,hover,sheet,quickview,fav,scroll').split(',');
const FFMPEG = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const LIST_HASH = '#q=%E5%B1%85%E9%85%92%E5%B1%8B';
const BLANK = 'data:text/html;charset=utf-8,' + encodeURIComponent('<meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#fff"></body>');

const VPS = [
  { w: 390, h: 823, deviceScaleFactor: 2, isMobile: true, hasTouch: true, gifW: 390 },
  { w: 1280, h: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false, gifW: 800 },
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    try { return await puppeteer.launch({ headless: m, args: ['--no-sandbox', '--disable-gpu'], protocolTimeout: 120000 }); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function openPage(browser, base, vp) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  page.__holdRe = null;   // 場面の setup が正規表現を入れると、当たるリクエストを止めて page.__held に貯める（page.__release() で流す）
  page.__held = [];
  page.__release = () => { const h = page.__held.splice(0); page.__holdRe = null; h.forEach(r => r.continue().catch(() => {})); return h.length; };
  page.on('request', req => {
    const u = req.url();
    if (page.__holdRe && page.__holdRe.test(u)) { page.__held.push(req); return; }
    if (u.startsWith(base) && /\/(sw\.js|manifest\.(json|webmanifest))(\?|$)/.test(u)) return req.respond({ status: 404, contentType: 'text/plain', body: 'not found' });
    if (/googletagmanager\.com|google-analytics\.com|analytics\.google\.com/.test(u)) return req.abort();
    return req.continue();
  });
  return { ctx, page };
}

async function waitFn(page, fn, arg, timeout) {
  try { await page.waitForFunction(fn, { timeout: timeout || 10000, polling: 50 }, arg); return true; } catch (e) { return false; }
}
const waitCatalog = page => waitFn(page, () => window.FULL_CATALOG_LOADED === true && window.ALL_STORES && window.ALL_STORES.length > 1000, null, 60000);
async function waitImages(page) {
  await page.evaluate(() => Promise.all(Array.from(document.images).filter(i => !i.complete && i.getBoundingClientRect().top < innerHeight * 2).slice(0, 30).map(i => new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000); })))).catch(() => {});
}

// 要素を画面中央へ即時スクロールして中心座標を返す
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
// 録画の間、右下の 1px を毎フレーム描き直す（見た目はほぼ変わらない）。page.screencast は画面が変わったときにしか
// コマを送らず、動きの最後のコマ（例: 閉じたシートが消えた画面）が届かないまま、途中のコマが最後まで残ることがあった（段階 3b）
async function keepPainting(page) {
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__rec_tick';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;pointer-events:none;z-index:2147483647;background:rgb(250,250,250);';
    document.documentElement.appendChild(d);
    let on = false;
    const f = () => { if (!d.isConnected) return; on = !on; d.style.backgroundColor = on ? 'rgb(251,251,251)' : 'rgb(250,250,250)'; requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
}
async function tap(page, vp, pt) {
  if (vp.hasTouch) await page.touchscreen.tap(pt.x, pt.y); else { await page.mouse.move(pt.x, pt.y, { steps: 12 }); await sleep(150); await page.mouse.click(pt.x, pt.y); }
}
// カード写真の真ん中（ボタンでない所。題名リンクが伸びてカード全体を覆うが、ふつうのクリックは nbCardClick がクイックビューを開く）
async function cardPhotoPoint(page) {
  return page.evaluate(() => {
    const cards = document.querySelectorAll('#grid .card');
    for (let i = 0; i < cards.length; i++) {
      const ci = cards[i].querySelector('.ci') || cards[i];
      ci.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = ci.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        if (hit && cards[i].contains(hit) && !hit.closest('button, .fav-btn')) return { x, y };
      }
    }
    return null;
  });
}

async function gotoList(page, base) {
  await page.goto(base + '/index.html' + LIST_HASH, { waitUntil: 'load', timeout: 60000 });
  await waitCatalog(page);
  await waitFn(page, () => document.querySelectorAll('#grid .card').length > 0, null, 20000);
  await sleep(1000);
  await waitImages(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(500);
}
async function gotoTop(page, base) {
  await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 60000 });
  await waitCatalog(page);
  await sleep(2500); // 前（段階 1 の前）の入場の動きが終わるのを待つ
  await waitImages(page);
}

// 押したまま 0.7 秒止めてから、要素の外で離す（クリックの処理は走らせない）。見つからない要素は飛ばして記録する
function holdFn(page, vp, ctx) {
  return async (name, sel) => {
    const pt = await centerOf(page, sel);
    if (!pt) { ctx.skipped.push(name + ': 要素が見つからない（' + sel + '）'); return; }
    await page.mouse.move(pt.x, pt.y, { steps: 8 });
    await sleep(400);
    await page.mouse.down();
    await sleep(700);
    await page.mouse.move(3, Math.round(vp.h / 2), { steps: 2 });
    await page.mouse.up();
    await sleep(800);
  };
}

// ── 場面 ──  setup は録画の前（準備）、run は録画の中。setup が false を返したら場面ごと失敗にする
const SCENES = {
  load: {
    vps: [0, 1],
    // 白紙から始める。about:blank はスマホの表示で幅 980 の画面になり、録画の大きさがそれに固定されて
    // 画面が左上に小さく写るので、幅を端末に合わせた白紙を使う
    async setup(page) { await page.goto(BLANK); },
    async run(page, vp, base, ctx) {
      await page.goto(BLANK);
      await sleep(300);
      page.goto(base + '/index.html', { waitUntil: 'load', timeout: 60000 }).catch(() => {});
      await sleep(3000);
    },
  },
  hover: {
    vps: [1],
    async setup(page, vp, base) { await gotoList(page, base); },
    async run(page, vp, base, ctx) {
      const skipped = ctx.skipped;
      const hoverOne = async (name, sel, hash) => {
        const pt = await centerOf(page, sel);
        if (!pt) { skipped.push(name + ': 要素が見つからない（' + sel + '）'); return; }
        await page.mouse.move(Math.max(5, pt.x - 300), Math.max(5, pt.y - 200), { steps: 5 });
        await sleep(500);
        await page.mouse.move(pt.x, pt.y, { steps: 25 });
        await sleep(1200);
        await page.mouse.move(Math.max(5, pt.x - 300), Math.max(5, pt.y - 200), { steps: 25 });
        await sleep(700);
      };
      await hoverOne('店のカード', '#grid .card .ci');
      // トップ（ハッシュ無し）へ
      await gotoTop(page, base);
      await hoverOne('特集カード', '.feature-card');
      await hoverOne('今日の話題店の写真', '.tp-card');
      await hoverOne('最新ジャーナルのカード', '.latest-journal-card');
    },
  },
  sheet: {
    vps: [0, 1],
    async setup(page, vp, base) { await gotoList(page, base); },
    async run(page, vp, base, ctx) {
      const open = await centerOf(page, '#tb-filter-btn, #filter-toggle-btn, .cta-filter');
      if (!open) throw new Error('絞り込みボタンが見つからない');
      await sleep(600);
      await tap(page, vp, open);
      await waitFn(page, () => document.getElementById('filter-sheet-wrap').classList.contains('open') && document.querySelector('#filter-sheet .fs-chip'), null, 5000);
      await sleep(900);
      // 選んでいないチップを 2 つ、続けて選ぶ（✓ と「N軒を見る」を見せる）
      for (let i = 0; i < 2; i++) {
        const chip = await centerOf(page, '#filter-sheet .fs-chip[aria-pressed="false"]', '#filter-sheet');
        if (!chip) { ctx.skipped.push('チップ ' + (i + 1) + ' が見つからない'); break; }
        await tap(page, vp, chip);
        await sleep(1300);
      }
      await page.evaluate(() => { if (typeof nbCloseFilterSheet === 'function') nbCloseFilterSheet(); });
      await sleep(900);
    },
  },
  quickview: {
    vps: [0, 1],
    async setup(page, vp, base) { await gotoList(page, base); },
    async run(page, vp, base) {
      const pt = await cardPhotoPoint(page);
      if (!pt) throw new Error('カード写真が見つからない');
      await sleep(600);
      await tap(page, vp, pt);
      const ok = await waitFn(page, () => document.getElementById('ov').classList.contains('open'), null, 4000);
      if (!ok) throw new Error('クイックビューが開かなかった');
      await sleep(1500);
      await page.evaluate(() => closeM());
      await sleep(900);
    },
  },
  fav: {
    vps: [0, 1],
    async setup(page, vp, base) { await gotoList(page, base); },
    async run(page, vp, base) {
      const pt = await centerOf(page, '#grid .fav-btn');
      if (!pt) throw new Error('♡が見つからない');
      await sleep(700);
      await tap(page, vp, pt);
      await sleep(1100);
      await tap(page, vp, pt);
      await sleep(1000);
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* なし */ } });
    },
  },
  // ── 段階 2（P-490）の場面 ──
  press: {
    vps: [0, 1],
    async setup(page, vp, base) { await gotoTop(page, base); },
    async run(page, vp, base, ctx) {
      // 押したまま止めて「沈む・色が濃くなる」を見せ、外で離す（クリックの処理は走らせない）
      const hold = holdFn(page, vp, ctx);
      await hold('検索ボタン', '.search-wrap button');
      await hold('シーンのタイル', '.scene-tile');
      await hold('特集カード', '.feature-card');
      await hold('今日の話題店の写真', '.tp-card');
      await hold('最新ジャーナルのカード', '.latest-journal-card');
    },
  },
  presslist: {
    vps: [0, 1],
    async setup(page, vp, base) { await gotoList(page, base); },
    async run(page, vp, base, ctx) {
      const hold = holdFn(page, vp, ctx);
      await hold('店のカード（写真）', '#grid .card .ci');
      await hold('カードの ♡', '#grid .fav-btn');
      await hold('カードの予約ボタン', '#grid .card-cta a');
      await hold('条件の札', '#active-chips .chip, .chip[data-clear]');
      await hold('ページ番号', '.pg-btn:not(.active):not(:disabled)');
    },
  },
  wait: {
    vps: [0, 1],
    async setup(page, vp, base) {
      await gotoList(page, base);
      // 位置の返事を 2.5 秒遅らせる（録画のためだけの差し替え。サイトの動きは変えない）
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
          getCurrentPosition: (ok) => setTimeout(() => ok({ coords: { latitude: 35.1709, longitude: 136.8815 } }), 2500),
        } });
      });
    },
    async run(page, vp) {
      // 「現在地」は追従の検索バー（下へ進んで最初の検索欄が隠れると出る）の中にある
      await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' }));
      const shown = await waitFn(page, () => document.getElementById('sticky-search').classList.contains('visible'), null, 3000);
      if (!shown) throw new Error('追従の検索バーが出なかった');
      await sleep(600);
      const pt = await page.evaluate(() => {
        const r = document.getElementById('geo-btn').getBoundingClientRect();
        return r.width > 0 && r.height > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      });
      if (!pt) throw new Error('現在地のボタンが見えない');
      await tap(page, vp, pt);
      await sleep(3800);
    },
  },
  count: {
    vps: [0, 1],
    async setup(page, vp, base) { await gotoList(page, base); },
    async run(page, vp, base, ctx) {
      // 件数の動きは「触ってから 1 秒の間」の変化だけなので、関数を直接呼ばずに指（マウス）で操作する
      const pickAndGo = async () => {
        const open = await centerOf(page, '#tb-filter-btn, #filter-toggle-btn, .cta-filter');
        if (!open) throw new Error('絞り込みボタンが見つからない');
        await tap(page, vp, open);
        await waitFn(page, () => document.getElementById('filter-sheet-wrap').classList.contains('open') && document.querySelector('#filter-sheet .fs-chip'), null, 5000);
        await sleep(700);
        const chip = await centerOf(page, '#filter-sheet .fs-chip[aria-pressed="false"]', '#filter-sheet');
        if (!chip) throw new Error('チップが見つからない');
        await tap(page, vp, chip);
        await sleep(900);
        const go = await page.evaluate(() => { const r = document.getElementById('fs-go').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        await tap(page, vp, go);
        await sleep(1600);
      };
      await sleep(500);
      await pickAndGo();
      await pickAndGo();
      // 条件の札の × で 1 つ外す（件数が増える）
      const x = await centerOf(page, '#active-chips .chip[data-clear], .chip[data-clear]');
      if (x) { await tap(page, vp, x); await sleep(1600); } else ctx.skipped.push('条件の札が見つからない');
    },
  },
  sheetwait: {
    vps: [0, 1],
    async setup(page, vp, base) {
      // 全店のデータの返事を止めたまま、先頭の店だけで一覧を出す（録画のためだけの差し止め。サイトの動きは変えない）
      page.__holdRe = /\/data\/stores\.json(\?|$)/;
      await page.goto(base + '/index.html' + LIST_HASH, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const ok = await waitFn(page, () => document.querySelectorAll('#grid .card').length > 0, null, 20000);
      if (!ok) return false;
      await sleep(1500);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await sleep(300);
    },
    async run(page, vp) {
      const open = await centerOf(page, '#tb-filter-btn, #filter-toggle-btn, .cta-filter');
      if (!open) throw new Error('絞り込みボタンが見つからない');
      await sleep(500);
      await tap(page, vp, open);
      await waitFn(page, () => document.getElementById('filter-sheet-wrap').classList.contains('open'), null, 5000);
      await sleep(3000);
      const n = page.__release();
      if (!n) throw new Error('全店のデータのリクエストを止められなかった');
      await waitFn(page, () => window.FULL_CATALOG_LOADED === true, null, 30000);
      await sleep(1800);
    },
  },
  scroll: {
    vps: [0, 1],
    async setup(page, vp, base) { await gotoList(page, base); },
    async run(page, vp, base) {
      await sleep(500);
      await page.evaluate(() => new Promise(res => {
        let n = 0;
        (function step() { window.scrollBy(0, 40); n++; if (n < 100) requestAnimationFrame(step); else res(); })();
      }));
      await sleep(700);
      const ok = await waitFn(page, () => document.getElementById('scroll-top').classList.contains('visible'), null, 3000);
      if (!ok) throw new Error('上へ戻るボタンが出なかった');
      const pt = await centerOf(page, '#scroll-top');
      if (!pt) throw new Error('上へ戻るボタンが見つからない');
      await tap(page, vp, pt); // #scroll-top は position:fixed なので、centerOf の scrollIntoView は位置を動かさない
      await sleep(1800);
    },
  },
  // ── 段階 3b（P-500・判断の記録 0050）の場面 ──
  sheetclose: {
    vps: [0, 1],
    async setup(page, vp, base) { await gotoList(page, base); },
    async run(page, vp) {
      const openSheet = async () => {
        const open = await centerOf(page, '#tb-filter-btn, #filter-toggle-btn, .cta-filter');
        if (!open) throw new Error('絞り込みボタンが見つからない');
        await tap(page, vp, open);
        const ok = await waitFn(page, () => document.getElementById('filter-sheet-wrap').classList.contains('open'), null, 5000);
        if (!ok) throw new Error('シートが開かなかった');
      };
      await sleep(600);
      await openSheet();
      await sleep(1000);
      const x = await centerOf(page, '#fs-close', '#filter-sheet');
      if (!x) throw new Error('× が見つからない');
      await tap(page, vp, x);
      await sleep(1100);
      await openSheet();
      await sleep(1000);
      // 背景（暗幕）のうち、シートに覆われていない所を押す
      const bd = await page.evaluate(() => {
        const sh = document.getElementById('filter-sheet').getBoundingClientRect();
        const pts = [[innerWidth / 2, Math.max(20, sh.top / 2)], [Math.max(20, sh.left / 2), innerHeight / 2]];
        for (const [x, y] of pts) { const h = document.elementFromPoint(x, y); if (h && h.id === 'fs-backdrop') return { x, y }; }
        return null;
      });
      if (!bd) throw new Error('背景の押せる所が無い');
      await tap(page, vp, bd);
      await sleep(1200);
    },
  },
  qvclose: {
    vps: [0, 1],
    async setup(page, vp, base) { await gotoList(page, base); },
    async run(page, vp) {
      const openQv = async () => {
        const pt = await cardPhotoPoint(page);
        if (!pt) throw new Error('カード写真が見つからない');
        await tap(page, vp, pt);
        const ok = await waitFn(page, () => document.getElementById('ov').classList.contains('open'), null, 4000);
        if (!ok) throw new Error('クイックビューが開かなかった');
      };
      await sleep(600);
      await openQv();
      await sleep(1300);
      const x = await page.evaluate(() => {
        const b = document.querySelector('#ov .mcl-close');
        const r = b && b.getBoundingClientRect();
        return r && r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      });
      if (!x) throw new Error('× が見つからない');
      await tap(page, vp, x);
      await sleep(1100);
      await openQv();
      await sleep(1300);
      await page.keyboard.press('Escape');
      await sleep(1200);
    },
  },
  landed: {
    vps: [0, 1],
    async setup(page, vp, base) { await gotoList(page, base); },
    async run(page, vp) {
      await sleep(500);
      const open = await centerOf(page, '#tb-filter-btn, #filter-toggle-btn, .cta-filter');
      if (!open) throw new Error('絞り込みボタンが見つからない');
      await tap(page, vp, open);
      await waitFn(page, () => document.getElementById('filter-sheet-wrap').classList.contains('open') && document.querySelector('#filter-sheet .fs-chip'), null, 5000);
      await sleep(800);
      // 最初のチップ（居酒屋の検索に足すので、多くは 1 ページを超え「次へ」も見せられる）
      const chip = await centerOf(page, '#filter-sheet .fs-chip', '#filter-sheet');
      if (!chip) throw new Error('チップが見つからない');
      await tap(page, vp, chip);
      await sleep(700);
      const go = await centerOf(page, '#fs-go', '#filter-sheet');
      if (!go) throw new Error('「N軒を見る」が見つからない');
      await tap(page, vp, go);
      await sleep(2200);   // 閉じる→結果の先頭へ→光る
      // ページの下の「次へ」まで即時に下り、押す→先頭の店へ戻って光る
      const next = await centerOf(page, '#pagination .pg-nav[aria-label="次のページ"]:not([disabled])');
      if (!next) { /* 1 ページしか無い条件なら飛ばす */ return; }
      await sleep(700);
      await tap(page, vp, next);
      await sleep(2400);
    },
  },
  viewmode: {
    vps: [0, 1],
    async setup(page, vp, base) {
      await gotoList(page, base);
      // 一覧の先頭が見える所へ（切り替えのボタンも見える）
      await page.evaluate(() => { const t = document.getElementById('view-toggle'); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 140, behavior: 'instant' }); });
      await sleep(600);
      await waitImages(page);
    },
    async run(page, vp) {
      const isList = await page.evaluate(() => document.getElementById('grid').classList.contains('list-mode'));
      const order = isList ? ['#vt-grid', '#vt-list'] : ['#vt-list', '#vt-grid'];
      await sleep(700);
      for (const sel of order.concat(order)) {
        const pt = await page.evaluate((sel) => {
          const r = document.querySelector(sel).getBoundingClientRect();
          return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
        }, sel);
        if (!pt) throw new Error('切り替えのボタンが見えない: ' + sel);
        await tap(page, vp, pt);
        await sleep(1300);
      }
      await page.evaluate(() => { try { localStorage.removeItem('nb_view'); } catch (e) { /* なし */ } });
    },
  },
};

function ffmpeg(args) { execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] }); }
function convert(webm, mp4, gif, gifW) {
  ffmpeg(['-i', webm, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  ffmpeg(['-i', webm, '-vf', `fps=15,scale=${gifW}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, gif]);
}

(async () => {
  const t0 = Date.now();
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await launchBrowser();
  const index = { label: LABEL, root: ROOT, startedAt: new Date().toISOString(), files: [], scenes: [] };
  try {
    for (const vp of VPS) {
      for (const name of Object.keys(SCENES)) {
        if (!ONLY.includes(name)) continue;
        const sc = SCENES[name];
        const rec = { scene: name, width: vp.w, ok: false, skipped: [] };
        if (!sc.vps.includes(VPS.indexOf(vp))) { rec.skippedReason = vp.w + ' では撮らない場面'; index.scenes.push(rec); continue; }
        const base_name = `${LABEL}-${vp.w}-${name}`;
        const webm = path.join(OUT, base_name + '.webm');
        // 失敗した場面は 1 回だけ撮り直す（読み込みの順の揺れで、たまにボタンが出る前に時間切れになるため）
        for (let attempt = 1; attempt <= 2 && !rec.ok; attempt++) {
          rec.skipped = [];
          const { ctx, page } = await openPage(browser, base, vp);
          try {
            await sc.setup(page, vp, base);
            const recorder = await page.screencast({ path: webm });
            await keepPainting(page).catch(() => {});
            await sleep(300);
            try { await sc.run(page, vp, base, { skipped: rec.skipped }); } finally { await sleep(600); await recorder.stop(); }
            const mp4 = path.join(OUT, base_name + '.mp4'), gif = path.join(OUT, base_name + '.gif');
            convert(webm, mp4, gif, vp.gifW);
            rec.ok = true;
            rec.attempts = attempt;
            delete rec.error;
            rec.files = [mp4, gif].map(f => ({ path: f, bytes: fs.statSync(f).size }));
            index.files.push(...rec.files);
            console.log('OK  ' + base_name + '  gif ' + (rec.files[1].bytes / 1048576).toFixed(2) + 'MB' + (attempt > 1 ? '  （撮り直し ' + attempt + ' 回目）' : '') + (rec.skipped.length ? '  飛ばし: ' + rec.skipped.join(' / ') : ''));
          } catch (e) {
            rec.error = String((e && e.message) || e).slice(0, 300);
            console.log((attempt < 2 ? 'やり直し  ' : 'NG  ') + base_name + ': ' + rec.error);
          } finally { await ctx.close().catch(() => {}); }
        }
        index.scenes.push(rec);
      }
    }
  } finally { await browser.close().catch(() => {}); server.close(); }
  index.seconds = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(OUT, `index-${LABEL}.json`), JSON.stringify(index, null, 2) + '\n');
  console.log(`完了 ${index.seconds}s  成功 ${index.scenes.filter(s => s.ok).length}/${index.scenes.filter(s => !s.skippedReason).length}`);
})().catch(e => { console.error(e); process.exit(2); });
