#!/usr/bin/env node
/**
 * fetch_places.js
 *
 * Google Places API (Find Place from Text) で各店舗の評価値・件数・営業ステータスを
 * 取得して data/places_resolved.json にキャッシュする。
 *
 * 用途: ISSUE-048（スコア信頼度）Step 2。Sheets 手動入力の Google評価 から
 *      公式 API 取得への移行と、レビュー件数 user_ratings_total の補完で
 *      S1（★ vs 件数比率）と S2（件数絶対値）シグナルを正規化する。
 *
 * 環境変数:
 *   GOOGLE_PLACES_API_KEY  必須。未設定の場合は exit 0 でスキップ（ワークフロー失敗扱いにしない）。
 *
 * 使い方:
 *   node scripts/fetch_places.js                # 既キャッシュをスキップして未解決のみ取得（新規店向け）
 *   node scripts/fetch_places.js --force        # 全店を再取得
 *   node scripts/fetch_places.js --limit 50     # 動作確認用（先頭50件）
 *   node scripts/fetch_places.js --store J000729743  # 特定1店のみ
 *   node scripts/fetch_places.js --delay 200    # レート対策（ms, 既定 150）
 *
 *   node scripts/fetch_places.js --refresh      # ★既存店の定期再取得（S7 時系列蓄積の本丸）
 *   node scripts/fetch_places.js --refresh --max-details 30  # 予算を明示（動作確認用）
 *
 * --refresh モード（TRUST SCORE 精度向上・S7a 蘇生）:
 *   従来は「キャッシュ済みならスキップ」のため places_history.json の snapshots が
 *   全店 1 個のまま増えず、S7（時系列健全性）と openingBurstPattern 検出が死んでいた。
 *   --refresh は placeId 既知の店を Find Place なしで Place Details 直叩きし、
 *   snapshot を追記する。優先度付き・予算制御:
 *     P1: cross_check_flags.json 掲載店（監視対象は必ず月次で更新）
 *     P2: features/*.html 掲載店 + view_counts 閲覧上位（露出中の店）
 *     P3: 残り全店を「最終取得が古い順」（予算内ローテで全店が約3ヶ月周期に収束）
 *   予算: --max-details N > env PLACES_DETAILS_BUDGET > 既定 1700
 *   対象: 最終 snapshot が STALE_DAYS(25日) より古い店のみ
 *   ガード: 最終 snapshot から 20 日以内は追記せず上書き（月内再実行で履歴が汚れない）
 *
 * コスト見積（2026-08 更新・実測 5,119 店ベース）:
 *   - 新規店パス: Find Place ($17/1000) + Details ($22/1000) — 新規追加分のみで少額
 *   - --refresh: Place Details のみ ($17 Basic + $5 Atmosphere = $22/1000)
 *     予算 1700 件/月（既定・階層化運用）≈ $37/月 — 無料クレジット $200/月 内
 *     全店月次にする場合は PLACES_DETAILS_BUDGET=6000 ≈ $113/月（写真取得等と合算注意）
 *
 * 安全策:
 *   - 住所に「名古屋市」が含まれない候補は採用しない（誤検出排除）
 *   - business_status が CLOSED_PERMANENTLY の店はキャッシュに記録（build.js で除外）
 *   - 100 件ごとに中間保存（途中失敗時のリトライ容易化）
 *
 * プライバシー設計（レビュー本文）:
 *   レビューの生本文は保存しない。公開リポジトリに第三者の本文を恒久保存しないため、
 *   保存するのは機械検証可能な派生特徴量のみ:
 *     textLen（本文文字数）/ lang（言語コード）/ incentiveHit（インセンティブ誘導語の有無）
 *   語彙リストは INCENTIVE_WORDS_V1 として本ファイルに明示し、features/integrity-method.html で全公開する。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const PLACES_CACHE = path.join(ROOT, 'data', 'places_resolved.json');
const PLACES_HISTORY = path.join(ROOT, 'data', 'places_history.json');
const INDEX_HTML = path.join(ROOT, 'index.html');
const FLAGS_PATH = path.join(ROOT, 'data', 'cross_check_flags.json');
const VIEW_COUNTS_PATH = path.join(ROOT, 'data', 'view_counts.json');
const FEATURES_DIR = path.join(ROOT, 'features');
// 月次履歴のリングバッファ長（12 ヶ月分保持）
const HISTORY_MAX_SNAPSHOTS = 12;
// --refresh の再取得判定: 最終 snapshot がこれより古い店だけをキューに載せる
const STALE_DAYS = 25;
// snapshot 追記ガード: 最終 snapshot からこの日数以内は追記せず上書き（月内再実行対策）
const SNAPSHOT_GUARD_DAYS = 20;
// --refresh の既定予算（Place Details 呼び出し件数/回）。階層化運用 ≈ $37/月。
const DEFAULT_DETAILS_BUDGET = 1700;

// レビュー本文の派生特徴量（本文そのものは保存しない — ヘッダのプライバシー設計参照）
// 語彙改定時は V2 を作り TEXT_SIGNALS_VERSION を上げる（integrity-method.html も更新）
const TEXT_SIGNALS_VERSION = 1;
const INCENTIVE_WORDS_V1 = /クーポン|割引|プレゼント|特典|キャンペーン|投稿で|レビューを書(?:い|く)|フォローで|無料/;

// ─── CLI ───
const args = process.argv.slice(2);
const opts = { limit: null, force: false, store: null, delayMs: 150, refresh: false, maxDetails: null };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (a === '--force') opts.force = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
  else if (a === '--refresh') opts.refresh = true;
  else if (a === '--max-details') opts.maxDetails = parseInt(args[++i], 10);
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

// Google Places "Find Place from Text" で place_id を解決（fields は最小限）
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

// Places API の review オブジェクト → 保存用レコード（本文は破棄し派生特徴量のみ保存）
// 旧形式（textLen 等なし）との後方互換は読み手（build.js / cross_check.js）が optional 扱いで担保
function toReviewRecord(r) {
  const text = typeof r.text === 'string' ? r.text : '';
  return {
    rating: typeof r.rating === 'number' ? r.rating : null,
    time: typeof r.time === 'number' ? r.time : null,
    relativeTime: r.relative_time_description || '',
    textLen: text.length,
    lang: r.language || r.original_language || null,
    incentiveHit: INCENTIVE_WORDS_V1.test(text),
    textSignalsVersion: TEXT_SIGNALS_VERSION
  };
}

// Place Details で最新 5 件のレビューを取得
// ISSUE-049: スコア信頼度 S7（時系列健全性）と S8（評価分布自然性）に使用
async function fetchPlaceDetails(placeId) {
  const fields = 'reviews';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&language=ja&reviews_no_translations=true&key=${API_KEY}`;
  const res = await fetchJson(url);
  if (res.status === 'OVER_QUERY_LIMIT' || res.status === 'REQUEST_DENIED') {
    throw new Error(`Places Details API ${res.status}: ${res.error_message || '(no message)'}`);
  }
  if (res.status !== 'OK' && res.status !== 'ZERO_RESULTS') {
    return [];
  }
  const reviews = (res.result && res.result.reviews) || [];
  return reviews.map(toReviewRecord);
}

// --refresh 用: Find Place を介さず Place Details 1 コールで snapshot + レビューを取得
// fields に rating/user_ratings_total/business_status を含めることで Find Place 分のコストが浮く
async function fetchDetailsForRefresh(placeId) {
  const fields = 'rating,user_ratings_total,business_status,reviews';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&language=ja&reviews_no_translations=true&key=${API_KEY}`;
  const res = await fetchJson(url);
  if (res.status === 'OVER_QUERY_LIMIT' || res.status === 'REQUEST_DENIED') {
    throw new Error(`Places Details API ${res.status}: ${res.error_message || '(no message)'}`);
  }
  if (res.status === 'NOT_FOUND') return { notFound: true };
  if (res.status !== 'OK') {
    throw new Error(`Places Details API status=${res.status} | ${res.error_message || ''}`);
  }
  const result = res.result || {};
  return {
    rating: typeof result.rating === 'number' ? result.rating : null,
    user_ratings_total: typeof result.user_ratings_total === 'number' ? result.user_ratings_total : null,
    business_status: result.business_status || null,
    latestReviews: (result.reviews || []).map(toReviewRecord)
  };
}

// snapshot 追記（ガード付き）: 最終 snapshot から SNAPSHOT_GUARD_DAYS 以内なら
// 追記せず最新を上書きする。workflow_dispatch を月内に複数回叩いても履歴が汚れない。
function appendSnapshot(history, id, snap) {
  if (!history[id]) history[id] = { snapshots: [] };
  const snaps = history[id].snapshots;
  const last = snaps[snaps.length - 1];
  const guardMs = SNAPSHOT_GUARD_DAYS * 24 * 60 * 60 * 1000;
  if (last && last.ts && (Date.parse(snap.ts) - Date.parse(last.ts)) < guardMs) {
    snaps[snaps.length - 1] = snap;
  } else {
    snaps.push(snap);
  }
  if (snaps.length > HISTORY_MAX_SNAPSHOTS) {
    history[id].snapshots = snaps.slice(-HISTORY_MAX_SNAPSHOTS);
  }
}

// 住所マッチ: 名古屋市が両方に含まれていれば採用
// （誤検出を排除するための最低限のサニティチェック）
function validateAddress(placesAddr, storeAddr) {
  if (!placesAddr) return false;
  if (placesAddr.includes('名古屋市')) return true;
  if (storeAddr && placesAddr.includes(storeAddr.slice(0, 10))) return true;
  return false;
}

// ISSUE-015-P2 第二段: data/stores.json を canonical として読込、無ければ index.html フォールバック
const { loadStores: loadStoresShared } = require('./lib/load_stores');
function loadStoresFromIndex() {
  return loadStoresShared();
}

function readJsonSafe(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

// --refresh の優先度キュー構築。
// 戻り値: [{ id, name, placeId, lastTs, tier }] を tier 昇順 → tier 内は規定順でソート済み
function buildRefreshQueue(stores, cache, history) {
  const now = Date.now();
  const staleMs = STALE_DAYS * 24 * 60 * 60 * 1000;

  // P1: 前回フラグ付き店（監視対象は必ず月次更新）
  const flagged = new Set();
  const flagsData = readJsonSafe(FLAGS_PATH, null);
  if (flagsData && Array.isArray(flagsData.flags)) {
    for (const f of flagsData.flags) {
      if (f['ホットペッパーID']) flagged.add(f['ホットペッパーID']);
    }
  }

  // P2a: 特集掲載店（features/*.html に店名が出現する店 = サイトで露出中）
  let featuresText = '';
  try {
    for (const f of fs.readdirSync(FEATURES_DIR)) {
      if (f.endsWith('.html')) featuresText += fs.readFileSync(path.join(FEATURES_DIR, f), 'utf8');
    }
  } catch (e) { /* features なしでも動く */ }

  // P2b: 閲覧上位（view_counts.json は 店名 キー）
  const viewCounts = readJsonSafe(VIEW_COUNTS_PATH, {});
  const counts = (viewCounts && viewCounts.counts) || {};

  const queue = [];
  for (const s of stores) {
    const id = s['ホットペッパーID'];
    const name = s['店名'];
    if (!id || !name) continue;
    if (opts.store && id !== opts.store) continue;
    const entry = cache[id];
    if (!entry || !entry.placeId) continue; // placeId 未解決は新規店パス（Find Place）の担当
    const snaps = (history[id] && history[id].snapshots) || [];
    const last = snaps[snaps.length - 1];
    const lastTs = last && last.ts ? Date.parse(last.ts) : 0;
    if (lastTs && (now - lastTs) < staleMs) continue; // 鮮度十分ならスキップ
    let tier = 3;
    if (flagged.has(id)) tier = 1;
    else if ((name.length >= 4 && featuresText.includes(name)) || counts[name]) tier = 2;
    queue.push({ id, name, placeId: entry.placeId, lastTs, views: counts[name] || 0, tier });
  }
  queue.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.tier === 2 && a.views !== b.views) return b.views - a.views; // 露出中は閲覧多い順
    return a.lastTs - b.lastTs; // 古い順（P3 はこれで全店ローテが自然に回る）
  });
  return queue;
}

