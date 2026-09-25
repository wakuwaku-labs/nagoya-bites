#!/usr/bin/env node
'use strict';
/**
 * add_feature_journal_links.js  (SEO-056 / SEO-108)
 *
 * 特集記事（features/*.html）に、同じ店を扱っているか同シーンKWを持つ
 * ジャーナル記事（journal/*.html）への内部リンクを設置する。
 *
 * 対応関係は2つのキーで決定（並列・どちらか一方でも一致すればリンク対象）:
 *   1. 店舗ID一致: data/journal_published.json の store_ids と、
 *      特集HTML内の href="../stores/JXXXX.html" を突合
 *   2. KW一致: data/journal_seo_keywords.json の scenes[]/genres[]/areas[] に定義された
 *      KW（表記揺れ含む）がジャーナル記事タイトルに含まれ、
 *      かつそのKWのfeatureが当該特集ファイルである
 *
 * 実在する記事のみを出す（架空リンク・404を作らない）。
 * 一致が無い特集には何も追加しない（空のセクションを作らない）。
 *
 * 冪等性: <!-- SEO-108:JOURNAL-LINKS:START --> 〜 <!-- SEO-108:JOURNAL-LINKS:END --> の
 * 間だけを差し替える（何度実行しても差分がなければ書き込まない）。
 * 旧形式（class="related-journal-articles" だけでコメントマーカー無し）は自動移行する。
 *
 * 上限件数（maxFeatureJournalLinks）は data/journal_seo_keywords.json に置く（制約10）。
 *
 * 使い方:
 *   node scripts/add_feature_journal_links.js            # 全 features/*.html に適用
 *   node scripts/add_feature_journal_links.js --dry-run  # 書き込まず対象・件数だけ表示
 *   node scripts/add_feature_journal_links.js --check    # 未反映差分があれば exit 1（CI向け）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const PUBLISHED_PATH = path.join(ROOT, 'data', 'journal_published.json');
const KW_PATH = path.join(ROOT, 'data', 'journal_seo_keywords.json');

const MARK_START = '<!-- SEO-108:JOURNAL-LINKS:START -->';
const MARK_END = '<!-- SEO-108:JOURNAL-LINKS:END -->';
const FOOTER_ANCHOR = '<!-- NB-CHROME:FOOTER:START -->';
// 旧形式の class マーカー（移行検出用）
const LEGACY_CLASS = 'related-journal-articles';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function jsEsc(s) {
  return String(s || '').replace(/'/g, '').replace(/</g, '').replace(/>/g, '');
}

function shortLabel(title) {
  if (!title) return '';
  const dash = title.indexOf(' — ');
  const base = dash > 0 ? title.slice(0, dash) : title;
  return base.length > 38 ? base.slice(0, 36) + '…' : base;
}

function loadPublished() {
  const data = JSON.parse(fs.readFileSync(PUBLISHED_PATH, 'utf8'));
  return data.entries || [];
}

function loadKwData() {
  return JSON.parse(fs.readFileSync(KW_PATH, 'utf8'));
}

/**
 * store_ids → journal entries のマップを構築
 */
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

/**
 * feature path → KW aliases のマップを構築
 * 例: 'features/nagoya-solo-dining.html' → ['一人飲み', '1人飲み', 'カウンター', ...]
 */
function buildFeatureToAliasMap(kwData) {
  const map = new Map();
  for (const section of ['scenes', 'genres', 'areas']) {
    for (const entry of kwData[section] || []) {
      const feat = entry.feature;
      if (!feat) continue;
      const aliases = entry.aliases || [entry.kw].filter(Boolean);
      if (!map.has(feat)) map.set(feat, []);
      for (const a of aliases) map.get(feat).push(a);
    }
  }
  return map;
}

/**
 * 特集ファイル名（例: features/nagoya-solo-dining.html）に対応するジャーナル記事を収集
 * 店舗ID一致 OR KW一致（タイトルのみ）の両キーで検索し、重複を除いて日付降順で返す
 */
function collectMatchingEntries(featureRelPath, html, entries, storeToJournals, featureAliasMap, maxLinks) {
  const seen = new Set();
  const matched = [];

  // Key 1: 店舗ID一致
  const storeIds = new Set([...html.matchAll(/stores\/(J\d+)\.html/g)].map(m => m[1]));
  for (const id of storeIds) {
    for (const e of storeToJournals.get(id) || []) {
      if (!seen.has(e.slug)) {
        seen.add(e.slug);
        matched.push(e);
      }
    }
  }

  // Key 2: KW一致（タイトルのみ）
  const aliases = featureAliasMap.get(featureRelPath) || [];
  if (aliases.length > 0) {
    for (const e of entries) {
      if (seen.has(e.slug)) continue;
      const title = e.title || '';
      if (aliases.some(a => title.includes(a))) {
        seen.add(e.slug);
        matched.push(e);
      }
    }
  }

  matched.sort((a, b) => (a.date < b.date ? 1 : -1));
  return matched.slice(0, maxLinks);
}

/**
 * ジャーナルリンクブロックHTML（コメントマーカー込み）を構築
 */
function buildBlock(entries) {
  if (entries.length === 0) return '';
  const links = entries.map(e => {
    const href = `../journal/${e.slug}.html`;
    return `    <a class="related-link" href="${esc(href)}" onclick="trackEvent('internal_link_click',{link_url:'${jsEsc(href)}',link_text:'${jsEsc(shortLabel(e.title))}',block:'feature_journal'})">${esc(shortLabel(e.title))}</a>`;
  }).join('\n');
  return (
    MARK_START + '\n' +
    `  <p class="related-journal-title ${LEGACY_CLASS}" style="margin-top:1.2rem;font-size:.7rem;letter-spacing:.08em;color:rgba(28,28,26,.5);text-transform:uppercase;">この特集の店の最新ジャーナル記事</p>\n` +
    `  <div class="related-links">\n${links}\n  </div>\n` +
    MARK_END
  );
}

