#!/usr/bin/env node
'use strict';
/**
 * scripts/build_filter_policy.js — index.html の「絞り込みのエリア・条件の表」（NB_FILTER_POLICY）を、ポリシーから書く（I-20・P-401）
 *
 * 区画（index.html の中の目印。手で編集しない）: NB-FILTER-POLICY:START と NB-FILTER-POLICY:END の印（それぞれ スラッシュ＋アスタリスクで囲んだ
 * 1 行のコメント）の間。印の文字列は scripts/lib/filter_policy.js の REGION が正本。
 *
 * 材料: data/area_genre_pages_policy.json（ハブ＝stores/area/ の判定基準の唯一の情報源）の areas と conditions。
 * 呼び出し: build.js が build_top_picks.js の後で呼ぶ（build.yml と daily-trending5.yml の両方で効く）。冪等。
 *
 * 使い方:
 *   node scripts/build_filter_policy.js            index.html を更新する
 *   node scripts/build_filter_policy.js --dry-run  書かずに結果を出す
 *   node scripts/build_filter_policy.js --check    今の index.html が生成結果と違えば exit 1
 */

const fs = require('fs');
const path = require('path');
const FP = require('./lib/filter_policy');

const ROOT = path.join(__dirname, '..');

function patchRegion(html, body) {
  const [start, end] = FP.REGION;
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a < 0 || b < 0 || b < a) return null;
  return html.slice(0, a + start.length) + '\n' + body + '\n' + html.slice(b);
}

/**
 * @param {{root?:string, write?:boolean, log?:(m:string)=>void, warn?:(m:string)=>void}} [opts]
 * @returns {{changed:boolean, html:string, missing:boolean, policy:object}}
 */
function main(opts = {}) {
  const root = opts.root || ROOT;
  const write = opts.write !== false;
  const log = opts.log || ((m) => console.log(m));
  const warn = opts.warn || ((m) => console.warn(m));

  const htmlPath = path.join(root, 'index.html');
  const before = fs.readFileSync(htmlPath, 'utf8');
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'data', 'area_genre_pages_policy.json'), 'utf8'));
  const policy = FP.buildFilterPolicy(raw);

  const next = patchRegion(before, FP.renderFilterPolicy(policy));
  const missing = next == null;
  if (missing) warn(`⚠️ index.html に ${FP.REGION[0]} がありません（区画を作り直さない）`);
  const html = missing ? before : next;
  const changed = html !== before;
  if (write && changed) fs.writeFileSync(htmlPath, html, 'utf8');
  log(`✅ 絞り込みの表: エリア${policy.areas.length}群・条件${policy.conds.length}軸${changed ? '（更新）' : '（変更なし）'}`);
  return { changed, html, missing, policy };
}

module.exports = { main, patchRegion };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const check = args.includes('--check');
  const r = main({ write: !dry && !check });
  if (check && (r.changed || r.missing)) {
    console.error('index.html の絞り込みの表（NB_FILTER_POLICY）が、ポリシーからの生成結果と違います（node scripts/build_filter_policy.js で更新してください）');
    process.exit(1);
  }
}
