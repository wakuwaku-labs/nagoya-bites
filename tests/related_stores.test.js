'use strict';

/**
 * I-16: 「似た店」の選び方（scripts/lib/related_stores.js）。
 *
 * 守ること:
 *  - 同じエリア群・同じジャンル（ハブと同じ判定）の店だけを出す。評価の高い順にはしない
 *  - 予算帯が同じか隣の店を先に、同じ段の中では最寄り駅が同じ店 → 予算帯の近さ → 2店のIDのハッシュ順
 *  - 最大6軒。足りなければ減らし、0軒なら出さない（埋めない）
 *  - 1店が似た店として出るページが一部の店に集まらない（旧実装: 上位50店に42.9%・最大423）
 *  - 判定の中身（NB-RELATED-CORE）は ES5・require 無しで、クイックビューに埋め込める
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const rel = require('../scripts/lib/related_stores.js');
const agp = require('../scripts/lib/area_genre_pages.js');
const policy = agp.loadPolicy();

const areaRaw = (slug) => policy.areas.find((a) => a.slug === slug).match[0];
const genreRaw = (slug) => policy.genres.find((g) => g.slug === slug).match[0];
const AREA = 'sakae';
const GENRE = 'izakaya';

function mk(id, o) {
  return Object.assign({
    '店名': '店' + id, 'ホットペッパーID': 'J' + id,
    'エリア': areaRaw(AREA), 'ジャンル': genreRaw(GENRE),
    '価格帯': '3001～4000円', '最寄駅': '栄', '営業ステータス': 'OPERATIONAL',
  }, o || {});
}
const sluggedOf = (stores) => stores.map((s) => ({ store: s, slug: 'slug-' + s['ホットペッパーID'] }));
const slugOf = (s) => 'slug-' + s['ホットペッパーID'];
const namesOf = (r) => r.items.map((i) => i.name);

// ── 価格帯の段・ハッシュ ──

test('価格帯の段: HotPepper の13区分が 0〜12 に並び、読めなければ null。area_genre_pages.parsePriceBand の読み方と同じ', () => {
  const table = [
    ['～500円', 0], ['501～1000円', 1], ['1001～1500円', 2], ['1501～2000円', 3], ['2001～3000円', 4],
    ['3001～4000円', 5], ['4001～5000円', 6], ['5001～7000円', 7], ['7001～10000円', 8], ['10001～15000円', 9],
    ['15001～20000円', 10], ['20001～30000円', 11], ['30001円～', 12],
  ];
  for (const [p, r] of table) assert.equal(rel.nbRelBudgetRank(p), r, p);
  for (const p of [null, undefined, '', 'abc', '円']) assert.equal(rel.nbRelBudgetRank(p), null, String(p));

  const edges = [500, 1000, 1500, 2000, 3000, 4000, 5000, 7000, 10000, 15000, 20000, 30000];
  const viaPolicy = (price) => {
    const b = agp.parsePriceBand(price);
    if (!b) return null;
    if (b.hi === null) return edges.length;
    let k = 0;
    while (k < edges.length && b.hi > edges[k]) k++;
    return k;
  };
  const prices = new Set(['～500円', '〜500円', '3,000円以下', '10,000円以上', '1000円', '15,001～20,000円', '2001～3000円']);
  const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
  for (const s of stores) if (s['価格帯']) prices.add(s['価格帯']);
  const diff = [...prices].filter((p) => viaPolicy(p) !== rel.nbRelBudgetRank(p));
  assert.deepEqual(diff, [], '段が area_genre_pages の読み方とずれる価格帯');
});

test('ハッシュ: FNV-1a（32bit）と一致し、同じ入力からは同じ値（乱数ではない）', () => {
  const ref = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  for (const s of ['', 'a', 'J000123456|J004558109', '店|名', 'N:ABC|N:あいう']) {
    assert.equal(rel.nbRelHash(s), ref(s), s);
    assert.equal(rel.nbRelHash(s), rel.nbRelHash(s));
  }
  assert.notEqual(rel.nbRelHash('J1|J2'), rel.nbRelHash('J2|J1'), '向きが違えば値も違う（ページごとに選びが変わる）');
});

// ── 選び方 ──

test('前提: 自分自身・同じ店名・別のエリア群・別のジャンル・閉店/一時休業は出さない。エリア群かジャンルが決まらない店は区画なし', () => {
  const me = mk(1);
  const stores = [
    me,
    mk(2),                                                  // 出す
    mk(3, { '店名': me['店名'] }),                           // 同じ店名
    mk(4, { 'エリア': areaRaw('meieki') }),                  // 別のエリア群
    mk(5, { 'ジャンル': genreRaw('yakiniku') }),             // 別のジャンル
    mk(6, { '営業ステータス': 'CLOSED_TEMPORARILY' }),       // 一時休業
    mk(7, { '営業ステータス': 'CLOSED_PERMANENTLY' }),       // 閉店
    mk(8, { 'ジャンル': '江戸前おまかせ鮨' }),                // ジャンル群が無い（候補にならない）
    mk(9, { 'エリア': '東京' }),                             // エリア群が無い
  ];
  const slugged = sluggedOf(stores);
  assert.deepEqual(namesOf(rel.buildRelatedStores(me, slugged, slugOf(me))), ['店2']);

  const noGenre = stores[7];
  const r1 = rel.buildRelatedStores(noGenre, slugged, slugOf(noGenre));
  assert.deepEqual(r1, { label: '', note: '', basis: '', items: [] });
  const noArea = stores[8];
  assert.deepEqual(rel.buildRelatedStores(noArea, slugged, slugOf(noArea)).items, []);
});

test('一時休業の店のページにも、開いている似た店は出す（休業の店は候補にならないだけ）', () => {
  const me = mk(1, { '営業ステータス': 'CLOSED_TEMPORARILY' });
  const slugged = sluggedOf([me, mk(2), mk(3)]);
  assert.deepEqual(namesOf(rel.buildRelatedStores(me, slugged, slugOf(me))).sort(), ['店2', '店3']);
});

test('並び: 予算が近い店が先 → 同じ段の中では最寄り駅が同じ店 → 予算の近さ。評価（Google評価・口コミ数）は見ない', () => {
  const me = mk(1, { '価格帯': '3001～4000円', '最寄駅': '栄' }); // 段5
  const stores = [
    me,
    mk(10, { '価格帯': '4001～5000円', 'Google評価': '3.0' }),                 // 段6: 隣・同じ駅
    mk(11, { '価格帯': '3001～4000円', 'Google評価': '3.1' }),                 // 段5: 同じ・同じ駅
    mk(12, { '価格帯': '1001～1500円', 'Google評価': '5.0', '口コミ数': '999' }), // 段2: 遠い
    mk(13, { '価格帯': null, 'Google評価': '4.9' }),                           // 不明
    mk(14, { '価格帯': '3001～4000円', '最寄駅': '伏見', 'Google評価': '5.0' }), // 段5: 別の駅
    mk(15, { '価格帯': '4001～5000円', '最寄駅': '伏見' }),                     // 段6: 別の駅
  ];
  const r = rel.buildRelatedStores(me, sluggedOf(stores), slugOf(me));
  // 1段目（予算が近い）: 同じ駅の 11（距離0）→ 10（距離1）→ 別の駅の 14（距離0）→ 15（距離1）。2段目: 12（距離3）→ 13（不明）
  assert.deepEqual(namesOf(r), ['店11', '店10', '店14', '店15', '店12', '店13']);
});

test('理由: 同じ駅なら「同じ○○駅」、1段目なら「予算が近い」。駅名の「駅」は重ねない', () => {
  const me = mk(1, { '最寄駅': '栄' });
  const stores = [me, mk(2), mk(3, { '最寄駅': '伏見' }), mk(4, { '価格帯': '1001～1500円' }), mk(5, { '価格帯': '1001～1500円', '最寄駅': '伏見' })];
  const r = rel.buildRelatedStores(me, sluggedOf(stores), slugOf(me));
  const reasonOf = Object.fromEntries(r.items.map((i) => [i.name, i.reasons]));
  assert.deepEqual(reasonOf['店2'], ['同じ栄駅', '予算が近い']);
  assert.deepEqual(reasonOf['店3'], ['予算が近い']);
  assert.deepEqual(reasonOf['店4'], ['同じ栄駅']);
  assert.deepEqual(reasonOf['店5'], []);

  const me2 = mk(1, { '最寄駅': '名古屋駅' });
  const r2 = rel.buildRelatedStores(me2, sluggedOf([me2, mk(2, { '最寄駅': '名古屋駅' })]), slugOf(me2));
  assert.deepEqual(r2.items[0].reasons, ['同じ名古屋駅', '予算が近い']);
});

test('見出しと注記: 区画の根拠（同じエリア群・同じジャンル）を述べ、予算が近い店があるときだけ並べ方を述べる', () => {
  const me = mk(1);
  const close = rel.buildRelatedStores(me, sluggedOf([me, mk(2)]), slugOf(me));
  assert.equal(close.label, '似た条件のお店');
  assert.equal(close.basis, '同じ栄の居酒屋');
  assert.equal(close.note, 'この店と同じ栄の居酒屋のうち、予算が近い店を先に並べています。');

  const far = rel.buildRelatedStores(me, sluggedOf([me, mk(2, { '価格帯': '15001～20000円' })]), slugOf(me));
  assert.equal(far.note, 'この店と同じ栄の居酒屋です。');
  const noPrice = rel.buildRelatedStores(mk(1, { '価格帯': null }), sluggedOf([mk(1, { '価格帯': null }), mk(2)]), 'slug-J1');
  assert.equal(noPrice.note, 'この店と同じ栄の居酒屋です。');
});

test('数: 最大6軒。足りなければその数だけ。0軒なら区画なし（関係の薄い店で埋めない）', () => {
  const many = Array.from({ length: 20 }, (_, i) => mk(i + 1));
  assert.equal(rel.buildRelatedStores(many[0], sluggedOf(many), slugOf(many[0])).items.length, 6);
  const three = many.slice(0, 4);
  assert.equal(rel.buildRelatedStores(three[0], sluggedOf(three), slugOf(three[0])).items.length, 3);
  const alone = [mk(1), mk(2, { 'エリア': areaRaw('meieki') }), mk(3, { 'ジャンル': genreRaw('ramen') })];
  const r = rel.buildRelatedStores(alone[0], sluggedOf(alone), slugOf(alone[0]));
  assert.deepEqual(r.items, []);
  assert.equal(r.label, '');
});

test('入力の並び順に左右されない（同じデータなら、並びを入れ替えても同じ店が同じ順で選ばれる）', () => {
  const stores = Array.from({ length: 40 }, (_, i) => mk(i + 1, { '価格帯': ['3001～4000円', '2001～3000円', '4001～5000円', '1001～1500円'][i % 4], '最寄駅': ['栄', '伏見', '久屋大通'][i % 3] }));
  const shuffled = stores.slice().reverse().sort((a, b) => (a['ホットペッパーID'].length % 3) - (b['ホットペッパーID'].length % 3));
  assert.notDeepEqual(stores.map((s) => s['店名']), shuffled.map((s) => s['店名']));
  for (const me of stores) {
    const a = rel.buildRelatedStores(me, sluggedOf(stores), slugOf(me)).items.map((i) => i.slug);
    const b = rel.buildRelatedStores(me, sluggedOf(shuffled), slugOf(me)).items.map((i) => i.slug);
    assert.deepEqual(a, b, me['店名']);
  }
});

test('集まらない: 条件が同じ60店が互いに6軒ずつ選ぶとき、特定の店に集まらない（IDの小さい順だと先頭6店に59ページずつ集まる）', () => {
  const stores = Array.from({ length: 60 }, (_, i) => mk(String(1000 + i)));
  const slugged = sluggedOf(stores);
  const inDeg = new Map();
  for (const me of stores) {
    const r = rel.buildRelatedStores(me, slugged, slugOf(me));
    assert.equal(r.items.length, 6);
    for (const it of r.items) inDeg.set(it.slug, (inDeg.get(it.slug) || 0) + 1);
  }
  const max = Math.max(...inDeg.values());
  assert.ok(max <= 20, `最も多い店が ${max} ページに出ている（平均 6）`);
  assert.ok(inDeg.size >= 55, `似た店として出る店が ${inDeg.size}/60 に偏っている`);
});

// ── 実データ ──

test('実データ: 全店で前提を守り、リンクが一部の店に集まらない（旧: 上位50店に42.9%・最大423）', () => {
  const { loadStores } = require('../scripts/lib/load_stores.js');
  const stores = loadStores();
  const gen = require('../gen-store-pages.js');
  const slugged = stores.map((s, i) => ({ store: s, slug: gen.toSlug(s) + '-' + i }));
  const byslug = new Map(slugged.map((x) => [x.slug, x.store]));
  const areaGenre = (s) => {
    const a = agp.normalizeArea(s['エリア'], policy), g = agp.normalizeGenre(s['ジャンル'], policy);
    return a && g ? a.slug + '::' + g.slug : null;
  };
  const inDeg = new Map();
  let total = 0, withFour = 0, empty = 0;
  const problems = [];
  for (const { store, slug } of slugged) {
    const r = rel.buildRelatedStores(store, slugged, slug);
    if (!r.items.length) empty++;
    if (r.items.length >= 4) withFour++;
    if (r.items.length > 6) problems.push(`${slug}: ${r.items.length}軒`);
    const seen = new Set();
    for (const it of r.items) {
      total++;
      inDeg.set(it.slug, (inDeg.get(it.slug) || 0) + 1);
      const c = byslug.get(it.slug);
      if (!c) { problems.push(`${slug}: 行き先 ${it.slug} がページ一覧に無い`); continue; }
      if (it.slug === slug || c === store) problems.push(`${slug}: 自分自身`);
      if (seen.has(it.slug)) problems.push(`${slug}: ${it.slug} が重複`);
      seen.add(it.slug);
      if (areaGenre(c) !== areaGenre(store)) problems.push(`${slug} → ${it.slug}: エリア群かジャンルが違う`);
      if (c['営業ステータス'] === 'CLOSED_TEMPORARILY' || c['営業ステータス'] === 'CLOSED_PERMANENTLY') problems.push(`${slug} → ${it.slug}: 閉店/休業`);
      if (c['店名'] === store['店名']) problems.push(`${slug} → ${it.slug}: 同じ店名`);
    }
  }
  assert.deepEqual(problems.slice(0, 5), []);
  const sorted = [...inDeg.values()].sort((a, b) => b - a);
  const top50 = sorted.slice(0, 50).reduce((a, b) => a + b, 0);
  // 実測（2026-10-12）: 最大18・上位50店 2.5%・4軒以上出る店 94.9%・出さない店 2.8%。しきい値は実測の数倍に置く
  assert.ok(sorted[0] <= 60, `最も多い店が ${sorted[0]} ページに出ている`);
  assert.ok(top50 / total < 0.1, `上位50店に ${(100 * top50 / total).toFixed(1)}%`);
  assert.ok(withFour / stores.length >= 0.9, `4軒以上出る店が ${(100 * withFour / stores.length).toFixed(1)}%`);
  assert.ok(empty / stores.length <= 0.06, `区画を出さない店が ${(100 * empty / stores.length).toFixed(1)}%`);
});

// ── 描画 ──

test('店舗ページ: 見出し・注記・店ごとの理由を出す。名前と理由は逃がし、軒が無ければ区画ごと出さない', () => {
  const gen = require('../gen-store-pages.js');
  const store = { '店名': 'テスト店', 'エリア': areaRaw(AREA), 'ジャンル': genreRaw(GENRE), 'ホットペッパーID': 'JTEST', '公開フラグ': '公開' };
  const html = gen.renderStorePage(store, 'jtest', {
    label: '似た条件のお店', note: 'この店と同じ栄の居酒屋のうち、予算が近い店を先に並べています。', basis: '同じ栄の居酒屋',
    items: [
      { name: '<b>&"店', slug: 'a', reasons: ['同じ栄駅', '予算が近い'] },
      { name: '理由なしの店', slug: 'b', reasons: [] },
    ],
  }, [], []);
  const block = /<div class="related-stores">[\s\S]*?<\/div>/.exec(html);
  assert.ok(block, '区画がある');
  assert.match(block[0], /<h2>似た条件のお店<\/h2>/);
  assert.match(block[0], /<p class="related-note">この店と同じ栄の居酒屋のうち、予算が近い店を先に並べています。<\/p>/);
  assert.match(block[0], /<li><a href="a\.html">&lt;b&gt;&amp;&quot;店<\/a><span class="related-reason">同じ栄駅・予算が近い<\/span><\/li>/);
  assert.match(block[0], /<li><a href="b\.html">理由なしの店<\/a><\/li>/);
  assert.doesNotMatch(block[0], /の他の店/);

  const none = gen.renderStorePage(store, 'jtest', { label: '', note: '', basis: '', items: [] }, [], []);
  assert.doesNotMatch(none, /class="related-stores"/);
  // CSS は文字を 13px 未満にしない（デザインシステム）
  assert.match(html, /\.related-stores \.related-reason\{font-size:var\(--fs-xs\)/);
  assert.match(html, /\.related-stores \.related-note\{font-size:var\(--fs-xs\)/);
});

test('gen-store-pages.js の buildRelatedStores は共有モジュールの1本（クイックビューと同じ判定に揃えられる）', () => {
  const gen = require('../gen-store-pages.js');
  assert.equal(gen.buildRelatedStores, rel.buildRelatedStores);
  const src = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
  assert.doesNotMatch(src, /function buildRelatedStores/, '選び方を gen-store-pages.js に書き戻さない');
});

// ── 判定の中身を、そのままブラウザに埋め込めること ──

function coreSource() {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'related_stores.js'), 'utf8');
  const m = /\/\/ NB-RELATED-CORE:START\n([\s\S]*?)\/\/ NB-RELATED-CORE:END/.exec(src);
  assert.ok(m, 'NB-RELATED-CORE の区画がある');
  return m[1];
}

test('判定の中身（NB-RELATED-CORE）は ES5・require 無し。単独で動かしても Node 側と同じ結果になる', () => {
  const core = coreSource();
  assert.doesNotMatch(core, /=>|\blet\b|\bconst\b|`|\brequire\b|\bmodule\b|\bexports\b|\bclass\b|\.\.\./, 'ES5 の範囲を超える書き方');
  const sandbox = {};
  vm.runInNewContext(core + '\nthis.api = { nbRelBuildIndex: nbRelBuildIndex, nbRelPick: nbRelPick, nbRelNote: nbRelNote, NB_REL_HEADING: NB_REL_HEADING, NB_REL_MAX: NB_REL_MAX };', sandbox);
  const api = sandbox.api;
  const ctx = rel.makeCtx(policy);

  const stores = Array.from({ length: 30 }, (_, i) => mk(i + 1, { '価格帯': ['3001～4000円', '2001～3000円', '4001～5000円'][i % 3], '最寄駅': ['栄', '伏見'][i % 2] }));
  const cellsB = api.nbRelBuildIndex(stores, ctx);
  const cellsN = rel.nbRelBuildIndex(stores, ctx);
  for (const me of stores) {
    const b = api.nbRelPick(me, cellsB, ctx, api.NB_REL_MAX);
    const n = rel.nbRelPick(me, cellsN, ctx, rel.NB_REL_MAX);
    // vm の別コンテキストで作られた配列は Array の実体が違うので、JSON にそろえて比べる
    assert.equal(JSON.stringify(b.items.map((i) => i.store['店名'])), JSON.stringify(n.items.map((i) => i.store['店名'])));
    assert.equal(JSON.stringify(b.items.map((i) => i.reasons)), JSON.stringify(n.items.map((i) => i.reasons)));
    assert.equal(api.nbRelNote(b), rel.nbRelNote(n));
  }
  assert.equal(api.NB_REL_HEADING, rel.NB_REL_HEADING);
});
