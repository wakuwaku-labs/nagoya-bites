#!/usr/bin/env node
/**
 * scripts/inject_hub_links_into_features.js
 *
 * SEO-099: 特集記事(features/*.html)へ、対応するエリア×ジャンル×条件ハブ
 * （stores/area/配下・SEO-094・691本）への内部リンクを機械的に挿入する。
 *
 * 対応関係は scripts/lib/hub_link_finder.js が
 *   data/journal_seo_keywords.json / data/area_genre_pages_policy.json /
 *   data/area_genre_pages_manifest.json
 * だけを根拠に決定する（自己申告・推測は使わない・CLAUDE.md 制約10）。
 * 手書きで個別ページを編集するのではなく、本スクリプトが全特集を機械的に処理する。
 *
 * 冪等性: <!-- SEO-099:HUB-LINKS:START --> 〜 <!-- SEO-099:HUB-LINKS:END --> の
 * 間だけを差し替える（2回連続実行しても差分ゼロ）。
 * 挿入位置: 共通フッター開始コメント（<!-- NB-CHROME:FOOTER:START -->）の直前。
 * 全特集ページに存在する唯一の共通アンカーのため、.related 内部のレイアウトの
 * 細かな違い（ページごとに手書きされてきた既存構造）に影響されない。
 * 対応ハブが無い特集は何も挿入しない（取り繕わない・存在しないリンクを作らない）。
 *
 * 使い方:
 *   node scripts/inject_hub_links_into_features.js            … 適用して書き込む
 *   node scripts/inject_hub_links_into_features.js --dry-run  … 書き込まず結果だけ表示
 *   node scripts/inject_hub_links_into_features.js --check    … 未反映の差分があれば exit 1（CI向け）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { buildFeatureHubMap } = require('./lib/hub_link_finder');

const ROOT = path.resolve(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const MARK_START = '<!-- SEO-099:HUB-LINKS:START -->';
const MARK_END = '<!-- SEO-099:HUB-LINKS:END -->';
const FOOTER_ANCHOR = '<!-- NB-CHROME:FOOTER:START -->';
const MAX_LINKS = 3;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildBlock(featureSlug, links) {
  const lines = [];
  lines.push(MARK_START);
  lines.push('<div class="related">');
  lines.push('  <p class="related-title">エリアで探す</p>');
  lines.push('  <div class="related-links">');
  for (const l of links) {
    const href = `../${l.url}`;
    const payload = `{feature:'${featureSlug}',link_url:'${href}',block:'feature_hub'}`;
    lines.push(
      `    <a class="related-link" href="${href}" onclick="trackEvent('internal_link_click',${payload})">${escapeHtml(l.label)}</a>`
    );
  }
  lines.push('  </div>');
  lines.push('</div>');
  lines.push(MARK_END);
  return lines.join('\n');
}

function listFeatureFiles() {
  return fs
    .readdirSync(FEATURES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .sort();
}

function processFile(file, hubMap, { dryRun }) {
  const rel = `features/${file}`;
  const links = hubMap.get(rel);
  const fp = path.join(FEATURES_DIR, file);
  const html = fs.readFileSync(fp, 'utf8');

  const markerRe = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}\\n?`, 'm');
  const hasMarker = markerRe.test(html);

  if (!links || links.length === 0) {
    // 対応ハブが無い特集: 既存の挿入があれば除去（マッピングが消えた場合の後始末）。
    if (!hasMarker) return { file, action: 'skip', reason: 'no-hub-mapping' };
    const updated = html.replace(markerRe, '');
    if (!dryRun) fs.writeFileSync(fp, updated);
    return { file, action: 'removed', reason: 'hub-mapping-gone' };
  }

  const featureSlug = file.replace(/\.html$/, '');
  const block = buildBlock(featureSlug, links);

  if (hasMarker) {
    const updated = html.replace(markerRe, block + '\n');
    if (updated === html) return { file, action: 'unchanged' };
    if (!dryRun) fs.writeFileSync(fp, updated);
    return { file, action: 'updated', count: links.length };
  }

  if (!html.includes(FOOTER_ANCHOR)) {
    return { file, action: 'skip', reason: 'no-footer-anchor' };
  }
  const updated = html.replace(FOOTER_ANCHOR, block + '\n' + FOOTER_ANCHOR);
  if (!dryRun) fs.writeFileSync(fp, updated);
  return { file, action: 'inserted', count: links.length };
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const dryRun = args.includes('--dry-run') || check;

  const hubMap = buildFeatureHubMap({ maxLinks: MAX_LINKS });
  const files = listFeatureFiles();

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let removed = 0;
  let skipped = 0;
  let linkTotal = 0;
  const diffs = [];

  for (const file of files) {
    const r = processFile(file, hubMap, { dryRun });
    if (r.action === 'inserted') {
      inserted++;
      linkTotal += r.count;
      diffs.push(r);
    } else if (r.action === 'updated') {
      updated++;
      diffs.push(r);
    } else if (r.action === 'unchanged') {
      unchanged++;
      linkTotal += (hubMap.get(`features/${file}`) || []).length;
    } else if (r.action === 'removed') {
      removed++;
      diffs.push(r);
    } else {
      skipped++;
    }
  }

  console.log(`対象特集: ${files.length}本 / ハブ対応あり: ${hubMap.size}本`);
  console.log(
    `挿入: ${inserted} / 更新: ${updated} / 変更なし: ${unchanged} / 除去: ${removed} / 対応なし: ${skipped}`
  );
  console.log(`現在ハブリンクが挿入されている特集の合計リンク数: ${linkTotal}`);

  if (check) {
    if (diffs.length > 0) {
      console.log('未反映の差分があります（--check は read-only）:');
      for (const d of diffs) console.log(`  ${d.action} ${d.file}`);
      process.exit(1);
    }
    process.exit(0);
  }
}

main();
