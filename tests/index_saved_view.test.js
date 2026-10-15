'use strict';
/**
 * tests/index_saved_view.test.js — I-23（UI・UX改修 段階1a）。I-20 で絞り込みの状態が NB_FILTER（絞り込みシート）に変わったのに合わせて更新。
 *
 * トップ（index.html）の「保存済み」（ナビのリンク）の決まりを確かめる。
 *   1. 保存済みは絞り込み条件の1つ（SHOW_FAVS_ONLY）。applyFilters が AND で絞り（絞り込みの条件・検索語とも）、一覧（#grid）を出す（search-active を付ける）
 *   2. 件数（#cnt・サマリー）・条件の札（保存済み ×）・件数のバッジ（2 か所）・「すべてリセット」・ナビの強調が、その1つの状態を見る。
 *      保存済みだけではシェアのボタンを出さない（URL に載る条件ではない）
 *   3. 保存した店が1件も無いときは、「該当なし」ではなく保存のしかたを案内する。保存した店の中で 0 軒になったときの「外す」案は、保存した店の中で数える
 *   4. 保存した店の記録（nb_favs）が壊れていても例外にしない
 *   5. 保存済みは URL（ハッシュ）に載せない
 *   6. 0 軒の計測（zero_result）: 保存した店がまだ無いだけの 0 軒は送らない。送るときも、検索語・店名・保存した店は含めない
 *   7. 絞り込みシートの「N軒を見る」は、保存済みを入れていれば保存した店の中で数える（一覧と同じ数え方）
 *
 * index.html から実物の関数（getFavs・applyFilters・updateFilterUI・clearAllFilters・showFavs・renderGrid・条件の札と 0 軒の「外す」
 * ボタンのクリック処理など）と、絞り込みの核（NB-FILTER-POLICY・NB-FILTER の区画）を取り出し、偽の DOM の上で動かす。
 * 実ブラウザでの確認は docs/qa/uiux-2026-10/e2e_saved.js。
 * 範囲の外: 絞り込みの核そのもの（tests/index_filter_core.test.js）、シートの開閉・下書き（tests/index_filter_sheet.test.js）。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ── index.html から取り出す ─────────────────────────────────────────────
// index.html の関数は、行頭の `}` で閉じる（中の `}` はインデントされている）
function fnSource(name) {
  const head = '\nfunction ' + name + '(';
  assert.strictEqual(INDEX.split(head).length - 1, 1, `function ${name} は1つだけ定義されている`);
  const a = INDEX.indexOf(head) + 1;
  const b = INDEX.indexOf('\n}\n', a);
  assert.ok(b > a, `function ${name} の終わりが見つからない`);
  return INDEX.slice(a, b + 2);
}
// 開始の印から終了の印まで（印はそれぞれ 1 か所だけ）
function region(start, end) {
  assert.strictEqual(INDEX.split(start).length - 1, 1, `${start} は 1 か所だけ`);
  const a = INDEX.indexOf(start);
  const b = INDEX.indexOf(end, a);
  assert.ok(b > a, `${end} が見つからない`);
  return INDEX.slice(a, b + end.length);
}
// document.addEventListener('click', …) の処理 1 つ（印の直後から、行頭の `});` まで）
function handlerSource(marker) {
  assert.strictEqual(INDEX.split(marker).length - 1, 1, `${marker} は 1 か所だけ`);
  const a = INDEX.indexOf(marker);
  const b = INDEX.indexOf('\n});\n', a);
  assert.ok(b > a, `${marker} の処理の終わりが見つからない`);
  return INDEX.slice(a, b + 5);
}

const ZERO_SENT_DECL = "var NB_ZERO_SENT = '';";
assert.strictEqual(INDEX.split(ZERO_SENT_DECL).length - 1, 1, 'NB_ZERO_SENT の宣言は 1 か所だけ');
const SUGGEST_HANDLER = "// 0 軒の表示の「◯◯を外す（+N軒）」\ndocument.addEventListener('click'";
const CHIP_HANDLER = '// Chip click handler (delegated)';
const SOURCE = [
  region('/* NB-FILTER-POLICY:START */', '/* NB-FILTER-POLICY:END */'),
  region('var GENRE_ORDER = ', '];'),
  region('var GENRE_RULES = [', '\n];'),
  region('// NB-FILTER:START', '// NB-FILTER:END'),
  region('var NB_SHEET = {', '\n];'),
  ZERO_SENT_DECL,
  'var NB_RESTORING = 0;',   // 「戻る」「進む」の読み直し中の印（NB-HISTORY 区画。ここでは常に 0）
  ['normalizeGenre', 'nbEscHtml', 'getFavs', 'nbSyncFavNav', 'applyFilters', 'nbTrackZeroResult', 'nbActiveConditions', 'nbSetBadge',
    'updateFilterUI', 'nbZeroIsProvisional', 'nbEmptySuggestHtml', 'nbDropCondition', 'clearAllFilters', 'showFavs',
    'nbScrollBehavior', 'scrollToMagazine', 'scrollToActiveConditions', 'exitSearchMode', 'renderSkeletons', 'renderGrid', 'nbSheetQuery',
    'nbSheetFooterState', 'nbBuildHash'].map(fnSource).join('\n'),
  handlerSource(SUGGEST_HANDLER),
  handlerSource(CHIP_HANDLER),
].join('\n');

// ── 偽の DOM ───────────────────────────────────────────────────────────
function makeEl(extra) {
  const cls = new Set();
  const el = {
    style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', hidden: false, disabled: false, offsetHeight: 40,
    classList: {
      add: (c) => { cls.add(c); },
      remove: (c) => { cls.delete(c); },
      contains: (c) => cls.has(c),
      toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); return cls.has(c); },
    },
    getBoundingClientRect: () => ({ top: 500, bottom: 560, height: 60 }),
    setAttribute() {},
  };
  return Object.assign(el, extra || {});
}

