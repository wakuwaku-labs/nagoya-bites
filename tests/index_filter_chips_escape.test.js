'use strict';
/**
 * tests/index_filter_chips_escape.test.js
 *
 * トップ（index.html）の「条件のチップ」と「結果の条件帯」に出す入力由来の値が、HTML として解釈されず、
 * 入力どおりの文字として表示されることを確かめる。
 *
 * index.html から実物の関数（nbEscHtml・updateFilterUI）を取り出し、偽の DOM の上で動かす。
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
const SOURCE = ['nbEscHtml', 'updateFilterUI'].map(fnSource).join('\n');

function makeEl(extra) {
  const cls = new Set();
  return Object.assign({
    style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', disabled: false,
    classList: {
      add: (c) => { cls.add(c); },
      remove: (c) => { cls.delete(c); },
      contains: (c) => cls.has(c),
    },
  }, extra || {});
}

// 条件を入れて updateFilterUI を動かし、できた HTML を返す
function render(cond) {
  cond = cond || {};
  const elements = {};
  ['filter-badge', 'filter-toggle-btn', 'clear-all-btn', 'active-chips', 'results-summary-cond', 'results-summary-count',
    'filter-panel-cta-count', 'filter-panel-cta-main'].forEach((id) => { elements[id] = makeEl(); });
  elements['cap-input'] = makeEl({ value: cond.cap || '' });
  elements['si'] = makeEl({ value: cond.q || '' });
  const prefEl = makeEl({ dataset: { pref: cond.pref || '全国' } });
  const genreEl = makeEl({ dataset: { f: cond.genre || 'All' } });
  const document = {
    getElementById: (id) => (Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null),
    querySelector: (sel) => (sel === '.pt.on' ? prefEl : sel === '.ft.on' ? genreEl : null),
    querySelectorAll: () => [],
  };
  const ctx = {
    document, console,
    ACTIVE_WARD: cond.ward || 'all', ACTIVE_TAGS: (cond.tags || []).slice(), FILTERED: [],
    nbUpdateSearchClearVisibility() {},
    // 保存した店だけを見る絞り込み（I-23）。入力由来の値ではなく、ここでは使わない（false）。
    SHOW_FAVS_ONLY: false, nbSyncFavNav() {},
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  ctx.updateFilterUI();
  return { chips: elements['active-chips'].innerHTML, pills: elements['results-summary-cond'].innerHTML };
}

// ── できた HTML の字句を調べる ───────────────────────────────────────────
// 許す要素は、条件のチップと結果の条件帯に使う span だけ。属性値に生の " < > を許さない。
const TAG_OPEN = /^<span class="(?:chip|chip-x|rs-pill|rs-sep)"(?: data-clear="(?:pref|ward|genre|tag|cap|q)")?(?: data-tag="[^"<>]*")?>$/;
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
// 条件1つにつき、チップは2要素（チップ本体と ×）、条件帯は1要素（rs-pill）
function assertOneCondition(out) {
  assertOnlyKnownSpans(out.chips);
  assertOnlyKnownSpans(out.pills);
  assert.strictEqual(openCount(out.chips), 2, `チップの要素の数が増えている: ${out.chips}`);
  assert.strictEqual(openCount(out.pills), 1, `条件帯の要素の数が増えている: ${out.pills}`);
}
// 文字として表示される内容（要素を取り除き、実体参照を戻したもの）
function visibleText(html) {
  return html.replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&amp;/g, '&');
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

// ── 1. 入力が HTML として解釈されない ───────────────────────────────────
PAYLOADS.forEach((p) => {
  test(`検索語に ${JSON.stringify(p)} を入れても、チップと条件帯に新しい要素ができない`, () => {
    assertOneCondition(render({ q: p }));
  });
  test(`検索語 ${JSON.stringify(p)} は、チップと条件帯に入力どおりの文字として表示される`, () => {
    const out = render({ q: p });
    assert.ok(visibleText(out.chips).indexOf(p) >= 0, `チップに入力が文字として残る: ${out.chips}`);
    assert.ok(visibleText(out.pills).indexOf(p) >= 0, `条件帯に入力が文字として残る: ${out.pills}`);
  });
});

test('エリア（区）・タグ・人数・都道府県・ジャンルに記号が入っても、新しい要素や属性ができない', () => {
  PAYLOADS.forEach((p) => {
    ['ward', 'cap', 'pref', 'genre'].forEach((k) => {
      const cond = {}; cond[k] = p;
      assertOneCondition(render(cond));
    });
    assertOneCondition(render({ tags: [p] }));
  });
});

test('タグは属性（data-tag）にも入るが、属性を閉じられない・文字としても表示される', () => {
  PAYLOADS.forEach((p) => {
    const out = render({ tags: [p] });
    const open = tokens(out.chips).tags.filter((t) => t.indexOf('data-clear="tag"') >= 0);
    assert.strictEqual(open.length, 1, '要素の数は変わらない（タグ1つにつきチップ1つ）');
    assert.ok(/ data-tag="[^"<>]*">$/.test(open[0]), `属性の値に生の " < > が無い: ${open[0]}`);
    assert.ok(visibleText(out.chips).indexOf(p) >= 0, `タグが文字として表示される: ${out.chips}`);
  });
});

test('複数の条件を同時に入れても、すべて文字として表示される', () => {
  const p = '"><i>';
  const out = render({ q: p, cap: p, ward: p, pref: p, genre: p, tags: [p, '個室'] });
  assertOnlyKnownSpans(out.chips);
  assertOnlyKnownSpans(out.pills);
  // 条件は7つ（都道府県・区・ジャンル・タグ2つ・人数・検索語）: チップは7×2要素、条件帯は7つの rs-pill と6つの区切り
  assert.strictEqual(openCount(out.chips), 14, out.chips);
  assert.strictEqual(openCount(out.pills), 13, out.pills);
  assert.ok(visibleText(out.chips).split(p).length - 1 >= 6, 'チップに6つの入力が文字として残る');
});

// ── 2. 通常の入力は、今までと同じ表示のまま ─────────────────────────────
test('通常の入力（日本語の語・区・タグ）は、これまでと同じ HTML になる', () => {
  const out = render({ q: '焼肉 個室', cap: '8', ward: '中区', pref: '愛知県', genre: '居酒屋', tags: ['個室', '接待'] });
  const x = '<span class="chip-x">×</span></span>';
  assert.strictEqual(out.chips,
    `<span class="chip" data-clear="pref">愛知県 ${x}`
    + `<span class="chip" data-clear="ward">中区 ${x}`
    + `<span class="chip" data-clear="genre">居酒屋 ${x}`
    + `<span class="chip" data-clear="tag" data-tag="個室">個室 ${x}`
    + `<span class="chip" data-clear="tag" data-tag="接待">接待 ${x}`
    + `<span class="chip" data-clear="cap">8名以上 ${x}`
    + `<span class="chip" data-clear="q">&ldquo;焼肉 個室&rdquo; ${x}`);
  assert.strictEqual(out.pills,
    '<span class="rs-pill">愛知県</span><span class="rs-sep">×</span>'
    + '<span class="rs-pill">中区</span><span class="rs-sep">×</span>'
    + '<span class="rs-pill">居酒屋</span><span class="rs-sep">×</span>'
    + '<span class="rs-pill">個室</span><span class="rs-sep">×</span>'
    + '<span class="rs-pill">接待</span><span class="rs-sep">×</span>'
    + '<span class="rs-pill">8名以上</span><span class="rs-sep">×</span>'
    + '<span class="rs-pill">「焼肉 個室」</span>');
});

test('条件が無いときは「条件なし」で、チップは空', () => {
  const out = render({});
  assert.strictEqual(out.chips, '');
  assert.strictEqual(out.pills, '<span class="rs-pill">条件なし</span>');
});

test('記号を含む語は、ブラウザが戻せる形（実体参照）で入る: & は &amp; になる', () => {
  const out = render({ q: 'A&B' });
  assert.ok(out.chips.indexOf('&ldquo;A&amp;B&rdquo;') >= 0, out.chips);
  assert.ok(out.pills.indexOf('「A&amp;B」') >= 0, out.pills);
});
