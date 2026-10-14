'use strict';
/**
 * tests/index_filter_core.test.js — 絞り込みの核（I-20・P-401）
 *
 * トップ（index.html）の `NB-FILTER` 区画（絞り込みの条件の判定・正規化・ハッシュ・件数・0 軒の提案）を、
 * index.html の実物のコードのまま vm で動かして確かめる。DOM は使わない（区画が DOM に触らないことも見る）。
 *
 * 実物と偽物:
 *   ・実物 … NB-FILTER 区画。依存の GENRE_ORDER・GENRE_RULES・normalizeGenre・SCENE_ALIAS・priceToNum・nbSafeDecode・nbParseHash。
 *            検索エンジン（NB_SEARCH_ENGINE 区画）の nbRunSearch も実物を使う。
 *   ・ポリシーの表（NB_FILTER_POLICY）… 生成区画（ビルドが書く）は使わず、scripts/lib/filter_policy.js の buildFilterPolicy に
 *            data/area_genre_pages_policy.json を通して作る。CI の build は npm test の前に生成区画を書き直すが、
 *            routine-pr-automerge は build 無しで npm test を走らせる。生成区画の鮮度に左右されないため。
 *            生成区画の「形」（印が 1 組・1 行・読める・禁止の並びが無い）だけは別に見る。今のポリシーと一致するかは見ない。
 *   ・偽物 … 件数・復元・0 軒の提案の検査で、検索エンジンの代わりに差し替えるもの。
 *            FAKE_MUTATE: 全店の __score・__why・__hitCount と NB_SEARCH_META を書き換え、半分を返す（任意で例外を投げる）。
 *            FAKE_SUBSTR: 店名に検索語を含む店だけを返す。
 *
 * 守ること:
 *   ・エリア 10 群・条件 13 軸は、ハブ（scripts/lib/area_genre_pages.js）と全店で同じ店を通す。予算 3 区分は重ならず漏れない
 *   ・人数は和集合（宴会収容・タグの上限・「NN名以上」）。10/20/30/50 の境目
 *   ・正規化とハッシュの往復。古い共有リンク（ward・pref・個室などのタグ・cap）が壊れない
 *   ・「N軒を見る」の件数 = 反映後の一覧の件数。数えても店の __score などを壊さない
 *   ・0 軒の提案は、条件を 1 つ外した結果を総当たりで数えた件数と一致する
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const FP = require('../scripts/lib/filter_policy.js');
const HUB = require('../scripts/lib/area_genre_pages.js');
const POLICY = HUB.loadPolicy();
const STORES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));

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
// コメントだけを除く（/* */・行頭の //・空白のあとの //）
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/\s.*$/, '')).join('\n');
}

const DEPS = [
  declSource('GENRE_ORDER', '];'),
  declSource('GENRE_RULES', '\n];'),
  fnSource('normalizeGenre'),
  declSource('SCENE_ALIAS', '\n};'),
  fnSource('nbSafeDecode'),
  fnSource('nbParseHash'),
  fnSource('priceToNum'),
].join('\n');
const ENGINE = region('// ==NB_SEARCH_ENGINE_START==', '// ==NB_SEARCH_ENGINE_END==');
const CORE = region('// NB-FILTER:START', '// NB-FILTER:END');

// 偽の検索エンジン（冒頭の説明を見る）
const FAKE_MUTATE = [
  'var NB_SEARCH_META = null;',
  'var FAKE_CALLS = [];',
  "var FAKE_MODE = 'ok';",
  'function nbRunSearch(list, q) {',
  '  FAKE_CALLS.push(q);',
  '  for (var i = 0; i < list.length; i++) { list[i].__score = 1000 + i; list[i].__why = ["fake"]; list[i].__hitCount = 1; }',
  '  NB_SEARCH_META = { fake: true, q: q };',
  "  if (FAKE_MODE === 'throw') throw new Error('boom');",
  '  return list.filter(function(s, i) { return i % 2 === 0; });',
  '}',
].join('\n');
const FAKE_SUBSTR = [
  'var NB_SEARCH_META = null;',
  'function nbRunSearch(list, q) {',
  '  if (!q) { NB_SEARCH_META = null; return list; }',
  '  NB_SEARCH_META = { q: q };',
  '  return list.filter(function(s) { return String(s["店名"]).indexOf(q) !== -1; });',
  '}',
].join('\n');

function load(opts) {
  opts = opts || {};
  const ctx = { console, NB_FILTER_POLICY: opts.policy || FP.buildFilterPolicy(POLICY) };
  vm.createContext(ctx);
  vm.runInContext([DEPS, opts.engine || ENGINE, CORE].join('\n'), ctx, { filename: 'index.html#nb-filter' });
  return ctx;
}
const C = load();

// ── 小道具 ─────────────────────────────────────────────────────────────
// vm の中で作った配列・オブジェクトは別の realm のもの。deepStrictEqual の前に素の形にする
const plain = (x) => JSON.parse(JSON.stringify(x));
const nm = (s) => (s && s['店名']) || '?';
let seq = 0;
const S = (o) => Object.assign({ '店名': 'T' + (++seq) }, o);          // 合成した店
const F = (o) => Object.assign(C.nbEmptyFilter(), o || {});            // 条件を作る
const fresh = (list) => list.map((s) => Object.assign({}, s));         // 検索の書き込み（__score など）から元を守る
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const AREAS = POLICY.areas.map((a) => a.slug);
const AREA_RAW = (slug) => POLICY.areas.find((a) => a.slug === slug).match[0];   // その群に入る「エリア」の原文
const RULE_SLUG = {};
POLICY.conditions.forEach((c) => { RULE_SLUG[c.rule] = c.slug; });
const JA = /[\u3040-\u30ff\u3400-\u9fff]/;   // ひらがな・カタカナ・漢字のどれか 1 文字

function sameSet(got, want, label) {
  const g = new Set(got);
  const w = new Set(want);
  const extra = [...g].filter((s) => !w.has(s));
  const missing = [...w].filter((s) => !g.has(s));
  assert.ok(extra.length === 0 && missing.length === 0,
    `${label}: ページだけが通す店 ${extra.length} 件（${extra.slice(0, 3).map(nm).join('、')}）／相手だけが通す店 ${missing.length} 件（${missing.slice(0, 3).map(nm).join('、')}）`);
  return w.size;
}
function deepFreeze(o) {
  if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); }
  return o;
}
// 疑似乱数（時刻・Math.random に頼らない）
function lcg(seed) {
  let x = seed >>> 0;
  return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296;
}

// ── 区画の約束（文字で確かめる）─────────────────────────────────────────
test('区画の約束: NB-FILTER は DOM・ブラウザの状態・時刻・乱数に触らない（純粋な関数の集まり）', () => {
  const code = codeOnly(CORE);
  for (const w of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'fetch', 'setTimeout', 'setInterval', 'Math\\.random', 'Date']) {
    assert.ok(!new RegExp('\\b' + w + '\\b').test(code), `NB-FILTER の中で ${w} に触れている`);
  }
  assert.ok(!/\.innerHTML|\.getElementById|\.querySelector|addEventListener/.test(code), 'DOM の操作が無い');
});

test('生成区画 NB-FILTER-POLICY: 印は 1 組・中身は 1 行の var NB_FILTER_POLICY = {…}; で、形が正しい（値が今のポリシーと一致するかは見ない）', () => {
  const [start, end] = FP.REGION;
  assert.strictEqual(INDEX.split(start).length - 1, 1, '開始の印は 1 つだけ');
  assert.strictEqual(INDEX.split(end).length - 1, 1, '終了の印は 1 つだけ');
  const a = INDEX.indexOf(start);
  const b = INDEX.indexOf(end);
  assert.ok(a >= 0 && b > a, '開始の印が終了の印より前');
  const body = INDEX.slice(a + start.length, b).trim();
  assert.ok(/^var NB_FILTER_POLICY = \{.*\};$/.test(body) && !body.includes('\n'), '中身は var NB_FILTER_POLICY = {…}; の 1 行');
  assert.ok(!/<\/|<!--/.test(body), '</script> や <!-- でページを壊す並びが無い');
  const c = {};
  vm.createContext(c);
  vm.runInContext(body, c);
  const P = plain(c.NB_FILTER_POLICY);
  assert.deepStrictEqual(Object.keys(P).sort(), ['areas', 'conds'], 'areas と conds だけ（重い欄をページに入れない）');
  assert.ok(P.areas.length > 0 && P.conds.length > 0, '空ではない');
  P.areas.forEach((x) => {
    assert.ok(/^[a-z0-9-]+$/.test(x.slug), `エリアの slug はハッシュにそのまま書ける文字: ${x.slug}`);
    assert.ok(typeof x.label === 'string' && x.label && typeof x.ward === 'string', `${x.slug}: label と ward`);
    assert.ok(Array.isArray(x.match) && x.match.length > 0 && x.match.every((m) => typeof m === 'string'), `${x.slug}: match`);
  });
  P.conds.forEach((x) => {
    assert.ok(/^[a-z0-9-]+$/.test(x.slug), `条件の slug はハッシュにそのまま書ける文字: ${x.slug}`);
    assert.ok(typeof x.label === 'string' && x.label && typeof x.rule === 'string' && x.rule, `${x.slug}: label と rule`);
  });
});

// ── 1. ハブとの一致 ────────────────────────────────────────────────────
test('ハブとの一致: エリアの群のどの slug も、全店でハブ（normalizeArea）と同じ店を通す', () => {
  assert.ok(STORES.length > 1000, '店のデータを読めている');
  assert.ok(POLICY.areas.length > 0);
  POLICY.areas.forEach((a) => {
    const got = C.nbFilterStores(F({ areas: [a.slug] }), STORES);
    const want = STORES.filter((s) => HUB.areaSlugsOf(s, POLICY).indexOf(a.slug) !== -1);
    const n = sameSet(got, want, `エリア ${a.slug}`);
    assert.ok(n > 0, `エリア ${a.slug}: 比べる店が 1 軒も無い（検査が空振りしている）`);
  });
  // 群の外の店は、どの群を選んでも出ない（全群を選んでも、ハブが群に入れた店と同じ）
  const all = C.nbFilterStores(F({ areas: AREAS }), STORES);
  sameSet(all, STORES.filter((s) => HUB.areaSlugsOf(s, POLICY).length > 0), '全群を選んだとき');
});

test('ハブとの一致: 条件のどの slug も、全店でハブ（storeMatchesCondition）と同じ店を通す。ポリシーの全 rule にページの述語がある', () => {
  assert.ok(POLICY.conditions.length > 0);
  const defs = C.nbCondDefs().bySlug;
  POLICY.conditions.forEach((c) => {
    assert.ok(defs[c.slug], `ポリシーの条件 ${c.slug} がページの表にある`);
    assert.strictEqual(defs[c.slug].rule, c.rule, `${c.slug}: rule がポリシーと同じ`);
    assert.strictEqual(typeof C.NB_COND_RULES[c.rule], 'function', `rule ${c.rule} の述語がページにある（無いと、選ぶと必ず 0 軒になる）`);
    const got = C.nbFilterStores(F({ conds: [c.slug] }), STORES);
    const want = STORES.filter((s) => HUB.storeMatchesCondition(s, c.rule));
    const n = sameSet(got, want, `条件 ${c.slug}`);
    assert.ok(n > 0, `条件 ${c.slug}: 比べる店が 1 軒も無い（検査が空振りしている）`);
  });
});

