'use strict';
// SEO-135: llms.txt にエリア → ジャンル → 条件のハブ階層と、数値の出典・更新日を載せることの検査
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const G = require('../scripts/gen_llms_txt');
const { loadPolicy } = require('../scripts/lib/area_genre_pages');

const ROOT = path.resolve(__dirname, '..');
const policy = {
  baseDir: 'stores/area',
  areas: [{ slug: 'meieki', label: '名駅' }, { slug: 'sakae', label: '栄' }],
  genres: [{ slug: 'bar', label: 'バー' }, { slug: 'dining-bar', label: 'ダイニングバー' }],
  conditions: [{ slug: 'koshitsu', label: '個室あり' }, { slug: 'late-night', label: '深夜営業' }, { slug: 'parking', label: '駐車場あり' }],
};
const page = (p, type, count, updated = '2026-10-01', status = 'active') =>
  ({ path: `stores/area/${p}`, type, count, updated, status });
const manifest = {
  pages: [
    page('index.html', 'root', null, '2026-10-05'),
    page('meieki/index.html', 'area', 30),
    page('meieki/bar.html', 'genre', 10),
    page('meieki/dining-bar.html', 'genre', 20, '2026-10-07'),
    page('meieki/dining-bar-late-night.html', 'condition', 8),
    page('meieki/dining-bar-koshitsu.html', 'condition', 9),
    page('meieki/bar-koshitsu.html', 'condition', 5, '2026-10-09', 'stub'),
    page('sakae/index.html', 'area', 40),
    page('sakae/bar.html', 'genre', 25),
    page('sakae/unknown.html', 'genre', 3),
  ],
};

test('階層: 公開中だけを、ハイフンを含む記号も正しく区切って、エリア → ジャンル → 条件にまとめる', () => {
  const h = G.collectHubs(policy, manifest);
  assert.strictEqual(h.total, 9); // stub を除く
  assert.deepStrictEqual(h.tree.map((a) => a.slug), ['sakae', 'meieki']); // 掲載店数の多い順
  const meieki = h.tree[1];
  assert.deepStrictEqual(meieki.genres.map((g) => g.slug), ['dining-bar', 'bar']);
  // 条件はポリシーの並び順（manifest の並びに左右されない）。dining-bar-late-night を dining + bar-late-night と読まない
  assert.deepStrictEqual(meieki.genres[0].conditions.map((c) => c.slug), ['koshitsu', 'late-night']);
  assert.deepStrictEqual(meieki.genres[1].conditions, []); // stub の bar-koshitsu は載せない
  assert.strictEqual(h.lastUpdated, '2026-10-07'); // stub の 10-09 は数えない
  assert.deepStrictEqual(h.unknown, ['stores/area/sakae/unknown.html']);
  assert.deepStrictEqual(h.top.map((t) => t.label), ['栄×バー', '名駅×ダイニングバー', '名駅×バー']);
});