// --refresh 本体: placeId 既知店の snapshot / latestReviews を予算内で更新
async function runRefresh(stores, cache, history) {
  const budget = opts.maxDetails != null ? opts.maxDetails
    : (parseInt(process.env.PLACES_DETAILS_BUDGET, 10) || DEFAULT_DETAILS_BUDGET);
  const full = buildRefreshQueue(stores, cache, history);
  const queue = full.slice(0, budget);
  const tierCount = t => queue.filter(q => q.tier === t).length;
  console.log(`refresh 対象: ${full.length}件（stale > ${STALE_DAYS}日） / 予算 ${budget}件`);
  console.log(`  今回消化: ${queue.length}件（P1フラグ店=${tierCount(1)} P2露出店=${tierCount(2)} P3ローテ=${tierCount(3)}）`);
  if (full.length > budget) {
    console.log(`  予算超過分 ${full.length - budget}件は次回実行時に「古い順」で自動的に順番が来る`);
  }

  let succeeded = 0, notFound = 0, errors = 0;
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    try {
      const d = await fetchDetailsForRefresh(q.placeId);
      const now = new Date().toISOString();
      if (d.notFound) {
        // placeId が失効（店の Google 掲載終了等）— キャッシュに印だけ付けて snapshot は積まない
        cache[q.id].detailsNotFoundAt = now;
        notFound++;
      } else {
        cache[q.id] = {
          ...cache[q.id],
          fetchedAt: now,
          rating: d.rating,
          user_ratings_total: d.user_ratings_total,
          business_status: d.business_status,
          latestReviews: d.latestReviews
        };
        delete cache[q.id].detailsNotFoundAt;
        appendSnapshot(history, q.id, {
          ts: now,
          rating: d.rating,
          total: d.user_ratings_total,
          businessStatus: d.business_status
        });
        if (d.latestReviews.length > 0) history[q.id].latestReviews = d.latestReviews;
        succeeded++;
      }
    } catch (e) {
      console.error(`  [${q.id}] ${q.name}: ${e.message}`);
      errors++;
      if (/REQUEST_DENIED|OVER_QUERY_LIMIT/.test(e.message)) {
        console.error('API キーまたはクォータ問題のため中断します');
        break;
      }
    }
    if ((i + 1) % 100 === 0) {
      console.log(`  進捗: ${i + 1}/${queue.length} (OK=${succeeded} 失効=${notFound} エラー=${errors})`);
      fs.writeFileSync(PLACES_CACHE, JSON.stringify(cache, null, 2), 'utf8');
      fs.writeFileSync(PLACES_HISTORY, JSON.stringify(history, null, 2), 'utf8');
    }
    await sleep(opts.delayMs);
  }

  fs.writeFileSync(PLACES_CACHE, JSON.stringify(cache, null, 2), 'utf8');
  fs.writeFileSync(PLACES_HISTORY, JSON.stringify(history, null, 2), 'utf8');
  const multi = Object.values(history).filter(h => h && Array.isArray(h.snapshots) && h.snapshots.length >= 2).length;
  console.log(`refresh 完了: 成功${succeeded} / placeId失効${notFound} / エラー${errors}`);
  console.log(`snapshots ≥2 の店舗数: ${multi}（S7 時系列判定はここが増えるほど効き始める）`);
  console.log(`キャッシュ書き込み: ${PLACES_CACHE}`);
  console.log(`月次履歴書き込み: ${PLACES_HISTORY}`);
}

