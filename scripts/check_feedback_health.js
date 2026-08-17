#!/usr/bin/env node
/**
 * NAGOYA BITES — 消費者フィードバック改善ループの生存確認
 *
 * 何を見るか（ISSUE-089 / 2026-08-17）:
 *   このループの検知器は「Gmail 検索」1本しかない。ところが Gmail 検索は
 *   **実在するメールに対して 0件を返す**ことがある（2026-08-17 実測。同一クエリを
 *   数分後に投げ直したらヒットした）。無人実行では 0件＝「新着なし」で静かに正常終了
 *   するため、偽陰性と平常が外から区別できない。
 *
 *   そこで triage ルーチンは毎日（**新着0件の日も**）data/feedback_health.json に
 *   心拍を書き、コミットで Mac／クラウドの外＝GitHub へ出す。ここはその鮮度を見る。
 *
 * 何を「検証できる事実」とみなすか（CLAUDE.md 制約10）:
 *   ○ 心拍ファイルが実在するか            … ファイルシステムの事実
 *   ○ last_run.date が何日前か            … **動いていないエージェントは更新できない**ので偽装不能。
 *                                            これが本体の検知シグナル
 *   △ last_run.status / reason            … 自己申告。合否は分けるが（gmail_error は即異常）、
 *                                            主用途は「原因を人に運ぶ」こと（ISSUE-084 原則5）
 *   ○ log_entries_total と feedback_log.json の実件数の一致 … 独立に再計算できる整合性チェック。
 *                                            ズレは警告のみ（心拍書き込み後の追記でも起こりうるため）
 *
 * 何を検知“しない”か（オオカミ少年化させない・ISSUE-084 原則6）:
 *   「N日フィードバックが0件」は**異常ではない**。実績で月3件程度・8日以上の空白は平常。
 *   異常なのは「triage ルーチン自体が報告してこないこと」。ここが両者を分ける線。
 *
 * 使い方:
 *   node scripts/check_feedback_health.js            # 人が読む要約
 *   node scripts/check_feedback_health.js --json     # 機械可読（CI が読む）
 *   node scripts/check_feedback_health.js --max-silence-days 3
 *
 * 終了コード: 健全=0 / 異常=1（CI が分岐に使う）
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const HEALTH = path.join(REPO, 'data', 'feedback_health.json');
const LOG = path.join(REPO, 'data', 'feedback_log.json');
const POLICY = path.join(REPO, 'data', 'feedback_policy.json');

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

// 閾値はポリシーが単一の情報源（.claude/commands/*.md は自己改変ブロックで編集できないため）
const policy = readJson(POLICY) || {};
const policyMax = policy.health && policy.health.max_silence_days;
const mi = argv.indexOf('--max-silence-days');
const MAX_SILENCE_DAYS =
  mi >= 0 ? Math.max(1, parseInt(argv[mi + 1], 10) || 3)
  : Number.isFinite(policyMax) ? policyMax
  : 3;

const today = jstDate();
const problems = [];
const warnings = [];

const health = readJson(HEALTH);
const log = readJson(LOG);
const actualEntries = log && Array.isArray(log.entries) ? log.entries.length : null;

let lastRun = null;
let silenceDays = null;

if (!health || !health.last_run || !health.last_run.date) {
  problems.push({
    kind: 'no_heartbeat',
    detail:
      'data/feedback_health.json が無い（または last_run.date が読めない）。triage ルーチンが ' +
      '一度も心拍を書いていない可能性がある。ルーチンの起動自体・push 権限・スケジュール登録を疑う。',
  });
} else {
  lastRun = health.last_run;
  silenceDays = daysBetween(lastRun.date, today);

  if (silenceDays === null) {
    problems.push({ kind: 'bad_date', detail: `last_run.date が日付として読めない: ${lastRun.date}` });
  } else if (silenceDays > MAX_SILENCE_DAYS) {
    problems.push({
      kind: 'stale_heartbeat',
      detail:
        `最後の心拍が ${lastRun.date}（${silenceDays}日前・許容 ${MAX_SILENCE_DAYS}日）。` +
        'triage ルーチンが動いていないか、動いてもコミット/push できていない。',
    });
  }

  if (lastRun.status === 'gmail_error') {
    problems.push({
      kind: 'gmail_error',
      detail:
        `最後の実行（${lastRun.date}）が Gmail を引けずに終わっている: ${lastRun.reason || '理由未記録'}。` +
        '認証切れならコードでは直せない（対話ログインが必要）。',
    });
  }

  if (actualEntries !== null && Number.isFinite(lastRun.log_entries_total) &&
      lastRun.log_entries_total !== actualEntries) {
    warnings.push(
      `心拍の log_entries_total=${lastRun.log_entries_total} と feedback_log.json の実件数=${actualEntries} が不一致` +
      '（心拍書き込み後の追記なら正常。恒常的にズレるなら書き込み順序を疑う）'
    );
  }

  if (Number.isFinite(lastRun.late_recovered) && lastRun.late_recovered > 0) {
    warnings.push(
      `直近の実行で ${lastRun.late_recovered} 件を**遅れて回収**している（＝過去に取りこぼしが実際に起きた証拠）。` +
      '頻発するなら検索窓 sweep_window_days の拡大を検討する。'
    );
  }
}

const result = {
  ok: problems.length === 0,
  today_jst: today,
  max_silence_days: MAX_SILENCE_DAYS,
  silence_days: silenceDays,
  last_run: lastRun,
  log_entries_total: actualEntries,
  problems,
  warnings,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[消費者フィードバックループ 生存確認] JST ${today}`);
  if (lastRun) {
    console.log(`  最後の心拍: ${lastRun.date}（${silenceDays}日前） / status=${lastRun.status}`);
    if (lastRun.reason) console.log(`  理由: ${lastRun.reason}`);
    if (Array.isArray(lastRun.queries) && lastRun.queries.length) {
      for (const q of lastRun.queries) console.log(`  クエリ: ${q.q} → ${q.matched}件`);
    }
  }
  console.log(`  ログ実件数: ${actualEntries === null ? '読めない' : actualEntries}`);
  if (result.ok) {
    console.log('✅ 健全（ルーチンは報告してきている）');
  } else {
    console.log(`🔴 異常 ${problems.length}件`);
    for (const p of problems) console.log(`   - [${p.kind}] ${p.detail}`);
  }
  for (const w of warnings) console.log(`   ⚠️  ${w}`);
}

process.exit(result.ok ? 0 : 1);
