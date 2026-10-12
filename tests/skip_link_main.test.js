'use strict';

/**
 * tests/skip_link_main.test.js — I-26a（UI・UX改修 段階1d・計画 U-77）
 *
 * 「本文へスキップ」のリンクと <main> を、全ページの共通クローム（scripts/lib/site_chrome.js）から出す。
 * 以前は、本文へ飛ぶリンクを持つのがトップだけで、<main> があるのは数ページだけだった
 * （キーボード・スクリーンリーダーの利用者は、毎ページ、ヘッダーのナビを全部たどらないと本文に着けなかった）。
 *
 *   - ヘッダーのブロック: 先頭に <a class="skip-link" href="#main-content">、最後に <main id="main-content"> の開き
 *   - フッターのブロック: 最初に </main>
 *   - ヘッダーとフッターは <body> の直下で隣り合うので、間にある本文はそのまま <main> の中に入る
 *   - ページ自身が <main> を持つ所（contact・privacy-policy など）は、2つ目を足さず自前の <main> に同じ id を付ける
 *   - トップ（index.html）は body の先頭に自前の「本文へスキップ」を持つので、ヘッダーのブロックでは出さない
 *
 * 生成ページ（店舗ページ・ハブ・日次ジャーナル）は CI が作り直すので、生成器を直接動かして確かめる
 * （build.yml は npm test を再生成の前に回す。生成済みのページは読まない）。
 * 手で保守している静的ページ（トップ・運営系・特集・ジャーナルのひな形・店舗の入口）は直接読む。
 * 日次ジャーナルの記事は読まない（記事の本文は LLM が書いた HTML で、閉じ忘れがあっても build を止めたくない。
 * 記事の形はひな形と生成器のテストで見る）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const chrome = require(path.join(ROOT, 'scripts', 'lib', 'site_chrome.js'));
const apply = require(path.join(ROOT, 'scripts', 'apply_site_chrome.js'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const strip = (h) => h.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
const count = (h, re) => (strip(h).match(re) || []).length;

// ── 開いている要素の並び（<main> で包めるかを見る。ヘッダーの終わりとフッターの始まりで同じなら包める） ──
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
function openElementsAt(html, pos) {
  const s = html.slice(0, pos)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '<svg></svg>');
  const stack = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(s))) {
    const tag = m[2].toLowerCase();
    if (VOID.has(tag) || m[3] === '/') continue;
    if (m[1] !== '/') stack.push(tag);
    else { const i = stack.lastIndexOf(tag); if (i >= 0) stack.length = i; }
  }
  return stack.join('>');
}

/** ページが「本文へスキップ」と <main> を正しく持つか。問題の説明の配列を返す（空なら良い） */
function problems(html, { top = false } = {}) {
  const out = [];
  const open = count(html, /<main[\s>]/g), close = count(html, /<\/main>/g);
  if (open !== 1 || close !== 1) out.push(`<main> が ${open} 個・</main> が ${close} 個`);
  const ids = count(html, /\sid="main-content"/g);
  if (ids !== 1) out.push(`id="main-content" が ${ids} 個`);
  const skips = count(html, /class="skip-link"/g);
  if (skips !== 1) out.push(`skip-link が ${skips} 個`);
  const href = (html.match(/<a href="([^"]*)" class="skip-link"/) || [])[1];
  if (href !== '#main-content') out.push(`skip-link の href が ${href}`);
  const body = strip(html);
  const iSkip = body.indexOf('class="skip-link"');
  const iHeader = body.search(/<header[\s>]/);
  if (!(iSkip >= 0 && iSkip < iHeader)) out.push('skip-link が <header> より前にない');
  const iMain = body.search(/<main[\s>]/);
  const iFooter = body.indexOf('<footer class="nb-footer">');
  const iMainEnd = body.indexOf('</main>');
  if (!(iHeader < iMain && iMain < iMainEnd && iMainEnd < iFooter)) out.push('<header> → <main> → </main> → <footer> の順になっていない');
  const he = html.indexOf(chrome.MARK('HEADER', 'END')), fsx = html.indexOf(chrome.MARK('FOOTER', 'START'));
  if (he >= 0 && fsx >= 0 && openElementsAt(html, he) !== openElementsAt(html, fsx)) {
    out.push(`ヘッダーの終わり（${openElementsAt(html, he)}）とフッターの始まり（${openElementsAt(html, fsx)}）で開いている要素が違う`);
  }
  return out;
}

