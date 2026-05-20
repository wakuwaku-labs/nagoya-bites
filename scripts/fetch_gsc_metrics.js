'use strict';
/**
 * fetch_gsc_metrics.js
 *
 * Google Search Console（検索パフォーマンス）API から
 *   - 総計: clicks / impressions / CTR / 平均掲載順位
 *   - トップクエリ（表示回数順）
 *   - トップページ（表示回数順）
 * を取得し data/gsc_metrics.json に書き出す。
 * organic 流入改善（ISSUE-054）の効果測定の本体。GA4(site_metrics) と対になる。
 *
 * 必要な環境変数（未設定時はスキップして 0 で正常終了）:
 *   GA4_SERVICE_ACCOUNT_KEY  サービスアカウント JSON 全文（GA4 と同一キーを流用）
 *   GSC_SITE_URL             GSC プロパティ URL（既定 https://nagoya-bites.com/）
 *                            ドメインプロパティの場合は `sc-domain:nagoya-bites.com`
 *   GSC_LOOKBACK_DAYS        集計期間（既定 28）
 *
 * 連携要件（一度だけ）:
 *   - GSC の「設定 → ユーザーと権限」でサービスアカウントのメール
 *     （xxx@xxx.iam.gserviceaccount.com）を「制限付き」以上で追加
 *   - GCP で「Google Search Console API」を有効化
 *   ※ GA4 用にサービスアカウントは既に存在するため、新規作成は不要。
 *
 * 注記: インデックス被覆数（4,973 URL のうち何件登録されたか）は本 API では
 *   一括取得できない（URL Inspection API は 1URL ずつ・クォータ厳しめ）。
 *   被覆の全体像は当面 GSC 画面で確認する。本スクリプトは「実際に表示・
 *   クリックされているクエリ/ページ」= 実効的にインデックス済みで価値のある面を取得する。
 */

const fs = require('fs');
const path = require('path');

const KEY_RAW  = process.env.GA4_SERVICE_ACCOUNT_KEY;
const SITE_URL = process.env.GSC_SITE_URL || 'https://nagoya-bites.com/';
const LOOKBACK = parseInt(process.env.GSC_LOOKBACK_DAYS || '28', 10);
const OUT_PATH = path.join(__dirname, '..', 'data', 'gsc_metrics.json');

// SEO 健全性の目安（素人判断用）
const BENCHMARKS = {
  ctr:      { good: 0.05, warn: 0.01 },   // クリック率（高いほど良い）
  position: { good: 10,   warn: 20   },   // 平均掲載順位（低いほど良い／10位=1ページ目末尾）
  impressionsPerDay: { weak: 100, healthy: 1000 }, // 1日あたり表示回数の目安
};

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

if (!KEY_RAW) {
  console.log('GA4_SERVICE_ACCOUNT_KEY が未設定。GSC 集計をスキップします。');
  process.exit(0);
}

async function query(searchconsole, body) {
  const res = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: body,
  });
  return res.data.rows || [];
}

async function main() {
  const { google } = require('googleapis');
  const credentials = JSON.parse(KEY_RAW);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  await auth.authorize();

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  // GSC データは 2〜3 日遅延するため、終端は余裕を持たせる
  const startDate = isoDaysAgo(LOOKBACK);
  const endDate = isoDaysAgo(1);
  const dateRange = { startDate, endDate };

  // 1) 総計（ディメンションなし → 1 行）
  const totalRows = await query(searchconsole, { ...dateRange, dimensions: [] });
  const t = totalRows[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const totals = {
    clicks: t.clicks || 0,
    impressions: t.impressions || 0,
    ctr: Math.round((t.ctr || 0) * 10000) / 10000,
    position: Math.round((t.position || 0) * 10) / 10,
    impressionsPerDay: Math.round(((t.impressions || 0) / LOOKBACK) * 10) / 10,
  };

  // 2) トップクエリ（表示回数順）
  const queryRows = await query(searchconsole, {
    ...dateRange, dimensions: ['query'], rowLimit: 25,
    orderBy: [{ field: 'impressions', descending: true }],
  });
  const topQueries = queryRows.map(r => ({
    query: r.keys[0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: Math.round((r.ctr || 0) * 10000) / 10000,
    position: Math.round((r.position || 0) * 10) / 10,
  }));

  // 3) トップページ（表示回数順）
  const pageRows = await query(searchconsole, {
    ...dateRange, dimensions: ['page'], rowLimit: 15,
    orderBy: [{ field: 'impressions', descending: true }],
  });
  const topPages = pageRows.map(r => ({
    page: r.keys[0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: Math.round((r.ctr || 0) * 10000) / 10000,
    position: Math.round((r.position || 0) * 10) / 10,
  }));

  const out = {
    generatedAt: new Date().toISOString(),
    siteUrl: SITE_URL,
    dateRange,
    lookbackDays: LOOKBACK,
    totals,
    topQueries,
    topPages,
    benchmarks: BENCHMARKS,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`gsc_metrics.json 更新: clicks=${totals.clicks} / impressions=${totals.impressions} / CTR=${(totals.ctr*100).toFixed(1)}% / 平均順位=${totals.position}`);
}

main().catch(err => {
  console.error('GSC 集計エラー:', err.message);
  // CI の `git add data/gsc_metrics.json` が落ちないよう、未存在時のみスタブを置く
  if (!fs.existsSync(OUT_PATH)) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      siteUrl: SITE_URL,
      error: err.message,
      hint: 'サービスアカウントを GSC のユーザーに追加し、Search Console API を有効化してください。',
      totals: null,
    }, null, 2));
  }
  process.exit(0);
});
