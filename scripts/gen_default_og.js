#!/usr/bin/env node
'use strict';
/**
 * 既定の og:image（icons/og-default.png・1200x630 の横長）を作る（K5・2026-11-13）。
 * 写真も図解も無いページが、正方形のアイコン（icon-512.png）を og:image にすると、
 * X のリンクカードでロゴの丸が切れる。横長の既定の画像にしてそれを防ぐ。
 *   node scripts/gen_default_og.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const F = require('./lib/og_figure_png');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'icons', 'og-default.png');
const FONT = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans CJK JP','Noto Sans JP','Yu Gothic','Meiryo',sans-serif";

function svg() {
  const icon = fs.readFileSync(path.join(ROOT, 'icons', 'icon-512.png')).toString('base64');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="${FONT}">
<rect width="1200" height="630" fill="#f7f5f1"/>
<rect width="18" height="630" fill="#7a5c10"/>
<image href="data:image/png;base64,${icon}" x="110" y="195" width="240" height="240"/>
<text x="400" y="300" font-size="84" font-weight="800" fill="#7a5c10" letter-spacing="3">NAGOYA BITES</text>
<text x="404" y="378" font-size="40" font-weight="600" fill="#3a3a36">名古屋の飲食店ガイド</text>
<line x1="404" y1="418" x2="1090" y2="418" stroke="#d3d1c7" stroke-width="3"/>
<text x="404" y="470" font-size="30" fill="#5a5a55">nagoya-bites.com</text>
</svg>
`;
}

if (require.main === module) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nb-defog-')), 'og-default.svg');
  fs.writeFileSync(tmp, svg());
  const r = F.renderSvgToPng(tmp, OUT);
  console.log(`icons/og-default.png: ${r.width}x${r.height} ${r.bytes} bytes (${r.renderer})`);
}

module.exports = { svg, OUT };
