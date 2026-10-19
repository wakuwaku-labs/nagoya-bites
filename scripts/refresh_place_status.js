#!/usr/bin/env node
'use strict';
/**
 * 掲載店の Google の営業状態（business_status）を Basic の項目だけで取り直す（ISSUE-173・P-177）。
 *   node scripts/refresh_place_status.js            # 今日の分を取り data/place_status.json に追記
 *   node scripts/refresh_place_status.js --dry-run  # 対象だけ表示（通信しない）
 *   node scripts/refresh_place_status.js --limit 5  # 件数を絞る（動作確認用）
 *   node scripts/refresh_place_status.js --report [--check]  # 閉業・一時休業を数える（通信しない・--check は閉業があれば exit 1）
 * 鍵 GOOGLE_PLACES_API_KEY が無ければ何もせず exit 0。1日の件数・月の上限は data/place_status_policy.json。
 * 店は自動では外さない（外すのは ISSUE-170 と同じ確認の後）。
 */
const fs = require('fs');
const https = require('https');
const path = require('path');
const lib = require('./lib/place_status');
const { loadStores } = require('./lib/load_stores');
const { placesKey } = require('./lib/places_key');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ROOT = path.resolve(__dirname, '..');
const stores = loadStores();
const status = lib.loadStatus();
status.usage = status.usage || {};
status.entries = status.entries || {};

if (flag('--report')) {
  const c = lib.closures(status, stores);
  console.log(`取り直した店: ${Object.keys(status.entries).length} / 閉業 ${c.permanent.length} / 一時休業 ${c.temporary.length} / 根拠にできない閉業の記録 ${c.unusable}`);
  for (const x of c.permanent) console.log(`  閉業: ${x.店名}（${x.エリア}）${x.checkedAt.slice(0, 10)}`);
  for (const x of c.temporary) console.log(`  一時休業: ${x.店名}（${x.エリア}）${x.checkedAt.slice(0, 10)}`);
  if (c.permanent.length) console.log('  → 自動では外さない。一次情報で確かめて data/store_liveness_reviews.json に記録する（ISSUE-170）');
  process.exit(flag('--check') && c.permanent.length ? 1 : 0);
}

const policy = lib.loadPolicy();
const now = new Date();
const places = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'places_resolved.json'), 'utf8'));
let targets = lib.pickTargets(stores, places, status, policy, now);
if (opt('--limit')) targets = targets.slice(0, Math.max(0, parseInt(opt('--limit'), 10) || 0));
const month = lib.monthOf(now);
console.log(`対象 ${targets.length} 件（今月の使用 ${status.usage[month] || 0} / 上限 ${policy.monthlyCap}）`);
if (flag('--dry-run')) { targets.slice(0, 10).forEach((s) => console.log('  ' + s['店名'])); process.exit(0); }

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
if (!API_KEY) { console.log('GOOGLE_PLACES_API_KEY 未設定 — 何もせず終了します'); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = ''; res.setEncoding('utf8');
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('JSON parse error')); } });
    }).on('error', reject);
  });
}

(async () => {
  let ok = 0, notFound = 0, fail = 0, closedNow = 0;
  for (const s of targets) {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(s.placeId)}&fields=${policy.fields.join(',')}&language=ja&key=${API_KEY}`;
    let res;
    try { res = await fetchJson(url); } catch (e) { fail++; continue; }
    if (res.status === 'OVER_QUERY_LIMIT' || res.status === 'REQUEST_DENIED') {
      console.error(`Places Details ${res.status}: ${res.error_message || ''} — ここで打ち切ります`);
      break;
    }
    status.usage[month] = (status.usage[month] || 0) + 1; // 課金対象になりうる呼び出しは結果にかかわらず数える
    if (res.status === 'NOT_FOUND') { // 順番が進むよう記録は残す（根拠にはしない）
      status.entries[placesKey(s)] = { placeId: s.placeId, checkedAt: now.toISOString(), status: 'NOT_FOUND', googleName: '', nameOk: false, addrVerdict: 'unknown', usable: false };
      notFound++; continue;
    }
    if (res.status !== 'OK') { fail++; continue; }
    const rec = lib.judge(s, res.result || {}, now);
    status.entries[placesKey(s)] = rec;
    ok++;
    if (rec.usable && rec.status === 'CLOSED_PERMANENTLY') closedNow++;
    await sleep(policy.delayMs);
  }
  status.generatedAt = now.toISOString();
  fs.writeFileSync(path.join(ROOT, 'data', 'place_status.json'), JSON.stringify(status, null, 1) + '\n');
  console.log(`取得 ${ok} / 見つからない ${notFound} / 失敗 ${fail} / 今回わかった閉業 ${closedNow}`);
})();
