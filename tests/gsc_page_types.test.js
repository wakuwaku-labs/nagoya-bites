'use strict';

/**
 * scripts/fetch_gsc_metrics.js のページ種別集計（SEO-112）の単体テスト。
 * 認証なしで require できる純粋関数だけを検証する。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyPageType, summarizePageTypes, groupPageQueries } = require('../scripts/fetch_gsc_metrics.js');

const U = p => `https://nagoya-bites.com${p}`;

test('classifyPageType: パスの形だけでページ種別を決める', () => {
  assert.equal(classifyPageType(U('/')), 'home');
  assert.equal(classifyPageType(U('/index.html')), 'home');
  assert.equal(classifyPageType(U('/?area=sakae')), 'home');
  assert.equal(classifyPageType(U('/stores/area/meieki/index.html')), 'area_hub');
  assert.equal(classifyPageType(U('/stores/J004660861.html')), 'store');
  assert.equal(classifyPageType(U('/journal/2026-09-19-kiyosu-yabaton-boochan-house.html')), 'journal');
  assert.equal(classifyPageType(U('/features/nagoya-solo-dining.html')), 'feature');
  assert.equal(classifyPageType(U('/about.html')), 'other');
  assert.equal(classifyPageType('not a url'), 'other');
});

test('summarizePageTypes: 種別ごとに件数・表示・クリックを合算し、順位は表示回数で加重平均する', () => {
  const s = summarizePageTypes([
    { page: U('/stores/area/sakae/yakiniku.html'), clicks: 1, impressions: 10, position: 10 },
    { page: U('/stores/area/meieki/index.html'), clicks: 0, impressions: 30, position: 20 },
    { page: U('/stores/J1.html'), clicks: 2, impressions: 100, position: 8 },
  ]);
  assert.deepEqual(s.area_hub, { pages: 2, clicks: 1, impressions: 40, ctr: 0.025, position: 17.5 });
  assert.deepEqual(s.store, { pages: 1, clicks: 2, impressions: 100, ctr: 0.02, position: 8 });
  assert.equal(s.journal, undefined, '行の無い種別は出さない');
});

test('summarizePageTypes: 空入力でも落ちない', () => {
  assert.deepEqual(summarizePageTypes([]), {});
  assert.deepEqual(summarizePageTypes(undefined), {});
});

test('groupPageQueries: 既存の挙動（トップページは常に観測対象）を維持する', () => {
  const rows = [
    { keys: [U('/'), '名古屋 グルメ'], clicks: 1, impressions: 50, ctr: 0.02, position: 20 },
    { keys: [U('/stores/J9.html'), '店名'], clicks: 0, impressions: 5, ctr: 0, position: 30 },
  ];
  const out = groupPageQueries(rows, [{ page: U('/features/a.html') }]);
  assert.deepEqual(out.map(o => o.page), [U('/')]);
});
