#!/usr/bin/env node
'use strict';
/**
 * scripts/audit_internal_links.js（P-383）
 *
 * 公開ページの <a href> のうち、サイト内を指すもの（相対・ルート相対・nagoya-bites.com の絶対）の
 * リンク先が、リポジトリの中のファイルとして実在するかを数える。
 * 2026-05 から 5 か月、一度も公開されていない記事（月曜夜の業界人記事）へのリンクが 404 のまま
 * 公開されていたのに、リンク先の実在を数える検査がリポジトリのどこにも無かった（P-382）。
 * 既存の audit_stub_links.js は「誘導ページを指すか」、audit_page_store_links.js は「食べログ・
 * ホットペッパーの URL が別の店か」を見る。どちらも「そのファイルがあるか」は見ない。
 *
 * 判定は検証できる事実（ファイルの有無）だけ（制約10）。判定器は scripts/lib/internal_links.js の1本。
 * 外部 URL・mailto:・tel:・# だけのもの・<script>/<style>/コメントの中・JS の文字列のつなぎは数えない。
 * 実在の見方は GitHub Pages が返すものに合わせる（/ で終わる→その下の index.html、拡張子なし→.html か
 * index.html、大文字小文字は区別する、query と fragment は外す）。
 *
 * 見つけたら: リンク先の記事・ページが本当に無いのか（名前の綴り・移動・未公開）を確かめ、
 * 移っていたらリンク先を直し、公開されていないならリンクを外す（P-382 は後者）。
 *
 * 使い方:
 *   node scripts/audit_internal_links.js                  # 一覧（リンク先が無いものだけ）
 *   node scripts/audit_internal_links.js --json           # JSON だけ
 *   node scripts/audit_internal_links.js --check          # 1件でもあれば exit 1（夜間QA soft）
 *   node scripts/audit_internal_links.js --only journal   # root / features / journal / stores / area に絞る
 *   node scripts/audit_internal_links.js --root <dir>     # 別のルート（試験用）
 */
const fs = require('fs');
const path = require('path');
const { listPublishedPages, SECTIONS, DEFAULT_ROOT } = require('./lib/published_pages');
const { auditPages } = require('./lib/internal_links');

const LIST_LIMIT = 100;

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

function main() {
  const args = process.argv.slice(2);
  const only = argValue(args, '--only');
  if (only && !SECTIONS.includes(only)) {
    console.error('--only は ' + SECTIONS.join(' / ') + ' のどれか: ' + only);
    process.exit(2);
  }
  const rootArg = argValue(args, '--root');
  const root = rootArg ? path.resolve(rootArg) : DEFAULT_ROOT;
  if (!fs.existsSync(root)) {
    console.error('--root が見つかりません: ' + root);
    process.exit(2);
  }
  const pages = listPublishedPages({ root, only });
  const r = auditPages(pages, root);
  const brokenLinks = r.broken.reduce((a, x) => a + x.count, 0);
  const summary = {
    pages: r.pages,
    internalLinks: r.internalLinks,
    brokenLinks,
    brokenTargets: new Set(r.broken.map((x) => x.target)).size,
    brokenPages: new Set(r.broken.map((x) => x.page)).size,
    broken: r.broken,
  };
  if (args.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    for (const x of r.broken.slice(0, LIST_LIMIT)) {
      console.log(`  ✗ ${x.page} → ${x.target}${x.count > 1 ? ' ×' + x.count : ''}`);
    }
    if (r.broken.length > LIST_LIMIT) console.log(`  …ほか ${r.broken.length - LIST_LIMIT} 組（--json で全件）`);
    console.log(
      `リンク先が無い内部リンク: ${brokenLinks} 件（リンク先 ${summary.brokenTargets} 種・${summary.brokenPages} ページ）` +
      ` / 調べた内部リンク ${r.internalLinks} 件・ページ ${r.pages} 本`
    );
  }
  if (args.includes('--check') && r.broken.length > 0) process.exit(1);
}

if (require.main === module) main();
module.exports = { main };
