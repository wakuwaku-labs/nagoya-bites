#!/usr/bin/env node
/**
 * add_journal_site_intro.js  (SEO-008)
 *
 * ジャーナル記事 HTML の <div class="art-body"> 直後に、NAGOYA BITES の
 * サイト紹介文 + index.html への内部リンクを 1行挿入する。
 *
 * - 冪等: class="nb-site-intro" が既存のファイルはスキップ
 * - 引数に複数ファイルを渡してバッチ適用可
 * - 失敗しても exit 1 にしない（run_journal_local.sh から非ブロッキングで呼ぶため）
 *
 * 使用例:
 *   node scripts/add_journal_site_intro.js journal/2026-08-04-*.html
 *   node scripts/add_journal_site_intro.js $(ls journal/2026-*.html)
 */

'use strict';
const fs = require('fs');

const MARKER = 'nb-site-intro';
const ANCHOR = '<div class="art-body">';
const INTRO_HTML =
  `<p class="${MARKER}" style="font-size:.74rem;color:var(--dim);padding:.55rem .9rem;` +
  `background:var(--bg2);border:1px solid var(--border);border-radius:4px;` +
  `margin-bottom:1.5rem;line-height:1.7;">` +
  `この記事は<a href="../index.html" style="color:var(--gold);text-decoration:none;">NAGOYA BITES</a>` +
  ` — 名古屋の厳選1,100店超を業界視点で紹介するグルメガイドの一部です。</p>`;

const files = process.argv.slice(2).filter(f => f && f.endsWith('.html'));

if (files.length === 0) {
  console.log('add_journal_site_intro: 対象ファイルなし（引数なし）');
  process.exit(0);
}

let modified = 0;
let skipped = 0;
let errored = 0;

for (const file of files) {
  try {
    if (!fs.existsSync(file)) {
      console.error(`SKIP (not found): ${file}`);
      skipped++;
      continue;
    }
    let html = fs.readFileSync(file, 'utf8');
    if (html.includes(MARKER)) {
      console.log(`SKIP (already present): ${file}`);
      skipped++;
      continue;
    }
    const idx = html.indexOf(ANCHOR);
    if (idx === -1) {
      console.log(`SKIP (art-body not found): ${file}`);
      skipped++;
      continue;
    }
    const insertAt = idx + ANCHOR.length;
    html = html.slice(0, insertAt) + '\n' + INTRO_HTML + '\n' + html.slice(insertAt);
    fs.writeFileSync(file, html, 'utf8');
    console.log(`OK: ${file}`);
    modified++;
  } catch (e) {
    console.error(`ERROR: ${file}: ${e.message}`);
    errored++;
  }
}

console.log(`add_journal_site_intro: modified=${modified} skipped=${skipped} errored=${errored}`);
