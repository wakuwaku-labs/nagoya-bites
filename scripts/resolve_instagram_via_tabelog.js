#!/usr/bin/env node
/**
 * resolve_instagram_via_tabelog.js
 * Tabelog経由で店舗の公式Instagramアカウントを解決する並行resolver。
 * Yahoo経由（resolve_instagram.js）と並行実行可能、同じキャッシュを共有。
 *
 * 戦略:
 *   1. 各店について Tabelog で検索 (tabelog.com/aichi/rstLst/?sw=店名)
 *   2. トップの店舗詳細URLを取得
 *   3. 詳細ページから instagram.com/<username> を抽出
 *   4. 1件しか出ない場合・店名がマッチした場合のみ採用
 *
 * 使い方:
 *   node scripts/resolve_instagram_via_tabelog.js                # 未解決店のみ
 *   node scripts/resolve_instagram_via_tabelog.js --limit 50    # 動作確認用
 *   node scripts/resolve_instagram_via_tabelog.js --force       # キャッシュ無視
 *   node scripts/resolve_instagram_via_tabelog.js --store J000805511
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

// ─── CLI ───────────────────────────────────────────
const args = process.argv.slice(2);
const opts = { limit: null, force: false, store: null, delayMs: 3000, jitterMs: 1500 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (a === '--force') opts.force = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
}

// ─── 店名クリーンアップ（resolve_instagram.js と同等） ───
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
  let tokens = s.split(/[\s\u3000]+/).filter(Boolean);
  let filtered = tokens.filter(t => !GENERIC_PREFIXES.has(t) && !isLocationSuffix(t));
  if (filtered.length === 0) return s;
  return filtered.join(' ').trim();
}

function nameHash(name) {
  return crypto.createHash('md5').update(name || '').digest('hex').slice(0, 8);
}

// ─── ストアロード（resolve_instagram.js と同じ） ───
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

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch (e) { console.warn('[cache]:', e.message); return {}; }
}
function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
}

// ─── HTTP ───
function fetchHtml(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html', 'Accept-Language': 'ja',
        ...headers,
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).toString();
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

const RESERVED_USERNAMES = new Set([
  'explore','accounts','direct','p','reel','reels','stories','tv','web','tags','about',
  'developer','press','api','help','legal','safety','terms','privacy','session','sessions',
  'graphql','creator','business','oauth','login','signup','emails','web_create_username','fxcal',
]);

function extractInstagramProfileUrls(html) {
  const found = new Map();
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

// ─── Tabelog 検索 → 店舗詳細URL取得 ───
async function tabelogSearch(query) {
  const url = 'https://tabelog.com/aichi/rstLst/?' + new URLSearchParams({ sw: query }).toString();
  const html = await fetchHtml(url);
  // 店舗詳細URLは tabelog.com/aichi/A####/A######/####### 形式
  const urls = (html.match(/https?:\/\/tabelog\.com\/aichi\/A\d+\/A\d+\/\d+\//g) || []);
  // 重複除去・順序保持
  const seen = new Set();
  const uniq = [];
  for (const u of urls) {
    if (!seen.has(u)) { seen.add(u); uniq.push(u); }
  }
  return uniq;
}

// ─── 店舗詳細ページから IG URL 抽出 + 店名検証 ───
async function fetchTabelogDetail(rstUrl, store) {
  const html = await fetchHtml(rstUrl);
  // 店名がページに含まれていることを最低限の関連性チェックとする
  const fullName = store['店名'] || '';
  const cleanName = cleanStoreName(fullName);
  const coreName = coreStoreName(fullName);
  // 詳細ページの店名がマッチするか確認: cleanName か coreName のどちらかが含まれる
  let nameMatch = false;
  for (const candidate of [coreName, cleanName, fullName]) {
    if (candidate && candidate.length >= 2 && html.includes(candidate)) { nameMatch = true; break; }
  }
  if (!nameMatch) return { match: false, urls: [] };

  // 名古屋エリアか確認（住所に含まれているか）
  const addrMatch = html.includes('名古屋') || html.includes('愛知県');

  const igs = extractInstagramProfileUrls(html);
  return { match: true, addrMatch, urls: igs };
}

// ─── 1店ぶん解決 ───
async function resolveOne(store) {
  const fullName = store['店名'] || '';
  const cleanName = cleanStoreName(fullName);
  const coreName = coreStoreName(fullName);
  // 既に食べログURLがある場合はそれを直接使う（検索1回省略）
  const existingTbgUrl = store['食べログURL'] && store['食べログURL'].trim();

  const queries = existingTbgUrl ? [{ method: 'TBG-direct', url: existingTbgUrl }] : [
    { method: 'TBG-Q1-core', q: coreName },
    { method: 'TBG-Q2-clean', q: cleanName !== coreName ? cleanName : null },
  ].filter(x => x.q);

  for (const item of queries) {
    try {
      let detailUrls;
      if (item.url) {
        detailUrls = [item.url];
      } else {
        await sleep(opts.delayMs + Math.random() * opts.jitterMs);
        detailUrls = await tabelogSearch(item.q);
        if (detailUrls.length === 0) continue;
        // 上位3件まで詳細ページを開いて検証
        detailUrls = detailUrls.slice(0, 3);
      }

      for (const detailUrl of detailUrls) {
        await sleep(opts.delayMs + Math.random() * opts.jitterMs);
        try {
          const result = await fetchTabelogDetail(detailUrl, store);
          if (!result.match) continue;
          if (!result.addrMatch) continue;
          if (result.urls.length === 0) continue;
          return {
            instagram: result.urls[0],
            method: item.method,
            tabelogUrl: detailUrl,
            candidates: result.urls.slice(0, 5),
          };
        } catch (e) {
          console.warn(`    [${store['ホットペッパーID']}] 詳細取得失敗 ${detailUrl}: ${e.message}`);
        }
      }
    } catch (e) {
      console.warn(`  [${store['ホットペッパーID']}] ${item.method} エラー: ${e.message}`);
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── メイン ───
(async () => {
  console.log('Tabelog経由 Instagram解決スクリプト');
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
    if (store['Instagram'] && store['Instagram'].trim() && !opts.force) { skipped++; continue; }
    const cached = cache[id];
    const currentHash = nameHash(store['店名']);
    // 既に IG解決済みはスキップ。failed のみのレコードは Tabelog で再試行する。
    if (!opts.force && cached && cached.nameHash === currentHash && cached.instagram) {
      skipped++;
      continue;
    }
    // Tabelogで既に試行済み（failedBy: 'tabelog'）かつ instagram なしならスキップ（再試行しない）
    if (!opts.force && cached && cached.nameHash === currentHash && cached.failed && cached.failedBy === 'tabelog') {
      skipped++;
      continue;
    }
    process.stdout.write(`[${id}] ${store['店名']} ... `);
    const result = await resolveOne(store);
    if (result) {
      console.log(`✓ ${result.method}: ${result.instagram}`);
      cache[id] = {
        store: store['店名'],
        nameHash: currentHash,
        instagram: result.instagram,
        method: result.method,
        tabelogUrl: result.tabelogUrl,
        candidates: result.candidates,
        resolvedAt: new Date().toISOString(),
      };
      resolved++;
    } else {
      console.log('✗ 解決失敗');
      // Tabelog で見つからなかった = 同じレコードを上書きしない
      // （Yahoo で後から成功する可能性があるため）
      // ただし完全に試行したことは記録
      if (!cached || !cached.instagram) {
        cache[id] = {
          store: store['店名'],
          nameHash: currentHash,
          failed: true,
          failedBy: 'tabelog',
          resolvedAt: new Date().toISOString(),
        };
      }
      failed++;
    }
    if ((resolved + failed) % 10 === 0) saveCache(cache);
  }
  saveCache(cache);
  console.log(`\n完了: 解決 ${resolved}件 / スキップ ${skipped}件 / 失敗 ${failed}件`);
})().catch((e) => { console.error(e); process.exit(1); });
