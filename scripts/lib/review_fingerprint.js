'use strict';
// ────────────────────────────────────────────────────
// クロス店舗レビュー指紋照合（口コミ信頼度 S9・2026-08-21 新設）
// ────────────────────────────────────────────────────
// 目的: 「同一の口コミ文面」「同一の投稿者名」が、当サイトが持つ無関係な複数店舗に
// またがって出現していないかを検出する（複数アカウントの使い回し／
// テンプレート文面の代理投稿パターンに対応）。
//
// Google Maps Platform Service Specific Terms は「names, ratings, reviews, and
// phone numbers must be requested live rather than warehoused」と規定しており、
// レビュー本文・投稿者名そのものを保存することはできない
// （developers.google.com/maps/documentation/places/web-service/policies で確認済み）。
// そのため本文・氏名は scripts/fetch_places.js の取得直後にその場で正規化・ハッシュ化し、
// 生データは一切保存しない。保存するのは非可逆ハッシュ値（textHash/authorNameHash）
// だけで、これは「コンテンツ」ではなく機械検証用の指紋にとどまる。
//
// 保持期間: data/places_history.json の latestReviews は毎回の取得で「追記」ではなく
// 「上書き」されるため（fetch_places.js: history[id].latestReviews = latestReviews）、
// 各店が保持するのは常に直近の取得分のみ。ハッシュも自動的にこの範囲でしか残らない
// （無期限に蓄積し続けるわけではない）。
//
// 誤検知への配慮（レビュアーは実在の一般消費者であり、多くの一致は偶然の可能性がある）:
//   - 文面一致: 正規化後 20 文字以上のテキストのみ対象（短い定型文の偶然一致を除外）。
//     この長さのレビュー文が複数の無関係な店舗で一字一句一致するのは、偶然としては
//     極めて起こりにくい
//   - 投稿者名一致: ありふれた姓名の偶然一致がありうるため、文面一致より大幅に高い
//     閾値（★4.5以上・3店舗以上・180日以内）を要求する。Inspector 目視確認用の
//     弱いシグナルとして扱い、単独でスコアを大きく動かさない

const crypto = require('crypto');

const MIN_NORMALIZED_TEXT_LEN = 20;
const MIN_DISTINCT_STORES_FOR_REVIEWER = 3;
const REVIEWER_WINDOW_DAYS = 180;

function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\s+/g, '')
    .replace(/[!-/:-@[-`{-~！-／：-＠［-｀｛-～、。，．・「」『』（）　]/g, '')
    .toLowerCase();
}

function hashOf(input) {
  if (!input) return null;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 16);
}

// レビュー本文 → 指紋ハッシュ（短すぎるテキストは対象外＝null）
function textFingerprint(text) {
  const norm = normalizeText(text);
  if (norm.length < MIN_NORMALIZED_TEXT_LEN) return null;
  return hashOf(norm);
}

// 投稿者名 → 指紋ハッシュ
function authorFingerprint(authorName) {
  if (typeof authorName !== 'string') return null;
  const norm = authorName.trim().toLowerCase();
  if (!norm) return null;
  return hashOf(norm);
}

// data/places_history.json 全体を一括スキャンし、店舗横断のハッシュ→店舗集合インデックスを構築
function buildFingerprintIndex(placesHistory) {
  const textIndex = new Map();   // textHash -> Set<storeKey>
  const authorIndex = new Map(); // authorNameHash -> Array<{storeKey, rating, time}>

  for (const storeKey of Object.keys(placesHistory || {})) {
    const entry = placesHistory[storeKey];
    const reviews = (entry && Array.isArray(entry.latestReviews)) ? entry.latestReviews : [];
    for (const r of reviews) {
      if (r.textHash) {
        if (!textIndex.has(r.textHash)) textIndex.set(r.textHash, new Set());
        textIndex.get(r.textHash).add(storeKey);
      }
      if (r.authorNameHash) {
        if (!authorIndex.has(r.authorNameHash)) authorIndex.set(r.authorNameHash, []);
        authorIndex.get(r.authorNameHash).push({
          storeKey,
          rating: typeof r.rating === 'number' ? r.rating : null,
          time: typeof r.time === 'number' ? r.time : null
        });
      }
    }
  }
  return { textIndex, authorIndex };
}

// 1店舗分の指紋照合結果を返す（cross_check.js の S9 入力）
function evaluateStoreFingerprint(storeKey, historyEntry, index) {
  const reviews = (historyEntry && Array.isArray(historyEntry.latestReviews)) ? historyEntry.latestReviews : [];
  const withHash = reviews.filter(r => r.textHash || r.authorNameHash);
  if (!storeKey || withHash.length === 0 || !index) {
    return { observed: false, duplicateReviewAcrossStores: false, sameReviewerAcrossStores: false, reason: '指紋データなし（判定保留）' };
  }

  let duplicateReviewAcrossStores = false;
  for (const r of reviews) {
    if (!r.textHash) continue;
    const stores = index.textIndex.get(r.textHash);
    if (stores && stores.size >= 2) { duplicateReviewAcrossStores = true; break; }
  }

  let sameReviewerAcrossStores = false;
  for (const r of reviews) {
    if (!r.authorNameHash) continue;
    const occurrences = index.authorIndex.get(r.authorNameHash) || [];
    const highRated = occurrences.filter(o => typeof o.rating === 'number' && o.rating >= 4.5);
    const distinctStores = new Set(highRated.map(o => o.storeKey));
    if (distinctStores.size >= MIN_DISTINCT_STORES_FOR_REVIEWER) {
      const times = highRated.map(o => o.time).filter(t => typeof t === 'number');
      const withinWindow = times.length < 2 || (Math.max(...times) - Math.min(...times)) <= REVIEWER_WINDOW_DAYS * 86400;
      if (withinWindow) { sameReviewerAcrossStores = true; break; }
    }
  }

  const reasons = [];
  if (duplicateReviewAcrossStores) reasons.push('同一の口コミ文面を他店舗でも検出');
  if (sameReviewerAcrossStores) reasons.push(`同一投稿者名で高評価が${MIN_DISTINCT_STORES_FOR_REVIEWER}店舗以上（${REVIEWER_WINDOW_DAYS}日以内）`);
  if (reasons.length === 0) reasons.push('他店舗との一致なし');

  return {
    observed: true,
    duplicateReviewAcrossStores,
    sameReviewerAcrossStores,
    reason: reasons.join(' / ')
  };
}

module.exports = {
  normalizeText,
  hashOf,
  textFingerprint,
  authorFingerprint,
  buildFingerprintIndex,
  evaluateStoreFingerprint,
  MIN_NORMALIZED_TEXT_LEN,
  MIN_DISTINCT_STORES_FOR_REVIEWER,
  REVIEWER_WINDOW_DAYS
};
