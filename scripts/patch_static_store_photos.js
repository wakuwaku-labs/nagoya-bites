#!/usr/bin/env node
// 静的生成済みファイルの汎用ストック写真を実写 / 店舗固有イメージ図へ直接パッチする。
//
// 対象:
//   A) features/*.html の shop-card-photo（店舗ID→実写真を解決）
//   B) stores/*.html のヒーロー primary src（手動店の Pexels）＋ onerror フォールバック
//
// 解決ロジック:
//   - 店舗ID（shop-detail-link / ページ名）が J始まり → LOCAL_STORES[ホットペッパーID].写真URL（実写）
//   - 店名（alt）が manual_stores.json に一致 → その 写真URL（= store-figures SVG）
//   - どちらも無い → /assets/store-figures/_fallback.svg
//
// 使い方: node scripts/patch_static_store_photos.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FALLBACK = '/assets/store-figures/_fallback.svg';
const FIGURE_DIR = path.join(ROOT, 'assets', 'store-figures');

const { classifyGenre } = require('./replace_feature_card_images.js');
const { makeStoreSvg, slugFor } = require('./replace_manual_store_photos.js');

// 未マッチ店（データ無し）には店名入りの個別図を生成して self-host
function ensureFigureFor(name, dryRun) {
  if (!name) return FALLBACK;
  const slug = slugFor(name);
  const file = path.join(FIGURE_DIR, `${slug}.svg`);
  if (!dryRun && !fs.existsSync(file)) {
    fs.writeFileSync(file, makeStoreSvg({ name, genre: classifyGenre(name), area: '' }), 'utf8');
  }
  return `/assets/store-figures/${slug}.svg`;
}
const STOCK_RE = /https?:\/\/(?:images\.|cdn\.)?(?:unsplash|pexels|loremflickr|pixabay)\.com[^"'\s]*/g;

function loadLocalStores() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  const stores = JSON.parse(m[1]);
  const byHpId = new Map();
  const byName = new Map();
  for (const s of stores) {
    if (s['ホットペッパーID']) byHpId.set(s['ホットペッパーID'], s['写真URL'] || '');
    if (s['店名']) byName.set(s['店名'], s['写真URL'] || '');
  }
  return { byHpId, byName };
}

function loadManual() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'manual_stores.json'), 'utf8'));
  const byName = new Map();
  for (const s of data.stores) if (s['店名']) byName.set(s['店名'], s['写真URL'] || '');
  return byName;
}

const isStock = (u) => /unsplash|pexels|loremflickr|pixabay/i.test(u);
const isUsable = (u) => u && !isStock(u);
// 再解決対象: ストック写真 または 既存の店舗図SVG（実写が後から取れた店を差し替えるため）
const isReplaceable = (u) => isStock(u) || (typeof u === 'string' && u.includes('/assets/store-figures/'));

function resolvePhoto({ storeId, alt }, L, M) {
  // 1. 店舗ID が HotPepper（J始まり）→ LOCAL_STORES 実写
  if (storeId && /^J/i.test(storeId)) {
    const u = L.byHpId.get(storeId);
    if (isUsable(u)) return u;
  }
  // 2. 店名（alt）一致 → manual / local
  if (alt) {
    const mu = M.get(alt);
    if (isUsable(mu)) return mu;
    const lu = L.byName.get(alt);
    if (isUsable(lu)) return lu;
  }
  return FALLBACK;
}

function patchFeatures(L, M, dryRun) {
  const dir = path.join(ROOT, 'features');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');
  let fileCount = 0, imgCount = 0;

  for (const f of files) {
    const file = path.join(dir, f);
    const html = fs.readFileSync(file, 'utf8');
    if (!isStock(html) && !html.includes('/assets/store-figures/')) continue;

    // stock src または店舗図SVG を持つ全 <img> を alt（店名）ベースで解決（実写が取れた店は実写へ）
    // 店舗カード写真は class が shop-card-photo / store-card-img / 無印（.store-photo 内）など多様なため class 非依存
    let out = html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*?)>/g, (tag, pre, src, post) => {
      if (!isReplaceable(src)) return tag;
      const alt = ((pre + post).match(/alt="([^"]+)"/) || [, ''])[1];
      let resolved = resolvePhoto({ storeId: '', alt }, L, M);
      if (resolved === FALLBACK) resolved = ensureFigureFor(alt, dryRun); // データ無し店は店名入り個別図
      imgCount++;
      return tag.replace(src, resolved);
    });

    if (out !== html) {
      if (!dryRun) fs.writeFileSync(file, out, 'utf8');
      fileCount++;
    }
  }
  return { fileCount, imgCount };
}

