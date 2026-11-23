'use strict';
/**
 * scripts/lib/og_photo_pick.js — 記事のリンク画像（og:image）に、記事の店のいちばん大きいホットペッパー写真を選ぶ（ADR 0083）
 *
 * 2026-11-23 本人「もっと画質の良く見える写真を使えないの」。
 * X のリンクカード（summary_large_image）は og:image を横幅いっぱいに出す。11/23 の記事は、主役の店の写真の
 * サフィックス無し版（358px）を指していて、同じ写真の _480 版（480px）より小さく、ぼやけていた。
 * 記事の別の店には 1280px の写真があった。
 *
 * 選び方:
 *   1. og:image がホットペッパーの写真でなければ何もしない（プレスリリース・記事の図はそのまま）。
 *   2. 主役の写真は、同じ写真の大きさ違い（_480 とサフィックス無し）のうち広い方にする。
 *   3. それでも GOOD_W（640px）未満なら、記事に載せた店（input.stores）のホットペッパー写真から、
 *      いちばん広いものに替える（主役より広いときだけ）。記事の外の店・他の写真元は使わない。
 *      ただし題（input.title）に店の名前（または名前の最初の語）が1つでも入る記事は替えない
 *      （1店が主役の記事のカードに別の店の写真を出さない・2026-08-17 の事故と同じ考え。迷ったら替えない側）。
 * どれも URL を参照するだけ（加工・自ホストなし・ADR 0078 と同じ）。幅は data/hotpepper_photo_sizes.json、
 * 無ければ measure（通信して測る）で取り、測った結果は sizes に足す（呼び出し側が保存する）。
 */

const H = require('./hotpepper_photo');

const GOOD_W = 640;

/** 同じ写真の大きさ違いのうち、いちばん広い URL と幅。測れなければ null。 */
function widest(url, sizes, measure) {
  const v = H.variants(url);
  const id = H.idOf(url);
  if (!v || !id) return null;
  let rec = sizes[id];
  if (!rec && measure) {
    const s = measure(v.small);
    const l = measure(v.large);
    if (s !== null && s !== undefined && l !== null && l !== undefined) {
      rec = { s, l };
      sizes[id] = rec;
    }
  }
  if (!rec || !(rec.s > 0 || rec.l > 0)) return null;
  return rec.l >= rec.s ? { url: v.large, w: rec.l } : { url: v.small, w: rec.s };
}

const squash = (t) => String(t || '').replace(/[\s　・「」『』（）()]/g, '');

/** 店の名前が題に入っているか（店名そのもの、または最初の語が2文字以上で入っている）。 */
function nameInTitle(name, title) {
  const t = squash(title);
  const n = squash(name);
  if (!t || !n) return false;
  if (t.includes(n)) return true;
  const head = String(name).trim().split(/[\s　（(]/)[0];
  return head.length >= 2 && t.includes(head);
}

/** 記事に載せた店のホットペッパー写真の URL（重複なし・記事の順）。題に店名が入る記事は空（替えない）。 */
function storePhotoUrls(input, findRecord) {
  const out = [];
  const stores = input.stores || [];
  if (stores.some((st) => st && nameInTitle(st.name, input.title))) return out;
  for (const st of stores) {
    let u = st && st.photo_url;
    if (!(u && H.variants(u)) && findRecord && st && st.name) {
      const rec = findRecord(st) || {};
      u = rec['写真URL'] || '';
    }
    if (u && H.variants(u) && !out.includes(u)) out.push(u);
  }
  return out;
}

/**
 * @returns {{ url: string, w: number, from: 'hero'|'store', changed: boolean } | null}
 *   null … og:image がホットペッパーでない・幅が分からない（そのままにする）
 */
function pickOgPhoto(input, { sizes = {}, measure = null, findRecord = null } = {}) {
  const og = input.og_image || '';
  if (!H.variants(og)) return null;
  const hero = widest(og, sizes, measure);
  if (!hero) return null;
  let best = { ...hero, from: 'hero' };
  if (hero.w < GOOD_W) {
    for (const u of storePhotoUrls(input, findRecord)) {
      if (H.idOf(u) === H.idOf(og)) continue;
      const c = widest(u, sizes, measure);
      if (c && c.w > best.w) best = { ...c, from: 'store' };
    }
  }
  return { ...best, changed: best.url !== og };
}

module.exports = { GOOD_W, widest, nameInTitle, storePhotoUrls, pickOgPhoto };
