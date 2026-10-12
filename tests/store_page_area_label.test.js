'use strict';
// I-14e（U-33）: 店舗ページに見えるエリア名・ジャンル名を、行き先のハブ（stores/area/）の見出しと同じ名前にそろえる。
//
// 事故: 店舗ページのパンくず・「もっと見る」・基本情報の「エリア」は、ホットペッパーの地域名をそのまま出していた。
//   「栄ｷﾀ錦/伏見丸の内/泉/東桜/新栄」（半角カナ）・「大曽根･千種･今池･池下･守山区」（半角の点）・「名古屋（名古屋駅/西区/中村区）」。
//   全店の約 26% がこの形で、行き先のハブの見出しは「錦・伏見・丸の内の居酒屋」「千種・今池・大曽根の居酒屋」なので、
//   押す前の文字と着いた先の見出しが一致せず、長い名前はパンくずを横にあふれさせていた（I-37）。
//
// 守ること（計画書 I-14・5.2 節）:
//   - 名前の表はハブの生成器と同じ areaGenrePages.normalizeArea / normalizeGenre の 1 本。店舗ページ側に別の表を持たない
//   - パンくず・「もっと見る」・BreadcrumbList の名前・基本情報の「エリア」の 4 か所がそろう（見える文字と構造化データが食い違わない）
//   - 行政区の名前（「名古屋市中区」「西区」）は元の表記のまま。ハブの名前（「栄」など）のほうが粗く、場所を誤って伝えるため
//   - どちらのハブにも当たらない店の「もっと見る」は、行き先（トップのジャンル絞り込み）と同じ文字にする（エリア名を入れない）
//   - <title>・説明文のエリア名（scripts/lib/area_label.js）は検索結果での見え方のために別に整えてあるので、ここでは変えない
//
// 読むのは生成器が返す文字列と data/stores.json・方針ファイルだけ。日次で作り直す stores/ の生成物は見ない
// （build.yml は npm test を再生成より前に回すので、生成物を読むテストは前の日の生成物を見てしまう）。

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
const hubs = require(path.join(ROOT, 'scripts', 'gen_area_genre_pages.js'));
const areaGenrePages = require(path.join(ROOT, 'scripts', 'lib', 'area_genre_pages.js'));
const { titleAreaLabel } = require(path.join(ROOT, 'scripts', 'lib', 'area_label.js'));
const { auditHtml } = require(path.join(ROOT, 'scripts', 'lib', 'inline_js.js'));

const ctx = hubs.prepare(); // 方針・全店・ページの計画（stores/area/ の生成元と同じ）
const { policy, pages, stores } = ctx;
const genrePages = pages.filter((p) => p.type === 'genre');
const areaPages = pages.filter((p) => p.type === 'area');

// ホットペッパーの地域名の癖: 半角カナ・半角の点（｡｢｣､･ｦ-ﾟ）・スラッシュの並び
const MESSY = /[｡-ﾟ/／]/;
// 行政区の名前（生成器の WARD_LEVEL_AREA と同じ意味。ここでは仕様として書き直す）
const isWard = (raw) => /^名古屋市/.test(raw) || /^[^・･/／()（）]+区$/.test(raw);

function render(overrides) {
  const s = { '店名': 'テスト酒場', 'エリア': '', 'ジャンル': '', 'おすすめポイント': '炭火の焼き鳥が看板。', ...overrides };
  return renderStorePage(s, 'J-test', [], []);
}
const strip = (h) => String(h).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function crumbLinks(html) {
  const block = (html.match(/<div class="breadcrumb">([\s\S]*?)<\/div>/) || [])[1];
  assert.ok(block, 'パンくずが見つからない');
  return [...block.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)].map((m) => ({ href: m[1], text: m[2] }));
}
function moreLink(html) {
  const m = html.match(/<div class="back-section">\s*<a href="([^"]*)">([^<]*)<\/a>/);
  assert.ok(m, '「もっと見る」のリンクが見つからない');
  return { href: m[1], text: m[2] };
}
function areaCell(html) {
  const m = html.match(/<label>エリア<\/label><span>([^<]*)<\/span>/);
  return m ? m[1] : null;
}
function ldNames(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const bc = blocks.flatMap((b) => (Array.isArray(b) ? b : [b])).find((x) => x['@type'] === 'BreadcrumbList');
  assert.ok(bc, 'BreadcrumbList が無い');
  return bc.itemListElement.map((x) => x.name);
}
const rawGenreOf = (slug) => policy.genres.find((g) => g.slug === slug).match[0];

