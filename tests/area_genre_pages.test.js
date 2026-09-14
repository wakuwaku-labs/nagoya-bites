'use strict';

/**
 * scripts/lib/area_genre_pages.js の単体テスト。
 * 条件13軸の述語（実データの文字列パターン）・決定性・エリア/ジャンル正規化・
 * 価格帯パースを検証する。stores/area/ の生成器自体（scripts/gen_area_genre_pages.js）は
 * 実データ規模の統合テストのため、ここではプランナー/述語のみをユニットテストする。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  loadPolicy, normalizeArea, normalizeGenre, storeMatchesCondition,
  parsePriceBand, planPages,
} = require('../scripts/lib/area_genre_pages.js');

test('loadPolicy: 閾値・エリア・ジャンル・条件がすべて定義されている', () => {
  const policy = loadPolicy();
  assert.equal(typeof policy.hubMinStores, 'number');
  assert.equal(typeof policy.conditionMinStores, 'number');
  assert.ok(policy.areas.length >= 5);
  assert.ok(policy.genres.length >= 5);
  assert.ok(policy.conditions.length >= 5);
});

test('normalizeArea / normalizeGenre: 既知の原文を正しいslugに解決する', () => {
  const policy = loadPolicy();
  assert.equal(normalizeArea('栄', policy).slug, 'sakae');
  assert.equal(normalizeArea('名古屋駅', policy).slug, 'meieki');
  assert.equal(normalizeArea('存在しないエリア', policy), null);
  assert.equal(normalizeGenre('居酒屋', policy).slug, 'izakaya');
  assert.equal(normalizeGenre('焼肉・ホルモン', policy).slug, 'yakiniku');
  assert.equal(normalizeGenre('存在しないジャンル', policy), null);
});

test('条件述語: 深夜営業（翌1時以降）は翌0時台を含まず翌1〜12時のみ true', () => {
  assert.equal(storeMatchesCondition({ '営業時間': '17:00～翌0:00' }, 'lateNight'), false);
  assert.equal(storeMatchesCondition({ '営業時間': '17:00～翌1:00' }, 'lateNight'), true);
  assert.equal(storeMatchesCondition({ '営業時間': '17:00～翌12:00' }, 'lateNight'), true);
  assert.equal(storeMatchesCondition({ '営業時間': '11:00～22:00' }, 'lateNight'), false);
  assert.equal(storeMatchesCondition({}, 'lateNight'), false);
});

test('条件述語: 日曜営業は「日」を含む定休日をfalse、年中無休/なし/無休をtrueにする', () => {
  assert.equal(storeMatchesCondition({ '定休日': '日' }, 'sunday'), false);
  assert.equal(storeMatchesCondition({ '定休日': '日、祝日' }, 'sunday'), false);
  assert.equal(storeMatchesCondition({ '定休日': '不定休' }, 'sunday'), false);
  assert.equal(storeMatchesCondition({ '定休日': 'なし' }, 'sunday'), true);
  assert.equal(storeMatchesCondition({ '定休日': '年中無休' }, 'sunday'), true);
  assert.equal(storeMatchesCondition({ '定休日': '無休' }, 'sunday'), true);
  assert.equal(storeMatchesCondition({ '定休日': '月、火' }, 'sunday'), true);
  assert.equal(storeMatchesCondition({ '定休日': '' }, 'sunday'), false);
});

test('条件述語: 個室/飲み放題/食べ放題/駐車場/ランチは「あり」始まりのみtrue', () => {
  assert.equal(storeMatchesCondition({ '個室': 'あり' }, 'koshitsu'), true);
  assert.equal(storeMatchesCondition({ '個室': 'あり ：応相談' }, 'koshitsu'), true);
  assert.equal(storeMatchesCondition({ '個室': 'なし' }, 'koshitsu'), false);
  assert.equal(storeMatchesCondition({}, 'koshitsu'), false);
});

test('条件述語: 禁煙区分（全面禁煙/禁煙席なし/一部禁煙/未確認）', () => {
  assert.equal(storeMatchesCondition({ '禁煙': '全面禁煙' }, 'nonSmoking'), true);
  assert.equal(storeMatchesCondition({ '禁煙': '禁煙席なし' }, 'nonSmoking'), false);
  assert.equal(storeMatchesCondition({ '禁煙': '禁煙席なし' }, 'smokingOk'), true);
  assert.equal(storeMatchesCondition({ '禁煙': '一部禁煙' }, 'smokingOk'), true);
  assert.equal(storeMatchesCondition({ '禁煙': '未確認' }, 'smokingOk'), false);
  assert.equal(storeMatchesCondition({ '禁煙': '未確認' }, 'nonSmoking'), false);
});

test('条件述語: 宴会収容30名以上', () => {
  assert.equal(storeMatchesCondition({ '宴会収容': '30' }, 'group30'), true);
  assert.equal(storeMatchesCondition({ '宴会収容': '29' }, 'group30'), false);
  assert.equal(storeMatchesCondition({ '宴会収容': 'なし' }, 'group30'), false);
});

test('条件述語: 駅徒歩3分以内はアクセス文字列の最初の「徒歩N分」だけを見る', () => {
  assert.equal(storeMatchesCondition({ 'アクセス': '栄駅から徒歩3分' }, 'walk3'), true);
  assert.equal(storeMatchesCondition({ 'アクセス': '栄駅から徒歩約2分' }, 'walk3'), true);
  assert.equal(storeMatchesCondition({ 'アクセス': '栄駅から徒歩4分' }, 'walk3'), false);
  assert.equal(storeMatchesCondition({ 'アクセス': '' }, 'walk3'), false);
});

test('parsePriceBand: 価格帯の上限/下限を取り出す（実データの全角チルダ表記）', () => {
  assert.deepEqual(parsePriceBand('2001～3000円'), { lo: 2001, hi: 3000 });
  assert.deepEqual(parsePriceBand('～500円'), { lo: null, hi: 500 });
  assert.deepEqual(parsePriceBand('30001円～'), { lo: 30001, hi: null });
  assert.deepEqual(parsePriceBand('10001円以上'), { lo: 10001, hi: null });
  assert.equal(parsePriceBand(''), null);
});

test('条件述語: 予算3,000円以下 / 5,001円以上', () => {
  assert.equal(storeMatchesCondition({ '価格帯': '2001～3000円' }, 'budget3000'), true);
  assert.equal(storeMatchesCondition({ '価格帯': '3001～4000円' }, 'budget3000'), false);
  assert.equal(storeMatchesCondition({ '価格帯': '5001～7000円' }, 'budget5000plus'), true);
  assert.equal(storeMatchesCondition({ '価格帯': '4001～5000円' }, 'budget5000plus'), false);
});

test('planPages: 実データに対して決定的（同一入力→同一出力）', () => {
  const policy = loadPolicy();
  const { loadStores } = require('../scripts/lib/load_stores.js');
  const stores = loadStores();
  const r1 = planPages(stores, policy);
  const r2 = planPages(stores, policy);
  assert.equal(r1.pages.length, r2.pages.length);
  const urls1 = r1.pages.map(p => p.url).sort();
  const urls2 = r2.pages.map(p => p.url).sort();
  assert.deepEqual(urls1, urls2);
});

test('planPages: 閾値未満のセルはページを作らない', () => {
  const policy = loadPolicy();
  const stores = [
    { '店名': 'A', 'エリア': '栄', 'ジャンル': '居酒屋', '営業ステータス': 'OPERATIONAL' },
    { '店名': 'B', 'エリア': '栄', 'ジャンル': 'ラーメン', '営業ステータス': 'OPERATIONAL' },
  ];
  const { pages } = planPages(stores, policy);
  // 栄×居酒屋・栄×ラーメンともに1店舗のみ（閾値10未満）なのでgenreページは作られない
  assert.equal(pages.filter(p => p.type === 'genre').length, 0);
  assert.equal(pages.filter(p => p.type === 'condition').length, 0);
});

test('planPages: 閉店（CLOSED_TEMPORARILY/CLOSED_PERMANENTLY）は対象外', () => {
  const policy = loadPolicy();
  const stores = Array.from({ length: 12 }, (_, i) => ({
    '店名': `店${i}`, 'エリア': '栄', 'ジャンル': '居酒屋',
    '営業ステータス': i < 11 ? 'CLOSED_TEMPORARILY' : 'OPERATIONAL',
  }));
  const { pages } = planPages(stores, policy);
  const genrePage = pages.find(p => p.type === 'genre');
  assert.equal(genrePage, undefined, '11/12件が休業中で開店中は1件のみ→閾値未満でページ無し');
});

test('生成済みページに font-size 床未満のリテラル・:root 再定義が無い（デザインシステム床チェックの簡易版）', () => {
  const areaDir = path.join(__dirname, '..', 'stores', 'area');
  if (!fs.existsSync(areaDir)) return; // 生成前の環境ではスキップ
  const DS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'design_system.json'), 'utf8'));
  const files = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.html')) files.push(p);
    }
  })(areaDir);
  assert.ok(files.length > 0, 'stores/area/ にページが無い（先に node scripts/gen_area_genre_pages.js を実行）');
  const sample = files.filter((_, i) => i % 40 === 0); // 全数だと重いので間引きサンプル
  for (const file of sample) {
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(!/:root\s*{[^}]*--bg\s*:/.test(html), `${file}: :root 再定義がある`);
    const blocks = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]);
    for (const css of blocks) {
      for (const [, raw] of css.matchAll(/font-size\s*:\s*([^;]+);/g)) {
        const r = raw.trim();
        if (r.startsWith('var(') || r.startsWith('clamp(')) continue;
        const remM = r.match(/^([\d.]+)rem$/);
        const pxM = r.match(/^([\d.]+)px$/);
        const px = remM ? parseFloat(remM[1]) * 16 : (pxM ? parseFloat(pxM[1]) : null);
        if (px !== null) assert.ok(px >= DS.floorPx, `${file}: font-size ${r} = ${px}px は床(${DS.floorPx}px)未満`);
      }
    }
  }
});

test('sitemap.xml: stores/area/ のURLが重複なく含まれる', () => {
  const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return;
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]*\/stores\/area\/[^<]*)<\/loc>/g)].map(m => m[1]);
  const unique = new Set(locs);
  assert.equal(locs.length, unique.size, 'stores/area/ のURLがsitemap内で重複している');
});
