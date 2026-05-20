'use strict';
/**
 * fetch_ga4_views.js
 *
 * GA4 Data API から「modal_open」イベントを店舗別に集計し、
 * data/view_counts.json に書き出す。
 * build.js が各店舗レコードに「閲覧数」フィールドを焼き込み、
 * index.html の buildRanking() がこれを基にグローバル閲覧数ランキングを描画する。
 *
 * 必要な環境変数（未設定時はスキップして 0 で正常終了）:
 *   GA4_SERVICE_ACCOUNT_KEY  サービスアカウント JSON 全文（GitHub Secrets 想定）
 *   GA4_PROPERTY_ID          GA4 プロパティ ID（数字のみ）
 *   GA4_LOOKBACK_DAYS        集計期間（既定 30）
 *
 * GA4 設定要件:
 *   - 「store_name」をカスタムディメンション（イベントスコープ）に登録済みであること
 *   - サービスアカウントに該当プロパティの「閲覧者」権限を付与済みであること
 */

const fs = require('fs');
const path = require('path');

const KEY_RAW    = process.env.GA4_SERVICE_ACCOUNT_KEY;
const PROPERTY   = process.env.GA4_PROPERTY_ID;
const LOOKBACK   = parseInt(process.env.GA4_LOOKBACK_DAYS || '30', 10);
const OUT_PATH   = path.join(__dirname, '..', 'data', 'view_counts.json');
const METRICS_OUT_PATH = path.join(__dirname, '..', 'data', 'site_metrics.json');

// 良し悪しの目安（地域グルメメディアの素人判断用ベンチマーク）
const BENCHMARKS = {
  bounceRate:      { good: 0.50, warn: 0.70 },  // 直帰率（低いほど良い）
  avgDuration:     { good: 60,   warn: 30   },  // 平均滞在秒（高いほど良い）
  pagesPerSession: { good: 2.0,  warn: 1.3  },  // 1訪問あたりページ数
  monthlyUU:       { phase0: 500, takeoff: 3000, healthy: 15000 }, // 月間UUの段階目安
};

if (!KEY_RAW || !PROPERTY) {
  console.log('GA4_SERVICE_ACCOUNT_KEY または GA4_PROPERTY_ID が未設定。GA4 集計をスキップします。');
  process.exit(0);
}

async function main() {
  const { google } = require('googleapis');
  const credentials = JSON.parse(KEY_RAW);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  await auth.authorize();

  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });

  const res = await analyticsdata.properties.runReport({
    property: `properties/${PROPERTY}`,
    requestBody: {
      dimensions: [{ name: 'customEvent:store_name' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'modal_open' },
        },
      },
      dateRanges: [{ startDate: `${LOOKBACK}daysAgo`, endDate: 'today' }],
      limit: '5000',
    },
  });

  const counts = {};
  for (const row of res.data.rows || []) {
    const name = row.dimensionValues[0].value;
    if (!name || name === '(not set)') continue;
    counts[name] = (counts[name] || 0) + parseInt(row.metricValues[0].value, 10);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const out = {
    generatedAt: new Date().toISOString(),
    lookbackDays: LOOKBACK,
    eventName: 'modal_open',
    totalEvents: total,
    counts,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`view_counts.json 更新: ${Object.keys(counts).length} 店舗 / 合計 ${total} イベント`);

  // サイト全体メトリクス（PV/UU/セッション/流入元/トップページ）は別レポート。
  // ここで失敗しても modal_open 集計（上記）は確定済みなので握りつぶす。
  try {
    await fetchSiteMetrics(analyticsdata);
  } catch (e) {
    console.error('site_metrics 集計エラー（view_counts は維持）:', e.message);
    // CI の `git add data/site_metrics.json` が pathspec エラーで落ちないよう、
    // 既存ファイルが無い時だけ最小スタブを置く（既存データは絶対に上書きしない）。
    if (!fs.existsSync(METRICS_OUT_PATH)) {
      fs.writeFileSync(METRICS_OUT_PATH, JSON.stringify({
        generatedAt: new Date().toISOString(),
        lookbackDays: LOOKBACK,
        error: e.message,
        totals: null,
      }, null, 2));
    }
  }
}

