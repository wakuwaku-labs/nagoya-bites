'use strict';

/**
 * 店舗ページへの静的な入口（項目13）: エリア×ジャンルの一覧に載らない店にも、エリアのページ（stores/area/）から
 * 店舗ページへのリンクが付くこと、同名の店のリンクが別の店のページを指さないことを、生成器を直接動かして確かめる。
 * 生成済みのページ（stores/area/）は CI が npm test の後に作り直すので、ここでは読まない。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const gen = require('../scripts/gen_area_genre_pages.js');
const { areaSlugsOf, openStores } = require('../scripts/lib/area_genre_pages.js');

const STORE_HREF_RE = /href="(?:\.\.\/)+stores\/([A-Za-z0-9_-]+)\.html"/g;
const slugsIn = (html) => new Set([...html.matchAll(STORE_HREF_RE)].map((m) => m[1]));

test('buildSlugMap: 同じスラグになる店には gen-store-pages.js と同じ順で -2・-3 を付ける', () => {
  const a = { '店名': 'Reminiscence' };
  const b = { '店名': 'reminiscence' };
  const c = { '店名': 'REMINISCENCE' };
  const hp = { '店名': 'ほげ', 'ホットペッパーID': 'J000000001' };
  const en = { '店名': 'ほげほげ', '英語名': 'Hoge Hoge Nagoya' };
  const none = { '店名': '' };
  const map = gen.buildSlugMap([a, hp, b, none, en, c]);
  assert.equal(map.get(a), 'reminiscence');
  assert.equal(map.get(b), 'reminiscence-2');
  assert.equal(map.get(c), 'reminiscence-3');
  assert.equal(map.get(hp), 'J000000001');
  assert.equal(map.get(en), 'hoge-hoge-nagoya', '英語名があれば店名の英数字より先に使う（gen-store-pages.js の toSlug と同じ）');
  assert.equal(map.has(none), false, '店名の無い店はページが作られない');
});

test('どのエリア群にも入る店は、エリアのハブかジャンルの一覧のどちらかから店舗ページへリンクされる', () => {
  const { policy, stores, pages, TRUST_POLICY } = gen.prepare();
  const slugMap = gen.buildSlugMap(stores);
  const linked = new Set();
  for (const p of pages) {
    if (p.type === 'condition') continue; // 条件ページは親のジャンルの一覧の部分集合
    for (const s of slugsIn(gen.renderHubPage(p, pages, policy, TRUST_POLICY, true))) linked.add(s);
  }
  const missing = openStores(stores)
    .filter((s) => areaSlugsOf(s, policy).length > 0)
    .filter((s) => !linked.has(slugMap.get(s)))
    .map((s) => s['店名']);
  assert.deepEqual(missing, [], '入口の無い店が残っている');
});

test('どのエリア群にも入らない店は、トップの入口（stores/area/index.html）から店舗ページへリンクされる', () => {
  const { policy, stores, pages, TRUST_POLICY } = gen.prepare();
  const slugMap = gen.buildSlugMap(stores);
  const root = pages.find((p) => p.type === 'root');
  const html = gen.renderHubPage(root, pages, policy, TRUST_POLICY, true);
  const linked = slugsIn(html);
  const ungrouped = openStores(stores).filter((s) => areaSlugsOf(s, policy).length === 0);
  for (const s of ungrouped) assert.ok(linked.has(slugMap.get(s)), `${s['店名']} へのリンクが入口に無い`);
  // 入口のリンクは深さ2（../../）で書く。../../../ だとサイトの外を指す
  assert.doesNotMatch(html, /href="\.\.\/\.\.\/\.\.\/stores\//);
});

test('ジャンル別の一覧がない店の区画: 閾値は下げず、一覧ページも増やさない（リンクだけ）', () => {
  const { policy, pages, TRUST_POLICY } = gen.prepare();
  assert.equal(policy.hubMinStores, 10, '一覧ページを作る下限を下げない（中身の薄いページを増やさない）');
  const areaPage = pages.find((p) => p.type === 'area' && p.area.slug === 'tsurumai-yagoto');
  const html = gen.renderHubPage(areaPage, pages, policy, TRUST_POLICY, true);
  assert.match(html, /class="hub-others"/);
  assert.match(html, /ジャンル別の一覧がない店/);
  assert.match(html, /<h2 class="nb-section-head"><span>ジャンル別の一覧がない店<\/span><\/h2>/);
});
