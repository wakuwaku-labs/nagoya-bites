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

const { categoryOf } = require('./lib/journal_category');

const DATA = path.join(__dirname, '..', 'data');

function loadJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
}

function inRange(dateStr, range) {
  const [from, to] = range.split('/');
  return dateStr >= from && dateStr <= to;
}

function weekdayJa(dateStr) {
  // 日付の文字列そのものの曜日。端末の時間帯に依らない（UTC の CI で日曜が土曜になっていた・2026-11-17）
  const d = new Date(dateStr + 'T00:00:00Z');
  return ['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()];
}

function daysBetween(a, b) {
  const ms = new Date(b + 'T00:00:00+09:00') - new Date(a + 'T00:00:00+09:00');
  return Math.abs(ms / 86400000);
}

function pickTrending(trending, published, date) {
  const stores = (trending && trending.stores) || [];
  const recentText = (published.entries || [])
    .filter(e => daysBetween(e.date, date) <= 90)
    .map(e => `${e.title || ''} ${e.description || ''}`).join('\n');
  const hit = stores.filter(s => {
    const score = s['話題スコア'] != null ? s['話題スコア'] : (s.buzz_score || 0);
    if (score < 90 || s.journaled) return false;
    const detected = s['検出日'] || date;
    if (detected > date || daysBetween(detected, date) > 14) return false;
    if (s['有効期限'] && s['有効期限'] < date) return false;
    if (Array.isArray(s['出典URL']) && s['出典URL'].length < 2) return false;
    const name = s['店名'];
    if (name && recentText.includes(name)) return false;
    return true;
  });
  hit.sort((a, b) => (b['話題スコア'] || 0) - (a['話題スコア'] || 0));
  return hit[0] || null;
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
  // 上書きは「話題のお店紹介」の日だけ（S3-3）。忘年会など長い期間の上書きが、ガイド・比較の回まで
  // 全部季節短信に塗りつぶして配分（話題4・ガイド2・比較1）を崩すため。
  const season = seasonal.events.find(e => inRange(date, e.date_range) && e.priority >= 80);
  if (season && categoryOf({ theme }) === 'topic') {
    theme = 'seasonal';
    label = '季節・イベント短信';
    source = 'seasonal_override';
  }

  // Trending override（S3-3 で修正）
  // 旧版は buzz_score / journaled を見ていたが、trending_stores.json の項目は 話題スコア・検出日・有効期限・出典URL
  // で、旧版の条件は一度も真にならなかった（実測）。今の条件は検証できる事実だけ:
  //   話題スコア>=90・検出日が14日以内・有効期限内・出典URLが2件以上・直近90日の記事の題・概要に店名が無い。
  // 上書きは「話題のお店紹介」の日だけ（ガイド・比較の日は配分を守るため上書きしない）。
  const trendingPick = pickTrending(trending, published, date);
  if (trendingPick && theme !== 'seasonal' && categoryOf({ theme }) === 'topic') {
    theme = 'today_one';
    label = '今日の1軒';
    source = 'trending_override';
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

  // Google で閉業・一時休業と表示されている店は新しい記事で扱わない（S1-4・ADR 0069）
  try {
    const noticeIdx = require('./lib/operating_notice').buildNoticeIndex(require('./lib/load_stores').loadStores());
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (candidates[i].type === 'local' && noticeIdx.has(candidates[i].id)) candidates.splice(i, 1);
    }
  } catch (e) { /* 判定できなければそのまま */ }

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
    category: categoryOf({ theme }),
    // ガイド・比較の回で基準に届く材料が集まらない日の逃げ道（話題のお店紹介に切り替える・基準は下げない）
    fallback_theme: categoryOf({ theme }) === 'topic' ? null : (queue.fallback_theme || 'today_one'),
    label,
    source,
    candidates,
    column,
    seasonal: (season && theme === 'seasonal') ? season : null,
    recent_store_ids: Array.from(recentStoreIds),
    recent_themes: recent.map(e => e.theme)
  };
}

// JST の YYYY-MM-DD（check_journal_health.js と同じ算出方法）。
// new Date().toISOString() は UTC のため、0:00〜8:59 JST に引数なしで実行すると
// 前日の日付・曜日テーマを誤って選んでしまう不具合があった（2026-08-23 発見）。
function jstToday() {
  const ms = Date.now() + 9 * 3600 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** 題材決めだけを from から days 日分回して、分類ごとの本数を数える（公開しない・S3-3 ⑩の試算） */
function simulateDistribution(from, days) {
  const counts = { topic: 0, guide: 0, compare: 0 };
  const rows = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(new Date(from + 'T00:00:00+09:00').getTime() + i * 86400000);
    const date = new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
    const r = pickDailyTopic(date);
    counts[r.category]++;
    rows.push({ date, weekday: r.weekday, theme: r.theme, category: r.category, source: r.source });
  }
  return { counts, rows };
}

if (require.main === module && process.argv[2] === '--simulate') {
  const from = process.argv[3] || jstToday();
  const days = Number(process.argv[4] || 30);
  const r = simulateDistribution(from, days);
  console.log(JSON.stringify({ from, days, counts: r.counts, per_week: Object.fromEntries(Object.entries(r.counts).map(([k, v]) => [k, +(v / days * 7).toFixed(1)])) }, null, 2));
} else if (require.main === module) {
  const date = process.argv[2] || jstToday();
  const result = pickDailyTopic(date);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { pickDailyTopic, pickTrending, simulateDistribution };