// ── レンダラー ──────────────────────────────────────────────────────────────

test('renderHeader: 先頭に「本文へスキップ」、最後に <main id="main-content"> の開き', () => {
  const html = chrome.renderHeader({ depth: 1, active: 'features' });
  const lines = html.split('\n');
  assert.equal(lines[0], chrome.MARK('HEADER', 'START'));
  assert.equal(lines[1], '<a href="#main-content" class="skip-link">本文へスキップ</a>');
  assert.equal(lines[lines.length - 2], '<main id="main-content">');
  assert.equal(lines[lines.length - 1], chrome.MARK('HEADER', 'END'));
  assert.ok(html.indexOf('class="skip-link"') < html.indexOf('<header>'));
});

test('renderHeader: skipLink:false で「本文へスキップ」を出さず、main:false で <main> を開かない', () => {
  const noSkip = chrome.renderHeader({ depth: 0, active: 'top', withFav: true, skipLink: false });
  assert.doesNotMatch(noSkip, /skip-link/);
  assert.match(noSkip, /<main id="main-content">/);
  const noMain = chrome.renderHeader({ depth: 1, active: null, main: false });
  assert.match(noMain, /skip-link/);
  assert.doesNotMatch(noMain, /<main/);
});

test('renderFooter: 最初に </main>、main:false なら閉じない', () => {
  const html = chrome.renderFooter({ depth: 1 });
  assert.equal(html.split('\n').slice(0, 3).join('\n'), `${chrome.MARK('FOOTER', 'START')}\n</main>\n<footer class="nb-footer">`);
  const noMain = chrome.renderFooter({ depth: 1, main: false });
  assert.doesNotMatch(noMain, /<\/main>/);
  assert.equal(noMain.split('\n')[1], '<footer class="nb-footer">');
});

// ── apply_site_chrome.js の部品 ───────────────────────────────────────────────

test('hasOwnMain: ヘッダーのブロックが出す <main> は数えず、ページ自身の <main> だけを見る', () => {
  const own = `<body>${chrome.renderHeader({ depth: 0, active: null, main: false })}<main class="page"><p>x</p></main>${chrome.renderFooter({ depth: 0, main: false })}</body>`;
  const chromeOnly = `<body>${chrome.renderHeader({ depth: 0, active: null })}<div>x</div>${chrome.renderFooter({ depth: 0 })}</body>`;
  assert.equal(apply.hasOwnMain(own), true);
  assert.equal(apply.hasOwnMain(chromeOnly), false);
  // スクリプトやコメントの中の文字は数えない
  assert.equal(apply.hasOwnMain('<body><script>var s="<main>";</script><!-- <main> --></body>'), false);
});

test('ensureMainId: id の無い自前の <main> に足す。付いていれば触らず、別の id は知らせる', () => {
  assert.equal(apply.ensureMainId('<body><main class="page">x</main></body>').html, '<body><main class="page" id="main-content">x</main></body>');
  assert.equal(apply.ensureMainId('<body><main>x</main></body>').html, '<body><main id="main-content">x</main></body>');
  const done = apply.ensureMainId('<body><main id="main-content">x</main></body>');
  assert.equal(done.changed, false);
  assert.equal(done.error, undefined);
  const other = apply.ensureMainId('<body><main id="content">x</main></body>');
  assert.equal(other.changed, false);
  assert.equal(other.error, 'main_id_conflict');
});

test('countMainContentIds: スクリプトの中の文字は数えない', () => {
  assert.equal(apply.countMainContentIds('<main id="main-content"></main><script>var a=\'<i id="main-content">\';</script>'), 1);
  assert.equal(apply.countMainContentIds('<main id="main-content"></main><section id="main-content"></section>'), 2);
  assert.equal(apply.countMainContentIds('<main></main>'), 0);
});

