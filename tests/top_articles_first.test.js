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

test('スマホ: 固定の検索の帯がフッター最後の行を隠さない／ご意見ボタンは帯の左の枠に入る', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const mobile = (html.match(/MOBILE CTA BAR[\s\S]*?@media/) || [html])[0];
  assert.ok(/body\{padding-bottom:calc\(4\.5rem \+ env\(safe-area-inset-bottom,0px\)\);\}/.test(html), '本文の下に帯の高さ分の余白');
  assert.ok(/\.mobile-cta-bar\{padding-left:calc\(1rem \+ var\(--tap-min\) \+ \.5rem\);\}/.test(html), '帯の左にご意見ボタンの枠');
  assert.ok(/#fb-fab\{left:1rem;bottom:10px;\}/.test(html), 'ご意見ボタンは帯の中');
  assert.ok(/\.mobile-cta-bar \.cta-filter\{white-space:nowrap;flex-shrink:0;\}/.test(html), '絞り込みの字を折り返さない');
  assert.ok(mobile.length > 0);
});

// ── 写真つき・今日の記事を必ず出す（Ondine #2097）──────────────────────────────────
const FIGURE = (source, src, store, credit) => `<figure class="art-hero-img" data-hero-source="${source}" data-hero-store="${store}">
  <img src="${src}" alt="x" loading="lazy" decoding="async">
  <figcaption class="art-img-credit">${credit}</figcaption>
</figure>`;
const HP_CREDIT = '写真: <a href="https://www.hotpepper.jp" target="_blank" rel="noopener">店舗公式写真</a> / <a href="https://www.hotpepper.jp" target="_blank" rel="noopener">HotPepper</a>';
const PR_CREDIT = '写真: 提供 株式会社X（<a href="https://prtimes.jp/main/html/rd/p/1.html" target="_blank" rel="noopener">プレスリリース</a>より）';

function withJournal(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'top-photo-'));
  for (const [slug, figure] of Object.entries(files)) fs.writeFileSync(path.join(dir, `${slug}.html`), `<html><body><article>${figure}</article></body></html>`);
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('並びは日付の新しい順（その日の記事が必ず先頭）。分類の順ではない', () => {
  const entries = [
    E('2026-11-05', 'seasonal', 'topic-old'),
    E('2026-11-09', 'weekly_digest', 'compare-new'),
    E('2026-11-17', 'industry_insider', 'guide-newest'),
  ];
  const html = BJI.renderTopArticles(entries);
  const titles = [...html.matchAll(/<span class="ta-title">([^<]*)</g)].map((m) => m[1]);
  assert.deepStrictEqual(titles, ['guide-newest', 'compare-new', 'topic-old']);
});

const NO_EXCLUDE = { photos: new Set(), slugs: new Set() };