// 条件ごとの境目（[店の欄, 通るか]）。ページの判定とハブの判定の両方が、この期待どおりに動く
const ariCases = (field) => [
  ['あり', true], ['あり（要予約）', true], ['  あり', true], ['なし', false], ['', false], ['なしあり', false], [undefined, false], [1, false], [true, false],
].map(([v, ok]) => [v === undefined ? {} : { [field]: v }, ok]);
const EDGE_CASES = {
  koshitsu: ariCases('個室'),
  nomihodai: ariCases('飲み放題'),
  tabehodai: ariCases('食べ放題'),
  parking: ariCases('駐車場'),
  lunch: ariCases('ランチ'),
  // 深夜営業: 翌 1 時〜翌 12 時。翌 0 時台は含めない
  lateNight: [
    [{ '営業時間': '月～日: 17:00～翌0:30' }, false], [{ '営業時間': '17:00～翌1:00' }, true], [{ '営業時間': '17:00～翌 5:00' }, true],
    [{ '営業時間': '18:00～翌12:00' }, true], [{ '営業時間': '18:00～翌13:00' }, false], [{ '営業時間': '18:00～翌1時' }, true],
    [{ '営業時間': '18:00～翌0時' }, false], [{ '営業時間': '18:00～翌1：00' }, true], [{ '営業時間': '18:00～23:00' }, false],
    [{ '営業時間': '翌00:30' }, false], [{ '営業時間': '翌10:00' }, true], [{}, false], [{ '営業時間': 123 }, false],
  ],
  // 日曜営業: 定休日に「日」を含まない。不定休などの自由記述は判定できないので偽
  sunday: [
    [{ '定休日': '' }, false], [{}, false], [{ '定休日': '   ' }, false], [{ '定休日': '不定休' }, false], [{ '定休日': '年中無休' }, true],
    [{ '定休日': 'なし' }, true], [{ '定休日': '無休' }, true], [{ '定休日': '日' }, false], [{ '定休日': '月' }, true], [{ '定休日': '月、火' }, true],
    [{ '定休日': '月,火' }, true], [{ '定休日': '月、日' }, false], [{ '定休日': '月曜日' }, false], [{ '定休日': '祝日' }, false],
    [{ '定休日': '木曜' }, false], [{ '定休日': '現在休業中' }, false], [{ '定休日': 'ご予約の状況により変更' }, false], [{ '定休日': ' 月 ' }, true], [{ '定休日': '火 水' }, true],
  ],
  smokingOk: [
    [{ '禁煙': '禁煙席なし' }, true], [{ '禁煙': '一部禁煙' }, true], [{ '禁煙': '全面禁煙' }, false], [{ '禁煙': '' }, false], [{}, false], [{ '禁煙': '禁煙席あり' }, false],
  ],
  nonSmoking: [
    [{ '禁煙': '全面禁煙' }, true], [{ '禁煙': '一部禁煙' }, false], [{ '禁煙': '禁煙席なし' }, false], [{ '禁煙': '' }, false], [{}, false],
  ],
  // 30 名: 宴会収容の数が 30 以上
  group30: [
    [{ '宴会収容': '30' }, true], [{ '宴会収容': '29' }, false], [{ '宴会収容': '31' }, true], [{ '宴会収容': '30名' }, true], [{ '宴会収容': 'abc' }, false],
    [{ '宴会収容': '' }, false], [{}, false], [{ '宴会収容': 30 }, true], [{ '宴会収容': '０' }, false],
  ],
  // 駅徒歩 3 分以内: アクセスの最初の「徒歩N分」
  walk3: [
    [{ 'アクセス': '名古屋駅から徒歩3分' }, true], [{ 'アクセス': '徒歩4分' }, false], [{ 'アクセス': '徒歩約3分' }, true], [{ 'アクセス': '徒歩 3 分' }, true],
    [{ 'アクセス': '徒歩10分' }, false], [{ 'アクセス': '徒歩1分' }, true], [{ 'アクセス': '徒歩0分' }, true], [{ 'アクセス': 'JR駅徒歩5分、地下鉄駅徒歩2分' }, false],
    [{ 'アクセス': '徒歩３分' }, false], [{}, false], [{ 'アクセス': '駅直結' }, false],
  ],
  budget3000: [
    [{ '価格帯': '～500円' }, true], [{ '価格帯': '501～1000円' }, true], [{ '価格帯': '2001～3000円' }, true], [{ '価格帯': '3001～4000円' }, false],
    [{ '価格帯': '3000円' }, true], [{ '価格帯': '3001円' }, false], [{ '価格帯': '～3000円' }, true], [{ '価格帯': '3000円以下' }, true],
    [{ '価格帯': '' }, false], [{}, false], [{ '価格帯': '価格不明' }, false],
  ],
  budget5000plus: [
    [{ '価格帯': '5001～7000円' }, true], [{ '価格帯': '4001～5000円' }, false], [{ '価格帯': '30001円～' }, true], [{ '価格帯': '5001円' }, true],
    [{ '価格帯': '5000円' }, false], [{ '価格帯': '5001円以上' }, true], [{ '価格帯': '～5000円' }, false], [{ '価格帯': '3001～4000円' }, false],
    [{ '価格帯': '' }, false], [{}, false],
  ],
};

test('ハブとの一致: 合成した境目の店（翌0時・日曜・禁煙・30名・徒歩3分・予算の端）でも、ページとハブが同じ答えで、期待どおり', () => {
  let exercised = 0;
  Object.keys(EDGE_CASES).forEach((rule) => {
    const slug = RULE_SLUG[rule];
    if (!slug) return;   // ポリシーから外れた rule は見ない
    exercised++;
    EDGE_CASES[rule].forEach(([fields, ok]) => {
      const s = S(fields);
      const label = `${rule} ${JSON.stringify(fields)}`;
      assert.strictEqual(HUB.storeMatchesCondition(s, rule), ok, `ハブ: ${label}`);
      assert.strictEqual(C.nbFilterStores(F({ conds: [slug] }), [s]).length === 1, ok, `ページ: ${label}`);
    });
  });
  assert.ok(exercised >= 10, `境目の表を使えた rule が少ない: ${exercised}`);
});

test('ハブとの一致: 判定が例外になる店（欄が文字列でない）は、落ちずに「通さない」', () => {
  const odd = S({ '定休日': 5, '営業時間': { x: 1 }, 'アクセス': 7, '価格帯': 3000, '禁煙': 1, '宴会収容': null });
  POLICY.conditions.forEach((c) => {
    assert.doesNotThrow(() => C.nbFilterStores(F({ conds: [c.slug] }), [odd]), c.slug);
    assert.strictEqual(C.nbFilterStores(F({ conds: [c.slug] }), [odd]).length, 0, `${c.slug}: 読めない欄は通さない`);
  });
  assert.strictEqual(C.nbCondFn('koshitsu')(null), false, '店が null でも例外にしない');
  assert.strictEqual(C.nbCondFn('存在しない条件')(S({ '個室': 'あり' })), false, '知らない条件は必ず偽');
});

// ── 2. 予算 3 区分 ─────────────────────────────────────────────────────
const BUDGETS = ['budget-3000', 'budget-3001-5000', 'budget-5000-plus'];

test('予算3区分: 価格のある店はちょうど 1 つの区分に入り（重ならず・漏れず）、価格の無い店はどこにも入らない', () => {
  const sets = BUDGETS.map((b) => new Set(C.nbFilterStores(F({ conds: [b] }), STORES)));
  let withBand = 0;
  let without = 0;
  STORES.forEach((s) => {
    const n = sets.filter((x) => x.has(s)).length;
    if (HUB.parsePriceBand(s['価格帯'])) {
      withBand++;
      assert.strictEqual(n, 1, `価格「${s['価格帯']}」の店「${nm(s)}」が ${n} 区分に入る`);
    } else {
      without++;
      assert.strictEqual(n, 0, `価格の無い店「${nm(s)}」（${s['価格帯']}）が区分に入る`);
    }
  });
  assert.ok(withBand > 1000 && without > 0, `価格あり ${withBand}・なし ${without}（両方を見ている）`);
});

test('予算3区分: HotPepper の 13 の価格帯が、3,000円以下／3,001〜5,000円／5,001円以上のどれか 1 つに入る。端の値も', () => {
  const bands = [
    ['～500円', 0], ['501～1000円', 0], ['1001～1500円', 0], ['1501～2000円', 0], ['2001～3000円', 0],
    ['3001～4000円', 1], ['4001～5000円', 1],
    ['5001～7000円', 2], ['7001～10000円', 2], ['10001～15000円', 2], ['15001～20000円', 2], ['20001～30000円', 2], ['30001円～', 2],
    ['3000円', 0], ['3001円', 1], ['5000円', 1], ['5001円', 2],
  ];
  bands.forEach(([price, want]) => {
    const s = S({ '価格帯': price });
    const got = BUDGETS.map((b) => C.nbFilterStores(F({ conds: [b] }), [s]).length);
    assert.deepStrictEqual(got, [0, 1, 2].map((i) => (i === want ? 1 : 0)), `価格帯「${price}」は ${BUDGETS[want]} だけ`);
  });
  // 価格の無い・読めない店
  ['', '価格不明', undefined].forEach((price) => {
    const s = S(price === undefined ? {} : { '価格帯': price });
    BUDGETS.forEach((b) => assert.strictEqual(C.nbFilterStores(F({ conds: [b] }), [s]).length, 0, `価格「${price}」は ${b} に入らない`));
  });
  // シートだけの区分 budget-3001-5000 の端（片側が開いた表記は入れない）
  [['3001～5000円', true], ['3001円～', false], ['～5000円', false], ['2001～3000円', false], ['5001～7000円', false]].forEach(([price, ok]) => {
    assert.strictEqual(C.nbFilterStores(F({ conds: ['budget-3001-5000'] }), [S({ '価格帯': price })]).length === 1, ok, `budget-3001-5000 ${price}`);
  });
});

