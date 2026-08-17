#!/usr/bin/env node
'use strict';
/**
 * journal/*.html と features/*.html の OGP メタタグを整える（OGPメタタグの正本）。
 *  1. HotPepper の _238.jpg は _480.jpg に格上げ（同URLで存在する大判）
 *  2. 図解SVGを指している og:image / twitter:image を、併置の 1200x630 PNG（絶対URL）に差し替える
 *  3. 相対パスの og:image / twitter:image を絶対URLにする
 *  4. og:image の現値からサイズを推定し、og:image:width / og:image:height を必ず付ける
 *
 * なぜ 2 が要るか:
 *   X / Facebook / LINE の OGP クローラは SVG をレンダリングしない。
 *   図解を og:image にした記事はSNS共有でサムネイルが出ず、
 *   日次ジャーナルのSNS手動投稿（主要導線）の CTR を丸ごと落とす。
 *   PNG は scripts/render_og_figures.js が生成する（記事本文の <img> は SVG のまま）。
 *
 * なぜ 3 が要るか:
 *   OGP クローラは記事URLを基準に相対パスを解決してくれない。絶対URLでないと画像が出ない。
 *
 * 推定ルール:
 *   - assets/journal-figures/*.png ⇒ 1200x630（render_og_figures.js の出力仕様）
 *   - Unsplash with w=1200&h=630 ⇒ 1200x630
 *   - imgfp.hotp.jp .../P*_480.jpg ⇒ 480x320 (HotPepperの_480系の典型比3:2)
 *   - icon-512.png ⇒ 512x512
 *   - 不明 ⇒ そのままスキップ
 *
 * 使い方:
 *   node scripts/normalize_og_images.js               # 修正を書き込む
 *   node scripts/normalize_og_images.js --only <語>   # ファイル名部分一致で対象を絞る
 *   node scripts/normalize_og_images.js --check       # 書き込まず検査（違反あり= exit 1・CI向け）
 *
 * --only は日次ジャーナルのラッパー（run_journal_local.sh）用。
 * ラッパーは surgical に git add するため、当日と無関係な過去記事まで書き換えると
 * 作業ツリーが汚れたまま残り、翌日の git pull を壊す（既知の故障モード）。
 */
const fs = require('fs');
const path = require('path');
const F = require('./lib/og_figure_png.js');

const ROOT = path.join(__dirname, '..');
const TARGET_DIRS = ['journal', 'features'];
const SITE_ORIGIN = F.SITE_ORIGIN;

function listHtml(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => f.endsWith('.html') && f !== '_template.html')
    .map(f => path.join(abs, f));
}

function inferDims(url) {
  if (!url) return null;
  // HTMLエンコードされた &amp; も & として扱う
  const decoded = url.replace(/&amp;/g, '&');
  if (/\/assets\/(?:journal|feature)-figures\/[^/?#]+\.png/i.test(decoded)) return { w: F.OG_WIDTH, h: F.OG_HEIGHT };
  const m1 = decoded.match(/[?&]w=(\d+)&h=(\d+)/);
  if (m1) return { w: parseInt(m1[1], 10), h: parseInt(m1[2], 10) };
  if (/icon-512\.png/.test(decoded)) return { w: 512, h: 512 };
  if (/imgfp\.hotp\.jp\/.+_480\.jpg/.test(decoded)) return { w: 480, h: 320 };
  if (/imgfp\.hotp\.jp\/.+_238\.jpg/.test(decoded)) return { w: 238, h: 158 };
  return null;
}

function upgradeHotpepperUrl(url) {
  return url.replace(/(imgfp\.hotp\.jp\/.+?)_238(\.jpg)/g, '$1_480$2');
}

/** テンプレートのプレースホルダ等、URLとして扱ってはいけない値 */
function isPlaceholder(url) {
  return !url || /^\{\{.*\}\}$/.test(url.trim());
}

function isAbsolute(url) {
  return /^https?:\/\//i.test(url) || /^\/\//.test(url);
}

/**
 * 記事HTMLからの相対パスを、サイトの絶対URLに直す。
 * 例: journal/x.html の "../assets/a.png" → https://nagoya-bites.com/assets/a.png
 */
function toAbsoluteUrl(url, filePath) {
  if (isAbsolute(url) || isPlaceholder(url)) return url;
  if (url.startsWith('data:')) return url;
  const fileDir = path.dirname(filePath);
  const abs = url.startsWith('/')
    ? path.join(ROOT, url)
    : path.resolve(fileDir, url);
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  if (rel.startsWith('..')) return url; // リポジトリ外は触らない
  return `${SITE_ORIGIN}/${rel}`;
}

/**
 * 図解SVGを指すURLを、併置PNGの絶対URLに差し替える。
 * PNG が実在するときだけ差し替える（存在しないURLに書き換えて壊さないため）。
 * @returns {{url:string, missingPng:string|null}}
 */
function svgToPngUrl(url) {
  const rel = F.matchFigureSvgUrl(url);
  if (!rel) return { url, missingPng: null };
  const pngRel = rel.replace(/\.svg$/i, '.png');
  const size = F.readPngSize(path.join(ROOT, pngRel));
  if (!size || size.width !== F.OG_WIDTH || size.height !== F.OG_HEIGHT) {
    return { url, missingPng: pngRel };
  }
  return { url: F.absoluteFigureUrl(pngRel), missingPng: null };
}

function ensureOgDims(html, prop, dims) {
  // 既存の og:image:width / og:image:height がある場合は値を更新、無ければ og:image の直後に挿入
  const widthRe = new RegExp(`<meta\\s+property="${prop}:width"\\s+content="\\d+">`);
  const heightRe = new RegExp(`<meta\\s+property="${prop}:height"\\s+content="\\d+">`);
  const widthMeta = `<meta property="${prop}:width" content="${dims.w}">`;
  const heightMeta = `<meta property="${prop}:height" content="${dims.h}">`;

  if (widthRe.test(html)) html = html.replace(widthRe, widthMeta);
  else {
    const baseRe = new RegExp(`(<meta\\s+property="${prop}"\\s+content="[^"]+">)`);
    if (baseRe.test(html)) html = html.replace(baseRe, `$1\n${widthMeta}`);
  }
  if (heightRe.test(html)) html = html.replace(heightRe, heightMeta);
  else {
    const widthMetaRe = new RegExp(`(<meta\\s+property="${prop}:width"\\s+content="\\d+">)`);
    if (widthMetaRe.test(html)) html = html.replace(widthMetaRe, `$1\n${heightMeta}`);
  }
  return html;
}

/** og:image / twitter:image の meta タグを列挙する */
const IMAGE_META_RE = /<meta\s+(property|name)="(og:image|twitter:image)"\s+content="([^"]*)">/g;