// ホットペッパーの癖のある表記（ハブの方針に載っているもの）のうち、ジャンル別のハブがあるエリアのもの
const messyRaws = policy.areas.flatMap((a) => a.match.filter((m) => MESSY.test(m)).map((raw) => ({ area: a, raw })))
  .filter(({ area }) => genrePages.some((p) => p.area.slug === area.slug));

test('前提: 癖のある表記（半角カナ・半角の点・スラッシュの並び）を持つエリアが方針にあり、ジャンル別のハブも実在する', () => {
  assert.ok(messyRaws.length >= 3, `癖のある表記が ${messyRaws.length} 件しか見つからない`);
  assert.ok(genrePages.length > 10 && areaPages.length > 3);
});

test('エリア×ジャンルのハブがある店: パンくず・「もっと見る」・BreadcrumbList・基本情報が、ハブの見出し「エリアのジャンル」と同じ名前になる', () => {
  for (const { area, raw } of messyRaws) {
    const hub = genrePages.find((p) => p.area.slug === area.slug);
    const html = render({ 'エリア': raw, 'ジャンル': rawGenreOf(hub.genre.slug), '市区町村': '名古屋市' });
    const label = `${hub.area.label}の${hub.genre.label}`;
    const where = `${raw} → ${label}`;
    const links = crumbLinks(html);
    assert.deepEqual(links[1], { href: `../${hub.url}`, text: label }, `パンくず: ${where}`);
    assert.deepEqual(moreLink(html), { href: `../${hub.url}`, text: `← ${label}をもっと見る` }, `もっと見る: ${where}`);
    assert.deepEqual(ldNames(html), ['NAGOYA BITES', label, 'テスト酒場'], `BreadcrumbList: ${where}`);
    assert.equal(areaCell(html), `愛知県 名古屋市 ${hub.area.label}`, `基本情報のエリア: ${where}`);
    for (const t of [links[1].text, moreLink(html).text, areaCell(html)]) assert.ok(!MESSY.test(t), `癖のある表記が残っている: ${t}`);
  }
});

test('ハブ自身の見出し（生成したハブページの <h1>）と、店舗ページのパンくずの文字が一致する', () => {
  const seen = new Set();
  for (const { area, raw } of messyRaws) {
    const hub = genrePages.find((p) => p.area.slug === area.slug);
    if (seen.has(hub.url)) continue;
    seen.add(hub.url);
    const hubHtml = hubs.renderHubPage(hub, ctx.pages, ctx.policy, ctx.TRUST_POLICY);
    const h1 = strip((hubHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]);
    const html = render({ 'エリア': raw, 'ジャンル': rawGenreOf(hub.genre.slug) });
    assert.equal(crumbLinks(html)[1].text, h1, `ハブ ${hub.url} の見出し「${h1}」`);
  }
  assert.ok(seen.size >= 2, 'ハブの見出しとの突き合わせが 2 ページ以上ある');
});

test('ジャンルの名前もハブの見出しにそろえる（店のジャンル名がハブの区分名と違うとき）', () => {
  let n = 0;
  for (const hub of genrePages) {
    const g = policy.genres.find((x) => x.slug === hub.genre.slug);
    const raw = g.match.find((m) => m !== g.label && !/[、,/]/.test(m));
    if (!raw) continue;
    const areaRaw = policy.areas.find((a) => a.slug === hub.area.slug).match[0];
    const html = render({ 'エリア': areaRaw, 'ジャンル': raw });
    assert.equal(crumbLinks(html)[1].text, `${hub.area.label}の${hub.genre.label}`, `${raw} → ${hub.genre.label}`);
    if (++n >= 6) break;
  }
  assert.ok(n >= 3, 'ジャンル名が区分名と違う例が 3 件以上ある');
});

