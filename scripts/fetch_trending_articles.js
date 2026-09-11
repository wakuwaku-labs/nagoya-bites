'use strict';
/**
 * scripts/fetch_trending_articles.js
 *
 * Web記事から「名古屋の話題の飲食店」名を抽出し、data/trending_stores.json に追記するスクリプト。
 *
 * 本スクリプトは "半自動" 運用を前提とする:
 *   - 検索クエリ一覧を定義
 *   - 各クエリで候補URLを取得（本スクリプト内では実行せず、URL一覧を吐き出す）
 *   - URLを Claude Code / Claude の WebFetch に渡し、記事本文から店名を抽出させる
 *   - 人間が data/trending_stores.json を編集して 話題フラグ=true に昇格
 *
 * 理由: Web検索APIの種類・利用規約・有償の可否が環境依存のため、
 *       本スクリプトは "運用手順の定形化" と "抽出結果の入力UI" のみを提供する。
 *
 * 使い方:
 *   node scripts/fetch_trending_articles.js queries                          # 推奨検索クエリ一覧を表示
 *   node scripts/fetch_trending_articles.js suggest-queries <theme> [genre] [area]  # 直近1週間フィルタ付きの動的クエリ生成
 *   node scripts/fetch_trending_articles.js ingest <file>                    # file（1行1店名）を candidates に追記
 *   node scripts/fetch_trending_articles.js ingest-json <file>               # JSON配列で店名・出典URLを一括取り込み
 *   node scripts/fetch_trending_articles.js promote <name>                   # candidates[name] を stores に昇格し話題フラグ=true に
 *   node scripts/fetch_trending_articles.js auto-promote                     # 検出から3日経過 & 出典URL≥2件 & _auto:true の候補を自動昇格
 */

const fs = require('fs');
const path = require('path');
const { RECOMMENDED_QUERIES, QUERY_TEMPLATES, RECOMMENDED_SITES } = require('./lib/trending_queries');

const TRENDING_PATH = path.join(__dirname, '..', 'data', 'trending_stores.json');
const INDEX_PATH = path.join(__dirname, '..', 'index.html');

function loadTrending() {
  if (!fs.existsSync(TRENDING_PATH)) return { stores: [], candidates: [] };
  return JSON.parse(fs.readFileSync(TRENDING_PATH, 'utf8'));
}

