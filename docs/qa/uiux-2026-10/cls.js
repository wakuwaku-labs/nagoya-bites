// CLS（Cumulative Layout Shift・レイアウトのずれ）の計算（UI・UX改修計画 I-02）。定義: https://web.dev/articles/cls
//   - 数えるのは、直前の入力（クリック・キー入力）に続かないずれだけ（layout-shift の hadRecentInput が false のもの）
//   - セッション窓 = 前のずれから 1 秒未満で続き、窓の最初のずれから 5 秒未満に収まるずれの塊
//   - CLS = いちばん大きいセッション窓の値。**全部のずれの合計ではない**
//     （2026-10-12: perf.js は初め合計を CLS として残していた。Codex のレビューで定義違いを指摘された。合計は clsSum として残し、CLS とは別の値として扱う）
// perf.js が測るのは、読み込みから 5 秒後まで（ラボの測定）。ページを開いている間ずっと、ではない。
//
// **入力を出していないのに「直前の入力あり」と判定されるずれがある**（2026-10-12 の診断）: モバイル相当の表示（isMobile）にした実ブラウザでは、ページを開いた直後の約 0.6 秒に起きたずれが、
// 入力が1つも無くても hadRecentInput = true になる（PC 相当では起きない。メタの viewport の有無にもよらない。通信と CPU を絞ると約 0.65 秒まで延びた）。
// perf.js は入力を一切出さないので、除外されたずれは本来 0 のはず。集め役は除外されたずれも [開始時刻, 値, 1] として残し、CLS からは除くが、除外した分を clsExcluded として別に出す（黙って捨てない）。
// 実ページは通信と CPU を絞ると最初の描画が 0.65 秒より後になるため、ふだんは影響しない。除外分が出たら、それは測定環境の影響として扱う。
'use strict';

const GAP_MS = 1000;
const WINDOW_MS = 5000;
const MAX_STORED_SHIFTS = 300; // 1回の行に残す、ずれの生の値の上限（これを超えても CLS は全部から計算し、truncated で知らせる）

const MAX_EXCLUDED_SHIFTS = 50; // 1回の行に残す、除外されたずれの生の値の上限

/** ずれの1件が使える形か（[開始時刻, 値, 入力の直後なら 1]。数でない・0 以下の値は使えない） */
const usable = s => Array.isArray(s) && Number.isFinite(s[0]) && Number.isFinite(s[1]) && s[1] > 0;

/** [[開始時刻 ms, 値, 入力の直後なら 1], ...] をセッション窓に分ける。入力の直後のずれ・数でない・0 以下の値は数えない。時刻順でなくてもよい。3つ目が無い形は、入力の直後ではない */
function sessionWindows(shifts) {
  const list = (Array.isArray(shifts) ? shifts : [])
    .filter(s => usable(s) && !s[2])
    .map(s => [s[0], s[1]])
    .sort((a, b) => a[0] - b[0]);
  const windows = [];
  let cur = null;
  for (const [t, v] of list) {
    if (cur && t - cur.end < GAP_MS && t - cur.start < WINDOW_MS) { cur.value += v; cur.end = t; cur.count++; }
    else { cur = { start: t, end: t, value: v, count: 1 }; windows.push(cur); }
  }
  return windows;
}

/** 入力の直後と判定されて CLS に数えなかったずれの件数と合計 */
function excludedOf(shifts) {
  const list = (Array.isArray(shifts) ? shifts : []).filter(s => usable(s) && s[2]);
  return { count: list.length, value: list.reduce((a, s) => a + s[1], 0) };
}

/** CLS（最大の窓）・合計（旧定義）・窓の一覧・ずれの数 */
function clsOf(shifts) {
  const windows = sessionWindows(shifts);
  return {
    cls: windows.reduce((m, w) => Math.max(m, w.value), 0),
    sum: windows.reduce((a, w) => a + w.value, 0),
    windows,
    count: windows.reduce((a, w) => a + w.count, 0),
  };
}

/**
 * ページの中に仕掛ける集め役（puppeteer の evaluateOnNewDocument に関数のまま渡す。外の変数は使えない）。
 * 全部のずれを [開始時刻, 値, 直前の入力があれば 1 なければ 0] で window.__ls に入れる（入力の直後のずれは、数えるかどうかを Node 側で決める）。
 * layout-shift を扱えないブラウザでは __lsSupported が false のまま。
 */
function installLayoutShiftCollector() {
  window.__ls = [];
  window.__lsSupported = false;
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) { window.__ls.push([e.startTime, e.value, e.hadRecentInput ? 1 : 0]); });
    }).observe({ type: 'layout-shift', buffered: true });
    window.__lsSupported = true;
  } catch (err) { /* layout-shift を扱えない */ }
}

/**
 * perf.js の1回分の行に入れる CLS の項目。raw はページから取った { list, supported }。
 * 取れなかったとき（layout-shift を扱えない・何も取れていない）は null（0 にしない）。
 * shifts = CLS に数えたずれ [開始時刻, 値]。excludedShifts = 入力の直後と判定されて数えなかったずれ（perf.js は入力を出さないので、あれば測定環境の影響）。
 */
function clsFields(raw) {
  if (!raw || !raw.supported || !Array.isArray(raw.list)) return { cls: null, clsSum: null, clsWindows: null, shifts: null, shiftsTruncated: false, clsExcluded: null, excludedCount: null, excludedShifts: null };
  const c = clsOf(raw.list);
  const ex = excludedOf(raw.list);
  const r3 = v => Number(v.toFixed(3));
  const pair = s => [Number(s[0].toFixed(1)), Number(s[1].toFixed(6))];
  const kept = raw.list.filter(s => usable(s) && !s[2]);
  const skipped = raw.list.filter(s => usable(s) && s[2]);
  return {
    cls: r3(c.cls), clsSum: r3(c.sum), clsWindows: c.windows.length,
    shifts: kept.slice(0, MAX_STORED_SHIFTS).map(pair),
    shiftsTruncated: kept.length > MAX_STORED_SHIFTS,
    clsExcluded: r3(ex.value), excludedCount: ex.count,
    excludedShifts: skipped.slice(0, MAX_EXCLUDED_SHIFTS).map(pair),
  };
}

module.exports = { GAP_MS, WINDOW_MS, MAX_STORED_SHIFTS, MAX_EXCLUDED_SHIFTS, sessionWindows, excludedOf, clsOf, installLayoutShiftCollector, clsFields };
