#!/usr/bin/env node
/**
 * fetch_media_appearances.js
 *
 * 動作確認済みの RSS フィードから店舗掲載情報を収集し
 * data/media_appearances.json にキャッシュする（S4 他媒体掲載クロスチェック用）。
 *
 * 採用ソース（動作検証済み）:
 *   - note.com ハッシュタグ RSS（25 タグ: エリア別 + ジャンル別 + シーン別）
 *   - Google News RSS（20 クエリ: エリア×ジャンル別）
 *
 * マッチング方式:
 *   - タイトル（title）と記事要約（description 先頭 600 文字）の両方を照合
 *   - タイトルマッチ: 店名 3 文字以上
 *   - 説明文マッチ: 店名 4 文字以上（false positive 抑制）
 *   → まとめ記事（「名古屋のおすすめ 5 選」等）でも description に個別店名が出るため
 *     タイトルのみより 3〜5 倍のカバレッジが見込める
 *
 * 制約: npm 依存ゼロ / スクレイピングなし / TOS 違反なし / 全ソース無料
 *
 * 使い方:
 *   node scripts/fetch_media_appearances.js           # RSS 取得・差分更新
 *   node scripts/fetch_media_appearances.js --force   # キャッシュ全破棄して再取得
 *   node scripts/fetch_media_appearances.js --dry-run # 統計のみ（ファイル更新なし）
 *   node scripts/fetch_media_appearances.js --store J000729743  # 1 店のマッチング確認
 *   node scripts/fetch_media_appearances.js --delay 400         # レート制御 ms（既定 250）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'media_appearances.json');
const INDEX_HTML = path.join(ROOT, 'index.html');

// タイトルマッチの最小店名文字数
const MIN_NAME_TITLE = 3;
// 説明文マッチの最小店名文字数（false positive 抑制のため長め）
const MIN_NAME_DESC = 4;
// 説明文は先頭 N 文字のみ参照（長い本文が入るケース対策）
const DESC_MAX = 600;

// リスティングプラットフォーム除外リスト（店舗自己登録のため第三者メディア掲載と見なさない）
const BLOCKED_SOURCES = new Set([
  'ホットペッパーグルメ', 'ホットペッパー', 'Hot Pepper',
  '食べログ', 'Tabelog', '食べログニュース',
  'ぐるなび', 'Gurunavi',
  'Retty', 'レティ',
  'Yelp', 'Google マップ', 'TripAdvisor',
  'じゃらん', 'Yahoo!ロコ', 'NAVITIME',
]);

// URL ドメインベースの除外リスト（Hatena RSS の extractSourceFromUrl 用）
const BLOCKED_DOMAINS = new Set([
  'hotpepper.jp', 'tabelog.com', 'gnavi.co.jp', 'retty.me',
  'yelp.com', 'tripadvisor.jp', 'jalan.net', 'navitime.co.jp',
  'b.hatena.ne.jp', 'maps.google.com', 'google.com',
  'google.co.jp', 'yahoo.co.jp',
]);

// Google News ベース URL
const GN = (q) => `https://news.google.com/rss/search?hl=ja&gl=JP&ceid=JP:ja&q=${encodeURIComponent(q)}`;
// はてなブックマーク検索 RSS ベース URL（スペースは + に変換、日本語はそのまま）
const HB = (q) => `https://b.hatena.ne.jp/q/${q.replace(/ /g, '+')}?mode=rss`;

/**
 * フィード設定
 *   name:                mediaFeatures に格納する媒体名
 *                        note 系は全て "note" に統一（S4 は distinct 媒体名カウント）
 *   rssUrl:              RSS フィード URL
 *   extractSource:       Google News 形式「タイトル - 媒体名」から媒体名を自動抽出
 *   extractSourceFromUrl: item.link URL のドメインを媒体名として使用（Hatena 用）
 */
