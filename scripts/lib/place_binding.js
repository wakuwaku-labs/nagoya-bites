'use strict';
/**
 * scripts/lib/place_binding.js — 店と Google の店舗情報の紐付けの状態（MEO-003 / MEO-004）
 *
 * 背景: 電話のボタン・Google の評価・口コミ信頼度は、店に紐付いた Google の店舗情報（placeId）を使う。
 * 以前の電話の判定（scripts/lib/phone_link.js）は、住所が町名＋丁目まで同じなら店名を見なかったため、
 * 同じビルの別の店や、同じ丁目の別の店の番号にかかる店があった（例: 「屋上酒場ホシノシタ」→
 * 「炭火焼き 居酒屋 ヒノカミ 名駅店」・計画書 docs/meo-plan-2026-10.md の 1.2〜1.4 節）。
 *
 * 状態（計画書 6.1 節）:
 *   confirmed（確認済み）… 店名が合う（namesMatch を通り、支店名の食い違いが無い）。または人が「同じ店」と記録した
 *   review（要確認）   … 店名が合わないが、住所は違わない。帯（店名の一致率）ごとに扱いを決める
 *   mismatch（不一致）  … 住所が別の場所／同じ placeId を店名の合う別の掲載店が使っている／人が「外す」と記録した
 *   none            … 紐付けが無い（placeId なし・記録なし）
 * 判定に使うのは、第三者が同じデータを見て検算できる事実だけ（制約10）: 掲載の店名と住所（data/stores.json）、
 * Google 側の名前と住所（data/places_resolved.json）、人の確認の記録（data/places_binding_reviewed.json）。
 * 外部へは問い合わせない。どの状態でどの機能を出すかは data/place_binding_policy.json で決める。
 */

const fs = require('fs');
const path = require('path');
const { namesMatch, branchConflict } = require('./store_name_match');
const { compareJpAddress } = require('./store_link_identity');
const { placesKey } = require('./places_key');

const ROOT = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'data', 'place_binding_policy.json');
const REVIEWED_PATH = path.join(ROOT, 'data', 'places_binding_reviewed.json');

const STATES = ['confirmed', 'review', 'mismatch', 'none'];
const BANDS = ['sim-0', 'sim-lt-0.3', 'sim-0.3-0.6', 'sim-ge-0.6', 'branch-conflict'];

/** 店名の一致率の帯（scripts/audit_places_binding.js と同じ分け方） */
function bandOf(r) {
  if (r.branchConflict) return 'branch-conflict';
  if (r.sim === 0) return 'sim-0';
  if (r.sim < 0.3) return 'sim-lt-0.3';
  if (r.sim < 0.6) return 'sim-0.3-0.6';
  return 'sim-ge-0.6';
}

function readJsonOr(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return fallback; }
}

function loadPolicy(p) { return readJsonOr(p || POLICY_PATH, { features: {} }); }
function loadReviewed(p) { return readJsonOr(p || REVIEWED_PATH, { entries: [] }); }

/**
 * placeId → { name, address, fetchedAt } の索引。同じ placeId が複数のキーにあるときは取得が新しいもの
 * （同じ時刻なら先に出たもの）。scripts/lib/phone_link.js の buildPlaceIndex と同じ規則。
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
 * 判定に要る索引をまとめる。stores は判定する店の全体（placeId の共有を見るため、1店だけでは決められない）。
 * @param {Array<object>} stores
 * @param {object} places  data/places_resolved.json
 * @param {{reviewed?:object, policy?:object, index?:Map}} [opts]  省略時は data/ から読む
 */
function buildContext(stores, places, opts) {
  const o = opts || {};
  const index = o.index || buildPlaceIndex(places);
  const byPlace = new Map();
  for (const s of stores || []) {
    if (!s || !s.placeId) continue;
    if (!byPlace.has(s.placeId)) byPlace.set(s.placeId, []);
    byPlace.get(s.placeId).push(s);
  }
  const reviewed = o.reviewed || loadReviewed();
  const reviewedBy = new Map(((reviewed && reviewed.entries) || []).map((e) => [e.key + '\u0000' + e.googleName, e]));
  return { places: places || {}, index, byPlace, reviewedBy, policy: o.policy || loadPolicy() };
}

/**
 * 1店の紐付けの状態。
 * @returns {{state:string, reason:string, band?:string, sim?:number, googleName?:string, addressVerdict?:string}}
 */
