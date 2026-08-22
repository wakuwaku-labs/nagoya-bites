#!/usr/bin/env node
'use strict';
/**
 * scripts/audit_closed_store_mentions.js
 *
 * ISSUE-113 の再発防止監査。data/closed_stores.json に「他都市の実店舗」と確認済みで
 * 登録された店名が、features/*.html や journal/*.html の本文にまだ残っていないかを検出する。
 *
 * 背景: ISSUE-103（2026-08-22）で71件の他都市チェーン店舗をLOCAL_STORESから除外したが、
 * その除外はデータ層（data/closed_stores.json → build.js の除外）にしか反映されておらず、
 * その店をすでに掲載していた特集記事側の店名・写真・リンクは一切修正されていなかった。
 * 結果、LOCAL_STORESからは消えた一方で特集ページ上には「他都市の実店舗」が「名古屋の
 * おすすめ店」として表示され続けていた（2026-08-23、nightly QA の架空店監査で6件発覚）。
 * audit_feature_stores.js は「LOCAL_STORESに無い」としか判定しないため、
 * data/closed_stores.json に「実在検証済みの他都市店」と突き合わせないと見逃す。
 *
 * 判定は検証できる事実だけを使う（CLAUDE.md 制約10）:
 *   - data/closed_stores.json の 店名（他都市の実店舗と一次情報で確認済み）
 *   - features/*.html・journal/*.html 本文中の完全一致テキスト出現
 *
 * 使い方:
 *   node scripts/audit_closed_store_mentions.js          # レポート出力（未対応があれば exit 1）
 *   node scripts/audit_closed_store_mentions.js --check   # CI向け短縮出力
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function listHtmlFiles(dir) {
  const p = path.join(ROOT, dir);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter((f) => f.endsWith('.html')).map((f) => path.join(dir, f));
}

function main() {
  const argv = process.argv.slice(2);
  const checkMode = argv.includes('--check');

  const closed = loadJson('data/closed_stores.json') || { stores: [] };
  // 「他都市」の実在検証済みエントリのみ対象（閉店等の別理由は対象外）
  const targets = (closed.stores || []).filter((s) => /他都市/.test(s['理由'] || '') && s['店名']);

  const files = [...listHtmlFiles('features'), ...listHtmlFiles('journal')];

  const hits = [];
  for (const rel of files) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const t of targets) {
      if (html.includes(t['店名'])) {
        hits.push({ file: rel, name: t['店名'], reason: t['理由'] });
      }
    }
  }

  console.log(`data/closed_stores.json の他都市確認済みエントリ ${targets.length} 件 × features/journal ${files.length} ファイルを突合`);
  console.log(`検出: ${hits.length} 件`);

  if (hits.length > 0) {
    console.log('\n他都市の実在店として除外済みの店名が、まだ本文に残っています:');
    for (const h of hits.slice(0, 30)) {
      console.log(`  - ${h.file}: 「${h.name}」`);
    }
    if (hits.length > 30) console.log(`  ...他 ${hits.length - 30} 件`);
  }

  if (!checkMode) {
    console.log('\n対応方法: 同テーマ・同エリアで実在検証済み（LOCAL_STORES現存）の代替店に差し替える。');
    console.log('カード本文・写真・detail/reserveリンク・JSON-LD ItemListの該当position・');
    console.log('関連するFAQ/比較表/ルート案内文の言及箇所も含めて整合させること（ISSUE-113参照）。');
  }

  if (hits.length > 0) {
    console.error(`\n[FAIL] 他都市の実在店として除外済みの店名が ${hits.length} 件、本文に残っています。`);
    process.exit(1);
  }

  console.log('[OK] 他都市確認済みエントリの本文残存はありません。');
  process.exit(0);
}

main();
