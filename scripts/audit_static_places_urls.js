#!/usr/bin/env node
/**
 * 書いた後に取り直さない面（journal/・features/・sitemap-images.xml）に、Google Places の写真 URL
 * （lh3.googleusercontent.com・places.googleapis.com など）が「新しく増えていないか」を数える（P-29・ADR 0045）。
 *
 * Places の photo name は期限切れになりうる・キャッシュ不可。書いた URL は失効して写真が出なくなる。
 * 生成器（generate_daily_draft.js・journal_photos.js・refresh_feature_rosters.js・build_features.js）は
 * もう書かないが、手書きや別経路からの混入を止める検査をここに置く。
 *
 * 既存の残りは scripts/repair_expired_place_photos.js が失効分を片付ける（生きている URL は残る）。
 * そのため「0 件」ではなく、ファイルごとの件数の基準（data/static_places_url_baseline.json）を超えたら落とす。
 * 判定は文字列の事実だけ（制約10）。毎日作り直す店舗ページ（stores/）は対象外。
 *
 *   node scripts/audit_static_places_urls.js                    # 件数を表示
 *   node scripts/audit_static_places_urls.js --check            # 基準を超えたファイルがあれば exit 1
 *   node scripts/audit_static_places_urls.js --update-baseline  # 基準を今の件数まで下げる（増やす方向には書かない）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { findPlacesPhotoUrls } = require('./lib/places_photo_url');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'data', 'static_places_url_baseline.json');
const argv = process.argv.slice(2);

function targets() {
  const out = [];
  for (const d of ['journal', 'features']) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.html')) out.push(`${d}/${f}`);
  }
  if (fs.existsSync(path.join(ROOT, 'sitemap-images.xml'))) out.push('sitemap-images.xml');
  return out;
}

function countAll() {
  const counts = {};
  for (const f of targets()) {
    const n = findPlacesPhotoUrls(fs.readFileSync(path.join(ROOT, f), 'utf8')).length;
    if (n) counts[f] = n;
  }
  return counts;
}

function loadBaseline() {
  try { return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).files || {}; } catch { return {}; }
}

function main() {
  const counts = countAll();
  const base = loadBaseline();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (argv.includes('--update-baseline')) {
    const next = {};
    for (const [f, n] of Object.entries(counts)) next[f] = Math.min(n, base[f] == null ? n : base[f]);
    const doc = {
      _note: '書いた後に取り直さない面の Places 写真 URL の件数の上限（P-29・docs/decisions/0045）。増やす方向には書かない。残りは repair_expired_place_photos.js が失効分を片付ける。',
      updatedFrom: 'scripts/audit_static_places_urls.js --update-baseline',
      files: next,
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n');
    console.log(`基準を更新: ${Object.keys(next).length} ファイル / 計 ${Object.values(next).reduce((a, b) => a + b, 0)} 件`);
    return;
  }

  const grew = Object.entries(counts).filter(([f, n]) => n > (base[f] || 0));
  console.log(`Places 写真 URL（journal・features・sitemap-images）: ${Object.keys(counts).length} ファイル / 計 ${total} 件`);
  if (!grew.length) { console.log('✅ 基準を超えて増えたファイルはありません'); return; }
  console.error('\n❌ 新しく Places の写真 URL が書かれました（失効する URL は書かない・P-29）:');
  for (const [f, n] of grew) console.error(`   ${f}: ${n} 件（基準 ${base[f] || 0}）`);
  console.error('   → HotPepper の公式写真 → プレスリリース → 記事固有の図、の順に替えてください（docs/decisions/0045）。');
  if (argv.includes('--check')) process.exit(1);
}

main();
