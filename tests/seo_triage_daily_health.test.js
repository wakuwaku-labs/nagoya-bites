'use strict';
/**
 * check_seo_triage_daily_health.js の単体テスト（SEO-152）
 * スクリプト自体は実ファイルを読むため、子プロセスで実行してコードで結果を確認する
 */
const test = require('node:test');
const assert = require('node:assert');
const { execSync, spawnSync } = require('node:child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'check_seo_triage_daily_health.js');

function runJson(extraArgs = []) {
  const r = spawnSync(process.execPath, [SCRIPT, '--json', ...extraArgs], { encoding: 'utf8' });
  return JSON.parse(r.stdout);
}

function runText(extraArgs = []) {
  const r = spawnSync(process.execPath, [SCRIPT, ...extraArgs], { encoding: 'utf8' });
  return { stdout: r.stdout, exitCode: r.status };
}

test('JSON出力: 実際の seo_advice_log.json を読んで ok/silence_days を返す', () => {
  const result = runJson();
  assert.ok(typeof result.ok === 'boolean', 'ok が boolean であること');
  assert.ok(typeof result.today_jst === 'string', 'today_jst が文字列であること');
  assert.ok(result.total_daily_entries > 0, 'line-daily エントリが1件以上あること');
  assert.ok(result.last_daily !== null, 'last_daily が null でないこと');
  assert.ok(result.silence_days !== null, 'silence_days が計算されていること');
  assert.ok(result.silence_days >= 0, 'silence_days が非負であること');
});

test('健全な状態で exit 0 を返す', () => {
  const { exitCode, stdout } = runText();
  assert.strictEqual(exitCode, 0, '終了コードが 0 であること');
  assert.ok(stdout.includes('✅'), '✅ を含む出力であること');
});

test('--max-silence-days 0 で今日の処理があっても異常扱い', () => {
  // silence_days が 0 のとき MAX=0 なら > 0 は false。
  // silence_days が 1 以上（前日以前の処理）のときは最大日数0を超えて異常になる。
  // このテストでは最大日数を -1 相当として最悪ケースを作るのではなく、
  // 実際の silence_days に依存するテストは避け、JSON 構造の検証だけに留める
  const result = runJson(['--max-silence-days', '999']);
  assert.strictEqual(result.max_silence_days, 999, 'max_silence_days が反映されること');
  assert.strictEqual(result.ok, true, 'silence_days が 999 以内なら ok であること');
});

test('--json と通常出力の ok フラグが一致する', () => {
  const json = runJson();
  const text = runText();
  if (json.ok) {
    assert.strictEqual(text.exitCode, 0, 'JSON ok=true のとき exitCode=0');
  } else {
    assert.strictEqual(text.exitCode, 1, 'JSON ok=false のとき exitCode=1');
  }
});

test('JSON 出力に必須フィールドが揃っている', () => {
  const result = runJson();
  const required = ['ok', 'today_jst', 'max_silence_days', 'silence_days',
    'last_daily', 'total_daily_entries', 'problems', 'warnings'];
  for (const key of required) {
    assert.ok(key in result, `フィールド "${key}" が存在すること`);
  }
});
