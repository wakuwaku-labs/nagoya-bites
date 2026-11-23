#!/usr/bin/env node
'use strict';
/**
 * 既存のエリアページ（stores/area/各エリア/index.html・stores/area/index.html）と特集に、
 * 「なぜこのエリア・この切り口なのか」の節を足す（冪等。data/why_sections.json が本文）。
 *   node scripts/apply_why_sections.js            # 書き込む
 *   node scripts/apply_why_sections.js --dry-run  # 件数だけ
 * 題・URL・冒頭（art-lead）は変えない（docs/plans/media-policy-2026-11 の「検索流入のある記事は足すだけ」）。
 * 足したページは data/why_section_baseline.json（猶予リスト）から外す。
 */
const fs = require('fs');
const path = require('path');
const { renderWhy, insertWhy, loadWhyData } = require('./lib/why_section');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(ROOT, 'data', 'why_section_baseline.json');
const dry = process.argv.includes('--dry-run');
const data = loadWhyData();

/** ハブの本文から、生成器と同じ値（軒数・最多ジャンル）を読む */
function hubCtx(html, slug, areaCount, hubMin) {
  if (slug === '_root') return { areas: areaCount, hubMin };
  const n = (/掲載中の飲食店(\d+)軒/.exec(html) || [])[1];
  const g = /hg-label">(.*?)<\/div>\s*<div class="hg-count">(\d+)軒/.exec(html) || [];
  return { n, g1: g[1], g1n: g[2] };
}

const changed = [];
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'area_genre_pages_policy.json'), 'utf8'));
const areaSlugs = Object.keys(data.areas).filter((k) => k !== '_root');
for (const slug of ['_root', ...areaSlugs]) {
  const rel = slug === '_root' ? 'stores/area/index.html' : `stores/area/${slug}/index.html`;
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) continue;
  const html = fs.readFileSync(fp, 'utf8');
  const ctx = hubCtx(html, slug, areaSlugs.length, policy.hubMinStores);
  const out = insertWhy(html, renderWhy(data.areas[slug], 'hub', ctx), 'hub');
  if (out && out !== html) { changed.push(rel); if (!dry) fs.writeFileSync(fp, out); }
}
for (const [rel, entry] of Object.entries(data.features)) {
  const fp = path.join(ROOT, rel);
  const html = fs.readFileSync(fp, 'utf8');
  const out = insertWhy(html, renderWhy(entry, 'feature'), 'feature');
  if (!out) { console.error('差し込み位置が見つからない: ' + rel); process.exitCode = 1; continue; }
  if (out !== html) { changed.push(rel); if (!dry) fs.writeFileSync(fp, out); }
}
if (!dry && fs.existsSync(BASELINE)) {
  const b = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const done = new Set([...Object.keys(data.features), ...areaSlugs.map((s) => `stores/area/${s}/index.html`), 'stores/area/index.html']);
  b.pages = b.pages.filter((p) => !done.has(p));
  fs.writeFileSync(BASELINE, JSON.stringify(b, null, 1) + '\n');
}
console.log(`${dry ? '(dry-run) ' : ''}足した・更新したページ: ${changed.length}件`);
changed.forEach((c) => console.log('  ' + c));
