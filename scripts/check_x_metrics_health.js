#!/usr/bin/env node
'use strict';
/**
 * X の数字の取得（x-metrics.yml）の見張り。data/x_metrics.json を見て、止まっていれば issue_body つきで --json に出す。
 *   ・最後の成功（最新スナップショット）が 36 時間より古い
 *   ・last_run が error / budget のまま、最後の成功から 24 時間以上たっている
 * 実行: node scripts/check_x_metrics_health.js --json
 */
const fs = require('fs');
const path = require('path');

const STALE_H = 36;
const FAIL_H = 24;

function check(root, now = new Date()) {
  let d = null;
  try { d = JSON.parse(fs.readFileSync(path.join(root, 'data/x_metrics.json'), 'utf8')); } catch (_) { /* 無い */ }
  const snaps = d && Array.isArray(d.snapshots) ? d.snapshots : [];
  const lastOk = snaps.length ? new Date(snaps[snaps.length - 1].at) : null;
  const ageH = lastOk && !isNaN(lastOk) ? (now - lastOk) / 3600e3 : Infinity;
  const lr = (d && d.last_run) || {};
  const problems = [];
  if (ageH > STALE_H) problems.push(`最後の成功が ${STALE_H} 時間より古い（${lastOk ? lastOk.toISOString() : '成功の記録なし'}）`);
  if ((lr.result === 'error' || lr.result === 'budget') && ageH >= FAIL_H) problems.push(`直近の実行が ${lr.result} のまま（${lr.at || '?'}）: ${lr.reason || '理由なし'}`);
  const ok = problems.length === 0;
  const issue_body = ok ? '' : [
    'X の数字の毎日の取得（.github/workflows/x-metrics.yml）が止まっています。', '',
    ...problems.map((p) => `- ${p}`), '',
    '直し方: Actions の「NAGOYA BITES — X の数字の取得」の最新の実行ログを見る。鍵の失効（401/403）は Secrets の X_API_* を作り直し、',
    'budget は今月の使用額（data/x_metrics.json の budget）を確認する。直ったら次の見張りで自動で閉じます。',
  ].join('\n');
  return { ok, problems, last_ok: lastOk ? lastOk.toISOString() : null, last_run: lr, issue_body };
}

if (require.main === module) {
  const r = check(path.resolve(__dirname, '..'));
  if (process.argv.includes('--json')) console.log(JSON.stringify(r));
  else console.log(r.ok ? 'OK' : r.issue_body);
}
module.exports = { check };
