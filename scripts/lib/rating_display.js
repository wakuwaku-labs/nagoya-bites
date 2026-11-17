'use strict';
/**
 * scripts/lib/rating_display.js — Google の星の表示を「評価・件数・時点」の1つの形に揃える（S2-3・基本方針の段階2）
 *
 * 形: 「Google★4.5（652件・2026年11月時点）」。30件未満は「（12件・2026年11月時点・件数が少ない）」。
 * 件数か時点のどちらかが取れない店は星を出さない（件数も時点も無い星は「12件の満点」を人気店と読ませる・半年前の数字を
 * 今の評判と読ませる失敗になる）。時点は data/stores.json の reviewTrust.d（口コミ信頼度を算出した日＝その時に見ていた評価の日）。
 * 通信しない。
 */

const FEW_REVIEWS = 30;

function toNum(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 'YYYY-MM-DD' → '2026年11月'。形式が違えば '' */
function monthText(d) {
  const m = /^(\d{4})-(\d{2})/.exec(String(d || ''));
  return m ? `${m[1]}年${parseInt(m[2], 10)}月` : '';
}

/** 'YYYY-MM-DD' → '2026年11月17日'。形式が違えば '' */
function dateText(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${m[1]}年${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日` : '';
}

/**
 * @param {{rating:*, count:*, date:string}} p
 * @returns {string} 出せなければ ''
 */
function formatRating(p) {
  const rating = toNum(p && p.rating);
  const count = parseInt(String((p && p.count) == null ? '' : p.count).replace(/[^0-9]/g, ''), 10);
  const when = monthText(p && p.date);
  if (rating === null || !Number.isFinite(count) || count <= 0 || !when) return '';
  const few = count < FEW_REVIEWS ? '・件数が少ない' : '';
  return `Google★${rating.toFixed(1)}（${count.toLocaleString('ja-JP')}件・${when}時点${few}）`;
}

/** data/stores.json の1店から */
function formatStoreRating(store) {
  const s = store || {};
  return formatRating({ rating: s['Google評価'], count: s['口コミ数'], date: s.reviewTrust && s.reviewTrust.d });
}

/** 件数も時点も無い星の書き方か（「★ 4.8」「★4.8」だけ）。統一形（Google★…件…時点）は false */
function isBareStar(text) {
  const t = String(text || '').trim();
  return /^[★☆]\s*\d(\.\d+)?$/.test(t);
}

module.exports = { FEW_REVIEWS, formatRating, formatStoreRating, isBareStar, monthText, dateText };
