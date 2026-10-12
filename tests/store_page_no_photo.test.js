'use strict';
// I-10c（UI・UX改修 段階1c・計画 U-60）: 写真の無い店の店舗ページ。
//
// 写真の無い店（写真URL が空。配信が終わった写真は I-10b で空にしてある）のページは、ヒーローの位置に
// 汎用の大きな画像（/assets/store-figures/_fallback.svg）を出していた。どの店でも同じ茶色の板で、店の情報ではない。
// 計画 8.3 節: 「大きな代わりの絵は出さない。詳細では写真の枠ごと出さずに店名から始める。
// Instagram の投稿がある店は、その埋め込みを写真の代わりに上に出す」。
//   - 写真の無い店: ヒーローを出さない。ページは店名から始まる。
//   - 写真の無い店で、所有者の検証（__igVerified）を通った投稿がある店: その埋め込みを店名の直下に出す。
//     読み込み後に下の内容が動かないよう、箱の高さを先に確保する（ig-photos-lead）。
//   - 検証を通っていない投稿は、写真が無くても埋め込まない（別の店の投稿が混ざるのを防ぐ・制約10）。
//   - 写真のある店のページは変わらない（ヒーローを出す・埋め込みは今までの位置・追加の CSS なし）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
const { auditHtml } = require(path.join(ROOT, 'scripts', 'lib', 'inline_js.js'));

const PHOTO = 'https://imgfp.hotp.jp/IMGH/00/00/P000000000/P000000000_480.jpg';
const IG1 = 'https://www.instagram.com/someshop/p/ABC123/';
const IG2 = 'https://www.instagram.com/someshop/p/DEF456/';
const BASE = { '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋', 'おすすめポイント': '炭火の焼き鳥が看板。', 'アクセス': '栄駅 徒歩3分' };
const page = (extra) => renderStorePage({ ...BASE, ...extra }, 'J-test', [], []);

const countOf = (html, re) => (html.match(re) || []).length;
const idx = (html, needle) => { const i = html.indexOf(needle); assert.ok(i >= 0, `${needle} が無い`); return i; };

test('写真も投稿も無い店: ヒーローを出さない。ページは店名から始まる', () => {
  const html = page({});
  assert.ok(!/<img class="hero-img"/.test(html), 'ヒーローが残っている');
  assert.ok(!html.includes('hero-wrap'));
  assert.ok(!/<body>[\s\S]*?<img [^>]*_fallback\.svg/.test(html.slice(0, html.indexOf('</body>'))), '本文に汎用の画像が出ている');
  assert.ok(!html.includes('class="ig-photos'), '投稿が無いのに埋め込みの区画がある');
  // ヘッダーの直後に本文（container）が始まり、その中に店名の h1 がある
  assert.match(html, /<!-- NB-CHROME:HEADER:END -->\s*<div class="container">/);
  assert.ok(/<h1>テスト酒場<\/h1>/.test(html));
  assert.deepEqual(auditHtml(html, { filename: 'stores/J-test.html' }).violations, [], 'インライン JS が壊れている');
});

test('写真が無く、確かめた投稿がある店: 埋め込みを店名の直下に出す（おすすめポイント・基本情報より前）', () => {
  const html = page({ 'Instagram投稿URL': IG1, __igVerified: true });
  assert.ok(!/<img class="hero-img"/.test(html), 'ヒーローが残っている');
  assert.equal(countOf(html, /class="ig-photos ig-photos-lead"/g), 1, '埋め込みの区画は1つだけ');
  assert.equal(countOf(html, /<div class="ig-embed-box"/g), 1);
  assert.ok(html.includes(`data-ig-src="https://www.instagram.com/p/ABC123/embed/"`));
  const h1 = idx(html, '<h1>テスト酒場</h1>');
  const lead = idx(html, 'class="ig-photos ig-photos-lead"');
  const point = idx(html, 'class="point-box"');
  const info = idx(html, 'class="info-grid"');
  assert.ok(h1 < lead, '店名より前に出ている');
  assert.ok(lead < point, 'おすすめポイントより前に出ていない');
  assert.ok(lead < info, '基本情報より前に出ていない');
  assert.ok(html.includes('<h2>公式Instagramの実際の写真</h2>'));
  // 読み込みのスクリプトも出る（クラス名で区画を探すので、lead でも同じ）
  assert.ok(html.includes("document.querySelector('.ig-photos')"));
  assert.deepEqual(auditHtml(html, { filename: 'stores/J-test.html' }).violations, []);
});

