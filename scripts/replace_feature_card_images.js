#!/usr/bin/env node
// features/index.html のカード画像（Pexels / Unsplash 等の汎用ストック）を、
// 既存の実写JPG（assets/features/<slug>-600.jpg）または
// 記事固有のSVGイメージ図（assets/feature-figures/<slug>.svg）へ一括置換する。
//
// CLAUDE.md 制約 #9（実写優先・汎用ストック禁止）に準拠。
//
// 使い方:
//   node scripts/replace_feature_card_images.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'features', 'index.html');
const REAL_PHOTO_DIR = path.join(ROOT, 'assets', 'features');
const FIGURE_DIR = path.join(ROOT, 'assets', 'feature-figures');

const STOCK_HOST_RE = /https?:\/\/(?:images\.)?(?:unsplash|pexels|loremflickr|pixabay)\.com[^"]*/g;

// ─────────────────────────────────────────────────────────────
// ジャンル分類（alt / カテゴリラベルから判定）
// ─────────────────────────────────────────────────────────────
const GENRE_RULES = [
  { key: 'ramen',       re: /ラーメン|らーめん|ramen|拉麺|まぜそば|まぜ麺|担々麺|担担麺|煮干し|豚骨|二郎|鶏白湯|中華そば|Wスープ|つけ麺|台湾ラーメン/i },
  { key: 'sushi',       re: /鮨|寿司|sushi/i },
  { key: 'yakiniku',    re: /焼肉|やきにく|yakiniku/i },
  { key: 'yakitori',    re: /焼き鳥|やきとり|yakitori/i },
  { key: 'unagi',       re: /うなぎ|鰻|うな重|ひつまぶし|unaju|unagi/i },
  { key: 'tebasaki',    re: /手羽先|tebasaki/i },
  { key: 'misoNikomi',  re: /味噌煮込|misonikomi/i },
  { key: 'tonkatsu',    re: /とんかつ|味噌かつ|tonkatsu/i },
  { key: 'steak',       re: /ステーキ|steak/i },
  { key: 'sukiyaki',    re: /すき焼|しゃぶしゃぶ|sukiyaki/i },
  { key: 'teppan',      re: /鉄板焼|teppan/i },
  { key: 'gyoza',       re: /餃子|gyoza/i },
  { key: 'chinese',     re: /中華|中国料理|chinese/i },
  { key: 'korean',      re: /韓国|korean/i },
  { key: 'italian',     re: /イタリアン|パスタ|italian/i },
  { key: 'french',      re: /フレンチ|french/i },
  { key: 'yoshoku',     re: /洋食|yoshoku/i },
  { key: 'seafood',     re: /海鮮|魚介|seafood/i },
  { key: 'washoku',     re: /和食|washoku|懐石|日本料理/i },
  { key: 'izakaya',     re: /居酒屋|izakaya|酒場/i },
  { key: 'bar',         re: /バー|bar|ワイン|カクテル/i },
  { key: 'cafe',        re: /カフェ|cafe|モーニング|morning|喫茶|コーヒー|coffee|焙煎|スペシャルティ|シングルオリジン|トースト|フレンチトースト|小倉トースト/i },
  { key: 'sweets',      re: /スイーツ|デザート|sweets|大福|プリン|チーズケーキ|パフェ|ジェラート|チョコレート|抹茶|かき氷|天然氷|甘味/i },
  { key: 'birthday',    re: /誕生日|サプライズ|記念日|birthday/i },
  { key: 'date',        re: /デート|date/i },
  { key: 'banquet',     re: /宴会|忘年会|大人数|banquet|large/i },
  { key: 'privateRoom', re: /個室|private/i },
  { key: 'girls',       re: /女子会|girls/i },
  { key: 'solo',        re: /一人|ソロ|solo/i },
  { key: 'settai',      re: /接待|settai|失敗しない/i },
  { key: 'reservation', re: /予約困難|reservation|hard.?to.?book/i },
  { key: 'insider',     re: /業界人|insider|目利き/i },
  { key: 'kospa',       re: /コスパ|kospa|お値打/i },
  { key: 'lunch',       re: /ランチ|lunch/i },
  { key: 'walk',        re: /食べ歩|food.?walk/i },
  { key: 'meieki',      re: /名駅|meieki/i },
  { key: 'sakae',       re: /栄|錦|sakae/i },
  { key: 'osu',         re: /大須|osu/i },
  { key: 'kakuozan',    re: /覚王山|kakuozan/i },
  { key: 'autumn',      re: /秋|autumn|fall/i },
  { key: 'summer',      re: /夏|summer/i },
  { key: 'spring',      re: /春|spring|テラス|terrace/i },
  { key: 'winter',      re: /冬|winter|忘年/i },
  { key: 'father',      re: /父の日|father/i },
  { key: 'mother',      re: /母の日|mother/i },
  { key: 'editorial',   re: /編集規約|editorial.?policy/i },
  { key: 'guide',       re: /完全ガイド|総合|guide|マニュアル/i },
  { key: 'diningbar',   re: /ダイニングバー|バル|dining.?bar/i },
];

function classifyGenre(text) {
  for (const r of GENRE_RULES) if (r.re.test(text)) return r.key;
  return 'guide';
}

// ─────────────────────────────────────────────────────────────
// ジャンル別カラーパレット & モチーフ
// ─────────────────────────────────────────────────────────────
const PALETTES = {
  ramen:       { from: '#8a2818', to: '#d65a2a', accent: '#fde8a8' },
  sushi:       { from: '#0e3a4a', to: '#3a6f80', accent: '#f4dac0' },
  yakiniku:    { from: '#3e0e08', to: '#8a2820', accent: '#f8c498' },
  yakitori:    { from: '#5a2a0a', to: '#a0501a', accent: '#fde2a0' },
  unagi:       { from: '#2a1a08', to: '#704a1a', accent: '#e8b870' },
  tebasaki:    { from: '#6a1a0a', to: '#b04020', accent: '#f4c890' },
  misoNikomi:  { from: '#3a2008', to: '#7a4818', accent: '#f0d098' },
  tonkatsu:    { from: '#4a2010', to: '#9a5020', accent: '#f4d8a0' },
  steak:       { from: '#3a0a0a', to: '#7a2818', accent: '#f0b890' },
  sukiyaki:    { from: '#5a0e0e', to: '#a0301e', accent: '#fde0a8' },
  teppan:      { from: '#2a2a30', to: '#6a4030', accent: '#f4c098' },
  gyoza:       { from: '#5a1a10', to: '#a04030', accent: '#f8d0a0' },
  chinese:     { from: '#6a0a0a', to: '#b02020', accent: '#fde0a0' },
  korean:      { from: '#5a0a0a', to: '#a02018', accent: '#f8c890' },
  italian:     { from: '#1a3a1a', to: '#4a7a3a', accent: '#f8e0a0' },
  french:      { from: '#2a0a3a', to: '#5a2a70', accent: '#f4d8c8' },
  yoshoku:     { from: '#3a1a08', to: '#7a3a18', accent: '#f4d098' },
  seafood:     { from: '#0a3a5a', to: '#2a6a9a', accent: '#e8e0c0' },
  washoku:     { from: '#1a2a4a', to: '#3a5a8a', accent: '#e8d8b8' },
  izakaya:     { from: '#3a1808', to: '#80401a', accent: '#fde2a8' },
  bar:         { from: '#0a1a3a', to: '#2a3a70', accent: '#e8d098' },
  cafe:        { from: '#2a1a0a', to: '#7a5a3a', accent: '#f4e0c0' },
  sweets:      { from: '#6a1a3a', to: '#c45a8a', accent: '#fde0e8' },
  birthday:    { from: '#5a1a4a', to: '#a04080', accent: '#fde0f0' },
  date:        { from: '#3a0a2a', to: '#80306a', accent: '#fdd0e0' },
  banquet:     { from: '#2a1a08', to: '#704818', accent: '#f8d0a0' },
  privateRoom: { from: '#1a1a1a', to: '#4a4a4a', accent: '#e8d098' },
  girls:       { from: '#5a1a4a', to: '#b05088', accent: '#fde8f0' },
  solo:        { from: '#1a1a2a', to: '#4a4a5a', accent: '#e8c098' },
  settai:      { from: '#0a0a1a', to: '#2a2a4a', accent: '#c4a060' },
  reservation: { from: '#1a0a0a', to: '#4a1a18', accent: '#e8b878' },
  insider:     { from: '#0a1a2a', to: '#2a4a6a', accent: '#e8c890' },
  kospa:       { from: '#1a3a1a', to: '#3a7a4a', accent: '#f4e090' },
  lunch:       { from: '#3a4a1a', to: '#7a9a3a', accent: '#fde8a8' },
  walk:        { from: '#5a3a08', to: '#a06a1a', accent: '#fde0a0' },
  meieki:      { from: '#1a2a3a', to: '#3a5a7a', accent: '#e8c890' },
  sakae:       { from: '#3a1a1a', to: '#80383a', accent: '#fde0a0' },
  osu:         { from: '#4a1a08', to: '#9a4818', accent: '#fde0a0' },
  kakuozan:    { from: '#2a1a3a', to: '#5a3a7a', accent: '#f4e0a8' },
  autumn:      { from: '#5a1a08', to: '#a04018', accent: '#fde0a0' },
  summer:      { from: '#0a3a5a', to: '#3a7aa0', accent: '#fde8a0' },
  spring:      { from: '#3a5a1a', to: '#7aa03a', accent: '#fde8c8' },
  winter:      { from: '#1a2a3a', to: '#3a5a7a', accent: '#f4d8c0' },
  father:      { from: '#1a2a3a', to: '#4a6a8a', accent: '#e8c098' },
  mother:      { from: '#5a1a3a', to: '#a04878', accent: '#fde0e8' },
  editorial:   { from: '#1a1a1a', to: '#3a3a3a', accent: '#c4a060' },
  guide:       { from: '#2a1a08', to: '#5a3a18', accent: '#c4a060' },
  diningbar:   { from: '#1a0a2a', to: '#3a1a5a', accent: '#e8c098' },
};

// ジャンル別モチーフ（600x260 内に配置する装飾SVG断片）
// 中央のタイトル領域を避け、左下・右下に大きめのオブジェクトを配置
function motif(genre, palette) {
  const a = palette.accent;
  switch (genre) {
    case 'ramen':
    case 'misoNikomi':
      // 丼 + 湯気
      return `
        <ellipse cx="500" cy="220" rx="80" ry="14" fill="${a}" opacity=".25"/>
        <path d="M420 210 q80 60 160 0 v-10 q-80 28 -160 0 z" fill="${a}" opacity=".55"/>
        <path d="M450 150 q5 -20 -5 -30 q-10 -10 0 -25" stroke="${a}" stroke-width="3" fill="none" opacity=".5"/>
        <path d="M500 145 q-5 -20 5 -30 q10 -10 0 -25" stroke="${a}" stroke-width="3" fill="none" opacity=".5"/>
        <path d="M550 155 q5 -20 -5 -30 q-10 -10 0 -25" stroke="${a}" stroke-width="3" fill="none" opacity=".5"/>`;
    case 'sushi':
      return `
        <rect x="430" y="195" width="150" height="30" rx="6" fill="${a}" opacity=".5"/>
        <path d="M430 195 q75 -28 150 0" fill="${a}" opacity=".35"/>`;
    case 'yakiniku':
    case 'yakitori':
    case 'steak':
    case 'tonkatsu':
    case 'sukiyaki':
    case 'teppan':
      // 網（グリル）
      return `
        <g opacity=".45" stroke="${a}" stroke-width="3" fill="none">
          <line x1="420" y1="210" x2="580" y2="210"/>
          <line x1="420" y1="195" x2="580" y2="195"/>
          <line x1="420" y1="180" x2="580" y2="180"/>
          <line x1="430" y1="170" x2="430" y2="225"/>
          <line x1="470" y1="170" x2="470" y2="225"/>
          <line x1="510" y1="170" x2="510" y2="225"/>
          <line x1="550" y1="170" x2="550" y2="225"/>
        </g>`;
    case 'izakaya':
      // 提灯
      return `
        <g opacity=".55">
          <ellipse cx="510" cy="190" rx="46" ry="55" fill="${a}"/>
          <rect x="496" y="135" width="28" height="6" fill="${a}"/>
          <rect x="496" y="244" width="28" height="6" fill="${a}"/>
          <line x1="510" y1="125" x2="510" y2="135" stroke="${a}" stroke-width="2"/>
        </g>`;
    case 'cafe':
      // コーヒーカップ
      return `
        <g opacity=".5" fill="${a}">
          <path d="M440 175 h100 v40 q0 20 -20 20 h-60 q-20 0 -20 -20 z"/>
          <path d="M540 185 q24 0 24 18 t-24 18" fill="none" stroke="${a}" stroke-width="4"/>
        </g>
        <path d="M470 160 q-4 -10 4 -18 q8 -8 0 -16" stroke="${a}" stroke-width="2.5" fill="none" opacity=".5"/>
        <path d="M510 155 q-4 -10 4 -18 q8 -8 0 -16" stroke="${a}" stroke-width="2.5" fill="none" opacity=".5"/>`;
    case 'bar':
    case 'diningbar':
      // マティーニグラス
      return `
        <g opacity=".55" fill="${a}">
          <path d="M460 160 l60 60 l60 -60 z"/>
          <rect x="516" y="220" width="8" height="35"/>
          <rect x="494" y="252" width="52" height="6"/>
        </g>`;
    case 'sweets':
    case 'birthday':
      // ケーキ
      return `
        <g opacity=".55" fill="${a}">
          <rect x="450" y="200" width="120" height="40" rx="4"/>
          <rect x="460" y="180" width="100" height="22"/>
          <circle cx="510" cy="172" r="3"/>
          <rect x="508" y="160" width="4" height="14"/>
        </g>`;
    case 'date':
      // キャンドル＋グラス
      return `
        <g opacity=".55" fill="${a}">
          <rect x="480" y="190" width="14" height="50"/>
          <path d="M487 188 q-6 -10 0 -22 q6 12 0 22"/>
          <path d="M530 200 q12 0 12 14 t-12 14 t-12 -14 t12 -14"/>
        </g>`;
    case 'banquet':
    case 'privateRoom':
    case 'girls':
    case 'solo':
      // 長卓・席の俯瞰
      return `
        <g opacity=".5" fill="${a}">
          <rect x="420" y="190" width="160" height="40" rx="6"/>
          <circle cx="440" cy="180" r="6"/>
          <circle cx="475" cy="180" r="6"/>
          <circle cx="510" cy="180" r="6"/>
          <circle cx="545" cy="180" r="6"/>
          <circle cx="440" cy="240" r="6"/>
          <circle cx="475" cy="240" r="6"/>
          <circle cx="510" cy="240" r="6"/>
          <circle cx="545" cy="240" r="6"/>
        </g>`;
    case 'unagi':
    case 'seafood':
      // 流線（魚）
      return `
        <g opacity=".5" stroke="${a}" stroke-width="3" fill="none">
          <path d="M420 200 q40 -25 80 0 q40 25 80 0"/>
          <path d="M420 220 q40 -25 80 0 q40 25 80 0"/>
        </g>`;
    case 'gyoza':
    case 'chinese':
      // 餃子（半月）
      return `
        <g opacity=".55" fill="${a}">
          <path d="M440 220 q40 -50 80 0 z"/>
          <path d="M510 220 q40 -50 80 0 z"/>
        </g>`;
    case 'korean':
      // 韓国（円形プレート）
      return `
        <g opacity=".5" fill="${a}">
          <circle cx="475" cy="205" r="35"/>
          <circle cx="540" cy="205" r="22"/>
        </g>`;
    case 'italian':
      // パスタ（渦）
      return `
        <g opacity=".5" stroke="${a}" stroke-width="3" fill="none">
          <circle cx="510" cy="200" r="35"/>
          <circle cx="510" cy="200" r="22"/>
          <circle cx="510" cy="200" r="10"/>
        </g>`;
    case 'french':
    case 'yoshoku':
      // ナイフ＆フォーク
      return `
        <g opacity=".55" stroke="${a}" stroke-width="3" fill="none">
          <line x1="490" y1="160" x2="490" y2="240"/>
          <path d="M484 160 v18 a6 6 0 0 0 12 0 v-18" fill="${a}"/>
          <line x1="525" y1="160" x2="525" y2="240"/>
          <path d="M522 160 q-8 18 0 36 q8 -18 0 -36" fill="${a}"/>
        </g>`;
    case 'tebasaki':
      // 手羽（くの字）
      return `
        <g opacity=".55" stroke="${a}" stroke-width="14" fill="none" stroke-linecap="round">
          <path d="M450 180 l30 30 l-15 30"/>
          <path d="M530 180 l30 30 l-15 30"/>
        </g>`;
    case 'washoku':
    case 'lunch':
      // 折敷＋椀
      return `
        <g opacity=".5" fill="${a}">
          <rect x="420" y="180" width="160" height="60" rx="4" fill="none" stroke="${a}" stroke-width="2"/>
          <circle cx="460" cy="210" r="16"/>
          <circle cx="510" cy="210" r="12"/>
          <circle cx="550" cy="210" r="10"/>
        </g>`;
    case 'autumn':
      // 紅葉（5角）
      return `
        <g opacity=".55" fill="${a}">
          <path d="M510 165 l12 22 l24 4 l-18 18 l4 24 l-22 -12 l-22 12 l4 -24 l-18 -18 l24 -4 z"/>
        </g>`;
    case 'summer':
      // 太陽
      return `
        <g opacity=".55" fill="${a}">
          <circle cx="510" cy="200" r="28"/>
          <g stroke="${a}" stroke-width="3">
            <line x1="510" y1="160" x2="510" y2="148"/>
            <line x1="510" y1="240" x2="510" y2="252"/>
            <line x1="470" y1="200" x2="458" y2="200"/>
            <line x1="550" y1="200" x2="562" y2="200"/>
            <line x1="482" y1="172" x2="473" y2="163"/>
            <line x1="538" y1="172" x2="547" y2="163"/>
            <line x1="482" y1="228" x2="473" y2="237"/>
            <line x1="538" y1="228" x2="547" y2="237"/>
          </g>
        </g>`;
    case 'spring':
      // 桜（5枚花弁）
      return `
        <g opacity=".55" fill="${a}">
          <circle cx="510" cy="170" r="10"/>
          <circle cx="540" cy="195" r="10"/>
          <circle cx="528" cy="230" r="10"/>
          <circle cx="492" cy="230" r="10"/>
          <circle cx="480" cy="195" r="10"/>
          <circle cx="510" cy="200" r="6"/>
        </g>`;
    case 'winter':
      // 雪結晶
      return `
        <g opacity=".5" stroke="${a}" stroke-width="3" fill="none">
          <line x1="510" y1="160" x2="510" y2="240"/>
          <line x1="470" y1="200" x2="550" y2="200"/>
          <line x1="480" y1="170" x2="540" y2="230"/>
          <line x1="480" y1="230" x2="540" y2="170"/>
        </g>`;
    case 'father':
      // ネクタイ
      return `
        <g opacity=".55" fill="${a}">
          <path d="M495 160 h30 l8 12 l-23 70 l-23 -70 z"/>
        </g>`;
    case 'mother':
      // カーネーション
      return `
        <g opacity=".55" fill="${a}">
          <path d="M500 180 q-10 -15 10 -22 q20 7 10 22 q10 15 -10 22 q-20 -7 -10 -22 z"/>
          <line x1="510" y1="200" x2="510" y2="245" stroke="${a}" stroke-width="3"/>
        </g>`;
    case 'meieki':
      // タワー（名駅）
      return `
        <g opacity=".55" fill="${a}">
          <polygon points="495,150 525,150 535,250 485,250"/>
          <rect x="500" y="135" width="20" height="20"/>
          <line x1="510" y1="120" x2="510" y2="135" stroke="${a}" stroke-width="2"/>
        </g>`;
    case 'sakae':
      // テレビ塔
      return `
        <g opacity=".55" fill="none" stroke="${a}" stroke-width="3">
          <polygon points="510,135 540,250 480,250" />
          <line x1="492" y1="200" x2="528" y2="200"/>
          <line x1="486" y1="225" x2="534" y2="225"/>
        </g>`;
    case 'osu':
      // 鳥居
      return `
        <g opacity=".55" fill="${a}">
          <rect x="450" y="160" width="120" height="12"/>
          <rect x="455" y="180" width="110" height="6"/>
          <rect x="468" y="186" width="10" height="64"/>
          <rect x="542" y="186" width="10" height="64"/>
        </g>`;
    case 'kakuozan':
      // 山並み
      return `
        <g opacity=".5" fill="${a}">
          <polygon points="420,250 470,180 510,220 550,170 590,250"/>
        </g>`;
    case 'settai':
    case 'reservation':
    case 'insider':
    case 'editorial':
    case 'guide':
      // 編集・業界（モノグラム枠）
      return `
        <g opacity=".4" fill="none" stroke="${a}" stroke-width="2">
          <rect x="430" y="160" width="160" height="90"/>
          <line x1="430" y1="178" x2="590" y2="178"/>
          <line x1="430" y1="232" x2="590" y2="232"/>
        </g>
        <text x="510" y="220" text-anchor="middle" fill="${a}" opacity=".6"
              font-family="'Hiragino Mincho ProN', 'Yu Mincho', serif"
              font-size="42" font-weight="700">NB</text>`;
    case 'kospa':
      // 円グラフ
      return `
        <g opacity=".55" fill="${a}">
          <path d="M510 165 a40 40 0 1 1 -0.1 0 z" opacity=".5"/>
          <path d="M510 165 a40 40 0 0 1 28 12 l-28 28 z"/>
        </g>`;
    case 'walk':
      // 足跡
      return `
        <g opacity=".5" fill="${a}">
          <ellipse cx="460" cy="195" rx="12" ry="16"/>
          <ellipse cx="500" cy="220" rx="12" ry="16"/>
          <ellipse cx="540" cy="195" rx="12" ry="16"/>
          <ellipse cx="580" cy="220" rx="12" ry="16"/>
        </g>`;
    default:
      // 汎用 — 皿
      return `
        <g opacity=".5" fill="${a}">
          <ellipse cx="510" cy="220" rx="80" ry="14"/>
          <ellipse cx="510" cy="205" rx="60" ry="10" fill="none" stroke="${a}" stroke-width="2"/>
        </g>`;
  }
}

// ─────────────────────────────────────────────────────────────
// SVG 生成
// ─────────────────────────────────────────────────────────────
function makeSvg({ title, category, genre }) {
  const p = PALETTES[genre] || PALETTES.guide;
  // タイトルは最大 14文字で2行に分ける（粗い分割）
  const lines = wrapTitle(title, 12);
  const titleY = lines.length === 1 ? 130 : 108;
  const titleEls = lines.map((l, i) => (
    `<text x="46" y="${titleY + i * 38}" fill="#fff" font-family="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif" font-size="32" font-weight="700" letter-spacing="0.02em">${escapeXml(l)}</text>`
  )).join('');
  const cat = escapeXml((category || '').replace(/\s*·\s*/g, ' · '));
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 260" width="600" height="260" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.from}"/>
      <stop offset="100%" stop-color="${p.to}"/>
    </linearGradient>
    <pattern id="grain" width="3" height="3" patternUnits="userSpaceOnUse">
      <rect width="3" height="3" fill="${p.from}"/>
      <circle cx="0.5" cy="0.5" r="0.4" fill="${p.accent}" opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="600" height="260" fill="url(#bg)"/>
  <rect width="600" height="260" fill="url(#grain)" opacity=".5"/>
  ${motif(genre, p)}
  <rect x="36" y="36" width="3" height="${lines.length === 1 ? 110 : 145}" fill="${p.accent}" opacity=".9"/>
  ${titleEls}
  <text x="46" y="60" fill="${p.accent}" opacity=".75" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10" font-weight="700" letter-spacing="0.3em">NAGOYA BITES</text>
</svg>
`;
  return svg;
}

function wrapTitle(s, max) {
  const t = String(s).replace(/\s+/g, '').replace(/[｜|｜]/g, '・');
  if (t.length <= max) return [t];
  // ・ や ／ で切れるならそこで
  const breaks = ['・', '／', '/', '〜', '|', '｜'];
  for (const b of breaks) {
    const i = t.indexOf(b);
    if (i > 4 && i < t.length - 3) return [t.slice(0, i), t.slice(i + 1)];
  }
  const mid = Math.ceil(t.length / 2);
  return [t.slice(0, mid), t.slice(mid)];
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ─────────────────────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────────────────────
function main() {
  const dryRun = process.argv.includes('--dry-run');
  const html = fs.readFileSync(INDEX, 'utf8');

  // <a class="article-card..." href="SLUG.html"> ... <img class="card-img" src="STOCK" alt="ALT">
  // <div class="card-category">CAT</div> をブロック単位で抽出
  const cardRe = /<a\s+class="article-card[^"]*"\s+href="([^"]+\.html)"[\s\S]*?<img\s+class="card-img"\s+src="([^"]+)"\s+alt="([^"]+)"[\s\S]*?<div\s+class="card-category">([^<]+)<\/div>/g;

  if (!fs.existsSync(FIGURE_DIR)) fs.mkdirSync(FIGURE_DIR, { recursive: true });

  const replacements = []; // {oldSrc, newSrc, slug, source}
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const [, href, src, alt, category] = m;
    const slug = href.replace(/\.html$/, '');
    if (!STOCK_HOST_RE.test(src)) { STOCK_HOST_RE.lastIndex = 0; continue; }
    STOCK_HOST_RE.lastIndex = 0;

    let newSrc;
    let source;
    const realJpg = path.join(REAL_PHOTO_DIR, `${slug}-600.jpg`);
    if (fs.existsSync(realJpg)) {
      newSrc = `../assets/features/${slug}-600.jpg`;
      source = 'real-photo';
    } else {
      const genre = classifyGenre(`${alt} ${category}`);
      const svg = makeSvg({ title: alt, category: category.trim(), genre });
      const outPath = path.join(FIGURE_DIR, `${slug}.svg`);
      if (!dryRun) fs.writeFileSync(outPath, svg, 'utf8');
      newSrc = `../assets/feature-figures/${slug}.svg`;
      source = `figure(${genre})`;
    }
    replacements.push({ oldSrc: src, newSrc, slug, source });
  }

  // src 文字列の一意性を確認しつつ置換
  let out = html;
  for (const r of replacements) {
    if (!out.includes(r.oldSrc)) continue;
    out = out.replace(r.oldSrc, r.newSrc);
  }

  if (!dryRun) fs.writeFileSync(INDEX, out, 'utf8');

  console.log(`Processed ${replacements.length} cards (dry-run: ${dryRun})`);
  const bySource = replacements.reduce((acc, r) => {
    const key = r.source.startsWith('figure') ? 'figure' : r.source;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  console.log('Sources:', bySource);
  replacements.slice(0, 10).forEach(r => console.log(`  ${r.slug} → ${r.source}`));
  if (replacements.length > 10) console.log(`  ... (+${replacements.length - 10} more)`);
}

if (require.main === module) main();
module.exports = { makeSvg, classifyGenre };
