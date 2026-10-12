'use strict';
// I-15（U-31・U-46）: 店舗ページの「この店が載っている特集・記事」を実際の掲載だけにする。
//
// - 載っている記事 = ジャーナルの本文にその店の店舗ページへのリンクがあるもの（scripts/lib/store_listings.js）。
//   リンク先が誘導ページ（古い ID）なら今の店舗ページに結ぶ。
// - 推定（タグ・ジャンル・エリア）の特集は「あわせて読みたい特集」に分け、載っているとは言わない。
//   載っている特集と同じ特集は繰り返さない。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const L = require(path.join(ROOT, 'scripts', 'lib', 'store_listings.js'));
const SO = require(path.join(ROOT, 'scripts', 'lib', 'store_orphans.js'));
const { renderStorePage, buildRelatedFeatures, toSlug } = require(path.join(ROOT, 'gen-store-pages.js'));

const article = (inner, { head = '', header = '', footer = '' } = {}) =>
  `<!doctype html><html><head>${head || '<title>x</title>'}</head><body><header>${header}</header><article class="nb-article">${inner}</article><footer>${footer}</footer></body></html>`;

// ── extractStoreSlugs ──

test('extractStoreSlugs: 本文の店舗ページへのリンクだけを、出た順・重複なしで返す', () => {
  const html = article([
    '<p><a href="../stores/J001.html">A</a> と <a href="https://nagoya-bites.com/stores/abc-def.html">B</a></p>',
    '<a href="../stores/J001.html">A again</a>',
    '<a href="../stores/J002.html#map">C</a><a href="../stores/J003.html?x=1">D</a>',
  ].join(''), {
    header: '<a href="../stores/HEADER.html">h</a>',
    footer: '<a href="../stores/FOOTER.html">f</a>',
  });
  assert.deepEqual(L.extractStoreSlugs(html), ['J001', 'abc-def', 'J002', 'J003']);
});

test('extractStoreSlugs: 店舗一覧・エリアのハブ・外部の URL・<article> の無いページは数えない', () => {
  const html = article([
    '<a href="../stores/index.html">list</a>',
    '<a href="../stores/area/nishiki-fushimi/index.html">hub</a>',
    '<a href="https://tabelog.com/stores/J009.html">ext</a>',
    '<a href="../features/banquet.html">feature</a>',
  ].join(''));
  assert.deepEqual(L.extractStoreSlugs(html), []);
  assert.deepEqual(L.extractStoreSlugs('<html><body><a href="../stores/J001.html">x</a></body></html>'), []);
});

// ── readArticleTitle ──

test('readArticleTitle: 構造化データの headline を使い、実体参照を戻す', () => {
  const html = article('<h1>見出し<em>強調</em></h1>', {
    head: '<title>題｜NAGOYA BITES Journal</title><script type="application/ld+json">{"headline": "星ヶ丘「Afro&#39;s BBQ」&amp;宴会", "x": 1}</script>',
  });
  assert.equal(L.readArticleTitle(html), "星ヶ丘「Afro's BBQ」&宴会");
});

test('readArticleTitle: headline が無ければ <title>（末尾のサイト名を除く）、それも無ければ h1 の文字', () => {
  assert.equal(L.readArticleTitle('<html><head><title>栄の一人飲み｜NAGOYA BITES Journal</title></head></html>'), '栄の一人飲み');
  assert.equal(L.readArticleTitle('<html><head><title>栄の一人飲み | NAGOYA BITES</title></head></html>'), '栄の一人飲み');
  assert.equal(L.readArticleTitle('<h1>名古屋の<em>『コース5,000円』</em>は<br>結局いくら払うのか</h1>'), '名古屋の『コース5,000円』は 結局いくら払うのか');
  assert.equal(L.readArticleTitle('<html><body>no title</body></html>'), '');
});

// ── makeSlugResolver / buildJournalStoreMap ──

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i15-'));
  fs.mkdirSync(path.join(root, 'journal'));
  fs.mkdirSync(path.join(root, 'stores'));
  return root;
}

