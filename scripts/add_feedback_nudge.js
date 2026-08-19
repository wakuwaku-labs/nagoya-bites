#!/usr/bin/env node
'use strict';
/**
 * add_feedback_nudge.js  (ISSUE-081)
 *
 * features/*.html・journal/*.html のフッター内に、トップページのフィードバック
 * ウィジェット（#fb-fab）へ誘導する1行リンクを追加する。「軽量案」の実装:
 * フル機能のウィジェット複製ではなく、既存パネルへの `../index.html#feedback` 誘導リンクのみ。
 *
 * フッターは3系統以上のパターンが混在する（単一行 <footer>...</footer> /
 * class="site-footer" の複数<p> / 最小構成 等）ため、共通して安全な挿入点として
 * **各ファイルの最後の `</footer>` 直前**にリンク段落を挿入する（内部構造に依存しない）。
 *
 * 新規記事は journal/_template.html / scripts/gen_industry_features.js に直接
 * 焼き込み済み（自動で入る）。本スクリプトは既存ファイルへの後追い適用のみ。
 *
 * - 冪等: class="feedback-nudge" を既に持つファイルはスキップ
 * - features/journal どちらも1階層下（../index.html）で同じ相対パスが使える
 *
 * 使い方:
 *   node scripts/add_feedback_nudge.js features/*.html journal/*.html
 */

const fs = require('fs');

const MARKER = 'feedback-nudge';
const NUDGE_HTML =
  `  <p class="${MARKER}" style="margin-top:.4rem;font-size:.68rem;color:rgba(247,245,241,.4);">` +
  `情報の誤りやご意見は <a href="../index.html#feedback" style="color:rgba(201,169,110,.7);">こちら</a> からお寄せください。</p>\n`;

const files = process.argv.slice(2).filter((f) =>
  f.endsWith('.html') && !f.endsWith('_template.html') && !f.endsWith('index.html')
);

if (files.length === 0) {
  console.log('add_feedback_nudge: 対象ファイルなし（引数なし）');
  process.exit(0);
}

let modified = 0, skipped = 0, errored = 0;

for (const file of files) {
  try {
    if (!fs.existsSync(file)) { console.error(`SKIP (not found): ${file}`); skipped++; continue; }
    let html = fs.readFileSync(file, 'utf8');
    if (html.includes(MARKER)) { skipped++; continue; }

    const idx = html.lastIndexOf('</footer>');
    if (idx === -1) { console.log(`SKIP (</footer> not found): ${file}`); skipped++; continue; }

    html = html.slice(0, idx) + NUDGE_HTML + html.slice(idx);
    fs.writeFileSync(file, html, 'utf8');
    modified++;
  } catch (e) {
    console.error(`ERROR: ${file}: ${e.message}`);
    errored++;
  }
}

console.log(`add_feedback_nudge: modified=${modified} skipped=${skipped} errored=${errored}`);
