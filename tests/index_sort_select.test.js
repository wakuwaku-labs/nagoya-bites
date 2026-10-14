'use strict';

/**
 * tests/index_sort_select.test.js
 *
 * 並べ替えと検索の送信（I-20）。
 *   ・並べ替えは「見える select 1 つ」。チップ 9 個・隠れた select・表示切り替えだけの帯・「近い順」（現在地）は無い
 *   ・「関連度順」は検索語があるときだけ選択肢に現れる（DOM から外す。iOS の Safari は option[hidden] を無視する）
 *   ・applySort は sort_change を 1 回だけ送る
 *   ・検索の送信は nbSubmitSearch の 1 つ（ボタン・Enter・suggestSearch）。search は 1 回・絞り込みは 1 回・溜まった入力のデバウンスを取り消す
 *   ・shareURL は alert を使わない
 * index.html の実物の関数を取り出し、偽の DOM で動かす。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// 生成した巨大な行（店のデータ）は読まない
const INDEX = RAW.split('\n').filter((l) => !/^var LOCAL_STORES\b/.test(l)).join('\n');

function fnSource(name) {
  const head = '\nfunction ' + name + '(';
  assert.strictEqual(INDEX.split(head).length - 1, 1, `function ${name} は 1 つだけ定義されている`);
  const a = INDEX.indexOf(head) + 1;
  const b = INDEX.indexOf('\n}\n', a);
  assert.ok(b > a, `function ${name} の終わりが見つからない`);
  return INDEX.slice(a, b + 2);
}

function cssBody(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = INDEX.match(new RegExp('(?:^|\\n)' + esc + '\\s*\\{([^}]*)\\}'));
  assert.ok(m, `CSS の規則が見つからない: ${selector}`);
  return m[1].replace(/\s*([:;,{}])\s*/g, '$1').replace(/\s+/g, ' ').trim();
}

// コメントだけを除く（行頭の // ・空白のあとの // ・/* */ 。URL の :// は残る）
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/\s.*$/, '')).join('\n');
}
const CODE = codeOnly(INDEX);

// ツールバーの HTML（#sort-bar の開きから #grid の手前まで）
const BAR = INDEX.slice(INDEX.indexOf('<div class="sort-bar sticky-sort" id="sort-bar"'), INDEX.indexOf('<div class="grid" id="grid">'));

// ── マークアップの契約 ──────────────────────────────────────────────────
test('ツールバー: 「絞り込み」ボタン・見える並べ替え select・表示切り替えの 3 つ（1 行）', () => {
  assert.ok(BAR.length > 200, 'ツールバーを読めていない');
  assert.ok(!/role="tablist"/.test(BAR), 'タブの役割は付けない（チップをやめた）');
  assert.ok(/<button type="button" id="tb-filter-btn" class="tb-filter" onclick="nbOpenFilterSheet\(this\)" aria-haspopup="dialog" aria-controls="filter-sheet">/.test(BAR), '絞り込みのボタン（ダイアログを開く）');
  assert.ok(/<span class="filter-badge" id="tb-filter-badge" hidden>0<\/span>/.test(BAR), '件数の丸は初期は hidden');
  assert.ok(/<label class="sort-select-wrap"><span class="visually-hidden">並べ替え<\/span>\s*<select class="sort-select" id="sort-select" onchange="applySort\(\)">/.test(BAR), '見出しは画面に出さず label で読み上げる・select は見える');
  assert.ok(!/<select[^>]*\b(hidden|aria-hidden)\b/.test(BAR), 'select を隠さない');
  assert.ok(/<div class="view-toggle" id="view-toggle">[\s\S]*id="vt-grid"[\s\S]*id="vt-list"/.test(BAR), '表示切り替え（#vt-grid・#vt-list）');
  const order = ['id="tb-filter-btn"', 'id="sort-select"', 'id="view-toggle"'].map((k) => BAR.indexOf(k));
  assert.ok(order[0] > 0 && order[0] < order[1] && order[1] < order[2], '並びは 絞り込み → 並べ替え → 表示切り替え');
});