test('ハブが無くエリアのハブだけある店: 「もっと見る」・パンくず・基本情報とも、エリアのハブの名前。行政区の名前だけは基本情報で元のまま', () => {
  for (const a of policy.areas) {
    const hub = areaPages.find((p) => p.area.slug === a.slug);
    if (!hub) continue;
    for (const raw of a.match) {
      const html = render({ 'エリア': raw, 'ジャンル': 'どのハブの区分にも当たらない料理' });
      const label = `${hub.area.label}の飲食店`;
      assert.deepEqual(moreLink(html), { href: `../${hub.url}`, text: `← ${label}をもっと見る` }, raw);
      assert.deepEqual(ldNames(html), ['NAGOYA BITES', label, 'テスト酒場'], raw);
      assert.equal(areaCell(html), `愛知県 ${isWard(raw) ? raw : hub.area.label}`, `基本情報のエリア: ${raw}`);
    }
  }
});

test('基本情報の「エリア」: 行政区の名前（名古屋市中区・西区 など）は元の表記のまま、ハブの名前（栄・名駅 など）に粗くしない', () => {
  const wards = policy.areas.flatMap((a) => a.match.filter(isWard).map((raw) => ({ a, raw })));
  assert.ok(wards.length >= 5, '行政区の表記が方針に 5 件以上ある');
  for (const { a, raw } of wards) {
    const hub = genrePages.find((p) => p.area.slug === a.slug);
    const html = render({ 'エリア': raw, 'ジャンル': hub ? rawGenreOf(hub.genre.slug) : 'どのハブの区分にも当たらない料理' });
    assert.equal(areaCell(html), `愛知県 ${raw}`, raw);
    if (hub) assert.equal(crumbLinks(html)[1].text, `${hub.area.label}の${hub.genre.label}`, `パンくずはハブの名前: ${raw}`);
  }
  // 逆に、行政区ではない地名・ホットペッパーの地域名はハブの名前になる
  const html = render({ 'エリア': policy.areas[0].match.find((m) => !isWard(m)), 'ジャンル': '' });
  assert.equal(areaCell(html), `愛知県 ${policy.areas[0].label}`);
});

test('どちらのハブにも当たらない店: 「もっと見る」は行き先（トップのジャンル絞り込み）と同じ文字で、エリア名を入れない。基本情報のエリアは元の表記', () => {
  const html = render({ 'エリア': 'どこの区分にも当たらない町', 'ジャンル': '居酒屋' });
  assert.deepEqual(moreLink(html), { href: `../index.html#genre=${encodeURIComponent('居酒屋')}`, text: '← 居酒屋をもっと見る' });
  assert.ok(!moreLink(html).text.includes('どこの区分にも当たらない町'), '「もっと見る」にエリア名を出さない');
  assert.equal(areaCell(html), '愛知県 どこの区分にも当たらない町');
  assert.deepEqual(crumbLinks(html).map((x) => x.text), ['トップ', '居酒屋']);
  assert.deepEqual(ldNames(html), ['NAGOYA BITES', '居酒屋', 'テスト酒場']);
  // ジャンルも空: 空の「#genre=」へ送らず、トップへ戻す
  const none = render({ 'エリア': 'どこの区分にも当たらない町', 'ジャンル': '' });
  assert.deepEqual(moreLink(none), { href: '../index.html', text: '← トップに戻る' });
  assert.ok(!none.includes('のをもっと見る') && !none.includes('#genre="'));
});

test('名前に使う文字は HTML として安全に出る（ジャンル名・エリア名に & や < があっても壊れない）', () => {
  const html = render({ 'エリア': 'どこの区分にも当たらない町', 'ジャンル': 'A&B <焼き鳥>' });
  assert.equal(areaCell(render({ 'エリア': 'A&B町 <東>', 'ジャンル': '居酒屋' })), '愛知県 A&amp;B町 &lt;東&gt;', '基本情報のエリアも文字を安全にする');
  assert.deepEqual(moreLink(html), { href: `../index.html#genre=${encodeURIComponent('A&B <焼き鳥>')}`, text: '← A&amp;B &lt;焼き鳥&gt;をもっと見る' });
  assert.deepEqual(auditHtml(html, { filename: 'render:area-label-escape' }).violations, []);
});

