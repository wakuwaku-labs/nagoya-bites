'use strict';
/**
 * tests/index_history.test.js — I-21（UI・UX改修 段階1a）。I-20 で絞り込みの状態が NB_FILTER に変わったのに合わせて更新。
 *
 * トップ（index.html）の URL と「戻る」の決まりを確かめる。
 *   1. `#store=` が全店で開く（最初に載っている50店に無い店は、全店のデータを読み終えてから開く）
 *   2. 店のモーダルは履歴を1つ足し、×・背景・Esc・下スワイプ・「戻る」のどれで閉じても1回で閉じる
 *   3. 壊れたハッシュ（不正な %・" など）で、条件の復元と初期化が止まらない
 *   4. 絞り込みの条件（NB_FILTER）⇄ ハッシュ。書く順は genre・area・cond・tag・cap・q・store。
 *      以前の共有リンク（ward=・pref=・tag=・cap=）も読める。ward= はその区に属するエリアの群すべてに広がり、pref= は読んで捨てる
 *
 * index.html の NB-FILTER-POLICY・NB-FILTER・NB-HISTORY の各区画と、実物の closeM を取り出し、偽の履歴・偽の DOM の上で動かす。
 * 期待値のうち、エリアの群・条件の slug と並びはポリシー（NB_FILTER_POLICY）から計算する（特定の件数や店に縛らない）。
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
// 開始の印から終了の印まで（印はそれぞれ 1 か所だけ）
function region(start, end) {
  assert.strictEqual(INDEX.split(start).length - 1, 1, `${start} は 1 か所だけ`);
  const a = INDEX.indexOf(start);
  const b = INDEX.indexOf(end, a);
  assert.ok(b > a, `${end} が見つからない`);
  return INDEX.slice(a, b + end.length);
}
// 行頭の `function name(` から、行頭の `}` まで
function topFunction(src, name) {
  const head = '\nfunction ' + name + '(';
  assert.strictEqual(src.split(head).length - 1, 1, `function ${name} は1つだけ定義されている`);
  const a = src.indexOf(head) + 1;
  const b = src.indexOf('\n}\n', a);
  assert.ok(b > a, `function ${name} の終わりが見つからない`);
  return src.slice(a, b + 2);
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
// 絞り込みの核（ポリシー・ジャンルの表・純粋関数の区画）と、その外の依存（ジャンルの正規化）
const FILTER_REGION = region('// NB-FILTER:START', '// NB-FILTER:END');
const FILTER_SOURCE = [
  region('/* NB-FILTER-POLICY:START */', '/* NB-FILTER-POLICY:END */'),
  region('var GENRE_ORDER = ', '];'),
  region('var GENRE_RULES = [', '\n];'),
  FILTER_REGION,
  topFunction(INDEX, 'normalizeGenre'),
].join('\n');

// openM の約束事だけを再現した偽物（実物の約束事は下の「静的に確かめる」で見る）
const FAKE_OPEN_M = [
  'function openM(i, source) {',
  '  var r = ALL_STORES[i];',
  "  opened.push({ id: r['ホットペッパーID'], source: source });",
  "  document.getElementById('ov').classList.add('open');",
  "  nbModalHistoryOpen(r['ホットペッパーID'] || '', source);",
  '}',
].join('\n');

// ── ポリシーから計算する期待値の材料 ───────────────────────────────────
const plain = (x) => JSON.parse(JSON.stringify(x));
const PROBE = vm.createContext({ console });
vm.runInContext(FILTER_SOURCE, PROBE);
const POLICY = plain(PROBE.NB_FILTER_POLICY);
const GENRES = plain(PROBE.GENRE_ORDER);
const TAGS = plain(PROBE.NB_TAG_ORDER);
const AREAS = POLICY.areas.map((a) => a.slug);
const ALL_CONDS = plain(PROBE.nbCondDefs().list).map((c) => c.slug); // ハッシュで読める条件（シートだけの予算の区分も含む）
const WARDS = Array.from(new Set(POLICY.areas.map((a) => a.ward).filter(Boolean)));
const areasOfWard = (w) => POLICY.areas.filter((a) => a.ward === w).map((a) => a.slug);
const WIDE_WARD = WARDS.find((w) => areasOfWard(w).length >= 2); // 複数のエリアの群を持つ区（中区など）
const enc = encodeURIComponent;
const GENRE = '焼肉・ホルモン'; // 代表ジャンルの 1 つ（画面に出る名前）
const EMPTY = { genre: 'All', areas: [], conds: [], tags: [], cap: 0 };

