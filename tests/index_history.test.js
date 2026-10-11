'use strict';
/**
 * tests/index_history.test.js — I-21（UI・UX改修 段階1a）
 *
 * トップ（index.html）の URL と「戻る」の決まりを確かめる。
 *   1. `#store=` が全店で開く（最初に載っている50店に無い店は、全店のデータを読み終えてから開く）
 *   2. 店のモーダルは履歴を1つ足し、×・背景・Esc・下スワイプ・「戻る」のどれで閉じても1回で閉じる
 *   3. 壊れたハッシュ（不正な %・" など）で、条件の復元と初期化が止まらない
 *
 * index.html の `NB-HISTORY` の区画と、実物の closeM を取り出し、偽の履歴・偽の DOM の上で動かす。
 * openM は長すぎて取り出せないので、約束事（開いたら nbModalHistoryOpen を呼ぶ・popstate では数えない）を
 * 静的に確かめる。実ブラウザでの確認は docs/qa/uiux-2026-10/e2e_history.js。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ── index.html から取り出す ─────────────────────────────────────────────
function extractBlock(src) {
  const a = src.indexOf('// NB-HISTORY:START');
  const b = src.indexOf('// NB-HISTORY:END');
  assert.ok(a >= 0 && b > a, 'NB-HISTORY の区画が見つからない');
  assert.strictEqual(src.split('// NB-HISTORY:START').length - 1, 1, '開始の印は1つだけ');
  assert.strictEqual(src.split('// NB-HISTORY:END').length - 1, 1, '終了の印は1つだけ');
  return src.slice(a, b);
}
function extractCloseM(src) {
  const a = src.indexOf('function closeM(opts) {');
  assert.ok(a >= 0, 'closeM(opts) が見つからない');
  const endMarker = "document.getElementById('ov').addEventListener('click', function(e){ if(e.target===this) closeM(); });";
  const b = src.indexOf(endMarker, a);
  assert.ok(b > a, 'closeM の終わりが見つからない');
  return src.slice(a, b);
}
function extractFunction(block, name, nextMarker) {
  const a = block.indexOf('function ' + name + '(');
  assert.ok(a >= 0, name + ' が見つからない');
  const b = block.indexOf(nextMarker, a);
  assert.ok(b > a, name + ' の終わりが見つからない');
  return block.slice(a, b);
}

const BLOCK = extractBlock(INDEX);
const CLOSE_M = extractCloseM(INDEX);

// openM の約束事だけを再現した偽物（実物の約束事は下の「静的に確かめる」で見る）
const FAKE_OPEN_M = [
  'function openM(i, source) {',
  '  var r = ALL_STORES[i];',
  "  opened.push({ id: r['ホットペッパーID'], source: source });",
  "  document.getElementById('ov').classList.add('open');",
  "  nbModalHistoryOpen(r['ホットペッパーID'] || '', source);",
  '}',
].join('\n');

// ── 偽のブラウザ（履歴・location・window） ─────────────────────────────
function makeBrowser(opts) {
  opts = opts || {};
  const listeners = {};
  const entries = (opts.entries || [{ hash: '', state: null }]).map((e) => ({ hash: e.hash, state: e.state }));
  let idx = opts.index || 0;
  const queue = [];
  const calls = { back: 0, push: 0, replace: 0 };
  const hashOf = (url) => { const i = String(url).indexOf('#'); return i >= 0 ? String(url).slice(i) : ''; };
  const win = {
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    dispatch(type) { (listeners[type] || []).forEach((fn) => fn()); },
  };
  const go = (d) => {
    const n = idx + d;
    if (n < 0 || n >= entries.length) return;
    idx = n;
    win.dispatch('popstate');
  };
  const history = {
    get state() { return entries[idx].state; },
    get length() { return entries.length; },
    pushState(state, _t, url) { calls.push++; entries.splice(idx + 1); entries.push({ hash: hashOf(url), state }); idx = entries.length - 1; },
    replaceState(state, _t, url) { calls.replace++; entries[idx] = { hash: hashOf(url), state }; },
    // 本物の back() は非同期。deferBack で再現する
    back() { calls.back++; if (opts.deferBack) queue.push(-1); else go(-1); },
    forward() { if (opts.deferBack) queue.push(1); else go(1); },
  };
  // URL が /# のとき location.hash は ''（本物と同じ）
  const location = { get hash() { const h = entries[idx].hash; return h === '#' ? '' : h; }, pathname: '/' };
  return {
    win, history, location, entries, calls, go,
    flush() { while (queue.length) go(queue.shift()); },
    get index() { return idx; },
    get hash() { return location.hash; },
  };
}

// ── 偽の DOM ───────────────────────────────────────────────────────────
function makeEl(attrs) {
  const cls = new Set();
  attrs = attrs || {};
  const dataset = {};
  Object.keys(attrs).forEach((k) => { if (k.indexOf('data-') === 0) dataset[k.slice(5)] = attrs[k]; });
  return {
    style: {}, dataset, innerHTML: '', textContent: '', value: '', parentNode: null,
    classList: {
      add: (c) => { cls.add(c); },
      remove: (c) => { cls.delete(c); },
      contains: (c) => cls.has(c),
    },
    getAttribute: (n) => (Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : null),
  };
}

function makeEnv(browserOpts) {
  const br = makeBrowser(browserOpts);
  const registry = {};
  const lists = { '.pt': [], '.ft': [], '.at': [], '.tg': [] };
  const document = {
    body: { style: {} },
    getElementById(id) { return registry[id] || (registry[id] = makeEl()); },
    querySelector(sel) {
      const m = /^(\.\w+)\.on$/.exec(sel);
      if (m) return (lists[m[1]] || []).find((e) => e.classList.contains('on')) || null;
      return null;
    },
    querySelectorAll(sel) { return (lists[sel] || []).slice(); },
  };
  const timers = [];
  const errors = [];
  const opened = [];
  const ctx = vm.createContext({
    window: br.win, history: br.history, location: br.location, document,
    console: { error: (...a) => { errors.push(a); }, log() {}, warn() {} },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    ALL_STORES: [], ACTIVE_WARD: 'all', ACTIVE_TAGS: [], FULL_CATALOG_LOADED: false,
    M_STICKY_OBS: null,
    normalizeGenre: (g) => g,
    opened,
  });
  vm.runInContext(BLOCK, ctx);
  vm.runInContext(CLOSE_M, ctx);
  vm.runInContext(FAKE_OPEN_M, ctx);
  const env = {
    br, ctx, document, lists, registry, errors, opened,
    run: (code) => vm.runInContext(code, ctx),
    // 保留中の setTimeout を全部実行する
    fire() { while (timers.length) timers.shift()(); },
    // n 軒の店。ID は J001, J002, …（hpids を渡すと、その ID の店を並べる）
    setStores(n, hpids) {
      const list = [];
      for (let i = 0; i < n; i++) list.push({ '店名': 'テスト店' + (i + 1), 'ホットペッパーID': hpids ? hpids[i] : 'J' + String(i + 1).padStart(3, '0') });
      ctx.ALL_STORES = list;
    },
    chips(sel, attr, values) {
      lists[sel] = values.map((v) => makeEl({ [attr]: v }));
      return lists[sel];
    },
    isOpen: () => registry.ov ? registry.ov.classList.contains('open') : false,
    json: (x) => JSON.parse(JSON.stringify(x)),
  };
  return env;
}

// ── 1. 壊れたハッシュを読む部品 ────────────────────────────────────────
test('nbSafeDecode: 壊れた % でも例外にせず、読めない値はそのまま返す', () => {
  const env = makeEnv();
  assert.strictEqual(env.run("nbSafeDecode('%E7%84%BC%E8%82%89')"), '焼肉');
  assert.strictEqual(env.run("nbSafeDecode('%E0%A4%A')"), '%E0%A4%A');
  assert.strictEqual(env.run("nbSafeDecode('%')"), '%');
  assert.strictEqual(env.run("nbSafeDecode('100%')"), '100%');
  assert.strictEqual(env.run("nbSafeDecode('')"), '');
});

test('nbParseHash: 名前=値 だけを読み、壊れた値と知らない形で止まらない', () => {
  const env = makeEnv();
  const p = env.json(env.run("nbParseHash('#pref=%E6%84%9B%E7%9F%A5%E7%9C%8C&q=%E7%84%BC%E8%82%89&store=J001&review=1')"));
  assert.deepStrictEqual(p, { pref: '愛知県', q: '焼肉', store: 'J001', review: '1' });
  // 名前だけ・空の名前・値が壊れている・= を含む値
  const q = env.json(env.run("nbParseHash('#q=%E0%A4%A&novalue&=x&a=b=c&')"));
  assert.deepStrictEqual(q, { q: '%E0%A4%A', a: 'b=c' });
  assert.deepStrictEqual(env.json(env.run("nbParseHash('')")), {});
  assert.deepStrictEqual(env.json(env.run("nbParseHash('#')")), {});
  assert.deepStrictEqual(env.json(env.run('nbParseHash(undefined)')), {});
});

test('nbParseHash: __proto__ を名前にしても、オブジェクトの土台を汚さない', () => {
  const env = makeEnv();
  assert.strictEqual(env.run("var r = nbParseHash('#__proto__=x&constructor=y'); Object.keys(r).join(',')"), 'constructor');
  assert.strictEqual(env.run("({}).x === undefined && r.x === undefined"), true);
});

test('nbFindByData: " や ] を含む値でも、セレクタを組み立てないので例外にならない', () => {
  const env = makeEnv();
  env.chips('.pt', 'data-pref', ['全国', '愛知県', 'a"b', 'x]y']);
  assert.strictEqual(env.run("nbFindByData('.pt', 'data-pref', 'a\"b').getAttribute('data-pref')"), 'a"b');
  assert.strictEqual(env.run("nbFindByData('.pt', 'data-pref', 'x]y').getAttribute('data-pref')"), 'x]y');
  assert.strictEqual(env.run("nbFindByData('.pt', 'data-pref', '愛知県').getAttribute('data-pref')"), '愛知県');
  assert.strictEqual(env.run("nbFindByData('.pt', 'data-pref', 'ない')"), null);
  assert.strictEqual(env.run("nbFindByData('.zz', 'data-pref', 'x')"), null);
});

// ── 2. 絞り込みの状態 ⇄ ハッシュ ──────────────────────────────────────
function setupFilters(env) {
  env.chips('.pt', 'data-pref', ['全国', '愛知県', '岐阜県']);
  env.chips('.ft', 'data-f', ['All', '焼肉', '居酒屋']);
  env.chips('.at', 'data-ward', ['all', '中区', '千種区']);
  env.chips('.tg', 'data-tag', ['個室', '禁煙']);
  env.registry['cap-input'] = makeEl();
  env.registry.si = makeEl();
}

test('readHash: 条件を復元する（pref・genre・ward・tag・cap・q）', () => {
  const env = makeEnv({ entries: [{ hash: '#pref=%E6%84%9B%E7%9F%A5%E7%9C%8C&genre=%E7%84%BC%E8%82%89&ward=%E4%B8%AD%E5%8C%BA&tag=%E5%80%8B%E5%AE%A4,%E7%A6%81%E7%85%99&cap=20&q=%E3%81%A8%E3%82%93', state: null }] });
  setupFilters(env);
  env.run('readHash()');
  assert.strictEqual(env.lists['.pt'][1].classList.contains('on'), true);
  assert.strictEqual(env.lists['.ft'][1].classList.contains('on'), true);
  assert.strictEqual(env.lists['.at'][1].classList.contains('on'), true);
  assert.strictEqual(env.ctx.ACTIVE_WARD, '中区');
  assert.deepStrictEqual(env.json(env.ctx.ACTIVE_TAGS), ['個室', '禁煙']);
  assert.strictEqual(env.registry['cap-input'].value, '20');
  assert.strictEqual(env.registry.si.value, 'とん');
  assert.deepStrictEqual(env.errors, []);
});

for (const bad of [
  '#q=%E0%A4%A',
  '#pref=a%22b',
  '#genre=%',
  '#genre=%22%5D',
  '#ward=%22',
  '#tag=%25,%E0%A4%A',
  '#cap=%',
  '#store=%',
  '#=&&=&',
  '#%',
  '#pref=%22%5D%7Bx',
]) {
  test('readHash: 壊れたハッシュ ' + bad + ' で例外にならず、初期化の続きを止めない', () => {
    const env = makeEnv({ entries: [{ hash: bad, state: null }] });
    setupFilters(env);
    assert.doesNotThrow(() => env.run('readHash()'));
    assert.deepStrictEqual(env.errors, [], 'console.error が出ていない');
  });
}

test('readHash: 壊れた値と正しい値が混ざっていても、正しい値は復元する', () => {
  const env = makeEnv({ entries: [{ hash: '#pref=a%22b&genre=%E7%84%BC%E8%82%89&q=%E0%A4%A', state: null }] });
  setupFilters(env);
  env.run('readHash()');
  assert.strictEqual(env.lists['.ft'][1].classList.contains('on'), true, '壊れた pref の後ろの genre も読む');
  assert.strictEqual(env.registry.si.value, '%E0%A4%A', '壊れた q は読めた分をそのまま入れる');
});

test('nbBuildHash: 今までと同じ並びと書き方（pref・genre・ward・tag・cap・q）。store は末尾', () => {
  const env = makeEnv();
  setupFilters(env);
  assert.strictEqual(env.run('nbBuildHash()'), '#');
  assert.strictEqual(env.run("nbBuildHash('J001')"), '#store=J001');
  env.lists['.pt'][1].classList.add('on');
  env.lists['.ft'][1].classList.add('on');
  env.ctx.ACTIVE_WARD = '中区';
  env.ctx.ACTIVE_TAGS = ['個室', '禁煙'];
  env.registry['cap-input'].value = ' 20 ';
  env.registry.si.value = ' とんかつ ';
  const base = '#pref=' + encodeURIComponent('愛知県') + '&genre=' + encodeURIComponent('焼肉') + '&ward=' + encodeURIComponent('中区')
    + '&tag=' + encodeURIComponent('個室') + ',' + encodeURIComponent('禁煙') + '&cap=20&q=' + encodeURIComponent('とんかつ');
  assert.strictEqual(env.run('nbBuildHash()'), base);
  assert.strictEqual(env.run("nbBuildHash('J001')"), base + '&store=J001');
  assert.strictEqual(env.run("nbBuildHash('a&b=c')"), base + '&store=' + encodeURIComponent('a&b=c'));
});

// ── 3. #store= が全店で開く ───────────────────────────────────────────
test('#store= : 最初の50店に無い店は、全店のデータを読み終えてから開く（URL の store= は消えない）', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J777', state: null }] });
  setupFilters(env);
  // 最初の50店（J777 は無い）
  env.setStores(50);
  env.run('readHash()');
  env.run('pushHash()'); // loadStores の applyFilters が呼ぶ
  env.fire();
  assert.strictEqual(env.isOpen(), false, 'まだ開かない');
  assert.strictEqual(env.ctx.NB_PENDING_STORE, 'J777', '待っている');
  assert.strictEqual(env.br.hash, '#store=J777', '待っている間も URL の store= は消えない');
  // 全店のデータが届く（J777 を含む）
  const ids = []; for (let i = 1; i <= 50; i++) ids.push('J' + String(i).padStart(3, '0')); ids.push('J777');
  env.setStores(ids.length, ids);
  env.ctx.FULL_CATALOG_LOADED = true;
  env.run('readHash()');
  env.run('pushHash()');
  env.fire();
  assert.strictEqual(env.isOpen(), true, '開く');
  assert.deepStrictEqual(env.json(env.opened), [{ id: 'J777', source: 'deeplink' }]);
  assert.strictEqual(env.ctx.NB_PENDING_STORE, '');
  assert.strictEqual(env.ctx.NB_OPEN_STORE_ID, 'J777');
  assert.strictEqual(env.br.hash, '#store=J777', '開いている間も URL に store= が残る');
  assert.strictEqual(env.br.history.length, 1, '共有リンクで開いたときは履歴を足さない');
  assert.strictEqual(env.br.calls.push, 0);
});

test('#store= : 最初の50店の中の店は、そのまま開く', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J005', state: null }] });
  setupFilters(env);
  env.setStores(50);
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.isOpen(), true);
  assert.deepStrictEqual(env.json(env.opened), [{ id: 'J005', source: 'deeplink' }]);
});

test('#store= : 全店を読み終えても無い ID は、開かずに URL から外す（index・古い ID など）', () => {
  const env = makeEnv({ entries: [{ hash: '#genre=%E7%84%BC%E8%82%89&store=index&review=1', state: null }] });
  setupFilters(env);
  env.setStores(60);
  env.ctx.FULL_CATALOG_LOADED = true;
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.isOpen(), false);
  assert.strictEqual(env.ctx.NB_PENDING_STORE, '');
  assert.ok(env.br.hash.indexOf('store=') < 0, 'store= を外す: ' + env.br.hash);
  assert.strictEqual(env.errors.length, 0);
});

test('#store= : すでに開いている店は、読み直しても開き直さない（modal_open を二重に出さない）', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J002', state: null }] });
  setupFilters(env);
  env.setStores(10);
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.opened.length, 1);
  env.run('readHash()'); // 全店のデータが届いて、もう一度読まれた
  env.fire();
  assert.strictEqual(env.opened.length, 1, '開き直さない');
});

// ── 4. モーダルと履歴 ─────────────────────────────────────────────────
test('一覧から開く: 履歴が1つ増え、URL に store=ID が載る。閉じる（×・背景・Esc・下スワイプ）と1回で戻る', () => {
  const env = makeEnv();
  setupFilters(env);
  env.setStores(60);
  env.lists['.ft'][1].classList.add('on');
  env.run('pushHash()'); // 条件を選んだ（applyFilters が pushHash を呼ぶ）
  env.run("openM(3, 'grid')");
  assert.strictEqual(env.isOpen(), true);
  assert.strictEqual(env.br.history.length, 2);
  assert.deepStrictEqual(env.json(env.br.history.state), { nbM: 1 });
  assert.strictEqual(env.br.hash, '#genre=' + encodeURIComponent('焼肉') + '&store=J004');
  env.run('closeM()'); // ×・背景・Esc・下スワイプは、どれもこの呼び出し
  assert.strictEqual(env.isOpen(), false);
  assert.strictEqual(env.br.index, 0, '足した履歴が1つ戻って、開く前の位置にいる');
  assert.strictEqual(env.br.hash, '#genre=' + encodeURIComponent('焼肉'));
  assert.strictEqual(env.ctx.NB_OPEN_STORE_ID, '');
  assert.strictEqual(env.br.calls.back, 1);
});

test('一覧から開く → ブラウザの「戻る」: モーダルが閉じ、ページはそのまま（余計な back をしない）', () => {
  const env = makeEnv();
  setupFilters(env);
  env.setStores(60);
  env.run("openM(0, 'grid')");
  env.br.history.back(); // 利用者の「戻る」
  assert.strictEqual(env.isOpen(), false);
  assert.strictEqual(env.br.index, 0);
  assert.strictEqual(env.br.calls.back, 1, 'closeM が重ねて back しない');
  assert.strictEqual(env.ctx.NB_OPEN_STORE_ID, '');
  assert.strictEqual(env.br.hash, '');
});

test('「戻る」のあとの「進む」: 同じ店を開き直す（履歴は足さず、modal_open の source は popstate）', () => {
  const env = makeEnv();
  setupFilters(env);
  env.setStores(60);
  env.run("openM(0, 'grid')");
  env.br.history.back();
  env.br.history.forward();
  assert.strictEqual(env.isOpen(), true);
  assert.strictEqual(env.br.hash, '#store=J001');
  assert.strictEqual(env.br.history.length, 2, '履歴は増えない');
  assert.strictEqual(env.opened[env.opened.length - 1].source, 'popstate');
  env.run('closeM()');
  assert.strictEqual(env.isOpen(), false);
  assert.strictEqual(env.br.index, 0);
});

test('共有リンクで開いた店を閉じる: back せず、URL から store= だけ外す（前のサイトへ戻らない）', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J002', state: null }] });
  setupFilters(env);
  env.setStores(10);
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.isOpen(), true);
  env.run('closeM()');
  assert.strictEqual(env.isOpen(), false);
  assert.strictEqual(env.br.calls.back, 0, '履歴を足していないので戻さない');
  assert.strictEqual(env.br.hash, '');
  assert.strictEqual(env.br.history.length, 1);
});

test('再読み込みで開き直した店（履歴の印あり）を閉じる: 足してあった履歴を1つ戻す', () => {
  const env = makeEnv({ entries: [{ hash: '', state: null }, { hash: '#store=J002', state: { nbM: 1 } }], index: 1 });
  setupFilters(env);
  env.setStores(10);
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.isOpen(), true);
  assert.strictEqual(env.br.calls.push, 0, '開き直しでは足さない');
  env.run('closeM()');
  assert.strictEqual(env.br.calls.back, 1);
  assert.strictEqual(env.br.index, 0);
  assert.strictEqual(env.isOpen(), false);
});

test('似たお店へ切り替える: 履歴を増やさず置き換える。閉じると1回で戻る', () => {
  const env = makeEnv();
  setupFilters(env);
  env.setStores(60);
  env.run("openM(0, 'grid')");
  assert.strictEqual(env.br.history.length, 2);
  // モーダルの「似たお店」ボタンの onclick と同じ呼び出し
  env.run("closeM({swap:true})");
  assert.strictEqual(env.br.calls.back, 0, '切り替えの間は履歴に触れない');
  env.run("openM(5, 'modal_reco')");
  assert.strictEqual(env.br.history.length, 2, '増えない');
  assert.strictEqual(env.br.hash, '#store=J006');
  assert.deepStrictEqual(env.json(env.br.history.state), { nbM: 1 });
  env.run('closeM()');
  assert.strictEqual(env.br.index, 0);
  assert.strictEqual(env.br.hash, '');
});

test('共有リンクで開いた店から似たお店へ切り替える: 履歴の印を付けず置き換える（閉じても前のサイトへ戻らない）', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J001', state: null }] });
  setupFilters(env);
  env.setStores(20);
  env.run('readHash()');
  env.fire();
  env.run('closeM({swap:true})');
  env.run("openM(7, 'modal_reco')");
  assert.strictEqual(env.br.history.length, 1);
  assert.strictEqual(env.br.history.state, null, '共有リンクの履歴に印を付けない');
  assert.strictEqual(env.br.hash, '#store=J008');
  env.run('closeM()');
  assert.strictEqual(env.br.calls.back, 0);
  assert.strictEqual(env.br.hash, '');
});

test('閉じたモーダルをもう一度閉じても（背景を続けて押すなど）、履歴を二重に戻さない', () => {
  const env = makeEnv({ entries: [{ hash: '', state: null }], deferBack: true });
  setupFilters(env);
  env.setStores(10);
  env.run("openM(0, 'grid')");
  env.run('closeM()');
  env.run('closeM()'); // back がまだ終わっていない間の2回目
  env.br.flush();
  assert.strictEqual(env.br.calls.back, 1);
  assert.strictEqual(env.br.index, 0, 'サイトの外へ出ない');
});

test('ID が無い店: URL は変えず履歴だけ足す。「戻る」で閉じる', () => {
  const env = makeEnv();
  setupFilters(env);
  env.setStores(3, ['', 'J002', 'J003']);
  env.run("openM(0, 'grid')");
  assert.strictEqual(env.br.history.length, 2);
  assert.strictEqual(env.br.hash, '', 'store= は載せない');
  assert.strictEqual(env.ctx.NB_OPEN_STORE_ID, '');
  env.br.history.back();
  assert.strictEqual(env.isOpen(), false);
  assert.strictEqual(env.br.index, 0);
});

test('pushHash: モーダルが開いている間に呼ばれても、履歴の印と store= を消さない', () => {
  const env = makeEnv();
  setupFilters(env);
  env.setStores(10);
  env.run("openM(1, 'grid')");
  env.run('pushHash()'); // 全店のデータが届いて applyFilters が呼ぶ
  assert.deepStrictEqual(env.json(env.br.history.state), { nbM: 1 });
  assert.strictEqual(env.br.hash, '#store=J002');
});

test('条件を変える（pushHash）: 履歴を足さず置き換える（今までどおり）', () => {
  const env = makeEnv();
  setupFilters(env);
  env.setStores(10);
  env.lists['.ft'][1].classList.add('on');
  env.run('pushHash()');
  env.lists['.ft'][2].classList.add('on');
  env.run('pushHash()');
  assert.strictEqual(env.br.history.length, 1);
  assert.strictEqual(env.br.calls.push, 0);
});

test('アドレス欄で #store= を書き換えた（popstate）: 別の店のモーダルへ切り替わる', () => {
  const env = makeEnv();
  setupFilters(env);
  env.setStores(10);
  env.ctx.FULL_CATALOG_LOADED = true;
  env.run("openM(0, 'grid')");
  // 利用者が #store=J005 に書き換えた（新しい履歴・印なし）
  env.br.entries.push({ hash: '#store=J005', state: null });
  env.br.go(1);
  assert.strictEqual(env.isOpen(), true);
  assert.strictEqual(env.ctx.NB_OPEN_STORE_ID, 'J005');
});

// ── 5. openM / closeM の約束事を静的に確かめる ─────────────────────────
test('静的: 区画は1つ。履歴の書き換えは区画の中だけ（GA の ?nb_owner を消す1行を除く）', () => {
  const outside = INDEX.replace(BLOCK, '');
  const pushes = outside.match(/history\.pushState\(/g) || [];
  assert.strictEqual(pushes.length, 0, '区画の外で pushState しない');
  const replaces = (outside.match(/history\.replaceState\(/g) || []).length;
  assert.strictEqual(replaces, 1, '区画の外の replaceState は GA の ?nb_owner を消す1行だけ');
  assert.ok(!/replaceState\(null/.test(BLOCK), '区画の中で state を null で上書きしない（印が消える）');
});

test('静的: readHash は decodeURIComponent も値入りのセレクタも使わない', () => {
  const src = extractFunction(BLOCK, 'readHash', '// 待っている店');
  assert.ok(!/decodeURIComponent\(/.test(src), 'nbSafeDecode / nbParseHash を通す');
  assert.ok(!/querySelector(All)?\([^)]*\+/.test(src), '値を連結したセレクタを使わない');
  assert.ok(!/\[data-/.test(src), '属性セレクタに値を埋め込まない');
});

test('静的: openM は開いた直後に nbModalHistoryOpen を呼び、source=popstate では modal_open を出さない', () => {
  const a = INDEX.indexOf('function openM(i, source) {');
  assert.ok(a >= 0);
  const b = INDEX.indexOf('function renderMhi', a) > 0 ? INDEX.indexOf('// モーダル ヒーロー写真カルーセル', a) : -1;
  assert.ok(b > a, 'openM の終わり');
  const src = INDEX.slice(a, b);
  assert.ok(/if \(source !== 'popstate'\) trackEvent\('modal_open'/.test(src), 'popstate では数えない');
  const iOpen = src.indexOf("document.getElementById('ov').classList.add('open');");
  const iHook = src.indexOf("nbModalHistoryOpen(r['ホットペッパーID'] || '', source);");
  const iLock = src.indexOf("document.body.style.overflow = 'hidden';");
  assert.ok(iOpen >= 0 && iHook > iOpen && iLock > iHook, '開く → 履歴 → スクロール固定 の順');
  assert.ok(src.indexOf("closeM({swap:true});setTimeout(function(){openM('+rs3.i+',\\'modal_reco\\');},50)") > 0, '似たお店は swap で切り替える');
});

test('静的: closeM は開いていたときだけ履歴を戻し、fromPop / swap では触れない', () => {
  assert.ok(/var wasOpen = ovEl\.classList\.contains\('open'\);/.test(CLOSE_M));
  assert.ok(/if \(wasOpen && !\(opts && \(opts\.fromPop \|\| opts\.swap\)\)\) nbModalHistoryClose\(\);/.test(CLOSE_M));
  assert.ok(/if \(opts && opts\.swap\) NB_SWAP = Date\.now\(\);/.test(CLOSE_M));
});

test('静的: ×・背景・Esc・下スワイプはすべて closeM() を呼ぶ（どれも同じ結果になる）', () => {
  assert.ok(/class="mcl mcl-close" onclick="closeM\(\)"/.test(INDEX), '×');
  assert.ok(/addEventListener\('click', function\(e\)\{ if\(e\.target===this\) closeM\(\); \}\)/.test(INDEX), '背景');
  assert.ok(/if \(ov && ov\.classList\.contains\('open'\)\) closeM\(\);/.test(INDEX), 'Esc');
  assert.ok(/if \(dy > 80 && startScrollTop <= 0\) \{\s*closeM\(\);/.test(INDEX), '下スワイプ');
});

test('静的: ハッシュの名前は変えていない（q・genre・tag・ward・pref・cap・store）', () => {
  for (const k of ['pref', 'genre', 'ward', 'tag', 'cap', 'q', 'store']) {
    assert.ok(BLOCK.indexOf("'" + k + "='") >= 0, k + '= を書いている');
  }
  assert.ok(INDEX.indexOf("'#store=' + encodeURIComponent(_shareStoreHpid)") >= 0, '共有 URL は #store=ID のまま');
});

test('openM を包む処理（閲覧履歴の記録）は source を元の openM へ渡す。渡さないと modal_open の source が常に unknown になり、共有リンク・戻る/進むの区別もつかない', () => {
  const a = INDEX.indexOf('var _origOpenM = openM;');
  assert.ok(a >= 0, 'openM を包む処理が見つからない');
  assert.strictEqual(INDEX.split('= openM;').length - 1, 1, 'openM を包む処理は1つだけ');
  const b = INDEX.indexOf('\n};', a);
  assert.ok(b > a, '包む処理の終わりが見つからない');
  const calls = [];
  const added = [];
  const ctx = vm.createContext({
    openM: function (i, source) { calls.push({ i: i, source: source }); },
    ALL_STORES: [{ '店名': 'A店' }, { '店名': 'B店' }],
    addHistory: function (name) { added.push(name); },
  });
  vm.runInContext(INDEX.slice(a, b + 3), ctx);
  ctx.openM(1, 'deeplink');
  ctx.openM(0);
  assert.deepStrictEqual(calls, [{ i: 1, source: 'deeplink' }, { i: 0, source: undefined }], '2つ目の引数をそのまま渡す');
  assert.deepStrictEqual(added, ['B店', 'A店'], '閲覧履歴の記録は今までどおり');
});
