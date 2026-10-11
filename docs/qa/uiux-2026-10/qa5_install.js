// I-13（ホーム画面への追加の案内）の Designer QA-5 の証跡（agents/designer.md の QA-5 チェックリストのうち、案内そのものに当たる項目）。
// index.html をローカルで配信し、headless Chrome（puppeteer）で、案内（Android の帯 #pwa-banner・iOS のカード #pwa-banner-ios）を実際に出して、375 / 768 / 1280 の幅で測る。
// 使い方: node docs/qa/uiux-2026-10/qa5_install.js [--root <フォルダ>] [--label <名前>] [--json <出力先>] [--only android|ios]
// - --root: 配信するフォルダ（既定: このリポジトリの直下）。別のフォルダ（改修前の木など）を渡せば、同じ測定を比べられる
// 測ること（判定の基準は data/design_system.json と agents/designer.md）:
//   Q1 画面の中に収まる／Q2 案内が出ても、ページの横スクロールが増えない／Q3 文字が 12px 未満のものが無い（床）／Q4 読む文字は 13px 以上（装飾を除く）
//   Q5 文字のコントラスト 4.5:1 以上（背景の透け・半透明の文字色は合成してから計算。装飾を除く）／Q6 押せるものが 44px 以上（幅・高さ）
//   Q7 下の固定検索バー・ご意見ボタン・上へ戻るに重ならない／Q8 重なり順（モーダル・ご意見・上へ戻る・トースト・ナビの暗幕より下）
//   Q9 押せるものに名前がある／Q10 キーボードの Tab で届き、フォーカスの輪が見える／Q11（参考）フォーカスの輪と周りの色の差／Q12 出てもフォーカスを奪わない
//   Q13 動き（animation）が無い／Q14 日本語の文字に DM Mono（等幅）を使っていない（agents/designer.md の「やってはいけないこと」）
// 外部への通信はすべて中断する（ローカルの配信だけで動く。GA4 にも送らない）。ページのエラー（pageerror）も数える。
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
const LABEL = getOpt('--label', 'after');
const JSON_OUT = getOpt('--json', '');
const ONLY = getOpt('--only', '');

const VIEWPORTS = [
  { name: '375', width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: '768', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: '1280', width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
// 基準（data/design_system.json の floorPx・readablePx・agents/designer.md の 44px・WCAG の通常の文字 4.5:1）
const FLOOR_PX = 12, READABLE_PX = 13, TAP_MIN = 44, CONTRAST_MIN = 4.5, RING_CONTRAST_REF = 3;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json',
};

async function launchBrowser() {
  let lastErr;
  for (const m of ['shell', true]) {
    try { return await puppeteer.launch({ headless: m, protocolTimeout: 60000 }); } catch (e) { lastErr = e; }
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

// ページに入れる計算の道具（色の合成・コントラスト）。evaluateOnNewDocument に関数のまま渡す（外の変数は使えない）
function installHelpers() {
  const parse = c => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const over = (t, b) => [t[0] * t[3] + b[0] * (1 - t[3]), t[1] * t[3] + b[1] * (1 - t[3]), t[2] * t[3] + b[2] * (1 - t[3]), 1];
  // el の文字の後ろにある、不透明な背景（半透明の背景は下の背景に重ねて合成する）
  const bgOf = el => {
    const chain = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0) { chain.push(c); if (c[3] === 1) break; }
    }
    let base = [255, 255, 255, 1];
    for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base);
    return base;
  };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  window.__qa = { parse, over, bgOf, lum, ratio };
}

