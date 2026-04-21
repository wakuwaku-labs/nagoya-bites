'use strict';
/**
 * generate_page_names.js
 *
 * GA4 の pagePath → 人間が読める名前 の対応表を生成する。
 * 出力: page-names.json（リポジトリ直下）
 *
 * 用途: GAS の LINE レポートが pagePath（例 "/nagoya-bites/stores/J000XXX.html"）を
 * 受け取ったときに、店舗名や特集記事タイトルに置き換えて表示するためのマスター。
 *
 * 実行:
 *   node scripts/generate_page_names.js
 *
 * GitHub Pages 公開後、GAS からは以下のURLで取得できる：
 *   https://wakuwaku-labs.github.io/nagoya-bites/page-names.json
 */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const STORES_DIR  = path.join(ROOT, 'stores');
const FEATURES_DIR= path.join(ROOT, 'features');
const OUT_PATH    = path.join(ROOT, 'page-names.json');

const BASE = '/nagoya-bites';

const RE_TITLE = /<title>([^<]+?)<\/title>/;

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'");
}

function readTitle(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  const m = RE_TITLE.exec(data);
  return m ? decodeEntities(m[1]).trim() : '';
}

// 店舗ページの title 例: 「居酒屋 きくや（栄・居酒屋）| NAGOYA BITES」
// → 店名部分 + エリア を短く返す
function shortenStoreTitle(title) {
  const m = /^(.+?)（([^・）]+)・([^）]+)）\s*\|\s*NAGOYA BITES\s*$/.exec(title);
  if (m) {
    const name = m[1].trim();
    const area = m[2].trim();
    return `🍽 ${name}（${area}）`;
  }
  return `🍽 ${title.replace(/\s*\|\s*NAGOYA BITES\s*$/, '').trim()}`;
}

// 特集ページの title 例: 「名古屋 宴会・忘年会おすすめ居酒屋15選｜NAGOYA BITES」
// → 末尾の「｜NAGOYA BITES」を落として短く
function shortenFeatureTitle(title) {
  const clean = title.replace(/\s*[｜|]\s*NAGOYA BITES.*$/, '').trim();
  return `📰 ${clean}`;
}

// ================================================================
// メイン
// ================================================================
function main() {
  const map = {};

  // 静的ページ（トップ／About／FAQ／Contact／features/index）
  map[`${BASE}/`]                              = '🏠 トップページ';
  map[`${BASE}/index.html`]                    = '🏠 トップページ';
  map[`${BASE}/about.html`]                    = 'ℹ️ About';
  map[`${BASE}/faq.html`]                      = '❓ Q&A';
  map[`${BASE}/contact.html`]                  = '✉️ Contact';
  map[`${BASE}/features/`]                     = '📚 特集一覧';
  map[`${BASE}/features/index.html`]           = '📚 特集一覧';

  // 特集記事
  if (fs.existsSync(FEATURES_DIR)) {
    const files = fs.readdirSync(FEATURES_DIR)
      .filter(f => f.endsWith('.html') && f !== 'index.html')
      .sort();
    for (const f of files) {
      const title = readTitle(path.join(FEATURES_DIR, f));
      if (!title) continue;
      map[`${BASE}/features/${f}`] = shortenFeatureTitle(title);
    }
  }

  // 店舗ページ
  if (fs.existsSync(STORES_DIR)) {
    const files = fs.readdirSync(STORES_DIR)
      .filter(f => f.endsWith('.html') && f !== 'index.html')
      .sort();
    for (const f of files) {
      const title = readTitle(path.join(STORES_DIR, f));
      if (!title) continue;
      map[`${BASE}/stores/${f}`] = shortenStoreTitle(title);
    }
  }

  // ローカルプレビュー・誤検出マーカー（開発中に出るやつ）
  map['/']            = '🧪 ローカル / (開発時のプレビュー)';
  map['/index.html']  = '🧪 ローカル /index.html (開発時のプレビュー)';

  fs.writeFileSync(OUT_PATH, JSON.stringify(map, null, 2), 'utf8');
  const entries = Object.keys(map).length;
  console.log(`page-names.json を書き出し: ${entries} エントリ (${(fs.statSync(OUT_PATH).size/1024).toFixed(1)} KB)`);
}

main();
