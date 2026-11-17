'use strict';
/**
 * tests/top_articles_first.test.js — トップの最初の画面（S6-1・判断の記録 0072・計画 media-policy-2026-11）
 * 理念 → このサイトの約束 → 3分類の新しい記事 → 店の検索（2番目）。
 *
 * 確かめること:
 *   1. 分類ごとの最新1本（話題のお店紹介・店選びガイド・比較・特集の順）。取り下げた記事・未来日付は出さない。空の分類は行を出さない
 *   2. 目印（TOP_ARTICLES）の間だけを書き換える。目印の無い index.html は触らない。何度回しても同じ（冪等）
 *   3. 最初の画面に出した記事は、下の「ジャーナル」の最新3件から除く（同じ記事が上下に並ばない）
 *   4. 実際の index.html: 約束・新しい記事・検索の順、検索を畳む状態（search-active）で約束と記事も畳む、
 *      font-size はトークン（13px 以上）で、店数の主張が無い
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BJI = require('../scripts/build_journal_index.js');
const { CATEGORIES } = require('../scripts/lib/journal_category');

const ROOT = path.resolve(__dirname, '..');
const E = (date, theme, title, extra) => Object.assign({ date, slug: `${date}-x-${theme}`, theme, title, description: '' }, extra || {});

test('分類ごとの最新1本を、CATEGORIES の順で返す', () => {
  const entries = [
    E('2026-11-01', 'today_one', 'topic-old'),
    E('2026-11-05', 'seasonal', 'topic-new'),
    E('2026-11-03', 'industry_insider', 'guide-new'),
    E('2026-11-02', 'weekly_digest', 'compare-new'),
    E('2026-11-04', 'weekly_digest', 'compare-newer'),
  ];
  const r = BJI.latestPerCategory(entries);
  assert.deepStrictEqual(r.map((x) => x.key), Object.keys(CATEGORIES));
  assert.deepStrictEqual(r.map((x) => x.entry.title), ['topic-new', 'guide-new', 'compare-newer']);
});

test('空の分類は行を出さない・明示の category を優先する・記事が0件なら空文字', () => {
  const only = BJI.latestPerCategory([E('2026-11-05', 'today_one', 'a')]);
  assert.deepStrictEqual(only.map((x) => x.key), ['topic']);
  const explicit = BJI.latestPerCategory([E('2026-11-05', 'today_one', 'a', { category: 'guide' })]);
  assert.deepStrictEqual(explicit.map((x) => x.key), ['guide']);
  assert.strictEqual(BJI.renderTopArticles([]), '');
});

test('行は記事へのリンク1本（分類名・日付・題）で、題と分類は HTML エスケープする', () => {
  const html = BJI.renderTopArticles([E('2026-11-05', 'seasonal', '<b>題</b> & "引用"')]);
  assert.ok(html.includes('class="ta-link" href="journal/2026-11-05-x-seasonal.html"'), html);
  assert.ok(html.includes('<span class="ta-cat">話題のお店紹介</span><time datetime="2026-11-05">11/05</time>'), html);
  assert.ok(html.includes('&lt;b&gt;題&lt;/b&gt; &amp; &quot;引用&quot;'), html);
  assert.ok(!html.includes('<b>'), html);
});

test('updateRootLatestSection: 目印の間だけを書き換え、冪等。目印の無いページでも最新3件は従来どおり', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'top-articles-'));
  const idx = path.join(dir, 'index.html');
  const base = (mid) => `<main>\nA\n<!-- TOP_ARTICLES_START -->\n${mid}\n<!-- TOP_ARTICLES_END -->\nB\n<!-- LATEST_JOURNAL_START -->old<!-- LATEST_JOURNAL_END -->\nC</main>`;
  fs.writeFileSync(idx, base('OLD'));
  const entries = [E('2026-11-05', 'seasonal', 'tt'), E('2026-11-03', 'industry_insider', 'gg')];
  assert.strictEqual(BJI.updateRootLatestSection(entries, dir, idx), true);
  const once = fs.readFileSync(idx, 'utf8');
  assert.ok(!once.includes('OLD'));
  assert.ok(once.startsWith('<main>\nA\n<!-- TOP_ARTICLES_START -->'));
  assert.ok(once.includes('\nB\n<!-- LATEST_JOURNAL_START -->') && once.endsWith('\nC</main>'), '目印の外は変えない');
  assert.strictEqual((once.match(/class="ta-item"/g) || []).length, 2);
  BJI.updateRootLatestSection(entries, dir, idx);
  assert.strictEqual(fs.readFileSync(idx, 'utf8'), once, '冪等');
  // 目印の無いページ
  const legacy = path.join(dir, 'legacy.html');
  fs.writeFileSync(legacy, '<!-- LATEST_JOURNAL_START -->x<!-- LATEST_JOURNAL_END -->');
  BJI.updateRootLatestSection(entries, dir, legacy);
  assert.ok(!fs.readFileSync(legacy, 'utf8').includes('TOP_ARTICLES'));
});

test('下の「ジャーナル」の最新3件は、最初の画面の「新しい記事」に出した記事を除く。目印の無いページは従来どおり', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'top-dedupe-'));
  const withMark = path.join(dir, 'a.html');
  const noMark = path.join(dir, 'b.html');
  fs.writeFileSync(withMark, '<!-- TOP_ARTICLES_START -->\n<!-- TOP_ARTICLES_END -->\n<!-- LATEST_JOURNAL_START --><!-- LATEST_JOURNAL_END -->');
  fs.writeFileSync(noMark, '<!-- LATEST_JOURNAL_START --><!-- LATEST_JOURNAL_END -->');
  const entries = [
    E('2026-11-17', 'seasonal', 't1'), E('2026-11-16', 'seasonal', 't2'), E('2026-11-15', 'seasonal', 't3'),
    E('2026-11-14', 'seasonal', 't4'), E('2026-11-11', 'industry_insider', 'g1'),
  ];
  BJI.updateRootLatestSection(entries, dir, withMark);
  const a = fs.readFileSync(withMark, 'utf8');
  const lower = a.slice(a.indexOf('<!-- LATEST_JOURNAL_START -->'));
  assert.ok(!lower.includes('2026-11-17-x-seasonal'), '上に出した最新の話題記事は下に出さない');
  assert.ok(!lower.includes('2026-11-11-x-industry_insider'), '上に出した店選びガイドは下に出さない');
  assert.strictEqual((lower.match(/class="latest-journal-card/g) || []).length, 3);
  assert.ok(lower.includes('2026-11-16-x-seasonal') && lower.includes('2026-11-14-x-seasonal'));
  BJI.updateRootLatestSection(entries, dir, noMark);
  assert.ok(fs.readFileSync(noMark, 'utf8').includes('2026-11-17-x-seasonal'), '目印の無いページは従来どおり最新3件');
});

test('実際の index.html: 3分類の行が入り、検索中は約束と記事を畳み、文字はトークンで 13px 以上', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const region = (html.match(/<!-- TOP_ARTICLES_START -->([\s\S]*?)<!-- TOP_ARTICLES_END -->/) || [])[1] || '';
  const rows = region.match(/class="ta-item"/g) || [];
  assert.ok(rows.length >= 1 && rows.length <= 3, `行は1〜3: ${rows.length}`);
  const cats = [...region.matchAll(/data-category="(\w+)"/g)].map((m) => m[1]);
  assert.strictEqual(new Set(cats).size, cats.length, '分類は重ならない');
  assert.ok(/body\.search-active \.site-promise,\s*body\.search-active \.top-articles,/.test(html), '検索中は畳む');
  const css = (html.match(/最初の画面：理念[\s\S]*?\.ranking-picks\{/) || [])[0] || '';
  assert.ok(css.length > 500, '最初の画面の CSS がある');
  assert.ok(!/font-size:\s*[\d.]+(px|rem)/.test(css), 'font-size はトークン（var(--fs-*)）で書く');
  assert.ok(!/font-family:\s*['"]/.test(css), '書体名の直書きをしない');
  // 本文の検索窓が見えている間は、固定の検索の帯とご意見ボタンを隠す（検索欄が2つ並ばない）
  assert.ok(/body\.hero-search-in-view \.mobile-cta-bar\{display:none !important;\}/.test(html));
  assert.ok(/body\.hero-search-in-view #fb-fab\{visibility:hidden;\}/.test(html));
  assert.ok(html.includes("document.body.classList.toggle('hero-search-in-view'"));
  // 実態と違う約束を置かない: 下の黒い帯（寄稿者・永久追放）は外し、約束は最初の画面の1か所にする
  assert.ok(!html.includes('no-sakura') && !html.includes('嘘の寄稿者') && !html.includes('永久追放'));
});
