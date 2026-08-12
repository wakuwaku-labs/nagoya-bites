#!/usr/bin/env node
/**
 * NAGOYA BITES — 日次ジャーナルの健全性チェック（欠番検出）
 *
 * 「記事が出ているか」を、検証できる事実だけで判定する（CLAUDE.md 制約10）:
 *   1. data/journal_published.json に該当日のエントリがあるか
 *   2. そのエントリの slug に対応する journal/<slug>.html が実在するか
 * 自己申告値（スコア等）は一切見ない。両方満たした日だけ「公開済み」とする。
 *
 * 用途:
 *   - GitHub Actions（.github/workflows/journal-watchdog.yml）から日次で実行し、
 *     欠番があれば Issue を起票してオーナーにメールで届ける。
 *     ローカル launchd が「落ちた」場合だけでなく「Mac が寝ていて一度も動かなかった」
 *     場合も検出できる（サーバ側で回るため、ローカルの全故障モードから独立）。
 *   - ローカルからの手動確認。
 *
 * 使い方:
 *   node scripts/check_journal_health.js              # 人が読む要約
 *   node scripts/check_journal_health.js --json       # 機械可読
 *   node scripts/check_journal_health.js --days 14    # 遡る日数（既定7）
 *   node scripts/check_journal_health.js --skip-today # 当日を判定対象から外す
 *
 * 終了コード: 欠番なし=0 / 欠番あり=1（CI が分岐に使う）
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PUBLISHED = path.join(REPO, 'data', 'journal_published.json');
const HEALTH = path.join(REPO, 'data', 'journal_health.json');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const skipToday = argv.includes('--skip-today');
const daysIdx = argv.indexOf('--days');
const DAYS = daysIdx >= 0 ? Math.max(1, parseInt(argv[daysIdx + 1], 10) || 7) : 7;

/** JST の YYYY-MM-DD（UTC+9 に寄せてから ISO の日付部分を取る） */
function jstDate(offsetDays = 0) {
  const ms = Date.now() + 9 * 3600 * 1000 - offsetDays * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

let published = { entries: [] };
try {
  published = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
} catch (e) {
  // published.json 自体が壊れている/読めないのは、欠番より重い異常。
  const out = {
    ok: false,
    fatal: `data/journal_published.json を読めません: ${e.message}`,
    missing: [],
    checked: [],
  };
  console.log(asJson ? JSON.stringify(out, null, 2) : `❌ ${out.fatal}`);
  process.exit(1);
}

const byDate = new Map();
for (const e of published.entries || []) byDate.set(e.date, e);

const checked = [];
const missing = [];

for (let i = skipToday ? 1 : 0; i < DAYS + (skipToday ? 1 : 0); i++) {
  const date = jstDate(i);
  const entry = byDate.get(date);
  let status;
  let detail = '';

  if (!entry) {
    status = 'missing';
    detail = 'published.json に該当日のエントリがない';
  } else if (!entry.slug) {
    status = 'missing';
    detail = 'エントリはあるが slug が空';
  } else if (!fs.existsSync(path.join(REPO, 'journal', `${entry.slug}.html`))) {
    status = 'missing';
    detail = `登録はあるが記事HTMLが無い: journal/${entry.slug}.html`;
  } else {
    status = 'ok';
    detail = `journal/${entry.slug}.html`;
  }

  const row = { date, status, detail };
  if (entry && entry.backfilled) row.backfilled = entry.backfilled;
  checked.push(row);
  if (status === 'missing') missing.push(row);
}

// ローカル実行ラッパーが最後に残した状態（あれば原因を添える）。
// 認証切れ / 品質HOLD / ネットワーク断 のどれなのかで対応が変わるため。
let health = null;
try {
  health = JSON.parse(fs.readFileSync(HEALTH, 'utf8'));
} catch (e) {
  /* 無くても判定は成立する（あくまで補足情報） */
}

const result = {
  ok: missing.length === 0,
  today_jst: jstDate(0),
  window_days: DAYS,
  missing_count: missing.length,
  missing,
  checked,
  last_local_run: health,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`日次ジャーナル健全性チェック（JST ${result.today_jst} / 直近${DAYS}日）`);
  for (const r of checked) {
    const mark = r.status === 'ok' ? '✅' : '❌';
    console.log(`  ${mark} ${r.date}  ${r.detail}${r.backfilled ? `（${r.backfilled} にバックフィル）` : ''}`);
  }
  if (health) {
    console.log('');
    console.log(`最後のローカル実行: ${health.date} — ${health.status}`);
    if (health.reason) console.log(`  理由: ${health.reason}`);
  }
  console.log('');
  console.log(result.ok ? '✅ 欠番なし' : `❌ 欠番 ${missing.length} 件: ${missing.map((m) => m.date).join(', ')}`);
}

process.exit(result.ok ? 0 : 1);
