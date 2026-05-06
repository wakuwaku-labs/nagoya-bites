'use strict';
/**
 * scripts/pick_daily_trending5.js
 *
 * 「今日の話題店」を毎朝5店ピックアップする。
 *
 * 設計思想:
 *   Google評価は使わない。「鮮度（いつ話題になったか）」と「多媒体露出（いくつの媒体で取り上げられたか）」だけで選ぶ。
 *
 * スコア配分（最大100点 + 推薦ボーナス10、ペナルティ -15）:
 *   - 鮮度:           最大50点（検出日からの経過日数で減衰）
 *   - 多媒体露出:     最大35点（トレンド情報源[] と 出典URL[] の distinct host を合算した媒体数）
 *   - 編集部推薦:     +10点
 *   - 既存話題スコア: 最大5点（補正）
 *   - 連日ピックペナ: 過去7日に5選入りしていれば -15点
 *
 * 入力: data/trending_stores.json, data/manual_stores.json, data/daily_trending5.json（前回値）
 * 出力: data/daily_trending5.json
 *
 * 使い方:
 *   node scripts/pick_daily_trending5.js dryrun   # スコアを stdout に表示し書き出さない
 *   node scripts/pick_daily_trending5.js run      # 書き出しまで実行
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TRENDING_PATH = path.join(ROOT, 'data', 'trending_stores.json');
const MANUAL_PATH = path.join(ROOT, 'data', 'manual_stores.json');
const OUT_PATH = path.join(ROOT, 'data', 'daily_trending5.json');

const TOP_N = 5;
const HISTORY_DAYS = 7;
const REPEAT_PENALTY = -15;

function todayJST() {
  const tz = new Date(Date.now() + 9 * 3600 * 1000);
  return tz.toISOString().slice(0, 10);
}

function diffDays(fromYmd, toYmd) {
  if (!fromYmd) return 9999;
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return 9999;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function freshnessScore(days) {
  if (days <= 0) return 50;
  if (days <= 3) return 50 - Math.round(((days - 0) / 3) * 8);
  if (days <= 7) return 42 - Math.round(((days - 3) / 4) * 9);
  if (days <= 14) return 33 - Math.round(((days - 7) / 7) * 13);
  if (days <= 30) return 20 - Math.round(((days - 14) / 16) * 12);
  if (days <= 60) return 8 - Math.round(((days - 30) / 30) * 8);
  return 0;
}

function mediaCount(sources, urls) {
  const set = new Set();
  for (const s of (sources || [])) {
    if (s && typeof s === 'string') set.add('src:' + s.trim());
  }
  for (const u of (urls || [])) {
    if (!u || typeof u !== 'string') continue;
    try {
      const h = new URL(u).hostname.replace(/^www\./, '');
      if (h) set.add('host:' + h);
    } catch (_) { /* ignore invalid URL */ }
  }
  return set.size;
}

function mediaScore(n) {
  if (n <= 0) return 0;
  if (n === 1) return 12;
  if (n === 2) return 22;
  if (n === 3) return 30;
  return 35;
}

function loadJSON(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error(`読み込み失敗: ${p}: ${e.message}`); return fallback; }
}

function buildCandidates(today) {
  const candidates = [];
  const trending = loadJSON(TRENDING_PATH, { stores: [] });
  for (const s of (trending.stores || [])) {
    if (s['話題フラグ'] !== true) continue;
    if (s['有効期限'] && s['有効期限'] < today) continue;
    candidates.push({
      店名: s['店名'],
      エリア: s['エリア'] || '',
      検出日: s['検出日'] || '',
      情報源: s['トレンド情報源'] || [],
      出典URL: s['出典URL'] || [],
      話題スコア: parseInt(s['話題スコア']) || 0,
      編集部推薦: false,
      コメント: s['コメント'] || '',
      _source: 'trending',
    });
  }
  const manual = loadJSON(MANUAL_PATH, { stores: [] });
  for (const s of (manual.stores || [])) {
    const hasBuzz = s['話題フラグ'] === true || s['編集部推薦'] === true;
    if (!hasBuzz) continue;
    if (s['有効期限'] && s['有効期限'] < today) continue;
    candidates.push({
      店名: s['店名'],
      エリア: s['エリア'] || '',
      検出日: s['追加日'] || s['検出日'] || '',
      情報源: s['トレンド情報源'] || [],
      出典URL: s['出典URL'] || [],
      話題スコア: parseInt(s['話題スコア']) || 0,
      編集部推薦: s['編集部推薦'] === true,
      コメント: s['コメント'] || '',
      _source: 'manual',
    });
  }
  // 重複除去（店名+エリア）。trending を先に push しているため、後勝ちで manual を優先
  const dedupe = new Map();
  for (const c of candidates) {
    const key = (c.店名 || '') + '|' + (c.エリア || '');
    dedupe.set(key, c);
  }
  return Array.from(dedupe.values());
}