async function main() {
  const stores = loadStoresFromIndex();
  console.log(`LOCAL_STORES: ${stores.length}件`);

  // 既存キャッシュ（最新スナップショット）
  // --refresh は既存 placeId が前提のため --force を併用されてもキャッシュは破棄しない
  let cache = {};
  if (fs.existsSync(PLACES_CACHE) && (!opts.force || opts.refresh)) {
    try {
      cache = JSON.parse(fs.readFileSync(PLACES_CACHE, 'utf8'));
      console.log(`既存キャッシュ: ${Object.keys(cache).length}件（--force で再取得）`);
    } catch (e) {
      console.warn(`既存キャッシュ読み込み失敗: ${e.message} — 新規作成します`);
      cache = {};
    }
  }

  // 月次履歴（time-series 用・リングバッファ 12 ヶ月分）
  let history = {};
  if (fs.existsSync(PLACES_HISTORY)) {
    try {
      history = JSON.parse(fs.readFileSync(PLACES_HISTORY, 'utf8'));
      console.log(`月次履歴: ${Object.keys(history).length}件分の履歴を読込`);
    } catch (e) {
      console.warn(`月次履歴読み込み失敗: ${e.message} — 新規作成します`);
      history = {};
    }
  }

  // --refresh モード: 既存店の定期再取得（Find Place パスとは独立）
  if (opts.refresh) {
    await runRefresh(stores, cache, history);
    return;
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
        // Place Details で最新 5 件のレビューを取得（S7・S8 用）
        let latestReviews = [];
        if (candidate.place_id) {
          try {
            latestReviews = await fetchPlaceDetails(candidate.place_id);
          } catch (detailErr) {
            console.warn(`  [${id}] Place Details 失敗: ${detailErr.message}`);
            if (/REQUEST_DENIED|OVER_QUERY_LIMIT/.test(detailErr.message)) throw detailErr;
          }
          await sleep(opts.delayMs);
        }
        const now = new Date().toISOString();
        cache[id] = {
          fetchedAt: now,
          placeId: candidate.place_id,
          name: candidate.name,
          formatted_address: candidate.formatted_address,
          rating: candidate.rating != null ? candidate.rating : null,
          user_ratings_total: candidate.user_ratings_total != null ? candidate.user_ratings_total : null,
          business_status: candidate.business_status || null,
          latestReviews: latestReviews
        };
        // 月次履歴に追加（リングバッファ・追記ガード付き）
        appendSnapshot(history, id, {
          ts: now,
          rating: candidate.rating != null ? candidate.rating : null,
          total: candidate.user_ratings_total != null ? candidate.user_ratings_total : null,
          businessStatus: candidate.business_status || null
        });
        // 最新レビューも history に上書き保存（古いものは破棄）
        if (latestReviews.length > 0) history[id].latestReviews = latestReviews;
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
      fs.writeFileSync(PLACES_HISTORY, JSON.stringify(history, null, 2), 'utf8');
    }
    await sleep(opts.delayMs);
  }

  // 最終保存
  fs.writeFileSync(PLACES_CACHE, JSON.stringify(cache, null, 2), 'utf8');
  fs.writeFileSync(PLACES_HISTORY, JSON.stringify(history, null, 2), 'utf8');
  console.log(`完了: 成功${succeeded} / 住所却下${rejected} / 該当なし${zeroResults} / エラー${errors}`);
  console.log(`キャッシュ書き込み: ${PLACES_CACHE}`);
  console.log(`月次履歴書き込み: ${PLACES_HISTORY}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
