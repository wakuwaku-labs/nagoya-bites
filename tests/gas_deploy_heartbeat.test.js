'use strict';
// GAS 反映状況の心拍（data/gas_deploy_health.json の last_run）が過去へ戻らないこと。
// 週次レポートの対象日（週の終わり）は日次より古く、日次の後に週次を記録すると
// 心拍が古い日付で上書きされ、ルーチンが動いているのに stale_heartbeat が鳴っていた（2026-10-15）。

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pickLastRun } = require('../scripts/lib/gas_deploy_trace');

const daily = { date: '2026-10-13', status: 'ok', verdict: 'deployed' };
const weekly = { date: '2026-10-10', status: 'ok', verdict: 'deployed' };

test('心拍: 古い対象日の記録（週次）は心拍を過去へ戻さない', () => {
  assert.equal(pickLastRun(daily, weekly), daily);
});

test('心拍: 新しい対象日の記録は心拍を進める', () => {
  assert.equal(pickLastRun(weekly, daily), daily);
});

test('心拍: 同じ対象日の再記録は上書きする（同じメールの再処理）', () => {
  const again = { date: '2026-10-13', status: 'ok', verdict: 'indeterminate' };
  assert.equal(pickLastRun(daily, again), again);
});

test('心拍: 記録が無いときは新しい記録をそのまま使う', () => {
  assert.equal(pickLastRun(null, weekly), weekly);
  assert.equal(pickLastRun({}, weekly), weekly);
});
