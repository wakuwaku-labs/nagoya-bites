'use strict';

/**
 * 404.html（scripts/gen_404_page.js）の試験（I-33・P-316）。
 *
 * このゲートが守るもの:
 *   GitHub Pages は存在しない URL に、サイト直下の 404.html を HTTP 404 のまま返す。
 *   深い URL（/features/a/b/c など）でも同じ文書が返るので、
 *   (1) リンクと資産がすべて「/」始まりの絶対パスであること（相対パスだと CSS もリンクも外れる）
 *   (2) リンク先が実在すること（行き止まりの 404 ページにしない）
 *   (3) 検索に出さないこと（noindex・sitemap.xml / llms.txt に入れない）
 *   (4) 生成物と一致していること（共通クローム・GA4・フォントの正本を変えたら作り直す）
 *   (5) 作業用ページ（_extract.html・manual_tagging.html）が公開のルートに戻らないこと
 *       GitHub Pages は main のルートをそのまま公開するため、置いたファイルは誰でも読める
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const gen = require(path.join(ROOT, 'scripts', 'gen_404_page.js'));
const chrome = require(path.join(ROOT, 'scripts', 'lib', 'site_chrome.js'));
const DS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'design_system.json'), 'utf8'));

const html = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');

// href / src の値（# だけのもの・javascript: は除く前に全部拾う）
function refs(doc) {
  const out = [];
  const re = /\b(?:href|src)="([^"]*)"/g;
  let m;
  while ((m = re.exec(doc))) out.push(m[1]);
  return out;
}

test('404.html: scripts/gen_404_page.js の生成物と一致している', () => {
  assert.equal(html, gen.render(), '404.html が生成物とずれています（node scripts/gen_404_page.js で作り直してください）');
});

test('404.html: リンクと資産は「/」始まりの絶対パス・https・ページ内アンカーのどれか（相対パスは禁止）', () => {
  const bad = refs(html).filter(v => !(v.startsWith('/') || v.startsWith('https://') || v.startsWith('#')));
  assert.deepEqual(bad, [], `相対パスが残っています（深い URL で外れます）: ${bad.join(' , ')}`);
});

test('404.html: 「/」始まりのリンク先は、リポジトリに実在するファイルを指す', () => {
  const missing = [];
  for (const v of refs(html)) {
    if (!v.startsWith('/') || v.startsWith('//')) continue;
    const rel = v.replace(/[?#].*$/, '').replace(/^\/+/, '');
    if (!rel) continue; // 「/」だけ（トップ）
    if (!fs.existsSync(path.join(ROOT, rel))) missing.push(v);
  }
  assert.deepEqual(missing, [], `リンク先が存在しません: ${missing.join(' , ')}`);
});

test('404.html: 正本の CSS（data/design_system.json の cssPath）とフォントの URL を、同じ形で読み込む', () => {
  assert.ok(html.includes(`href="/${DS.cssPath.replace(/^\/+/, '')}"`), 'nb.css を絶対パスで読み込んでいません');
  assert.ok(html.includes(`href="${DS.fontsUrl}"`), 'フォントの URL が data/design_system.json の fontsUrl と違います');
});

test('404.html: 検索に出さない（noindex・sitemap.xml / llms.txt に入れない）', () => {
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.ok(!/\/404\.html/.test(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8')), 'sitemap.xml に 404.html が入っています');
  const llms = path.join(ROOT, 'llms.txt');
  if (fs.existsSync(llms)) assert.ok(!/404\.html/.test(fs.readFileSync(llms, 'utf8')), 'llms.txt に 404.html が入っています');
});

test('404.html: GA4 の読み込みとイベント関数、本文の見出しと戻り先がある（<main> と <h1> は 1 つずつ）', () => {
  assert.match(html, /googletagmanager\.com\/gtag\/js\?id=/);
  assert.match(html, /function trackEvent|trackEvent\s*=/);
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<title>ページが見つかりません \| NAGOYA BITES<\/title>/);
  // 戻り先は 3 つ（店舗検索・エリア・特集）。行き止まりにしない
  for (const href of ['/index.html', '/stores/area/index.html', '/features/index.html']) {
    assert.ok(html.includes(`href="${href}" onclick="trackEvent('internal_link_click'`), `戻り先 ${href} が計測つきで出ていません`);
  }
});

test('404.html: font-size の直書きや :root の再定義を持たない（制約12・トークンだけを使う）', () => {
  const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  assert.doesNotMatch(style, /font-size:\s*\d/, 'font-size のリテラルが入っています（var(--fs-*) を使ってください）');
  assert.doesNotMatch(style, /:root\s*\{/);
});

test('site_chrome.js: base を渡すと、ヘッダーとフッターのリンクがすべて base 始まりになる（既定の相対パスは変わらない）', () => {
  const head = chrome.renderHeader({ depth: 0, active: null, main: false, base: '/' });
  const foot = chrome.renderFooter({ depth: 0, main: false, base: '/' });
  for (const part of [head, foot]) {
    const internal = [...part.matchAll(/\bhref="([^"#][^"]*)"/g)].map(m => m[1]).filter(v => !/^https?:/.test(v));
    assert.ok(internal.length > 0);
    const bad = internal.filter(v => !v.startsWith('/'));
    assert.deepEqual(bad, [], `base を指定したのに相対のリンクが残っています: ${bad.join(' , ')}`);
  }
  // 既定（base なし）は今までどおり depth の相対パス
  const rel = chrome.renderHeader({ depth: 1, active: 'features' });
  assert.match(rel, /href="\.\.\/index\.html"/);
  assert.ok(!/href="\/index\.html"/.test(rel));
});

test('作業用ページ（_extract.html・manual_tagging.html）が公開のルートに無い', () => {
  for (const f of ['_extract.html', 'manual_tagging.html']) {
    assert.ok(!fs.existsSync(path.join(ROOT, f)), `${f} が公開のルートにあります（GitHub Pages は main のルートを全部公開します。履歴は残るので、必要なら git で取り出してください）`);
  }
});