test('写真つきの行: ホットペッパーの顔の写真だけを小さく添え、出所は文字（入れ子のリンクを作らない）。大きな顔にした記事の行は文字だけ', () => {
  const entries = [E('2026-11-17', 'seasonal', 'new'), E('2026-11-11', 'industry_insider', 'older')];
  withJournal({
    '2026-11-17-x-seasonal': FIGURE('hotpepper', 'https://imgfp.hotp.jp/IMGH/33/69/P037623369/P037623369.jpg', '蜀漢 金山駅店', HP_CREDIT),
    '2026-11-11-x-industry_insider': FIGURE('hotpepper', 'https://imgfp.hotp.jp/IMGH/30/43/P037723043/P037723043.jpg', '鉄板屋大吉', HP_CREDIT),
  }, (dir) => {
    // 17日の写真を目で外したなら、17日の行は文字・11日の行に小さな写真
    const ex = { photos: new Set(['P037623369']), slugs: new Set() };
    const html = BJI.renderTopArticles(entries, dir, ex);
    assert.strictEqual((html.match(/class="ta-item ta-has-photo"/g) || []).length, 0, '11日の記事が大きな顔になったので、行は文字だけ');
    // 除外が無ければ、新しい17日が大きな顔・11日の行に小さな写真
    const html2 = BJI.renderTopArticles(entries, dir, NO_EXCLUDE);
    assert.strictEqual((html2.match(/class="ta-item ta-has-photo"/g) || []).length, 1);
    assert.ok(html2.includes('src="https://imgfp.hotp.jp/IMGH/30/43/P037723043/P037723043.jpg" alt="鉄板屋大吉" width="160" height="160"'), html2);
    assert.ok(!/fetchpriority/.test(html2), '先頭の画像は大きな顔の1枚（行の写真は急がない）');
    assert.ok(!/loading="lazy"/.test(html2));
    assert.ok(html2.includes('<span class="ta-credit">写真: 店舗公式写真 / HotPepper</span>'), html2);
    let depth = 0; let max = 0;
    for (const m of html2.matchAll(/<a\b[^>]*>|<\/a>/g)) { depth += m[0] === '</a>' ? -1 : 1; max = Math.max(max, depth); }
    assert.strictEqual(max, 1, '行のリンクの中にリンクを入れない');
    assert.strictEqual((html2.match(/<a\b/g) || []).length, 2);
  });
});

test('大きな顔の選び方: 日付の新しい順で、写真が確かで除外リストに無い最初の記事（記事が更新されれば自動で入れ替わる）', () => {
  const entries = [E('2026-11-17', 'seasonal', 'a'), E('2026-11-11', 'industry_insider', 'b'), E('2026-11-09', 'weekly_digest', 'c')];
  withJournal({
    '2026-11-17-x-seasonal': FIGURE('hotpepper', 'https://imgfp.hotp.jp/IMGH/33/69/P037623369/P037623369.jpg', '蜀漢', HP_CREDIT),
    '2026-11-11-x-industry_insider': FIGURE('hotpepper', 'https://imgfp.hotp.jp/IMGH/30/43/P037723043/P037723043.jpg', '鉄板屋大吉', HP_CREDIT),
    '2026-11-09-x-weekly_digest': FIGURE('press', 'https://prcdn.freetls.fastly.net/release_image/1/2/3-2523x2700.jpg', 'X店', PR_CREDIT),
  }, (dir) => {
    assert.strictEqual(BJI.pickTopHero(entries, dir, NO_EXCLUDE).entry.title, 'a');
    // 写真の番号で外す
    assert.strictEqual(BJI.pickTopHero(entries, dir, { photos: new Set(['P037623369']), slugs: new Set() }).entry.title, 'b');
    // 記事の slug で外す
    assert.strictEqual(BJI.pickTopHero(entries, dir, { photos: new Set(), slugs: new Set([entries[0].slug]) }).entry.title, 'b');
    // 全部外れ（プレスリリース写真は載せない）なら置かない
    assert.strictEqual(BJI.pickTopHero(entries, dir, { photos: new Set(['P037623369', 'P037723043']), slugs: new Set() }), null);
    assert.strictEqual(BJI.renderTopHero(null), '');
    // 新しい記事が入れば、その記事に替わる
    const more = [E('2026-11-18', 'seasonal', 'newer')].concat(entries);
    assert.strictEqual(BJI.pickTopHero(more, dir, NO_EXCLUDE).entry.title, 'b', '同じ分類の新記事が写真を持たなければ、次の分類の最新に回る（古い a は分類の最新ではない）');
  });
});

