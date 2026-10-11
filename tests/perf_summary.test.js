'use strict';
// UI・UX改修計画 I-02: 速さの測定（perf.js の出力）を、ページごとの中央値にまとめる。
const test = require('node:test');
const assert = require('node:assert');
const P = require('../docs/qa/uiux-2026-10/perf_summary');

const run = (name, lcp, extra = {}) => ({ name, run: 0, ttfb: 100, fcp: 800, lcp, cls: 0.1, tbt: 200, dcl: 900, load: 1500, totalKB: 500, reqs: 40, dom: 1000, htmlBytes: 50000, longTasks: 3, heapMB: 20, lcpEl: 'IMG.hero', ...extra });

test('median: 奇数は真ん中、偶数は真ん中の2つの平均、数でない値は無視', () => {
  assert.strictEqual(P.median([5, 1, 3]), 3);
  assert.strictEqual(P.median([4, 1, 3, 2]), 2.5);
  assert.strictEqual(P.median([null, undefined, NaN, 7]), 7);
  assert.strictEqual(P.median([]), null);
});

test('summarize: 5回の中央値・最小・最大をページごとに出す（外れ値に引っ張られない）', () => {
  const rows = [9000, 10400, 10500, 10600, 30000].map(l => run('top', l)).concat([2000, 2100, 2200].map(l => run('store', l)));
  const s = P.summarize(rows);
  assert.strictEqual(s.top.runs, 5);
  assert.strictEqual(s.top.median.lcp, 10500);
  assert.strictEqual(s.top.min.lcp, 9000);
  assert.strictEqual(s.top.max.lcp, 30000);
  assert.strictEqual(s.store.runs, 3);
  assert.strictEqual(s.store.median.lcp, 2100);
  assert.deepStrictEqual(s.top.lcpElement, { value: 'IMG.hero', times: 5 });
});

test('summarize: 取れなかった項目は null（0 にしない）', () => {
  const s = P.summarize([run('top', 1000, { heapMB: null }), run('top', 1200, { heapMB: null })]);
  assert.strictEqual(s.top.median.heapMB, null);
  assert.strictEqual(s.top.median.lcp, 1100);
});

test('parseJsonl: 空行を飛ばし、壊れた行は何行目かを言う', () => {
  assert.strictEqual(P.parseJsonl('{"name":"a"}\n\n{"name":"b"}\n').length, 2);
  assert.throws(() => P.parseJsonl('{"name":"a"}\nnot json'), /2 行目/);
});

test('tableOf: ページごとに1行の表', () => {
  const t = P.tableOf(P.summarize([run('top', 1000), run('top', 1200), run('top', 1400)]));
  assert.ok(t.split('\n')[0].includes('LCP'));
  assert.ok(t.includes('| top | 3 | 1200 |'));
});

test('summarize: 目標（LCP 2.5s・CLS 0.1）を超えた回数も数える。中央値が目標内でも、割れる指標を見落とさない', () => {
  // ハブの CLS は 5回中4回が 0.013、1回が 0.652 に割れた（2026-10-11 の実測）。中央値は 0.013 で、最大は別の欄にあるが、回数で見える方が読み違えない
  const cls = [0.013, 0.013, 0.013, 0.013, 0.652];
  const s = P.summarize(cls.map(c => run('hub', 1500, { cls: c })));
  assert.strictEqual(s.hub.median.cls, 0.013);
  assert.deepStrictEqual(s.hub.over, { lcp: 0, cls: 1 });
  // 目標ちょうどは超えていない
  assert.deepStrictEqual(P.summarize([run('top', 2500, { cls: 0.1 })]).top.over, { lcp: 0, cls: 0 });
  assert.deepStrictEqual(P.summarize([run('top', 2501, { cls: 0.101 })]).top.over, { lcp: 1, cls: 1 });
  // 取れなかった値（null）は超えた回数に数えない
  assert.deepStrictEqual(P.summarize([run('top', null, { cls: null })]).top.over, { lcp: 0, cls: 0 });
});

