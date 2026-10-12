'use strict';
/**
 * tests/modal_features.test.js — I-15b（UI・UX改修）
 *
 * トップのクイックビュー（モーダル）の特集の区画を確かめる。
 *   ・「この店が載っている特集」は、実際に載っている特集だけ（LOCAL_STORES の 掲載特集）。無ければ区画ごと出さない
 *   ・タグ・ジャンル・エリアから推定した特集は、別の区画「あわせて読みたい特集」に出す。載っている特集は繰り返さない
 *   ・推定の規則（SEO-004）は変えない（24本・最後は全店に出る「名古屋グルメ完全ガイド」）
 *
 * index.html の `NB-MODAL-FEATURES` の区画と nbEscHtml を取り出し、偽の DOM の上で動かす。
 * 実ブラウザでの確認は docs/qa/uiux-2026-10/ ではなく PR の本文に書く（画面の見た目は 390px・1280px で測った）。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── index.html から取り出す ─────────────────────────────────────────────
function extractBlock(src) {
  const a = src.indexOf('// NB-MODAL-FEATURES:START');
  const b = src.indexOf('// NB-MODAL-FEATURES:END');
  assert.ok(a >= 0 && b > a, 'NB-MODAL-FEATURES の区画が見つからない');
  assert.equal(src.split('// NB-MODAL-FEATURES:START').length - 1, 1, '開始の印は1つだけ');
  assert.equal(src.split('// NB-MODAL-FEATURES:END').length - 1, 1, '終了の印は1つだけ');
  return src.slice(a, b);
}
function extractEsc(src) {
  const a = src.indexOf('function nbEscHtml(s) {');
  assert.ok(a >= 0, 'nbEscHtml が見つからない');
  const b = src.indexOf('\n}\n', a);
  assert.ok(b > a, 'nbEscHtml の終わりが見つからない');
  return src.slice(a, b + 3);
}
const BLOCK = extractBlock(INDEX);
const ESC = extractEsc(INDEX);

// vm の中で作られたオブジェクトは Object.prototype が別物（deepStrictEqual が通らない）ので、受け取った時点で複製する
const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function makeEnv() {
  const els = {};
  const getEl = (id) => (els[id] || (els[id] = { style: { display: 'none' }, innerHTML: '' }));
  const ctx = vm.createContext({ document: { getElementById: getEl } });
  vm.runInContext(ESC + '\n' + BLOCK, ctx);
  return { ctx, getEl, els };
}
const links = (ctx, r) => plain(ctx.nbModalFeatureLinks(r));
const hrefs = (html) => [...String(html).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

const RAMEN = { slug: 'nagoya-ramen', title: '名古屋ラーメン おすすめ11選【2026年版】' };
const TONKATSU = { slug: 'nagoya-tonkatsu', title: '名古屋とんかつ・味噌かつ おすすめ10選【2026年版】' };

// ---------------------------------------------------------------- 実際の掲載（掲載特集）

test('掲載特集が無い店: 「載っている特集」は出さず、推定は「あわせて読みたい」に出す', () => {
  const { ctx, getEl } = makeEnv();
  const r = { '店名': 'テスト', 'ジャンル': 'ラーメン', 'タグ': '', 'エリア': '栄' };
  const l = links(ctx, r);
  assert.deepEqual(l.listed, []);
  assert.deepEqual(l.more.map((x) => x.u), ['features/nagoya-ramen.html', 'features/nagoya-gourmet-guide.html']);
  ctx.nbRenderModalFeatures(r);
  assert.equal(getEl('m-features-section').style.display, 'none');
  assert.equal(getEl('m-related-features').innerHTML, '');
  assert.equal(getEl('m-readmore-section').style.display, '');
  assert.deepEqual(hrefs(getEl('m-readmore-features').innerHTML), ['features/nagoya-ramen.html', 'features/nagoya-gourmet-guide.html']);
});

test('掲載特集がある店: 載っている特集をそのまま出し、推定には同じ特集を繰り返さない', () => {
  const { ctx, getEl } = makeEnv();
  const r = { '店名': 'テスト', 'ジャンル': 'ラーメン', 'タグ': '', 'エリア': '栄', '掲載特集': [RAMEN] };
  const l = links(ctx, r);
  assert.deepEqual(l.listed, [{ u: 'features/nagoya-ramen.html', l: RAMEN.title }]);
  // ラーメンの規則は載っている特集と同じ行き先なので、推定からは外れる
  assert.deepEqual(l.more.map((x) => x.u), ['features/nagoya-gourmet-guide.html']);
  ctx.nbRenderModalFeatures(r);
  assert.equal(getEl('m-features-section').style.display, '');
  assert.deepEqual(hrefs(getEl('m-related-features').innerHTML), ['features/nagoya-ramen.html']);
  assert.ok(getEl('m-related-features').innerHTML.includes(RAMEN.title));
  assert.deepEqual(hrefs(getEl('m-readmore-features').innerHTML), ['features/nagoya-gourmet-guide.html']);
});

test('掲載特集は題を省略せず・上限なしで出す（実際の掲載は事実なので隠さない）。同じ特集の重複は1件', () => {
  const { ctx } = makeEnv();
  const many = Array.from({ length: 7 }, (_, i) => ({ slug: `f${i}`, title: `特集${i}` }));
  const r = { '店名': 'テスト', 'ジャンル': '居酒屋', 'タグ': '', 'エリア': '栄', '掲載特集': [...many, many[0], many[3]] };
  const l = links(ctx, r);
  assert.deepEqual(l.listed.map((x) => x.u), many.map((x) => `features/${x.slug}.html`));
  assert.deepEqual(l.listed.map((x) => x.l), many.map((x) => x.title));
});

test('掲載特集の要素が壊れていても止まらない（slug・title が無いものは出さない）', () => {
  const { ctx } = makeEnv();
  const r = { '店名': 'テスト', 'ジャンル': '居酒屋', 'タグ': '', 'エリア': '栄', '掲載特集': [null, {}, { slug: 'a' }, { title: 'b' }, { slug: 'ok', title: 'OK' }] };
  assert.deepEqual(links(ctx, r).listed, [{ u: 'features/ok.html', l: 'OK' }]);
  for (const bad of [null, undefined, '', 0, []]) {
    assert.deepEqual(links(ctx, { '店名': 'テスト', 'ジャンル': '居酒屋', 'タグ': '', 'エリア': '栄', '掲載特集': bad }).listed, []);
  }
});

test('題は HTML として逃がして出す（データの文字がタグにならない）', () => {
  const { ctx, getEl } = makeEnv();
  const r = { '店名': 'テスト', 'ジャンル': '居酒屋', 'タグ': '', 'エリア': '栄', '掲載特集': [{ slug: 'x', title: '<img src=x onerror=alert(1)> & "A"' }] };
  ctx.nbRenderModalFeatures(r);
  const html = getEl('m-related-features').innerHTML;
  assert.ok(!html.includes('<img'), html);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;A&quot;'), html);
  assert.equal(hrefs(html).length, 1);
});

test('行き先も逃がして出す（slug の文字が属性を抜けてイベントにならない）', () => {
  const { ctx, getEl } = makeEnv();
  const r = { '店名': 'テスト', 'ジャンル': '居酒屋', 'タグ': '', 'エリア': '栄', '掲載特集': [{ slug: 'x" onmouseover="alert(1)', title: 'T' }] };
  ctx.nbRenderModalFeatures(r);
  const html = getEl('m-related-features').innerHTML;
  // 開きタグは決まった形のまま（href の値の中に " が出て属性が増えたら、この形に合わなくなる）
  assert.match(html, /^<a href="[^"]*" target="_blank" rel="noopener noreferrer">/, html);
  assert.ok(html.includes('&quot;'), html);
  assert.equal(hrefs(html).length, 1);
});

test('開き直し: 載っている特集がある店の次に無い店を開いたら、実際の掲載の区画は隠れて中身も空になる', () => {
  const { ctx, getEl } = makeEnv();
  ctx.nbRenderModalFeatures({ '店名': 'A', 'ジャンル': 'ラーメン', 'タグ': '', 'エリア': '栄', '掲載特集': [RAMEN, TONKATSU] });
  assert.equal(getEl('m-features-section').style.display, '');
  assert.equal(hrefs(getEl('m-related-features').innerHTML).length, 2);
  ctx.nbRenderModalFeatures({ '店名': 'B', 'ジャンル': 'ラーメン', 'タグ': '', 'エリア': '栄' });
  assert.equal(getEl('m-features-section').style.display, 'none');
  assert.equal(getEl('m-related-features').innerHTML, '');
  // 推定は B の分に入れ替わる（A の分が残らない）
  assert.deepEqual(hrefs(getEl('m-readmore-features').innerHTML), ['features/nagoya-ramen.html', 'features/nagoya-gourmet-guide.html']);
  // 逆向き: 推定が空になる店は無い（全店に出る規則がある）が、入れ物は毎回作り直される
  ctx.nbRenderModalFeatures({ '店名': 'C', 'ジャンル': '居酒屋', 'タグ': '', 'エリア': '栄' });
  assert.deepEqual(hrefs(getEl('m-readmore-features').innerHTML), ['features/nagoya-gourmet-guide.html']);
});

// ---------------------------------------------------------------- 推定（あわせて読みたい）

test('推定は 1店 3本まで・規則の順・同じ行き先は1回', () => {
  const { ctx } = makeEnv();
  const r = { '店名': 'テスト', 'ジャンル': 'ラーメン・焼肉', 'タグ': '接待,個室,宴会', 'エリア': '名駅' };
  assert.deepEqual(links(ctx, r).more.map((x) => x.u), [
    'features/settai-guide.html', 'features/private-room.html', 'features/banquet.html',
  ]);
});

test('推定の規則は変えない: 24本・順序・最後は全店に当たる「名古屋グルメ完全ガイド」', () => {
  const { ctx } = makeEnv();
  const rules = ctx.NB_MODAL_FEATURE_RULES;
  assert.equal(rules.length, 24);
  assert.deepEqual(Array.from(rules, (x) => x.u), [
    'features/settai-guide.html', 'features/private-room.html', 'features/banquet.html', 'features/girls-party.html',
    'features/birthday.html', 'features/nagoya-hitsumabushi.html', 'features/nagoya-tebasaki.html',
    'features/nagoya-miso-nikomi-udon.html', 'features/nagoya-ramen.html', 'features/nagoya-tonkatsu.html',
    'features/nagoya-yakitori-guide.html', 'features/nagoya-cafe.html', 'features/nagoya-italian-guide.html',
    'features/nagoya-french-guide.html', 'features/nagoya-bar-guide.html', 'features/nagoya-seafood.html',
    'features/nagoya-korean.html', 'features/nagoya-chinese-guide.html', 'features/nagoya-yakiniku-guide.html',
    'features/nagoya-lunch-washoku.html', 'features/nagoya-sushi-guide.html', 'features/meieki.html',
    'features/osu-food-walk.html', 'features/nagoya-gourmet-guide.html',
  ]);
  assert.equal(rules[23].t({}), true, '末尾は全店に当たる');
  assert.equal(rules[22].t({ 'エリア': '栄' }), false);
});

test('推定の行き先の特集ファイルは実在する（死にリンクを出さない）', () => {
  const { ctx } = makeEnv();
  for (const rule of ctx.NB_MODAL_FEATURE_RULES) {
    assert.ok(fs.existsSync(path.join(ROOT, rule.u)), `${rule.u} が無い`);
  }
});

// ---------------------------------------------------------------- 全店で

test('全店: 2つの区画に同じ特集が出ない・推定は1〜3本・載っている特集は元データどおり', () => {
  const { loadStores } = require(path.join(ROOT, 'scripts', 'lib', 'load_stores'));
  const stores = loadStores().filter((s) => s['店名']);
  const { ctx } = makeEnv();
  let withListing = 0;
  for (const s of stores) {
    const l = links(ctx, s);
    const uniq = [...new Set((s['掲載特集'] || []).map((f) => `features/${f.slug}.html`))];
    assert.deepEqual(l.listed.map((x) => x.u), uniq, `${s['店名']}: 載っている特集が元データと違う`);
    const all = [...l.listed.map((x) => x.u), ...l.more.map((x) => x.u)];
    assert.equal(new Set(all).size, all.length, `${s['店名']}: 同じ特集が2回出る`);
    assert.ok(l.more.length <= 3, `${s['店名']}: 推定が3本を超える`);
    assert.ok(l.more.length >= 1 || uniq.includes('features/nagoya-gourmet-guide.html'), `${s['店名']}: 推定が空`);
    if (l.listed.length) withListing++;
    for (const f of l.listed) assert.ok(fs.existsSync(path.join(ROOT, f.u)), `${s['店名']}: ${f.u} が無い`);
  }
  assert.ok(withListing > 0, '載っている特集がある店が1つも無い（掲載特集が付いていない？）');
});

// ---------------------------------------------------------------- 静的

test('index.html: 見出しは「この店が載っている特集」「あわせて読みたい特集」の2つ。openM は nbRenderModalFeatures を呼ぶ', () => {
  assert.equal(INDEX.split('<div class="m-section-title">この店が載っている特集</div>').length - 1, 1);
  assert.equal(INDEX.split('<div class="m-section-title">あわせて読みたい特集</div>').length - 1, 1);
  // 実際の掲載の区画のすぐ後に、推定の区画がある
  assert.match(INDEX, /id="m-features-section"[\s\S]{0,400}<\/section>\s*<section class="m-section" id="m-readmore-section"/);
  // 区画の中身の入れ物
  assert.match(INDEX, /id="m-related-features"/);
  assert.match(INDEX, /id="m-readmore-features"/);
  // 古い実装（openM の中の MF 配列と hits）は残っていない
  assert.ok(!INDEX.includes('var MF=['), '古い MF 配列が残っている');
  assert.ok(!INDEX.includes('var hits=[],seen={};'), '古い hits が残っている');
  const open = INDEX.slice(INDEX.indexOf('function openM(i, source) {'));
  assert.equal(open.split('nbRenderModalFeatures(r);').length - 1, 1, 'openM から1回だけ呼ぶ');
});
