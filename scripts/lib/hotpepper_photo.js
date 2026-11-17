'use strict';
/**
 * scripts/lib/hotpepper_photo.js — ホットペッパー写真の「大きさ違いの URL」の選び方（Ondine #2097）
 *
 * ホットペッパーの写真は、同じ写真に大きさ違いの URL がある（`…/P000000000_480.jpg` と `…/P000000000.jpg`）。
 * 後者は店により 1280px まである一方、180〜370px しかない店もある。幅は data/hotpepper_photo_sizes.json に測って残す
 * （scripts/measure_hotpepper_photo_sizes.js が通信して測る。ここは通信しない）。
 * どちらも URL を参照するだけ。加工・切り抜き・自ホストはしない（店のデータ data/stores.json の写真 URL も、API が返す
 * サフィックス無しの URL をそのまま参照している）。
 *
 * 使い方: pick(url) → { src, srcset, maxW }
 *   src    … いちばん幅の広い URL（測っていなければ渡された URL）
 *   srcset … 幅の違う2つの URL があるときだけ「url 480w, url 1280w」
 *   maxW   … 画面に出してよい最大の幅(px)。これを超えて引き伸ばさない（測っていなければ 480）
 */

const fs = require('fs');
const path = require('path');

const SIZES_FILE = path.join(__dirname, '..', '..', 'data', 'hotpepper_photo_sizes.json');
const DEFAULT_W = 480;

let cache = null;
function loadSizes(file) {
  if (file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')).sizes || {}; } catch (_) { return {}; } }
  if (!cache) {
    try { cache = JSON.parse(fs.readFileSync(SIZES_FILE, 'utf8')).sizes || {}; } catch (_) { cache = {}; }
  }
  return cache;
}

function idOf(url) {
  const m = String(url || '').match(/\/(P\d{6,})(?:_\d+)?\.jpg/);
  return m ? m[1] : null;
}

function variants(url) {
  const m = String(url || '').match(/^(https:\/\/imgfp\.hotp\.jp\/IMGH\/\d+\/\d+\/P\d{6,}\/P\d{6,})(?:_\d+)?\.jpg$/);
  if (!m) return null;
  return { small: `${m[1]}_480.jpg`, large: `${m[1]}.jpg` };
}

function pick(url, sizes) {
  const table = sizes || loadSizes();
  const v = variants(url);
  const rec = v && table[idOf(url)];
  if (!v || !rec || !(rec.s > 0 || rec.l > 0)) return { src: url, srcset: '', maxW: DEFAULT_W };
  // 土台は _480（あれば）。サフィックス無しが土台より広いときだけ、それを大きい側に足す（狭い店は足さない）
  const base = rec.s > 0 ? { url: v.small, w: rec.s } : { url: v.large, w: rec.l };
  if (rec.s > 0 && rec.l > rec.s) {
    return { src: base.url, srcset: `${base.url} ${base.w}w, ${v.large} ${rec.l}w`, maxW: rec.l };
  }
  return { src: base.url, srcset: '', maxW: base.w };
}

module.exports = { SIZES_FILE, loadSizes, idOf, variants, pick };