test('summarize: LCP になった画像の URL の最頻値を残す（URL を持たない古い行は無視）', () => {
  const rows = [
    run('store', 1700, { lcpUrl: 'https://imgfp.hotp.jp/a_480.jpg' }),
    run('store', 1800, { lcpUrl: 'https://imgfp.hotp.jp/a_480.jpg' }),
    run('store', 1900, { lcpUrl: 'https://imgfp.hotp.jp/b.jpg' }),
    run('store', 2000),
  ];
  assert.deepStrictEqual(P.summarize(rows).store.lcpUrl, { value: 'https://imgfp.hotp.jp/a_480.jpg', times: 2 });
  assert.strictEqual(P.summarize([run('top', 1000)]).top.lcpUrl, null);
});

test('tableOf: 目標を超えた回数の列を出す', () => {
  const t = P.tableOf(P.summarize([run('top', 3000, { cls: 0.2 }), run('top', 1000, { cls: 0.01 }), run('top', 3100, { cls: 0.01 })]));
  assert.ok(t.split('\n')[0].includes('目標超'));
  assert.ok(t.includes('LCP 2/3'), t);
  assert.ok(t.includes('CLS 1/3'), t);
});

test('summarize: 描画されなかった回（FCP か LCP が 0）は中央値に入れず、無効として数える', () => {
  // 画面が消えている間などは、FCP・LCP・CLS が全部 0 で返る（2026-10-11 の測定で22回起きた）。そのまま入れると「速くなった」ように見える
  const rows = [1000, 1200, 1400].map(l => run('top', l)).concat([run('top', 0, { fcp: 0, cls: 0 }), run('top', 0, { fcp: 0, cls: 0 })]);
  const s = P.summarize(rows);
  assert.strictEqual(s.top.runs, 3);
  assert.strictEqual(s.top.invalid, 2);
  assert.strictEqual(s.top.median.lcp, 1200);
  assert.strictEqual(s.top.median.cls, 0.1);
  assert.strictEqual(s.top.min.lcp, 1000);
  assert.deepStrictEqual(s.top.over, { lcp: 0, cls: 0 });
  // FCP だけ 0 でも無効（描画された形跡が無い）
  assert.strictEqual(P.summarize([run('top', 1000, { fcp: 0 })]).top.invalid, 1);
  assert.strictEqual(P.summarize([run('top', 0)]).top.invalid, 1);
});

test('summarize: 全部が無効なページは、中央値を null にして無効の数だけ残す（0 にしない）', () => {
  const s = P.summarize([run('hub', 0, { fcp: 0 }), run('hub', 0, { fcp: 0 })]);
  assert.strictEqual(s.hub.runs, 0);
  assert.strictEqual(s.hub.invalid, 2);
  assert.strictEqual(s.hub.median.lcp, null);
  assert.strictEqual(s.hub.median.cls, null);
  assert.strictEqual(s.hub.lcpElement, null);
});

test('tableOf: 無効の回があれば、回数の欄に出す', () => {
  const t = P.tableOf(P.summarize([run('top', 1000), run('top', 1200), run('top', 0, { fcp: 0 })]));
  assert.ok(t.includes('| top | 2 (無効 1) |'), t);
  assert.ok(P.tableOf(P.summarize([run('top', 1000)])).includes('| top | 1 |'));
});

