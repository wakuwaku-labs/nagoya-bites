#!/usr/bin/env node
/**
 * fetch_media_appearances.js
 *
 * 名古屋グルメ系メディアから店舗掲載情報を収集し
 * data/media_appearances.json にキャッシュする（S4 他媒体掲載クロスチェック用）。
 *
 * 2 つの取得モード:
 *
 *   【rss モード（週次・差分更新）】
 *     各メディアの RSS フィードを取得（直近 10〜50 件）。
 *     weekly-pipeline.yml から自動実行される。
 *
 *   【sitemap モード（一括・過去分全件）】
 *     各メディアの XML サイトマップを解析し、全記事アーカイブをスキャン。
 *     1 サイトあたり 1〜3 リクエストで数千件をカバー。
 *     初回または履歴を一括取込みたいときに手動実行:
 *       node scripts/fetch_media_appearances.js --mode sitemap
 *
 * 制約:
 *   - npm 依存ゼロ（標準 https/http モジュールのみ）
 *   - スクレイピングなし（RSS・サイトマップのみ）・TOS 違反なし
 *   - 食べログ・Retty 等の本文取得は行わない
 *
 * 使い方:
 *   node scripts/fetch_media_appearances.js                   # RSS モード（既定）
 *   node scripts/fetch_media_appearances.js --mode sitemap    # サイトマップ一括取込み
 *   node scripts/fetch_media_appearances.js --mode all        # RSS + サイトマップ両方
 *   node scripts/fetch_media_appearances.js --force           # キャッシュ全破棄して再取得
 *   node scripts/fetch_media_appearances.js --dry-run         # 統計のみ（ファイル更新なし）
 *   node scripts/fetch_media_appearances.js --store J000729743 # 1 店のマッチング確認
 *   node scripts/fetch_media_appearances.js --delay 500       # レート制御 ms（既定 300）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'media_appearances.json');
const INDEX_HTML = path.join(ROOT, 'index.html');

// 最小店名文字数（短い名前はノイズになるため除外）
const MIN_NAME_LEN = 3;

// サイトマップから再帰取得する最大 URL 数（1 サイト当たり）
const SITEMAP_MAX_URLS = 5000;
// サイトマップインデックスから取得する子サイトマップの上限
const SITEMAP_MAX_CHILDREN = 8;
// 記事URLのスラグとして認識する最小日本語文字数（デコード後）
const SLUG_MIN_JP_CHARS = 2;

// 名古屋関連キーワード（nagoyaOnly フィードの記事フィルタ用）
const NAGOYA_KEYWORDS = [
  '名古屋', '栄', '名駅', '大須', '覚王山', '今池', '千種', '東山',
  '八事', '金山', '熱田', '港区', '中川区', '中区', '西区', '南区', '守山区',
  '天白区', '名東区', '北区', '東区', '瑞穂区', '昭和区', '緑区'
];

/**
 * フィード設定
 *   name:        mediaFeatures に格納される媒体名
 *   rssUrl:      RSS/Atom フィード URL
 *   sitemapUrl:  サイトマップ URL（未指定は自動探索: /sitemap_index.xml → /sitemap.xml）
 *   nagoyaOnly:  true = 名古屋キーワードを含む記事のみ対象
 */
