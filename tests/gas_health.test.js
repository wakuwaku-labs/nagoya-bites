'use strict';

/**
 * GAS（LINE/メールレポート配信）のコンパイル健全性テスト。
 *
 * CLAUDE.md の警告:
 *   「GASは単一ファイル Code.js で運用。重複ファイル（"Code 2.js"等）混入は
 *    top-level二重宣言でコンパイル全体が落ちる → レポート不送信になるので厳禁。」
 *
 * デプロイ経路: deploy-gas.sh が `Google分析オートLINE送信.js` を .gas-deploy/Code.js に
 * コピーして clasp push する。よって「デプロイされる実体」= 単一ファイルの中身を検査する。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const GAS_SRC = path.join(ROOT, 'Google分析オートLINE送信.js');
const GAS_DEPLOY_DIR = path.join(ROOT, '.gas-deploy');

/** トップレベル（行頭・インデント無し）の宣言名を集める */
function topLevelDeclarations(src) {
  const fns = [];
  const vars = [];
  for (const line of src.split('\n')) {
    let m;
    if ((m = /^function\s+([A-Za-z0-9_$]+)\s*\(/.exec(line))) fns.push(m[1]);
    else if ((m = /^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/.exec(line))) vars.push(m[1]);
  }
  return { fns, vars };
}

function firstDuplicate(names) {
  const seen = new Set();
  for (const n of names) {
    if (seen.has(n)) return n;
    seen.add(n);
  }
  return null;
}

test('GAS: デプロイ元ファイルが存在する', () => {
  assert.ok(fs.existsSync(GAS_SRC), `${GAS_SRC} が見つかりません`);
});

test('GAS: トップレベル function 名が重複しない（二重宣言でコンパイル全落ち防止）', () => {
  const src = fs.readFileSync(GAS_SRC, 'utf8');
  const { fns } = topLevelDeclarations(src);
  const dup = firstDuplicate(fns);
  assert.equal(dup, null, `function "${dup}" がトップレベルで重複宣言されています`);
});

test('GAS: トップレベル const/let/var 名が重複しない', () => {
  const src = fs.readFileSync(GAS_SRC, 'utf8');
  const { vars } = topLevelDeclarations(src);
  const dup = firstDuplicate(vars);
  assert.equal(dup, null, `変数 "${dup}" がトップレベルで重複宣言されています`);
});

test('GAS: .gas-deploy に Code.js 以外の .js（"Code 2.js"等）が無い', () => {
  if (!fs.existsSync(GAS_DEPLOY_DIR)) return; // 未セットアップ環境ではスキップ
  const stray = fs.readdirSync(GAS_DEPLOY_DIR)
    .filter(f => f.endsWith('.js') && f !== 'Code.js');
  assert.deepEqual(stray, [], `clasp push 対象に余計な .js があります: ${stray.join(', ')}`);
});

test('GAS: 配信エントリポイント関数が存在する（レポート送信の生存確認）', () => {
  const src = fs.readFileSync(GAS_SRC, 'utf8');
  const { fns } = topLevelDeclarations(src);
  // 日次/週次レポートのトリガ関数が消えていないか（リファクタ事故の検知）
  assert.ok(fns.length >= 5, `トップレベル関数が少なすぎる (${fns.length}) — リファクタ事故の疑い`);
});
