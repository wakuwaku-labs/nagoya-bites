// 本番（https://nagoya-bites.com/）で、操作したときに GA4 へ「何が送られようとするか」を記録する。
// GA4 への送信（/g/collect など）は、ネットワークの層で遮断し（Network.setBlockedURLs）、送ろうとした内容だけを記録する＝GA4 には何も届かない。サーバーに何も書かない。
// gtag.js は遮断された送信をやり直すので、同じイベントが2回以上記録される。イベント名と URL が同じものは1件に数える（e2e_history.js の --ga4-history と同じ）
// 確かめること: P-244 の達成条件 5（pushState・「戻る」・「進む」で page_view が出ない）・modal_open の source と store_id（I-21・I-08）
// 使い方: node prod_events.js [--base https://nagoya-bites.com/]
const puppeteer = require('puppeteer');
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = bi >= 0 ? argv[bi + 1] : 'https://nagoya-bites.com/';
const COLLECT_RE = /\/g\/collect|\/j\/collect|\/collect\?|google-analytics\.com|analytics\.google\.com|doubleclick\.net/;
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail)); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parseCollect(url, post) {
  const out = [];
  let u; try { u = new URL(url); } catch (e) { return out; }
  const q = {}; u.searchParams.forEach((v, k) => { q[k] = v; });
  const lines = (post || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (q.en) out.push(q);
  lines.forEach((ln) => { const p = {}; new URLSearchParams(ln).forEach((v, k) => { p[k] = v; }); if (p.en) out.push(Object.assign({ dl: q.dl }, p)); });
  return out;
}
const uniq = (list) => { const seen = new Set(); return list.filter(h => { const k = h.en + '|' + (h.dl || '') + '|' + (h['ep.source'] || '') + '|' + (h['ep.store_id'] || ''); if (seen.has(k)) return false; seen.add(k); return true; }); };

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ['*google-analytics.com*', '*analytics.google.com*', '*doubleclick.net*', '*/g/collect*', '*/j/collect*', '*formspree.io*'] });
  const log = { collect: [], net: 0 };
  cdp.on('Network.requestWillBeSent', (ev) => {
    if (!COLLECT_RE.test(ev.request.url)) return;
    log.net++;
    try { parseCollect(ev.request.url, ev.request.postData).forEach(h => log.collect.push(h)); } catch (e) { /* 読めない送信は数えない */ }
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page._nbErrors = errors; page._log = log;
  return page;
}
const summarize = (hits) => hits.map(h => h.en + (h['ep.source'] ? '[' + h['ep.source'] + ']' : '') + (h['ep.store_id'] ? '{id}' : '') + '@' + (h.dl || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 40));
async function phase(page, fn, wait) { page._log.collect.length = 0; await fn(); await sleep(wait || 3500); return uniq(page._log.collect); }

(async () => {
  const browser = await puppeteer.launch({ headless: 'shell' });
  try {
    const page = await newPage(browser);
    await page.goto(BASE + '?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#si', { timeout: 30000 });
    await page.waitForFunction(() => typeof window.ALL_STORES !== 'undefined' && window.ALL_STORES.length > 100 && document.querySelectorAll('#grid .card').length > 0, { timeout: 60000 }).catch(() => {});
    await sleep(3500);
    const loaded = uniq(page._log.collect);
    check('gtag.js が動き、最初の page_view を送ろうとする', loaded.some(h => h.en === 'page_view'), JSON.stringify(summarize(loaded)));

    // ① 一覧のカードを押して、モーダルを開く（grid）
    const histBefore = await page.evaluate(() => history.length);
    const ev1 = await phase(page, async () => { await page.evaluate(() => { const c = document.querySelector('#grid .card'); c.scrollIntoView({ block: 'center' }); c.click(); }); await page.waitForFunction(() => document.getElementById('ov').classList.contains('open'), { timeout: 15000 }).catch(() => {}); });
    const open1 = await page.evaluate(() => ({ open: document.getElementById('ov').classList.contains('open'), hash: location.hash, len: history.length }));
    const mo1 = ev1.filter(h => h.en === 'modal_open');
    check('モーダルが開き、URL に store=ID が載り、履歴が1つ増える', open1.open && /store=/.test(open1.hash) && open1.len === histBefore + 1, JSON.stringify({ open: open1.open, hash: open1.hash.slice(0, 30), len: open1.len, before: histBefore }));
    check('modal_open が source=grid・store_id つきで送られようとする（1種類）', mo1.length === 1 && mo1[0]['ep.source'] === 'grid' && !!mo1[0]['ep.store_id'], JSON.stringify(summarize(ev1)));
    check('モーダルを開いても page_view は出ない（pushState）', ev1.filter(h => h.en === 'page_view').length === 0, JSON.stringify(summarize(ev1)));

    // ② 「戻る」で閉じる
    const ev2 = await phase(page, async () => { await page.evaluate(() => history.back()); await page.waitForFunction(() => !document.getElementById('ov').classList.contains('open'), { timeout: 10000 }).catch(() => {}); });
    const closed = await page.evaluate(() => ({ open: document.getElementById('ov').classList.contains('open'), hash: location.hash }));
    check('「戻る」でモーダルが閉じ、store= が URL から消える', !closed.open && !/store=/.test(closed.hash), JSON.stringify({ open: closed.open, hash: closed.hash.slice(0, 30) }));
    check('「戻る」で page_view も modal_open も出ない（popstate）', ev2.filter(h => h.en === 'page_view' || h.en === 'modal_open').length === 0, JSON.stringify(summarize(ev2)));

    // ③ 「進む」で開き直す（popstate は modal_open に数えない）
    const ev3 = await phase(page, async () => { await page.evaluate(() => history.forward()); await page.waitForFunction(() => document.getElementById('ov').classList.contains('open'), { timeout: 10000 }).catch(() => {}); });
    const fwd = await page.evaluate(() => ({ open: document.getElementById('ov').classList.contains('open'), hash: location.hash }));
    check('「進む」でモーダルが開く', fwd.open && /store=/.test(fwd.hash), JSON.stringify({ open: fwd.open, hash: fwd.hash.slice(0, 30) }));
    check('「進む」で page_view も modal_open も出ない（popstate は数えない）', ev3.filter(h => h.en === 'page_view' || h.en === 'modal_open').length === 0, JSON.stringify(summarize(ev3)));
    const id = await page.evaluate(() => (location.hash.match(/store=([^&]+)/) || [])[1] || '');

    // ④ ×で閉じる（history.back で足した履歴を戻す）
    const ev4 = await phase(page, async () => { await page.evaluate(() => { const b = document.querySelector('.mcl-close'); if (b) b.click(); }); await page.waitForFunction(() => !document.getElementById('ov').classList.contains('open'), { timeout: 10000 }).catch(() => {}); });
    const closed2 = await page.evaluate(() => ({ open: document.getElementById('ov').classList.contains('open'), hash: location.hash }));
    check('×でモーダルが閉じ、store= が URL から消える', !closed2.open && !/store=/.test(closed2.hash), JSON.stringify({ open: closed2.open, hash: closed2.hash.slice(0, 30) }));
    check('×で閉じても page_view は出ない', ev4.filter(h => h.en === 'page_view').length === 0, JSON.stringify(summarize(ev4)));
    check('ページのエラーが出ていない（操作中）', page._nbErrors.length === 0, page._nbErrors.slice(0, 2).join(' | '));
    await page.close();

    // ⑤ 共有リンク（#store=ID）で開く（deeplink）
    if (id) {
      const p2 = await newPage(browser);
      await p2.goto(BASE + '?cb=' + Date.now() + '#store=' + id, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p2.waitForFunction(() => { const o = document.getElementById('ov'); return !!o && o.classList.contains('open'); }, { timeout: 30000 }).catch(() => {});
      await sleep(4000);
      const dl = await p2.evaluate(() => ({ open: document.getElementById('ov').classList.contains('open'), len: history.length }));
      const evd = uniq(p2._log.collect);
      const mo = evd.filter(h => h.en === 'modal_open');
      check('共有リンクで店のモーダルが開く', dl.open, JSON.stringify(dl));
      check('共有リンクの modal_open は source=deeplink・store_id が開いた店と同じ（1種類）', mo.length === 1 && mo[0]['ep.source'] === 'deeplink' && mo[0]['ep.store_id'] === id, JSON.stringify(summarize(evd)));
      check('共有リンクで開いても、page_view は最初の1件だけ', evd.filter(h => h.en === 'page_view').length === 1, JSON.stringify(summarize(evd)));
      check('ページのエラーが出ていない（共有リンク）', p2._nbErrors.length === 0, p2._nbErrors.slice(0, 2).join(' | '));
      await p2.close();
    }
  } finally {
    await browser.close();
  }
  const fails = results.filter(r => !r.ok);
  console.log('\n合計 ' + results.length + ' 件中 ' + (results.length - fails.length) + ' 件通過・' + fails.length + ' 件失敗');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('実行できなかった: ' + e); process.exit(2); });
