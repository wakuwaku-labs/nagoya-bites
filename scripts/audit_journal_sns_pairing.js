#!/usr/bin/env node
'use strict';
/**
 * audit_journal_sns_pairing.js  (SEO-055)
 *
 * 公開済みジャーナル記事（data/journal_published.json）に対応する
 * SNS投稿原稿（docs/daily-posts/<date>.md）が実在するかを監査する。
 *
 * 通常の自動生成フロー（run_journal_local.sh）は .md 生成をブロッキングで検証しているが、
 * バックフィル公開（Editorが手動で journal/*.html を直接作成するケース）はこの経路を通らず、
 * 2026-08-10 / 08-11 の2日で原稿の生成漏れが実際に発生した（SEO-055）。
 * 本監査はその再発を「検知して終わりにしない」ための出口（制約11）。
 *
 * 判定は検証できる事実だけで行う（制約10）: published.json のエントリ実在と
 * docs/daily-posts/<date>.md の実在。自己申告値は使わない。
 *
 * 使い方:
 *   node scripts/audit_journal_sns_pairing.js          # 一覧表示
 *   node scripts/audit_journal_sns_pairing.js --check  # 欠落があれば exit 1（CI向け）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLISHED = path.join(ROOT, 'data', 'journal_published.json');
const POSTS_DIR = path.join(ROOT, 'docs', 'daily-posts');

function main() {
  const args = process.argv.slice(2);
  if (!fs.existsSync(PUBLISHED)) {
    console.log('journal_published.json が無いためスキップ');
    process.exit(0);
  }
  const data = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const entries = data.entries || [];

  const missing = entries
    .filter((e) => e.date && !fs.existsSync(path.join(POSTS_DIR, `${e.date}.md`)))
    .map((e) => ({ date: e.date, slug: e.slug, title: e.title }));

  console.log(`公開済みジャーナル: ${entries.length}件 / SNS原稿あり: ${entries.length - missing.length}件 / 欠落: ${missing.length}件`);
  if (missing.length) {
    console.log('\n欠落一覧（journal記事はあるがdocs/daily-posts/<date>.mdが無い）:');
    missing.forEach((m) => console.log(`  - ${m.date}  ${m.slug}  「${m.title}」`));
  }

  if (args.includes('--check') && missing.length) {
    process.exit(1);
  }
}

main();
