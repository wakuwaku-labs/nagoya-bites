// 店舗ページの CLS を、店ごとに1周ずつ測る（UI・UX 改修計画 I-02・U-85。2026-10-12）。
// 使い方: node cls_stores.js <店ID一覧の JSON ファイル> [--out <結果の JSON>] [--no-fonts | --breadcrumb-nowrap]
//   店ID一覧: ["J000015458", ...]（前の結果の JSON〔stores[].id〕でもよい）（店舗ページ `https://nagoya-bites.com/stores/<ID>.html` を開く。BASE で本番以外にもできる）
//   エリア名が長い店のパンくずのずれは、店ごとに決まって起きる（同じ店で 5/5 周）ので、1店1周で足りる。条件は cls_diag.js と同じ（412×823・DPR 1.75・CPU 4倍遅く・遅延 150ms・下り 1.6Mbps・キャッシュなし）。5秒待ってから読む。
//   --no-fonts / --breadcrumb-nowrap は cls_diag.js と同じ（Web フォントを読まない／パンくずを折り返さない1行にする）。
// 出力: 1店1行 `<ID> CLS <値> sum <合計> bcH <パンくずの高さ> <条件>`（入力の直後と判定されて数えなかったずれがあれば `除外 N 件`）、最後に 0.1 を超えた店の数。--out があれば、同じ内容を JSON に残す。
// 画面は起こしたまま測る（caffeinate -u -d -i）。開けなかった店は数に入れず、ERROR として出す。
'use strict';
const puppeteer = require('puppeteer');
const fs = require('fs');
const { clsOf, excludedOf, installLayoutShiftCollector } = require('./cls');

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const OUT = outAt >= 0 ? args[outAt + 1] : null;
const flags = args.filter(a => a.startsWith('--') && a !== '--out');
const rest = args.filter((a, i) => !a.startsWith('--') && !(outAt >= 0 && i === outAt + 1));
const NO_FONTS = flags.includes('--no-fonts');
const NOWRAP = flags.includes('--breadcrumb-nowrap');
const BASE = process.env.BASE || 'https://nagoya-bites.com';
if (rest.length !== 1 || flags.some(f => !['--no-fonts', '--breadcrumb-nowrap'].includes(f)) || (NO_FONTS && NOWRAP) || (outAt >= 0 && !OUT)) {
  console.error('使い方: node cls_stores.js <店ID一覧の JSON ファイル> [--out <結果の JSON>] [--no-fonts | --breadcrumb-nowrap]');
  process.exit(2);
}
const listed = JSON.parse(fs.readFileSync(rest[0], 'utf8'));
const ids = Array.isArray(listed) ? listed : (listed && Array.isArray(listed.stores) ? listed.stores.map(s => s && s.id) : null); // 前の結果の JSON（stores[].id）をそのまま渡して、同じ店を測り直せる
if (!Array.isArray(ids) || !ids.length || ids.some(id => !/^J\d+$/.test(id))) { console.error('店ID一覧は ["J000015458", ...]（または前の結果の JSON）の形で、空でないこと'); process.exit(2); }
const MODE = NO_FONTS ? 'no-fonts' : NOWRAP ? 'breadcrumb-nowrap' : 'normal';
const BLOCKED = ['*googletagmanager.com*', '*google-analytics.com*', '*analytics.google.com*', '*doubleclick.net*']
  .concat(NO_FONTS ? ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] : []);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** パンくずを折り返さない1行にする CSS を最初から入れる（cls_diag.js の --breadcrumb-nowrap と同じ） */
function addNowrap() {
  const add = () => { const h = document.head || document.documentElement; if (!h) return false; const st = document.createElement('style'); st.textContent = '.breadcrumb{white-space:nowrap!important;flex-wrap:nowrap!important;overflow-x:auto!important;}'; h.appendChild(st); return true; };
  if (!add()) { const mo = new MutationObserver(() => { if (add()) mo.disconnect(); }); mo.observe(document, { childList: true, subtree: true }); }
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'shell' });
  const stores = [];
  for (const id of ids) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.bringToFront();
    await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
    const client = await page.createCDPSession();
    await client.send('Network.enable');
    await client.send('Network.setBlockedURLs', { urls: BLOCKED });
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluateOnNewDocument(installLayoutShiftCollector);
    if (NOWRAP) await page.evaluateOnNewDocument(addNowrap);
    try { await page.goto(`${BASE}/stores/${id}.html`, { waitUntil: 'load', timeout: 90000 }); } catch (err) { console.log(`${id} ERROR ${String(err).slice(0, 60)}`); await ctx.close(); continue; }
    await sleep(5000);
    const raw = await page.evaluate(() => { const bc = document.querySelector('.breadcrumb'); return { list: window.__ls, supported: window.__lsSupported, bc: bc ? Math.round(bc.getBoundingClientRect().height) : null }; });
    if (!raw.supported || !Array.isArray(raw.list)) { console.log(`${id} ERROR layout-shift を扱えない`); await ctx.close(); continue; }
    const c = clsOf(raw.list);
    const ex = excludedOf(raw.list); // 入力の直後と判定されて CLS に数えなかったずれ（モバイル相当の表示で、開いた直後の約 0.6 秒に起きることがある。黙って捨てず残す）
    const row = { id, cls: Number(c.cls.toFixed(3)), clsSum: Number(c.sum.toFixed(3)), clsExcluded: Number(ex.value.toFixed(3)), excludedCount: ex.count, breadcrumbHeight: raw.bc };
    stores.push(row);
    console.log(`${id} CLS ${row.cls.toFixed(3)} sum ${row.clsSum.toFixed(3)} bcH ${row.breadcrumbHeight} ${MODE}${ex.count ? ` 除外 ${ex.count} 件（${row.clsExcluded.toFixed(3)}）` : ''}`);
    await ctx.close();
  }
  await browser.close();
  const over = stores.filter(s => s.cls > 0.1);
  console.log(`# ${stores.length} 店のうち CLS が 0.1 を超えた店: ${over.length}${over.length ? '（' + over.map(s => s.id).join('・') + '）' : ''}`);
  const excl = stores.filter(s => s.excludedCount > 0);
  console.log(`# 入力の直後と判定されて数えなかったずれがあった店: ${excl.length}${excl.length ? '（測定環境の影響。cls.js の説明を参照）' : ''}`);
  if (OUT) {
    const result = {
      schema: 'cls-stores/1', date: new Date().toISOString(), base: BASE, mode: MODE,
      conditions: '412x823 DPR1.75・CPU 4倍遅く・遅延150ms・下り1.6Mbps・キャッシュなし・GA4等は止める・読み込み後5秒待つ・1店1周',
      requested: ids.length, measured: stores.length, over01: over.length, excludedStores: excl.length, stores,
    };
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
    console.log(`# 結果を ${OUT} に書いた`);
  }
})().catch(err => { console.error(err); process.exit(1); });