function patchStores(L, M, dryRun) {
  const dir = path.join(ROOT, 'stores');
  if (!fs.existsSync(dir)) return { fileCount: 0, primaryCount: 0, onerrorCount: 0 };
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');
  let fileCount = 0, primaryCount = 0, onerrorCount = 0;

  for (const f of files) {
    const file = path.join(dir, f);
    const html = fs.readFileSync(file, 'utf8');
    if (!isStock(html) && !html.includes('/assets/store-figures/')) continue;
    const storeId = f.replace(/\.html$/, '');

    let out = html;

    // primary hero src が stock or 店舗図SVG（手動店）→ 解決（実写が取れた店は実写へ）
    out = out.replace(/(<img\s+class="hero-img"\s+src=")([^"]+)(")/g, (m, pre, src, post) => {
      if (!isReplaceable(src)) return m;
      const alt = (html.match(/<img\s+class="hero-img"[^>]*\balt="([^"]+)"/) || [, ''])[1];
      const resolved = resolvePhoto({ storeId, alt }, L, M);
      primaryCount++;
      return pre + resolved + post;
    });

    // onerror フォールバックの stock → 中立フォールバックSVG
    out = out.replace(/onerror="this\.(?:onerror=null;)?src='[^']*(?:unsplash|pexels|loremflickr|pixabay)[^']*'"/g, () => {
      onerrorCount++;
      return `onerror="this.onerror=null;this.src='${FALLBACK}'"`;
    });

    // og:image / twitter:image / JSON-LD image を hero に合わせて絶対URL化
    // （stock もしくは store-figures を指している場合のみ差し替え）
    const heroNow = (out.match(/<img\s+class="hero-img"\s+src="([^"]+)"/) || [, ''])[1];
    const ogAbs = !heroNow ? 'https://nagoya-bites.com' + FALLBACK
      : heroNow.startsWith('http') ? heroNow
      : 'https://nagoya-bites.com' + heroNow;
    const ogReplaceable = (url) => isStock(url) || url.includes('/assets/store-figures/');
    out = out.replace(/(<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content=")([^"]+)(")/g,
      (m, pre, url, post) => ogReplaceable(url) ? pre + ogAbs + post : m);
    out = out.replace(/("image"\s*:\s*")([^"]+)(")/g,
      (m, pre, url, post) => ogReplaceable(url) ? pre + ogAbs + post : m);

    if (out !== html) {
      if (!dryRun) fs.writeFileSync(file, out, 'utf8');
      fileCount++;
    }
  }
  return { fileCount, primaryCount, onerrorCount };
}

// OG用: hero の解決済みURL（root相対）を返す。stock以外ならそれを優先
function resolveForMeta(html, storeId, L, M) {
  const heroSrc = (html.match(/<img\s+class="hero-img"\s+src="([^"]+)"/) || [, ''])[1];
  if (isUsable(heroSrc)) return heroSrc.startsWith('http') ? null /* 絶対URLはそのまま使えないので og は元維持不可→fallback */ : heroSrc;
  return null;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const L = loadLocalStores();
  const M = loadManual();

  const fr = patchFeatures(L, M, dryRun);
  const sr = patchStores(L, M, dryRun);

  console.log(`(dry-run: ${dryRun})`);
  console.log(`features: ${fr.fileCount} files, ${fr.imgCount} shop-card images patched`);
  console.log(`stores:   ${sr.fileCount} files (primary:${sr.primaryCount}, onerror:${sr.onerrorCount})`);
}

if (require.main === module) main();
