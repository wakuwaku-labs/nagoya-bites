// 実ブラウザで、perf.js が使う CLS の集め役（cls.js）が正しく動くことを確かめる（I-02・Codex のレビュー 2026-10-12 への対応）。
// 使い方: node docs/qa/uiux-2026-10/e2e_cls.js   （puppeteer と Chrome が要る。外部には通信しない）
//
// 確かめること:
//   E1 集め役が、ページのレイアウトのずれを全部 [開始時刻, 値, 入力の直後なら 1] で集める。ブラウザ自身の記録（hadRecentInput）と一致し、クリック直後のずれには 1 が付く
//   E2 cls.js の CLS（セッション窓の最大）が、このファイルの別の書き方（総当たり）と、実ブラウザのずれで一致する。入力の直後のずれは数えず、excluded に残る
//   E3 全部のずれの合計（clsSum）は CLS 以上で、窓が2つ以上できたときは CLS より大きい
//   E4 perf.js そのものをこのページに向けて1回実行し、行に cls・clsSum・clsWindows・shifts・excluded* が入り、shifts から cls を作り直せる
//
// ずれの起こし方: ページを開いてから 1.2 秒以降に、上に積む空き領域を、+60px・その 0.3 秒後に +40px・その 2.5 秒後に +80px と広げる（間隔の目安は 0.3 秒＝同じ窓・2.5 秒＝別の窓）。
//   1.2 秒以降にするのは、モバイル相当の表示にした実ブラウザでは、ページを開いた直後の約 0.6 秒のずれが、入力が無くても hadRecentInput = true になるため（2026-10-12 の診断）。
//   描画の前に起こしたずれは layout-shift として数えられないことも分かったので、最初の描画（first-contentful-paint）も待つ。
//   端末が忙しくて間隔が崩れても、判定は「実際に取れた時刻」から別の書き方で作り直した値と比べるので、間隔の目安そのものは判定に使わない。
// ずれの確認の最後に、ボタンをクリックして、入力の直後のずれ（hadRecentInput = true）を1つ起こす。
// 注意: perf.js は別のプロセスで動かす。同じプロセスの中で同期的に待つと、このファイルが立てた配信サーバも止まり、ページが読み込めなくなる。
'use strict';
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const puppeteer = require('puppeteer');
const { installLayoutShiftCollector, clsOf, excludedOf, GAP_MS, WINDOW_MS } = require('./cls');

const QUIET_MS = 1200; // ページを開いてからこの時間までは、ずれを起こさない（上の注意）

const FIXTURE = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cls fixture</title><style>body{margin:0;font:16px sans-serif}#space{height:0}.blk{height:300px;background:#cde;padding:8px}button{display:block;width:100%;height:60px}</style></head>
<body><div id="space"></div><div class="blk">ブロック A</div><div class="blk">ブロック B</div><button id="btn" type="button">ずらす</button>
<script>
window.__all = []; // ブラウザ自身が教える、全部のずれ [開始時刻, 値, hadRecentInput]（集め役の結果と見比べるため）
new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { window.__all.push([e.startTime, e.value, !!e.hadRecentInput]); }); }).observe({ type: 'layout-shift', buffered: true });
function grow(px) { var s = document.getElementById('space'); s.style.height = ((parseInt(s.style.height || '0', 10)) + px) + 'px'; }
function after(ms, px) { return new Promise(function (r) { setTimeout(function () { grow(px); r(); }, ms); }); }
// 最初の描画の後、かつページを開いてから ${QUIET_MS}ms 以降に始める
function whenPainted(fn) {
  var t = setInterval(function () {
    if (performance.getEntriesByName('first-contentful-paint').length && performance.now() >= ${QUIET_MS}) { clearInterval(t); requestAnimationFrame(function () { requestAnimationFrame(fn); }); }
  }, 20);
}
whenPainted(async function () { await after(0, 60); await after(300, 40); await after(2500, 80); window.__done = true; });
document.getElementById('btn').addEventListener('click', function () { grow(50); });
</script></body></html>`;

// このファイルの別の書き方（総当たり）。cls.js の sessionWindows とは書き方を変えてある。入力の直後のずれ（3つ目が真）は数えない
function naiveCls(shifts) {
  const s = shifts.filter(x => !x[2]).sort((a, b) => a[0] - b[0]);
  let best = 0, windows = 0;
  for (let i = 0; i < s.length; i++) {
    // i を窓の最初のずれとみなし、続けて入るずれを足す。窓の最初になれるのは、前のずれから 1 秒以上あいているか、前の窓が 5 秒を超えたもの
    let startsWindow = i === 0;
    if (!startsWindow) {
      // i-1 までを順に窓に分けたとき、i が新しい窓の最初になるか
      let w0 = 0;
      for (let j = 1; j <= i; j++) {
        const sameWindow = s[j][0] - s[j - 1][0] < GAP_MS && s[j][0] - s[w0][0] < WINDOW_MS;
        if (!sameWindow) w0 = j;
      }
      startsWindow = w0 === i;
    }
    if (!startsWindow) continue;
    windows++;
    let sum = s[i][1], last = i;
    for (let j = i + 1; j < s.length; j++) {
      if (s[j][0] - s[last][0] < GAP_MS && s[j][0] - s[i][0] < WINDOW_MS) { sum += s[j][1]; last = j; } else break;
    }
    best = Math.max(best, sum);
  }
  return { cls: best, windows };
}

/** 別のプロセスで動かして、終わるまで待つ（待つ間も、このプロセスの配信サーバは動き続ける） */
function runNode(args, env, timeoutMs) {
  return new Promise(resolve => {
    execFile(process.execPath, args, { env: { ...process.env, ...env }, timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ status: error ? (typeof error.code === 'number' ? error.code : null) : 0, killed: !!(error && error.killed), stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

const results = [];
const check = (id, ok, detail) => { results.push({ id, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  ' + detail : ''}`); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

