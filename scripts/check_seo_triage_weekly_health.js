#!/usr/bin/env node
/**
 * NAGOYA BITES — SEO トリアージ 生存確認（SEO-103 / SEO-152）
 *
 * 何を見るか:
 *   日次/週次レポートメールは GAS が Gmail 送信し、スケジュール済み Claude ルーチンが
 *   /seo-triage（日次）/ /seo-triage-weekly（週次）コマンドで処理する。
 *   処理が行われると data/seo_advice_log.json に source="line-daily" / "line-weekly" の
 *   エントリが追記される。このファイルは append-only でリポジトリへコミットされるため、
 *   最新エントリの date が「最後に処理が行われた日」を表す検証可能な事実になる。
 *
 * 何を「検証できる事実」とみなすか（CLAUDE.md 制約10）:
 *   ○ seo_advice_log.json が実在するか
 *   ○ 指定 source の最新エントリの date が何日前か
 *     → 動いていないルーチンはエントリを追記できないため偽装不能
 *
 * 何を検知"しない"か（オオカミ少年化させない・ISSUE-084 原則6）:
 *   「採用件数が0件」「却下が多い」は**異常ではない**。
 *   検知するのは「処理自体が行われていないこと」だけ。
 *
 * 使い方:
 *   node scripts/check_seo_triage_weekly_health.js                    # 週次（デフォルト）
 *   node scripts/check_seo_triage_weekly_health.js --source line-daily   # 日次
 *   node scripts/check_seo_triage_weekly_health.js --source line-weekly  # 週次（明示）
 *   node scripts/check_seo_triage_weekly_health.js --json              # 機械可読（CI が読む）
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

// --source で日次/週次を切り替え。デフォルトは後方互換のため line-weekly
const si = argv.indexOf('--source');
const SOURCE = si >= 0 && argv[si + 1] ? argv[si + 1] : 'line-weekly';
const isDaily = SOURCE === 'line-daily';

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

// デフォルト閾値: 日次=3日（1日カデンス＋バッファ2日）、週次=14日（週次＋バッファ7日）
// 閾値変更は --max-silence-days 引数でのみ制御する
const mi = argv.indexOf('--max-silence-days');
const DEFAULT_MAX = isDaily ? 3 : 14;
const MAX_SILENCE_DAYS = mi >= 0 ? Math.max(1, parseInt(argv[mi + 1], 10) || DEFAULT_MAX) : DEFAULT_MAX;

const SOURCE_LABEL = isDaily ? '日次' : '週次';
const COMMAND_NAME = isDaily ? '/seo-triage' : '/seo-triage-weekly';

const today = jstDate();
const problems = [];
const warnings = [];

const log = readJson(LOG);
let lastEntry = null;
let silenceDays = null;

if (!log || !Array.isArray(log.entries)) {
  problems.push({
    kind: 'no_log',
    detail:
      'data/seo_advice_log.json が無い（または entries 配列が読めない）。' +
      `SEO ${SOURCE_LABEL}トリアージが一度も実行されていない可能性がある。`,
  });
} else {
  // 指定 source の最新エントリを探す（entries は append-only なので末尾が最新）
  for (let i = log.entries.length - 1; i >= 0; i--) {
    if (log.entries[i].source === SOURCE) {
      lastEntry = log.entries[i];
      break;
    }
  }

  if (!lastEntry) {
    problems.push({
      kind: 'no_entry',
      detail:
        `data/seo_advice_log.json に source="${SOURCE}" のエントリが一件もない。` +
        `${SOURCE_LABEL}処理が一度も実行されていない可能性がある。`,
    });
  } else {
    silenceDays = daysBetween(lastEntry.date, today);

    if (silenceDays === null) {
      problems.push({
        kind: 'bad_date',
        detail: `最新の ${SOURCE} エントリの date が日付として読めない: ${lastEntry.date}`,
      });
    } else if (silenceDays > MAX_SILENCE_DAYS) {
      const hint = isDaily
        ? '日次レポートの処理が止まっている可能性がある。Gmail TRASH への誤振り分け、' +
          '認証切れ、またはスケジュール未登録を疑う。' +
          `未判定レポートは Gmail で "NAGOYA BITES 日次レポート" を検索して手動で ${COMMAND_NAME} を実行する。`
        : '週次レポートの処理が止まっている可能性がある。Gmail TRASH への誤振り分け（SEO-103）、' +
          '認証切れ、またはスケジュール未登録を疑う。';
      problems.push({
        kind: 'stale_entry',
        detail:
          `最後の${SOURCE_LABEL}処理が ${lastEntry.date}（${silenceDays}日前・許容 ${MAX_SILENCE_DAYS}日）。` +
          hint,
      });
    }
  }
}

const result = {
  ok: problems.length === 0,
  source: SOURCE,
  today_jst: today,
  max_silence_days: MAX_SILENCE_DAYS,
  silence_days: silenceDays,
  last_entry: lastEntry ? {
    date: lastEntry.date,
    verdict: lastEntry.verdict,
    id: lastEntry.id || null,
  } : null,
  total_entries: log && Array.isArray(log.entries)
    ? log.entries.filter(e => e.source === SOURCE).length
    : null,
  problems,
  warnings,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[SEO ${SOURCE_LABEL}トリアージ 生存確認] JST ${today}`);
  if (lastEntry) {
    console.log(`  最後の${SOURCE_LABEL}処理: ${lastEntry.date}（${silenceDays}日前・許容 ${MAX_SILENCE_DAYS}日）`);
    console.log(`  verdict: ${lastEntry.verdict} / id: ${lastEntry.id || '—'}`);
  } else {
    console.log(`  ${SOURCE_LABEL}処理の記録なし`);
  }
  console.log(`  累計 ${SOURCE} エントリ数: ${result.total_entries === null ? '読めない' : result.total_entries}`);
  if (result.ok) {
    console.log(`✅ 健全（${SOURCE_LABEL}処理は定期的に行われている）`);
  } else {
    console.log(`🔴 異常 ${problems.length}件`);
    for (const p of problems) console.log(`   - [${p.kind}] ${p.detail}`);
  }
  for (const w of warnings) console.log(`   ⚠️  ${w}`);
}

process.exit(result.ok ? 0 : 1);
