'use strict';
/**
 * tests/index_top_structure.test.js — トップ（index.html）の構成（I-24・P-399）
 *
 * 最初の画面に「探す入口」と「写真で選べる今日の話題店」を並べた構成が壊れていないことを、構造で確かめる。
 *   1. 生成される 2 つの区画の目印（TREND_PICKS / VIEW_RANKING）が 1 つずつ、順番どおりにある
 *   2. 今日の話題店は最初の画面（検索欄より後・hero の中）、今月の特集は hero の外（直後）
 *   3. 古い描き方（JS が全店から行を作る）と「この条件で通知」が残っていない
 *   4. 行は本物のリンク（stores/*.html か index.html#q=）。写真の alt は店名で、写真が切れたとき店ごとの面に差し替える処理が効く
 *   5. 行をふつうにクリックしたら店の詳細（クイックビュー）を開く。新しいタブ・修飾キー・読み込み前・決められない店はリンク本来の動き
 *   6. 検索中は回遊面（よく見られている店・今月の特集・話題店の行）を隠す
 *
 * 注意: 区画の「中身」がいまのデータと同じかどうかは検査しない。routine の PR（話題店の発掘など）は data/ だけを変えて
 * index.html を作り直さないため、検査すると自動マージが止まる。中身の正しさは tests/top_picks.test.js が部品で確かめ、
 * 作り直しは build.js が毎日行う。ここでは「どんな中身でも守られるべき形」だけを見る。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const TREND = ['<!-- TREND_PICKS_START -->', '<!-- TREND_PICKS_END -->'];
const RANKING = ['<!-- VIEW_RANKING_START -->', '<!-- VIEW_RANKING_END -->'];
const count = (s, sub) => s.split(sub).length - 1;
const region = ([a, b]) => INDEX.slice(INDEX.indexOf(a) + a.length, INDEX.indexOf(b));

// ── 1. 目印 ─────────────────────────────────────────────────────────
test('区画の目印が 1 つずつあり、START → END の順で、話題店 → よく見られている店 の順', () => {
  for (const m of [...TREND, ...RANKING]) assert.strictEqual(count(INDEX, m), 1, m);
  const [ts, te, rs, re] = [TREND[0], TREND[1], RANKING[0], RANKING[1]].map((m) => INDEX.indexOf(m));
  assert.ok(ts < te && te < rs && rs < re, '話題店の区画 → よく見られている店の区画 の順に、重ならない');
});

// ── 2. 配置 ─────────────────────────────────────────────────────────
test('今日の話題店の区画は hero の中（検索欄より後）の .nb-cover-featured にあり、今月の特集はその外（hero の直後）にある', () => {
  const si = INDEX.indexOf('id="si"');
  const featuredDiv = INDEX.indexOf('<div class="nb-cover-featured">');
  const ts = INDEX.indexOf(TREND[0]);
  const te = INDEX.indexOf(TREND[1]);
  assert.ok(si > 0 && featuredDiv > si, '話題店は検索欄より後ろ（最初の画面で検索の次に出る）');
  assert.ok(featuredDiv < ts && ts < te);
  // .nb-cover-featured の中身（話題店の区画の終わりから最初の </div> まで）に今月の特集が入っていない
  const closeDiv = INDEX.indexOf('</div>', te);
  const featuredInner = INDEX.slice(featuredDiv, closeDiv);
  assert.ok(!featuredInner.includes('feature-strip'), '今月の特集は .nb-cover-featured の外');
  // 今月の特集は話題店の後（hero の直後）にあり、hero の外
  const strip = INDEX.indexOf('<section class="feature-strip feature-top"');
  assert.ok(strip > closeDiv, '今月の特集は話題店の後ろ');
  const heroEnd = INDEX.indexOf('</section>', closeDiv);
  assert.ok(heroEnd > 0 && heroEnd < strip, 'hero の </section> の後ろに今月の特集がある');
  assert.ok(!/<h1[\s>]/.test(INDEX.slice(closeDiv, strip)), '見出し h1 は hero の中だけ');
});

test('見出し h1 → 検索欄 の順は変わらない（最初の画面の先頭に見出し）', () => {
  const h1 = INDEX.search(/<h1[\s>]/);
  const si = INDEX.indexOf('id="si"');
  assert.ok(h1 > 0 && h1 < si);
  assert.strictEqual(count(INDEX, 'id="si"'), 1);
  assert.strictEqual(count(INDEX, 'id="si2"'), 1);
  assert.strictEqual(count(INDEX, 'id="hero-suggest"'), 1);
});

// ── 3. 古い描き方・通知が残っていない ───────────────────────────────
test('古い行の描き方（buildTrendRanking / buildRanking）・古い CSS の名前・「この条件で通知」が残っていない', () => {
  const gone = ['trend-ranking-section', 'ranking-section', 'ranking-scroll', 'trend-ranking-date', 'buildTrendRanking', 'buildRanking',
    'rank-card', 'trend-rank-card', 'notify-btn', 'showNotifyToast', 'この条件で通知'];
  for (const g of gone) assert.strictEqual(count(INDEX, g), 0, `${g} が残っている`);
});

// ── 4. 行の形（中身がどうでも守られる形）────────────────────────────
function cards() {
  const html = region(TREND) + '\n' + region(RANKING);
  return html.match(/<a class="tp-card"[^>]*>[\s\S]*?<\/a>/g) || [];
}

test('行は本物のリンク（店舗ページか検索のディープリンク）で、店名・エリア・計測の出どころを持つ', () => {
  for (const c of cards()) {
    const href = (c.match(/ href="([^"]*)"/) || [])[1];
    assert.ok(/^(stores\/[A-Za-z0-9._-]+\.html|index\.html#q=[^"\s]+)$/.test(href), `href: ${href}`);
    assert.ok(/ data-store="[^"]+"/.test(c), 'data-store');
    assert.ok(/ data-area="[^"]*"/.test(c), 'data-area');
    assert.ok(/ data-source="(trend_today|ranking)"/.test(c), 'data-source');
    assert.ok(!/ onclick=|<script/.test(c), '行にインラインのイベントを持たせない');
  }
});

test('行の写真: alt は店名、切れたときは既存の nbImgFallback、先頭以外は遅延読み込み、幅と高さを持つ', () => {
  assert.strictEqual(count(INDEX, '\nfunction nbImgFallback('), 1, 'nbImgFallback が定義されている');
  const imgs = (region(TREND) + region(RANKING)).match(/<img [^>]*>/g) || [];
  for (const img of imgs) {
    assert.ok(img.includes('onerror="nbImgFallback(this)"'), img);
    assert.ok(/ alt="[^"]+"/.test(img) && / width="\d+" height="\d+"/.test(img), img);
    assert.ok(img.includes('decoding="async"'));
  }
  for (const c of cards()) {
    const store = (c.match(/ data-store="([^"]*)"/) || [])[1];
    const alt = (c.match(/<img [^>]* alt="([^"]*)"/) || [])[1];
    if (alt !== undefined) assert.strictEqual(alt, store, '写真の alt は店名（切れたとき店名で店を探して差し替える）');
  }
});

// ── 5. クリックの動き ───────────────────────────────────────────────
function loadHandler(sandbox) {
  const start = INDEX.indexOf('\nfunction nbFindStoreIndex(');
  assert.ok(start > 0, 'nbFindStoreIndex が見つからない');
  const hook = INDEX.indexOf("document.addEventListener('click', function(e) {", start);
  assert.ok(hook > start, 'クリックの処理が見つからない');
  const end = INDEX.indexOf('\n});\n', hook) + 5;
  assert.ok(end > hook);
  vm.runInContext(INDEX.slice(start, end), sandbox);
}
function setup(stores) {
  const handlers = [];
  const opened = [];
  const sandbox = vm.createContext({
    document: { addEventListener: (type, fn) => { if (type === 'click') handlers.push(fn); } },
    openM: (i, source) => opened.push([i, source]),
  });
  if (stores !== undefined) vm.runInContext('var ALL_STORES = ' + JSON.stringify(stores) + ';', sandbox);
  loadHandler(sandbox);
  assert.strictEqual(handlers.length, 1, 'click の処理は 1 つ');
  const click = (attrs, over) => {
    const anchor = { getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null) };
    let prevented = false;
    const e = Object.assign({
      defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
      target: { closest: (sel) => (sel === 'a.tp-card' ? anchor : null) },
      preventDefault() { prevented = true; },
    }, over);
    handlers[0](e);
    return prevented;
  };
  return { click, opened };
}
const STORES = [
  { 店名: 'まるや', エリア: '栄' },
  { 店名: 'まるや', エリア: '大須' },
  { 店名: '小菜一碟', エリア: '東区・相生町' },
];

test('ふつうのクリック: 店が 1 件に決まれば、リンクの移動を止めて店の詳細（クイックビュー）を開く。計測の出どころは行の data-source のまま', () => {
  const { click, opened } = setup(STORES);
  assert.strictEqual(click({ 'data-store': '小菜一碟', 'data-area': '東区・相生町', 'data-source': 'trend_today' }), true);
  assert.deepStrictEqual(opened, [[2, 'trend_today']]);
  assert.strictEqual(click({ 'data-store': '小菜一碟', 'data-source': 'ranking' }), true, 'エリアが無くても店名が 1 件なら決まる');
  assert.deepStrictEqual(opened[1], [2, 'ranking']);
  assert.strictEqual(click({ 'data-store': '小菜一碟' }), true);
  assert.deepStrictEqual(opened[2], [2, 'unknown'], 'data-source が無ければ unknown');
});

test('同名の店が複数: エリアで 1 件に決まれば開く。決まらなければリンク本来の動き（店舗ページへの移動）に任せる', () => {
  const { click, opened } = setup(STORES);
  assert.strictEqual(click({ 'data-store': 'まるや', 'data-area': '大須', 'data-source': 'ranking' }), true);
  assert.deepStrictEqual(opened, [[1, 'ranking']]);
  assert.strictEqual(click({ 'data-store': 'まるや', 'data-area': '名駅', 'data-source': 'ranking' }), false, 'エリアが合わない');
  assert.strictEqual(click({ 'data-store': 'まるや', 'data-source': 'ranking' }), false, 'エリアが無い');
  assert.strictEqual(opened.length, 1);
});

test('リンク本来の動きに任せる場合: 新しいタブ・修飾キー・中クリック・既に止められたクリック・店が見つからない・全店が未読み込み・行の外', () => {
  const { click, opened } = setup(STORES);
  const attrs = { 'data-store': '小菜一碟', 'data-area': '東区・相生町', 'data-source': 'trend_today' };
  for (const over of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }, { defaultPrevented: true }]) {
    assert.strictEqual(click(attrs, over), false, JSON.stringify(over));
  }
  assert.strictEqual(click({ 'data-store': '存在しない店' }), false, '店が見つからない');
  assert.strictEqual(click({}), false, 'data-store が無い');
  assert.strictEqual(click(attrs, { target: { closest: () => null } }), false, '行の外のクリック');
  assert.strictEqual(click(attrs, { target: {} }), false, 'closest を持たない対象');
  assert.strictEqual(click(attrs, { target: null }), false);
  assert.strictEqual(opened.length, 0);
  const notLoaded = setup(undefined); // ALL_STORES がまだ無い（全店の読み込み前）
  assert.strictEqual(notLoaded.click(attrs), false);
  assert.strictEqual(notLoaded.opened.length, 0);
  const empty = setup([]);
  assert.strictEqual(empty.click(attrs), false);
});

test('openM は計測の出どころ（source）を受け取る', () => {
  const sig = INDEX.match(/\nfunction openM\(([^)]*)\)/);
  assert.ok(sig && /\bsource\b/.test(sig[1]), 'function openM(i, source)');
});

// ── 6. 検索中・CSS ──────────────────────────────────────────────────
test('検索中は回遊面（よく見られている店・今月の特集・話題店の行）を隠す', () => {
  assert.ok(/body\.search-active\s+\.nb-cover-featured\s*\{display:none;?\}/.test(INDEX), '話題店の行');
  const list = INDEX.match(/body\.search-active \.feature-strip,[\s\S]*?\{display:none !important;\}/);
  assert.ok(list, '回遊面を隠す規則');
  assert.ok(list[0].includes('body.search-active #ranking-picks'), 'よく見られている店');
  assert.ok(list[0].includes('body.search-active .feature-strip'), '今月の特集');
});

test('ジャーナルのカード: タイトルのリンクがカード全体を覆い、出所のリンクはその上で押せる', () => {
  assert.ok(/\.ljc-link::after\{content:"";position:absolute;inset:0;\}/.test(INDEX), 'タイトルのリンクがカードを覆う');
  assert.ok(/\.latest-journal-card\{[^}]*position:relative/.test(INDEX), '覆う基準はカード');
  assert.ok(/\.ljc-credit\{position:relative;z-index:1;/.test(INDEX), '出所のリンクは覆いの上');
  assert.ok(/\.ljc-link:focus-visible::after\{outline:/.test(INDEX), 'キーボードの焦点がカード全体に見える');
});

test('横に並べる行は、キーボードの焦点の枠（外側 4px）が上下で切れないだけの余白を持つ。縦の一覧に切り替わる幅では余白を戻す', () => {
  // overflow-x:auto の行は縦方向も切り取られるので、枠を出す分の余白を足し、同じ分だけ上の余白を引いて位置は変えない
  assert.ok(/\.trend-picks-list\{[^}]*margin:calc\(-1 \* var\(--sp-1\)\) 0 0;padding:var\(--sp-1\) 0 var\(--sp-2\);/.test(INDEX), '行の上に枠の分の余白');
  assert.ok(/\.nb-cover-featured \.trend-picks-list\{flex-direction:column;overflow:visible;gap:0;margin:0;padding:0;\}/.test(INDEX), '縦の一覧では余白を戻す（上の余白を引いたままにしない）');
  assert.ok(/(^|\n)\s*:focus-visible\{outline:2px solid var\(--gold\);outline-offset:2px;\}/.test(INDEX), '全体の焦点の枠は 2px＋離れ 2px＝外側 4px（行の余白 var(--sp-1)=4px はこれを受ける）');
});

test('話題店の行の CSS: 横に並べる行（狭い画面）と縦の一覧（1024px 以上）、写真の読み込み前に高さが決まる', () => {
  assert.ok(/\.trend-picks-list\{[^}]*overflow-x:auto/.test(INDEX), '狭い画面は横にスクロールする行');
  assert.ok(/@media\(min-width:1024px\)\{[\s\S]*?\.nb-cover-featured \.trend-picks-list\{flex-direction:column/.test(INDEX), '1024px 以上は縦の一覧');
  assert.ok(/\.tp-img\{[^}]*aspect-ratio:/.test(INDEX) || /\.tp-photo\{[^}]*aspect-ratio:/.test(INDEX), '写真の枠に縦横比（読み込み中に高さが動かない）');
});
