#!/usr/bin/env node
/**
 * SEO-002: 特集記事の末尾に「関連する特集記事」内部リンク(3〜5件)を設置し回遊を促す。
 * - リンク先は features/ に実在するページのみ（架空リンクブロック）。
 * - 既に class="related" を持つファイルはスキップ。
 * - .related CSS が無いファイルには date.html と同じCSSを </style> 直前に注入。
 */
const fs = require('fs');
const path = require('path');

const FEAT = path.join(__dirname, '..', 'features');
const HUB = 'nagoya-gourmet-guide';

// 短いラベル（カードではないので簡潔に）
const LABEL = {
  'nagoya-gourmet-guide': '名古屋グルメ完全ガイド',
  'banquet': '宴会・忘年会15選',
  'birthday': '誕生日・記念日10選',
  'date': 'デートディナー10選',
  'girls-party': '女子会10選',
  'large-group': '大人数宴会10選',
  'private-room': '個室グルメ10選',
  'meieki': '名駅グルメ15選',
  'sakae': '栄・錦グルメ15選',
  'osu-food-walk': '大須食べ歩き10選',
  'nagoya-kakuozan': '覚王山グルメ10選',
  'nagoya-morning': 'モーニング・喫茶10選',
  'nagoya-cafe': 'カフェ10選',
  'nagoya-sweets': 'スイーツ10選',
  'nagoya-bar': 'バー・カクテル10選',
  'nagoya-bar-guide': 'バー・ワインバー10選',
  'nagoya-dining-bar': 'ダイニングバー・バル10選',
  'nagoya-izakaya': '居酒屋10選',
  'nagoya-industry-pick-izakaya': '業界人推薦の居酒屋10選',
  'nagoya-yakitori': '焼き鳥10選',
  'nagoya-yakitori-guide': '焼き鳥ガイド10選',
  'nagoya-yakiniku': '焼肉10選',
  'nagoya-yakiniku-guide': '業界人の焼肉8選',
  'nagoya-steak': 'ステーキ10選',
  'nagoya-teppanyaki': '鉄板焼き10選',
  'nagoya-sukiyaki': 'すき焼き・しゃぶしゃぶ10選',
  'nagoya-sushi-guide': '鮨8選',
  'nagoya-seafood': '海鮮・魚介10選',
  'nagoya-kaiseki-guide': '懐石・会席10選',
  'nagoya-lunch-washoku': '和食ランチ10選',
  'nagoya-unaju': 'うなぎ・ひつまぶし10選',
  'nagoya-hitsumabushi': 'ひつまぶし完全ガイド',
  'nagoya-tonkatsu': 'とんかつ・味噌かつ10選',
  'nagoya-tebasaki': '手羽先完全ガイド',
  'nagoya-gyoza': '餃子10選',
  'nagoya-ramen': 'ラーメン12選',
  'nagoya-miso-nikomi-udon': '味噌煮込みうどんガイド',
  'nagoya-chinese-guide': '中華料理10選',
  'nagoya-korean': '韓国料理10選',
  'nagoya-italian-guide': 'イタリアン10選',
  'nagoya-french-guide': 'フレンチ8選',
  'nagoya-yoshoku': '洋食10選',
  'nagoya-solo-dining': '一人飲み完全ガイド',
  'nagoya-settai-secret': '失敗しない接待10選',
  'nagoya-settai-lunch': '接待ランチ10選',
  'settai-guide': '接待店選びマニュアル',
  'nagoya-meieki-business-dinner': '名駅・会食10選',
  'spring-terrace': 'テラス席・春グルメ10選',
  'gw-2026': 'GW・連休グルメ12選',
  'nagoya-summer-2026': '夏グルメ10選',
  'nagoya-autumn-2026': '秋グルメ10選',
};

