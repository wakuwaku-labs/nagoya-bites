#!/usr/bin/env node
'use strict';
/**
 * scripts/render_og_figures.js
 *
 * assets/journal-figures/*.svg → 同名 .png（1200x630）を生成する。
 *
 * X / Facebook / LINE は og:image の SVG をレンダリングしない。
 * 図解を og:image にしている記事はSNS共有でサムネイルが出ないため、
 * 配信用に PNG を併置して og:image はそちらを指す（記事本文の <img> は SVG のまま）。
 *
 * 使い方:
 *   node scripts/render_og_figures.js              # 記事が og:image で参照している図のうち、未生成/古いものだけ
 *   node scripts/render_og_figures.js --all        # 参照有無に関わらず全SVG
 *   node scripts/render_og_figures.js --force      # 既存PNGも作り直す
 *   node scripts/render_og_figures.js --only <名前>  # ファイル名の部分一致で対象を絞る
 *   node scripts/render_og_figures.js --check      # 生成せず、不足を報告（不足あり= exit 1・CI向け）
 *
 * 判定は検証できる事実だけで行う（CLAUDE.md 制約10）:
 *   PNG の IHDR を読んだ実寸が 1200x630 であること・SVGより新しいこと。
 */

const fs = require('fs');
const path = require('path');
const F = require('./lib/og_figure_png.js');

const ROOT = path.join(__dirname, '..');
const JOURNAL_DIR = path.join(ROOT, 'journal');
const FEATURES_DIR = path.join(ROOT, 'features');

/**
 * 記事HTMLの og:image / twitter:image が参照している figure（生成元SVGのリポジトリ相対パス）の集合。
 * 正規化後は og:image が PNG を指すため、SVG参照・PNG参照の両方を辿って元SVGに正規化する。
 */
function referencedSvgs() {
  const refs = new Set();
  for (const dir of [JOURNAL_DIR, FEATURES_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.html')) continue;
      const html = fs.readFileSync(path.join(dir, f), 'utf8');
      const re = /<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content="([^"]+)"/g;
      let m;
      while ((m = re.exec(html))) {
        const hit = F.matchFigureUrl(m[1]);
        // 生成元SVGが実在するものだけ対象にする（手描きPNGを誤って対象にしない）
        if (hit && fs.existsSync(path.join(F.ROOT, hit.rel))) refs.add(hit.rel);
      }
    }
  }
  return refs;
}

function main() {
  const argv = process.argv.slice(2);
  const all = argv.includes('--all');
  const force = argv.includes('--force');
  const check = argv.includes('--check');
  const onlyIdx = argv.indexOf('--only');
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

  const svgs = F.listFigureSvgs();
  if (svgs.length === 0) {
    console.log(`${F.FIGURE_DIRS_REL.join(' / ')} に SVG がありません。`);
    return;
  }

  const refs = referencedSvgs();
  let targets = all ? svgs : svgs.filter(n => refs.has(n));
  if (only) targets = targets.filter(n => n.includes(only));

  if (targets.length === 0) {
    console.log(`対象なし（全SVG ${svgs.length}件 / og:image 参照 ${refs.size}件）。--all で全件を対象にできます。`);
    return;
  }

  const absSvg = rel => path.join(F.ROOT, rel);

  // --check: 生成せず不足だけ報告する
  if (check) {
    const missing = targets.filter(n => !F.isPngFresh(absSvg(n), F.pngPathForSvg(absSvg(n))));
    if (missing.length === 0) {
      console.log(`✅ OGP用PNG: 対象 ${targets.length}件すべて ${F.OG_WIDTH}x${F.OG_HEIGHT} で最新です。`);
      return;
    }
    console.error(`❌ OGP用PNGが未生成/古い: ${missing.length}件`);
    missing.forEach(n => console.error(`   - ${n}`));
    console.error('\n   修復: node scripts/render_og_figures.js');
    process.exit(1);
  }

  const rast = F.findRasterizer();
  if (!rast) {
    console.error(F.rasterizerHint());
    process.exit(1);
  }
  console.log(`ラスタライザ: ${rast.kind} (${rast.bin})`);

  let made = 0, skipped = 0;
  const failed = [];
  for (const name of targets) {
    const svgPath = absSvg(name);
    const pngPath = F.pngPathForSvg(svgPath);
    if (!force && F.isPngFresh(svgPath, pngPath)) { skipped++; continue; }
    try {
      const r = F.renderSvgToPng(svgPath, pngPath, { rasterizer: rast });
      made++;
      console.log(`  ✅ ${name} → ${path.basename(pngPath)} (${Math.round(r.bytes / 1024)}KB)`);
    } catch (e) {
      failed.push({ name, message: e.message });
      console.error(`  ❌ ${name}: ${e.message}`);
    }
  }

  console.log(`\n生成 ${made}件 / スキップ(最新) ${skipped}件 / 失敗 ${failed.length}件`);
  if (failed.length) process.exit(1);
}

if (require.main === module) main();
