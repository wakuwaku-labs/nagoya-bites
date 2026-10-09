#!/usr/bin/env node
/**
 * hotpepper_fetch_report.js — HotPepper 由来の店の取りこぼしと出入りを数える（ISSUE-143）
 *
 *   node scripts/hotpepper_fetch_report.js            # 最新の取得の記録（data/hotpepper_fetch_log.json）を表示
 *   node scripts/hotpepper_fetch_report.js --check    # 最新の回に取りこぼし（エラー・件数との差）があれば exit 1
 *   node scripts/hotpepper_fetch_report.js --churn [--days 14] [--ref origin/main] [--json]
 *       data/stores.json の git の履歴（日本時間の1日の最後の版）から、HotPepper ID の出入りを数える。
 *       「消えた後に戻った」ID は、実在する店が取得の取りこぼしで一時的に消えたもの（ISSUE-143 の直後7日で比べる）
 *
 * 判定に使うのは API が返した件数（results_available）・取れた店の数・掲載データの ID だけ（制約10）。
 * 記録が無い（CI でまだ一度も書かれていない）ときは何も判定せず exit 0（鳴らさない）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { shortfalls } = require('./lib/hotpepper_fetch');

const ROOT = path.join(__dirname, '..');
const LOG = path.join(ROOT, 'data', 'hotpepper_fetch_log.json');

function jstDate(iso) {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 日ごとの ID 集合から出入りを数える（純関数・テスト対象）。
 * snapshots: [{ date, ids: Set }]（古い順）
 */
function churnFromSnapshots(snapshots) {
  const steps = [];
  const removedAt = new Map(); // id → 最初に消えた日
  const returned = new Set();
  for (let i = 0; i < snapshots.length; i++) {
    const cur = snapshots[i];
    if (i === 0) { steps.push({ date: cur.date, count: cur.ids.size, added: null, removed: null }); continue; }
    const prev = snapshots[i - 1];
    let added = 0, removed = 0;
    for (const id of cur.ids) {
      if (!prev.ids.has(id)) {
        added++;
        if (removedAt.has(id)) returned.add(id);
      }
    }
    for (const id of prev.ids) {
      if (!cur.ids.has(id)) {
        removed++;
        if (!removedAt.has(id)) removedAt.set(id, cur.date);
      }
    }
    steps.push({ date: cur.date, count: cur.ids.size, added, removed });
  }
  const last = snapshots.length ? snapshots[snapshots.length - 1].ids : new Set();
  const stillGone = [...removedAt.keys()].filter((id) => !last.has(id)).length;
  return {
    steps,
    added: steps.reduce((a, s) => a + (s.added || 0), 0),
    removed: steps.reduce((a, s) => a + (s.removed || 0), 0),
    returned: returned.size,
    stillGone,
  };
}

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
}

function snapshotsFromGit(ref, days) {
  const lines = git(['log', '--first-parent', `--since=${days} days ago`, '--format=%H %cI', ref, '--', 'data/stores.json'])
    .trim().split('\n').filter(Boolean);
  const lastOfDay = new Map();
  for (const line of lines.reverse()) { // 古い順に並べ、同じ日は後の版で上書き
    const [sha, iso] = line.split(' ');
    lastOfDay.set(jstDate(iso), sha);
  }
  return [...lastOfDay.entries()].map(([date, sha]) => {
    const data = JSON.parse(git(['show', `${sha}:data/stores.json`]));
    const list = Array.isArray(data) ? data : (data.stores || []);
    return { date, sha: sha.slice(0, 10), ids: new Set(list.map((s) => String(s['ホットペッパーID'] || '')).filter((id) => /^J\d+$/.test(id))) };
  });
}

function main() {
  const args = process.argv.slice(2);
  const val = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
  if (args.includes('--churn')) {
    const days = Number(val('--days', '14'));
    const ref = val('--ref', 'origin/main');
    const snaps = snapshotsFromGit(ref, days);
    const r = churnFromSnapshots(snaps);
    if (args.includes('--json')) { console.log(JSON.stringify({ ref, days, ...r }, null, 2)); return; }
    console.log(`HotPepper ID の出入り（${ref}・直近${days}日・日本時間の1日の最後の版）`);
    for (const s of r.steps) console.log(`  ${s.date}  ${String(s.count).padStart(5)}件  ${s.added == null ? '' : `+${s.added} / -${s.removed}`}`);
    console.log(`合計: 増えた ${r.added} / 消えた ${r.removed} / 消えた後に戻った ${r.returned} / 消えたまま ${r.stillGone}`);
    return;
  }
  if (!fs.existsSync(LOG)) {
    console.log('data/hotpepper_fetch_log.json がまだ無い（CI の build.js が書く）。判定しない');
    return;
  }
  const log = JSON.parse(fs.readFileSync(LOG, 'utf8'));
  const run = (log.runs || [])[log.runs.length - 1];
  if (!run) { console.log('記録に回が無い。判定しない'); return; }
  console.log(`最新の取得: ${run.at}（合計 ${run.total} 件）`);
  for (const a of run.areas || []) {
    const extra = a.smallAreas ? ` ・小エリア ${a.smallAreas} 件で取り直し` : '';
    console.log(`  ${a.code} ${a.name}: 件数 ${a.available == null ? '不明' : a.available} / 取れた ${a.fetched}${extra}${a.errors && a.errors.length ? ` ・エラー ${a.errors.length}` : ''}`);
  }
  const short = shortfalls(run);
  console.log(`取りこぼしのあるエリア: ${short.length} 件${short.length ? `（${short.map((x) => `${x.name}: ${x.reasons.join('・')}`).join(' / ')}）` : ''}`);
  if (args.includes('--check') && short.length) process.exit(1);
}

if (require.main === module) main();
module.exports = { churnFromSnapshots, jstDate };
