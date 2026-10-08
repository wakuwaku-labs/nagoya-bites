#!/usr/bin/env node
'use strict';
/**
 * scripts/audit_station_names.js
 *
 * アクセス文の駅名監査（SEO-120・SEO-119 の再発防止）。店のアクセス文に愛知県外の駅名が
 * 出ていないかを見る。2026-10-09、エリア「栄」の店23件が、北海道釧路市栄町・宮城県仙台市の
 * 中野栄・東京の「〇栄ビル」などの他都市の店だったと判明した（ISSUE-103 の取り残し）。
 * 既存の audit_other_prefecture_matches.js は Google Places の住所却下ログしか見ず、Places が
 * 名古屋の別店に誤って紐付いた店や Places で見つからなかった店を検出できなかった。
 *
 * 判定（scripts/lib/station_names.js）:
 *   アクセス文の「〜駅」の直前の語の末尾が、愛知県外にしか無い駅名に当たったら「県外の疑い」。
 *   駅名は data/station_names.json（出典つき）。ホテル名など駅を伴わない語は見ない。
 *   どの駅名にも当たらない語（バス停・誤記・「最寄駅」）は件数だけ報告し、合否に使わない。
 * 除外: data/closed_stores.json に載った店（対応済み）と data/station_audit_exceptions.json
 *       （一次情報で名古屋の店と確かめたもの）。data/access_corrections.json の訂正は build.js と
 *       同じく先に当てる。
 *
 * 見つかったら: ホットペッパーの店舗ページで所在地を確かめ、他都市なら closed_stores.json、
 * 名古屋の店なら station_audit_exceptions.json に理由つきで載せる（推測で決めない）。
 *
 *   node scripts/audit_station_names.js          # 一覧を表示
 *   node scripts/audit_station_names.js --check  # 県外の疑いが1件でもあれば exit 1
 *   node scripts/audit_station_names.js --json   # 結果を JSON で表示
 */

const fs = require('fs');
const path = require('path');
const { auditAccess, loadSets } = require('./lib/station_names');
const { applyAccessCorrections } = require('./lib/access_corrections');

const ROOT = path.resolve(__dirname, '..');

function readJson(rel, fallback) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function idsOf(list) {
  return new Set((list || []).map((x) => x && x['ホットペッパーID']).filter(Boolean));
}

function run({ stores, closed = [], exceptions = [], sets = loadSets() } = {}) {
  const closedIds = idsOf(closed);
  const exceptionIds = idsOf(exceptions);
  const outside = [];
  const unknown = new Map();
  let checked = 0;
  let skipped = 0;
  for (const s of stores) {
    const id = s['ホットペッパーID'] || '';
    if (closedIds.has(id) || exceptionIds.has(id)) { skipped++; continue; }
    checked++;
    const r = auditAccess(s['アクセス'], sets);
    if (r.outside.length) {
      outside.push({
        hotpepperId: id || null,
        name: s['店名'],
        area: s['エリア'] || '',
        stations: [...new Set(r.outside.map((t) => t.station))],
        access: String(s['アクセス'] || ''),
      });
    }
    for (const t of r.unknown) unknown.set(t.token, (unknown.get(t.token) || 0) + 1);
  }
  const unknownTop = [...unknown.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([token, count]) => ({ token, count }));
  return { ok: outside.length === 0, checked, skipped, outside, unknownTokens: unknown.size, unknownTop };
}

function main() {
  const argv = process.argv.slice(2);
  const stores = readJson('data/stores.json', null);
  if (!Array.isArray(stores) || stores.length === 0) {
    console.error('data/stores.json を読めない（空・欠落）。監査できない');
    process.exit(2);
  }
  // build.js と同じ訂正を先に当てる（data/stores.json がビルド前の古い文でも同じ結果になるように）
  applyAccessCorrections(stores);
  const result = run({
    stores,
    closed: readJson('data/closed_stores.json', { stores: [] }).stores,
    exceptions: readJson('data/station_audit_exceptions.json', { exceptions: [] }).exceptions,
  });
  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const sets = loadSets();
    console.log(`駅名監査: 対象 ${result.checked} 店（対応済み・例外 ${result.skipped} 店を除く）／県外の駅名 ${result.outside.length} 店`);
    console.log(`  駅名リスト: ${sets.fetchedAt} 取得（愛知 ${sets.aichi.size} 語 / 県外のみ ${sets.outside.size} 語）`);
    for (const o of result.outside) {
      console.log(`  ✗ ${o.name}（${o.area}・${o.hotpepperId || 'IDなし'}）: ${o.stations.join(' / ')} ← ${o.access.slice(0, 60)}`);
    }
    if (result.outside.length) {
      console.log('  → ホットペッパーの店舗ページで所在地を確かめ、他都市なら data/closed_stores.json、名古屋の店なら data/station_audit_exceptions.json に理由つきで載せる');
    }
    console.log(`  （参考）どの駅名にも当たらない語: ${result.unknownTokens} 種類。合否には使わない`);
  }
  if (argv.includes('--check') && !result.ok) process.exit(1);
}

if (require.main === module) main();

module.exports = { run };
