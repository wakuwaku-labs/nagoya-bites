#!/usr/bin/env node
'use strict';
/**
 * audit_heading_levels.js — 公開ページの見出しの階層が飛んでいないか（I-26f・U-78・夜間QA の soft）
 *
 * h1 の次に h3、h2 の次に h4 のように、見出しの段が飛ぶページを数える。画面の読み上げは見出しの一覧を
 * 階層で辿るので、飛んでいると「この見出しの親が無い」状態になる。判定は HTML の文字列だけで行い
 * （scripts/lib/heading_levels.js の1本・実行も描画もしない）、第三者が同じファイルで検算できる事実だけを見る（制約10）。
 *
 * 直し方の型（I-26f）:
 *   - 店の一覧だけがあって本文に h2 が無い日次ジャーナル … 店の一覧の先頭に見えない h2（class="visually-hidden"）を置く
 *     （生成器 scripts/generate_daily_draft.js の buildStores が書く。見た目は変わらない）
 *   - 小見出しが h4 になっていた特集 … h3 にする（CSS の選択子も合わせる）
 *
 * 使い方:
 *   node scripts/audit_heading_levels.js               # 一覧を出す（exit 0）
 *   node scripts/audit_heading_levels.js --check       # 飛ぶページが1本でもあれば exit 1
 *   node scripts/audit_heading_levels.js --json        # 結果を JSON で出す
 *   node scripts/audit_heading_levels.js --only journal   # root / features / journal / stores / area のどれかに絞る
 *   --root <dir>  別のリポジトリ（テスト用の小さな fixture）を見る
 */

const fs = require('fs');
const { findJumps } = require('./lib/heading_levels');
const { DEFAULT_ROOT, SECTIONS, listPublishedPages } = require('./lib/published_pages');

const MAX_LISTED = 40;

function audit({ root = DEFAULT_ROOT, only = null } = {}) {
  const pages = listPublishedPages({ root, only });
  const bad = [];
  const bySection = {};
  for (const p of pages) {
    const jumps = findJumps(fs.readFileSync(p.abs, 'utf8'));
    if (!jumps.length) continue;
    bad.push({ file: p.rel, section: p.section, jumps });
    bySection[p.section] = (bySection[p.section] || 0) + 1;
  }
  return {
    ok: bad.length === 0,
    files_scanned: pages.length,
    pages_with_jumps: bad.length,
    by_section: bySection,
    pages: bad.slice(0, MAX_LISTED),
    pages_truncated: Math.max(0, bad.length - MAX_LISTED),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx >= 0 ? require('path').resolve(argv[rootIdx + 1]) : DEFAULT_ROOT;
  const onlyIdx = argv.indexOf('--only');
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
  if (only && !SECTIONS.includes(only)) {
    console.error(`--only は ${SECTIONS.join(' / ')} のどれか: ${only}`);
    process.exit(2);
  }
  const result = audit({ root, only });
  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`見出しの階層が飛ぶページ: ${result.pages_with_jumps} 本 / 公開ページ ${result.files_scanned} 本`);
    for (const p of result.pages) {
      console.log(`  ❌ ${p.file}  ${p.jumps.slice(0, 2).map((j) => `h${j.from || '-'}→h${j.to}「${j.text.slice(0, 24)}」`).join(' ; ')}`);
    }
    if (result.pages_truncated) console.log(`  …ほか ${result.pages_truncated} 本`);
    console.log(`  ${result.ok ? '✅' : '❌'} 飛ぶページ: ${result.pages_with_jumps} 本`);
  }
  if (argv.includes('--check') && !result.ok) process.exit(1);
}

if (require.main === module) main();

module.exports = { audit };
