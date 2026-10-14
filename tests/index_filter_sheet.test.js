'use strict';
/**
 * tests/index_filter_sheet.test.js — 絞り込みシート（I-20・P-401・判断の記録 0037）
 *
 * トップ（index.html）の「絞り込みシート」（開く → 下書きを触る → 「N軒を見る」で反映 / ×・背景・Esc で捨てる）の動きを、
 * index.html の実物のコードのまま vm で動かして確かめる。絞り込みの判定そのもの（エリア・条件・人数の境目など）は
 * tests/index_filter_core.test.js が見る。ここは「シートが下書きをどう扱うか」を見る。
 *
 * 実物と偽物:
 *   ・実物 … 絞り込みシートの区画（NB_SHEET から、シートの外側の IIFE まで）・NB-FILTER 区画・検索エンジン（NB_SEARCH_ENGINE 区画）・
 *            initPillFold・normalizeGenre・priceToNum など。ポリシーの表（NB_FILTER_POLICY）は生成区画を読まず、
 *            scripts/lib/filter_policy.js の buildFilterPolicy に data/area_genre_pages_policy.json を通して作る
 *            （CI の build は npm test の前に生成区画を書き直すが、routine-pr-automerge は build 無しで走るため、生成区画の鮮度に左右されない）。
 *   ・偽物 … DOM（シートのボタン・本文・下の件数・body）。applyFilters（一覧の描画は見ず、呼ばれた順と、その時点の NB_FILTER・シートの開閉だけを残す）。
 *            trackEvent・setTimeout・scrollToResults / scrollToMagazine・getFavs。
 *            店は合成した 13 店（件数は店の表から数える）。data/stores.json は読まない。
 *
 * 守ること:
 *   ・開くと下書き = NB_FILTER の写し（別の入れ物）。押した結果は下書きにだけ入り、「N軒を見る」まで NB_FILTER（一覧の条件）は変わらない
 *   ・下の件数は nbCountStores（一覧と同じ判定）。0 軒の組は押せず、外すと増える条件が出る。何も選んでいなければ押せない。
 *     全店のデータが届く前は数えない
 *   ・「N軒を見る」は反映 → 閉じる → 一覧の切り替え → filter_apply を 1 回。×・背景・Esc は下書きを捨てる
 *   ・予算は 3 区分から 1 つ・エリアと条件とシーンは複数・ジャンルと人数は 1 つ
 *   ・閉じたら body のスクロールと焦点が戻る。見出し・ボタンはすべて日本語
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// 生成した巨大な行（店のデータ）は読まない
const INDEX = RAW.split('\n').filter((l) => !/^var LOCAL_STORES\b/.test(l)).join('\n');
const FP = require('../scripts/lib/filter_policy.js');
const HUB = require('../scripts/lib/area_genre_pages.js');
const POLICY = HUB.loadPolicy();

// ── index.html から取り出す ─────────────────────────────────────────────
// index.html の関数は、行頭の `}` で閉じる（中の `}` はインデントされている）
function fnSource(name) {
  const head = '\nfunction ' + name + '(';
  assert.strictEqual(INDEX.split(head).length - 1, 1, `function ${name} は 1 つだけ定義されている`);
  const a = INDEX.indexOf(head) + 1;
  const b = INDEX.indexOf('\n}\n', a);
  assert.ok(b > a, `function ${name} の終わりが見つからない`);
  return INDEX.slice(a, b + 2);
}
// `var NAME = …` の宣言（行頭）。終わりは closer（`];` など）の最初の出現
function declSource(name, closer) {
  const head = '\nvar ' + name + ' = ';
  assert.strictEqual(INDEX.split(head).length - 1, 1, `var ${name} は 1 つだけ定義されている`);
  const a = INDEX.indexOf(head) + 1;
  const b = INDEX.indexOf(closer, a);
  assert.ok(b > a, `var ${name} の終わりが見つからない`);
  return INDEX.slice(a, b + closer.length);
}
// 開始の印から終了の印まで（印はどちらも 1 つだけ）
function region(start, end) {
  assert.strictEqual(INDEX.split(start).length - 1, 1, `${start} は 1 つだけ`);
  assert.strictEqual(INDEX.split(end).length - 1, 1, `${end} は 1 つだけ`);
  const a = INDEX.indexOf(start);
  const b = INDEX.indexOf(end);
  assert.ok(a >= 0 && b > a, `${start} が ${end} より前にある`);
  return INDEX.slice(a, b + end.length);
}

const DEPS = [
  declSource('GENRE_ORDER', '];'),
  declSource('GENRE_RULES', '\n];'),
  fnSource('normalizeGenre'),
  declSource('SCENE_ALIAS', '\n};'),
  fnSource('nbSafeDecode'),
  fnSource('nbParseHash'),
  fnSource('priceToNum'),
  fnSource('initPillFold'),
  fnSource('nbEscHtml'),
].join('\n');
const ENGINE = region('// ==NB_SEARCH_ENGINE_START==', '// ==NB_SEARCH_ENGINE_END==');
const CORE = region('// NB-FILTER:START', '// NB-FILTER:END');
// シートの区画: `var NB_SHEET` から、次の区画（結果ブロックへのスクロール）の手前まで
const SHEET = (() => {
  const a = INDEX.indexOf('\nvar NB_SHEET = ');
  const b = INDEX.indexOf('\n// 結果ブロック先頭へスムーズスクロール', a);
  assert.ok(a > 0 && b > a, 'シートの区画が見つからない');
  assert.strictEqual(INDEX.split('\nvar NB_SHEET = ').length - 1, 1, 'var NB_SHEET は 1 つだけ');
  return INDEX.slice(a + 1, b);
})();

// 検索語があるときの偽の検索エンジン（店名に検索語を含む店だけ）
const FAKE_SUBSTR = [
  'var NB_SEARCH_META = null;',
  'function nbRunSearch(list, q) {',
  '  if (!q) { NB_SEARCH_META = null; return list; }',
  '  NB_SEARCH_META = { q: q };',
  '  return list.filter(function(s) { return String(s["店名"]).indexOf(q) !== -1; });',
  '}',
].join('\n');
// 数えると店の __score などを書き換える偽の検索エンジン（件数の計算が画面の一覧を壊さないことを見る）
const FAKE_MUTATE = [
  'var NB_SEARCH_META = null;',
  'function nbRunSearch(list, q) {',
  '  for (var i = 0; i < list.length; i++) { list[i].__score = 1000 + i; list[i].__why = ["fake"]; list[i].__hitCount = 1; }',
  '  NB_SEARCH_META = { fake: true, q: q };',
  '  return list.filter(function(s, i) { return i % 2 === 0; });',
  '}',
].join('\n');

// ── 偽の DOM ───────────────────────────────────────────────────────────
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function makeDom() {
  const reg = Object.create(null);
  const doc = { activeElement: null, body: null };
  class El {
    constructor(id) {
      this.id = id || '';
      this.attrs = Object.create(null);
      this.cls = new Set();
      this.style = {};
      this.children = [];
      this.parent = null;
      this.listeners = Object.create(null);
      this.disabled = false;
      this.textContent = '';
      this.value = '';
      this.scrollTop = 0;
      this.attached = true;
      this.onclick = null;
      this._html = '';
      const self = this;
      this.classList = {
        add(c) { self.cls.add(c); },
        remove(c) { self.cls.delete(c); },
        contains(c) { return self.cls.has(c); },
        toggle(c, force) {
          const want = force === undefined ? !self.cls.has(c) : !!force;
          if (want) self.cls.add(c); else self.cls.delete(c);
          return want;
        },
      };
      if (id) reg[id] = this;
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    hasAttribute(k) { return k in this.attrs; }
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
    focus() { doc.activeElement = this; }
    click() { if (this.onclick) this.onclick(); }
    contains(el) { return !!el && el.attached !== false; }
    get offsetParent() { return this.style.display === 'none' ? null : {}; }
    set innerHTML(h) { this._html = h; if (this.onHtml) this.onHtml(h); }
    get innerHTML() { return this._html; }
    closest(sel) {
      for (let e = this; e; e = e.parent) {
        if (sel[0] === '#' ? e.id === sel.slice(1) : sel[0] === '.' ? e.cls.has(sel.slice(1)) : false) return e;
      }
      return null;
    }
    querySelectorAll(sel) {
      if (sel === '.fs-extra') return this.children.filter((c) => c.cls.has('fs-extra'));
      if (sel === 'button:not([disabled])') return this.buttons().filter((b) => !b.disabled);
      throw new Error('偽の DOM が知らないセレクター: ' + sel);
    }
    buttons() { return []; }
  }
  const mk = (id) => new El(id);

  const wrap = mk('filter-sheet-wrap');
  const backdrop = mk('fs-backdrop');
  const sheet = mk('filter-sheet');
  const close = mk('fs-close');
  const body = mk('fs-body');
  const suggest = mk('fs-suggest');
  const reset = mk('fs-reset');
  const go = mk('fs-go');
  const live = mk('fs-live');
  const si = mk('si');
  [backdrop, sheet].forEach((e) => { e.parent = wrap; });
  [close, body, suggest, reset, go, live].forEach((e) => { e.parent = sheet; });
  go.textContent = '条件を選んでください';
  const pageBody = mk('');
  pageBody.style.overflow = '';
  doc.body = pageBody;

  // 本文（チップ）を HTML から作り直す。想定外の字句が残ったら失敗にする（構造の検査を兼ねる）
  body.sections = [];
  body.resetScrollOnHtml = false;
  body.onHtml = (html) => {
    Object.keys(reg).forEach((k) => { if (/^fs-(row|fold|sec)-/.test(k)) delete reg[k]; });
    body.sections = [];
    body.children = [];
    let rest = html;
    const secRe = /<section class="fs-sec" id="fs-sec-(\w+)"><h3 class="fs-h">([\s\S]*?)<\/h3><div class="fs-chips" id="fs-row-\1"(?: data-fold="(\d+)")?>([\s\S]*?)<\/div>(<button type="button" class="fold-toggle" id="fs-fold-\1"[^>]*><\/button>)?<\/section>/g;
    const chipRe = /<button type="button" class="(fs-chip(?: fs-extra)?)" data-k="([^"]*)" data-v="([^"]*)" aria-pressed="(true|false)">([^<]*)<\/button>/g;
    rest = rest.replace(secRe, (m, id, h, fold, chips, foldBtn) => {
      const hm = h.match(/^([^<]*)(?:<span class="fs-hint">([^<]*)<\/span>)?$/);
      assert.ok(hm, '見出しの形: ' + h);
      const row = mk('fs-row-' + id);
      row.parent = body;
      if (fold) row.setAttribute('data-fold', fold);
      const sec = { id, title: unesc(hm[1]), hint: hm[2] ? unesc(hm[2]) : '', row, chips: [], fold: null };
      const left = chips.replace(chipRe, (mm, cls, k, v, pr, label) => {
        const c = mk('');
        c.parent = row;
        cls.split(' ').forEach((x) => c.cls.add(x));
        c.setAttribute('data-k', k);
        c.setAttribute('data-v', unesc(v));
        c.setAttribute('aria-pressed', pr);
        c.label = unesc(label);
        c.textContent = c.label;
        row.children.push(c);
        sec.chips.push(c);
        return '';
      });
      assert.strictEqual(left, '', 'チップの組み立てに想定外の字句: ' + left.slice(0, 80));
      if (foldBtn) {
        const f = mk('fs-fold-' + id);
        f.parent = body;
        f.style.display = 'none';
        sec.fold = f;
      }
      body.sections.push(sec);
      return '';
    });
    assert.strictEqual(rest, '', '本文の組み立てに想定外の字句: ' + rest.slice(0, 80));
    if (body.resetScrollOnHtml) body.scrollTop = 0;
  };
  body.allChips = () => [].concat(...body.sections.map((s) => s.chips));
  sheet.buttons = () => [close].concat(body.allChips(), body.sections.map((s) => s.fold).filter(Boolean), [reset, go]);

  // 0 軒のときの「外すと増える」ボタン
  suggest.buttonsList = [];
  suggest.onHtml = (html) => {
    suggest.children = [];
    const re = /<button type="button" class="fs-suggest-btn" data-k="([^"]*)" data-v="([^"]*)">([^<]*)<\/button>/g;
    const left = html.replace(re, (m, k, v, label) => {
      const b = mk('');
      b.parent = suggest;
      b.cls.add('fs-suggest-btn');
      b.setAttribute('data-k', k);
      b.setAttribute('data-v', unesc(v));
      b.textContent = unesc(label);
      suggest.children.push(b);
      return '';
    });
    assert.strictEqual(left, '', '提案ボタンの組み立てに想定外の字句: ' + left);
  };

  doc.getElementById = (id) => reg[id] || null;
  doc.querySelectorAll = (sel) => {
    if (sel === '#fs-body .fs-chip') return body.allChips();
    throw new Error('偽の DOM が知らないセレクター: ' + sel);
  };
  const dispatch = (type, target, extra) => {
    const e = Object.assign({ type, target, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } }, extra || {});
    (wrap.listeners[type] || []).forEach((fn) => fn(e));
    return e;
  };
  return {
    doc, wrap, backdrop, sheet, close, body, suggest, reset, go, live, si, pageBody,
    // 実際のブラウザと同じく、押せないボタンはクリックを出さない
    click(el) { if (el.disabled) return null; return dispatch('click', el); },
    key(k, extra) { return dispatch('keydown', sheet, Object.assign({ key: k }, extra || {})); },
    chip(k, v) {
      const c = body.allChips().find((x) => x.getAttribute('data-k') === k && x.getAttribute('data-v') === String(v));
      assert.ok(c, `チップが無い: ${k}:${v}`);
      return c;
    },
    pressed() { return body.allChips().filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.getAttribute('data-k') + ':' + c.getAttribute('data-v')).sort(); },
    section(id) { const s = body.sections.find((x) => x.id === id); assert.ok(s, `見出しの区画が無い: ${id}`); return s; },
    El,
  };
}

// ── 合成した店 ─────────────────────────────────────────────────────────
// [店名, ジャンルの原文, エリアの原文, 価格帯, 追加の項目]
const SPEC = [
  ['S01', '居酒屋', '栄', '2001～3000円', { '個室': 'あり', 'タグ': 'デート', '宴会収容': '20' }],
  ['S02', '居酒屋', '栄', '3001～4000円', { '個室': 'なし', '飲み放題': 'あり' }],
  ['S03', '居酒屋', '名駅', '3001～5000円', { '個室': 'あり', 'タグ': 'デート,女子会' }],
  ['S04', '焼肉', '栄', '5001～6000円', { '個室': 'あり', '宴会収容': '35' }],
  ['S05', '焼肉', '金山', '6000～8000円', {}],
  ['S06', 'ラーメン', '名駅', '～1000円', {}],
  ['S07', '寿司', '金山', '8000～10000円', { '個室': 'あり' }],
  ['S08', '和食', '栄', '3001～4000円', { 'タグ': 'カウンター' }],
  ['S09', '中華料理', '名駅', '2001～3000円', { '宴会収容': '50', '禁煙': '全面禁煙' }],
  ['S10', 'イタリアン', '金山', '3001～4000円', {}],
  ['S11', '洋食', '栄', '4001～5000円', {}],
  ['S12', 'カフェ', '名駅', '1001～2000円', {}],
  ['S13', '居酒屋', '岡崎', '2001～3000円', {}],   // エリアの群に入らない
];
const mkStores = () => SPEC.map(([n, g, a, p, x]) => Object.assign({ '店名': n, 'ジャンル': g, 'エリア': a, '価格帯': p }, x));
const sel = (pred) => SPEC.filter((r) => pred(Object.assign({ n: r[0], g: r[1], a: r[2], p: r[3] }, r[4]))).length;

// ── 環境 ───────────────────────────────────────────────────────────────
function env(opts) {
  opts = opts || {};
  const dom = makeDom();
  const log = { apply: [], events: [], timers: [], cleared: [], scrolls: [], hash: [] };
  const pop = {};
  const setImmediateLike = () => (pop.popstate || []).forEach((f) => f());
  // 偽の履歴: back() は印（state）を戻すだけで、popstate は firePop() で届ける（実ブラウザでは非同期のため）
  const fakeHistory = {
    stack: [{ state: null, url: '#start' }], i: 0,
    get state() { return this.stack[this.i].state; },
    pushState(st, t, url) { this.stack.length = this.i + 1; this.stack.push({ state: st, url }); this.i++; },
    replaceState(st, t, url) { this.stack[this.i] = { state: st, url }; },
    // 実ブラウザの popstate は非同期。opts.manualPop のとき以外は、戻ったらすぐ届けて既存のテストを同期のまま動かす
    back() { this.i--; if (!opts.manualPop) setImmediateLike(); },
  };
  const ctx = {
    console,
    NB_FILTER_POLICY: FP.buildFilterPolicy(POLICY),
    document: dom.doc,
    window: { addEventListener(t, f) { (pop[t] = pop[t] || []).push(f); } },
    history: fakeHistory,
    location: { href: '#start' },
    __log: log,
    __favs: opts.favs || ['S01', 'S04'],
  };
  vm.createContext(ctx);
  const glue = [
    "var NB_FILTER = { genre: 'All', areas: [], conds: [], tags: [], cap: 0 };",
    'var ALL_STORES = [];',
    'var FILTERED = [];',
    'var SHOW_FAVS_ONLY = false;',
    'var FULL_CATALOG_LOADED = true;',
    'var FULL_CATALOG_FAILED = false;',
    'function getFavs() { return __favs; }',
    "function pushHash() { history.replaceState(history.state, '', 'H:' + JSON.stringify(NB_FILTER)); __log.hash.push(1); }",
    // 一覧の描画は見ない。呼ばれた順・その時点の条件・シートの開閉・body の状態だけ残す
    'function applyFilters() {',
    '  __log.apply.push({ open: NB_SHEET.open, filter: nbCloneFilter(NB_FILTER), overflow: document.body.style.overflow });',
    '  FILTERED = nbFilterStores(NB_FILTER, ALL_STORES, null);',
    "  document.body.classList.toggle('search-active', nbFilterCount(NB_FILTER) > 0);",
    '}',
    "function trackEvent(name, params) { __log.events.push({ name: name, params: params }); }",
    "function scrollToResults() { __log.scrolls.push('results'); }",
    "function scrollToMagazine() { __log.scrolls.push('magazine'); }",
    'function setTimeout(fn, ms) { __log.timers.push({ fn: fn, ms: ms }); return __log.timers.length; }',
    'function clearTimeout(id) { __log.cleared.push(id); }',
  ].join('\n');
  vm.runInContext([glue, DEPS, opts.engine || ENGINE, CORE, SHEET].join('\n'), ctx, { filename: 'index.html#filter-sheet' });
  vm.runInContext('ALL_STORES = ' + JSON.stringify(mkStores()) + ';', ctx);
  return { ctx, dom, log, history: fakeHistory, firePop: () => (pop.popstate || []).forEach((f) => f()), run: (src) => vm.runInContext(src, ctx) };
}
// vm の中で作った配列・オブジェクトは別の realm のもの。deepStrictEqual の前に素の形にする
const plain = (x) => JSON.parse(JSON.stringify(x));
const EMPTY = { genre: 'All', areas: [], conds: [], tags: [], cap: 0 };
const F = (o) => Object.assign({}, EMPTY, o || {});
function setFilter(e, f) { e.run('NB_FILTER = ' + JSON.stringify(F(f)) + ';'); }
const draftOf = (e) => plain(e.ctx.NB_SHEET.draft);
const filterOf = (e) => plain(e.ctx.NB_FILTER);
// 条件の札を押す・下の状態を読む
const press = (e, k, v) => e.dom.click(e.dom.chip(k, v));
const foot = (e) => ({ label: e.dom.go.textContent, disabled: e.dom.go.disabled, live: e.dom.live.textContent, reset: e.dom.reset.disabled, sug: e.dom.suggest.children.map((b) => b.textContent) });
const JA = /[぀-ヿ㐀-鿿]/;

// ── 準備: 合成した店の表が、ジャンル・エリアの意図どおりに読まれる ───────────
test('準備: 合成した店のジャンルとエリアの群が、この表の想定どおりに読まれる', () => {
  const e = env();
  const g = e.run('ALL_STORES.map(nbGenreOf)');
  assert.deepStrictEqual(plain(g), ['居酒屋', '居酒屋', '居酒屋', '焼肉・ホルモン', '焼肉・ホルモン', 'ラーメン', '寿司', '和食', '中華', 'イタリアン・フレンチ', '洋食', 'カフェ・スイーツ', '居酒屋']);
  const a = e.run('ALL_STORES.map(function(s) { return nbAreaSlug(s["エリア"]); })');
  assert.deepStrictEqual(plain(a), ['sakae', 'sakae', 'meieki', 'sakae', 'kanayama', 'meieki', 'kanayama', 'sakae', 'meieki', 'kanayama', 'sakae', 'meieki', '']);
});

// ── 構造（マークアップの契約）──────────────────────────────────────────
test('マークアップ: ダイアログの役割・見出し・閉じるボタンの説明・本文と下の欄の id', () => {
  const m = INDEX.match(/<div class="filter-sheet-wrap" id="filter-sheet-wrap">[\s\S]*?<div class="visually-hidden" id="fs-live" role="status" aria-live="polite"><\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
  assert.ok(m, 'シートの HTML が見つからない');
  const h = m[0];
  assert.ok(/<div class="filter-sheet" id="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="fs-title" tabindex="-1">/.test(h), 'role=dialog・aria-modal・aria-labelledby・焦点を受けられる');
  assert.ok(/<h2 class="fs-title" id="fs-title">絞り込み<\/h2>/.test(h), '見出し');
  assert.ok(/<button type="button" class="fs-close" id="fs-close" aria-label="閉じる（変更は反映されません）">/.test(h), '閉じる（反映されないことを読み上げる）');
  ['fs-backdrop', 'fs-body', 'fs-suggest', 'fs-reset', 'fs-go', 'fs-live'].forEach((id) => assert.ok(h.includes('id="' + id + '"'), `#${id} がある`));
  assert.ok(/<button type="button" class="fs-reset" id="fs-reset">条件を外す<\/button>/.test(h), '「条件を外す」');
  assert.ok(/<button type="button" class="fs-go" id="fs-go">条件を選んでください<\/button>/.test(h), '主ボタンの初期文言');
});

// ── ① 開くと下書き ──────────────────────────────────────────────────────
test('①開く: 下書きは NB_FILTER の写し（別の入れ物）・現在の条件が aria-pressed=true・body のスクロールを止める・焦点がシートへ', () => {
  const e = env();
  const cur = F({ genre: '居酒屋', areas: ['sakae'], conds: ['koshitsu'], tags: ['デート'], cap: 10 });
  setFilter(e, cur);
  const opener = new e.dom.El('tb-filter-btn');
  e.dom.pageBody.style.overflow = 'scroll';
  e.dom.body.scrollTop = 77;
  e.run('nbOpenFilterSheet').call(null, opener);
  assert.strictEqual(e.ctx.NB_SHEET.open, true);
  assert.deepStrictEqual(draftOf(e), cur, '下書き = 現在の条件');
  assert.ok(e.ctx.NB_SHEET.draft !== e.ctx.NB_FILTER, '同じ入れ物ではない');
  assert.ok(e.ctx.NB_SHEET.draft.areas !== e.ctx.NB_FILTER.areas && e.ctx.NB_SHEET.draft.conds !== e.ctx.NB_FILTER.conds && e.ctx.NB_SHEET.draft.tags !== e.ctx.NB_FILTER.tags, '配列も別');
  assert.deepStrictEqual(e.dom.pressed(), ['area:sakae', 'cap:10', 'cond:koshitsu', 'genre:居酒屋', 'tag:デート'], '現在の条件だけが押された状態');
  assert.ok(e.dom.wrap.classList.contains('open'), '開いたクラス');
  assert.strictEqual(e.dom.pageBody.style.overflow, 'hidden', 'body のスクロールを止める');
  assert.strictEqual(e.dom.body.scrollTop, 0, '本文は先頭から');
  assert.strictEqual(e.ctx.NB_SHEET.opener, opener, '開いたボタンを覚える');
  assert.strictEqual(e.dom.doc.activeElement, e.dom.sheet, '焦点はシートへ');
  assert.strictEqual(e.run('nbFilterSheetIsOpen()'), true);
});

test('①開く: 開いている間にもう一度開いても、下書き・開いたボタン・退避したスクロールを上書きしない', () => {
  const e = env();
  const first = new e.dom.El('b1');
  const second = new e.dom.El('b2');
  e.dom.pageBody.style.overflow = 'scroll';
  e.run('nbOpenFilterSheet').call(null, first);
  press(e, 'area', 'sakae');
  e.run('nbOpenFilterSheet').call(null, second);
  assert.strictEqual(e.ctx.NB_SHEET.opener, first, '開いたボタンはそのまま');
  assert.deepStrictEqual(draftOf(e).areas, ['sakae'], '下書きはそのまま（作り直さない）');
  assert.strictEqual(e.ctx.NB_SHEET.prevOverflow, 'scroll', '退避したスクロールの値は hidden に上書きされない');
  e.run('nbCloseFilterSheet()');
  assert.strictEqual(e.dom.pageBody.style.overflow, 'scroll');
});

test('①開く: 開いたボタンが渡されなければ、そのとき焦点のあった要素を覚える・シートの HTML が無ければ何もしない', () => {
  const e = env();
  const active = new e.dom.El('focused');
  e.dom.doc.activeElement = active;
  e.run('nbOpenFilterSheet()');
  assert.strictEqual(e.ctx.NB_SHEET.opener, active);
  const e2 = env();
  delete e2.dom.doc.getElementById('filter-sheet-wrap').id;
  e2.dom.doc.getElementById = () => null;
  e2.run('nbOpenFilterSheet()');
  assert.strictEqual(e2.ctx.NB_SHEET.open, false, 'シートが無ければ開かない');
});

test('①開く: 開くたびに NB_FILTER から作り直す（前回の捨てた下書きは残らない・反映した条件は押された状態で出る）', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  e.run('nbCloseFilterSheet()');
  e.run('nbOpenFilterSheet()');
  assert.deepStrictEqual(draftOf(e), EMPTY, '捨てた下書きは戻らない');
  assert.deepStrictEqual(e.dom.pressed(), []);
  press(e, 'area', 'sakae');
  e.dom.click(e.dom.go);
  e.run('nbOpenFilterSheet()');
  assert.deepStrictEqual(e.dom.pressed(), ['area:sakae'], '反映した条件が押された状態で出る');
});

// ── ② 押すと下書きだけが変わる ─────────────────────────────────────────
test('②チップを押す: 下書きだけが変わり、NB_FILTER（一覧の条件）・一覧の再描画・計測は動かない。押した状態が aria-pressed に出る', () => {
  const e = env();
  const cur = F({ areas: ['sakae'] });
  setFilter(e, cur);
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'meieki');
  press(e, 'genre', '居酒屋');
  press(e, 'tag', 'デート');
  assert.deepStrictEqual(draftOf(e), F({ genre: '居酒屋', areas: ['sakae', 'meieki'].sort((a, b) => (e.ctx.NB_FILTER_POLICY.areas.findIndex((x) => x.slug === a) - e.ctx.NB_FILTER_POLICY.areas.findIndex((x) => x.slug === b))), tags: ['デート'] }), '下書きに入る（決まった順）');
  assert.deepStrictEqual(filterOf(e), cur, 'NB_FILTER は変わらない');
  assert.strictEqual(e.log.apply.length, 0, '一覧は描き直さない');
  assert.strictEqual(e.log.events.length, 0, '計測は送らない');
  assert.deepStrictEqual(e.dom.pressed(), ['area:meieki', 'area:sakae', 'genre:居酒屋', 'tag:デート']);
  press(e, 'area', 'sakae');
  assert.deepStrictEqual(e.dom.pressed(), ['area:meieki', 'genre:居酒屋', 'tag:デート'], 'もう一度押すと外れる');
  assert.deepStrictEqual(filterOf(e), cur);
});

test('②チップを押す: シートが閉じているときのクリックは何もしない（下書きが無い）', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  const c = e.dom.chip('area', 'sakae');
  e.run('nbCloseFilterSheet()');
  e.dom.click(c);
  assert.strictEqual(e.ctx.NB_SHEET.draft, null);
  assert.strictEqual(e.ctx.NB_SHEET.open, false);
  e.dom.click(e.dom.go);
  assert.strictEqual(e.log.apply.length, 0);
});

// ── ③ 件数 ─────────────────────────────────────────────────────────────
test('③下の件数: 「N軒を見る」の N は nbCountStores と一致し、店の表から数えた件数とも一致する・読み上げ欄も同じ件数', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  let want = sel((s) => s.a === '栄');
  assert.strictEqual(want, 5);
  assert.deepStrictEqual([foot(e).label, foot(e).disabled, foot(e).live], ['5軒を見る', false, '5軒が当てはまります']);
  assert.strictEqual(e.run("nbCountStores(NB_SHEET.draft, ALL_STORES, '', null)"), want, 'nbCountStores と一致');
  press(e, 'cond', 'koshitsu');
  want = sel((s) => s.a === '栄' && s['個室'] === 'あり');
  assert.strictEqual(want, 2);
  assert.strictEqual(foot(e).label, '2軒を見る');
  press(e, 'area', 'meieki');   // エリアは和集合
  want = sel((s) => (s.a === '栄' || s.a === '名駅') && s['個室'] === 'あり');
  assert.strictEqual(want, 3);
  assert.strictEqual(foot(e).label, '3軒を見る');
  press(e, 'cond', 'koshitsu');
  press(e, 'genre', '居酒屋');
  assert.strictEqual(foot(e).label, sel((s) => (s.a === '栄' || s.a === '名駅') && s.g === '居酒屋') + '軒を見る');
  press(e, 'cap', 30);
  assert.strictEqual(foot(e).label, '該当するお店がありません', '宴会 30 名以上の居酒屋は、栄・名駅に無い');
});

test('③下の件数: 千軒を超えると桁区切りが付く（1,200軒を見る）', () => {
  const e = env();
  e.run('ALL_STORES = [];for (var i = 0; i < 1200; i++) ALL_STORES.push({ "店名": "X" + i, "ジャンル": "居酒屋", "エリア": "栄", "価格帯": "2001～3000円" });');
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  assert.deepStrictEqual([foot(e).label, foot(e).live], ['1,200軒を見る', '1,200軒が当てはまります']);
  // 提案の数も桁区切り
  press(e, 'cond', 'koshitsu');
  assert.deepStrictEqual(foot(e).sug, ['個室ありを外す（+1,200軒）']);
});

test('③下の件数: 検索語（#si）と保存済みの絞りも同じ判定で数える', () => {
  const e = env({ engine: FAKE_SUBSTR });
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  e.dom.si.value = '  S0  ';
  assert.strictEqual(e.run('nbSheetQuery()'), 'S0', '前後の空白を除く');
  e.dom.click(e.dom.chip('area', 'sakae'));
  e.dom.click(e.dom.chip('area', 'sakae'));   // 外して付け直し → 件数を数え直す
  assert.strictEqual(foot(e).label, sel((s) => s.a === '栄' && s.n.indexOf('S0') !== -1) + '軒を見る', '検索語を掛けた件数');
  e.dom.si.value = '';
  e.run('SHOW_FAVS_ONLY = true');
  e.dom.click(e.dom.chip('area', 'sakae'));
  e.dom.click(e.dom.chip('area', 'sakae'));
  assert.strictEqual(foot(e).label, '2軒を見る', '保存済み（S01・S04）の栄の店');
});

test('③下の件数: 数えても画面の一覧の店（__score・__why・__hitCount）と検索のメタを壊さない', () => {
  const e = env({ engine: FAKE_MUTATE });
  e.run('ALL_STORES[0].__score = 5; ALL_STORES[0].__why = ["keep"]; NB_SEARCH_META = { keep: true };');
  e.dom.si.value = '栄';
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  press(e, 'cond', 'koshitsu');
  const s0 = plain(e.run('ALL_STORES[0]'));
  assert.strictEqual(s0.__score, 5);
  assert.deepStrictEqual(s0.__why, ['keep']);
  assert.ok(!('__hitCount' in s0), '元に無かった印は残さない');
  assert.ok(!('__score' in plain(e.run('ALL_STORES[1]'))));
  assert.deepStrictEqual(plain(e.run('NB_SEARCH_META')), { keep: true });
});

// ── ③ 0 軒 ─────────────────────────────────────────────────────────────
test('③0 軒: 押せず「該当するお店がありません」・外すと増える条件のボタン（外すと +N軒）が多い順に出る・押すと外れて押せるようになり焦点が主ボタンへ', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  press(e, 'genre', '焼肉・ホルモン');
  press(e, 'area', 'meieki');
  assert.strictEqual(sel((s) => s.g === '焼肉' && s.a === '名駅'), 0);
  const f = foot(e);
  assert.deepStrictEqual([f.label, f.disabled, f.live], ['該当するお店がありません', true, '該当するお店がありません']);
  // ジャンルを外す → 名駅の店 4 軒。エリアを外す → 焼肉の店 2 軒
  assert.deepStrictEqual(f.sug, ['焼肉・ホルモンを外す（+4軒）', '名駅（名古屋駅）を外す（+2軒）']);
  const btn = e.dom.suggest.children[0];
  assert.deepStrictEqual([btn.getAttribute('data-k'), btn.getAttribute('data-v')], ['genre', '焼肉・ホルモン']);
  e.dom.click(btn);
  assert.deepStrictEqual(draftOf(e), F({ areas: ['meieki'] }), '押した条件が下書きから外れる');
  const g = foot(e);
  assert.deepStrictEqual([g.label, g.disabled, g.sug], ['4軒を見る', false, []]);
  assert.strictEqual(e.dom.doc.activeElement, e.dom.go, '押したボタンは消えるので焦点を主ボタンへ');
  assert.deepStrictEqual(filterOf(e), EMPTY, 'NB_FILTER は変わらない');
});

test('③0 軒: 主ボタンを押しても何も起きない（反映されず・閉じず・計測なし）。外すと増える条件が無いときは提案も空', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  press(e, 'genre', '焼肉・ホルモン');
  press(e, 'area', 'meieki');
  e.run('nbCommitFilterSheet()');
  assert.strictEqual(e.ctx.NB_SHEET.open, true);
  assert.deepStrictEqual(filterOf(e), EMPTY);
  assert.strictEqual(e.log.events.length + e.log.apply.length, 0);
  // どの条件を 1 つ外しても 0 軒のまま: 提案が出ない
  const e2 = env();
  e2.run('ALL_STORES = [{ "店名": "Z", "ジャンル": "居酒屋", "エリア": "栄", "価格帯": "2001～3000円" }]');
  setFilter(e2, { genre: '焼肉・ホルモン' });   // 載っていないジャンルは、選んでいるときだけ出る
  e2.run('nbOpenFilterSheet()');
  press(e2, 'area', 'meieki');
  const f = foot(e2);
  assert.strictEqual(f.label, '該当するお店がありません');
  assert.deepStrictEqual(f.sug, [], '1 つ外しても 0 軒のままなら、提案は出さない');
});

test('③0 軒: 検索語があっても、提案は条件を外す案だけ（検索語を外す案は出さない。シートは検索語を持たない）', () => {
  const e = env({ engine: FAKE_SUBSTR });
  e.dom.si.value = 'S1';
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  press(e, 'cond', 'koshitsu');
  assert.strictEqual(sel((s) => s.n.indexOf('S1') !== -1 && s.a === '栄' && s['個室'] === 'あり'), 0);
  assert.strictEqual(sel((s) => s.a === '栄' && s['個室'] === 'あり'), 2, '検索語を外せば増える店はある（それでも案には出さない）');
  assert.deepStrictEqual(foot(e).sug, ['個室ありを外す（+1軒）']);
});

test('③0 軒: 提案は増える軒数の多い順に上位 3 つまで（増えない条件は出さない）', () => {
  const e = env();
  const st = (n, a, koshitsu, nomi, tag) => ({ '店名': n, 'ジャンル': '居酒屋', 'エリア': a, '価格帯': '2001～3000円', '個室': koshitsu ? 'あり' : 'なし', '飲み放題': nomi ? 'あり' : 'なし', 'タグ': tag ? 'デート' : '' });
  // どの店も、4 つの条件（栄・個室・飲み放題・デート）のうち 1 つだけ足りない
  e.run('ALL_STORES = ' + JSON.stringify([
    st('A1', '栄', false, true, true), st('A2', '栄', false, true, true),   // 個室だけ足りない × 2
    st('B', '栄', true, false, true),                                      // 飲み放題だけ足りない
    st('C', '栄', true, true, false),                                      // デートだけ足りない
    st('D', '名駅', true, true, true),                                     // 栄だけ足りない
  ]));
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  press(e, 'cond', 'koshitsu');
  press(e, 'cond', 'nomihodai');
  press(e, 'tag', 'デート');
  assert.strictEqual(foot(e).label, '該当するお店がありません');
  assert.deepStrictEqual(foot(e).sug, ['個室ありを外す（+2軒）', '栄を外す（+1軒）', '飲み放題ありを外す（+1軒）'], '4 つのうち上位 3 つ・多い順');
});

// ── ④ 何も選んでいない ─────────────────────────────────────────────────
test('④何も選んでいない: 「条件を選んでください」で押せない・押しても何も起きない・「条件を外す」も押せない', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  const f = foot(e);
  assert.deepStrictEqual([f.label, f.disabled, f.reset, f.live], ['条件を選んでください', true, true, '条件を選んでください']);
  assert.strictEqual(e.run('nbSheetFooterState().count'), 13, '件数は全店');
  e.dom.click(e.dom.go);
  e.run('nbCommitFilterSheet()');
  assert.strictEqual(e.ctx.NB_SHEET.open, true);
  assert.strictEqual(e.log.apply.length + e.log.events.length, 0);
  press(e, 'area', 'sakae');
  assert.strictEqual(foot(e).reset, false, '条件を選ぶと「条件を外す」が押せる');
  press(e, 'area', 'sakae');
  assert.deepStrictEqual([foot(e).label, foot(e).disabled, foot(e).reset], ['条件を選んでください', true, true], '外し切ると元に戻る');
});

test('④何も選んでいない: いまの条件があるときだけ「条件を外して閉じる」（押すと NB_FILTER を空にして閉じ、filter_apply は条件 0 で 1 回）', () => {
  const e = env();
  setFilter(e, { areas: ['sakae'], tags: ['デート'] });
  e.run('nbOpenFilterSheet()');
  e.dom.click(e.dom.reset);
  assert.deepStrictEqual(draftOf(e), EMPTY);
  const f = foot(e);
  assert.deepStrictEqual([f.label, f.disabled, f.reset], ['条件を外して閉じる', false, true]);
  assert.deepStrictEqual(filterOf(e), F({ areas: ['sakae'], tags: ['デート'] }), 'まだ反映しない');
  e.dom.click(e.dom.go);
  assert.deepStrictEqual(filterOf(e), EMPTY);
  assert.strictEqual(e.ctx.NB_SHEET.open, false);
  assert.deepStrictEqual(e.log.events.map((x) => [x.name, plain(x.params)]), [['filter_apply', { condition_count: 0, result_count: 13 }]]);
  assert.deepStrictEqual(e.log.scrolls, ['magazine'], '条件が無くなったら雑誌面へ戻る');
});

test('④何も選んでいない: 検索語か保存済みがあれば、条件が空でも件数を出して押せる（「条件を選んでください」ではない）', () => {
  const e = env({ engine: FAKE_SUBSTR });
  e.dom.si.value = 'S1';
  e.run('nbOpenFilterSheet()');
  assert.deepStrictEqual([foot(e).label, foot(e).disabled], ['4軒を見る', false], 'S10〜S13');
  const e2 = env();
  e2.run('SHOW_FAVS_ONLY = true');
  e2.run('nbOpenFilterSheet()');
  assert.deepStrictEqual([foot(e2).label, foot(e2).disabled], ['2軒を見る', false]);
});

// ── ⑤ 読み込み中 ───────────────────────────────────────────────────────
test('⑤全店のデータが届く前: 「読み込み中…」で件数を出さず押せない・押しても反映しない。届くと数え直し、下書きとスクロールは保つ', () => {
  const e = env();
  e.run('FULL_CATALOG_LOADED = false');
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  let f = foot(e);
  assert.deepStrictEqual([f.label, f.disabled, f.live, f.sug], ['読み込み中…', true, '読み込み中…', []]);
  assert.ok(!/\d/.test(f.label), '件数を出さない');
  e.run('nbCommitFilterSheet()');
  assert.strictEqual(e.ctx.NB_SHEET.open, true);
  assert.deepStrictEqual(filterOf(e), EMPTY);
  // 届いた
  e.run('FULL_CATALOG_LOADED = true');
  e.dom.body.resetScrollOnHtml = true;   // 本文を作り直すとブラウザはスクロールを失う
  e.dom.body.scrollTop = 120;
  e.run('nbRefreshFilterSheet()');
  assert.strictEqual(e.dom.body.scrollTop, 120, 'スクロール位置を保つ');
  f = foot(e);
  assert.deepStrictEqual([f.label, f.disabled], ['5軒を見る', false]);
  assert.deepStrictEqual(draftOf(e), F({ areas: ['sakae'] }), '下書きは保つ');
  assert.deepStrictEqual(e.dom.pressed(), ['area:sakae'], '押された状態も作り直したあとに出る');
});

test('⑤全店のデータが届く前: 読み込みに失敗した場合は待たずに、いまある店で数える', () => {
  const e = env();
  e.run('FULL_CATALOG_LOADED = false; FULL_CATALOG_FAILED = true;');
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  assert.deepStrictEqual([foot(e).label, foot(e).disabled], ['5軒を見る', false]);
});

test('⑤読み込み中: 何も選んでいなくても「読み込み中…」（「条件を選んでください」より先）', () => {
  const e = env();
  e.run('FULL_CATALOG_LOADED = false');
  e.run('nbOpenFilterSheet()');
  assert.deepStrictEqual([foot(e).label, foot(e).disabled], ['読み込み中…', true]);
});

test('⑤全店のデータの更新: 作り直しは NB_FILTER でなく下書きから（下書きにだけある条件も出る）', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  e.run("NB_SHEET.draft = nbToggleFilter(NB_SHEET.draft, 'tag', '個室')");   // 古いリンクの条件が下書きに入っている
  e.run("NB_SHEET.draft = nbToggleFilter(NB_SHEET.draft, 'genre', '焼肉・ホルモン')");
  e.run('ALL_STORES = ALL_STORES.slice(0, 3)');   // 焼肉の店が（まだ）載っていない
  e.run('nbRefreshFilterSheet()');
  assert.deepStrictEqual(e.dom.section('other').chips.map((c) => c.label), ['個室']);
  assert.ok(e.dom.section('genre').chips.some((c) => c.label === '焼肉・ホルモン'), '選んでいるジャンルは載っていなくても出す');
  assert.deepStrictEqual(e.dom.pressed(), ['genre:焼肉・ホルモン', 'tag:個室']);
});

test('⑤全店のデータの更新: 閉じているシートは作り直さない・ジャンルの並びは載っている店から作り直す', () => {
  const e = env();
  e.run('nbRefreshFilterSheet()');
  assert.strictEqual(e.dom.body.innerHTML, '', '閉じていれば何もしない');
  e.run('ALL_STORES = ALL_STORES.slice(0, 3)');   // 居酒屋だけ
  e.run('nbOpenFilterSheet()');
  assert.deepStrictEqual(e.dom.section('genre').chips.map((c) => c.label), ['居酒屋']);
  e.run('ALL_STORES = ' + JSON.stringify(mkStores()));
  e.run('nbRefreshFilterSheet()');
  assert.strictEqual(e.dom.section('genre').chips.length, 9, '届いた店のジャンルが増える');
});

// ── ⑥ 反映 ─────────────────────────────────────────────────────────────
test('⑥「N軒を見る」: 下書きを正規化して NB_FILTER に入れ、閉じてから一覧を切り替え、filter_apply を 1 回送る（条件の数・結果の数）', () => {
  const e = env();
  e.dom.pageBody.style.overflow = 'scroll';
  e.run('nbOpenFilterSheet()');
  press(e, 'tag', 'デート');    // 押した順は 「デート」→「エリア」→「個室」 でも、保存する並びは決まった順
  press(e, 'area', 'meieki');
  press(e, 'area', 'sakae');
  press(e, 'cond', 'koshitsu');
  const want = sel((s) => (s.a === '栄' || s.a === '名駅') && s['個室'] === 'あり' && (s['タグ'] || '').split(',').indexOf('デート') !== -1);
  assert.strictEqual(want, 2);
  assert.strictEqual(foot(e).label, want + '軒を見る');
  e.dom.click(e.dom.go);
  assert.deepStrictEqual(filterOf(e), F({ areas: ['meieki', 'sakae'], conds: ['koshitsu'], tags: ['デート'] }), '決まった順（エリアは表の順）');
  assert.strictEqual(e.ctx.NB_SHEET.open, false);
  assert.strictEqual(e.ctx.NB_SHEET.draft, null);
  assert.strictEqual(e.log.apply.length, 1, '一覧の切り替えは 1 回');
  assert.strictEqual(e.log.apply[0].open, false, '切り替えの時点ではシートは閉じている（スクロールの自動移動を止める条件が外れている）');
  assert.strictEqual(e.log.apply[0].overflow, 'scroll', 'body のスクロールも戻っている');
  assert.deepStrictEqual(plain(e.log.apply[0].filter), F({ areas: ['meieki', 'sakae'], conds: ['koshitsu'], tags: ['デート'] }), '切り替えの時点で NB_FILTER は反映済み');
  assert.strictEqual(e.log.events.length, 1, '計測は 1 回');
  assert.deepStrictEqual([e.log.events[0].name, plain(e.log.events[0].params)], ['filter_apply', { condition_count: 4, result_count: want }]);
  assert.strictEqual(e.ctx.FILTERED.length, want, '一覧の件数 = 下の「N軒を見る」');
  assert.ok(!e.dom.wrap.classList.contains('open'));
});

test('⑥「N軒を見る」: 反映した NB_FILTER は下書きと別の入れ物（閉じたあとに下書きを触っても変わらない）', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  const draft = e.ctx.NB_SHEET.draft;
  e.run('nbCommitFilterSheet()');
  assert.ok(e.ctx.NB_FILTER !== draft);
  draft.areas.push('meieki');
  assert.deepStrictEqual(filterOf(e).areas, ['sakae']);
});

test('⑥「N軒を見る」: 条件が残るときは結果の先頭へスクロール（80ms 後に 1 回・前の予約は取り消す）。シートが閉じているときの commit は何もしない', () => {
  const e = env();
  e.run('window.__scrollToResultsTimer = 41;');
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  e.dom.click(e.dom.go);
  assert.deepStrictEqual(e.log.cleared, [41], '前の予約は取り消す');
  assert.strictEqual(e.log.timers.length, 1);
  assert.strictEqual(e.log.timers[0].ms, 80);
  e.log.timers[0].fn();
  assert.deepStrictEqual(e.log.scrolls, ['results']);
  // 閉じた後の commit
  e.run('nbCommitFilterSheet()');
  assert.strictEqual(e.log.apply.length, 1);
  assert.strictEqual(e.log.events.length, 1);
});

test('⑥「N軒を見る」: 主ボタンのクリックは委譲された 1 か所で commit される（二重送信しない）', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae');
  e.dom.click(e.dom.go);
  e.dom.click(e.dom.go);   // 閉じたあとの 2 回目
  assert.strictEqual(e.log.events.length, 1);
  assert.strictEqual(e.log.apply.length, 1);
});

// ── ⑦ 捨てる ───────────────────────────────────────────────────────────
test('⑦×・背景・Esc: 下書きを捨てて閉じる。NB_FILTER は変わらず、一覧の切り替えも計測もしない', () => {
  [
    ['×', (e) => e.dom.click(e.dom.close)],
    ['背景', (e) => e.dom.click(e.dom.backdrop)],
    ['Esc', (e) => { const ev = e.dom.key('Escape'); assert.ok(ev.defaultPrevented && ev.stopped, 'Esc は他へ伝えない（店のモーダルまで閉じない）'); }],
  ].forEach(([name, act]) => {
    const e = env();
    const cur = F({ areas: ['sakae'] });
    setFilter(e, cur);
    e.dom.pageBody.style.overflow = 'auto';
    const opener = new e.dom.El('op');
    e.run('nbOpenFilterSheet').call(null, opener);
    press(e, 'area', 'meieki');
    press(e, 'genre', '居酒屋');
    act(e);
    assert.strictEqual(e.ctx.NB_SHEET.open, false, name + ': 閉じる');
    assert.strictEqual(e.ctx.NB_SHEET.draft, null, name + ': 下書きを捨てる');
    assert.deepStrictEqual(filterOf(e), cur, name + ': NB_FILTER は変わらない');
    assert.strictEqual(e.log.apply.length + e.log.events.length, 0, name + ': 切り替えも計測も無い');
    assert.ok(!e.dom.wrap.classList.contains('open'), name);
    assert.strictEqual(e.dom.pageBody.style.overflow, 'auto', name + ': スクロールが戻る');
    assert.strictEqual(e.dom.doc.activeElement, opener, name + ': 焦点が開いたボタンへ戻る');
  });
});

test('⑦背景: 背景以外（シートの中の余白）を押しても閉じない・シート以外のキーでは閉じない・閉じているときの Esc は何もしない', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  e.dom.click(e.dom.sheet);
  e.dom.click(e.dom.body);
  assert.strictEqual(e.ctx.NB_SHEET.open, true);
  e.dom.key('Enter');
  e.dom.key('a');
  assert.strictEqual(e.ctx.NB_SHEET.open, true);
  e.run('nbCloseFilterSheet()');
  const ev = e.dom.key('Escape');
  assert.strictEqual(ev.defaultPrevented, false, '閉じているときは Esc を奪わない');
});

test('⑦閉じる: 閉じているときに呼んでも、スクロールの値や焦点を壊さない（二重に閉じても hidden のままにならない）', () => {
  const e = env();
  e.dom.pageBody.style.overflow = 'scroll';
  e.run('nbOpenFilterSheet()');
  e.run('nbCloseFilterSheet()');
  e.dom.pageBody.style.overflow = 'visible';
  e.run('nbCloseFilterSheet()');
  assert.strictEqual(e.dom.pageBody.style.overflow, 'visible', '2 回目は何もしない');
});

// ── ⑧ 選び方 ───────────────────────────────────────────────────────────
test('⑧予算: 3 区分から 1 つ（別の区分を押すと入れ替わり・同じものを押すと外れる）', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  const bud = e.dom.section('budget');
  assert.deepStrictEqual(bud.chips.map((c) => [c.getAttribute('data-k'), c.getAttribute('data-v'), c.label]), [
    ['cond', 'budget-3000', '3,000円以下'], ['cond', 'budget-3001-5000', '3,001〜5,000円'], ['cond', 'budget-5000-plus', '5,001円以上']]);
  press(e, 'cond', 'budget-3000');
  assert.deepStrictEqual(draftOf(e).conds, ['budget-3000']);
  press(e, 'cond', 'budget-5000-plus');
  assert.deepStrictEqual(draftOf(e).conds, ['budget-5000-plus'], '入れ替わる');
  assert.deepStrictEqual(e.dom.pressed(), ['cond:budget-5000-plus']);
  press(e, 'cond', 'budget-3001-5000');
  assert.deepStrictEqual(draftOf(e).conds, ['budget-3001-5000']);
  assert.strictEqual(foot(e).label, sel((s) => ['S02', 'S03', 'S08', 'S10', 'S11'].indexOf(s.n) !== -1) + '軒を見る', '3,001〜5,000円に収まる店（S02・S03・S08・S10・S11）');
  press(e, 'cond', 'budget-3001-5000');
  assert.deepStrictEqual(draftOf(e).conds, [], '同じものを押すと外れる');
  // 予算と他の条件は一緒に選べる（予算を押しても個室は外れない）
  press(e, 'cond', 'koshitsu');
  press(e, 'cond', 'budget-3000');
  assert.deepStrictEqual(draftOf(e).conds.sort(), ['budget-3000', 'koshitsu']);
});

test('⑧喫煙: 「喫煙できる店」と「全席禁煙」は同時に選べない（片方を押すともう片方が外れる）', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  press(e, 'cond', 'smoking-ok');
  press(e, 'cond', 'non-smoking');
  assert.deepStrictEqual(draftOf(e).conds, ['non-smoking']);
});

test('⑧エリアと条件とシーンは複数・ジャンルと人数は 1 つ', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  press(e, 'area', 'sakae'); press(e, 'area', 'meieki'); press(e, 'area', 'kanayama');
  assert.strictEqual(draftOf(e).areas.length, 3, 'エリアは複数');
  press(e, 'cond', 'koshitsu'); press(e, 'cond', 'nomihodai'); press(e, 'cond', 'lunch');
  assert.strictEqual(draftOf(e).conds.length, 3, '条件は複数');
  press(e, 'tag', 'デート'); press(e, 'tag', '女子会'); press(e, 'tag', 'カウンター');
  assert.strictEqual(draftOf(e).tags.length, 3, 'シーン・席のタグは複数');
  press(e, 'genre', '居酒屋'); press(e, 'genre', '焼肉・ホルモン');
  assert.strictEqual(draftOf(e).genre, '焼肉・ホルモン', 'ジャンルは 1 つ（入れ替わる）');
  press(e, 'genre', '焼肉・ホルモン');
  assert.strictEqual(draftOf(e).genre, 'All', '同じものを押すと外れる');
  assert.deepStrictEqual(e.dom.pressed().filter((x) => x.indexOf('genre:') === 0), []);
});

// ── ⑨ 人数 ─────────────────────────────────────────────────────────────
test('⑨人数: 「N名以上」のボタンから 1 つ（10・20・30・50）。別の人数を押すと入れ替わり、同じものを押すと外れる。件数は宴会収容に従う', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  const cap = e.dom.section('cap');
  assert.deepStrictEqual(cap.chips.map((c) => [c.getAttribute('data-k'), c.getAttribute('data-v'), c.label]),
    [['cap', '10', '10名以上'], ['cap', '20', '20名以上'], ['cap', '30', '30名以上'], ['cap', '50', '50名以上']]);
  press(e, 'cap', 20);
  assert.strictEqual(draftOf(e).cap, 20);
  assert.strictEqual(foot(e).label, sel((s) => parseInt(s['宴会収容'], 10) >= 20) + '軒を見る', '20 名以上（S01・S04・S09）');
  press(e, 'cap', 50);
  assert.strictEqual(draftOf(e).cap, 50, '入れ替わる');
  assert.deepStrictEqual(e.dom.pressed(), ['cap:50']);
  assert.strictEqual(foot(e).label, '1軒を見る');
  press(e, 'cap', 50);
  assert.strictEqual(draftOf(e).cap, 0, '同じものを押すと外れる');
});

test('⑨人数: 古いリンクの人数（cap=35）は押された状態で、決まった位置（30 と 50 の間）に出る', () => {
  const e = env();
  setFilter(e, { cap: 35 });
  e.run('nbOpenFilterSheet()');
  const cap = e.dom.section('cap');
  assert.deepStrictEqual(cap.chips.map((c) => c.label), ['10名以上', '20名以上', '30名以上', '35名以上', '50名以上']);
  assert.deepStrictEqual(e.dom.pressed(), ['cap:35']);
  press(e, 'cap', 35);
  assert.strictEqual(draftOf(e).cap, 0, '外せる');
});

// ── ⑩ 条件を外す ───────────────────────────────────────────────────────
test('⑩「条件を外す」: 下書きを空にする（NB_FILTER はそのまま・押された状態が全部消える）', () => {
  const e = env();
  const cur = F({ genre: '居酒屋', areas: ['sakae'], conds: ['koshitsu'], tags: ['デート'], cap: 10 });
  setFilter(e, cur);
  e.run('nbOpenFilterSheet()');
  assert.strictEqual(foot(e).reset, false, '条件があれば押せる');
  e.dom.click(e.dom.reset);
  assert.deepStrictEqual(draftOf(e), EMPTY);
  assert.deepStrictEqual(e.dom.pressed(), []);
  assert.deepStrictEqual(filterOf(e), cur, 'NB_FILTER は変わらない');
  assert.strictEqual(e.log.apply.length + e.log.events.length, 0);
  assert.strictEqual(foot(e).reset, true);
  assert.strictEqual(e.ctx.NB_SHEET.open, true, '閉じない');
});

// ── ⑪ 閉じたときの後始末 ───────────────────────────────────────────────
test('⑪閉じる: body のスクロールが元の値に戻る（開く前が空でも戻る）・焦点が開いたボタンへ戻る', () => {
  const e = env();
  const opener = new e.dom.El('op');
  e.run('nbOpenFilterSheet').call(null, opener);
  assert.strictEqual(e.dom.pageBody.style.overflow, 'hidden');
  e.run('nbCloseFilterSheet()');
  assert.strictEqual(e.dom.pageBody.style.overflow, '', 'もともと無かった値は空に戻る（hidden のまま残らない）');
  assert.strictEqual(e.dom.doc.activeElement, opener);
  assert.strictEqual(e.ctx.NB_SHEET.opener, null);
});

test('⑪閉じる: 開いたボタンがもう画面に無いとき・渡されていないときは、焦点を動かさず例外も出さない。反映して閉じるときも焦点は戻る', () => {
  const e = env();
  const opener = new e.dom.El('op');
  e.run('nbOpenFilterSheet').call(null, opener);
  opener.attached = false;
  e.dom.doc.activeElement = null;
  e.run('nbCloseFilterSheet()');
  assert.strictEqual(e.dom.doc.activeElement, null, '画面に無い要素には焦点を渡さない');
  const e2 = env();
  const op2 = new e2.dom.El('op2');
  e2.run('nbOpenFilterSheet').call(null, op2);
  press(e2, 'area', 'sakae');
  e2.dom.click(e2.dom.go);
  assert.strictEqual(e2.dom.doc.activeElement, op2, '「N軒を見る」で閉じても焦点は開いたボタンへ');
});

test('⑪焦点: Tab で一周する（最後の次は最初・最初で Shift+Tab は最後）。押せないボタンは数えない', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  // 「条件を選んでください」で go は押せない → 最後は reset も押せないので、最後の押せるボタンは折りたたみのボタンの手前までの並びの最後
  const vis = e.dom.sheet.querySelectorAll('button:not([disabled])');
  assert.ok(vis.length > 5);
  assert.ok(!vis.includes(e.dom.go) && !vis.includes(e.dom.reset), '押せないボタンは焦点の対象外');
  const first = vis[0];
  const last = vis[vis.length - 1];
  e.dom.doc.activeElement = last;
  let ev = e.dom.key('Tab');
  assert.ok(ev.defaultPrevented, '最後の次は最初へ');
  assert.strictEqual(e.dom.doc.activeElement, first);
  e.dom.doc.activeElement = first;
  ev = e.dom.key('Tab', { shiftKey: true });
  assert.ok(ev.defaultPrevented);
  assert.strictEqual(e.dom.doc.activeElement, last, '最初で Shift+Tab は最後へ');
  e.dom.doc.activeElement = vis[2];
  ev = e.dom.key('Tab');
  assert.strictEqual(ev.defaultPrevented, false, '途中は何もしない（ブラウザの動きに任せる）');
  e.dom.doc.activeElement = e.dom.sheet;
  ev = e.dom.key('Tab', { shiftKey: true });
  assert.ok(ev.defaultPrevented && e.dom.doc.activeElement === last, 'シート自身から Shift+Tab は最後へ');
  // Tab 以外のキーは奪わない（最後のボタンで Enter を押しても焦点は動かない）
  e.dom.doc.activeElement = last;
  ev = e.dom.key('Enter');
  assert.strictEqual(ev.defaultPrevented, false);
  assert.strictEqual(e.dom.doc.activeElement, last);
});

// ── ⑫ 日本語の見出し ───────────────────────────────────────────────────
test('⑫見出し: エリア・ジャンル・予算・シーン・こだわり・人数 の順。すべて日本語。そのほかの条件は古いリンクの条件があるときだけ', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  assert.deepStrictEqual(e.dom.body.sections.map((s) => s.title), ['エリア', 'ジャンル', '予算', 'シーン', 'こだわり', '人数']);
  e.dom.body.sections.forEach((s) => assert.ok(JA.test(s.title), `見出しが日本語: ${s.title}`));
  assert.strictEqual(e.dom.section('area').hint, '複数選べます');
  assert.strictEqual(e.dom.section('cap').hint, '宴会で入れる人数');
  // 見出しも含めて、画面に出る文字はすべて日本語を含む（英語・スラッグだけのボタンは無い）
  e.dom.body.allChips().forEach((c) => assert.ok(JA.test(c.label), `ボタンの文言が日本語: ${c.label}`));
  e.dom.body.allChips().forEach((c) => assert.ok(c.label !== c.getAttribute('data-v') || JA.test(c.label), 'スラッグをそのまま出さない'));
  assert.ok(INDEX.includes('<h2 class="fs-title" id="fs-title">絞り込み</h2>'));
});

test('⑫見出し: エリアは 10 群（ハブと同じ表の名前）・ジャンルは載っている店のものだけ（代表ジャンルの並び）・シーンは 13 個・こだわりは 16 個', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  assert.deepStrictEqual(e.dom.section('area').chips.map((c) => c.getAttribute('data-v')), POLICY.areas.map((a) => a.slug));
  assert.deepStrictEqual(e.dom.section('area').chips.map((c) => c.label), e.ctx.NB_FILTER_POLICY.areas.map((a) => a.label));
  assert.deepStrictEqual(e.dom.section('genre').chips.map((c) => c.label),
    ['居酒屋', '焼肉・ホルモン', '和食', '寿司', 'ラーメン', '中華', 'イタリアン・フレンチ', '洋食', 'カフェ・スイーツ']);
  assert.strictEqual(e.dom.section('scene').chips.length, 13);
  const pick = e.dom.section('pick').chips;
  assert.strictEqual(pick.length, 16);
  assert.deepStrictEqual(pick.slice(0, 3).map((c) => c.label), ['個室あり', '飲み放題あり', '食べ放題あり']);
  assert.deepStrictEqual(pick.slice(10).map((c) => [c.getAttribute('data-k'), c.label]), [['tag', '半個室'], ['tag', 'カウンター'], ['tag', 'テラス席'], ['tag', '座敷'], ['tag', '貸切可'], ['tag', '隠れ家']]);
});

test('⑫見出し: 古いリンクの条件（シートにボタンの無いタグ・条件）は「そのほかの条件」に押された状態で出て、外せる。ボタンのあるものは重複しない', () => {
  const e = env();
  setFilter(e, { tags: ['個室', '1001〜2000円', 'デート'], conds: ['group-30', 'koshitsu'] });
  e.run('nbOpenFilterSheet()');
  const other = e.dom.section('other');
  assert.strictEqual(other.title, 'そのほかの条件');
  assert.deepStrictEqual(other.chips.map((c) => [c.getAttribute('data-k'), c.getAttribute('data-v'), c.label]),
    [['tag', '個室', '個室'], ['tag', '1001〜2000円', '1001〜2000円'], ['cond', 'group-30', '30名以上の宴会可']]);
  other.chips.forEach((c) => assert.strictEqual(c.getAttribute('aria-pressed'), 'true'));
  assert.deepStrictEqual(e.dom.pressed().sort(), ['cond:group-30', 'cond:koshitsu', 'tag:1001〜2000円', 'tag:デート', 'tag:個室'].sort());
  press(e, 'tag', '個室');
  assert.deepStrictEqual(draftOf(e).tags, ['デート', '1001〜2000円'], '外せる');
  assert.strictEqual(other.chips[0].getAttribute('aria-pressed'), 'false');
  assert.strictEqual(e.dom.body.allChips().filter((c) => c.getAttribute('data-k') === 'tag' && c.getAttribute('data-v') === 'デート').length, 1, 'ボタンのあるタグは「そのほか」に重複して出ない');
});

// ── 折りたたみ ─────────────────────────────────────────────────────────
test('折りたたみ: ジャンル 8・シーン 7・こだわり 8 を超える分は隠れる側（fs-extra）。多くなければ「もっと見る」は出ない。押された条件が隠れる側にあれば最初から開く', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  const g = e.dom.section('genre');
  assert.deepStrictEqual(g.chips.map((c) => c.cls.has('fs-extra')), [false, false, false, false, false, false, false, false, true]);
  assert.strictEqual(g.row.getAttribute('data-fold'), '8');
  assert.strictEqual(g.fold.style.display, '', '9 個あるので「もっと見る」が出る');
  assert.strictEqual(g.fold.getAttribute('aria-expanded'), 'false');
  assert.ok(g.row.classList.contains('is-folded'));
  assert.strictEqual(e.dom.section('scene').chips.filter((c) => c.cls.has('fs-extra')).length, 6);
  assert.strictEqual(e.dom.section('pick').chips.filter((c) => c.cls.has('fs-extra')).length, 8);
  assert.ok(e.dom.section('area').fold === null && e.dom.section('budget').fold === null && e.dom.section('cap').fold === null, '折りたたまない区画');
  // 開く
  e.run('nbCloseFilterSheet()');
  setFilter(e, { genre: 'カフェ・スイーツ', tags: ['壮行会'], conds: ['parking'] });
  e.run('nbOpenFilterSheet()');
  ['genre', 'scene', 'pick'].forEach((id) => {
    const s = e.dom.section(id);
    assert.strictEqual(s.fold.getAttribute('aria-expanded'), 'true', id + ': 隠れる側に押された条件があれば最初から開く');
    assert.ok(!s.row.classList.contains('is-folded'), id);
  });
  // 隠れる側が押されていなければ閉じたまま
  e.run('nbCloseFilterSheet()');
  setFilter(e, { genre: '居酒屋', tags: ['デート'], conds: ['koshitsu'] });
  e.run('nbOpenFilterSheet()');
  ['genre', 'scene', 'pick'].forEach((id) => assert.strictEqual(e.dom.section(id).fold.getAttribute('aria-expanded'), 'false', id + ': 閉じたまま'));
});

test('折りたたみ: いま選んでいるジャンルは、載っている店が無くても出す（外せるように）', () => {
  const e = env();
  e.run('ALL_STORES = ALL_STORES.slice(0, 3)');
  setFilter(e, { genre: '寿司' });
  e.run('nbOpenFilterSheet()');
  assert.deepStrictEqual(e.dom.section('genre').chips.map((c) => c.label), ['居酒屋', '寿司']);
  assert.deepStrictEqual(e.dom.pressed(), ['genre:寿司']);
});

// ── 逃がし方 ───────────────────────────────────────────────────────────
test('HTML の逃がし: 古いリンクの値に記号があっても、ボタンの属性と文言は逃がしてから入る', () => {
  const e = env();
  e.run('nbOpenFilterSheet()');
  const html = e.run('nbSheetChip("tag", \'a"><b>&\', \'x<y>"\')');
  assert.strictEqual(html, '<button type="button" class="fs-chip" data-k="tag" data-v="a&quot;&gt;&lt;b&gt;&amp;" aria-pressed="false">x&lt;y&gt;&quot;</button>');
  assert.ok(/class="fs-chip fs-extra"/.test(e.run('nbSheetChip("tag", "a", "b", true)')));
});

// ── P-441: シートの外（背景）を inert にする ───────────────────────────
test('背景 inert: 開いている間はシートの外の兄弟に inert を付け（#toast・script・もとから inert は除く）、閉じる・反映・Esc のどれでも外れる。繰り返しても残らない', () => {
  const e = env();
  const page = e.dom.pageBody;
  const mkKid = (id, tag) => { const k = new e.dom.El(id); k.tagName = tag; k.parentNode = page; return k; };
  const main = mkKid('main', 'MAIN'), toast = mkKid('toast', 'DIV'), scr = mkKid('', 'SCRIPT'), pre = mkKid('pre', 'DIV');
  pre.setAttribute('inert', '');
  e.dom.wrap.tagName = 'DIV'; e.dom.wrap.parentNode = page;
  page.children = [main, toast, scr, e.dom.wrap, pre];
  page.parentNode = null;
  const flagged = () => page.children.filter((k) => k.hasAttribute('inert')).map((k) => k.id || k.tagName);
  const open = () => e.run('nbOpenFilterSheet').call(null, new e.dom.El('op'));
  const closers = [
    () => e.dom.click(e.dom.close),
    () => e.dom.click(e.dom.backdrop),
    () => e.dom.key('Escape'),
    () => { press(e, 'area', 'sakae'); e.dom.click(e.dom.go); },
  ];
  for (let round = 0; round < 2; round++) closers.forEach((close, i) => {
    open();
    assert.deepStrictEqual(flagged().sort(), ['main', 'pre'].sort(), '開いている間: 背景だけ止まる（' + i + '）');
    assert.ok(!e.dom.wrap.hasAttribute('inert'), 'シート自身は止めない');
    open(); // 二重に開いても付け直さない
    assert.strictEqual(e.ctx.NB_SHEET.inert.length, 1);
    close();
    assert.strictEqual(e.ctx.NB_SHEET.open, false);
    assert.deepStrictEqual(flagged(), ['pre'], '閉じたら自分が付けた分だけ外れる。もとからのものは残す（' + i + '）');
    assert.strictEqual(e.ctx.NB_SHEET.inert.length, 0);
    e.run('NB_FILTER = ' + JSON.stringify(EMPTY) + ';');
  });
});

// ── P-428: 「戻る」でシートを閉じる ──────────────────────────────────────
const sheetEntries = (e) => e.history.stack.filter((x) => x.state && x.state.nbS).length;

test('⑨戻る: 開くと履歴を1つ足し（URL は同じ）、戻ると下書きを捨てて閉じる（足した履歴は残らず、戻る処理は二重に走らない）', () => {
  const e = env({ manualPop: true });
  const cur = F({ areas: ['sakae'] });
  setFilter(e, cur);
  e.run('nbOpenFilterSheet')(null);
  assert.strictEqual(e.history.stack.length, 2);
  assert.strictEqual(e.history.stack[1].url, e.history.stack[0].url, 'URL（ハッシュ）は変えない');
  press(e, 'genre', '居酒屋');
  e.history.back(); e.firePop();   // ブラウザの「戻る」
  assert.strictEqual(e.ctx.NB_SHEET.open, false);
  assert.strictEqual(e.ctx.NB_SHEET.draft, null);
  assert.strictEqual(e.ctx.NB_SHEET.leaving, false);
  assert.deepStrictEqual(filterOf(e), cur, '変更は反映しない');
  assert.strictEqual(e.history.i, 0, 'ページから離れず、開く前の履歴に戻る');
  assert.strictEqual(e.log.apply.length + e.log.events.length, 0);
  assert.ok(!e.dom.wrap.classList.contains('open'));
});

test('⑨×・背景・Esc: 足した履歴を1つ戻して消し（履歴が増えない）、戻り終えたらいまの条件のハッシュを書き直す', () => {
  ['×', '背景', 'Esc'].forEach((name) => {
    const e = env({ manualPop: true });
    e.run('nbOpenFilterSheet')(null);
    if (name === '×') e.dom.click(e.dom.close); else if (name === '背景') e.dom.click(e.dom.backdrop); else e.dom.key('Escape');
    assert.strictEqual(e.ctx.NB_SHEET.open, false, name);
    assert.strictEqual(e.ctx.NB_SHEET.leaving, true, name + ': 戻り待ち');
    assert.strictEqual(e.history.i, 0, name + ': 1つ戻した');
    e.firePop();
    assert.strictEqual(e.ctx.NB_SHEET.leaving, false, name);
    assert.strictEqual(e.log.hash.length, 1, name + ': ハッシュを書き直す（1回）');
  });
});

test('⑨「N軒を見る」: 条件を反映して閉じ、履歴を1つ戻したあとにその条件のハッシュが残る（戻るで再びシートは開かない・履歴は増えない）', () => {
  const e = env({ manualPop: true });
  e.run('nbOpenFilterSheet')(null);
  press(e, 'genre', '居酒屋');
  e.dom.click(e.dom.go);
  assert.deepStrictEqual(filterOf(e), F({ genre: '居酒屋' }));
  assert.strictEqual(e.log.apply.length, 1);
  assert.strictEqual(e.ctx.NB_SHEET.leaving, true);
  e.firePop();
  assert.strictEqual(e.history.i, 0);
  assert.strictEqual(e.history.stack[0].url, 'H:' + JSON.stringify(F({ genre: '居酒屋' })), '絞り込みのハッシュが残る');
  assert.strictEqual(sheetEntries(e) <= 1, true);
  assert.strictEqual(e.ctx.NB_SHEET.open, false, '戻り終えてもシートは開かない');
  // 戻る処理は1回きり: 続けて popstate が来ても書き直しは増えない
  e.firePop();
  assert.strictEqual(e.log.hash.length, 1);
});

test('⑨戻り待ちの間は開き直さない（履歴が重ならない）・閉じ済みのシートに popstate が来ても何もしない', () => {
  const e = env({ manualPop: true });
  e.run('nbOpenFilterSheet')(null);
  e.dom.click(e.dom.close);
  e.run('nbOpenFilterSheet')(null);
  assert.strictEqual(e.ctx.NB_SHEET.open, false);
  assert.strictEqual(e.history.stack.length, 2);
  e.firePop();
  e.firePop();
  assert.strictEqual(e.ctx.NB_SHEET.open, false);
  assert.strictEqual(e.log.hash.length, 1);
});

test('⑨履歴を触れない環境（history が無い・例外）でも、開く・閉じるは動く', () => {
  const e = env({ manualPop: true });
  e.ctx.history = { get state() { throw new Error('x'); }, pushState() { throw new Error('x'); }, back() { throw new Error('x'); }, replaceState() {} };
  e.run('nbOpenFilterSheet')(null);
  assert.strictEqual(e.ctx.NB_SHEET.open, true);
  e.dom.click(e.dom.close);
  assert.strictEqual(e.ctx.NB_SHEET.open, false);
  assert.strictEqual(e.ctx.NB_SHEET.leaving, false);
});
