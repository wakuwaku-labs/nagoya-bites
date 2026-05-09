#!/usr/bin/env node
/**
 * marketer_weekly_check.js
 * Marketer 週次 SEO/SNS チェックエントリを agent-backlog.md に自動起票する。
 *
 * 動作:
 *  1. 今週の ISO 週番号 (YYYY-WW) を計算する
 *  2. agent-backlog.md に MKT-WEEKLY-YYYY-WW がまだなければスケルトンを追記する
 *  3. GA4 / Search Console アクセスが未確立の場合は「取得待ち (ISSUE-043)」と記載する
 *
 * Phase 2 以降:
 *  - Google Analytics Data API v1 で指標を取得して埋める
 *  - Google Search Console API で KW 順位を取得して埋める
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── ユーティリティ ──────────────────────────────────────────────

/**
 * ISO 8601 週番号を返す (例: "2026-W19")
 * @param {Date} date
 * @returns {string}
 */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO 週は木曜を基準にした週
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo    = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * 週の月曜〜日曜の日付文字列を返す (YYYY-MM-DD 形式)
 * @param {Date} date  基準日（月曜）
 * @returns {{ mon: string, sun: string }}
 */
function weekRange(date) {
  const d   = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  const mon = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const sun = d.toISOString().slice(0, 10);
  return { mon, sun };
}

/**
 * JST 現在時刻を返す
 */
function nowJST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}

// ── メイン ──────────────────────────────────────────────────────

const ROOT    = path.resolve(__dirname, '..');
const BACKLOG = path.join(ROOT, 'agent-backlog.md');

if (!fs.existsSync(BACKLOG)) {
  console.error('agent-backlog.md が見つかりません:', BACKLOG);
  process.exit(1);
}

const today  = nowJST();
const week   = isoWeek(today);
const { mon, sun } = weekRange(today);
const id     = `MKT-WEEKLY-${week}`;
const recorded = today.toISOString().slice(0, 10);

const content = fs.readFileSync(BACKLOG, 'utf8');

// すでに同じ週のエントリがあればスキップ
if (content.includes(`[${id}]`)) {
  console.log(`✅ ${id} はすでに存在します。スキップ。`);
  process.exit(0);
}

// GA4 / Search Console が利用可能かチェック（環境変数で判断）
const hasGA4 = Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GA4_PROPERTY_ID);
const hasGSC = Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GSC_SITE_URL);

const dataNote = hasGA4
  ? '（自動取得 — GA4 接続済み）'
  : '（取得待ち: ISSUE-043 — GA4/Search Console 未接続）';

const entry = `
### [${id}] 週次 SEO/SNS チェック（${mon}〜${sun}）

- **priority**: P3 → **status**: done（記録のみ・施策ではない）
- **detected/recorded**: ${recorded}（月曜自動起票）
- **owner**: Marketer
- **category**: seo / sns / monitoring

#### 1. SEO 順位（代表 KW）${dataNote}
| キーワード | 今週 | 前週 | 変動 |
|---|---|---|---|
| 名古屋 グルメ 業界人 | (取得待ち) | — | — |
| 名古屋 居酒屋 個室 | (取得待ち) | — | — |
| 名古屋 宴会 幹事 | (取得待ち) | — | — |
| 名古屋 接待 和食 | (取得待ち) | — | — |
| 名古屋 飲食店 おすすめ | (取得待ち) | — | — |

#### 2. トラフィック${dataNote}
- オーガニック流入: (取得待ち)
- CTA クリック数: (取得待ち)

#### 3. SNS エンゲージメント（手動入力欄）
- Instagram: リーチ — / いいね — / 保存 —
- X: インプレ — / RT — / いいね —

#### 4. 機会・リスク
- 機会 KW: (未検出)
- 要注意ページ: (未検出)
- 次週の打ち手: GA4/Search Console 実値接続（ISSUE-043）完了後に実値ベース運用へ移行

`;

// 実行ログセクションの直前に挿入（なければ末尾に追記）
const logMarker = '## エージェント実行ログ';
if (content.includes(logMarker)) {
  const updated = content.replace(logMarker, `${entry}\n${logMarker}`);
  fs.writeFileSync(BACKLOG, updated, 'utf8');
} else {
  fs.appendFileSync(BACKLOG, entry, 'utf8');
}

console.log(`✅ ${id} を agent-backlog.md に起票しました（${mon}〜${sun}）`);
