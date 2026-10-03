#!/usr/bin/env node
'use strict';
/**
 * add_feature_journal_links.js  (SEO-056 / SEO-108)
 *
 * 特集記事（features/*.html）に、同じ店を扱っているジャーナル記事（journal/*.html）への
 * 内部リンクを設置する（冪等・日次実行対応）。
 *
 * 対応関係は2つのキーで決定する（SEO-108 acceptance 2）:
 *   1. store ID 一致: journal の store_ids に、特集HTML内の stores/JXXXX.html が含まれる
 *   2. KW 一致: journal タイトルが journal_seo_keywords.json の KW（またはエイリアス）を含み、
 *      そのKWの feature が当該特集を指す（検証できる事実のみ・CLAUDE.md 制約10）
 *
 * - 冪等: 既存ブロックを再生成し差分がなければ書かない（旧: マーカー検出でスキップ固定→SEO-108）
 * - 一致が無い特集には何も追加しない（空のセクションを作らない）
 * - 挿入先は既存の <div class="related"> 内、related-journal 段落の直後
 * - クリック計測は internal_link_click（block='feature_journal'）
 *
 * 使い方:
 *   node scripts/add_feature_journal_links.js            # 全 features/*.html に適用
 *   node scripts/add_feature_journal_links.js --dry-run   # 書き込まず対象・件数だけ表示
 *   node scripts/add_feature_journal_links.js --check     # 差分があれば exit 1（CI向け）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const PUBLISHED = path.join(ROOT, 'data', 'journal_published.json');
const JOURNAL_SEO_KW_PATH = path.join(ROOT, 'data', 'journal_seo_keywords.json');

const MARKER = 'related-journal-articles';
const MAX_LINKS = 3;

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function jsEsc(s) { return String(s || '').replace(/'/g, '').replace(/</g, '').replace(/>/g, ''); }

function shortLabel(title) {
  if (!title) return '';
  const dash = title.indexOf(' — ');
  const base = dash > 0 ? title.slice(0, dash) : title;
  return base.length > 38 ? base.slice(0, 36) + '…' : base;
}

function loadAllEntries() {
  const data = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  return data.entries || [];
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

// featureSlug → Set<alias> （journal_seo_keywords.json の areas/scenes/genres を統合）
function buildKwFeatureMap() {
  const data = JSON.parse(fs.readFileSync(JOURNAL_SEO_KW_PATH, 'utf8'));
  const map = new Map();
  for (const category of ['areas', 'scenes', 'genres']) {
    for (const entry of data[category] || []) {
      const feat = entry.feature || '';
      const slug = feat.replace('features/', '').replace('.html', '');
      if (!slug) continue;
      if (!map.has(slug)) map.set(slug, new Set());
      for (const alias of entry.aliases || [entry.kw]) {
        if (alias) map.get(slug).add(alias);
      }
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

// 既存ブロック（マーカーつきの段落 + related-links div）を新しい内容で置換する正規表現
// 先頭の空白（インデント）も含めてマッチしないと replace 後にインデントが増殖して冪等性が壊れる
const EXISTING_BLOCK_RE = /[ \t]*<p class="related-journal-title related-journal-articles"[\s\S]*?<\/p>\s*<div class="related-links">[\s\S]*?<\/div>/;

function inject(html, blockHtml) {
  // 既存ブロックがあれば置換（冪等）
  if (EXISTING_BLOCK_RE.test(html)) {
    return html.replace(EXISTING_BLOCK_RE, blockHtml.trimEnd());
  }
  // 優先: 既存 .related ブロック内の related-journal 段落直後
  const anchorRe = /(<p class="related-journal"[\s\S]*?<\/p>\n)/;
  const m = html.match(anchorRe);
  if (m) {
    const idx = html.indexOf(m[0]) + m[0].length;
    return html.slice(0, idx) + blockHtml + html.slice(idx);
  }
  // 次点: <div class="related"> の related-links 直後
  const relStart = html.indexOf('<div class="related"');
  if (relStart !== -1) {
    const linksOpen = html.indexOf('<div class="related-links">', relStart);
    if (linksOpen !== -1) {
      const linksClose = html.indexOf('</div>', linksOpen) + '</div>'.length;
      return html.slice(0, linksClose) + '\n' + blockHtml.trimEnd() + html.slice(linksClose);
    }
  }
  // 最終手段: <footer の直前
  const fi = html.indexOf('<footer');
  if (fi !== -1) {
    return html.slice(0, fi) + `<div class="related">\n${blockHtml}</div>\n` + html.slice(fi);
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--check');
  const checkMode = args.includes('--check');

  const allEntries = loadAllEntries();
  const storeToJournals = buildStoreToJournalsMap(allEntries);
  const kwFeatureMap = buildKwFeatureMap();

  const files = fs.readdirSync(FEATURES_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_'));

  let modified = 0, noDiff = 0, noMatch = 0, errored = 0;
  const outdated = [];

  for (const file of files) {
    try {
      const featureSlug = file.replace('.html', '');
      const filePath = path.join(FEATURES_DIR, file);
      const html = fs.readFileSync(filePath, 'utf8');

      const storeIds = new Set([...html.matchAll(/stores\/(J\d+)\.html/g)].map((m) => m[1]));
      const featureAliases = kwFeatureMap.get(featureSlug) || new Set();

      const seen = new Set();
      const candidates = [];

      // 1. Store ID match
      for (const id of storeIds) {
        for (const e of storeToJournals.get(id) || []) {
          if (seen.has(e.slug)) continue;
          seen.add(e.slug);
          candidates.push(e);
        }
      }

      // 2. KW match: journal title contains alias for this feature
      if (featureAliases.size > 0) {
        for (const e of allEntries) {
          if (seen.has(e.slug)) continue;
          const title = e.title || '';
          for (const alias of featureAliases) {
            if (title.includes(alias)) {
              seen.add(e.slug);
              candidates.push(e);
              break;
            }
          }
        }
      }

      if (candidates.length === 0) { noMatch++; continue; }

      candidates.sort((a, b) => (a.date < b.date ? 1 : -1));
      const top = candidates.slice(0, MAX_LINKS);

      const blockHtml = buildBlockHtml(top);
      const newHtml = inject(html, blockHtml);
      if (!newHtml) {
        console.error(`SKIP (挿入先not found): ${file}`);
        noDiff++;
        continue;
      }
      if (newHtml === html) {
        noDiff++;
        continue;
      }

      if (checkMode) {
        outdated.push(file);
        console.log(`OUTDATED: ${file} (${top.length}件: ${top.map((e) => e.slug).join(', ')})`);
      } else if (!dryRun) {
        fs.writeFileSync(filePath, newHtml, 'utf8');
        console.log(`OK: ${file} (${top.length}件: ${top.map((e) => e.slug).join(', ')})`);
      } else {
        console.log(`DRY-RUN: ${file} (${top.length}件: ${top.map((e) => e.slug).join(', ')})`);
      }
      modified++;
    } catch (e) {
      console.error(`ERROR: ${file}: ${e.message}`);
      errored++;
    }
  }

  console.log(`add_feature_journal_links: modified=${modified} noDiff=${noDiff} noMatch=${noMatch} errored=${errored}${dryRun ? ' (dry/check)' : ''}`);

  if (checkMode && outdated.length > 0) {
    console.error(`CHECK FAILED: ${outdated.length}件の特集でジャーナルリンクが古い状態です`);
    process.exit(1);
  }
}

main();
