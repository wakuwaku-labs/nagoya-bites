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
 * 鮮度の自動更新（A案）:
 *   `data/trending_url_history.json` を管理し、`出典URL[]` に新しいURLが
 *   追加されたら自動で `検出日` を当日に繰り上げる。Editor は新しい媒体URLを
 *   `出典URL[]` に追記するだけで OK。`検出日` を手動で書き換える必要はない。
 *
 * 入力: data/trending_stores.json, data/manual_stores.json, data/daily_trending5.json, data/trending_url_history.json
 * 出力: data/daily_trending5.json, data/trending_url_history.json,
 *       (検出日が新しくなった場合のみ) data/trending_stores.json と data/manual_stores.json も更新
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
const URL_HISTORY_PATH = path.join(ROOT, 'data', 'trending_url_history.json');
const OUT_PATH = path.join(ROOT, 'data', 'daily_trending5.json');

const TOP_N = 5;
const HISTORY_DAYS = 7;
const REPEAT_PENALTY = -15;
const MAX_PER_CATEGORY = 2; // TOP5 内で同一の粗ジャンルは最大2件まで（一極集中防止）

// 粗ジャンル分類。trending_stores は ジャンル を持たないため 店名 でも判定する。
// 上から順にマッチ判定するので、より具体的なルールを上に置く。
const CATEGORY_RULES = [
  ['ラーメン', /らーめん|ラーメン|ramen|menya|中華そば|つけ麺|まぜそば|担々|担担|二郎|煮干し|鶏白湯|豚骨|Wスープ|黒醤油|清湯|醤油|味噌|塩|麺/i],
  ['餃子', /餃子|ぎょうざ|ワンタン/i],
  ['焼肉・鉄板', /焼肉|鉄板|ホルモン|神戸牛|和牛|ステーキ/i],
  ['寿司・和食', /鮨|寿司|割烹|懐石|和食|季節料理|料亭/i],
  ['焼鳥', /焼鳥|焼き鳥|手羽|串/i],
  ['スイーツ', /スイーツ|大福|プリン|チーズケーキ|パフェ|ジェラート|クレープ|かき氷|氷|抹茶|チョコレート|チョコ|ケーキ|甘味|トースト/i],
  ['カフェ・喫茶', /喫茶|カフェ|cafe|coffee|コーヒー|珈琲|焙煎|モーニング|スペシャルティ|シングルオリジン/i],
  ['イタリアン・洋食', /イタリアン|フレンチ|ビストロ|パスタ|スパゲティ|洋食|ピザ|ピッツァ|ワイン/i],
  ['カレー', /カレー|スパイス/i],
  ['居酒屋・バー', /居酒屋|酒場|バー|\bbar\b|日本酒|焼酎/i],
];

function coarseCategory(c) {
  const hay = `${c.ジャンル || ''} ${c.店名 || ''}`;
  for (const [name, re] of CATEGORY_RULES) {
    if (re.test(hay)) return name;
  }
  return 'その他';
}

