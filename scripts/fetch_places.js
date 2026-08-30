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
 *     P1: cross_check_flags.json 掲載店（監視対象・毎回の実行で優先消化）
 *     P2: features/*.html 掲載店 + view_counts 閲覧上位（露出中の店）
 *     P3: 残り全店を「最終取得が古い順」（予算内ローテで全店が約3ヶ月周期に収束）
 *   予算: --max-details N > env PLACES_DETAILS_BUDGET > 既定 0（一時停止・下記参照）
 *   対象: 最終 snapshot が STALE_DAYS(25日) より古い店のみ
 *   ガード: 最終 snapshot から 20 日以内は追記せず上書き（週内再実行で履歴が汚れない）
 *
 *   2026-08-15（ISSUE-086）: 実行 workflow を月次(monthly-places.yml)→週次
 *   (weekly-places.yml) に変更。「staleness 経過 → 次の定期実行まで待つ」遅延が
 *   最大30日→最大7日に短縮。
 *
 *   ⚠ 2026-08-15 追記（同日・ユーザー確認事項）: rating/user_ratings_total/reviews は
 *   いずれも Places API の Atmosphere Data カテゴリで、Google が 2025-03 に廃止した
 *   旧・一律 $200/月クレジットの対象ではなく個別 SKU 課金。旧コードコメントの
 *   「無料クレジット$200/月内」は誤り（オーナー未確認のまま走らせていた）。
 *   オーナーが Google Cloud 請求画面で実際の無料枠・クレジット残高を確認するまで、
 *   既定予算を 0（実質一時停止・課金ゼロ）にしている。確認後、実行したい予算件数を
 *   repo variable PLACES_DETAILS_BUDGET に設定して再開すること（docs/places-api-setup.md 参照）。
 *
 * コスト見積（2026-08 更新・実測 5,119 店ベース・週次運用・現在は一時停止中）:
 *   - 新規店パス: Find Place ($17/1000) + Details ($22/1000) — 新規追加分のみで少額
 *     （--refresh とは独立。新規店の初回解決のみで動くため既定では止めていない）
 *   - --refresh: Place Details のみ ($17 Basic + $5 Atmosphere = $22/1000)。
 *     参考: 425 件/週なら月換算1840件 ≈ $40/月（無料枠を消費した場合の上乗せ額。
 *     実際の無料枠残高は要確認）
 *
 * 安全策:
 *   - 住所に「名古屋市」が含まれない候補は採用しない（誤検出排除）
 *   - business_status が CLOSED_PERMANENTLY の店はキャッシュに記録（build.js で除外）
 *   - 100 件ごとに中間保存（途中失敗時のリトライ容易化）
 *
 * プライバシー設計（レビュー本文・投稿者名）:
 *   レビューの生本文・投稿者名は保存しない。公開リポジトリに第三者の本文/氏名を
 *   恒久保存しないため、保存するのは機械検証可能な派生特徴量のみ:
 *     textLen（本文文字数）/ lang（言語コード）/ incentiveHit（インセンティブ誘導語の有無）
 *     textHash（正規化本文のSHA-256先頭16桁・20文字未満はnull）
 *     authorNameHash（投稿者名のSHA-256先頭16桁）
 *   textHash/authorNameHash は非可逆ハッシュで元の文字列は復元できない。用途は
 *   scripts/lib/review_fingerprint.js によるクロス店舗の重複検出（同一文面・同一投稿者名が
 *   無関係な複数店舗に出現していないか）のみで、本文・氏名そのものではなく指紋を保存する。
 *   Google Maps Platform Service Specific Terms（reviews/author情報の warehousing 禁止）に
 *   抵触しないよう、生データはこの関数のスコープを出ない。
 *   語彙リストは INCENTIVE_WORDS_V1 として本ファイルに明示し、features/integrity-method.html で全公開する。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { placesKey } = require('./lib/places_key');
// 店名の同一性判定。写真取得（fetch_manual_store_photos.js）と同じ判定器を共有する。
// ここに店名ゲートが無かったため、Google のあいまい一致が返した**別の店**の
// 評価・口コミ・口コミ信頼度がその店の値として表示されていた（2026-08-30 発覚）。
const { namesMatch, branchConflict } = require('./lib/store_name_match');
const { textFingerprint, authorFingerprint } = require('./lib/review_fingerprint');

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
// snapshot 追記ガード: 最終 snapshot からこの日数以内は追記せず上書き（週内再実行対策）
const SNAPSHOT_GUARD_DAYS = 20;
// --refresh の既定予算（Place Details 呼び出し件数/回・週次実行前提）。
// 2026-08-15: 0（一時停止）。rating/reviews は Atmosphere Data で個別課金対象と判明し、
// 旧コメントが前提にしていた「$200/月無料クレジット」は2025-03に廃止済みだった。
// オーナーが実際の無料枠・クレジット残高を Google Cloud 請求画面で確認するまで
// 意図的に課金を発生させない。再開時は repo variable PLACES_DETAILS_BUDGET に
// 正の値（例: 425＝週次$40相当）を設定する（docs/places-api-setup.md 参照）。
const DEFAULT_DETAILS_BUDGET = 0;

// レビュー本文の派生特徴量（本文そのものは保存しない — ヘッダのプライバシー設計参照）
// 語彙改定時は V2 を作り TEXT_SIGNALS_VERSION を上げる（integrity-method.html も更新）
// v2: textHash/authorNameHash（クロス店舗指紋照合）を追加
const TEXT_SIGNALS_VERSION = 2;
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
  const authorName = typeof r.author_name === 'string' ? r.author_name : '';
  return {
    rating: typeof r.rating === 'number' ? r.rating : null,
    time: typeof r.time === 'number' ? r.time : null,
    relativeTime: r.relative_time_description || '',
    textLen: text.length,
    lang: r.language || r.original_language || null,
    incentiveHit: INCENTIVE_WORDS_V1.test(text),
    textHash: textFingerprint(text),
    authorNameHash: authorFingerprint(authorName),
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
  // name を含めるのは、保存済み placeId が本当にその店を指しているかを毎回検算するため。
  // name は Basic フィールドなので rating 等と同じ課金区分＝追加コストは発生しない。
  const fields = 'name,rating,user_ratings_total,business_status,reviews';
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
    name: typeof result.name === 'string' ? result.name : '',
    rating: typeof result.rating === 'number' ? result.rating : null,
    user_ratings_total: typeof result.user_ratings_total === 'number' ? result.user_ratings_total : null,
    business_status: result.business_status || null,
    latestReviews: (result.reviews || []).map(toReviewRecord)
  };
}

// snapshot 追記（ガード付き）: 最終 snapshot から SNAPSHOT_GUARD_DAYS 以内なら
// 追記せず最新を上書きする。workflow_dispatch を短期間に複数回叩いても履歴が汚れない。
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
// 2026-08-20: Google が稀に formatted_address の市区町村部分だけローマ字表記
// （例: 「愛知県Nagoya-shi名東区」）で返すケースを確認。漢字表記のみを見ていたため
// 実在する名古屋市内の店が住所却下されていた（ISSUE-103調査で発見）。
function validateAddress(placesAddr, storeAddr) {
  if (!placesAddr) return false;
  if (placesAddr.includes('名古屋市')) return true;
  if (/nagoya-shi/i.test(placesAddr)) return true;
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

  // P1: 前回フラグ付き店（監視対象・毎回の実行で優先消化）
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
      } else if (d.name && q.name && (!namesMatch(q.name, d.name).ok || branchConflict(q.name, d.name))) {
        // 保存済み placeId が別の店を指していた。--refresh は Find Place を介さず placeId を
        // 直叩きするため、ここで検算しないと**誤った紐付けが永久に更新され続ける**
        // （2026-08-30 発覚。別店の評価・口コミ・口コミ信頼度が表示されていた）。
        // 値は更新せず rejected に倒し、build.js が適用しないようにする。
        // 次回の通常解決（Find Place ＋ 店名ゲート）で正しい店を引き直す。
        console.warn(`  [${q.id}] ${q.name}: 保存済み placeId が「${d.name}」を指しています → 紐付けを破棄`);
        cache[q.id] = {
          fetchedAt: now,
          rejected: true,
          rejectReason: 'name-mismatch-on-refresh',
          candidateName: d.name,
          previousPlaceId: q.placeId
        };
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
  // 2026-08-20（ISSUE-104）: 従来はホットペッパーID必須で、data/manual_stores.json 由来の
  // 手動キュレーション店（編集部推薦・話題フラグの目玉店に集中）が一律で対象外だった。
  // ホットペッパーIDが無い店も placesKey()（店名+エリア）で識別して対象に含める。
  let queue = stores.filter(s => {
    if (opts.store && s['ホットペッパーID'] !== opts.store) return false;
    if (!s['店名']) return false;
    const key = placesKey(s);
    if (cache[key] && !opts.force) return false;
    return true;
  });
  if (opts.limit) queue = queue.slice(0, opts.limit);
  console.log(`今回取得対象: ${queue.length}件（delay=${opts.delayMs}ms / 推定所要 ${Math.round(queue.length * opts.delayMs / 1000)}秒）`);

  let succeeded = 0, rejected = 0, zeroResults = 0, errors = 0;
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    const id = placesKey(s);
    const name = s['店名'];
    const addr = s['住所'] || s['アクセス'] || '';
    try {
      const candidate = await findPlace(name, addr || '名古屋市');
      if (!candidate) {
        cache[id] = { fetchedAt: new Date().toISOString(), notFound: true };
        zeroResults++;
      } else if (!namesMatch(name, candidate.name).ok || branchConflict(name, candidate.name)) {
        // 住所（名古屋市内か）だけでは「名古屋市内の別の店」を弾けない。
        // findplacefromtext は候補を1件しか返さないため、あいまい一致が外れたときの
        // リカバリが無く、別店の rating / user_ratings_total がそのまま入っていた。
        cache[id] = {
          fetchedAt: new Date().toISOString(),
          rejected: true,
          rejectReason: 'name-mismatch',
          candidateName: candidate.name,
          candidateAddress: candidate.formatted_address
        };
        rejected++;
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
