#!/usr/bin/env node
/**
 * data/stores.json の写真URLが実際に配信されているかを検査する（CDN側の配信終了検知）。
 *
 * 【なぜ必要か】
 * DSN-006 の作業中、data/stores.json にキャッシュされた HotPepper 写真URL
 * （imgfp.hotp.jp）の一部が CDN側で404になっていることが判明した。サンプル21件中4件
 * （約19%）が404で、同じキャッシュURLは stores/*.html（店舗個別ページ）や index.html の
 * カードからも参照されるため、壊れた画像として既にサイト上に露出している可能性が高い。
 *
 * 既存の scripts/audit_photo_policy.js は「写真の出所・帰属が基準どおりか」を見るもので、
 * 「そのURLが今も実際に配信されているか」は検査していない（データが基準どおりでも、
 * CDN側で後から消えることは検知できない）。このスクリプトはその穴を埋める。
 *
 * 判定器は scripts/lib/photo_url_liveness.js の1本（実際のHTTPステータスだけで判定・
 * CLAUDE.md 制約10）。404/410 を間隔を置いて2回連続で観測できて初めて dead と確定する
 * （単発の応答・一時障害で誤検知しない＝ISSUE-084 原則6のオオカミ少年化防止）。
 *
 * 使い方:
 *   node scripts/audit_photo_url_liveness.js                # 全件検査してレポート出力
 *   node scripts/audit_photo_url_liveness.js --limit 200     # 先頭200件のみ（動作確認用）
 *   node scripts/audit_photo_url_liveness.js --store "ホタル" # 店名部分一致で絞り込み
 *   node scripts/audit_photo_url_liveness.js --host hotpepper # hotpepper/places/other で絞り込み
 *   node scripts/audit_photo_url_liveness.js --check          # dead が1件でもあれば exit 1（CI向け）
 *   node scripts/audit_photo_url_liveness.js --concurrency 24 --timeout 8000
 *
 * 出力: data/photo_url_liveness_report.json
 *   （店ごとの dead 一覧 + firstDetected/lastChecked + サマリ。第三者が同じURLを開けば
 *    同じ結果を再現できる。firstDetected は前回レポートから引き継ぐ＝いつから死んでいるか
 *    が後から検算できる）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { judgeLiveness, mapWithConcurrency, classifyHost } = require('./lib/photo_url_liveness');

const ROOT = path.resolve(__dirname, '..');
const STORES_PATH = path.join(ROOT, 'data', 'stores.json');
const REPORT_PATH = path.join(ROOT, 'data', 'photo_url_liveness_report.json');

const argv = process.argv.slice(2);
function optInt(flag, dflt) {
  const i = argv.indexOf(flag);
  return i >= 0 ? parseInt(argv[i + 1], 10) : dflt;
}
function optStr(flag, dflt) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : dflt;
}
const opts = {
  limit: optInt('--limit', Infinity),
  concurrency: optInt('--concurrency', 16),
  timeoutMs: optInt('--timeout', 8000),
  store: optStr('--store', null),
  host: optStr('--host', null), // hotpepper | places | other
  check: argv.includes('--check'),
  list: argv.includes('--list'),
  json: argv.includes('--json'),
};

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

/** URLからHotPepperの写真アセットID（P0xxxxxxx）を取り出す。人が後から現物を検索する手掛かり。 */
function hotpepperPhotoId(url) {
  const m = String(url || '').match(/\/(P\d{6,})\//);
  return m ? m[1] : '';
}

const jstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

async function main() {
  const stores = loadJson(STORES_PATH, []);
  if (!Array.isArray(stores) || !stores.length) {
    console.error('data/stores.json が読み込めません。');
    process.exit(2);
  }

  let targets = stores
    .map((s, i) => ({ i, store: s, url: String(s['写真URL'] || '').trim() }))
    .filter((t) => t.url);

  if (opts.store) targets = targets.filter((t) => String(t.store['店名'] || '').includes(opts.store));
  if (opts.host) targets = targets.filter((t) => classifyHost(t.url) === opts.host);
  if (Number.isFinite(opts.limit)) targets = targets.slice(0, opts.limit);

  console.log('=== 店舗写真URL 生存確認 ===');
  console.log(`検査対象: ${targets.length}件（全店 ${stores.length}件中 / 並列 ${opts.concurrency}）\n`);

  const prevReport = loadJson(REPORT_PATH, null);
  const prevFirstDetected = new Map();
  if (prevReport && Array.isArray(prevReport.dead)) {
    for (const d of prevReport.dead) if (d.url) prevFirstDetected.set(d.url, d.firstDetected || d.lastChecked);
  }

  let done = 0;
  const results = await mapWithConcurrency(targets, opts.concurrency, async (t) => {
    const verdict = await judgeLiveness(t.url, { timeoutMs: opts.timeoutMs });
    done++;
    if (done % 500 === 0) console.log(`  ... ${done}/${targets.length}件検査済み`);
    return { ...t, verdict };
  });

  const today = jstToday();
  const byHost = {};
  const dead = [];
  const unknown = [];
  let ok = 0;

  for (const r of results) {
    const host = classifyHost(r.url);
    byHost[host] = byHost[host] || { ok: 0, dead: 0, unknown: 0 };
    if (r.verdict.verdict === 'ok') { ok++; byHost[host].ok++; continue; }
    if (r.verdict.verdict === 'unknown') {
      byHost[host].unknown++;
      unknown.push({ 店名: r.store['店名'] || '', url: r.url, error: r.verdict.error || `status=${r.verdict.status}` });
      continue;
    }
    byHost[host].dead++;
    dead.push({
      店名: r.store['店名'] || '',
      host,
      url: r.url,
      status: r.verdict.status,
      ホットペッパーID: r.store['ホットペッパーID'] || '',
      写真アセットID: hotpepperPhotoId(r.url),
      firstDetected: prevFirstDetected.get(r.url) || today,
      lastChecked: today,
    });
  }

  const report = {
    version: 1,
    lastRun: today,
    lastRunAt: new Date().toISOString(),
    checked: targets.length,
    summary: { ok, dead: dead.length, unknown: unknown.length, byHost },
    dead: dead.sort((a, b) => a.firstDetected.localeCompare(b.firstDetected)),
    unknownSample: unknown.slice(0, 20),
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`OK: ${ok}件 / DEAD: ${dead.length}件 / UNKNOWN(一時障害・判定保留): ${unknown.length}件\n`);
    for (const [host, c] of Object.entries(byHost)) {
      console.log(`  ${host}: ok=${c.ok} dead=${c.dead} unknown=${c.unknown}`);
    }
    if (dead.length) {
      console.log('\n[DEAD 一覧]' + (opts.list ? '' : '（先頭20件・--list で全件）'));
      const sample = opts.list ? dead : dead.slice(0, 20);
      for (const d of sample) {
        console.log(`  - ${d.店名} [${d.host}] status=${d.status} 初検出=${d.firstDetected}`);
        console.log(`      ${d.url}`);
      }
      if (!opts.list && dead.length > sample.length) console.log(`  … 他 ${dead.length - sample.length}件`);
    }
    console.log(`\nレポート: data/photo_url_liveness_report.json`);
  }

  if (opts.check && dead.length > 0) {
    console.error(`\nNG: 配信終了した写真URLが ${dead.length}件あります。`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
