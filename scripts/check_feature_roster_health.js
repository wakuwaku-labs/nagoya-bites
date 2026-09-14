#!/usr/bin/env node
/**
 * NAGOYA BITES — 特集の月次店舗ローテーションの生存確認
 *
 * 何を見るか（ISSUE-125・ISSUE-084 の適用・2026-09-15新設）:
 *   ISSUE-124 で特集の月次ローテーション対象を19→51特集に拡大した際、旧実装が
 *   「build.yml の月初(1〜3日 JST)だけ実行」という固定日ゲートだったため、その3日間に
 *   手前のステップ（他都道府県マッチ監査等・continue-on-error 無し）がたまたま失敗すると、
 *   その月はローテーションが丸ごと欠落したまま誰も気づけないことが実測で判明した
 *   （2026-08-01〜03・2026-09-01〜03 とも全run失敗で欠落。オーナー報告で発覚）。
 *
 *   対策として `refresh_feature_rosters.js --if-stale` は「今月まだ未反映か」で判定する
 *   自己修復方式に変更したが、これ自体が「気づけるはず」で止まっていては同じ発覚遅れが
 *   再発する（ISSUE-084 原則3）。ここはその心構え通り、監視を別レイヤーに置く。
 *
 * 何を「検証できる事実」とみなすか（CLAUDE.md 制約10）:
 *   ○ data/feature_roster_health.json の実在        … ファイルシステムの事実
 *   ○ last_run.month / last_run.date が何日前か       … 動いていなければ更新できないので偽装不能
 *   △ last_run.status（ok/partial）                   … 自己申告。partial は原因を人に運ぶ用途
 *
 * 何を検知“しない”か（オオカミ少年化させない・ISSUE-084 原則6）:
 *   月内の2回目以降のスキップは正常動作（--if-stale の設計通り）。異常なのは
 *   「今月分がいつまで経っても反映されないこと」だけ。月初からの猶予日数を持たせる。
 *
 * 使い方:
 *   node scripts/check_feature_roster_health.js
 *   node scripts/check_feature_roster_health.js --json
 *   node scripts/check_feature_roster_health.js --max-silence-days 40
 *
 * 終了コード: 健全=0 / 異常=1（CI が分岐に使う）
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const HEALTH = path.join(REPO, 'data', 'feature_roster_health.json');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');

function jstDate(offsetDays = 0) {
  const ms = Date.now() + 9 * 3600 * 1000 - offsetDays * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}
function jstMonth() { return jstDate().slice(0, 7); }

function daysBetween(fromYmd, toYmd) {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

const mi = argv.indexOf('--max-silence-days');
// 月次カデンスなので「数日の遅延」は正常。丸1ヶ月分の反映が完全に抜けたことだけを検知する
// （最悪ケース: 前月末近くに反映→翌月分は月末近くまで積み上がる、を許容する猶予）。
const MAX_SILENCE_DAYS = mi >= 0 ? Math.max(7, parseInt(argv[mi + 1], 10) || 40) : 40;

const today = jstDate();
const thisMonth = jstMonth();
const problems = [];
const warnings = [];

const health = readJson(HEALTH);
let lastRun = null;
let silenceDays = null;

if (!health || !health.last_run || !health.last_run.date || !health.last_run.month) {
  problems.push({
    kind: 'no_heartbeat',
    detail:
      'data/feature_roster_health.json が無い（または last_run.date/month が読めない）。' +
      'refresh_feature_rosters.js --if-stale が一度も反映を記録していない可能性がある。' +
      'build.yml のステップ実行・push 権限・スケジュール自体を疑う。',
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
        `最後の反映が ${lastRun.date}（${lastRun.month}分・${silenceDays}日前・許容 ${MAX_SILENCE_DAYS}日）。` +
        '月次ローテーションが少なくとも1ヶ月分反映されていない可能性が高い。' +
        '手前のステップ（他都道府県マッチ監査等）が継続的にブロックしているか、' +
        'ワークフロー自体が動いていないかを疑う。',
    });
  } else if (lastRun.month !== thisMonth && silenceDays > 10) {
    // 今月分がまだ一度も反映されていない。許容日数内でも月初からの遅延として警告扱いにする
    // （build.yml は毎日走るはずなので、10日経っても前月のままなら手前のステップが詰まっている）。
    warnings.push(
      `今月(${thisMonth})分はまだ反映されていない（最終反映は${lastRun.month}分・${today}時点）。` +
      `許容(${MAX_SILENCE_DAYS}日)は超えていないため異常扱いはしないが、手前のステップの` +
      '継続失敗が無いか一応確認を推奨。'
    );
  }

  if (lastRun.status === 'partial') {
    warnings.push(
      `最後の反映（${lastRun.date}）で枠割れ・失敗が${lastRun.shortfalls}件あった` +
      `（対象${lastRun.targets}件中${lastRun.updated}件のみ更新）。反映自体は行われているため異常扱いはしない。`
    );
  }
}

const result = {
  ok: problems.length === 0,
  today_jst: today,
  this_month: thisMonth,
  max_silence_days: MAX_SILENCE_DAYS,
  silence_days: silenceDays,
  last_run: lastRun,
  problems,
  warnings,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[特集ロスター 生存確認] JST ${today}（今月: ${thisMonth}）`);
  if (lastRun) {
    console.log(`  最終反映: ${lastRun.date}（${lastRun.month}分・${silenceDays}日前） / status=${lastRun.status}`);
    console.log(`  対象${lastRun.targets}件中 更新${lastRun.updated}件 / 枠割れ${lastRun.shortfalls}件`);
  }
  if (result.ok) {
    console.log('✅ 健全');
  } else {
    console.log(`🔴 異常 ${problems.length}件`);
    for (const p of problems) console.log(`   - [${p.kind}] ${p.detail}`);
  }
  for (const w of warnings) console.log(`   ⚠️  ${w}`);
}

process.exit(result.ok ? 0 : 1);