test('大きな顔の描画: 記事へのリンク・出所と題を写真の下に・480px の URL・幅と高さ・fetchpriority・遅延しない', () => {
  const entries = [E('2026-11-11', 'industry_insider', 'タイトル<b>')];
  withJournal({
    '2026-11-11-x-industry_insider': FIGURE('hotpepper', 'https://imgfp.hotp.jp/IMGH/30/43/P037723043/P037723043.jpg', '鉄板屋大吉', HP_CREDIT),
  }, (dir) => {
    const html = BJI.renderTopHero(BJI.pickTopHero(entries, dir, NO_EXCLUDE));
    assert.ok(html.startsWith('<figure class="top-hero"><a class="top-hero-link" href="journal/2026-11-11-x-industry_insider.html">'), html);
    assert.ok(html.includes('src="https://imgfp.hotp.jp/IMGH/30/43/P037723043/P037723043_480.jpg"'), '小さな画像の URL を大きく伸ばさず _480 にそろえる');
    assert.ok(/width="480" height="300"/.test(html) && /fetchpriority="high"/.test(html) && !/loading="lazy"/.test(html));
    assert.ok(html.includes('<span class="top-hero-credit">写真: 鉄板屋大吉（ホットペッパーグルメ）</span>'));
    assert.ok(html.includes('<span class="top-hero-title">タイトル&lt;b&gt;</span>'), '題は文字として出す');
    assert.strictEqual((html.match(/<a\b/g) || []).length, 1, 'リンクは1つ（入れ子にしない）');
    assert.strictEqual(BJI.bigPhotoSrc('https://imgfp.hotp.jp/IMGH/1/2/P000000001/P000000001_168.jpg'), 'https://imgfp.hotp.jp/IMGH/1/2/P000000001/P000000001_480.jpg');
  });
});

test('大きな顔: 特集の顔に使っている写真は、トップの顔にしない（同じ写真を別の記事の顔にしない）', () => {
  const ex = BJI.loadTopHeroExcluded();
  const faces = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_faces.json'), 'utf8')).faces;
  for (const [slug, f] of Object.entries(faces)) {
    assert.ok(ex.photos.has((f.photo.match(/(P\d{6,})/) || [])[1]), `${slug} の顔の写真が除外に入っている`);
  }
  // 目で外した写真（data/top_hero_excluded.json）も入っている
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'top_hero_excluded.json'), 'utf8'));
  assert.ok(j.excluded.length >= 1 && j.excluded.every((x) => x.photo && x.reason));
  for (const x of j.excluded) assert.ok(ex.photos.has(x.photo));
});