// 材料が空だと「空のまま一致」して何も確かめなくなる。先に材料が揃っていることを確かめる
test('前提: ポリシーに、エリアの群・条件・ジャンル・タグが揃い、複数の群を持つ区がある（期待値が空振りしない）', () => {
  assert.ok(AREAS.length >= 3, 'エリアの群');
  assert.ok(ALL_CONDS.length >= 3, '条件');
  assert.ok(GENRES.indexOf(GENRE) >= 0, 'ジャンル ' + GENRE);
  assert.ok(TAGS.length >= 3, 'タグ');
  assert.ok(TAGS.every((t) => t.indexOf(',') < 0), 'タグの名前に , が無い（ハッシュは , で区切る）');
  assert.ok(WARDS.length >= 2, '区');
  assert.ok(WIDE_WARD && areasOfWard(WIDE_WARD).length >= 2, '1 つの区に 2 つ以上の群');
  assert.ok(AREAS.some((a) => areasOfWard(WIDE_WARD).indexOf(a) < 0), 'その区に属さない群');
});

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
  const registry = { si: makeEl() }; // 検索ボックス（#si）
  const lists = {}; // nbFindByData が探す要素の一覧（セレクタ → 要素）
  const document = {
    body: { style: {} },
    getElementById(id) { return registry[id] || (registry[id] = makeEl()); },
    querySelector() { return null; },
    querySelectorAll(sel) { return (lists[sel] || []).slice(); },
  };
  const timers = [];
  const errors = [];
  const opened = [];
  const ctx = vm.createContext({
    window: br.win, history: br.history, location: br.location, document,
    console: { error: (...a) => { errors.push(a); }, log() {}, warn() {} },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    ALL_STORES: [], FULL_CATALOG_LOADED: false,
    M_STICKY_OBS: null,
    opened,
  });
  vm.runInContext(FILTER_SOURCE, ctx);
  vm.runInContext(BLOCK, ctx);
  vm.runInContext(CLOSE_M, ctx);
  vm.runInContext(FAKE_OPEN_M, ctx);
  ctx.NB_FILTER = ctx.nbEmptyFilter(); // index.html では区画の外（var NB_FILTER = …）にある
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
    // 絞り込みの状態をまとめて決める（正規化してから入れる＝画面の操作で作れる状態だけ）
    setFilter(partial) { ctx.NB_FILTER = ctx.nbNormalizeFilter(Object.assign(ctx.nbEmptyFilter(), partial || {})); },
    filter: () => plain(ctx.NB_FILTER),
    chips(sel, attr, values) {
      lists[sel] = values.map((v) => makeEl({ [attr]: v }));
      return lists[sel];
    },
    isOpen: () => registry.ov ? registry.ov.classList.contains('open') : false,
    json: plain,
  };
  return env;
}

// ハッシュを持つ状態でページを開き、readHash を実行した環境
function openWith(hash) {
  const env = makeEnv({ entries: [{ hash, state: null }] });
  env.run('readHash()');
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
  // エリアの群・条件は ASCII の slug を , でつなぐ
  assert.deepStrictEqual(env.json(env.run("nbParseHash('#area=sakae,meieki&cond=koshitsu,late-night')")), { area: 'sakae,meieki', cond: 'koshitsu,late-night' });
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
  env.chips('.fs-chip', 'data-v', ['koshitsu', 'late-night', 'a"b', 'x]y']);
  assert.strictEqual(env.run("nbFindByData('.fs-chip', 'data-v', 'a\"b').getAttribute('data-v')"), 'a"b');
  assert.strictEqual(env.run("nbFindByData('.fs-chip', 'data-v', 'x]y').getAttribute('data-v')"), 'x]y');
  assert.strictEqual(env.run("nbFindByData('.fs-chip', 'data-v', 'koshitsu').getAttribute('data-v')"), 'koshitsu');
  assert.strictEqual(env.run("nbFindByData('.fs-chip', 'data-v', 'ない')"), null);
  assert.strictEqual(env.run("nbFindByData('.zz', 'data-v', 'x')"), null);
});

// ── 2. 絞り込みの状態 ⇄ ハッシュ ──────────────────────────────────────
test('readHash: 条件を復元する（genre・area・cond・tag・cap・q）', () => {
  const [a1, a3] = [AREAS[1], AREAS[3]];
  const [c0, c1] = [ALL_CONDS[0], ALL_CONDS[1]];
  const env = openWith('#genre=' + enc(GENRE) + '&area=' + a3 + ',' + a1 + '&cond=' + c1 + ',' + c0
    + '&tag=' + enc('個室') + ',' + enc('デート') + '&cap=20&q=' + enc('とん'));
  // 並びはハッシュに書かれた順ではなく、ポリシー・タグの表の並び（ハッシュの文字列を安定させるため）
  assert.deepStrictEqual(env.filter(), {
    genre: GENRE,
    areas: AREAS.filter((a) => a === a1 || a === a3),
    conds: ALL_CONDS.filter((c) => c === c0 || c === c1),
    tags: TAGS.filter((t) => t === 'デート' || t === '個室'),
    cap: 20,
  });
  assert.strictEqual(env.registry.si.value, 'とん');
  assert.deepStrictEqual(env.errors, []);
});

