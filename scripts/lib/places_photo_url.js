'use strict';
/**
 * Google Places の写真 URL かどうかの判定と、「書いた後に取り直さない面」へ書く前の除去（P-29・ADR 0046）。
 *
 * Places の photo name は期限切れになりうる・キャッシュ不可（Place Photos の公式説明）。
 * 日次ジャーナル・特集・sitemap-images.xml は、HTML に書いたあとで取り直さないため、
 * 書き込んだ URL が失効して写真が出なくなる（2026-10-15 実測: 56 URL / 59 ページ）。
 * そこでこれらの面には Places の URL を書かない。毎日作り直す店舗ページは対象外。
 * 判定器はこの1本（生成器・検査が共有する）。
 */

const PLACES_PHOTO_RE = /(?:^|\/\/)lh\d\.googleusercontent\.com\/|googleusercontent\.com\/place-photos\/|places\.googleapis\.com\/|maps\.googleapis\.com\/maps\/api\/place\/photo/i;

/** Places 由来の写真 URL か */
function isPlacesPhotoUrl(url) {
  return PLACES_PHOTO_RE.test(String(url || ''));
}

/** 静的な面に書いてよい写真 URL を返す。Places 由来なら空文字（写真なし） */
function staticPhotoUrl(url) {
  const u = String(url || '');
  return isPlacesPhotoUrl(u) ? '' : u;
}

/** HTML / XML の文字列に含まれる Places 写真 URL を重複なく返す */
function findPlacesPhotoUrls(text) {
  const out = new Set();
  for (const m of String(text || '').match(/https?:\/\/[^\s"'<>)]+/g) || []) {
    if (isPlacesPhotoUrl(m)) out.add(m);
  }
  return [...out];
}

module.exports = { PLACES_PHOTO_RE, isPlacesPhotoUrl, staticPhotoUrl, findPlacesPhotoUrls };