test('CLI: 無効の回があれば stderr で知らせ、出力に invalidRuns を残す', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-summary-'));
  const file = path.join(dir, 'runs.jsonl');
  const out = path.join(dir, 'out.json');
  try {
    fs.writeFileSync(file, [run('top', 1000), run('top', 1200), run('top', 0, { fcp: 0 })].map(r => JSON.stringify(r)).join('\n') + '\n');
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'docs', 'qa', 'uiux-2026-10', 'perf_summary.js'), file, '--label', 't', '--date', '2026-10-11', '--out', out], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stderr, /無効/);
    const j = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.strictEqual(j.invalidRuns, 1);
    assert.strictEqual(j.pages.top.runs, 2);
    assert.strictEqual(j.pages.top.median.lcp, 1100);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('summarize: Web フォントの通信量とファイル数も中央値に出す（フォントを外す改善案の前後を比べるため）', () => {
  const withFont = (kb, files) => ({ kbType: { Font: kb, Image: 100 }, byType: { Font: files, Image: 3 } });
  const s = P.summarize([run('hub', 1500, withFont(1600, 70)), run('hub', 1500, withFont(1700, 73)), run('hub', 1500, withFont(1675, 72))]);
  assert.strictEqual(s.hub.median.fontKB, 1675);
  assert.strictEqual(s.hub.median.fontFiles, 72);
  // フォントが1つも無いページは 0（取れなかったのではなく、無かった）
  const none = P.summarize([run('store', 1500, { kbType: { Image: 10 }, byType: { Image: 1 } })]);
  assert.strictEqual(none.store.median.fontKB, 0);
  // 内訳を持たない古い行は null（0 にしない）
  assert.strictEqual(P.summarize([run('top', 1500)]).top.median.fontKB, null);
});

test('summarize: 描画側の速さの目安（rendererBenchMs）と負荷（loadAvg1）も中央値に出す。TBT は同じページでも描画側の速さで割れるため、前後の比較で速さがそろっているかを見る', () => {
  const s = P.summarize([run('hub', 1500, { rendererBenchMs: 180, loadAvg1: 2.5 }), run('hub', 1500, { rendererBenchMs: 400, loadAvg1: 9 }), run('hub', 1500, { rendererBenchMs: 200, loadAvg1: 3 })]);
  assert.strictEqual(s.hub.median.rendererBenchMs, 200);
  assert.strictEqual(s.hub.max.rendererBenchMs, 400);
  assert.strictEqual(s.hub.median.loadAvg1, 3);
  // 目安を持たない古い行は null（0 にしない）
  assert.strictEqual(P.summarize([run('top', 1500)]).top.median.rendererBenchMs, null);
});

test('CLI: --note を出力に残す（測った時の事情を、数字と一緒に持ち運ぶ）', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-summary-'));
  const file = path.join(dir, 'runs.jsonl');
  const out = path.join(dir, 'out.json');
  try {
    fs.writeFileSync(file, JSON.stringify(run('top', 1000)) + '\n');
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'docs', 'qa', 'uiux-2026-10', 'perf_summary.js'), file, '--note', '画面を起こした状態で測った', '--note', '2つ目', '--out', out], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(out, 'utf8')).notes, ['画面を起こした状態で測った', '2つ目']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('summarize: 1回ごとの要点（samples）を回の順に残す。中央値だけでは、TBT が端末の負荷で二つに割れたことが見えない', () => {
  const rows = [
    run('hub', 1500, { run: 1, tbt: 2015, cls: 0.652, rendererBenchMs: 400, loadAvg1: 9, power: 'battery', lowPowerMode: 1 }),
    run('hub', 1500, { run: 0, tbt: 178, cls: 0.013, rendererBenchMs: 180, loadAvg1: 2.5, power: 'ac', lowPowerMode: 0 }),
    run('hub', 0, { run: 2, fcp: 0, tbt: 0, cls: 0 }),
  ];
  const s = P.summarize(rows).hub;
  // 無効な回は入れない。回の順に並べる。要点だけ（通信の内訳などは入れない）
  assert.deepStrictEqual(s.samples, [
    { run: 0, url: null, lcp: 1500, cls: 0.013, tbt: 178, rendererBenchMs: 180, loadAvg1: 2.5, power: 'ac', lowPowerMode: 0 },
    { run: 1, url: null, lcp: 1500, cls: 0.652, tbt: 2015, rendererBenchMs: 400, loadAvg1: 9, power: 'battery', lowPowerMode: 1 },
  ]);
  // 目安を持たない古い行は null
  assert.strictEqual(P.summarize([run('top', 1000)]).top.samples[0].rendererBenchMs, null);
  assert.strictEqual(P.summarize([run('top', 1000)]).top.samples[0].power, null);
  // 低電力モードの 0（切）は null にしない（取れなかった null と区別する）
  assert.strictEqual(P.summarize([run('top', 1000, { lowPowerMode: 0 })]).top.samples[0].lowPowerMode, 0);
  assert.strictEqual(P.summarize([run('top', 1000)]).top.samples[0].lowPowerMode, null);
});

