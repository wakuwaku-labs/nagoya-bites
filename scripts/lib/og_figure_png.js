'use strict';
/**
 * scripts/lib/og_figure_png.js
 *
 * assets/journal-figures/*.svg を OGP 用の 1200x630 PNG に変換する唯一の情報源。
 *
 * なぜ必要か:
 *   X / Facebook / LINE の OGP クローラは SVG をレンダリングしない。
 *   図解を og:image に指定した記事はSNS共有時にサムネイルが出ず、
 *   日次ジャーナルのSNS手動投稿（主要導線）の CTR を丸ごと落とす。
 *
 * 依存追加をしない方針（CLAUDE.md 制約4）のため npm パッケージは使わない。
 * 代わりに「マシンに既にあるラスタライザ」を探して呼ぶ:
 *   1. Chrome / Chromium ヘッドレス  … macOS ローカル・ubuntu Actions の両方にある
 *   2. rsvg-convert (librsvg)        … 入っている環境向けのフォールバック
 *
 * 変換方法（1200x630 への収め方）:
 *   元の図は viewBox が 600x260 等で OGP 比（1.91:1）と一致しない。
 *   そこで 1200x630 の「ラッパーSVG」を組み、元SVGを等比縮小して中央に入れ子にする。
 *   背景は元SVGの全面 <rect> の fill をそのまま流用する（多くは url(#bg) のグラデーション。
 *   gradientUnits は既定の objectBoundingBox なのでラッパー全面に伸びて余白の継ぎ目が出ない）。
 *   ＝ 画素を発明せず（制約9の禁止事項）、元の図をそのまま拡大するだけ。
 *
 * 検証は自己申告ではなく事実で行う（制約10）:
 *   出力PNGの IHDR を読んで実寸が 1200x630 であることを確認してから成功とする。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SITE_ORIGIN = 'https://nagoya-bites.com';

/**
 * 図解SVGを置くディレクトリ（記事の og:image が指しうる場所）。
 * journal（日次）と features（特集）で同じ問題・同じ配信経路なので同じ仕組みで扱う。
 */
const FIGURE_DIRS_REL = ['assets/journal-figures', 'assets/feature-figures'];
const FIGURE_DIRS = FIGURE_DIRS_REL.map(r => path.join(ROOT, r));

// 後方互換（既存の呼び出し向け）: 日次ジャーナルの図解ディレクトリ
const FIGURES_REL = FIGURE_DIRS_REL[0];
const FIGURES_DIR = FIGURE_DIRS[0];

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/** 全面 rect の fill が拾えなかったときの最終フォールバック（ブランドの濃紺） */
const FALLBACK_BG = '#0f1720';

// --------------------------------------------------------------------------
// ラスタライザの探索
// --------------------------------------------------------------------------

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.CHROMIUM_PATH,
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  // Linux（GitHub Actions ubuntu ランナーには google-chrome / chromium が入っている）
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
].filter(Boolean);

function whichBin(name) {
  try {
    return execFileSync('command', ['-v', name], { shell: true, encoding: 'utf8' }).trim() || null;
  } catch (_) {
    return null;
  }
}

let _rasterizerCache;

/**
 * 使えるラスタライザを1つ返す。無ければ null。
 * @returns {{kind:'chrome'|'rsvg', bin:string}|null}
 */
function findRasterizer() {
  if (_rasterizerCache !== undefined) return _rasterizerCache;

  for (const p of CHROME_CANDIDATES) {
    if (p && fs.existsSync(p)) { _rasterizerCache = { kind: 'chrome', bin: p }; return _rasterizerCache; }
  }
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const p = whichBin(name);
    if (p) { _rasterizerCache = { kind: 'chrome', bin: p }; return _rasterizerCache; }
  }
  const rsvg = whichBin('rsvg-convert');
  if (rsvg) { _rasterizerCache = { kind: 'rsvg', bin: rsvg }; return _rasterizerCache; }

  _rasterizerCache = null;
  return null;
}

function rasterizerHint() {
  return [
    'SVG→PNG のラスタライザが見つかりません。以下のいずれかを用意してください:',
    '  - Google Chrome / Chromium（推奨・追加依存なし）',
    '  - CHROME_PATH=/path/to/chrome を環境変数で明示',
    '  - rsvg-convert（macOS: brew install librsvg / ubuntu: apt-get install librsvg2-bin）',
  ].join('\n');
}

