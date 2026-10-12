#!/usr/bin/env node
'use strict';
/**
 * audit_page_weight.js — ページ種別ごとの HTML の重さの上限（I-35 ④・夜間QA の soft）
 *
 * 後から足した仕組み（インラインの JS や CSS・埋め込みの JSON）が、気づかないうちにページを重くしないように、
 * 公開ページの HTML のバイト数（UTF-8）を種別ごとの上限と比べる。上限の正本は data/page_weight_policy.json
 * （閾値の変更はそちらで行いスクリプトは触らない・CLAUDE.md 制約10）。
 *
 * 測るのは HTML だけ。画像・フォント・JS の転送量は静的には測れない（ブラウザの計測は
 * docs/qa/uiux-2026-10/perf.js）。そちらの上限は I-12（フォント）・I-25（トップの索引）の後に決める。
 *
 * 上限は「いまの正直な最大に余裕を足した位置」に置く（CLAUDE.md 品質ゲート原則3・5）。
 * 実測の分布は `--measure` で出せる（policy の measured はその結果。置き直すときもこの出力から決める）。
 *
 * 使い方:
 *   node scripts/audit_page_weight.js              # 種別ごとの表を出す（exit 0）
 *   node scripts/audit_page_weight.js --check      # 上限を超えるページがあれば exit 1
 *   node scripts/audit_page_weight.js --measure    # 実測の分布を JSON で出す（policy の measured を置き直すとき）
 *   node scripts/audit_page_weight.js --json       # 結果を JSON で出す
 *   --root <dir>  別のリポジトリ（テスト用の小さな fixture）を見る
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_ROOT, listPublishedPages } = require('./lib/published_pages');

const MAX_LISTED = 20;

function quantile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function loadPolicy(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data', 'page_weight_policy.json'), 'utf8'));
}

/** @returns {Record<string,{n:number,p50:number,p90:number,p99:number,max:number,maxPage:string}>} */
function measure(pages) {
  const byType = {};
  for (const p of pages) (byType[p.type] = byType[p.type] || []).push([fs.statSync(p.abs).size, p.rel]);
  const out = {};
  for (const [type, list] of Object.entries(byType)) {
    list.sort((a, b) => a[0] - b[0]);
    const sizes = list.map((x) => x[0]);
    out[type] = {
      n: sizes.length, p50: quantile(sizes, 0.5), p90: quantile(sizes, 0.9), p99: quantile(sizes, 0.99),
      max: sizes[sizes.length - 1], maxPage: list[list.length - 1][1],
    };
  }
  return out;
}

function audit({ root = DEFAULT_ROOT, policy = null } = {}) {
  policy = policy || loadPolicy(root);
  const pages = listPublishedPages({ root });
  const dist = measure(pages);
  const violations = [];
  const unknownTypes = [];
  for (const p of pages) {
    const rule = policy.types[p.type];
    if (!rule) { if (!unknownTypes.includes(p.type)) unknownTypes.push(p.type); continue; }
    const bytes = fs.statSync(p.abs).size;
    if (bytes > rule.maxBytes) violations.push({ file: p.rel, type: p.type, bytes, maxBytes: rule.maxBytes });
  }
  violations.sort((a, b) => (b.bytes - b.maxBytes) - (a.bytes - a.maxBytes));
  const types = Object.keys(policy.types).map((t) => ({
    type: t, cap: policy.types[t].maxBytes, n: dist[t] ? dist[t].n : 0, max: dist[t] ? dist[t].max : 0,
    maxPage: dist[t] ? dist[t].maxPage : '', over: violations.filter((v) => v.type === t).length,
  }));
  return {
    ok: violations.length === 0 && unknownTypes.length === 0,
    files_scanned: pages.length, violations_total: violations.length,
    unknown_types: unknownTypes, types,
    violations: violations.slice(0, MAX_LISTED), violations_truncated: Math.max(0, violations.length - MAX_LISTED),
  };
}

const kb = (n) => (n / 1024).toFixed(1) + 'KB';

function main() {
  const argv = process.argv.slice(2);
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx >= 0 ? path.resolve(argv[rootIdx + 1]) : DEFAULT_ROOT;
  if (argv.includes('--measure')) {
    console.log(JSON.stringify(measure(listPublishedPages({ root })), null, 2));
    return;
  }
  const result = audit({ root });
  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`ページ種別ごとの HTML の重さ（上限は data/page_weight_policy.json）: 公開ページ ${result.files_scanned} 本`);
    for (const t of result.types) {
      console.log(`  ${t.over ? '❌' : '✅'} ${t.type.padEnd(14)} ${String(t.n).padStart(5)} 本  最大 ${kb(t.max).padStart(10)}  上限 ${kb(t.cap).padStart(10)}${t.over ? `  超過 ${t.over} 本` : ''}  ${t.maxPage}`);
    }
    for (const v of result.violations) console.log(`  超過: ${v.file} ${kb(v.bytes)}（${v.type} の上限 ${kb(v.maxBytes)}）`);
    if (result.violations_truncated) console.log(`  …ほか ${result.violations_truncated} 本`);
    if (result.unknown_types.length) console.log(`  ❌ 上限の無い種別: ${result.unknown_types.join(', ')}（data/page_weight_policy.json に足す）`);
    console.log(`  ${result.ok ? '✅' : '❌'} 上限を超えるページ: ${result.violations_total} 本`);
  }
  if (argv.includes('--check') && !result.ok) process.exit(1);
}

if (require.main === module) main();

module.exports = { audit, measure, loadPolicy };
