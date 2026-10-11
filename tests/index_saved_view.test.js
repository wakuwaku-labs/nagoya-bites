'use strict';
/**
 * tests/index_saved_view.test.js — I-23（UI・UX改修 段階1a）
 *
 * トップ（index.html）の「保存済み」（ナビのリンク）の決まりを確かめる。
 *   1. 保存済みは絞り込み条件の1つ（SHOW_FAVS_ONLY）。applyFilters が AND で絞り、一覧（#grid）を出す（search-active を付ける）
 *   2. 件数・条件のチップ（保存済み ×）・「すべて外す」・ナビの強調が、その1つの状態を見る
 *   3. 保存した店が1件も無いときは、「該当なし」ではなく保存のしかたを案内する
 *   4. 保存した店の記録（nb_favs）が壊れていても例外にしない
 *   5. 保存済みは URL（ハッシュ）に載せない
 *
 * index.html から実物の関数（getFavs・applyFilters・updateFilterUI・clearAllFilters・showFavs・renderGrid・条件のチップの
 * クリック処理など）を取り出し、偽の DOM の上で動かす。実ブラウザでの確認は docs/qa/uiux-2026-10/e2e_saved.js。
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
function chipHandlerSource() {
  const a = INDEX.indexOf('// Chip click handler (delegated)');
  assert.ok(a >= 0, '条件のチップのクリック処理が見つからない');
  const b = INDEX.indexOf('\n});\n', a);
  assert.ok(b > a, '条件のチップのクリック処理の終わりが見つからない');
  return INDEX.slice(a, b + 5);
}

const SOURCES = ['getFavs', 'nbSyncFavNav', 'applyFilters', 'updateFilterUI', 'clearAllFilters', 'showFavs',
  'scrollToMagazine', 'scrollToActiveConditions', 'exitSearchMode', 'renderGrid'].map(fnSource);
const CHIP_HANDLER = chipHandlerSource();

// ── 偽の DOM ───────────────────────────────────────────────────────────
function makeEl(extra) {
  const cls = new Set();
  const el = {
    style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', disabled: false, offsetHeight: 40,
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
  ['filter-badge', 'filter-toggle-btn', 'clear-all-btn', 'active-chips', 'results-summary-cond', 'results-summary-count',
    'filter-panel-cta-count', 'filter-panel-cta-main', 'nav-fav', 'cnt', 'grid', 'pagination', 'filter-panel', 'results-block', 'si']
    .forEach((id) => { elements[id] = makeEl(); });
  const body = makeEl();
  const calls = { scrollTo: [], timeouts: [], cleared: [], rendered: [], scrollToResults: 0, scrollToMagazine: 0, scrollToActive: 0, pushHash: 0, applyFilters: 0, renderPage: [] };
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
    setTimeout: (fn, ms) => { calls.timeouts.push(ms); return 99; },
    clearTimeout: (t) => { calls.cleared.push(t); },
    // applyFilters などが参照する、ほかの部分（この確認の対象ではないので偽物）
    ALL_STORES: opts.stores || [], FILTERED: [], ACTIVE_TAGS: opts.tags || [], ACTIVE_WARD: 'all', SHOW_FAVS_ONLY: !!opts.favsOnly,
    AREA_TO_WARD: {}, SCENE_ALIAS: {}, NB_SEARCH_META: null, RENDER_DATA: [], CURRENT_PAGE: 1, NB_OPEN_REEL: null,
    normalizeGenre: (g) => g, priceToNum: () => 0,
    nbRunSearch: (list) => list, nbSyncRelevanceSort() {}, nbRenderSearchMeta() {}, nbUpdateSearchClearVisibility() {}, nbEscHtml: (s) => String(s),
    pushHash() { calls.pushHash++; },
    renderPage(n) { calls.renderPage.push(n); },
  };
  ctx.renderGrid = undefined; // 実物（下で読み込む）
  vm.createContext(ctx);
  vm.runInContext(SOURCES.join('\n'), ctx);
  // 部品の呼び出しを数える（実物は上で読み込んだまま、呼ばれたことだけ数える）
  const wrap = (name, after) => { const orig = ctx[name]; ctx[name] = function () { after.apply(null, arguments); return orig.apply(this, arguments); }; };
  ctx.scrollToResults = function () { calls.scrollToResults++; };
  wrap('scrollToMagazine', () => { calls.scrollToMagazine++; });
  wrap('scrollToActiveConditions', () => { calls.scrollToActive++; });
  const realRenderGrid = ctx.renderGrid;
  ctx.renderGrid = function (data) { calls.rendered.push(data.slice ? data.slice() : data); };
  if (opts.realRenderGrid) ctx.renderGrid = realRenderGrid;
  vm.runInContext(CHIP_HANDLER, ctx);
  return { ctx, elements, body, calls, handlers, storage, reads, realRenderGrid };
}

// vm の中で作られた配列・オブジェクトは、このテストとは別の Object/Array（プロトタイプが違う）なので、deepStrictEqual に渡す前に素の値へそろえる
const plain = (x) => JSON.parse(JSON.stringify(x));
const names = (list) => plain(Array.from(list, (s) => s['店名']));
const STORES = [
  { 店名: 'A', タグ: '個室,飲み放題', アクセス: '', 備考: '' },
  { 店名: 'B', タグ: '個室', アクセス: '', 備考: '' },
  { 店名: 'C', タグ: '禁煙', アクセス: '', 備考: '' },
  { 店名: 'D', タグ: '', アクセス: '', 備考: '' },
];

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
test('applyFilters: 保存済みはほかの条件と AND（保存した店の中から、さらに絞る）', () => {
  const e = makeEnv({ stores: STORES, storedFavs: '["A","C"]', favsOnly: true, tags: ['個室'] });
  e.ctx.applyFilters();
  assert.deepStrictEqual(names(e.ctx.FILTERED), ['A']);
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

// ── 3. updateFilterUI: 件数・チップ・帯・ナビの強調 ───────────────────────
test('updateFilterUI: 保存済みを入れていなければ、チップも強調も出ない', () => {
  const e = makeEnv({ stores: STORES, favsOnly: false });
  e.ctx.FILTERED = STORES.slice();
  e.ctx.updateFilterUI();
  assert.strictEqual(e.elements['active-chips'].innerHTML, '');
  assert.strictEqual(e.elements['filter-badge'].style.display, 'none');
  assert.strictEqual(e.elements['clear-all-btn'].style.display, 'none');
  assert.strictEqual(e.elements['nav-fav'].style.borderBottom, '');
  assert.ok(e.elements['results-summary-cond'].innerHTML.includes('条件なし'));
});
test('updateFilterUI: 保存済みを入れると、チップ・条件の数・帯・ナビの強調が揃う', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true });
  e.ctx.FILTERED = [STORES[0], STORES[2]];
  e.ctx.updateFilterUI();
  assert.strictEqual(e.elements['active-chips'].innerHTML, '<span class="chip" data-clear="favs">保存済み <span class="chip-x">×</span></span>');
  assert.strictEqual(e.elements['filter-badge'].textContent, 1);
  assert.strictEqual(e.elements['filter-badge'].style.display, 'inline-flex');
  assert.strictEqual(e.elements['clear-all-btn'].style.display, '', '「すべてリセット」が出る');
  assert.ok(e.elements['results-summary-cond'].innerHTML.includes('保存済み'));
  assert.strictEqual(e.elements['results-summary-count'].textContent, '2');
  assert.strictEqual(e.elements['nav-fav'].style.borderBottom, '2px solid var(--gold)');
});
test('updateFilterUI: ほかの条件があるときは、保存済みのチップが先頭で、条件の数は足し算', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true, tags: ['個室'] });
  e.ctx.FILTERED = [STORES[0]];
  e.ctx.updateFilterUI();
  const html = e.elements['active-chips'].innerHTML;
  assert.ok(html.indexOf('data-clear="favs"') >= 0 && html.indexOf('data-clear="favs"') < html.indexOf('data-clear="tag"'), html);
  assert.strictEqual(e.elements['filter-badge'].textContent, 2);
});
test('updateFilterUI: 状態を戻して呼び直すと、強調とチップが消える（どの経路で外しても同じ）', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true });
  e.ctx.FILTERED = [];
  e.ctx.updateFilterUI();
  e.ctx.SHOW_FAVS_ONLY = false;
  e.ctx.updateFilterUI();
  assert.strictEqual(e.elements['nav-fav'].style.borderBottom, '');
  assert.strictEqual(e.elements['active-chips'].innerHTML, '');
});

// ── 4. 保存済みを外す経路 ───────────────────────────────────────────────
function click(e, dataset) {
  const chip = makeEl({ dataset });
  const fn = e.handlers.click[0];
  fn({ target: { closest: (sel) => (sel === '.chip' ? chip : null) } });
}
test('条件のチップ「保存済み ×」を押すと、保存済みだけが外れて絞り込みを作り直す', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true });
  let seen = null;
  e.ctx.applyFilters = function () { e.calls.applyFilters++; seen = e.ctx.SHOW_FAVS_ONLY; };
  click(e, { clear: 'favs' });
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, false);
  assert.strictEqual(e.calls.applyFilters, 1);
  assert.strictEqual(seen, false, 'applyFilters を呼ぶ前に外れている');
});
test('ほかのチップを外しても、保存済みは残る', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true });
  e.ctx.applyFilters = function () { e.calls.applyFilters++; };
  click(e, { clear: 'cap' });
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, true);
  assert.strictEqual(e.calls.applyFilters, 1);
});
test('clearAllFilters（すべてリセット・フィルターをリセット）は、保存済みも外してから絞り込みを作り直す', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true });
  let seen = null;
  e.ctx.applyFilters = function () { e.calls.applyFilters++; seen = e.ctx.SHOW_FAVS_ONLY; };
  e.ctx.clearAllFilters();
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, false);
  assert.strictEqual(seen, false);
  assert.strictEqual(e.calls.applyFilters, 1);
});

// ── 5. ナビの「保存済み」（showFavs） ───────────────────────────────────
test('showFavs: 押すと保存済みを入れ、絞り込みを作り直し、チップが見える位置へ動く（結果の先頭の予約は取り消す）', () => {
  const e = makeEnv({ stores: STORES });
  e.ctx.applyFilters = function () { e.calls.applyFilters++; };
  e.ctx.showFavs();
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, true);
  assert.strictEqual(e.calls.applyFilters, 1, '一覧・件数・チップ・強調は applyFilters 1本に任せる');
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
  const e = makeEnv({ stores: STORES, favsOnly: true });
  e.ctx.applyFilters = function () { e.body.classList.add('search-active'); };
  e.ctx.showFavs();
  assert.strictEqual(e.ctx.SHOW_FAVS_ONLY, false);
  assert.strictEqual(e.calls.scrollToMagazine, 0);
  assert.strictEqual(e.calls.scrollToActive, 0);
});
test('showFavs: 絞り込みの外で一覧だけを描く近道（_origRenderGrid・#cnt の書き換え）を使わない', () => {
  const src = fnSource('showFavs');
  assert.ok(!/_origRenderGrid|renderGrid\(|\.textContent/.test(src), 'showFavs が一覧を直接描くと、件数・並び替え・チップとずれる（I-23 の原因）');
  assert.ok(/applyFilters\(\)/.test(src));
});

// ── 6. スクロール ───────────────────────────────────────────────────────
test('scrollToActiveConditions: チップの行が固定バーの下に来る位置へ、滑らかに動く', () => {
  const e = makeEnv({ pageYOffset: 100 });
  e.elements['active-chips'].offsetHeight = 58;
  e.elements['active-chips'].getBoundingClientRect = () => ({ top: 700 });
  e.ctx.scrollToActiveConditions();
  assert.deepStrictEqual(plain(e.calls.scrollTo), [{ top: 700 + 100 - 130, behavior: 'smooth' }]);
});
test('scrollToActiveConditions: 先頭より上には動かない／チップの行が無いときは結果の先頭へ', () => {
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

test('exitSearchMode（「絞り込みを解除して特集・ランキングに戻る」「すべてリセット」）: すべての条件（保存済みも）を外してから、雑誌面へ戻る', () => {
  const e = makeEnv({ stores: STORES, favsOnly: true });
  const order = [];
  e.ctx.applyFilters = function () { order.push('applyFilters:' + e.ctx.SHOW_FAVS_ONLY); };
  e.ctx.scrollToMagazine = function () { order.push('scrollToMagazine'); };
  e.ctx.exitSearchMode();
  assert.deepStrictEqual(plain(order), ['applyFilters:false', 'scrollToMagazine']);
});

// ── 7. 一覧が0件のときの案内 ─────────────────────────────────────────────
test('renderGrid: 保存した店が1件も無いときは、保存のしかたと「保存済みの表示をやめる」を出す', () => {
  const e = makeEnv({ storedFavs: '[]', favsOnly: true, realRenderGrid: true });
  e.ctx.renderGrid([]);
  const html = e.elements.grid.innerHTML;
  assert.ok(html.includes('<h3>保存したお店はまだありません</h3>'), html);
  assert.ok(html.includes('ハート'), '保存のしかた（カードのハート）を伝える');
  assert.ok(html.includes('onclick="showFavs()"') && html.includes('保存済みの表示をやめる'), html);
  assert.ok(!html.includes('該当するお店が見つかりませんでした'), '検索が外れたように読める文言は出さない');
});
test('renderGrid: 保存した店はあるが、ほかの条件で0件のときは、今までの「該当なし」の案内', () => {
  const e = makeEnv({ storedFavs: '["A"]', favsOnly: true, realRenderGrid: true });
  e.ctx.renderGrid([]);
  const html = e.elements.grid.innerHTML;
  assert.ok(html.includes('該当するお店が見つかりませんでした') && html.includes('フィルターをリセット'), html);
  assert.ok(html.includes('onclick="clearAllFilters()"'));
});
test('renderGrid: 保存済みでないときの0件の案内は、今までと同じ', () => {
  const e = makeEnv({ storedFavs: '[]', favsOnly: false, realRenderGrid: true });
  e.ctx.renderGrid([]);
  const html = e.elements.grid.innerHTML;
  assert.ok(html.includes('該当するお店が見つかりませんでした') && html.includes('検索条件を変えるか、フィルターをリセットしてお試しください。'), html);
  assert.ok(!html.includes('保存したお店はまだありません'));
});
test('renderGrid: 店があるときは、ふだんどおり1ページ目を描く', () => {
  const e = makeEnv({ storedFavs: '["A"]', favsOnly: true, realRenderGrid: true });
  e.ctx.renderGrid([STORES[0]]);
  assert.deepStrictEqual(plain(e.calls.renderPage), [1]);
});

// ── 8. 静的に確かめる決まり ─────────────────────────────────────────────
test('SHOW_FAVS_ONLY は1か所で宣言され、applyFilters より前（最初の描画より前に初期化される）', () => {
  assert.strictEqual(INDEX.split('var SHOW_FAVS_ONLY = false;').length - 1, 1);
  assert.ok(INDEX.indexOf('var SHOW_FAVS_ONLY = false;') < INDEX.indexOf('\nfunction applyFilters('));
});
test('保存済みは URL（ハッシュ）に載せない（保存した店はこの端末だけの情報。共有リンクに個人の保存を混ぜない）', () => {
  ['pushHash', 'readHash'].forEach((n) => {
    assert.ok(!/SHOW_FAVS_ONLY|favs/i.test(fnSource(n)), `${n} が保存済みを扱っていない`);
  });
});
test('ナビの「保存済み」は showFavs を呼ぶ', () => {
  assert.ok(/<a [^>]*id="nav-fav"[^>]*onclick="event\.preventDefault\(\);showFavs\(\);closeNav\(\)"/.test(INDEX));
});
