'use strict';
/**
 * scripts/lib/photo_credit.js — 店舗ページのヒーロー写真に出す撮影者（クレジット）の判定と描画（I-11 / P-267）
 *
 * 背景: Google マップの写真（Places）を使う店は 151 店ある（2026-10-12）。トップのカードとクイックビューは
 * 利用者の投稿に撮影者を出していたが（index.html の nbPhotoCredit）、店舗ページの生成器は
 * `写真クレジット` を読んでおらず、同じ写真に撮影者が出なかった。data/photo_policy.json の
 * userPhotoRequiresCredit（利用者の写真は撮影者を表示面に出す）にも、Google の写真の帰属の決まり
 * （撮影者の表示がある写真は、写真の近くに出す）にも合わない。
 *
 * 判定は新しい基準を足さず、既存の判定器（scripts/lib/photo_policy.js）をそのまま使う:
 *   - 写真の出所 … 写真URLが Places 由来か（isPlacesPhotoUrl）。HotPepper の写真は店が媒体に出した素材なので出さない
 *   - 利用者かどうか … `写真出所: places-user` の記録、または記録が無くてもクレジットの名前が店名と合わない
 *     （isOwnerAttribution）。名前の照合は第三者が後から検算できる事実だけを使う（CLAUDE.md 制約10）
 * 撮影者の名前が読めないもの（文字化け）と、撮影者が分からないときの既定値（"Google Maps"）は出さない。
 * 読めない名前を出すと、帰属の表示としてかえって誤りになる。
 *
 * 生成器（gen-store-pages.js）と tests/photo_credit.test.js が共有する。ネットワーク不要・決定的。
 */

const { isPlacesPhotoUrl, isOwnerAttribution } = require('./photo_policy');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** データに残っている HTML の文字参照（&amp; &#39; など）を元の文字に戻す。1回だけ戻す（&amp;#39; は &#39; のまま） */
function decodeEntities(str) {
  return String(str == null ? '' : str).replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi, (m, dec, hex, name) => {
    if (name) return ENTITIES[name.toLowerCase()];
    const cp = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10FFFF ? String.fromCodePoint(cp) : m;
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const TITLES = {
  user: 'Google マップの利用者が投稿した写真です',
  owner: 'Google マップに掲載されている写真です',
};

/**
 * ヒーロー写真の撮影者。出さないときは null。
 * @param {object} store  data/stores.json の1店（写真クレジット・写真出所・店名・英語名）
 * @param {string} photoUrl  ヒーローに使う写真URL
 * @returns {null|{name:string, kind:'user'|'owner'}}
 */
function photoCreditOf(store, photoUrl) {
  if (!store || !isPlacesPhotoUrl(photoUrl)) return null;
  const name = decodeEntities(store['写真クレジット']).replace(/\s+/g, ' ').trim();
  if (!name) return null;
  if (name.includes('\uFFFD')) return null; // 文字化け（途中で切れた多バイト文字）
  if (name.toLowerCase() === 'google maps') return null; // 撮影者が分からないときに取得側が入れる既定値
  const origin = String(store['写真出所'] || '');
  let kind;
  if (origin === 'places-user') kind = 'user';
  else if (origin === 'places-owner') kind = 'owner';
  else kind = isOwnerAttribution(name, store['店名'], store['英語名']).owner ? 'owner' : 'user';
  return { name, kind };
}

/** 写真の右下に出す帯（出さないときは空文字）。トップの nbPhotoCredit と同じ書き方（📷 + 撮影者名） */
function renderPhotoCredit(store, photoUrl) {
  const c = photoCreditOf(store, photoUrl);
  if (!c) return '';
  return `<span class="photo-credit" title="${TITLES[c.kind]}">📷 ${escapeHtml(c.name)}</span>`;
}

/**
 * 帯の CSS。クレジットのあるページにだけ入れる（無いページは1バイトも変えない）。
 * 帰属の表示なので省略せず折り返す。文字は --fs-xs（13px）、暗い半透明の下地の上で白（4.5:1 以上）。
 */
const PHOTO_CREDIT_CSS = '.hero-wrap{position:relative;}\n'
  + '.photo-credit{position:absolute;right:12px;bottom:12px;z-index:1;max-width:calc(100% - 24px);padding:3px 8px;border-radius:3px;'
  + 'background:rgba(10,10,8,.62);color:rgba(255,255,255,.92);font-family:var(--font-body);font-size:var(--fs-xs);line-height:1.4;'
  + 'letter-spacing:.02em;overflow-wrap:anywhere;pointer-events:none;}\n';

module.exports = { photoCreditOf, renderPhotoCredit, decodeEntities, escapeHtml, PHOTO_CREDIT_CSS, TITLES };
