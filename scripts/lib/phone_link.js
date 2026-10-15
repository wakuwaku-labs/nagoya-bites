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
 *   4. 1〜2 で出してよいとなった店も、紐付けの状態（scripts/lib/place_binding.js）が「不一致」か、
 *      data/place_binding_policy.json の phone で許していない「要確認」の帯なら出さない（MEO-004・2026-10-15
 *      オーナーの判断 2=A）。住所の比べ方は町名＋丁目までで、同じビル・同じ丁目の別の店も「同じ」と出るため
 *      （例: 「屋上酒場ホシノシタ」→「ヒノカミ 名駅店」）。止めたのは、店名の一致率 0.3 未満の帯と、
 *      同じ placeId を店名の合う別の掲載店が使っている店。ほかの帯は標本の確かめ（MEO-003）の後に見直す。
 *   判定に使うのは、第三者が同じデータを見て検算できる事実だけ（制約10）。
 *
 * 結果は各店の「電話確認」の欄に、確かめた根拠（「住所」か「店名」）として持たせる。確かめられない店は欄なし。
 * placeId は消さない（重複店の統合 scripts/lib/store_dedup.js と予約の計測の store_id が使っている）。
 * build.js が重複統合の後に annotatePhoneLinks() を呼ぶ。トップ（index.html）と店舗ページ（gen-store-pages.js）は
 * この欄を見てボタンを出す。判定の再計算は scripts/audit_phone_links.js。
 */

const { compareJpAddress } = require('./store_link_identity');
const { namesMatch } = require('./store_name_match');
const { placesKey } = require('./places_key');
const binding = require('./place_binding');

/** data/stores.json・LOCAL_STORES の各店に持たせる欄の名前 */
const FIELD = '電話確認';

/**
 * 判定の理由（counts のキー）。ok が真になるのは address-same と address-unknown-name-ok だけ。
 * binding-mismatch・binding-review・switched-off は、住所か店名では出してよいが、紐付けの状態で止めた店
 */
const REASONS = ['address-same', 'address-unknown-name-ok', 'address-different', 'address-unknown-name-ng', 'rejected', 'no-record', 'no-place-id',
  'binding-mismatch', 'binding-review', 'switched-off'];

/**
 * data/places_resolved.json から placeId → { name, address } の索引を作る。
 * 同じ placeId が複数の店のキーに付いていること（チェーン店など）はあるので、取得が新しいものを使う
 * （同じ時刻なら先に出たもの）。rejected のキーは placeId を持たない（候補の名前と住所だけ）ので入らない。
 * 本体は scripts/lib/place_binding.js（紐付けの状態と同じ索引を使う）。
 */
const buildPlaceIndex = binding.buildPlaceIndex;

/**
 * 1店の判定。
 * @param {object} store  data/stores.json の1店（placeId・住所・店名・ホットペッパーID を読む）
 * @param {Map} index  buildPlaceIndex() の戻り値
 * @param {object} [places]  data/places_resolved.json（rejected の確認用。省略時は確認しない）
 * @param {object} [ctx]  place_binding.buildContext() の戻り値。渡すと紐付けの状態でも止める（build.js と監査は必ず渡す）
 * @returns {{ok:boolean, basis?:'住所'|'店名', reason:string}}
 */
function phoneLinkVerdict(store, index, places, ctx) {
  const v = addressOrNameVerdict(store, index, places);
  if (!v.ok || !ctx) return v;
  const a = binding.allowedFor('phone', binding.bindingOf(store, ctx), ctx.policy);
  if (a.ok) return v;
  return { ok: false, reason: a.reason === 'switched-off' ? 'switched-off' : (a.reason === 'binding-review' ? 'binding-review' : 'binding-mismatch') };
}

/** 住所か店名で、紐付けが掲載の店と合うか（1〜3。紐付けの状態は見ない） */
function addressOrNameVerdict(store, index, places) {
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
 * @param {{reviewed?:object, policy?:object}} [opts]  省略時は data/places_binding_reviewed.json・data/place_binding_policy.json
 * @returns {Record<string, number>} 理由ごとの店数
 */
function annotatePhoneLinks(stores, places, opts) {
  const ctx = buildPhoneContext(stores, places, opts);
  const counts = {};
  for (const r of REASONS) counts[r] = 0;
  for (const s of stores) {
    const v = phoneLinkVerdict(s, ctx.index, places, ctx);
    counts[v.reason] += 1;
    if (v.ok) s[FIELD] = v.basis;
    else delete s[FIELD];
  }
  return counts;
}

/** build.js と scripts/audit_phone_links.js が同じ判定をするための索引（placeId の共有を見るので全店を渡す） */
function buildPhoneContext(stores, places, opts) {
  return binding.buildContext(stores, places, { ...(opts || {}), index: buildPlaceIndex(places) });
}

/** その店に電話のボタンを出してよいか（トップと店舗ページの生成・表示が共有する） */
function canShowCallButton(store) {
  return !!(store && store[FIELD]);
}

module.exports = { FIELD, REASONS, buildPlaceIndex, buildPhoneContext, phoneLinkVerdict, annotatePhoneLinks, canShowCallButton };