// vm の中で作られた配列・オブジェクトは、このテストとは別の Object/Array（プロトタイプが違う）なので、deepStrictEqual に渡す前に素の値へそろえる
const plain = (x) => JSON.parse(JSON.stringify(x));
const names = (list) => plain(Array.from(list, (s) => s['店名']));

// ポリシー（ビルドで埋め込まれた、エリア 10 群と条件 13 軸の表）と代表ジャンルの並び。期待値の計算に使う
const PROBE = vm.createContext({ console });
vm.runInContext(SOURCE.split('\nfunction normalizeGenre(')[0], PROBE);
const POLICY = plain(PROBE.NB_FILTER_POLICY);
const AREAS = POLICY.areas.map((a) => a.slug);
const areaLabel = (slug) => POLICY.areas.find((a) => a.slug === slug).label;
const condLabel = (slug) => POLICY.conds.find((c) => c.slug === slug).label;
// 数える店。エリアの原文は、各群の match の 1 つ（ポリシーの表どおりに群へ入る）
const matchOf = (i) => POLICY.areas[i].match[0];
const STORES = [
  { 店名: 'A', ジャンル: '居酒屋', エリア: matchOf(1), 個室: 'あり' },
  { 店名: 'B', ジャンル: '居酒屋', エリア: matchOf(1), 個室: 'あり' },
  { 店名: 'C', ジャンル: '焼肉・ホルモン', エリア: matchOf(2), 個室: 'なし' },
  { 店名: 'D', ジャンル: 'ラーメン', エリア: matchOf(3), 個室: 'なし' },
];
// 5 種類の条件がすべて入った絞り込み
const FULL = { genre: '居酒屋', areas: [AREAS[1]], conds: ['koshitsu'], tags: ['デート'], cap: 20 };