const MEDIA_FEEDS = [
  // ─── 名古屋ローカルグルメメディア ────────────────────────────────────────
  {
    name: 'ナゴレコ',
    rssUrl: 'https://nagoreco.com/feed/',
    sitemapUrl: 'https://nagoreco.com/sitemap_index.xml',
    nagoyaOnly: false
  },
  {
    name: 'WEB大人の名古屋',
    rssUrl: 'https://otona-nagoya.com/feed/',
    sitemapUrl: 'https://otona-nagoya.com/sitemap_index.xml',
    nagoyaOnly: false
  },
  {
    name: '日刊KELLY',
    rssUrl: 'https://kelly-net.jp/gourmet/feed/',
    sitemapUrl: 'https://kelly-net.jp/sitemap.xml',
    nagoyaOnly: false
  },
  {
    name: '名古屋観光情報',
    rssUrl: 'https://www.nagoya-info.jp/rss.xml',
    sitemapUrl: 'https://www.nagoya-info.jp/sitemap.xml',
    nagoyaOnly: false
  },

  // ─── 全国グルメメディア（名古屋記事を含む） ─────────────────────────────
  {
    name: 'dancyu',
    rssUrl: 'https://dancyu.jp/feed',
    sitemapUrl: 'https://dancyu.jp/sitemap.xml',
    nagoyaOnly: true
  },
  {
    name: 'dressing',
    rssUrl: 'https://dressing.media/feed/',
    sitemapUrl: 'https://dressing.media/sitemap_index.xml',
    nagoyaOnly: true
  },
  {
    name: 'マカロニ',
    rssUrl: 'https://macaro-ni.jp/feed',
    sitemapUrl: 'https://macaro-ni.jp/sitemap.xml',
    nagoyaOnly: true
  },
  {
    name: 'ReTRIP',
    rssUrl: 'https://retrip.jp/articles/feed/',
    sitemapUrl: 'https://retrip.jp/sitemap.xml',
    nagoyaOnly: true
  },
  {
    name: 'TABI LABO',
    rssUrl: 'https://tabi-labo.com/feed',
    sitemapUrl: 'https://tabi-labo.com/sitemap.xml',
    nagoyaOnly: true
  },
  {
    name: 'icotto',
    rssUrl: 'https://icotto.jp/feed',
    sitemapUrl: 'https://icotto.jp/sitemap.xml',
    nagoyaOnly: true
  },
  {
    name: 'ヒトサラ',
    rssUrl: 'https://hitosara.com/feed.xml',
    sitemapUrl: 'https://hitosara.com/sitemap.xml',
    nagoyaOnly: true
  },

  // ─── プレスリリース ────────────────────────────────────────────────────
  {
    name: 'PR TIMES',
    rssUrl: 'https://prtimes.jp/topics/restaurants/rss.xml',
    sitemapUrl: null, // PR TIMES はサイトマップが使いにくいため RSS のみ
    nagoyaOnly: true
  },
];

// ─── CLI ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = { mode: 'rss', force: false, dryRun: false, store: null, delayMs: 300 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--mode') opts.mode = args[++i]; // 'rss' | 'sitemap' | 'all'
  else if (a === '--force') opts.force = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── HTTP ────────────────────────────────────────────────────────────────
function fetchText(url, redirectDepth = 0) {
  if (redirectDepth > 3) return Promise.reject(new Error(`リダイレクト上限: ${url}`));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'NAGOYA-BITES-Bot/1.0 (+https://nagoya-bites.com/)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        const loc = res.headers['location'];
        res.resume();
        if (loc) return resolve(fetchText(loc, redirectDepth + 1));
        return reject(new Error(`リダイレクト先不明: ${url}`));
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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error(`タイムアウト: ${url}`)); });
  });
}