// 案内の中の測定（ページの中で動く）
function probeBanner(id) {
  const root = document.getElementById(id);
  if (!root) return { missing: true };
  const Q = window.__qa;
  const rs = getComputedStyle(root);
  const rr = root.getBoundingClientRect();
  const r1 = v => Math.round(v * 10) / 10;
  const cls = el => (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  // 文字（文字のある要素ごとに1件）
  const seen = new Set(), texts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const bg = Q.bgOf(el), fg = Q.over(Q.parse(cs.color), bg);
    texts.push({
      text: t.slice(0, 24), el: el.tagName.toLowerCase() + cls(el),
      fontSize: r1(parseFloat(cs.fontSize)), family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      contrast: Math.round(Q.ratio(fg, bg) * 100) / 100,
      decorative: !!el.closest('[aria-hidden="true"]'),
      ja: /[぀-ヿ㐀-鿿]/.test(t),
    });
  }
  // 押せるもの
  const taps = Array.from(root.querySelectorAll('button, a[href], [role="button"], [tabindex]')).map(el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
    return { el: el.tagName.toLowerCase() + cls(el), w: r1(r.width), h: r1(r.height), shown: cs.display !== 'none' && r.width > 0 && r.height > 0, name: name.slice(0, 40) };
  });
  // 重なり順（その要素が無いページでは null）
  const z = sel => { const e = document.querySelector(sel); if (!e) return null; const v = getComputedStyle(e).zIndex; return v === 'auto' ? null : Number(v); };
  return {
    shown: rs.display !== 'none' && rr.width > 0 && rr.height > 0,
    box: { x: r1(rr.x), y: r1(rr.y), w: r1(rr.width), h: r1(rr.height) },
    vw: innerWidth, vh: innerHeight,
    ownOverflowX: root.scrollWidth > root.clientWidth + 1, ownOverflowY: root.scrollHeight > root.clientHeight + 1,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    z: Number(rs.zIndex), animationName: rs.animationName, transitionDuration: rs.transitionDuration,
    zOthers: { modal: z('.ov'), fabFeedback: z('#fb-fab'), panelFeedback: z('#fb-panel'), scrollTop: z('#scroll-top'), toast: z('.toast'), navOverlay: z('.nav-overlay'), ctaBar: z('.mobile-cta-bar'), reserveAsk: z('.nb-reserve-ask') },
    texts, taps,
  };
}

// キーボードの Tab で届いたときのフォーカスの輪（ページの中で動く）
function probeRing(sel) {
  const el = document.querySelector(sel);
  if (!el) return null;
  const Q = window.__qa;
  const cs = getComputedStyle(el);
  const bg = Q.bgOf(el.parentElement || el);
  const ring = Q.parse(cs.outlineColor);
  return {
    focused: document.activeElement === el,
    outlineStyle: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth), outlineOffset: cs.outlineOffset, outlineColor: cs.outlineColor,
    ringContrast: ring ? Math.round(Q.ratio(Q.over(ring, bg), bg) * 100) / 100 : null,
  };
}

async function openPage(ctx, base, vp, o) {
  o = o || {};
  const page = await ctx.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  if (o.ua) await page.setUserAgent(o.ua);
  const log = { pageErrors: [] };
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith(base) && /\/(sw\.js|manifest\.(json|webmanifest))(\?|$)/.test(u)) return req.respond({ status: 404, contentType: 'text/plain', body: 'not found' });
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') return req.continue();
    return req.abort();
  });
  page.on('pageerror', e => log.pageErrors.push(String((e && e.message) || e).slice(0, 300)));
  page.__log = log;
  await page.evaluateOnNewDocument(installHelpers);
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  return page;
}

// Android の案内を出す合図（beforeinstallprompt）を送る（prompt()・userChoice は偽物）
async function fireInstallEvent(page) {
  return page.evaluate(() => {
    const ev = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = () => Promise.resolve();
    ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
}

// 案内が出る条件（2回目以降の訪問・保存が1件以上）まで進めて、2回目の訪問のページを返す
async function secondVisit(browser, base, vp, o) {
  const ctx = await browser.createBrowserContext();
  const p1 = await openPage(ctx, base, vp, o);
  await p1.evaluate(() => { localStorage.setItem('nb_favs', JSON.stringify(['確認用の店1'])); });
  await p1.close();
  const p2 = await openPage(ctx, base, vp, o);
  p2.__ctx = ctx;
  return p2;
}

const rectOf = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s);
  if (!e) return null;
  const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) return null;
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, sel);
const overlap = (a, b) => (a && b) ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0;

