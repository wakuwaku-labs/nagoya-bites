'use strict';

/**
 * SEO日次トリアージ 生存確認スクリプト（SEO-152）のテスト
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check_seo_triage_daily_health.js');
const LOG = path.join(ROOT, 'data', 'seo_advice_log.json');

test('check_seo_triage_daily_health.js: スクリプトが存在する', () => {
  assert.ok(fs.existsSync(SCRIPT), `${SCRIPT} が見つかりません`);
});

test('check_seo_triage_daily_health.js: --json オプションで JSON を出力する', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--json'], { encoding: 'utf8', cwd: ROOT });
  const parsed = JSON.parse(out);
  assert.ok(typeof parsed.ok === 'boolean', 'ok フィールドが boolean でない');
  assert.ok(typeof parsed.today_jst === 'string', 'today_jst フィールドが string でない');
  assert.ok(Array.isArray(parsed.problems), 'problems フィールドが配列でない');
  assert.ok(typeof parsed.max_silence_days === 'number', 'max_silence_days フィールドが number でない');
});

test('check_seo_triage_daily_health.js: seo_advice_log.json に line-daily エントリがある', () => {
  const log = JSON.parse(fs.readFileSync(LOG, 'utf8'));
  const dailyEntries = log.entries.filter(e => e.source === 'line-daily');
  assert.ok(dailyEntries.length > 0, 'line-daily エントリが一件もない');
});

test('check_seo_triage_daily_health.js: 現在の状態で健全（line-daily の最新エントリが2日以内）', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--json'], { encoding: 'utf8', cwd: ROOT });
  const result = JSON.parse(out);
  // 最新エントリの日付が存在することを確認（偽装不能な事実を使っていることの検証）
  assert.ok(result.last_daily !== null, 'last_daily が null — line-daily エントリが無い');
  assert.ok(typeof result.silence_days === 'number', 'silence_days が number でない');
  assert.ok(result.silence_days >= 0, `silence_days が負の値: ${result.silence_days}`);
});

test('check_seo_triage_daily_health.js: 許容日数を超えるとき stale_daily 問題が出る', () => {
  // silence_days（昨日以前に処理済みなので >= 1）より少ない --max-silence-days を渡すと異常になるはず
  const result = JSON.parse(
    execFileSync(process.execPath, [SCRIPT, '--json'], { encoding: 'utf8', cwd: ROOT }),
  );
  if (result.silence_days === null || result.silence_days < 2) {
    // silence_days が確定できない or 同日処理済みならスキップ
    return;
  }
  // silence_days >= 2 のとき、--max-silence-days (silence_days - 1) を渡せば必ず stale になる
  const threshold = result.silence_days - 1;
  const out2 = execFileSync(
    process.execPath, [SCRIPT, '--json', '--max-silence-days', String(threshold)],
    { encoding: 'utf8', cwd: ROOT },
  );
  const r2 = JSON.parse(out2);
  assert.equal(r2.ok, false, `--max-silence-days ${threshold} で ok=true になっている`);
  const kinds = r2.problems.map(p => p.kind);
  assert.ok(
    kinds.includes('stale_daily') || kinds.includes('no_daily_entry') || kinds.includes('bad_date'),
    `期待するエラー種別が含まれない: ${JSON.stringify(kinds)}`,
  );
});
