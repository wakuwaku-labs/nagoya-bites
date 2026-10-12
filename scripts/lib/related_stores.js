'use strict';
/**
 * scripts/lib/related_stores.js
 *
 * 「似た店」の選び方の唯一の情報源（I-16・docs/uiux-overhaul-plan-2026-10.md 7.4 節）。
 *
 * 店舗ページ（gen-store-pages.js の buildRelatedStores）と、トップのクイックビュー（index.html のモーダル）が
 * 同じ判定を使えるように、判定の中身（NB-RELATED-CORE の区画）は ES5・require 無しの純粋な関数だけで書く。
 * 区画の外（このファイルの下半分）は Node 側の道具（ポリシーの読み込み・店舗ページのスラグへの対応づけ）。
 *
 * クイックビューへの埋め込み（I-16b）: 区画の中身とエリア・ジャンルの対応表（ポリシーの match）を index.html の
 * `NB-RELATED-EMBED` に書き写す。直接直さず `node scripts/lib/related_stores.js --apply index.html` を実行する
 * （`--check` はずれがあれば exit 1。tests/modal_related.test.js も同じ検査をする）。
 *
 * 選び方（理由を1行で言える店だけを出す。回遊を増やすためだけの関係の薄いおすすめはしない）:
 *   前提: 同じエリア群・同じジャンル（scripts/lib/area_genre_pages.js のハブと同じ判定。新しい基準は作らない）
 *   1段目: 予算帯が同じか隣（HotPepper の価格帯の段）  → 「予算が近い」
 *   2段目: それ以外（予算帯が遠い・どちらかが不明）
 *   同じ段の中: 最寄り駅が同じ → 予算帯の近さ → 2店の ID のハッシュ順
 *   最大6軒。足りなければその数だけ出し、0軒なら出さない（関係の薄い店で埋めない）。
 *
 * 評価の高い順にはしない: 評価順だとどのページからも同じ人気店を指す（旧実装: 上位50店に 42.9%・最大 423 ページ）。
 * 同順位を「店の ID 順」にすると ID の小さい店に集まる（実測: 上位50店 14.0%・最大 165）。2店の ID の組を
 * ハッシュして並べると、ページごとに違う店が選ばれて集まりが消える（実測: 上位50店 2.5%・最大 18。上限は要らない）。
 * ハッシュは決定的なので、同じデータからは同じ結果になる（乱数ではない）。
 *
 * 計画の7.4節の3段目（隣のエリア群）と4段目（同じ条件）は入れていない:
 *   3段目の「隣」は area_genre_pages_policy.json に定義が無く、手で決めると確かめられない新しい基準になる。
 *   4段目は条件13軸の半分近くが店の4割以上に当たり（日曜営業 43%・全席禁煙 55% など）、理由として弱い。
 *   足りない店（同じエリア群・ジャンルの店が6軒に満たない）は、その数だけ出す。
 */

// NB-RELATED-CORE:START
var NB_REL_MAX = 6;
// HotPepper の価格帯（「2001～3000円」など13区分）の上限の値。上限がこれより大きい区分ほど高い段になる
var NB_REL_BUDGET_EDGES = [500, 1000, 1500, 2000, 3000, 4000, 5000, 7000, 10000, 15000, 20000, 30000];

// 価格帯の文字列 → 段（0〜12）。読めなければ null。area_genre_pages.js の parsePriceBand と同じ読み方
function nbRelBudgetRank(price) {
  if (typeof price !== 'string' || !price) return null;
  var nums = price.match(/\d[\d,]*/g);
  if (!nums || nums.length === 0) return null;
  var vals = [];
  for (var i = 0; i < nums.length; i++) vals.push(parseInt(nums[i].replace(/,/g, ''), 10));
  var hi;
  if (vals.length === 1 && (/^[～〜]/.test(price) || /以下/.test(price))) hi = vals[0];
  else if (vals.length === 1 && (/[～〜]$/.test(price) || /以上/.test(price))) hi = null;
  else hi = vals[vals.length - 1];
  if (hi === null) return NB_REL_BUDGET_EDGES.length;
  var k = 0;
  while (k < NB_REL_BUDGET_EDGES.length && hi > NB_REL_BUDGET_EDGES[k]) k++;
  return k;
}