// 店名+日付から決まる安定した [0,1) のジッター。同点店の並びを日替わりでローテーションさせ、
// 「いつも同じ先頭の店が出続ける（ファイル順固定）」状態を防ぐ。
function dailyJitter(name, today) {
  let h = 2166136261;
  const s = `${name}|${today}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

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

function storeKey(store) {
  return (store['店名'] || '') + '|' + (store['エリア'] || '');
}

function loadUrlHistory() {
  const fallback = {
    _comment: '出典URLの初回検出日を追跡する管理ファイル。pick_daily_trending5.js が自動更新するため手動編集不要。Editor が trending_stores.json / manual_stores.json の 出典URL[] に新URLを追記すると、ここに当日の日付で記録され、対象店舗の 検出日 が自動的に繰り上がる。',
    stores: {},
  };
  if (!fs.existsSync(URL_HISTORY_PATH)) return fallback;
  try {
    const h = JSON.parse(fs.readFileSync(URL_HISTORY_PATH, 'utf8'));
    if (!h.stores) h.stores = {};
    return h;
  } catch (e) {
    console.error(`url history 読み込み失敗: ${e.message}`);
    return fallback;
  }
}

// 出典URLの履歴を更新し、新URL分の最新日付を返す
// returns: { newestUrlDate: string|null, newUrls: number, knownUrls: number }
function syncStoreUrls(store, history, today) {
  const key = storeKey(store);
  const urls = (store['出典URL'] || []).filter(u => u && typeof u === 'string');
  if (!history.stores[key]) history.stores[key] = { urls: {} };
  const entry = history.stores[key];
  let newUrls = 0;
  for (const u of urls) {
    if (!entry.urls[u]) {
      entry.urls[u] = today;
      newUrls++;
    }
  }
  // 現在 出典URL[] にある URL の初回検出日 のうち最新を採用（削除されたURLは無視）
  const currentSet = new Set(urls);
  const dates = Object.entries(entry.urls)
    .filter(([u, d]) => currentSet.has(u))
    .map(([u, d]) => d)
    .filter(Boolean)
    .sort();
  const newestUrlDate = dates.length ? dates[dates.length - 1] : null;
  return { newestUrlDate, newUrls, knownUrls: urls.length };
}

// 検出日 を必要に応じて bump し、変更があれば true を返す
function maybeBumpDetectionDate(store, newestUrlDate) {
  if (!newestUrlDate) return false;
  const orig = store['検出日'] || '';
  if (newestUrlDate > orig) {
    store['検出日'] = newestUrlDate;
    return true;
  }
  return false;
}

// ソースファイル全体を返す（書き戻し用に元構造を保持）。
// URL履歴を更新し、必要に応じて 検出日 を bump する。
// returns: { trending, manual, urlHistory, trendingDirty, manualDirty, urlHistoryDirty, bumpedKeys[] }
function loadAndSyncSources(today) {
  const trending = loadJSON(TRENDING_PATH, { stores: [], candidates: [] });
  const manual = loadJSON(MANUAL_PATH, { stores: [] });
  const urlHistory = loadUrlHistory();
  let trendingDirty = false;
  let manualDirty = false;
  let urlHistoryDirty = false;
  const bumpedKeys = [];

  function processStore(store, dateField, onDirty) {
    const before = JSON.stringify(urlHistory.stores[storeKey(store)] || null);
    const { newestUrlDate, newUrls } = syncStoreUrls(store, urlHistory, today);
    const after = JSON.stringify(urlHistory.stores[storeKey(store)] || null);
    if (before !== after) urlHistoryDirty = true;
    if (newUrls > 0) {
      console.log(`  [URL履歴] ${storeKey(store)} に新URL ${newUrls}件を記録`);
    }
    if (maybeBumpDetectionDate(store, newestUrlDate)) {
      bumpedKeys.push(`${storeKey(store)} → ${store['検出日']}`);
      onDirty();
    }
  }

  for (const s of (trending.stores || [])) {
    processStore(s, '検出日', () => { trendingDirty = true; });
  }
  for (const s of (manual.stores || [])) {
    // manual_stores は「検出日」と「追加日」の両方を持ちうる。話題鮮度に使うのは「検出日」
    // 検出日フィールドが無ければ「追加日」をシードとして使い、新URL検出時に「検出日」を生やす
    if (!s['検出日'] && s['追加日']) s['検出日'] = s['追加日'];
    processStore(s, '検出日', () => { manualDirty = true; });
  }

  return { trending, manual, urlHistory, trendingDirty, manualDirty, urlHistoryDirty, bumpedKeys };
}

function buildCandidatesFromSynced(trending, manual, today) {
  const candidates = [];
  for (const s of (trending.stores || [])) {
    if (s['話題フラグ'] !== true) continue;
    if (s['有効期限'] && s['有効期限'] < today) continue;
    candidates.push({
      店名: s['店名'],
      エリア: s['エリア'] || '',
      ジャンル: s['ジャンル'] || '',
      検出日: s['検出日'] || '',
      情報源: s['トレンド情報源'] || [],
      出典URL: s['出典URL'] || [],
      話題スコア: parseInt(s['話題スコア']) || 0,
      編集部推薦: false,
      コメント: s['コメント'] || '',
      _source: 'trending',
    });
  }
  for (const s of (manual.stores || [])) {
    const hasBuzz = s['話題フラグ'] === true || s['編集部推薦'] === true;
    if (!hasBuzz) continue;
    if (s['有効期限'] && s['有効期限'] < today) continue;
    candidates.push({
      店名: s['店名'],
      エリア: s['エリア'] || '',
      ジャンル: s['ジャンル'] || '',
      検出日: s['検出日'] || s['追加日'] || '',
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

// スコア順を尊重しつつ、同一の粗ジャンルが MAX_PER_CATEGORY を超えないよう TOP_N 件を選ぶ。
// 候補のジャンル多様性が足りずキャップだけでは TOP_N に満たない場合は、残りをスコア順で補充する。
function selectDiverse(scored, n) {
  const selected = [];
  const catCount = {};
  for (const x of scored) {
    if (selected.length >= n) break;
    const cat = x.category || 'その他';
    if ((catCount[cat] || 0) >= MAX_PER_CATEGORY) continue;
    selected.push(x);
    catCount[cat] = (catCount[cat] || 0) + 1;
  }
  if (selected.length < n) {
    const chosen = new Set(selected);
    for (const x of scored) {
      if (selected.length >= n) break;
      if (chosen.has(x)) continue;
      selected.push(x);
      chosen.add(x);
    }
  }
  return selected;
}

function run({ write }) {
  const today = todayJST();

  // ステップ1: ソースファイルを読み URL履歴をシンクして 検出日 を自動bump
  console.log(`=== URL履歴シンク (today=${today}) ===`);
  const synced = loadAndSyncSources(today);
  if (synced.bumpedKeys.length) {
    console.log(`  検出日を ${synced.bumpedKeys.length} 件繰り上げ:`);
    for (const k of synced.bumpedKeys) console.log(`    ${k}`);
  } else {
    console.log('  検出日の繰り上げなし（新URLなし or 既に最新）');
  }

  // ステップ2: スコアリング
  const history = loadHistory(today);
  const recent = recentlyPickedNames(history);
  const candidates = buildCandidatesFromSynced(synced.trending, synced.manual, today);
  const scored = candidates.map(c => ({
    c,
    ...score(c, today, recent),
    category: coarseCategory(c),
    jitter: dailyJitter(c.店名, today),
  }));
  // スコア降順。同点はファイル順固定にせず、日替わりジッターでローテーションさせる。
  scored.sort((a, b) => (b.score - a.score) || (b.jitter - a.jitter));

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

  const top = selectDiverse(scored, TOP_N);
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
    if (synced.urlHistoryDirty) {
      fs.writeFileSync(URL_HISTORY_PATH, JSON.stringify(synced.urlHistory, null, 2) + '\n', 'utf8');
      console.log(`URL履歴書き出し: ${URL_HISTORY_PATH}`);
    }
    if (synced.trendingDirty) {
      fs.writeFileSync(TRENDING_PATH, JSON.stringify(synced.trending, null, 2) + '\n', 'utf8');
      console.log(`trending_stores.json 検出日を更新: ${TRENDING_PATH}`);
    }
    if (synced.manualDirty) {
      fs.writeFileSync(MANUAL_PATH, JSON.stringify(synced.manual, null, 2) + '\n', 'utf8');
      console.log(`manual_stores.json 検出日を更新: ${MANUAL_PATH}`);
    }
  } else {
    console.log('\n(dryrun: 書き出しスキップ)');
    if (synced.urlHistoryDirty) console.log(`  → URL履歴に変更あり (write モードで保存される)`);
    if (synced.trendingDirty) console.log(`  → trending_stores.json の 検出日 に変更あり (write モードで保存される)`);
    if (synced.manualDirty) console.log(`  → manual_stores.json の 検出日 に変更あり (write モードで保存される)`);
  }
}

const cmd = process.argv[2] || 'run';
if (cmd === 'run') run({ write: true });
else if (cmd === 'dryrun') run({ write: false });
else {
  console.error('Usage: node scripts/pick_daily_trending5.js [run|dryrun]');
  process.exit(1);
}
