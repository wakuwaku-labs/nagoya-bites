#!/usr/bin/env node
/**
 * audit_page_store_links.js — 特集とジャーナルに手で書かれた食べログ・ホットペッパーのリンクが、
 * 別の店を指していないかを毎日確かめる（ISSUE-156）。
 *
 * 判定器は scripts/lib/page_store_links.js の1本。照合キャッシュ（data/store_link_identity_checked.json）
 * で「別の店」と判定済みの URL だけを数え、外部へは問い合わせない（制約10）。キャッシュは
 * build.yml の audit_store_link_identity.js が日々更新する。
 * 見つかったリンクは、clear_broken_tabelog_links.js と同じく外す（推測で別の URL に差し替えない。
 * 正しい URL を住所などの一次情報で確かめられたときだけ差し替える）。
 *
 * 使い方:
 *   node scripts/audit_page_store_links.js             # 一覧を出す
 *   node scripts/audit_page_store_links.js --check     # 1件でもあれば exit 1（夜間QA）
 *   node scripts/audit_page_store_links.js --json      # JSON で出す
 *   node scripts/audit_page_store_links.js --only journal
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildVerdictIndex, auditPages, listPages } = require('./lib/page_store_links');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, 'data', 'store_link_identity_checked.json');

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const json = args.includes('--json');
  const oi = args.indexOf('--only');
  const only = oi >= 0 ? args[oi + 1] : null;
  if (only && !['features', 'journal'].includes(only)) {
    console.error('--only は features か journal');
    process.exit(2);
  }
  if (!fs.existsSync(CACHE)) {
    console.error('照合キャッシュが無い: data/store_link_identity_checked.json');
    process.exit(2);
  }
  const index = buildVerdictIndex(JSON.parse(fs.readFileSync(CACHE, 'utf8')));
  const files = listPages(ROOT, only);
  const pages = files.map((file) => ({ file, html: fs.readFileSync(path.join(ROOT, file), 'utf8') }));
  const findings = auditPages(pages, index);
  if (json) {
    console.log(JSON.stringify({ pages: files.length, cachedUrls: index.size, findings }, null, 2));
  } else {
    for (const f of findings) {
      console.log(`  ✗ ${f.file}: ${f.url}`);
      console.log(`      我々の店名: ${f.storeNames.join(' / ') || '-'} → リンク先: ${f.title || f.matchedName || f.reason}`);
    }
    console.log(`特集・ジャーナルの、別の店を指す店舗リンク: ${findings.length} 件（対象 ${files.length} ページ・照合済みの URL ${index.size} 件）`);
  }
  if (check && findings.length) process.exit(1);
}

if (require.main === module) main();