test('readHash: 以前の共有リンク（pref・genre・ward・tag・cap・q）がそのまま読める', () => {
  // 以前のリンクの genre は「焼肉」のような言い方でもよい（代表ジャンルへ解決）。タグの候補に無い値（禁煙）は捨てる
  const env = openWith('#pref=' + enc('愛知県') + '&genre=' + enc('焼肉') + '&ward=' + enc(WIDE_WARD)
    + '&tag=' + enc('個室') + ',' + enc('禁煙') + '&cap=20&q=' + enc('とん'));
  assert.deepStrictEqual(env.filter(), { genre: GENRE, areas: areasOfWard(WIDE_WARD), conds: [], tags: ['個室'], cap: 20 });
  assert.strictEqual(env.registry.si.value, 'とん');
  assert.deepStrictEqual(env.errors, []);
});

test('readHash: ward= は、その区に属するエリアの群すべてに広がる（ポリシーの並び）', () => {
  WARDS.forEach((w) => {
    const env = openWith('#ward=' + enc(w));
    assert.deepStrictEqual(env.filter(), Object.assign({}, EMPTY, { areas: areasOfWard(w) }), w);
  });
});

test('readHash: pref= は読んで捨てる（何も足さない・何も消さない）', () => {
  ['愛知県', '岐阜県', '全国'].forEach((pref) => {
    const env = openWith('#pref=' + enc(pref));
    assert.deepStrictEqual(env.filter(), EMPTY, pref);
    assert.deepStrictEqual(Object.keys(env.filter()).sort(), Object.keys(EMPTY).sort(), '条件の入れ物に pref は増えない');
  });
  const env = openWith('#pref=' + enc('岐阜県') + '&area=' + AREAS[0]);
  assert.deepStrictEqual(env.filter(), Object.assign({}, EMPTY, { areas: [AREAS[0]] }), 'ほかの条件はそのまま');
});

test('readHash: ward= と area= が両方あれば和集合（重複は 1 つ）。知らない区・空の区は何も足さない', () => {
  const inWard = areasOfWard(WIDE_WARD);
  const extra = AREAS.find((a) => inWard.indexOf(a) < 0);
  const env = openWith('#ward=' + enc(WIDE_WARD) + '&area=' + extra + ',' + inWard[0]);
  assert.deepStrictEqual(env.filter().areas, AREAS.filter((a) => inWard.indexOf(a) >= 0 || a === extra));
  assert.deepStrictEqual(openWith('#ward=' + enc('存在しない区')).filter(), EMPTY);
  assert.deepStrictEqual(openWith('#ward=').filter(), EMPTY);
});

test('readHash: 知らない値は捨て、読める値だけ残す（エリアの群・条件・タグ・人数・ジャンル）', () => {
  const env = openWith('#area=zzz,' + AREAS[2] + '&cond=nope,' + ALL_CONDS[0] + '&tag=' + enc('存在しないタグ') + ',' + enc('デート') + '&cap=abc');
  assert.deepStrictEqual(env.filter(), { genre: 'All', areas: [AREAS[2]], conds: [ALL_CONDS[0]], tags: ['デート'], cap: 0 });
  assert.strictEqual(openWith('#cap=-5').filter().cap, 0, '負の人数は付けない');
  // ジャンルは代表ジャンルのどれかに解決する（知らない名前は normalizeGenre が決める）
  const g = openWith('#genre=' + enc('見たことのない料理')).filter().genre;
  assert.ok(GENRES.indexOf(g) >= 0, '代表ジャンルのどれか: ' + g);
  assert.strictEqual(openWith('#genre=All').filter().genre, 'All');
});

for (const bad of [
  '#q=%E0%A4%A',
  '#pref=a%22b',
  '#genre=%',
  '#genre=%22%5D',
  '#ward=%22',
  '#area=%',
  '#area=%22',
  '#area=%22%5D%7Bx',
  '#cond=%E0%A4%A',
  '#cond=%22%5D',
  '#tag=%25,%E0%A4%A',
  '#cap=%',
  '#store=%',
  '#=&&=&',
  '#%',
  '#pref=%22%5D%7Bx',
]) {
  test('readHash: 壊れたハッシュ ' + bad + ' で例外にならず、初期化の続きを止めない', () => {
    const env = makeEnv({ entries: [{ hash: bad, state: null }] });
    assert.doesNotThrow(() => env.run('readHash()'));
    assert.deepStrictEqual(env.errors, [], 'console.error が出ていない');
    // できた条件は、画面の操作で作れる状態（正規化しても変わらない）。壊れた値が条件に混ざらない
    assert.deepStrictEqual(env.filter(), plain(env.ctx.nbNormalizeFilter(env.ctx.NB_FILTER)));
  });
}

