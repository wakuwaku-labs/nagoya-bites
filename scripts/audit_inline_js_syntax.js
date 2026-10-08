#!/usr/bin/env node
/**
 * audit_inline_js_syntax.js
 *
 * 公開ページのインライン <script> が構文として通るかを検査する決定的ゲート（SEO-115）。
 * 判定器は scripts/lib/inline_js.js の1本（qa_gate.js・テストと共有）。
 *
 * 2026-10-09、店舗ページ約5,000本の GA4 スクリプトが生成器のエスケープ誤りで構文エラーになり、
 * 2026-05-08 から閲覧・CTA が一度も GA4 に届いていなかったと判明した。生成物の JS を
 * 見る検査がどこにも無かったため、5か月間だれも気づけなかった（CLAUDE.md 制約11）。
 *
 * 検査項目（lib の rule 名）:
 *   js-syntax         インライン JS が vm.Script でコンパイルできない
 *   json-syntax       JSON-LD 等の JSON ブロックが JSON.parse できない
 *   ga-config-broken  gtag.js を読み込むページで gtag('config',…) を含む構文OKのJSが無い
 *
 * 使い方:
 *   node scripts/audit_inline_js_syntax.js                # 全ページを検査して JSON を出す（exit 0）
 *   node scripts/audit_inline_js_syntax.js --check        # 違反があれば exit 1（CI向け）
 *   node scripts/audit_inline_js_syntax.js --sample 300   # stores/ 直下を等間隔に N 件だけ見る
 *   node scripts/audit_inline_js_syntax.js --only stores  # root|features|journal|stores|area のいずれか
 *
 * 出力: { ok, files_scanned, blocks_checked, unique_blocks, violations_total, by_rule, by_section,
 *         violations（先頭50件）, violations_truncated }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { auditHtml } = require('./lib/inline_js');

const ROOT = path.join(__dirname, '..');
const ROOT_PAGES = ['index.html', 'about.html', 'faq.html', 'contact.html', 'privacy-policy.html'];
const SECTIONS = ['root', 'features', 'journal', 'stores', 'area'];
const MAX_LISTED = 50;

function parseArgs(argv) {
  const opts = { check: argv.includes('--check'), sample: null, only: null };
  const s = argv.indexOf('--sample');
  if (s >= 0) {
    const n = parseInt(argv[s + 1], 10);
    if (!Number.isInteger(n) || n <= 0) throw new Error('--sample には正の整数を指定してください');
    opts.sample = n;
  }
  const o = argv.indexOf('--only');
  if (o >= 0) {
    const v = argv[o + 1];
    if (!SECTIONS.includes(v)) throw new Error(`--only は ${SECTIONS.join('|')} のいずれか`);
    opts.only = v;
  }
  return opts;
}

function listHtml(dir, opts) {
  opts = opts || {};
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .filter(f => !opts.excludeTemplate || !f.startsWith('_'))
    .sort()
    .map(f => path.join(dir, f));
}

function listHtmlRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) out = out.concat(listHtmlRecursive(p));
    else if (f.endsWith('.html')) out.push(p);
  }
  return out;
}

/** 等間隔サンプリング（決定的。乱数を使わない） */
function sampleEvenly(files, n) {
  if (!n || files.length <= n) return files;
  const step = files.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(files[Math.floor(i * step)]);
  return out;
}

function collectTargets(opts, root) {
  root = root || ROOT;
  const targets = {
    root: ROOT_PAGES.map(f => path.join(root, f)).filter(f => fs.existsSync(f)),
    features: listHtml(path.join(root, 'features')),
    journal: listHtml(path.join(root, 'journal'), { excludeTemplate: true }),
    stores: sampleEvenly(listHtml(path.join(root, 'stores')), opts.sample),
    area: listHtmlRecursive(path.join(root, 'stores', 'area')),
  };
  if (opts.only) for (const k of SECTIONS) if (k !== opts.only) targets[k] = [];
  return targets;
}

function run(opts, root) {
  root = root || ROOT;
  const cache = new Map();
  const targets = collectTargets(opts, root);
  const all = [];
  const bySection = {};
  const byRule = {};
  let files = 0;
  let blocks = 0;
  for (const section of SECTIONS) {
    let sectionViolations = 0;
    for (const f of targets[section]) {
      const rel = path.relative(root, f);
      const r = auditHtml(fs.readFileSync(f, 'utf8'), { filename: rel, cache });
      files++;
      blocks += r.checked;
      for (const v of r.violations) {
        all.push(v);
        byRule[v.rule] = (byRule[v.rule] || 0) + 1;
        sectionViolations++;
      }
    }
    bySection[section] = { files: targets[section].length, violations: sectionViolations };
  }
  return {
    ok: all.length === 0,
    files_scanned: files,
    blocks_checked: blocks,
    unique_blocks: cache.size,
    violations_total: all.length,
    by_rule: byRule,
    by_section: bySection,
    violations: all.slice(0, MAX_LISTED),
    violations_truncated: Math.max(0, all.length - MAX_LISTED),
  };
}

function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const result = run(opts);
  console.log(JSON.stringify(result, null, 2));
  if (opts.check && !result.ok) process.exit(1);
}

if (require.main === module) main();

module.exports = { run, collectTargets, sampleEvenly, parseArgs };
