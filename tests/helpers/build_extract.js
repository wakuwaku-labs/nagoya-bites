'use strict';

/**
 * tests/helpers/build_extract.js
 *
 * build.js は末尾で main() を無条件実行する（require すると本番ビルドが走る）ため、
 * require せずに「純粋ヘルパーの宣言だけ」を vm sandbox へ切り出して評価する。
 * 既存の scripts/audit_isnagoya_filter.js と同じ思想の汎用版。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BUILD_JS = path.resolve(__dirname, '..', '..', 'build.js');

/** function 宣言を `function NAME(...) { ... }` の閉じ } まで切り出す */
function sliceFunction(src, name) {
  const start = src.indexOf(`function ${name}`);
  if (start === -1) throw new Error(`build.js に function ${name} が見つかりません`);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`function ${name} の終端 } が見つかりません`);
}

/** `const NAME = ...;` を、括弧の入れ子を考慮して終端 ; まで切り出す */
function sliceConst(src, name) {
  const start = src.indexOf(`const ${name}`);
  if (start === -1) throw new Error(`build.js に const ${name} が見つかりません`);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ';' && depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`const ${name} の終端 ; が見つかりません`);
}

/**
 * 指定した純粋ヘルパー群を抽出した sandbox を返す。
 * 依存順に連結して評価する。
 */
function extractHelpers() {
  const src = fs.readFileSync(BUILD_JS, 'utf8');
  const pieces = [
    // isNagoyaStore が参照するモジュールスコープ定数（依存順は問わない・宣言だけ）
    sliceConst(src, 'ACCESS_HARD_NEGATIVE'),
    sliceConst(src, 'PRICE_NOTES_NEGATIVE'),
    sliceConst(src, 'NAME_NEGATIVE_PATTERNS'),
    sliceConst(src, 'ACCESS_NAGOYA_POSITIVE'),
    sliceConst(src, 'NAGOYA_AREA_WORDS'),
    sliceConst(src, 'NAME_NAGOYA_PATTERNS'),
    sliceFunction(src, 'norm'),
    sliceFunction(src, 'escapeHtml'),
    sliceFunction(src, 'isNagoyaStore'),
    'this.norm = norm;',
    'this.escapeHtml = escapeHtml;',
    'this.isNagoyaStore = isNagoyaStore;',
  ].join('\n');

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(pieces, sandbox, { filename: 'build-helpers-extracted.js' });
  return sandbox;
}

module.exports = { extractHelpers, sliceFunction, sliceConst, BUILD_JS };
