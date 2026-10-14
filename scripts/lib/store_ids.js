'use strict';

/**
 * scripts/lib/store_ids.js
 *
 * ホットペッパーIDの無い店（編集部の手動キュレーション店ほか・約150店）に載せる共有用の安定 ID。
 * 判断の記録: docs/decisions/0043-store-share-id.md（P-246・I-21c）
 *
 * - 形式は `E` + 英小文字と数字の 10 文字（例: E3fa91c2b7d）。ホットペッパーID（`J` + 数字）とも、
 *   凍結した古い店舗ページの `M` + 6 桁とも重ならない。
 * - 台帳（採番表）を持たず、店の持ち物から決定的に作る。台帳はビルドが複数のワークフロー（build.yml・
 *   daily-trending5.yml）から走るため、コミット漏れで番号が食い違う失敗点になる。
 *     1. Google の placeId があれば placeId（店名・並び順が変わっても変わらない）
 *     2. 無ければ 店名+エリア（scripts/lib/places_key.js と同じ join 条件）
 * - ホットペッパーIDのある店には付けない（そのIDが従来どおり共有リンクの ID）。
 * - フロント（index.html）は `ホットペッパーID || 店舗ID` を店の指定として使う（nbStoreKey）。
 */

const crypto = require('crypto');

function shareIdKey(store) {
  const place = store && store['placeId'];
  if (place) return 'place:' + place;
  return 'name:' + ((store && store['店名']) || '') + '|' + ((store && store['エリア']) || '');
}

function digest(key) {
  return 'E' + crypto.createHash('sha1').update(key, 'utf8').digest('hex').slice(0, 10);
}

function storeShareId(store) {
  if (!store || store['ホットペッパーID']) return '';
  if (!store['店名'] && !store['placeId']) return '';
  return digest(shareIdKey(store));
}

// stores の各店に 店舗ID を付ける（ホットペッパーIDのある店からは外す）。
// 同じキーの店が 2 件（同名・同エリア・placeId 無し）ある場合は、2 件目以降に連番を足して区別する。
function assignStoreShareIds(stores) {
  const seen = new Map();
  let assigned = 0;
  let collisions = 0;
  for (const s of stores) {
    let id = storeShareId(s);
    if (!id) { delete s['店舗ID']; continue; }
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    if (n > 1) {
      collisions++;
      id = digest(shareIdKey(s) + '#' + n);
    }
    s['店舗ID'] = id;
    assigned++;
  }
  return { assigned, collisions };
}

module.exports = { shareIdKey, storeShareId, assignStoreShareIds };
