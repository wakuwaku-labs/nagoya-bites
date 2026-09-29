#!/usr/bin/env node
'use strict';
/**
 * add_feature_journal_links.js  (SEO-056, SEO-108)
 *
 * 特集記事（features/*.html）に、同じ店・同じシーンを扱うジャーナル記事（journal/*.html）への
 * 内部リンクを設置する。三層編集（DB／特集／ジャーナル）のうち、ジャーナル→特集は
 * refresh_journal_related.js で自動化済みだが、逆方向（特集→ジャーナル個別記事）が
 * 凍結していた（SEO-056 の一回実行 2026-08-19 以降の記事が反映なし・SEO-108）。
 *
 * 対応関係は：
 * 1. data/journal_published.json の store_ids と特集HTMLの stores/JXXXX.html を突合
 * 2. data/journal_seo_keywords.json の aliases とジャーナルタイトルを照合（SEO-108）
 *
 * - 冪等: class="related-journal-articles" ブロックを毎回再生成し、差分があるときだけ書く
 *   （旧実装は「マーカーがあればスキップ」で 2026-08-19 以降凍結・SEO-108）
 * - 一致が無い特集には何も追加しない（空のセクションを作らない）
 * - --check: 書き込まず、更新が必要なファイルがあれば exit 1
 * - --dry-run: 書き込まず対象・件数だけ表示
 *
 * 使い方:
 *   node scripts/add_feature_journal_links.js            # 全 features/*.html に適用
 *   node scripts/add_feature_journal_links.js --dry-run   # 書き込まず対象・件数だけ表示
 *   node scripts/add_feature_journal_links.js --check     # 更新が必要なら exit 1（CI向け）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const PUBLISHED = path.join(ROOT, 'data', 'journal_published.json');
const KW_FILE = path.join(ROOT, 'data', 'journal_seo_keywords.json');

const MARKER = 'related-journal-articles';
const MAX_LINKS = 3;

// Matches the generated block from its <p> start to the closing </div> of related-links.
// The <p> content has no nested elements, so the first "  </div>" after the block start
// is reliably the end of <div class="related-links">.
const BLOCK_RE = /  <p class="related-journal-title related-journal-articles"[\s\S]*?  <\/div>/;

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function jsEsc(s) { return String(s || '').replace(/'/g, '').replace(/</g, '').replace(/>/g, ''); }

// scripts/refresh_journal_related.js の shortLabel() と同じ短縮規則（表記の一貫性）
function shortLabel(title) {
  if (!title) return '';
  const dash = title.indexOf(' — ');
  const base = dash > 0 ? title.slice(0, dash) : title;
  return base.length > 38 ? base.slice(0, 36) + '…' : base;
}

function buildStoreToJournalsMap(entries) {
  const map = new Map();
  for (const e of entries) {
    for (const id of e.store_ids || []) {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(e);
    }
  }
  return map;
}

// data/journal_seo_keywords.json の aliases とジャーナルタイトルを照合し、
// featurePath（例: "features/nagoya-solo-dining.html"）→ 該当 entries[] のマップを返す。
// 判定は「タイトルに alias が含まれるか」のみ ＝ 検証できる事実だけ（CLAUDE.md 制約10）。
function buildKwToJournalsMap(entries) {
  const kwData = JSON.parse(fs.readFileSync(KW_FILE, 'utf8'));
  const allKws = [
    ...(kwData.areas || []),
    ...(kwData.scenes || []),
    ...(kwData.genres || []),
  ];
  // featurePath → aliases[]
  const featureToAliases = new Map();
  for (const kw of allKws) {
    if (!kw.feature || !Array.isArray(kw.aliases)) continue;
    const fp = kw.feature.startsWith('features/') ? kw.feature : `features/${kw.feature}`;
    if (!featureToAliases.has(fp)) featureToAliases.set(fp, []);
    featureToAliases.get(fp).push(...kw.aliases);
  }
  // featurePath → matching journal entries[]
  const featureToEntries = new Map();
  for (const [fp, aliases] of featureToAliases) {
    const matched = entries.filter(e => e.title && aliases.some(a => e.title.includes(a)));
    featureToEntries.set(fp, matched);
  }
  return featureToEntries;
}

function buildBlockHtml(entries) {
  const links = entries.map((e) => {
    const href = `../journal/${e.slug}.html`;
    return `    <a class="related-link" href="${esc(href)}" onclick="trackEvent('internal_link_click',{link_url:'${jsEsc(href)}',link_text:'${jsEsc(shortLabel(e.title))}',block:'feature_journal'})">${esc(shortLabel(e.title))}</a>`;
  }).join('\n');
  return (
    `  <p class="related-journal-title ${MARKER}" style="margin-top:1.2rem;font-size:.7rem;letter-spacing:.08em;color:rgba(28,28,26,.5);text-transform:uppercase;">この特集の店の最新ジャーナル記事</p>\n` +
    `  <div class="related-links">\n${links}\n  </div>`
  );
}

// 既存ブロックを置換、なければ inject で挿入する
function replaceOrInject(html, blockHtml) {
  if (BLOCK_RE.test(html)) {
    return html.replace(BLOCK_RE, blockHtml);
  }
  return inject(html, blockHtml);
}

function inject(html, blockHtml) {
  // 優先: 既存 .related ブロック内の related-journal 段落（デイリージャーナル索引リンク）直後
  const anchorRe = /(<p class="related-journal"[\s\S]*?<\/p>\n)/;
  const m = html.match(anchorRe);
  if (m) {
    const idx = html.indexOf(m[0]) + m[0].length;
    return html.slice(0, idx) + blockHtml + '\n' + html.slice(idx);
  }
  // 次点: <div class="related"> の閉じタグ直前（related-journal段落が無い旧型ファイル）
  const relStart = html.indexOf('<div class="related"');
  if (relStart !== -1) {
    const linksOpen = html.indexOf('<div class="related-links">', relStart);
    if (linksOpen !== -1) {
      const linksClose = html.indexOf('</div>', linksOpen) + '</div>'.length;
      return html.slice(0, linksClose) + '\n' + blockHtml + html.slice(linksClose);
    }
  }
  // 最終手段: <footer の直前に単独ブロックとして挿入
  const fi = html.indexOf('<footer');
  if (fi !== -1) {
    return html.slice(0, fi) + `<div class="related">\n${blockHtml}\n</div>\n` + html.slice(fi);
  }
  return null; // 挿入先が見つからない
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const checkMode = args.includes('--check');

  const publishedData = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const entries = publishedData.entries;

  const storeToJournals = buildStoreToJournalsMap(entries);
  const kwToJournals = buildKwToJournalsMap(entries);

  const files = fs.readdirSync(FEATURES_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_'));

  let modified = 0, unchanged = 0, noMatch = 0, errored = 0;

  for (const file of files) {
    try {
      const filePath = path.join(FEATURES_DIR, file);
      const html = fs.readFileSync(filePath, 'utf8');

      // 店舗ID照合
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

      // KW照合（SEO-108）
      const featurePath = `features/${file}`;
      for (const e of kwToJournals.get(featurePath) || []) {
        if (seenSlugs.has(e.slug)) continue;
        seenSlugs.add(e.slug);
        matched.push(e);
      }

      const hasMarker = html.includes(MARKER);

      if (matched.length === 0) {
        if (hasMarker) {
          // マッチが無くなった場合はブロックを除去
          const newHtml = html.replace(BLOCK_RE, '');
          if (newHtml === html) { unchanged++; continue; }
          if (!dryRun && !checkMode) fs.writeFileSync(filePath, newHtml, 'utf8');
          console.log(`REMOVE: ${file} (マッチなし・ブロック除去)`);
          modified++;
        } else {
          noMatch++;
        }
        continue;
      }

      matched.sort((a, b) => (a.date < b.date ? 1 : -1)); // 新しい記事を優先
      const top = matched.slice(0, MAX_LINKS);

      const blockHtml = buildBlockHtml(top);
      const newHtml = replaceOrInject(html, blockHtml);
      if (!newHtml) {
        console.error(`SKIP (挿入先not found): ${file}`);
        unchanged++;
        continue;
      }
      if (newHtml === html) { unchanged++; continue; }

      if (!dryRun && !checkMode) fs.writeFileSync(filePath, newHtml, 'utf8');
      console.log(`${hasMarker ? 'UPDATE' : 'ADD'}: ${file} (${top.length}件: ${top.map((e) => e.slug).join(', ')})`);
      modified++;
    } catch (e) {
      console.error(`ERROR: ${file}: ${e.message}`);
      errored++;
    }
  }

  console.log(`add_feature_journal_links: modified=${modified} unchanged=${unchanged} noMatch=${noMatch} errored=${errored}${dryRun ? ' (--dry-run)' : ''}${checkMode ? ' (--check)' : ''}`);

  if (checkMode && modified > 0) {
    console.error(`--check: ${modified}件の更新が必要です`);
    process.exit(1);
  }
}

main();
