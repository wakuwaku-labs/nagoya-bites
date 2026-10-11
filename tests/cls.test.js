'use strict';
/**
 * tests/cls.test.js — I-02（UI・UX改修 段階0）の CLS の計算
 *
 * Codex のレビュー（2026-10-12）の指摘: perf.js は測定中の layout-shift を全部足していた。CLS は「いちばん大きいセッション窓」の値
 * （https://web.dev/articles/cls）なので、足し算は定義違いで、基線を誤らせる。
 * ここでは、窓の切り方（1 秒の間隔・5 秒の上限）、最大の窓を選ぶこと、旧定義の合計との違い、ページに仕掛ける集め役の振る舞いを確かめる。
 * 実ブラウザでの確認は docs/qa/uiux-2026-10/e2e_cls.js。
 *
 * 2026-10-12 の診断: モバイル相当の表示にした実ブラウザでは、入力が1つも無いのに、ページを開いた直後の約 0.6 秒のずれが「直前の入力あり」になる。
 * 集め役は入力の直後のずれも [開始時刻, 値, 1] で残し、CLS には数えず、clsExcluded として別に出す（黙って捨てない）。その扱いもここで確かめる。
 */

const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const C = require('../docs/qa/uiux-2026-10/cls');

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} と ${b} が違う`);

test('何も無ければ CLS は 0、窓は無い', () => {
  const c = C.clsOf([]);
  assert.strictEqual(c.cls, 0);
  assert.strictEqual(c.sum, 0);
  assert.deepStrictEqual(c.windows, []);
  assert.strictEqual(C.clsOf(undefined).cls, 0);
  assert.strictEqual(C.clsOf(null).cls, 0);
});

test('ずれが1つなら、その値が CLS', () => {
  const c = C.clsOf([[1200, 0.04]]);
  near(c.cls, 0.04);
  assert.strictEqual(c.windows.length, 1);
  assert.strictEqual(c.windows[0].count, 1);
});

test('前のずれから 1 秒未満で続くずれは、同じ窓に足す', () => {
  const c = C.clsOf([[1000, 0.03], [1400, 0.02], [2300, 0.01]]);
  assert.strictEqual(c.windows.length, 1);
  near(c.cls, 0.06);
  assert.strictEqual(c.windows[0].count, 3);
});

test('前のずれからちょうど 1 秒（1000ms）あくと、別の窓になる', () => {
  const c = C.clsOf([[1000, 0.03], [2000, 0.02]]);
  assert.strictEqual(c.windows.length, 2, '1000ms は「1 秒未満」ではない');
  near(c.cls, 0.03);
  const d = C.clsOf([[1000, 0.03], [1999.9, 0.02]]);
  assert.strictEqual(d.windows.length, 1, '1000ms 未満なら同じ窓');
});

test('CLS はいちばん大きい窓の値。全部の合計（旧定義）より小さくなる', () => {
  // 3 秒離れた2つの塊: 0.05+0.04 と 0.08
  const c = C.clsOf([[500, 0.05], [900, 0.04], [4000, 0.08]]);
  assert.strictEqual(c.windows.length, 2);
  near(c.cls, 0.09);
  near(c.sum, 0.17);
  assert.ok(c.cls < c.sum);
});

test('最大の窓は、最初でも最後でもよい', () => {
  near(C.clsOf([[0, 0.2], [3000, 0.05], [6000, 0.01]]).cls, 0.2);
  near(C.clsOf([[0, 0.01], [3000, 0.05], [6000, 0.2]]).cls, 0.2);
  near(C.clsOf([[0, 0.01], [3000, 0.2], [6000, 0.05]]).cls, 0.2);
});

test('窓は最初のずれから 5 秒まで。0.9 秒おきに続いても、5 秒を超えたら新しい窓', () => {
  const t = [0, 900, 1800, 2700, 3600, 4500, 5400, 6300]; // 0〜4500 が1つめ（6つ）、5400 から2つめ
  const c = C.clsOf(t.map(x => [x, 0.01]));
  assert.strictEqual(c.windows.length, 2);
  assert.strictEqual(c.windows[0].count, 6);
  assert.strictEqual(c.windows[1].count, 2);
  near(c.cls, 0.06);
  near(c.sum, 0.08);
});

test('ちょうど 5 秒（5000ms）の位置のずれは、前の窓に入らない', () => {
  const c = C.clsOf([[0, 0.01], [800, 0.01], [1600, 0.01], [2400, 0.01], [3200, 0.01], [4000, 0.01], [4800, 0.01], [5000, 0.01]]);
  assert.strictEqual(c.windows.length, 2);
  assert.strictEqual(c.windows[0].count, 7);
  assert.strictEqual(c.windows[1].count, 1);
});

test('入力が時刻順でなくても同じ結果（並べ替えてから窓に分ける）', () => {
  const a = [[4000, 0.08], [500, 0.05], [900, 0.04]];
  const b = [[500, 0.05], [900, 0.04], [4000, 0.08]];
  assert.deepStrictEqual(C.clsOf(a), C.clsOf(b));
});

test('数でない値・0 以下の値・形の違う要素は捨てる（例外にしない）', () => {
  const c = C.clsOf([[100, 0.02], [NaN, 0.5], [200, NaN], [300, 0], [400, -1], null, 'x', [500], [Infinity, 1], [600, 0.03]]);
  assert.strictEqual(c.count, 2);
  near(c.cls, 0.05);
});

test('旧定義との差: perf.js が測定中に足していた値（sum）と、CLS は別の値として返る', () => {
  // 2026-10-11 の測定の形（離れた2つの塊）。足し算だと過大になる
  const c = C.clsOf([[600, 0.06], [650, 0.03], [3500, 0.05]]);
  near(c.sum, 0.14);
  near(c.cls, 0.09);
});

// ── clsFields: 1回分の行に入れる項目 ───────────────────────────────────
test('clsFields: cls・clsSum・窓の数・ずれの生の値を返す（小数 3 桁）', () => {
  const f = C.clsFields({ supported: true, list: [[600.04, 0.0601234], [650.46, 0.0301234], [3500, 0.05]] });
  assert.strictEqual(f.cls, 0.09); // 0.0601234 + 0.0301234 = 0.0902468 → 小数 3 桁で 0.09
  assert.strictEqual(f.clsSum, 0.14);
  assert.strictEqual(f.clsWindows, 2);
  assert.deepStrictEqual(f.shifts, [[600, 0.060123], [650.5, 0.030123], [3500, 0.05]]);
  assert.strictEqual(f.shiftsTruncated, false);
});

test('clsFields: layout-shift を扱えなかったときは null（0 にしない）', () => {
  const f = C.clsFields({ supported: false, list: [] });
  assert.deepStrictEqual(f, { cls: null, clsSum: null, clsWindows: null, shifts: null, shiftsTruncated: false, clsExcluded: null, excludedCount: null, excludedShifts: null });
  assert.strictEqual(C.clsFields(undefined).cls, null);
});

test('clsFields: ずれが1つも無いのは 0（扱えていて、無かった）', () => {
  const f = C.clsFields({ supported: true, list: [] });
  assert.strictEqual(f.cls, 0);
  assert.strictEqual(f.clsWindows, 0);
  assert.deepStrictEqual(f.shifts, []);
  assert.strictEqual(f.excludedCount, 0);
  assert.strictEqual(f.clsExcluded, 0);
  assert.deepStrictEqual(f.excludedShifts, []);
});

test('clsFields: 生の値は上限まで残し、CLS は全部から計算する（上限で切って小さくしない）', () => {
  const list = [];
  for (let i = 0; i < C.MAX_STORED_SHIFTS + 50; i++) list.push([i * 10000, 0.001]); // 10 秒おき: 1つずつ別の窓
  list.push([(C.MAX_STORED_SHIFTS + 100) * 10000, 0.3]);  // 上限の外にある、いちばん大きい窓
  const f = C.clsFields({ supported: true, list });
  assert.strictEqual(f.shifts.length, C.MAX_STORED_SHIFTS);
  assert.strictEqual(f.shiftsTruncated, true);
  assert.strictEqual(f.cls, 0.3);
});

// ── installLayoutShiftCollector: ページの中に仕掛ける集め役 ──────────────
function runCollector(opts) {
  opts = opts || {};
  let handler = null;
  const window = {};
  class PerformanceObserver {
    constructor(fn) { handler = fn; }
    observe(o) { if (opts.unsupported) throw new TypeError('type が layout-shift に対応していない'); this.options = o; }
  }
  const ctx = { window, PerformanceObserver };
  vm.createContext(ctx);
  vm.runInContext('(' + C.installLayoutShiftCollector.toString() + ')()', ctx);
  return { window, emit: entries => handler({ getEntries: () => entries }) };
}

test('集め役: 全部のずれを [開始時刻, 値, 直前の入力があれば 1] で残す（入力の直後のずれも捨てない）', () => {
  const r = runCollector();
  assert.strictEqual(r.window.__lsSupported, true);
  r.emit([
    { startTime: 100, value: 0.02, hadRecentInput: false },
    { startTime: 150, value: 0.4, hadRecentInput: true },
    { startTime: 900, value: 0.01, hadRecentInput: false },
  ]);
  r.emit([{ startTime: 2500, value: 0.03, hadRecentInput: false }]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.window.__ls)), [[100, 0.02, 0], [150, 0.4, 1], [900, 0.01, 0], [2500, 0.03, 0]]);
});

test('集め役: layout-shift を扱えないブラウザでは __lsSupported が false のまま（例外にしない）', () => {
  const r = runCollector({ unsupported: true });
  assert.strictEqual(r.window.__lsSupported, false);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.window.__ls)), []);
});

test('集め役は外の変数を使わない（puppeteer が関数を文字にして送るため）', () => {
  const src = C.installLayoutShiftCollector.toString();
  // 関数の外の名前（GAP_MS など）を参照していたら、ページの中で ReferenceError になる
  assert.ok(!/GAP_MS|WINDOW_MS|MAX_STORED_SHIFTS|sessionWindows|clsOf|require\(/.test(src), src);
});

// ── 入力の直後と判定されたずれ（除外）の扱い ─────────────────────────────
test('入力の直後のずれ（3つ目が 1）は CLS にも合計にも窓にも数えない', () => {
  const c = C.clsOf([[100, 0.5, 1], [700, 0.02, 0], [1200, 0.03, 0], [9000, 0.4, 1]]);
  assert.strictEqual(c.windows.length, 1);
  assert.strictEqual(c.windows[0].count, 2);
  near(c.cls, 0.05);
  near(c.sum, 0.05);
  assert.strictEqual(c.count, 2);
});

test('3つ目が無い形（古い形）は、入力の直後ではないものとして数える', () => {
  near(C.clsOf([[100, 0.02], [400, 0.03]]).cls, 0.05);
  near(C.clsOf([[100, 0.02, 0], [400, 0.03, 0]]).cls, 0.05);
});

test('入力の直後のずれが間にあっても、窓を切らない・つながない（数えないので無かったものとして扱う）', () => {
  // 0 と 900 の間（500）に入力直後のずれがあっても、0 と 900 は 1 秒未満なので同じ窓
  near(C.clsOf([[0, 0.02, 0], [500, 0.3, 1], [900, 0.03, 0]]).cls, 0.05);
  // 入力直後のずれが橋になって、離れた2つのずれを同じ窓にしてしまわない
  const c = C.clsOf([[0, 0.02, 0], [800, 0.3, 1], [1600, 0.03, 0]]);
  assert.strictEqual(c.windows.length, 2);
  near(c.cls, 0.03);
});

test('excludedOf: 入力の直後と判定されたずれの件数と合計。数えるずれ・数でない値は含めない', () => {
  const e = C.excludedOf([[100, 0.02, 1], [200, 0.03, 1], [300, 0.5, 0], [400, 0.5], [NaN, 1, 1], [500, 0, 1], null]);
  assert.strictEqual(e.count, 2);
  near(e.value, 0.05);
  assert.deepStrictEqual(C.excludedOf(undefined), { count: 0, value: 0 });
});

test('clsFields: 入力の直後のずれは shifts に入れず、excluded として別に残す（CLS を小さく見せたことが後から分かる）', () => {
  const f = C.clsFields({ supported: true, list: [[215.04, 0.0613, 1], [514, 0.0397, 1], [3014.4, 0.0841, 0]] });
  assert.strictEqual(f.cls, 0.084);
  assert.strictEqual(f.clsSum, 0.084);
  assert.deepStrictEqual(f.shifts, [[3014.4, 0.0841]]);
  assert.strictEqual(f.excludedCount, 2);
  assert.strictEqual(f.clsExcluded, 0.101);
  assert.deepStrictEqual(f.excludedShifts, [[215, 0.0613], [514, 0.0397]]);
});

test('clsFields: 除外されたずれの生の値は上限（MAX_EXCLUDED_SHIFTS）まで。件数と合計は全部から数える', () => {
  const list = [];
  for (let i = 0; i < C.MAX_EXCLUDED_SHIFTS + 20; i++) list.push([i * 10, 0.001, 1]);
  const f = C.clsFields({ supported: true, list });
  assert.strictEqual(f.excludedShifts.length, C.MAX_EXCLUDED_SHIFTS);
  assert.strictEqual(f.excludedCount, C.MAX_EXCLUDED_SHIFTS + 20);
  assert.strictEqual(f.clsExcluded, Number(((C.MAX_EXCLUDED_SHIFTS + 20) * 0.001).toFixed(3)));
  assert.strictEqual(f.cls, 0);
});

test('perf.js が行に残す項目が cls.js の clsFields の返す項目と対応している（行から作り直せる）', () => {
  const keys = Object.keys(C.clsFields({ supported: true, list: [] })).sort();
  assert.deepStrictEqual(keys, ['cls', 'clsExcluded', 'clsSum', 'clsWindows', 'excludedCount', 'excludedShifts', 'shifts', 'shiftsTruncated']);
});
