'use strict';
/**
 * tests/index_japanese_labels.test.js — I-07（UI・UX改修 段階1a）
 *
 * トップ（index.html）の画面に出る英語の表示を日本語にした決まりを確かめる。
 *   1. ジャンルの絞り込み: 見出しは「ジャンル」、先頭の選択肢は「すべて」。
 *      ただし先頭の選択肢の内部の値（data-f）は今までどおり「All」のまま（絞り込み・URL・ハッシュの復元がこの値で動く）
 *   2. 収容人数の絞り込み: 見出しは「収容人数」。入力欄・単位・ヒントは今までどおり
 *   3. ランキング: 閲覧数は「N回閲覧」。折り返すときは項目ごとで、「12回閲／覧」のように途中で割れない（CSS）
 *   4. リール動画つきのカードの印は「リール」、ご意見パネルの見出しは「サイトへのご意見」、
 *      「この条件で通知」の案内は「準備中です — …」
 *   5. 直した英語の文字列が index.html に戻っていない
 *
 * index.html から実物の関数（buildGenreTabs・buildCapTabs・buildRanking・showNotifyToast）を取り出し、偽の DOM の上で動かす。
 * 実ブラウザでの確認は docs/qa/uiux-2026-10/e2e_labels.js。
 * 範囲の外: フッターの「Daily Journal」・パンくず先頭の「TOP」など、全ページ共通の表記は共通クローム
 * （scripts/lib/site_chrome.js）が持つので、別の課題 I-07b で直した（tests/chrome_japanese_labels.test.js）。
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

// 取り出した関数だけを入れた vm の中で式を評価する
function load(names, sandbox) {
  const ctx = vm.createContext(sandbox);
  vm.runInContext(names.map(fnSource).join('\n'), ctx);
  return ctx;
}

// 絞り込みの選択肢のタイル（<div class="ft on" data-f="All">すべて</div>）を取り出す
function parseTiles(html) {
  const tiles = [];
  const re = /<div class="ft( on)?" data-f="([^"]*)">([^<]*)<\/div>/g;
  let m;
  while ((m = re.exec(html))) tiles.push({ on: !!m[1], key: m[2], text: m[3] });
  return tiles;
}

// ── 1. ジャンルの絞り込み ───────────────────────────────────────────────
function genreEnv(stores) {
  const bar = { innerHTML: '', onclick: null, querySelectorAll: () => [] };
  const calls = { applyFilters: 0, pillFold: [] };
  const sandbox = {
    ALL_STORES: stores,
    GENRE_ORDER: ['居酒屋', '焼肉・ホルモン', '和食', 'ラーメン'],
    normalizeGenre: (g) => (g === '焼肉' ? '焼肉・ホルモン' : g),
    initPillFold: (b, toggle, n, limit) => { calls.pillFold.push({ n, limit }); },
    applyFilters: () => { calls.applyFilters++; },
    document: {
      querySelector: (sel) => (sel === '.filter-bar' ? bar : null),
      getElementById: () => null,
    },
  };
  const ctx = load(['buildGenreTabs'], sandbox);
  return { bar, calls, run: () => vm.runInContext('buildGenreTabs()', ctx) };
}

test('ジャンルの絞り込み: 見出しは「ジャンル」で、英語の「Genre」は出さない', () => {
  const env = genreEnv([{ ジャンル: '居酒屋' }]);
  env.run();
  assert.ok(env.bar.innerHTML.startsWith('<span class="fl">ジャンル</span>'), env.bar.innerHTML.slice(0, 80));
  assert.ok(!/Genre/i.test(env.bar.innerHTML));
});

test('ジャンルの絞り込み: 先頭の選択肢は画面の文字が「すべて」で、内部の値（data-f）は「All」のまま', () => {
  const env = genreEnv([{ ジャンル: '居酒屋' }, { ジャンル: '焼肉' }]);
  env.run();
  const tiles = parseTiles(env.bar.innerHTML);
  assert.strictEqual(tiles[0].text, 'すべて');
  assert.strictEqual(tiles[0].key, 'All', '絞り込み・URL・ハッシュの復元は data-f の「All」で比べるので、値は変えない');
  assert.strictEqual(tiles[0].on, true, '先頭が選ばれた状態で始まる');
  assert.ok(!tiles.some((t) => /^all$/i.test(t.text)), '画面に「All」の文字は出ない');
});

test('ジャンルの絞り込み: 先頭以外の選択肢は、ジャンル名がそのまま画面の文字と内部の値になる', () => {
  const env = genreEnv([{ ジャンル: '居酒屋' }, { ジャンル: '焼肉' }, { ジャンル: 'ラーメン' }]);
  env.run();
  const tiles = parseTiles(env.bar.innerHTML);
  assert.deepStrictEqual(tiles.map((t) => t.key), ['All', '居酒屋', '焼肉・ホルモン', 'ラーメン']);
  assert.deepStrictEqual(tiles.slice(1).map((t) => t.text), ['居酒屋', '焼肉・ホルモン', 'ラーメン']);
  assert.deepStrictEqual(tiles.map((t) => t.on), [true, false, false, false], '選ばれているのは先頭だけ');
});

test('ジャンルの絞り込み: 選択肢のクリックは文字ではなく選択肢（ft）そのものを見て絞り込みを呼ぶ', () => {
  const env = genreEnv([{ ジャンル: '居酒屋' }]);
  env.run();
  const added = [];
  const tile = { classList: { contains: (c) => c === 'ft', add: (c) => added.push(c) }, textContent: 'すべて' };
  env.bar.onclick({ target: tile });
  assert.strictEqual(env.calls.applyFilters, 1);
  assert.deepStrictEqual(added, ['on']);
  // 選択肢でないもの（見出しの「ジャンル」）を押しても絞り込みは呼ばれない
  env.bar.onclick({ target: { classList: { contains: () => false, add() { throw new Error('呼ばれない'); } } } });
  assert.strictEqual(env.calls.applyFilters, 1);
});

test('ジャンルの絞り込み: 選択肢の数（畳むかどうかの判定に使う）は表示の文字を変えても変わらない', () => {
  const env = genreEnv([{ ジャンル: '居酒屋' }, { ジャンル: '和食' }]);
  env.run();
  assert.deepStrictEqual(env.calls.pillFold, [{ n: 3, limit: 8 }], 'All + 2ジャンル');
});

test('絞り込みの内部の値は変えていない: 絞り込み・URL・ハッシュの復元は dataset.f の「All」で比べる', () => {
  // タイルの文字（textContent・innerText）を読んで絞り込む作りだと、文字を日本語にしたとき壊れる。そういう読み方が無いことを確かめる
  assert.ok(!/\.ft\b[^;\n]{0,80}(textContent|innerText)/.test(INDEX), 'ft の文字を読んでいる処理がある');
  assert.ok(!/(textContent|innerText)[^;\n]{0,80}\.ft\b/.test(INDEX), 'ft の文字を読んでいる処理がある');
  assert.ok(/genre === 'All' \|\| normalizeGenre/.test(fnSource('applyFilters')), 'applyFilters は data-f の「All」で全ジャンルを判定する');
  // URL（ハッシュ）を作る関数は、全ジャンル（All）のとき genre を載せない。別の改善案がこの関数を作り替えても通るよう、どちらの名前でも見る
  const hashFn = INDEX.includes('\nfunction nbBuildHash(') ? 'nbBuildHash' : 'pushHash';
  assert.ok(/genre !== 'All'/.test(fnSource(hashFn)), `URL に載せるかの判定は data-f の「All」（${hashFn}）`);
  // ハッシュの復元・条件を外すときは、選択肢を data-f の値で探す（文字では探さない）
  assert.ok(INDEX.includes('.ft[data-f="All"]') || INDEX.includes("'.ft', 'data-f'"), 'ハッシュの復元・条件を外すときは data-f の値で選択肢を探す');
});

// ── 2. 収容人数の絞り込み ───────────────────────────────────────────────
test('収容人数の絞り込み: 見出しは「収容人数」で、入力欄・単位・ヒントは今までどおり', () => {
  const container = { innerHTML: '' };
  const listeners = [];
  const sandbox = {
    applyFilters: () => {},
    document: {
      getElementById: (id) => {
        if (id === 'cap-tabs') return container;
        if (id === 'cap-input') return { addEventListener: (type, fn) => listeners.push({ type, fn }) };
        return null;
      },
    },
  };
  const ctx = load(['buildCapTabs'], sandbox);
  vm.runInContext('buildCapTabs()', ctx);
  assert.ok(container.innerHTML.startsWith('<span class="cap-label">収容人数</span>'), container.innerHTML.slice(0, 80));
  assert.ok(!/Capacity/i.test(container.innerHTML));
  assert.ok(container.innerHTML.includes('id="cap-input"') && container.innerHTML.includes('type="number"'));
  assert.ok(container.innerHTML.includes('<span class="cap-unit">名以上収容できるお店</span>'));
  assert.ok(container.innerHTML.includes('<span class="cap-hint">（空欄=すべて）</span>'));
  assert.deepStrictEqual(listeners.map((l) => l.type), ['input'], '人数を入れたら絞り込みが動く');
});

// ── 3. ランキング ──────────────────────────────────────────────────────
function rankingEnv(stores) {
  const scrollEl = { innerHTML: '' };
  const sectionEl = { style: { display: 'none' } };
  const sandbox = {
    ALL_STORES: stores,
    nbImage: (u) => u || '',
    nbSrcset: () => '',
    nbStoreFigure: () => 'fig.svg',
    document: {
      getElementById: (id) => (id === 'ranking-scroll' ? scrollEl : id === 'ranking-section' ? sectionEl : null),
    },
  };
  const ctx = load(['buildRanking'], sandbox);
  vm.runInContext('buildRanking()', ctx);
  return { scrollEl, sectionEl };
}
function scores(html) {
  return Array.from(html.matchAll(/<span class="rank-score">([^<]*)<\/span>/g)).map((m) => m[1]);
}

test('ランキング: 閲覧数は「N回閲覧」で、英語の「views」は出さない（閲覧数の多い順に10店まで）', () => {
  const stores = [];
  for (let i = 1; i <= 12; i++) stores.push({ 店名: '店' + i, ジャンル: '和食', エリア: '栄', 閲覧数: String(i) });
  const { scrollEl, sectionEl } = rankingEnv(stores);
  assert.deepStrictEqual(scores(scrollEl.innerHTML), ['12回閲覧', '11回閲覧', '10回閲覧', '9回閲覧', '8回閲覧', '7回閲覧', '6回閲覧', '5回閲覧', '4回閲覧', '3回閲覧']);
  assert.ok(!/views/i.test(scrollEl.innerHTML));
  assert.strictEqual(sectionEl.style.display, '', '見せる');
});

test('ランキング: 閲覧数が0・数字でない店は出さない。1店も無ければ区画ごと出さない（今までどおり）', () => {
  const some = rankingEnv([
    { 店名: 'A', 閲覧数: '5' }, { 店名: 'B', 閲覧数: '0' }, { 店名: 'C', 閲覧数: 'x' }, { 店名: 'D' },
  ]);
  assert.deepStrictEqual(scores(some.scrollEl.innerHTML), ['5回閲覧']);
  const none = rankingEnv([{ 店名: 'B', 閲覧数: '0' }]);
  assert.strictEqual(none.sectionEl.style.display, 'none');
});

test('ランキング: 閲覧数・ジャンル・エリアは並ぶ項目ごとに折り返し、閲覧数は途中で割れない（CSS）', () => {
  // 180px 幅のカードに3項目が並ぶ。折り返しを許さないと、長いジャンル名・エリア名の隣で「4回／閲／覧」のように文字ごとに割れる
  const rule = (sel) => {
    const m = INDEX.match(new RegExp('\\n' + sel.replace(/\./g, '\\.') + '\\{([^}]*)\\}'));
    assert.ok(m, sel + ' の規則が見つからない');
    return m[1];
  };
  assert.ok(/(^|;)flex-wrap:wrap(;|$)/.test(rule('.rank-meta')), '.rank-meta は項目ごとに折り返す');
  assert.ok(/(^|;)white-space:nowrap(;|$)/.test(rule('.rank-score')), '.rank-score は途中で折り返さない');
});

// ── 4. リール・ご意見・通知の案内 ─────────────────────────────────────────
test('リール動画つきのカードの印は「リール」', () => {
  assert.strictEqual(INDEX.split('<span class="reel-tag">リール</span>').length - 1, 1);
  assert.ok(!/<span class="reel-tag">Reel<\/span>/.test(INDEX));
});

test('ご意見パネルの見出しは「サイトへのご意見」（英語の「FEEDBACK」は付けない）', () => {
  assert.ok(INDEX.includes('<span class="fb-panel-title">サイトへのご意見</span>'));
  assert.ok(!/fb-panel-title">[^<]*FEEDBACK/.test(INDEX));
});

test('「この条件で通知」の案内は日本語の「準備中です — …」で、英語の「Coming Soon」は出さない', () => {
  const messages = [];
  const ctx = load(['showNotifyToast'], { showToast: (m) => messages.push(m) });
  vm.runInContext('showNotifyToast()', ctx);
  assert.deepStrictEqual(messages, ['準備中です — SNSをフォローして最新情報をチェック！']);
});

// ── 5. 直した英語の文字列が戻っていない ─────────────────────────────────
test('直した英語の文字列が index.html に戻っていない', () => {
  const banned = [
    ['<span class="fl">Genre</span>', 'ジャンルの絞り込みの見出し'],
    ['data-f="all">All</div>', 'ジャンルの先頭の選択肢（HTML の初期値）'],
    ["'\" data-f=\"' + g + '\">' + g + '</div>'", 'ジャンルの選択肢（先頭が「All」と出る組み立て）'],
    ['<span class="cap-label">Capacity</span>', '収容人数の見出し'],
    ["item.count + ' views'", 'ランキングの閲覧数'],
    ['Coming Soon', '通知の案内'],
    ['FEEDBACK — ', 'ご意見パネルの見出し'],
  ];
  for (const [text, what] of banned) assert.ok(!INDEX.includes(text), `${what}に英語の表示が戻っている: ${text}`);
});
