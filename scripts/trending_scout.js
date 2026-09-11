#!/usr/bin/env node
'use strict';
/**
 * scripts/trending_scout.js
 *
 * 話題店発掘ループ（docs/trending-scout-runbook.md）の決定的ヘルパー。
 * WebSearch/WebFetch そのものはこのスクリプトの責務外（Claude Code の Agent 専用ツールのため）。
 * ここが担うのは「今日どのクエリを投げるか」の決定と「動いた証跡（心拍）」の記録のみ。
 *
 * 使い方:
 *   node scripts/trending_scout.js --policy                 # data/trending_scout_policy.json を表示
 *   node scripts/trending_scout.js --next-queries [n]        # 今日投げるべきクエリをJSONで返す
 *   node scripts/trending_scout.js --health-write '<json>'   # 心拍を書く（0件の日も必ず）
 *   node scripts/trending_scout.js --report [--days N]       # 直近の心拍・発掘実績を要約
 */

const fs = require('fs');
const path = require('path');
const { RECOMMENDED_QUERIES } = require('./lib/trending_queries');

const REPO = path.resolve(__dirname, '..');
const POLICY_PATH = path.join(REPO, 'data', 'trending_scout_policy.json');
const HEALTH_PATH = path.join(REPO, 'data', 'trending_scout_health.json');
const TRENDING_PATH = path.join(REPO, 'data', 'trending_stores.json');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

function loadPolicy() {
  return readJson(POLICY_PATH, {});
}

/** JST の日付・年間通算日 */
function jstNow() {
  return new Date(Date.now() + 9 * 3600 * 1000);
}
function jstDateString() {
  return jstNow().toISOString().slice(0, 10);
}
function dayOfYearJST() {
  const d = jstNow();
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((cur - start) / 86400000) + 1; // 1-indexed
}

function out(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

/**
 * 今日投げるべきクエリを決定的に選ぶ。
 * オフセットは「年間通算日 × 1回あたり件数」を全クエリ数で割った余り。
 * gcd(queries_per_run, total)=1 のときは全クエリを重複なく巡回できる
 * （現行37クエリ・6件/回なら実測7日で全クエリをカバーする）。
 */
function nextQueries(n) {
  const policy = loadPolicy();
  const qpr = n || (policy.queries && policy.queries.queries_per_run) || 6;
  const total = RECOMMENDED_QUERIES.length;
  const doy = dayOfYearJST();
  const offset = (doy * qpr) % total;
  const selected = [];
  for (let i = 0; i < Math.min(qpr, total); i++) {
    selected.push(RECOMMENDED_QUERIES[(offset + i) % total]);
  }
  return {
    date_jst: jstDateString(),
    day_of_year: doy,
    offset,
    total_queries: total,
    queries: selected,
  };
}

/**
 * 心拍を書く。ISSUE-084 の教訓（警報を防音室で鳴らすな）の適用:
 * 新規リードが0件の日も必ず書き、コミットしてリポジトリの外（GitHub）へ出す。
 * 判定側は scripts/check_trending_scout_health.js。
 */
function healthWrite(item) {
  const now = new Date();
  const trending = readJson(TRENDING_PATH, { stores: [], candidates: [] });
  const health = {
    version: 1,
    _comment:
      '話題店発掘ループの心拍。trending-scout ルーチンが毎回（新規リード0件の日も）書き、' +
      'コミットで Mac／クラウドの外＝GitHub へ出す。.github/workflows/trending-scout-watchdog.yml が' +
      '鮮度を見て、滞ったら Issue を起票する（＝オーナーにメール）。鮮度は自己申告できない' +
      '（動いていないエージェントはファイルを更新できない）ため、これが本体の検知シグナル。',
    last_run: {
      date: item.date || jstDateString(),
      recorded_at: now.toISOString(),
      // ok = WebSearch/WebFetchを実行できた（新規0件でも ok） / error = 実行自体が失敗した
      status: item.status === 'error' ? 'error' : 'ok',
      reason: item.reason || null,
      queries: Array.isArray(item.queries) ? item.queries.map(String) : [],
      leads_found: Number(item.leads_found) || 0,
      matched_existing: Number(item.matched_existing) || 0,
      new_candidates: Number(item.new_candidates) || 0,
      promoted: Number(item.promoted) || 0,
      trending_stores_total: (trending.stores || []).length,
      trending_candidates_total: (trending.candidates || []).filter(c => c && c['店名']).length,
    },
  };
  fs.writeFileSync(HEALTH_PATH, JSON.stringify(health, null, 2) + '\n');
  return health;
}

function report(days) {
  const health = readJson(HEALTH_PATH, null);
  const trending = readJson(TRENDING_PATH, { stores: [], candidates: [] });
  out({
    days_requested: days || null,
    heartbeat: health ? health.last_run : null,
    trending_stores_total: (trending.stores || []).length,
    trending_candidates_total: (trending.candidates || []).filter(c => c && c['店名']).length,
    note: 'このスクリプトは実行履歴を蓄積しない（心拍は最新1件のみ保持）。過去の傾向は git log data/trending_stores.json で追える',
  });
}

const argv = process.argv.slice(2);

if (argv.includes('--policy')) {
  out(loadPolicy());
} else if (argv.includes('--next-queries')) {
  const i = argv.indexOf('--next-queries');
  const n = parseInt(argv[i + 1], 10);
  out(nextQueries(Number.isFinite(n) ? n : undefined));
} else if (argv.includes('--health-write')) {
  const i = argv.indexOf('--health-write');
  const raw = argv[i + 1];
  if (raw === undefined) { out({ ok: false, error: '--health-write requires JSON' }); process.exit(1); }
  let item;
  try { item = JSON.parse(raw); } catch (e) { out({ ok: false, error: `invalid JSON: ${e.message}` }); process.exit(1); }
  const health = healthWrite(item);
  out({ ok: true, written: HEALTH_PATH, health });
} else if (argv.includes('--report')) {
  const i = argv.indexOf('--days');
  const days = i >= 0 ? parseInt(argv[i + 1], 10) : null;
  report(days);
} else {
  console.error('Usage:');
  console.error('  node scripts/trending_scout.js --policy');
  console.error('  node scripts/trending_scout.js --next-queries [n]');
  console.error("  node scripts/trending_scout.js --health-write '<json>'");
  console.error('  node scripts/trending_scout.js --report [--days N]');
  process.exit(1);
}
