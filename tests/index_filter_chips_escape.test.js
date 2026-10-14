'use strict';
/**
 * tests/index_filter_chips_escape.test.js
 *
 * トップ（index.html）の「条件の札」（#active-chips）と「結果の条件帯」（#results-summary-cond）に出す入力由来の値が、
 * HTML として解釈されず、入力どおりの文字として表示されることを確かめる（HTML 注入の防止）。
 *
 * I-20 で絞り込みの状態は NB_FILTER（{ genre, areas[], conds[], tags[], cap }）の 1 つになり、検索語は #si の値、
 * 保存済みは SHOW_FAVS_ONLY が持つ。札も条件帯も updateFilterUI（→ nbActiveConditions）の 1 か所で作る。
 * 値が入る道は 2 つある。
 *   1. 検索語: 共有リンクの q= がそのまま #si に入る（正規化されない）。札と条件帯の逃がし方が最後の砦。
 *   2. 条件: 共有リンクの値は nbFilterFromParams が「エリアの群・条件・タグ・ジャンルの決まった候補」だけに絞り、
 *      知らない値は捨てる。だから共有リンクからは記号を含む条件が札まで届かない。ただし札の組み立てが
 *      「候補だけが来る」ことに頼っていると、候補の表に記号が入ったときや、入口が増えたときに壊れる。
 *      そこで NB_FILTER に記号を含む値を直接入れ（正規化を通さない）、札と条件帯が自分で逃がしていることを確かめる。
 *      共有リンクの道は、捨てられることを別の試験で確かめる（二重の防壁のそれぞれを見る）。
 *
 * index.html から実物の関数（nbEscHtml・nbActiveConditions・updateFilterUI・NB-FILTER の区画）を取り出し、偽の DOM の上で動かす。
 * 判定は、できた HTML の字句を調べる（許す要素は決まった span だけ・要素の数が増えない・属性を閉じられない）。
 * 入力は HTML に使われる記号だけで作る。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

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

// 絞り込みの核と、その外の依存（ジャンルの正規化・ハッシュを読む部品）
const SOURCE = [
  region('/* NB-FILTER-POLICY:START */', '/* NB-FILTER-POLICY:END */'),
  region('var GENRE_ORDER = ', '];'),
  region('var GENRE_RULES = [', '\n];'),
  region('// NB-FILTER:START', '// NB-FILTER:END'),
  ['normalizeGenre', 'nbSafeDecode', 'nbParseHash', 'nbEscHtml', 'nbActiveConditions', 'nbSetBadge', 'nbSyncFavNav', 'nbZeroIsProvisional', 'updateFilterUI']
    .map(fnSource).join('\n'),
].join('\n');

function makeEl(extra) {
  const cls = new Set();
  return Object.assign({
    style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', hidden: false,
    classList: {
      add: (c) => { cls.add(c); },
      remove: (c) => { cls.delete(c); },
      contains: (c) => cls.has(c),
      toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); return cls.has(c); },
    },
  }, extra || {});
}

// 実物の関数を読み込んだ偽のブラウザを作る
function load(opt) {
  opt = opt || {};
  const elements = {};
  ['filter-badge', 'tb-filter-badge', 'filter-toggle-btn', 'tb-filter-btn', 'clear-all-btn', 'share-filter-btn',
    'active-chips', 'results-summary-cond', 'results-summary-count'].forEach((id) => { elements[id] = makeEl(); });
  elements.si = makeEl({ value: opt.q || '' });
  const document = { getElementById: (id) => (Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null) };
  const ctx = vm.createContext({
    document, console, FILTERED: [], FULL_CATALOG_LOADED: true, FULL_CATALOG_FAILED: false,
    SHOW_FAVS_ONLY: !!opt.favs, getFavs: () => [], nbUpdateSearchClearVisibility() {},
  });
  vm.runInContext(SOURCE, ctx);
  return { ctx, elements };
}

// 条件を入れて updateFilterUI を動かし、できた HTML を返す。
//   opt.filter: NB_FILTER に直接入れる値（正規化を通さない）
//   opt.hash:   共有リンクのハッシュ。readHash と同じく nbFilterFromParams を通して NB_FILTER にし、q= は #si に入れる
function render(opt) {
  opt = opt || {};
  const { ctx, elements } = load(opt);
  if (opt.hash !== undefined) {
    const params = ctx.nbParseHash(opt.hash);
    ctx.NB_FILTER = ctx.nbFilterFromParams(params);
    if (params.q) elements.si.value = params.q;
  } else {
    ctx.NB_FILTER = Object.assign(ctx.nbEmptyFilter(), opt.filter || {});
  }
  ctx.updateFilterUI();
  return { chips: elements['active-chips'].innerHTML, pills: elements['results-summary-cond'].innerHTML, filter: ctx.NB_FILTER, ctx };
}

