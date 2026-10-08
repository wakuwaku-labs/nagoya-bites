#!/usr/bin/env node
/**
 * SEO-117: data/metrics_history.json の過去の行に GSC の集計値（gsc）を埋め戻す（一回限り・冪等）。
 *
 * 日次スナップショットに gsc が入ったのは 2026-10-09 から。それより前の行は、build.yml が毎日
 * コミットしてきた data/gsc_metrics.json の各版（git 履歴）から、同じ日（generatedAt の UTC 日付
 * ＝スナップショットの date と同じ基準）の最後の版を取って埋める。値は git に残る事実だけで、
 * 埋めた行には backfilledFrom（コミット）を付け、後から第三者が同じ版を開いて検算できるようにする。
 * 既に gsc がある行は触らない。該当する日の版が無い行もそのまま（推測で埋めない）。
 *
 * 使い方: node scripts/backfill_gsc_history.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { extractGsc } = require('./track_metrics');

const ROOT = path.resolve(__dirname, '..');
const HISTORY = path.join(ROOT, 'data/metrics_history.json');
const FILE = 'data/gsc_metrics.json';

/** 日付（UTC）→ その日の最後の版。versions は { sha, gsc } の配列（順不同） */
function latestByDate(versions) {
  const byDate = new Map();
  for (const v of versions) {
    const at = v.gsc && v.gsc.generatedAt;
    if (!at) continue;
    const d = String(at).slice(0, 10);
    const cur = byDate.get(d);
    if (!cur || cur.gsc.generatedAt < at) byDate.set(d, v);
  }
  return byDate;
}

/** gsc の無い行だけ埋める。返り値は埋めた行数 */
function fill(entries, byDate) {
  let n = 0;
  for (const e of entries) {
    if (e.gsc) continue;
    const v = byDate.get(e.date);
    if (!v) continue;
    e.gsc = { ...v.gsc, backfilledFrom: v.sha.slice(0, 10) };
    n++;
  }
  return n;
}

function main() {
  const dry = process.argv.includes('--dry-run');
  const hist = JSON.parse(fs.readFileSync(HISTORY, 'utf8'));
  const shas = execFileSync('git', ['log', '--format=%H', 'HEAD', '--', FILE], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const versions = [];
  for (const sha of shas) {
    try {
      const raw = execFileSync('git', ['show', `${sha}:${FILE}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const gsc = extractGsc(JSON.parse(raw));
      if (gsc) versions.push({ sha, gsc });
    } catch (_) { /* 壊れた版は使わない */ }
  }
  const byDate = latestByDate(versions);
  const n = fill(hist.entries, byDate);
  const missing = hist.entries.filter(e => !e.gsc).map(e => e.date);
  if (!dry && n > 0) fs.writeFileSync(HISTORY, JSON.stringify(hist, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, dryRun: dry, versions: versions.length, days: byDate.size, filled: n, stillMissing: missing.length, stillMissingDates: missing.slice(0, 10) }, null, 2));
}

if (require.main === module) main();

module.exports = { latestByDate, fill };
