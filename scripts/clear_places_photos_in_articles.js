#!/usr/bin/env node
'use strict';
/**
 * 公開済みの記事（journal/20*.html・features/*.html）にある Google Places の写真を外す（基本方針 段階1 S1-5・ADR 0069・ADR 0045）。
 *
 * Places の写真 URL は期限切れになりうる・キャッシュ不可で、書いた後に取り直さない面（ジャーナル・特集）では
 * 表示できなくなる（2026-11-16 実測: 59 URL のうち 49 が 403）。個人名クレジット（客が上げたスマホ写真）も混ざっていた。
 * 外すもの（scripts/lib/places_photo_url.js の判定器）:
 *   - <figure> の写真が Places のもの → figure ごと（ヒーロー・本文の写真・個人名クレジットの図説も一緒に消える）
 *   - 特集の店カードの写真（<img class="shop-card-photo"> など）が Places のもの → その <img>（空になった写真の枠も消す）
 *   - og:image / twitter:image が Places のもの → 既定の画像（icons/og-default.png）。幅・高さは normalize_og_images.js が付ける
 * 本文・題は変えない。冪等。
 *
 *   node scripts/clear_places_photos_in_articles.js           # 書き換える
 *   node scripts/clear_places_photos_in_articles.js --check   # 外す写真があれば exit 1（書かない）
 * 戻し方: コミットを打ち消す。
 */
const fs = require('fs');
const path = require('path');
const { isPlacesPhotoUrl } = require('./lib/places_photo_url');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OG = 'https://nagoya-bites.com/icons/og-default.png';

function clearHtml(html) {
  let n = 0;
  let out = html;
  // 1. 写真の図（figure）ごと
  out = out.replace(/[ \t]*<figure\b[^>]*>(?:(?!<\/figure>)[\s\S])*?<\/figure>[ \t]*\n?(?:[ \t]*\n)?/g, (m) => {
    const src = (m.match(/<img\b[^>]*\bsrc="([^"]*)"/) || [])[1];
    if (src && isPlacesPhotoUrl(src)) {
      n++;
      // ヒーローは、外したことが検査（hero_photo_gate の hero_expired）に分かる印を残す（写真が無いだけの記事と区別する）
      return /class="art-hero-img"/.test(m) ? '  <!-- NB-HERO-EXPIRED: Google の写真 URL は期限切れになるため外した。他店の写真は借りない -->\n' : '';
    }
    return m;
  });
  // 2. 写真の枠（store-photo）の中の Places の <img>
  out = out.replace(/<div class="store-photo">\s*<img\b[^>]*\bsrc="([^"]*)"[^>]*>\s*<\/div>\s*\n?/g, (m, src) => {
    if (isPlacesPhotoUrl(src)) { n++; return ''; }
    return m;
  });
  // 3. 店カードの写真（<img>）
  out = out.replace(/[ \t]*<img\b[^>]*\bsrc="([^"]*)"[^>]*>[ \t]*\n?/g, (m, src) => {
    if (isPlacesPhotoUrl(src) && /class="shop-card-photo"|class="[^"]*store-photo/.test(m)) { n++; return ''; }
    return m;
  });
  // 4. og:image / twitter:image
  out = out.replace(/(<meta (?:property="og:image"|name="twitter:image") content=")([^"]*)(")/g, (m, a, src, c) => {
    if (isPlacesPhotoUrl(src)) { n++; return a + DEFAULT_OG + c; }
    return m;
  });
  return { html: out, count: n };
}

function targets() {
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'journal')).filter((x) => /^20.*\.html$/.test(x))) out.push('journal/' + f);
  for (const f of fs.readdirSync(path.join(ROOT, 'features')).filter((x) => x.endsWith('.html'))) out.push('features/' + f);
  return out;
}

function main() {
  const check = process.argv.includes('--check');
  let files = 0, items = 0;
  for (const f of targets()) {
    const p = path.join(ROOT, f);
    const before = fs.readFileSync(p, 'utf8');
    const r = clearHtml(before);
    if (r.html === before) continue;
    files++; items += r.count;
    if (!check) fs.writeFileSync(p, r.html);
  }
  console.log(`記事の Places 写真（S1-5）: ${files}ファイル・${items}か所${check ? '（書き込みなし）' : 'を外した'}`);
  if (check && files) process.exit(1);
}

if (require.main === module) main();
module.exports = { clearHtml };