test('summarize: store-sample は 1周ごとに別の店。samples に測った URL を残す（どの店の LCP が遅かったかを後から辿れる）', () => {
  // 初めて見られる店の写真は、画像変換サービス（wsrv.nl）の側にキャッシュが無く 3〜4s かかる。同じ店を測り続けると、この遅さが消える（2026-10-11 の実測）
  const rows = [
    run('store-sample', 8004, { run: 0, url: '/stores/J001186933.html' }),
    run('store-sample', 1900, { run: 1, url: '/stores/J000400974.html' }),
    run('store-sample', 6200, { run: 2, url: '/stores/J001147513.html' }),
  ];
  const s = P.summarize(rows)['store-sample'];
  assert.strictEqual(s.runs, 3);
  assert.strictEqual(s.median.lcp, 6200);
  assert.deepStrictEqual(s.over, { lcp: 2, cls: 0 });
  assert.deepStrictEqual(s.samples.map(x => x.url), ['/stores/J001186933.html', '/stores/J000400974.html', '/stores/J001147513.html']);
  // URL を持たない古い行は null
  assert.strictEqual(P.summarize([run('store', 1700)]).store.samples[0].url, null);
});

test('CLI: 端末の CPU 数と、電源（バッテリーか充電器か）の回数を出力の host に残す', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-summary-'));
  const file = path.join(dir, 'runs.jsonl');
  const out = path.join(dir, 'out.json');
  const cli = path.join(__dirname, '..', 'docs', 'qa', 'uiux-2026-10', 'perf_summary.js');
  try {
    fs.writeFileSync(file, [run('top', 1000, { cpus: 8, power: 'battery' }), run('top', 1100, { cpus: 8, power: 'battery' }), run('top', 1200, { power: 'ac' })].map(r => JSON.stringify(r)).join('\n') + '\n');
    const r = cp.spawnSync(process.execPath, [cli, file, '--out', out], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(out, 'utf8')).host, { cpus: 8, power: { battery: 2, ac: 1 }, lowPowerMode: {} });
    // 低電力モードを持つ行は、入り切りの回数を数える（取れなかった null は数えない）
    fs.writeFileSync(file, [run('top', 1000, { power: 'battery', lowPowerMode: 1 }), run('top', 1100, { power: 'battery', lowPowerMode: 1 }), run('top', 1200, { power: 'ac', lowPowerMode: 0 }), run('top', 1300, { power: 'ac', lowPowerMode: null })].map(r => JSON.stringify(r)).join('\n') + '\n');
    assert.strictEqual(cp.spawnSync(process.execPath, [cli, file, '--out', out], { encoding: 'utf8' }).status, 0);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(out, 'utf8')).host.lowPowerMode, { on: 2, off: 1 });
    // 持たない古い行だけのときは、cpus は null・power は空
    fs.writeFileSync(file, JSON.stringify(run('top', 1000)) + '\n');
    assert.strictEqual(cp.spawnSync(process.execPath, [cli, file, '--out', out], { encoding: 'utf8' }).status, 0);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(out, 'utf8')).host, { cpus: null, power: {}, lowPowerMode: {} });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