// 実物の関数を読み込んだ、偽のブラウザ環境を作る
function makeEnv(opts) {
  opts = opts || {};
  const storage = { nb_favs: opts.storedFavs === undefined ? null : opts.storedFavs };
  const reads = { getItem: 0 };
  const localStorage = {
    getItem(k) { reads.getItem++; if (opts.storageThrows) throw new Error('blocked'); return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem(k, v) { storage[k] = String(v); },
  };
  const elements = {};
  ['filter-badge', 'tb-filter-badge', 'filter-toggle-btn', 'tb-filter-btn', 'clear-all-btn', 'share-filter-btn', 'active-chips',
    'results-summary-cond', 'results-summary-count', 'nav-fav', 'cnt', 'grid', 'pagination', 'results-block', 'si', 'si2']
    .forEach((id) => { elements[id] = makeEl(); });
  elements.si.value = opts.q || '';
  const body = makeEl();
  const calls = { scrollTo: [], timers: [], cleared: [], rendered: [], scrollToResults: 0, scrollToMagazine: 0, scrollToActive: 0,
    pushHash: 0, applyFilters: 0, renderPage: [], events: [] };
  const handlers = {};
  const document = {
    body,
    getElementById: (id) => (Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
  };
  const window = { pageYOffset: opts.pageYOffset || 0, __scrollToResultsTimer: 123, scrollTo: (o) => { calls.scrollTo.push(o); } };
  const ctx = {
    document, window, localStorage, console,
    setTimeout: (fn, ms) => { calls.timers.push({ fn, ms }); return 99; },
    clearTimeout: (t) => { calls.cleared.push(t); },
    // applyFilters などが参照する、ほかの部分（この確認の対象ではないので偽物）
    ALL_STORES: opts.stores || [], FILTERED: [], SHOW_FAVS_ONLY: !!opts.favsOnly,
    FULL_CATALOG_LOADED: opts.loaded !== false, FULL_CATALOG_FAILED: !!opts.failed,
    SCENE_ALIAS: {}, NB_SEARCH_META: null, RENDER_DATA: [], CURRENT_PAGE: 1, NB_OPEN_REEL: null,
    priceToNum: () => 0,
    // 検索の代わり: 店名にその語を含む店だけを残す（決定的な簡易版。検索そのものはこの確認の対象ではない）
    nbRunSearch: (list, q) => (q ? list.filter((s) => String(s['店名']).indexOf(q) >= 0) : list),
    nbSyncRelevanceSort() {}, nbRenderSearchMeta() {}, nbUpdateSearchClearVisibility() {},
    pushHash() { calls.pushHash++; },
    renderPage(n) { calls.renderPage.push(n); },
    trackEvent(name, params) { calls.events.push([name, params]); },
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  ctx.NB_FILTER = ctx.nbNormalizeFilter(opts.filter || {});
  // 部品の呼び出しを数える（実物は上で読み込んだまま、呼ばれたことだけ数える）
  const wrap = (name, after) => { const orig = ctx[name]; ctx[name] = function () { after.apply(null, arguments); return orig.apply(this, arguments); }; };
  ctx.scrollToResults = function () { calls.scrollToResults++; };
  wrap('scrollToMagazine', () => { calls.scrollToMagazine++; });
  wrap('scrollToActiveConditions', () => { calls.scrollToActive++; });
  const realRenderGrid = ctx.renderGrid;
  ctx.renderGrid = function (data) { calls.rendered.push(data.slice ? data.slice() : data); };
  if (opts.realRenderGrid) ctx.renderGrid = realRenderGrid;
  return { ctx, elements, body, calls, handlers, storage, reads };
}
// 条件の札（span.chip）を押す。委譲のクリック処理は 2 つあり、0 軒の「外す」ボタンが先・条件の札が後
function clickChip(e, dataset) {
  assert.strictEqual(e.handlers.click.length, 2, 'クリックの委譲は 0 軒の「外す」と条件の札の 2 つ');
  const chip = makeEl({ dataset });
  e.handlers.click[1]({ target: { closest: (sel) => (sel === '.chip' ? chip : null) } });
}
function clickSuggest(e, kind, v) {
  const attrs = { 'data-k': kind, 'data-v': v };
  const btn = makeEl({ getAttribute: (n) => attrs[n] });
  e.handlers.click[0]({ target: { closest: (sel) => (sel === '#grid .fs-suggest-btn' ? btn : null) } });
}
// 描画の予約（setTimeout）をまとめて実行する（件数の表示・結果の先頭へのスクロール）
function flushTimers(e) { e.calls.timers.splice(0).forEach((t) => t.fn()); }
const zeroEvents = (e) => plain(e.calls.events.filter((x) => x[0] === 'zero_result'));
// 条件 1 種類を外した絞り込み（期待値の計算）
function without(filter, kind) {
  const f = plain(filter);
  if (kind === 'genre') f.genre = 'All';
  else if (kind === 'cap') f.cap = 0;
  else f[kind + 's'] = [];
  return f;
}

// ── 1. 保存した店名の読み取り ───────────────────────────────────────────
test('getFavs: 保存した店名の配列を返す／無いときは空', () => {
  assert.deepStrictEqual(plain(makeEnv({ storedFavs: '["A","B"]' }).ctx.getFavs()), ['A', 'B']);
  assert.deepStrictEqual(plain(makeEnv({ storedFavs: null }).ctx.getFavs()), []);
});
test('getFavs: 配列でない値・壊れた値・読み書きできない環境でも、例外にせず空として扱う', () => {
  ['{"a":1}', 'null', '"abc"', '5', 'true', '[壊れた', ''].forEach((raw) => {
    const out = makeEnv({ storedFavs: raw }).ctx.getFavs();
    assert.ok(Array.isArray(out) && out.length === 0, `値 ${JSON.stringify(raw)} は空の配列になる: ${JSON.stringify(out)}`);
  });
  assert.deepStrictEqual(plain(makeEnv({ storageThrows: true }).ctx.getFavs()), []);
});

// ── 2. applyFilters: 保存済みは絞り込み条件の1つ ─────────────────────────
test('applyFilters: 保存済みを入れていないときは、今までどおり全店・一覧は隠したまま', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '["A","C"]', favsOnly: false });
  e.ctx.applyFilters();
  assert.deepStrictEqual(names(e.ctx.FILTERED), ['A', 'B', 'C', 'D']);
  assert.strictEqual(e.body.classList.contains('search-active'), false, '条件が無ければ雑誌面のまま');
  assert.strictEqual(e.reads.getItem, 0, '保存済みを使わないときは、保存した店の記録を読まない');
});
test('applyFilters: 保存済みを入れると保存した店だけに絞り、一覧を出す（search-active が付く）', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '["A","C","Z"]', favsOnly: true });
  e.ctx.applyFilters();
  assert.deepStrictEqual(names(e.ctx.FILTERED), ['A', 'C'], '載っていない店名（Z）は無視する');
  assert.strictEqual(e.body.classList.contains('search-active'), true, '一覧（#grid）を隠したままにしない');
  assert.deepStrictEqual(plain(e.calls.rendered.map(names)), [['A', 'C']], '絞った結果をそのまま一覧に描く');
  assert.strictEqual(e.calls.pushHash, 1, 'ほかの条件と同じ流れ（pushHash は1回）');
});
test('applyFilters: 保存済みは絞り込みの条件（NB_FILTER）と AND（保存した店の中から、さらに絞る）', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '["A","C"]', favsOnly: true, filter: { conds: ['koshitsu'] } });
  e.ctx.applyFilters();
  assert.deepStrictEqual(names(e.ctx.FILTERED), ['A'], '個室ありの A だけ。個室ありでも保存していない B は出ない');
  // 保存済みを入れていなければ、個室ありの店は保存の有無に関係なく出る
  const off = makeEnv({ stores: STORES, storedFavs: '["A","C"]', favsOnly: false, filter: { conds: ['koshitsu'] } });
  off.ctx.applyFilters();
  assert.deepStrictEqual(names(off.ctx.FILTERED), ['A', 'B']);
});
test('applyFilters: 保存済みは検索語とも AND（保存していない店は、検索に当たっても出ない）', () => {
  const hit = makeEnv({ stores: STORES, storedFavs: '["A","C"]', favsOnly: true, q: 'A' });
  hit.ctx.applyFilters();
  assert.deepStrictEqual(names(hit.ctx.FILTERED), ['A']);
  const miss = makeEnv({ stores: STORES, storedFavs: '["B","C"]', favsOnly: true, q: 'A' });
  miss.ctx.applyFilters();
  assert.deepStrictEqual(names(miss.ctx.FILTERED), [], '検索に当たる A は保存していないので出ない（OR ではない）');
});
test('applyFilters: 保存した店が無いときは0件で、それでも一覧を出す（案内を見せるため）', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '[]', favsOnly: true });
  e.ctx.applyFilters();
  assert.deepStrictEqual(names(e.ctx.FILTERED), []);
  assert.strictEqual(e.body.classList.contains('search-active'), true);
});
test('applyFilters: 保存した店の記録は、店ごとではなく1回だけ読む', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '["A"]', favsOnly: true });
  e.ctx.applyFilters();
  assert.strictEqual(e.reads.getItem, 1);
});
test('applyFilters: 壊れた記録（配列でない）でも止まらず、保存ゼロとして扱う', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '{"a":1}', favsOnly: true });
  assert.doesNotThrow(() => e.ctx.applyFilters());
  assert.deepStrictEqual(names(e.ctx.FILTERED), []);
});
test('applyFilters: 全店のデータがまだ無い（ALL_STORES が空）あいだは何もしない', () => {
  const e = makeEnv({ stores: [], storedFavs: '["A"]', favsOnly: true });
  e.ctx.applyFilters();
  assert.strictEqual(e.calls.pushHash, 0);
  assert.strictEqual(e.calls.rendered.length, 0);
  assert.strictEqual(e.body.classList.contains('search-active'), false);
});
test('件数（#cnt）は一覧と同じ数になる（件数を別に書き換えない）', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '["A","C"]', favsOnly: true, realRenderGrid: true });
  e.ctx.applyFilters();
  flushTimers(e);
  assert.strictEqual(e.elements.cnt.textContent, '2 件');
  assert.deepStrictEqual(plain(e.calls.renderPage), [1]);
  const none = makeEnv({ stores: STORES, storedFavs: '[]', favsOnly: true, realRenderGrid: true });
  none.ctx.applyFilters();
  flushTimers(none);
  assert.strictEqual(none.elements.cnt.textContent, '0 件');
});
test('applyFilters: シートの外から保存済みを入れたときは結果へ動く予約を入れ、シートを開いている間は入れない', () => {
  const closed = makeEnv({ stores: STORES, storedFavs: '["A"]', favsOnly: true });
  closed.ctx.applyFilters();
  assert.deepStrictEqual(closed.calls.timers.map((t) => t.ms), [80], '80ms 後に結果の先頭へ');
  const open = makeEnv({ stores: STORES, storedFavs: '["A"]', favsOnly: true });
  open.ctx.NB_SHEET.open = true;
  open.ctx.applyFilters();
  assert.deepStrictEqual(open.calls.timers.map((t) => t.ms), [], 'シートを開いている間は動かさない');
  // 条件が何も無ければ、結果へは動かない
  const none = makeEnv({ stores: STORES, favsOnly: false });
  none.ctx.applyFilters();
  assert.deepStrictEqual(none.calls.timers.map((t) => t.ms), []);
});

