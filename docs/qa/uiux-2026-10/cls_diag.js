// CLS（レイアウトのずれ）の原因を調べる診断（UI・UX改修計画 I-02。2026-10-12）。perf.js が「どのくらいずれたか」を測るのに対し、こちらは「どの要素が、いつ、なぜずれたか」を見る。
// 使い方: node cls_diag.js <URL> [周回数=5] [--no-fonts | --breadcrumb-nowrap]
//   何も付けない      : 今のページのまま
//   --no-fonts        : Web フォント（fonts.googleapis.com・fonts.gstatic.com）を読まない。ずれが消えれば、原因はフォントの読み込み
//   --breadcrumb-nowrap: パンくず（.breadcrumb）を、折り返さない1行にする CSS を最初から入れる。ずれが消えれば、原因はパンくずの折り返し（I-37 の確かめ）
// 条件は perf.js と同じ（412×823・DPR 1.75・CPU 4倍遅く・遅延 150ms・下り 1.6Mbps・キャッシュなし・GA4 などは止める）。5秒待ってから読む。画面は起こしたまま測る（caffeinate）。
// 1周ごとに出すもの:
//   ・CLS（いちばん大きいセッション窓）と、全部のずれの合計（cls.js の定義）
//   ・0.01 以上のずれごとに、時刻・値・ずれた要素（前の位置の y → 今の y）
//   ・h1 より上にある要素（h1 と、その祖先の前の兄弟）で、高さが 8px 以上変わったものの時刻（50ms ごとに見ている）
//   ・ずれの前後に、読み込み済みの Web フォントが増えていく様子（読み込み済み/読み込み中）
// 2026-10-12 に本番で測った結果（`docs/uiux-overhaul-plan-2026-10.md` の U-53・U-85）:
//   ・ハブ: パンくずの高さが 107px ↔ 87px に変わり、下の部分が 21px 下がって戻る（0.309＋0.331）。10周のうち3回
//   ・店舗ページ（エリア名が長い店）: パンくずを入れた <nav> の高さが 143px → 93px に変わり、下の部分が約 50px 上がる（0.125〜0.128）
//   ・--no-fonts で、ハブ（10周）・店舗ページ（4周）・ジャーナル（3周）のずれがすべて 0
//   ・--breadcrumb-nowrap で、ハブは 10周とも 0.014〜0.016、エリア名が長い3店は 0.001〜0.010（ジャーナルは変わらない）
'use strict';
const puppeteer = require('puppeteer');
const { clsOf } = require('./cls');

const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const rest = args.filter(a => !a.startsWith('--'));
const URL_ = rest[0];
const LAPS = Number(rest[1] || 5);
const NO_FONTS = flags.includes('--no-fonts');
const NOWRAP = flags.includes('--breadcrumb-nowrap');
if (!URL_ || !/^https?:\/\//.test(URL_) || !Number.isInteger(LAPS) || LAPS < 1 || LAPS > 50 || flags.some(f => !['--no-fonts', '--breadcrumb-nowrap'].includes(f))) {
  console.error('使い方: node cls_diag.js <URL> [周回数 1〜50] [--no-fonts | --breadcrumb-nowrap]');
  process.exit(2);
}
const BLOCKED = ['*googletagmanager.com*', '*google-analytics.com*', '*analytics.google.com*', '*doubleclick.net*']
  .concat(NO_FONTS ? ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] : []);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** ページの中に仕掛ける集め役（evaluateOnNewDocument に関数のまま渡す。外の変数は使えない） */
