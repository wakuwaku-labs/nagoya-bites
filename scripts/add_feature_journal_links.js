#!/usr/bin/env node
'use strict';
/**
 * add_feature_journal_links.js  (SEO-056 / SEO-108)
 *
 * 特集記事（features/*.html）に、同じ店を扱っているジャーナル記事（journal/*.html）への
 * 内部リンクを設置する。三層編集（DB／特集／ジャーナル）のうち、ジャーナル→特集は
 * refresh_journal_related.js で自動化済みだが、逆方向（特集→ジャーナル個別記事）が
 * 0本だった（最大の入口である特集が最新層への出口を持たない＝回遊が伸びない構造要因）。
 *
 * 対応関係は2つのキーの論理和で決定する（制約10：検証できる事実のみ）:
 *   1. store_ids: data/journal_published.json の store_ids と特集HTML内の
 *      href="../stores/JXXXX.html" の店舗ID一致
 *   2. KW: data/journal_seo_keywords.json の scenes[].aliases いずれかが
 *      ジャーナル記事タイトルに含まれ、かつその scenes[].feature が当該特集ファイルである
 *
 * - 冪等（再生成型）: MARKER区間があれば差し替え、無ければ挿入。差分なしなら書かない。
 *   （旧: マーカーがあればスキップ → SEO-108 で修正）
 * - 一致が無い特集には何も追加しない（空のセクションを作らない）
 * - 挿入先は既存の <div class="related"> 内、related-journal 段落の直後。
 *   .related が無いファイルは <footer より前に単独ブロックとして挿入する
 * - クリック計測は internal_link_click（SEO-052と同じイベント名・block='feature_journal'）
 *
 * 使い方:
 *   node scripts/add_feature_journal_links.js            # 全 features/*.html に適用
 *   node scripts/add_feature_journal_links.js --dry-run   # 書き込まず差分を表示
 *   node scripts/add_feature_journal_links.js --check     # 更新が必要なら exit 1（CI向け）
 */

const fs   = require('fs');
const path = require('path');

const ROOT         = path.join(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const PUBLISHED    = path.join(ROOT, 'data', 'journal_published.json');
const SEO_KW       = path.join(ROOT, 'data', 'journal_seo_keywords.json');

const MARKER   = 'related-journal-articles';
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
  const map = new Map(); // storeId → [entry]
  for (const e of (data.entries || [])) {
    for (const id of (e.store_ids || [])) {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(e);
    }
  }
  return map;
}

// feature ファイル名（features/xxx.html）→ aliases[] のマップを構築
function buildKwMap() {
  let kwData = { scenes: [] };
  try { kwData = JSON.parse(fs.readFileSync(SEO_KW, 'utf8')); } catch {}
  // featurePath（"features/nagoya-solo-dining.html"）→ aliases[]
  const map = new Map();
  for (const s of (kwData.scenes || [])) {
    if (!s.feature || !s.aliases) continue;
    const key = s.feature; // "features/xxx.html"
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(...s.aliases.map(a => a.toLowerCase()));
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

// 既存のマーカー区間（オプションの先行空白を含む）を除去
function stripMarkerBlock(html) {
  // 先行空白（インデント）も含めて除去し、inject が再挿入した結果と一致するようにする
  const re = /[ \t]*<p class="[^"]*related-journal-articles[^"]*"[\s\S]*?[ \t]*<\/div>\n/;
  return html.replace(re, '');
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
  return null;
}

function main() {
  const args    = process.argv.slice(2);
  const dryRun  = args.includes('--dry-run');
  const check   = args.includes('--check');

  const storeToJournals = buildStoreToJournalsMap();
  const kwMap           = buildKwMap();

  const publishedData = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const allEntries     = publishedData.entries || [];

  const files = fs.readdirSync(FEATURES_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_'));

  let modified = 0, unchanged = 0, noMatch = 0, errored = 0;
  const needsUpdate = [];

  for (const file of files) {
    try {
      const filePath   = path.join(FEATURES_DIR, file);
      const featureKey = `features/${file}`;
      const html       = fs.readFileSync(filePath, 'utf8');

      // ---- マッチング ----
      // キー1: 店舗ID
      const storeIds = new Set([...html.matchAll(/stores\/(J\d+)\.html/g)].map((m) => m[1]));
      // キー2: KW（この特集に紐づく aliases）
      const featureAliases = kwMap.get(featureKey) || [];

      const seenSlugs = new Set();
      const matched   = [];

      // キー1
      for (const id of storeIds) {
        for (const e of (storeToJournals.get(id) || [])) {
          if (seenSlugs.has(e.slug)) continue;
          seenSlugs.add(e.slug);
          matched.push(e);
        }
      }
      // キー2
      if (featureAliases.length > 0) {
        for (const e of allEntries) {
          if (seenSlugs.has(e.slug)) continue;
          const title = (e.title || '').toLowerCase();
          if (featureAliases.some(a => title.includes(a))) {
            seenSlugs.add(e.slug);
            matched.push(e);
          }
        }
      }

      if (matched.length === 0) { noMatch++; continue; }

      matched.sort((a, b) => (a.date < b.date ? 1 : -1));
      const top      = matched.slice(0, MAX_LINKS);
      const newBlock = buildBlockHtml(top);

      // 既存マーカー区間を取り除いてから再挿入（冪等）
      const baseHtml = html.includes(MARKER) ? stripMarkerBlock(html) : html;
      const newHtml  = inject(baseHtml, newBlock);

      if (!newHtml) {
        console.error(`SKIP (挿入先not found): ${file}`);
        unchanged++;
        continue;
      }

      if (newHtml === html) {
        unchanged++;
        continue; // 差分なし
      }

      needsUpdate.push(file);
      if (dryRun || check) {
        console.log(`[${check ? 'CHECK' : 'DRY-RUN'}] NEEDS UPDATE: ${file} (${top.length}件: ${top.map((e) => e.slug).join(', ')})`);
        modified++;
        continue;
      }

      fs.writeFileSync(filePath, newHtml, 'utf8');
      console.log(`OK: ${file} (${top.length}件: ${top.map((e) => e.slug).join(', ')})`);
      modified++;
    } catch (e) {
      console.error(`ERROR: ${file}: ${e.message}`);
      errored++;
    }
  }

  console.log(`add_feature_journal_links: modified=${modified} unchanged=${unchanged} noMatch=${noMatch} errored=${errored}${dryRun ? ' (--dry-run)' : ''}${check ? ' (--check)' : ''}`);

  if (check && needsUpdate.length > 0) {
    console.error(`check: ${needsUpdate.length} feature(s) need journal link updates`);
    process.exit(1);
  }
  if (check) {
    console.log('check: OK (all features up to date)');
  }
}

main();