function saveTrending(data) {
  fs.writeFileSync(TRENDING_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ISSUE-015-P2 第二段: data/stores.json を canonical として読込、無ければ index.html フォールバック
const { loadStores: _loadStoresShared } = require('./lib/load_stores');
function loadLocalStores() {
  return _loadStoresShared();
}

function cmdQueries() {
  console.log('=== 推奨検索クエリ（Claude Code の WebSearch に渡す） ===');
  RECOMMENDED_QUERIES.forEach((q) => console.log('  - ' + q));
  console.log('\n=== 推奨参照サイト（WebFetch で記事本文を取得） ===');
  RECOMMENDED_SITES.forEach((s) => console.log('  - ' + s));
  console.log('\n運用手順:');
  console.log('  1. Claude Code で上記クエリを WebSearch → 記事URL取得');
  console.log('  2. WebFetch で記事本文を取得 → 店名抽出（例: "栄の新店◯◯がメディア掲載"）');
  console.log('  3. 抽出した店名を 1行1店名のテキストファイル（例: /tmp/buzz.txt）に保存');
  console.log('  4. node scripts/fetch_trending_articles.js ingest /tmp/buzz.txt');
  console.log('  5. candidates に LOCAL_STORES と一致したものは自動で stores にコピーされる（_auto:true）');
  console.log('  6. 人間が data/trending_stores.json を開き、確認後 話題フラグ=true に変更');
}

function cmdIngest(file) {
  if (!file || !fs.existsSync(file)) {
    console.error('ファイルが見つかりません: ' + file);
    process.exit(1);
  }
  const lines = fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`取り込み対象: ${lines.length}件`);
  const localStores = loadLocalStores();
  const trending = loadTrending();
  const today = new Date().toISOString().slice(0, 10);
  const expireDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let matched = 0, candidates = 0;
  const existingStoreNames = new Set((trending.stores || []).map((s) => s['店名']));
  const existingCandNames = new Set((trending.candidates || []).map((c) => c['店名']).filter(Boolean));
  for (const name of lines) {
    const hit = localStores.find((s) => s['店名'].includes(name) || name.includes(s['店名']));
    if (hit) {
      if (existingStoreNames.has(hit['店名'])) continue;
      trending.stores = trending.stores || [];
      trending.stores.push({
        '店名': hit['店名'],
        'エリア': hit['エリア'],
        '話題フラグ': false,
        'トレンド情報源': ['メディア記事'],
        '出典URL': [],
        '話題スコア': 70,
        '検出日': today,
        '有効期限': expireDate,
        'コメント': 'メディア記事から抽出（人間レビュー待ち）',
        '_auto': true
      });
      existingStoreNames.add(hit['店名']);
      matched++;
    } else {
      if (existingCandNames.has(name)) continue;
      trending.candidates = trending.candidates || [];
      trending.candidates.push({
        '店名': name,
        'エリア': '',
        'ジャンル': '',
        'トレンド情報源': ['メディア記事'],
        '話題スコア': 70,
        '検出日': today,
        'コメント': 'LOCAL_STORES 未登録。Google Sheets への追加検討'
      });
      existingCandNames.add(name);
      candidates++;
    }
  }
  saveTrending(trending);
  console.log(`既存DBマッチ → stores に追加: ${matched}件（話題フラグ=false、人間レビュー待ち）`);
  console.log(`未登録店 → candidates に追加: ${candidates}件`);
}

function cmdPromote(name) {
  if (!name) {
    console.error('店名を指定してください');
    process.exit(1);
  }
  const trending = loadTrending();
  const target = (trending.stores || []).find((s) => s['店名'] === name);
  if (!target) {
    console.error('stores に該当店舗が見つかりません: ' + name);
    process.exit(1);
  }
  target['話題フラグ'] = true;
  delete target['_auto'];
  saveTrending(trending);
  console.log(`"${name}" を 話題フラグ=true に昇格しました。次の node build.js で反映されます。`);
}

function cmdSuggestQueries(theme, genre, area) {
  theme = theme || 'today_one';
  genre = genre || '';
  area = area || '';
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
  const dateFilter = 'after:' + sevenDaysAgo.toISOString().slice(0, 10);
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  // 季節判定（簡易）
  const m = month;
  const season = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
  const tpl = QUERY_TEMPLATES[theme] || QUERY_TEMPLATES.flexible;
  const queries = tpl.map(t => t
    .replace(/{genre}/g, genre)
    .replace(/{area}/g, area)
    .replace(/{date_filter}/g, dateFilter)
    .replace(/{month}/g, String(month))
    .replace(/{year}/g, String(year))
    .replace(/{season}/g, season)
    // 空変数の置換後の余分な空白を整理
    .replace(/\s+/g, ' ')
    .trim()
  );
  console.log(JSON.stringify({
    theme,
    genre,
    area,
    date_filter: dateFilter,
    month,
    year,
    season,
    queries
  }, null, 2));
}

function cmdIngestJSON(file) {
  if (!file || !fs.existsSync(file)) {
    console.error('ファイルが見つかりません: ' + file);
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(items)) {
    console.error('入力は配列である必要があります');
    process.exit(1);
  }
  const localStores = loadLocalStores();
  const trending = loadTrending();
  const today = new Date().toISOString().slice(0, 10);
  const expireDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let matched = 0, candidates = 0, updated = 0;
  const storesByName = new Map((trending.stores || []).map(s => [s['店名'], s]));
  const candByName = new Map((trending.candidates || []).map(c => [c['店名'], c]));
  trending.stores = trending.stores || [];
  trending.candidates = trending.candidates || [];
  for (const item of items) {
    const name = item['店名'];
    if (!name) continue;
    const sourceUrls = Array.isArray(item['出典URL']) ? item['出典URL'] : (item['出典URL'] ? [item['出典URL']] : []);
    const buzzScore = item['話題スコア'] || 70;
    const comment = item['コメント'] || 'メディア記事/SNSから抽出（人間レビュー待ち）';
    const hit = localStores.find(s => s['店名'].includes(name) || name.includes(s['店名']));
    if (hit) {
      const existing = storesByName.get(hit['店名']);
      if (existing) {
        // 出典URLを追記
        existing['出典URL'] = Array.from(new Set([...(existing['出典URL'] || []), ...sourceUrls]));
        if (buzzScore > (existing['話題スコア'] || 0)) existing['話題スコア'] = buzzScore;
        updated++;
      } else {
        const newEntry = {
          '店名': hit['店名'],
          'エリア': hit['エリア'] || item['エリア'] || '',
          '話題フラグ': false,
          'トレンド情報源': item['トレンド情報源'] || ['メディア記事', 'SNS'],
          '出典URL': sourceUrls,
          '話題スコア': buzzScore,
          '検出日': today,
          '有効期限': expireDate,
          'コメント': comment,
          '_auto': true
        };
        trending.stores.push(newEntry);
        storesByName.set(hit['店名'], newEntry);
        matched++;
      }
    } else {
      const existing = candByName.get(name);
      if (existing) {
        existing['出典URL'] = Array.from(new Set([...(existing['出典URL'] || []), ...sourceUrls]));
        if (buzzScore > (existing['話題スコア'] || 0)) existing['話題スコア'] = buzzScore;
        updated++;
      } else {
        const newCand = {
          '店名': name,
          'エリア': item['エリア'] || '',
          'ジャンル': item['ジャンル'] || '',
          'トレンド情報源': item['トレンド情報源'] || ['メディア記事', 'SNS'],
          '出典URL': sourceUrls,
          '話題スコア': buzzScore,
          '検出日': today,
          'コメント': comment + ' / LOCAL_STORES 未登録'
        };
        trending.candidates.push(newCand);
        candByName.set(name, newCand);
        candidates++;
      }
    }
  }
  saveTrending(trending);
  console.log(`既存DBマッチ → stores 追加: ${matched}件（_auto:true、人間レビュー待ち）`);
  console.log(`未登録店 → candidates 追加: ${candidates}件`);
  console.log(`既存レコード更新（出典URL追記）: ${updated}件`);
}

function cmdAutoPromote() {
  const trending = loadTrending();
  const today = new Date().toISOString().slice(0, 10);
  let promoted = 0, skipped = 0;
  (trending.stores || []).forEach(s => {
    if (!s['_auto']) return;
    if (s['話題フラグ']) return;
    const detectedDate = s['検出日'];
    if (!detectedDate) { skipped++; return; }
    const ms = new Date(today + 'T00:00:00+09:00') - new Date(detectedDate + 'T00:00:00+09:00');
    const days = ms / 86400000;
    const urlCount = (s['出典URL'] || []).length;
    if (days >= 3 && urlCount >= 2) {
      s['話題フラグ'] = true;
      delete s['_auto'];
      console.log(`昇格: "${s['店名']}" (検出${days.toFixed(0)}日前 / 出典${urlCount}件)`);
      promoted++;
    } else {
      skipped++;
    }
  });
  saveTrending(trending);
  console.log(`\n自動昇格: ${promoted}件 / 条件未達: ${skipped}件`);
}

const cmd = process.argv[2];
const arg = process.argv[3];
const arg2 = process.argv[4];
const arg3 = process.argv[5];
if (cmd === 'queries' || !cmd) cmdQueries();
else if (cmd === 'suggest-queries') cmdSuggestQueries(arg, arg2, arg3);
else if (cmd === 'ingest') cmdIngest(arg);
else if (cmd === 'ingest-json') cmdIngestJSON(arg);
else if (cmd === 'promote') cmdPromote(arg);
else if (cmd === 'auto-promote') cmdAutoPromote();
else {
  console.error('Unknown command: ' + cmd);
  console.error('Usage:');
  console.error('  node scripts/fetch_trending_articles.js queries');
  console.error('  node scripts/fetch_trending_articles.js suggest-queries <theme> [genre] [area]');
  console.error('  node scripts/fetch_trending_articles.js ingest <file>');
  console.error('  node scripts/fetch_trending_articles.js ingest-json <file>');
  console.error('  node scripts/fetch_trending_articles.js promote <name>');
  console.error('  node scripts/fetch_trending_articles.js auto-promote');
  process.exit(1);
}