// ── 2b. 0 軒の計測（zero_result） ───────────────────────────────────────
test('zero_result: 保存した店がまだ1件も無いだけの0軒は送らない（条件のせいではない）', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '[]', favsOnly: true });
  e.ctx.applyFilters();
  assert.deepStrictEqual(zeroEvents(e), []);
  // ほかの条件が付いていても、保存した店が無いこと自体が原因なので送らない
  const withCond = makeEnv({ stores: STORES, storedFavs: '[]', favsOnly: true, filter: { conds: ['koshitsu'] } });
  withCond.ctx.applyFilters();
  assert.deepStrictEqual(zeroEvents(withCond), []);
});
test('zero_result: 保存した店の中で条件が合わず0軒になったときは、条件の種類と値だけを1回送る。同じ条件が続く間は増やさず、変わるか0軒でなくなれば送り直す', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '["C"]', favsOnly: true, filter: { conds: ['koshitsu'] } });
  e.ctx.applyFilters();
  assert.deepStrictEqual(zeroEvents(e), [['zero_result', { condition_kinds: 'cond,favs', condition_count: 2, conditions: 'cond=koshitsu' }]]);
  e.ctx.applyFilters();
  assert.strictEqual(zeroEvents(e).length, 1, '同じ条件の続きでは送らない');
  e.ctx.NB_FILTER = e.ctx.nbNormalizeFilter({ conds: ['lunch'] });
  e.ctx.applyFilters();
  assert.strictEqual(zeroEvents(e).length, 2, '条件が変われば新しく送る');
  e.ctx.NB_FILTER = e.ctx.nbEmptyFilter();
  e.ctx.applyFilters();
  assert.deepStrictEqual(names(e.ctx.FILTERED), ['C'], '条件を外せば 0 軒でなくなる');
  e.ctx.NB_FILTER = e.ctx.nbNormalizeFilter({ conds: ['lunch'] });
  e.ctx.applyFilters();
  assert.strictEqual(zeroEvents(e).length, 3, '0 軒でなくなったあとに同じ 0 軒へ戻れば、また送る');
});
test('zero_result: 検索語・店名・保存した店は送らない（種類 q・favs だけ）', () => {
  const stores = [{ 店名: 'ひみつの店', ジャンル: '居酒屋', エリア: matchOf(1), 個室: 'なし' }];
  const e = makeEnv({ stores, storedFavs: '["ひみつの店"]', favsOnly: true, q: '秘密の検索語' });
  e.ctx.applyFilters();
  const sent = zeroEvents(e);
  assert.strictEqual(sent.length, 1);
  assert.deepStrictEqual(sent[0][1], { condition_kinds: 'favs,q', condition_count: 2, conditions: '' });
  assert.ok(!JSON.stringify(sent).includes('ひみつの店') && !JSON.stringify(sent).includes('秘密の検索語'), JSON.stringify(sent));
});
test('zero_result: 先頭の50店だけで動いている間の0軒は送らず、全店のデータの取得に失敗したあとの0軒は送る', () => {
  const loading = makeEnv({ stores: STORES, storedFavs: '["C"]', favsOnly: true, filter: { conds: ['koshitsu'] }, loaded: false });
  loading.ctx.applyFilters();
  assert.deepStrictEqual(zeroEvents(loading), []);
  const failed = makeEnv({ stores: STORES, storedFavs: '["C"]', favsOnly: true, filter: { conds: ['koshitsu'] }, loaded: false, failed: true });
  failed.ctx.applyFilters();
  assert.strictEqual(zeroEvents(failed).length, 1);
});

