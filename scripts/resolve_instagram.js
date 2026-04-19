#!/usr/bin/env node
/**
 * resolve_instagram.js
 * 各店舗の公式Instagramアカウントをビルド時に事前解決し、
 * data/instagram_resolved.json にキャッシュ保存する。
 *
 * 使い方:
 *   node scripts/resolve_instagram.js                 # 全店、未解決分のみ
 *   node scripts/resolve_instagram.js --limit 10      # 先頭10店だけ（動作確認用）
 *   node scripts/resolve_instagram.js --force         # キャッシュ無視で全件再解決
 *   node scripts/resolve_instagram.js --dry-run       # キャッシュ書き込まず標準出力に表示
 *   node scripts/resolve_instagram.js --store J000805511   # 特定IDのみ
 *
 * 検索バックエンド:
 *   - 環境変数 SERPAPI_KEY があれば SerpAPI 使用（信頼性高）
 *   - なければ Yahoo! JAPAN 検索 HTML スクレイプ（無料・日本語結果に強い）
 *
 * 結果は data/instagram_resolved.json にキー=ホットペッパーID で蓄積される。
 * build.js がこのファイルを読み、LOCAL_STORES の Instagram フィールドにマージする。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { URLSearchParams } = require('url');

const ROOT = path.resolve(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'instagram_resolved.json');
const INDEX_HTML = path.join(ROOT, 'index.html');

// ─── CLI args ─────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = {
  limit: null,
  force: false,
  dryRun: false,
  store: null,
  delayMs: 2000,
  jitterMs: 1500,
};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (a === '--force') opts.force = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
  else if (a === '--help' || a === '-h') {
    console.log(fs.readFileSync(__filename, 'utf8').match(/\/\*\*[\s\S]+?\*\//)[0]);
    process.exit(0);
  }
}

// ─── 店名クリーンアップ（index.html の cleanStoreName と同等ロジック） ───
function cleanStoreName(name) {
  if (!name) return '';
  let s = String(name);
  s = s.replace(/[（(]\s*[\u3040-\u309F\u30A0-\u30FFー]+\s*[）)]/g, ' ');
  s = s.replace(/[\-－‐‑–—]\s*[\u3040-\u309F\u30A0-\u30FFー]+\s*[\-－‐‑–—]/g, ' ');
  s = s.replace(/【[^】]*】/g, ' ');
  let tokens = s.split(/[\s\u3000]+/).filter(Boolean);
  const isHira = (t) => /^[\u3040-\u309Fー]+$/.test(t);
  const isKanji = (t) => /^[\u4E00-\u9FFF々]+$/.test(t);
  while (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    const prev = tokens[tokens.length - 2];
    if (isHira(last) && isKanji(prev) && prev.length >= 1 && prev.length <= 5 && last.length >= prev.length * 1.5) {
      tokens.pop();
    } else break;
  }
  return tokens.join(' ').replace(/\s+/g, ' ').trim();
}

// ─── 店名から「ブランド名」だけを抽出（generic prefix と location suffix を除去） ───
// 例: "個室居酒屋 和菜美 名古屋駅店" → "和菜美"
//     "居酒屋 ヒノカミ 名古屋駅前店" → "ヒノカミ"
//     "牛タンともつ鍋 個室居酒屋 Kurosawa 名古屋駅店" → "牛タンともつ鍋 Kurosawa"（generic除去のみ）
const GENERIC_PREFIXES = new Set([
  // 業態系
  '居酒屋','個室居酒屋','完全個室居酒屋','完全個室','個室','全室個室','全席個室','全席完全個室',
  '海鮮居酒屋','やきとん居酒屋','焼肉ホルモン','焼肉','焼鳥','焼き鳥','やきとり','炭火焼','炭火焼鳥',
  '串焼','串焼き','鉄板焼','鉄板焼き','お好み焼','もんじゃ','和食','新和食','割烹','寿司','鮨','すし',
  '魚介','海鮮','海鮮料理','肉','肉バル','バル','バー','カフェ','レストラン','ビストロ','ダイニング','ダイニングバー',
  '韓国料理','韓国','中華','中華料理','イタリアン','イタリア料理','フレンチ','フランス料理','スペイン料理',
  'タイ料理','ベトナム料理','エスニック','もつ鍋','しゃぶしゃぶ','すきやき','鍋','水炊き','餃子','ラーメン','つけ麺',
  'そば','うどん','定食','食堂','ステーキ','ハンバーグ','ピザ','パスタ','チーズ','ワイン','ワインバー','日本酒',
  '焼酎','クラフトビール','ビアバー','貸切','水槽個室','全室水槽個室','プライベート個室','完全分煙','個室完備',
  '新規開店','完全予約制','飲み放題','食べ飲み放題','食べ放題','飲食店','レストランバー','立ち飲み',
  '居酒屋ダイニング','大衆酒場','大衆居酒屋','大衆食堂','酒場','酒蔵','名物','名古屋名物','名古屋めし',
  // 装飾形容
  '老舗','元祖','本格','本格派','名店','人気','話題','美味い','うまい','旨い',
]);
function isLocationSuffix(t) {
  // ○○店 / ○号店 / ○号館 系のブランチ表記
  if (/店$/.test(t) && t.length >= 2) return true;
  if (/号店$/.test(t)) return true;
  if (/号館$/.test(t)) return true;
  if (/^(本店|総本店|別館|新館|分店|別邸)$/.test(t)) return true;
  return false;
}
function coreStoreName(name) {
  const s = cleanStoreName(name);
  if (!s) return '';
  let tokens = s.split(/[\s\u3000]+/).filter(Boolean);
  // generic prefix 除外
  let filtered = tokens.filter(t => !GENERIC_PREFIXES.has(t));
  // location suffix 除外
  filtered = filtered.filter(t => !isLocationSuffix(t));
  // 全部消えたら最低限 cleanStoreName を返す
  if (filtered.length === 0) return s;
  return filtered.join(' ').trim();
}

function nameHash(name) {
  return crypto.createHash('md5').update(name || '').digest('hex').slice(0, 8);
}

// ─── ストア一覧読み込み（index.html の LOCAL_STORES から） ───
function loadStores() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const m = html.match(/LOCAL_STORES\s*=\s*(\[)/);
  if (!m) throw new Error('LOCAL_STORES not found in index.html');
  const start = m.index + m[0].length - 1;
  // バランス括弧で末尾を見つける（文字列内のbracketは無視）
  let depth = 0, i = start, inStr = false, esc = false;
  while (i < html.length) {
    const c = html[i];
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === '"') inStr = !inStr;
    else if (!inStr) {
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) break; }
    }
    i++;
  }
  const arr = JSON.parse(html.slice(start, i + 1));
  return arr;
}

// ─── キャッシュ ───
function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch (e) { console.warn('[cache] 読み込み失敗、空で開始:', e.message); return {}; }
}
function saveCache(cache) {
  if (opts.dryRun) return;
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
}

// ─── HTTP（簡易、UAローテーション） ───
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];
function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }
function fetchHtml(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        ...headers,
      },
      timeout: 15000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // followredirect 1段
          return fetchHtml(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).toString(), headers).then(resolve, reject);
        }
        if (res.statusCode === 429) {
          const err = new Error('HTTP 429 (rate limited)');
          err.rateLimited = true;
          return reject(err);
        }
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
        resolve(body);
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

// ─── Instagram URL候補抽出 ───
const RESERVED_USERNAMES = new Set([
  'explore', 'accounts', 'direct', 'p', 'reel', 'reels', 'stories',
  'tv', 'web', 'tags', 'about', 'developer', 'press', 'api', 'help',
  'legal', 'safety', 'terms', 'privacy', 'fragment', 'sessions',
  'session', 'graphql', 'creator', 'business', 'oauth', 'login',
  'signup', 'emails', 'web_create_username', 'fxcal',
]);

function extractInstagramProfileUrls(html) {
  // instagram.com/<username>/ ペアのみ抽出（投稿/リール/タグは除外）
  const found = new Map(); // username -> first matched URL
  const re = /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)\/?(?:[?#"<\s]|$)/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (!u || RESERVED_USERNAMES.has(u.toLowerCase())) continue;
    if (u.length < 2 || u.length > 30) continue;
    if (!found.has(u)) found.set(u, `https://www.instagram.com/${u}/`);
  }
  return Array.from(found.values());
}

// ─── 検索バックエンド ───
async function yahooJpSearch(query) {
  // Yahoo! JAPAN 検索（日本語結果に強い、レート制限ゆるめ）
  const url = 'https://search.yahoo.co.jp/search?' + new URLSearchParams({ p: query }).toString();
  const html = await fetchHtml(url);
  // Yahoo はリダイレクトURLでくるんでいる場合あり: /*-https%3A//... → デコード
  const decoded = html.replace(/\/\*-(https?%3A[^"'<>\s]+)/gi, (_, u) => {
    try { return decodeURIComponent(u); } catch { return u; }
  });
  return extractInstagramProfileUrls(decoded);
}
async function serpApiSearch(query, key) {
  const url = 'https://serpapi.com/search.json?' + new URLSearchParams({
    q: query, engine: 'google', hl: 'ja', gl: 'jp', api_key: key, num: 10,
  }).toString();
  const body = await fetchHtml(url);
  let json; try { json = JSON.parse(body); } catch { return []; }
  const out = [];
  for (const r of (json.organic_results || [])) {
    if (!r.link) continue;
    const urls = extractInstagramProfileUrls(r.link);
    out.push(...urls);
  }
  return Array.from(new Set(out));
}
async function searchProfileUrls(query) {
  const key = process.env.SERPAPI_KEY;
  if (key) return serpApiSearch(query, key);
  return yahooJpSearch(query);
}

// ─── スコアリング（false-positive 排除のため厳しめ） ───
// ひらがな/カタカナ → ローマ字（粗い変換、username マッチ用）
const KANA_ROMAJI = {};
{
  const tables = {
    // 基本ひらがな
    'あ':'a','い':'i','う':'u','え':'e','お':'o',
    'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
    'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
    'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
    'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
    'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
    'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
    'や':'ya','ゆ':'yu','よ':'yo',
    'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
    'わ':'wa','を':'wo','ん':'n',
    'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
    'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
    'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
    'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
    'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
    'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','っ':'','ゃ':'ya','ゅ':'yu','ょ':'yo','ー':'',
  };
  for (const [k, v] of Object.entries(tables)) {
    KANA_ROMAJI[k] = v;
    // カタカナ版も自動生成
    const kata = String.fromCharCode(k.charCodeAt(0) + 0x60);
    KANA_ROMAJI[kata] = v;
  }
  KANA_ROMAJI['ー'] = '';
}
function kanaToRomaji(s) {
  return Array.from(s || '').map(c => KANA_ROMAJI[c] !== undefined ? KANA_ROMAJI[c] : c).join('').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function scoreCandidate(url, store, position) {
  const username = (url.match(/instagram\.com\/([^/]+)/)?.[1] || '').toLowerCase();
  const fullName = store['店名'] || '';
  const coreName = coreStoreName(fullName);
  let score = 0;
  // 1) ASCII（英字部分）の一致 — 強い相関
  const nameAsciiTokens = (fullName.match(/[A-Za-z0-9]{2,}/g) || []).map(t => t.toLowerCase());
  for (const t of nameAsciiTokens) {
    if (username.includes(t)) score += 6;
  }
  // 2) コア店名の各トークン → カナ部分をローマ字化して username マッチ
  const coreTokens = coreName.split(/[\s\u3000]+/).filter(Boolean);
  for (const t of coreTokens) {
    const kanaChunks = (t.match(/[\u3040-\u309F\u30A0-\u30FFー]+/g) || []);
    for (const k of kanaChunks) {
      const romaji = kanaToRomaji(k);
      if (romaji.length >= 3) {
        if (username.includes(romaji)) {
          score += 5;
        } else if (romaji.length >= 4 && username.includes(romaji.slice(0, Math.max(3, romaji.length - 1)))) {
          score += 3;
        } else if (romaji.length >= 4) {
          for (let len = romaji.length; len >= 3; len--) {
            if (username.includes(romaji.slice(0, len))) { score += 2; break; }
          }
        }
      }
    }
    const asc = (t.match(/[A-Za-z0-9]{2,}/g) || []);
    for (const a of asc) {
      if (username.includes(a.toLowerCase())) score += 4;
    }
  }
  // 3) 名古屋関連の地名 username
  if (/nagoya|nagoyashi|sakae|nishiki|meieki|fushimi|kanayama|osu/i.test(username)) score += 2;
  // 4) Yahoo検索結果の上位ランク（kochuten_restaurant のような漢字専用名で
  //    ローマ字スコアが効かないケースの救済 — 検索クエリが具体的なら上位結果を信頼する）
  //    coreName が generic でなく 2文字以上の固有名詞っぽい場合のみ有効
  if (position === 0 && coreName.length >= 2 && !GENERIC_PREFIXES.has(coreName)) score += 4;
  if (position === 1 && coreName.length >= 2 && !GENERIC_PREFIXES.has(coreName)) score += 1;
  // 5) ペナルティ: 完全に汎用的すぎる username
  if (/^(restaurant|izakaya|cafe|bar|shop|store)\d*$/i.test(username)) score -= 5;
  return { url, username, score };
}
const MIN_SCORE = 4;  // この未満はリジェクト

// ─── 1店ぶん解決 ───
async function resolveOne(store) {
  const coreName = coreStoreName(store['店名']);
  const cleanName = cleanStoreName(store['店名']);
  const genre = (store['ジャンル'] || '').split('・')[0] || '';
  // コア店名 → クリーン店名 → 全文 の順で検索
  // false-positive 排除のため最低スコア閾値を満たす候補のみ採用
  const queries = [
    { method: 'Q1', q: coreName ? `${coreName} 名古屋 site:instagram.com` : '' },
    { method: 'Q2', q: cleanName && cleanName !== coreName ? `${cleanName} 名古屋 site:instagram.com` : '' },
    { method: 'Q3', q: `${store['店名']} ${genre} 名古屋 site:instagram.com` },
  ].filter(x => x.q && x.q.replace('site:instagram.com', '').trim());

  let bestSoFar = null;
  for (const { method, q } of queries) {
    try {
      const urls = await searchProfileUrls(q);
      if (urls.length > 0) {
        const scored = urls.map((u, i) => scoreCandidate(u, store, i)).sort((a, b) => b.score - a.score);
        const best = scored[0];
        if (best.score >= MIN_SCORE) {
          return { instagram: best.url, method, query: q, score: best.score, candidates: scored.slice(0, 5) };
        }
        // スコア未達でも記憶しておく（全段階 fail 時の参考用、ただし採用はしない）
        if (!bestSoFar || best.score > bestSoFar.score) bestSoFar = { ...best, method, query: q };
      }
    } catch (e) {
      console.warn(`  [${store['ホットペッパーID']}] ${method} エラー: ${e.message}`);
      // 429 (rate limit) は長めにスリープ
      const backoffMs = e.rateLimited ? 60000 + Math.random() * 30000 : opts.delayMs * 3 + Math.random() * opts.jitterMs;
      console.warn(`  → ${Math.round(backoffMs/1000)}秒バックオフ`);
      await sleep(backoffMs);
    }
    await sleep(opts.delayMs + Math.random() * opts.jitterMs);
  }
  // 全段失敗。スコア未達の候補があれば、参考までに返す（採用はしない、failed=trueでログ）
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── メイン ───
(async () => {
  console.log('Instagram公式アカウント解決スクリプト');
  console.log(`バックエンド: ${process.env.SERPAPI_KEY ? 'SerpAPI' : 'Yahoo! JAPAN HTML'}`);
  console.log(`オプション: ${JSON.stringify(opts)}`);

  const stores = loadStores();
  console.log(`総店舗数: ${stores.length}`);

  let cache = loadCache();
  let targets = stores;
  if (opts.store) targets = stores.filter(s => s['ホットペッパーID'] === opts.store);
  if (opts.limit) targets = targets.slice(0, opts.limit);

  let resolved = 0, skipped = 0, failed = 0;
  for (const store of targets) {
    const id = store['ホットペッパーID'];
    if (!id) continue;
    // 既に手動でInstagramフィールドに入っている店はスキップ（最優先で尊重）
    if (store['Instagram'] && store['Instagram'].trim() && !opts.force) {
      skipped++;
      continue;
    }
    const cached = cache[id];
    const currentHash = nameHash(store['店名']);
    if (!opts.force && cached && cached.nameHash === currentHash && (cached.instagram || cached.failed)) {
      skipped++;
      continue;
    }
    process.stdout.write(`[${id}] ${store['店名']} ... `);
    const result = await resolveOne(store);
    if (result) {
      console.log(`✓ ${result.method} score=${result.score}: ${result.instagram}`);
      cache[id] = {
        store: store['店名'],
        nameHash: currentHash,
        instagram: result.instagram,
        method: result.method,
        query: result.query,
        score: result.score,
        candidates: result.candidates.map(c => ({url: c.url, score: c.score})),
        resolvedAt: new Date().toISOString(),
      };
      resolved++;
    } else {
      console.log('✗ 解決失敗');
      cache[id] = {
        store: store['店名'],
        nameHash: currentHash,
        failed: true,
        resolvedAt: new Date().toISOString(),
      };
      failed++;
    }
    if ((resolved + failed) % 20 === 0) saveCache(cache);
  }
  saveCache(cache);
  console.log(`\n完了: 解決 ${resolved}件 / スキップ ${skipped}件 / 失敗 ${failed}件`);
  console.log(`キャッシュ: ${CACHE_PATH}`);
})().catch((e) => { console.error(e); process.exit(1); });