const MEDIA_FEEDS = [
  // ════════════════════════════════════════════════════════════════════════
  // note.com ハッシュタグ RSS（25 タグ）
  // ════════════════════════════════════════════════════════════════════════

  // エリア別
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋グルメ/rss'      },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋飯/rss'          },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋めし/rss'        },
  { name: 'note', rssUrl: 'https://note.com/hashtag/愛知グルメ/rss'        },
  { name: 'note', rssUrl: 'https://note.com/hashtag/栄グルメ/rss'          },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名駅グルメ/rss'        },
  { name: 'note', rssUrl: 'https://note.com/hashtag/大須グルメ/rss'        },
  { name: 'note', rssUrl: 'https://note.com/hashtag/金山グルメ/rss'        },
  { name: 'note', rssUrl: 'https://note.com/hashtag/覚王山グルメ/rss'      },
  { name: 'note', rssUrl: 'https://note.com/hashtag/今池グルメ/rss'        },
  { name: 'note', rssUrl: 'https://note.com/hashtag/千種グルメ/rss'        },

  // シーン別
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋ランチ/rss'      },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋ディナー/rss'    },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋ランチ巡り/rss'  },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋グルメ巡り/rss'  },

  // ジャンル別
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋ラーメン/rss'    },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋焼肉/rss'        },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋カフェ/rss'      },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋居酒屋/rss'      },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋寿司/rss'        },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋イタリアン/rss'  },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋焼き鳥/rss'      },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋中華/rss'        },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋スイーツ/rss'    },
  { name: 'note', rssUrl: 'https://note.com/hashtag/名古屋記録/rss'        },

  // ════════════════════════════════════════════════════════════════════════
  // Google News RSS（20 クエリ）
  // ════════════════════════════════════════════════════════════════════════

  // 一般トレンド
  { name: '_gnews', rssUrl: GN('名古屋 グルメ 話題'),                    extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 新店 レストラン'),                extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 おすすめ グルメ ランキング'),     extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 グルメ テレビ'),                  extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 ミシュラン 食べログ'),            extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 グルメ オープン'),                extractSource: true },

  // エリア別新店
  { name: '_gnews', rssUrl: GN('栄 グルメ 新店 名古屋'),                 extractSource: true },
  { name: '_gnews', rssUrl: GN('名駅 グルメ 新店 名古屋'),               extractSource: true },
  { name: '_gnews', rssUrl: GN('覚王山 グルメ 名古屋'),                  extractSource: true },
  { name: '_gnews', rssUrl: GN('大須 グルメ 名古屋'),                    extractSource: true },

  // ジャンル別
  { name: '_gnews', rssUrl: GN('名古屋 ラーメン 新店 話題'),             extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 焼肉 新店 オープン'),             extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 寿司 おすすめ 話題'),             extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 カフェ 新店 話題'),               extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 居酒屋 オープン 話題'),           extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 イタリアン フレンチ オープン'),   extractSource: true },

  // プレスリリース系
  { name: '_gnews', rssUrl: GN('名古屋 新規オープン 飲食店'),            extractSource: true },
  { name: '_gnews', rssUrl: GN('愛知 レストラン グランドオープン'),       extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 リニューアルオープン 飲食'),      extractSource: true },
  { name: '_gnews', rssUrl: GN('名古屋 初出店 グルメ'),                  extractSource: true },

  // ════════════════════════════════════════════════════════════════════════
  // はてなブックマーク RSS（ブックマーク記事の link ドメインを媒体名として使用）
  // ※ Hatena 検索は複合語タグ形式のみ有効（スペース区切りは 0 件になる）
  // ════════════════════════════════════════════════════════════════════════
  { name: '_hatena', rssUrl: HB('名古屋グルメ'),   extractSourceFromUrl: true },
  { name: '_hatena', rssUrl: HB('名古屋めし'),     extractSourceFromUrl: true },
  { name: '_hatena', rssUrl: HB('名古屋ランチ'),   extractSourceFromUrl: true },
  { name: '_hatena', rssUrl: HB('名古屋ラーメン'), extractSourceFromUrl: true },
  { name: '_hatena', rssUrl: HB('名古屋居酒屋'),   extractSourceFromUrl: true },
  { name: '_hatena', rssUrl: HB('名古屋カフェ'),   extractSourceFromUrl: true },
  { name: '_hatena', rssUrl: HB('名古屋焼肉'),     extractSourceFromUrl: true },
  { name: '_hatena', rssUrl: HB('名古屋スイーツ'), extractSourceFromUrl: true },
  { name: '_hatena', rssUrl: HB('愛知グルメ'),     extractSourceFromUrl: true },
];

// ─── CLI ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = { force: false, dryRun: false, store: null, delayMs: 250 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--force') opts.force = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
  else if (a === '--mode') { i++; /* 後方互換: 無視 */ }
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

// HTML エンティティデコード（&#xNNNN; / &#NNN; / 名前付きエンティティ）
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

// RSS 2.0 / Atom 1.0 パーサ（description も取得する）
function parseRssItems(xml) {
  const items = [];
  const blocks = (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [])
    .concat(xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || []);
  for (const block of blocks) {
    const getField = (tag) => {
      const cdata = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i'));
      if (cdata) return decodeEntities(cdata[1].trim());
      const plain = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
      return plain ? decodeEntities(plain[1]).trim() : '';
    };
    const title = getField('title');
    let link = getField('link');
    if (!link) { const m = block.match(/<link[^>]+href=["']([^"']+)["']/i); if (m) link = m[1]; }
    if (!link) { const m = block.match(/<link>\s*(https?:\/\/[^\s<]+)/i);  if (m) link = m[1]; }

    // description / summary: HTML タグを除去してテキストにする
    const rawDesc = getField('description') || getField('summary') || getField('content');
    const desc = rawDesc
      ? rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, DESC_MAX)
      : '';

    const pubDate = getField('pubDate') || getField('published') || getField('updated') || getField('dc:date');
    let year = new Date().getFullYear();
    if (pubDate) {
      const p = new Date(pubDate).getFullYear();
      if (!isNaN(p) && p >= 2010 && p <= 2040) year = p;
    }
    if (title && link) items.push({ title, desc, link, year });
  }
  return items;
}

// Google News タイトルから媒体名を抽出: "記事タイトル - 媒体名" の「媒体名」部分
function extractSourceFromGNewsTitle(title) {
  const m = title.match(/\s[-–]\s([^-–]{3,30})\s*$/);
  return m ? m[1].trim() : null;
}

