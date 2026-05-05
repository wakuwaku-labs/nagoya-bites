#!/usr/bin/env node
/**
 * journal/2026-*.html の <div class="related"> を「直近3本の他journal + ナビリンク」に書き換える。
 * 各記事の <h1 class="art-title"> から <em> を剥いだ表示用タイトルを抽出して使う。
 * _template.html / index.html / feed.* は対象外。
 */
const fs = require('fs');
const path = require('path');

const JOURNAL_DIR = path.join(__dirname, '..', 'journal');

function listPosts() {
  return fs.readdirSync(JOURNAL_DIR)
    .filter(f => /^2\d{3}-\d{2}-\d{2}-.+\.html$/.test(f))
    .sort()
    .reverse(); // 新しい順
}

function extractTitle(html) {
  const m = html.match(/<h1 class="art-title">([\s\S]*?)<\/h1>/);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function shortLabel(title) {
  // 表示用ラベル: 「— 」以降を落として頭の主張だけ残す（長すぎる時の保険）
  const dash = title.indexOf(' — ');
  const base = dash > 0 ? title.slice(0, dash) : title;
  return base.length > 38 ? base.slice(0, 36) + '…' : base;
}

function buildRelatedHtml(currentFile, posts, postsMeta) {
  const others = posts.filter(f => f !== currentFile).slice(0, 3);
  const lines = [];
  lines.push('<div class="related">');
  lines.push('  <p class="related-title">関連記事</p>');
  lines.push('  <div class="related-links">');
  for (const f of others) {
    const meta = postsMeta[f];
    if (!meta) continue;
    lines.push(`    <a class="related-link" href="${f}">${shortLabel(meta.title)}</a>`);
  }
  lines.push('    <a class="related-link" href="index.html" style="background:rgba(122,92,16,.08);">📰 Journal 一覧</a>');
  lines.push('    <a class="related-link" href="../features/index.html">📖 特集記事</a>');
  lines.push('    <a class="related-link" href="../index.html">🍽 全店舗を検索</a>');
  lines.push('  </div>');
  lines.push('</div>');
  return lines.join('\n');
}

function refreshFile(file, posts, postsMeta) {
  const fp = path.join(JOURNAL_DIR, file);
  let html = fs.readFileSync(fp, 'utf8');
  const re = /<div class="related">\s*<p class="related-title">[^<]*<\/p>\s*<div class="related-links">[\s\S]*?<\/div>\s*<\/div>/;
  if (!re.test(html)) {
    return { file, changed: false, reason: 'related block not found' };
  }
  const next = buildRelatedHtml(file, posts, postsMeta);
  const updated = html.replace(re, next);
  if (updated === html) return { file, changed: false, reason: 'no diff' };
  fs.writeFileSync(fp, updated);
  return { file, changed: true };
}

function main() {
  const posts = listPosts();
  const postsMeta = {};
  for (const f of posts) {
    const html = fs.readFileSync(path.join(JOURNAL_DIR, f), 'utf8');
    const title = extractTitle(html);
    if (title) postsMeta[f] = { title };
  }
  console.log(`Found ${posts.length} posts`);
  let changed = 0;
  for (const f of posts) {
    const r = refreshFile(f, posts, postsMeta);
    if (r.changed) changed++;
    else console.log(`SKIP ${f}: ${r.reason}`);
  }
  console.log(`Updated ${changed}/${posts.length} files`);
}

main();