test('transform: 自前の <main> に id が無いページは、2つ目を足さずに id を付ける（エラー無し・冪等）', () => {
  const html = read('contact.html').replace(' id="main-content"', '');
  assert.equal(count(html, /\sid="main-content"/g), 0, '前提: id を外した');
  const t = apply.transform(html, 'contact.html');
  assert.deepEqual(t.errors, []);
  assert.equal(count(t.html, /<main[\s>]/g), 1, '<main> は1つだけ');
  assert.equal(count(t.html, /\sid="main-content"/g), 1);
  assert.match(t.html, /<main(?:\s[^>]*)? id="main-content"/);
  assert.equal(apply.transform(t.html, 'contact.html').html, t.html, '2回かけても同じ');
});

test('transform: 自前の <main> が別の id を持つページは main_id_conflict で知らせ、<main> は増やさない', () => {
  const html = read('contact.html').replace(' id="main-content"', ' id="content"');
  const t = apply.transform(html, 'contact.html');
  assert.ok(t.errors.includes('main_id_conflict'), t.errors.join(','));
  assert.equal(count(t.html, /<main[\s>]/g), 1);
});

test('transform: <main> を持たないページ（faq）は、<main> と飛び先の id を足して外す前の形に戻る', () => {
  const html = read('faq.html');
  const bare = html.replace('<main id="main-content">\n', '').replace('<!-- NB-CHROME:FOOTER:START -->\n</main>\n', '<!-- NB-CHROME:FOOTER:START -->\n');
  assert.equal(count(bare, /<main[\s>]/g), 0, '前提: <main> を外した');
  const t = apply.transform(bare, 'faq.html');
  assert.deepEqual(t.errors, []);
  assert.equal(t.html, html, '外す前の形に戻る');
});

test('transform: トップ（index.html）は、ヘッダーのブロックでは skip-link を足さない（自前の1つだけ）', () => {
  const html = read('index.html');
  const t = apply.transform(html, 'index.html');
  assert.deepEqual(t.errors, []);
  assert.equal(count(t.html, /class="skip-link"/g), 1);
  assert.equal(t.html, html, '冪等');
});

// ── 手で保守している静的ページ ───────────────────────────────────────────────

function staticPages() {
  const pages = ['index.html', 'about.html', 'faq.html', 'contact.html', 'privacy-policy.html', 'stores/index.html', 'journal/_template.html'];
  for (const f of fs.readdirSync(path.join(ROOT, 'features')).sort()) if (f.endsWith('.html') && !f.startsWith('_')) pages.push(`features/${f}`);
  return pages;
}

test('静的ページ: 本文へスキップと <main> が1つずつあり、<header> → <main> → <footer> の順で、ヘッダーとフッターの入れ子が合う', () => {
  const bad = [];
  const pages = staticPages();
  for (const rel of pages) {
    const p = problems(read(rel), { top: rel === 'index.html' });
    if (p.length) bad.push(`${rel}: ${p.join(' / ')}`);
  }
  assert.ok(pages.length > 70, `静的ページを集められた: ${pages.length}`);
  assert.deepEqual(bad, []);
});

test('自前の <main> を持つページ（contact・privacy-policy・特集2ページ）は、2つ目を足さず自前の <main> に id が付いている', () => {
  for (const rel of ['contact.html', 'privacy-policy.html', 'features/nagoya-solo-dining.html', 'features/nagoya-yakiniku.html']) {
    const html = read(rel);
    assert.match(html, /<main(?:\s[^>]*)? id="main-content"/, `${rel}: 自前の <main> に id`);
    assert.doesNotMatch(html, /<main id="main-content">\s*<!-- NB-CHROME:HEADER:END -->/, `${rel}: ヘッダーのブロックが <main> を足していない`);
  }
});

