'use strict';
/**
 * scripts/lib/phone_link.js — 電話のボタンを出してよい店の判定（I-36 / P-273）
 *
 * 背景: 電話番号はデータに持たない（Google Maps Platform の規約で保存できない）。ボタンを押したときに、
 * 店に紐付いた Google の店舗情報（placeId）から番号を取る。紐付けが別の店を指していると、別の店の番号に
 * かかる（例: 「かき氷 うと（栄マルエイガレリア店）」の紐付け先は「かき氷専門店 awayuki」・ISSUE-147）。
 * 以前は placeId のある店すべてにボタンを出していた（2026-10-12 の main で 4,677 店）。
 *
 * 決めたこと（計画 7.3 節「電話の紐付けの確かめ方」）:
 *   1. 紐付け先の Google の住所と、掲載の住所を compareJpAddress()（食べログのリンクの照合と同じ判定）で比べる。
 *      同じ場所なら出す。別の場所なら出さない。
 *   2. 住所で比べられない店（掲載の住所が無い・表記の違いで決められない）だけ、店名を namesMatch()
 *      （架空店の確認と同じ判定）で比べ、合うときだけ出す。店名だけで決めないのは、この判定が厳しく、住所が
 *      同じ店でも表記の違いで合わないことがあるため（例「cafe chikaku」と「チカク」）。
 *   3. ISSUE-147 で別の店と確かめて外した紐付け（places_resolved.json の rejected: true）は使わない。
 *   新しい基準は作らない。判定に使うのは、第三者が同じデータを見て検算できる事実だけ（制約10）。
 *
 * 結果は各店の「電話確認」の欄に、確かめた根拠（「住所」か「店名」）として持たせる。確かめられない店は欄なし。
 * placeId は消さない（重複店の統合 scripts/lib/store_dedup.js と予約の計測の store_id が使っている）。
 * build.js が重複統合の後に annotatePhoneLinks() を呼ぶ。トップ（index.html）と店舗ページ（gen-store-pages.js）は
 * この欄を見てボタンを出す。判定の再計算は scripts/audit_phone_links.js。
 */

const { compareJpAddress } = require('./store_link_identity');
const { namesMatch } = require('./store_name_match');
const { placesKey } = require('./places_key');

/** data/stores.json・LOCAL_STORES の各店に持たせる欄の名前 */
const FIELD = '電話確認';

/** 判定の理由（counts のキー）。ok が真になるのは address-same と address-unknown-name-ok だけ */
const REASONS = ['address-same', 'address-unknown-name-ok', 'address-different', 'address-unknown-name-ng', 'rejected', 'no-record', 'no-place-id'];

/**
 * data/places_resolved.json から placeId → { name, address } の索引を作る。
 * 同じ placeId が複数の店のキーに付いていること（チェーン店など）はあるので、取得が新しいものを使う
 * （同じ時刻なら先に出たもの）。rejected のキーは placeId を持たない（候補の名前と住所だけ）ので入らない。
 */
function buildPlaceIndex(places) {
  const index = new Map();
  for (const v of Object.values(places || {})) {
    if (!v || typeof v !== 'object' || !v.placeId || !v.name) continue;
    const prev = index.get(v.placeId);
    const at = String(v.fetchedAt || '');
    if (prev && prev.fetchedAt >= at) continue;
    index.set(v.placeId, { name: v.name, address: v.formatted_address || '', fetchedAt: at });
  }
  return index;
}

/**
 * 1店の判定。
 * @param {object} store  data/stores.json の1店（placeId・住所・店名・ホットペッパーID を読む）
 * @param {Map} index  buildPlaceIndex() の戻り値
 * @param {object} [places]  data/places_resolved.json（rejected の確認用。省略時は確認しない）
 * @returns {{ok:boolean, basis?:'住所'|'店名', reason:string}}
 */
function phoneLinkVerdict(store, index, places) {
  const placeId = store && store.placeId;
  if (!placeId) return { ok: false, reason: 'no-place-id' };
  if (places) {
    const own = places[placesKey(store)];
    if (own && own.rejected) return { ok: false, reason: 'rejected' };
  }
  const rec = index.get(placeId);
  if (!rec) return { ok: false, reason: 'no-record' };
  const ours = store['住所'];
  const verdict = (ours && rec.address) ? compareJpAddress(ours, rec.address).verdict : 'unknown';
  if (verdict === 'same') return { ok: true, basis: '住所', reason: 'address-same' };
  if (verdict === 'different') return { ok: false, reason: 'address-different' };
  return namesMatch(store['店名'], rec.name).ok
    ? { ok: true, basis: '店名', reason: 'address-unknown-name-ok' }
    : { ok: false, reason: 'address-unknown-name-ng' };
}

/**
 * 全店の「電話確認」の欄をそろえる（確かめられた店には根拠を入れ、そうでない店からは欄を外す）。冪等。
 * @param {Array<object>} stores  書き換える（build.js の stores）
 * @param {object} places  data/places_resolved.json
 * @returns {Record<string, number>} 理由ごとの店数
 */
function annotatePhoneLinks(stores, places) {
  const index = buildPlaceIndex(places);
  const counts = {};
  for (const r of REASONS) counts[r] = 0;
  for (const s of stores) {
    const v = phoneLinkVerdict(s, index, places);
    counts[v.reason] += 1;
    if (v.ok) s[FIELD] = v.basis;
    else delete s[FIELD];
  }
  return counts;
}

/** その店に電話のボタンを出してよいか（トップと店舗ページの生成・表示が共有する） */
function canShowCallButton(store) {
  return !!(store && store[FIELD]);
}

module.exports = { FIELD, REASONS, buildPlaceIndex, phoneLinkVerdict, annotatePhoneLinks, canShowCallButton };
