'use strict';

/**
 * 店舗↔特集の逆引き判定（scripts/lib/feature_store_match.js）の単体テスト（SEO-106）。
 *
 * この判定器が守るもの: audit_feature_stores.js（実在不明の検出）と build.js
 * （店舗カードへの「掲載特集」ラベル付与）が同じ判定を共有すること。片方だけ
 * 緩めると「ラベルは出るが監査は不一致のまま」のようなズレが生まれる。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildResolver, shortLabel } = require('../scripts/lib/feature_store_match.js');

test('buildResolver: 完全一致は解決できる', () => {
  const stores = [{ 店名: '矢場とん 本店' }, { 店名: 'コメダ珈琲店 本山店' }];
  const { resolve } = buildResolver(stores);
  assert.equal(resolve('矢場とん 本店'), stores[0]);
});

test('buildResolver: 全角半角・空白の差を吸収する', () => {
  const stores = [{ 店名: '錦3丁目 だるま' }];
  const { resolve } = buildResolver(stores);
  assert.equal(resolve('錦３丁目　だるま'), stores[0]);
});

test('buildResolver: 内包一致（業態接尾辞の有無）で解決できる', () => {
  const stores = [{ 店名: '呼炉凪来 ころなぎらい 大曽根駅前店' }];
  const { resolve } = buildResolver(stores);
  // 特集側が支店表記だけ短い・業態語が前後に付く典型パターン
  assert.equal(resolve('呼炉凪来 ころなぎらい 大曽根駅前'), stores[0]);
});

test('buildResolver: 識別力トークンを2つ以上共有すれば解決できる（表記差の吸収）', () => {
  const stores = [{ 店名: '呼炉凪来 ころなぎらい 大曽根駅前店' }];
  const { resolve } = buildResolver(stores);
  assert.equal(resolve('炉端とおでん 呼炉凪来 ころなぎらい 大曽根店'), stores[0]);
});

test('buildResolver: 実在しない店名は null（取り繕わない）', () => {
  const stores = [{ 店名: '矢場とん 本店' }, { 店名: 'コメダ珈琲店 本山店' }];
  const { resolve } = buildResolver(stores);
  assert.equal(resolve('架空の店 テスト'), null);
});

test('buildResolver: 業態語1語だけの被りでは解決しない（架空店検出力の維持）', () => {
  const stores = [{ 店名: '個室居酒屋 和の宴' }];
  const { resolve } = buildResolver(stores);
  // 「個室居酒屋」は GENERIC_STORE_TOKENS で除外される汎用業態語のため、
  // 識別力トークンが無く別店（架空店）と誤認してはならない
  assert.equal(resolve('個室居酒屋 秋月'), null);
});

test('shortLabel: 「｜」区切りの前半だけを短いラベルとして使う', () => {
  assert.equal(
    shortLabel('名古屋 一人飲み完全ガイド 2026｜カウンター名店から立ち飲みまで業界人が厳選10店｜NAGOYA BITES'),
    '名古屋 一人飲み完全ガイド 2026'
  );
});

test('shortLabel: 区切りが無ければそのまま返す', () => {
  assert.equal(shortLabel('名古屋 秋グルメ10選'), '名古屋 秋グルメ10選');
});