test('nb.css: 飛び先（#main-content）は固定のヘッダーの高さ分だけ余白を持ち、本文の先頭が隠れない', () => {
  const css = read('assets/css/nb.css');
  assert.match(css, /#main-content\{scroll-margin-top:var\(--header-h\);\}/);
  assert.match(css, /--header-h:56px/);
  assert.match(css, /\.skip-link:focus\{left:0;\}/);
});

test('トップ: 自前の「本文へスキップ」は body の先頭近くにあり、ヘッダーのブロックでは足さず、飛び先は <main> だけ', () => {
  const html = read('index.html');
  const header = html.slice(html.indexOf(chrome.MARK('HEADER', 'START')), html.indexOf(chrome.MARK('HEADER', 'END')));
  assert.doesNotMatch(header, /skip-link/);
  assert.match(header, /<main id="main-content">/);
  assert.ok(html.indexOf('class="skip-link"') < html.indexOf('id="scroll-top"'), '自前の skip-link が、ほかの操作（上へ戻るボタン）より前');
  assert.equal(count(html, /\sid="main-content"/g), 1, 'hero の id は <main> に移した');
});

test('apply_site_chrome.js: トップ・運営系・特集を --check にかけても、本文へスキップに関するエラーが出ない', () => {
  const { execFileSync } = require('child_process');
  for (const group of ['root', 'features']) {
    const out = execFileSync('node', [path.join(ROOT, 'scripts', 'apply_site_chrome.js'), '--check', '--only', group], { cwd: ROOT, encoding: 'utf8' });
    const parsed = JSON.parse(out);
    assert.equal(parsed.files_changed, 0, `${group}: 冪等`);
    assert.deepEqual(parsed.errors, [], `${group}: エラー無し`);
  }
});

// ── 生成器（生成済みのページは読まない） ──────────────────────────────────────

test('店舗ページ: 生成器の出力が本文へスキップと <main> を持つ（写真あり・なし・IG あり・名が長い店を含む）', () => {
  const { renderStorePage, toSlug } = require(path.join(ROOT, 'gen-store-pages.js'));
  const stores = JSON.parse(read('data/stores.json'));
  const pick = [];
  for (const id of ['J000015490', 'J004422261', 'J000107620', 'J004558109', 'J000015458']) {
    const s = stores.find((x) => x['ホットペッパーID'] === id);
    if (s) pick.push(s);
  }
  for (let i = 0; pick.length < 8 && i < stores.length; i += 613) if (stores[i]['ホットペッパーID'] && !pick.includes(stores[i])) pick.push(stores[i]);
  assert.ok(pick.length >= 5, `標本の店: ${pick.length}`);
  const bad = [];
  for (const s of pick) {
    const p = problems(renderStorePage(s, toSlug(s), [], []));
    if (p.length) bad.push(`${s['ホットペッパーID']}: ${p.join(' / ')}`);
  }
  assert.deepEqual(bad, []);
});

test('エリア×ジャンルのハブ: 生成器の出力（ルート・エリア・ジャンル・条件）が本文へスキップと <main> を持つ', () => {
  const hubs = require(path.join(ROOT, 'scripts', 'gen_area_genre_pages.js'));
  const ctx = hubs.prepare();
  const bad = [];
  for (const t of ['root', 'area', 'genre', 'condition']) {
    const page = ctx.pages.find((p) => p.type === t);
    assert.ok(page, `${t} のページが計画にある`);
    const p = problems(hubs.renderHubPage(page, ctx.pages, ctx.policy, ctx.TRUST_POLICY));
    if (p.length) bad.push(`${t}: ${p.join(' / ')}`);
  }
  assert.deepEqual(bad, []);
});

test('日次ジャーナル: 生成器の出力（renderHtml）が本文へスキップと <main> を持ち、記事の本文がその中に入る', () => {
  const { renderHtml } = require(path.join(ROOT, 'scripts', 'generate_daily_draft.js'));
  const html = renderHtml({
    title: '標本の記事', description: '説明', slug: '2026-10-12-sample', date: '2026-10-12', lead: 'リード', theme: 'today_one',
    body_html: '<p>本文の標本</p>', stores: [], sources: [], insider_points: [],
  });
  assert.deepEqual(problems(html), []);
  const main = html.slice(html.indexOf('<main id="main-content">'), html.indexOf('</main>'));
  assert.ok(main.includes('本文の標本'), '記事の本文が <main> の中にある');
  assert.ok(main.includes('<h1'), '見出し（h1）も <main> の中にある');
});
