#!/usr/bin/env node
'use strict';
/**
 * check_social_health.js  (SEO-055)
 *
 * 「SNS原稿（docs/daily-posts/<date>.md）はあるのに、その日以降 SNS 由来セッションが
 *  何日も連続で 0」を検知する。日次ジャーナル欠番監視（check_journal_health.js）や
 *  消費者フィードバックの生存監視（check_feedback_health.js）と同じ設計思想:
 *
 *   - 判定は検証できる事実だけで行う（制約10）:
 *     data/metrics_history.json の search_channels.social（数値）と
 *     docs/daily-posts/<date>.md の実在。どちらも自己申告できない
 *   - 「原稿が無い日」は異常ではない（そもそも配信対象が無い）ため streak に含めない
 *   - search_channels.social が未計測（旧形式・キー自体が無い）の日はカウントしない
 *     （scripts/search_channel_metrics.js の aggregate() が social を必ず明示するよう
 *     SEO-055 で修正したのは 2026-08-19。それ以前の履歴エントリには social キーが無い）
 *
 * 使い方:
 *   node scripts/check_social_health.js          # 人間可読
 *   node scripts/check_social_health.js --json    # JSON（GitHub Actions 向け）
 *   異常検知時は exit 1（--json でも同様。CI がこれで分岐する）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HISTORY = path.join(ROOT, 'data', 'metrics_history.json');
const POSTS_DIR = path.join(ROOT, 'docs', 'daily-posts');

// 「配信断絶」と判断するまでの連続日数。日次公開ペースなので1週間分。
const CONSECUTIVE_DAYS_THRESHOLD = 7;

function hasSocialKey(entry) {
  return !!(entry && entry.search_channels && typeof entry.search_channels.social === 'number');
}

function hasDraftForDate(date) {
  return fs.existsSync(path.join(POSTS_DIR, `${date}.md`));
}

function evaluate() {
  if (!fs.existsSync(HISTORY)) {
    return { ok: true, ready: false, note: 'data/metrics_history.json が無い（観測前）' };
  }
  let history;
  try {
    history = JSON.parse(fs.readFileSync(HISTORY, 'utf8'));
  } catch (e) {
    return { ok: true, ready: false, note: `metrics_history.json の読み込みに失敗: ${e.message}` };
  }
  const entries = (history.entries || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));

  let streak = 0;
  let scanned = 0;
  const recent = [];
  for (let i = entries.length - 1; i >= 0 && scanned < 30; i--) {
    const e = entries[i];
    if (!hasSocialKey(e)) continue; // 旧形式（social未計測）はスキップ
    scanned++;
    const draftExists = hasDraftForDate(e.date);
    if (!draftExists) continue; // 原稿が無い日はそもそも配信対象が無い＝異常ではない
    recent.push({ date: e.date, social: e.search_channels.social });
    if (e.search_channels.social === 0) {
      streak++;
    } else {
      break; // 直近から見て streak が途切れた時点で打ち切り
    }
  }

  return {
    ok: streak < CONSECUTIVE_DAYS_THRESHOLD,
    ready: true,
    today_jst: new Date().toISOString().slice(0, 10),
    consecutive_zero_days: streak,
    threshold: CONSECUTIVE_DAYS_THRESHOLD,
    recent: recent.slice(0, CONSECUTIVE_DAYS_THRESHOLD + 2),
  };
}

function main() {
  const args = process.argv.slice(2);
  const r = evaluate();
  if (args.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
  } else if (!r.ready) {
    console.log(r.note);
  } else {
    console.log(
      `SNS配信 生存確認（JST ${r.today_jst}）: 原稿ありでsocial=0の連続日数 ${r.consecutive_zero_days}日 ` +
      `（閾値 ${r.threshold}日）`
    );
    r.recent.forEach((d) => console.log(`  ${d.date}: social=${d.social}`));
    console.log(r.ok ? '✅ 健全' : '🔴 異常: 原稿はあるのにSNS流入が連続してゼロです');
  }
  if (r.ready && !r.ok) process.exit(1);
}

if (require.main === module) main();
module.exports = { evaluate, hasSocialKey, hasDraftForDate, CONSECUTIVE_DAYS_THRESHOLD };
