#!/usr/bin/env node
/**
 * NAGOYA BITES — SEO週次triageループの生存確認（SEO-080 / 2026-09-04）
 *
 * 何を見るか:
 *   週次レポートが Gmail ゴミ箱に入ると取得クエリ（TRASH除外）が0件を返し、
 *   triage が静かにスキップされる。seo_advice_log.json の source='line-weekly'
 *   エントリが一定期間途絶えていれば、この沈黙を検知する。
 *
 * 何を「検証できる事実」とみなすか（CLAUDE.md 制約10）:
 *   ○ seo_advice_log.json の最新 line-weekly エントリの date   … 動いていないエージェントは追記できない
 *   ○ エントリの実在                                            … ファイルシステムの事実
 *   △ status / verdict                                          … 自己申告。主用途は原因を人に運ぶこと
 *
 * 何を検知"しない"か（オオカミ少年化させない・ISSUE-084 原則6）:
 *   「N週間 新しい採用課題が出なかった」は異常ではない（全却下/重複は平常）。
 *   異常なのは「line-weekly エントリが max_silence_days を超えて途絶えること」だけ。
 *
 * 使い方:
 *   node scripts/check_seo_triage_weekly_health.js            # 人が読む要約
 *   node scripts/check_seo_triage_weekly_health.js --json     # 機械可読（CI が読む）
 *   node scripts/check_seo_triage_weekly_health.js --max-silence-days 10
 *
 * 終了コード: 健全=0 / 異常=1（CI が分岐に使う）
 */

'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SEO_LOG = path.join(REPO, 'data', 'seo_advice_log.json');
const POLICY = path.join(REPO, 'data', 'seo_triage_retrieval_policy.json');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');

function jstDate(offsetDays = 0) {
  const ms = Date.now() + 9 * 3600 * 1000 - offsetDays * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetween(fromYmd, toYmd) {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const policy = readJson(POLICY) || {};
const policyMax = policy.weekly && policy.weekly.max_silence_days;
const mi = argv.indexOf('--max-silence-days');
const MAX_SILENCE_DAYS =
  mi >= 0 ? Math.max(1, parseInt(argv[mi + 1], 10) || 10)
  : Number.isFinite(policyMax) ? policyMax
  : 10;

const today = jstDate();
const problems = [];
const warnings = [];

const log = readJson(SEO_LOG);
const entries = (log && Array.isArray(log.entries)) ? log.entries : null;

let lastWeeklyDate = null;
let lastWeeklyEntry = null;

if (!entries) {
  problems.push('seo_advice_log.json が見つからない、または形式が不正');
} else {
  const weekly = entries.filter(e => e.source === 'line-weekly');
  if (weekly.length === 0) {
    problems.push('line-weekly エントリが seo_advice_log.json に一件もない');
  } else {
    lastWeeklyEntry = weekly[weekly.length - 1];
    lastWeeklyDate = lastWeeklyEntry.date;
    const age = daysBetween(lastWeeklyDate, today);
    if (age === null) {
      warnings.push(`line-weekly の date "${lastWeeklyDate}" が日付として解析できない`);
    } else if (age > MAX_SILENCE_DAYS) {
      problems.push(
        `週次triage の最終実行から ${age} 日が経過（閾値: ${MAX_SILENCE_DAYS} 日）。` +
        `最終エントリ: ${lastWeeklyDate}。週次レポートが Gmail ゴミ箱に入っている可能性あり`
      );
    }
  }
}

const ok = problems.length === 0;

if (asJson) {
  const out = {
    ok,
    today_jst: today,
    max_silence_days: MAX_SILENCE_DAYS,
    last_weekly_date: lastWeeklyDate,
    last_weekly_verdict: lastWeeklyEntry ? lastWeeklyEntry.verdict || lastWeeklyEntry.status : null,
    problems,
    warnings,
    note: ok
      ? `週次triageは ${lastWeeklyDate ? `最終 ${lastWeeklyDate}（${daysBetween(lastWeeklyDate, today)}日前）` : '不明'} に動作確認済み`
      : '週次triageの沈黙を検出しました。Gmail ゴミ箱を確認してください',
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(ok ? 0 : 1);
}

// 人が読む要約
console.log('=== SEO 週次triage 生存確認 ===');
console.log(`検査日（JST）: ${today}`);
console.log(`沈黙閾値: ${MAX_SILENCE_DAYS} 日`);
console.log('');

if (lastWeeklyDate) {
  const age = daysBetween(lastWeeklyDate, today);
  console.log(`最終 line-weekly エントリ: ${lastWeeklyDate}（${age !== null ? age + '日前' : '日数不明'}）`);
  if (lastWeeklyEntry && (lastWeeklyEntry.verdict || lastWeeklyEntry.status)) {
    console.log(`  verdict/status: ${lastWeeklyEntry.verdict || lastWeeklyEntry.status}`);
  }
} else {
  console.log('最終 line-weekly エントリ: なし');
}

if (warnings.length) {
  console.log('');
  console.log('⚠️  警告:');
  warnings.forEach(w => console.log('  ' + w));
}

if (problems.length) {
  console.log('');
  console.log('🔴 異常:');
  problems.forEach(p => console.log('  ' + p));
  console.log('');
  console.log('対処:');
  console.log('  1. Gmail で「週次レポート」を「ゴミ箱を含む全て」で検索し、最新メールを確認');
  console.log('  2. 見つかった場合: ゴミ箱から移動し、/seo-triage-weekly を手動実行');
  console.log('  3. GAS が週次メールを送信しているか確認（週次スケジュール設定）');
  console.log('  参考: data/seo_triage_retrieval_policy.json の sweep_query を使う');
  process.exit(1);
} else {
  console.log('');
  console.log('✅ 正常: 週次triage は沈黙閾値内で動作しています');
  process.exit(0);
}
