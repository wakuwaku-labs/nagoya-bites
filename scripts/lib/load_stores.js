'use strict';

/**
 * scripts/lib/load_stores.js
 *
 * ISSUE-015-P2 第二段: 店舗データの読込元を index.html → data/stores.json に
 * 段階的に張り替えるための共有ヘルパー。
 *
 * 読み込み優先順:
 *   1. data/stores.json（build.js が書き出す canonical 形式・将来は唯一の真値）
 *   2. index.html `var LOCAL_STORES = [...]`（互換用フォールバック）
 *
 * 第二段の最終形では index.html は TOP50 のみインライン化されるため、
 * 全件読込が必要なスクリプトは必ず本ヘルパー経由にすること。
 */

const fs = require('fs');
const path = require('path');

// repo root = scripts/lib の 2 つ上
const ROOT = path.resolve(__dirname, '..', '..');
const STORES_JSON = path.join(ROOT, 'data', 'stores.json');
const INDEX_HTML = path.join(ROOT, 'index.html');

/**
 * 全店舗データを返す。
 * @returns {Array<object>} スリム化済みストア配列
 */
function loadStores() {
  // 優先: data/stores.json（canonical post-build artifact）
  if (fs.existsSync(STORES_JSON)) {
    try {
      const arr = JSON.parse(fs.readFileSync(STORES_JSON, 'utf8'));
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch (e) {
      // 壊れていれば下のフォールバックへ
    }
  }
  // フォールバック: index.html の LOCAL_STORES をパース（legacy 互換）
  if (!fs.existsSync(INDEX_HTML)) {
    throw new Error('load_stores: data/stores.json も index.html も見つかりません');
  }
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('load_stores: LOCAL_STORES が index.html に見つかりません');
  return JSON.parse(m[1]);
}

module.exports = { loadStores, STORES_JSON, INDEX_HTML };
