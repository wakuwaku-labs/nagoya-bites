'use strict';
/**
 * tests/index_japanese_labels.test.js — I-07（UI・UX改修 段階1a）。I-20 で絞り込みの画面が「絞り込みシート」に変わったのに合わせて更新。
 *
 * トップ（index.html）の画面に出る英語の表示を日本語にした決まりを確かめる。
 *   1. 絞り込みシート・条件の札・条件帯・0 軒の案内: 見出し（エリア・ジャンル・予算・シーン・こだわり・人数）、ボタン
 *      （条件を外す／条件を選んでください／条件を外して閉じる／読み込み中…／N軒を見る／該当するお店がありません／もっと見る（+N））、
 *      札の語（保存済み／N名以上／条件なし）、0 軒の案内（次の条件を外すと、お店が見つかります。／◯◯を外す（+N軒））がすべて日本語。
 *      期待する語は EXPECTED_LABELS の 1 つの表に置く。さらに「画面に出る文字に、英字 2 文字以上の連なりが無い」という一般規則を、
 *      実物のコードが作った文字すべてに掛ける（表にない語が英語で紛れ込んでも見つかる）
 *   2. 内部の値「All」は画面にもハッシュにも出ない。ジャンルのボタンは代表ジャンルの名前が値と文字を兼ね、
 *      押したときは data-k / data-v を見て文字を見ない（文字を日本語にしても壊れない）
 *   3. よく見られている店（I-24 から scripts/build_top_picks.js が描く）: 閲覧数は「{N}日で{n}回閲覧」。折り返すときは「・」の後だけで、「12回閲／覧」のように途中で割れない（CSS）
 *   4. リール動画つきのカードの印は「リール」、ご意見パネルの見出しは「サイトへのご意見」。
 *      押しても準備中としか出ない「この条件で通知」は I-24 で外した（戻っていない）
 *   5. 直した英語の文字列が index.html に戻っていない
 *
 * index.html から実物の関数（nbRenderFilterSheet・nbSheetFooterState・nbSheetUpdateFooter・updateFilterUI・nbEmptySuggestHtml・initPillFold ほか）と
 * NB-FILTER-POLICY・NB-FILTER の区画を取り出し、偽の DOM の上で動かす。
 * 実ブラウザでの確認は docs/qa/uiux-2026-10/e2e_labels.js。
 * 範囲の外: フッターの「Daily Journal」・パンくず先頭の「TOP」など、全ページ共通の表記は共通クローム
 * （scripts/lib/site_chrome.js）が持つので、別の課題 I-07b で直した（tests/chrome_japanese_labels.test.js）。
 * 範囲の外: シートの開閉・件数・下書きの動き（tests/index_filter_sheet.test.js）。ここは「出る言い方」だけを見る。
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
// 開き要素の位置から、対応する閉じ要素の直後までの文字列（入れ子を数える）
function balanced(src, from, tag) {
  const re = new RegExp('<(/?)' + tag + '\\b', 'g');
  re.lastIndex = from;
  let depth = 0, m;
  while ((m = re.exec(src))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return src.slice(from, src.indexOf('>', m.index) + 1);
  }
  throw new Error('<' + tag + '> の閉じが見つからない');
}

// 絞り込みの核とシートのコード（実物）。NB_SHEET の定数は「var NB_SHEET = {」から NB_SHEET_PICKS の終わりまで
const SHEET_CONSTS = region('var NB_SHEET = {', '\n];');
const SOURCE = [
  region('/* NB-FILTER-POLICY:START */', '/* NB-FILTER-POLICY:END */'),
  region('var GENRE_ORDER = ', '];'),
  region('var GENRE_RULES = [', '\n];'),
  region('// NB-FILTER:START', '// NB-FILTER:END'),
  SHEET_CONSTS,
  ['normalizeGenre', 'initPillFold', 'nbEscHtml', 'nbSheetChip', 'nbSheetSection', 'nbRenderFilterSheet', 'nbSheetQuery',
    'nbSheetFooterState', 'nbSheetUpdateFooter', 'nbActiveConditions', 'nbSetBadge', 'nbSyncFavNav', 'nbZeroIsProvisional',
    'nbEmptySuggestHtml', 'updateFilterUI'].map(fnSource).join('\n'),
].join('\n');
// ハッシュを作る関数（NB-HISTORY の区画の中。区画全体は window を要るので、この関数だけ取り出す）
const BUILD_HASH = (() => {
  const block = region('// NB-HISTORY:START', '// NB-HISTORY:END');
  const a = block.indexOf('\nfunction nbBuildHash(') + 1;
  const b = block.indexOf('\n}\n', a);
  assert.ok(a > 0 && b > a, 'nbBuildHash が見つからない');
  return block.slice(a, b + 2);
})();
// シートのクリック・キーボードの処理（即時実行の関数。wrap にイベントを付ける）
const SHEET_EVENTS = (() => {
  const head = "(function() {\n  var wrap = document.getElementById('filter-sheet-wrap');";
  assert.strictEqual(INDEX.split(head).length - 1, 1, 'シートのクリック処理は 1 か所だけ');
  const a = INDEX.indexOf(head);
  const b = INDEX.indexOf('\n})();', a);
  assert.ok(b > a, 'シートのクリック処理の終わりが見つからない');
  return INDEX.slice(a, b + 6);
})();