test('makeSlugResolver: 現役はそのまま・誘導ページは誘導先（現役のときだけ）・それ以外は null', () => {
  const root = sandbox();
  try {
    fs.writeFileSync(path.join(root, 'stores', 'OLD.html'), SO.renderRedirectStub('J1', 'とん八 栄店'));
    fs.writeFileSync(path.join(root, 'stores', 'GONE.html'), SO.renderRedirectStub('J404', '消えた店'));
    fs.writeFileSync(path.join(root, 'stores', 'PLAIN.html'), '<html><h1>通常ページ</h1></html>');
    const resolve = L.makeSlugResolver({ root, liveSlugs: new Set(['J1', 'J2']) });
    assert.equal(resolve('J2'), 'J2');
    assert.equal(resolve('OLD'), 'J1');
    assert.equal(resolve('GONE'), null, '誘導先が現役でなければ結ばない');
    assert.equal(resolve('PLAIN'), null, '誘導ページでも現役でもないページは結ばない');
    assert.equal(resolve('MISSING'), null, 'ファイルが無ければ結ばない');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('buildJournalStoreMap: 新しい順・同じ日はファイル名順・同じ店は1記事に1件・誘導ページは誘導先へ', () => {
  const root = sandbox();
  try {
    const put = (name, body) => fs.writeFileSync(path.join(root, 'journal', name), article(body, { head: `<title>${name.replace(/\.html$/, '')}の題｜NAGOYA BITES Journal</title>` }));
    put('2026-10-01-a.html', '<a href="../stores/J1.html">1</a><a href="../stores/J1.html">1b</a><a href="../stores/J2.html">2</a>');
    put('2026-10-05-b.html', '<a href="../stores/OLD.html">旧ID</a>');
    put('2026-09-01-c.html', '<a href="../stores/J2.html">2</a>');
    put('2026-10-05-a2.html', '<a href="../stores/J2.html">2</a>');
    fs.writeFileSync(path.join(root, 'journal', '2026-10-02-notitle.html'), '<html><body><article><a href="../stores/J1.html">1</a></article></body></html>');
    fs.writeFileSync(path.join(root, 'journal', 'index.html'), article('<a href="../stores/J3.html">3</a>'));
    fs.writeFileSync(path.join(root, 'journal', '_template.html'), article('<a href="../stores/J3.html">3</a>'));
    fs.writeFileSync(path.join(root, 'stores', 'OLD.html'), SO.renderRedirectStub('J1', 'とん八 栄店'));
    const map = L.buildJournalStoreMap({ root, resolveSlug: L.makeSlugResolver({ root, liveSlugs: new Set(['J1', 'J2', 'J3']) }) });
    assert.deepEqual(map.get('J1').map(e => e.slug), ['2026-10-05-b', '2026-10-01-a'], '旧IDへのリンクは今の店に結び、題の無い記事は出さない');
    assert.deepEqual(map.get('J2').map(e => e.slug), ['2026-10-05-a2', '2026-10-01-a', '2026-09-01-c'], '同じ日はファイル名順');
    assert.equal(map.has('J3'), false, 'index.html・_template.html は記事ではない');
    assert.deepEqual(map.get('J1')[0], { slug: '2026-10-05-b', title: '2026-10-05-bの題', date: '2026-10-05' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('buildJournalStoreMap: journal/ が無ければ空', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i15-'));
  try { assert.equal(L.buildJournalStoreMap({ root, resolveSlug: s => s }).size, 0); } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('実データ: 記事の対応表の各件は、記事を開けば検算できる（日付はファイル名・題は空でなく記号が残らない）', () => {
  const map = L.buildJournalStoreMap({ root: ROOT, resolveSlug: s => s });
  assert.ok(map.size > 0, 'ジャーナルに店舗ページへのリンクがある');
  for (const [storeSlug, list] of map) {
    let prev = null;
    for (const e of list) {
      const html = fs.readFileSync(path.join(ROOT, 'journal', `${e.slug}.html`), 'utf8');
      assert.ok(L.extractStoreSlugs(html).includes(storeSlug), `${e.slug} の本文に ${storeSlug} へのリンクがある`);
      assert.ok(e.slug.startsWith(e.date), `${e.slug} の日付`);
      assert.ok(e.title.length >= 4 && !/[<>]|&(?:amp|lt|gt|quot|#\d+);/.test(e.title), `${e.slug} の題: ${e.title}`);
      if (prev) assert.ok(prev.date >= e.date, '新しい順');
      prev = e;
    }
  }
});

// ── 店舗ページの描画 ──

const STORE = { '店名': 'テスト酒場', 'エリア': '大須', 'ジャンル': 'ラーメン', 'タグ': '個室', 'おすすめポイント': '炭火の焼き鳥が看板。' };
const FEATURE = { slug: 'private-room', title: '個室のある名古屋グルメ10選' };
const J = (n, over) => ({ slug: `2026-10-0${n}-j${n}`, title: `記事${n}の題`, date: `2026-10-0${n}`, ...over });

function section(html, headingText) {
  const i = html.indexOf(`<h2>${headingText}</h2>`);
  if (i < 0) return null;
  return html.slice(html.lastIndexOf('<div', i), html.indexOf('</div>', i));
}

test('描画: 特集だけ・記事だけ・両方・どちらも無い、で見出しが実際の中身と一致する', () => {
  const only = (f, j) => renderStorePage(STORE, 'J-t', [], f, j);
  assert.ok(section(only([FEATURE], []), 'この店が載っている特集'));
  assert.ok(section(only([], [J(1)]), 'この店が載っている記事'));
  assert.ok(section(only([FEATURE], [J(1)]), 'この店が載っている特集・記事'));
  const none = only([], []);
  assert.equal(none.includes('listed-features'), false, '載っているものが無い店は見出しごと出さない');
  assert.equal(/この店が載っている/.test(none), false);
});

test('描画: 古い見出し（この店舗が登場する特集・掲載特集）はどのページにも出ない', () => {
  for (const html of [
    renderStorePage(STORE, 'J-t', [], [], []),
    renderStorePage(STORE, 'J-t', [], [FEATURE], [J(1)]),
    renderStorePage(STORE, 'J-t'),
  ]) {
    assert.equal(html.includes('この店舗が登場する特集'), false);
    assert.equal(html.includes('<h2>掲載特集</h2>'), false);
  }
});

test('描画: 記事のリンクは ../journal/<slug>.html・題は逃がして出し・日付とジャーナルの添え書きが付く', () => {
  const html = renderStorePage(STORE, 'J-t', [], [], [J(1, { title: 'A & B <最強> "辛口"' })]);
  const sec = section(html, 'この店が載っている記事');
  assert.ok(sec.includes('<a href="../journal/2026-10-01-j1.html">A &amp; B &lt;最強&gt; &quot;辛口&quot;</a>'), sec);
  assert.ok(sec.includes('<span class="listed-kind">ジャーナル 2026年10月1日</span>'), sec);
});

test('描画: 載せる記事は新しい順に最大3本', () => {
  const list = [J(5), J(4), J(3), J(2), J(1)];
  const sec = section(renderStorePage(STORE, 'J-t', [], [], list), 'この店が載っている記事');
  const hrefs = [...sec.matchAll(/href="\.\.\/journal\/([^"]+)\.html"/g)].map(m => m[1]);
  assert.deepEqual(hrefs, ['2026-10-05-j5', '2026-10-04-j4', '2026-10-03-j3']);
});

test('描画: 載っている特集は特集の側の件数の表記をそろえた名前で出る（従来どおり）', () => {
  const sec = section(renderStorePage(STORE, 'J-t', [], [FEATURE], []), 'この店が載っている特集');
  assert.ok(/<a href="\.\.\/features\/private-room\.html">個室のある名古屋グルメ\d+選<\/a>/.test(sec), sec);
});

test('描画: 推定の特集は「あわせて読みたい特集」に出し、載っている特集と同じ特集は繰り返さない', () => {
  const inferredOf = (listedF) => section(renderStorePage(STORE, 'J-t', [], listedF, []), 'あわせて読みたい特集');
  const before = inferredOf([]);
  assert.ok(before.includes('../features/private-room.html'), '個室タグの店には個室の特集が推定で出る');
  const after = inferredOf([FEATURE]);
  assert.equal(after.includes('../features/private-room.html'), false, '載っている特集は推定の側に出ない');
  assert.equal((after.match(/<li>/g) || []).length, 3, '残りの規則で3本まで埋める');
  const page = renderStorePage(STORE, 'J-t', [], [FEATURE], []);
  assert.equal(page.split('../features/private-room.html').length - 1, 1, 'ページ全体で1回だけ');
});

test('描画: 推定が全部「載っている特集」と重なれば、あわせて読みたい特集は見出しごと出さない', () => {
  const lone = { '店名': 'どれにも当たらない店', 'エリア': '不明', 'ジャンル': '不明' };
  assert.deepEqual(buildRelatedFeatures(lone).map(h => h.file), ['nagoya-gourmet-guide.html']);
  assert.ok(renderStorePage(lone, 'J-t', [], [], []).includes('<h2>あわせて読みたい特集</h2>'));
  const html = renderStorePage(lone, 'J-t', [], [{ slug: 'nagoya-gourmet-guide', title: '名古屋グルメ完全ガイド' }], []);
  assert.equal(html.includes('あわせて読みたい特集'), false);
  assert.ok(html.includes('この店が載っている特集'));
});

test('buildRelatedFeatures: 除外する特集を渡さなければ従来どおり（最大3本・優先順）', () => {
  const hits = buildRelatedFeatures(STORE);
  assert.equal(hits.length, 3);
  assert.equal(hits[0].file, 'private-room.html');
  assert.deepEqual(buildRelatedFeatures(STORE, ['private-room.html']).map(h => h.file).includes('private-room.html'), false);
});

test('全店: どの店舗ページにも古い見出し「この店舗が登場する特集」は出ない', () => {
  const { loadStores } = require(path.join(ROOT, 'scripts', 'lib', 'load_stores'));
  const stores = loadStores().filter(s => s['店名']);
  assert.ok(stores.length > 1000);
  let withHeading = 0;
  for (const s of stores) {
    const html = renderStorePage(s, toSlug(s), [], [], []);
    assert.equal(html.includes('この店舗が登場する特集'), false, s['店名']);
    if (html.includes('<h2>あわせて読みたい特集</h2>')) withHeading++;
  }
  assert.ok(withHeading > stores.length * 0.9, '推定の特集の案内は従来どおり大半の店に残る');
});