// ── 3. updateFilterUI: 件数・条件の札・帯・ナビの強調 ─────────────────────
test('updateFilterUI: 保存済みを入れていなければ、札も強調も出ない', () => {
  const e = makeEnv({ stores: STORES, favsOnly: false });
  e.ctx.FILTERED = STORES.slice();
  e.ctx.updateFilterUI();
  assert.strictEqual(e.elements['active-chips'].innerHTML, '');
  ['filter-badge', 'tb-filter-badge'].forEach((id) => {
    assert.strictEqual(e.elements[id].style.display, 'none', id);
    assert.strictEqual(e.elements[id].hidden, true, id);
    assert.strictEqual(e.elements[id].textContent, '0', id);
  });
  assert.strictEqual(e.elements['clear-all-btn'].style.display, 'none');
  assert.strictEqual(e.elements['share-filter-btn'].style.display, 'none');
  assert.strictEqual(e.elements['nav-fav'].style.borderBottom, '');
  assert.strictEqual(e.elements['filter-toggle-btn'].classList.contains('has-filters'), false);
  assert.ok(e.elements['results-summary-cond'].innerHTML.includes('条件なし'));
});
test('updateFilterUI: 保存済みを入れると、札・条件の数（バッジ 2 か所）・帯・ナビの強調が揃う。保存済みだけではシェアのボタンを出さない', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true });
  e.ctx.FILTERED = [STORES[0], STORES[2]];
  e.ctx.updateFilterUI();
  assert.strictEqual(e.elements['active-chips'].innerHTML, '<span class="chip" data-clear="favs">保存済み <span class="chip-x">×</span></span>');
  ['filter-badge', 'tb-filter-badge'].forEach((id) => {
    assert.strictEqual(e.elements[id].textContent, '1', id);
    assert.strictEqual(e.elements[id].style.display, 'inline-flex', id);
    assert.strictEqual(e.elements[id].hidden, false, id);
  });
  ['filter-toggle-btn', 'tb-filter-btn'].forEach((id) => assert.strictEqual(e.elements[id].classList.contains('has-filters'), true, id));
  assert.strictEqual(e.elements['clear-all-btn'].style.display, '', '「すべてリセット」が出る');
  assert.strictEqual(e.elements['share-filter-btn'].style.display, 'none', '保存した店はこの端末だけの情報なので、シェアする条件ではない');
  assert.ok(e.elements['results-summary-cond'].innerHTML.includes('保存済み'));
  assert.strictEqual(e.elements['results-summary-count'].textContent, '2');
  assert.strictEqual(e.elements['nav-fav'].style.borderBottom, '2px solid var(--gold)');
});
test('updateFilterUI: ほかの条件があるときは、保存済みの札が先頭で、条件の数は足し算。URL に載る条件があればシェアのボタンも出す', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true, filter: FULL, q: '焼肉' });
  e.ctx.FILTERED = [STORES[0]];
  e.ctx.updateFilterUI();
  const chips = Array.from(e.elements['active-chips'].innerHTML.matchAll(/<span class="chip" data-clear="([a-z]+)"(?: data-v="([^"]*)")?>([\s\S]*?) <span class="chip-x">×<\/span><\/span>/g))
    .map((m) => [m[1], m[2] === undefined ? null : m[2], m[3]]);
  assert.deepStrictEqual(chips, [
    ['favs', null, '保存済み'],
    ['area', AREAS[1], areaLabel(AREAS[1])],
    ['genre', '居酒屋', '居酒屋'],
    ['cond', 'koshitsu', condLabel('koshitsu')],
    ['tag', 'デート', 'デート'],
    ['cap', '20', '20名以上'],
    ['q', null, '&ldquo;焼肉&rdquo;'],
  ]);
  ['filter-badge', 'tb-filter-badge'].forEach((id) => assert.strictEqual(e.elements[id].textContent, '7', id));
  assert.strictEqual(e.elements['share-filter-btn'].style.display, '', '絞り込み・検索語は URL に載るのでシェアできる');
});
test('updateFilterUI: 状態を戻して呼び直すと、強調と札が消える（どの経路で外しても同じ）', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true });
  e.ctx.FILTERED = [];
  e.ctx.updateFilterUI();
  e.ctx.SHOW_FAVS_ONLY = false;
  e.ctx.updateFilterUI();
  assert.strictEqual(e.elements['nav-fav'].style.borderBottom, '');
  assert.strictEqual(e.elements['active-chips'].innerHTML, '');
  assert.strictEqual(e.elements['filter-badge'].style.display, 'none');
});
test('updateFilterUI: 先頭の50店だけで動いている間の0軒は件数を「--」にする（保存した店がまだ無いときは本当の0なので「0」）', () => {
  const loading = makeEnv({ stores: STORES, storedFavs: '["C"]', favsOnly: true, filter: { conds: ['koshitsu'] }, loaded: false });
  loading.ctx.FILTERED = [];
  loading.ctx.updateFilterUI();
  assert.strictEqual(loading.elements['results-summary-count'].textContent, '--');
  const noSaved = makeEnv({ stores: STORES, storedFavs: '[]', favsOnly: true, loaded: false });
  noSaved.ctx.FILTERED = [];
  noSaved.ctx.updateFilterUI();
  assert.strictEqual(noSaved.elements['results-summary-count'].textContent, '0');
  const loaded = makeEnv({ stores: STORES, storedFavs: '["C"]', favsOnly: true, filter: { conds: ['koshitsu'] } });
  loaded.ctx.FILTERED = [];
  loaded.ctx.updateFilterUI();
  assert.strictEqual(loaded.elements['results-summary-count'].textContent, '0');
});

