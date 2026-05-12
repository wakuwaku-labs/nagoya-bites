#!/usr/bin/env node
/**
 * fetch_media_appearances.js
 *
 * 名古屋グルメ系 RSS フィードを取得し、記事タイトルに店舗名が出現するかを検出して
 * data/media_appearances.json にキャッシュする（S4 他媒体掲載クロスチェック用）。
 *
 * 手法:
 *   - 各メディアの公開 RSS フィードを一度だけ取得（ページスクレイピングなし・TOS 違反なし）
 *   - 記事タイトルに LOCAL_STORES の店名が出現するかを突き合わせ（逆引き方式）
 *   - HP ID をキーに掲載情報を蓄積（新記事は追記、既存 URL は重複除去）
 *
 * 制約:
 *   - npm 依存ゼロ（標準 https/http モジュールのみ）
 *   - 食べログ・Retty・ぐるなびの本文スクレイピングは行わない（TOS リスク回避）
 *
 * コスト: 無料（RSS は公開フィード）
 * リクエスト数: フィード数（約10件）のみ。店舗数に比例しない。
 *
 * 使い方:
 *   node scripts/fetch_media_appearances.js           # 全フィード取得・差分更新
 *   node scripts/fetch_media_appearances.js --force   # キャッシュ全破棄して再取得
 *   node scripts/fetch_media_appearances.js --dry-run # 統計のみ表示（ファイル更新なし）
 *   node scripts/fetch_media_appearances.js --store J000729743  # 1店のマッチング確認
 *   node scripts/fetch_media_appearances.js --delay 500  # レート制御（ms、既定 300）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'media_appearances.json');
const INDEX_HTML = path.join(ROOT, 'index.html');

// 最小店名文字数（短すぎる名前はノイズになるため）
const MIN_NAME_LEN = 3;

// 名古屋関連キーワード（nagoyaOnly フィードの記事フィルタ用）
const NAGOYA_KEYWORDS = [
  '名古屋', '栄', '名駅', '大須', '覚王山', '今池', '千種', '東山',
  '八事', '金山', '熱田', '港区', '中川区', '中区', '西区', '南区', '守山区',
  '天白区', '名東区', '北区', '東区', '瑞穂区', '昭和区', '緑区'
];

/**
 * 取得対象の RSS フィード一覧
 *
 * name: build.js の mediaFeatures に格納される媒体名（日本語表記推奨）
 * url:  RSS/Atom フィードの URL（404 や接続エラーは warn で継続）
 * nagoyaOnly: true の場合、NAGOYA_KEYWORDS を含まない記事タイトルはスキップ
 */
const MEDIA_FEEDS = [
  // ─── 名古屋ローカルグルメメディア ────────────────────────────
  { name: 'ナゴレコ',          url: 'https://nagoreco.com/feed/',             nagoyaOnly: false },
  { name: 'WEB大人の名古屋',   url: 'https://otona-nagoya.com/feed/',          nagoyaOnly: false },
  { name: '日刊KELLY',         url: 'https://kelly-net.jp/gourmet/feed/',      nagoyaOnly: false },
  { name: '名古屋観光情報',    url: 'https://www.nagoya-info.jp/rss.xml',      nagoyaOnly: false },

  // ─── 全国グルメメディア（名古屋記事を含む） ─────────────────
  { name: 'dancyu',            url: 'https://dancyu.jp/feed',                  nagoyaOnly: true  },
  { name: 'dressing',          url: 'https://dressing.media/feed/',             nagoyaOnly: true  },
  { name: 'マカロニ',          url: 'https://macaro-ni.jp/feed',               nagoyaOnly: true  },
  { name: 'ReTRIP',            url: 'https://retrip.jp/articles/feed/',         nagoyaOnly: true  },
  { name: 'TABI LABO',         url: 'https://tabi-labo.com/feed',               nagoyaOnly: true  },
  { name: 'icotto',            url: 'https://icotto.jp/feed',                   nagoyaOnly: true  },
  { name: 'ヒトサラ',          url: 'https://hitosara.com/feed.xml',            nagoyaOnly: true  },

  // ─── プレスリリース（レストランオープン・周年情報） ──────────
  { name: 'PR TIMES',          url: 'https://prtimes.jp/topics/restaurants/rss.xml', nagoyaOnly: true },
];