function processFile(fp, { check }) {
  const original = fs.readFileSync(fp, 'utf8');
  let html = original;
  const issues = [];

  // 1) HotPepper _238 → _480
  html = upgradeHotpepperUrl(html);

  // 2) 図解SVG → 併置PNG（絶対URL） / 3) 相対 → 絶対
  html = html.replace(IMAGE_META_RE, (tag, kind, prop, url) => {
    if (isPlaceholder(url)) return tag;
    let next = url;

    const svg = svgToPngUrl(next);
    if (svg.missingPng) {
      issues.push(`${prop} が SVG を指しているが PNG が未生成: ${svg.missingPng}`);
    }
    next = svg.url;

    const wasRelative = !isAbsolute(next) && !next.startsWith('data:');
    next = toAbsoluteUrl(next, fp);
    if (wasRelative && !isAbsolute(next)) {
      issues.push(`${prop} が相対パスのまま解決できない: ${url}`);
    }

    if (/\.svg(?:[?#]|$)/i.test(next)) {
      issues.push(`${prop} が SVG のまま（SNSクローラは描画しない）: ${next}`);
    }

    return next === url ? tag : `<meta ${kind}="${prop}" content="${next}">`;
  });

  // 4) og:image の width/height
  const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)">/);
  if (ogMatch && !isPlaceholder(ogMatch[1])) {
    const dims = inferDims(ogMatch[1]);
    if (dims) html = ensureOgDims(html, 'og:image', dims);
  }
  // twitter:image はサイズメタが標準でないので width/height は付けない（Twitterは og:image:width/height も読む）

  const changed = html !== original;
  if (changed && !check) fs.writeFileSync(fp, html);
  return { changed, issues };
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const onlyIdx = argv.indexOf('--only');
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

  let files = TARGET_DIRS.flatMap(listHtml);
  if (only) files = files.filter(f => path.basename(f).includes(only));

  let changed = 0;
  const problems = [];
  for (const f of files) {
    const r = processFile(f, { check });
    if (r.changed) changed++;
    if (r.issues.length) problems.push({ file: path.relative(ROOT, f), issues: r.issues });
  }

  if (check) {
    // --check では「書き換えが必要な状態＝未整形」も違反として扱う（CIで退行を止める）
    if (changed === 0 && problems.length === 0) {
      console.log(`✅ OGP画像メタ: ${files.length}件すべて絶対URL・PNG・サイズ付きです。`);
      return;
    }
    if (changed > 0) {
      console.error(`❌ OGP画像メタが未整形: ${changed}/${files.length}件`);
      console.error('   修復: node scripts/normalize_og_images.js');
    }
    for (const p of problems) {
      console.error(`   - ${p.file}`);
      p.issues.forEach(i => console.error(`       ${i}`));
    }
    if (problems.some(p => p.issues.some(i => i.includes('PNG が未生成')))) {
      console.error('   PNG生成: node scripts/render_og_figures.js');
    }
    process.exit(1);
  }

  console.log(`Updated ${changed}/${files.length} files`);
  for (const p of problems) {
    console.warn(`⚠️  ${p.file}`);
    p.issues.forEach(i => console.warn(`     ${i}`));
  }
  if (problems.length) {
    console.warn('\n   PNGが未生成の場合: node scripts/render_og_figures.js');
  }
}

if (require.main === module) main();
module.exports = { inferDims, toAbsoluteUrl, svgToPngUrl };
