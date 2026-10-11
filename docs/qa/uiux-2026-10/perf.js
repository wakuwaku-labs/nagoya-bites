// 表示速度の実測（本番・スマホ相当: 412x823・CPU 4倍遅く・150ms/1.6Mbps）。GA4 などの計測は遮断。
// 使い方: node perf.js [回数] > runs.jsonl   （ONLY=top,hub のように絞れる。集計は perf_summary.js）
// 測る順は「ページ種別を一周 × 回数」。同じページを続けて測ると、その間の端末の負荷の変化が1ページに偏るため。
// CLS は web.dev の定義（いちばん大きいセッション窓の値）で計算する（cls.js）。ずれの生の値 shifts を1回ごとの行に残すので、後から同じ値を作り直せる。全部のずれの合計は clsSum（旧定義・比べない）。
// 描画されなかった回（FCP が 0）は最大2回やり直す。画面が消えている間などは、ページが「見えない」扱いになって FCP・LCP・CLS が全部 0 で返り、
// そのまま中央値に入れると「速くなった」ように見えるため。やり直しても描画されなかった行は、summary 側が無効として数える。
// 1回ごとに電源（power: ac か battery・macOS のみ）と、描画側の速さの目安（rendererBenchMs＝測定が終わった後、同じページの中で決まった量の計算に
// かかった ms。CPU 4倍遅くの下）、Node 側の負荷（loadAvg1・cpus）を残す。**TBT は同じページ・同じ内容でも、電源で数十 ms と数秒に割れた**（2026-10-11:
// 20:57 JST に充電器を抜いた時刻で、TBT が一段階上がった。pmset のログと一致）。前後の比較は、電源が同じ回どうしで見る。バッテリー駆動のときは警告を出す。
// この Mac は低電力モードが「バッテリー駆動のときだけ」入る設定（pmset -g custom）だったので、電源と一緒に低電力モード（lowPowerMode: 1 入／0 切）も動く。1回ごとに残す。
// store は同じ店を測り続ける（前後で同じ条件にできるが、画像変換サービス wsrv.nl の側にキャッシュができて速く出る）。store-sample は 1周ごとに別の店（sitemap.xml の店舗ページから無作為に選ぶ）
// を測る。実際の訪問はほとんどが初めて見られる店なので、店舗ページの LCP の基線は store-sample で見る（2026-10-11 の実測: 初めて見られる店の写真は 2.9〜4.4s、2回目以降は 0.07〜0.4s）。
// 前と後で別の店になるよう、標本は毎回無作為に選び直し、測った URL は 1行ごとの url に残す。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const { installLayoutShiftCollector, clsFields } = require('./cls');
const BASE = process.env.BASE || 'https://nagoya-bites.com';
const RUNS = Number(process.argv[2] || 1);
const BLOCKED = ['*googletagmanager.com*', '*google-analytics.com*', '*analytics.google.com*', '*doubleclick.net*'];
const URLS_ALL = [
  ['top', '/'],
  ['store', '/stores/J004660861.html'],
  ['store-sample', null], // 1周ごとに別の店（pickStoreSample）
  ['feature', '/features/nagoya-solo-dining.html'],
  ['journal', '/journal/2026-10-11-hoshigaoka-afros-bbq-enkai.html'],
  ['hub', '/stores/area/sakae/izakaya.html'],
  ['features-index', '/features/'],
  ['journal-index', '/journal/'],
];
const URLS = process.env.ONLY ? URLS_ALL.filter(([n]) => process.env.ONLY.split(',').includes(n)) : URLS_ALL;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MAX_ATTEMPTS = 3;

/** 店舗ページの標本。sitemap.xml の店舗ページから無作為に並べ、本番で 200 を返すものを先頭から n 件。測れない店（404 など）は飛ばす */
async function pickStoreSample(n) {
  const xml = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'sitemap.xml'), 'utf8');
  const pool = [...xml.matchAll(/<loc>https?:\/\/[^<\/]+(\/stores\/J\d+\.html)<\/loc>/g)].map(m => m[1]);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const picked = [];
  for (const p of pool) {
    if (picked.length >= n) break;
    try { const res = await fetch(BASE + p, { method: 'HEAD' }); if (res.status === 200) picked.push(p); } catch (e) { /* 取れない店は飛ばす */ }
  }
  return picked;
}

/** 電源。macOS の pmset だけ（他は null）。バッテリー駆動かどうかで描画側の速さが変わるかを、後から見られるように残す */
function powerSource() {
  try {
    const out = execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8', timeout: 3000 });
    if (/AC Power/.test(out)) return 'ac';
    if (/Battery Power/.test(out)) return 'battery';
  } catch (e) { /* pmset が無い・失敗: 取れなかったものは null */ }
  return null;
}

/** 低電力モード。pmset -g が今の値（1: 入っている／0: 切れている）を返す。電源の設定に連動して入り切りされることがあるので、電源と別に残す */
function lowPowerMode() {
  try {
    const m = /lowpowermode\s+(\d)/.exec(execFileSync('pmset', ['-g'], { encoding: 'utf8', timeout: 3000 }));
    if (m) return Number(m[1]);
  } catch (e) { /* pmset が無い・失敗: 取れなかったものは null */ }
  return null;
}

