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
  if (listed.some((p) => photoId(p.src) === photoId(face.photo))) {
    return { src: face.photo, store: face.store, pinned: true };
  }
  const rejected = new Set((cfg.rejectedPhotos || []).map(photoId));
  const alt = listed.find((p) => !rejected.has(photoId(p.src)) && p.alt);
  return alt ? { src: alt.src, store: alt.alt, pinned: false } : null;
}

function creditText(face, cfg) {
  return `写真: ${face.store}（${cfg.credit || 'ホットペッパーグルメ'}）`;
}

// 特集ページの先頭に置く顔（区画の印つき・冪等）
function heroBlock(face, cfg) {
  return `${FACE_START}
<div class="art-hero-image nb-feature-face">
  <img src="${esc(face.src)}" alt="${esc(face.store)}の料理・店内" width="480" height="320" loading="eager" fetchpriority="high" decoding="async">
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
 * 特集一覧（features/index.html）の slug のカードの画像を顔の写真にし、出所の1行を足す。
 * 図のカード、または前に自分が出所の行を足したカードだけを直す（手で入れた写真のカードは触らない）。
 */
function applyIndexCard(html, slug, face, cfg) {
  const re = new RegExp(`(<a class="article-card[^"]*" href="${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.html"[^>]*>)([\\s\\S]*?)(</a>)`);
  const m = html.match(re);
  if (!m) return html;
  let inner = m[2];
  const isFigure = /<img class="card-img" src="[^"]*feature-figures\/[^"]*"/.test(inner);
  const hasCredit = /<p class="card-photo-credit">/.test(inner);
  if (!isFigure && !hasCredit) return html;
  inner = inner.replace(/(<img class="card-img" src=")[^"]*(")/, (_, a, b) => a + esc(face.src) + b);
  const credit = `<p class="card-photo-credit">${esc(creditText(face, cfg))}</p>`;
  if (hasCredit) inner = inner.replace(/<p class="card-photo-credit">[\s\S]*?<\/p>/, () => credit);
  else inner = inner.replace(/(<p class="card-desc">[\s\S]*?<\/p>)/, (x) => `${x}\n      ${credit}`);
  return html.replace(re, () => m[1] + inner + m[3]);
}

module.exports = {
  CONFIG, FACE_START, FACE_END,
  loadConfig, photoId, listedPhotos, resolveFace, creditText, heroBlock, applyHero, applyIndexCard,
};