test('排他: 同時に選ぶと必ず 0 軒になる組は、全店で重ならない・片方を押すと後から押した方だけが残る・別の組とは両立する', () => {
  const groups = plain(C.NB_COND_EXCLUSIVE);
  assert.ok(groups.length >= 2, '排他の組が 2 つ以上ある（予算 3 区分・喫煙）');
  assert.ok(groups.some((g) => BUDGETS.every((b) => g.includes(b))), '予算 3 区分が 1 つの組');
  assert.ok(groups.some((g) => g.includes('smoking-ok') && g.includes('non-smoking')), '喫煙できる店と全席禁煙が 1 つの組');
  groups.forEach((g) => {
    const sets = g.map((slug) => new Set(C.nbFilterStores(F({ conds: [slug] }), STORES)));
    STORES.forEach((s) => {
      const n = sets.filter((x) => x.has(s)).length;
      assert.ok(n <= 1, `排他の組 ${g.join('/')} の ${n} つに入る店: ${nm(s)}`);
    });
    // 組の中の 2 つは、押す順に関係なく後から押した方だけが残る
    g.forEach((a) => g.forEach((b) => {
      if (a === b) return;
      const f = C.nbToggleFilter(C.nbToggleFilter(F(), 'cond', a), 'cond', b);
      assert.deepStrictEqual(plain(f.conds), [b], `${a} のあとに ${b} を押すと ${b} だけ`);
    }));
  });
  // 別の組・組に無い条件は両立する
  let f = F();
  ['budget-3000', 'koshitsu', 'non-smoking', 'lunch'].forEach((c) => { f = C.nbToggleFilter(f, 'cond', c); });
  assert.deepStrictEqual(plain(f.conds).sort(), ['budget-3000', 'koshitsu', 'lunch', 'non-smoking'].sort());
  // 組の 2 つを押した状態でも、押したものを押し直せば外れるだけで、ほかの条件は変わらない
  f = C.nbToggleFilter(f, 'cond', 'budget-5000-plus');
  assert.ok(!f.conds.includes('budget-3000') && f.conds.includes('budget-5000-plus') && f.conds.includes('koshitsu'));
  f = C.nbToggleFilter(f, 'cond', 'budget-5000-plus');
  assert.ok(!f.conds.includes('budget-5000-plus') && !f.conds.includes('budget-3000') && f.conds.includes('koshitsu'), '外すだけ（前に押していた予算は戻らない）');
  // ハッシュは読んだとおりに保つ（排他にしない）。その状態は 0 軒になる
  const h = C.nbFilterFromParams(C.nbParseHash('#cond=budget-3000,budget-5000-plus'));
  assert.deepStrictEqual(plain(h.conds), ['budget-3000', 'budget-5000-plus']);
  assert.strictEqual(C.nbFilterStores(h, STORES).length, 0);
  assert.deepStrictEqual(plain(C.nbToggleFilter(h, 'cond', 'budget-5000-plus').conds), ['budget-3000'], '外すときは、組のもう片方を巻き込んで外さない');
  assert.deepStrictEqual(plain(C.nbToggleFilter(h, 'cond', 'budget-3000').conds), ['budget-5000-plus']);
  assert.deepStrictEqual(plain(C.nbToggleFilter(h, 'cond', 'budget-3001-5000').conds), ['budget-3001-5000'], '組の 3 つめを押すと、押した方だけが残る');
});

// ── 3. 人数（cap）の和集合 ─────────────────────────────────────────────
test('人数: 宴会収容・タグ「NN〜MM名」の上限・「NN名以上」の和集合。10/20/30/50 の境目（ちょうど・直下・直上）', () => {
  // [店の欄, N, 通るか]
  const cases = [
    // 宴会収容
    [{ '宴会収容': '30' }, 30, true], [{ '宴会収容': '29' }, 30, false], [{ '宴会収容': '31' }, 30, true],
    [{ '宴会収容': '10' }, 10, true], [{ '宴会収容': '9' }, 10, false], [{ '宴会収容': '20' }, 20, true], [{ '宴会収容': '19' }, 20, false],
    [{ '宴会収容': '50' }, 50, true], [{ '宴会収容': '49' }, 50, false], [{ '宴会収容': '100' }, 50, true], [{ '宴会収容': '30名' }, 30, true],
    // タグ「NN〜MM名」: 上限が N 以上（下限ではない）。全角の波ダッシュ・チルダのどちらも
    [{ 'タグ': '20〜30名' }, 30, true], [{ 'タグ': '20〜30名' }, 31, false], [{ 'タグ': '20〜30名' }, 20, true], [{ 'タグ': '20〜30名' }, 10, true], [{ 'タグ': '20〜30名' }, 50, false],
    [{ 'タグ': '20～30名' }, 30, true], [{ 'タグ': '20～30名' }, 31, false], [{ 'タグ': '10〜20名' }, 20, true], [{ 'タグ': '10〜20名' }, 21, false],
    [{ 'タグ': '5〜9名' }, 10, false], [{ 'タグ': '5〜10名' }, 10, true], [{ 'タグ': '40〜50名' }, 50, true], [{ 'タグ': '30〜40名' }, 50, false],
    // タグ「NN名以上」: NN が N 以上
    [{ 'タグ': '30名以上' }, 30, true], [{ 'タグ': '30名以上' }, 31, false], [{ 'タグ': '30名以上' }, 10, true], [{ 'タグ': '100名以上' }, 50, true], [{ 'タグ': '30名以上' }, 50, false],
    // タグの区切り（, 、 ， /）と前後の空白
    [{ 'タグ': 'デート,20〜30名,個室' }, 30, true], [{ 'タグ': 'デート、20〜30名' }, 30, true], [{ 'タグ': 'デート，20〜30名' }, 30, true],
    [{ 'タグ': 'デート/20〜30名' }, 30, true], [{ 'タグ': 'デート, 20〜30名' }, 30, true],
    // 和集合: どれか 1 つの根拠があれば通る
    [{ '宴会収容': '5', 'タグ': '20〜30名' }, 30, true], [{ '宴会収容': '60', 'タグ': 'デート' }, 50, true],
    [{ '宴会収容': '5', 'タグ': '30名以上' }, 30, true], [{ '宴会収容': '5', 'タグ': '5〜10名' }, 30, false],
    // 人数が分からない店は入らない
    [{}, 10, false], [{ '宴会収容': '' }, 10, false], [{ '宴会収容': 'abc' }, 10, false], [{ 'タグ': '' }, 10, false], [{ 'タグ': '個室,デート' }, 10, false],
    [{ 'タグ': '20〜30' }, 10, false],
  ];
  cases.forEach(([fields, n, ok]) => {
    const s = S(fields);
    assert.strictEqual(C.nbCapOk(s, n), ok, `nbCapOk ${JSON.stringify(fields)} N=${n}`);
    assert.strictEqual(C.nbFilterStores(F({ cap: n }), [s]).length === 1, ok, `nbFilterStores cap=${n} ${JSON.stringify(fields)}`);
  });
  // 人数を指定しない（0 以下）ときは、人数が分からない店も含めて絞らない
  [0, -1].forEach((n) => assert.strictEqual(C.nbCapOk(S({}), n), true, `N=${n} は絞らない`));
  assert.strictEqual(C.nbFilterStores(F({ cap: 0 }), [S({}), S({ '宴会収容': '5' })]).length, 2);
});

test('人数: ボタンの候補（NB_CAP_CHOICES）は小さい順の正の整数で、正規化で丸められない値だけ', () => {
  const choices = plain(C.NB_CAP_CHOICES);
  assert.ok(choices.length >= 2, '候補が 2 つ以上ある');
  choices.forEach((n, i) => {
    assert.ok(Number.isInteger(n) && n > 0 && n <= 999, `候補は 1〜999 の整数: ${n}`);
    if (i > 0) assert.ok(n > choices[i - 1], '小さい順で、重ならない');
    assert.strictEqual(C.nbNormalizeFilter({ cap: n }).cap, n, `候補 ${n} は正規化で変わらない`);
    assert.ok(C.nbFilterStores(F({ cap: n }), STORES).length > 0, `候補 ${n} で絞ると 1 軒以上ある（押すと必ず 0 軒になる候補を置かない）`);
  });
});

test('人数: 全店で、人数の候補は入れ子（50 ⊆ 30 ⊆ 20 ⊆ 10）で、「30名以上の宴会可」の店は 30 名の条件にも入る', () => {
  const caps = [10, 20, 30, 50].map((n) => new Set(C.nbFilterStores(F({ cap: n }), STORES)));
  for (let i = 1; i < caps.length; i++) {
    caps[i].forEach((s) => assert.ok(caps[i - 1].has(s), `より大きい人数に入る店が、小さい人数に入っていない: ${nm(s)}`));
    assert.ok(caps[i].size < caps[i - 1].size, '人数が増えると候補が減る（検査が空振りしていない）');
  }
  const g30 = C.nbFilterStores(F({ conds: [RULE_SLUG.group30] }), STORES);
  g30.forEach((s) => assert.ok(caps[2].has(s), `group-30 の店が cap=30 に入っていない: ${nm(s)}`));
});

// ── 4. 正規化とハッシュの往復 ──────────────────────────────────────────
test('正規化: 知らない値を捨て・重複を除き・決まった順に並べる（ハッシュが安定する）', () => {
  const policyConds = POLICY.conditions.map((c) => c.slug).concat(plain(C.NB_COND_EXTRA).map((c) => c.slug));
  const tags = plain(C.NB_TAG_ORDER);
  const rev = (a) => a.slice().reverse();
  const f = plain(C.nbNormalizeFilter({
    genre: 'ZZZ',
    areas: ['存在しない'].concat(rev(AREAS), rev(AREAS)),
    conds: ['nope', '__proto__', 'constructor'].concat(rev(policyConds), policyConds),
    tags: ['存在しないタグ', '__proto__'].concat(rev(tags), tags),
    cap: '0030',
  }));
  assert.strictEqual(f.genre, 'All', '知らないジャンルは「すべて」');
  assert.deepStrictEqual(f.areas, AREAS, 'エリアはポリシーの並び');
  assert.deepStrictEqual(f.conds, policyConds, '条件はポリシーの並び＋シートだけの条件');
  assert.deepStrictEqual(f.tags, tags, 'タグは決まった並び（NB_TAG_ORDER）');
  assert.strictEqual(f.cap, 30);
  // ジャンルは代表ジャンル 18 のどれかだけ
  plain(C.GENRE_ORDER).forEach((g) => assert.strictEqual(C.nbNormalizeFilter({ genre: g }).genre, g, g));
  ['All', '', null, undefined, '焼肉', 'constructor'].forEach((g) => assert.strictEqual(C.nbNormalizeFilter({ genre: g }).genre, 'All', `ジャンル ${g} は代表ジャンルではない`));
  // 入力の並び・重複が違っても、同じ条件は同じ形になる（ハッシュが変わらない）
  const a = C.nbNormalizeFilter({ areas: [AREAS[3], AREAS[0]], conds: ['lunch', 'koshitsu'], tags: ['女子会', 'デート'] });
  const b = C.nbNormalizeFilter({ areas: [AREAS[0], AREAS[3], AREAS[0]], conds: ['koshitsu', 'lunch', 'lunch'], tags: ['デート', '女子会', 'デート'] });
  assert.deepStrictEqual(plain(a), plain(b));
  assert.strictEqual(C.nbFilterParams(a).join('&'), C.nbFilterParams(b).join('&'));
  // 何度通しても同じ・入力を書き換えない・入力と配列を共有しない
  const input = deepFreeze({ genre: '寿司', areas: [AREAS[1]], conds: ['lunch'], tags: ['デート'], cap: 20 });
  const once = C.nbNormalizeFilter(input);
  assert.deepStrictEqual(plain(C.nbNormalizeFilter(once)), plain(once), '冪等');
  assert.notStrictEqual(once.areas, input.areas);
  assert.deepStrictEqual(plain(once), { genre: '寿司', areas: [AREAS[1]], conds: ['lunch'], tags: ['デート'], cap: 20 });
  // 空の入力
  [undefined, null, {}].forEach((x) => assert.deepStrictEqual(plain(C.nbNormalizeFilter(x)), plain(C.nbEmptyFilter())));
});

