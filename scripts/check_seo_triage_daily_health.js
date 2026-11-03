#!/usr/bin/env node
/**
 * NAGOYA BITES — SEO日次トリアージ の生存確認（SEO-152）
 *
 * 何を見るか:
 *   日次レポートメール（件名「📊 NAGOYA BITES 日次レポート」）は GAS が Gmail 送信し、
 *   スケジュール済み Claude ルーチンが /seo-triage コマンドで処理する。
 *   ところが日次の Gmail 取得クエリは `newer_than:2d`（最新スレッドのみ）なので、
 *   定期実行が 1 回抜けるとその日のレポートは二度と読まれない（SEO-152）。
 *
 *   日次処理が行われると data/seo_advice_log.json に source="line-daily" のエントリが
 *   追記される。このファイルは append-only でリポジトリへコミットされるため、
 *   最新エントリの date が「最後に日次処理が行われた日」を表す検証可能な事実になる。
 *
 * 何を「検証できる事実」とみなすか（CLAUDE.md 制約10）:
 *   ○ seo_advice_log.json が実在するか
 *   ○ source="line-daily" の最新エントリの date が何日前か
 *     → 動いていないルーチンはエントリを追記できないため偽装不能
 *
 * 何を検知"しない"か（オオカミ少年化させない・ISSUE-084 原則6）:
 *   「採用件数が0件」「却下が多い」は**異常ではない**。
 *   検知するのは「日次処理自体が行われていないこと」だけ。
 *
 * 使い方:
 *   node scripts/check_seo_triage_daily_health.js            # 人が読む要約
 *   node scripts/check_seo_triage_daily_health.js --json     # 機械可読（CI が読む）
 *   node scripts/check_seo_triage_daily_health.js --max-silence-days 5
 *
 * 終了コード: 健全=0 / 異常=1
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const LOG = path.join(REPO, 'data', 'seo_advice_log.json');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');

/** JST の YYYY-MM-DD */
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
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

// デフォルト3日（日次カデンス1日 + バッファ2日 = 3日連続で欠けると検知）
// `.claude/commands/*.md` は自己改変ブロックで編集できないため、
// 閾値変更は --max-silence-days 引数でのみ制御する（CLI引数→デフォルト値）
const mi = argv.indexOf('--max-silence-days');
const MAX_SILENCE_DAYS = mi >= 0 ? Math.max(1, parseInt(argv[mi + 1], 10) || 3) : 3;

const today = jstDate();
const problems = [];
const warnings = [];

const log = readJson(LOG);
let lastDaily = null;
let silenceDays = null;

if (!log || !Array.isArray(log.entries)) {
  problems.push({
    kind: 'no_log',
    detail:
      'data/seo_advice_log.json が無い（または entries 配列が読めない）。' +
      'SEO トリアージが一度も実行されていない可能性がある。',
  });
} else {
  // source="line-daily" の最新エントリを探す（entries は append-only なので末尾が最新）
  for (let i = log.entries.length - 1; i >= 0; i--) {
    if (log.entries[i].source === 'line-daily') {
      lastDaily = log.entries[i];
      break;
    }
  }

  if (!lastDaily) {
    problems.push({
      kind: 'no_daily_entry',
      detail:
        'data/seo_advice_log.json に source="line-daily" のエントリが一件もない。' +
        '日次処理が一度も実行されていない可能性がある。',
    });
  } else {
    silenceDays = daysBetween(lastDaily.date, today);

    if (silenceDays === null) {
      problems.push({
        kind: 'bad_date',
        detail: `最新の line-daily エントリの date が日付として読めない: ${lastDaily.date}`,
      });
    } else if (silenceDays > MAX_SILENCE_DAYS) {
      problems.push({
        kind: 'stale_daily',
        detail:
          `最後の日次処理が ${lastDaily.date}（${silenceDays}日前・許容 ${MAX_SILENCE_DAYS}日）。` +
          '日次レポートの処理が止まっている可能性がある。Gmail の取得クエリ（newer_than:2d）が' +
          '窓の外に落としたレポートがある可能性がある。' +
          '認証切れ、またはスケジュール未登録を疑う。',
      });
    }
  }
}

const result = {
  ok: problems.length === 0,
  today_jst: today,
  max_silence_days: MAX_SILENCE_DAYS,
  silence_days: silenceDays,
  last_daily: lastDaily ? {
    date: lastDaily.date,
    verdict: lastDaily.verdict,
    id: lastDaily.id || null,
  } : null,
  total_daily_entries: log && Array.isArray(log.entries)
    ? log.entries.filter(e => e.source === 'line-daily').length
    : null,
  problems,
  warnings,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[SEO 日次トリアージ 生存確認] JST ${today}`);
  if (lastDaily) {
    console.log(`  最後の日次処理: ${lastDaily.date}（${silenceDays}日前・許容 ${MAX_SILENCE_DAYS}日）`);
    console.log(`  verdict: ${lastDaily.verdict} / id: ${lastDaily.id || '—'}`);
  } else {
    console.log('  日次処理の記録なし');
  }
  console.log(`  累計 line-daily エントリ数: ${result.total_daily_entries === null ? '読めない' : result.total_daily_entries}`);
  if (result.ok) {
    console.log('✅ 健全（日次処理は定期的に行われている）');
  } else {
    console.log(`🔴 異常 ${problems.length}件`);
    for (const p of problems) console.log(`   - [${p.kind}] ${p.detail}`);
  }
  for (const w of warnings) console.log(`   ⚠️  ${w}`);
}

process.exit(result.ok ? 0 : 1);