// ── 4. 保存済みを外す経路 ───────────────────────────────────────────────
test('条件の札「保存済み ×」を押すと、保存済みだけが外れて絞り込みを作り直す（ほかの条件は残る）', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true, filter: FULL });
  let seen = null;
  e.ctx.applyFilters = function () { e.calls.applyFilters++; seen = e.ctx.SHOW_FAVS_ONLY; };
  clickChip(e, { clear: 'favs' });
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, false);
  assert.strictEqual(e.calls.applyFilters, 1);
  assert.strictEqual(seen, false, 'applyFilters を呼ぶ前に外れている');
  assert.deepStrictEqual(plain(e.ctx.NB_FILTER), plain(e.ctx.nbNormalizeFilter(FULL)), '絞り込みの条件は触らない');
});
[['genre', '居酒屋'], ['area', AREAS[1]], ['cond', 'koshitsu'], ['tag', 'デート'], ['cap', '20']].forEach(([kind, v]) => {
  test(`ほかの札（${kind}）を外しても、その条件だけが外れ、保存済みは残る`, () => {
    const e = makeEnv({ stores: STORES, favsOnly: true, filter: FULL });
    e.ctx.applyFilters = function () { e.calls.applyFilters++; };
    clickChip(e, { clear: kind, v });
    assert.deepStrictEqual(plain(e.ctx.NB_FILTER), without(e.ctx.nbNormalizeFilter(FULL), kind));
    assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, true);
    assert.strictEqual(e.calls.applyFilters, 1);
  });
});
test('検索語の札を外すと、検索欄（2 つ）が空になり、保存済みは残る', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true, q: '焼肉' });
  e.elements.si2.value = '焼肉';
  e.ctx.applyFilters = function () { e.calls.applyFilters++; };
  clickChip(e, { clear: 'q' });
  assert.strictEqual(e.elements.si.value, '');
  assert.strictEqual(e.elements.si2.value, '');
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, true);
  assert.strictEqual(e.calls.applyFilters, 1);
});
test('札でないものを押しても（data-clear が無い）、何も起きない', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true, filter: FULL });
  e.ctx.applyFilters = function () { e.calls.applyFilters++; };
  clickChip(e, {});
  assert.strictEqual(e.calls.applyFilters, 0);
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, true);
});
test('clearAllFilters（すべてリセット・フィルターをリセット）は、保存済み・絞り込みの条件・検索語をすべて外してから、絞り込みを作り直す', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true, filter: FULL, q: '焼肉' });
  e.elements.si2.value = '焼肉';
  let seen = null;
  e.ctx.applyFilters = function () {
    e.calls.applyFilters++;
    seen = { favs: e.ctx.SHOW_FAVS_ONLY, filter: plain(e.ctx.NB_FILTER), q: e.elements.si.value, q2: e.elements.si2.value };
  };
  e.ctx.clearAllFilters();
  assert.deepStrictEqual(seen, { favs: false, filter: plain(e.ctx.nbEmptyFilter()), q: '', q2: '' });
  assert.strictEqual(e.calls.applyFilters, 1);
});
test('0 軒の「◯◯を外す」ボタンを押すと、その条件だけが外れ、保存済みは残る（検索語の案は検索欄を空にする）', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true, filter: { genre: 'ラーメン', conds: ['koshitsu'] } });
  e.ctx.applyFilters = function () { e.calls.applyFilters++; };
  clickSuggest(e, 'cond', 'koshitsu');
  assert.deepStrictEqual(plain(e.ctx.NB_FILTER), { genre: 'ラーメン', areas: [], conds: [], tags: [], cap: 0 });
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, true);
  assert.strictEqual(e.calls.applyFilters, 1);
  const q = makeEnv({ stores: STORES, favsOnly: true, q: '焼肉' });
  q.elements.si2.value = '焼肉';
  q.ctx.applyFilters = function () { q.calls.applyFilters++; };
  clickSuggest(q, 'q', '焼肉');
  assert.strictEqual(q.elements.si.value, '');
  assert.strictEqual(q.elements.si2.value, '');
  assert.strictEqual(q.ctx.SHOW_FAVS_ONLY, true);
  assert.strictEqual(q.calls.applyFilters, 1);
});