async function measure(browser, url) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.bringToFront();
  await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  await client.send('Network.setBlockedURLs', { urls: BLOCKED });
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0, reqs = 0;
  const byType = {}, idType = {}, kbType = {}, hosts = {}, big = [];
  client.on('Network.responseReceived', e => { const t = e.type || 'Other'; byType[t] = (byType[t] || 0) + 1; idType[e.requestId] = [t, e.response.url]; try { const h = new URL(e.response.url).host; hosts[h] = (hosts[h] || 0) + 1; } catch (x) {} });
  client.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; reqs++; const [t, u] = idType[e.requestId] || ['?', '']; kbType[t] = (kbType[t] || 0) + e.encodedDataLength / 1024; if (e.encodedDataLength > 150000) big.push([Math.round(e.encodedDataLength / 1024), u.slice(0, 110)]); });
  await page.evaluateOnNewDocument(installLayoutShiftCollector); // CLS はずれの生の値を集め、Node 側でセッション窓の最大を計算する（cls.js）
  await page.evaluateOnNewDocument(() => {
    window.__p = { lcp: 0, lcpEl: '', lcpUrl: '', lt: [] };
    try { localStorage.setItem('pwa-banner-dismissed', String(Date.now())); } catch (e) {}
    window.addEventListener('beforeinstallprompt', e => { e.stopImmediatePropagation(); e.preventDefault(); }, true);
    new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__p.lcp = e.startTime; window.__p.lcpUrl = e.url || ''; window.__p.lcpEl = (e.element && (e.element.tagName + '.' + String(e.element.className).slice(0, 40))) || e.url || ''; } }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__p.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 120000 }).catch(e => console.error('goto', url, e.message));
  const loadWall = Date.now() - t0;
  await sleep(5000);
  const r = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0;
    const tbt = window.__p.lt.filter(([s]) => s > fcp).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    return {
      ttfb: Math.round(nav.responseStart || 0), fcp: Math.round(fcp), lcp: Math.round(window.__p.lcp), lcpEl: window.__p.lcpEl, lcpUrl: window.__p.lcpUrl,
      dcl: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0),
      ls: { list: window.__ls || [], supported: !!window.__lsSupported }, tbt: Math.round(tbt), longTasks: window.__p.lt.length,
      htmlBytes: nav.encodedBodySize || 0, dom: document.getElementsByTagName('*').length,
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      visibility: document.visibilityState,
    };
  });
  // 描画側の速さの目安。上の測定が済んだ後に、同じページの中で決まった量の計算にかかった ms（CPU 4倍遅くの下）。測定には混ぜない
  const rendererBenchMs = await page.evaluate(() => { const t = performance.now(); let x = 0; for (let i = 1; i <= 3000000; i++) x += Math.sqrt(i) % 7; return x >= 0 ? Math.round(performance.now() - t) : -1; }).catch(() => null);
  await ctx.close();
  for (const k in kbType) kbType[k] = Math.round(kbType[k]);
  const { ls, ...rest } = r;
  return { ...rest, ...clsFields(ls), rendererBenchMs, totalKB: Math.round(bytes / 1024), reqs, byType, kbType, hosts, big, loadWall };
}

/** 電源が変わった・バッテリー駆動のときに知らせる。バッテリー駆動の TBT は、充電器につないだときより大きく出る（2026-10-11 の実測） */
let lastPower;
function warnPower(power, run, lpm) {
  const key = `${power}/${lpm}`;
  if (key === lastPower) return;
  const lpmText = lpm === 1 ? '低電力モード: 入' : lpm === 0 ? '低電力モード: 切' : '低電力モード: 不明';
  if (power === 'battery') console.error(`⚠️ バッテリー駆動で測っている（run ${run}・${lpmText}）。TBT は充電器につないだときより大きく出る。前後の比較は電源をそろえる`);
  else console.error(`電源: ${power || '不明'}・${lpmText}（run ${run}）${lastPower ? `。直前は ${lastPower}` : ''}`);
  lastPower = key;
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: ['--lang=ja-JP', '--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  try {
    const sample = URLS.some(([n]) => n === 'store-sample') ? await pickStoreSample(RUNS) : [];
    if (sample.length) console.error(`店舗ページの標本 ${sample.length} 件: ${sample.join(' ')}`);
    for (let i = 0; i < RUNS; i++) {
      for (const [name, fixedUrl] of URLS) {
        const url = name === 'store-sample' ? sample[i] : fixedUrl;
        if (!url) { console.error(`skip ${name} run ${i}: 標本が足りない`); continue; }
        try {
          let r, attempt = 0, host;
          do {
            host = { power: powerSource(), lowPowerMode: lowPowerMode(), loadAvg1: Number(os.loadavg()[0].toFixed(2)), cpus: os.cpus().length };
            warnPower(host.power, i, host.lowPowerMode);
            r = await measure(browser, url);
            attempt++;
            if (!(r.fcp > 0 && r.lcp > 0)) console.error(`unpainted ${name} run ${i} attempt ${attempt} visibility=${r.visibility}`);
          } while (!(r.fcp > 0 && r.lcp > 0) && attempt < MAX_ATTEMPTS);
          console.log(JSON.stringify({ name, run: i, url, attempts: attempt, ...host, ...r }));
        } catch (e) { console.error('fail', name, e.message); }
      }
    }
  } finally { await browser.close(); }
})();