test('ツールバー: 選択肢はこの 7 つ（関連度順は動的）・チップ・帯・近い順は無い', () => {
  const sel = BAR.match(/<select[\s\S]*?<\/select>/)[0];
  const opts = [...sel.matchAll(/<option value="([^"]+)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]);
  assert.deepStrictEqual(opts, [
    ['recommend', 'おすすめ順'], ['view-desc', '人気順'], ['trend-desc', '話題沸騰順'], ['new-desc', '新着順'],
    ['price-asc', '予算が安い順'], ['price-desc', '予算が高い順'], ['cc-desc', '口コミ信頼度順'],
  ]);
  assert.ok(/<option value="recommend" selected>/.test(sel), '既定はおすすめ順');
  assert.ok(!sel.includes('relevance'), '関連度順は HTML に書かない（検索語があるときに JS が入れる）');
  assert.ok(!/sort-chip/.test(CODE), 'チップ（.sort-chip）は無い');
  assert.ok(!/sort-meta-bar/.test(CODE), '表示切り替えだけの帯（.sort-meta-bar）は無い');
  assert.ok(!/data-needs-geo/.test(CODE), 'data-needs-geo は無い');
  assert.ok(!/distance/.test(BAR), '「近い順」は選択肢に無い');
  // 選択肢の値は、sortStores が受ける（recommend は default）
  const stores = fnSource('sortStores');
  for (const [v] of opts) if (v !== 'recommend') assert.ok(stores.includes("case '" + v + "':"), `sortStores に ${v} の並べ方がある`);
  assert.ok(stores.includes("case 'relevance':"), '関連度順の並べ方も残っている');
});

test('消した名前が残っていない: 近い順（現在地）・チップ・使われていない関数', () => {
  for (const name of ['distBadge', 'dist-badge', 'ensureGeoAndSort', 'revertSort', 'USER_GEO', 'AREA_CENTROIDS', 'getStoreCoords', 'calculateDistance',
    'bindSortChips', 'nb_user_geo', 'sort_distance_granted', 'sort_distance_denied', 'sort-chip', 'sort-chips', 'sort-bar-label', 'sort-meta-bar',
    'selectPref', 'selectGenre', 'selectTag', 'doSearch']) {
    assert.ok(!CODE.includes(name), `${name} が index.html のコードに残っている`);
  }
  assert.ok(!/case 'distance'/.test(CODE), "sortStores に case 'distance' が残っている");
  // 残すもの（別の機能が使う）
  for (const keep of ['function priceToNum(', 'function scrollToResultsIfAbove(', 'function sortAndRender(', 'function geoSearch(']) assert.ok(CODE.includes(keep), `${keep} は残す`);
});

// ── 動き ────────────────────────────────────────────────────────────────
function makeSelect(values) {
  const sel = { options: values.map((v) => ({ value: v, textContent: v })), value: values[0] };
  Object.defineProperty(sel, 'firstChild', { get: () => sel.options[0] || null });
  sel.insertBefore = (o, ref) => { const i = sel.options.indexOf(ref); sel.options.splice(i < 0 ? sel.options.length : i, 0, o); };
  sel.removeChild = (o) => { sel.options = sel.options.filter((x) => x !== o); };
  return sel;
}

function load(names, extra) {
  const events = [];
  const calls = { sortAndRender: 0, scroll: 0, applyFilters: 0, historyCommit: [], cleared: [], toasts: [] };
  const sel = makeSelect(['recommend', 'view-desc', 'trend-desc']);
  const bodyClasses = new Set();
  const el = { si: { value: '' }, si2: { value: '' } };
  const ctx = {
    console, calls, events, sel, bodyClasses, el,
    document: {
      getElementById: (id) => (id === 'sort-select' ? sel : el[id] || null),
      createElement: () => ({ value: '', textContent: '' }),
      body: { classList: { toggle: (c, on) => { if (on) bodyClasses.add(c); else bodyClasses.delete(c); } } },
    },
    window: { trackEvent: (n, p) => events.push([n, JSON.parse(JSON.stringify(p))]) },
    trackEvent: (n, p) => events.push([n, JSON.parse(JSON.stringify(p))]),
    sortAndRender: () => { calls.sortAndRender++; },
    scrollToResultsIfAbove: () => { calls.scroll++; },
    applyFilters: () => { calls.applyFilters++; },
    nbSearchHistoryCommit: (q) => { calls.historyCommit.push(q); },
    clearTimeout: (t) => { calls.cleared.push(t); },
    showToast: (m) => { calls.toasts.push(m); },
    SORT_MODE: 'recommend', SORT_USER_PINNED: false, NB_SEARCH_DEBOUNCE: null,
    ...(extra || {}),
  };
  vm.createContext(ctx);
  vm.runInContext(names.map(fnSource).join('\n'), ctx);
  return ctx;
}
const values = (ctx) => ctx.sel.options.map((o) => o.value);

