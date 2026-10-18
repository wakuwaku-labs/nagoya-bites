'use strict';
/**
 * data/hotpepper_trending_details.json（scripts/enrich_hotpepper_details.js）を店へ載せる。
 * ホットペッパーID は入れない（スラグと予約送客の計測がその欄で決まるため）。
 * 載せるのは 営業時間・定休日（空のときだけ）と「ホットペッパー掲載URL」。既存の値は上書きしない。
 */
function mergeHotpepperTrending(stores, details) {
  let n = 0;
  for (const s of stores) {
    if (s['ホットペッパーID']) continue;
    const d = details && details[s['店名']];
    if (!d || !d.id) continue;
    if (!s['営業時間'] && d['営業時間']) s['営業時間'] = d['営業時間'];
    if (!s['定休日'] && d['定休日']) s['定休日'] = d['定休日'];
    if (!s['ホットペッパー掲載URL'] && d.url) s['ホットペッパー掲載URL'] = d.url;
    n++;
  }
  return n;
}
module.exports = { mergeHotpepperTrending };
