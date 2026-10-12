'use strict';
// I-17（U-34）: 店舗ページのパンくず・「もっと見る」・BreadcrumbList の行き先。
// - エリア×ジャンルのハブがある店は、今までどおりそのハブへ（出力を変えない）
// - ハブが無くエリアのハブだけある店は、エリアのハブへ送る。トップは #area= を読まないので、
//   「../#area=…」は押してもエリアの条件が消える死にリンクだった
// - どちらも無い店は、死んだ #area= の項目を出さない（生きている #genre= のフィルタだけ残す）
// テストの店は data/stores.json の実際の計画（stores/area/ の生成元と同じ）から選ぶ。店数が増減しても組み合わせは変わらない。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
const areaGenrePages = require(path.join(ROOT, 'scripts', 'lib', 'area_genre_pages.js'));
const { loadStores } = require(path.join(ROOT, 'scripts', 'lib', 'load_stores'));
const { auditHtml } = require(path.join(ROOT, 'scripts', 'lib', 'inline_js.js'));

const BASE_URL = 'https://nagoya-bites.com';
const policy = areaGenrePages.loadPolicy();
const { pages } = areaGenrePages.planPages(loadStores(), policy);

const genrePage = pages.find((p) => p.type === 'genre');
const areaPage = pages.find((p) => p.type === 'area');
const rawArea = (slug) => policy.areas.find((a) => a.slug === slug).match[0];
const rawGenre = (slug) => policy.genres.find((g) => g.slug === slug).match[0];

function render(overrides) {
  const s = { '店名': 'テスト酒場', 'エリア': '', 'ジャンル': '', 'おすすめポイント': '炭火の焼き鳥が看板。', ...overrides };
  return renderStorePage(s, 'J-test', [], []);
}
function breadcrumbLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const flat = blocks.flatMap((b) => (Array.isArray(b) ? b : [b]));
  return flat.find((x) => x['@type'] === 'BreadcrumbList');
}
function moreLink(html) {
  const m = html.match(/<div class="back-section">\s*<a href="([^"]*)">([^<]*)<\/a>/);
  assert.ok(m, '「もっと見る」のリンクが見つからない');
  return { href: m[1], text: m[2] };
}
function crumbs(html) {
  const bc = breadcrumbLd(html);
  assert.ok(bc, 'BreadcrumbList が無い');
  return bc.itemListElement;
}
const positionsAreSequential = (items) => items.every((x, i) => x.position === i + 1);

test('前提: 計画に、エリア×ジャンルのハブとエリアのハブがどちらも実在する', () => {
  assert.ok(genrePage, 'type=genre のページが無い');
  assert.ok(areaPage, 'type=area のページが無い');
  assert.ok(rawArea(genrePage.area.slug) && rawGenre(genrePage.genre.slug));
  assert.ok(rawArea(areaPage.area.slug));
});

test('エリア×ジャンルのハブがある店: 今までどおりそのハブへ送る（エリアのハブには替えない）', () => {
  const area = rawArea(genrePage.area.slug);
  const genre = rawGenre(genrePage.genre.slug);
  const html = render({ 'エリア': area, 'ジャンル': genre });
  const label = `${area}の${genre}`;
  assert.ok(html.includes(`<a href="../${genrePage.url}">${label}</a>`), 'パンくずがハブへ');
  const more = moreLink(html);
  assert.equal(more.href, `../${genrePage.url}`);
  assert.equal(more.text, `← ${label}をもっと見る`);
  const items = crumbs(html);
  assert.deepEqual(items.map((x) => x.name), ['NAGOYA BITES', label, 'テスト酒場']);
  assert.equal(items[1].item, `${BASE_URL}/${genrePage.url}`);
  assert.ok(positionsAreSequential(items));
  assert.ok(!html.includes('#area='), '死んだ #area= を出さない');
  assert.ok(!html.includes('の飲食店をもっと見る'));
});

test('ハブが無くエリアのハブだけある店（ジャンル名がハブの区分に当たらない）: エリアのハブへ送る', () => {
  const area = rawArea(areaPage.area.slug);
  const html = render({ 'エリア': area, 'ジャンル': 'どのハブの区分にも当たらない料理' });
  const label = `${areaPage.area.label}の飲食店`;
  assert.ok(html.includes(`<a href="../${areaPage.url}">${label}</a>`), 'パンくずがエリアのハブへ');
  const more = moreLink(html);
  assert.equal(more.href, `../${areaPage.url}`);
  assert.equal(more.text, `← ${label}をもっと見る`);
  const items = crumbs(html);
  assert.deepEqual(items.map((x) => x.name), ['NAGOYA BITES', label, 'テスト酒場']);
  assert.equal(items[1].item, `${BASE_URL}/${areaPage.url}`);
  assert.ok(positionsAreSequential(items));
  assert.ok(!html.includes('#area='), '死んだ #area= を出さない');
  assert.ok(!moreLink(html).href.includes('index.html#genre='), 'トップのジャンル絞り込みへは送らない（エリアの条件が消える）');
  assert.ok(!html.includes('どのハブの区分にも当たらない料理</a>'), 'ジャンルの項目はエリアのハブに置き換わる（二重にしない）');
});

