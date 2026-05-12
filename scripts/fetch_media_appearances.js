#!/usr/bin/env node
/**
 * fetch_media_appearances.js
 *
 * 動作確認済みの RSS フィードから店舗掲載情報を収集し
 * data/media_appearances.json にキャッシュする（S4 他媒体掲載クロスチェック用）。
 *
 * 採用ソース（動作検証済み）:
 *   - note.com ハッシュタグ RSS（#名古屋グルメ等 10 タグ）
 *     → 記事タイトルに店名が直接入るため店名マッチング精度が高い
 *   - Google News RSS（名古屋グルメ関連クエリ 5 種）
 *     → 媒体名を自動抽出し、複数メディアをそれぞれ 1 カウント
 *
 * 除外したソース（動作不可確認済み）:
 *   - nagoreco.com, otona-nagoya.com: ドメイン未解決 or プレースホルダー
 *   - kelly-net.jp, macaro-ni.jp, dressing.media, retrip.jp: React SPA / 403 / 404
 *   - 各サイトサイトマップ: URL スラグが英数字のため日本語店名マッチング不可
 *
 * 制約: npm 依存ゼロ / スクレイピングなし / TOS 違反なし
 *
 * 使い方:
 *   node scripts/fetch_media_appearances.js           # RSS 取得・差分更新（推奨）
 *   node scripts/fetch_media_appearances.js --force   # キャッシュ全破棄して再取得
 *   node scripts/fetch_media_appearances.js --dry-run # 統計のみ（ファイル更新なし）
 *   node scripts/fetch_media_appearances.js --store J000729743  # 1 店のマッチング確認
 *   node scripts/fetch_media_appearances.js --delay 400         # レート制御 ms（既定 300）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'media_appearances.json');
const INDEX_HTML = path.join(ROOT, 'index.html');

const MIN_NAME_LEN = 3;

// Google News 経由で引っかかることがあるリスティングプラットフォーム
// これらは店舗自身が登録するため「第三者メディア掲載」とは見なさない
const BLOCKED_SOURCES = new Set([
  'ホットペッパーグルメ', 'ホットペッパー', 'Hot Pepper',
  '食べログ', 'Tabelog',
  'ぐるなび', 'Gurunavi',
  'Retty', 'レティ',
  'Yelp', 'Google マップ', 'TripAdvisor',
  'じゃらん', 'Yahoo!ロコ',
]);

/**
 * フィード設定
 *   name:          mediaFeatures に格納する媒体名
 *                  note.com 系は全て "note" に統一（S4 は媒体数カウントのため同一ソースは1カウント）
 *   rssUrl:        RSS フィード URL（動作確認済みのみ）
 *   extractSource: true = Google News 形式「タイトル - 媒体名」から媒体名を自動抽出して name を上書き
 */
const MEDIA_FEEDS = [
  // ─── note.com ハッシュタグ RSS（動作確認済み）────────────────────────────────
  // 記事タイトルに店名が直接入るためマッチング精度が高い
  // 全タグを "note" で統一 → 複数タグに同じ店が出現しても S4 は 1 カウント
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋グルメ/rss'  },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋飯/rss'      },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋めし/rss'    },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋ランチ/rss'  },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋ディナー/rss'},
  { name: 'note', rssUrl: 'https://note.com/hashtag/愛知グルメ/rss'    },
  { name: 'note', rssUrl: 'https://note.com/hashtag/栄グルメ/rss'      },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名駅グルメ/rss'    },
  { name: 'note', rssUrl: 'https://note.com/hashtag/大須グルメ/rss'    },
  { name: 'note', rssUrl: 'https://note.com/hashtag/金山グルメ/rss'    },

  // ─── Google News RSS（動作確認済み）──────────────────────────────────────────
  // タイトル末尾「 - 媒体名」から発行元を自動抽出 → 媒体ごとに 1 カウント
  { name: '_gnews', rssUrl: 'https://news.google.com/rss/search?q=名古屋+グルメ+話題&hl=ja&gl=JP&ceid=JP:ja',             extractSource: true },
  { name: '_gnews', rssUrl: 'https://news.google.com/rss/search?q=名古屋+新店+レストラン&hl=ja&gl=JP&ceid=JP:ja',          extractSource: true },
  { name: '_gnews', rssUrl: 'https://news.google.com/rss/search?q=名古屋+おすすめ+グルメ+ランキング&hl=ja&gl=JP&ceid=JP:ja', extractSource: true },
  { name: '_gnews', rssUrl: 'https://news.google.com/rss/search?q=名古屋+ミシュラン+食べログ&hl=ja&gl=JP&ceid=JP:ja',       extractSource: true },
  { name: '_gnews', rssUrl: 'https://news.google.com/rss/search?q=名古屋+グルメ+テレビ&hl=ja&gl=JP&ceid=JP:ja',            extractSource: true },
];

