// I-23（保存した店が見えない）の実ブラウザ確認。index.html をローカルで配信し、headless Chrome（puppeteer）で、ナビの「保存済み」を押したときの表示を確かめる。
// 使い方: node docs/qa/uiux-2026-10/e2e_saved.js [--root <フォルダ>] [--viewport mobile|desktop|both] [--only <場面の語>] [--label <名前>] [--json <出力先>] [--shots <フォルダ>] [--headless auto|shell|new]
// - --root: 配信するフォルダ（既定: このリポジトリの直下）。改修前の index.html を置いたフォルダを渡すと、同じ確認が「前」でどうなるかを比べられる
// - --viewport: mobile = 390x844（タッチ）／desktop = 1280x900（既定は両方）
// - --only: 場面の名前（basic・sort・exit・combine・empty・broken・unsave・pages・deep・plain）に含まれる語で絞る
// - --shots: 画面の写真（PNG）を残すフォルダ。無ければ撮らない
// - --headless: auto（既定）= chrome-headless-shell があればそれ、無ければ新しいヘッドレス。e2e_history.js と同じ理由（新しいヘッドレスはタッチ操作が応答しなくなることがある）
// 外部への通信はすべて中断する（ローカルの配信だけで動く）。保存した店は localStorage の nb_favs（店名の配列）に直接書いて用意する。
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
const ONLY = getOpt('--only', '').toLowerCase();
const HEADLESS = getOpt('--headless', 'auto');

const VIEWPORTS = {
  mobile: { name: 'mobile-390', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { name: 'desktop-1280', width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

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

async function newPage(browser, base, vp) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  await page.bringToFront();
  // 初回訪問のスプラッシュ（全面）と、ホーム画面追加の案内は、見終えた・閉じた人の状態にする。出たままだとナビやチップを覆う（どちらも I-13 の範囲）
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('pwa-banner-dismissed', String(Date.now())); } catch (e) { /* 保存できない環境では案内が出るだけ */ }
    try { sessionStorage.setItem('nb_splash', '1'); } catch (e) { /* 同上 */ }
    const orig = window.addEventListener;
    window.addEventListener = function (type, fn, o) { if (type === 'beforeinstallprompt') return undefined; return orig.call(this, type, fn, o); };
  });
  const log = { pageErrors: [], consoleErrors: [], blocked: 0 };
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith(base) && /\/(sw\.js|manifest\.(json|webmanifest))(\?|$)/.test(u)) return req.respond({ status: 404, contentType: 'text/plain', body: 'not found' });
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') return req.continue();
    log.blocked++;
    return req.abort();
  });
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

const results = [];
function check(vp, id, name, ok, detail) { results.push({ viewport: vp.name, id, name, ok: !!ok, detail: detail || '' }); }

// 保存した店（店名の配列）を書いてからトップを開く。raw を渡すと、その文字列をそのまま nb_favs に書く（壊れた値の確認用）
async function openTop(browser, base, vp, favs, raw) {
  const page = await newPage(browser, base, vp);
  const value = raw !== undefined ? raw : (favs ? JSON.stringify(favs) : null);
  await page.evaluateOnNewDocument(v => { try { if (v !== null) localStorage.setItem('nb_favs', v); else localStorage.removeItem('nb_favs'); } catch (e) { /* 書けない環境では空のまま */ } }, value);
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitCatalog(page);
  await sleep(300);
  return page;
}

// 全店のデータの中から、店名が1つしかない店を位置を散らして n 件選ぶ（最初の50店の中の店を1件含める）
async function pickNames(page, n) {
  return page.evaluate(count => {
    const counts = {};
    window.ALL_STORES.forEach(s => { counts[s['店名']] = (counts[s['店名']] || 0) + 1; });
    const out = [];
    const used = {};
    const total = window.ALL_STORES.length;
    const take = i => {
      for (let k = 0; k < 400; k++) {
        const s = window.ALL_STORES[(i + k) % total];
        if (s && counts[s['店名']] === 1 && !used[s['店名']]) { used[s['店名']] = 1; out.push(s['店名']); return; }
      }
    };
    take(2); // 最初の50店の中
    for (let j = 1; j < count; j++) take(Math.floor((total - 1) * j / count));
    return out;
  }, n);
}