// FNV-1a（32bit）。乱数ではなく文字列から決まる値なので、同じデータからは同じ順になる
function nbRelHash(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// ctx = { areaOf(store) → {slug,label}|null, genreOf(store) → {slug,label}|null }
function nbRelKey(store) {
  return store['ホットペッパーID'] || ('N:' + (store['店名'] || ''));
}

function nbRelIsOpen(store) {
  var st = store['営業ステータス'];
  return st !== 'CLOSED_TEMPORARILY' && st !== 'CLOSED_PERMANENTLY';
}

function nbRelFeatures(store, ctx) {
  return {
    store: store,
    area: ctx.areaOf(store),
    genre: ctx.genreOf(store),
    rank: nbRelBudgetRank(store['価格帯']),
    station: store['最寄駅'] || '',
    key: nbRelKey(store),
    name: store['店名'] || ''
  };
}

// 候補の索引（エリア群×ジャンルごと）。閉店・一時休業の店と、エリア群かジャンルが決まらない店は入れない
function nbRelBuildIndex(stores, ctx) {
  var cells = {};
  for (var i = 0; i < stores.length; i++) {
    var s = stores[i];
    if (!s || !s['店名'] || !nbRelIsOpen(s)) continue;
    var f = nbRelFeatures(s, ctx);
    if (!f.area || !f.genre) continue;
    f.pos = i; // 入力の並びの中の位置（クイックビューは ALL_STORES の番号で店を開く）
    var k = f.area.slug + '::' + f.genre.slug;
    if (!cells[k]) cells[k] = [];
    cells[k].push(f);
  }
  return cells;
}

function nbRelBasis(area, genre) {
  return '同じ' + area.label + 'の' + genre.label;
}

function nbRelStationLabel(station) {
  return /駅$/.test(station) ? station : station + '駅';
}

// store に似た店を最大 max 軒選ぶ。選べなければ null。
// 戻り値: { area, genre, basis, items: [{ store, tier, sameStation, reasons[] }] }
function nbRelPick(store, cells, ctx, max) {
  var me = nbRelFeatures(store, ctx);
  if (!me.area || !me.genre) return null;
  var pool = cells[me.area.slug + '::' + me.genre.slug];
  if (!pool) return null;
  var cand = [];
  for (var i = 0; i < pool.length; i++) {
    var c = pool[i];
    if (c.store === store || c.key === me.key || c.name === me.name) continue;
    var dist = (me.rank !== null && c.rank !== null) ? Math.abs(me.rank - c.rank) : 99;
    cand.push({
      c: c,
      tier: dist <= 1 ? 1 : 2,
      st: (me.station && c.station === me.station) ? 0 : 1,
      dist: dist,
      h: nbRelHash(me.key + '|' + c.key)
    });
  }
  cand.sort(function (a, b) {
    return (a.tier - b.tier) || (a.st - b.st) || (a.dist - b.dist) || (a.h - b.h) ||
      (a.c.key < b.c.key ? -1 : a.c.key > b.c.key ? 1 : 0);
  });
  var items = [];
  for (var j = 0; j < cand.length && items.length < (max || NB_REL_MAX); j++) {
    var x = cand[j], reasons = [];
    if (x.st === 0) reasons.push('同じ' + nbRelStationLabel(me.station));
    if (x.tier === 1) reasons.push('予算が近い');
    items.push({ store: x.c.store, pos: x.c.pos, tier: x.tier, sameStation: x.st === 0, reasons: reasons });
  }
  if (!items.length) return null;
  return { area: me.area, genre: me.genre, basis: nbRelBasis(me.area, me.genre), items: items };
}

// 区画の見出しと注記（店舗ページとクイックビューで同じ文言にする）
var NB_REL_HEADING = '似た条件のお店';
function nbRelNote(pick) {
  var anyClose = false;
  for (var i = 0; i < pick.items.length; i++) if (pick.items[i].tier === 1) anyClose = true;
  return 'この店と' + pick.basis + (anyClose ? 'のうち、予算が近い店を先に並べています。' : 'です。');
}
// NB-RELATED-CORE:END

// ================================================================
// Node 側
// ================================================================
const agp = require('./area_genre_pages');

let _policy = null;
function policyOf() {
  if (!_policy) _policy = agp.loadPolicy();
  return _policy;
}

function makeCtx(policy) {
  const p = policy || policyOf();
  return {
    areaOf: (s) => agp.normalizeArea(s['エリア'], p),
    genreOf: (s) => agp.normalizeGenre(s['ジャンル'], p),
  };
}

// slugged（gen-store-pages.js の [{store, slug}]）ごとの索引を使い回す（1店ごとに作り直すと 5,000 × 5,000 になる）
const _cache = new WeakMap();
function indexFor(slugged, ctx) {
  let c = _cache.get(slugged);
  if (!c || c.ctx !== ctx) {
    const slugOf = new Map();
    for (const x of slugged) slugOf.set(x.store, x.slug);
    c = { ctx, slugOf, cells: nbRelBuildIndex(slugged.map((x) => x.store), ctx) };
    _cache.set(slugged, c);
  }
  return c;
}

/**
 * 店舗ページ用。gen-store-pages.js の buildRelatedStores と同じ形で返す。
 * @returns {{label:string, note:string, basis:string, items:Array<{name:string, slug:string, reasons:string[]}>}}
 */
function buildRelatedStores(store, slugged, ownSlug, policy) {
  const ctx = policy ? makeCtx(policy) : (_defaultCtx || (_defaultCtx = makeCtx()));
  const idx = indexFor(slugged, ctx);
  const pick = nbRelPick(store, idx.cells, ctx, NB_REL_MAX);
  if (!pick) return { label: '', note: '', basis: '', items: [] };
  const items = [];
  for (const it of pick.items) {
    const slug = idx.slugOf.get(it.store);
    if (!slug || slug === ownSlug) continue;
    items.push({ name: it.store['店名'] || '', slug, reasons: it.reasons });
  }
  return { label: NB_REL_HEADING, note: nbRelNote(pick), basis: pick.basis, items };
}
let _defaultCtx = null;

// ================================================================
// index.html（クイックビュー）への埋め込み
// ================================================================
const fs = require('fs');

const CORE_START = '// NB-RELATED-CORE:START';
const CORE_END = '// NB-RELATED-CORE:END';
const EMBED_START = '// NB-RELATED-EMBED:START';
const EMBED_END = '// NB-RELATED-EMBED:END';
const EMBED_ANCHOR = '// NB-MODAL-FEATURES:START'; // 初めて書くときは、この印の手前に入れる

function coreSource() {
  const src = fs.readFileSync(__filename, 'utf8');
  const a = src.indexOf(CORE_START);
  const b = src.indexOf(CORE_END);
  if (a < 0 || b < a) throw new Error('NB-RELATED-CORE の区画が見つからない');
  return src.slice(a, b + CORE_END.length);
}

// ポリシーの match（原文 → 群）を、クイックビューの areaOf / genreOf が引く表にする（normalizeArea / normalizeGenre と同じ: 後に書いた方が勝つ）
function tablesOf(policy) {
  const table = (entries) => {
    const t = {};
    for (const e of entries) for (const raw of e.match || []) t[raw] = [e.slug, e.label];
    return t;
  };
  return { areas: table(policy.areas), genres: table(policy.genres) };
}

function renderEmbed(policy) {
  const p = policy || policyOf();
  return [
    EMBED_START + '（scripts/lib/related_stores.js が書く。ここを直接直さない: node scripts/lib/related_stores.js --apply index.html）',
    coreSource(),
    'var NB_REL_TABLES = ' + JSON.stringify(tablesOf(p)) + ';',
    EMBED_END,
  ].join('\n');
}

const EMBED_RE = /\/\/ NB-RELATED-EMBED:START[\s\S]*?\/\/ NB-RELATED-EMBED:END/;

/** html の埋め込みを今の内容にそろえる。印が無ければ NB-MODAL-FEATURES の手前に入れる。 */
function applyToHtml(html, policy) {
  const block = renderEmbed(policy);
  if (EMBED_RE.test(html)) return html.replace(EMBED_RE, () => block);
  const i = html.indexOf(EMBED_ANCHOR);
  if (i < 0) throw new Error('埋め込み先（NB-MODAL-FEATURES の印）が見つからない');
  return html.slice(0, i) + block + '\n' + html.slice(i);
}

module.exports = {
  NB_REL_MAX,
  NB_REL_HEADING,
  nbRelBudgetRank,
  nbRelHash,
  nbRelKey,
  nbRelIsOpen,
  nbRelBuildIndex,
  nbRelPick,
  nbRelNote,
  nbRelBasis,
  makeCtx,
  buildRelatedStores,
  coreSource,
  tablesOf,
  renderEmbed,
  applyToHtml,
  EMBED_RE,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const files = args.filter((a) => !a.startsWith('--'));
  if ((!check && !args.includes('--apply')) || !files.length) {
    console.error('使い方: node scripts/lib/related_stores.js --apply|--check <html...>');
    process.exit(2);
  }
  let stale = 0;
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const next = applyToHtml(html);
    if (next === html) { console.log('変更なし: ' + f); continue; }
    if (check) { console.log('要更新: ' + f); stale++; continue; }
    fs.writeFileSync(f, next);
    console.log('更新: ' + f);
  }
  process.exit(stale ? 1 : 0);
}