test('正規化: cap は 1〜999 の整数だけ（読めない・0 以下は 0。大きすぎる値は 999 にそろえる）', () => {
  const cases = [
    ['30', 30], [30, 30], ['0', 0], [0, 0], [-1, 0], ['-5', 0], ['abc', 0], [NaN, 0], [undefined, 0], [null, 0], [1, 1], ['1', 1],
    [998, 998], [999, 999], [1000, 999], ['99999', 999], [2.9, 2], ['30abc', 30], ['', 0], [' 30', 30],
  ];
  cases.forEach(([v, want]) => assert.strictEqual(C.nbNormalizeFilter({ cap: v }).cap, want, `cap=${JSON.stringify(v)}`));
});

test('ハッシュの往復: nbFilterFromParams(nbParseHash(nbFilterParams(f))) が f に戻る。並びは genre・area・cond・tag・cap', () => {
  const GENRES = plain(C.GENRE_ORDER);
  const CONDS = C.nbCondDefs().list.map((c) => c.slug);
  const TAGS = plain(C.NB_TAG_ORDER);
  const roundTrip = (f) => {
    const p = C.nbFilterParams(f);
    const back = C.nbFilterFromParams(C.nbParseHash(p.length ? '#' + p.join('&') : '#'));
    assert.deepStrictEqual(plain(back), plain(f), `往復で変わる: ${p.join('&')}`);
  };
  // 1 つずつ
  roundTrip(F());
  GENRES.forEach((g) => roundTrip(F({ genre: g })));
  AREAS.forEach((a) => roundTrip(F({ areas: [a] })));
  CONDS.forEach((c) => roundTrip(F({ conds: [c] })));
  TAGS.forEach((t) => roundTrip(F({ tags: [t] })));
  [1, 10, 20, 30, 35, 50, 999].forEach((n) => roundTrip(F({ cap: n })));
  roundTrip(F({ areas: AREAS, conds: CONDS, tags: TAGS, genre: GENRES[0], cap: 50 }));
  // 疑似乱数の組み合わせ（毎回同じ）
  const rnd = lcg(20261014);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const subset = (arr, p) => arr.filter(() => rnd() < p);
  let rich = 0;
  for (let i = 0; i < 300; i++) {
    const f = C.nbNormalizeFilter({
      genre: rnd() < 0.5 ? 'All' : pick(GENRES), areas: subset(AREAS, 0.3), conds: subset(CONDS, 0.25), tags: subset(TAGS, 0.2),
      cap: rnd() < 0.5 ? 0 : pick([1, 10, 20, 30, 35, 50, 999]),
    });
    if (C.nbFilterCount(f) >= 3) rich++;
    roundTrip(f);
  }
  assert.ok(rich > 100, `条件が 3 つ以上の組み合わせを十分に試している: ${rich}`);

  // 形と並び
  const full = F({ genre: '居酒屋', areas: [AREAS[0], AREAS[3]], conds: ['koshitsu', 'lunch'], tags: ['デート', '誕生日・記念日'], cap: 30 });
  assert.deepStrictEqual(plain(C.nbFilterParams(full)), [
    'genre=' + encodeURIComponent('居酒屋'),
    'area=' + AREAS[0] + ',' + AREAS[3],
    'cond=koshitsu,lunch',
    'tag=' + encodeURIComponent('デート') + ',' + encodeURIComponent('誕生日・記念日'),
    'cap=30',
  ]);
  assert.deepStrictEqual(plain(C.nbFilterParams(F())), [], '条件が無ければ何も書かない');
  assert.deepStrictEqual(plain(C.nbFilterParams(F({ genre: 'All' }))), [], 'ジャンルが「すべて」なら書かない');
  assert.deepStrictEqual(plain(C.nbFilterParams(F({ cap: 0 }))), [], '人数が 0 なら書かない');
  C.nbCondDefs().list.concat(POLICY.areas).forEach((d) => assert.ok(/^[a-z0-9-]+$/.test(d.slug), `slug はそのまま書ける文字: ${d.slug}`));
  // ハッシュの値に & # = を生で書かない（ジャンル・タグは符号化される）
  const hash = C.nbFilterParams(F({ tags: ['誕生日・記念日', '3001〜5000円'], genre: 'お好み焼き・もんじゃ' })).join('&');
  assert.ok(!/[・〜]/.test(hash), `日本語は符号化される: ${hash}`);
});

// ── 5. 旧ハッシュの互換 ────────────────────────────────────────────────
test('旧ハッシュの互換: ward（区）はその区に属するエリアの群すべてに広げる。ポリシーの ward と一致する slug すべて', () => {
  const wardSlugs = (w) => POLICY.areas.filter((a) => a.ward === w).map((a) => a.slug);
  // 古い共有リンクが作れた 3 つの区は、いまも空にならない（ポリシーの ward から外すと古いリンクが全店表示になる）
  ['中区', '中村区', '熱田区'].forEach((w) => assert.ok(wardSlugs(w).length >= 1, `ward=${w} に属するエリアの群がポリシーにある`));
  const rows = [
    ['#ward=中区', wardSlugs('中区')], ['#ward=中村区', wardSlugs('中村区')], ['#ward=熱田区', wardSlugs('熱田区')],
    ['#ward=千種区', wardSlugs('千種区')], ['#ward=中川区', wardSlugs('中川区')],
    ['#ward=' + encodeURIComponent('中区'), wardSlugs('中区')],
    ['#ward=存在しない区', []], ['#ward=', []], ['#ward=all', []],
    // area と合わせたら和集合（ポリシーの並び）
    ['#ward=中区&area=' + AREAS[AREAS.length - 1], AREAS.filter((s) => wardSlugs('中区').includes(s) || s === AREAS[AREAS.length - 1])],
    ['#area=' + AREAS[0] + '&ward=存在しない区', [AREAS[0]]],
  ];
  rows.forEach(([hash, want]) => {
    const f = C.nbFilterFromParams(C.nbParseHash(hash));
    assert.deepStrictEqual(plain(f.areas), want, hash);
    assert.deepStrictEqual(plain(Object.assign({}, f, { areas: [] })), plain(C.nbEmptyFilter()), `${hash}: エリア以外は空`);
  });
  // 展開はポリシーの表に従う（実物の区の名前を書き込んでいない）
  const P2 = { areas: [
    { slug: 'a1', label: 'A1', ward: 'W1', match: ['x1'] }, { slug: 'a2', label: 'A2', ward: 'W1', match: ['x2'] },
    { slug: 'a3', label: 'A3', ward: '', match: ['x3'] }, { slug: 'a4', label: 'A4', ward: 'W2', match: ['x4'] },
  ], conds: [] };
  const c2 = load({ policy: P2 });
  const f2 = (h) => plain(c2.nbFilterFromParams(c2.nbParseHash(h)).areas);
  assert.deepStrictEqual(f2('#ward=W1'), ['a1', 'a2']);
  assert.deepStrictEqual(f2('#ward=W2&area=a3'), ['a3', 'a4']);
  assert.deepStrictEqual(f2('#ward='), [], 'ward が空なら、ward の無い群（a3）に当たらない');
  assert.deepStrictEqual(f2('#ward=W3'), []);
});

test('旧ハッシュの互換: pref は読んで捨てる・tag（個室・予算・知らない値）・genre・cap の扱い', () => {
  const E = plain(C.nbEmptyFilter());
  const parse = (h) => plain(C.nbFilterFromParams(C.nbParseHash(h)));
  const withF = (o) => Object.assign({}, E, o);
  // pref: 読んで捨てる（掲載の店はすべて愛知県）
  ['#pref=愛知県', '#pref=東京都', '#pref=', '#pref=' + encodeURIComponent('愛知県')].forEach((h) => assert.deepStrictEqual(parse(h), E, h));
  // tag: シートにボタンの無い古いタグ（個室・予算）は、いままでどおり読む。知らないタグは捨てる
  assert.deepStrictEqual(parse('#tag=個室'), withF({ tags: ['個室'] }));
  assert.deepStrictEqual(parse('#tag=' + encodeURIComponent('個室')), withF({ tags: ['個室'] }));
  assert.deepStrictEqual(parse('#tag=3001〜5000円'), withF({ tags: ['3001〜5000円'] }));
  assert.deepStrictEqual(parse('#tag=' + encodeURIComponent('〜1000円') + ',' + encodeURIComponent('10001円以上')), withF({ tags: ['〜1000円', '10001円以上'] }));
  assert.deepStrictEqual(parse('#tag=個室,飲み放題'), withF({ tags: ['個室'] }), 'ボタンの無い「飲み放題」は捨てる');
  assert.deepStrictEqual(parse('#tag=' + encodeURIComponent(encodeURIComponent('個室'))), withF({ tags: ['個室'] }), '二重に符号化されたタグ（貼り付けで再符号化されたリンク）も読む');
  assert.deepStrictEqual(parse('#tag=30名以上'), E, '人数のタグは、条件の人数（cap）で表す。tag としては捨てる');
  assert.deepStrictEqual(parse('#tag=半個室,個室,個室'), withF({ tags: ['個室', '半個室'].sort((a, b) => plain(C.NB_TAG_ORDER).indexOf(a) - plain(C.NB_TAG_ORDER).indexOf(b)) }), '重複は 1 つ・決まった並び');
  assert.deepStrictEqual(parse('#tag=%E0%A4%A'), E, '壊れた % の値は捨てる（例外にしない）');
  assert.deepStrictEqual(parse('#tag='), E);
  // 旧タグで使っていた全部の名前が読める
  plain(C.NB_TAG_ORDER).forEach((t) => assert.deepStrictEqual(parse('#tag=' + encodeURIComponent(t)), withF({ tags: [t] }), t));
  // genre: 代表ジャンルへ解決（古い #genre=焼肉 も）。「すべて」・空は条件なし
  assert.deepStrictEqual(parse('#genre=居酒屋'), withF({ genre: '居酒屋' }));
  assert.deepStrictEqual(parse('#genre=' + encodeURIComponent('居酒屋')), withF({ genre: '居酒屋' }));
  assert.deepStrictEqual(parse('#genre=焼肉'), withF({ genre: '焼肉・ホルモン' }));
  assert.deepStrictEqual(parse('#genre=All'), E);
  assert.deepStrictEqual(parse('#genre='), E);
  assert.deepStrictEqual(parse('#genre=ZZZ'), withF({ genre: 'その他グルメ' }), '知らない値は normalizeGenre の既定（旧 readHash と同じ）');
  // cap: 1〜999 の整数だけ。専用のボタンが無い値（35）も、押された状態として残る
  assert.deepStrictEqual(parse('#cap=abc'), E);
  assert.deepStrictEqual(parse('#cap=-5'), E);
  assert.deepStrictEqual(parse('#cap=0'), E);
  assert.deepStrictEqual(parse('#cap=99999'), withF({ cap: 999 }));
  assert.deepStrictEqual(parse('#cap=35'), withF({ cap: 35 }));
  assert.deepStrictEqual(parse('#cap=30'), withF({ cap: 30 }));
  assert.deepStrictEqual(parse('#cap=' + encodeURIComponent('30')), withF({ cap: 30 }));
});

