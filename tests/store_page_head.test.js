'use strict';
// I-18（U-72・U-73）: 店舗ページの構造化データの位置の情報と、店名を属性に入れるときの記号の処理。
//
// - geo: data/stores.json の 緯度・経度 は build.js がエリアの中心点（座標精度=area）で埋めた値で、
//   同じエリアの店が全部同じ点になる（誘導ページを除く 4,939 ページで 39 通り）。店の本当の座標
//   （座標精度=exact）があるときだけ出す。
// - 記号: 店名に " を含む店（J003987010）で og:title が途中で切れていた。title・description・
//   alt・h1 に入れる値は、属性が途中で切れないように逃がす。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { renderStorePage, buildGeo } = require(path.join(ROOT, 'gen-store-pages.js'));
const SO = require(path.join(ROOT, 'scripts', 'lib', 'store_orphans.js'));
const { auditHtml } = require(path.join(ROOT, 'scripts', 'lib', 'inline_js.js'));

const BASE = { '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋', 'おすすめポイント': '炭火の焼き鳥が看板。' };

function jsonLdOf(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'JSON-LD が無い');
  const list = JSON.parse(m[1]);
  return list.find(x => x['@type'] === 'Restaurant');
}

// ── geo ──

test('geo: エリアの中心点（座標精度=area）は出さない', () => {
  const s = { ...BASE, '緯度': '35.162', '経度': '136.97', '座標精度': 'area' };
  assert.equal(buildGeo(s), null);
  const html = renderStorePage(s, 'J-test', [], []);
  assert.equal('geo' in jsonLdOf(html), false);
  assert.ok(!html.includes('GeoCoordinates'));
});

test('geo: 座標精度の記録が無い店は、緯度・経度があっても出さない（推測しない）', () => {
  const s = { ...BASE, '緯度': '35.1681971858', '経度': '136.8867950252' };
  assert.equal(buildGeo(s), null);
  assert.equal('geo' in jsonLdOf(renderStorePage(s, 'J-test', [], [])), false);
});

test('geo: 店の本当の座標（座標精度=exact）は、そのまま出す', () => {
  const s = { ...BASE, '緯度': '35.1681971858', '経度': '136.8867950252', '座標精度': 'exact' };
  assert.deepEqual(buildGeo(s), { '@type': 'GeoCoordinates', 'latitude': '35.1681971858', 'longitude': '136.8867950252' });
  assert.deepEqual(jsonLdOf(renderStorePage(s, 'J-test', [], [])).geo,
    { '@type': 'GeoCoordinates', 'latitude': '35.1681971858', 'longitude': '136.8867950252' });
});

test('geo: exact でも緯度・経度が数として読めなければ出さない', () => {
  for (const [lat, lng] of [['', ''], ['35.1', ''], ['', '136.9'], ['abc', '136.9'], ['35.1', 'NaN'], [undefined, undefined]]) {
    assert.equal(buildGeo({ '座標精度': 'exact', '緯度': lat, '経度': lng }), null, JSON.stringify([lat, lng]));
  }
});

// ── 記号の処理 ──

// 属性の値が途中で切れていないか確かめるため、<meta> を 1 つずつ厳密に読む
function metaTags(html) {
  const head = html.slice(0, html.indexOf('</head>'));
  return head.split('\n').filter(l => l.startsWith('<meta '));
}
const STRICT_META = /^<meta(?:\s+[a-zA-Z:-]+(?:="[^"]*")?)+\s*>$/;
function decode(s) {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[k]));
}
function metaContent(html, key) {
  const re = new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)">`);
  const m = html.match(re);
  assert.ok(m, `${key} が無い、または属性が途中で切れている`);
  return decode(m[1]);
}

const TRICKY = 'TT" a <Little> & Knowledge\'s Store';

// 店名・題・説明文を入れる属性（og:title / description / *:image:alt など）の値に、逃がされていない & < > が残っていないこと
// （& は逃がした参照の一部としてだけ許す）。画像や URL の属性（&output=png&w=… を含む）は、この変更の対象外
function assertEscaped(tag) {
  if (!/(?:title|description|alt)"/.test(tag)) return;
  const values = [...tag.matchAll(/="([^"]*)"/g)].map(m => m[1]);
  for (const v of values) {
    assert.ok(!/[<>]/.test(v), `< > が逃がされていない: ${tag}`);
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(v), `& が逃がされていない: ${tag}`);
  }
}

