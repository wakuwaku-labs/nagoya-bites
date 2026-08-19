#!/usr/bin/env node
'use strict';
/**
 * add_feature_journal_links.js  (SEO-056)
 *
 * 特集記事（features/*.html）に、同じ店を扱っているジャーナル記事（journal/*.html）への
 * 内部リンクを設置する。三層編集（DB／特集／ジャーナル）のうち、ジャーナル→特集は
 * refresh_journal_related.js で自動化済みだが、逆方向（特集→ジャーナル個別記事）が
 * 0本だった（最大の入口である特集が最新層への出口を持たない＝回遊が伸びない構造要因）。
 *
 * 対応関係は data/journal_published.json の store_ids と、特集HTML内の
 * href="../stores/JXXXX.html" を突合して機械的に導出する。**実在する記事のみ**を出す
 * （架空リンク・404を作らない）。
 *
 * - 冪等: class="related-journal-articles" を既に持つファイルはスキップ
 * - 一致が無い特集には何も追加しない（空のセクションを作らない）
 * - 挿入先は既存の <div class="related"> 内、related-journal 段落の直後
 *   （add_related_features.js が作る「関連する特集記事」ブロックの隣）。
 *   .related が無いファイルは <footer より前に単独ブロックとして挿入する
 * - クリック計測は internal_link_click（SEO-052と同じイベント名・block='feature_journal'）
 *
 * 使い方:
 *   node scripts/add_feature_journal_links.js            # 全 features/*.html に適用
 *   node scripts/add_feature_journal_links.js --dry-run   # 書き込まず対象・件数だけ表示
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const PUBLISHED = path.join(ROOT, 'data', 'journal_published.json');

const MARKER = 'related-journal-articles';
const MAX_LINKS = 3;

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function jsEsc(s) { return String(s || '').replace(/'/g, '').replace(/</g, '').replace(/>/g, ''); }

// scripts/refresh_journal_related.js の shortLabel() と同じ短縮規則（表記の一貫性）
function shortLabel(title) {
  if (!title) return '';
  const dash = title.indexOf(' — ');
  const base = dash > 0 ? title.slice(0, dash) : title;
  return base.length > 38 ? base.slice(0, 36) + '…' : base;
}

function buildStoreToJournalsMap() {
  const data = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const map = new Map();
  for (const e of data.entries) {
    for (const id of e.store_ids || []) {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(e);
    }
  }
  return map;
}

function buildBlockHtml(entries) {
  const links = entries.map((e) => {
    const href = `../journal/${e.slug}.html`;
    return `    <a class="related-link" href="${esc(href)}" onclick="trackEvent('internal_link_click',{link_url:'${jsEsc(href)}',link_text:'${jsEsc(shortLabel(e.title))}',block:'feature_journal'})">${esc(shortLabel(e.title))}</a>`;
  }).join('\n');
  return (
    `  <p class="related-journal-title ${MARKER}" style="margin-top:1.2rem;font-size:.7rem;letter-spacing:.08em;color:rgba(28,28,26,.5);text-transform:uppercase;">この特集の店の最新ジャーナル記事</p>\n` +
    `  <div class="related-links">\n${links}\n  </div>\n`
  );
}

function inject(html, blockHtml) {
  // 優先: 既存 .related ブロック内の related-journal 段落（デイリージャーナル索引リンク）直後
  const anchorRe = /(<p class="related-journal"[\s\S]*?<\/p>\n)/;
  const m = html.match(anchorRe);
  if (m) {
    const idx = html.indexOf(m[0]) + m[0].length;
    return html.slice(0, idx) + blockHtml + html.slice(idx);
  }
  // 次点: <div class="related"> の閉じタグ直前（related-journal段落が無い旧型ファイル）
  const relStart = html.indexOf('<div class="related"');
  if (relStart !== -1) {
    const linksOpen = html.indexOf('<div class="related-links">', relStart);
    if (linksOpen !== -1) {
      const linksClose = html.indexOf('</div>', linksOpen) + '</div>'.length;
      return html.slice(0, linksClose) + '\n' + blockHtml.trimEnd() + html.slice(linksClose);
    }
  }
  // 最終手段: <footer の直前に単独ブロックとして挿入
  const fi = html.indexOf('<footer');
  if (fi !== -1) {
    return html.slice(0, fi) + `<div class="related">\n${blockHtml}</div>\n` + html.slice(fi);
  }
  return null; // 挿入先が見つからない
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const storeToJournals = buildStoreToJournalsMap();
  const files = fs.readdirSync(FEATURES_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_'));

  let modified = 0, skipped = 0, noMatch = 0, errored = 0;

  for (const file of files) {
    try {
      const filePath = path.join(FEATURES_DIR, file);
      let html = fs.readFileSync(filePath, 'utf8');

      if (html.includes(MARKER)) { skipped++; continue; }

      const storeIds = new Set([...html.matchAll(/stores\/(J\d+)\.html/g)].map((m) => m[1]));
      const seenSlugs = new Set();
      const matched = [];
      for (const id of storeIds) {
        for (const e of storeToJournals.get(id) || []) {
          if (seenSlugs.has(e.slug)) continue;
          seenSlugs.add(e.slug);
          matched.push(e);
        }
      }
      if (matched.length === 0) { noMatch++; continue; }

      matched.sort((a, b) => (a.date < b.date ? 1 : -1)); // 新しい記事を優先
      const top = matched.slice(0, MAX_LINKS);

      const blockHtml = buildBlockHtml(top);
      const newHtml = inject(html, blockHtml);
      if (!newHtml) {
        console.error(`SKIP (挿入先not found): ${file}`);
        skipped++;
        continue;
      }
      if (!dryRun) fs.writeFileSync(filePath, newHtml, 'utf8');
      console.log(`OK: ${file} (${top.length}件: ${top.map((e) => e.slug).join(', ')})`);
      modified++;
    } catch (e) {
      console.error(`ERROR: ${file}: ${e.message}`);
      errored++;
    }
  }

  console.log(`add_feature_journal_links: modified=${modified} skipped=${skipped} noMatch=${noMatch} errored=${errored}${dryRun ? ' (--dry-run)' : ''}`);
}

main();
