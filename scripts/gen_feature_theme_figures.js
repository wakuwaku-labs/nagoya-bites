#!/usr/bin/env node
'use strict';
/**
 * 特集 7 本（banquet・gw-2026・meieki・mothers-day・private-room・sakae・spring-terrace）の顔になる図を作る
 * （基本方針 段階1 S1-1・ADR 0069）。以前は Unsplash 由来の写真（assets/features/*.jpg）を使っていた。URL に unsplash の文字が無く
 * 検査に掛からなかったが、制約9（汎用ストック写真の新規使用は原則禁止・実写優先）に当たる。
 * 他店の写真を借りず、その特集の題材を示す「記事専用の図」（CLAUDE.md 写真ソースの最終手段）に替える。
 * 既存の assets/feature-figures/*.svg と同じ作り（背景のグラデーション・粒状・左の縦線・題・英字の小見出し）。画素を発明しない。
 * 出力は 900x599（以前の写真と同じ比率。置く場所の枠が変わらない）。og:image 用の PNG は scripts/render_og_figures.js が作る。
 *
 *   node scripts/gen_feature_theme_figures.js          # 書く（既にあれば同じ内容で上書き＝冪等）
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'feature-figures');
const W = 900, H = 599;

const FIGS = [
  { slug: 'banquet', title: '宴会・忘年会', en: 'BANQUET', from: '#2a1a08', to: '#704818', ink: '#f8d0a0', motif: 'dots' },
  { slug: 'gw-2026', title: 'GW 名古屋グルメ', en: 'GOLDEN WEEK', from: '#0e2a1f', to: '#2f6a4a', ink: '#c8f0d8', motif: 'rays' },
  { slug: 'meieki', title: '名駅エリア', en: 'MEIEKI', from: '#101a30', to: '#2c4a86', ink: '#c8d8f8', motif: 'lines' },
  { slug: 'mothers-day', title: '母の日', en: "MOTHER'S DAY", from: '#301020', to: '#8a3a5a', ink: '#f8d0e0', motif: 'dots' },
  { slug: 'private-room', title: '個室グルメ', en: 'PRIVATE ROOM', from: '#201410', to: '#5a3a28', ink: '#f0d8c0', motif: 'frames' },
  { slug: 'sakae', title: '栄・錦エリア', en: 'SAKAE / NISHIKI', from: '#1a1030', to: '#5a3a8a', ink: '#e0d0f8', motif: 'lines' },
  { slug: 'spring-terrace', title: '初夏のテラス', en: 'TERRACE', from: '#0e2a28', to: '#2a7a70', ink: '#c8f0e8', motif: 'rays' },
];

function motif(kind, ink) {
  if (kind === 'dots') {
    let s = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) s += `<circle cx="${560 + c * 42}" cy="${420 + r * 46}" r="7"/>`;
    return `<g opacity=".45" fill="${ink}">${s}</g>`;
  }
  if (kind === 'rays') {
    let s = '';
    for (let i = 0; i < 9; i++) s += `<path d="M 700 120 L ${520 + i * 50} 340" stroke="${ink}" stroke-width="2"/>`;
    return `<g opacity=".35" fill="none">${s}<circle cx="700" cy="120" r="34" fill="${ink}" stroke="none"/></g>`;
  }
  if (kind === 'lines') {
    let s = '';
    for (let i = 0; i < 7; i++) s += `<rect x="${540 + i * 44}" y="${330 - i * 26}" width="26" height="${170 + i * 26}" rx="3"/>`;
    return `<g opacity=".4" fill="${ink}">${s}</g>`;
  }
  let s = '';
  for (let i = 0; i < 3; i++) s += `<rect x="${560 + i * 34}" y="${300 + i * 30}" width="${220 - i * 40}" height="${150 - i * 30}" rx="6" fill="none" stroke="${ink}" stroke-width="3"/>`;
  return `<g opacity=".45">${s}</g>`;
}

function svgOf(f) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${f.title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${f.from}"/>
      <stop offset="100%" stop-color="${f.to}"/>
    </linearGradient>
    <pattern id="grain" width="3" height="3" patternUnits="userSpaceOnUse">
      <rect width="3" height="3" fill="${f.from}"/>
      <circle cx="0.5" cy="0.5" r="0.4" fill="${f.ink}" opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grain)" opacity=".5"/>
  ${motif(f.motif, f.ink)}
  <rect x="54" y="170" width="4" height="190" fill="${f.ink}" opacity=".9"/>
  <text x="70" y="300" fill="#fff" font-family="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif" font-size="56" font-weight="700" letter-spacing="0.02em">${f.title}</text>
  <text x="70" y="214" fill="${f.ink}" opacity=".8" font-family="'Helvetica Neue',Arial,sans-serif" font-size="22" letter-spacing="0.2em">${f.en}</text>
  <text x="70" y="340" fill="${f.ink}" opacity=".7" font-family="'Hiragino Sans','Yu Gothic','Noto Sans JP',sans-serif" font-size="20">NAGOYA BITES 特集</text>
</svg>
`;
}

function main() {
  for (const f of FIGS) fs.writeFileSync(path.join(OUT, f.slug + '.svg'), svgOf(f));
  console.log(`特集の図 ${FIGS.length} 本を書いた: ${FIGS.map((f) => f.slug).join('・')}`);
}

if (require.main === module) main();
module.exports = { FIGS };