test('写真が無く、確かめた投稿がある店: 読み込み後に下が動かないよう、箱の高さを先に確保する', () => {
  const html = page({ 'Instagram投稿URL': IG1, __igVerified: true });
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  // iframe は高さ 560px・箱は 1px の枠（border-box）なので 562px
  assert.ok(/\.ig-embed-box iframe\{[^}]*height:560px/.test(css), '前提: iframe の高さが変わった');
  assert.ok(css.includes('.ig-photos-lead .ig-embed-box{min-height:562px;}'), css.slice(css.indexOf('.ig-photos')));
  assert.ok(css.includes('.ig-photos-lead{margin-bottom:1.6rem;}'));
});

test('写真が無く、追加の投稿もある店: 枚数分の箱・矢印・ドットが出る（lead でも同じ作り）', () => {
  const html = page({ 'Instagram投稿URL': IG1, __igVerified: true, __igExtraVerified: [IG2] });
  assert.equal(countOf(html, /<div class="ig-embed-box"/g), 2);
  assert.equal(countOf(html, /class="ig-carousel-nav ig-carousel-(prev|next)"/g), 2);
  assert.equal(countOf(html, /<span class="ig-carousel-dot/g), 2);
  assert.ok(html.indexOf('ig-photos-lead') < html.indexOf('class="point-box"'));
});

test('写真が無くても、検証を通っていない投稿は埋め込まない（別の店の投稿が混ざらない）', () => {
  for (const extra of [{ 'Instagram投稿URL': IG1 }, { 'Instagram投稿URL': IG1, __igVerified: false }]) {
    const html = page(extra);
    assert.ok(!html.includes('class="ig-photos'), JSON.stringify(extra));
    assert.ok(!html.includes('ig-photos-lead'), '箱の高さの CSS だけ残っている');
    assert.ok(!/<img class="hero-img"/.test(html), 'ヒーローは出さない');
  }
});

test('写真URL が空白だけの店も、写真の無い店として扱う', () => {
  const html = page({ '写真URL': '   ' });
  assert.ok(!/<img class="hero-img"/.test(html));
});

test('写真のある店: ヒーローを出し、埋め込みは今までの位置（おすすめポイントの後）で、追加の CSS は無い', () => {
  const html = page({ '写真URL': PHOTO, 'Instagram投稿URL': IG1, __igVerified: true });
  assert.equal(countOf(html, /<img class="hero-img"/g), 1);
  assert.ok(html.includes('P000000000'));
  assert.ok(!html.includes('ig-photos-lead'), 'lead の印が写真のある店に付いている');
  assert.ok(!html.includes('min-height:562px'));
  assert.equal(countOf(html, /<div class="ig-photos">/g), 1);
  const point = idx(html, 'class="point-box"');
  const ig = idx(html, 'class="ig-photos"');
  const info = idx(html, 'class="info-grid"');
  assert.ok(point < ig && ig < info, 'おすすめポイント → 埋め込み → 基本情報 の順');
});

test('写真のある店で投稿が無い店: ヒーローを出し、埋め込みの区画は無い', () => {
  const html = page({ '写真URL': PHOTO });
  assert.equal(countOf(html, /<img class="hero-img"/g), 1);
  assert.ok(!html.includes('class="ig-photos'));
});

test('撮影者を出す写真（Google マップの利用者の写真）のある店は、これまでどおり hero-wrap に包まれる', () => {
  const html = page({ '写真URL': 'https://lh3.googleusercontent.com/places/AAA=s1600-w1200', '写真出所': 'places-user', '写真クレジット': 'TOMO' });
  assert.match(html, /<div class="hero-wrap"><img class="hero-img"/);
});