function loadHistory(today) {
  const prev = loadJSON(OUT_PATH, null);
  if (!prev || !Array.isArray(prev.history)) return [];
  return prev.history
    .filter(h => h && h.date && diffDays(h.date, today) > 0 && diffDays(h.date, today) <= HISTORY_DAYS)
    .slice(-HISTORY_DAYS);
}

function recentlyPickedNames(history) {
  const set = new Set();
  for (const h of history) {
    for (const n of (h['店名一覧'] || [])) set.add(n);
  }
  return set;
}

function summarize(c, days, n) {
  const parts = [];
  if (n >= 4) parts.push(`${n}媒体掲載`);
  else if (n >= 1) parts.push(`${n}媒体掲載`);
  if (days <= 0) parts.push('今日掲載');
  else if (days === 1) parts.push('昨日掲載');
  else if (days <= 7) parts.push(`${days}日前に掲載`);
  else if (days <= 30) parts.push(`${days}日前に話題化`);
  else parts.push(`${days}日前検出`);
  if (c.編集部推薦) parts.push('編集部推薦');
  return parts.join('・');
}

function score(c, today, recentSet) {
  const days = diffDays(c.検出日, today);
  const n = mediaCount(c.情報源, c.出典URL);
  let s = 0;
  const f = freshnessScore(days);
  const m = mediaScore(n);
  const e = c.編集部推薦 ? 10 : 0;
  const b = Math.round((c.話題スコア || 0) * 0.05);
  const p = recentSet.has(c.店名) ? REPEAT_PENALTY : 0;
  s = f + m + e + b + p;
  const repURL = (c.出典URL || []).find(Boolean) || '';
  return {
    score: s,
    breakdown: { freshness: f, media: m, editor: e, buzz: b, penalty: p },
    days, mediaCount: n, repURL,
  };
}

function pickTop(today) {
  const history = loadHistory(today);
  const recent = recentlyPickedNames(history);
  const candidates = buildCandidates(today);
  const scored = candidates.map(c => ({ c, ...score(c, today, recent) }));
  scored.sort((a, b) => b.score - a.score);
  return { scored, history };
}

function run({ write }) {
  const today = todayJST();
  const { scored, history } = pickTop(today);

  if (scored.length === 0) {
    console.log('候補ゼロ。書き出ししない。');
    return;
  }

  console.log(`\n=== 候補スコア (${scored.length}件 / today=${today}) ===`);
  for (const x of scored) {
    console.log(
      `[${String(x.score).padStart(3)}] ${x.c.店名} (${x.c.エリア}) ` +
      `f=${x.breakdown.freshness} m=${x.breakdown.media} e=${x.breakdown.editor} ` +
      `b=${x.breakdown.buzz} p=${x.breakdown.penalty} ` +
      `[鮮度${x.days}日 / ${x.mediaCount}媒体]`
    );
  }

  const top = scored.slice(0, TOP_N);
  const outStores = top.map((x, i) => ({
    順位: i + 1,
    店名: x.c.店名,
    エリア: x.c.エリア,
    鮮度日数: x.days,
    媒体数: x.mediaCount,
    話題ハイライト: summarize(x.c, x.days, x.mediaCount),
    情報源: x.c.情報源,
    代表URL: x.repURL,
    スコア: x.score,
  }));

  // 履歴更新（直近 HISTORY_DAYS 日分のみ保持）
  const newHistoryEntry = { date: today, '店名一覧': outStores.map(s => s.店名) };
  const filteredHistory = history.filter(h => h.date !== today);
  const nextHistory = [...filteredHistory, newHistoryEntry]
    .filter(h => diffDays(h.date, today) <= HISTORY_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date));

  const out = {
    date: today,
    _comment: '毎朝 scripts/pick_daily_trending5.js が更新。鮮度+多媒体露出で TOP5 を選定。Google評価は不問。',
    stores: outStores,
    history: nextHistory,
  };

  console.log(`\n=== TOP${TOP_N} (${today}) ===`);
  for (const s of outStores) {
    console.log(`${s.順位}. ${s.店名} (${s.エリア}) — ${s.話題ハイライト} [score=${s.スコア}]`);
  }

  if (write) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log(`\n書き出し完了: ${OUT_PATH}`);
  } else {
    console.log('\n(dryrun: 書き出しスキップ)');
  }
}

const cmd = process.argv[2] || 'run';
if (cmd === 'run') run({ write: true });
else if (cmd === 'dryrun') run({ write: false });
else {
  console.error('Usage: node scripts/pick_daily_trending5.js [run|dryrun]');
  process.exit(1);
}
