/**
 * gas_line_report.js
 *
 * Google Apps Script（GAS）で動かすスクリプト。
 * GA4 Data API からNAGOYA BITESのアクセスデータを取得し、
 * LINE Notifyで日次/週次レポートを送信する。
 *
 * =====================================================
 * セットアップ手順
 * =====================================================
 *
 * 【STEP 1】GA4 プロパティを作成
 *   1. https://analytics.google.com/ にアクセス
 *   2. 「管理」→「プロパティを作成」
 *   3. プロパティ名: 「NAGOYA BITES」
 *   4. タイムゾーン: 日本、通貨: 日本円
 *   5. ウェブストリームを作成（URL: https://wakuwaku-labs.github.io/nagoya-bites/）
 *   6. 測定ID（G-XXXXXXXXXX）をメモ → index.html に設置
 *   7. プロパティID（数字のみ）をメモ → 下の GA4_PROPERTY_ID に設定
 *
 * 【STEP 2】LINE Notifyトークンを取得
 *   1. https://notify-bot.line.me/ にLINEアカウントでログイン
 *   2. 「トークンを発行する」をクリック
 *   3. トークン名: 「NAGOYA BITES レポート」
 *   4. 送信先: 「1:1でLINE Notifyから通知を受け取る」 または グループ
 *   5. 発行されたトークンをメモ → 下の LINE_NOTIFY_TOKEN に設定
 *
 * 【STEP 3】Google Apps Script にデプロイ
 *   1. https://script.google.com/ で新しいプロジェクトを作成
 *   2. このファイルの内容をコピー＆ペースト
 *   3. GA4_PROPERTY_ID と LINE_NOTIFY_TOKEN を設定
 *   4. 「サービス」→「Google Analytics Data API」を追加
 *   5. sendDailyReport を実行して動作確認
 *   6. 「トリガー」→ 時間主導型 → 毎日 → 午前9時で設定
 *
 * 【STEP 4】index.html にGA4タグを設置
 *   → setup_ga4.md の手順を参照
 *
 * =====================================================
 */

// ─── 設定（ここを変更する） ───
const GA4_PROPERTY_ID = 'XXXXXXXXX';  // GA4のプロパティID（数字のみ）
const LINE_NOTIFY_TOKEN = 'YOUR_LINE_NOTIFY_TOKEN';  // LINE Notifyのトークン
const SITE_URL = 'https://wakuwaku-labs.github.io/nagoya-bites/';

// ─── 日次レポート（毎朝LINE送信） ───
function sendDailyReport() {
  const yesterday = getDateStr(-1);
  const data = fetchGA4Report(yesterday, yesterday);
  const report = formatDailyReport(data, yesterday);
  sendLineNotify(report);
}

// ─── 週次レポート（毎週月曜LINE送信） ───
function sendWeeklyReport() {
  const endDate = getDateStr(-1);
  const startDate = getDateStr(-7);
  const data = fetchGA4Report(startDate, endDate);
  const prevData = fetchGA4Report(getDateStr(-14), getDateStr(-8));
  const report = formatWeeklyReport(data, prevData, startDate, endDate);
  sendLineNotify(report);
}

// ─── GA4 Data API からデータ取得 ───
function fetchGA4Report(startDate, endDate) {
  const request = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'screenPageViews' },
      { name: 'sessions' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
      { name: 'eventCount' },
    ],
    dimensions: [
      { name: 'pagePath' },
    ],
    orderBys: [
      { metric: { metricName: 'screenPageViews' }, desc: true }
    ],
    limit: 20,
  }, 'properties/' + GA4_PROPERTY_ID);

  // イベント別データ（CTAクリック等）
  const eventRequest = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [
      { name: 'eventCount' },
    ],
    dimensions: [
      { name: 'eventName' },
    ],
    orderBys: [
      { metric: { metricName: 'eventCount' }, desc: true }
    ],
    limit: 30,
  }, 'properties/' + GA4_PROPERTY_ID);

  // 流入元
  const sourceRequest = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
    ],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ],
    orderBys: [
      { metric: { metricName: 'sessions' }, desc: true }
    ],
    limit: 10,
  }, 'properties/' + GA4_PROPERTY_ID);

  // デバイス
  const deviceRequest = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [
      { name: 'activeUsers' },
    ],
    dimensions: [
      { name: 'deviceCategory' },
    ],
  }, 'properties/' + GA4_PROPERTY_ID);

  return {
    pages: parseReport(request),
    events: parseReport(eventRequest),
    sources: parseReport(sourceRequest),
    devices: parseReport(deviceRequest),
    totals: parseTotals(request),
  };
}

