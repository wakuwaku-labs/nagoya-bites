#!/usr/bin/env node
'use strict';
/**
 * scripts/audit_stub_links.js（ISSUE-182）
 *
 * 特集・ジャーナル・エリア×ジャンルのページ・トップから、誘導ページ（ISSUE-102・古い ID の
 * stores/<slug>.html）へのリンクを数える。誘導ページは今の店舗ページへ送るが、同じ店の予約リンク
 * （古い ID のホットペッパー）と計測（store_id）は古いまま残る。2026-10-09 に特集12本の19件と
 * ジャーナル4本が残っていたのに、数える検査が無かった（ISSUE-180）。
 *
 * 判定は scripts/lib/store_orphans.js の findStubLinks の1本（リンク先のファイルが誘導ページか）。
 * 人が確かめて残すと決めた組は data/stub_link_reviewed.json に理由つきで書き、数えずに別枠で出す。
 * 誘導先が変わった組は数え直す。
 *
 * 見つけたら: 誘導先が同じ店か（店名・住所・data/store_merge_pairs.json）を確かめ、同じ店なら
 * 店舗リンク・ItemList・予約リンク・計測の ID を今のものにそろえる。別の店なら差し替えない。
 *
 * 使い方:
 *   node scripts/audit_stub_links.js           # 一覧
 *   node scripts/audit_stub_links.js --json    # JSON だけ
 *   node scripts/audit_stub_links.js --check   # 確認済みでないリンクが1件でもあれば exit 1（夜間QA soft）
 */
const fs = require('fs');
const path = require('path');
const { findStubLinks } = require('./lib/store_orphans');

const ROOT = path.join(__dirname, '..');
const REVIEWED = path.join(ROOT, 'data', 'stub_link_reviewed.json');

function loadReviewed(file) {
  if (!fs.existsSync(file)) return [];
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(j.reviewed) ? j.reviewed : [];
}

function main() {
  const args = process.argv.slice(2);
  const r = findStubLinks(ROOT, { reviewed: loadReviewed(REVIEWED) });
  const summary = {
    pages: r.pages,
    stubLinks: r.found.reduce((a, x) => a + x.count, 0),
    stubLinkPages: new Set(r.found.map((x) => x.page)).size,
    found: r.found,
    reviewedKeep: r.kept,
  };
  if (args.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    for (const x of r.found) console.log(`  ✗ ${x.page}: stores/${x.slug}.html（誘導先 ${x.target}）×${x.count}`);
    for (const x of r.kept) console.log(`  ・確認済みで残す ${x.page}: stores/${x.slug}.html（誘導先 ${x.target}・${x.issue}）`);
    console.log(`誘導ページへのリンク: ${summary.stubLinks} 件（${summary.stubLinkPages} ページ）/ 確認済みで残す ${r.kept.length} 組 / 調べたページ ${r.pages} 本`);
  }
  if (args.includes('--check') && r.found.length > 0) process.exit(1);
}

if (require.main === module) main();
module.exports = { loadReviewed };
