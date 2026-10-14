'use strict';
/**
 * tests/top_light_index.test.js
 *
 * トップを軽くする（I-25・P-403・判断の記録 0039）。
 *   トップの「エリア別 全店舗一覧」は、掲載全店（5,005 店）の店舗ページへのリンクを 1 本ずつ書いた区画で、トップの HTML の半分以上を占めていた。
 *   これを、エリア別・ジャンル別の一覧ページ（stores/area/・以下「ハブ」）への入口に置き換えた。あわせて次の 3 つを守る:
 *     1. 入口は、実在して公開中のハブだけ（閾値割れの stub・まだ書かれていないハブ・条件のハブには張らない）
 *     2. カードの題名の店舗ページへのリンクは、これまでと同じ店に付く（リンクの出所を、索引の文字から店のデータの ID に移した）
 *     3. ItemList（構造化データ）はトップに 1 本だけ。URL は実在する現役の店舗ページ
 *
 * 区画（STORE-INDEX・STORE-ITEMLIST など CI が書き直す所）の中身を、現在のデータと突き合わせることはしない
 * （定期ルーチンの PR は build を通さずに npm test だけを回す）。ここで見るのは、
 *   ・生成器の部品（純粋な関数）の振る舞い（フィクスチャと、今のデータを入れたときの出力）
 *   ・index.html の静的な構造（ItemList の本数・JS が ItemList を作らないこと・区画の印・LOCAL_STORES の形）
 * だけ。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const gen = require('../scripts/inject_store_links');
const { renderRedirectStub } = require('../scripts/lib/store_orphans');
const { loadPolicy } = require('../scripts/lib/area_genre_pages');
const { loadStores } = require('../scripts/lib/load_stores');

// ── フィクスチャ ──────────────────────────────────────────────────────────
const POLICY = {
  areas: [{ slug: 'meieki', label: '名駅' }, { slug: 'sakae', label: '栄' }, { slug: 'kanayama', label: '金山' }],
  genres: [{ slug: 'izakaya', label: '居酒屋' }, { slug: 'yakiniku', label: '焼肉' }, { slug: 'cafe', label: 'カフェ' }],
};
const page = (p, type, count, status = 'active') => ({ path: p, type, count, status });
const MANIFEST = {
  pages: [
    page('stores/area/index.html', 'root', null),
    page('stores/area/meieki/index.html', 'area', 120),
    // 並びが違う順に書いてある（件数の少ない順・同数はポリシーと逆）: 入口の並びは、manifest の並びに頼らず決める
    page('stores/area/meieki/cafe.html', 'genre', 10),
    page('stores/area/meieki/yakiniku.html', 'genre', 80),
    page('stores/area/meieki/izakaya.html', 'genre', 80),
    page('stores/area/meieki/izakaya-koshitsu.html', 'condition', 30),
    page('stores/area/sakae/index.html', 'area', 300),
    page('stores/area/sakae/izakaya.html', 'genre', 150),
    page('stores/area/sakae/yakiniku.html', 'genre', 60, 'stub'),
    page('stores/area/sakae/izakaya-sunday.html', 'condition', 12, 'stub'),
    page('stores/area/kanayama/index.html', 'area', 40, 'stub'),
    page('stores/area/kanayama/cafe.html', 'genre', 20),
    page('stores/area/nowhere/index.html', 'area', 5),
    page('stores/area/sakae/ramen.html', 'genre', 9),
  ],
};
const everyFile = () => true;
const except = (...gone) => (rel) => !gone.includes(rel);

// 今のデータ（店のデータ・stores/ の現役ページと誘導ページの一覧）。店舗ページ約 5,200 本を読むので、1 度だけ読む
let realCache = null;
function real() {
  if (!realCache) realCache = { stores: loadStores().filter((s) => s['公開フラグ'] !== 'FALSE'), dp: gen.loadDetailPageSet() };
  return realCache;
}

// ── 1. 入口にするハブを決める ───────────────────────────────────────────
test('planHubLinks: active でファイルが実在するエリアとジャンルのハブだけ。stub・条件のハブ・名前を引けないものは載せない', () => {
  const plan = gen.planHubLinks({ manifest: MANIFEST, policy: POLICY, exists: everyFile });
  assert.deepEqual(plan.root, { path: 'stores/area/index.html' });
  // kanayama の area は stub → エリアごと載せない。その配下の genre（active）も、親が無いので載せない
  assert.deepEqual(plan.areas.map((a) => a.slug), ['sakae', 'meieki'], 'エリアは店の多い順');
  const sakae = plan.areas[0];
  assert.deepEqual(sakae.genres.map((g) => g.path), ['stores/area/sakae/izakaya.html'], 'stub のジャンル・条件のハブ・ポリシーに無いジャンルは載せない');
  const meieki = plan.areas[1];
  assert.deepEqual(meieki.genres.map((g) => g.slug), ['izakaya', 'yakiniku', 'cafe'], '同数は、ポリシーの並び（居酒屋・焼肉）。件数の少ないものは後ろ');
  assert.equal(meieki.genres.find((g) => g.slug === 'izakaya').text, '名駅の居酒屋');
  // 載せなかった理由: ポリシーに無いエリア（nowhere）・親が無い／名前を引けないジャンル（kanayama/cafe・sakae/ramen）
  assert.equal(plan.skipped, 3);
  assert.ok(!JSON.stringify(plan).includes('koshitsu') && !JSON.stringify(plan).includes('sunday'), '条件のハブ（個室あり・日曜営業）は入口にしない');
});

test('planHubLinks: ファイルが実在しないハブ・manifest やポリシーが読めない日は載せない（死にリンクを作らない）', () => {
  const noRoot = gen.planHubLinks({ manifest: MANIFEST, policy: POLICY, exists: except('stores/area/index.html') });
  assert.equal(noRoot.root, null);
  assert.equal(noRoot.areas.length, 2);
  const noGenre = gen.planHubLinks({ manifest: MANIFEST, policy: POLICY, exists: except('stores/area/meieki/yakiniku.html') });
  assert.deepEqual(noGenre.areas.find((a) => a.slug === 'meieki').genres.map((g) => g.slug), ['izakaya', 'cafe']);
  const noArea = gen.planHubLinks({ manifest: MANIFEST, policy: POLICY, exists: except('stores/area/meieki/index.html') });
  assert.deepEqual(noArea.areas.map((a) => a.slug), ['sakae'], 'エリアのページが無ければ、そのエリアごと載せない');
  for (const [manifest, policy] of [[null, POLICY], [MANIFEST, null], [{}, POLICY], [{ pages: 'x' }, POLICY]]) {
    const plan = gen.planHubLinks({ manifest, policy, exists: everyFile });
    assert.deepEqual(plan, { root: null, areas: [], skipped: 0 });
  }
  assert.deepEqual(gen.planHubLinks({ manifest: { pages: [] }, policy: POLICY, exists: everyFile }).areas, []);
});

test('renderStoreIndexBlock: エリアごとの details・ハブへのリンクだけ。リンクは重ならず、店名も店舗ページへのリンクも書かない', () => {
  const plan = gen.planHubLinks({ manifest: MANIFEST, policy: POLICY, exists: everyFile });
  const html = gen.renderStoreIndexBlock(plan);
  assert.ok(html.startsWith('<section id="store-index" class="store-index" aria-label="エリア別 店舗一覧">'), 'section#store-index は残る（フッター・他のページが指す）');
  assert.ok(html.includes('<h2 class="store-index-title">エリア別 店舗一覧</h2>'));
  assert.equal((html.match(/<details class="store-index-area">/g) || []).length, plan.areas.length);
  const hrefs = [...html.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]);
  // エリアのハブ 2 + ジャンルのハブ 4 + 入口 1
  assert.equal(hrefs.length, 7);
  assert.equal(new Set(hrefs).size, hrefs.length, '同じリンクを 2 回書かない');
  for (const h of hrefs) assert.match(h, /^stores\/area\/(?:index\.html|[a-z-]+\/(?:index|[a-z-]+)\.html)$/, `ハブか入口だけ: ${h}`);
  assert.ok(!/href="stores\/[^a]/.test(html), '店舗ページ（stores/<ID>.html）へのリンクは書かない');
  assert.ok(html.includes('<li><a href="stores/area/sakae/index.html">栄の飲食店<span class="store-index-n">（300軒）</span></a></li>'), 'エリアのハブのリンク文は、そのページの見出し「{エリア}の飲食店」＋件数');
  assert.ok(html.includes('<li><a href="stores/area/meieki/yakiniku.html">名駅の焼肉<span class="store-index-n">（80軒）</span></a></li>'), 'ジャンルのハブは「{エリア}の{ジャンル}」＋件数');
  // 件数は 1 つの span に入る（折り返しで「（93」と「軒）」に割れない）。タグを外した見える文字は「{見出し}（N軒）」のまま
  const visible = [...html.matchAll(/<li><a href="[^"]*">([\s\S]*?)<\/a><\/li>/g)].map((m) => m[1].replace(/<[^>]*>/g, ''));
  assert.equal(visible[0], '栄の飲食店（300軒）');
  assert.ok(visible.includes('名駅の焼肉（80軒）'));
  assert.equal((html.match(/<span class="store-index-n">（\d+軒）<\/span>/g) || []).length, visible.length, '件数の span はリンクの数と同じ');
  assert.ok(html.includes('<span class="store-index-name">栄</span><span class="store-index-count">300軒</span>'));
  assert.ok(html.includes('<p class="store-index-more"><a href="stores/area/index.html">エリア×ジャンルをすべて見る →</a></p>'));
  assert.ok(!gen.renderStoreIndexBlock(Object.assign({}, plan, { root: null })).includes('store-index-more'), '入口が無い日は書かない');
});

test('renderStoreIndexBlock: ラベルや path に属性を破る文字があっても逃がす', () => {
  const plan = {
    root: { path: 'stores/area/index.html' },
    areas: [{ slug: 'x', label: 'A&B"<i>', path: 'stores/area/x/index.html?"><b>', count: 1, genres: [{ slug: 'g', label: 'G', path: 'stores/area/x/g.html', count: 1, text: 'A&B"<i>のG' }] }],
  };
  const html = gen.renderStoreIndexBlock(plan);
  assert.ok(!html.includes('<i>') && !html.includes('<b>'), html);
  assert.ok(html.includes('A&amp;B&quot;&lt;i&gt;'));
});

// ── 2. 今のデータで、入口が全部実在する ─────────────────────────────────────
test('今のデータ: 入口にするハブはすべてファイルが実在し、manifest で active。リンク文は着地ページの見出しと同じ', () => {
  const manifest = gen.loadHubManifest(ROOT);
  const policy = loadPolicy();
  const plan = gen.planHubLinks({ manifest, policy, exists: (rel) => fs.existsSync(path.join(ROOT, rel)) });
  assert.ok(plan.root && plan.areas.length >= 1, '入口が 1 つも無い（manifest かポリシーが読めていない）');
  const status = new Map(manifest.pages.map((p) => [p.path, p]));
  const html = gen.renderStoreIndexBlock(plan);
  const hrefs = [...html.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const h of hrefs) {
    assert.ok(fs.existsSync(path.join(ROOT, h)), `ハブのファイルが無い: ${h}`);
    assert.equal((status.get(h) || {}).status, 'active', `active でないハブに張っている: ${h}`);
    assert.notEqual((status.get(h) || {}).type, 'condition', `条件のハブには張らない: ${h}`);
  }
  // リンク文は、着地ページの h1 と同じ言い方（「{エリア}の飲食店」「{エリア}の{ジャンル}」）。違うと、リンクとページの対応が崩れる
  const h1Of = (rel) => {
    const m = fs.readFileSync(path.join(ROOT, rel), 'utf8').match(/<h1 class="art-title">([\s\S]*?)<\/h1>/);
    return m ? m[1].replace(/<[^>]*>/g, '').trim() : null;
  };
  for (const a of plan.areas) {
    assert.equal(h1Of(a.path), gen.hubLinkText('area', a), a.path);
    for (const g of a.genres) assert.equal(h1Of(g.path), g.text, g.path);
  }
  // エリアの数は、ポリシーのエリアの数を超えない。リンクの総数は、条件のハブ（600 本近く）を載せない小ささにとどまる
  assert.ok(plan.areas.length <= policy.areas.length);
  assert.ok(hrefs.length <= 1 + policy.areas.length * (1 + policy.genres.length), `リンクが多すぎる: ${hrefs.length}`);
});

// ── 3. 店舗ページへの例外の表（カードの題名のリンクが引く）─────────────────────────────
function detailPages(active, redirects = {}) {
  return { active: new Set(active), redirects: new Map(Object.entries(redirects)) };
}

test('buildStorePageTable: 自分の ID のページがある店は表に載せない。ページが無い店は none・誘導ページ経由で移った店は to', () => {
  const dp = detailPages(['J1', 'J2', 'J9'], { J3: 'J9', J4: 'J404' });
  const stores = [
    { '店名': 'a', 'ホットペッパーID': 'J1' },
    { '店名': 'b', 'ホットペッパーID': 'J2' },
    { '店名': 'c', 'ホットペッパーID': 'J3' }, // 誘導ページ → 現役の J9
    { '店名': 'd', 'ホットペッパーID': 'J4' }, // 誘導ページ → 移り先が無い
    { '店名': 'e', 'ホットペッパーID': 'J5' }, // ページが無い
    { '店名': 'f' }, // ID 無し（手動店）
    { '店名': 'g', 'ホットペッパーID': '' },
    { '店名': 'h', 'ホットペッパーID': 'a/b' }, // 不正な形
    { '店名': 'i', 'ホットペッパーID': 'J<9' },
  ];
  assert.deepEqual(gen.buildStorePageTable(stores, dp), { none: { J4: 1, J5: 1 }, to: { J3: 'J9' } });
  assert.deepEqual(gen.buildStorePageTable([], dp), { none: {}, to: {} });
  assert.deepEqual(gen.buildStorePageTable([{ 'ホットペッパーID': 'J1' }], dp), { none: {}, to: {} }, '全店が自分のページを持つ日は空');
});

test('buildStorePageTable: キーは並べ替えて書く（同じ入力は同じ出力・差分が小さい）', () => {
  const dp = detailPages([]);
  const t = gen.buildStorePageTable([{ 'ホットペッパーID': 'J3' }, { 'ホットペッパーID': 'J1' }, { 'ホットペッパーID': 'J2' }], dp);
  assert.deepEqual(Object.keys(t.none), ['J1', 'J2', 'J3']);
});

test('renderStorePagesScript: JSON の 1 行の script。< は逃がして、</script> で区画が閉じない', () => {
  const html = gen.renderStorePagesScript({ none: { J1: 1 }, to: { J2: 'J9' } });
  assert.equal(html, '<script>var NB_STORE_PAGES = {"none":{"J1":1},"to":{"J2":"J9"}};</script>');
  const tricky = gen.renderStorePagesScript({ none: {}, to: { J3: '</script><b>' } });
  assert.equal((tricky.match(/<\/script>/g) || []).length, 1, '閉じるタグは末尾の 1 つだけ');
  const m = tricky.match(/^<script>var NB_STORE_PAGES = (.*);<\/script>$/);
  assert.deepEqual(JSON.parse(m[1]), { none: {}, to: { J3: '</script><b>' } }, '逃がしても、読み戻すと元の値');
  // 生成した script が、そのまま JS として動く
  const ctx = {};
  vm.runInNewContext(html.replace(/^<script>|<\/script>$/g, ''), ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.NB_STORE_PAGES)), { none: { J1: 1 }, to: { J2: 'J9' } });
});

// ── 4. ItemList（構造化データ）──────────────────────────────────────────────
test('buildItemList: 現役の店舗ページがある店だけ。誘導ページ・検索へのリンクだけの店は載せず、移り先の現役ページがあれば移り先の URL', () => {
  const dp = detailPages(['J1', 'J2', 'J9'], { J3: 'J9', J4: 'J404' });
  const stores = [
    { '店名': '一', 'ホットペッパーID': 'J1' },
    { '店名': '手動の店' }, // ID 無し＝検索ディープリンク
    { '店名': '二', 'ホットペッパーID': 'J2' },
    { '店名': '移った店', 'ホットペッパーID': 'J3' },
    { '店名': '誘導先無し', 'ホットペッパーID': 'J4' },
    { '店名': '', 'ホットペッパーID': 'J1' }, // 店名が無い
    { '店名': '五', 'ホットペッパーID': 'J5' }, // ページ無し
  ];
  const il = gen.buildItemList(stores, dp);
  assert.equal(il['@context'], 'https://schema.org');
  assert.equal(il['@type'], 'ItemList');
  assert.equal(il.name, '名古屋グルメ掲載店舗一覧');
  assert.deepEqual(il.itemListElement.map((x) => [x.position, x.name, x.url]), [
    [1, '一', 'https://nagoya-bites.com/stores/J1.html'],
    [2, '二', 'https://nagoya-bites.com/stores/J2.html'],
    [3, '移った店', 'https://nagoya-bites.com/stores/J9.html'],
  ]);
  assert.ok(il.itemListElement.every((x) => x['@type'] === 'ListItem'));
  assert.equal(il.numberOfItems, il.itemListElement.length, 'numberOfItems は、実際に並べた件数（全店の数ではない）');
});

test('buildItemList: 古い ID の店と移り先の店が同じページを指すときは、同じ URL を 2 回並べない', () => {
  const dp = detailPages(['J9'], { J3: 'J9' });
  const il = gen.buildItemList([{ '店名': '古い ID の店', 'ホットペッパーID': 'J3' }, { '店名': '移り先の店', 'ホットペッパーID': 'J9' }], dp);
  assert.deepEqual(il.itemListElement.map((x) => [x.position, x.name]), [[1, '古い ID の店']]);
  assert.equal(il.numberOfItems, 1);
});

test('buildItemList: 上限は 50 件で、並べる順は店のデータの順。URL は一意', () => {
  const ids = Array.from({ length: 80 }, (_, i) => `J${1000 + i}`);
  const dp = detailPages(ids);
  const stores = ids.map((id, i) => ({ '店名': `店${i}`, 'ホットペッパーID': id }));
  const il = gen.buildItemList(stores, dp);
  assert.equal(il.itemListElement.length, 50);
  assert.equal(il.numberOfItems, 50);
  assert.equal(il.itemListElement[0].name, '店0');
  assert.equal(il.itemListElement[49].name, '店49');
  assert.equal(il.itemListElement[49].position, 50);
  assert.equal(new Set(il.itemListElement.map((x) => x.url)).size, 50);
  assert.equal(gen.buildItemList(stores, dp, 3).itemListElement.length, 3, '上限は引数で変えられる');
  assert.equal(gen.buildItemList([], dp).numberOfItems, 0);
});

test('renderItemListBlock: 1 つの script。0 件なら印だけ（空の ItemList を出さない）。</script> を含む店名でも区画が破れない', () => {
  const dp = detailPages(['J1']);
  const empty = gen.renderItemListBlock(gen.buildItemList([], dp));
  assert.equal(empty, '<!-- STORE-ITEMLIST:START -->\n<!-- STORE-ITEMLIST:END -->');
  const il = gen.buildItemList([{ '店名': '</script><img src=x onerror=alert(1)>', 'ホットペッパーID': 'J1' }], dp);
  const block = gen.renderItemListBlock(il);
  assert.ok(block.startsWith('<!-- STORE-ITEMLIST:START -->\n<script type="application/ld+json">'));
  assert.ok(block.endsWith('</script>\n<!-- STORE-ITEMLIST:END -->'));
  assert.equal((block.match(/<\/script>/g) || []).length, 1);
  assert.ok(!block.includes('<img'), '< は \\u003c に逃がす');
  const json = JSON.parse(block.match(/<script type="application\/ld\+json">([\s\S]*)<\/script>/)[1]);
  assert.equal(json.itemListElement[0].name, '</script><img src=x onerror=alert(1)>', '読み戻すと元の店名');
});

test('今のデータ: ItemList の URL は、すべて実在する現役の店舗ページ（誘導ページ・検索へのリンクを載せない）', () => {
  const { stores, dp } = real();
  const il = gen.buildItemList(stores, dp);
  assert.ok(il.itemListElement.length >= 10, `ItemList が少なすぎる: ${il.itemListElement.length}`);
  assert.equal(il.numberOfItems, il.itemListElement.length);
  for (const x of il.itemListElement) {
    const m = x.url.match(/^https:\/\/nagoya-bites\.com\/stores\/([^/]+)\.html$/);
    assert.ok(m, x.url);
    const slug = decodeURIComponent(m[1]);
    assert.ok(dp.active.has(slug), `現役の店舗ページが無い: ${x.url}`);
    assert.ok(!dp.redirects.has(slug), `誘導ページを載せている: ${x.url}`);
    assert.ok(fs.existsSync(path.join(ROOT, 'stores', `${slug}.html`)), x.url);
  }
});

// ── 5. カードの題名のリンク: 索引をやめても、リンクが付く店は変わらない ───────────────────────
// 以前は「店名（エリア・ジャンル）」の索引から href を引いていた。今は店の ID と例外の表で決める。
// どちらも「現役の店舗ページがある店にだけ」付ける、という同じ決まり。全店で結果が一致することを、生成器の元の規則（buildHrefFor）と照らす。
function fnSource(name) {
  const head = '\nfunction ' + name + '(';
  assert.equal(INDEX.split(head).length - 1, 1, `function ${name} は 1 つだけ定義されている`);
  const a = INDEX.indexOf(head) + 1;
  const b = INDEX.indexOf('\n}\n', a);
  assert.ok(b > a, `function ${name} の終わりが見つからない`);
  return INDEX.slice(a, b + 2);
}
function loadNbStoreHref(table) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext((table ? `var NB_STORE_PAGES = ${JSON.stringify(table)};\n` : '') + fnSource('nbStoreHref'), ctx);
  return ctx.nbStoreHref;
}

test('今のデータ: カードの題名のリンクは、現役の店舗ページがある全店に付き、ページが無い店には付かない（以前の索引と同じ結果）', () => {
  const { stores, dp } = real();
  const table = gen.buildStorePageTable(stores, dp);
  const href = loadNbStoreHref(table);
  let linked = 0;
  const wrong = [];
  for (const s of stores) {
    // 以前の索引が出していた href（店舗ページなら stores/…・そうでなければ検索へのリンク＝カードはリンクにしない）
    const before = gen.buildHrefFor(s, dp);
    const want = /^stores\/[^#?\s"'<>]+\.html$/.test(before) ? before : '';
    const got = href(s);
    if (got !== want) wrong.push(`${s['店名']}(${s['ホットペッパーID'] || '-'}): ${got} ≠ ${want}`);
    if (got) { linked++; assert.ok(fs.existsSync(path.join(ROOT, got)), `リンク先が無い: ${got}`); }
  }
  assert.deepEqual(wrong.slice(0, 10), [], `リンクの付く店が以前と違う: ${wrong.length} 件`);
  assert.ok(linked > 4000, `リンクの付く店が少なすぎる: ${linked}`);
});

// ── 6. index.html の静的な構造 ─────────────────────────────────────────────
function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(JSON.parse(m[1]));
  return out;
}
function plainScripts(html) {
  const out = [];
  const re = /<script(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}
const count = (s, sub) => s.split(sub).length - 1;

test('index.html: ItemList は構造化データ全体で 1 本だけ。画面の JS は ItemList を作らない（以前は静的な about と JS の 2 本で最大 3 本だった）', () => {
  const blocks = jsonLdBlocks(INDEX);
  const lists = blocks.filter((b) => b['@type'] === 'ItemList');
  assert.equal(lists.length, 1, 'ItemList は 1 本');
  assert.ok(!JSON.stringify(blocks.filter((b) => b['@type'] !== 'ItemList')).includes('ItemList'), 'WebPage の about などに、別の ItemList を入れない');
  assert.ok(!plainScripts(INDEX).some((s) => /ItemList/.test(s)), 'JS が head に ItemList を足さない');
  assert.ok(!INDEX.includes('injectDynamicJsonLd'), 'injectDynamicJsonLd は無い');
  const il = lists[0];
  assert.equal(il.numberOfItems, il.itemListElement.length, 'numberOfItems は並べた件数');
  assert.ok(il.itemListElement.length <= 50);
  for (const x of il.itemListElement) assert.match(x.url, /^https:\/\/nagoya-bites\.com\/stores\/[A-Za-z0-9_-]+\.html$/, '店舗ページの URL（検索条件の # や外部の URL を入れない）');
  // 構造化データの ItemList は、head の中にある
  const head = INDEX.slice(0, INDEX.indexOf('</head>'));
  assert.ok(head.includes('<!-- STORE-ITEMLIST:START -->') && head.includes('<!-- STORE-ITEMLIST:END -->'));
});

test('index.html: 全店の索引をなくした。区画の印と NB_STORE_PAGES の表は 1 組ずつ、店舗ページへの 1 本ずつのリンクは書かない', () => {
  for (const mark of ['<!-- STORE-INDEX:START', '<!-- STORE-INDEX:END -->', '<!-- SCENE-INDEX:START -->', '<!-- SCENE-INDEX:END -->', '<!-- STORE-ITEMLIST:START -->', '<!-- STORE-ITEMLIST:END -->']) {
    assert.equal(count(INDEX, mark), 1, `${mark} は 1 つ`);
  }
  assert.equal(count(INDEX, 'id="store-index"'), 1, 'section#store-index は残る（フッターなど全ページが指す）');
  assert.equal(count(INDEX, 'id="scene-index"'), 1, 'section#scene-index は残る');
  assert.equal(count(INDEX, 'var NB_STORE_PAGES'), 1, '例外の表は 1 つ');
  const a = INDEX.indexOf('<!-- STORE-INDEX:START');
  const b = INDEX.indexOf('<!-- STORE-INDEX:END -->');
  assert.ok(a > 0 && b > a);
  const region = INDEX.slice(a, b);
  assert.ok(region.includes('var NB_STORE_PAGES'), '例外の表は STORE-INDEX の区画に書く');
  // 最初の描画（loadStores(LOCAL_STORES)）より前に表がある。後ろにあると、最初に出る 30 枚のカードだけリンクが付かない（表が無いと nbStoreHref は黙って「リンク無し」を返す）
  const firstRender = INDEX.indexOf('loadStores(LOCAL_STORES)');
  assert.ok(firstRender > 0 && INDEX.indexOf('var NB_STORE_PAGES') < firstRender, '例外の表は、最初の描画より前の区画に置く');
  const hrefs = [...region.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 1);
  for (const h of hrefs) assert.match(h, /^stores\/area\//, `STORE-INDEX のリンクはハブだけ: ${h}`);
  assert.ok(!/index\.html#q=/.test(region), '検索へのディープリンク（店名ごと 157 本あった）も書かない');
  // 区画の大きさ: 以前は 718KB。エリアとジャンルのハブだけなら、数十 KB に収まる
  assert.ok(region.length < 60000, `STORE-INDEX が大きすぎる: ${region.length} 文字`);
  // 画面の JS が使っていた、索引の中のカード展開・サブエリアの絞り込み・折りたたみは無い
  for (const gone of ['enhanceStoreIndex', 'foldStoreIndex', 'parseSubAreas', 'inSubArea', 'NB_STORE_HREFS']) assert.ok(!INDEX.includes(gone), `${gone} は無い`);
  for (const gone of ['.si-cards', '.si-sub', '.si-more', '.si-viewall', '.si-actions', '.si-subbar', '.cards-on', '.store-index.is-folded']) assert.ok(!INDEX.includes(gone), `CSS ${gone} は無い`);
});

test('index.html: var LOCAL_STORES の形と先頭 50 件の順は変えない（トップの最初の描画・ItemList の元）', () => {
  const lines = INDEX.split('\n').filter((l) => l.startsWith('var LOCAL_STORES = ['));
  assert.equal(lines.length, 1, 'var LOCAL_STORES = [...]; の行は 1 本');
  assert.ok(lines[0].endsWith('];'), '行末は ];');
  const local = JSON.parse(lines[0].slice('var LOCAL_STORES = '.length, -1));
  assert.equal(local.length, 50, '先頭 50 件だけを埋め込む');
  // build.js は、優先順に並べた全店の先頭 50 件をここに埋め込み、全店を data/stores.json に書く（モーダルの openM(i) が、
  // 先頭 50 件の期間と全件を読み込んだ後で同じ店を指すため）。この順を崩すと、開いた店が入れ替わる
  const head = loadStores().slice(0, 50);
  assert.deepEqual(local.map((s) => s['店名']), head.map((s) => s['店名']), '先頭 50 件は data/stores.json の先頭 50 件と同じ順');
  assert.deepEqual(local.map((s) => s['ホットペッパーID'] || ''), head.map((s) => s['ホットペッパーID'] || ''));
});

test('index.html: 大きさの上限は方針（data/page_weight_policy.json の top）にあり、全店の索引が戻れない位置にある', () => {
  const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'page_weight_policy.json'), 'utf8'));
  const max = policy.types.top.maxBytes;
  const bytes = Buffer.byteLength(INDEX, 'utf8');
  assert.ok(bytes <= max, `index.html が方針の上限を超えている: ${bytes} > ${max}`);
  // 全店の索引（約 718KB）を戻すと 1.3MB を超える。上限がそこまで緩いと、戻っても audit_page_weight.js が止めない
  assert.ok(max <= 1000000, `トップの上限が緩い: ${max}`);
  assert.ok(bytes < 900000, `トップが全店の索引を持っていたころの大きさに近い: ${bytes}`);
});

test('index.html: 表示用の CSS は、タップの高さ（--tap-min）と文字の大きさのトークン（--fs-*）を使う', () => {
  const css = INDEX.slice(INDEX.indexOf('/* ── STORE INDEX'), INDEX.indexOf('/* ── iOS 入力時の自動ズーム防止'));
  assert.ok(css.length > 200, 'STORE INDEX の CSS が見つからない');
  assert.ok(/\.store-index-area>summary\{[^}]*min-height:var\(--tap-min\)/.test(css), 'summary はタップの高さ');
  assert.ok(/\.store-index-list a\{[^}]*min-height:var\(--tap-min\)/.test(css), 'ハブへのリンクはタップの高さ');
  assert.ok(/\.store-index-n\{[^}]*white-space:nowrap/.test(css), '件数（N軒）は折り返しで割れない');
  assert.ok(!/font-size:\s*\d/.test(css), '文字の大きさは var(--fs-*) のトークンだけ（直書きしない）');
  assert.ok(!/font-size:var\(--fs-(?:2xs|xxs)/.test(css), '13px 未満のトークンは使わない');
});