test('readHash: 壊れた値と正しい値が混ざっていても、正しい値は復元する', () => {
  const env = openWith('#area=a%22b&cond=' + ALL_CONDS[0] + '&genre=' + enc(GENRE) + '&q=%E0%A4%A');
  assert.strictEqual(env.filter().genre, GENRE, '壊れた area の後ろの genre も読む');
  assert.deepStrictEqual(env.filter().conds, [ALL_CONDS[0]], '壊れた area の後ろの cond も読む');
  assert.deepStrictEqual(env.filter().areas, [], '壊れた area は条件にならない');
  assert.strictEqual(env.registry.si.value, '%E0%A4%A', '壊れた q は読めた分をそのまま入れる');
  assert.deepStrictEqual(env.errors, []);
});

test('readHash: 条件の復元で想定外の例外が起きても、条件を空に戻し、store= の復元など初期化の続きを止めない', () => {
  const env = makeEnv({ entries: [{ hash: '#genre=' + enc(GENRE) + '&store=J001', state: null }] });
  env.setFilter({ areas: [AREAS[0]] });
  env.run("nbFilterFromParams = function() { throw new Error('想定外'); };");
  assert.doesNotThrow(() => env.run('readHash()'));
  assert.strictEqual(env.errors.length, 1, 'console.error に 1 回だけ記録する');
  assert.strictEqual(env.errors[0][0], 'readHash failed');
  assert.deepStrictEqual(env.filter(), EMPTY, '半端な条件を残さない');
  assert.strictEqual(env.ctx.NB_PENDING_STORE, 'J001', '店のモーダルを開く準備は続く');
});

test('nbBuildHash: 並びと書き方は genre・area・cond・tag・cap・q の順。store は末尾', () => {
  const env = makeEnv();
  assert.strictEqual(env.run('nbBuildHash()'), '#');
  assert.strictEqual(env.run("nbBuildHash('J001')"), '#store=J001');
  const [a1, a3] = [AREAS[1], AREAS[3]];
  const [c0, c1] = [ALL_CONDS[0], ALL_CONDS[1]];
  env.setFilter({ genre: GENRE, areas: [a3, a1], conds: [c1, c0], tags: ['個室', 'デート'], cap: 20 });
  env.registry.si.value = ' とんかつ ';
  // エリアの群と条件は ASCII の slug なので符号化せず、, でつなぐ。ジャンル・タグ・検索語は符号化する
  const base = '#genre=' + enc(GENRE) + '&area=' + AREAS.filter((a) => a === a1 || a === a3).join(',')
    + '&cond=' + ALL_CONDS.filter((c) => c === c0 || c === c1).join(',')
    + '&tag=' + enc('デート') + ',' + enc('個室') + '&cap=20&q=' + enc('とんかつ');
  assert.strictEqual(env.run('nbBuildHash()'), base);
  assert.strictEqual(env.run("nbBuildHash('J001')"), base + '&store=J001');
  assert.strictEqual(env.run("nbBuildHash('a&b=c')"), base + '&store=' + enc('a&b=c'));
});

test('nbBuildHash: 条件が無いものは書かない（ジャンル All・人数 0・空の一覧）。1 種類だけでも名前どおりに書く', () => {
  const env = makeEnv();
  env.setFilter({ genre: 'All', cap: 0 });
  assert.strictEqual(env.run('nbBuildHash()'), '#');
  env.setFilter({ genre: GENRE });
  assert.strictEqual(env.run('nbBuildHash()'), '#genre=' + enc(GENRE));
  env.setFilter({ areas: [AREAS[0]] });
  assert.strictEqual(env.run('nbBuildHash()'), '#area=' + AREAS[0]);
  env.setFilter({ conds: [ALL_CONDS[0]] });
  assert.strictEqual(env.run('nbBuildHash()'), '#cond=' + ALL_CONDS[0]);
  env.setFilter({ tags: ['デート'] });
  assert.strictEqual(env.run('nbBuildHash()'), '#tag=' + enc('デート'));
  env.setFilter({ cap: 30 });
  assert.strictEqual(env.run('nbBuildHash()'), '#cap=30');
  env.setFilter({});
  env.registry.si.value = '   ';
  assert.strictEqual(env.run('nbBuildHash()'), '#', '空白だけの検索語は書かない');
});

test('ハッシュの往復: 書いたハッシュを読み直すと同じ条件・同じ検索語になり、もう一度書くと同じハッシュになる', () => {
  const cases = [
    {},
    { genre: GENRE },
    { areas: [AREAS[0]] },
    { areas: AREAS.slice(0, 3), conds: [ALL_CONDS[0]] },
    { conds: ALL_CONDS }, // シートだけの予算の区分も含め、読める条件すべて
    { tags: TAGS }, // タグの表すべて（符号化・, 区切り・日本語の記号を通す）
    { cap: 30 },
    { genre: GENRE, areas: AREAS, conds: ALL_CONDS, tags: TAGS, cap: 50 },
  ];
  cases.forEach((c, i) => {
    [{ q: '' }, { q: 'とん&かつ=100%' }].forEach((qq) => {
      const a = makeEnv();
      a.setFilter(c);
      a.registry.si.value = qq.q;
      const hash = a.run('nbBuildHash()');
      const b = openWith(hash);
      assert.deepStrictEqual(b.filter(), a.filter(), `条件 #${i} q=${JSON.stringify(qq.q)}: ${hash}`);
      assert.strictEqual(b.registry.si.value, qq.q, '検索語');
      assert.strictEqual(b.run('nbBuildHash()'), hash, '書き直しても同じ');
      assert.deepStrictEqual(b.errors, []);
    });
  });
});