// ── できた HTML の字句を調べる ───────────────────────────────────────────
// 許す要素は、条件の札と結果の条件帯に使う span だけ。属性値に生の " < > を許さない。
const TAG_OPEN = /^<span class="(?:chip|chip-x|rs-pill|rs-sep)"(?: data-clear="(?:favs|area|genre|cond|tag|cap|q)")?(?: data-v="[^"<>]*")?>$/;
const TAG_CLOSE = /^<\/span>$/;

function tokens(html) {
  const out = { tags: [], text: '' };
  html.replace(/<[^>]*>|[^<]+/g, (t) => {
    if (t.charAt(0) === '<') out.tags.push(t); else out.text += t;
    return t;
  });
  // 生の < が残っていれば、字句に分けきれていない
  const stripped = html.replace(/<[^>]*>/g, '');
  assert.ok(stripped.indexOf('<') === -1 && stripped.indexOf('>') === -1, `要素の外に生の < > が残っている: ${html}`);
  return out;
}
function assertOnlyKnownSpans(html) {
  tokens(html).tags.forEach((t) => {
    assert.ok(TAG_OPEN.test(t) || TAG_CLOSE.test(t), `想定外の要素・属性ができている: ${t}`);
  });
}
// 開き要素の数（入力が要素を増やしていないことを、許可リストとは別に数で確かめる）
function openCount(html) {
  return tokens(html).tags.filter((t) => t.charAt(1) !== '/').length;
}
// 条件1つにつき、札は2要素（札本体と ×）、条件帯は1要素（rs-pill）
function assertOneCondition(out) {
  assertOnlyKnownSpans(out.chips);
  assertOnlyKnownSpans(out.pills);
  assert.strictEqual(openCount(out.chips), 2, `札の要素の数が増えている: ${out.chips}`);
  assert.strictEqual(openCount(out.pills), 1, `条件帯の要素の数が増えている: ${out.pills}`);
}
// 実体参照を戻す（& は最後。先に戻すと &amp;lt; が < になる）
function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&amp;/g, '&');
}
// 文字として表示される内容（要素を取り除き、実体参照を戻したもの）
function visibleText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ''));
}
// 期待値を作るための逃がし方（実物とは別に書く）
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 入力は HTML に使われる記号だけで作る（特定の攻撃手順は書かない）
const PAYLOADS = [
  '<b id="nb-test">x</b>',
  '"><i>',
  '" data-nb-test="1',
  "'\"<>&",
  '&lt;b&gt;',
  '</span><span class="chip">',
];

// 札になる条件の種類。値をそのまま持てる入口（正規化を通さない NB_FILTER）で、記号を含む値を1つ入れる
const KINDS = [
  { name: 'エリアの群', clear: 'area', make: (p) => ({ areas: [p] }) },
  { name: 'ジャンル', clear: 'genre', make: (p) => ({ genre: p }) },
  { name: '条件（13軸・予算）', clear: 'cond', make: (p) => ({ conds: [p] }) },
  { name: 'タグ（シーン・こだわり）', clear: 'tag', make: (p) => ({ tags: [p] }) },
];

// ── 1. 検索語: 入力が HTML として解釈されない ─────────────────────────────
PAYLOADS.forEach((p) => {
  test(`検索語に ${JSON.stringify(p)} を入れても、札と条件帯に新しい要素ができない`, () => {
    assertOneCondition(render({ q: p }));
  });
  test(`検索語 ${JSON.stringify(p)} は、札と条件帯に入力どおりの文字として表示される`, () => {
    const out = render({ q: p });
    assert.ok(visibleText(out.chips).indexOf(p) >= 0, `札に入力が文字として残る: ${out.chips}`);
    assert.ok(visibleText(out.pills).indexOf(p) >= 0, `条件帯に入力が文字として残る: ${out.pills}`);
  });
});

