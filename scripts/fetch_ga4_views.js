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
}

main().catch(err => {
  console.error('GA4 集計エラー:', err.message);
  // 既存の view_counts.json を残してビルドを継続させる
  process.exit(0);
});