// ─── RSS/Atom パーサ ──────────────────────────────────────────────────────
function parseRssItems(xml) {
  const items = [];
  const blocks = (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [])
    .concat(xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || []);
  for (const block of blocks) {
    const getField = (tag) => {
      const cdata = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i'));
      if (cdata) return cdata[1].trim();
      const plain = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
      return plain ? plain[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
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

// ─── サイトマップパーサ ───────────────────────────────────────────────────

// サイトマップ XML を解析して記事候補を返す
// 戻り値: { isIndex: bool, childUrls: string[], items: [{loc, title, year}] }
function parseSitemap(xml) {
  // サイトマップインデックス（<sitemap> 要素を持つ）
  const sitemapBlocks = xml.match(/<sitemap[\s>][\s\S]*?<\/sitemap>/gi) || [];
  if (sitemapBlocks.length > 0) {
    const childUrls = sitemapBlocks.map(b => {
      const loc = b.match(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/i);
      return loc ? loc[1] : null;
    }).filter(Boolean);
    return { isIndex: true, childUrls, items: [] };
  }

  // 通常サイトマップ（<url> 要素を持つ）
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/gi) || [];
  const items = [];
  for (const block of urlBlocks) {
    const loc = block.match(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/i)?.[1];
    if (!loc) continue;

    // Google News サイトマップなら <news:title> を使う（最も正確）
    const newsTitle = (() => {
      const cdata = block.match(/<news:title>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/news:title>/i);
      if (cdata) return cdata[1].trim();
      const plain = block.match(/<news:title>([^<]+)<\/news:title>/i);
      return plain ? plain[1].trim() : null;
    })();

    // URL スラグをデコードして日本語タイトルを推定
    let slugTitle = null;
    try {
      const rawSlug = loc.split('/').filter(Boolean).pop() || '';
      const decoded = decodeURIComponent(rawSlug)
        .replace(/\.(html?|php|aspx?)$/i, '')
        .replace(/[-_]/g, ' ');
      // 日本語文字が含まれる場合のみ有効なスラグとして使う
      const jpChars = (decoded.match(/[　-鿿豈-﫿]/g) || []).length;
      if (jpChars >= SLUG_MIN_JP_CHARS) slugTitle = decoded;
    } catch (e) { /* デコード失敗は無視 */ }

    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/i)?.[1];
    let year = new Date().getFullYear();
    if (lastmod) {
      const p = new Date(lastmod).getFullYear();
      if (!isNaN(p) && p >= 2010 && p <= 2040) year = p;
    }

    // title の優先順: news:title > slugTitle（どちらもない場合は URL だけ記録）
    const title = newsTitle || slugTitle;
    if (title || loc) items.push({ loc, title, year });
  }
  return { isIndex: false, childUrls: [], items };
}

// サイトマップ URL を受け取り、記事エントリの配列を返す（インデックスは再帰展開）
async function fetchSitemapEntries(url, feed, depth = 0) {
  if (depth > 2) return [];
  let xml;
  try {
    xml = await fetchText(url);
  } catch (e) {
    console.warn(`    [SKIP] ${url}: ${e.message}`);
    return [];
  }
  const parsed = parseSitemap(xml);
  if (parsed.isIndex) {
    // 記事サイトマップらしいものを優先（post, article, entry 等を含む URL）
    const postSitemaps = parsed.childUrls.filter(u =>
      /post|article|entry|news|gourmet|restaurant/i.test(u)
    );
    // 記事っぽいものがなければ全チャイルドを試みる
    const targets = (postSitemaps.length > 0 ? postSitemaps : parsed.childUrls)
      .slice(0, SITEMAP_MAX_CHILDREN);
    console.log(`    インデックス: ${parsed.childUrls.length}件 → ${targets.length}件を展開`);
    let all = [];
    for (const child of targets) {
      const entries = await fetchSitemapEntries(child, feed, depth + 1);
      all = all.concat(entries);
      if (all.length >= SITEMAP_MAX_URLS) break;
      await sleep(Math.floor(opts.delayMs / 2));
    }
    return all.slice(0, SITEMAP_MAX_URLS);
  }
  return parsed.items.slice(0, SITEMAP_MAX_URLS);
}

// サイトマップ URL を自動探索（/sitemap_index.xml → /sitemap.xml の順）
async function discoverSitemapUrl(baseUrl) {
  const candidates = [
    baseUrl.replace(/\/$/, '') + '/sitemap_index.xml',
    baseUrl.replace(/\/$/, '') + '/sitemap.xml'
  ];
  for (const url of candidates) {
    try {
      await fetchText(url);
      return url;
    } catch (e) { /* 次を試す */ }
  }
  return null;
}

// ─── ストア読み込み ───────────────────────────────────────────────────────
function loadStoresFromIndex() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const match = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!match) throw new Error('LOCAL_STORES not found in index.html');
  return JSON.parse(match[1]);
}

function isNagoyaRelated(text) {
  return NAGOYA_KEYWORDS.some(kw => text.includes(kw));
}

function storeKey(s) {
  return s['ホットペッパーID'] || `_manual_${s['店名']}_${s['エリア'] || ''}`;
}

// ─── メインマッチング関数 ─────────────────────────────────────────────────
function matchAndAccumulate(cache, feed, entries, nameToKey, isRss) {
  let newMatches = 0;
  for (const entry of entries) {
    const title = isRss ? entry.title : entry.title;
    const url   = isRss ? entry.link  : entry.loc;
    const year  = entry.year;

    if (!title && !url) continue;
    if (feed.nagoyaOnly && title && !isNagoyaRelated(title)) continue;

    for (const [storeName, key] of nameToKey) {
      // タイトルがある場合はタイトルで照合（精度優先）
      // タイトルがない場合は URL スラグで照合（カバレッジ優先）
      const haystack = title || '';
      if (!haystack.includes(storeName)) continue;

      if (!Array.isArray(cache[key])) cache[key] = [];
      const alreadyHas = cache[key].some(a => a.url === url);
      if (alreadyHas) continue;

      cache[key].push({
        name: feed.name,
        url,
        title: (title || '').slice(0, 100),
        year
      });
      newMatches++;

      if (opts.store) {
        console.log(`    ✓ "${storeName}" → "${(title || url).slice(0, 60)}"`);
        console.log(`      URL: ${url} (${year})`);
      }
    }
  }
  return newMatches;
}