// ── 2. 条件: 札を作る入口で自分で逃がしている ────────────────────────────────
KINDS.forEach((k) => {
  test(`${k.name}に記号が入っても（正規化を通さず直接入れても）、札と条件帯に新しい要素や属性ができない`, () => {
    PAYLOADS.forEach((p) => {
      assertOneCondition(render({ filter: k.make(p) }));
    });
  });
  test(`${k.name}は値（data-v）にも入るが、属性を閉じられない・もとの値のまま読み戻せる・文字としても表示される`, () => {
    PAYLOADS.forEach((p) => {
      const out = render({ filter: k.make(p) });
      const open = tokens(out.chips).tags.filter((t) => t.indexOf(`data-clear="${k.clear}"`) >= 0);
      assert.strictEqual(open.length, 1, `札は1つだけ（${k.clear}）: ${out.chips}`);
      const m = / data-v="([^"<>]*)">$/.exec(open[0]);
      assert.ok(m, `属性の値に生の " < > が無い: ${open[0]}`);
      assert.strictEqual(decodeEntities(m[1]), p, 'ブラウザが戻した値は入れた値と同じ（札を押して条件を外すときに使う値）');
      assert.ok(visibleText(out.chips).indexOf(p) >= 0, `文字として表示される: ${out.chips}`);
      assert.ok(visibleText(out.pills).indexOf(p) >= 0, `条件帯にも文字として表示される: ${out.pills}`);
    });
  });
});

test('人数は数で持つ。数でない値は札にならない（記号を入れても要素や属性ができない）', () => {
  PAYLOADS.forEach((p) => {
    const out = render({ filter: { cap: p } });
    assertOnlyKnownSpans(out.chips);
    assertOnlyKnownSpans(out.pills);
    assert.ok(openCount(out.chips) <= 2 && openCount(out.pills) <= 1, `条件は多くても1つ: ${out.chips}`);
  });
  const ok = render({ filter: { cap: 20 } });
  assert.ok(ok.chips.indexOf('data-clear="cap" data-v="20">20名以上 ') >= 0, ok.chips);
});

test('エリアの群を複数選ぶと、札は群ごとに1つ・条件帯は「／」でつないだ1つ（記号を含む名前も文字として残る）', () => {
  const a = '<b>', b = '"><i>';
  const out = render({ filter: { areas: [a, b] } });
  assertOnlyKnownSpans(out.chips);
  assertOnlyKnownSpans(out.pills);
  assert.strictEqual(openCount(out.chips), 4, '札は2つ（札本体と ×）× 2: ' + out.chips);
  assert.strictEqual(openCount(out.pills), 1, '条件帯は「どれかに当てはまる」ので1つにまとまる: ' + out.pills);
  assert.strictEqual(visibleText(out.pills), `${a}／${b}`);
});

test('複数の条件を同時に入れても、すべて文字として表示される', () => {
  const p = '"><i>';
  const out = render({ q: p, filter: { genre: p, areas: [p], conds: [p], tags: [p, '個室'], cap: 20 } });
  assertOnlyKnownSpans(out.chips);
  assertOnlyKnownSpans(out.pills);
  // 条件は7つ（エリア・ジャンル・条件・タグ2つ・人数・検索語）: 札は7×2要素、条件帯は7つの rs-pill と6つの区切り
  assert.strictEqual(openCount(out.chips), 14, out.chips);
  assert.strictEqual(openCount(out.pills), 13, out.pills);
  assert.ok(visibleText(out.chips).split(p).length - 1 >= 5, '札に5つの入力が文字として残る');
});

test('保存済みを足しても、札の形は変わらない（保存済みが先頭・値を持たない）', () => {
  const p = '"><i>';
  const out = render({ favs: true, q: p, filter: { tags: [p] } });
  assertOnlyKnownSpans(out.chips);
  assertOnlyKnownSpans(out.pills);
  assert.strictEqual(openCount(out.chips), 6, out.chips);
  assert.ok(out.chips.indexOf('<span class="chip" data-clear="favs">保存済み <span class="chip-x">×</span></span>') === 0, '保存済みが先頭: ' + out.chips);
});

// ── 3. 共有リンクの道: 検索語以外は決まった候補だけが通り、通らない値は札にならない ───────────
test('共有リンクの値は、検索語以外は候補に無ければ捨てられ、記号を含む値が札まで届かない', () => {
  PAYLOADS.forEach((p) => {
    const enc = encodeURIComponent(p);
    const out = render({ hash: `#genre=${enc}&area=${enc}&cond=${enc}&tag=${enc}&cap=${enc}&ward=${enc}&pref=${enc}&q=${enc}` });
    const f = out.filter;
    assert.deepStrictEqual(Array.from(f.areas), [], 'エリアの群は候補に無ければ捨てる');
    assert.deepStrictEqual(Array.from(f.conds), [], '条件は候補に無ければ捨てる');
    assert.deepStrictEqual(Array.from(f.tags), [], 'タグは候補に無ければ捨てる');
    assert.strictEqual(f.cap, 0, '人数は数でなければ 0');
    assert.ok(f.genre === 'All' || out.ctx.GENRE_ORDER.indexOf(f.genre) >= 0, `ジャンルは代表ジャンルのどれか: ${f.genre}`);
    assertOnlyKnownSpans(out.chips);
    assertOnlyKnownSpans(out.pills);
    // 入力が文字として残るのは検索語の札だけ（1回）
    assert.strictEqual(visibleText(out.chips).split(p).length - 1, 1, `入力が残るのは検索語だけ: ${out.chips}`);
    assert.ok(out.chips.indexOf('data-clear="q"') >= 0, '検索語の札はある');
  });
});