// item.link の URL からドメイン名を媒体名として抽出（Hatena RSS 用）
function extractSourceFromItemUrl(link) {
  try {
    const url = new URL(link);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
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

  // 店名 → キー のマップ（同名が複数エリアにある場合は先着）
  const nameToKey = new Map();   // (全店名用)  MIN_NAME_TITLE 以上
  const nameToKeyDesc = new Map(); // (説明文用) MIN_NAME_DESC 以上
  for (const s of targetStores) {
    const name = (s['店名'] || '').trim();
    const key = storeKey(s);
    if (name.length >= MIN_NAME_TITLE && !nameToKey.has(name))     nameToKey.set(name, key);
    if (name.length >= MIN_NAME_DESC  && !nameToKeyDesc.has(name)) nameToKeyDesc.set(name, key);
  }
  console.log(`マッチング対象: タイトル=${nameToKey.size}件 / 説明文=${nameToKeyDesc.size}件`);

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
      const media = Array.isArray(v) ? [...new Set(v.map(a => a.name))].join(', ') : '?';
      console.log(`  ${k}: [${media}]（${Array.isArray(v) ? v.length : 0}件）`);
    }
    return;
  }

  let totalScanned = 0, totalNewMatches = 0;
  const feedsOk = [], feedsFailed = [];

  for (const feed of MEDIA_FEEDS) {
    const feedLabel = feed.name === '_gnews'   ? 'Google News'
      : feed.name === '_hatena' ? 'はてなブックマーク'
      : feed.name;
    const urlSnip = feed.rssUrl.replace(/https:\/\/[^/]+\//, '').slice(0, 60);
    console.log(`\n取得中: ${feedLabel} — ${urlSnip}`);

    let xml;
    try { xml = await fetchText(feed.rssUrl); }
    catch (e) {
      console.warn(`  [SKIP] ${e.message}`);
      feedsFailed.push(feedLabel);
      await sleep(opts.delayMs);
      continue;
    }

    const items = parseRssItems(xml);
    console.log(`  記事数: ${items.length}`);
    if (items.length === 0) {
      console.warn(`  [WARN] 記事 0 件`);
      feedsFailed.push(feedLabel);
      await sleep(opts.delayMs);
      continue;
    }

    let feedNew = 0;
    for (const item of items) {
      totalScanned++;

      // Google News: タイトルから媒体名を抽出（失敗やBLOCKEDはスキップ）
      let mediaName = feed.name;
      if (feed.extractSource) {
        const src = extractSourceFromGNewsTitle(item.title);
        if (!src || BLOCKED_SOURCES.has(src)) continue;
        mediaName = src;
      }
      // Hatena Bookmark: item.link ドメインを媒体名として抽出（BLOCKED_DOMAINSはスキップ）
      if (feed.extractSourceFromUrl) {
        const domain = extractSourceFromItemUrl(item.link);
        if (!domain || BLOCKED_DOMAINS.has(domain)) continue;
        mediaName = domain;
      }

      // ── タイトルマッチ (MIN_NAME_TITLE 以上) ───────────────────────────
      for (const [storeName, key] of nameToKey) {
        if (!item.title.includes(storeName)) continue;
        if (!Array.isArray(cache[key])) cache[key] = [];
        if (cache[key].some(a => a.url === item.link)) continue;
        cache[key].push({ name: mediaName, url: item.link, title: item.title.slice(0, 100), year: item.year, matchedBy: 'title' });
        feedNew++; totalNewMatches++;
        if (opts.store) console.log(`  ✓[title] "${storeName}" → "${item.title.slice(0, 55)}" / ${mediaName}`);
      }

      // ── 説明文マッチ (MIN_NAME_DESC 以上・description がある場合のみ) ──
      if (item.desc) {
        for (const [storeName, key] of nameToKeyDesc) {
          if (!item.desc.includes(storeName)) continue;
          if (!Array.isArray(cache[key])) cache[key] = [];
          // 同一 URL の重複除去（タイトルマッチ済みのものも含む）
          if (cache[key].some(a => a.url === item.link)) continue;
          cache[key].push({ name: mediaName, url: item.link, title: item.title.slice(0, 100), year: item.year, matchedBy: 'desc' });
          feedNew++; totalNewMatches++;
          if (opts.store) console.log(`  ✓[desc] "${storeName}" → "${item.title.slice(0, 55)}" / ${mediaName}`);
        }
      }
    }
    console.log(`  新規マッチ: ${feedNew}件`);
    feedsOk.push(feedLabel);
    await sleep(opts.delayMs);
  }

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
  console.log(`成功: ${[...new Set(feedsOk)].join(', ')}`);
  if (feedsFailed.length) console.log(`失敗: ${[...new Set(feedsFailed)].join(', ')}`);
  console.log(`記事スキャン: ${totalScanned}件 / 新規マッチ: ${totalNewMatches}件（タイトル+説明文）`);
  console.log(`掲載情報あり店舗数（累積）: ${storeCount}件`);

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`キャッシュ書き込み: ${CACHE_PATH}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
