'use strict';
/**
 * scripts/lib/feature_face.js — 特集の「顔」の写真を決める（Ondine #2097・data/feature_faces.json が正本）
 *
 * 顔の写真は、その特集の掲載店（特集ページの店カード）のホットペッパー公式写真を URL で参照するだけ。
 * 加工・切り抜き・自ホストはしない（リクルートの規約・CLAUDE.md 写真ソースの優先2）。CSS の object-fit は加工にあたらない。
 * どの写真にするかは人が候補を見て決め（data/feature_faces.json の faces）、機械では良し悪しを判定しない。
 * ここは「決めた写真が今も掲載店のものか」を確かめて、使う写真を返すだけ。
 *
 * 使い手: scripts/apply_feature_faces.js（特集ページ・特集一覧）／ scripts/build_featured.js（トップの特集ストリップ）
 */

const fs = require('fs');
const path = require('path');
const HP = require('./hotpepper_photo');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG = path.join(ROOT, 'data', 'feature_faces.json');
const FACE_START = '<!-- NB_FEATURE_FACE_START -->';
const FACE_END = '<!-- NB_FEATURE_FACE_END -->';

function loadConfig(file) {
  return JSON.parse(fs.readFileSync(file || CONFIG, 'utf8'));
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function unesc(s) {
  return String(s || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// HotPepper の写真は _480 など大きさ違いの URL があるので、写真の番号（P000000000）で同じ写真かを見る
function photoId(url) {
  const m = String(url || '').match(/(P\d{6,})/);
  return m ? m[1] : String(url || '');
}

// ページ本文のうち、顔の部分（自分が入れた区画・今の art-hero-image）を除いた店カードの写真（ホットペッパーだけ）
function listedPhotos(html) {
  const bodyAt = html.indexOf('<body');
  let body = bodyAt >= 0 ? html.slice(bodyAt) : html;
  body = body.replace(new RegExp(`${FACE_START}[\\s\\S]*?${FACE_END}`), '');
  body = body.replace(/<div class="art-hero-image">[\s\S]*?<\/div>/, '');
  const out = [];
  const seen = new Set();
  for (const m of body.matchAll(/<img\s+[^>]*?src="(https:\/\/imgfp\.hotp\.jp\/[^"]+)"[^>]*>/g)) {
    const src = m[1];
    if (/noimage/i.test(src) || seen.has(photoId(src))) continue;
    seen.add(photoId(src));
    const alt = (m[0].match(/alt="([^"]*)"/) || [])[1] || '';
    out.push({ src, alt: unesc(alt).trim() });
  }
  return out;
}

/**
 * その特集の顔を返す。{ src, store, pinned } か null（顔を持たない特集は null＝今の図のまま）。
 * pinned=false は、決めた店が掲載から外れたので先頭の店で代えた状態（人の目の再確認が要る）。
 */
function resolveFace(slug, html, cfg) {
  const face = cfg.faces && cfg.faces[slug];
  if (!face) return null;
  const listed = listedPhotos(html);
  // 大きさ違いの URL は同じ写真の参照（data/hotpepper_photo_sizes.json に測った幅がある写真だけ。無ければ 480px のまま）
  if (listed.some((p) => photoId(p.src) === photoId(face.photo))) {
    return Object.assign({ store: face.store, pinned: true }, HP.pick(face.photo));
  }
  const rejected = new Set((cfg.rejectedPhotos || []).map(photoId));
  const alt = listed.find((p) => !rejected.has(photoId(p.src)) && p.alt);
  return alt ? Object.assign({ store: alt.alt, pinned: false }, HP.pick(alt.src)) : null;
}

function creditText(face, cfg) {
  return `写真: ${face.store}（${cfg.credit || 'ホットペッパーグルメ'}）`;
}

// 特集ページの先頭に置く顔（区画の印つき・冪等）
function heroBlock(face, cfg) {
  const srcset = face.srcset ? ` srcset="${esc(face.srcset)}" sizes="(max-width:640px) 100vw, 832px"` : '';
  // 画面に出す幅は元の写真の幅まで（--face-w）。元より広く引き伸ばさない
  return `${FACE_START}
<div class="art-hero-image nb-feature-face" style="--face-w:${face.maxW || 480}px">
  <img src="${esc(face.src)}"${srcset} alt="${esc(face.store)}の料理・店内" width="480" height="320" loading="eager" fetchpriority="high" decoding="async">
  <p class="art-hero-credit">${esc(creditText(face, cfg))}</p>
</div>
${FACE_END}`;
}

/**
 * 特集ページの html に顔を入れた html を返す。変えなかったときは同じ文字列。
 *  1. 印の区画が既にあれば、その中身を作り直す
 *  2. 今の顔が図（feature-figures の svg）なら、その div を区画に置き換える
 *  3. 顔の div が無い古い型の本文は、最初の見出しの塊（hero）の前に置く
 *  4. すでに別の写真の顔（手で入れたホットペッパー写真）があれば触らない。ただし cfg.replaceHero に載せた特集は、
 *     人が見て顔にふさわしくない（ロゴが主役など）と判断した写真なので、区画に置き換える
 */
function applyHero(html, face, cfg, slug) {
  const block = heroBlock(face, cfg);
  const marked = new RegExp(`${FACE_START}[\\s\\S]*?${FACE_END}`);
  if (marked.test(html)) return html.replace(marked, () => block);
  const bodyAt = html.indexOf('<body');
  const head = bodyAt >= 0 ? html.slice(0, bodyAt) : '';
  const body = bodyAt >= 0 ? html.slice(bodyAt) : html;
  const figure = /<div class="art-hero-image">\s*<img[^>]*feature-figures[^>]*>\s*<\/div>/;
  if (figure.test(body)) return head + body.replace(figure, () => block);
  const handSet = /<div class="art-hero-image">\s*<img[^>]*>\s*<\/div>/;
  if (handSet.test(body) && (cfg.replaceHero || []).includes(slug)) return head + body.replace(handSet, () => block);
  if (/<div class="art-hero-image">/.test(body)) return html;
  const heroAt = body.search(/<(?:div|section) class="(?:art-)?hero">/);
  if (heroAt < 0) return html;
  return head + body.slice(0, heroAt) + block + '\n' + body.slice(heroAt);
}

/**
 * 特集一覧（features/index.html）の slug の札（同じ特集の札が2か所あれば全部）を顔の写真にし、写真のすぐ下に出所の1行を足す。
 * 図の札・写真の無い札（季節の札）・手で入れた写真の札も、特集ページの顔に そろえる（顔の無い特集は触らない）。
 * 画像は札の写真の枠の中、出所は枠の直後（本文の前）。作り直しても同じ結果になる（冪等）。
 */
function applyIndexCard(html, slug, face, cfg) {
  const re = new RegExp(`(<a class="article-card[^"]*" href="${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.html"[^>]*>)([\\s\\S]*?)(</a>)`, 'g');
  const srcset = face.srcset ? ` srcset="${esc(face.srcset)}" sizes="(max-width:768px) 50vw, 400px"` : '';
  const credit = `<p class="card-photo-credit">${esc(creditText(face, cfg))}</p>`;
  return html.replace(re, (all, open, inner, close) => {
    inner = inner.replace(/\s*<p class="card-photo-credit">[\s\S]*?<\/p>/g, '');
    if (/<img class="card-img"/.test(inner)) {
      inner = inner.replace(/<img class="card-img"[^>]*>/, (tag) => {
        const alt = (tag.match(/alt="([^"]*)"/) || [])[1];
        return `<img class="card-img" src="${esc(face.src)}"${srcset} alt="${alt == null ? esc(face.store) : alt}" loading="lazy">`;
      });
    } else {
      inner = inner.replace(/(<div class="card-badge">)/, `$1\n      <img class="card-img" src="${esc(face.src)}"${srcset} alt="${esc(face.store)}の料理・店内" loading="lazy">`);
    }
    inner = inner.replace(/(\n\s*)(<div class="card-body">)/, (m, ws, body) => `${ws}${credit}${ws}${body}`);
    return open + inner + close;
  });
}

module.exports = {
  CONFIG, FACE_START, FACE_END,
  loadConfig, photoId, listedPhotos, resolveFace, creditText, heroBlock, applyHero, applyIndexCard,
};
