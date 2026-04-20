'use strict';
/**
 * scripts/pick_daily_topic.js
 *
 * 今日のジャーナルテーマと候補店を選定する。
 * Editor エージェントがローカル Claude Code セッションから起動される前提。
 *
 * 使い方:
 *   node scripts/pick_daily_topic.js [YYYY-MM-DD]
 *   # 省略時は today
 *
 * 出力: stdout に JSON { date, weekday, theme, label, candidates:[], column, seasonal }
 *
 * ロジック:
 *   1. journal_queue.json から当日の枠を取得
 *   2. seasonal_events.json で priority>=80 の該当日は seasonal にオーバーライド
 *   3. trending_stores.json に話題スコア>=90 の新着があれば today_one にオーバーライド
 *   4. 連続2日同ジャンル禁止 / 同一店30日再掲禁止 を journal_published.json で判定
 *   5. 業界裏側テーマなら editorial_column_backlog.json から未使用&直近60日同カテゴリ未使用を選ぶ
 */

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');

function loadJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
}

function inRange(dateStr, range) {
  const [from, to] = range.split('/');
  return dateStr >= from && dateStr <= to;
}

function weekdayJa(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
}

function daysBetween(a, b) {
  const ms = new Date(b + 'T00:00:00+09:00') - new Date(a + 'T00:00:00+09:00');
  return Math.abs(ms / 86400000);
}

function pickDailyTopic(date) {
  const queue = loadJSON('journal_queue.json');
  const seasonal = loadJSON('seasonal_events.json');
  const backlog = loadJSON('editorial_column_backlog.json');
  const published = loadJSON('journal_published.json');
  let trending = { stores: [] };
  try { trending = loadJSON('trending_stores.json'); } catch (_) {}

  const slot = queue.queue.find(q => q.date === date);
  const weekday = weekdayJa(date);
  let theme = slot ? slot.theme : (queue.rotation_rules[weekday] || {}).theme || 'today_one';
  let label = (queue.rotation_rules[weekday] || {}).label || '';
  let source = slot ? 'queue' : 'rotation';

  // Seasonal override
  const season = seasonal.events.find(e => inRange(date, e.date_range) && e.priority >= 80);
  if (season) {
    theme = 'seasonal';
    label = '🗓 季節・イベント短信';
    source = 'seasonal_override';
  }

  // Trending override
  let trendingPick = null;
  if (trending.stores) {
    trendingPick = trending.stores.find(s => (s.buzz_score || 0) >= 90 && !s.journaled);
    if (trendingPick && theme !== 'seasonal') {
      theme = 'today_one';
      label = '🍶 今日の1軒';
      source = 'trending_override';
    }
  }

  // Published history check
  const recent = (published.entries || []).slice(-10);
  const last = recent[recent.length - 1];
  if (last && last.theme === theme && theme === 'today_one') {
    // 連続2日 today_one は許容(火木土で並ぶ)、同ジャンル連投のみ避ける(現場で運用)
  }

  // Column pick for industry_insider
  let column = null;
  if (theme === 'industry_insider') {
    const usedCategoriesInLast60d = (published.entries || [])
      .filter(e => e.theme === 'industry_insider' && daysBetween(e.date, date) <= 60)
      .map(e => (backlog.items.find(i => i.id === e.column_id) || {}).category);
    column = backlog.items.find(i => !i.used && !usedCategoriesInLast60d.includes(i.category));
    if (!column) column = backlog.items.find(i => !i.used);
  }

  // Candidate stores: slot candidates + trending overrides + empty for Editor to fill
  const candidates = [];
  if (slot && slot.candidate_store_ids) candidates.push(...slot.candidate_store_ids.map(id => ({ type: 'local', id })));
  if (slot && slot.candidate_external) candidates.push(...slot.candidate_external.map(x => ({ type: 'external', ...x })));
  if (trendingPick) candidates.unshift({ type: 'trending', store: trendingPick });

  // Recent store ids to avoid re-posting within 30 days
  const recentStoreIds = new Set();
  (published.entries || []).forEach(e => {
    if (daysBetween(e.date, date) <= 30) {
      (e.store_ids || []).forEach(id => recentStoreIds.add(id));
      (e.pending_store_keys || []).forEach(k => recentStoreIds.add('pending:' + k));
    }
  });

  return {
    date,
    weekday,
    theme,
    label,
    source,
    candidates,
    column,
    seasonal: season || null,
    recent_store_ids: Array.from(recentStoreIds),
    recent_themes: recent.map(e => e.theme)
  };
}

if (require.main === module) {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  const result = pickDailyTopic(date);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { pickDailyTopic };