// ─── CLI ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = { force: false, dryRun: false, store: null, delayMs: 300 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--force') opts.force = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
  else if (a === '--mode') {
    const m = args[++i];
    if (m !== 'rss') console.warn(`[INFO] --mode ${m} は現バージョンでは rss と同じ動作をします`);
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// HTTP GET（リダイレクト最大 3 段まで追従）
function fetchText(url, depth = 0) {
  if (depth > 3) return Promise.reject(new Error(`リダイレクト上限: ${url}`));
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'NAGOYA-BITES-Bot/1.0 (+https://nagoya-bites.com/)',
        'Accept': 'application/rss+xml, application/atom+xml, text/xml, */*'
      }
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        const loc = res.headers['location'];
        res.resume();
        return loc ? resolve(fetchText(loc, depth + 1)) : reject(new Error(`リダイレクト先不明: ${url}`));
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error(`タイムアウト: ${url}`)); });
  });
}

// RSS 2.0 / Atom 1.0 パーサ（npm 依存なし）
function parseRssItems(xml) {
  const items = [];
  const blocks = (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [])
    .concat(xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || []);
  for (const block of blocks) {
    const getField = tag => {
      const cdata = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i'));
      if (cdata) return cdata[1].trim();
      const plain = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
      return plain ? plain[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : '';
    };
    const title = getField('title');
    let link = getField('link');
    if (!link) {
      const href = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (href) link = href[1];
    }
    if (!link) {
      const bare = block.match(/<link>\s*(https?:\/\/[^\s<]+)/i);
      if (bare) link = bare[1];
    }
    const pubDate = getField('pubDate') || getField('published') || getField('updated') || getField('dc:date');
    let year = new Date().getFullYear();
    if (pubDate) {
      const p = new Date(pubDate).getFullYear();
      if (!isNaN(p) && p >= 2010 && p <= 2040) year = p;
    }
    if (title && link) items.push({ title, link, year });
  }
  return items;
}

// Google News タイトルから媒体名を抽出: "記事タイトル - 媒体名" の「媒体名」部分
function extractSourceFromGNewsTitle(title) {
  const m = title.match(/\s[-–]\s([^-–]{3,30})\s*$/);
  return m ? m[1].trim() : null;
}

function loadStoresFromIndex() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const match = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!match) throw new Error('LOCAL_STORES not found in index.html');
  return JSON.parse(match[1]);
}

function storeKey(s) {
  return s['ホットペッパーID'] || `_manual_${s['店名']}_${s['エリア'] || ''}`;
}

