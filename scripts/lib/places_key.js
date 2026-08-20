'use strict';

/**
 * scripts/lib/places_key.js
 *
 * data/places_resolved.json / data/places_history.json のキーを決める唯一の情報源。
 *
 * ── 背景（2026-08-20・ISSUE-104） ──────────────────────────
 * fetch_places.js は従来「ホットペッパーIDを持つ店」だけを取得対象にしていた。
 * このため data/manual_stores.json 由来の手動キュレーション店（編集部推薦・話題フラグの
 * 目玉店に集中）は一律で Google Places 解決の対象外となり、口コミ信頼度が恒久的に
 * 「判定材料不足」になっていた（実測: 編集部推薦133店のNA率100%）。
 *
 * ホットペッパーIDが無い店は「店名+エリア」を安定キーとして使う（build.js の
 * insider_reviews マージと同じ join 条件・唯一の代替一意キー）。実 HotPepper ID
 * （`J` + 数字）と衝突しないよう `manual:` 接頭辞を付ける。
 */

function placesKey(store) {
  const hpId = store && store['ホットペッパーID'];
  if (hpId) return hpId;
  const name = (store && store['店名']) || '';
  const area = (store && store['エリア']) || '';
  return `manual:${name}|${area}`;
}

module.exports = { placesKey };
