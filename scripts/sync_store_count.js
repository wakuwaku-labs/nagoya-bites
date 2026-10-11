#!/usr/bin/env node
'use strict';
/**
 * scripts/sync_store_count.js — 静的なページの掲載店数の表記を、1つの値にそろえる（I-06 / P-272）
 *
 * 値の出どころは scripts/lib/store_count.js の1本（data/stores.json の営業中の店を 500 件単位に丸めた
 * 「約5,000」）。このスクリプトは、手で書かれたページの数字の部分だけを書き換える（言い回しは変えない）。
 * 冪等。丸めた値が変わった日に、同じ実行で追いつく。判断の記録: docs/decisions/0021-store-count-notation.md
 *
 * 対象（scope）:
 *   index         index.html                      本文・メタ・構造化データの「N軒」と numberOfItems、権威性バーの静的な数字
 *   stores-index  stores/index.html               同上
 *   faq           faq.html
 *   features      features/*.html                 「N軒」と、トップページへの導線の「全N店舗」（数字を外す）
 *   journal       journal/*.html                  記事の冒頭の紹介文（nb-site-intro）だけ。本文の数は触らない
 *
 * 使い方:
 *   node scripts/sync_store_count.js              書き換える
 *   node scripts/sync_store_count.js --dry-run    書き換えずに件数だけ出す
 *   node scripts/sync_store_count.js --check      ずれがあれば exit 1（CI・夜間QA 向け）
 *   node scripts/sync_store_count.js --report     同期の対象外の「N店/N軒」（1,000 以上）を一覧する
 *   node scripts/sync_store_count.js --only <scope>[,<scope>]   scope を絞る
 *
 * build.yml は journal/ を触らない（書き手を1つにするため）。journal の冒頭の紹介文は、新しい記事を作る
 * scripts/add_journal_site_intro.js が同じ値を入れる。丸めた値が変わったときは --only journal を手元で実行する。
 */

const fs = require('fs');
const path = require('path');
const { siteStoreCount, SCOPES, syncStoreCountText, findUnmanagedTokens } = require('./lib/store_count');

const ROOT = path.resolve(__dirname, '..');

function listFiles(scope) {
  if (Array.isArray(scope.files)) {
    return scope.files.filter((f) => fs.existsSync(path.join(ROOT, f)));
  }
  const dir = path.join(ROOT, scope.files.dir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(scope.files.ext) && !f.startsWith('_'))
    .sort()
    .map((f) => `${scope.files.dir}/${f}`);
}

function parseArgs(argv) {
  const opts = { dryRun: false, check: false, report: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--report') opts.report = true;
    else if (a === '--only') opts.only = String(argv[++i] || '').split(',').filter(Boolean);
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`知らない引数: ${a}`);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 31).join('\n'));
    return 0;
  }
  const ids = opts.only || Object.keys(SCOPES);
  for (const id of ids) {
    if (!SCOPES[id]) throw new Error(`知らない scope: ${id}（${Object.keys(SCOPES).join(' / ')}）`);
  }

  const count = siteStoreCount();
  console.log(`掲載店数: 営業中 ${count.exact.toLocaleString('en-US')}店 → 表記は「${count.label}」（${count.rounded.toLocaleString('en-US')} 件単位に丸め）`);

  if (opts.report) {
    let total = 0;
    for (const id of ids) {
      const scope = SCOPES[id];
      for (const rel of listFiles(scope)) {
        const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const found = findUnmanagedTokens(text, scope);
        if (!found.length) continue;
        console.log(`\n== ${rel}`);
        for (const f of found) console.log(`   ${f.dated ? '[日付つき・そのまま]' : '[対象外]'} ${f.token}  … ${f.context}`);
        total += found.length;
      }
    }
    console.log(`\n同期の対象外の表記: ${total} 件（日付つきの数と、ジャンル・エリアごとの件数など。必要なら scripts/lib/store_count.js の scope に足す）`);
    return 0;
  }

  let changedFiles = 0;
  let changedTokens = 0;
  const samples = [];
  for (const id of ids) {
    const scope = SCOPES[id];
    let scopeFiles = 0;
    let scopeTokens = 0;
    for (const rel of listFiles(scope)) {
      const abs = path.join(ROOT, rel);
      const before = fs.readFileSync(abs, 'utf8');
      const { text, changes } = syncStoreCountText(before, scope, count);
      if (text === before) continue;
      scopeFiles++;
      scopeTokens += changes.length;
      if (samples.length < 12) samples.push(`${rel}: ${changes.slice(0, 2).map((c) => `${c.from} → ${c.to}`).join(' ／ ')}`);
      if (!opts.check && !opts.dryRun) fs.writeFileSync(abs, text, 'utf8');
    }
    console.log(`  ${id}: ${scopeFiles} ファイル・${scopeTokens} 箇所`);
    changedFiles += scopeFiles;
    changedTokens += scopeTokens;
  }
  for (const s of samples) console.log(`    例 ${s}`);

  if (opts.check) {
    if (changedFiles) {
      console.error(`店数の表記がずれています: ${changedFiles} ファイル・${changedTokens} 箇所。node scripts/sync_store_count.js で直せます`);
      return 1;
    }
    console.log('店数の表記はそろっています');
    return 0;
  }
  console.log(opts.dryRun
    ? `（dry-run）書き換え対象: ${changedFiles} ファイル・${changedTokens} 箇所`
    : `書き換え: ${changedFiles} ファイル・${changedTokens} 箇所`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (e) {
    console.error(`sync_store_count: ${e.message}`);
    process.exitCode = 2;
  }
}

module.exports = { listFiles, parseArgs };