function parseReport(response) {
  if (!response.rows) return [];
  return response.rows.map(row => ({
    dimensions: row.dimensionValues.map(d => d.value),
    metrics: row.metricValues.map(m => m.value),
  }));
}

function parseTotals(response) {
  if (!response.totals || !response.totals[0]) return {};
  const vals = response.totals[0].metricValues.map(m => m.value);
  return {
    users: parseInt(vals[0]) || 0,
    pageviews: parseInt(vals[1]) || 0,
    sessions: parseInt(vals[2]) || 0,
    avgDuration: parseFloat(vals[3]) || 0,
    bounceRate: parseFloat(vals[4]) || 0,
    events: parseInt(vals[5]) || 0,
  };
}

// ─── 日次レポート フォーマット ───
function formatDailyReport(data, date) {
  const t = data.totals;
  const duration = Math.round(t.avgDuration);
  const bounce = Math.round(t.bounceRate * 100);

  let msg = `\n📊 NAGOYA BITES 日次レポート\n`;
  msg += `📅 ${date}\n`;
  msg += `━━━━━━━━━━━━━━━\n`;
  msg += `👥 ユーザー数: ${t.users}人\n`;
  msg += `📄 ページビュー: ${t.pageviews}PV\n`;
  msg += `🔄 セッション数: ${t.sessions}\n`;
  msg += `⏱ 平均滞在時間: ${duration}秒\n`;
  msg += `↩️ 直帰率: ${bounce}%\n`;
  msg += `\n`;

  // 人気ページ TOP5
  msg += `📈 人気ページ TOP5\n`;
  data.pages.slice(0, 5).forEach((p, i) => {
    const path = p.dimensions[0];
    const pv = p.metrics[1];
    const name = pagePathToName(path);
    msg += `  ${i + 1}. ${name} (${pv}PV)\n`;
  });
  msg += `\n`;

  // イベント TOP5
  const customEvents = data.events.filter(e =>
    !['page_view', 'session_start', 'first_visit', 'user_engagement', 'scroll'].includes(e.dimensions[0])
  );
  if (customEvents.length > 0) {
    msg += `🔘 ボタンクリック TOP5\n`;
    customEvents.slice(0, 5).forEach((e, i) => {
      const name = eventToName(e.dimensions[0]);
      msg += `  ${i + 1}. ${name} (${e.metrics[0]}回)\n`;
    });
    msg += `\n`;
  }

  // 流入元 TOP3
  if (data.sources.length > 0) {
    msg += `🔗 流入元 TOP3\n`;
    data.sources.slice(0, 3).forEach((s, i) => {
      msg += `  ${i + 1}. ${s.dimensions[0]}/${s.dimensions[1]} (${s.metrics[1]}セッション)\n`;
    });
    msg += `\n`;
  }

  // デバイス比率
  if (data.devices.length > 0) {
    msg += `📱 デバイス比率\n`;
    const total = data.devices.reduce((sum, d) => sum + parseInt(d.metrics[0]), 0);
    data.devices.forEach(d => {
      const pct = Math.round(parseInt(d.metrics[0]) / total * 100);
      const icon = d.dimensions[0] === 'mobile' ? '📱' : d.dimensions[0] === 'desktop' ? '💻' : '📟';
      msg += `  ${icon} ${d.dimensions[0]}: ${pct}%\n`;
    });
  }

  msg += `\n🔗 ${SITE_URL}`;
  return msg;
}

