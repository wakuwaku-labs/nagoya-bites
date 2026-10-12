'use strict';
/**
 * tests/english_labels.test.js — I-07c（UI・UX改修 段階1a）
 *
 * 制約3「テキストはすべて日本語」。見出しの上の小さな英語・カードの区分・写真の出所の書式・節の見出しを
 * 日本語にした決まりを確かめる。I-07（トップ）と I-07b（全ページ共通のフッター・パンくず）の続き。
 *
 *   1. エリア×ジャンルのハブの見出しの上: 「Restaurant Database — …」→「店舗データベース — …」
 *   2. 特集の冒頭の注目店の見出し: 「EDITORS' PICK」→「この特集の注目店」
 *   3. ジャーナルの写真の出所: 「Photo:」→「写真:」（図は「図:」）
 *   4. 特集・FAQ・お問い合わせ・プライバシーの見出しの上の小さな英語、特集一覧のカードの区分（「Area Guide · 名駅」など）、
 *      食べ歩きガイドの節の見出し（「02 — Specialty Coffee」など）
 *   5. 「English — 日本語」「ROMAJI · 日本語」の形の区分（「Top Picks — …」「Selection — 実在確認済み」「Feature — …」など）の英語の前置き
 *
 * 店舗ページ・ハブは CI が作り直すので、生成器を直接動かして確かめる（生成済みのページは読まない。
 * build.yml は npm test を再生成の前に回す）。手で保守している静的ページ（特集・ジャーナル・運営系）は直接読む。
 *
 * 範囲の外（運営者の経歴・選び方の文案を決める P-237 #2 と一緒に直す。決まるまで英語のまま）:
 *   特集の「Editor's Note — この特集の選定基準」（選び方の文面そのもの）。
 *   about.html・特集の編集規約／レビュワー募集／口コミ信頼度の3ページ（editorial-policy・become-reviewer・no-fake-reviews・
 *   review-trust・integrity-method）、編集規約へのカード（nagoya-gourmet-guide の EDITORIAL／DAILY JOURNAL）、
 *   stores/index.html（転送だけのページ）。サービス名（Instagram・Google Maps・HotPepper）は英語のまま。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const JA = /[぀-ヿ一-鿿]/;

// P-237 #2 と一緒に直すまで英語のままにするページ
const EXEMPT_PAGES = new Set([
  'about.html',
  'features/editorial-policy.html',
  'features/become-reviewer.html',
  'features/no-fake-reviews.html',
  'features/review-trust.html',
  'features/integrity-method.html',
  'features/nagoya-gourmet-guide.html', // カードの EDITORIAL／DAILY JOURNAL（編集規約への案内）だけ。見出しの上の英語は直した
]);
// サービス名はそのまま
const SERVICE_NAMES = new Set(['Instagram', 'Google Maps', 'HotPepper', 'Hot Pepper']);

// 見出しの上の小さな英語・区分・節の見出しに使うクラス
const LABEL_CLASSES = [
  'art-eyebrow', 'eyebrow', 'page-eyebrow', 'cta-eyebrow', 'section-label', 'sec-label', 'card-category', 'card-label',
  'related-title', 'related-card-label', 'related-link-label', 'topcta-head', 'tips-title', 'tip-title', 'axes-title',
  'column-label', 'pillar-label', 'tier-label',
];

function staticPages() {
  const pages = ['faq.html', 'contact.html', 'privacy-policy.html', 'about.html'];
  for (const dir of ['features', 'journal']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
      if (f.endsWith('.html') && !f.startsWith('_')) pages.push(`${dir}/${f}`);
    }
  }
  return pages;
}

function labelsOf(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const out = [];
  const re = /<(\w+)[^>]*\bclass="([^"]*)"[^>]*>([^<]{1,120})<\/\1>/g;
  let m;
  while ((m = re.exec(body))) {
    const classes = m[2].split(/\s+/);
    const hit = classes.find((c) => LABEL_CLASSES.includes(c));
    if (!hit) continue;
    const text = m[3].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
    out.push({ cls: hit, text });
  }
  return out;
}

test('ハブ: 見出しの上は「店舗データベース — …」で、英語の「Restaurant Database」が残っていない（4種類のページ）', () => {
  const hubs = require('../scripts/gen_area_genre_pages.js');
  const ctx = hubs.prepare();
  const types = ['root', 'area', 'genre', 'condition'];
  for (const t of types) {
    const page = ctx.pages.find((p) => p.type === t);
    assert.ok(page, `${t} のページが計画にある`);
    const html = hubs.renderHubPage(page, ctx.pages, ctx.policy, ctx.TRUST_POLICY);
    assert.match(html, /<p class="art-eyebrow">店舗データベース — [^<]+<\/p>/, `${t}: 見出しの上が日本語`);
    assert.ok(!html.includes('Restaurant Database'), `${t}: Restaurant Database が残っていない`);
  }
});

test('特集の冒頭の注目店: 見出しは「この特集の注目店」（生成器）', () => {
  const { buildCta } = require('../scripts/add_feature_top_cta.js');
  const stores = [
    { jcode: 'J000000001', name: 'テスト店A' },
    { jcode: 'J000000002', name: 'テスト店B' },
    { jcode: 'J000000003', name: 'テスト店C' },
  ];
  const html = buildCta(stores, 'banquet');
  assert.ok(html.includes('<div class="topcta-head">この特集の注目店</div>'));
  assert.ok(!html.includes("EDITORS' PICK"));
});

test('特集の冒頭の注目店: 公開中の特集に英語の見出しが残っていない', () => {
  const bad = [];
  let withBlock = 0;
  for (const rel of staticPages().filter((p) => p.startsWith('features/'))) {
    const html = read(rel);
    if (html.includes('class="topcta-head"')) withBlock++;
    if (html.includes("EDITORS' PICK")) bad.push(rel);
  }
  assert.ok(withBlock > 40, `注目店の区画を持つ特集を集められた: ${withBlock}`);
  assert.deepStrictEqual(bad, []);
});

test('ジャーナル: 写真の出所は「写真:」で始まる（生成器2か所と公開済みの全記事）', () => {
  const JP = require('../scripts/lib/journal_photos.js');
  const fig = JP.figureHtml({
    url: 'https://imgfp.hotp.jp/IMGH/94/09/P044229409/P044229409.jpg', source: 'hotpepper', storeName: 'テスト店',
    creditName: '店舗公式写真', creditUrl: 'https://www.hotpepper.jp',
  });
  assert.ok(/<figcaption class="art-img-credit">写真: /.test(fig), fig);
  assert.ok(!/Photo:/.test(fig));

  const gen = read('scripts/generate_daily_draft.js');
  assert.ok(gen.includes('<figcaption class="art-img-credit">写真: ${creditHtml}</figcaption>'), 'ヒーローの出所の書式');
  assert.ok(!/art-img-credit">Photo:/.test(gen));

  const bad = [];
  let credits = 0;
  for (const rel of staticPages().filter((p) => p.startsWith('journal/'))) {
    const html = read(rel);
    for (const m of html.matchAll(/<figcaption class="art-img-credit">([\s\S]*?)<\/figcaption>/g)) {
      credits++;
      if (/Photo:|Figure:/.test(m[1])) bad.push(rel);
    }
  }
  assert.ok(credits > 100, `出所の欄を集められた: ${credits}`);
  assert.deepStrictEqual([...new Set(bad)], []);
});

test('静的ページ: 見出しの上の小さな英語・区分・節の見出しが日本語（範囲の外のページと、サービス名を除く）', () => {
  const bad = [];
  let scanned = 0;
  for (const rel of staticPages()) {
    scanned++;
    const exempt = EXEMPT_PAGES.has(rel);
    for (const { cls, text } of labelsOf(read(rel))) {
      if (SERVICE_NAMES.has(text)) continue;
      if (exempt) continue;
      if (!JA.test(text) && /[A-Za-z]{3,}/.test(text)) bad.push(`${rel}: ${cls} 「${text}」`);
      // 「Area Guide · 名駅」のような、英語の区分を前に付けた形
      if (cls === 'card-category' && /^[A-Za-z][A-Za-z&' ]* · /.test(text)) bad.push(`${rel}: ${cls} 「${text}」`);
    }
  }
  assert.ok(scanned > 200, `静的ページを集められた: ${scanned}`);
  assert.deepStrictEqual(bad, []);
});

// 選び方の文面そのもの。運営者の経歴・選び方の文案（P-237 #2）と一緒に直すまで、英語の前置きのまま
const KEEP_PREFIXES = new Set(["Editor's Note"]);

test('静的ページ: 「English — 日本語」「ROMAJI · 日本語」の形の区分が残っていない（Editor\'s Note を除く）', () => {
  const bad = [];
  let scanned = 0;
  for (const rel of staticPages()) {
    if (EXEMPT_PAGES.has(rel)) continue;
    for (const { cls, text } of labelsOf(read(rel))) {
      scanned++;
      const m = /^([A-Za-z][A-Za-z'’&.\- ]*[A-Za-z]) (?:—|·) /.exec(text);
      if (m && !KEEP_PREFIXES.has(m[1])) bad.push(`${rel}: ${cls} 「${text}」`);
    }
  }
  assert.ok(scanned > 500, `見出しの上の区分を集められた: ${scanned}`);
  assert.deepStrictEqual(bad, []);
});

test('英語の前置きを外した区分: 生成器の出力と、実物の1本ずつ', () => {
  const rf = read('scripts/recreate_fabricated_features.js');
  assert.ok(rf.includes('<p class="section-label">掲載店 — 実在確認済み</p>'));
  assert.ok(!rf.includes('Selection — '));
  const gi = read('scripts/gen_industry_features.js');
  assert.ok(gi.includes('<p class="art-eyebrow">${feature.eyebrow}</p>'));
  assert.ok(!/Feature — \$\{feature\.eyebrow\}/.test(gi));
  assert.ok(read('features/nagoya-autumn-2026.html').includes('<h2 class="section-label">掲載店 — 実在確認済み</h2>'));
  assert.ok(read('features/banquet.html').includes('<h2 class="section-label">宴会・忘年会におすすめの'));
  assert.ok(read('features/birthday-surprise.html').includes('<p class="art-eyebrow">シーン別特集</p>'));
  assert.ok(read('features/nagoya-tebasaki.html').includes('<div class="art-eyebrow">名古屋手羽先完全ガイド</div>'));
  // 選び方の文面は P-237 #2 と一緒に直すので、まだ英語の前置きのまま（外れたらこのテストを直す）
  assert.ok(read('features/birthday-surprise.html').includes("Editor's Note — この特集の選定基準"));
});

test('静的ページ: 見出しの上の英語は、特集記事・エリアガイド・ご利用ガイド・ご連絡はこちら・個人情報の取り扱いに置き換わっている', () => {
  assert.ok(read('features/index.html').includes('<p class="eyebrow">特集記事</p>'));
  assert.ok(read('faq.html').includes('<p class="eyebrow">ご利用ガイド</p>'));
  assert.ok(read('contact.html').includes('<div class="eyebrow">ご連絡はこちら</div>'));
  assert.ok(read('privacy-policy.html').includes('<div class="page-eyebrow">個人情報の取り扱い</div>'));
  assert.ok(read('features/banquet.html').includes('<p class="art-eyebrow">特集記事</p>'));
  assert.ok(read('features/meieki.html').includes('<p class="art-eyebrow">エリアガイド</p>'));
  assert.ok(read('features/nagoya-gourmet-guide.html').includes('<div class="art-eyebrow">完全ガイド</div>'));
});

test('特集一覧のカード: 区分は日本語。エリアガイドとシーン別は区分を日本語で残し、ほかは「英語 · 」を外した', () => {
  const html = read('features/index.html');
  const labels = [...html.matchAll(/<div class="card-category">([^<]*)<\/div>/g)].map((m) => m[1]);
  assert.ok(labels.length > 50, `カードの区分を集められた: ${labels.length}`);
  assert.ok(labels.includes('エリアガイド · 名駅'));
  assert.ok(labels.includes('エリアガイド · 栄・錦'));
  assert.ok(labels.includes('シーン別 · 顔合わせ・結納'));
  assert.ok(labels.includes('一人飲み · 名古屋駅特化'));
  assert.ok(labels.includes('名古屋ラーメンガイド【2026年版】'));
  for (const l of labels) assert.ok(!/^[A-Za-z]/.test(l), `英語で始まる区分が残っている: ${l}`);
});

test('季節特集のカードの区分を作る生成器（build_featured.js）に英語の「Seasonal」が残っていない', () => {
  const src = read('scripts/build_featured.js');
  assert.ok(!/Seasonal · /.test(src));
  assert.ok(/return '季節特集';/.test(src));
});

test('食べ歩きガイドの節の見出し: 「NN — 日本語」の形になっている（範囲の外のページを除く）', () => {
  const cases = {
    'features/nagoya-cafe.html': ['02 — スペシャルティコーヒー', '06 — よくある質問'],
    'features/nagoya-gyoza.html': ['03 — 一口餃子', '11 — 関連特集'],
    'features/nagoya-ramen.html': ['04 — 台湾まぜそば'],
    'features/nagoya-sweets.html': ['04 — かき氷・甘味処'],
    'features/nagoya-kakuozan.html': ['00 — はじめに'],
    'features/fathers-day-2026.html': ['03 — 寿司・割烹'],
  };
  for (const [rel, expected] of Object.entries(cases)) {
    const texts = labelsOf(read(rel)).map((l) => l.text);
    for (const e of expected) assert.ok(texts.includes(e), `${rel}: 「${e}」が無い`);
  }
});
