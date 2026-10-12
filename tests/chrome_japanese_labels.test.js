'use strict';
/**
 * tests/chrome_japanese_labels.test.js — I-07b（UI・UX改修 段階1a）
 *
 * 全ページに出る共通の英語の表示を日本語にした決まりを確かめる（制約3「テキストはすべて日本語」）。
 *   1. フッターの「Daily Journal」→「ジャーナル」（ヘッダーのナビ・トップの見出しと同じ言葉。新しい文言は作らない）
 *   2. パンくずの先頭「TOP」→「トップ」
 *   3. ジャーナルの記事の下の「Journal 一覧」→「ジャーナル一覧」、ジャーナル一覧の見出しの上の小さな英語とパンくず
 *
 * 直す場所は、正本（scripts/lib/site_chrome.js）・生成器・ひな形と、手で保守している静的ページ。
 * 店舗ページ・エリア×ジャンルのハブは CI が毎回作り直すので、ここでは読まない
 * （build.yml は npm test を再生成の前に回す。生成済みのページを読むテストは書かない）。
 * 生成器が返す形は、store_index_entrance.test.js（ハブのパンくず）と site_chrome.test.js が見ている。
 *
 * 範囲の外: 特集・FAQ・運営ページなどの見出しの上の小さな英語（Restaurant Database・Feature Articles・
 *   Frequently Asked Questions・Get in Touch・Legal など）、「EDITORS' PICK」、「Photo:」。別の課題で扱う。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const chrome = require('../scripts/lib/site_chrome');
const { buildRelatedHtml } = require('../scripts/refresh_journal_related');

// 手で保守している静的ページ（CI が作り直さないもの）
function staticPages() {
  const pages = ['index.html', 'about.html', 'contact.html', 'faq.html', 'privacy-policy.html', 'stores/index.html', 'journal/_template.html'];
  for (const dir of ['features', 'journal']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
      if (f.endsWith('.html') && !pages.includes(`${dir}/${f}`)) pages.push(`${dir}/${f}`);
    }
  }
  return pages;
}

test('正本: フッターの記事の群は「ジャーナル」で、ナビと同じ言葉・同じリンク先', () => {
  const html = chrome.renderFooter({ depth: 1 });
  assert.ok(html.includes('<a href="../journal/index.html">ジャーナル</a>'), 'フッターに「ジャーナル」のリンクがある');
  assert.ok(!html.includes('Daily Journal'), 'フッターに Daily Journal が残っていない');
  const nav = chrome.renderHeader({ depth: 1, active: null });
  assert.ok(nav.includes('<a href="../journal/index.html">ジャーナル</a>'), 'ナビも同じ言葉');
  // 深さ0（トップ直下のページ）でも同じ
  assert.ok(chrome.renderFooter({ depth: 0 }).includes('<a href="journal/index.html">ジャーナル</a>'));
});

test('生成器・ひな形のソースに、直した英語が戻っていない', () => {
  const sources = [
    'scripts/lib/site_chrome.js',
    'gen-store-pages.js',
    'scripts/gen_area_genre_pages.js',
    'scripts/gen_industry_features.js',
    'scripts/apply_site_chrome.js',
    'scripts/recreate_fabricated_features.js',
    'scripts/refresh_journal_related.js',
    'journal/_template.html',
  ];
  for (const rel of sources) {
    const src = read(rel);
    assert.ok(!/label:\s*'TOP'/.test(src), `${rel}: パンくずの先頭が TOP のまま`);
    assert.ok(!/>TOP<\/a>/.test(src), `${rel}: リンクの文字が TOP のまま`);
    assert.ok(!/Daily Journal'|>Daily Journal</.test(src), `${rel}: Daily Journal のまま`);
    assert.ok(!/Journal 一覧/.test(src), `${rel}: Journal 一覧 のまま`);
  }
});

test('静的ページ（トップ・運営・FAQ・特集・ジャーナルすべて）に、直した英語が残っていない', () => {
  const pages = staticPages();
  assert.ok(pages.length > 200, `静的ページを集められた: ${pages.length}`);
  const bad = [];
  for (const rel of pages) {
    const html = read(rel);
    if (/<a [^>]*>Daily Journal<\/a>/.test(html)) bad.push(`${rel}: フッターが Daily Journal`);
    if (/<a [^>]*>TOP<\/a>/.test(html)) bad.push(`${rel}: パンくずが TOP`);
    if (/>Journal 一覧<\/a>/.test(html)) bad.push(`${rel}: Journal 一覧`);
  }
  assert.deepStrictEqual(bad, []);
});

test('静的ページのフッターは「ジャーナル」で、リンク先（journal/index.html）は変わっていない', () => {
  const missing = [];
  for (const rel of staticPages()) {
    if (rel === 'journal/_template.html') continue;
    const html = read(rel);
    const footer = html.slice(html.indexOf('<!-- NB-CHROME:FOOTER:START -->'), html.indexOf('<!-- NB-CHROME:FOOTER:END -->'));
    const hasFooter = footer.length > 0;
    // フッターの区画を持つページは、必ず「ジャーナル」のリンクを持つ。持たないページ（独自のフッター）はトップだけ
    if (hasFooter && !/<a href="(?:\.\.\/)?journal\/index\.html">ジャーナル<\/a>/.test(footer)) missing.push(rel);
  }
  assert.deepStrictEqual(missing, []);
  // トップ（独自のフッター）も同じ
  assert.ok(/<a href="journal\/index\.html">ジャーナル<\/a>/.test(read('index.html')));
});

test('ジャーナル一覧: 見出しの上の小さな英語・パンくずが日本語', () => {
  const html = read('journal/index.html');
  assert.ok(html.includes('<p class="eyebrow">ジャーナル</p>'));
  assert.ok(!html.includes('<p class="eyebrow">Daily Journal</p>'));
  assert.ok(/<span>›<\/span>\s*ジャーナル\s*<\/div>/.test(html), 'パンくずの最後が「ジャーナル」');
  assert.ok(html.includes('<a href="../index.html">トップ</a>'), 'パンくずの先頭が「トップ」');
});

test('ジャーナルの記事のひな形と、日次の関連記事の区画は「ジャーナル一覧」', () => {
  const tpl = read('journal/_template.html');
  assert.ok(tpl.includes('>ジャーナル一覧</a>'));
  assert.ok(tpl.includes('<a href="../index.html">トップ</a>'));
  const posts = ['2026-01-01-a.html', '2026-01-02-b.html', '2026-01-03-c.html'];
  const meta = {};
  for (const f of posts) meta[f] = { title: `テスト記事 ${f}`, topics: new Set() };
  const html = buildRelatedHtml(posts[0], posts, meta);
  assert.ok(html.includes('class="related-link is-primary" href="index.html">ジャーナル一覧</a>'), html);
  assert.ok(!html.includes('Journal 一覧'));
});

test('再生成の対象外の古い店舗ページ（data/store_page_orphans.json）にも、直した英語が残っていない', () => {
  // 生成器は孤児の店舗ページを作り直さない。ここが漏れると、CI が全部の店舗ページを作り直しても英語が残る
  const orphans = JSON.parse(read('data/store_page_orphans.json')).orphanSlugs;
  assert.ok(Array.isArray(orphans) && orphans.length > 0, '孤児の一覧を読めた');
  const bad = [];
  let seen = 0;
  for (const slug of orphans) {
    const rel = `stores/${slug}.html`;
    if (!fs.existsSync(path.join(ROOT, rel))) continue;
    seen++;
    const html = read(rel);
    if (/<a [^>]*>Daily Journal<\/a>/.test(html)) bad.push(`${rel}: フッターが Daily Journal`);
    if (/<a [^>]*>TOP<\/a>/.test(html)) bad.push(`${rel}: パンくずが TOP`);
  }
  assert.ok(seen > 0, '孤児の店舗ページを1本以上読めた');
  assert.deepStrictEqual(bad, []);
});

test('特集の一覧とひな形のパンくずの先頭が「トップ」', () => {
  assert.ok(read('features/index.html').includes('<a href="../index.html">トップ</a>'));
  // 特集の生成器（業界人特集）の戻り値は gen_industry_features.js のソースで確かめる（上のソース検査）。ここは実物の1本
  const banquet = read('features/banquet.html');
  const crumb = banquet.slice(banquet.indexOf('<!-- NB-CHROME:BREADCRUMB:START -->'), banquet.indexOf('<!-- NB-CHROME:BREADCRUMB:END -->'));
  assert.ok(crumb.includes('<a href="../index.html">トップ</a>'), crumb);
});