// 流入元を organic / direct / social / referral / other に分類
function classifyChannel(source, medium) {
  const s = (source || '').toLowerCase();
  const m = (medium || '').toLowerCase();
  if (m === 'organic') return 'organic';
  if (s === '(direct)' || m === '(none)' || m === '(not set)') return 'direct';
  if (m === 'referral') {
    if (/twitter|t\.co|x\.com|instagram|facebook|line|tiktok|youtube/.test(s)) return 'social';
    return 'referral';
  }
  if (/twitter|t\.co|x\.com|instagram|facebook|line|tiktok|youtube/.test(s)) return 'social';
  if (m === 'cpc' || m === 'paid') return 'paid';
  return 'other';
}

async function fetchSiteMetrics(analyticsdata) {
  const dateRanges = [{ startDate: `${LOOKBACK}daysAgo`, endDate: 'today' }];

  // 1) サイト全体トータル（ディメンションなし → 1行のトータル）
  const totalsRes = await analyticsdata.properties.runReport({
    property: `properties/${PROPERTY}`,
    requestBody: {
      dateRanges,
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    },
  });
  const tv = (totalsRes.data.rows && totalsRes.data.rows[0])
    ? totalsRes.data.rows[0].metricValues.map(v => v.value)
    : ['0', '0', '0', '0', '0'];
  const totals = {
    activeUsers: parseInt(tv[0], 10) || 0,
    pageViews: parseInt(tv[1], 10) || 0,
    sessions: parseInt(tv[2], 10) || 0,
    avgSessionDuration: Math.round((parseFloat(tv[3]) || 0) * 10) / 10,
    bounceRate: Math.round((parseFloat(tv[4]) || 0) * 1000) / 1000,
    pagesPerSession: (parseInt(tv[2], 10) || 0) > 0
      ? Math.round((parseInt(tv[1], 10) / parseInt(tv[2], 10)) * 100) / 100
      : 0,
  };

  // 2) 流入元（source × medium）
  const srcRes = await analyticsdata.properties.runReport({
    property: `properties/${PROPERTY}`,
    requestBody: {
      dateRanges,
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: '50',
    },
  });
  const channels = { organic: 0, direct: 0, social: 0, referral: 0, paid: 0, other: 0 };
  const sourceBreakdown = [];
  for (const row of srcRes.data.rows || []) {
    const source = row.dimensionValues[0].value;
    const medium = row.dimensionValues[1].value;
    const sessions = parseInt(row.metricValues[1].value, 10) || 0;
    channels[classifyChannel(source, medium)] += sessions;
    sourceBreakdown.push({ source, medium, sessions });
  }
  const srcTotal = Object.values(channels).reduce((a, b) => a + b, 0);
  const channelPct = {};
  for (const k of Object.keys(channels)) {
    channelPct[k] = srcTotal > 0 ? Math.round((channels[k] / srcTotal) * 1000) / 10 : 0;
  }

  // 3) トップ5ランディング（pagePath を PV 順に）
  const pageRes = await analyticsdata.properties.runReport({
    property: `properties/${PROPERTY}`,
    requestBody: {
      dateRanges,
      metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }],
      dimensions: [{ name: 'pagePath' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: '5',
    },
  });
  const topPages = (pageRes.data.rows || []).map(row => ({
    path: row.dimensionValues[0].value,
    pageViews: parseInt(row.metricValues[0].value, 10) || 0,
    sessions: parseInt(row.metricValues[1].value, 10) || 0,
  }));

  // 月間UUの段階自動判定
  const uu = totals.activeUsers;
  let stage = 'phase0';
  if (uu >= BENCHMARKS.monthlyUU.healthy) stage = 'strong';
  else if (uu >= BENCHMARKS.monthlyUU.takeoff) stage = 'healthy';
  else if (uu >= BENCHMARKS.monthlyUU.phase0) stage = 'takeoff';

  const metricsOut = {
    generatedAt: new Date().toISOString(),
    lookbackDays: LOOKBACK,
    totals,
    channels: { sessions: channels, pct: channelPct },
    sourceBreakdown: sourceBreakdown.slice(0, 10),
    topPages,
    stageAssessment: { metric: 'activeUsers', value: uu, stage, thresholds: BENCHMARKS.monthlyUU },
    benchmarks: BENCHMARKS,
  };

  fs.writeFileSync(METRICS_OUT_PATH, JSON.stringify(metricsOut, null, 2));
  console.log(`site_metrics.json 更新: UU=${uu} / PV=${totals.pageViews} / Sessions=${totals.sessions} / 段階=${stage}`);
}

main().catch(err => {
  console.error('GA4 集計エラー:', err.message);
  // 既存の view_counts.json を残してビルドを継続させる
  process.exit(0);
});