// gap slug → 関連リンク(姉妹特集)。HUBは別途先頭に付与。
const MAP = {
  'fathers-day-2026': ['date', 'birthday', 'nagoya-yakiniku', 'nagoya-sushi-guide', 'nagoya-teppanyaki'],
  'nagoya-autumn-2026': ['nagoya-summer-2026', 'spring-terrace', 'gw-2026', 'nagoya-kaiseki-guide'],
  'nagoya-bar-guide': ['nagoya-bar', 'nagoya-dining-bar', 'nagoya-solo-dining', 'date'],
  'nagoya-bar': ['nagoya-bar-guide', 'nagoya-dining-bar', 'nagoya-solo-dining', 'date'],
  'nagoya-cafe': ['nagoya-morning', 'nagoya-sweets', 'nagoya-kakuozan', 'osu-food-walk'],
  'nagoya-chinese-guide': ['nagoya-gyoza', 'nagoya-ramen', 'nagoya-izakaya', 'nagoya-korean'],
  'nagoya-dining-bar': ['nagoya-bar-guide', 'nagoya-bar', 'nagoya-italian-guide', 'date'],
  'nagoya-french-guide': ['nagoya-italian-guide', 'date', 'birthday', 'nagoya-kaiseki-guide'],
  'nagoya-gyoza': ['nagoya-chinese-guide', 'nagoya-ramen', 'nagoya-izakaya', 'nagoya-tebasaki'],
  'nagoya-italian-guide': ['nagoya-french-guide', 'date', 'birthday', 'nagoya-dining-bar'],
  'nagoya-izakaya': ['nagoya-industry-pick-izakaya', 'nagoya-yakitori-guide', 'banquet', 'private-room'],
  'nagoya-kaiseki-guide': ['nagoya-sushi-guide', 'nagoya-lunch-washoku', 'nagoya-settai-secret', 'birthday'],
  'nagoya-kakuozan': ['sakae', 'meieki', 'osu-food-walk', 'nagoya-cafe'],
  'nagoya-korean': ['nagoya-yakiniku', 'nagoya-izakaya', 'girls-party', 'nagoya-chinese-guide'],
  'nagoya-morning': ['nagoya-cafe', 'nagoya-sweets', 'nagoya-kakuozan'],
  'nagoya-ramen': ['nagoya-tebasaki', 'nagoya-gyoza', 'nagoya-miso-nikomi-udon', 'nagoya-solo-dining'],
  'nagoya-seafood': ['nagoya-sushi-guide', 'nagoya-kaiseki-guide', 'nagoya-unaju', 'nagoya-izakaya'],
  'nagoya-settai-lunch': ['nagoya-settai-secret', 'settai-guide', 'nagoya-meieki-business-dinner', 'nagoya-lunch-washoku'],
  'nagoya-steak': ['nagoya-teppanyaki', 'nagoya-yakiniku', 'date', 'birthday'],
  'nagoya-sukiyaki': ['nagoya-yakiniku', 'nagoya-steak', 'nagoya-kaiseki-guide', 'private-room'],
  'nagoya-summer-2026': ['nagoya-autumn-2026', 'spring-terrace', 'gw-2026', 'nagoya-bar-guide'],
  'nagoya-sushi-guide': ['nagoya-seafood', 'nagoya-kaiseki-guide', 'nagoya-unaju', 'date'],
  'nagoya-sweets': ['nagoya-cafe', 'nagoya-morning', 'girls-party', 'nagoya-kakuozan'],
  'nagoya-teppanyaki': ['nagoya-steak', 'nagoya-yakiniku', 'date', 'birthday'],
  'nagoya-tonkatsu': ['nagoya-miso-nikomi-udon', 'nagoya-tebasaki', 'nagoya-yoshoku', 'nagoya-ramen'],
  'nagoya-unaju': ['nagoya-hitsumabushi', 'nagoya-seafood', 'nagoya-kaiseki-guide', 'nagoya-lunch-washoku'],
  'nagoya-yakitori-guide': ['nagoya-yakitori', 'nagoya-industry-pick-izakaya', 'nagoya-izakaya', 'nagoya-solo-dining'],
  'nagoya-yakitori': ['nagoya-yakitori-guide', 'nagoya-izakaya', 'nagoya-tebasaki', 'private-room'],
  'nagoya-yoshoku': ['nagoya-tonkatsu', 'nagoya-cafe', 'nagoya-italian-guide', 'nagoya-steak'],
  // ハブ自身: 自己リンクせず、主要シーン/エリア/業界人ハブへ送る
  'nagoya-gourmet-guide': ['meieki', 'sakae', 'nagoya-solo-dining', 'date', 'nagoya-yakiniku-guide'],
};

