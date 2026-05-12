'use strict';
/**
 * gen_store_og_svg.js
 *
 * 各店舗の og:image を NAGOYA BITES オリジナル SVG として生成し、
 * `assets/og/{HP_ID}.svg`（HP IDがない場合は slug）に書き出す。
 *
 * 配信は wsrv.nl (images.weserv.nl) を経由して SVG→PNG 変換する想定:
 *   https://wsrv.nl/?url=https://nagoya-bites.com/assets/og/{HP_ID}.svg&output=png&w=1200&h=630
 *
 * SVG はベクター固定サイズ 1200×630（Twitter Summary Large Image / Facebook OG 標準）。
 * 日本語は font-family の fallback により wsrv.nl 側の Noto / Sans でレンダリングされる。
 *
 * 実行: node scripts/gen_store_og_svg.js [--limit=N] [--dryrun]
 */

const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const INDEX    = path.join(ROOT, 'index.html');
const OUT_DIR  = path.join(ROOT, 'assets', 'og');

// ── ユーティリティ ────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 全角文字を 2、半角を 1 として幅換算（フォント幅近似）
function visualWidth(s) {
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code > 0x7f && !(code >= 0xff61 && code <= 0xff9f)) w += 2;
    else w += 1;
  }
  return w;
}

// 全角換算で n 幅以内になるよう切り詰め（…付き）
function truncate(s, maxWidth) {
  if (!s) return '';
  if (visualWidth(s) <= maxWidth) return s;
  let acc = '';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    const w = (code > 0x7f && !(code >= 0xff61 && code <= 0xff9f)) ? 2 : 1;
    if (visualWidth(acc) + w + 1 > maxWidth) break; // +1 for …
    acc += ch;
  }
  return acc + '…';
}

function shortArea(area) {
  // 「名古屋（名古屋駅/西区/中村区）」→「名駅」、「栄(ミナミ)/...」→「栄」等
  return String(area || '')
    .replace(/^名古屋（([^/）]+)[^）]*）$/, '$1')
    .split('/')[0]
    .replace(/[（(].*?[)）]/g, '')
    .replace('名古屋駅', '名駅')
    .trim();
}

function loadStores() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('LOCAL_STORES が見つかりません');
  return JSON.parse(m[1]);
}

// ── SVG テンプレート ──────────────────────────────────────
// 1200×630 / NAGOYA BITES ブランドカラー（gold #7a5c10、bg #f7f5f1、text #1c1c1a）
function buildSvg(store) {
  const name   = String(store['店名'] || '').trim();
  const genre  = String(store['ジャンル'] || '').trim();
  const area   = shortArea(store['エリア']);
  const price  = String(store['価格帯'] || '').trim();
  const rating = parseFloat(store['Google評価']) || 0;
  const isPick = store['編集部推薦'] === true || store['編集部推薦'] === 'true';

  // 店名は最大全角13幅（≒13文字）。長い場合は切り詰め
  const nameDisplay = truncate(name, 26); // 全角13幅 = 26ユニット
  const subParts = [];
  if (genre)  subParts.push(genre);
  if (area)   subParts.push(area);
  if (price)  subParts.push(price);
  const sub = truncate(subParts.join(' ・ '), 60);

  const ratingBadge = rating >= 4.0
    ? `<g transform="translate(80,460)">
        <rect x="0" y="0" width="220" height="56" rx="8" fill="#7a5c10"/>
        <text x="110" y="36" text-anchor="middle" fill="#f7f5f1" font-size="24" font-weight="600" font-family="'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif">★ Google ${rating.toFixed(1)}</text>
       </g>`
    : '';

  const pickBadge = isPick
    ? `<g transform="translate(${rating >= 4.0 ? 320 : 80},460)">
        <rect x="0" y="0" width="200" height="56" rx="8" fill="#1c1c1a"/>
        <text x="100" y="36" text-anchor="middle" fill="#f7f5f1" font-size="22" font-weight="600" font-family="'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif">✦ 編集部推薦</text>
       </g>`
    : '';

  // フォントは wsrv.nl/libvips のフォールバックを期待
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f7f5f1"/>
      <stop offset="100%" stop-color="#eeebe5"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <!-- ゴールド帯 -->
  <rect x="0" y="0" width="1200" height="8" fill="#7a5c10"/>
  <rect x="0" y="622" width="1200" height="8" fill="#7a5c10"/>
  <!-- ロゴ＋タグライン -->
  <g transform="translate(80,80)">
    <text x="0" y="0" font-size="34" font-weight="300" font-family="'Cormorant Garamond','Times New Roman',serif" letter-spacing="8" fill="#1c1c1a">NAGOYA <tspan font-style="italic" fill="#7a5c10">BITES</tspan></text>
    <text x="0" y="42" font-size="18" font-family="'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif" fill="rgba(28,28,26,0.6)">名古屋の飲食店選びの最終回答</text>
  </g>
  <!-- 店名 -->
  <g transform="translate(80,260)">
    <text x="0" y="0" font-size="72" font-weight="500" font-family="'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif" fill="#1c1c1a">${esc(nameDisplay)}</text>
  </g>
  <!-- ジャンル ・ エリア ・ 価格帯 -->
  <g transform="translate(80,330)">
    <text x="0" y="0" font-size="28" font-family="'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif" fill="rgba(28,28,26,0.7)">${esc(sub)}</text>
  </g>
  <!-- バッジ群 -->
  ${ratingBadge}
  ${pickBadge}
  <!-- フッター -->
  <g transform="translate(80,580)">
    <text x="0" y="0" font-size="20" font-family="'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif" fill="rgba(28,28,26,0.5)">業界人運営 ・ 広告ゼロ ・ nagoya-bites.com</text>
  </g>
</svg>
`;
}

// ── スラグ算出（gen-store-pages.js と整合） ─────────────────────
function toSlug(store) {
  const hp = (store['ホットペッパーID'] || '').trim();
  if (hp) return hp;
  // フォールバック: 店名を ASCII セーフ化
  const name = (store['店名'] || '').trim();
  return name.normalize('NFKC').replace(/[^\w\d-]/g, '_').slice(0, 60) || 'noname';
}

// ── メイン ────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const dryrun = args.includes('--dryrun');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  const stores = loadStores();
  console.log(`LOCAL_STORES: ${stores.length}件`);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const subset = LIMIT ? stores.slice(0, LIMIT) : stores;
  let written = 0;
  let skipped = 0;
  const seenSlugs = new Set();

  for (const s of subset) {
    if (!s['店名']) { skipped++; continue; }
    let slug = toSlug(s);
    if (seenSlugs.has(slug)) {
      // 同名衝突は数字 suffix
      let i = 2;
      while (seenSlugs.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
    seenSlugs.add(slug);

    const svg = buildSvg(s);
    const outPath = path.join(OUT_DIR, `${slug}.svg`);

    if (dryrun) {
      if (written < 3) console.log(`(dryrun) ${outPath}\n${svg.slice(0, 200)}...`);
    } else {
      fs.writeFileSync(outPath, svg, 'utf8');
    }
    written++;
  }

  console.log(`書き出し: ${written}件${dryrun ? '（dryrun）' : ''} / スキップ: ${skipped}件 → ${OUT_DIR}`);
}

main();
