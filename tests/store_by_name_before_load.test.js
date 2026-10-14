'use strict';
/**
 * P-440: 全店データ（ALL_STORES）の到着前に写真の onerror が nbStoreByName を呼んでも例外を出さない。
 * 静的に出した話題店の写真が先に失敗すると、索引が null のまま null[店名] を引いていた。
 * index.html の固定部分の関数だけを取り出して vm で検査する（生成済みの区画は読まない）。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/var NB_STORE_INDEX = null, NB_STORE_INDEX_SRC = null;\nfunction nbStoreByName\(n\)\{[\s\S]*?\n\}\n/);
assert.ok(m, 'nbStoreByName が index.html に見つからない');

function sandbox(extra) {
  const ctx = vm.createContext(Object.assign({}, extra));
  vm.runInContext(m[0], ctx);
  return ctx;
}

test('ALL_STORES が未宣言でも null を返し例外を出さない', () => {
  const ctx = sandbox();
  assert.equal(vm.runInContext('nbStoreByName("鮨")', ctx), null);
});

test('ALL_STORES が空配列でも例外を出さない', () => {
  const ctx = sandbox({ ALL_STORES: [] });
  assert.equal(vm.runInContext('nbStoreByName("鮨")', ctx), null);
});

test('到着前に呼んだあと、到着したら店を引ける（索引を作り直す）', () => {
  const ctx = sandbox();
  assert.equal(vm.runInContext('nbStoreByName("鮨")', ctx), null);
  vm.runInContext('var ALL_STORES=[{"店名":"鮨"}]', ctx);
  assert.equal(vm.runInContext('nbStoreByName("鮨")["店名"]', ctx), '鮨');
  vm.runInContext('ALL_STORES=[{"店名":"天"}]', ctx);
  assert.equal(vm.runInContext('nbStoreByName("鮨")', ctx), null);
  assert.equal(vm.runInContext('nbStoreByName("天")["店名"]', ctx), '天');
});