test('旧ハッシュの互換: 古いリンクの全部入り・area/cond の読み方・ほかの値（q・store）や壊れた値で止まらない', () => {
  const parse = (h) => plain(C.nbFilterFromParams(C.nbParseHash(h)));
  const wardChu = POLICY.areas.filter((a) => a.ward === '中区').map((a) => a.slug);
  assert.deepStrictEqual(parse('#genre=居酒屋&tag=個室&ward=中区&pref=愛知県&cap=30&q=' + encodeURIComponent('忘年会') + '&store=ABC'),
    { genre: '居酒屋', areas: wardChu, conds: [], tags: ['個室'], cap: 30 }, 'q と store は条件に入らない');
  // area / cond: 空白を除き、知らない値・空の要素を捨てる。大文字小文字は区別する
  assert.deepStrictEqual(parse('#area=' + AREAS[3]).areas, [AREAS[3]]);
  assert.deepStrictEqual(parse('#area=' + AREAS[3] + ',' + AREAS[0]).areas, [AREAS[0], AREAS[3]], '決まった並び');
  assert.deepStrictEqual(parse('#area=' + AREAS[3] + ',' + AREAS[3]).areas, [AREAS[3]]);
  assert.deepStrictEqual(parse('#area=%20' + AREAS[3] + '%20').areas, [AREAS[3]], '前後の空白は除く');
  assert.deepStrictEqual(parse('#area=' + AREAS[3] + ',,nope').areas, [AREAS[3]]);
  assert.deepStrictEqual(parse('#area=' + AREAS[3].toUpperCase()).areas, []);
  assert.deepStrictEqual(parse('#cond=koshitsu').conds, ['koshitsu']);
  assert.deepStrictEqual(parse('#cond=%20koshitsu%20,lunch').conds, ['koshitsu', 'lunch'], 'cond= の値の前後の空白は除く');
  assert.deepStrictEqual(parse('#cond=nope,__proto__,constructor').conds, []);
  assert.deepStrictEqual(parse('#__proto__=x&area=' + AREAS[3]).areas, [AREAS[3]], '__proto__ という名前の値に邪魔されない');
  ['', '#', '#area', '#=x', '#area=&cond=&tag=&cap=&genre=&ward=&pref='].forEach((h) => assert.deepStrictEqual(parse(h), plain(C.nbEmptyFilter()), `「${h}」は条件なし`));
  assert.deepStrictEqual(parse('#genre=%E0%A4%A&area=' + AREAS[3]).areas, [AREAS[3]], 'ジャンルの値が壊れていても、ほかの条件は読める');
});

// ── 6. 件数の一致 ──────────────────────────────────────────────────────
test('件数: nbCountStores（「N軒を見る」）は、nbFilterStores → nbRunSearch で作った一覧の件数と、いつも同じ', () => {
  const FAV = STORES.filter((_, i) => i % 97 === 0).map((s) => s['店名']);
  const cases = [
    ['条件なし・検索語なし', F(), '', null],
    ['エリア 1 つ', F({ areas: [AREAS[0]] }), '', null],
    ['エリア 2 つ（OR）', F({ areas: [AREAS[0], AREAS[3]] }), '', null],
    ['ジャンル＋条件', F({ genre: '焼肉・ホルモン', conds: ['koshitsu'] }), '', null],
    ['条件 3 つ', F({ conds: ['koshitsu', 'nomihodai', 'lunch'] }), '', null],
    ['タグ', F({ tags: ['女子会'] }), '', null],
    ['人数', F({ cap: 30 }), '', null],
    ['検索語つき（シーン語）', F({ areas: [AREAS[3]] }), '個室', null],
    ['検索語つき（ジャンル語・エリア語）', F({ genre: '焼肉・ホルモン' }), '焼肉 名駅', null],
    ['保存済みだけ', F(), '', FAV],
    ['保存済み＋条件＋検索語', F({ conds: ['lunch'] }), '個室', FAV],
    ['検索語が解釈できない', F({ areas: [AREAS[0]] }), '!!!', null],
    ['保存済みが空', F(), '', []],
    ['0 軒になる条件', F({ conds: ['smoking-ok', 'non-smoking'] }), '', null],
  ];
  let engineCut = 0;
  cases.forEach(([label, f, q, fav]) => {
    const list = fresh(STORES);
    const counted = C.nbCountStores(f, list, q, fav);
    const viaSearchCount = C.nbSearchCount(C.nbFilterStores(f, fresh(STORES), fav), q);
    const filtered = C.nbFilterStores(f, fresh(STORES), fav);
    const built = C.nbRunSearch(filtered, q);       // applyFilters が一覧を作る手順
    assert.strictEqual(counted, built.length, `${label}: nbCountStores と一覧の件数`);
    assert.strictEqual(viaSearchCount, built.length, `${label}: nbSearchCount と一覧の件数`);
    assert.strictEqual(C.nbCountStores(f, list, q, fav), counted, `${label}: 2 回数えても同じ（数えたあとに店の状態が残らない）`);
    if (built.length < C.nbFilterStores(f, STORES, fav).length) engineCut++;
  });
  assert.ok(engineCut >= 2, `検索語が一覧を絞る場合を試している（検索語の分を数えている）: ${engineCut}`);
  assert.strictEqual(C.nbCountStores(F(), fresh(STORES), '', null), STORES.length, '条件も検索語も無ければ全店');
  assert.strictEqual(C.nbCountStores(F(), fresh(STORES), '', []), 0, '保存済みが空なら 0 軒');
});

// ── 7. nbSearchCount は店の状態を壊さない ──────────────────────────────
test('nbSearchCount: 数える前に付いていた __score・__why・__hitCount は同じ値で戻り、無かったものは付いたままにならない。NB_SEARCH_META も戻る', () => {
  const KEYS = ['__score', '__why', '__hitCount'];
  const c = load({ engine: FAKE_MUTATE });
  const why = ['元の理由'];
  const list = [
    S({ __score: 7, __why: why, __hitCount: 3 }), S({ __score: 5 }), S({}), S({ __why: undefined }), S({ __hitCount: 0 }), S({}), S({ __score: 1 }), S({}),
  ];
  const before = list.map((s) => KEYS.map((k) => (has(s, k) ? [true, s[k]] : [false])));
  const meta = { sentinel: true };
  c.NB_SEARCH_META = meta;
  const n = c.nbSearchCount(list, '検索語');
  assert.strictEqual(n, 4, '偽のエンジンが返した件数（半分）');
  assert.deepStrictEqual(plain(c.FAKE_CALLS), ['検索語'], '検索語つきで 1 回だけ呼ぶ');
  list.forEach((s, i) => KEYS.forEach((k, j) => {
    assert.strictEqual(has(s, k), before[i][j][0], `店 ${i} の ${k} の有無が元と同じ`);
    if (before[i][j][0]) assert.strictEqual(s[k], before[i][j][1], `店 ${i} の ${k} の値が元と同じ`);
  }));
  assert.strictEqual(list[0].__why, why, '配列の値は同じ参照のまま戻る');
  assert.strictEqual(c.NB_SEARCH_META, meta, 'NB_SEARCH_META が元の値（同じ参照）に戻る');
  c.NB_SEARCH_META = null;
  c.nbSearchCount(list, '検索語');
  assert.strictEqual(c.NB_SEARCH_META, null, '元が null なら null に戻る');
});

test('nbSearchCount: 検索語が無ければ何もせず店の数を返す。エンジンが例外を投げても店の状態と META は戻り、例外はそのまま出る', () => {
  const KEYS = ['__score', '__why', '__hitCount'];
  const c = load({ engine: FAKE_MUTATE });
  const list = [S({ __score: 7 }), S({}), S({ __why: ['a'] }), S({})];
  [undefined, null, ''].forEach((q) => {
    assert.strictEqual(c.nbSearchCount(list, q), 4, `検索語 ${JSON.stringify(q)} は店の数`);
  });
  assert.deepStrictEqual(plain(c.FAKE_CALLS), [], '検索語が無ければエンジンを呼ばない');
  assert.ok(!has(list[1], '__score') && list[0].__score === 7, '店に触っていない');
  // 例外
  const before = list.map((s) => KEYS.map((k) => (has(s, k) ? [true, s[k]] : [false])));
  const meta = { sentinel: 1 };
  c.NB_SEARCH_META = meta;
  c.FAKE_MODE = 'throw';
  assert.throws(() => c.nbSearchCount(list, 'x'), /boom/, '例外は握りつぶさない');
  list.forEach((s, i) => KEYS.forEach((k, j) => {
    assert.strictEqual(has(s, k), before[i][j][0], `例外のあとも 店 ${i} の ${k} の有無が元と同じ`);
    if (before[i][j][0]) assert.deepStrictEqual(plain(s[k]), plain(before[i][j][1]));
  }));
  assert.strictEqual(c.NB_SEARCH_META, meta, '例外のあとも META が戻る');
});

test('nbSearchCount: 本物の検索エンジンでも、数えたあとに店の __score・__why・__hitCount と META が元どおり', () => {
  const list = fresh(STORES);
  // 検索が書き込む店（個室で当たる店）のいくつかに、先に印を付けておく
  const probe = C.nbRunSearch(fresh(STORES), '個室');
  const hitNames = new Set(probe.map(nm));
  const marked = list.filter((s) => hitNames.has(nm(s))).slice(0, 5);
  assert.ok(marked.length >= 3, '検索に当たる店が見つかった');
  marked.forEach((s, i) => { s.__score = 100 + i; s.__why = ['印' + i]; });
  marked[0].__hitCount = 9;
  const before = list.map((s) => [has(s, '__score') && s.__score, has(s, '__why') && s.__why, has(s, '__hitCount') && s.__hitCount]);
  C.NB_SEARCH_META = null;
  const n = C.nbSearchCount(list, '個室');
  assert.strictEqual(n, probe.length, '本物のエンジンの件数');
  assert.strictEqual(C.NB_SEARCH_META, null, 'META が元に戻る');
  list.forEach((s, i) => {
    assert.deepStrictEqual([has(s, '__score') && s.__score, has(s, '__why') && s.__why, has(s, '__hitCount') && s.__hitCount], before[i], `店 ${nm(s)}`);
  });
  assert.strictEqual(list.filter((s) => has(s, '__score')).length, marked.length, '印を付けた店以外には付いていない');
});