function bindingOf(store, ctx) {
  const placeId = store && store.placeId;
  const own = ctx.places[placesKey(store)];
  // placeId が消えた後も places_resolved.json の rejected 記録は残るため、placeId の有無より先に確認する
  if (own && own.rejected) return { state: 'mismatch', reason: 'rejected' };
  if (!placeId) return { state: 'none', reason: 'no-place-id' };
  const rec = ctx.index.get(placeId);
  if (!rec) return { state: 'none', reason: 'no-record' };

  const name = store['店名'] || '';
  const nm = namesMatch(name, rec.name);
  const bc = !!branchConflict(name, rec.name);
  const base = { sim: nm.sim, googleName: rec.name, band: bandOf({ sim: nm.sim, branchConflict: bc }) };

  const rv = ctx.reviewedBy.get(placesKey(store) + '\u0000' + rec.name);
  if (rv && rv.decision === 'reject') return { ...base, state: 'mismatch', reason: 'reviewed-reject' };
  if (rv && rv.decision === 'keep') return { ...base, state: 'confirmed', reason: 'reviewed-keep' };

  // Google 側の住所が標準の形（〒が付く）でないものは比べない（並びが逆の住所が別の場所と出るため・audit_places_binding.js と同じ）
  const ours = store['住所'];
  const addr = (ours && rec.address && /〒\d{3}-\d{4}/.test(rec.address)) ? compareJpAddress(ours, rec.address).verdict : 'unknown';
  base.addressVerdict = addr;
  if (addr === 'different') return { ...base, state: 'mismatch', reason: 'address-different' };

  if (!nm.ok) {
    const others = (ctx.byPlace.get(placeId) || []).filter((o) => o !== store && namesMatch(o['店名'] || '', rec.name).ok);
    if (others.length) return { ...base, state: 'mismatch', reason: 'place-owned-by-other' };
  }
  if (nm.ok && !bc) return { ...base, state: 'confirmed', reason: 'name-match' };
  return { ...base, state: 'review', reason: 'name-not-match' };
}

/**
 * その機能にこの紐付けを使ってよいか（data/place_binding_policy.json の features[feature]）。
 * 機能の設定が無いときは、不一致だけを止める（設定の書き忘れで全店が消えないように）。
 * @returns {{ok:boolean, reason:string}}
 */
function allowedFor(feature, binding, policy) {
  const f = (policy && policy.features && policy.features[feature]) || null;
  if (f && f.show === false) return { ok: false, reason: 'switched-off' };
  if (binding.state === 'none') return { ok: false, reason: binding.reason };
  if (binding.state === 'mismatch') return { ok: false, reason: 'binding-mismatch' };
  if (binding.state === 'review') {
    if (!f) return { ok: true, reason: 'review-no-policy' };
    const bands = Array.isArray(f.allowReviewBands) ? f.allowReviewBands : [];
    return bands.includes(binding.band) ? { ok: true, reason: 'review-allowed' } : { ok: false, reason: 'binding-review' };
  }
  return { ok: true, reason: 'confirmed' };
}

/**
 * build.js の関門と同じ決め方で、その機能を出してよいか（評価・口コミ信頼度は、紐付けの無い店を止めない）。
 * applyRatingGate と、出している店を数え直す監査（scripts/audit_places_binding.js --states --check）が同じ判定を使う。
 * 電話と地図リンクの place_id は allowedFor と同じ（紐付けの無い店には使わない）。
 * @returns {{ok:boolean, reason:string}}
 */
function gateFor(feature, binding, policy) {
  const r = allowedFor(feature, binding, policy);
  if ((feature === 'rating' || feature === 'trust') && binding.state === 'none' && r.reason !== 'switched-off') return { ok: true, reason: 'no-binding' };
  return r;
}

/**
 * Google の評価・口コミ数・口コミ信頼度を出してよいかを店ごとに決め、出さない店の評価と口コミ数を消す
 * （MEO-003・オーナーの判断 3=A・2026-10-15・判断の記録 0046）。
 * 不一致の店と、policy の rating が許していない要確認の帯の店は、評価と口コミ数を消す（別の店の数字の可能性がある）。
 * 口コミ信頼度は、評価を消した店と、policy の trust が許していない店に付けない（呼び出し側が trustBlocked を見る）。
 * 紐付けの無い店（状態 none）は触らない（評価に Google の紐付け以外の出どころがある）。スイッチ（show=false）は全店に効く。
 * @param {Array<object>} stores  書き換える（Google評価・口コミ数を消す）
 * @param {object} places  data/places_resolved.json
 * @param {{reviewed?:object, policy?:object, keyOf?:function}} [opts]
 * @returns {{ratingBlocked:Set<string>, trustBlocked:Set<string>, counts:{rating:object, trust:object}}}
 *   ratingBlocked / trustBlocked は placesKey の集合。counts は止めた理由ごとの店の数（評価は、評価を持っていた店だけ数える）
 */
function applyRatingGate(stores, places, opts) {
  const o = opts || {};
  const ctx = buildContext(stores, places, o);
  const keyOf = o.keyOf || placesKey;
  const ratingBlocked = new Set();
  const trustBlocked = new Set();
  const counts = { rating: {}, trust: {} };
  const bump = (m, k) => { m[k] = (m[k] || 0) + 1; };
  const decide = (feature, b) => gateFor(feature, b, ctx.policy);
  for (const s of stores || []) {
    if (!s || !s['店名']) continue;
    const b = bindingOf(s, ctx);
    const key = keyOf(s);
    const rating = decide('rating', b);
    if (!rating.ok) {
      if (s['Google評価'] || s['口コミ数']) bump(counts.rating, rating.reason);
      delete s['Google評価'];
      delete s['口コミ数'];
      ratingBlocked.add(key);
    }
    const trust = decide('trust', b);
    if (!rating.ok || !trust.ok) {
      trustBlocked.add(key);
      bump(counts.trust, trust.ok ? rating.reason : trust.reason);
    }
  }
  return { ratingBlocked, trustBlocked, counts };
}

module.exports = {
  STATES, BANDS, POLICY_PATH, REVIEWED_PATH,
  bandOf, loadPolicy, loadReviewed, buildPlaceIndex, buildContext, bindingOf, allowedFor, gateFor, applyRatingGate,
};
