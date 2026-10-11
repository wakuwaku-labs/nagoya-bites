#!/usr/bin/env node
'use strict';
/**
 * scripts/audit_phone_links.js — 電話のボタンを出す店の判定が、今のデータと合っているかの確認（I-36 / P-273）
 *
 * data/stores.json の「電話確認」の欄を、data/places_resolved.json と各店の住所・店名から作り直した判定
 * （scripts/lib/phone_link.js・build.js と同じ関数）と突き合わせる。外部へは問い合わせない（制約10: 第三者が
 * 同じ2つのファイルから検算できる事実だけで決める）。
 *
 *   欄はあるのに判定は「出さない」 … 古い欄が残っている（別の店の番号にかかるボタンが出うる＝重い）
 *   判定は「出す」のに欄が無い     … 反映されていない（ボタンが出ないだけ＝軽い。次の build.js が直す）
 *   欄の根拠（住所／店名）が判定と違う
 *
 * 使い方:
 *   node scripts/audit_phone_links.js            内訳を出す
 *   node scripts/audit_phone_links.js --check    ずれがあれば exit 1（夜間QA・soft）
 *   node scripts/audit_phone_links.js --json     機械向け
 */

const fs = require('fs');
const path = require('path');
const { FIELD, REASONS, buildPlaceIndex, phoneLinkVerdict } = require('./lib/phone_link');

const ROOT = path.resolve(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function audit(stores, places) {
  const index = buildPlaceIndex(places);
  const counts = Object.fromEntries(REASONS.map((r) => [r, 0]));
  const stale = [];     // 欄があるのに判定は出さない
  const missing = [];   // 判定は出すのに欄が無い
  const basisDiff = []; // 根拠が違う
  for (const s of stores) {
    const v = phoneLinkVerdict(s, index, places);
    counts[v.reason] += 1;
    const has = s[FIELD];
    if (has && !v.ok) stale.push({ name: s['店名'], id: s['ホットペッパーID'] || '', field: has, reason: v.reason });
    else if (!has && v.ok) missing.push({ name: s['店名'], id: s['ホットペッパーID'] || '', basis: v.basis });
    else if (has && v.ok && has !== v.basis) basisDiff.push({ name: s['店名'], id: s['ホットペッパーID'] || '', field: has, basis: v.basis });
  }
  const shown = stores.filter((s) => s[FIELD]).length;
  return { total: stores.length, shown, counts, stale, missing, basisDiff };
}

function main(argv) {
  const check = argv.includes('--check');
  const json = argv.includes('--json');
  const stores = readJson('data/stores.json');
  const places = readJson('data/places_resolved.json');
  const r = audit(Array.isArray(stores) ? stores : stores.stores, places);
  const bad = r.stale.length + r.missing.length + r.basisDiff.length;
  if (json) {
    console.log(JSON.stringify(r, null, 1));
  } else {
    const c = r.counts;
    console.log(`店 ${r.total} 件のうち、電話のボタンを出す店（電話確認あり）: ${r.shown}`);
    console.log(`判定の内訳: 住所が同じ ${c['address-same']} ／ 住所は比べられず店名が合う ${c['address-unknown-name-ok']}`
      + ` ／ 住所が別の場所 ${c['address-different']} ／ 住所で比べられず店名も合わない ${c['address-unknown-name-ng']}`
      + ` ／ 紐付け却下 ${c.rejected} ／ 記録なし ${c['no-record']} ／ placeId なし ${c['no-place-id']}`);
    console.log(`欄と判定のずれ: 古い欄 ${r.stale.length}（別の店の番号にかかりうる） ／ 未反映 ${r.missing.length} ／ 根拠の違い ${r.basisDiff.length}`);
    for (const x of r.stale.slice(0, 10)) console.log(`  古い欄: ${x.name}（${x.id}）電話確認=${x.field} → 判定 ${x.reason}`);
    for (const x of r.missing.slice(0, 5)) console.log(`  未反映: ${x.name}（${x.id}）判定の根拠=${x.basis}`);
    for (const x of r.basisDiff.slice(0, 5)) console.log(`  根拠の違い: ${x.name}（${x.id}）欄=${x.field} 判定=${x.basis}`);
    if (r.shown === 0 && r.counts['address-same'] + r.counts['address-unknown-name-ok'] > 0) {
      console.log('※ 欄が1件も無い: build.js の次の実行で入ります（この確認は build.js が書いた data/stores.json を見ます）');
    }
  }
  return check && bad ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`audit_phone_links: ${e.message}`);
    process.exitCode = 2;
  }
}

module.exports = { audit };
