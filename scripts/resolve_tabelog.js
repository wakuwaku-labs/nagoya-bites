#!/usr/bin/env node
/**
 * resolve_tabelog.js
 * 店舗の公式食べログページURLを事前解決して data/tabelog_resolved.json にキャッシュする。
 *
 * フェーズ1: data/instagram_resolved.json の tabelogUrl フィールドを即時インポート（約974件）
 * フェーズ2: 未解決店について tabelog.com/aichi/rstLst/?sw=店名 で検索 → 上位3件を検証
 *   - 店名トークンのスコアリング（core/clean で段階的に）
 *   - 名古屋/愛知県 の住所確認
 *   - 最高スコアの候補を採用（MIN_SCORE = 2）
 *
 * 使い方:
 *   node scripts/resolve_tabelog.js                   # 未解決のみ
 *   node scripts/resolve_tabelog.js --import-only     # Instagram解決キャッシュからのインポートのみ（高速）
 *   node scripts/resolve_tabelog.js --limit 50        # 動作確認用（先頭50件）
 *   node scripts/resolve_tabelog.js --store J000729743 # 特定1店のみ
 *   node scripts/resolve_tabelog.js --force           # キャッシュ無視
 *   node scripts/resolve_tabelog.js --delay 6000      # レート制限対策（ms）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { URLSearchParams } = require('url');

const ROOT = path.resolve(__dirname, '..');
const TABELOG_CACHE = path.join(ROOT, 'data', 'tabelog_resolved.json');
const IG_CACHE = path.join(ROOT, 'data', 'instagram_resolved.json');
const INDEX_HTML = path.join(ROOT, 'index.html');

// MIN_SCOREを下回る場合は採用しない
const MIN_SCORE = 2;

// ─── CLI ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = {
  limit: null,
  force: false,
  importOnly: false,
  store: null,
  delayMs: 4000,
  jitterMs: 2000,
};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (a === '--force') opts.force = true;
  else if (a === '--import-only') opts.importOnly = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
}

// ─── 店名クリーンアップ ────────────────────────────────────────────────
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
    if (
      isHira(last) && isKanji(prev) &&
      prev.length >= 1 && prev.length <= 5 &&
      last.length >= prev.length * 1.5
    ) {
      tokens.pop();
    } else break;
  }
  return tokens.join(' ').replace(/\s+/g, ' ').trim();
}

const GENERIC_PREFIXES = new Set([
  '居酒屋','個室居酒屋','完全個室居酒屋','完全個室','個室','全室個室','全席個室','全席完全個室',
  '海鮮居酒屋','やきとん居酒屋','焼肉ホルモン','焼肉','焼鳥','焼き鳥','やきとり','炭火焼','炭火焼鳥',
  '串焼','串焼き','鉄板焼','鉄板焼き','お好み焼','もんじゃ','和食','新和食','割烹','寿司','鮨','すし',
  '魚介','海鮮','海鮮料理','肉','肉バル','バル','バー','カフェ','レストラン','ビストロ','ダイニング','ダイニングバー',
  '韓国料理','韓国','中華','中華料理','イタリアン','イタリア料理','フレンチ','フランス料理','スペイン料理',
  'タイ料理','ベトナム料理','エスニック','もつ鍋','しゃぶしゃぶ','すきやき','鍋','水炊き','餃子','ラーメン','つけ麺',
  'そば','うどん','定食','食堂','ステーキ','ハンバーグ','ピザ','パスタ','チーズ','ワイン','ワインバー','日本酒',
  '焼酎','クラフトビール','ビアバー','貸切','水槽個室','全室水槽個室','プライベート個室','完全分煙','個室完備',
  '新規開店','完全予約制','飲み放題','食べ飲み放題','食べ放題','飲食店',
]);

function isLocationSuffix(t) {
  if (/店$/.test(t) && t.length >= 2) return true;
  if (/号店$/.test(t) || /号館$/.test(t)) return true;
  if (/^(本店|総本店|別館|新館|分店|別邸)$/.test(t)) return true;
  return false;
}

function coreStoreName(name) {
  const s = cleanStoreName(name);
  if (!s) return '';
  const tokens = s.split(/[\s\u3000]+/).filter(Boolean);
  const filtered = tokens.filter(t => !GENERIC_PREFIXES.has(t) && !isLocationSuffix(t));
  if (filtered.length === 0) return s;
  return filtered.join(' ').trim();
}

function nameHash(name) {
  return crypto.createHash('md5').update(name || '').digest('hex').slice(0, 8);
}

// ─── Tabelog URL バリデーション ──────────────────────────────────────
/**
 * 店舗詳細URLは /aichi/A\d+/A\d+/\d+/ の形式（数値IDで終わる）
 * エリア一覧ページ（/aichi/A2301/A230101/）は除外
 */