(async () => {
  const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(FIXTURE); } else { res.writeHead(404); res.end('no'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
    await page.evaluateOnNewDocument(installLayoutShiftCollector);
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForFunction('window.__done === true', { timeout: 60000 });
    // クリックで起こすずれ（入力の直後なので hadRecentInput が true になる）
    const tClick = await page.evaluate(() => performance.now());
    await page.click('#btn');
    await new Promise(r => setTimeout(r, 800));
    const got = await page.evaluate(() => ({ ls: window.__ls, all: window.__all, supported: window.__lsSupported }));

    check('E0 集め役が入った（layout-shift を扱える）', got.supported === true);
    const inputShifts = got.all.filter(e => e[2]);
    check('E1a クリック直後のずれが、ブラウザの全部のずれの中に1つ以上ある（入力の判定が働いている）', inputShifts.length >= 1 && inputShifts.every(e => e[0] >= tClick), `全部 ${got.all.length} 件・入力直後 ${inputShifts.length} 件`);
    check('E1b 集め役の件数 = ブラウザの全部のずれの件数（入力の直後のずれも捨てない）', got.ls.length === got.all.length, `集め役 ${got.ls.length} 件 / ブラウザ ${got.all.length} 件`);
    check('E1c 集め役の「入力の直後」の印が、ブラウザの hadRecentInput と一致する', got.ls.length === got.all.length && got.ls.every((s, i) => s[0] === got.all[i][0] && s[1] === got.all[i][1] && Boolean(s[2]) === got.all[i][2]), JSON.stringify(got.ls.map(s => [Math.round(s[0]), s[2]])));
    const counted = got.ls.filter(s => !s[2]);
    check('E1d 入力以外のずれが2つ以上（意図した3回のうち、別の窓になる2回は必ず入る）', counted.length >= 2, JSON.stringify(counted.map(s => [Math.round(s[0]), Number(s[1].toFixed(4))])));
    check(`E1e クリックの前に、入力の直後と判定されたずれが無い（ページを開いてから ${QUIET_MS}ms 以降にずれを起こしたので）`, !got.ls.some(s => s[2] && s[0] < tClick), JSON.stringify(got.ls.filter(s => s[2] && s[0] < tClick).map(s => Math.round(s[0]))));

    const c = clsOf(got.ls);
    const naive = naiveCls(got.ls);
    check('E2a cls.js の CLS が、別の書き方（総当たり）と一致する', near(c.cls, naive.cls), `cls.js ${c.cls.toFixed(6)} / 総当たり ${naive.cls.toFixed(6)}`);
    check('E2b 窓の数が一致する', c.windows.length === naive.windows, `${c.windows.length} / ${naive.windows}`);
    const ex = excludedOf(got.ls);
    const exAll = got.all.filter(e => e[2]);
    check('E2c 数えなかったずれ（excluded）の件数・合計が、ブラウザの hadRecentInput のずれと一致する', ex.count === exAll.length && near(ex.value, exAll.reduce((a, e) => a + e[1], 0)), `${ex.count} 件・${ex.value.toFixed(4)}`);
    check('E2d CLS には、入力の直後のずれの値が入っていない（全部の合計から引いた値と一致）', near(c.sum, got.all.filter(e => !e[2]).reduce((a, e) => a + e[1], 0)));
    const gaps = counted.slice(1).map((s, i) => Math.round(s[0] - counted[i][0]));
    console.log('     数えたずれの間隔 ms:', JSON.stringify(gaps), '・窓:', JSON.stringify(c.windows.map(w => [Math.round(w.start), w.count, Number(w.value.toFixed(4))])));
    check('E3a 合計 ≥ CLS', c.sum >= c.cls - 1e-12, `合計 ${c.sum.toFixed(6)} / CLS ${c.cls.toFixed(6)}`);
    if (c.windows.length >= 2) check('E3b 窓が2つ以上なら 合計 > CLS（足し算は過大になる）', c.sum > c.cls, `差 ${(c.sum - c.cls).toFixed(6)}`);
    else console.log('     （端末が忙しく、窓が1つにまとまった。E3b は飛ばす）');

    // E4: perf.js そのものを、このページに向けて1回実行する（別のプロセス。待つ間もこのプロセスの配信サーバは動く）
    const r = await runNode([path.join(__dirname, 'perf.js'), '1'], { BASE: base, ONLY: 'top' }, 280000);
    const line = r.stdout.split('\n').filter(Boolean).pop();
    let row = null;
    try { row = JSON.parse(line); } catch (e) { /* 下で失敗にする */ }
    check('E4a perf.js が1行の測定を出力した', !!row, row ? '' : `exit ${r.status}${r.killed ? '（時間切れ）' : ''} ${r.stderr.trim().split('\n').slice(-4).join(' / ').slice(0, 400)}`);
    if (row) {
      const keys = ['cls', 'clsSum', 'clsWindows', 'clsExcluded', 'excludedCount'];
      check('E4b 行に cls・clsSum・clsWindows・shifts・clsExcluded・excludedCount・excludedShifts が入っている', keys.every(k => typeof row[k] === 'number') && Array.isArray(row.shifts) && Array.isArray(row.excludedShifts), JSON.stringify({ cls: row.cls, clsSum: row.clsSum, clsWindows: row.clsWindows, shifts: row.shifts && row.shifts.length, clsExcluded: row.clsExcluded, excludedCount: row.excludedCount }));
      check('E4c shifts から作り直した CLS が、行の cls と一致する（小数3桁）', row.shifts && near(Number(clsOf(row.shifts).cls.toFixed(3)), row.cls, 0.0011), `行 ${row.cls} / 作り直し ${row.shifts && clsOf(row.shifts).cls.toFixed(4)}`);
      check('E4d clsSum ≥ cls', row.clsSum >= row.cls - 1e-9);
      check('E4e 描画された回として数えられる（fcp・lcp が 0 より大きい）', row.fcp > 0 && row.lcp > 0, `fcp ${row.fcp} / lcp ${row.lcp}`);
      check(`E4f perf.js は入力を出さないので、入力の直後と判定されたずれは 0 件（ページが ${QUIET_MS}ms 以降にずれを起こすため）`, row.excludedCount === 0 && row.clsExcluded === 0, `excludedCount ${row.excludedCount} / clsExcluded ${row.clsExcluded}`);
      check('E4g 絞った条件（通信と CPU）でも、ずれが2つ以上取れて CLS が 0 より大きい', row.shifts && row.shifts.length >= 2 && row.cls > 0, `shifts ${row.shifts && row.shifts.length} / cls ${row.cls} / clsWindows ${row.clsWindows}`);
    }
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  const bad = results.filter(x => !x.ok).length;
  console.log(`\n${results.length - bad}/${results.length} 件通過`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('実行できなかった:', e); process.exit(2); });