/**
 * 新規マーカー区間がある場合はその範囲を差し替え、
 * 旧形式マーカー（クラスのみ）がある場合は旧ブロックを探して置換、
 * いずれも無い場合は NB-CHROME:FOOTER:START の直前に挿入
 */
function applyBlock(html, block) {
  // 1) 新マーカー区間の差し替え
  const markerRe = new RegExp(
    escapeRegex(MARK_START) + '[\\s\\S]*?' + escapeRegex(MARK_END),
    'm'
  );
  if (markerRe.test(html)) {
    const updated = html.replace(markerRe, block);
    return { html: updated, action: updated === html ? 'unchanged' : 'updated' };
  }

  // 2) 旧形式マーカーがある場合: 旧ブロック全体を新ブロックで置換
  //    旧ブロック: <p class="related-journal-title related-journal-articles" ...>...</p>\n  <div class="related-links">...</div>
  const legacyRe = new RegExp(
    `\\s*<p class="related-journal-title ${LEGACY_CLASS}"[^>]*>[^<]*</p>\\n  <div class="related-links">[\\s\\S]*?</div>`,
    'm'
  );
  if (legacyRe.test(html)) {
    const updated = html.replace(legacyRe, '\n' + block);
    return { html: updated, action: 'migrated' };
  }

  // 3) 新規挿入: NB-CHROME:FOOTER:START の直前
  if (html.includes(FOOTER_ANCHOR)) {
    const updated = html.replace(FOOTER_ANCHOR, block + '\n' + FOOTER_ANCHOR);
    return { html: updated, action: 'inserted' };
  }

  // 4) 最終手段: <footer の直前
  const fi = html.indexOf('<footer');
  if (fi !== -1) {
    const updated = html.slice(0, fi) + block + '\n' + html.slice(fi);
    return { html: updated, action: 'inserted' };
  }

  return { html, action: 'skip-no-anchor' };
}

/**
 * ブロックが不要（エントリ0件）になった場合: 既存マーカー区間を除去
 */
function removeBlock(html) {
  const markerRe = new RegExp(
    escapeRegex(MARK_START) + '[\\s\\S]*?' + escapeRegex(MARK_END) + '\\n?',
    'm'
  );
  if (markerRe.test(html)) {
    return { html: html.replace(markerRe, ''), action: 'removed' };
  }
  const legacyRe = new RegExp(
    `\\s*<p class="related-journal-title ${LEGACY_CLASS}"[^>]*>[^<]*</p>\\n  <div class="related-links">[\\s\\S]*?</div>\\n?`,
    'm'
  );
  if (legacyRe.test(html)) {
    return { html: html.replace(legacyRe, ''), action: 'removed' };
  }
  return { html, action: 'unchanged' };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listFeatureFiles() {
  return fs.readdirSync(FEATURES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_'))
    .sort();
}

function verifyLinks(entries) {
  for (const e of entries) {
    const file = path.join(ROOT, 'journal', `${e.slug}.html`);
    if (!fs.existsSync(file)) return false;
  }
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const dryRun = args.includes('--dry-run') || check;

  const kwData = loadKwData();
  const maxLinks = kwData.maxFeatureJournalLinks || 3;
  const entries = loadPublished();
  const storeToJournals = buildStoreToJournalsMap(entries);
  const featureAliasMap = buildFeatureToAliasMap(kwData);

  const files = listFeatureFiles();

  let inserted = 0, updated = 0, migrated = 0, unchanged = 0, removed = 0, skipped = 0;
  const diffs = [];

  for (const file of files) {
    const featureRelPath = `features/${file}`;
    const filePath = path.join(FEATURES_DIR, file);
    let html;
    try {
      html = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      console.error(`ERROR reading ${file}: ${e.message}`);
      skipped++;
      continue;
    }

    const matched = collectMatchingEntries(featureRelPath, html, entries, storeToJournals, featureAliasMap, maxLinks);

    if (matched.length === 0) {
      // エントリ無し: 既存ブロックがあれば除去
      const { html: newHtml, action } = removeBlock(html);
      if (action === 'removed') {
        if (!dryRun) fs.writeFileSync(filePath, newHtml, 'utf8');
        removed++;
        diffs.push({ file, action });
      } else {
        unchanged++;
      }
      continue;
    }

    if (!verifyLinks(matched)) {
      console.warn(`WARN: ${file} — リンク先に存在しないファイルがあります（スキップ）`);
      skipped++;
      continue;
    }

    const block = buildBlock(matched);
    const { html: newHtml, action } = applyBlock(html, block);

    if (action === 'skip-no-anchor') {
      console.warn(`SKIP (挿入先not found): ${file}`);
      skipped++;
      continue;
    }

    if (action === 'unchanged') {
      unchanged++;
      continue;
    }

    if (!dryRun) fs.writeFileSync(filePath, newHtml, 'utf8');
    console.log(`${action.toUpperCase()}: ${file} (${matched.length}件: ${matched.map(e => e.slug).join(', ')})`);

    if (action === 'inserted') inserted++;
    else if (action === 'updated') updated++;
    else if (action === 'migrated') migrated++;
    diffs.push({ file, action, count: matched.length });
  }

  console.log(
    `add_feature_journal_links: ` +
    `inserted=${inserted} migrated=${migrated} updated=${updated} unchanged=${unchanged} removed=${removed} skipped=${skipped}` +
    (dryRun ? ' (--dry-run)' : '')
  );

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