// ── 8. 0 軒の提案 ──────────────────────────────────────────────────────
// 条件を 1 つ外した結果を、nbDropFilter を使わずに総当たりで数える（本物の検索エンジンで）
function bruteDrops(c, f, list, q, fav, withQuery) {
  const cands = [];
  if (f.genre !== 'All') cands.push(['genre', f.genre, Object.assign({}, f, { genre: 'All' })]);
  f.areas.forEach((a) => cands.push(['area', a, Object.assign({}, f, { areas: f.areas.filter((x) => x !== a) })]));
  f.conds.forEach((x) => cands.push(['cond', x, Object.assign({}, f, { conds: f.conds.filter((y) => y !== x) })]));
  f.tags.forEach((t) => cands.push(['tag', t, Object.assign({}, f, { tags: f.tags.filter((y) => y !== t) })]));
  if (f.cap > 0) cands.push(['cap', String(f.cap), Object.assign({}, f, { cap: 0 })]);
  const out = cands.map(([kind, v, g]) => ({ kind, v, count: c.nbRunSearch(c.nbFilterStores(g, fresh(list), fav), q).length }));
  if (withQuery && q) out.push({ kind: 'q', v: q, count: c.nbFilterStores(f, list, fav).length });
  return out.filter((x) => x.count > 0);
}
// 返ってきた案が「正しい上位 3 つ」か（同じ件数の並びは問わない）
function assertTopSuggestions(actual, all, label) {
  assert.strictEqual(actual.length, Math.min(3, all.length), `${label}: 件数は 候補数と 3 の小さい方`);
  actual.forEach((a) => {
    const e = all.find((x) => x.kind === a.kind && x.v === a.v);
    assert.ok(e, `${label}: 総当たりに無い案が出ている: ${a.kind} ${a.v}`);
    assert.strictEqual(a.count, e.count, `${label}: ${a.kind} ${a.v} の件数`);
    assert.ok(a.count > 0, `${label}: 0 件の案は出さない`);
  });
  for (let i = 1; i < actual.length; i++) assert.ok(actual[i - 1].count >= actual[i].count, `${label}: 多い順`);
  const shown = new Set(actual.map((a) => a.kind + '\u0000' + a.v));
  const minShown = actual.length ? Math.min(...actual.map((a) => a.count)) : 0;
  all.filter((x) => !shown.has(x.kind + '\u0000' + x.v)).forEach((o) => assert.ok(o.count <= minShown, `${label}: 出さなかった案 ${o.kind} ${o.v}（${o.count}）が出した案より多い`));
}

test('0軒の提案: 実データで、返す件数は「条件を 1 つ外した結果」の総当たりと一致し、0 件の案は出ず、多い順の上位 3 つだけ', () => {
  const FAV = STORES.filter((_, i) => i % 7 === 0).map((s) => s['店名']);
  const cases = [
    ['喫煙できる×全席禁煙＋エリア・ジャンル・人数', F({ conds: ['smoking-ok', 'non-smoking'], areas: [AREAS[3]], genre: '居酒屋', cap: 30 }), '', null, true],
    ['予算の矛盾＋タグ・人数', F({ conds: ['budget-3000', 'budget-5000-plus'], tags: ['女子会'], cap: 50 }), '', null, true],
    ['矛盾＋検索語（withQuery あり）', F({ conds: ['smoking-ok', 'non-smoking'], areas: [AREAS[0]] }), '個室', null, true],
    ['矛盾＋検索語（withQuery なし）', F({ conds: ['smoking-ok', 'non-smoking'], areas: [AREAS[0]] }), '個室', null, false],
    ['矛盾＋保存済み', F({ conds: ['smoking-ok', 'non-smoking'] }), '', FAV, false],
    ['条件が多い（データ次第で 0 軒）', F({ genre: '寿司', areas: [AREAS[3]], conds: ['koshitsu', 'late-night'], tags: ['接待'], cap: 50 }), '', null, true],
    ['条件が無い', F(), '', null, true],
  ];
  cases.forEach(([label, f, q, fav, withQuery]) => {
    const actual = plain(C.nbDropSuggestions(f, fresh(STORES), q, fav, withQuery));
    assertTopSuggestions(actual, bruteDrops(C, f, STORES, q, fav, withQuery), label);
    if (!withQuery) assert.ok(actual.every((a) => a.kind !== 'q'), `${label}: withQuery が偽なら検索語を外す案は入れない`);
  });
  // 矛盾は片方を外すしか直らない。それ以外の条件を外しても 0 軒のまま（案に出ない）
  const conflict = F({ conds: ['smoking-ok', 'non-smoking'], areas: [AREAS[0]], genre: '居酒屋', cap: 10 });
  assert.strictEqual(C.nbCountStores(conflict, fresh(STORES), '', null), 0, '矛盾した条件は必ず 0 軒');
  const only = plain(C.nbDropSuggestions(conflict, fresh(STORES), '', null, false));
  assert.ok(only.length >= 1, '直せる案がある（検査が空振りしていない）');
  only.forEach((x) => assert.ok(x.kind === 'cond' && ['smoking-ok', 'non-smoking'].includes(x.v), `矛盾の片方を外す案だけ: ${x.kind} ${x.v}`));
  assert.deepStrictEqual(plain(C.nbDropSuggestions(F(), fresh(STORES), '', null, true)), [], '条件が無ければ案は無い');
  assert.deepStrictEqual(plain(C.nbDropSuggestions(F(), fresh(STORES), '個室', null, false)), [], '条件が無く、検索語を外す案も許さないなら案は無い');
  assert.deepStrictEqual(plain(C.nbDropSuggestions(F(), fresh(STORES), '個室', null, true)).map((x) => x.kind), ['q'], '条件が無く検索語だけなら、検索語を外す案だけ');
});

test('0軒の提案: 条件の種類ごとの kind・v・label と、件数の多い順・最大 3 つ・同じ件数の上限（合成した店）', () => {
  const sakae = AREAS[3];
  const base = { 'ジャンル': '寿司', 'エリア': AREA_RAW(sakae), '個室': 'あり', 'タグ': '女子会,30〜40名', '宴会収容': '40' };
  // 条件 5 つのうち、ちょうど 1 つだけ満たさない店
  const miss = {
    genre: Object.assign({}, base, { 'ジャンル': '居酒屋' }),
    area: Object.assign({}, base, { 'エリア': AREA_RAW(AREAS[0]) }),
    cond: Object.assign({}, base, { '個室': 'なし' }),
    tag: Object.assign({}, base, { 'タグ': '30〜40名' }),
    cap: Object.assign({}, base, { '宴会収容': '10', 'タグ': '女子会' }),
  };
  const f = F({ genre: '寿司', areas: [sakae], conds: ['koshitsu'], tags: ['女子会'], cap: 30 });
  const scenario = (counts) => {
    const list = [];
    Object.keys(miss).forEach((k) => { for (let i = 0; i < counts[k]; i++) list.push(S(miss[k])); });
    return list;
  };
  // 件数が全部ちがう → 5 つの案から多い順の上位 3 つ
  let list = scenario({ genre: 5, area: 4, cond: 3, tag: 2, cap: 1 });
  assert.strictEqual(C.nbCountStores(f, list, '', null), 0, '条件を全部満たす店は無い（0 軒）');
  let s = plain(C.nbDropSuggestions(f, list, '', null, false));
  assert.deepStrictEqual(s, [
    { kind: 'genre', v: '寿司', label: '寿司', count: 5 },
    { kind: 'area', v: sakae, label: POLICY.areas.find((a) => a.slug === sakae).label, count: 4 },
    { kind: 'cond', v: 'koshitsu', label: POLICY.conditions.find((c) => c.slug === 'koshitsu').label, count: 3 },
  ]);
  // 逆の並び → 人数とタグが先頭に来る。人数の案の v は文字列、ラベルは「N名以上」
  list = scenario({ genre: 1, area: 1, cond: 1, tag: 4, cap: 5 });
  s = plain(C.nbDropSuggestions(f, list, '', null, false));
  assert.strictEqual(s.length, 3);
  assert.deepStrictEqual(s.slice(0, 2), [
    { kind: 'cap', v: '30', label: '30名以上', count: 5 },
    { kind: 'tag', v: '女子会', label: '女子会', count: 4 },
  ]);
  assert.strictEqual(s[2].count, 1);
  // 外しても 0 軒のままの条件は案に出ない（その条件の店が 0）
  list = scenario({ genre: 0, area: 0, cond: 2, tag: 0, cap: 3 });
  s = plain(C.nbDropSuggestions(f, list, '', null, false));
  assert.deepStrictEqual(s.map((x) => [x.kind, x.count]), [['cap', 3], ['cond', 2]], '0 件の案（ジャンル・エリア・タグ）は出ない');
  // 件数が同じ案は、上限 3 つで切る（4 つ以上が同数でも 3 つ）
  list = scenario({ genre: 2, area: 2, cond: 2, tag: 2, cap: 2 });
  s = plain(C.nbDropSuggestions(f, list, '', null, false));
  assert.strictEqual(s.length, 3);
  s.forEach((x) => assert.strictEqual(x.count, 2));
  // 提案を実際に適用した結果の件数が、案の件数と同じ
  list = scenario({ genre: 5, area: 4, cond: 3, tag: 2, cap: 1 });
  plain(C.nbDropSuggestions(f, list, '', null, false)).forEach((x) => {
    assert.strictEqual(C.nbCountStores(C.nbDropFilter(f, x.kind, x.v), list, '', null), x.count, `${x.kind} を外した結果`);
  });
});

test('0軒の提案: 検索語を外す案は withQuery が真で検索語があるときだけ（kind:q・ラベルは「…」・件数は検索語を外した結果）', () => {
  const c = load({ engine: FAKE_SUBSTR });
  const list = [S({ '店名': '焼肉A', '個室': 'あり' }), S({ '店名': '焼肉B', '個室': 'なし' }), S({ '店名': '寿司C', '個室': 'あり' }), S({ '店名': '寿司D', '個室': 'あり' })];
  const f = c.nbToggleFilter(c.nbEmptyFilter(), 'cond', 'koshitsu');   // 個室あり: A・C・D
  assert.strictEqual(c.nbCountStores(f, list, '焼肉', null), 1, '個室あり×焼肉 = A だけ');
  assert.strictEqual(c.nbCountStores(f, list, 'ラーメン', null), 0, '個室あり×ラーメン = 0 軒');
  const sugg = (q, withQuery, fav) => plain(c.nbDropSuggestions(f, list, q, fav || null, withQuery));
  // 検索語が原因の 0 軒: 外す案は「検索語を外す」だけ（個室を外しても 0 軒）
  assert.deepStrictEqual(sugg('ラーメン', true), [{ kind: 'q', v: 'ラーメン', label: '「ラーメン」', count: 3 }]);
  assert.deepStrictEqual(sugg('ラーメン', false), [], 'withQuery が偽なら検索語の案は入れない（絞り込みシートは検索語を持たない）');
  // 検索語と条件の両方が原因: 個室を外す案（B が通って焼肉 2 軒）と検索語を外す案
  const g = list.concat(S({ '店名': '焼肉E', '個室': 'なし' }));
  const both = plain(c.nbDropSuggestions(f, g, '焼肉', null, true));
  assert.deepStrictEqual(both.map((x) => [x.kind, x.count]).sort(), [['cond', 3], ['q', 3]], '個室を外すと焼肉 3 軒・焼肉を外すと個室あり 3 軒（同じ件数の並びは決めない）');
  assert.deepStrictEqual(both.find((x) => x.kind === 'cond'), { kind: 'cond', v: 'koshitsu', label: c.nbCondLabel('koshitsu'), count: 3 });
  // 検索語が空なら「検索語を外す」案は入らない
  assert.ok(sugg('', true).every((x) => x.kind !== 'q'), '検索語が空なら q の案は無い');
  assert.ok(sugg(undefined, true).every((x) => x.kind !== 'q'), '検索語が無ければ q の案は無い');
  // 検索語を外しても 0 軒なら、その案は出さない
  const f2 = c.nbToggleFilter(c.nbEmptyFilter(), 'cond', 'lunch');   // ランチ: 誰も持っていない
  assert.deepStrictEqual(plain(c.nbDropSuggestions(f2, list, '焼肉', null, true)).map((x) => x.kind), ['cond'], '検索語を外しても 0 軒なら q の案は出ない');
  // 保存済み（favNames）の中で数える
  assert.deepStrictEqual(sugg('ラーメン', true, ['焼肉A', '寿司C']), [{ kind: 'q', v: 'ラーメン', label: '「ラーメン」', count: 2 }]);
});

