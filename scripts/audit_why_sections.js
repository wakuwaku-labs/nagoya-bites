#!/usr/bin/env node
'use strict';
/**
 * 特集とエリアページに「なぜこのエリア・この切り口なのか」の節があるかの検査
 * （本人 2026-11-23「なぜ今池というエリアにこだわって選んだか？がないので説得力がない、読みたいと思えない」）。
 *   node scripts/audit_why_sections.js           # 一覧を出す（常に exit 0）
 *   node scripts/audit_why_sections.js --check   # 新しい頁で節が無い・不十分なら exit 1
 *   node scripts/audit_why_sections.js --init    # 今ある「節が無い頁」を猶予リスト（data/why_section_baseline.json）に書く
 * 段階: 猶予リストにある既存の頁は警告（節を足したら自動で外れる）。猶予リストに無い頁（今後作る特集・エリア）は FAIL。
 * 対象: stores/area/各エリア/index.html・stores/area/index.html、題に「◯選・◯店・◯軒・ガイド」がある特集。
 * 節の条件・書き方の決まりは scripts/lib/why_section.js。
 */
const fs = require('fs');
const path = require('path');
const { checkWhy, appliesTo } = require('./lib/why_section');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(ROOT, 'data', 'why_section_baseline.json');

function targets() {
  const out = [];
  const feats = fs.readdirSync(path.join(ROOT, 'features')).filter((f) => f.endsWith('.html')).map((f) => `features/${f}`);
  const hubs = ['stores/area/index.html'];
  const ad = path.join(ROOT, 'stores', 'area');
  for (const d of fs.readdirSync(ad)) if (fs.existsSync(path.join(ad, d, 'index.html'))) hubs.push(`stores/area/${d}/index.html`);
  for (const rel of [...hubs, ...feats]) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const kind = appliesTo(rel, html);
    if (kind) out.push({ rel, kind, res: checkWhy(html) });
  }
  return out;
}

function main() {
  const all = targets();
  const bad = all.filter((t) => !t.res.ok);
  if (process.argv.includes('--init')) {
    fs.writeFileSync(BASELINE, JSON.stringify({ _README: '「なぜ…」の節が無いまま公開されている既存頁の猶予リスト。ここにある頁は警告、無い頁は FAIL。節を足したら scripts/apply_why_sections.js が外す。', pages: bad.map((t) => t.rel) }, null, 1) + '\n');
    console.log(`猶予リストに ${bad.length} 件を書いた`);
    return;
  }
  const base = new Set((fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')).pages : []));
  const fails = bad.filter((t) => !base.has(t.rel));
  const warns = bad.filter((t) => base.has(t.rel));
  for (const t of fails) console.log(`FAIL ${t.rel}: ${t.res.msg}`);
  for (const t of warns) console.log(`warn ${t.rel}: ${t.res.msg}（既存。猶予リスト）`);
  const hub = all.filter((t) => t.kind === 'hub');
  const feat = all.filter((t) => t.kind === 'feature');
  const n = (a) => a.filter((t) => !t.res.ok).length;
  console.log(`対象 ${all.length}件（エリア ${hub.length}・特集 ${feat.length}）。節なし: エリア ${n(hub)}/${hub.length}・特集 ${n(feat)}/${feat.length}。FAIL ${fails.length}・warn ${warns.length}`);
  if (process.argv.includes('--check') && fails.length) process.exit(1);
}
if (require.main === module) main();
module.exports = { targets };