test('ハッシュの正規化: 順序が違う・重複した共有リンクも、読んで書き直すと決まった並びになる', () => {
  const [a0, a2] = [AREAS[0], AREAS[2]];
  const [c0, c1] = [ALL_CONDS[0], ALL_CONDS[1]];
  const env = openWith('#q=' + enc('とん') + '&cap=20&tag=' + enc('個室') + ',' + enc('デート') + ',' + enc('デート')
    + '&cond=' + c1 + ',' + c0 + ',' + c0 + '&area=' + a2 + ',' + a0 + '&genre=' + enc(GENRE));
  assert.strictEqual(env.run('nbBuildHash()'), '#genre=' + enc(GENRE) + '&area=' + a0 + ',' + a2 + '&cond=' + c0 + ',' + c1
    + '&tag=' + enc('デート') + ',' + enc('個室') + '&cap=20&q=' + enc('とん'));
});

// ── 3. #store= が全店で開く ───────────────────────────────────────────
test('#store= : 最初の50店に無い店は、全店のデータを読み終えてから開く（URL の store= は消えない）', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J777', state: null }] });
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

test('#store= : 条件つきの共有リンクは、店のモーダルを開いても条件を失わない（URL の genre・area・cond・store が並んで残る）', () => {
  const hash = '#genre=' + enc(GENRE) + '&area=' + AREAS[0] + '&cond=' + ALL_CONDS[0] + '&store=J777';
  const env = makeEnv({ entries: [{ hash, state: null }] });
  env.setStores(50);
  env.run('readHash()');
  env.run('pushHash()');
  env.fire();
  assert.strictEqual(env.br.hash, hash, '待っている間も条件と store= が残る');
  const ids = []; for (let i = 1; i <= 50; i++) ids.push('J' + String(i).padStart(3, '0')); ids.push('J777');
  env.setStores(ids.length, ids);
  env.ctx.FULL_CATALOG_LOADED = true;
  env.run('readHash()');
  env.run('pushHash()');
  env.fire();
  assert.strictEqual(env.isOpen(), true);
  assert.strictEqual(env.br.hash, hash, '開いても同じ');
  assert.deepStrictEqual(env.filter(), Object.assign({}, EMPTY, { genre: GENRE, areas: [AREAS[0]], conds: [ALL_CONDS[0]] }));
});

test('#store= : 最初の50店の中の店は、そのまま開く', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J005', state: null }] });
  env.setStores(50);
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.isOpen(), true);
  assert.deepStrictEqual(env.json(env.opened), [{ id: 'J005', source: 'deeplink' }]);
});

test('#store= : 全店を読み終えても無い ID は、開かずに URL から外す（index・古い ID など）。条件は残す', () => {
  const env = makeEnv({ entries: [{ hash: '#genre=%E7%84%BC%E8%82%89&store=index&review=1', state: null }] });
  env.setStores(60);
  env.ctx.FULL_CATALOG_LOADED = true;
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.isOpen(), false);
  assert.strictEqual(env.ctx.NB_PENDING_STORE, '');
  assert.ok(env.br.hash.indexOf('store=') < 0, 'store= を外す: ' + env.br.hash);
  assert.strictEqual(env.br.hash, '#genre=' + enc(GENRE), '条件（古い言い方の焼肉は代表ジャンルに直して）は URL に残る');
  assert.strictEqual(env.errors.length, 0);
});

test('#store= : すでに開いている店は、読み直しても開き直さない（modal_open を二重に出さない）', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J002', state: null }] });
  env.setStores(10);
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.opened.length, 1);
  env.run('readHash()'); // 全店のデータが届いて、もう一度読まれた
  env.fire();
  assert.strictEqual(env.opened.length, 1, '開き直さない');
});

