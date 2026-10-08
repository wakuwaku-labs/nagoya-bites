'use strict';

/**
 * 特集の冒頭の「先に結論」（scripts/apply_feature_conclusions.js）と、
 * デート特集の掲載店を記事の約束にそろえる選定条件（refresh_feature_rosters.js の
 * scene.exclude / requirePrice / minGoogle）の検査（SEO-122）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  inRange, rangeText, pickLines, hubLabel, renderBlock, placeBlock, storesFromItemList, START, END,
} = require('../scripts/apply_feature_conclusions.js');
const { sceneMatch } = require('../scripts/refresh_feature_rosters.js');
const { loadPolicy } = require('../scripts/lib/area_genre_pages.js');
const rosters = require('../data/feature_rosters.json');
const conclusions = require('../data/feature_conclusions.json');

const policy = loadPolicy();
const store = (jcode, area, band, extra = {}) => ({ jcode, store: { '店名': `店${jcode}`, 'エリア': area, 'ジャンル': 'イタリアン', '価格帯': band, ...extra } });

test('inRange / rangeText: 価格帯の上限・下限で行の条件に当てる（表示が無い店は当てない）', () => {
  assert.equal(inRange('4001～5000円', { priceMax: 5000 }), true);
  assert.equal(inRange('5001～7000円', { priceMax: 5000 }), false);
  assert.equal(inRange('7001～10000円', { priceMin: 5001, priceMax: 10000 }), true);
  assert.equal(inRange('10001～15000円', { priceMin: 10001 }), true);
  assert.equal(inRange('', { priceMax: 5000 }), false);
  assert.equal(inRange(undefined, { priceMin: 10001 }), false);
  assert.equal(rangeText({ priceMax: 5000 }), '〜5,000円');
  assert.equal(rangeText({ priceMin: 5001, priceMax: 10000 }), '5,001〜10,000円');
  assert.equal(rangeText({ priceMin: 10001 }), '10,001円〜');
});

test('pickLines: 一覧の順に、行の条件に合う最初の店を選び、エリアが重ならない店を優先する', () => {
  const cfg = { lines: [{ label: 'A', priceMax: 5000 }, { label: 'B', priceMin: 5001, priceMax: 10000 }, { label: 'C', priceMin: 10001 }], distinctArea: true };
  const entries = [
    store('J1', '栄', '4001～5000円'),
    store('J2', '栄', '5001～7000円'),
    store('J3', '名古屋（名古屋駅/西区/中村区）', '7001～10000円'),
    store('J4', '栄', '10001～15000円'),
  ];
  const picks = pickLines(entries, cfg, policy);
  assert.deepEqual(picks.map(p => p.entry.jcode), ['J1', 'J3', 'J4']);
  // エリアが重なる店しか無いときは重ねてでも出す（行を落とさない）
  assert.equal(picks[2].areaLabel, '栄');
  // 条件に合う店が無い行は出さない
  assert.deepEqual(pickLines([store('J1', '栄', '4001～5000円')], cfg, policy).map(p => p.line.label), ['A']);
});

test('hubLabel: ハブの名前は area_genre_pages_policy.json の語から組み、知らない形は null', () => {
  assert.equal(hubLabel('stores/area/sakae/index.html', policy), '栄で探す');
  assert.equal(hubLabel('stores/area/meieki/italian-french.html', policy), '名駅（名古屋駅）のイタリアン・フレンチ');
  assert.equal(hubLabel('stores/area/nishiki-fushimi/italian-french-koshitsu.html', policy), '錦・伏見・丸の内のイタリアン・フレンチ（個室あり）');
  assert.equal(hubLabel('stores/area/nowhere/izakaya.html', policy), null);
  assert.equal(hubLabel('features/date.html', policy), null);
});

test('renderBlock: 事実だけを書き、店名をエスケープし、区切りは「 / 」', () => {
  const cfg = { title: '先に結論', note: '注記', lines: [] };
  const picks = [{ line: { label: '気軽に', priceMax: 5000 }, entry: store('J9', '栄', '4001～5000円', { '店名': 'A&B <bar>', '個室': 'あり：2名' }), areaLabel: '栄' }];
  const html = renderBlock(cfg, picks, [{ path: 'stores/area/sakae/index.html', label: '栄で探す' }]);
  assert.match(html, /A&amp;B &lt;bar&gt;/);
  assert.match(html, /栄 \/ イタリアン \/ 4001～5000円 \/ 個室あり/);
  assert.match(html, /href="\.\.\/stores\/J9\.html"/);
  assert.match(html, /href="\.\.\/stores\/area\/sakae\/index\.html">栄で探す</);
  assert.doesNotMatch(html, /[0-9]+(?:\.[0-9]+)?点|評価[0-9]/);
});

test('placeBlock: .art-body の先頭に入れ、2回目は置き換え、空なら外す（冪等）', () => {
  const page = '<article><div class="art-body">\n<p>本文</p></div></article>';
  const block = `${START}\n<section class="nb-conclusion">x</section>\n${END}`;
  const once = placeBlock(page, block);
  assert.ok(once.indexOf(START) > once.indexOf('<div class="art-body">'));
  assert.ok(once.indexOf(START) < once.indexOf('<p>本文</p>'));
  assert.equal(placeBlock(once, block), once);
  assert.equal(placeBlock(once, ''), page);
  assert.equal(placeBlock('<div>art-body なし</div>', block), null);
});

test('storesFromItemList: ItemList の順に J コードを取り出す', () => {
  const html = '{"@type":"ItemList","itemListElement":[{"@type":"ListItem","position":2,"name":"B","url":"https://nagoya-bites.com/stores/J2.html"},{"@type":"ListItem","position":1,"name":"A\\"","url":"https://nagoya-bites.com/stores/J1.html"}]}';
  assert.deepEqual(storesFromItemList(html).map(e => [e.position, e.name, e.jcode]), [[1, 'A"', 'J1'], [2, 'B', 'J2']]);
});

test('デート特集の選定条件: FAQ の約束（焼肉・ホルモン等を除外・価格帯4,000円以上・Google評価4.0以上）を守る', () => {
  const scene = rosters.features.date.scene;
  const base = { '店名': 'リストランテ', 'ジャンル': 'イタリアン', '価格帯': '5001～7000円', 'Google評価': '4.2' };
  assert.ok(sceneMatch(base, scene));
  assert.equal(sceneMatch({ ...base, 'ジャンル': '焼肉・ホルモン' }, scene), null);
  assert.equal(sceneMatch({ ...base, '店名': '焼き肉 なにがし', 'ジャンル': 'ダイニングバー・バル' }, scene), null);
  assert.equal(sceneMatch({ ...base, '店名': 'Shisha Lounge', 'ジャンル': 'ダイニングバー・バル' }, scene), null);
  assert.equal(sceneMatch({ ...base, '店名': '立ち飲み ビストロ', 'ジャンル': 'ダイニングバー・バル' }, scene), null);
  assert.equal(sceneMatch({ ...base, '価格帯': '3001～4000円' }, scene), null);
  assert.equal(sceneMatch({ ...base, '価格帯': '' }, scene), null);
  assert.equal(sceneMatch({ ...base, 'Google評価': '3.9', editorReason: '理由' }, scene), null);
  assert.equal(sceneMatch({ ...base, 'Google評価': '' }, scene), null);
});

test('ほかの特集の選定は変えない（exclude / requirePrice / minGoogle は date だけ）', () => {
  for (const [slug, f] of Object.entries(rosters.features)) {
    if (slug === 'date') continue;
    assert.equal(f.scene.exclude, undefined, slug);
    assert.equal(f.scene.requirePrice, undefined, slug);
    assert.equal(f.scene.minGoogle, undefined, slug);
  }
});

test('feature_conclusions.json: 行のラベルと価格帯の条件があり、ハブは stores/area/ の形', () => {
  for (const [slug, cfg] of Object.entries(conclusions.features)) {
    assert.ok(cfg.title && cfg.note, slug);
    assert.ok(cfg.lines.length >= 2, slug);
    for (const l of cfg.lines) assert.ok(l.label && (l.priceMin != null || l.priceMax != null), `${slug}: ${l.label}`);
    for (const h of cfg.hubs || []) assert.ok(hubLabel(h, policy), `${slug}: ${h}`);
  }
});
