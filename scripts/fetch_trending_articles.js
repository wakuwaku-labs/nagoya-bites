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
 *   node scripts/fetch_trending_articles.js queries          # 推奨検索クエリ一覧を表示
 *   node scripts/fetch_trending_articles.js ingest <file>    # file（1行1店名）を candidates に追記
 *   node scripts/fetch_trending_articles.js promote <name>   # candidates[name] を stores に昇格し話題フラグ=true に
 */

const fs = require('fs');
const path = require('path');

const TRENDING_PATH = path.join(__dirname, '..', 'data', 'trending_stores.json');
const INDEX_PATH = path.join(__dirname, '..', 'index.html');

// 「第三者メディア」＝食べログでも我々でもない、中立な第三の媒体。
// 食べログ本体を直接スクレイピングせず、第三者メディアが食べログを「引用している」記事から店名を拾う。
const RECOMMENDED_QUERIES = [
  // === 一般トレンド ===
  '名古屋 話題 飲食店 2026',
  '名古屋 新店 オープン',
  '名古屋 行列ができる店',
  '名古屋 予約 取れない',
  '名古屋 トレンド レストラン',
  '栄 話題の店',
  '名駅 新店 2026',

  // === 食べログ言及系（第三者記事内の引用） ===
  '名古屋 食べログ ランキング 2026',
  '名古屋 食べログ 百名店',
  '栄 食べログ 高評価',
  '名駅 食べログ 人気',

  // === グルメ雑誌・レビュー系 ===
  '名古屋 雑誌 掲載 レストラン',
  '名古屋 dressing 特集',
  '名古屋 マカロニ グルメ',
  '名古屋 ヒトサラ おすすめ',
  '名古屋 OZmall 特集',

  // === 名古屋ローカルメディア ===
  '名古屋 ナゴレコ 新店',
  'サブロー 名古屋 グルメ',
  '名古屋ジャーニー 特集',

  // === TV番組系 ===
  '東海テレビ グルメ 名古屋',
  'CBC 名古屋 紹介',
  'メ〜テレ 飲食店',
  'ケンミンショー 名古屋',

  // === 観光・まとめ系 ===
  '名古屋 retrip 人気',
  '名古屋 icotto おすすめ',
  '名古屋 MATCHA 訪日',
  '名古屋 tabi-labo グルメ',

  // === SNS話題系 ===
  '名古屋 Twitter バズった 飲食店',
  '名古屋 TikTok 話題',
  '名古屋 インスタ映え カフェ',

  // === ニュース・PR系 ===
  'PR TIMES 名古屋 レストラン オープン',
  '名古屋 オープン ニュース',

  // === シーン別 ===
  '名古屋 デート レストラン 雑誌',
  '名古屋 接待 おすすめ 特集'
];

const RECOMMENDED_SITES = [
  // グルメ雑誌・レビュー系
  'https://dressing.media/search?q=%E5%90%8D%E5%8F%A4%E5%B1%8B',
  'https://macaro-ni.jp/search?q=%E5%90%8D%E5%8F%A4%E5%B1%8B',
  'https://www.hitosara.com/search/?area=nagoya',
  'https://www.ozmall.co.jp/restaurant/nagoya/',

  // トレンド紹介系
  'https://retrip.jp/articles/search/?query=%E5%90%8D%E5%8F%A4%E5%B1%8B',
  'https://icotto.jp/search?q=%E5%90%8D%E5%8F%A4%E5%B1%8B',
  'https://matcha-jp.com/jp/search?q=%E5%90%8D%E5%8F%A4%E5%B1%8B',

  // ニュース・PR系
  'https://prtimes.jp/search?search_type=1&search_word=%E5%90%8D%E5%8F%A4%E5%B1%8B+%E9%A3%B2%E9%A3%9F',
  'https://news.livedoor.com/topics/keyword/?k=%E5%90%8D%E5%8F%A4%E5%B1%8B+%E3%82%B0%E3%83%AB%E3%83%A1',

  // TV番組公式
  'https://hicbc.com/gourmet/',

  // 観光協会系
  'https://www.nagoya-info.jp/eat/',

  // ブログ・note
  'https://note.com/search?context=note&q=%E5%90%8D%E5%8F%A4%E5%B1%8B+%E3%82%B0%E3%83%AB%E3%83%A1'
];

function loadTrending() {
  if (!fs.existsSync(TRENDING_PATH)) return { stores: [], candidates: [] };
  return JSON.parse(fs.readFileSync(TRENDING_PATH, 'utf8'));
}

function saveTrending(data) {
  fs.writeFileSync(TRENDING_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function loadLocalStores() {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('LOCAL_STORES not found');
  return JSON.parse(m[1]);
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

const cmd = process.argv[2];
const arg = process.argv[3];
if (cmd === 'queries' || !cmd) cmdQueries();
else if (cmd === 'ingest') cmdIngest(arg);
else if (cmd === 'promote') cmdPromote(arg);
else {
  console.error('Unknown command: ' + cmd);
  console.error('Usage: node scripts/fetch_trending_articles.js [queries|ingest <file>|promote <name>]');
  process.exit(1);
}