// ─── CLI ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = { force: false, dryRun: false, store: null, delayMs: 300 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--force') opts.force = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// HTTP/HTTPS GET でテキストを取得（リダイレクト 1 段まで追従）
function fetchText(url, redirectDepth = 0) {
  if (redirectDepth > 3) return Promise.reject(new Error(`リダイレクト上限: ${url}`));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'NAGOYA-BITES-Bot/1.0 (+https://nagoya-bites.com/)',
        'Accept': 'application/rss+xml, application/atom+xml, text/xml, */*'
      }
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const location = res.headers['location'];
        res.resume();
        if (location) return resolve(fetchText(location, redirectDepth + 1));
        return reject(new Error(`リダイレクト先不明: ${url}`));
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error(`タイムアウト: ${url}`)); });
  });
}

// RSS 2.0 / Atom 1.0 XML からアイテムを抽出（npm 依存なし・正規表現のみ）
function parseRssItems(xml) {
  const items = [];
  // RSS 2.0 <item> と Atom 1.0 <entry>
  const blocks = (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [])
    .concat(xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || []);

  for (const block of blocks) {
    // CDATA 対応テキスト抽出
    const getField = (tag) => {
      const cdata = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i'));
      if (cdata) return cdata[1].trim();
      const plain = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
      return plain ? plain[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : '';
    };

    const title = getField('title');
    let link = getField('link');
    // Atom: <link href="...">
    if (!link) {
      const href = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (href) link = href[1];
    }
    // RSS: <link> は </link> なしで <guid> の前に出ることがある
    if (!link) {
      const bare = block.match(/<link>\s*(https?:\/\/[^\s<]+)\s*/i);
      if (bare) link = bare[1];
    }

    const pubDate = getField('pubDate') || getField('published') || getField('updated') || getField('dc:date');
    let year = new Date().getFullYear();
    if (pubDate) {
      const parsed = new Date(pubDate).getFullYear();
      if (!isNaN(parsed) && parsed >= 2015 && parsed <= 2035) year = parsed;
    }

    if (title && link) items.push({ title, link, year });
  }
  return items;
}

function loadStoresFromIndex() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const match = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!match) throw new Error('LOCAL_STORES not found in index.html');
  return JSON.parse(match[1]);
}

function isNagoyaRelated(title) {
  return NAGOYA_KEYWORDS.some(kw => title.includes(kw));
}

// HP ID がある店: HP ID をキーに
// 手動キュレーション店（HP ID なし）: "_manual_{店名}_{エリア}" をキーに
function storeKey(s) {
  return s['ホットペッパーID'] || `_manual_${s['店名']}_${s['エリア'] || ''}`;
}