async function main() {
  const allStores = loadStoresFromIndex();
  console.log(`LOCAL_STORES: ${allStores.length}件`);

  const targetStores = opts.store
    ? allStores.filter(s => s['ホットペッパーID'] === opts.store || s['店名'] === opts.store)
    : allStores;
  if (opts.store && targetStores.length === 0) {
    console.error(`--store "${opts.store}" に一致する店舗が見つかりません`);
    process.exit(1);
  }

  // 店名 → キー のマップ（3 文字未満はノイズになるため除外）
  const nameToKey = new Map();
  for (const s of targetStores) {
    const name = (s['店名'] || '').trim();
    if (name.length < MIN_NAME_LEN) continue;
    if (!nameToKey.has(name)) nameToKey.set(name, storeKey(s));
  }
  console.log(`マッチング対象店名: ${nameToKey.size}件（${MIN_NAME_LEN}文字以上）`);

  // 既存キャッシュ読み込み
  let cache = {};
  if (fs.existsSync(CACHE_PATH) && !opts.force) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
      const n = Object.keys(cache).filter(k => k !== '_meta').length;
      console.log(`既存キャッシュ: ${n}店舗分（--force で全破棄）`);
    } catch (e) {
      console.warn(`既存キャッシュ読み込み失敗: ${e.message} — 新規作成`);
      cache = {};
    }
  }

  if (opts.dryRun) {
    const entries = Object.entries(cache).filter(([k]) => k !== '_meta');
    console.log(`\n=== dry-run: 既存キャッシュ統計 ===`);
    console.log(`掲載情報あり店舗数: ${entries.length}`);
    for (const [k, v] of entries) {
      const mediaNames = Array.isArray(v) ? [...new Set(v.map(a => a.name))].join(', ') : '?';
      console.log(`  ${k}: [${mediaNames}]（${Array.isArray(v) ? v.length : 0}件）`);
    }
    return;
  }

  let totalScanned = 0, totalNewMatches = 0;
  const feedsOk = [], feedsFailed = [];

  for (const feed of MEDIA_FEEDS) {
    console.log(`\n取得中: ${feed.name} — ${feed.rssUrl.slice(0, 80)}`);
    let xml;
    try {
      xml = await fetchText(feed.rssUrl);
    } catch (e) {
      console.warn(`  [SKIP] ${e.message}`);
      feedsFailed.push(feed.name === '_gnews' ? 'Google News' : feed.name);
      await sleep(opts.delayMs);
      continue;
    }

    const items = parseRssItems(xml);
    console.log(`  記事数: ${items.length}`);
    if (items.length === 0) {
      console.warn(`  [WARN] 記事 0 件 — RSS 形式の変化の可能性`);
      feedsFailed.push(feed.name === '_gnews' ? 'Google News' : feed.name);
      await sleep(opts.delayMs);
      continue;
    }

    let feedNew = 0;
    for (const item of items) {
      totalScanned++;

      // Google News の場合、タイトルから媒体名を抽出
      let mediaName = feed.name;
      if (feed.extractSource) {
        const source = extractSourceFromGNewsTitle(item.title);
        if (!source) continue; // 媒体名抽出できない記事はスキップ
        if (BLOCKED_SOURCES.has(source)) continue; // リスティングプラットフォームは除外
        mediaName = source;
      }

      for (const [storeName, key] of nameToKey) {
        if (!item.title.includes(storeName)) continue;

        if (!Array.isArray(cache[key])) cache[key] = [];
        // 同一 URL の重複除去
        if (cache[key].some(a => a.url === item.link)) continue;

        cache[key].push({
          name: mediaName,
          url: item.link,
          title: item.title.slice(0, 100),
          year: item.year
        });
        feedNew++;
        totalNewMatches++;

        if (opts.store) {
          console.log(`  ✓ "${storeName}" → "${item.title.slice(0, 60)}"`);
          console.log(`    媒体: ${mediaName} / URL: ${item.link}`);
        }
      }
    }
    console.log(`  新規マッチ: ${feedNew}件`);
    feedsOk.push(feed.name === '_gnews' ? 'Google News' : feed.name);
    await sleep(opts.delayMs);
  }

  // メタ情報
  const storeCount = Object.keys(cache).filter(k => k !== '_meta').length;
  cache['_meta'] = {
    lastFetchedAt: new Date().toISOString(),
    feedsOk: [...new Set(feedsOk)],
    feedsFailed: [...new Set(feedsFailed)],
    articlesScanned: totalScanned,
    newMatchesThisRun: totalNewMatches,
    totalStoresWithAppearances: storeCount
  };

  console.log(`\n=== 完了 ===`);
  console.log(`成功ソース: ${[...new Set(feedsOk)].join(', ')}`);
  if (feedsFailed.length) console.log(`失敗: ${[...new Set(feedsFailed)].join(', ')}`);
  console.log(`記事スキャン: ${totalScanned}件 / 新規マッチ: ${totalNewMatches}件`);
  console.log(`掲載情報あり店舗数（累積）: ${storeCount}件`);

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`キャッシュ書き込み: ${CACHE_PATH}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
