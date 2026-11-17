#!/usr/bin/env node
'use strict';
/**
 * scripts/apply_feature_faces.js — 特集の「顔」を、その特集の掲載店の実写にする（Ondine #2097）
 *
 * data/feature_faces.json（人が目で選んだ写真）を、次の2か所へ反映する。冪等・通信なし。
 *   1. features/<slug>.html の先頭の顔（図の svg → 掲載店のホットペッパー写真。顔の無い古い型の本文には足す）
 *   2. features/index.html の特集カードの画像（図の svg → 同じ写真）と出所の1行
 * トップの特集ストリップは scripts/build_featured.js が同じ lib（scripts/lib/feature_face.js）で決める。
 * 写真は URL を参照するだけ。加工・切り抜き・自ホストをしない。掲載店の写真を持たない特集（keepFigure）は図のまま。
 *
 * 使い方:
 *   node scripts/apply_feature_faces.js           # 反映する
 *   node scripts/apply_feature_faces.js --check   # 反映が要るものがあれば exit 1（書き換えない）
 *
 * 自動実行: .github/workflows/build.yml が、月次の掲載店の入れ替え（refresh_feature_rosters.js）の後に日次で回す。
 * 決めた店が掲載から外れたら、先頭の店で代えて警告を出す（人の目の再確認が要る・ビルドは止めない）。
 */

const fs = require('fs');
const path = require('path');
const F = require('./lib/feature_face');

const ROOT = path.resolve(__dirname, '..');
const FEATURES = path.join(ROOT, 'features');

function run(opts) {
  const check = !!(opts && opts.check);
  const cfg = F.loadConfig();
  const changed = [];
  const warnings = [];
  const write = (file, before, after) => {
    if (before === after) return;
    changed.push(path.relative(ROOT, file));
    if (!check) fs.writeFileSync(file, after);
  };

  let indexHtml = fs.readFileSync(path.join(FEATURES, 'index.html'), 'utf8');
  const indexBefore = indexHtml;

  for (const slug of Object.keys(cfg.faces || {})) {
    const file = path.join(FEATURES, `${slug}.html`);
    if (!fs.existsSync(file)) { warnings.push(`${slug}: 特集ページが無い`); continue; }
    const html = fs.readFileSync(file, 'utf8');
    const face = F.resolveFace(slug, html, cfg);
    if (!face) { warnings.push(`${slug}: 掲載店のホットペッパー写真が無いので図のまま`); continue; }
    if (!face.pinned) warnings.push(`${slug}: 決めた店が掲載から外れたので「${face.store}」で代えた（目で再確認して data/feature_faces.json を直す）`);
    write(file, html, F.applyHero(html, face, cfg, slug));
    indexHtml = F.applyIndexCard(indexHtml, slug, face, cfg);
  }
  write(path.join(FEATURES, 'index.html'), indexBefore, indexHtml);
  return { changed, warnings };
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const { changed, warnings } = run({ check });
  warnings.forEach((w) => console.log(`⚠️  ${w}`));
  if (check) {
    if (changed.length) { console.log(`❌ 反映が要る: ${changed.join(', ')}`); process.exitCode = 1; }
    else console.log('✅ 特集の顔は最新');
  } else {
    console.log(`✅ 特集の顔を反映（変更 ${changed.length} 件）${changed.length ? ': ' + changed.join(', ') : ''}`);
  }
}

module.exports = { run };