test('<title> と説明文のエリア名は触らない（検索結果での見え方のために scripts/lib/area_label.js で別に整えてある）', () => {
  for (const { area, raw } of messyRaws) {
    const hub = genrePages.find((p) => p.area.slug === area.slug);
    const html = render({ 'エリア': raw, 'ジャンル': rawGenreOf(hub.genre.slug) });
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    assert.ok(title.includes(`（${titleAreaLabel(raw)}・`), `title は area_label.js のまま: ${title}`);
  }
});

test('全店: 見えるエリア名とジャンル名は、行き先のハブの見出しと同じ。BreadcrumbList の名前は見えるパンくずと一致する', () => {
  assert.ok(stores.length > 1000, '全店が読み込めている');
  const genreByKey = new Map(genrePages.map((p) => [`${p.area.slug}::${p.genre.slug}`, p]));
  const areaBySlug = new Map(areaPages.map((p) => [p.area.slug, p]));
  let withGenreHub = 0, withAreaHub = 0, withoutHub = 0, renamed = 0;
  for (const s of stores) {
    const html = renderStorePage(s, 'J-test', [], []);
    const links = crumbLinks(html);
    const names = ldNames(html);
    const who = `${s['店名']}（${s['エリア']}・${s['ジャンル']}）`;
    const a = areaGenrePages.normalizeArea(s['エリア'], policy);
    const g = areaGenrePages.normalizeGenre(s['ジャンル'], policy);
    const gp = a && g ? genreByKey.get(`${a.slug}::${g.slug}`) : null;
    const ap = !gp && a ? areaBySlug.get(a.slug) : null;
    // 見えるパンくず（トップと店名の間）と BreadcrumbList の名前（NAGOYA BITES と店名の間）は同じ並び
    assert.deepEqual(names.slice(1, -1), links.slice(1).map((x) => x.text), `BreadcrumbList と見えるパンくずが食い違う: ${who}`);
    const more = moreLink(html);
    if (gp) {
      withGenreHub++;
      const label = `${gp.area.label}の${gp.genre.label}`;
      assert.deepEqual(links[1], { href: `../${gp.url}`, text: label }, who);
      assert.deepEqual(more, { href: `../${gp.url}`, text: `← ${label}をもっと見る` }, who);
      if (label !== `${s['エリア']}の${s['ジャンル']}`) renamed++;
    } else if (ap) {
      withAreaHub++;
      const label = `${ap.area.label}の飲食店`;
      assert.deepEqual(links[1], { href: `../${ap.url}`, text: label }, who);
      assert.deepEqual(more, { href: `../${ap.url}`, text: `← ${label}をもっと見る` }, who);
    } else {
      withoutHub++;
      assert.equal(more.text, `← ${s['ジャンル']}をもっと見る`, who);
    }
    // 基本情報のエリア: ハブの区分に当たる店は、行政区の名前でなければハブの名前
    const cell = areaCell(html);
    assert.ok(cell && cell.startsWith('愛知県'), who);
    if (a && !isWard(s['エリア'])) assert.ok(cell.endsWith(a.label), `基本情報のエリアがハブの名前ではない: ${who} → ${cell}`);
    if (a && isWard(s['エリア'])) assert.ok(cell.endsWith(s['エリア']), `行政区の名前が変わっている: ${who} → ${cell}`);
  }
  assert.ok(withGenreHub > 4000 && withAreaHub > 300, `ハブのある店が少なすぎる: ${withGenreHub} / ${withAreaHub}`);
  assert.ok(renamed > 3000, `名前が変わった店が少なすぎる: ${renamed}`);
  assert.ok(withoutHub < 200, `どちらのハブにも当たらない店が多すぎる: ${withoutHub}`);
});