// ── 期待する語（1 つの表）─────────────────────────────────────────────
const EXPECTED_LABELS = {
  // 絞り込みシートの見出しとヒント（表示の順）
  sheetSections: [
    ['エリア', '複数選べます'],
    ['ジャンル', ''],
    ['予算', ''],
    ['シーン', ''],
    ['こだわり', ''],
    ['人数', '宴会で入れる人数'],
  ],
  sheetOther: 'そのほかの条件',
  budget: ['3,000円以下', '3,001〜5,000円', '5,001円以上'],
  caps: ['10名以上', '20名以上', '30名以上', '50名以上'],
  // 下の主ボタン（nbSheetFooterState）と、読み上げの文（#fs-live）
  footer: {
    loading: '読み込み中…',
    choose: '条件を選んでください',
    clearAndClose: '条件を外して閉じる',
    none: '該当するお店がありません',
    see: (n) => n + '軒を見る',
    live: (n) => n + '軒が当てはまります',
  },
  // 折りたたみ（initPillFold）
  fold: {
    more: (n) => 'もっと見る（+' + n + '） <span class="fa">▾</span>',
    less: '閉じる <span class="fa">▾</span>',
  },
  // 条件の札と条件帯（updateFilterUI）
  strip: {
    favs: '保存済み',
    cap: (n) => n + '名以上',
    none: '条件なし',
    areaSep: '／',
    query: (q) => '「' + q + '」',
  },
  // 0 軒の案内（nbEmptySuggestHtml・シートの下の提案）
  empty: {
    lead: '次の条件を外すと、お店が見つかります。',
    drop: (label, n) => label + 'を外す（+' + n + '軒）',
  },
  // 0 軒の表示（renderGrid）
  emptyGrid: ['該当するお店が見つかりませんでした', '検索条件を変えるか、フィルターをリセットしてお試しください。', 'フィルターをリセット',
    '保存したお店はまだありません', 'お店のカードのハートを押すと、この端末に保存されます。', '保存済みの表示をやめる'],
  // HTML に書いてある固定の語（id → 画面に出る文字・aria-label）。null は確かめない
  staticTexts: [
    ['filter-toggle-btn', '絞り込み', '絞り込みを開く'],
    ['tb-filter-btn', '絞り込み', null],
    ['clear-all-btn', 'すべてリセット', 'すべてのフィルターをクリア'],
    ['share-filter-btn', 'この条件をシェア', '現在の絞り込み条件をシェアする'],
    ['fs-title', '絞り込み', null],
    ['fs-close', '×', '閉じる（変更は反映されません）'],
    ['fs-reset', '条件を外す', null],
    ['fs-go', '条件を選んでください', null],
  ],
};

// ── 一般規則: 画面に出る文字に、英字 2 文字以上の連なりが無い ─────────────────
// 固有名などで例外が要るときは、理由つきでここに足す（今は 1 つも無い）。例: { word: 'LINE', why: '…' }
const ALLOWED_ASCII = [];
function asciiWords(text) {
  return (String(text).match(/[A-Za-z]{2,}/g) || []).filter((w) => !ALLOWED_ASCII.some((a) => a.word === w));
}
function assertNoEnglish(text, where) {
  assert.deepStrictEqual(asciiWords(text), [], `${where} に英語の表示が混ざっている: ${text}`);
}
function decodeEntities(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&amp;/g, '&');
}
// 画面に出る文字（要素を取り除き、実体参照を戻す）
function visibleText(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}
const hasJapanese = (s) => /[\u3040-\u30ff\u3400-\u9fff]/.test(s);

test('一般規則の確かめ: 英字 2 文字以上の連なりを見つけ、数字・記号・日本語は見逃さず誤検出もしない', () => {
  assert.deepStrictEqual(asciiWords('All'), ['All']);
  assert.deepStrictEqual(asciiWords('Genre と 条件'), ['Genre']);
  assert.deepStrictEqual(asciiWords('もっと見る（+10） ▾ 3,001〜5,000円 N 軒 ×'), []);
  assert.deepStrictEqual(asciiWords(visibleText('<span class="fa">▾</span>&ldquo;焼肉&rdquo; &amp; &lt;')), []);
});