// 1つの案内（kind: android | ios）を、1つの幅で測って、確認の結果を返す
async function measure(browser, base, vp, kind) {
  const id = kind === 'android' ? 'pwa-banner' : 'pwa-banner-ios';
  const buttons = kind === 'android' ? ['#pwa-install-btn', '#pwa-dismiss'] : ['#pwa-dismiss-ios'];
  const page = await secondVisit(browser, base, vp, kind === 'ios' ? { ua: IOS_UA } : {});
  await waitCatalog(page);
  const before = await page.evaluate(() => ({ active: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  if (kind === 'android') await fireInstallEvent(page);
  else await waitFn(page, () => getComputedStyle(document.getElementById('pwa-banner-ios')).display !== 'none', null, 8000);
  await sleep(500);
  const after = await page.evaluate(() => ({ active: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null }));
  const p = await page.evaluate(probeBanner, id);
  const me = p && p.box ? { x: p.box.x, y: p.box.y, w: p.box.w, h: p.box.h } : null;
  const cta = await rectOf(page, '.mobile-cta-bar'), fab = await rectOf(page, '#fb-fab'), top = await rectOf(page, '#scroll-top'), ask = await rectOf(page, '.nb-reserve-ask');
  // キーボード: ボタンに合わせて、1つ戻って（Shift+Tab）、Tab で進み直す
  const rings = [];
  for (const sel of buttons) {
    await page.focus(sel);
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    await page.keyboard.press('Tab');
    rings.push({ sel, ...(await page.evaluate(probeRing, sel)) });
  }
  const errors = page.__log.pageErrors.slice();
  await page.__ctx.close();

  const out = [];
  const add = (q, name, ok, cell, detail) => out.push({ kind, viewport: vp.name, id: q, name, ok: ok === null ? null : !!ok, cell, detail: detail || '' });
  const key = `${kind}-${vp.name}`;
  if (!p || p.missing || !p.shown) {
    add('Q0', '案内が出ている', false, '出ない', JSON.stringify({ p: p && { shown: p.shown, missing: p.missing } }));
    return out;
  }
  const readable = p.texts.filter(t => !t.decorative);
  const minFont = Math.min(...p.texts.map(t => t.fontSize));
  const minReadable = readable.length ? Math.min(...readable.map(t => t.fontSize)) : null;
  const minContrast = readable.length ? Math.min(...readable.map(t => t.contrast)) : null;
  const shownTaps = p.taps.filter(t => t.shown);
  const minTap = shownTaps.length ? Math.min(...shownTaps.map(t => Math.min(t.w, t.h))) : null;
  const inside = p.box.x >= 0 && p.box.x + p.box.w <= p.vw && p.box.y >= 0 && p.box.y + p.box.h <= p.vh;

  add('Q0', '案内が出ている', true, `${p.box.w}x${p.box.h}`);
  add('Q1', '画面の中に収まる', inside && !p.ownOverflowX, inside ? `余白 下${Math.round(p.vh - p.box.y - p.box.h)}` : 'はみ出す', JSON.stringify({ box: p.box, vw: p.vw, vh: p.vh, ownOverflowX: p.ownOverflowX, ownOverflowY: p.ownOverflowY }));
  add('Q2', '案内が出ても、ページの横スクロールが増えない', p.pageOverflow <= before.overflow, `${before.overflow}→${p.pageOverflow}`, JSON.stringify({ before: before.overflow, after: p.pageOverflow }));
  add('Q3', `文字が ${FLOOR_PX}px 未満のものが無い`, minFont >= FLOOR_PX, `最小 ${minFont}px`, JSON.stringify(p.texts.filter(t => t.fontSize < FLOOR_PX)));
  add('Q4', `読む文字は ${READABLE_PX}px 以上（装飾を除く）`, minReadable === null || minReadable >= READABLE_PX, minReadable === null ? '-' : `最小 ${minReadable}px`, JSON.stringify(readable.filter(t => t.fontSize < READABLE_PX)));
  add('Q5', `文字のコントラストが ${CONTRAST_MIN}:1 以上（装飾を除く）`, minContrast === null || minContrast >= CONTRAST_MIN, minContrast === null ? '-' : `最小 ${minContrast}:1`, JSON.stringify(readable.filter(t => t.contrast < CONTRAST_MIN)));
  add('Q6', `押せるものが ${TAP_MIN}px 以上（幅・高さ）`, minTap !== null && minTap >= TAP_MIN, minTap === null ? '-' : `最小 ${minTap}px`, JSON.stringify(shownTaps.filter(t => Math.min(t.w, t.h) < TAP_MIN)));
  const ov = { cta: overlap(me, cta), fab: overlap(me, fab), top: overlap(me, top) };
  add('Q7', '下の固定検索バー・ご意見ボタン・上へ戻るに重ならない', ov.cta === 0 && ov.fab === 0 && ov.top === 0, ov.cta + ov.fab + ov.top === 0 ? '重ならない' : '重なる', JSON.stringify({ me, cta, fab, top, ov }));
  const zs = p.zOthers, higher = ['modal', 'fabFeedback', 'panelFeedback', 'scrollTop', 'toast', 'navOverlay'].filter(k => zs[k] !== null && zs[k] !== undefined);
  const zOk = higher.every(k => zs[k] > p.z);
  add('Q8', 'モーダル・ご意見・上へ戻る・トースト・ナビの暗幕より下に重なる', zOk, `z=${p.z}`, JSON.stringify({ z: p.z, others: zs, reserveAskOverlapsBanner: overlap(me, ask) > 0 }));
  const unnamed = shownTaps.filter(t => !t.name);
  add('Q9', '押せるものに名前がある', shownTaps.length > 0 && unnamed.length === 0, `${shownTaps.length}個`, JSON.stringify({ shownTaps: shownTaps.map(t => t.el + ':' + t.name), unnamed }));
  const ringBad = rings.filter(r => !r.focused || r.outlineStyle === 'none' || !(r.outlineWidth > 0));
  add('Q10', 'キーボードの Tab で届き、フォーカスの輪が見える', ringBad.length === 0, ringBad.length === 0 ? `${rings.length}個とも` : `${ringBad.length}個に輪なし`, JSON.stringify(rings));
  const ringLow = rings.filter(r => r.ringContrast !== null && r.ringContrast < RING_CONTRAST_REF);
  add('Q11', `（参考）フォーカスの輪と周りの色の差が ${RING_CONTRAST_REF}:1 以上`, ringLow.length === 0 ? true : null, rings.map(r => r.ringContrast).join('/'), JSON.stringify(rings.map(r => ({ sel: r.sel, ringContrast: r.ringContrast, outlineColor: r.outlineColor }))));
  add('Q12', '出てもフォーカスを奪わない', before.active === after.active, `${before.active}→${after.active}`, JSON.stringify({ before: before.active, after: after.active }));
  add('Q13', '動き（animation）が無い', p.animationName === 'none', p.animationName, JSON.stringify({ animationName: p.animationName, transitionDuration: p.transitionDuration }));
  const monoJa = p.texts.filter(t => t.ja && /^DM Mono$/i.test(t.family));
  add('Q14', '日本語の文字に DM Mono（等幅）を使っていない', monoJa.length === 0, monoJa.length ? `${monoJa.length}件` : p.texts.filter(t => t.ja)[0] ? p.texts.filter(t => t.ja)[0].family : '-', JSON.stringify(monoJa));
  add('Q15', 'ページのエラーが出ていない', errors.length === 0, `${errors.length}件`, errors.join(' / '));
  void key;
  return out;
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  console.log(`配信: ${ROOT} → ${base}（ラベル: ${LABEL}）`);
  const browser = await launchBrowser();
  console.log(`ブラウザ: ${await browser.version()}`);
  const results = [];
  try {
    for (const vp of VIEWPORTS) {
      const kinds = ['android', 'ios'].filter(k => !ONLY || k === ONLY); // iOS のカードは iPad の横向きなど広い画面にも出る（PC の Chrome・Safari には出ない）ので、3つの幅とも測る
      for (const kind of kinds) {
        let rows;
        try { rows = await measure(browser, base, vp, kind); } catch (e) { rows = [{ kind, viewport: vp.name, id: 'EXC', name: '測定で例外', ok: false, cell: '例外', detail: String((e && e.stack) || e).slice(0, 400) }]; }
        rows.forEach(r => results.push(r));
        console.log(`\n── ${kind} / ${vp.name}px ──`);
        rows.forEach(r => console.log(`${r.ok === null ? '➖' : r.ok ? '✅' : '❌'} ${r.id} ${r.name}  [${r.cell}]${r.ok === false ? '\n     ' + r.detail.slice(0, 600) : ''}`));
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  // 表（貼り付け用）: 行 = 確認、列 = 案内 × 幅
  const cols = Array.from(new Set(results.map(r => `${r.kind}-${r.viewport}`)));
  const ids = Array.from(new Set(results.map(r => r.id)));
  console.log('\n| 確認 | ' + cols.join(' | ') + ' |');
  console.log('|---|' + cols.map(() => '---').join('|') + '|');
  ids.forEach(id => {
    const name = (results.find(r => r.id === id) || {}).name;
    console.log(`| ${id} ${name} | ` + cols.map(c => { const r = results.find(x => x.id === id && `${x.kind}-${x.viewport}` === c); return r ? `${r.ok === null ? '➖' : r.ok ? '✅' : '❌'} ${r.cell}` : ''; }).join(' | ') + ' |');
  });
  const judged = results.filter(r => r.ok !== null);
  const fail = judged.filter(r => !r.ok).length;
  console.log(`\n合計 ${judged.length} 件中 ${judged.length - fail} 件通過・${fail} 件失敗（${LABEL}）`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ label: LABEL, root: ROOT, results }, null, 1));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(2); });
