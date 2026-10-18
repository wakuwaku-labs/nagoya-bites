/**
 * 話題店（pending / 外部媒体由来）に欠けていた「住所」を、
 * Google Places のキャッシュ（data/places_resolved.json）から補う唯一の実装。
 *
 * 背景（2026-10-19・オーナー報告「話題店を開いた時の情報が少なすぎる」）:
 *   pending_stores.json 由来の店は toLocalStoreShape() が住所・営業時間・リンクを持たず、
 *   話題店 107 店のうち住所があるのは 16 店だけだった。店舗ページには地図ボタンしか出なかった。
 *
 * 判定は検証できる事実だけ（制約10）:
 *   - 紐付けが掲載の店と合うと確かめられた店（電話確認 または 地図確認）にだけ使う。
 *     不一致・要確認の店の住所は書かない（別の店の住所を載せない）。
 *   - ホットペッパーID は付けない（スラグ＝URL と計測がこの欄で決まるため）。
 *   - すでに値がある欄は上書きしない。
 */
'use strict';

function cleanAddress(a) {
  return String(a || '')
    .replace(/^日本、?\s*/, '')
    .replace(/^〒?\s*\d{3}-?\d{4}\s*/, '')
    .trim();
}

function backfillStoreDetails(stores, places) {
  const keysByPlaceId = new Map();
  for (const [k, v] of Object.entries(places || {})) {
    if (!v || !v.placeId) continue;
    if (!keysByPlaceId.has(v.placeId)) keysByPlaceId.set(v.placeId, []);
    keysByPlaceId.get(v.placeId).push(k);
  }
    const counts = { address: 0, skipped: 0 };
  for (const s of stores) {
    if (!s.placeId) continue;
    if (!(s['電話確認'] || s['地図確認'])) { counts.skipped++; continue; }
    const keys = keysByPlaceId.get(s.placeId) || [];
    if (!s['住所']) {
      for (const k of keys) {
        const addr = cleanAddress(places[k].formatted_address);
        if (/愛知県/.test(addr)) { s['住所'] = addr; counts.address++; break; }
      }
    }
    // ホットペッパーID は付けない: 店舗ページのスラグ（URL）と予約導線の計測がこの欄で決まり、付けると既存のURLが変わるため。
  }
  return counts;
}

module.exports = { backfillStoreDetails, cleanAddress };