async function realClick(page, handle) {
  let why = '';
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

// ナビの「保存済み」を押す。ナビが畳まれている画面幅ではハンバーガーを開いてから押す（人と同じ手順）
async function clickSavedNav(page) {
  const visible = await page.evaluate(() => {
    const el = document.getElementById('nav-fav');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.right > 0 && r.left < window.innerWidth;
  });
  if (!visible) {
    const h = await clickSel(page, '#hamburger-btn');
    if (!h.ok) return { ok: false, why: 'ハンバーガーが押せない: ' + h.why };
    await waitFn(page, () => document.getElementById('main-nav') && document.getElementById('main-nav').classList.contains('open'), null, 3000);
    await sleep(350); // ドロワーが出る動きを待つ
  }
  const c = await clickSel(page, '#nav-fav');
  await sleep(1400); // 滑らかなスクロールが終わるのを待つ
  return c;
}

// いまの画面の状態（保存済みの表示に関わるもの）
async function view(page) {
  return page.evaluate(() => {
    const g = document.getElementById('grid');
    const gcs = g ? getComputedStyle(g) : null;
    const rs = document.getElementById('results-summary');
    const rscs = rs ? getComputedStyle(rs) : null;
    const cards = g ? Array.from(g.querySelectorAll('.card')) : [];
    const names = cards.map(c => {
      const m = /openM\((\d+)/.exec(c.getAttribute('onclick') || '');
      const s = m ? window.ALL_STORES[Number(m[1])] : null;
      return s ? s['店名'] : '';
    });
    const first = cards[0] ? cards[0].getBoundingClientRect() : null;
    const empty = g ? g.querySelector('.empty-state') : null;
    const nav = document.getElementById('nav-fav');
    const chips = Array.from(document.querySelectorAll('#active-chips .chip')).map(c => c.getAttribute('data-clear'));
    const feature = document.querySelector('.feature-strip');
    const frect = feature ? feature.getBoundingClientRect() : null;
    const favChip = document.querySelector('#active-chips .chip[data-clear="favs"]');
    const fcr = favChip ? favChip.getBoundingClientRect() : null;
    return {
      searchActive: document.body.classList.contains('search-active'),
      gridShown: !!g && gcs.display !== 'none' && g.offsetHeight > 0,
      cardCount: cards.length,
      names,
      favChipTop: fcr ? Math.round(fcr.top) : null,
      favChipBottom: fcr ? Math.round(fcr.bottom) : null,
      firstTop: first ? Math.round(first.top) : null,
      firstBottom: first ? Math.round(first.bottom) : null,
      firstH: first ? Math.round(first.height) : 0, // 隠れた（display:none）カードは高さ0。位置だけ見ると 0 が「画面の先頭」に見えてしまう
      innerHeight: window.innerHeight,
      scrollY: Math.round(window.scrollY),
      summaryShown: !!rs && rscs.display !== 'none' && rs.offsetHeight > 0,
      summaryCount: (document.getElementById('results-summary-count') || {}).textContent || '',
      summaryCond: (document.getElementById('results-summary-cond') || {}).innerText || '',
      chips,
      navLabel: nav ? nav.innerText.replace(/\s+/g, '') : '',
      navBorder: nav ? nav.style.borderBottom : '',
      emptyTitle: empty ? (empty.querySelector('h3') || {}).textContent : null,
      emptyText: empty ? (empty.querySelector('p') || {}).textContent : null,
      emptyButton: empty ? (empty.querySelector('button') || {}).textContent : null,
      featureTop: frect ? Math.round(frect.top) : null,
      featureShown: !!feature && getComputedStyle(feature).display !== 'none',
      showFavsOnly: typeof window.SHOW_FAVS_ONLY === 'undefined' ? null : window.SHOW_FAVS_ONLY,
      hash: location.hash,
      historyLength: history.length,
      stored: (() => { try { return localStorage.getItem('nb_favs'); } catch (e) { return null; } })(),
    };
  });
}
const sameSet = (a, b) => a.length === b.length && a.slice().sort().join('\u0000') === b.slice().sort().join('\u0000');
const subset = (a, b) => a.every(x => b.indexOf(x) !== -1);
async function shot(page, vp, name) {
  if (!SHOTS) return;
  try { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${LABEL}-${vp.name}-${name}.png`) }); } catch (e) { /* 写真が撮れなくても確認は続ける */ }
}
function errorCheck(vp, id, page, scene) {
  const errs = page.__log.pageErrors.concat(page.__log.consoleErrors);
  check(vp, id, `${scene}: ページのエラーが出ていない`, errs.length === 0, errs.slice(0, 3).join(' / '));
}

// ── 場面 ──

// 基本: 保存した店を押すと、保存した店だけが見える（今回直す不具合）
async function scenarioBasic(browser, base, vp) {
  const probe = await openTop(browser, base, vp, null);
  const names = await pickNames(probe, 3);
  await probe.close();
  const page = await openTop(browser, base, vp, names);
  const before = await view(page);
  check(vp, 'S1-pre', '保存前: トップは一覧を隠している（雑誌面の表示）', !before.searchActive && !before.gridShown, `searchActive=${before.searchActive} gridShown=${before.gridShown}`);
  check(vp, 'S1-label', 'ナビに保存した件数が出る（保存済み(3)）', before.navLabel.includes('保存済み(3)'), before.navLabel);
  const c = await clickSavedNav(page);
  check(vp, 'S1-click', 'ナビの「保存済み」が押せる', c.ok, c.why);
  const v = await view(page);
  await shot(page, vp, 'saved-on');
  check(vp, 'S1-grid', '一覧が表示される（隠れたままにならない）', v.searchActive && v.gridShown, `searchActive=${v.searchActive} gridShown=${v.gridShown} cards=${v.cardCount}`);
  check(vp, 'S1-cards', '並ぶのは保存した3店だけ', sameSet(v.names, names), `期待 ${JSON.stringify(names)} / 実際 ${JSON.stringify(v.names)}`);
  check(vp, 'S1-summary', '「絞り込み結果」の帯が出て、件数が 3', v.summaryShown && v.summaryCount === '3', `shown=${v.summaryShown} count="${v.summaryCount}"`);
  check(vp, 'S1-pill', '帯の条件に「保存済み」が出る', v.summaryCond.includes('保存済み'), v.summaryCond.replace(/\s+/g, ' '));
  check(vp, 'S1-chip', '条件のチップに「保存済み」が出る', v.chips.includes('favs'), JSON.stringify(v.chips));
  check(vp, 'S1-chip-visible', '「保存済み ×」のチップが、ヘッダと検索バーの下に見えている（何を表示していて、どう外すかが見える）', v.favChipTop !== null && v.favChipTop >= 120 && v.favChipBottom <= v.innerHeight, `chipTop=${v.favChipTop} chipBottom=${v.favChipBottom} 画面の高さ=${v.innerHeight} scrollY=${v.scrollY}`);
  check(vp, 'S1-visible', '1枚目のカードも画面に見えている（結果まで動いている）', v.firstH > 50 && v.firstTop !== null && v.firstTop >= 0 && v.firstTop < v.innerHeight - 40, `firstTop=${v.firstTop} 高さ=${v.firstH} 画面の高さ=${v.innerHeight} scrollY=${v.scrollY}`);
  check(vp, 'S1-nav', 'ナビの「保存済み」が強調される', v.navBorder !== '', `border="${v.navBorder}"`);
  check(vp, 'S1-url', '保存済みの表示では URL も履歴も変わらない', v.hash === before.hash && v.historyLength === before.historyLength, `hash "${before.hash}"→"${v.hash}" 履歴 ${before.historyLength}→${v.historyLength}`);
  check(vp, 'S1-stored', '保存した店の記録（nb_favs）は変わらない', v.stored === before.stored, `${before.stored} → ${v.stored}`);
  errorCheck(vp, 'S1-error', page, '基本');
  await page.close();
}

// 並び替え: どの並びでも保存済みのまま
async function scenarioSort(browser, base, vp) {
  const probe = await openTop(browser, base, vp, null);
  const names = await pickNames(probe, 3);
  await probe.close();
  const page = await openTop(browser, base, vp, names);
  await clickSavedNav(page);
  const modes = await page.evaluate(() => Array.from(document.querySelectorAll('.sort-chip')).filter(b => !b.hasAttribute('disabled') && !b.dataset.needsGeo && b.dataset.sort !== 'relevance').map(b => b.dataset.sort));
  check(vp, 'S2-modes', '押せる並び替えがある', modes.length >= 4, modes.join(','));
  let okAll = true, firstBad = '';
  for (const m of modes) {
    const h = await page.$(`.sort-chip[data-sort="${m}"]`);
    const c = h ? await realClick(page, h) : { ok: false, why: '無い' };
    await sleep(500);
    const v = await view(page);
    const ok = c.ok && v.searchActive && sameSet(v.names, names) && v.chips.includes('favs');
    if (!ok && okAll) { okAll = false; firstBad = `${m}: click=${c.ok}${c.why ? '(' + c.why + ')' : ''} cards=${JSON.stringify(v.names)} chips=${JSON.stringify(v.chips)}`; }
  }
  check(vp, 'S2-sort', `どの並び替え（${modes.length}種）でも保存した3店だけのまま`, okAll, firstBad);
  errorCheck(vp, 'S2-error', page, '並び替え');
  await page.close();
}

// 抜け方: ナビをもう一度／条件のチップ／「特集・ランキングに戻る」／リセット
async function scenarioExit(browser, base, vp) {
  const probe = await openTop(browser, base, vp, null);
  const names = await pickNames(probe, 3);
  await probe.close();
  const page = await openTop(browser, base, vp, names);

  // a) ナビをもう一度押す
  await clickSavedNav(page);
  let c = await clickSavedNav(page);
  let v = await view(page);
  check(vp, 'S3-toggle', 'ナビをもう一度押すと保存済みの表示が終わり、雑誌面に戻る', c.ok && !v.searchActive && !v.gridShown && v.showFavsOnly === false && !v.chips.includes('favs') && v.navBorder === '', `click=${c.ok} searchActive=${v.searchActive} gridShown=${v.gridShown} flag=${v.showFavsOnly} chips=${JSON.stringify(v.chips)} border="${v.navBorder}"`);
  check(vp, 'S3-toggle-scroll', '戻ったとき、特集の先頭が画面に見える（一覧が消えた場所に取り残されない）', v.featureShown && v.featureTop !== null && v.featureTop >= -10 && v.featureTop < v.innerHeight - 100, `featureTop=${v.featureTop} scrollY=${v.scrollY}`);

  // b) 条件のチップ（保存済み ×）
  await clickSavedNav(page);
  c = await clickSel(page, '#active-chips .chip[data-clear="favs"]');
  await sleep(900);
  v = await view(page);
  check(vp, 'S3-chip', '条件のチップ「保存済み ×」で保存済みの表示が終わる', c.ok && !v.searchActive && v.showFavsOnly === false && !v.chips.includes('favs') && v.navBorder === '', `click=${c.ok}${c.why ? '(' + c.why + ')' : ''} searchActive=${v.searchActive} flag=${v.showFavsOnly} chips=${JSON.stringify(v.chips)} border="${v.navBorder}"`);

  // c) 「絞り込みを解除して特集・ランキングに戻る」
  await clickSavedNav(page);
  c = await clickSel(page, '.back-to-magazine');
  await sleep(1200);
  v = await view(page);
  check(vp, 'S3-back', '「絞り込みを解除して特集・ランキングに戻る」で保存済みの表示も終わる', c.ok && !v.searchActive && v.showFavsOnly === false && v.navBorder === '', `click=${c.ok}${c.why ? '(' + c.why + ')' : ''} searchActive=${v.searchActive} flag=${v.showFavsOnly} border="${v.navBorder}"`);

  // d) 保存した店の記録は、どの抜け方でも消えない
  check(vp, 'S3-kept', '抜けても、保存した店の記録（nb_favs）は残る', sameSet(JSON.parse(v.stored || '[]'), names), v.stored || '');
  errorCheck(vp, 'S3-error', page, '抜け方');
  await page.close();
}

// ほかの条件との組み合わせ
async function scenarioCombine(browser, base, vp) {
  const probe = await openTop(browser, base, vp, null);
  const names = await pickNames(probe, 3);
  await probe.close();
  const page = await openTop(browser, base, vp, names);
  await clickSavedNav(page);

  // 検索語: 保存した1店の店名で探す → 保存した店の中から、その店が出る
  const target = names[1];
  const typed = await page.evaluate(q => {
    const inputs = ['si2', 'si'].map(id => document.getElementById(id)).filter(Boolean);
    const el = inputs.find(i => i.getBoundingClientRect().width > 0) || inputs[0];
    if (!el) return false;
    el.value = q;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, target);
  await sleep(1500);
  let v = await view(page);
  check(vp, 'S4-search', '保存済みのまま店名で探すと、保存した店の中からその店が出る（保存していない店は出ない）', typed && v.names.includes(target) && subset(v.names, names), `typed=${typed} cards=${JSON.stringify(v.names)}`);
  check(vp, 'S4-chips', '保存済みと検索語のチップが両方出る', v.chips.includes('favs') && v.chips.includes('q'), JSON.stringify(v.chips));
  // 検索語のチップを外す → 保存した3店に戻る
  let c = await clickSel(page, '#active-chips .chip[data-clear="q"]');
  await sleep(900);
  v = await view(page);
  check(vp, 'S4-q-off', '検索語のチップを外すと保存した3店に戻る（保存済みは残る）', c.ok && sameSet(v.names, names) && v.chips.includes('favs') && !v.chips.includes('q'), `click=${c.ok} cards=${JSON.stringify(v.names)} chips=${JSON.stringify(v.chips)}`);

  // 保存した店がどれも入っていないジャンル: 「該当なし」の既定の案内が出て、リセットで保存済みも外れる
  const genre = await page.evaluate(saved => {
    const have = {};
    window.ALL_STORES.forEach(s => { if (saved.indexOf(s['店名']) !== -1) have[window.normalizeGenre ? window.normalizeGenre(s['ジャンル'] || '') : s['ジャンル']] = 1; });
    const btn = Array.from(document.querySelectorAll('.ft')).find(b => b.dataset.f && b.dataset.f !== 'All' && b.dataset.f !== 'all' && !have[b.dataset.f]);
    return btn ? btn.dataset.f : null;
  }, names);
  if (genre) {
    await page.evaluate(g => { const b = Array.from(document.querySelectorAll('.ft')).find(x => x.dataset.f === g); if (b) b.click(); }, genre);
    await sleep(900);
    v = await view(page);
    check(vp, 'S4-nomatch', `保存した店に無いジャンル（${genre}）を足すと、該当なしの案内が出る（保存ゼロの案内ではない）`, v.cardCount === 0 && v.emptyTitle === '該当するお店が見つかりませんでした' && v.chips.includes('favs') && v.chips.includes('genre'), `cards=${v.cardCount} title="${v.emptyTitle}" chips=${JSON.stringify(v.chips)}`);
    await shot(page, vp, 'saved-nomatch');
    const reset = await page.evaluate(() => { const b = document.querySelector('.empty-state-reset'); if (b) { b.click(); return true; } return false; });
    await sleep(900);
    v = await view(page);
    check(vp, 'S4-reset', '「フィルターをリセット」で、保存済みも含めてすべて外れる', reset && !v.searchActive && v.showFavsOnly === false && v.chips.length === 0 && v.navBorder === '', `reset=${reset} searchActive=${v.searchActive} flag=${v.showFavsOnly} chips=${JSON.stringify(v.chips)} border="${v.navBorder}"`);
  } else {
    check(vp, 'S4-nomatch', '保存した店に無いジャンルを足す確認', false, 'ジャンルのボタンが見つからない');
  }
  errorCheck(vp, 'S4-error', page, '組み合わせ');
  await page.close();
}

// 保存した店が1件も無いとき
async function scenarioEmpty(browser, base, vp) {
  for (const [label, favs, raw] of [['記録なし', null, undefined], ['空の配列', [], undefined]]) {
    const page = await openTop(browser, base, vp, favs, raw);
    const before = await view(page);
    const c = await clickSavedNav(page);
    const v = await view(page);
    await shot(page, vp, 'saved-empty-' + (favs === null ? 'none' : 'array'));
    check(vp, `S5-${label}-label`, `${label}: ナビは保存済み(0)`, before.navLabel.includes('保存済み(0)'), before.navLabel);
    check(vp, `S5-${label}-msg`, `${label}: 「保存したお店はまだありません」と、保存のしかたが出る`, c.ok && v.searchActive && v.gridShown && v.emptyTitle === '保存したお店はまだありません' && /ハート/.test(v.emptyText || ''), `click=${c.ok} grid=${v.gridShown} title="${v.emptyTitle}" text="${v.emptyText}"`);
    check(vp, `S5-${label}-btn`, `${label}: 案内のボタンは「保存済みの表示をやめる」`, v.emptyButton === '保存済みの表示をやめる', `button="${v.emptyButton}"`);
    const b = await page.evaluate(() => { const x = document.querySelector('.empty-state-reset'); if (x) { x.click(); return true; } return false; });
    await sleep(1200);
    const after = await view(page);
    check(vp, `S5-${label}-exit`, `${label}: ボタンで保存済みの表示が終わり、雑誌面に戻る`, b && !after.searchActive && after.showFavsOnly === false && after.chips.length === 0 && after.navBorder === '', `pressed=${b} searchActive=${after.searchActive} flag=${after.showFavsOnly} chips=${JSON.stringify(after.chips)} border="${after.navBorder}"`);
    errorCheck(vp, `S5-${label}-error`, page, label);
    await page.close();
  }
}

// 壊れた保存の記録・存在しない店
async function scenarioBroken(browser, base, vp) {
  for (const [label, raw] of [['配列でない', '{"a":1}'], ['null', 'null'], ['JSONでない', '[壊れた']]) {
    const page = await openTop(browser, base, vp, null, raw);
    const c = await clickSavedNav(page);
    const v = await view(page);
    check(vp, `S6-${label}`, `nb_favs が${label}値でも、ページが止まらず「保存したお店はまだありません」になる`, c.ok && v.emptyTitle === '保存したお店はまだありません' && v.cardCount === 0, `click=${c.ok} cards=${v.cardCount} title="${v.emptyTitle}"`);
    errorCheck(vp, `S6-${label}-error`, page, label);
    await page.close();
  }
  // いまは載っていない店名が混じる（閉店で外れた店など）: 載っている店だけが並ぶ
  const probe = await openTop(browser, base, vp, null);
  const names = await pickNames(probe, 2);
  await probe.close();
  const page = await openTop(browser, base, vp, names.concat(['存在しない店 E2E']));
  const before = await view(page);
  await clickSavedNav(page);
  const v = await view(page);
  check(vp, 'S6-ghost', '載っていない店名が混じっていても、載っている店だけが並ぶ', sameSet(v.names, names) && before.navLabel.includes('保存済み(3)'), `label="${before.navLabel}" cards=${JSON.stringify(v.names)}`);
  errorCheck(vp, 'S6-ghost-error', page, '載っていない店名');
  await page.close();
}

// 保存済みの表示の中でハートを外す
async function scenarioUnsave(browser, base, vp) {
  const probe = await openTop(browser, base, vp, null);
  const names = await pickNames(probe, 3);
  await probe.close();
  const page = await openTop(browser, base, vp, names);
  await clickSavedNav(page);
  const h = await page.$('#grid .card .fav-btn');
  const c = h ? await realClick(page, h) : { ok: false, why: 'ハートが無い' };
  await sleep(400);
  let v = await view(page);
  check(vp, 'S7-unsave', 'ハートを外すと保存が2件になる（ナビの件数・記録）', c.ok && v.navLabel.includes('保存済み(2)') && JSON.parse(v.stored || '[]').length === 2, `click=${c.ok}${c.why ? '(' + c.why + ')' : ''} label="${v.navLabel}" stored=${v.stored}`);
  check(vp, 'S7-stays', '外した直後はカードが残る（押し間違いをすぐ戻せる）', v.cardCount === 3, `cards=${v.cardCount}`);
  // 入れ直すと2件だけ
  await clickSavedNav(page); // 終わる
  await clickSavedNav(page); // もう一度入る
  v = await view(page);
  check(vp, 'S7-reenter', '入れ直すと、外した店は並ばない（2件）', v.cardCount === 2 && v.summaryCount === '2', `cards=${v.cardCount} count="${v.summaryCount}"`);
  errorCheck(vp, 'S7-error', page, 'ハートを外す');
  await page.close();
}

// 31件以上: ページ送り
async function scenarioPages(browser, base, vp) {
  const probe = await openTop(browser, base, vp, null);
  const names = await pickNames(probe, 35);
  await probe.close();
  const page = await openTop(browser, base, vp, names);
  await clickSavedNav(page);
  let v = await view(page);
  const pag = await page.evaluate(() => { const p = document.getElementById('pagination'); return { shown: !!p && p.children.length > 0, info: (p.querySelector('.pg-info') || {}).textContent || '' }; });
  check(vp, 'S8-page1', '35件保存: 1ページ目は30枚・ページ送りが出る・件数が 35', names.length === 35 && v.cardCount === 30 && pag.shown && v.summaryCount === '35', `saved=${names.length} cards=${v.cardCount} count="${v.summaryCount}" pager="${pag.info}"`);
  const first = v.names.slice();
  await page.evaluate(() => goToPage(2));
  await sleep(1000);
  v = await view(page);
  check(vp, 'S8-page2', '2ページ目は残りの5枚で、1ページ目と重ならない（全部で35店が揃う）', v.cardCount === 5 && sameSet(first.concat(v.names), names), `page2=${v.cardCount} 合計=${first.length + v.names.length}`);
  errorCheck(vp, 'S8-error', page, 'ページ送り');
  await page.close();
}

// ページの下の方から押す
async function scenarioDeep(browser, base, vp) {
  const probe = await openTop(browser, base, vp, null);
  const names = await pickNames(probe, 3);
  await probe.close();
  const page = await openTop(browser, base, vp, names);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await sleep(500);
  const startY = await page.evaluate(() => Math.round(window.scrollY));
  const c = await clickSavedNav(page);
  const v = await view(page);
  check(vp, 'S9-deep', `ページの一番下（scrollY ${startY}）から押しても、保存した店が画面に見える`, c.ok && sameSet(v.names, names) && v.firstH > 50 && v.firstTop !== null && v.firstTop >= 0 && v.firstTop < v.innerHeight - 40, `click=${c.ok}${c.why ? '(' + c.why + ')' : ''} firstTop=${v.firstTop} 高さ=${v.firstH} 画面の高さ=${v.innerHeight} scrollY=${v.scrollY}`);
  await shot(page, vp, 'saved-from-bottom');
  errorCheck(vp, 'S9-error', page, '下から押す');
  await page.close();
}

// 保存済みを使わない通常の動き（退行がないこと）
async function scenarioPlain(browser, base, vp) {
  const probe = await openTop(browser, base, vp, null);
  const names = await pickNames(probe, 3);
  await probe.close();
  const page = await openTop(browser, base, vp, names);
  // 条件を足す前は、保存済みの印は何も出ない
  let v = await view(page);
  check(vp, 'S10-idle', '保存済みを押していないときは、チップも強調も出ない', v.chips.length === 0 && v.navBorder === '' && v.showFavsOnly === false, `chips=${JSON.stringify(v.chips)} border="${v.navBorder}" flag=${v.showFavsOnly}`);
  // ジャンルだけで絞る（保存済みを使わない）
  const genre = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.ft')).find(x => x.dataset.f && x.dataset.f !== 'All' && x.dataset.f !== 'all'); if (b) { b.click(); return b.dataset.f; } return null; });
  await sleep(1200);
  v = await view(page);
  check(vp, 'S10-genre', 'ジャンルだけの絞り込みは今までどおり動く（保存の有無に関係なく多数の店が並ぶ）', !!genre && v.searchActive && v.gridShown && v.cardCount >= 20 && v.chips.length === 1 && v.chips[0] === 'genre' && Number(v.summaryCount.replace(/,/g, '')) > 30, `genre=${genre} cards=${v.cardCount} count="${v.summaryCount}" chips=${JSON.stringify(v.chips)}`);
  // 保存済みを足す → 外す → ジャンルだけが残る
  await clickSavedNav(page);
  v = await view(page);
  check(vp, 'S10-both', 'ジャンルに保存済みを足すと、チップは2つになる', v.chips.length === 2 && v.chips.includes('favs') && v.chips.includes('genre') && v.cardCount <= 3, `chips=${JSON.stringify(v.chips)} cards=${v.cardCount}`);
  await clickSavedNav(page);
  v = await view(page);
  check(vp, 'S10-keep', 'もう一度押すと保存済みだけが外れ、ジャンルの絞り込みは残る（雑誌面には戻らない）', v.searchActive && v.chips.length === 1 && v.chips[0] === 'genre' && v.cardCount >= 20, `searchActive=${v.searchActive} chips=${JSON.stringify(v.chips)} cards=${v.cardCount}`);
  errorCheck(vp, 'S10-error', page, '通常の絞り込み');
  await page.close();
}

const SCENES = [
  ['basic', scenarioBasic], ['sort', scenarioSort], ['exit', scenarioExit], ['combine', scenarioCombine], ['empty', scenarioEmpty],
  ['broken', scenarioBroken], ['unsave', scenarioUnsave], ['pages', scenarioPages], ['deep', scenarioDeep], ['plain', scenarioPlain],
];

(async () => {
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await launchBrowser();
  const vps = WHICH === 'mobile' ? [VIEWPORTS.mobile] : WHICH === 'desktop' ? [VIEWPORTS.desktop] : [VIEWPORTS.mobile, VIEWPORTS.desktop];
  console.log(`E2E（${LABEL}）: root=${ROOT}`);
  for (const vp of vps) {
    console.log(`\n== ${vp.name} ==`);
    for (const [name, fn] of SCENES) {
      if (ONLY && !name.includes(ONLY)) continue;
      const start = results.length;
      try { await fn(browser, base, vp); } catch (e) {
        check(vp, 'ERR-' + name, `場面 ${name} が最後まで動いた`, false, String((e && e.stack) || e).split('\n').slice(0, 2).join(' / ').slice(0, 300));
      }
      results.slice(start).forEach(r => console.log(`${r.ok ? '✅' : '❌'} ${r.id} ${r.name}${r.ok ? '' : '\n     ' + r.detail}`));
    }
  }
  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n合計 ${results.length} 件中 ${results.length - failed.length} 件通過・${failed.length} 件失敗（${LABEL}）`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ label: LABEL, root: ROOT, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
