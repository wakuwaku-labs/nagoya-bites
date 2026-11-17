'use strict';

/**
 * tests/stage5_ledger_display.test.js — 基本方針 段階5（S5-1 棚卸し台帳・S5-4 順位と段階の表示）
 *
 * 読むのは生成器の出力する文字列と、台帳・index.html のソースだけ。日次で作り直す stores/ の生成物は見ない
 * （build.yml は npm test を再生成より前に回すため）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ledgerLib = require(path.join(ROOT, 'scripts/build_article_review_ledger.js'));
const trust = require(path.join(ROOT, 'scripts/lib/trust_display.js'));
const hub = require(path.join(ROOT, 'scripts/gen_area_genre_pages.js'));
const rosters = require(path.join(ROOT, 'scripts/refresh_feature_rosters.js'));
const { buildTrustBreakdown } = require(path.join(ROOT, 'gen-store-pages.js'));

const P = trust.loadPolicy();
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n').filter((l) => !/^var LOCAL_STORES\b/.test(l)).join('\n');

// ── S5-1 台帳 ──
test('台帳: 公開中の特集・ジャーナルの全記事が台帳にある（欠けが 0）', () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/article_review_ledger.json'), 'utf8'));
  assert.deepStrictEqual(ledgerLib.missingFrom(ledger), [], 'node scripts/build_article_review_ledger.js で作り直す');
  assert.equal(ledger.totals.articles, ledger.articles.length);
  for (const a of ledger.articles) {
    assert.ok(a.path && a.kind && Array.isArray(a.problems), a.path);
    assert.ok(Number.isFinite(a.priority), a.path);
  }
});

test('台帳: 優先度の降順に並び、検索クリックの多い記事が上に来る', () => {
  const ledger = ledgerLib.build();
  for (let i = 1; i < ledger.articles.length; i++) assert.ok(ledger.articles[i - 1].priority >= ledger.articles[i].priority);
  const solo = ledger.articles.findIndex((a) => a.path === 'features/nagoya-solo-dining.html');
  assert.ok(solo >= 0 && solo < 3, '流入の最も多い特集は上位に来る');
});

test('台帳: 確認日は本文に書かれた日付だけを拾う', () => {
  assert.equal(ledgerLib.lastConfirmDate('公式サイトで2026年11月13日に確認できたものだけ', '2026'), '2026-11-13');
  assert.equal(ledgerLib.lastConfirmDate('（11月3日確認）', '2026'), '2026-11-03');
  assert.equal(ledgerLib.lastConfirmDate('更新日 2026年11月1日', '2026'), null);
});

// ── S5-4 一覧: 番号・評価順をやめる ──
test('一覧: 並びは最寄り駅からの徒歩分数で、Google評価・口コミ数に依らない（番号の表示も無い）', () => {
  const mk = (name, access, rating, n) => ({ 店名: name, アクセス: access, Google評価: rating, 口コミ数: n });
  const stores = [
    mk('高評価だが遠い', '名古屋駅から徒歩12分', '5.0', '900'),
    mk('評価なしだが近い', '名古屋駅から徒歩2分', '', ''),
    mk('徒歩の記載なし', '', '4.9', '500'),
    mk('普通', '名古屋駅から徒歩5分', '3.5', '40'),
  ];
  assert.deepEqual(hub.sortForDisplay(stores).map((s) => s['店名']), ['評価なしだが近い', '普通', '高評価だが遠い', '徒歩の記載なし']);
  const html = hub.storeCard(Object.assign({}, stores[0], { reviewTrust: { t: 'D', s: 40, d: '2026-11-07' } }), 0, 3, P, []);
  assert.ok(!/store-num/.test(html), '番号の要素が無い');
  assert.ok(!/ccs-tier[^>]*>(SS|A|B|C|D)</.test(html), '段階の記号を出さない');
  assert.match(html, /他の情報も確認を/, '言葉の助言で出す');
});

test('一覧: 星は件数と取得時点つきで残す（制約5）', () => {
  const html = hub.storeCard({ 店名: 'テスト店', アクセス: '名古屋駅から徒歩3分', Google評価: '4.5', 口コミ数: '652', reviewTrust: { t: 'B', s: 80, d: '2026-11-07' } }, 0, 3, P, []);
  assert.match(html, /Google★4\.5（652件・2026年11月時点）/);
});

// ── S5-4 特集 ──
test('特集: 店カードに番号が無く、表示順はエリア→店名（選定のスコアに依らない）', () => {
  const entry = { store: { ホットペッパーID: 'J000000001', 店名: 'テスト', エリア: '栄', ジャンル: '居酒屋', 'Google評価': '4.5', 口コミ数: '120', reviewTrust: { d: '2026-11-07' } } };
  for (const html of [rosters.renderStoreCard(entry, 1, 'banquet'), rosters.renderShopCard(entry, 1, 'banquet')]) {
    assert.ok(!/store-num|shop-num/.test(html));
  }
  const a = { score: 9, store: { エリア: '栄', 店名: 'ん' } };
  const b = { score: 1, store: { エリア: '栄', 店名: 'あ' } };
  const c = { score: 5, store: { エリア: '金山', 店名: 'い' } };
  const names = rosters.displayOrder([a, b, c]).map((e) => e.store['店名']);
  assert.ok(names.indexOf('あ') < names.indexOf('ん'), '同じエリア内は店名順（スコア 9 の店が先頭にならない）');
  assert.notDeepEqual(rosters.displayOrder([a, b, c]).map((e) => e.score), [9, 5, 1], 'スコア順にならない');
});

// ── S5-4 店舗ページ ──
test('店舗ページ: 内訳の見出しに段階の記号・点数・項目ごとの点数が出ない／出所と取得日が出る', () => {
  const cc = {};
  for (const chk of P.checks) {
    const node = { id: chk.part, score: 6, max: 10, reason: '理由', observed: true };
    if (chk.part) (cc[chk.axis] = cc[chk.axis] || { score: 0, max: 20, reason: '', observed: true, parts: [] }).parts.push(node);
    else cc[chk.axis] = node;
  }
  for (const m of P.meta || []) cc[m.axis] = cc[m.axis] || { score: 3, max: 10, reason: '補足', observed: true };
  const rt = { tier: 'A', score: 91, headline: 'Google★4.5（652件）は、確認できた範囲では、偏りは小さい状態です。', coverage: { observed: 9, total: 9 }, lastChecked: '2026-11-07' };
  const html = buildTrustBreakdown(cc, rt);
  assert.ok(html.includes('trust-breakdown'));
  assert.ok(!/ \/ 100/.test(html), '0〜100点を出さない');
  assert.ok(!/\d+\/\d+点/.test(html), '項目ごとの点数を出さない');
  assert.ok(!/class="trust-tier/.test(html), '段階の記号を出さない');
  assert.match(html, /出所: Googleマップの口コミ（2026-11-07取得）/);
});

test('店舗ページ: 生成器に点数の構造化データ・記号つきの題が残っていない', () => {
  const src = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
  assert.match(src, /TRUST_DISPLAY\.showScore && rt && typeof rt\.score === 'number'/);
  assert.match(src, /TRUST_DISPLAY\.showTierId \? `口コミ信頼度\$\{trustTier\}`/);
});

// ── 方針 JSON ──
test('方針: display が記号・点数・並べ替えを止め、全段階に言葉の助言（short）がある', () => {
  const d = trust.displayOf(P);
  assert.equal(d.showTierId, false);
  assert.equal(d.showScore, false);
  assert.equal(d.showCheckPoints, false);
  assert.equal(d.sortByTrust, false);
  for (const t of [...P.tiers, P.na]) assert.ok(trust.shortAdviceOf(t.id, P) && trust.shortAdviceOf(t.id, P) !== t.id);
  assert.equal(trust.publicPolicy(P).display.label, d.label);
});

// ── index.html ──
test('index.html: 口コミ信頼度順の並べ替えが無く、点数の要素も無い。星は件数と時点を添える', () => {
  assert.ok(!/value="cc-desc"/.test(INDEX) && !/case 'cc-desc'/.test(INDEX));
  assert.ok(!/id="m-cc-score"/.test(INDEX) && !/cc-score-suffix">/.test(INDEX));
  assert.match(INDEX, /function nbRatingNote\(r\)/);
  assert.match(INDEX, /nbTrustShows\(TRUST_POLICY\)/);
  // 評価の表示と絞り込みは残す（制約5）
  assert.match(INDEX, /class="card-rating"/);
});