// ── 5. ナビの「保存済み」（showFavs） ───────────────────────────────────
test('showFavs: 押すと保存済みを入れ、絞り込みを作り直し、札が見える位置へ動く（結果の先頭の予約は取り消す）', () => {
  const e = makeEnv({ stores: STORES });
  e.ctx.applyFilters = function () { e.calls.applyFilters++; };
  e.ctx.showFavs();
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, true);
  assert.strictEqual(e.calls.applyFilters, 1, '一覧・件数・札・強調は applyFilters 1本に任せる');
  assert.deepStrictEqual(plain(e.calls.cleared), [123], 'applyFilters が入れた「結果の先頭へ」の予約を取り消す');
  assert.strictEqual(e.calls.scrollToActive, 1);
  assert.strictEqual(e.calls.scrollToMagazine, 0);
});
test('showFavs: もう一度押すと外れ、ほかに条件が残っていなければ雑誌面へ戻る', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true });
  e.ctx.applyFilters = function () { e.calls.applyFilters++; /* 条件が無いので search-active は付かない */ };
  e.ctx.showFavs();
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, false);
  assert.strictEqual(e.calls.scrollToMagazine, 1);
  assert.strictEqual(e.calls.scrollToActive, 0);
});
test('showFavs: 外したあとに、ほかの条件が残っているときは雑誌面へ戻さない（結果を見ている途中なので）', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true, filter: { conds: ['koshitsu'] } });
  e.ctx.applyFilters = function () { e.body.classList.add('search-active'); };
  e.ctx.showFavs();
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, false);
  assert.strictEqual(e.calls.scrollToMagazine, 0);
  assert.strictEqual(e.calls.scrollToActive, 0);
  assert.deepStrictEqual(plain(e.ctx.NB_FILTER).conds, ['koshitsu'], '絞り込みの条件は触らない');
});
test('showFavs: 実物の applyFilters と通して、押すと保存した店だけの一覧になり、もう一度押すと全店・雑誌面に戻る', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '["A","C"]', realRenderGrid: true });
  e.ctx.showFavs();
  assert.deepStrictEqual(names(e.ctx.FILTERED), ['A', 'C']);
  assert.strictEqual(e.body.classList.contains('search-active'), true);
  assert.strictEqual(e.elements['nav-fav'].style.borderBottom, '2px solid var(--gold)');
  e.ctx.showFavs();
  assert.deepStrictEqual(names(e.ctx.FILTERED), ['A', 'B', 'C', 'D']);
  assert.strictEqual(e.body.classList.contains('search-active'), false);
  assert.strictEqual(e.elements['nav-fav'].style.borderBottom, '');
  assert.strictEqual(e.calls.scrollToMagazine, 1);
});
test('showFavs: 絞り込みの外で一覧だけを描く近道（_origRenderGrid・#cnt の書き換え）を使わない', () => {
  const src = fnSource('showFavs');
  assert.ok(!/_origRenderGrid|renderGrid\(|\.textContent/.test(src), 'showFavs が一覧を直接描くと、件数・並び替え・札とずれる（I-23 の原因）');
  assert.ok(/applyFilters\(\)/.test(src));
});

// ── 6. スクロール ───────────────────────────────────────────────────────
test('scrollToActiveConditions: 札の行が固定バーの下に来る位置へ、滑らかに動く', () => {
  const e = makeEnv({ pageYOffset: 100 });
  e.elements['active-chips'].offsetHeight = 58;
  e.elements['active-chips'].getBoundingClientRect = () => ({ top: 700 });
  e.ctx.scrollToActiveConditions();
  assert.deepStrictEqual(plain(e.calls.scrollTo), [{ top: 700 + 100 - 130, behavior: 'smooth' }]);
});
test('scrollToActiveConditions: 先頭より上には動かない／札の行が無いときは結果の先頭へ', () => {
  const e = makeEnv({ pageYOffset: 0 });
  e.elements['active-chips'].getBoundingClientRect = () => ({ top: 20 });
  e.ctx.scrollToActiveConditions();
  assert.strictEqual(e.calls.scrollTo[0].top, 0);
  const f = makeEnv({});
  f.elements['active-chips'].offsetHeight = 0;
  f.ctx.scrollToActiveConditions();
  assert.strictEqual(f.calls.scrollTo.length, 0);
  assert.strictEqual(f.calls.scrollToResults, 1);
});
test('scrollToMagazine: 特集の先頭へ（無ければ main、それも無ければページの先頭）', () => {
  const e = makeEnv({ pageYOffset: 400 });
  e.ctx.document.querySelector = () => ({ getBoundingClientRect: () => ({ top: 300 }) });
  e.ctx.scrollToMagazine();
  assert.deepStrictEqual(plain(e.calls.scrollTo), [{ top: 300 + 400 - 70, behavior: 'smooth' }]);
  const f = makeEnv({});
  f.ctx.scrollToMagazine();
  assert.deepStrictEqual(plain(f.calls.scrollTo), [{ top: 0, behavior: 'smooth' }]);
});

test('exitSearchMode（「絞り込みを解除して特集・ランキングに戻る」「すべてリセット」）: すべての条件（保存済み・絞り込み・検索語）を外してから、雑誌面へ戻る', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true, filter: FULL, q: '焼肉' });
  const order = [];
  e.ctx.applyFilters = function () {
    order.push('applyFilters:' + e.ctx.SHOW_FAVS_ONLY + ':' + JSON.stringify(plain(e.ctx.NB_FILTER)) + ':' + e.elements.si.value);
  };
  e.ctx.scrollToMagazine = function () { order.push('scrollToMagazine'); };
  e.ctx.exitSearchMode();
  assert.deepStrictEqual(plain(order), ['applyFilters:false:' + JSON.stringify(plain(e.ctx.nbEmptyFilter())) + ':', 'scrollToMagazine']);
});

// ── 7. 一覧が0件のときの案内 ─────────────────────────────────────────────
test('renderGrid: 保存した店が1件も無いときは、保存のしかたと「保存済みの表示をやめる」を出す（外すと増える条件の案内は出さない）', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '[]', favsOnly: true, filter: { conds: ['koshitsu'] }, realRenderGrid: true });
  e.ctx.renderGrid([]);
  const html = e.elements.grid.innerHTML;
  assert.ok(html.includes('<h3>保存したお店はまだありません</h3>'), html);
  assert.ok(html.includes('ハート'), '保存のしかた（カードのハート）を伝える');
  assert.ok(html.includes('onclick="showFavs()"') && html.includes('保存済みの表示をやめる'), html);
  assert.ok(!html.includes('該当するお店が見つかりませんでした'), '検索が外れたように読める文言は出さない');
  assert.ok(!html.includes('fs-suggest-btn'), '保存した店が無いのは条件のせいではないので、条件を外す案は出さない');
});
test('renderGrid: 保存した店はあるが、ほかの条件で0件のときは、今までの「該当なし」の案内。外すと増える条件は、保存した店の中で数える', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '["C","D"]', favsOnly: true, filter: { conds: ['koshitsu'] }, realRenderGrid: true });
  e.ctx.renderGrid([]);
  const html = e.elements.grid.innerHTML;
  assert.ok(html.includes('該当するお店が見つかりませんでした') && html.includes('フィルターをリセット'), html);
  assert.ok(html.includes('onclick="clearAllFilters()"'));
  assert.ok(!html.includes('保存したお店はまだありません'));
  // 個室ありを外すと、保存した C と D の 2 軒（全店で数えると A・B も入って 4 軒になってしまう）
  const items = Array.from(html.matchAll(/<button type="button" class="fs-suggest-btn" data-k="([^"]*)" data-v="([^"]*)">([^<]*)<\/button>/g)).map((m) => [m[1], m[2], m[3]]);
  assert.deepStrictEqual(items, [['cond', 'koshitsu', condLabel('koshitsu') + 'を外す（+2軒）']]);
});
test('renderGrid: 保存済みでないときの0件の案内は、今までと同じ（外すと増える条件も出す）', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '[]', favsOnly: false, filter: { genre: 'ラーメン', conds: ['koshitsu'] }, realRenderGrid: true });
  e.ctx.renderGrid([]);
  const html = e.elements.grid.innerHTML;
  assert.ok(html.includes('該当するお店が見つかりませんでした') && html.includes('検索条件を変えるか、フィルターをリセットしてお試しください。'), html);
  assert.ok(!html.includes('保存したお店はまだありません'));
  const items = Array.from(html.matchAll(/<button type="button" class="fs-suggest-btn" data-k="([^"]*)" data-v="([^"]*)">([^<]*)<\/button>/g)).map((m) => m[3]);
  assert.deepStrictEqual(items, ['ラーメンを外す（+2軒）', condLabel('koshitsu') + 'を外す（+1軒）']);
});
test('renderGrid: 先頭の50店だけで動いている間の0軒は「見つかりません」と出さず読み込み中の表示にする。保存した店がまだ無いときは本当の0なので案内を出す', () => {
  const loading = makeEnv({ stores: STORES, storedFavs: '["C"]', favsOnly: true, filter: { conds: ['koshitsu'] }, loaded: false, realRenderGrid: true });
  loading.ctx.renderGrid([]);
  assert.ok(loading.elements.grid.innerHTML.includes('class="skel"'), '読み込み中の枠');
  assert.ok(!loading.elements.grid.innerHTML.includes('該当するお店が見つかりませんでした'));
  assert.strictEqual(loading.elements.pagination.innerHTML, '');
  flushTimers(loading);
  assert.strictEqual(loading.elements.cnt.textContent, '-- 件');
  const noSaved = makeEnv({ stores: STORES, storedFavs: '[]', favsOnly: true, loaded: false, realRenderGrid: true });
  noSaved.ctx.renderGrid([]);
  assert.ok(noSaved.elements.grid.innerHTML.includes('保存したお店はまだありません'));
  // 全店のデータの取得に失敗したあとは、読み込み中のままにせず案内を出す
  const failed = makeEnv({ stores: STORES, storedFavs: '["C"]', favsOnly: true, filter: { conds: ['koshitsu'] }, loaded: false, failed: true, realRenderGrid: true });
  failed.ctx.renderGrid([]);
  assert.ok(failed.elements.grid.innerHTML.includes('該当するお店が見つかりませんでした'));
});
test('renderGrid: 店があるときは、ふだんどおり1ページ目を描く', () => {
  const e = makeEnv({ storedFavs: '["A"]', favsOnly: true, realRenderGrid: true });
  e.ctx.renderGrid([STORES[0]]);
  assert.deepStrictEqual(plain(e.calls.renderPage), [1]);
});