// ── 4. 逃がす部品そのもの ────────────────────────────────────────────────
test('nbEscHtml: & < > " \' をすべて実体参照にし、null / undefined は空にする', () => {
  const { ctx } = load();
  assert.strictEqual(ctx.nbEscHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;');
  assert.strictEqual(ctx.nbEscHtml('&lt;'), '&amp;lt;', '二重に逃がす（もとの文字のまま表示するため）');
  assert.strictEqual(ctx.nbEscHtml(null), '');
  assert.strictEqual(ctx.nbEscHtml(undefined), '');
  assert.strictEqual(ctx.nbEscHtml(0), '0');
});

// ── 5. 通常の入力は、決まった表示のまま ─────────────────────────────────────
test('通常の入力（日本語の語・エリア・条件・タグ・人数）は、決まった HTML になる。値（data-v）は画面の文字ではなく条件の値', () => {
  const { ctx } = load();
  const area = ctx.NB_FILTER_POLICY.areas[0], cond = ctx.NB_FILTER_POLICY.conds[0];
  assert.notStrictEqual(area.slug, area.label, '試験の前提: エリアの値と画面の文字は別（値で外す作りを確かめるため）');
  assert.notStrictEqual(cond.slug, cond.label, '試験の前提: 条件の値と画面の文字は別');
  const out = render({ q: '焼肉 個室', filter: { genre: '居酒屋', areas: [area.slug], conds: [cond.slug], tags: ['個室', '接待'], cap: 8 } });
  const x = '<span class="chip-x">×</span></span>';
  assert.strictEqual(out.chips,
    `<span class="chip" data-clear="area" data-v="${esc(area.slug)}">${esc(area.label)} ${x}`
    + `<span class="chip" data-clear="genre" data-v="居酒屋">居酒屋 ${x}`
    + `<span class="chip" data-clear="cond" data-v="${esc(cond.slug)}">${esc(cond.label)} ${x}`
    + `<span class="chip" data-clear="tag" data-v="個室">個室 ${x}`
    + `<span class="chip" data-clear="tag" data-v="接待">接待 ${x}`
    + `<span class="chip" data-clear="cap" data-v="8">8名以上 ${x}`
    + `<span class="chip" data-clear="q">&ldquo;焼肉 個室&rdquo; ${x}`);
  assert.strictEqual(out.pills,
    `<span class="rs-pill">${esc(area.label)}</span><span class="rs-sep">×</span>`
    + '<span class="rs-pill">居酒屋</span><span class="rs-sep">×</span>'
    + `<span class="rs-pill">${esc(cond.label)}</span><span class="rs-sep">×</span>`
    + '<span class="rs-pill">個室</span><span class="rs-sep">×</span>'
    + '<span class="rs-pill">接待</span><span class="rs-sep">×</span>'
    + '<span class="rs-pill">8名以上</span><span class="rs-sep">×</span>'
    + '<span class="rs-pill">「焼肉 個室」</span>');
});

test('エリアの群を複数選ぶと、札は群ごとに1つ・条件帯は「／」でつないだ1つ', () => {
  const { ctx } = load();
  const [a, b] = ctx.NB_FILTER_POLICY.areas;
  const out = render({ filter: { areas: [a.slug, b.slug] } });
  const x = '<span class="chip-x">×</span></span>';
  assert.strictEqual(out.chips,
    `<span class="chip" data-clear="area" data-v="${esc(a.slug)}">${esc(a.label)} ${x}`
    + `<span class="chip" data-clear="area" data-v="${esc(b.slug)}">${esc(b.label)} ${x}`);
  assert.strictEqual(out.pills, `<span class="rs-pill">${esc(a.label)}／${esc(b.label)}</span>`);
});

test('条件が無いときは「条件なし」で、札は空', () => {
  const out = render({});
  assert.strictEqual(out.chips, '');
  assert.strictEqual(out.pills, '<span class="rs-pill">条件なし</span>');
});

test('記号を含む語は、ブラウザが戻せる形（実体参照）で入る: & は &amp; になる', () => {
  const out = render({ q: 'A&B' });
  assert.ok(out.chips.indexOf('&ldquo;A&amp;B&rdquo;') >= 0, out.chips);
  assert.ok(out.pills.indexOf('「A&amp;B」') >= 0, out.pills);
});
