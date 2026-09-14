#!/usr/bin/env node
/**
 * NAGOYA BITES — 話題店発掘ループの生存確認
 *
 * 何を見るか（ISSUE-084 の適用・2026-09-11新設):
 *   「今日の話題店がずっと同じラインナップ」というオーナー報告を調査したところ、
 *   新規話題店を発掘して取り込む半自動パイプライン（fetch_trending_articles.js）が
 *   誰にも定期的に回されておらず、data/trending_stores.json が3週間以上フリーズ
 *   していたことが判明した（ISSUE-084 原則1-3の再適用: 監視も自動化しないと同じ
 *   発覚遅れが起きる）。
 *
 *   trending-scout ルーチンは毎回（新規リードが0件の日も）data/trending_scout_health.json
 *   に心拍を書く。ここはその鮮度を見る。
 *
 * 何を「検証できる事実」とみなすか（CLAUDE.md 制約10）:
 *   ○ 心拍ファイルが実在するか       … ファイルシステムの事実
 *   ○ last_run.date が何日前か       … 動いていないエージェントは更新できないので偽装不能
 *   △ last_run.status / reason       … 自己申告。error は即異常、主用途は原因を人に運ぶこと
 *
 * 何を検知“しない”か（オオカミ少年化させない・ISSUE-084 原則6）:
 *   「新規リードが0件」は異常ではない。話題化するネタが無い日があるのは平常。
 *   異常なのは「ループ自体が報告してこないこと」だけ。
 *
 * 使い方:
 *   node scripts/check_trending_scout_health.js
 *   node scripts/check_trending_scout_health.js --json
 *   node scripts/check_trending_scout_health.js --max-silence-days 3
 *
 * 終了コード: 健全=0 / 異常=1（CI が分岐に使う）
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const HEALTH = path.join(REPO, 'data', 'trending_scout_health.json');
const POLICY = path.join(REPO, 'data', 'trending_scout_policy.json');

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
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

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
let lastRun = null;
let silenceDays = null;

if (!health || !health.last_run || !health.last_run.date) {
  problems.push({
    kind: 'no_heartbeat',
    detail:
      'data/trending_scout_health.json が無い（または last_run.date が読めない）。trending-scout ' +
      'ルーチンが一度も心拍を書いていない可能性がある。ルーチンの起動自体・push 権限・スケジュール登録を疑う。',
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
        'trending-scout ルーチンが動いていないか、動いてもコミット/push できていない。',
    });
  }

  if (lastRun.status === 'error') {
    problems.push({
      kind: 'scout_error',
      detail: `最後の実行（${lastRun.date}）がエラーで終わっている: ${lastRun.reason || '理由未記録'}。`,
    });
  }
}

const result = {
  ok: problems.length === 0,
  today_jst: today,
  max_silence_days: MAX_SILENCE_DAYS,
  silence_days: silenceDays,
  last_run: lastRun,
  problems,
  warnings,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[話題店発掘ループ 生存確認] JST ${today}`);
  if (lastRun) {
    console.log(`  最後の心拍: ${lastRun.date}（${silenceDays}日前） / status=${lastRun.status}`);
    if (lastRun.reason) console.log(`  理由: ${lastRun.reason}`);
    console.log(`  今回: リード${lastRun.leads_found}件 / 既存店マッチ${lastRun.matched_existing}件 / ` +
      `新規候補${lastRun.new_candidates}件 / 自動昇格${lastRun.promoted}件`);
  }
  if (result.ok) {
    console.log('✅ 健全（ルーチンは報告してきている）');
  } else {
    console.log(`🔴 異常 ${problems.length}件`);
    for (const p of problems) console.log(`   - [${p.kind}] ${p.detail}`);
  }
  for (const w of warnings) console.log(`   ⚠️  ${w}`);
}

process.exit(result.ok ? 0 : 1);