// --------------------------------------------------------------------------
// ラッパーSVGの組み立て
// --------------------------------------------------------------------------

function stripProlog(svgText) {
  return svgText
    .replace(/^﻿/, '')
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .trim();
}

function parseAttrs(tag) {
  const attrs = {};
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tag))) attrs[m[1]] = m[2];
  return attrs;
}

function parseLength(v) {
  if (v == null) return NaN;
  const n = parseFloat(String(v).replace(/px$/, ''));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * 元SVGの「全面を覆う最初の <rect>」の fill を返す。
 * url(#bg) 等のグラデーション参照もそのまま返す（ラッパー側で再解決される）。
 */
function extractCanvasFill(svgText, vbWidth, vbHeight) {
  const re = /<rect\b[^>]*>/g;
  let m;
  while ((m = re.exec(svgText))) {
    const a = parseAttrs(m[0]);
    if (!a.fill || a.fill === 'none') continue;
    const w = a.width === '100%' ? vbWidth : parseLength(a.width);
    const h = a.height === '100%' ? vbHeight : parseLength(a.height);
    const x = parseLength(a.x || '0');
    const y = parseLength(a.y || '0');
    if (!Number.isFinite(w) || !Number.isFinite(h)) continue;
    // 全面（誤差1%まで許容）かつ原点付近から始まる矩形だけを背景とみなす
    if (w >= vbWidth * 0.99 && h >= vbHeight * 0.99 && (x || 0) <= 1 && (y || 0) <= 1) {
      // pattern（grain 等のオーバーレイ）は背景色として使わない
      if (/^url\(#/.test(a.fill) && /pattern/i.test(a.fill)) continue;
      return a.fill;
    }
  }
  return null;
}

/**
 * 元SVGを 1200x630 の中央に等比で入れ子にしたラッパーSVGを返す。
 * @param {string} svgText 元SVGの中身
 * @returns {string}
 */
function buildWrapperSvg(svgText) {
  const inner = stripProlog(svgText);
  const rootMatch = inner.match(/^<svg\b[^>]*>/);
  if (!rootMatch) throw new Error('ルート <svg> タグが見つかりません');
  const rootAttrs = parseAttrs(rootMatch[0]);

  let vbX = 0, vbY = 0, vbW, vbH;
  if (rootAttrs.viewBox) {
    const p = rootAttrs.viewBox.trim().split(/[\s,]+/).map(Number);
    if (p.length !== 4 || p.some(n => !Number.isFinite(n))) throw new Error(`viewBox が不正: ${rootAttrs.viewBox}`);
    [vbX, vbY, vbW, vbH] = p;
  } else {
    vbW = parseLength(rootAttrs.width);
    vbH = parseLength(rootAttrs.height);
  }
  if (!Number.isFinite(vbW) || !Number.isFinite(vbH) || vbW <= 0 || vbH <= 0) {
    throw new Error('SVG の寸法（viewBox / width / height）を決定できません');
  }

  // contain フィット（切り取らない — 図の情報を落とさないため）
  const scale = Math.min(OG_WIDTH / vbW, OG_HEIGHT / vbH);
  const w = vbW * scale;
  const h = vbH * scale;
  const x = (OG_WIDTH - w) / 2;
  const y = (OG_HEIGHT - h) / 2;

  const bg = extractCanvasFill(inner, vbW, vbH) || FALLBACK_BG;

  const nested = inner.replace(
    /^<svg\b[^>]*>/,
    // overflow は既定（hidden）のまま。記事内で表示される SVG と同じ見え方にするため、
    // viewBox からはみ出す要素は PNG でも同じように切る（元図の見切れを PNG だけ直さない）。
    `<svg x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}"` +
    ` viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet">`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"` +
    ` width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">\n` +
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${bg}"/>\n${nested}\n</svg>\n`;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

// --------------------------------------------------------------------------
// PNG の実寸検証（自己申告ではなく事実で判定・制約10）
// --------------------------------------------------------------------------

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * PNG ファイルの IHDR を読んで実寸を返す。PNG でなければ null。
 * @returns {{width:number, height:number}|null}
 */
function readPngSize(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(24);
    if (fs.readSync(fd, buf, 0, 24, 0) < 24) return null;
    if (!buf.subarray(0, 8).equals(PNG_MAGIC)) return null;
    if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch (_) {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch (_) {}
  }
}

// --------------------------------------------------------------------------
// 変換本体
// --------------------------------------------------------------------------

function renderWithChrome(bin, wrapperPath, pngPath) {
  // 注意: --user-data-dir は付けないこと。
  // macOS の Chrome は使い捨てプロファイルを渡すとスクリーンショット出力後もプロセスが終了せず、
  // 毎回タイムアウトする（実測・2026-08-17）。既定プロファイルのままで --screenshot は問題なく動く。
  const args = [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',                 // Actions のコンテナで必要
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--window-size=${OG_WIDTH},${OG_HEIGHT}`,
    '--virtual-time-budget=3000',   // フォント適用が終わるのを待つ
    `--screenshot=${pngPath}`,
    `file://${wrapperPath}`,
  ];
  const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 60000 });
  if (r.error) throw r.error;
  if (!fs.existsSync(pngPath)) {
    throw new Error(`Chrome がPNGを出力しませんでした (exit ${r.status})\n${(r.stderr || '').slice(-500)}`);
  }
}

function renderWithRsvg(bin, wrapperPath, pngPath) {
  const r = spawnSync(bin, ['-w', String(OG_WIDTH), '-h', String(OG_HEIGHT), '-o', pngPath, wrapperPath],
    { encoding: 'utf8', timeout: 60000 });
  if (r.error) throw r.error;
  if (r.status !== 0 || !fs.existsSync(pngPath)) {
    throw new Error(`rsvg-convert が失敗しました (exit ${r.status})\n${(r.stderr || '').slice(-500)}`);
  }
}

/**
 * SVG を 1200x630 の PNG に変換して書き出す。
 * @param {string} svgPath 元SVGの絶対パス
 * @param {string} pngPath 出力PNGの絶対パス
 * @param {{rasterizer?:{kind:string,bin:string}}} [opts]
 * @returns {{renderer:string, bytes:number, width:number, height:number}}
 */
function renderSvgToPng(svgPath, pngPath, opts = {}) {
  const rast = opts.rasterizer || findRasterizer();
  if (!rast) throw new Error(rasterizerHint());

  const wrapper = buildWrapperSvg(fs.readFileSync(svgPath, 'utf8'));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-og-'));
  const wrapperPath = path.join(tmpDir, 'wrapper.svg');
  const tmpPng = path.join(tmpDir, 'out.png');
  fs.writeFileSync(wrapperPath, wrapper);

  try {
    if (rast.kind === 'chrome') renderWithChrome(rast.bin, wrapperPath, tmpPng);
    else renderWithRsvg(rast.bin, wrapperPath, tmpPng);

    // 事実確認: 出力が本当に 1200x630 の PNG か（ここを通ったものだけ採用する）
    const size = readPngSize(tmpPng);
    if (!size) throw new Error('出力がPNGとして読めません');
    if (size.width !== OG_WIDTH || size.height !== OG_HEIGHT) {
      throw new Error(`出力サイズが ${size.width}x${size.height} で ${OG_WIDTH}x${OG_HEIGHT} ではありません`);
    }

    fs.mkdirSync(path.dirname(pngPath), { recursive: true });
    fs.copyFileSync(tmpPng, pngPath);
    return { renderer: rast.kind, bytes: fs.statSync(pngPath).size, ...size };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// --------------------------------------------------------------------------
// パス / URL のユーティリティ
// --------------------------------------------------------------------------

/** SVGパス → 併置するPNGパス */
function pngPathForSvg(svgPath) {
  return svgPath.replace(/\.svg$/i, '.png');
}

/** figure の「ディレクトリ相対パス」→ 絶対URL（例: assets/journal-figures/a.png） */
function absoluteFigureUrl(relPath) {
  // 後方互換: ファイル名だけ渡された場合は journal-figures 配下とみなす
  const rel = relPath.includes('/') ? relPath : `${FIGURES_REL}/${relPath}`;
  return `${SITE_ORIGIN}/${rel}`;
}

const FIGURE_DIR_ALT = FIGURE_DIRS_REL
  .map(d => d.replace('assets/', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

/**
 * og:image の値が図解ディレクトリの SVG を指しているなら、
 * リポジトリ相対パス（assets/xxx-figures/name.svg）を返す。
 * 相対（../assets/... / ./assets/... / /assets/...）と絶対URLの両方を受ける。
 */
function matchFigureSvgUrl(url) {
  const hit = matchFigureUrl(url);
  return hit && hit.ext === 'svg' ? hit.rel : null;
}

/**
 * og:image の値が図解ディレクトリの SVG / PNG を指しているなら、
 * 元SVGのリポジトリ相対パスと実際の拡張子を返す。
 *
 * 正規化後の記事は og:image が PNG を指すため、PNG も辿れないと
 * 「PNGが最新か」の検査が対象0件になって空振りする（＝検知でなくなる）。
 * @returns {{rel:string, ext:'svg'|'png'}|null} rel は常に .svg（生成元）
 */
function matchFigureUrl(url) {
  if (!url) return null;
  const re = new RegExp(`(?:^|/)assets/(${FIGURE_DIR_ALT})/([^/?#"']+)\\.(svg|png)(?:[?#]|$)`, 'i');
  const m = String(url).match(re);
  if (!m) return null;
  return { rel: `assets/${m[1]}/${m[2]}.svg`, ext: m[3].toLowerCase() };
}

/** 図解ディレクトリ配下の全SVGを、リポジトリ相対パスで列挙する */
function listFigureSvgs() {
  const out = [];
  FIGURE_DIRS_REL.forEach((relDir, i) => {
    const dir = FIGURE_DIRS[i];
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.svg'))
      .sort()
      .forEach(f => out.push(`${relDir}/${f}`));
  });
  return out;
}

/** PNG が既に最新か（存在し、SVGより新しい）。ローカルでの再生成スキップ判定専用。
 *  mtime 比較を含むため、git checkout でファイルmtimeが再現されない CI 環境の
 *  合否判定には使わないこと（→ isPngDimensionsOk を使う）。 */
function isPngFresh(svgPath, pngPath) {
  if (!fs.existsSync(pngPath)) return false;
  const size = readPngSize(pngPath);
  if (!size || size.width !== OG_WIDTH || size.height !== OG_HEIGHT) return false;
  return fs.statSync(pngPath).mtimeMs >= fs.statSync(svgPath).mtimeMs;
}

/** PNG の実寸が配信可能な状態か（IHDR実寸のみで判定・mtime不問）。
 *  CI の --check ゲート用。actions/checkout はコミット時刻ではなく checkout 時刻を
 *  mtime に使うため、SVG/PNG の mtime 前後関係はチェックアウトの書き込み順で
 *  ほぼランダムに決まり、isPngFresh の mtime 比較を CI の合否に使うと「今回はこの
 *  ファイル、次回は別のファイル」という形で無関係なファイルが日替わりで
 *  false-positive の不足報告に上がる（2026-08-18実測）。CLAUDE.md 制約10
 *  「後から第三者が確認できる事実だけで判定する」に沿い、CIでは検証可能な
 *  PNGの実寸だけを見る。 */
function isPngDimensionsOk(pngPath) {
  if (!fs.existsSync(pngPath)) return false;
  const size = readPngSize(pngPath);
  return !!size && size.width === OG_WIDTH && size.height === OG_HEIGHT;
}

module.exports = {
  OG_WIDTH,
  OG_HEIGHT,
  SITE_ORIGIN,
  ROOT,
  FIGURES_DIR,
  FIGURES_REL,
  FIGURE_DIRS,
  FIGURE_DIRS_REL,
  listFigureSvgs,
  findRasterizer,
  rasterizerHint,
  buildWrapperSvg,
  renderSvgToPng,
  readPngSize,
  pngPathForSvg,
  absoluteFigureUrl,
  matchFigureSvgUrl,
  matchFigureUrl,
  isPngFresh,
  isPngDimensionsOk,
};