// ── 9. トグル ──────────────────────────────────────────────────────────
test('トグル: 押すと入り、もう一度押すと外れる。ジャンルは 1 つだけ・人数は同じ値で外れ別の値で入れ替わる。元は変わらない', () => {
  // エリア・条件・タグ: 入る → 外れる
  [['area', AREAS[3]], ['area', AREAS[0]], ['cond', 'koshitsu'], ['cond', 'lunch'], ['tag', 'デート'], ['tag', '個室']].forEach(([kind, v]) => {
    const on = C.nbToggleFilter(F(), kind, v);
    assert.ok(C.nbFilterHas(on, kind, v), `${kind} ${v} が入る`);
    const off = C.nbToggleFilter(on, kind, v);
    assert.deepStrictEqual(plain(off), plain(C.nbEmptyFilter()), `${kind} ${v} をもう一度押すと外れる`);
  });
  // 複数が入るのは area / cond / tag
  let f = F();
  f = C.nbToggleFilter(f, 'area', AREAS[3]);
  f = C.nbToggleFilter(f, 'area', AREAS[0]);
  assert.deepStrictEqual(plain(f.areas), [AREAS[0], AREAS[3]], '2 つ入り、ポリシーの並び');
  f = C.nbToggleFilter(f, 'area', AREAS[0]);
  assert.deepStrictEqual(plain(f.areas), [AREAS[3]], '押した方だけが外れる');
  // ジャンルは 1 つだけ（別のジャンルを押すと入れ替わる・同じジャンルで外れる）
  let g = C.nbToggleFilter(F(), 'genre', '寿司');
  assert.strictEqual(g.genre, '寿司');
  g = C.nbToggleFilter(g, 'genre', '居酒屋');
  assert.strictEqual(g.genre, '居酒屋', '別のジャンルを押すと入れ替わる');
  g = C.nbToggleFilter(g, 'genre', '居酒屋');
  assert.strictEqual(g.genre, 'All', '同じジャンルを押すと外れる');
  assert.strictEqual(C.nbToggleFilter(F(), 'genre', '存在しないジャンル').genre, 'All', '知らないジャンルは入らない');
  // 人数: 同じ値で外れ、別の値で入れ替わる（文字列の値も受ける）
  let cap = C.nbToggleFilter(F(), 'cap', 30);
  assert.strictEqual(cap.cap, 30);
  assert.strictEqual(C.nbToggleFilter(cap, 'cap', '30').cap, 0, '同じ値（文字列でも）を押すと外れる');
  assert.strictEqual(C.nbToggleFilter(cap, 'cap', 50).cap, 50, '別の値を押すと入れ替わる');
  assert.strictEqual(C.nbToggleFilter(F(), 'cap', 'abc').cap, 0, '数でない値は入らない');
  // 知らない値・知らない種類を押しても条件は増えない
  assert.deepStrictEqual(plain(C.nbToggleFilter(F(), 'area', '存在しない')), plain(C.nbEmptyFilter()));
  assert.deepStrictEqual(plain(C.nbToggleFilter(F(), 'cond', 'nope')), plain(C.nbEmptyFilter()));
  assert.deepStrictEqual(plain(C.nbToggleFilter(F(), 'tag', 'nope')), plain(C.nbEmptyFilter()));
  assert.deepStrictEqual(plain(C.nbToggleFilter(F({ cap: 20 }), 'zzz', 'x')), plain(F({ cap: 20 })));
  // 元の条件は変わらない（凍らせても例外にならず、中身も同じ）
  const frozen = deepFreeze(plain(F({ genre: '寿司', areas: [AREAS[0]], conds: ['koshitsu'], tags: ['デート'], cap: 20 })));
  const snapshot = JSON.stringify(frozen);
  ['genre', 'area', 'cond', 'tag', 'cap'].forEach((kind) => {
    const v = { genre: '居酒屋', area: AREAS[3], cond: 'lunch', tag: '女子会', cap: 50 }[kind];
    const r = C.nbToggleFilter(frozen, kind, v);
    assert.notStrictEqual(r, frozen);
    assert.strictEqual(JSON.stringify(frozen), snapshot, `${kind}: 元の条件が変わらない`);
  });
  const dropped = C.nbDropFilter(frozen, 'area', AREAS[0]);
  assert.deepStrictEqual(plain(dropped.areas), []);
  assert.strictEqual(JSON.stringify(frozen), snapshot);
});

test('nbFilterHas・nbDropFilter・nbFilterCount: 押されているか・1 つ外した条件・効いている条件の数', () => {
  const f = F({ genre: '寿司', areas: [AREAS[0], AREAS[3]], conds: ['koshitsu'], tags: ['デート', '女子会'], cap: 30 });
  assert.ok(C.nbFilterHas(f, 'genre', '寿司') && !C.nbFilterHas(f, 'genre', '居酒屋'));
  assert.ok(C.nbFilterHas(f, 'area', AREAS[0]) && !C.nbFilterHas(f, 'area', AREAS[1]));
  assert.ok(C.nbFilterHas(f, 'cond', 'koshitsu') && !C.nbFilterHas(f, 'cond', 'lunch'));
  assert.ok(C.nbFilterHas(f, 'tag', 'デート') && !C.nbFilterHas(f, 'tag', '接待'));
  assert.ok(C.nbFilterHas(f, 'cap', 30) && C.nbFilterHas(f, 'cap', '30') && !C.nbFilterHas(f, 'cap', 50));
  assert.strictEqual(C.nbFilterHas(f, 'zzz', 'x'), false);
  // 外す
  assert.deepStrictEqual(plain(C.nbDropFilter(f, 'tag', 'デート').tags), ['女子会']);
  assert.deepStrictEqual(plain(C.nbDropFilter(f, 'area', AREAS[3]).areas), [AREAS[0]]);
  assert.strictEqual(C.nbDropFilter(f, 'cap', '30').cap, 0);
  assert.strictEqual(C.nbDropFilter(f, 'genre', '寿司').genre, 'All');
  // 入っていないものを「外す」は、何も変えない（押して入れてしまわない）
  [['area', AREAS[1]], ['cond', 'lunch'], ['tag', '接待'], ['cap', 50], ['genre', '居酒屋']].forEach(([k, v]) => {
    const r = C.nbDropFilter(f, k, v);
    assert.deepStrictEqual(plain(r), plain(f), `入っていない ${k} ${v} を外しても変わらない`);
    assert.notStrictEqual(r, f, '別のオブジェクト');
  });
  // 数: ジャンル 1 + エリア 2 + 条件 1 + タグ 2 + 人数 1
  assert.strictEqual(C.nbFilterCount(f), 7);
  assert.strictEqual(C.nbFilterCount(F()), 0);
  assert.strictEqual(C.nbFilterCount(F({ genre: '寿司' })), 1);
  assert.strictEqual(C.nbFilterCount(F({ cap: 10 })), 1);
  assert.strictEqual(C.nbFilterCount(F({ areas: AREAS })), AREAS.length, 'エリアは 1 つずつ数える');
});

// ── 10. ラベル ─────────────────────────────────────────────────────────
test('ラベル: エリアの群・条件のラベルはポリシーと一致し、日本語で、重ならない。知らない slug はそのまま返す', () => {
  POLICY.areas.forEach((a) => {
    assert.strictEqual(C.nbAreaLabel(a.slug), a.label, `エリア ${a.slug}`);
    assert.ok(JA.test(a.label), `エリアのラベルが日本語: ${a.label}`);
  });
  POLICY.conditions.forEach((c) => {
    assert.strictEqual(C.nbCondLabel(c.slug), c.label, `条件 ${c.slug}`);
    assert.ok(JA.test(c.label), `条件のラベルが日本語: ${c.label}`);
  });
  const extra = plain(C.NB_COND_EXTRA);
  assert.ok(extra.length >= 1);
  extra.forEach((c) => {
    assert.strictEqual(C.nbCondLabel(c.slug), c.label, `シートだけの条件 ${c.slug}`);
    assert.ok(JA.test(c.label) && c.label.length > 0);
  });
  assert.strictEqual(C.nbCondLabel('budget-3001-5000'), '予算3,001〜5,000円');
  const labels = C.nbCondDefs().list.map((c) => c.label).concat(POLICY.areas.map((a) => a.label));
  assert.strictEqual(new Set(labels).size, labels.length, 'ラベルが重ならない（札が見分けられる）');
  ['nope', '', 'constructor', '__proto__', 'toString', 'hasOwnProperty'].forEach((x) => {
    assert.strictEqual(C.nbAreaLabel(x), String(x), `知らないエリア ${x}`);
    assert.strictEqual(C.nbCondLabel(x), String(x), `知らない条件 ${x}`);
  });
});

// ── そのほか: 判定の中身 ───────────────────────────────────────────────
test('絞り込みの意味: エリアの群の中は OR・そのほか（ジャンル・条件・タグ・人数）は AND。順番は結果に関係しない', () => {
  const set = (f) => C.nbFilterStores(f, STORES);
  const a0 = set(F({ areas: [AREAS[0]] }));
  const a3 = set(F({ areas: [AREAS[3]] }));
  sameSet(set(F({ areas: [AREAS[3], AREAS[0]] })), [...new Set(a0.concat(a3))], 'エリア 2 つは和集合（両方に入る店は 1 回だけ）');
  assert.ok(a0.length > 0 && a3.length > 0, '比べる店がある');
  // 群が重なるのは、住所で所属する店（addressMatch）だけ。重なる店は、両方の群を選んだときも 1 軒として数える
  a0.filter((s) => a3.includes(s)).forEach((s) => {
    assert.ok(HUB.areaSlugsOf(s, POLICY).length >= 2, '重なる店は、ハブの判定でも 2 つ以上の群に入る: ' + s['店名']);
  });
  const k = new Set(set(F({ conds: ['koshitsu'] })));
  const l = new Set(set(F({ conds: ['lunch'] })));
  const both = set(F({ conds: ['koshitsu', 'lunch'] }));
  sameSet(both, [...k].filter((s) => l.has(s)), '条件 2 つは積集合');
  sameSet(set(F({ conds: ['lunch', 'koshitsu'] })), both, '条件の順番は関係しない');
  assert.ok(both.length > 0 && both.length < k.size, '積集合は片方より小さい（空振りしていない）');
  // 全部入り = 単独の結果の積集合
  const parts = [F({ genre: '居酒屋' }), F({ areas: [AREAS[0], AREAS[3]] }), F({ conds: ['koshitsu', 'nomihodai'] }), F({ tags: ['誕生日・記念日'] }), F({ cap: 20 })]
    .map((f) => new Set(set(f)));
  const all = set(F({ genre: '居酒屋', areas: [AREAS[0], AREAS[3]], conds: ['koshitsu', 'nomihodai'], tags: ['誕生日・記念日'], cap: 20 }));
  sameSet(all, STORES.filter((s) => parts.every((p) => p.has(s))), '5 種類の条件を全部掛けた結果');
  const noTag = set(F({ genre: '居酒屋', areas: [AREAS[0], AREAS[3]], conds: ['koshitsu', 'nomihodai'], cap: 20 }));
  assert.ok(all.length < noTag.length || noTag.length === 0, 'タグを足すと小さくなる');
  // ジャンル: 代表ジャンルで全店を分けられる
  const byGenre = plain(C.GENRE_ORDER).map((g) => set(F({ genre: g })));
  assert.strictEqual(byGenre.reduce((n, x) => n + x.length, 0), STORES.length, '全店がどれか 1 つのジャンルに入る');
  assert.strictEqual(new Set([].concat(...byGenre)).size, STORES.length, '重ならない');
});