function isValidTabelogStoreUrl(url) {
  return /^https:\/\/tabelog\.com\/aichi\/A\d+\/A\d+\/\d{5,}\//.test(url);
}

// ─── ストアロード ────────────────────────────────────────────────────
function loadStores() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const m = html.match(/LOCAL_STORES\s*=\s*(\[)/);
  if (!m) throw new Error('LOCAL_STORES not found');
  const start = m.index + m[0].length - 1;
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
  return JSON.parse(html.slice(start, i + 1));
}

// ─── キャッシュ ──────────────────────────────────────────────────────
function loadCache() {
  if (!fs.existsSync(TABELOG_CACHE)) return {};
  try { return JSON.parse(fs.readFileSync(TABELOG_CACHE, 'utf8')); }
  catch (e) { console.warn('[tabelog-cache]:', e.message); return {}; }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(TABELOG_CACHE), { recursive: true });
  fs.writeFileSync(TABELOG_CACHE, JSON.stringify(cache, null, 2) + '\n');
}

// ─── Phase 1: instagram_resolved.json からインポート ─────────────────
function importFromIgCache(cache) {
  if (!fs.existsSync(IG_CACHE)) {
    console.log('instagram_resolved.json が存在しないためスキップ');
    return 0;
  }
  const igCache = JSON.parse(fs.readFileSync(IG_CACHE, 'utf8'));
  let imported = 0;
  for (const [id, entry] of Object.entries(igCache)) {
    if (entry.tabelogUrl && isValidTabelogStoreUrl(entry.tabelogUrl)) {
      if (!cache[id] || opts.force) {
        cache[id] = {
          store: entry.store,
          tabelog: entry.tabelogUrl,
          method: 'import-from-ig-cache',
          resolvedAt: entry.resolvedAt || new Date().toISOString(),
        };
        imported++;
      }
    }
  }
  return imported;
}

// ─── HTTP ────────────────────────────────────────────────────────────
function fetchHtml(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
        'Accept-Encoding': 'identity',
        ...headers,
      },
      timeout: 25000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        return fetchHtml(next, headers).then(resolve, reject);
      }
      if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// ─── Tabelog 検索 ────────────────────────────────────────────────────