const CSS = ".related{background:var(--bg2);border-top:1px solid var(--border);padding:2.5rem 1.5rem;text-align:center;}.related-title{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:1.3rem;color:var(--white);margin-bottom:1.2rem;}.related-links{display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;}.related-link{font-size:.78rem;color:var(--gold);text-decoration:none;border:1px solid rgba(122,92,16,.35);padding:.5rem 1.1rem;border-radius:2px;transition:background .2s;}.related-link:hover{background:rgba(122,92,16,.08);}";

function buildBlock(slug) {
  const links = MAP[slug];
  const isHub = slug === HUB;
  const parts = [];
  if (!isHub) {
    parts.push(`    <a class="related-link" href="${HUB}.html" style="background:rgba(122,92,16,.08);border-color:var(--gold);font-weight:500;">\u{1F4D6} ${LABEL[HUB]}</a>`);
  }
  for (const t of links) {
    parts.push(`    <a class="related-link" href="${t}.html">${LABEL[t]}</a>`);
  }
  return `\n<div class="related">\n  <p class="related-title">関連する特集記事</p>\n  <div class="related-links">\n${parts.join('\n')}\n  </div>\n  <p style="margin-top:1.5rem;">\n    <a class="related-link" href="../index.html" style="background:rgba(122,92,16,.06);">トップページで全店舗を検索する →</a>\n  </p>\n</div>\n`;
}

// 全リンク先の実在検証（架空リンクブロック）
const existing = new Set(fs.readdirSync(FEAT).filter(f => f.endsWith('.html')).map(f => f.replace('.html', '')));
let badRefs = 0;
for (const [slug, links] of Object.entries(MAP)) {
  const all = (slug === HUB ? links : [HUB, ...links]);
  for (const t of links) if (!LABEL[t]) { console.error(`LABEL欠落: ${t} (in ${slug})`); badRefs++; }
  for (const t of all) if (!existing.has(t)) { console.error(`実在しないリンク先: ${t}.html (in ${slug})`); badRefs++; }
}
if (badRefs) { console.error(`\n${badRefs}件の不正リンクを検出。中断。`); process.exit(1); }

let changed = 0, skipped = 0;
for (const slug of Object.keys(MAP)) {
  const fp = path.join(FEAT, slug + '.html');
  if (!fs.existsSync(fp)) { console.error(`ファイル無し: ${slug}.html`); continue; }
  let html = fs.readFileSync(fp, 'utf8');
  if (html.includes('class="related"')) { skipped++; continue; }

  // CSS注入（未定義なら最後の </style> 直前へ）
  if (!html.includes('.related-link')) {
    const idx = html.lastIndexOf('</style>');
    if (idx === -1) { console.error(`</style> 無し: ${slug}`); continue; }
    html = html.slice(0, idx) + CSS + html.slice(idx);
  }

  // HTML注入（最初の <footer> 直前へ）
  const fi = html.indexOf('<footer');
  if (fi === -1) { console.error(`<footer> 無し: ${slug}`); continue; }
  html = html.slice(0, fi) + buildBlock(slug) + '\n' + html.slice(fi);

  fs.writeFileSync(fp, html);
  changed++;
}
console.log(`完了: 注入 ${changed} 件 / スキップ(既存) ${skipped} 件 / 対象 ${Object.keys(MAP).length} 件`);