test('#store= : 「進む」で開こうとして店のデータを待っていたとき、データが届いたあとの再試行も popstate のまま（deeplink と数えない）', () => {
  // 履歴: 今の1つ先に、店のモーダルの履歴（#store=J777）がある。まだ最初の50店しか無い（J777 は無い）
  const env = makeEnv({ entries: [{ hash: '', state: null }, { hash: '#store=J777', state: { nbM: 1 } }], index: 0 });
  env.setStores(50);
  env.br.go(1); // 「進む」→ popstate
  env.fire();
  assert.strictEqual(env.isOpen(), false, 'まだ開かない');
  assert.strictEqual(env.ctx.NB_PENDING_STORE, 'J777', '待っている');
  assert.strictEqual(env.ctx.NB_PENDING_SOURCE, 'popstate', '待っている間の source は popstate');
  // 全店のデータが届く（J777 を含む）。loadStores が readHash を読み直し、50ms 後に再試行する
  const ids = []; for (let i = 1; i <= 50; i++) ids.push('J' + String(i).padStart(3, '0')); ids.push('J777');
  env.setStores(ids.length, ids);
  env.ctx.FULL_CATALOG_LOADED = true;
  env.run('readHash()');
  env.run('pushHash()');
  env.fire();
  assert.strictEqual(env.isOpen(), true, '開く');
  assert.deepStrictEqual(env.json(env.opened), [{ id: 'J777', source: 'popstate' }], 'source は popstate（modal_open は数えない）');
  assert.strictEqual(env.ctx.NB_PENDING_STORE, '');
  assert.strictEqual(env.ctx.NB_PENDING_SOURCE, '', '開いたら待ちの印を消す');
  assert.strictEqual(env.br.calls.push, 0, '履歴を足さない');
});

test('#store= : 共有リンクで開いたときの再試行は、これまでどおり deeplink（popstate の印を引きずらない）', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J777', state: null }] });
  env.setStores(50);
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.ctx.NB_PENDING_SOURCE, 'deeplink');
  const ids = []; for (let i = 1; i <= 50; i++) ids.push('J' + String(i).padStart(3, '0')); ids.push('J777');
  env.setStores(ids.length, ids);
  env.ctx.FULL_CATALOG_LOADED = true;
  env.run('readHash()');
  env.fire();
  assert.deepStrictEqual(env.json(env.opened), [{ id: 'J777', source: 'deeplink' }]);
  assert.strictEqual(env.ctx.NB_PENDING_SOURCE, '');
});

test('#store= : 「戻る」「進む」で待っていた店とは別の店の共有リンクは、deeplink のまま', () => {
  // popstate で J777 を待っている間に、別の店 J888 のハッシュを読み直した（待ちの印は J777 のもの）
  const env = makeEnv({ entries: [{ hash: '#store=J888', state: null }] });
  env.setStores(50);
  env.run("NB_PENDING_STORE = 'J777'; NB_PENDING_SOURCE = 'popstate';");
  env.run('readHash()');
  assert.strictEqual(env.ctx.NB_PENDING_STORE, 'J888');
  assert.strictEqual(env.ctx.NB_PENDING_SOURCE, 'deeplink', '別の店の待ちに popstate の印を持ち越さない');
});

test('#store= : 共有リンクで店のデータを待っている間に、同じ店のハッシュで popstate が来ても、source は deeplink のまま（共有リンクの訪問を数え落とさない）', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J777', state: null }] });
  env.setStores(50);
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.ctx.NB_PENDING_SOURCE, 'deeplink');
  env.run('nbSyncModalWithUrl()'); // 同じ店のハッシュで popstate が来た（待ち始めた理由は変えない）
  assert.strictEqual(env.ctx.NB_PENDING_STORE, 'J777');
  assert.strictEqual(env.ctx.NB_PENDING_SOURCE, 'deeplink', '待ち始めた理由を保つ');
  const ids = []; for (let i = 1; i <= 50; i++) ids.push('J' + String(i).padStart(3, '0')); ids.push('J777');
  env.setStores(ids.length, ids);
  env.ctx.FULL_CATALOG_LOADED = true;
  env.run('readHash()');
  env.fire();
  assert.deepStrictEqual(env.json(env.opened), [{ id: 'J777', source: 'deeplink' }], '共有リンクの訪問は1回、deeplink と数える');
});

test('#store= : 待っている店と別の店のハッシュへ着いたら、待つ店が替わり、source は popstate（前の店の理由を持ち越さない）', () => {
  const env = makeEnv({ entries: [{ hash: '#store=J777', state: null }, { hash: '#store=J888', state: { nbM: 1 } }], index: 0 });
  env.setStores(50);
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.ctx.NB_PENDING_SOURCE, 'deeplink');
  env.br.go(1); // 「進む」→ popstate（別の店 J888 のハッシュ。これも最初の50店に無い）
  env.fire();
  assert.strictEqual(env.ctx.NB_PENDING_STORE, 'J888');
  assert.strictEqual(env.ctx.NB_PENDING_SOURCE, 'popstate', '新しく待つ店の理由は popstate');
  const ids = []; for (let i = 1; i <= 50; i++) ids.push('J' + String(i).padStart(3, '0')); ids.push('J888');
  env.setStores(ids.length, ids);
  env.ctx.FULL_CATALOG_LOADED = true;
  env.run('readHash()');
  env.fire();
  assert.deepStrictEqual(env.json(env.opened), [{ id: 'J888', source: 'popstate' }]);
});

