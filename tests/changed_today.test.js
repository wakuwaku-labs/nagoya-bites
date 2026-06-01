'use strict';

/**
 * changed_today.categorize() の単体テスト。
 * 「その日に追加されたシステム」のカテゴリ分類が壊れると夜間QAの
 * スコープ判定が狂うため、分類ロジックを固定する。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { categorize } = require('../scripts/lib/changed_today.js');

test('categorize: 各カテゴリへ正しく振り分ける', () => {
  const c = categorize([
    'journal/2026-06-02-foo.html',
    'features/nagoya-ramen.html',
    'build.js',
    'gen-store-pages.js',
    'Google分析オートLINE送信.js',
    '.gas-deploy/Code.js',
    'scripts/seo_triage.js',
    'data/manual_stores.json',
    'data/stores.json',
    'README.md',
  ]);
  assert.deepEqual(c.journalHtml, ['journal/2026-06-02-foo.html']);
  assert.deepEqual(c.featureHtml, ['features/nagoya-ramen.html']);
  assert.deepEqual(c.buildCore.sort(), ['build.js', 'gen-store-pages.js']);
  assert.deepEqual(c.gas.sort(), ['.gas-deploy/Code.js', 'Google分析オートLINE送信.js']);
  assert.deepEqual(c.scripts, ['scripts/seo_triage.js']);
  assert.deepEqual(c.dataManual, ['data/manual_stores.json']);
  assert.deepEqual(c.dataStores, ['data/stores.json']);
  assert.deepEqual(c.other, ['README.md']);
});

test('categorize: Finder 複製 "foo 2.js" は other へ落とす（QA対象外）', () => {
  const c = categorize(['scripts/inject_ga 2.js', 'nagoya-yakitori-guide 2.html']);
  assert.equal(c.scripts.length, 0);
  assert.equal(c.featureHtml.length, 0);
  assert.deepEqual(c.other.sort(), ['nagoya-yakitori-guide 2.html', 'scripts/inject_ga 2.js']);
});

test('categorize: node_modules 配下の js は scripts に含めない', () => {
  const c = categorize(['node_modules/foo/index.js']);
  assert.equal(c.scripts.length, 0);
  assert.deepEqual(c.other, ['node_modules/foo/index.js']);
});

test('categorize: 空入力で全カテゴリ空配列', () => {
  const c = categorize([]);
  for (const k of Object.keys(c)) assert.deepEqual(c[k], [], `${k} は空であるべき`);
});