test('保存済み（favNames）: null なら絞らず、空配列なら 0 軒、名前の配列ならその店だけ（条件との AND）', () => {
  const list = [S({ '店名': 'あ', '個室': 'あり' }), S({ '店名': 'い' }), S({ '店名': 'う', '個室': 'あり' }), S({ '店名': 'う' })];
  const f = C.nbToggleFilter(C.nbEmptyFilter(), 'cond', 'koshitsu');
  assert.strictEqual(C.nbFilterStores(C.nbEmptyFilter(), list, null).length, 4, 'null は絞らない');
  assert.strictEqual(C.nbFilterStores(C.nbEmptyFilter(), list, undefined).length, 4, 'undefined も絞らない');
  assert.strictEqual(C.nbFilterStores(C.nbEmptyFilter(), list, []).length, 0, '保存済みが空なら 0 軒');
  assert.deepStrictEqual(plain(C.nbFilterStores(C.nbEmptyFilter(), list, ['い', 'う']).map((s) => s['店名'])), ['い', 'う', 'う'], '名前の店だけ（同じ名前の店は全部）');
  assert.deepStrictEqual(plain(C.nbFilterStores(C.nbEmptyFilter(), list, ['あ']).map((s) => s['店名'])), ['あ']);
  assert.deepStrictEqual(plain(C.nbFilterStores(f, list, ['い', 'う']).map((s) => s['店名'])), ['う'], '条件と AND');
  assert.strictEqual(C.nbFilterStores(f, list, ['い']).length, 0);
  assert.strictEqual(C.nbFilterStores(f, list, ['存在しない店']).length, 0);
});

test('タグの判定: 店のタグ欄・アクセス・備考と、予算タグの端・シーンの言い換え・個室と半個室', () => {
  const T = (tag, fields) => C.nbFilterStores(F({ tags: [tag] }), [S(fields)]).length === 1;
  // 予算のタグ（価格帯の最初の数字で判定）
  const budget = [
    ['〜1000円', '～500円', true], ['〜1000円', '501～1000円', true], ['〜1000円', '1001～1500円', false],
    ['1001〜2000円', '1001～1500円', true], ['1001〜2000円', '1501～2000円', true], ['1001〜2000円', '2001～3000円', false], ['1001〜2000円', '501～1000円', false],
    ['2001〜3000円', '2001～3000円', true], ['2001〜3000円', '3001～4000円', false],
    ['3001〜5000円', '3001～4000円', true], ['3001〜5000円', '4001～5000円', true], ['3001〜5000円', '5001～7000円', false], ['3001〜5000円', '2001～3000円', false],
    ['5001〜7000円', '5001～7000円', true], ['5001〜7000円', '7001～10000円', false], ['5001〜7000円', '4001～5000円', false],
    ['7001〜10000円', '7001～10000円', true], ['7001〜10000円', '10001～15000円', false],
    ['10001円以上', '10001～15000円', true], ['10001円以上', '30001円～', true], ['10001円以上', '7001～10000円', false],
    // 価格帯が 1 つの数だけの店（最初の数字で判定）。7 つのタグの境目を、ちょうど・直下・直上で
    ['〜1000円', '1000円', true], ['〜1000円', '1001円', false], ['〜1000円', '0円', false],
    ['1001〜2000円', '1000円', false], ['1001〜2000円', '1001円', true], ['1001〜2000円', '2000円', true], ['1001〜2000円', '2001円', false],
    ['2001〜3000円', '2000円', false], ['2001〜3000円', '2001円', true], ['2001〜3000円', '3000円', true], ['2001〜3000円', '3001円', false],
    ['3001〜5000円', '3000円', false], ['3001〜5000円', '3001円', true], ['3001〜5000円', '5000円', true], ['3001〜5000円', '5001円', false],
    ['5001〜7000円', '5000円', false], ['5001〜7000円', '5001円', true], ['5001〜7000円', '7000円', true], ['5001〜7000円', '7001円', false],
    ['7001〜10000円', '7000円', false], ['7001〜10000円', '7001円', true], ['7001〜10000円', '10000円', true], ['7001〜10000円', '10001円', false],
    ['10001円以上', '10000円', false], ['10001円以上', '10001円', true],
  ];
  budget.forEach(([tag, price, ok]) => assert.strictEqual(T(tag, { '価格帯': price }), ok, `${tag} × 価格帯 ${price}`));
  ['〜1000円', '1001〜2000円', '2001〜3000円', '3001〜5000円', '5001〜7000円', '7001〜10000円', '10001円以上'].forEach((tag) => {
    assert.strictEqual(T(tag, {}), false, `${tag} × 価格帯なし`);
    assert.strictEqual(T(tag, { '価格帯': '' }), false, `${tag} × 価格帯が空`);
  });
  // 店のタグ欄は , 区切りの完全一致
  assert.strictEqual(T('デート', { 'タグ': 'デート' }), true);
  assert.strictEqual(T('デート', { 'タグ': '居酒屋, デート ,個室' }), true, '前後の空白は除く');
  assert.strictEqual(T('デート', { 'タグ': 'デートプラン' }), false, 'タグ欄は部分一致にしない');
  assert.strictEqual(T('デート', {}), false);
  // アクセス・備考の語
  assert.strictEqual(T('カウンター', { 'アクセス': 'カウンター席あり' }), true);
  assert.strictEqual(T('カウンター', { '備考': '全席カウンター' }), true);
  assert.strictEqual(T('カウンター', { 'タグ': 'カウンター席' }), false, 'タグ欄の「カウンター席」は「カウンター」ではない');
  // 個室と半個室は互いに含む。アクセス・備考の語も見る
  assert.strictEqual(T('個室', { 'タグ': '半個室' }), true);
  assert.strictEqual(T('個室', { 'アクセス': '完全個室あり' }), true);
  assert.strictEqual(T('個室', { '備考': '個室' }), true);
  assert.strictEqual(T('個室', { 'タグ': 'デート' }), false);
  assert.strictEqual(T('半個室', { 'タグ': '個室' }), true);
  assert.strictEqual(T('半個室', { 'アクセス': '半個室あり' }), true);
  assert.strictEqual(T('半個室', { 'アクセス': '個室あり' }), false, '半個室は、アクセスに「個室」だけでは入らない');
  // シーンの言い換え: 言い換え先のタグ・語のどれかがあれば入る。そのタグが店のタグ欄にあるだけでは入らない
  assert.strictEqual(T('推し活', { 'タグ': '女子会' }), true);
  assert.strictEqual(T('推し活', { 'タグ': '誕生日・記念日' }), true);
  assert.strictEqual(T('推し活', { '備考': '誕生日・記念日プラン' }), true);
  assert.strictEqual(T('推し活', { 'アクセス': '推し活に人気' }), true);
  assert.strictEqual(T('推し活', { 'タグ': 'デート' }), false);
  assert.strictEqual(T('ママ会', { 'タグ': '家族・子連れ' }), true);
  assert.strictEqual(T('ママ会', { 'タグ': '半個室' }), true);
  assert.strictEqual(T('オフ会', { 'タグ': '貸切可' }), true);
  assert.strictEqual(T('壮行会', { 'タグ': '歓送迎会' }), true);
  assert.strictEqual(T('壮行会', { 'タグ': '接待' }), false);
  // 複数のタグは AND
  assert.strictEqual(C.nbFilterStores(F({ tags: ['デート', '女子会'] }), [S({ 'タグ': 'デート,女子会' }), S({ 'タグ': 'デート' })]).length, 1);
});

test('エリアの群・ジャンルの判定: エリアの原文は前後の空白を除いた完全一致。プロトタイプの名前に引っかからない', () => {
  const all = new Set();
  POLICY.areas.forEach((a) => a.match.forEach((m) => all.add(m)));
  POLICY.areas.forEach((a) => a.match.forEach((m) => {
    assert.strictEqual(C.nbAreaSlug(m), a.slug, `「${m}」→ ${a.slug}`);
    assert.strictEqual(C.nbAreaSlug('  ' + m + '\t'), a.slug, `前後の空白は除く: 「${m}」`);
    if (!all.has(m + 'x')) assert.strictEqual(C.nbAreaSlug(m + 'x'), '', '後ろに足した文字は別のエリア');
    if (m.length > 1 && !all.has(m.slice(0, -1))) assert.strictEqual(C.nbAreaSlug(m.slice(0, -1)), '', '前方一致にしない');
  }));
  [undefined, null, '', '  ', 123, '存在しないエリア', 'constructor', '__proto__', 'toString', 'hasOwnProperty'].forEach((x) => assert.strictEqual(C.nbAreaSlug(x), '', `群に入らない: ${String(x)}`));
  // ジャンル: 店のジャンルの原文 → 代表ジャンル
  assert.strictEqual(C.nbGenreOf(S({ 'ジャンル': '焼肉' })), '焼肉・ホルモン');
  assert.strictEqual(C.nbGenreOf(S({ 'ジャンル': 'constructor' })), 'その他グルメ');
  assert.strictEqual(C.nbGenreOf(S({ 'ジャンル': '__proto__' })), 'その他グルメ');
  assert.strictEqual(C.nbGenreOf(S({ 'ジャンル': 'toString' })), 'その他グルメ');
  assert.strictEqual(C.nbGenreOf(S({ 'ジャンル': '焼肉' })), '焼肉・ホルモン', '2 回目（覚えた値）も同じ');
  // 載っているジャンル: 代表ジャンルの並びで 1 つずつ。ジャンルが空の店は数えない
  const present = C.nbPresentGenres([S({ 'ジャンル': 'ラーメン' }), S({ 'ジャンル': '寿司' }), S({ 'ジャンル': '鮨' }), S({ 'ジャンル': '' }), S({}), S({ 'ジャンル': '居酒屋' }), S({ 'ジャンル': 'へんな店' })]);
  assert.deepStrictEqual(plain(present), plain(C.GENRE_ORDER).filter((g) => ['居酒屋', '寿司', 'ラーメン', 'その他グルメ'].includes(g)));
  assert.deepStrictEqual(plain(C.nbPresentGenres([S({ 'ジャンル': '' }), S({})])), [], 'ジャンルが空の店だけなら、載せるジャンルは無い（「その他グルメ」を勝手に足さない）');
  assert.deepStrictEqual(plain(C.nbPresentGenres([])), []);
});