// ── 4. モーダルと履歴 ─────────────────────────────────────────────────
test('一覧から開く: 履歴が1つ増え、URL に条件と store=ID が載る。閉じる（×・背景・Esc・下スワイプ）と1回で戻る', () => {
  const env = makeEnv();
  env.setStores(60);
  env.setFilter({ genre: GENRE, areas: [AREAS[0]], conds: [ALL_CONDS[0]] });
  env.run('pushHash()'); // 条件を選んだ（applyFilters が pushHash を呼ぶ）
  const cond = '#genre=' + enc(GENRE) + '&area=' + AREAS[0] + '&cond=' + ALL_CONDS[0];
  env.run("openM(3, 'grid')");
  assert.strictEqual(env.isOpen(), true);
  assert.strictEqual(env.br.history.length, 2);
  assert.deepStrictEqual(env.json(env.br.history.state), { nbM: 1 });
  assert.strictEqual(env.br.hash, cond + '&store=J004');
  env.run('closeM()'); // ×・背景・Esc・下スワイプは、どれもこの呼び出し
  assert.strictEqual(env.isOpen(), false);
  assert.strictEqual(env.br.index, 0, '足した履歴が1つ戻って、開く前の位置にいる');
  assert.strictEqual(env.br.hash, cond);
  assert.strictEqual(env.ctx.NB_OPEN_STORE_ID, '');
  assert.strictEqual(env.br.calls.back, 1);
});

