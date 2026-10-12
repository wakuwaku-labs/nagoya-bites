'use strict';

/**
 * I-17B: 「エリア別 店舗一覧」の行き先と、エリア×ジャンルのハブのパンくず。
 *
 * 背景: フッターの「エリア別 店舗一覧」は stores/index.html に着き、そこがトップの `#store=index` へ転送していた
 * （トップはこのハッシュを読まないので、押してもトップに戻るだけ）。ハブのパンくずにも同じ「店舗一覧」の段があり、
 * 同じ行き止まりだった。どちらも、実在するエリア×ジャンルの入口（stores/area/index.html）に直した。
 *
 * 生成済みのページ（stores/*.html・stores/area/）は CI が npm test の後に作り直すので、ここでは読まない。
 * 読むと、生成器を直した直後の 1 回は古い出力のせいで赤くなり、再生成に進めなくなる（build.yml は npm test が先）。
 * 生成器を直接動かして確かめ、手で保存している静的ページ（トップ・特集・ジャーナルなど）だけを読む。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://nagoya-bites.com';
const ENTRANCE = 'stores/area/index.html';
const LABEL = 'エリア別 店舗一覧';
const chrome = require('../scripts/lib/site_chrome.js');

const FOOTER_LINK_RE = /<a href="([^"]+)">エリア別 店舗一覧<\/a>/g;
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

test('フッターの「エリア別 店舗一覧」は、転送だけのページではなくエリア×ジャンルの入口を指す（深さ0〜3）', () => {
  for (const depth of [0, 1, 2, 3]) {
    const html = chrome.renderFooter({ depth });
    const links = [...html.matchAll(FOOTER_LINK_RE)].map((m) => m[1]);
    assert.deepEqual(links, ['../'.repeat(depth) + ENTRANCE], `深さ${depth}`);
    assert.doesNotMatch(html, /href="[^"]*stores\/index\.html"/, `深さ${depth}: 転送だけの stores/index.html を指さない`);
  }
});

function staticPages() {
  const list = ['index.html', 'about.html', 'faq.html', 'contact.html', 'privacy-policy.html', 'stores/index.html', 'journal/_template.html'];
  for (const dir of ['features', 'journal']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) if (f.endsWith('.html') && !f.startsWith('_')) list.push(`${dir}/${f}`);
  }
  return list;
}

test('手で保存している静的ページのフッターは、どれもエリア×ジャンルの入口へ行き、行き先が実在する', () => {
  const pages = staticPages();
  assert.ok(pages.length > 200, `対象のページが少なすぎる（${pages.length}）`);
  assert.ok(fs.existsSync(path.join(ROOT, ENTRANCE)), '入口のページ自体が無い');
  const bad = [];
  for (const rel of pages) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const links = [...html.matchAll(FOOTER_LINK_RE)].map((m) => m[1]);
    if (links.length !== 1) { bad.push(`${rel}: 「${LABEL}」が${links.length}個`); continue; }
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), links[0]));
    if (target !== ENTRANCE) bad.push(`${rel}: ${links[0]} → ${target}`);
  }
  assert.deepEqual(bad, [], bad.slice(0, 5).join(' / '));
});

test('stores/index.html: 転送先はエリア×ジャンルの入口。トップの #store=index へは送らず、noredirect の抜け道は残す', () => {
  const html = fs.readFileSync(path.join(ROOT, 'stores/index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => /location\.replace/.test(s));
  assert.equal(scripts.length, 1, '転送の script が1つ');
  const m = /location\.replace\("([^"]+)"\)/.exec(scripts[0]);
  assert.ok(m, 'location.replace の行き先が読める');
  assert.equal(m[1], 'area/index.html');
  assert.ok(fs.existsSync(path.join(ROOT, 'stores', m[1])), '転送先のファイルが実在する');
  assert.match(scripts[0], /location\.search\.indexOf\("noredirect"\)/, 'noredirect の抜け道を残す');
  assert.doesNotMatch(html, /index\.html#store=index(?!&review)/, 'トップの #store=index へ転送しない');
});

test('gen-store-pages.js が書く店舗ページのフッターも、エリア×ジャンルの入口を指す', () => {
  const { renderStorePage } = require('../gen-store-pages.js');
  const storesJson = path.join(ROOT, 'data', 'stores.json');
  if (!fs.existsSync(storesJson)) return; // 環境依存（ローカルビルド未実行）はスキップ
  const sample = JSON.parse(fs.readFileSync(storesJson, 'utf8')).find((s) => s['ホットペッパーID']);
  if (!sample) return;
  const html = renderStorePage(sample, sample['ホットペッパーID'], []);
  const links = [...html.matchAll(FOOTER_LINK_RE)].map((m) => m[1]);
  assert.deepEqual(links, ['../' + ENTRANCE]);
});

// ── エリア×ジャンルのハブ（生成器を直接動かす） ──

const hubs = require('../scripts/gen_area_genre_pages.js');
const ctx = hubs.prepare();
const rendered = new Map(); // page.url → html
function render(page) {
  if (!rendered.has(page.url)) rendered.set(page.url, hubs.renderHubPage(page, ctx.pages, ctx.policy, ctx.TRUST_POLICY));
  return rendered.get(page.url);
}

function visibleCrumbs(html) {
  const m = /<!-- NB-CHROME:BREADCRUMB:START -->[\s\S]*?<div class="breadcrumb">([\s\S]*?)<\/div>[\s\S]*?<!-- NB-CHROME:BREADCRUMB:END -->/.exec(html);
  assert.ok(m, 'パンくずがある');
  return m[1].split('<span>›</span>').map((part) => {
    const t = part.trim();
    const a = /^<a href="([^"]*)">([^<]*)<\/a>$/.exec(t);
    return a ? { href: a[1], label: unesc(a[2]) } : { label: unesc(t) };
  });
}

function breadcrumbLd(html) {
  const found = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const j = JSON.parse(m[1]);
    for (const o of Array.isArray(j) ? j : [j]) if (o && o['@type'] === 'BreadcrumbList') found.push(o.itemListElement);
  }
  assert.ok(found.length <= 1, 'BreadcrumbList は 1 つまで');
  return found[0] || null;
}

const pageUrlOf = (page) => `${BASE}/${page.url}`;
const norm = (u) => u.replace(/^https:\/\/nagoya-bites\.com\/index\.html$/, `${BASE}/`);

test('ハブ: 種類ごとのパンくずの形（TOP › エリア×ジャンルで探す › エリア › ジャンル › 条件）', () => {
  const byType = (t) => ctx.pages.find((p) => p.type === t);
  const root = byType('root'), area = byType('area'), genre = byType('genre'), cond = byType('condition');
  assert.ok(root && area && genre && cond, '4種類のページが計画に含まれる');

  assert.deepEqual(visibleCrumbs(render(root)).map((c) => c.label), ['TOP', 'エリア×ジャンルで探す']);
  assert.deepEqual(visibleCrumbs(render(area)).map((c) => c.label), ['TOP', 'エリア×ジャンルで探す', area.area.label]);
  assert.deepEqual(visibleCrumbs(render(genre)).map((c) => c.label), ['TOP', 'エリア×ジャンルで探す', genre.area.label, genre.genre.label]);
  assert.deepEqual(visibleCrumbs(render(cond)).map((c) => c.label), ['TOP', 'エリア×ジャンルで探す', cond.area.label, cond.genre.label, cond.cond.label]);

  assert.deepEqual(breadcrumbLd(render(area)).map((i) => i.name), ['NAGOYA BITES', 'エリア×ジャンルで探す', area.area.label]);
  assert.deepEqual(breadcrumbLd(render(genre)).map((i) => i.name), ['NAGOYA BITES', 'エリア×ジャンルで探す', genre.area.label, genre.genre.label]);
  assert.deepEqual(breadcrumbLd(render(cond)).map((i) => i.name), ['NAGOYA BITES', 'エリア×ジャンルで探す', cond.area.label, cond.genre.label, cond.cond.label]);
});

test('ハブ: 全ページで、行き止まりの「店舗一覧」の段が無く、見える階層と構造化データが同じ行き先を指す', () => {
  const known = new Set(ctx.pages.map((p) => p.url));
  const problems = [];
  for (const page of ctx.pages) {
    const html = render(page);
    const crumbs = visibleCrumbs(html);
    const ld = breadcrumbLd(html);
    const self = pageUrlOf(page);

    if (crumbs.some((c) => c.label === '店舗一覧' || /(^|\/)stores\/(index\.html)?$/.test(c.href || ''))) problems.push(`${page.url}: 見えるパンくずに店舗一覧が残る`);
    if (crumbs[1] && crumbs[1].label !== 'エリア×ジャンルで探す') problems.push(`${page.url}: 2段目が入口ではない`);
    if (crumbs.slice(0, -1).some((c) => !c.href) || crumbs[crumbs.length - 1].href) problems.push(`${page.url}: 最後の段だけが文字になっていない`);

    // 見える階層の行き先は、実在するページ（ファイルがある・今回生成する）だけ
    for (const c of crumbs.filter((x) => x.href)) {
      const abs = new URL(c.href, self).href;
      const rel = abs.slice(BASE.length + 1);
      if (!fs.existsSync(path.join(ROOT, rel)) && !known.has(rel)) problems.push(`${page.url}: ${c.href} が実在しない`);
    }

    if (!ld) { if (page.type !== 'root') problems.push(`${page.url}: BreadcrumbList が無い`); continue; }
    if (ld.length !== crumbs.length) { problems.push(`${page.url}: 段の数が違う 見える${crumbs.length}・構造化${ld.length}`); continue; }
    if (!ld.every((it, i) => it.position === i + 1)) problems.push(`${page.url}: position が連番でない`);
    if (ld.some((it) => it.name === '店舗一覧' || /\/stores\/(index\.html)?$/.test(it.item || ''))) problems.push(`${page.url}: 構造化データに店舗一覧が残る`);
    crumbs.forEach((c, i) => {
      if (i === 0) { if (norm(new URL(c.href, self).href) !== norm(ld[0].item)) problems.push(`${page.url}: 1段目の行き先が違う`); return; }
      if (c.label !== ld[i].name) problems.push(`${page.url}: ${i + 1}段目の名前が違う ${c.label} / ${ld[i].name}`);
      const want = c.href ? new URL(c.href, self).href : self;
      if (ld[i].item !== want) problems.push(`${page.url}: ${i + 1}段目の行き先が違う ${want} / ${ld[i].item}`);
    });
  }
  assert.ok(ctx.pages.length > 100, `ページが少なすぎる（${ctx.pages.length}）`);
  assert.deepEqual(problems, [], problems.slice(0, 5).join('\n'));
});

test('ハブ: フッターの「エリア別 店舗一覧」も、エリア×ジャンルの入口を指す（全ページ）', () => {
  const bad = [];
  for (const page of ctx.pages) {
    const links = [...render(page).matchAll(FOOTER_LINK_RE)].map((m) => m[1]);
    const depth = page.url.split('/').length - 1;
    if (links.length !== 1 || links[0] !== '../'.repeat(depth) + ENTRANCE) bad.push(`${page.url}: ${links.join(',')}`);
  }
  assert.deepEqual(bad, [], bad.slice(0, 5).join('\n'));
});
