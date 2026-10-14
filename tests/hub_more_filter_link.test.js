'use strict';

/**
 * ハブの「もっと絞る（全店検索）」リンク（P-429）。
 * そのハブの群（area=）と、条件ページなら条件（cond=）のまま、トップの絞り込みを開く。
 * 旧 ward= は区全体に広がり、ハブの件数と食い違っていた。
 * 生成器を直接呼んで検査する（生成済みページは CI の再生成より前の npm test では古い）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const hubs = require('../scripts/gen_area_genre_pages.js');

const ctx = hubs.prepare();
const moreHref = (html) => {
  const m = html.match(/<a class="related-link" href="([^"]*index\.html#[^"]*)">もっと絞る（全店検索）<\/a>/);
  return m ? m[1] : null;
};

test('ジャンルのハブ: 群のスラッグを area= で渡し、区全体の ward= は使わない', () => {
  const page = ctx.pages.find((p) => p.type === 'genre' && p.area.slug === 'sakae');
  assert.ok(page, '栄のジャンルページがある');
  const href = moreHref(hubs.renderHubPage(page, ctx.pages, ctx.policy, ctx.TRUST_POLICY));
  assert.ok(href, 'もっと絞るのリンクがある');
  assert.match(href, /#genre=[^&]+&area=sakae$/);
  assert.doesNotMatch(href, /ward=/);
});

test('条件のハブ: 群に加えて条件を cond= で渡す', () => {
  const page = ctx.pages.find((p) => p.type === 'condition' && p.area.slug === 'sakae' && p.cond.slug === 'koshitsu');
  assert.ok(page, '栄×個室ありの条件ページがある');
  const href = moreHref(hubs.renderHubPage(page, ctx.pages, ctx.policy, ctx.TRUST_POLICY));
  assert.match(href, /&area=sakae&cond=koshitsu$/);
});

test('すべてのハブ: リンクの群と条件が、ポリシーに実在するスラッグである', () => {
  const areaSlugs = new Set(ctx.policy.areas.map((a) => a.slug));
  const condSlugs = new Set(ctx.policy.conditions.map((c) => c.slug));
  for (const page of ctx.pages.filter((p) => p.type !== 'area').slice(0, 400)) {
    const href = moreHref(hubs.renderHubPage(page, ctx.pages, ctx.policy, ctx.TRUST_POLICY));
    if (!href) continue;
    const p = new URLSearchParams(href.split('#')[1]);
    assert.ok(areaSlugs.has(p.get('area')), `${page.url}: area=${p.get('area')}`);
    if (p.get('cond')) assert.ok(condSlugs.has(p.get('cond')), `${page.url}: cond=${p.get('cond')}`);
  }
});
