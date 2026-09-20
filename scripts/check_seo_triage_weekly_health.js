#!/usr/bin/env node
/**
 * NAGOYA BITES — SEO週次トリアージ の生存確認（SEO-103）
 *
 * 何を見るか:
 *   週次レポートメール（件名「📊 NAGOYA BITES 週次レポート」）は GAS が Gmail 送信し、
 *   スケジュール済み Claude ルーチンが /seo-triage-weekly コマンドで処理する。
 *   ところが Gmail がこのメールを TRASH へ移動させるフィルタが誤設定されており、
 *   /seo-triage-weekly の Gmail 検索クエリ（newer_than:9d）は INBOX/TRASH 両方を
 *   探さないため、TRASH に入ったメールを 0件として静かに終了する（SEO-103）。
 *
 *   週次処理が行われると data/seo_advice_log.json に source="line-weekly" のエントリが
 *   追記される。このファイルは append-only でリポジトリへコミットされるため、
 *   最新エントリの date が「最後に週次処理が行われた日」を表す検証可能な事実になる。
 *
 * 何を「検証できる事実」とみなすか（CLAUDE.md 制約10）:
 *   ○ seo_advice_log.json が実在するか
 *   ○ source="line-weekly" の最新エントリの date が何日前か
 *     → 動いていないルーチンはエントリを追記できないため偽装不能
 *
 * 何を検知"しない"か（オオカミ少年化させない・ISSUE-084 原則6）:
 *   「採用件数が0件」「却下が多い」は**異常ではない**。
 *   検知するのは「週次処理自体が行われていないこと」だけ。
 *
 * 使い方:
 *   node scripts/check_seo_triage_weekly_health.js            # 人が読む要約
 *   node scripts/check_seo_triage_weekly_health.js --json     # 機械可読（CI が読む）
 *   node scripts/check_seo_triage_weekly_health.js --max-silence-days 14
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

// デフォルト14日（週次カデンス7日 + バッファ7日 = 2回連続スキップで検知）
// `.claude/commands/*.md` は自己改変ブロックで編集できないため、
// 閾値変更は --max-silence-days 引数でのみ制御する（CLI引数→デフォルト値）
const mi = argv.indexOf('--max-silence-days');
const MAX_SILENCE_DAYS = mi >= 0 ? Math.max(1, parseInt(argv[mi + 1], 10) || 14) : 14;

const today = jstDate();
const problems = [];
const warnings = [];

const log = readJson(LOG);
let lastWeekly = null;
let silenceDays = null;

if (!log || !Array.isArray(log.entries)) {
  problems.push({
    kind: 'no_log',
    detail:
      'data/seo_advice_log.json が無い（または entries 配列が読めない）。' +
      'SEO トリアージが一度も実行されていない可能性がある。',
  });
} else {
  // source="line-weekly" の最新エントリを探す（entries は append-only なので末尾が最新）
  for (let i = log.entries.length - 1; i >= 0; i--) {
    if (log.entries[i].source === 'line-weekly') {
      lastWeekly = log.entries[i];
      break;
    }
  }

  if (!lastWeekly) {
    problems.push({
      kind: 'no_weekly_entry',
      detail:
        'data/seo_advice_log.json に source="line-weekly" のエントリが一件もない。' +
        '週次処理が一度も実行されていない可能性がある。',
    });
  } else {
    silenceDays = daysBetween(lastWeekly.date, today);

    if (silenceDays === null) {
      problems.push({
        kind: 'bad_date',
        detail: `最新の line-weekly エントリの date が日付として読めない: ${lastWeekly.date}`,
      });
    } else if (silenceDays > MAX_SILENCE_DAYS) {
      problems.push({
        kind: 'stale_weekly',
        detail:
          `最後の週次処理が ${lastWeekly.date}（${silenceDays}日前・許容 ${MAX_SILENCE_DAYS}日）。` +
          '週次レポートの処理が止まっている可能性がある。Gmail TRASH への誤振り分け（SEO-103）、' +
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
  last_weekly: lastWeekly ? {
    date: lastWeekly.date,
    verdict: lastWeekly.verdict,
    id: lastWeekly.id || null,
  } : null,
  total_weekly_entries: log && Array.isArray(log.entries)
    ? log.entries.filter(e => e.source === 'line-weekly').length
    : null,
  problems,
  warnings,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[SEO 週次トリアージ 生存確認] JST ${today}`);
  if (lastWeekly) {
    console.log(`  最後の週次処理: ${lastWeekly.date}（${silenceDays}日前・許容 ${MAX_SILENCE_DAYS}日）`);
    console.log(`  verdict: ${lastWeekly.verdict} / id: ${lastWeekly.id || '—'}`);
  } else {
    console.log('  週次処理の記録なし');
  }
  console.log(`  累計 line-weekly エントリ数: ${result.total_weekly_entries === null ? '読めない' : result.total_weekly_entries}`);
  if (result.ok) {
    console.log('✅ 健全（週次処理は定期的に行われている）');
  } else {
    console.log(`🔴 異常 ${problems.length}件`);
    for (const p of problems) console.log(`   - [${p.kind}] ${p.detail}`);
  }
  for (const w of warnings) console.log(`   ⚠️  ${w}`);
}

process.exit(result.ok ? 0 : 1);