// ─── 週次レポート フォーマット ───
function formatWeeklyReport(data, prevData, startDate, endDate) {
  const t = data.totals;
  const pt = prevData.totals;

  const userChange = pt.users > 0 ? Math.round((t.users - pt.users) / pt.users * 100) : 0;
  const pvChange = pt.pageviews > 0 ? Math.round((t.pageviews - pt.pageviews) / pt.pageviews * 100) : 0;
  const arrow = (v) => v > 0 ? `📈+${v}%` : v < 0 ? `📉${v}%` : '→ 横ばい';

  let msg = `\n📊 NAGOYA BITES 週次レポート\n`;
  msg += `📅 ${startDate} 〜 ${endDate}\n`;
  msg += `━━━━━━━━━━━━━━━\n`;
  msg += `👥 ユーザー: ${t.users}人 ${arrow(userChange)}\n`;
  msg += `📄 PV: ${t.pageviews} ${arrow(pvChange)}\n`;
  msg += `🔄 セッション: ${t.sessions}\n`;
  msg += `⏱ 平均滞在: ${Math.round(t.avgDuration)}秒\n`;
  msg += `↩️ 直帰率: ${Math.round(t.bounceRate * 100)}%\n`;
  msg += `\n`;

  msg += `📈 人気ページ TOP5\n`;
  data.pages.slice(0, 5).forEach((p, i) => {
    msg += `  ${i + 1}. ${pagePathToName(p.dimensions[0])} (${p.metrics[1]}PV)\n`;
  });
  msg += `\n`;

  const customEvents = data.events.filter(e =>
    !['page_view', 'session_start', 'first_visit', 'user_engagement', 'scroll'].includes(e.dimensions[0])
  );
  if (customEvents.length > 0) {
    msg += `🔘 ボタンクリック TOP5\n`;
    customEvents.slice(0, 5).forEach((e, i) => {
      msg += `  ${i + 1}. ${eventToName(e.dimensions[0])} (${e.metrics[0]}回)\n`;
    });
    msg += `\n`;
  }

  if (data.sources.length > 0) {
    msg += `🔗 流入元\n`;
    data.sources.slice(0, 5).forEach((s, i) => {
      msg += `  ${i + 1}. ${s.dimensions[0]}/${s.dimensions[1]} (${s.metrics[1]})\n`;
    });
  }

  msg += `\n🔗 ${SITE_URL}`;
  return msg;
}

// ─── LINE Notify 送信 ───
function sendLineNotify(message) {
  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + LINE_NOTIFY_TOKEN,
    },
    payload: {
      message: message,
    },
  };
  const response = UrlFetchApp.fetch('https://notify-api.line.me/api/notify', options);
  Logger.log('LINE Notify: ' + response.getContentText());
}

// ─── ヘルパー関数 ───
function getDateStr(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function pagePathToName(path) {
  const map = {
    '/nagoya-bites/': 'トップページ',
    '/nagoya-bites/index.html': 'トップページ',
    '/nagoya-bites/features/': '特集一覧',
    '/nagoya-bites/features/index.html': '特集一覧',
    '/nagoya-bites/features/meieki.html': '名駅特集',
    '/nagoya-bites/features/sakae.html': '栄特集',
    '/nagoya-bites/features/banquet.html': '宴会特集',
    '/nagoya-bites/features/private-room.html': '個室特集',
    '/nagoya-bites/features/birthday.html': '誕生日特集',
    '/nagoya-bites/features/date.html': 'デート特集',
    '/nagoya-bites/features/girls-party.html': '女子会特集',
    '/nagoya-bites/features/large-group.html': '大人数特集',
    '/nagoya-bites/about.html': 'About',
    '/nagoya-bites/faq.html': 'Q&A',
    '/nagoya-bites/contact.html': 'Contact',
  };
  return map[path] || path;
}

function eventToName(event) {
  const map = {
    'cta_click': 'ホットペッパー予約ボタン',
    'cta_gmap_click': 'Googleマップボタン',
    'modal_open': '店舗詳細を開く',
    'filter_genre': 'ジャンルフィルター',
    'filter_area': 'エリアフィルター',
    'filter_tag': 'タグフィルター',
    'search': '検索',
    'share_x': 'Xでシェア',
    'share_line': 'LINEでシェア',
    'share_copy': 'リンクコピー',
    'fav_add': 'お気に入り追加',
    'fav_remove': 'お気に入り解除',
    'feature_click': '特集記事クリック',
    'ranking_click': 'ランキングクリック',
    'sort_change': '並び替え変更',
    'geo_search': '現在地検索',
  };
  return map[event] || event;
}

// ─── テスト用（GASエディタから手動実行） ───
function testLineNotify() {
  sendLineNotify('\n🧪 NAGOYA BITES レポートのテスト送信です。\nLINE連携が正常に動作しています！');
}