test('applySort: select の値で並べ直し、sort_change を 1 回だけ送る（形は { mode }）', () => {
  const c = load(['applySort']);
  c.sel.value = 'view-desc';
  vm.runInContext('applySort()', c);
  assert.strictEqual(vm.runInContext('SORT_MODE', c), 'view-desc');
  assert.strictEqual(vm.runInContext('SORT_USER_PINNED', c), true, '利用者が選んだ印');
  assert.strictEqual(c.calls.sortAndRender, 1);
  assert.strictEqual(c.calls.scroll, 1);
  assert.deepStrictEqual(c.events, [['sort_change', { mode: 'view-desc' }]]);
});

test('applySort: 関連度順を選んだときは「利用者が固定した」印にしない', () => {
  const c = load(['applySort']);
  c.sel.value = 'relevance';
  vm.runInContext('applySort()', c);
  assert.strictEqual(vm.runInContext('SORT_USER_PINNED', c), false);
  assert.deepStrictEqual(c.events, [['sort_change', { mode: 'relevance' }]]);
});

test('nbSetSortMode: SORT_MODE を替え、select に無い値は選ばない', () => {
  const c = load(['nbSetSortMode']);
  vm.runInContext("nbSetSortMode('trend-desc')", c);
  assert.strictEqual(c.sel.value, 'trend-desc');
  assert.strictEqual(vm.runInContext('SORT_MODE', c), 'trend-desc');
  vm.runInContext("nbSetSortMode('nothing')", c);
  assert.strictEqual(c.sel.value, 'trend-desc', '無い値で select を壊さない');
});

test('nbSyncRelevanceSort: 検索語があるときだけ関連度順の option が先頭に入り、選ばれる。消すと外れて既定に戻る', () => {
  const c = load(['nbSetSortMode', 'nbSyncRelevanceSort']);
  vm.runInContext('nbSyncRelevanceSort(true)', c);
  assert.deepStrictEqual(values(c).slice(0, 2), ['relevance', 'recommend'], '先頭に入る');
  assert.strictEqual(c.sel.options[0].textContent, '関連度順');
  assert.strictEqual(c.sel.value, 'relevance');
  assert.strictEqual(vm.runInContext('SORT_MODE', c), 'relevance');
  assert.ok(c.bodyClasses.has('search-query-active'));
  vm.runInContext('nbSyncRelevanceSort(true)', c);
  assert.strictEqual(values(c).filter((v) => v === 'relevance').length, 1, '2 回呼んでも option は 1 つ');
  vm.runInContext('nbSyncRelevanceSort(false)', c);
  assert.ok(!values(c).includes('relevance'), '語を消したら DOM から外す');
  assert.strictEqual(vm.runInContext('SORT_MODE', c), 'recommend');
  assert.strictEqual(c.sel.value, 'recommend');
  assert.ok(!c.bodyClasses.has('search-query-active'));
});

test('nbSyncRelevanceSort: 利用者が並べ替えを選んでいたら、検索語が付いても切り替えない（選択肢だけ現れる）', () => {
  const c = load(['nbSetSortMode', 'nbSyncRelevanceSort'], { SORT_MODE: 'view-desc', SORT_USER_PINNED: true });
  c.sel.value = 'view-desc';
  vm.runInContext('nbSyncRelevanceSort(true)', c);
  assert.strictEqual(vm.runInContext('SORT_MODE', c), 'view-desc');
  assert.ok(values(c).includes('relevance'));
  vm.runInContext('nbSyncRelevanceSort(false)', c);
  assert.strictEqual(vm.runInContext('SORT_MODE', c), 'view-desc', '語を消しても利用者の選びは動かさない');
  assert.ok(!values(c).includes('relevance'));
});

test('nbSubmitSearch: デバウンスを取り消し、2 つの欄をそろえ、絞り込み 1 回・search 1 回', () => {
  const c = load(['nbSubmitSearch'], { NB_SEARCH_DEBOUNCE: 77 });
  c.el.si2.value = '個室 栄';
  c.el.si.value = '古い';
  vm.runInContext('nbSubmitSearch()', c);
  assert.deepStrictEqual(c.calls.cleared, [77], '溜まっているタイマーを取り消す');
  assert.strictEqual(vm.runInContext('NB_SEARCH_DEBOUNCE', c), null);
  assert.strictEqual(c.el.si.value, '個室 栄');
  assert.strictEqual(c.el.si2.value, '個室 栄');
  assert.strictEqual(c.calls.applyFilters, 1);
  assert.deepStrictEqual(c.calls.historyCommit, ['個室 栄'], '履歴を足す判断は検索語を渡して1回（P-245）');
  assert.deepStrictEqual(c.events, [['search', { search_term: '個室 栄' }]]);
});

