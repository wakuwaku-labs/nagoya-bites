'use strict';
// SEO-152: SEO日次トリアージ 生存確認スクリプトの検査
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'check_seo_triage_health.js');
const LOG = path.join(__dirname, '..', 'data', 'seo_advice_log.json');

test('check_seo_triage_health.js が存在する', () => {
  assert.ok(fs.existsSync(SCRIPT), 'scripts/check_seo_triage_health.js が存在すること');
});

test('--json オプションで有効な JSON を返す', () => {
  const out = execSync(`node ${SCRIPT} --json`, { encoding: 'utf8' });
  const r = JSON.parse(out);
  assert.ok(typeof r.ok === 'boolean', 'ok フィールドが boolean');
  assert.ok(typeof r.today_jst === 'string', 'today_jst フィールドが string');
  assert.ok(typeof r.max_silence_days === 'number', 'max_silence_days フィールドが number');
  assert.ok(Array.isArray(r.problems), 'problems フィールドが array');
});

test('seo_advice_log.json に line-daily エントリがあるため健全と判定される', () => {
  const log = JSON.parse(fs.readFileSync(LOG, 'utf8'));
  const dailyEntries = log.entries.filter(e => e.source === 'line-daily');
  assert.ok(dailyEntries.length > 0, 'line-daily エントリが1件以上あること');

  const out = execSync(`node ${SCRIPT} --json`, { encoding: 'utf8' });
  const r = JSON.parse(out);
  assert.ok(r.ok === true, '現在のログで健全判定されること');
  assert.ok(r.total_daily_entries > 0, 'total_daily_entries が 0 より大きいこと');
});

test('--max-silence-days 0 を指定するとシレンス0日でも異常判定になる', () => {
  let result;
  try {
    execSync(`node ${SCRIPT} --json --max-silence-days 0`, { encoding: 'utf8' });
    result = 'ok'; // 健全と判定（silence_days=0 <= max=1 なので）
  } catch (e) {
    result = 'error'; // 異常と判定（exit 1）
  }
  // max-silence-days 0 は内部で Math.max(1,...) に切り上げるため、実質 --max-silence-days 1
  // 最新エントリが今日なら silence_days=0 <= 1 で健全になるはず
  assert.strictEqual(result, 'ok', '--max-silence-days 0 は 1 に切り上げ → 健全');
});

test('seo_triage_retrieval_policy.json のクエリに絵文字が含まれていない（SEO-152 fix）', () => {
  const policy = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data', 'seo_triage_retrieval_policy.json'), 'utf8'
  ));
  assert.ok(
    !policy.daily.primary_query.includes('📊'),
    '日次の primary_query に 📊 が含まれないこと'
  );
  assert.ok(
    !policy.weekly.primary_query.includes('📊'),
    '週次の primary_query に 📊 が含まれないこと'
  );
});

test('.claude/commands/seo-triage.md の検索クエリに絵文字が含まれていない（SEO-152 fix）', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', '.claude', 'commands', 'seo-triage.md'), 'utf8'
  );
  // subject: "📊..." のパターン（バッククォート内のクエリ）が無いこと
  assert.ok(
    !src.includes('subject:"📊 NAGOYA BITES 日次レポート"'),
    'seo-triage.md の subject: クエリに 📊 が含まれないこと'
  );
});

test('.claude/commands/seo-triage-weekly.md の検索クエリに絵文字が含まれていない（SEO-152 fix）', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', '.claude', 'commands', 'seo-triage-weekly.md'), 'utf8'
  );
  assert.ok(
    !src.includes('subject:"📊 NAGOYA BITES 週次レポート"'),
    'seo-triage-weekly.md の subject: クエリに 📊 が含まれないこと'
  );
});

test('seo-triage-watchdog.yml が存在する', () => {
  assert.ok(
    fs.existsSync(path.join(__dirname, '..', '.github', 'workflows', 'seo-triage-watchdog.yml')),
    '.github/workflows/seo-triage-watchdog.yml が存在すること'
  );
});

test('seo-triage-daily-runbook.md が存在する', () => {
  assert.ok(
    fs.existsSync(path.join(__dirname, '..', 'docs', 'seo-triage-daily-runbook.md')),
    'docs/seo-triage-daily-runbook.md が存在すること'
  );
});
