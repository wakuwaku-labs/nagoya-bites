#!/usr/bin/env node
/**
 * fetch_places.js
 *
 * Google Places API (Find Place from Text) で各店舗の評価値・件数・営業ステータスを
 * 取得して data/places_resolved.json にキャッシュする。
 *
 * 用途: ISSUE-048（クロスチェック整合度）Step 2。Sheets 手動入力の Google評価 から
 *      公式 API 取得への移行と、レビュー件数 user_ratings_total の補完で
 *      S1（★ vs 件数比率）と S2（件数絶対値）シグナルを正規化する。
 *
 * 環境変数:
 *   GOOGLE_PLACES_API_KEY  必須。未設定の場合は exit 0 でスキップ（ワークフロー失敗扱いにしない）。
 *
 * 使い方:
 *   node scripts/fetch_places.js                # 既キャッシュをスキップして未解決のみ取得
 *   node scripts/fetch_places.js --force        # 全店を再取得
 *   node scripts/fetch_places.js --limit 50     # 動作確認用（先頭50件）
 *   node scripts/fetch_places.js --store J000729743  # 特定1店のみ
 *   node scripts/fetch_places.js --delay 200    # レート対策（ms, 既定 150）
 *
 * コスト見積（2026 時点）:
 *   - Find Place from Text + fields (rating,user_ratings_total,business_status)
 *     ≈ $17/1000 リクエスト（Place Search SKU 扱い）
 *   - 1100 店 × 月1回 = 1100 リクエスト = $18.7/月
 *   - Google Cloud の $200/月 無料クレジット内に収まる
 *
 * 安全策:
 *   - 住所に「名古屋市」が含まれない候補は採用しない（誤検出排除）
 *   - business_status が CLOSED_PERMANENTLY の店はキャッシュに記録（build.js で除外）
 *   - 100 件ごとに中間保存（途中失敗時のリトライ容易化）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const PLACES_CACHE = path.join(ROOT, 'data', 'places_resolved.json');
const INDEX_HTML = path.join(ROOT, 'index.html');

// ─── CLI ───
const args = process.argv.slice(2);
const opts = { limit: null, force: false, store: null, delayMs: 150 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (a === '--force') opts.force = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
if (!API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY 未設定 — 何もせず終了します。');
  console.error('GitHub Secrets またはローカル環境変数で設定してください。');
  process.exit(0);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message} | body[0..200]: ${data.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

// Google Places "Find Place from Text" を 1 リクエストで叩く
// fields に rating, user_ratings_total, business_status を含めることで詳細リクエストを節約
async function findPlace(name, address) {
  const query = encodeURIComponent(`${name} ${address}`.trim());
  const fields = 'place_id,name,formatted_address,rating,user_ratings_total,business_status';
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=${fields}&language=ja&region=jp&key=${API_KEY}`;
  const res = await fetchJson(url);
  if (res.status === 'OVER_QUERY_LIMIT' || res.status === 'REQUEST_DENIED') {
    throw new Error(`Places API ${res.status}: ${res.error_message || '(no message)'}`);
  }
  if (res.status !== 'OK' && res.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API status=${res.status} | ${res.error_message || ''}`);
  }
  return (res.candidates && res.candidates[0]) || null;
}

// 住所マッチ: 名古屋市が両方に含まれていれば採用
// （誤検出を排除するための最低限のサニティチェック）
function validateAddress(placesAddr, storeAddr) {
  if (!placesAddr) return false;
  if (placesAddr.includes('名古屋市')) return true;
  if (storeAddr && placesAddr.includes(storeAddr.slice(0, 10))) return true;
  return false;
}

function loadStoresFromIndex() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const match = html.match(/var LOCAL_STORES = (\[.+?\]);/s);
  if (!match) throw new Error('LOCAL_STORES not found in index.html');
  return JSON.parse(match[1]);
}

async function main() {
  const stores = loadStoresFromIndex();
  console.log(`LOCAL_STORES: ${stores.length}件`);

  // 既存キャッシュ
  let cache = {};
  if (fs.existsSync(PLACES_CACHE) && !opts.force) {
    try {
      cache = JSON.parse(fs.readFileSync(PLACES_CACHE, 'utf8'));
      console.log(`既存キャッシュ: ${Object.keys(cache).length}件（--force で再取得）`);
    } catch (e) {
      console.warn(`既存キャッシュ読み込み失敗: ${e.message} — 新規作成します`);
      cache = {};
    }
  }

  // 取得対象
  let queue = stores.filter(s => {
    if (opts.store && s['ホットペッパーID'] !== opts.store) return false;
    if (!s['店名']) return false;
    if (!s['ホットペッパーID']) return false;
    if (cache[s['ホットペッパーID']] && !opts.force) return false;
    return true;
  });
  if (opts.limit) queue = queue.slice(0, opts.limit);
  console.log(`今回取得対象: ${queue.length}件（delay=${opts.delayMs}ms / 推定所要 ${Math.round(queue.length * opts.delayMs / 1000)}秒）`);

  let succeeded = 0, rejected = 0, zeroResults = 0, errors = 0;
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    const id = s['ホットペッパーID'];
    const name = s['店名'];
    const addr = s['住所'] || '';
    try {
      const candidate = await findPlace(name, addr || '名古屋市');
      if (!candidate) {
        cache[id] = { fetchedAt: new Date().toISOString(), notFound: true };
        zeroResults++;
      } else if (!validateAddress(candidate.formatted_address, addr)) {
        cache[id] = {
          fetchedAt: new Date().toISOString(),
          rejected: true,
          rejectReason: 'address-mismatch',
          candidateName: candidate.name,
          candidateAddress: candidate.formatted_address
        };
        rejected++;
      } else {
        cache[id] = {
          fetchedAt: new Date().toISOString(),
          placeId: candidate.place_id,
          name: candidate.name,
          formatted_address: candidate.formatted_address,
          rating: candidate.rating != null ? candidate.rating : null,
          user_ratings_total: candidate.user_ratings_total != null ? candidate.user_ratings_total : null,
          business_status: candidate.business_status || null
        };
        succeeded++;
      }
    } catch (e) {
      console.error(`  [${id}] ${name}: ${e.message}`);
      cache[id] = { fetchedAt: new Date().toISOString(), error: e.message };
      errors++;
      // 重大エラー（API キー無効・クォータ超過）は即停止
      if (/REQUEST_DENIED|OVER_QUERY_LIMIT/.test(e.message)) {
        console.error('API キーまたはクォータ問題のため中断します');
        break;
      }
    }
    // 進捗ログ・中間保存（100件ごと）
    if ((i + 1) % 100 === 0) {
      console.log(`  進捗: ${i + 1}/${queue.length} (OK=${succeeded} 却下=${rejected} なし=${zeroResults} エラー=${errors})`);
      fs.writeFileSync(PLACES_CACHE, JSON.stringify(cache, null, 2), 'utf8');
    }
    await sleep(opts.delayMs);
  }

  // 最終保存
  fs.writeFileSync(PLACES_CACHE, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`完了: 成功${succeeded} / 住所却下${rejected} / 該当なし${zeroResults} / エラー${errors}`);
  console.log(`キャッシュ書き込み: ${PLACES_CACHE}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
