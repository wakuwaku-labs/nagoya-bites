'use strict';

/**
 * tests/site_chrome_entities.test.js — パンくずの店名・記事名の「二重エスケープ」の再発防止
 *
 * 事故（2026-10-12）: 日次ジャーナルの生成器は、記事名を HTML としてエスケープした文字（Afro&#39;s）を
 * 目に見えるパンくずだけでなく JSON-LD の name にも入れる。apply_site_chrome.js はパンくずを
 * JSON-LD の name から作り直すとき、その文字をそのまま esc() に渡していたため
 * `&#39;` が `&amp;#39;` に二重にエスケープされた。結果は2つ。
 *   1. `npm test` の「--check reports zero mismatches across a sample」が、記事の数が変わって標本が
 *      ずれるたびに（店名に ' を含む記事 2026-10-11 が標本に入った回から）落ちた。
 *      build.yml は npm test を再生成の前に回すので、落ちるとその日のビルドが丸ごと止まる。
 *   2. 2026-05-12 の記事のパンくずは、すでに作り直されていて画面に `&quot;` の文字がそのまま出ていた。
 * 直し方: ① 作り直しの前に、JSON-LD の name と h1 の中身を素の文字に戻す（unesc）
 *         ② esc() も ' を &#39; にして、生成器（generate_daily_draft.js）の書き方と同じ形にそろえる。
 * ここでは標本に頼らず、決まった入力と実際の記事で確かめる。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const chrome = require(path.join(ROOT, 'scripts', 'lib', 'site_chrome.js'));
const { applyBreadcrumb, buildBreadcrumbItems } = require(path.join(ROOT, 'scripts', 'apply_site_chrome.js'));
const { renderHtml } = require(path.join(ROOT, 'scripts', 'generate_daily_draft.js'));

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const crumbOf = (html) => {
  const a = html.indexOf('<!-- NB-CHROME:BREADCRUMB:START -->');
  const b = html.indexOf('<!-- NB-CHROME:BREADCRUMB:END -->');
  return a >= 0 && b > a ? html.slice(a, b) : '';
};
const DOUBLE_ESCAPED = /&amp;(?:amp|lt|gt|quot|apos|#\d+|#[xX][0-9a-fA-F]+);/;

test('esc: & < > " \' をすべてエスケープする（生成器の esc と同じ形）', () => {
  assert.equal(chrome.esc(`A&B <i> "q" it's`), 'A&amp;B &lt;i&gt; &quot;q&quot; it&#39;s');
  assert.equal(chrome.esc(null), '');
});

test('unesc: esc の逆。1回だけ戻し、知らない実体参照や不正な番号はそのまま残す', () => {
  const samples = [`Afro's BBQ`, 'A & B', '"勝手口"', '<b>', `& &amp; &#39;`, '', '日本語のみ'];
  for (const s of samples) assert.equal(chrome.unesc(chrome.esc(s)), s, `往復: ${s}`);
  assert.equal(chrome.unesc('Afro&#39;s &amp; &quot;x&quot; &lt;b&gt;'), `Afro's & "x" <b>`);
  assert.equal(chrome.unesc('&#x27; &#X27; &#12354; &apos;'), `' ' あ '`);
  // 1回だけ: &amp;lt; は &lt;（< にはならない）
  assert.equal(chrome.unesc('&amp;lt;'), '&lt;');
  // 知らない実体参照・0・サロゲート・範囲外は触らない
  assert.equal(chrome.unesc('&bogus; &#0; &#xD800; &#x110000;'), '&bogus; &#0; &#xD800; &#x110000;');
});

test('renderBreadcrumb: 素の文字は1回だけエスケープされる（二重にならない）', () => {
  const html = chrome.renderBreadcrumb([{ href: 'index.html', label: 'トップ' }, { label: `L'atelier K & "Co"` }], { depth: 1 });
  assert.match(html, /L&#39;atelier K &amp; &quot;Co&quot;/);
  assert.doesNotMatch(html, DOUBLE_ESCAPED);
});

// 日次ジャーナルの形（journal/_template.html）: 目に見えるパンくずも JSON-LD の name も、エスケープ済みの記事名
function journalLikeArticle(escapedTitle, visibleOverride) {
  let crumb = chrome.renderBreadcrumb([
    { href: 'index.html', label: 'トップ' },
    { href: 'journal/index.html', label: 'ジャーナル' },
    { label: chrome.unesc(escapedTitle) },
  ], { depth: 1 });
  // 目に見える表示だけを別の形（二重エスケープされた形など）にしたいとき
  if (visibleOverride) crumb = crumb.replace(`    ${chrome.esc(chrome.unesc(escapedTitle))}\n`, `    ${visibleOverride}\n`);
  return `<html><head><script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type":"ListItem","position":1,"name":"NAGOYA BITES","item":"https://nagoya-bites.com/"},
    {"@type":"ListItem","position":2,"name":"Journal","item":"https://nagoya-bites.com/journal/"},
    {"@type":"ListItem","position":3,"name":"${escapedTitle}"}
  ]
}
</script></head><body>
<!-- NB-CHROME:HEADER:END -->
${crumb}
<h1>${escapedTitle}</h1>
</body></html>`;
}

test('パンくずの作り直し: 記事名に \' & " < > を含んでも、作り直しの結果は変わらない（冪等）', () => {
  const titles = [
    'Afro&#39;s BBQ アメリカンBBQで宴会',
    '料亭『河文』の板場が&quot;勝手口&quot;の隠れ家になった意味',
    'Bistro &amp; Cafe ARAKAZU の昼',
    '1 &lt; 2 &gt; 0 の話',
    '普通の記事名',
  ];
  for (const t of titles) {
    const html = journalLikeArticle(t);
    const r = applyBreadcrumb(html, { depth: 1, group: 'journal' });
    assert.equal(r.changed, false, `作り直すと変わってしまう: ${t}\n${crumbOf(r.html)}`);
    assert.doesNotMatch(crumbOf(r.html), DOUBLE_ESCAPED, t);
  }
});

test('パンくずの作り直し: すでに二重エスケープされた表示は、素の文字を取り出して1回に直す', () => {
  const html = journalLikeArticle('A &amp; B &quot;C&quot;', 'A &amp;amp; B &amp;quot;C&amp;quot;');
  assert.match(crumbOf(html), DOUBLE_ESCAPED, '前提: 二重エスケープの表示がある');
  const r = applyBreadcrumb(html, { depth: 1, group: 'journal' });
  assert.equal(r.changed, true);
  assert.doesNotMatch(crumbOf(r.html), DOUBLE_ESCAPED);
  assert.match(crumbOf(r.html), /A &amp; B &quot;C&quot;/);
});

test('パンくずの作り直し: 最後の項目に item の URL がある JSON-LD でも、name の実体参照を素の文字に戻す', () => {
  const html = journalLikeArticle('Afro&#39;s &amp; Co').replace(
    '"name":"Afro&#39;s &amp; Co"}',
    '"name":"Afro&#39;s &amp; Co","item":"https://nagoya-bites.com/journal/2026-10-11-x.html"}');
  assert.match(html, /"item":"https:\/\/nagoya-bites\.com\/journal\/2026-10-11-x\.html"/, '前提: 最後の項目に item がある');
  const items = buildBreadcrumbItems(html, 'journal');
  assert.equal(items[items.length - 1].label, `Afro's & Co`);
  const r = applyBreadcrumb(html, { depth: 1, group: 'journal' });
  assert.doesNotMatch(crumbOf(r.html), DOUBLE_ESCAPED);
  assert.match(crumbOf(r.html), /Afro&#39;s &amp; Co/);
});

test('パンくずの作り直し: JSON-LD が無いときは h1 の中身（HTML）から1回だけエスケープして作る', () => {
  const html = '<html><body>\n<!-- NB-CHROME:HEADER:END -->\n<h1 class="art-title">Tom&#39;s <em>Diner</em> &amp; Co</h1>\n</body></html>';
  const items = buildBreadcrumbItems(html, 'features');
  assert.equal(items[items.length - 1].label, `Tom's Diner & Co`);
  const r = applyBreadcrumb(html, { depth: 1, group: 'features' });
  assert.match(crumbOf(r.html) || r.html, /Tom&#39;s Diner &amp; Co/);
  assert.doesNotMatch(r.html, DOUBLE_ESCAPED);
});

test('生成器との約束: 日次ジャーナルの生成器が書いたパンくずを、作り直しは変えない', () => {
  // 記事名にエスケープの対象になる文字を全部入れて、実際の生成器（renderHtml）に通す
  const input = {
    title: `星ヶ丘「Afro's BBQ」& "宴会" <飲み放題> 3,500円`, description: '説明', slug: '2026-10-12-entities',
    date: '2026-10-12', lead: 'リード', theme: 'today_one', body_html: '<p>本文</p>', stores: [], sources: [], insider_points: [],
  };
  const html = renderHtml(input);
  assert.match(crumbOf(html), /Afro&#39;s BBQ/, '前提: 生成器は目に見えるパンくずに記事名を入れる');
  const r = applyBreadcrumb(html, { depth: 1, group: 'journal' });
  assert.equal(r.changed, false, `生成器の書き方と作り直しの書き方がずれている:\n${crumbOf(html)}\n--- 作り直し ---\n${crumbOf(r.html)}`);
});

test('実際の記事: 店名に \' を含む記事と、" を含む記事のパンくずが、作り直しで変わらず、二重エスケープも無い', () => {
  for (const rel of ['journal/2026-10-11-hoshigaoka-afros-bbq-enkai.html', 'journal/2026-05-12-katteguchi-kawachiya-marunouchi.html']) {
    const html = read(rel);
    assert.doesNotMatch(crumbOf(html), DOUBLE_ESCAPED, `${rel}: 画面にエスケープの文字がそのまま出る`);
    const r = applyBreadcrumb(html, { depth: 1, group: 'journal' });
    assert.equal(r.changed, false, `${rel}: 作り直しで変わる`);
  }
  assert.match(crumbOf(read('journal/2026-10-11-hoshigaoka-afros-bbq-enkai.html')), /Afro&#39;s BBQ/);
  assert.match(crumbOf(read('journal/2026-05-12-katteguchi-kawachiya-marunouchi.html')), /&quot;勝手口&quot;/);
});

test('手で保守している特集・ジャーナルすべて: パンくずに二重エスケープの文字が残っていない', () => {
  const bad = [];
  let seen = 0;
  for (const dir of ['features', 'journal']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
      if (!f.endsWith('.html')) continue;
      const crumb = crumbOf(read(`${dir}/${f}`));
      if (!crumb) continue;
      seen++;
      if (DOUBLE_ESCAPED.test(crumb)) bad.push(`${dir}/${f}`);
    }
  }
  assert.ok(seen > 200, `パンくずを持つページを集められた: ${seen}`);
  assert.deepEqual(bad, []);
});