// 自家製の OG 画像（assets/og/<slug>.svg）がある店は、別の分岐で og:image:alt を書く
function slugWithCustomOg() {
  const f = fs.readdirSync(path.join(ROOT, 'assets', 'og')).find(x => /^J\d+\.svg$/.test(x));
  assert.ok(f, 'assets/og に自家製 OG 画像が 1 つも無い（このテストの前提が崩れた）');
  return f.replace(/\.svg$/, '');
}

test('店名に " & < > \' を含んでも、head の属性が途中で切れず、読み戻すと元の店名になる', () => {
  const s = { ...BASE, '店名': TRICKY, 'おすすめポイント': '看板は "炭火" & <塩> のみ。' };
  const html = renderStorePage(s, 'J-test', [], []);
  for (const tag of metaTags(html)) {
    assert.match(tag, STRICT_META, `属性が壊れている: ${tag}`);
    assertEscaped(tag);
  }
  const title = decode(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
  assert.ok(title.startsWith(`${TRICKY}（`), title);
  assert.equal(metaContent(html, 'og:title'), title);
  assert.equal(metaContent(html, 'twitter:title'), title);
  assert.equal(metaContent(html, 'og:image:alt').startsWith(TRICKY), true);
  assert.equal(metaContent(html, 'twitter:image:alt').startsWith(TRICKY), true);
  const desc = metaContent(html, 'description');
  assert.ok(desc.includes('"炭火" & <塩>'), desc);
  assert.equal(metaContent(html, 'og:description'), desc);
  assert.equal(metaContent(html, 'twitter:description'), desc);
});

test('自家製の OG 画像がある店でも、og:image:alt・twitter:image:alt の店名を逃がす', () => {
  const html = renderStorePage({ ...BASE, '店名': TRICKY }, slugWithCustomOg(), [], []);
  assert.ok(html.includes('<meta property="og:image" content="https://wsrv.nl/?url='), '自家製 OG の分岐に入っていない');
  for (const tag of metaTags(html)) {
    assert.match(tag, STRICT_META, `属性が壊れている: ${tag}`);
    assertEscaped(tag);
  }
  assert.ok(metaContent(html, 'og:image:alt').startsWith(`${TRICKY} | NAGOYA BITES`));
  assert.ok(metaContent(html, 'twitter:image:alt').startsWith(`${TRICKY} | NAGOYA BITES`));
});

test('title のテキストには、& < > が逃がされずに残らない', () => {
  const html = renderStorePage({ ...BASE, '店名': 'A & B <C>' }, 'J-test', [], []);
  const raw = html.match(/<title>([\s\S]*?)<\/title>/)[1];
  assert.ok(!/[<>]/.test(raw), raw);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(raw), raw);
});

test('ヒーロー画像の alt と h1 も逃がし、h1 から店名を読み戻せる（誘導ページ化の照合用）', () => {
  const html = renderStorePage({ ...BASE, '店名': TRICKY }, 'J-test', [], []);
  const hero = html.match(/<img class="hero-img"[^>]*>/)[0];
  assert.match(hero, /alt="[^"]*&quot;[^"]*"/);
  assert.ok(!/alt="TT"/.test(hero), 'alt が " で切れている');
  assert.equal(SO.readH1(html), TRICKY);
});

test('Instagram の埋め込みへのリンク文も、店名を逃がして入れる', () => {
  const s = { ...BASE, '店名': 'A & <B>', 'Instagram投稿URL': 'https://www.instagram.com/someshop/p/ABC123/', __igVerified: true };
  const html = renderStorePage(s, 'J-test', [], []);
  assert.ok(html.includes('<div class="ig-embed-box" data-ig-src="https://www.instagram.com/p/ABC123/embed/">'), '埋め込みが出ていない（前提が崩れた）');
  assert.ok(html.includes('A &amp; &lt;B&gt; の公式Instagram投稿を見る'));
  assert.ok(!html.includes('A & <B> の公式Instagram投稿を見る'));
});

test('普通の店名のページは、記号の処理で 1 文字も変わらない', () => {
  const html = renderStorePage(BASE, 'J-test', [], []);
  assert.ok(html.includes('<title>テスト酒場（栄・居酒屋'));
  assert.ok(html.includes('<h1>テスト酒場</h1>'));
  assert.ok(html.includes('alt="テスト酒場"'));
  assert.equal(SO.readH1(html), 'テスト酒場');
  assert.deepEqual(auditHtml(html, { filename: 'render:head' }).violations, []);
});