function collector(nowrap) {
  window.__ls = []; window.__chg = []; window.__fonts = [];
  const name = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const nodeName = n => { if (!n) return null; const e = n.nodeType === 1 ? n : n.parentElement; return e ? name(e) + ' "' + (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12) + '"' : String(n.nodeName); };
  try {
    new PerformanceObserver(list => list.getEntries().forEach(e => window.__ls.push({
      t: Math.round(e.startTime), v: e.value, input: e.hadRecentInput,
      src: (e.sources || []).slice(0, 3).map(s => ({ n: nodeName(s.node), from: Math.round(s.previousRect.y), to: Math.round(s.currentRect.y) })),
    }))).observe({ type: 'layout-shift', buffered: true });
  } catch (err) { /* layout-shift を扱えない */ }
  if (nowrap) {
    const add = () => { const h = document.head || document.documentElement; if (!h) return false; const st = document.createElement('style'); st.textContent = '.breadcrumb{white-space:nowrap!important;flex-wrap:nowrap!important;overflow-x:auto!important;}'; h.appendChild(st); return true; };
    if (!add()) { const mo = new MutationObserver(() => { if (add()) mo.disconnect(); }); mo.observe(document, { childList: true, subtree: true }); }
  }
  const last = {}; // h1 より上の要素の高さ（50ms ごと）と、読み込み済みのフォントの数
  const tick = () => {
    const t = Math.round(performance.now());
    const h1 = document.querySelector('h1');
    if (h1) {
      const seen = new Set();
      for (let n = h1; n && n !== document.body; n = n.parentElement) {
        for (let p = n.previousElementSibling; p; p = p.previousElementSibling) {
          if (seen.has(p)) continue; seen.add(p);
          const k = name(p) + '@' + (p.parentElement ? name(p.parentElement) : ''); const v = Math.round(p.getBoundingClientRect().height);
          if (last[k] !== v) { if (last[k] !== undefined) window.__chg.push({ t, k, from: last[k], to: v }); last[k] = v; }
        }
      }
      const v = Math.round(h1.getBoundingClientRect().height);
      if (last.h1 !== v) { if (last.h1 !== undefined) window.__chg.push({ t, k: 'h1', from: last.h1, to: v }); last.h1 = v; }
    }
    try { const all = [...document.fonts]; const loaded = all.filter(f => f.status === 'loaded').length; const key = loaded + '/' + all.length; if (last.__f !== key) { last.__f = key; window.__fonts.push({ t, loaded, total: all.length }); } } catch (err) { /* document.fonts を扱えない */ }
    if (t < 12000) setTimeout(tick, 50);
  };
  setTimeout(tick, 0);
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'shell' });
  console.log(`# ${URL_}  周回数 ${LAPS}  条件: ${NO_FONTS ? 'Web フォントを読まない' : NOWRAP ? 'パンくずを1行にする' : '今のまま'}`);
  for (let i = 0; i < LAPS; i++) {
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
    await page.evaluateOnNewDocument(collector, NOWRAP);
    try { await page.goto(URL_, { waitUntil: 'load', timeout: 90000 }); } catch (err) { console.log(`lap ${i} 開けなかった: ${String(err).slice(0, 80)}`); await ctx.close(); continue; }
    await sleep(5000);
    const raw = await page.evaluate(() => ({ ls: window.__ls, chg: window.__chg, fonts: window.__fonts }));
    const c = clsOf(raw.ls.map(s => [s.t, s.v, s.input ? 1 : 0]));
    console.log(`lap ${i}  CLS ${c.cls.toFixed(3)}（窓 ${c.windows.length}）・合計 ${c.sum.toFixed(3)}・ずれ ${c.count} 件`);
    const big = raw.ls.filter(s => s.v >= 0.01 && !s.input);
    for (const s of big) console.log(`   ずれ ${s.t}ms ${s.v.toFixed(4)}  ${s.src.map(x => `${x.n} ${x.from}→${x.to}`).join(' ／ ')}`);
    if (big.length) {
      const lo = Math.min(...big.map(s => s.t)) - 1500; const hi = Math.max(...big.map(s => s.t)) + 500;
      const chg = raw.chg.filter(x => x.t >= lo && x.t <= hi && Math.abs(x.to - x.from) >= 8);
      console.log('   高さが変わった要素（h1 より上）:', chg.length ? chg.map(x => `${x.t}ms ${x.k} ${x.from}→${x.to}px`).join(' ／ ') : '（なし）');
      const f = raw.fonts.filter(x => x.t >= lo && x.t <= hi);
      if (f.length) console.log('   読み込み済みのフォント:', f.map(x => `${x.t}ms ${x.loaded}/${x.total}`).join(' '));
    }
    await ctx.close();
  }
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