async function tabelogSearch(query) {
  const url = 'https://tabelog.com/aichi/rstLst/?' + new URLSearchParams({ sw: query }).toString();
  const html = await fetchHtml(url);
  // 店舗詳細URLは tabelog.com/aichi/A####/A######/####### 形式
  const urls = (html.match(/https?:\/\/tabelog\.com\/aichi\/A\d+\/A\d+\/\d+\//g) || []);
  const seen = new Set();
  const uniq = [];
  for (const u of urls) {
    const normalized = u.startsWith('http://') ? u.replace('http://', 'https://') : u;
    if (!seen.has(normalized) && isValidTabelogStoreUrl(normalized)) {
      seen.add(normalized);
      uniq.push(normalized);
    }
  }
  return uniq;
}

// ─── 店舗詳細ページのスコアリング ────────────────────────────────────
async function scoreDetailPage(detailUrl, store) {
  const html = await fetchHtml(detailUrl);
  const fullName = store['店名'] || '';
  const cleanName = cleanStoreName(fullName);
  const coreName = coreStoreName(fullName);

  // ページ先頭8000文字でマッチ確認
  const pageStart = html.slice(0, 8000);

  // coreStoreName の各トークンが含まれているか（2点/トークン）
  const coreTokens = coreName.split(/\s+/).filter(t => t.length >= 2);
  let score = 0;
  for (const token of coreTokens) {
    if (pageStart.includes(token)) score += 2;
  }

  // cleanStoreName の追加トークンも加点（1点）
  const cleanTokens = cleanName.split(/\s+/).filter(t => t.length >= 2 && !coreTokens.includes(t));
  for (const token of cleanTokens) {
    if (pageStart.includes(token)) score += 1;
  }

  // 名古屋/愛知県 の住所確認（必須）
  const hasNagoya = html.includes('名古屋') || html.includes('愛知県');

  return {
    url: detailUrl,
    score,
    hasNagoya,
    match: score >= MIN_SCORE && hasNagoya,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── 1店ぶん解決 ─────────────────────────────────────────────────────
async function resolveOne(store) {
  const fullName = store['店名'] || '';
  const cleanName = cleanStoreName(fullName);
  const coreName = coreStoreName(fullName);

  const queries = [
    { method: 'TBG-Q1-core', q: coreName },
    ...(cleanName !== coreName ? [{ method: 'TBG-Q2-clean', q: cleanName }] : []),
  ].filter(x => x.q && x.q.trim().length >= 2);

  let bestResult = null;

  for (const item of queries) {
    try {
      await sleep(opts.delayMs + Math.random() * opts.jitterMs);
      const detailUrls = await tabelogSearch(item.q);
      if (detailUrls.length === 0) continue;

      // 上位3件のみ検証
      for (const detailUrl of detailUrls.slice(0, 3)) {
        await sleep(opts.delayMs / 2 + Math.random() * 1000);
        try {
          const result = await scoreDetailPage(detailUrl, store);
          if (result.match && (!bestResult || result.score > bestResult.score)) {
            bestResult = { ...result, method: item.method };
          }
          if (bestResult && bestResult.score >= 6) break; // 十分なスコア
        } catch (e) {
          console.warn(`    詳細取得失敗 ${detailUrl}: ${e.message}`);
        }
      }
      if (bestResult && bestResult.score >= 6) break; // Q1 で十分なら Q2 をスキップ
    } catch (e) {
      console.warn(`  ${item.method} エラー: ${e.message}`);
    }
  }

  return bestResult;
}

// ─── メイン ──────────────────────────────────────────────────────────
(async () => {
  console.log('食べログ URL 解決スクリプト (resolve_tabelog.js)');
  console.log(`オプション: ${JSON.stringify(opts)}`);

  const stores = loadStores();
  console.log(`総店舗数: ${stores.length}`);

  let cache = loadCache();
  const prevCount = Object.keys(cache).length;
  console.log(`既存キャッシュ: ${prevCount}件`);

  // Phase 1: instagram_resolved.json からインポート
  const imported = importFromIgCache(cache);
  if (imported > 0) {
    console.log(`instagram_resolved.json からインポート: ${imported}件`);
    saveCache(cache);
  }

  const withTabelog = Object.values(cache).filter(v => v.tabelog).length;
  console.log(`インポート後 tabelog URL あり: ${withTabelog}件`);

  if (opts.importOnly) {
    console.log('--import-only のため Web 解決をスキップ');
    return;
  }

  // Phase 2: 未解決店を Tabelog で検索
  let targets = stores;
  if (opts.store) targets = stores.filter(s => s['ホットペッパーID'] === opts.store);
  if (opts.limit) targets = targets.slice(0, opts.limit);

  let resolved = 0, skipped = 0, failed = 0;

  for (const store of targets) {
    const id = store['ホットペッパーID'];
    if (!id) continue;

    const currentHash = nameHash(store['店名']);
    const cached = cache[id];

    // スキップ判定（既に解決済み または 既に失敗を記録済み）
    if (!opts.force && cached) {
      if (cached.tabelog && cached.tabelog.trim()) { skipped++; continue; }
      if (cached.failed && cached.failedBy === 'tabelog') { skipped++; continue; }
    }

    process.stdout.write(`[${id}] ${store['店名']} ... `);

    const result = await resolveOne(store);
    if (result) {
      console.log(`✓ ${result.method} (score=${result.score}): ${result.url}`);
      cache[id] = {
        store: store['店名'],
        tabelog: result.url,
        method: result.method,
        score: result.score,
        resolvedAt: new Date().toISOString(),
      };
      resolved++;
    } else {
      console.log('✗ 解決失敗');
      if (!cached || !cached.tabelog) {
        cache[id] = {
          store: store['店名'],
          failed: true,
          failedBy: 'tabelog',
          resolvedAt: new Date().toISOString(),
        };
      }
      failed++;
    }

    if ((resolved + failed) % 20 === 0) saveCache(cache);
  }

  saveCache(cache);
  const finalCount = Object.values(cache).filter(v => v.tabelog).length;
  console.log(`\n完了: Web解決 ${resolved}件 / スキップ ${skipped}件 / 失敗 ${failed}件`);
  console.log(`キャッシュ合計 (tabelog URL あり): ${finalCount}件`);
})().catch((e) => { console.error(e); process.exit(1); });