test('実際の index.html: 見出しの直後に大きな顔の写真が1枚あり、最新の記事のうち除外に無い記事に張られ、ロゴが主役の写真ではない', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const block = (html.match(/<!-- TOP_HERO_START -->([\s\S]*?)<!-- TOP_HERO_END -->/) || [])[1] || '';
  assert.ok(block.length > 100, '大きな顔の区画がある');
  assert.ok(html.indexOf('<h1>飲食店選びの失敗を') < html.indexOf('<!-- TOP_HERO_START -->'), '見出しより後');
  assert.ok(html.indexOf('<!-- TOP_HERO_END -->') < html.indexOf('id="site-promise-title"'), '約束の区画より前');
  const img = (block.match(/<img class="top-hero-img"[^>]*>/) || [])[0] || '';
  assert.ok(/src="https:\/\/imgfp\.hotp\.jp\/[^"]+_480\.jpg"/.test(img), img);
  assert.ok(/width="\d+" height="\d+"/.test(img) && /fetchpriority="high"/.test(img) && !/loading="lazy"/.test(img) && /alt="[^"]+"/.test(img));
  assert.ok(/<span class="top-hero-credit">写真: [^<]+（ホットペッパーグルメ）<\/span>/.test(block));
  assert.ok(/<span class="top-hero-title">[^<]+<\/span>/.test(block));
  const ex = BJI.loadTopHeroExcluded();
  const n = (img.match(/(P\d{6,})/) || [])[1];
  assert.ok(n && !ex.photos.has(n), '除外した写真・特集の顔の写真は使わない');
  const slug = (block.match(/href="journal\/([^"]+)\.html"/) || [])[1];
  assert.ok(slug && !ex.slugs.has(slug));
  // CSS: 13px のトークン・全幅（16:10）の枠
  assert.ok(/\.top-hero-img\{[^}]*aspect-ratio:16\/10/.test(html));
  assert.ok(/\.top-hero-credit\{font-size:var\(--fs-xs\)/.test(html) && /\.top-hero-title\{font-size:var\(--fs-xs\)/.test(html));
  assert.strictEqual((html.match(/class="top-hero-img"/g) || []).length, 1, '大きな顔は1枚');
});

test('プレスリリースの写真・写真の無い記事・読めない記事は、文字だけの行（最初の画面を重くしない・取り繕わない）', () => {
  const entries = [E('2026-11-17', 'seasonal', 'a'), E('2026-11-11', 'industry_insider', 'b'), E('2026-11-09', 'weekly_digest', 'c')];
  withJournal({
    '2026-11-17-x-seasonal': FIGURE('press', 'https://prcdn.freetls.fastly.net/release_image/1/2/3-2523x2700.jpg', 'X店', PR_CREDIT),
    '2026-11-11-x-industry_insider': '<p>写真なし</p>',
  }, (dir) => {
    const html = BJI.renderTopArticles(entries, dir);
    assert.ok(!html.includes('ta-has-photo') && !html.includes('<img'), html);
    assert.strictEqual((html.match(/class="ta-item"/g) || []).length, 3);
  });
});

test('実際の index.html: 公開中でいちばん新しい記事が、最初の画面の先頭の行に出ている（その日のうちにトップへ）', () => {
  const published = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'journal_published.json'), 'utf8'));
  const { isPublic } = require('../scripts/lib/journal_category');
  const jst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const pub = (published.entries || []).filter((e) => e.date <= jst && isPublic(e)).sort((a, b) => b.date.localeCompare(a.date));
  assert.ok(pub.length > 0);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const region = (html.match(/<!-- TOP_ARTICLES_START -->([\s\S]*?)<!-- TOP_ARTICLES_END -->/) || [])[1] || '';
  const first = (region.match(/class="ta-link" href="journal\/([^"]+)\.html"/) || [])[1];
  const newestDate = pub[0].date;
  const sameDay = pub.filter((e) => e.date === newestDate).map((e) => e.slug);
  assert.ok(sameDay.includes(first), `先頭の行は最新日（${newestDate}）の記事のはず: ${first}`);
});

test('実際の index.html: 最初の画面の写真は小さなホットペッパー写真で、幅・高さ・出所の文字があり、遅延させず、先頭だけ fetchpriority', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const region = (html.match(/<!-- TOP_ARTICLES_START -->([\s\S]*?)<!-- TOP_ARTICLES_END -->/) || [])[1] || '';
  const imgs = [...region.matchAll(/<img class="ta-img"[^>]*>/g)].map((m) => m[0]);
  for (const tag of imgs) {
    assert.ok(/src="https:\/\/imgfp\.hotp\.jp\//.test(tag), tag);
    assert.ok(/width="\d+" height="\d+"/.test(tag), '幅と高さ（CLS を出さない）');
    assert.ok(/alt="[^"]+"/.test(tag), '店名の alt');
    assert.ok(!/loading="lazy"/.test(tag), '最初の画面');
  }
  assert.strictEqual((region.match(/class="ta-credit">写真: [^<]+</g) || []).length, imgs.length, '写真ごとに出所の文字');
  assert.ok((region.match(/fetchpriority="high"/g) || []).length <= 1);
  const css = (html.match(/最初の画面：理念[\s\S]*?\.ranking-picks\{/) || [])[0] || '';
  assert.ok(/\.ta-photo\{[^}]*width:80px;height:80px/.test(css), '写真の枠は幅・高さを決める');
  assert.ok(/\.ta-credit\{font-size:var\(--fs-xs\)/.test(css), '出所は 13px のトークン');
});
