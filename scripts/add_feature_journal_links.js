#!/usr/bin/env node
'use strict';
/**
 * add_feature_journal_links.js  (SEO-056, SEO-108)
 *
 * 特集記事（features/*.html）に、同じ店を扱っているジャーナル記事（journal/*.html）への
 * 内部リンクを設置する。三層編集（DB／特集／ジャーナル）のうち、ジャーナル→特集は
 * refresh_journal_related.js で自動化済みだが、逆方向（特集→ジャーナル個別記事）が
 * 0本だった（最大の入口である特集が最新層への出口を持たない＝回遊が伸びない構造要因）。
 *
 * 対応関係は2つの鍵で決定する（SEO-108）:
 *   1. data/journal_published.json の store_ids と、特集HTML内の href="../stores/JXXXX.html" の突合
 *   2. ジャーナル記事タイトルが data/journal_seo_keywords.json の KW（またはその aliases）を含み、
 *      その KW の feature フィールドが当該特集と一致するもの
 * 実在する記事のみを出す（架空リンク・404を作らない）。
 *
 * - 冪等: HTML コメントマーカー（SEO-108:JOURNAL-LINKS:START/END）で区間を識別し、
 *         差分があるときだけ書き直す（一度書いたらスキップ → 廃止）
 * - 一致が無い特集には何も追加しない（空のセクションを作らない）
 * - 挿入先は既存の <div class="related"> 内、related-journal 段落の直後
 *   （add_related_features.js が作る「関連する特集記事」ブロックの隣）。
 *   .related が無いファイルは <footer より前に単独ブロックとして挿入する
 * - クリック計測は internal_link_click（SEO-052と同じイベント名・block='feature_journal'）
 *
 * 使い方:
 *   node scripts/add_feature_journal_links.js            # 全 features/*.html に適用
 *   node scripts/add_feature_journal_links.js --dry-run  # 書き込まず対象・件数だけ表示
 *   node scripts/add_feature_journal_links.js --check    # 差分があれば exit 1（CI向け）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const PUBLISHED = path.join(ROOT, 'data', 'journal_published.json');
const SEO_KW = path.join(ROOT, 'data', 'journal_seo_keywords.json');

const BLOCK_START = '<!-- SEO-108:JOURNAL-LINKS:START -->';
const BLOCK_END = '<!-- SEO-108:JOURNAL-LINKS:END -->';
const MARKER = 'related-journal-articles'; // p クラス名（後方互換のため残す）
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

// 鍵1: store_id → journal entries
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

// 鍵2: feature相対パス → journal entries（タイトルKW一致）
function buildFeatureToKwJournalsMap() {
  const kwData = JSON.parse(fs.readFileSync(SEO_KW, 'utf8'));
  const publishedData = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const entries = publishedData.entries || [];

  // feature パス → 全 aliases の配列
  const featureAliases = new Map();
  for (const section of [kwData.areas || [], kwData.scenes || [], kwData.genres || []]) {
    for (const item of section) {
      if (!item.feature) continue;
      // feature フィールドは "features/xxx.html" 形式
      const key = item.feature.startsWith('features/') ? item.feature.replace('features/', '') : null;
      if (!key) continue;
      if (!featureAliases.has(key)) featureAliases.set(key, []);
      for (const alias of item.aliases || [item.kw]) {
        featureAliases.get(key).push(alias);
      }
    }
  }

  // feature ファイル名 → 一致する journal entries
  const result = new Map();
  for (const [featureFile, aliases] of featureAliases) {
    const matched = entries.filter(e => {
      if (!e.title) return false;
      return aliases.some(a => e.title.includes(a));
    });
    if (matched.length > 0) result.set(featureFile, matched);
  }
  return result;
}

function buildBlockHtml(entries) {
  const links = entries.map((e) => {
    const href = `../journal/${e.slug}.html`;
    return `    <a class="related-link" href="${esc(href)}" onclick="trackEvent('internal_link_click',{link_url:'${jsEsc(href)}',link_text:'${jsEsc(shortLabel(e.title))}',block:'feature_journal'})">${esc(shortLabel(e.title))}</a>`;
  }).join('\n');
  return (
    `${BLOCK_START}\n` +
    `  <p class="related-journal-title ${MARKER}" style="margin-top:1.2rem;font-size:.7rem;letter-spacing:.08em;color:rgba(28,28,26,.5);text-transform:uppercase;">この特集の店の最新ジャーナル記事</p>\n` +
    `  <div class="related-links">\n${links}\n  </div>\n` +
    `${BLOCK_END}\n`
  );
}

// 既存マーカー区間を新しい blockHtml で置換する（冪等）
function replaceBlock(html, blockHtml) {
  const si = html.indexOf(BLOCK_START);
  const ei = html.indexOf(BLOCK_END);
  if (si !== -1 && ei !== -1) {
    return html.slice(0, si) + blockHtml + html.slice(ei + BLOCK_END.length + 1); // +1 for \n
  }
  return null; // マーカーなし → inject() へ
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
      return html.slice(0, linksClose) + '\n' + blockHtml.trimEnd() + '\n' + html.slice(linksClose);
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
  const checkMode = args.includes('--check');

  const storeToJournals = buildStoreToJournalsMap();
  const featureToKwJournals = buildFeatureToKwJournalsMap();

  const files = fs.readdirSync(FEATURES_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_'));

  let modified = 0, upToDate = 0, noMatch = 0, errored = 0, stale = 0;

  for (const file of files) {
    try {
      const filePath = path.join(FEATURES_DIR, file);
      let html = fs.readFileSync(filePath, 'utf8');

      // 鍵1: store_id 一致
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

      // 鍵2: KW一致（同じ特集ファイルを指す KW の aliases がタイトルに含まれる）
      const kwJournals = featureToKwJournals.get(file) || [];
      for (const e of kwJournals) {
        if (seenSlugs.has(e.slug)) continue;
        seenSlugs.add(e.slug);
        matched.push(e);
      }

      if (matched.length === 0) { noMatch++; continue; }

      matched.sort((a, b) => (a.date < b.date ? 1 : -1)); // 新しい記事を優先
      const top = matched.slice(0, MAX_LINKS);

      const blockHtml = buildBlockHtml(top);

      // 冪等: 既存マーカー区間があれば置換、なければ inject
      let newHtml = replaceBlock(html, blockHtml);
      if (newHtml === null) {
        newHtml = inject(html, blockHtml);
      }

      if (!newHtml) {
        console.error(`SKIP (挿入先not found): ${file}`);
        errored++;
        continue;
      }

      if (newHtml === html) {
        upToDate++;
        continue;
      }

      if (checkMode) {
        console.log(`STALE: ${file} (${top.length}件)`);
        stale++;
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

  if (checkMode) {
    console.log(`add_feature_journal_links --check: stale=${stale} upToDate=${upToDate} noMatch=${noMatch} errored=${errored}`);
    if (stale > 0 || errored > 0) process.exit(1);
  } else {
    console.log(`add_feature_journal_links: modified=${modified} upToDate=${upToDate} noMatch=${noMatch} errored=${errored}${dryRun ? ' (--dry-run)' : ''}`);
  }
}

main();