// ── 8. 絞り込みシートの件数 ─────────────────────────────────────────────
test('絞り込みシートの「N軒を見る」: 保存済みを入れていれば、保存した店の中で数える（一覧と同じ数え方）。下書きが空でも押せる', () => {
  const draft = (e, f) => { e.ctx.NB_SHEET.draft = e.ctx.nbNormalizeFilter(f); return plain(e.ctx.nbSheetFooterState()); };
  const on = makeEnv({ stores: STORES, storedFavs: '["A","C"]', favsOnly: true });
  const st = draft(on, { conds: ['koshitsu'] });
  assert.strictEqual(st.count, 1, '個室ありで保存しているのは A だけ');
  assert.strictEqual(st.label, '1軒を見る');
  assert.strictEqual(st.disabled, false);
  const off = makeEnv({ stores: STORES, storedFavs: '["A","C"]', favsOnly: false });
  assert.strictEqual(draft(off, { conds: ['koshitsu'] }).count, 2, '保存済みを入れていなければ全店（A・B）');
  const empty = draft(makeEnv({ stores: STORES, storedFavs: '["A","C"]', favsOnly: true }), {});
  assert.deepStrictEqual([empty.count, empty.label, empty.disabled], [2, '2軒を見る', false], '保存済みが入っているので、条件が空でも保存した店の数を見られる');
  const none = draft(makeEnv({ stores: STORES, storedFavs: '["C","D"]', favsOnly: true }), { conds: ['koshitsu'] });
  assert.deepStrictEqual([none.count, none.label, none.disabled], [0, '該当するお店がありません', true]);
});

// ── 9. 静的に確かめる決まり ─────────────────────────────────────────────
test('SHOW_FAVS_ONLY は1か所で宣言され、applyFilters より前（最初の描画より前に初期化される）', () => {
  assert.strictEqual(INDEX.split('var SHOW_FAVS_ONLY = false;').length - 1, 1);
  assert.ok(INDEX.indexOf('var SHOW_FAVS_ONLY = false;') < INDEX.indexOf('\nfunction applyFilters('));
});
test('保存済みは URL（ハッシュ）に載せない（保存した店はこの端末だけの情報。共有リンクに個人の保存を混ぜない）', () => {
  ['nbBuildHash', 'nbFilterParams', 'nbFilterFromParams', 'nbParseHash', 'pushHash', 'readHash'].forEach((n) => {
    assert.ok(!/SHOW_FAVS_ONLY|favs/i.test(fnSource(n)), `${n} が保存済みを扱っていない`);
  });
  // 実際に作るハッシュも、保存済みの有無で変わらない
  const on = makeEnv({ favsOnly: true, filter: { conds: ['koshitsu'] } });
  const off = makeEnv({ favsOnly: false, filter: { conds: ['koshitsu'] } });
  assert.strictEqual(on.ctx.nbBuildHash(), '#cond=koshitsu');
  assert.strictEqual(on.ctx.nbBuildHash(), off.ctx.nbBuildHash());
  assert.strictEqual(makeEnv({ favsOnly: true }).ctx.nbBuildHash(), '#', '保存済みだけならハッシュは空');
  assert.strictEqual(on.ctx.nbBuildHash('J001'), '#cond=koshitsu&store=J001');
});
test('ナビの「保存済み」は showFavs を呼ぶ', () => {
  assert.ok(/<a [^>]*id="nav-fav"[^>]*onclick="event\.preventDefault\(\);showFavs\(\);closeNav\(\)"/.test(INDEX));
});