test('nbSubmitSearch: si2 が空なら si の語を使う・語が無いときは search を送らず絞り込みだけ・タイマーが無ければ取り消さない', () => {
  const c = load(['nbSubmitSearch']);
  c.el.si.value = '焼肉';
  vm.runInContext('nbSubmitSearch()', c);
  assert.strictEqual(c.el.si2.value, '焼肉');
  assert.deepStrictEqual(c.events, [['search', { search_term: '焼肉' }]]);
  assert.strictEqual(c.calls.cleared.length, 0);
  const d = load(['nbSubmitSearch']);
  vm.runInContext('nbSubmitSearch()', d);
  assert.strictEqual(d.events.length, 0);
  assert.strictEqual(d.calls.applyFilters, 1);
});

test('検索の入口はすべて nbSubmitSearch（ボタン 2 つ・Enter 2 つ・suggestSearch）。Enter で applyFilters を直接呼ばない', () => {
  assert.strictEqual(INDEX.split('onclick="nbSubmitSearch()"').length - 1, 2, '「検索」ボタンは 2 つとも nbSubmitSearch');
  assert.ok(INDEX.includes("document.getElementById('si').addEventListener('keydown', function(e){ if(e.key==='Enter') nbSubmitSearch(); });"), 'si の Enter');
  assert.ok(INDEX.includes("document.getElementById('si2').addEventListener('keydown', function(e){ if(e.key==='Enter') nbSubmitSearch(); });"), 'si2 の Enter');
  assert.strictEqual(INDEX.split("addEventListener('keydown', function(e) { if (e.key === 'Enter')").length - 1, 0, '同期のブロックに Enter の処理を重ねない（Enter で 2 回走っていた）');
  assert.ok(/function suggestSearch\([\s\S]*?nbSubmitSearch\(\);[\s\S]*?\n}/.test(INDEX), 'suggestSearch も nbSubmitSearch');
  for (const id of ['id="si"', 'id="si2"', 'id="hero-suggest"']) assert.ok(INDEX.includes(id), `${id} は変えない`);
});

test('shareURL: コピーしたことは showToast で知らせる（alert は使わない・文言は同じ）', () => {
  const src = fnSource('shareURL');
  assert.ok(!/\balert\(/.test(codeOnly(src)));
  const c = load(['shareURL'], {
    location: { href: 'https://example.com/?a=1' },
    navigator: { clipboard: { writeText: (u) => { c.copied = u; return { then: (f) => f() }; } } },
    alert: () => { throw new Error('alert を呼んだ'); },
  });
  vm.runInContext('shareURL()', c);
  assert.strictEqual(c.copied, 'https://example.com/?a=1');
  assert.deepStrictEqual(c.calls.toasts, ['URLをコピーしました']);
});

// ── CSS ─────────────────────────────────────────────────────────────────
test('CSS: 絞り込みと select は押す所 44px・select の文字はスマホで 16px（iOS の自動拡大を避ける）・帯は今の位置のまま', () => {
  assert.ok(cssBody('.tb-filter').includes('min-height:var(--tap-min)'));
  assert.ok(cssBody('.tb-filter').includes('display:inline-flex'));
  assert.ok(cssBody('.sort-select').includes('min-height:var(--tap-min)'));
  assert.ok(cssBody('.sort-select').includes('font-size:var(--fs-md)'));
  assert.ok(INDEX.includes('@media(max-width:768px){.sort-select{font-size:16px;}}'), 'スマホは 16px');
  const bar = cssBody('.sort-bar.sticky-sort');
  for (const s of ['position:sticky', 'top:56px', 'z-index:140']) assert.ok(bar.includes(s), `帯: ${s}`);
  assert.ok(cssBody('.sort-select-wrap').includes('min-width:0'), '狭い画面で select が親を押し広げない');
  assert.ok(cssBody('.tb-filter .filter-badge[hidden]').includes('display:none'), 'hidden の丸は消える');
});

test('CSS: ↑ボタンはスマホ（〜768px）で下の固定バーの上に出る', () => {
  const m = INDEX.match(/@media\(max-width:768px\)\{#scroll-top\{bottom:calc\(([^)]*\)?[^)]*)\);\}\}/);
  assert.ok(m, '≤768px の #scroll-top の規則');
  assert.ok(/4\.5rem/.test(m[1]) && /safe-area-inset-bottom/.test(m[1]), 'バーの上（#fb-fab と同じ 4.5rem）＋セーフエリア');
});
