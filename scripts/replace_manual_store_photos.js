#!/usr/bin/env node
// data/manual_stores.json の汎用ストック写真URL（Unsplash/Pexels等）を、
// 店名入りの店舗固有 SVG イメージ図（assets/store-figures/<hash>.svg）へ置換する。
//
// 手動キュレーション店は HotPepper / Google / 公式IG が未解決なため、
// CLAUDE.md 制約 #9 の「最終手段: 記事/店舗固有のイメージ図」を適用する。
// （将来 DataKeeper が公式IG投稿URLを解決したら embed/実写へ差し替える。EDT-PHOTO-001 参照）
//
// 置換後は `node build.js` を実行して features/ と stores/ に反映すること。
//
// 使い方: node scripts/replace_manual_store_photos.js [--dry-run]

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MANUAL_JSON = path.join(ROOT, 'data', 'manual_stores.json');
const FIGURE_DIR = path.join(ROOT, 'assets', 'store-figures');

const { classifyGenre } = require('./replace_feature_card_images.js');

// store-figure 専用パレット（feature と共通のジャンル分類を流用）
const PALETTES = require('./store_figure_palettes.js');

const STOCK_RE = /unsplash|pexels|loremflickr|pixabay/i;

function slugFor(name) {
  return 'store-' + crypto.createHash('sha1').update(name).digest('hex').slice(0, 12);
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function wrapName(s, max) {
  const t = String(s).trim();
  if (t.length <= max) return [t];
  // 空白・中点で割る
  for (const b of [' ', '　', '・']) {
    const i = t.indexOf(b);
    if (i > 2 && i < t.length - 2) return [t.slice(0, i), t.slice(i + 1).trim()];
  }
  const mid = Math.ceil(t.length / 2);
  return [t.slice(0, mid), t.slice(mid)];
}

// 店舗カード用 SVG（shop-card-photo は 600x340 相当）
function makeStoreSvg({ name, genre, area }) {
  const p = PALETTES[genre] || PALETTES.guide;
  const lines = wrapName(name, 9);
  const nameY = lines.length === 1 ? 175 : 150;
  const nameEls = lines.map((l, i) =>
    `<text x="40" y="${nameY + i * 42}" fill="#fff" font-family="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif" font-size="34" font-weight="700" letter-spacing="0.02em">${escapeXml(l)}</text>`
  ).join('');
  const sub = escapeXml([genreLabel(genre), area].filter(Boolean).join(' · '));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" width="600" height="340" role="img" aria-label="${escapeXml(name)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.from}"/><stop offset="100%" stop-color="${p.to}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="340" fill="url(#bg)"/>
  ${storeMotif(genre, p.accent)}
  <rect x="30" y="40" width="3" height="${lines.length === 1 ? 160 : 200}" fill="${p.accent}" opacity=".9"/>
  <text x="40" y="70" fill="${p.accent}" opacity=".8" font-family="'Helvetica Neue',Arial,sans-serif" font-size="11" font-weight="700" letter-spacing="0.28em">NAGOYA BITES</text>
  ${nameEls}
  <text x="40" y="${nameY + lines.length * 42 + 8}" fill="${p.accent}" opacity=".85" font-family="'Helvetica Neue','Hiragino Sans','Yu Gothic',sans-serif" font-size="14" font-weight="600" letter-spacing="0.06em">${sub}</text>
</svg>
`;
}

function genreLabel(g) {
  const map = {
    ramen:'ラーメン', sushi:'鮨', yakiniku:'焼肉', yakitori:'焼き鳥', unagi:'うなぎ',
    tonkatsu:'とんかつ', steak:'ステーキ', sukiyaki:'すき焼き', teppan:'鉄板焼き', gyoza:'餃子',
    chinese:'中華', korean:'韓国料理', italian:'イタリアン', french:'フレンチ', yoshoku:'洋食',
    seafood:'海鮮', washoku:'和食', izakaya:'居酒屋', bar:'バー', cafe:'カフェ', sweets:'スイーツ',
    diningbar:'ダイニングバー', tebasaki:'手羽先', misoNikomi:'味噌煮込み', lunch:'ランチ', guide:'店',
  };
  return map[g] || '';
}

// 店舗カード用モチーフ（右下に配置）
function storeMotif(genre, a) {
  switch (genre) {
    case 'ramen': case 'misoNikomi':
      return `<g opacity=".4"><path d="M430 250 q90 60 180 0 v-12 q-90 30 -180 0 z" fill="${a}"/>
        <path d="M470 195 q6 -22 -6 -34 q-12 -12 0 -28" stroke="${a}" stroke-width="3" fill="none"/>
        <path d="M520 190 q-6 -22 6 -34 q12 -12 0 -28" stroke="${a}" stroke-width="3" fill="none"/></g>`;
    case 'sushi': case 'seafood':
      return `<g opacity=".4"><rect x="450" y="255" width="140" height="28" rx="6" fill="${a}"/><path d="M450 255 q70 -26 140 0" fill="${a}"/></g>`;
    case 'yakiniku': case 'yakitori': case 'steak': case 'tonkatsu': case 'sukiyaki': case 'teppan':
      return `<g opacity=".4" stroke="${a}" stroke-width="3" fill="none"><line x1="440" y1="280" x2="600" y2="280"/><line x1="440" y1="262" x2="600" y2="262"/><line x1="440" y1="244" x2="600" y2="244"/><line x1="460" y1="232" x2="460" y2="295"/><line x1="510" y1="232" x2="510" y2="295"/><line x1="560" y1="232" x2="560" y2="295"/></g>`;
    case 'izakaya':
      return `<g opacity=".42"><ellipse cx="530" cy="250" rx="48" ry="58" fill="${a}"/><rect x="514" y="190" width="32" height="6" fill="${a}"/><rect x="514" y="305" width="32" height="6" fill="${a}"/></g>`;
    case 'cafe':
      return `<g opacity=".4" fill="${a}"><path d="M450 230 h110 v44 q0 22 -22 22 h-66 q-22 0 -22 -22 z"/><path d="M560 242 q26 0 26 20 t-26 20" fill="none" stroke="${a}" stroke-width="4"/></g>`;
    case 'bar': case 'diningbar':
      return `<g opacity=".42" fill="${a}"><path d="M470 215 l66 66 l66 -66 z"/><rect x="532" y="281" width="8" height="40"/><rect x="508" y="316" width="56" height="6"/></g>`;
    case 'sweets':
      return `<g opacity=".42" fill="${a}"><rect x="470" y="262" width="120" height="44" rx="4"/><rect x="480" y="240" width="100" height="24"/><rect x="528" y="220" width="4" height="16"/></g>`;
    case 'gyoza': case 'chinese':
      return `<g opacity=".42" fill="${a}"><path d="M450 290 q44 -56 88 0 z"/><path d="M520 290 q44 -56 88 0 z"/></g>`;
    default:
      return `<g opacity=".38" fill="${a}"><ellipse cx="530" cy="285" rx="84" ry="16"/><ellipse cx="530" cy="268" rx="62" ry="11" fill="none" stroke="${a}" stroke-width="2"/></g>`;
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!fs.existsSync(FIGURE_DIR)) fs.mkdirSync(FIGURE_DIR, { recursive: true });

  const data = JSON.parse(fs.readFileSync(MANUAL_JSON, 'utf8'));
  let changed = 0;
  const report = [];

  for (const s of data.stores) {
    const url = s['写真URL'] || '';
    const needsFix = !url || STOCK_RE.test(url);
    if (!needsFix) continue;

    const name = s['店名'] || '';
    const genre = classifyGenre(`${s['ジャンル'] || ''} ${name} ${s['おすすめポイント'] || ''}`);
    const slug = slugFor(name);
    const svg = makeStoreSvg({ name, genre, area: s['エリア'] || '' });
    if (!dryRun) fs.writeFileSync(path.join(FIGURE_DIR, `${slug}.svg`), svg, 'utf8');
    s['写真URL'] = `/assets/store-figures/${slug}.svg`;
    changed++;
    report.push(`${name} [${genre}] → ${slug}.svg`);
  }

  if (!dryRun) fs.writeFileSync(MANUAL_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`manual stores: ${data.stores.length}  fixed: ${changed}  (dry-run: ${dryRun})`);
  report.slice(0, 12).forEach(r => console.log('  ' + r));
  if (report.length > 12) console.log(`  ... (+${report.length - 12} more)`);
  if (!dryRun) console.log('\n次に `node build.js` を実行して features/ と stores/ に反映してください。');
}

if (require.main === module) main();
module.exports = { makeStoreSvg, slugFor };
