#!/usr/bin/env node
'use strict';
/**
 * 特集の「読者を誤解させうる表示」の再発検査（基本方針 段階1 S1-1/S1-4・ADR 0069）。
 *   node scripts/audit_feature_facts.js          # 件数を出す（常に exit 0）
 *   node scripts/audit_feature_facts.js --check  # 1件でもあれば exit 1
 * 見るもの（features/*.html。検証できる事実だけで判定・制約10）:
 *   掲載歴      「掲載歴:」の行・media-features の部品（実在を確かめられない媒体名・賞名が混ざっていた）
 *   訪問済      「編集部訪問済」のバッジ（訪問の日付の記録を出せる店だけに付ける）
 *   食べログ点  「食べログ4.x」の点数（Google の評価の取り違えだった）。「4.5超え」は出典つきの引用として除く
 *   内部の項目名 editor_picks・editorReason・insiderNote・mediaFeatures・visitStatus
 *   星の食い違い 本文の★と data/stores.json の Google評価（scripts/lib/feature_stars.js）
 *   休業の注記  閉業・一時休業・掲載データに無い店のカードに注記が出ているか（scripts/sync_feature_closure_notes.js --check）
 */
const fs = require('fs');
const path = require('path');
const { loadStores: loadByName, scanFeatureStars } = require('./lib/feature_stars');
const { loadStores } = require('./lib/load_stores');
const { buildNoticeIndex } = require('./lib/operating_notice');
const { syncNotes } = require('./sync_feature_closure_notes');

const ROOT = path.resolve(__dirname, '..');
const FEATURES = path.join(ROOT, 'features');

const RULES = [
  ['掲載歴', /掲載歴:|class="media-features"/g],
  ['訪問済', /編集部訪問済/g],
  ['食べログ点', /食べログ4\.\d(?!\d|超え)/g],
  ['内部の項目名', /editor_picks|editorReason|insiderNote|mediaFeatures|visitStatus/g],
];

function auditHtml(html, ctx) {
  const found = [];
  for (const [kind, re] of RULES) {
    for (const m of html.matchAll(re)) found.push({ kind, line: html.slice(0, m.index).split('\n').length, text: m[0] });
  }
  for (const r of scanFeatureStars(html, ctx.byName)) {
    if (r.verdict === 'ok') continue;
    found.push({ kind: '星の食い違い', line: r.line, text: `${r.store} 表示★${r.shown} / データ ${r.actual === null ? 'なし' : r.actual}` });
  }
  const notes = syncNotes(html, ctx.notices, ctx.knownIds);
  if (notes.html !== html) found.push({ kind: '休業の注記', line: 0, text: '閉業・休業・掲載データに無い店の注記が出ていない（node scripts/sync_feature_closure_notes.js）' });
  return found;
}

function makeContext() {
  const stores = loadStores();
  const idx = buildNoticeIndex(stores);
  return {
    byName: loadByName(ROOT),
    notices: new Map([...idx.entries()].filter(([k]) => /^J\d+$/.test(k))),
    knownIds: new Set(stores.map((s) => s['ホットペッパーID']).filter(Boolean)),
  };
}

function main() {
  const check = process.argv.includes('--check');
  const ctx = makeContext();
  let total = 0;
  for (const f of fs.readdirSync(FEATURES).filter((x) => x.endsWith('.html')).sort()) {
    const found = auditHtml(fs.readFileSync(path.join(FEATURES, f), 'utf8'), ctx);
    for (const x of found) { total++; console.log(`${f}:${x.line} [${x.kind}] ${x.text}`); }
  }
  console.log(`特集の誤解を招く表示: ${total}件`);
  if (check && total) process.exit(1);
}

if (require.main === module) main();
module.exports = { auditHtml, makeContext, RULES };
