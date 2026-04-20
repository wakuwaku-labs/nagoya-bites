'use strict';
/**
 * scripts/merge_pending_stores.js
 *
 * data/pending_stores.json の pending[] を LOCAL_STORES フォーマットに整形して返すモジュール。
 * build.js が require して、CSV由来の stores 配列に追加する(永続的にマージ)。
 *
 * CLI 実行時は "どの店がマージされるか" のドライラン表示のみ。
 * 実際のマージは build.js のビルドパイプラインで毎回行う(pending_stores.json を
 * source of truth として扱う)。
 *
 * 使い方:
 *   node scripts/merge_pending_stores.js           # ドライラン表示
 *
 * マージ時の付与:
 *   - データソース="外部媒体"
 *   - 公開フラグ="TRUE"
 *   - 営業状況="営業中"(未設定時)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PENDING = path.join(ROOT, 'data', 'pending_stores.json');

function toLocalStoreShape(p) {
  const name = p['店名'] || '';
  const q = encodeURIComponent(name + ' 名古屋');
  return {
    '店名': name,
    '英語名': '',
    'ジャンル': p['ジャンル'] || '',
    'エリア': p['エリア'] || '',
    '都道府県': '愛知県',
    '価格帯': p['価格帯'] || '',
    '営業時間': '',
    'アクセス': p['アクセス'] || '',
    'ホットペッパーID': p.hotpepper_id || '',
    '写真URL': '',
    'Instagram': p.instagram_handle ? `https://www.instagram.com/${p.instagram_handle}/` : '',
    '食べログURL': '',
    'TikTok検索': `https://www.tiktok.com/search?q=${q}`,
    'X検索': `https://x.com/search?q=${q}`,
    'Instagram検索': `https://www.instagram.com/explore/search/keyword/?q=${q}`,
    '公開フラグ': 'TRUE',
    '備考': `外部媒体採用 (情報源: ${p['情報源'] || ''})`,
    'タグ': p['タグ'] || '',
    'Google評価': '',
    'Instagram投稿URL': '',
    'おすすめポイント': p['おすすめポイント'] || '',
    '内観写真URL': '',
    '料理写真URL1': '',
    '料理写真URL2': '',
    '口コミ数': '',
    'データソース': '外部媒体',
    '情報源URL': p['情報源'] || '',
    '追加日': p['追加日'] || new Date().toISOString().slice(0, 10),
    '営業状況': p['営業状況'] || '営業中'
  };
}

/**
 * build.js から require される。
 * 既存の stores 配列に pending_stores.json の内容をマージした配列を返す。
 * 店名重複はスキップ(既存側を優先)。
 */
function mergePendingStores(existingStores) {
  if (!fs.existsSync(PENDING)) return { merged: existingStores, addedCount: 0, skippedCount: 0 };
  const pending = JSON.parse(fs.readFileSync(PENDING, 'utf8'));
  const pendingList = pending.pending || [];
  if (pendingList.length === 0) return { merged: existingStores, addedCount: 0, skippedCount: 0 };

  const existingNames = new Set(existingStores.map(s => (s['店名'] || '').trim()));
  const result = existingStores.slice();
  let added = 0, skipped = 0;
  pendingList.forEach(p => {
    if (!p['店名']) return;
    if (existingNames.has(p['店名'])) { skipped++; return; }
    result.push(toLocalStoreShape(p));
    existingNames.add(p['店名']);
    added++;
  });
  return { merged: result, addedCount: added, skippedCount: skipped };
}

function main() {
  const pending = fs.existsSync(PENDING) ? JSON.parse(fs.readFileSync(PENDING, 'utf8')) : { pending: [] };
  console.log(`pending_stores.json: ${pending.pending.length}件登録`);
  pending.pending.forEach(p => {
    console.log(`  - ${p['店名']} (${p['エリア']}) 情報源: ${p['情報源']}`);
  });
  console.log('\nビルド時に build.js がこれらを LOCAL_STORES にマージします (pending_stores.json が source of truth)');
}

if (require.main === module) main();
module.exports = { toLocalStoreShape, mergePendingStores };