// ── 偽の DOM ───────────────────────────────────────────────────────────
function makeClassList() {
  const cls = new Set();
  return {
    add: (c) => { cls.add(c); },
    remove: (c) => { cls.delete(c); },
    contains: (c) => cls.has(c),
    toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); return cls.has(c); },
  };
}
function makeEl(extra) {
  return Object.assign({ style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', hidden: false, disabled: false, classList: makeClassList(), setAttribute() {}, getAttribute: () => null }, extra || {});
}

// シートの中身（#fs-body の innerHTML）から、実物が探しに来る「チップの行（fs-row-*）」と「もっと見るボタン（fs-fold-*）」の偽物を作る
function sheetPart(html, id) {
  const row = /^fs-row-(.+)$/.exec(id);
  if (row) {
    const m = new RegExp('<div class="fs-chips" id="fs-row-' + row[1] + '"(?: data-fold="(\\d+)")?>([\\s\\S]*?)</div>').exec(html);
    if (!m) return null;
    const chips = parseChips(m[2]).map((c) => ({
      extra: c.extra, label: c.label,
      getAttribute: (n) => (n === 'data-k' ? c.k : n === 'data-v' ? c.v : null),
    }));
    return makeEl({
      children: chips,
      getAttribute: (n) => (n === 'data-fold' ? m[1] || null : null),
      querySelectorAll: (sel) => (sel === '.fs-extra' ? chips.filter((c) => c.extra) : []),
    });
  }
  const fold = /^fs-fold-(.+)$/.exec(id);
  if (fold && html.indexOf('id="fs-fold-' + fold[1] + '"') >= 0) {
    const attrs = {};
    const btn = makeEl({ setAttribute: (n, v) => { attrs[n] = v; }, getAttribute: (n) => (n in attrs ? attrs[n] : null), attrs });
    btn.click = () => { if (btn.onclick) btn.onclick(); };
    return btn;
  }
  return null;
}
// シートのチップ（button.fs-chip）を読み出す
function parseChips(html) {
  const out = [];
  const re = /<button type="button" class="fs-chip( fs-extra)?" data-k="([^"]*)" data-v="([^"]*)" aria-pressed="(true|false)">([^<]*)<\/button>/g;
  let m;
  while ((m = re.exec(html))) out.push({ extra: !!m[1], k: decodeEntities(m[2]), v: decodeEntities(m[3]), pressed: m[4], label: decodeEntities(m[5]) });
  return out;
}
// シート全体を見出しごとに読み出す
function parseSheet(html) {
  const out = [];
  const re = /<section class="fs-sec" id="fs-sec-([a-z]+)"><h3 class="fs-h">([^<]*)(?:<span class="fs-hint">([^<]*)<\/span>)?<\/h3>([\s\S]*?)<\/section>/g;
  let m;
  while ((m = re.exec(html))) {
    const fold = /data-fold="(\d+)"/.exec(m[4]);
    out.push({ id: m[1], title: decodeEntities(m[2]), hint: decodeEntities(m[3] || ''), chips: parseChips(m[4]), fold: fold ? Number(fold[1]) : 0 });
  }
  return out;
}

// ── 実物のコードを読み込んだ偽のブラウザ ─────────────────────────────────
const plain = (x) => JSON.parse(JSON.stringify(x));
const PROBE = vm.createContext({ console });
vm.runInContext(SOURCE.split('\nfunction normalizeGenre(')[0], PROBE); // 表（ポリシー・ジャンル・タグ）だけ読む
const POLICY = plain(PROBE.NB_FILTER_POLICY);
const GENRES = plain(PROBE.GENRE_ORDER);
const AREAS = POLICY.areas.map((a) => a.slug);
const condLabel = (slug) => POLICY.conds.find((c) => c.slug === slug).label;
const areaLabel = (slug) => POLICY.areas.find((a) => a.slug === slug).label;
// 数える店。エリアの原文は、各群の match の 1 つ（ポリシーの表どおりに群へ入る）
const matchOf = (i) => POLICY.areas[i].match[0];
const STORES = [
  { 店名: 'A', ジャンル: '居酒屋', エリア: matchOf(1), 個室: 'あり' },
  { 店名: 'B', ジャンル: '居酒屋', エリア: matchOf(1), 個室: 'なし' },
  { 店名: 'C', ジャンル: '焼肉・ホルモン', エリア: matchOf(2), 個室: 'あり' },
  { 店名: 'D', ジャンル: 'ラーメン', エリア: matchOf(3), 個室: 'なし' },
];

function load(opt) {
  opt = opt || {};
  const registry = {};
  const body = makeEl();
  let bodyHtml = '';
  let parts = {};
  Object.defineProperty(body, 'innerHTML', { get: () => bodyHtml, set: (v) => { bodyHtml = String(v); parts = {}; } });
  registry['fs-body'] = body;
  registry.si = makeEl({ value: opt.q || '' });
  const document = {
    getElementById(id) {
      if (Object.prototype.hasOwnProperty.call(registry, id)) return registry[id];
      if (/^fs-(row|fold)-/.test(id)) {
        if (!(id in parts)) parts[id] = sheetPart(bodyHtml, id);
        return parts[id];
      }
      return (registry[id] = makeEl());
    },
  };
  const ctx = vm.createContext({
    document, console,
    ALL_STORES: opt.stores || STORES, FILTERED: [],
    FULL_CATALOG_LOADED: opt.loaded !== false, FULL_CATALOG_FAILED: !!opt.failed,
    SHOW_FAVS_ONLY: !!opt.favs, getFavs: () => opt.favNames || [],
    nbUpdateSearchClearVisibility() {}, nbRunSearch: (list, q) => (q ? list.filter((s) => String(s['店名']).indexOf(q) >= 0) : list), NB_SEARCH_META: null, priceToNum: () => 0, SCENE_ALIAS: {},
  });
  vm.runInContext(SOURCE, ctx);
  vm.runInContext(BUILD_HASH, ctx);
  ctx.NB_FILTER = ctx.nbEmptyFilter();
  const env = {
    ctx, registry, document,
    // 絞り込みシートを開いた状態にして中身を作る（draft は下書き）
    open(draft) {
      ctx.NB_SHEET.open = true;
      ctx.NB_SHEET.draft = ctx.nbNormalizeFilter(Object.assign(ctx.nbEmptyFilter(), draft || {}));
      ctx.nbRenderFilterSheet();
    },
    html: () => bodyHtml,
    sections: () => parseSheet(bodyHtml),
    section: (id) => parseSheet(bodyHtml).find((s) => s.id === id),
    // 描かれた「もっと見る」ボタン（initPillFold が文字を入れたもの）
    foldButton: (id) => document.getElementById('fs-fold-' + id),
    setFilter(partial) { ctx.NB_FILTER = ctx.nbNormalizeFilter(Object.assign(ctx.nbEmptyFilter(), partial || {})); },
    footer() { ctx.nbSheetUpdateFooter(); return { label: registry['fs-go'].textContent, disabled: registry['fs-go'].disabled, live: registry['fs-live'].textContent, suggest: registry['fs-suggest'].innerHTML }; },
  };
  return env;
}

// ── 1. 絞り込みシート ───────────────────────────────────────────────────
test('シートの固定の語（見出し・ボタン・aria-label）は日本語で、表のとおりに書いてある', () => {
  const sheetStart = INDEX.indexOf('<div class="filter-sheet-wrap" id="filter-sheet-wrap">');
  assert.ok(sheetStart >= 0, '絞り込みシートの HTML が見つからない');
  const sheetHtml = balanced(INDEX, sheetStart, 'div');
  // 画面に出る文字と、読み上げに使われる属性（aria-label・title・placeholder・alt）に、英語が無い
  assertNoEnglish(visibleText(sheetHtml), 'シートの固定の文字');
  (sheetHtml.match(/\b(?:aria-label|title|placeholder|alt)="[^"]*"/g) || []).forEach((a) => assertNoEnglish(a.replace(/^[a-z-]+=/, ''), 'シートの属性 ' + a));
  EXPECTED_LABELS.staticTexts.forEach(([id, text, aria]) => {
    const open = new RegExp('<(button|h2|h3|span|div)\\b[^>]*\\bid="' + id + '"[^>]*>').exec(INDEX);
    assert.ok(open, '#' + id + ' が見つからない');
    const el = balanced(INDEX, open.index, open[1]);
    assert.ok(visibleText(el).indexOf(text) >= 0, `#${id} の文字に「${text}」がある: ${visibleText(el)}`);
    assertNoEnglish(visibleText(el), '#' + id);
    if (aria) {
      assert.ok(el.indexOf('aria-label="' + aria + '"') >= 0, `#${id} の aria-label は「${aria}」`);
    }
    (el.match(/aria-label="[^"]*"/g) || []).forEach((a) => assertNoEnglish(a.replace(/^aria-label=/, ''), '#' + id + ' の ' + a));
  });
});

test('結果の上の帯（絞り込み結果・件数・シェア）と並べ替えの行（並べ替えの選択肢・表示の切り替え）の固定の語は日本語で、英語が混ざらない', () => {
  const block = (open) => {
    const at = INDEX.indexOf(open);
    assert.ok(at >= 0, open + ' が見つからない');
    return balanced(INDEX, at, 'div');
  };
  const summary = block('<div class="results-summary" id="results-summary"');
  assert.ok(visibleText(summary).indexOf('絞り込み結果') === 0, '帯の見出しは「絞り込み結果」');
  assert.ok(/<em id="results-summary-count">--<\/em>件 のお店/.test(summary), '件数の言い方は「N件 のお店」');
  assert.ok(visibleText(summary).indexOf('この条件をシェア') >= 0);
  const sortBar = block('<div class="sort-bar sticky-sort" id="sort-bar"');
  const options = Array.from(sortBar.matchAll(/<option value="([^"]+)"[^>]*>([^<]*)<\/option>/g)).map((m) => [m[1], m[2]]);
  assert.deepStrictEqual(options, [
    ['recommend', 'おすすめ順'], ['view-desc', '人気順'], ['trend-desc', '話題沸騰順'], ['new-desc', '新着順'],
    ['price-asc', '予算が安い順'], ['price-desc', '予算が高い順'], ['cc-desc', '口コミ信頼度順'],
  ]);
  [['結果の上の帯', summary], ['並べ替えの行', sortBar]].forEach(([name, html]) => {
    assertNoEnglish(visibleText(html), name + 'の文字');
    (html.match(/\b(?:aria-label|title|placeholder|alt)="[^"]*"/g) || []).forEach((a) => assertNoEnglish(a.replace(/^[a-z-]+=/, ''), name + 'の属性 ' + a));
  });
});

test('シートの中身: 見出しとヒントは決まった順の日本語（エリア・ジャンル・予算・シーン・こだわり・人数）', () => {
  const env = load();
  env.open();
  assert.deepStrictEqual(env.sections().map((s) => [s.title, s.hint]), EXPECTED_LABELS.sheetSections);
});

test('シートの中身: ボタンの文字はすべて日本語を含み、英語が混ざらない（エリア・ジャンル・予算・シーン・こだわり・人数・そのほか）', () => {
  const env = load({ stores: GENRES.map((g) => ({ 店名: g, ジャンル: g })) });
  // 「そのほかの条件」も出す（シートにボタンの無い条件・タグ）
  env.open({ tags: ['個室', '〜1000円'], conds: ['group-30'], cap: 35 });
  const secs = env.sections();
  assert.ok(secs.length === EXPECTED_LABELS.sheetSections.length + 1, '「そのほかの条件」を含めて 7 つの見出し');
  secs.forEach((s) => {
    assert.ok(s.chips.length > 0, s.title + ' にボタンがある');
    s.chips.forEach((c) => {
      assert.ok(hasJapanese(c.label), `${s.title}のボタン「${c.label}」に日本語が無い`);
      assertNoEnglish(c.label, `${s.title}のボタン`);
    });
  });
  assertNoEnglish(visibleText(env.html()), 'シートの中身');
});

test('シートの中身: 予算は 3 つ、人数は 10・20・30・50 名以上（単位まで日本語）。ボタンに無い人数は「N名以上」で足す', () => {
  const env = load();
  env.open();
  assert.deepStrictEqual(env.section('budget').chips.map((c) => c.label), EXPECTED_LABELS.budget);
  assert.deepStrictEqual(env.section('cap').chips.map((c) => c.label), EXPECTED_LABELS.caps);
  assert.ok(!/Capacity/i.test(env.html()));
  const env2 = load();
  env2.open({ cap: 35 });
  assert.deepStrictEqual(env2.section('cap').chips.map((c) => c.label), ['10名以上', '20名以上', '30名以上', '35名以上', '50名以上']);
});

test('シートの中身: 「そのほかの条件」は、ボタンの無い条件（以前のリンクのタグ・ハブの条件）を日本語の名前で出す。無ければ出さない', () => {
  const env = load();
  env.open({ tags: ['個室'], conds: ['group-30'] });
  const other = env.section('other');
  assert.ok(other, '見出しがある');
  assert.strictEqual(other.title, EXPECTED_LABELS.sheetOther);
  assert.deepStrictEqual(other.chips.map((c) => c.label).sort(), ['個室', condLabel('group-30')].sort());
  const none = load();
  none.open({ conds: ['koshitsu'] });
  assert.strictEqual(none.section('other'), undefined, 'ボタンのある条件だけなら出さない');
});

test('ボタンの値（data-v）は内部の値（エリア・条件は slug、人数は数字、タグ・ジャンルはその名前）で、画面の日本語の名前とは別。種類は data-k が持つ', () => {
  const env = load({ stores: GENRES.map((g) => ({ 店名: g, ジャンル: g })) });
  env.open({ tags: ['個室'], conds: ['group-30'], cap: 35 });
  const all = [].concat(...env.sections().map((s) => s.chips.map((c) => Object.assign({ sec: s.id }, c))));
  assert.ok(all.length > 40, 'ボタンが十分にある');
  const condSlugs = POLICY.conds.map((c) => c.slug).concat(['budget-3001-5000']);
  all.forEach((c) => {
    const where = `${c.sec}「${c.label}」`;
    assert.ok(['area', 'genre', 'cond', 'tag', 'cap'].indexOf(c.k) >= 0, where + ' の data-k');
    if (c.k === 'area') {
      assert.ok(AREAS.indexOf(c.v) >= 0, where + ' の値はエリアの slug');
      assert.strictEqual(c.label, areaLabel(c.v));
      assert.notStrictEqual(c.v, c.label, where + ' の値が画面の文字になっている');
    } else if (c.k === 'cond') {
      assert.ok(condSlugs.indexOf(c.v) >= 0, where + ' の値は条件の slug');
      assert.notStrictEqual(c.v, c.label, where + ' の値が画面の文字になっている');
    } else if (c.k === 'cap') {
      assert.ok(/^\d+$/.test(c.v), where + ' の値は数字');
      assert.strictEqual(c.label, c.v + '名以上');
    } else {
      assert.strictEqual(c.label, c.v, where + ' は名前そのものが値');
    }
  });
  // 見出しごとの種類: エリアは area、ジャンルは genre、予算は cond、シーンは tag、人数は cap
  const kindOf = (id) => Array.from(new Set(env.section(id).chips.map((c) => c.k)));
  assert.deepStrictEqual(kindOf('area'), ['area']);
  assert.deepStrictEqual(kindOf('genre'), ['genre']);
  assert.deepStrictEqual(kindOf('budget'), ['cond']);
  assert.deepStrictEqual(kindOf('scene'), ['tag']);
  assert.deepStrictEqual(kindOf('cap'), ['cap']);
});

test('ジャンルのボタン: 代表ジャンルの順で、値（data-v）と文字が同じ。内部の値「All」の選択肢は無い', () => {
  const env = load({ stores: GENRES.map((g) => ({ 店名: g, ジャンル: g })) });
  env.open();
  const chips = env.section('genre').chips;
  assert.deepStrictEqual(chips.map((c) => c.v), GENRES, '代表ジャンルの順・全ジャンル');
  chips.forEach((c) => {
    assert.strictEqual(c.k, 'genre');
    assert.strictEqual(c.label, c.v, '値と文字が同じ');
  });
  assert.ok(!chips.some((c) => /^all$/i.test(c.v) || /^all$/i.test(c.label)), '「All」のボタンは無い');
  // 載っているジャンルと、いま選んでいるジャンルだけを出す
  const some = load();
  some.open({ genre: '寿司' });
  assert.deepStrictEqual(some.section('genre').chips.map((c) => c.v), ['居酒屋', '焼肉・ホルモン', '寿司', 'ラーメン']);
});

test('もっと見る: ラベルは「もっと見る（+N） ▾」と「閉じる ▾」。N は隠れる数（ジャンル・シーン・こだわり）。隠れる側が選ばれていれば最初から開く', () => {
  const env = load({ stores: GENRES.map((g) => ({ 店名: g, ジャンル: g })) });
  env.open();
  ['genre', 'scene', 'pick'].forEach((id) => {
    const s = env.section(id);
    assert.ok(s.fold > 0 && s.chips.length > s.fold, id + ' は折りたたまれる');
    assert.strictEqual(env.foldButton(id).innerHTML, EXPECTED_LABELS.fold.more(s.chips.length - s.fold), id);
    assertNoEnglish(visibleText(env.foldButton(id).innerHTML), id + ' のもっと見る');
  });
  // 押すと「閉じる」、もう一度押すと元に戻る
  const btn = env.foldButton('genre');
  btn.click();
  assert.strictEqual(btn.innerHTML, EXPECTED_LABELS.fold.less);
  btn.click();
  assert.strictEqual(btn.innerHTML, EXPECTED_LABELS.fold.more(env.section('genre').chips.length - env.section('genre').fold));
  // 隠れる側のボタン（シーンの 8 番目以降）が選ばれていれば、最初から開いている
  const open = load();
  open.open({ tags: ['推し活'] });
  assert.strictEqual(open.foldButton('scene').innerHTML, EXPECTED_LABELS.fold.less, '最初から開いている');
});

test('initPillFold: 数が少なければボタンを隠し、多ければ「もっと見る（+N）」を出す（N = 全体 - しきい値）', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fnSource('initPillFold'), ctx);
  const make = () => {
    const attrs = {};
    return {
      container: { classList: makeClassList() },
      btn: { style: {}, innerHTML: '', setAttribute: (n, v) => { attrs[n] = v; }, attrs },
    };
  };
  const few = make();
  ctx.initPillFold(few.container, few.btn, 8, 8);
  assert.strictEqual(few.btn.style.display, 'none');
  const many = make();
  ctx.initPillFold(many.container, many.btn, 12, 8);
  assert.strictEqual(many.btn.innerHTML, 'もっと見る（+4） <span class="fa">▾</span>');
  assert.strictEqual(many.btn.attrs['aria-expanded'], 'false');
  many.btn.onclick();
  assert.strictEqual(many.btn.innerHTML, '閉じる <span class="fa">▾</span>');
  assert.strictEqual(many.btn.attrs['aria-expanded'], 'true');
  many.btn.onclick();
  assert.strictEqual(many.btn.innerHTML, 'もっと見る（+4） <span class="fa">▾</span>');
});

// ── 下の主ボタンの言い方 ──────────────────────────────────────────────────
test('下の主ボタン: 状態ごとの文言は表のとおりの日本語（読み込み中／条件を選んでください／条件を外して閉じる／N軒を見る／該当するお店がありません）', () => {
  const F = EXPECTED_LABELS.footer;
  // 全店のデータが届く前は、数えずに待つ
  const loading = load({ loaded: false });
  loading.open({ conds: ['koshitsu'] });
  assert.deepStrictEqual(loading.footer(), Object.assign(loading.footer(), { label: F.loading, disabled: true }));
  // 何も選んでいないし、いまの条件も無い
  const choose = load();
  choose.open();
  assert.strictEqual(choose.footer().label, F.choose);
  assert.strictEqual(choose.footer().disabled, true);
  // 何も選んでいないが、いまの条件がある（外して閉じる）
  const clear = load();
  clear.setFilter({ conds: ['koshitsu'] });
  clear.open();
  assert.strictEqual(clear.footer().label, F.clearAndClose);
  assert.strictEqual(clear.footer().disabled, false);
  // 当てはまる店がある
  const see = load();
  see.open({ conds: ['koshitsu'] });
  assert.strictEqual(see.footer().label, F.see(2));
  assert.strictEqual(see.footer().live, F.live(2));
  assert.strictEqual(see.footer().disabled, false);
  // 当てはまる店が無い
  const none = load();
  none.open({ genre: 'ラーメン', conds: ['koshitsu'] });
  assert.strictEqual(none.footer().label, F.none);
  assert.strictEqual(none.footer().disabled, true);
  assert.strictEqual(none.footer().live, F.none, '読み上げも同じ文');
  [loading, choose, clear, see, none].forEach((e) => {
    const f = e.footer();
    assertNoEnglish(f.label, '主ボタン');
    assertNoEnglish(f.live, '読み上げ');
    assertNoEnglish(visibleText(f.suggest), '提案');
  });
});

test('下の提案ボタン: 0 軒のとき「◯◯を外す（+N軒）」を、増える軒数の多い順に日本語で出す（値は data-k / data-v）', () => {
  const env = load();
  env.open({ genre: 'ラーメン', conds: ['koshitsu'] });
  const f = env.footer();
  const items = Array.from(f.suggest.matchAll(/<button type="button" class="fs-suggest-btn" data-k="([^"]*)" data-v="([^"]*)">([^<]*)<\/button>/g))
    .map((m) => ({ k: m[1], v: decodeEntities(m[2]), text: decodeEntities(m[3]) }));
  // ラーメンを外すと 個室ありの 2 軒、個室ありを外すとラーメンの 1 軒
  assert.deepStrictEqual(items, [
    { k: 'genre', v: 'ラーメン', text: EXPECTED_LABELS.empty.drop('ラーメン', 2) },
    { k: 'cond', v: 'koshitsu', text: EXPECTED_LABELS.empty.drop(condLabel('koshitsu'), 1) },
  ]);
  items.forEach((i) => assertNoEnglish(i.text, '提案ボタン'));
});

// ── 条件の札・条件帯 ───────────────────────────────────────────────────────
test('条件の札と条件帯: 保存済み・エリア・ジャンル・条件・タグ・N名以上・検索語がすべて日本語で並ぶ。無ければ「条件なし」', () => {
  const S = EXPECTED_LABELS.strip;
  const env = load({ favs: true, q: '焼肉' });
  env.setFilter({ genre: '居酒屋', areas: [AREAS[1], AREAS[2]], conds: ['koshitsu', 'late-night'], tags: ['デート'], cap: 20 });
  env.ctx.updateFilterUI();
  const chips = Array.from(env.registry['active-chips'].innerHTML.matchAll(/<span class="chip" data-clear="([a-z]+)"[^>]*>([\s\S]*?) <span class="chip-x">×<\/span><\/span>/g))
    .map((m) => [m[1], decodeEntities(m[2])]);
  assert.deepStrictEqual(chips, [
    ['favs', S.favs],
    ['area', areaLabel(AREAS[1])],
    ['area', areaLabel(AREAS[2])],
    ['genre', '居酒屋'],
    ['cond', condLabel('koshitsu')],
    ['cond', condLabel('late-night')],
    ['tag', 'デート'],
    ['cap', S.cap(20)],
    ['q', '“焼肉”'],
  ]);
  const pills = Array.from(env.registry['results-summary-cond'].innerHTML.matchAll(/<span class="rs-pill">([^<]*)<\/span>/g)).map((m) => decodeEntities(m[1]));
  assert.deepStrictEqual(pills, [
    S.favs,
    areaLabel(AREAS[1]) + S.areaSep + areaLabel(AREAS[2]),
    '居酒屋', condLabel('koshitsu'), condLabel('late-night'), 'デート', S.cap(20), S.query('焼肉'),
  ]);
  assertNoEnglish(visibleText(env.registry['active-chips'].innerHTML), '条件の札');
  assertNoEnglish(visibleText(env.registry['results-summary-cond'].innerHTML), '条件帯');
  // 条件が無いとき
  const empty = load();
  empty.ctx.updateFilterUI();
  assert.strictEqual(empty.registry['active-chips'].innerHTML, '');
  assert.strictEqual(visibleText(empty.registry['results-summary-cond'].innerHTML), S.none);
});

// ── 0 軒の案内 ─────────────────────────────────────────────────────────────
test('0 軒の案内: 「次の条件を外すと、お店が見つかります。」と「◯◯を外す（+N軒）」。値は data-k / data-v で持つ', () => {
  const env = load();
  env.setFilter({ genre: 'ラーメン', conds: ['koshitsu'] });
  const html = env.ctx.nbEmptySuggestHtml();
  assert.ok(html.indexOf('<p class="empty-suggest-lead">' + EXPECTED_LABELS.empty.lead + '</p>') >= 0, html);
  const items = Array.from(html.matchAll(/<button type="button" class="fs-suggest-btn" data-k="([^"]*)" data-v="([^"]*)">([^<]*)<\/button>/g)).map((m) => [m[1], decodeEntities(m[2]), decodeEntities(m[3])]);
  assert.deepStrictEqual(items, [
    ['genre', 'ラーメン', EXPECTED_LABELS.empty.drop('ラーメン', 2)],
    ['cond', 'koshitsu', EXPECTED_LABELS.empty.drop(condLabel('koshitsu'), 1)],
  ]);
  assertNoEnglish(visibleText(html), '0 軒の案内');
  // 検索語で 0 軒になったときは、検索語を外す案も「「◯◯」を外す（+N軒）」の言い方で出す（値は data-k=q・検索語）
  const withQuery = load({ q: '存在しない店' });
  withQuery.setFilter({ conds: ['koshitsu'] });
  const qHtml = withQuery.ctx.nbEmptySuggestHtml();
  const qItems = Array.from(qHtml.matchAll(/<button type="button" class="fs-suggest-btn" data-k="([^"]*)" data-v="([^"]*)">([^<]*)<\/button>/g)).map((m) => [m[1], decodeEntities(m[2]), decodeEntities(m[3])]);
  assert.deepStrictEqual(qItems, [['q', '存在しない店', '「存在しない店」を外す（+2軒）']]);
  assertNoEnglish(visibleText(qHtml), '検索語を外す案');
  // 外しても増えない条件しか無い（提案が無い）ときは、案内ごと出さない
  const noSuggest = load({ stores: [] });
  noSuggest.setFilter({ genre: 'ラーメン' });
  assert.strictEqual(noSuggest.ctx.nbEmptySuggestHtml(), '');
});

test('0 軒の表示（renderGrid）の文言は日本語で、案内の部品（nbEmptySuggestHtml）を呼んでいる', () => {
  const src = fnSource('renderGrid');
  EXPECTED_LABELS.emptyGrid.forEach((s) => {
    assert.ok(src.includes(s), `renderGrid に「${s}」が無い`);
    assertNoEnglish(s, '0 軒の表示の文言');
  });
  assert.ok(src.includes('nbEmptySuggestHtml()'), '外すと見つかる条件の案内を呼んでいる');
});

// ── 2. 内部の値と、押したときの読み方 ───────────────────────────────────────
test('内部の値「All」は画面にもハッシュにも出ない（ジャンルを選んでいなければハッシュに載せず、札も出さない）', () => {
  const env = load();
  env.ctx.updateFilterUI();
  assert.strictEqual(env.registry['active-chips'].innerHTML, '', '札に出ない');
  assert.ok(!/all/i.test(visibleText(env.registry['results-summary-cond'].innerHTML)), '条件帯に出ない');
  assert.strictEqual(env.ctx.nbBuildHash(), '#', 'ハッシュに載せない');
  assert.ok(!/genre=All/i.test(env.ctx.nbBuildHash('J001')));
  // ジャンルを選んで戻すと、内部の値は All に戻る（ハッシュにも載らない）
  const toggled = plain(env.ctx.nbToggleFilter(env.ctx.nbToggleFilter(env.ctx.nbEmptyFilter(), 'genre', '居酒屋'), 'genre', '居酒屋'));
  assert.strictEqual(toggled.genre, 'All');
  env.ctx.NB_FILTER = env.ctx.nbEmptyFilter();
  env.setFilter({ genre: '居酒屋' });
  assert.strictEqual(env.ctx.nbBuildHash(), '#genre=' + encodeURIComponent('居酒屋'));
});

test('シートのボタンを押したときは、文字ではなく data-k / data-v を見る（文字を日本語にしても、別の文字に変えても動きが変わらない）', () => {
  const handlers = {};
  const wrap = { addEventListener: (type, fn) => { handlers[type] = fn; } };
  const calls = { sync: 0, close: 0, commit: 0 };
  const go = { disabled: false, focus() {} };
  const ctx = vm.createContext({
    document: { getElementById: (id) => (id === 'filter-sheet-wrap' ? wrap : id === 'fs-go' ? go : null) },
    nbSheetSync: () => { calls.sync++; }, nbCloseFilterSheet: () => { calls.close++; }, nbCommitFilterSheet: () => { calls.commit++; },
    console,
  });
  vm.runInContext(SOURCE.split('\nfunction normalizeGenre(')[0], ctx); // 条件を計算する部品（nbToggleFilter など）
  vm.runInContext(fnSource('normalizeGenre'), ctx);
  vm.runInContext(SHEET_EVENTS, ctx);
  assert.strictEqual(typeof handlers.click, 'function', 'クリックを受ける');
  ctx.NB_SHEET.open = true;
  ctx.NB_SHEET.draft = ctx.nbEmptyFilter();
  // 画面の文字とは無関係な文字を持たせても、data-k / data-v のとおりに動く
  const press = (selector, attrs) => {
    const el = { textContent: '押した要素の文字は見ない', innerText: 'x', getAttribute: (n) => (n in attrs ? attrs[n] : null) };
    handlers.click({ target: { id: '', closest: (sel) => (sel === selector ? el : null) } });
  };
  const draft = () => plain(ctx.NB_SHEET.draft);
  press('.fs-chip', { 'data-k': 'genre', 'data-v': '居酒屋' });
  press('.fs-chip', { 'data-k': 'area', 'data-v': AREAS[0] });
  press('.fs-chip', { 'data-k': 'cond', 'data-v': 'koshitsu' });
  press('.fs-chip', { 'data-k': 'tag', 'data-v': 'デート' });
  press('.fs-chip', { 'data-k': 'cap', 'data-v': '20' });
  assert.deepStrictEqual(draft(), { genre: '居酒屋', areas: [AREAS[0]], conds: ['koshitsu'], tags: ['デート'], cap: 20 });
  assert.strictEqual(calls.sync, 5, '押すたびに押された状態と件数を更新する');
  // もう一度押すと外れる（ジャンルは All に戻る）
  press('.fs-chip', { 'data-k': 'genre', 'data-v': '居酒屋' });
  press('.fs-chip', { 'data-k': 'cond', 'data-v': 'koshitsu' });
  assert.deepStrictEqual(draft(), { genre: 'All', areas: [AREAS[0]], conds: [], tags: ['デート'], cap: 20 });
  // 提案ボタン（外すと増える条件）も data-k / data-v で条件を外す
  press('.fs-suggest-btn', { 'data-k': 'area', 'data-v': AREAS[0] });
  assert.deepStrictEqual(draft().areas, []);
  // ボタンでないもの（見出しの文字など）を押しても、何も起きない
  const before = JSON.stringify(draft());
  const syncs = calls.sync;
  handlers.click({ target: { id: '', closest: () => null } });
  assert.strictEqual(JSON.stringify(draft()), before);
  assert.strictEqual(calls.sync, syncs);
  // シートが閉じている間は、押しても下書きを変えない
  ctx.NB_SHEET.open = false;
  press('.fs-chip', { 'data-k': 'cond', 'data-v': 'lunch' });
  assert.strictEqual(JSON.stringify(draft()), before);
});

test('絞り込みの内部の値は変えていない: 絞り込み・URL・ハッシュの復元は、ボタンの文字ではなく値（All・data-k・data-v）で比べる', () => {
  // ボタンの文字（textContent・innerText）を読んで絞り込む作りだと、文字を日本語にしたとき壊れる。そういう読み方が無いことを確かめる
  const events = SHEET_EVENTS;
  assert.ok(!/(textContent|innerText)/.test(events), 'シートのクリック処理がボタンの文字を読んでいる');
  assert.ok(!/\.fs-chip\b[^;\n]{0,80}(textContent|innerText)/.test(INDEX), 'fs-chip の文字を読んでいる処理がある');
  assert.ok(!/(textContent|innerText)[^;\n]{0,80}\.fs-chip\b/.test(INDEX), 'fs-chip の文字を読んでいる処理がある');
  assert.ok(/getAttribute\('data-k'\)/.test(events) && /getAttribute\('data-v'\)/.test(events), 'data-k / data-v を読んで条件を決める');
  // 全ジャンルの判定とハッシュは、内部の値「All」で決める
  assert.ok(/genre !== 'All'/.test(fnSource('nbCompileFilter')), 'nbCompileFilter は「All」で全ジャンルを判定する');
  assert.ok(/f\.genre !== 'All'/.test(fnSource('nbFilterParams')), 'URL に載せるかの判定は「All」');
});

// ── 3. よく見られている店（生成器 scripts/lib/top_picks.js の buildViewRanking）──────────────
const TOP_PICKS = require('../scripts/lib/top_picks.js');
function rankingHtml(stores, policy) {
  return TOP_PICKS.buildViewRanking({
    stores,
    policy: Object.assign({ minViewsPerStore: 1, minStoresToShow: 1, maxStores: 10 }, policy),
    lookbackDays: 30,
    pageHref: (s) => 'stores/' + encodeURIComponent(s['店名']) + '.html',
  });
}
function reasons(html) {
  return Array.from(html.matchAll(/<span class="tp-reason"><span>([^<]*)<\/span><\/span>/g)).map((m) => m[1]);
}

test('ランキング: 閲覧数は「30日でn回閲覧」で、英語の「views」は出さない（閲覧数の多い順に10店まで）', () => {
  const stores = [];
  for (let i = 1; i <= 12; i++) stores.push({ 店名: '店' + i, ジャンル: '和食', エリア: '栄', 閲覧数: String(i) });
  const { html } = rankingHtml(stores);
  assert.deepStrictEqual(reasons(html), ['30日で12回閲覧', '30日で11回閲覧', '30日で10回閲覧', '30日で9回閲覧', '30日で8回閲覧', '30日で7回閲覧', '30日で6回閲覧', '30日で5回閲覧', '30日で4回閲覧', '30日で3回閲覧']);
  assert.ok(!/views/i.test(html));
  assert.ok(html.includes('<h2 id="ranking-picks-title">よく見られている店</h2>'));
});

test('ランキング: 閲覧数が0・数字でない店は出さない。下限にそろわなければ区画ごと出さない', () => {
  const some = rankingHtml([
    { 店名: 'A', 閲覧数: '5' }, { 店名: 'B', 閲覧数: '0' }, { 店名: 'C', 閲覧数: 'x' }, { 店名: 'D' },
  ]);
  assert.deepStrictEqual(reasons(some.html), ['30日で5回閲覧']);
  const none = rankingHtml([{ 店名: 'B', 閲覧数: '0' }]);
  assert.strictEqual(none.html, '');
});

test('ランキング: 閲覧数・ジャンル・エリアは項目ごとに折り返し、理由の行は「・」の後だけで折り返す（CSS）', () => {
  // 156〜200px 幅のカードに項目が並ぶ。折り返しを許さないと、長いジャンル名・エリア名の隣で文字ごとに割れる
  const rule = (sel) => {
    const m = INDEX.match(new RegExp('\\n' + sel.replace(/\./g, '\\.').replace(/ /g, '\\s+') + '\\{([^}]*)\\}'));
    assert.ok(m, sel + ' の規則が見つからない');
    return m[1];
  };
  assert.ok(/(^|;)flex-wrap:wrap(;|$)/.test(rule('.tp-meta')), '.tp-meta は項目ごとに折り返す');
  assert.ok(/(^|;)white-space:nowrap(;|$)/.test(rule('.tp-reason span')), '理由の行は、まとまりの途中で折り返さない');
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

test('「この条件で通知」は外した（押しても「準備中です」としか出ないボタンは置かない・I-24）', () => {
  for (const word of ['notify-btn', 'notify-txt', 'showNotifyToast', 'この条件で通知', '準備中です']) {
    assert.ok(!INDEX.includes(word), `index.html に「${word}」が戻っている`);
  }
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