// ─── メイン ───────────────────────────────────────────────────────────────
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

  const nameToKey = new Map();
  for (const s of targetStores) {
    const name = (s['店名'] || '').trim();
    if (name.length < MIN_NAME_LEN) continue;
    if (!nameToKey.has(name)) nameToKey.set(name, storeKey(s));
  }
  console.log(`マッチング対象店名: ${nameToKey.size}件（${MIN_NAME_LEN}文字以上）`);
  console.log(`取得モード: ${opts.mode.toUpperCase()}`);

  // 既存キャッシュ
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
      const mediaNames = Array.isArray(v) ? v.map(a => a.name).join(', ') : '?';
      console.log(`  ${k}: [${mediaNames}]`);
    }
    return;
  }

  let totalNewMatches = 0;
  let totalEntries = 0;
  const feedsSucceeded = [], feedsFailed = [];

  const runRss = opts.mode === 'rss' || opts.mode === 'all';
  const runSitemap = opts.mode === 'sitemap' || opts.mode === 'all';

  for (const feed of MEDIA_FEEDS) {
    let feedNew = 0;

    // ── RSS フェッチ ──────────────────────────────────────────────────────
    if (runRss) {
      console.log(`\n[RSS] ${feed.name} — ${feed.rssUrl}`);
      try {
        const xml = await fetchText(feed.rssUrl);
        const items = parseRssItems(xml);
        console.log(`  記事数: ${items.length}`);
        const n = matchAndAccumulate(cache, feed, items, nameToKey, true);
        feedNew += n;
        totalEntries += items.length;
        totalNewMatches += n;
        feedsSucceeded.push(`${feed.name}(RSS)`);
      } catch (e) {
        console.warn(`  [SKIP] ${e.message}`);
        feedsFailed.push(`${feed.name}(RSS)`);
      }
      await sleep(opts.delayMs);
    }

    // ── サイトマップフェッチ ─────────────────────────────────────────────
    if (runSitemap && feed.sitemapUrl !== null) {
      const baseOrigin = (() => {
        try { return new URL(feed.rssUrl).origin; } catch (e) { return ''; }
      })();
      // sitemapUrl が明示されていれば使う、なければ自動探索
      let sitemapTarget = feed.sitemapUrl;
      if (!sitemapTarget && baseOrigin) {
        console.log(`\n[Sitemap] ${feed.name} — 自動探索中...`);
        sitemapTarget = await discoverSitemapUrl(baseOrigin);
        if (!sitemapTarget) {
          console.warn(`  [SKIP] サイトマップ URL が見つかりません`);
          feedsFailed.push(`${feed.name}(Sitemap)`);
          continue;
        }
      }
      console.log(`\n[Sitemap] ${feed.name} — ${sitemapTarget}`);
      const entries = await fetchSitemapEntries(sitemapTarget, feed);
      console.log(`  エントリ数: ${entries.length}`);
      const n = matchAndAccumulate(cache, feed, entries, nameToKey, false);
      feedNew += n;
      totalEntries += entries.length;
      totalNewMatches += n;
      console.log(`  新規マッチ（サイトマップ）: ${n}件`);
      feedsSucceeded.push(`${feed.name}(Sitemap)`);
      await sleep(opts.delayMs);
    }

    if (feedNew > 0) console.log(`  → ${feed.name} 合計新規マッチ: ${feedNew}件`);
  }

  cache['_meta'] = {
    lastFetchedAt: new Date().toISOString(),
    lastMode: opts.mode,
    feedsSucceeded,
    feedsFailed,
    entriesScanned: totalEntries,
    newMatchesThisRun: totalNewMatches,
    totalStoresWithAppearances: Object.keys(cache).filter(k => k !== '_meta').length
  };

  const storeCount = cache['_meta'].totalStoresWithAppearances;
  console.log(`\n=== 完了（モード: ${opts.mode}） ===`);
  console.log(`成功: ${feedsSucceeded.length}件 / 失敗: ${feedsFailed.length}件`);
  if (feedsFailed.length) console.log(`  失敗: ${feedsFailed.join(', ')}`);
  console.log(`エントリスキャン: ${totalEntries}件 / 新規マッチ: ${totalNewMatches}件`);
  console.log(`掲載情報あり店舗数（累積）: ${storeCount}件`);
  console.log(`キャッシュ書き込み: ${CACHE_PATH}`);

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

main().catch(e => { console.error(e.message); process.exit(1); });