test('ジャンルが空でも、エリアのハブがあればそこへ送る', () => {
  const area = rawArea(areaPage.area.slug);
  const html = render({ 'エリア': area, 'ジャンル': '' });
  const label = `${areaPage.area.label}の飲食店`;
  assert.equal(moreLink(html).href, `../${areaPage.url}`);
  assert.equal(moreLink(html).text, `← ${label}をもっと見る`);
  const items = crumbs(html);
  assert.deepEqual(items.map((x) => x.name), ['NAGOYA BITES', label, 'テスト酒場']);
  assert.ok(positionsAreSequential(items));
  assert.ok(!html.includes('#area='));
});

test('エリアがハブの区分に当たらない店: 死んだ #area= の項目を出さず、生きている #genre= のフィルタは残す', () => {
  const html = render({ 'エリア': 'どこの区分にも当たらない町', 'ジャンル': '居酒屋' });
  assert.ok(!html.includes('#area='), '死んだ #area= を出さない');
  const items = crumbs(html);
  assert.deepEqual(items.map((x) => x.name), ['NAGOYA BITES', '居酒屋', 'テスト酒場']);
  assert.equal(items[1].item, `${BASE_URL}/#genre=${encodeURIComponent('居酒屋')}`);
  assert.ok(positionsAreSequential(items));
  assert.ok(html.includes(`<a href="../#genre=${encodeURIComponent('居酒屋')}">居酒屋</a>`), 'パンくずにジャンルのフィルタ');
  // 「もっと見る」はこれまでどおり（出力を変えない）
  assert.deepEqual(moreLink(html), { href: `../index.html#genre=${encodeURIComponent('居酒屋')}`, text: '← どこの区分にも当たらない町の居酒屋をもっと見る' });
});

test('エリアもジャンルもハブに当たらず、ジャンルが空の店: パンくずは TOP › 店名 だけで、位置は連番', () => {
  const html = render({ 'エリア': 'どこの区分にも当たらない町', 'ジャンル': '' });
  const items = crumbs(html);
  assert.deepEqual(items.map((x) => x.name), ['NAGOYA BITES', 'テスト酒場']);
  assert.ok(positionsAreSequential(items));
  assert.ok(!html.includes('#area='));
});

test('BreadcrumbList の位置は、どの組み合わせでも 1 から連番（欠番・重複なし）', () => {
  const combos = [
    { 'エリア': rawArea(genrePage.area.slug), 'ジャンル': rawGenre(genrePage.genre.slug) },
    { 'エリア': rawArea(areaPage.area.slug), 'ジャンル': '居酒屋っぽくない独自の料理' },
    { 'エリア': rawArea(areaPage.area.slug), 'ジャンル': '' },
    { 'エリア': '区分外の町', 'ジャンル': 'カレー' },
    { 'エリア': '区分外の町', 'ジャンル': '' },
    { 'エリア': '', 'ジャンル': '' },
  ];
  for (const c of combos) {
    const items = crumbs(render(c));
    assert.ok(positionsAreSequential(items), JSON.stringify(c) + ' → ' + JSON.stringify(items.map((x) => x.position)));
    assert.equal(items[items.length - 1].item, `${BASE_URL}/stores/J-test.html`, '最後は店のページ');
  }
});

test('生成したページのインライン JS・JSON-LD は壊れない（エリアのハブへ送る店）', () => {
  const html = render({ 'エリア': rawArea(areaPage.area.slug), 'ジャンル': 'どのハブの区分にも当たらない料理' });
  const r = auditHtml(html, { filename: 'render:area-hub-link' });
  assert.deepEqual(r.violations, []);
});

test('掲載している全店のページに、死んだ「../#area=」のリンクが残らない', () => {
  const all = loadStores();
  assert.ok(all.length > 1000, '全店が読み込めている');
  for (const s of all) {
    const html = renderStorePage(s, 'J-test', [], []);
    assert.ok(!html.includes('#area='), `${s['店名']}（${s['エリア']}）に #area= が残っている`);
  }
});