test('全階層の出力: エリアとジャンルは URL を書き、条件は記号(掲載店数)と URL の作り方の実例を示す', () => {
  const h = G.collectHubs(policy, manifest);
  const out = G.renderHubTree(h, policy);
  assert.match(out, /### 名駅・30店: https:\/\/nagoya-bites\.com\/stores\/area\/meieki\/index\.html/);
  assert.match(out, /- ダイニングバー・20店: https:\/\/nagoya-bites\.com\/stores\/area\/meieki\/dining-bar\.html ／ 条件別2本: koshitsu\(9\) late-night\(8\)/);
  // 実例は実在する条件ページから取る
  assert.match(out, /名駅×ダイニングバー×個室あり → https:\/\/nagoya-bites\.com\/stores\/area\/meieki\/dining-bar-koshitsu\.html/);
  // 凡例は実際に使われた条件だけ（parking のページは無い）
  assert.match(out, /条件記号: koshitsu=個室あり \/ late-night=深夜営業\n/);
  assert.doesNotMatch(out, /parking/);
  assert.doesNotMatch(out, /unknown\.html/);
});

test('店舗数の更新日: 数値が変わらなければ前回の日付を引き継ぎ、変われば当日にする', () => {
  const wrap = (name, inner) => `<!-- AUTO-GENERATED:${name}:start -->${inner}<!-- AUTO-GENERATED:${name}:end -->`;
  const original = [
    wrap('store_count', '4,856'), wrap('areas', '\nA\n'), wrap('genres', 'G'),
    wrap('data_sources', '\n  - 店舗数（この数値に更新した日: 2026-10-08）\n'),
  ].join('\n');
  const same = { store_count: '4,856', areas: '\nA\n', genres: 'G' };
  assert.strictEqual(G.storesAsOf(original, same, '2026-10-20'), '2026-10-08');
  assert.strictEqual(G.storesAsOf(original, { ...same, store_count: '4,900' }, '2026-10-20'), '2026-10-20');
  assert.strictEqual(G.storesAsOf(original, { ...same, genres: 'G2' }, '2026-10-20'), '2026-10-20');
  const noDate = original.replace(/この数値に更新した日: [\d-]+/, '');
  assert.strictEqual(G.storesAsOf(noDate, same, '2026-10-20'), '2026-10-20');
  const out = G.renderDataSources({ storesDate: '2026-10-08', hubsDate: '2026-10-07' });
  assert.match(out, /data\/stores\.json から営業中の店だけを数えた値（この数値に更新した日: 2026-10-08）/);
  assert.match(out, /area_genre_pages_manifest\.json の値（ページの内容が最後に変わった日: 2026-10-07）/);
});

test('マーカー: 同名マーカーは全箇所を置き換え、読み出しは最初の中身を返す', () => {
  const src = 'a<!-- AUTO-GENERATED:x:start -->1<!-- AUTO-GENERATED:x:end -->b<!-- AUTO-GENERATED:x:start -->1<!-- AUTO-GENERATED:x:end -->';
  const next = G.replaceMarker(src, 'x', '2');
  assert.strictEqual(next.match(/-->2<!--/g).length, 2);
  assert.strictEqual(G.readMarker(next, 'x'), '2');
  assert.strictEqual(G.readMarker(next, 'y'), null);
  assert.throws(() => G.replaceMarker(src, 'y', '2'), /マーカーが見つかりません/);
});

test('実データ: URL の表に衝突が無く、公開中のハブはすべて階層に入る', () => {
  const real = loadPolicy();
  const idx = G.hubUrlIndex(real);
  const A = real.areas.length;
  const N = real.genres.length;
  assert.strictEqual(idx.size, 1 + A + A * N + A * N * real.conditions.length);
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'area_genre_pages_manifest.json'), 'utf8'));
  const h = G.collectHubs(real, m);
  assert.deepStrictEqual(h.unknown, []);
  const active = new Set(m.pages.filter((p) => p.status === 'active').map((p) => p.path));
  const genres = h.tree.flatMap((a) => a.genres);
  const conds = genres.flatMap((g) => g.conditions);
  assert.strictEqual(conds.length, h.byType.condition || 0);
  assert.strictEqual(genres.filter((g) => g.url).length, h.byType.genre || 0);
  for (const u of [...h.tree.map((a) => a.url), ...genres.map((g) => g.url), ...conds.map((c) => c.url)].filter(Boolean)) {
    assert.ok(active.has(u), `公開中でない URL が階層に入った: ${u}`);
  }
});

test('llms.txt: 出典・全階層のマーカーがあり、サイトマップは毎日更新される sitemap.xml を指す', () => {
  const txt = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
  for (const name of ['data_sources', 'area_genre_hubs', 'area_genre_tree']) {
    assert.ok(G.readMarker(txt, name) !== null, `マーカーが無い: ${name}`);
  }
  assert.match(txt, /サイトマップ: https:\/\/nagoya-bites\.com\/sitemap\.xml\n/);
  assert.doesNotMatch(txt, /sitemap-index\.xml|sitemap-news\.xml/);
});