test('一覧から開く → ブラウザの「戻る」: モーダルが閉じ、ページはそのまま（余計な back をしない）', () => {
  const env = makeEnv();
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

test('条件つきの共有リンクで開いた店を閉じる: URL から外れるのは store= だけで、条件（genre・area・cond・検索語）は残る', () => {
  const cond = '#genre=' + enc(GENRE) + '&area=' + AREAS[0] + '&cond=' + ALL_CONDS[0] + '&q=' + enc('とん');
  const env = makeEnv({ entries: [{ hash: cond + '&store=J002', state: null }] });
  env.setStores(10);
  env.run('readHash()');
  env.fire();
  assert.strictEqual(env.isOpen(), true);
  env.run('closeM()');
  assert.strictEqual(env.isOpen(), false);
  assert.strictEqual(env.br.calls.back, 0);
  assert.strictEqual(env.br.hash, cond);
});

test('再読み込みで開き直した店（履歴の印あり）を閉じる: 足してあった履歴を1つ戻す', () => {
  const env = makeEnv({ entries: [{ hash: '', state: null }, { hash: '#store=J002', state: { nbM: 1 } }], index: 1 });
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
  env.setStores(3, ['', 'J002', 'J003']);
  env.run("openM(0, 'grid')");
  assert.strictEqual(env.br.history.length, 2);
  assert.strictEqual(env.br.hash, '', 'store= は載せない');
  assert.strictEqual(env.ctx.NB_OPEN_STORE_ID, '');
  env.br.history.back();
  assert.strictEqual(env.isOpen(), false);
  assert.strictEqual(env.br.index, 0);
});

test('pushHash: モーダルが開いている間に呼ばれても、履歴の印と store= を消さない（条件が変わっていれば条件は新しくなる）', () => {
  const env = makeEnv();
  env.setStores(10);
  env.run("openM(1, 'grid')");
  env.run('pushHash()'); // 全店のデータが届いて applyFilters が呼ぶ
  assert.deepStrictEqual(env.json(env.br.history.state), { nbM: 1 });
  assert.strictEqual(env.br.hash, '#store=J002');
  env.setFilter({ areas: [AREAS[0]], cap: 20 });
  env.run('pushHash()');
  assert.deepStrictEqual(env.json(env.br.history.state), { nbM: 1 }, '条件を変えても印は残る');
  assert.strictEqual(env.br.hash, '#area=' + AREAS[0] + '&cap=20&store=J002');
  assert.strictEqual(env.br.history.length, 2);
});

test('条件を変える（pushHash）: 履歴を足さず置き換える（今までどおり）。検索語も URL に載る', () => {
  const env = makeEnv();
  env.setStores(10);
  env.setFilter({ genre: GENRE });
  env.run('pushHash()');
  assert.strictEqual(env.br.hash, '#genre=' + enc(GENRE));
  env.setFilter({ genre: GENRE, areas: AREAS.slice(0, 2), conds: ALL_CONDS.slice(0, 2) });
  env.registry.si.value = 'とん';
  env.run('pushHash()');
  assert.strictEqual(env.br.hash, '#genre=' + enc(GENRE) + '&area=' + AREAS.slice(0, 2).join(',') + '&cond=' + ALL_CONDS.slice(0, 2).join(',') + '&q=' + enc('とん'));
  assert.strictEqual(env.br.history.length, 1);
  assert.strictEqual(env.br.calls.push, 0);
  env.setFilter({});
  env.registry.si.value = '';
  env.run('pushHash()');
  assert.strictEqual(env.br.hash, '', '条件をすべて外せば URL は素のページに戻る');
  assert.strictEqual(env.br.history.length, 1);
});

test('アドレス欄で #store= を書き換えた（popstate）: 別の店のモーダルへ切り替わる', () => {
  const env = makeEnv();
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

test('静的: ハッシュを読む処理（readHash・nbFilterFromParams）は decodeURIComponent も値入りのセレクタも使わない', () => {
  const src = extractFunction(BLOCK, 'readHash', '// 待っている店');
  const core = topFunction(FILTER_REGION, 'nbFilterFromParams');
  [['readHash', src], ['nbFilterFromParams', core]].forEach(([name, code]) => {
    assert.ok(!/decodeURIComponent\(/.test(code), name + ': nbSafeDecode / nbParseHash を通す');
    assert.ok(!/querySelector(All)?\([^)]*\+/.test(code), name + ': 値を連結したセレクタを使わない');
    assert.ok(!/\[data-/.test(code), name + ': 属性セレクタに値を埋め込まない');
  });
  assert.ok(/nbFilterFromParams\(params\)/.test(src), 'readHash は条件を nbFilterFromParams で作る');
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
  // 似たお店のカードの描画は NB-MODAL-RELATED の nbRelatedHtml（I-16b）。openM はそれを呼び、カードは swap で切り替える
  assert.ok(/nbRelatedHtml\(r\)/.test(src), 'openM は似た店の区画を nbRelatedHtml で作る');
  assert.ok(INDEX.indexOf("closeM({swap:true});setTimeout(function(){openM(' + it.pos + ',\\'modal_reco\\');},50)") > 0, '似たお店は swap で切り替える');
});

test('静的: closeM は開いていたときだけ履歴を戻し、fromPop / swap では触れない', () => {
  assert.ok(/var wasOpen = ovEl\.classList\.contains\('open'\);/.test(CLOSE_M));
  assert.ok(/if \(wasOpen && !\(opts && \(opts\.fromPop \|\| opts\.swap\)\)\) nbModalHistoryClose\(\);/.test(CLOSE_M));
  assert.ok(/if \(opts && opts\.swap\) NB_SWAP = Date\.now\(\);/.test(CLOSE_M));
});

test('静的: ×・背景・Esc・下スワイプはすべて closeM() を呼ぶ（どれも同じ結果になる）', () => {
  assert.ok(/class="mcl mcl-close" type="button" onclick="closeM\(\)"/.test(INDEX), '×');
  assert.ok(/addEventListener\('click', function\(e\)\{ if\(e\.target===this\) closeM\(\); \}\)/.test(INDEX), '背景');
  assert.ok(/if \(ov && ov\.classList\.contains\('open'\)\) closeM\(\);/.test(INDEX), 'Esc');
  assert.ok(/if \(dy > 80 && startScrollTop <= 0\) closeM\(\);/.test(INDEX), '下スワイプ');
});

test('静的: ハッシュの名前は、書く側が genre・area・cond・tag・cap・q・store の順、読む側は以前の共有リンクの ward（pref は読んで捨てる）まで変えていない', () => {
  // 書く側: 条件は nbFilterParams（NB-FILTER の区画）、検索語と店は nbBuildHash（NB-HISTORY の区画）
  const writer = topFunction(FILTER_REGION, 'nbFilterParams');
  const keys = ['genre', 'area', 'cond', 'tag', 'cap'];
  const at = keys.map((k) => writer.indexOf("'" + k + "='"));
  at.forEach((i, n) => assert.ok(i >= 0, keys[n] + '= を書いている'));
  assert.deepStrictEqual(at.slice().sort((x, y) => x - y), at, '条件の書く順は ' + keys.join('・'));
  const build = topFunction(BLOCK, 'nbBuildHash');
  const iFilter = build.indexOf('nbFilterParams(NB_FILTER)');
  const iQ = build.indexOf("'q='");
  const iStore = build.indexOf("'store='");
  assert.ok(iFilter >= 0 && iQ > iFilter && iStore > iQ, 'nbBuildHash は条件 → q= → store= の順');
  // 読む側: 以前の共有リンクの名前（ward・pref）を含め、ハッシュの名前を読み続ける
  const reader = topFunction(FILTER_REGION, 'nbFilterFromParams');
  ['genre', 'area', 'cond', 'tag', 'cap', 'ward'].forEach((k) => {
    assert.ok(new RegExp('\\bp\\.' + k + '\\b').test(reader), 'ハッシュの ' + k + ' を読む');
  });
  assert.ok(/params\.q\b/.test(extractFunction(BLOCK, 'readHash', '// 待っている店')), 'q を読む');
  assert.ok(/params\.store\b/.test(extractFunction(BLOCK, 'readHash', '// 待っている店')), 'store を読む');
  // 共有 URL は #store=ID のまま
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