async function main() {
  const allStores = loadStoresFromIndex();
  console.log(`LOCAL_STORES: ${allStores.length}件`);

  // --store オプション: 特定店舗のみ対象にしてデバッグ
  const targetStores = opts.store
    ? allStores.filter(s => s['ホットペッパーID'] === opts.store || s['店名'] === opts.store)
    : allStores;
  if (opts.store && targetStores.length === 0) {
    console.error(`--store "${opts.store}" に一致する店舗が見つかりません`);
    process.exit(1);
  }

  // 店名 → キー のマップ（同じ店名が複数エリアにある場合を考慮して先勝ち）
  // 短すぎる名前（MIN_NAME_LEN 未満）はノイズになるため除外
  const nameToKey = new Map(); // storeName → storeKey
  for (const s of targetStores) {
    const name = (s['店名'] || '').trim();
    if (name.length < MIN_NAME_LEN) continue;
    if (!nameToKey.has(name)) nameToKey.set(name, storeKey(s));
  }
  console.log(`マッチング対象店名: ${nameToKey.size}件（${MIN_NAME_LEN}文字以上）`);

  // 既存キャッシュを読み込み
  let cache = {};
  if (fs.existsSync(CACHE_PATH) && !opts.force) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
      const entryCount = Object.keys(cache).filter(k => k !== '_meta').length;
      console.log(`既存キャッシュ: ${entryCount}店舗分の掲載情報を保持（--force で全破棄）`);
    } catch (e) {
      console.warn(`既存キャッシュ読み込み失敗: ${e.message} — 新規作成します`);
      cache = {};
    }
  }

  // --dry-run: 統計だけ表示してファイル更新しない
  if (opts.dryRun) {
    const entries = Object.entries(cache).filter(([k]) => k !== '_meta');
    console.log(`\n=== dry-run: 既存キャッシュ統計 ===`);
    console.log(`掲載情報あり店舗数: ${entries.length}`);
    for (const [k, v] of entries) {
      const mediaNames = Array.isArray(v) ? v.map(a => a.name).join(', ') : '?';
      console.log(`  ${k}: [${mediaNames}]`);
    }
    return;
  }

  let totalArticles = 0, totalNewMatches = 0;
  const feedsSucceeded = [], feedsFailed = [];

  for (const feed of MEDIA_FEEDS) {
    console.log(`\n取得中: ${feed.name} — ${feed.url}`);
    let xml;
    try {
      xml = await fetchText(feed.url);
    } catch (e) {
      console.warn(`  [SKIP] ${e.message}`);
      feedsFailed.push(feed.name);
      await sleep(opts.delayMs);
      continue;
    }

    const items = parseRssItems(xml);
    console.log(`  記事数: ${items.length}`);
    if (items.length === 0) {
      console.warn(`  [WARN] 記事が 0 件 — XML 解析失敗の可能性`);
      feedsFailed.push(feed.name);
      await sleep(opts.delayMs);
      continue;
    }

    let feedNewMatches = 0;
    for (const item of items) {
      totalArticles++;
      // nagoyaOnly フィードは名古屋関連記事のみ処理
      if (feed.nagoyaOnly && !isNagoyaRelated(item.title)) continue;

      for (const [storeName, key] of nameToKey) {
        if (!item.title.includes(storeName)) continue;

        // マッチ — 掲載情報をキャッシュに追記
        if (!Array.isArray(cache[key])) cache[key] = [];
        const alreadyHas = cache[key].some(a => a.url === item.link);
        if (alreadyHas) continue;

        cache[key].push({
          name: feed.name,
          url: item.link,
          title: item.title.slice(0, 100),
          year: item.year
        });
        feedNewMatches++;
        totalNewMatches++;

        if (opts.store) {
          console.log(`  ✓ "${storeName}" が "${item.title.slice(0, 60)}" に出現`);
          console.log(`    URL: ${item.link} (${item.year})`);
        }
      }
    }
    console.log(`  新規マッチ: ${feedNewMatches}件`);
    feedsSucceeded.push(feed.name);
    await sleep(opts.delayMs);
  }

  // メタ情報を更新（_meta キーは build.js でマージ時に除外する）
  cache['_meta'] = {
    lastFetchedAt: new Date().toISOString(),
    feedsSucceeded,
    feedsFailed,
    articlesScanned: totalArticles,
    newMatchesThisRun: totalNewMatches,
    totalStoresWithAppearances: Object.keys(cache).filter(k => k !== '_meta').length
  };

  const storeCount = cache['_meta'].totalStoresWithAppearances;
  console.log(`\n=== 完了 ===`);
  console.log(`成功フィード: ${feedsSucceeded.length}件 / 失敗: ${feedsFailed.length}件`);
  if (feedsFailed.length) console.log(`  失敗: ${feedsFailed.join(', ')}`);
  console.log(`記事スキャン: ${totalArticles}件 / 新規マッチ: ${totalNewMatches}件`);
  console.log(`掲載情報あり店舗数（累積）: ${storeCount}件`);
  console.log(`キャッシュ書き込み: ${CACHE_PATH}`);

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

main().catch(e => { console.error(e.message); process.exit(1); });
