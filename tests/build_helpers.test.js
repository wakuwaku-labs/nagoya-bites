'use strict';

/**
 * build.js の純粋ヘルパー単体テスト。
 * - norm: NFKC 正規化
 * - escapeHtml: HTML エスケープ（XSS/壊れマークアップ防止）
 * - isNagoyaStore: 品質フィルタ（ISSUE-057 部分一致バグ再発防止）
 *
 * build.js が変更された日の夜間QAで走る。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractHelpers } = require('./helpers/build_extract.js');

const h = extractHelpers();

test('norm: 半角カナ/全角を NFKC 正規化する', () => {
  assert.equal(h.norm('ﾅｺﾞﾔ'), 'ナゴヤ');
  assert.equal(h.norm('１２３'), '123');
  assert.equal(h.norm(null), '');
  assert.equal(h.norm(undefined), '');
});

test('escapeHtml: 特殊文字を実体参照へ', () => {
  assert.equal(h.escapeHtml('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
  assert.equal(h.escapeHtml(''), '');
  // & を最初に変換するため二重エスケープしない
  assert.equal(h.escapeHtml('a & b'), 'a &amp; b');
});

test('isNagoyaStore: 名古屋確定アクセスは accept（POSITIVE-FIRST）', () => {
  const yes = [
    '名古屋駅から徒歩5分',
    '上前津駅から徒歩3分',   // 旧バグ: "津" で誤除外されていた
    '金山駅 徒歩2分',
    '栄駅から徒歩1分',
    '伏見駅すぐ',
    '国際センター駅 徒歩4分',
  ];
  for (const access of yes) {
    assert.equal(h.isNagoyaStore({ アクセス: access }), true, `accept されるべき: ${access}`);
  }
});

test('isNagoyaStore: 他都市確定アクセスは reject', () => {
  const no = [
    '天神駅から徒歩3分',      // 福岡
    '梅田駅から徒歩5分',      // 大阪
    '三宮駅 徒歩2分',         // 神戸
    '渋谷駅から徒歩10分',     // 東京
  ];
  for (const access of no) {
    assert.equal(h.isNagoyaStore({ アクセス: access }), false, `reject されるべき: ${access}`);
  }
});

test('isNagoyaStore: アクセス空でも例外を投げない', () => {
  assert.doesNotThrow(() => h.isNagoyaStore({}));
  assert.doesNotThrow(() => h.isNagoyaStore({ アクセス: '' }));
});
