#!/usr/bin/env node
/**
 * fix_ramen_schema_pollution.js
 *
 * ISSUE-059: features/*.html の 20 ファイルで Article/ItemList/BreadcrumbList/FAQPage
 * の JSON-LD すべてが「名古屋ラーメン12選」のテンプレを copy-paste されている問題を
 * 機械的に修復する。
 *
 * 方針（安全側に振る）:
 *   1. Article ブロック: headline / description / url / image / mainEntityOfPage を当該ファイル用に置換
 *   2. BreadcrumbList ブロック: 末端 name を title 由来に置換
 *   3. ItemList / FAQPage ブロック: ラーメン内容そのものなので**完全除去**
 *      （誤情報を残すより無いほうが安全。後日 per-file で正しい ItemList/FAQ を作成）
 *   4. 元データは git で履歴管理されているため backup 不要
 *
 * 安全装置:
 *   - 対象は「Article.url が nagoya-ramen.html を指している」ファイルのみ（false-positive 防止）
 *   - 既に修正済み（Article.url が当該ファイル）はスキップ
 *   - 本物のラーメン特集 nagoya-ramen.html は除外
 *
 * 使い方:
 *   node scripts/fix_ramen_schema_pollution.js --dry-run   # 修正計画のみ表示
 *   node scripts/fix_ramen_schema_pollution.js             # 実行
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FEATURES_DIR = path.join(__dirname, '..', 'features');
const RAMEN_FILE = 'nagoya-ramen.html';
const DRY_RUN = process.argv.includes('--dry-run');

function extract(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : '';
}

function buildArticleBlock(filename, title, h1, image) {
  const url = `https://nagoya-bites.com/features/${filename}`;
  // headline は h1 を優先、無ければ title から接尾辞「｜NAGOYA BITES」と「【2026年版】」等を取り除いたもの
  const headline = h1 || title.replace(/\s*｜.*$/, '').trim();
  // description は title 由来の簡潔版
  const description = `${headline} — NAGOYA BITES編集部による業界視点の厳選。実在検証済みの店舗のみ掲載しています。`;
  // 既存の OG 画像を尊重（feature-figures パス）
  const imageUrl = image || `https://nagoya-bites.com/assets/feature-figures/${filename.replace(/\.html$/, '.svg')}`;

  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": ${JSON.stringify(headline)},
  "description": ${JSON.stringify(description)},
  "author": {"@type": "Organization", "name": "NAGOYA BITES"},
  "publisher": {"@type": "Organization", "name": "NAGOYA BITES", "url": "https://nagoya-bites.com/"},
  "url": ${JSON.stringify(url)},
  "datePublished": "2026-05-14",
  "dateModified": "2026-05-25",
  "image": ${JSON.stringify(imageUrl)},
  "mainEntityOfPage": ${JSON.stringify(url)}
}
</script>`;
}

function buildBreadcrumbBlock(title) {
  const lastName = title.replace(/\s*｜\s*NAGOYA BITES.*$/, '').trim();
  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type":"ListItem","position":1,"name":"NAGOYA BITES","item":"https://nagoya-bites.com/"},
    {"@type":"ListItem","position":2,"name":"特集","item":"https://nagoya-bites.com/features/"},
    {"@type":"ListItem","position":3,"name":${JSON.stringify(lastName)}}
  ]
}
</script>`;
}

function fixFile(filename) {
  const filePath = path.join(FEATURES_DIR, filename);
  let html = fs.readFileSync(filePath, 'utf8');

  // Article.url を確認 — このファイルが汚染されているかを判定
  if (!html.includes('"url": "https://nagoya-bites.com/features/nagoya-ramen.html"')
      && !html.includes('"mainEntityOfPage": "https://nagoya-bites.com/features/nagoya-ramen.html"')) {
    return { filename, skipped: 'not_polluted' };
  }

  const title = extract(html, /<title[^>]*>([^<]+)<\/title>/);
  const h1 = extract(html, /<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const ogImage = extract(html, /<meta property="og:image" content="([^"]+)"/);

  if (!title) return { filename, skipped: 'no_title' };

  // すべての JSON-LD ブロックを抽出
  const jsonLdRegex = /<script type="application\/ld\+json">\s*[\s\S]*?\s*<\/script>/g;
  const blocks = html.match(jsonLdRegex) || [];

  // 各ブロックを「型」で分類し、**ラーメン汚染シグナル**を含むものだけを polluted 対象とする
  // （同じ型の正しいブロックが body 側に存在するケースを保護）
  const RAMEN_SIGNALS = [
    '麺屋はなび', '歌志軒', '拉ノ刻', '台湾まぜそば', '担々麺', '担担麺',
    'ラーメン激戦区', '名古屋ラーメン', '煮干し系', '豚骨醤油',
    'nagoya-ramen.html'
  ];
  function isRamenPolluted(blockText) {
    // ファイル名が nagoya-ramen 以外なら、上記シグナルを含むブロックは汚染
    return RAMEN_SIGNALS.some(s => blockText.includes(s));
  }
  const polluted = [];
  for (const b of blocks) {
    let parsed;
    try { parsed = JSON.parse(b.replace(/^<script[^>]*>\s*/, '').replace(/\s*<\/script>$/, '')); } catch { continue; }
    const type = parsed['@type'];
    if ((type === 'Article' || type === 'ItemList' || type === 'BreadcrumbList' || type === 'FAQPage')
        && isRamenPolluted(b)) {
      polluted.push({ block: b, type });
    }
  }

  if (polluted.length === 0) return { filename, skipped: 'no_target_blocks' };

  // 戦略: 4 ブロックすべてを削除し、Article + BreadcrumbList のみを再挿入
  // ItemList と FAQPage はラーメン内容そのままなので除去
  // 連続する JSON-LD ブロックの最初の位置を探す
  const firstIdx = html.indexOf(polluted[0].block);
  // 連続する JSON-LD ブロック群をひとまとめにして削除
  let combined = '';
  for (const p of polluted) combined += p.block + '\n';
  // 各 polluted block を順次除去
  for (const p of polluted) {
    html = html.replace(p.block, '');
  }
  // 連続する空行を整理
  html = html.replace(/\n{3,}/g, '\n\n');

  // 新しい Article + BreadcrumbList を挿入（最初の polluted ブロックがあった位置に）
  const newBlocks = buildArticleBlock(filename, title, h1, ogImage) + '\n' + buildBreadcrumbBlock(title);
  // <link rel="stylesheet"> の直後あたり、または <style> の直前に挿入
  if (html.includes('<style>')) {
    html = html.replace('<style>', newBlocks + '\n<style>');
  } else {
    // フォールバック: </head> の直前
    html = html.replace('</head>', newBlocks + '\n</head>');
  }

  if (DRY_RUN) {
    console.log(`[DRY] ${filename}: ${polluted.length} ブロック除去（${polluted.map(p => p.type).join(',')}）→ Article + Breadcrumb を再注入`);
  } else {
    fs.writeFileSync(filePath, html);
    console.log(`✅ ${filename}: ${polluted.length} ブロック修復（${polluted.map(p => p.type).join(',')}）`);
  }

  return { filename, fixed: polluted.length, types: polluted.map(p => p.type) };
}

function main() {
  const files = fs.readdirSync(FEATURES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html' && f !== RAMEN_FILE);

  let fixedCount = 0;
  let skippedCount = 0;
  for (const f of files) {
    const r = fixFile(f);
    if (r.fixed) fixedCount++;
    else skippedCount++;
  }

  console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}修復: ${fixedCount} ファイル / スキップ: ${skippedCount} ファイル`);
}

main();
