/**
 * gas_line_report.js
 *
 * Google Apps Script（GAS）で動かすスクリプト。
 * GA4 Data API からNAGOYA BITESのアクセスデータを取得し、
 * LINE Messaging API + Gmailの両方でレポートを送信する。
 *
 * =====================================================
 * セットアップ手順
 * =====================================================
 *
 * 【STEP 1】LINE公式アカウント + Messaging API の設定
 *
 *   1. https://manager.line.biz/ にアクセス → LINEアカウントでログイン
 *   2. 「アカウントを作成」→ アカウント名「NAGOYA BITES」
 *   3. 業種: 飲食店・レストラン
 *   4. 作成完了後、右上「設定」→「Messaging API」→「Messaging APIを利用する」
 *   5. プロバイダー名: 「NAGOYA BITES」→ 同意して有効化
 *   6. https://developers.line.biz/console/ にアクセス
 *   7. プロバイダー「NAGOYA BITES」→ チャネル（Messaging API）を選択
 *   8. 「Messaging API設定」タブ → 「チャネルアクセストークン（長期）」を発行
 *   9. トークンをコピー → 下の LINE_CHANNEL_TOKEN に設定
 *   10. LINEアプリでこの公式アカウントを友だち追加する
 *       （Messaging API設定タブのQRコードから）
 *
 *   ※ 自分のLINE User IDの取得方法:
 *   - 「チャネル基本設定」タブ → 「あなたのユーザーID」に表示されている
 *   → 下の LINE_USER_ID に設定
 *
 * 【STEP 2】Google Apps Script にデプロイ
 *   1. https://script.google.com/ で新しいプロジェクトを作成
 *   2. プロジェクト名を「NAGOYA BITES レポート」に変更
 *   3. このファイルの内容をすべてコピー＆ペースト
 *   4. LINE_CHANNEL_TOKEN, LINE_USER_ID を設定
 *   5. 左メニュー「サービス」→「+」→「Google Analytics Data API」を検索して追加
 *   6. 関数「testLineMessage」を選択して ▶ 実行（初回は権限承認が必要）
 *   7. LINEにテストメッセージが届いたことを確認
 *   8. 左メニュー「トリガー」→「+トリガーを追加」
 *      - 関数: sendDailyReport
 *      - イベントソース: 時間主導型
 *      - 時間ベースのトリガー: 日付ベースのタイマー
 *      - 時刻: 午前9時〜10時
 *
 * =====================================================
 */

// ─── 設定（ここを変更する） ───
const GA4_PROPERTY_ID = '143787045';
const LINE_CHANNEL_TOKEN = 'YOUR_CHANNEL_ACCESS_TOKEN';  // Messaging APIのチャネルアクセストークン
const LINE_USER_ID = 'YOUR_LINE_USER_ID';  // あなたのLINE User ID
const REPORT_EMAIL = '';  // Gmail送信も併用する場合はメールアドレスを設定（空ならLINEのみ）
const SITE_URL = 'https://wakuwaku-labs.github.io/nagoya-bites/';

// ─── LINE Messaging API でメッセージ送信 ───
function sendLineMessage(text) {
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: LINE_USER_ID,
    messages: [{ type: 'text', text: text }]
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + LINE_CHANNEL_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  const res = UrlFetchApp.fetch(url, options);
  Logger.log('LINE送信: ' + res.getResponseCode() + ' ' + res.getContentText());
}

// ─── 日次レポート ───
function sendDailyReport() {
  const yesterday = getDateStr(-1);
  const data = fetchGA4Report(yesterday, yesterday);
  const report = formatDailyReport(data, yesterday);

  // LINE送信
  sendLineMessage(report);

  // Gmail送信（併用設定時）
  if (REPORT_EMAIL) {
    GmailApp.sendEmail(REPORT_EMAIL, '📊 NAGOYA BITES 日次レポート ' + yesterday, report);
  }
  Logger.log('日次レポート送信完了');
}

// ─── 週次レポート ───
function sendWeeklyReport() {
  const endDate = getDateStr(-1);
  const startDate = getDateStr(-7);
  const data = fetchGA4Report(startDate, endDate);
  const prevData = fetchGA4Report(getDateStr(-14), getDateStr(-8));
  const report = formatWeeklyReport(data, prevData, startDate, endDate);

  sendLineMessage(report);
  if (REPORT_EMAIL) {
    GmailApp.sendEmail(REPORT_EMAIL, '📊 NAGOYA BITES 週次レポート ' + startDate + '〜' + endDate, report);
  }
  Logger.log('週次レポート送信完了');
}

// ─── GA4 Data API ───
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
    dimensions: [{ name: 'pagePath' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 20,
  }, 'properties/' + GA4_PROPERTY_ID);

  const eventRequest = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [{ name: 'eventCount' }],
    dimensions: [{ name: 'eventName' }],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 30,
  }, 'properties/' + GA4_PROPERTY_ID);

  const sourceRequest = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  }, 'properties/' + GA4_PROPERTY_ID);

  const deviceRequest = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [{ name: 'activeUsers' }],
    dimensions: [{ name: 'deviceCategory' }],
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
  let msg = '📊 NAGOYA BITES 日次レポート\n';
  msg += '📅 ' + date + '\n';
  msg += '━━━━━━━━━━━━━━━\n';
  msg += '👥 ユーザー: ' + t.users + '人\n';
  msg += '📄 PV: ' + t.pageviews + '\n';
  msg += '🔄 セッション: ' + t.sessions + '\n';
  msg += '⏱ 平均滞在: ' + Math.round(t.avgDuration) + '秒\n';
  msg += '↩️ 直帰率: ' + Math.round(t.bounceRate * 100) + '%\n\n';

  msg += '📈 人気ページ TOP5\n';
  data.pages.slice(0, 5).forEach((p, i) => {
    msg += (i+1) + '. ' + pagePathToName(p.dimensions[0]) + ' (' + p.metrics[1] + 'PV)\n';
  });

  const ce = data.events.filter(e =>
    !['page_view','session_start','first_visit','user_engagement','scroll'].includes(e.dimensions[0])
  );
  if (ce.length > 0) {
    msg += '\n🔘 クリック TOP5\n';
    ce.slice(0, 5).forEach((e, i) => {
      msg += (i+1) + '. ' + eventToName(e.dimensions[0]) + ' (' + e.metrics[0] + '回)\n';
    });
  }

  if (data.sources.length > 0) {
    msg += '\n🔗 流入元 TOP3\n';
    data.sources.slice(0, 3).forEach((s, i) => {
      msg += (i+1) + '. ' + s.dimensions[0] + '/' + s.dimensions[1] + ' (' + s.metrics[1] + ')\n';
    });
  }

  if (data.devices.length > 0) {
    msg += '\n📱 デバイス\n';
    const total = data.devices.reduce((sum, d) => sum + parseInt(d.metrics[0]), 0);
    data.devices.forEach(d => {
      const pct = total > 0 ? Math.round(parseInt(d.metrics[0]) / total * 100) : 0;
      msg += d.dimensions[0] + ': ' + pct + '% ';
    });
  }
  return msg;
}

// ─── 週次レポート フォーマット ───
function formatWeeklyReport(data, prevData, startDate, endDate) {
  const t = data.totals;
  const pt = prevData.totals;
  const uc = pt.users > 0 ? Math.round((t.users - pt.users) / pt.users * 100) : 0;
  const pc = pt.pageviews > 0 ? Math.round((t.pageviews - pt.pageviews) / pt.pageviews * 100) : 0;
  const ar = (v) => v > 0 ? '📈+' + v + '%' : v < 0 ? '📉' + v + '%' : '→';

  let msg = '📊 NAGOYA BITES 週次レポート\n';
  msg += '📅 ' + startDate + '〜' + endDate + '\n';
  msg += '━━━━━━━━━━━━━━━\n';
  msg += '👥 ユーザー: ' + t.users + '人 ' + ar(uc) + '\n';
  msg += '📄 PV: ' + t.pageviews + ' ' + ar(pc) + '\n';
  msg += '🔄 セッション: ' + t.sessions + '\n';
  msg += '⏱ 平均滞在: ' + Math.round(t.avgDuration) + '秒\n\n';

  msg += '📈 人気ページ TOP5\n';
  data.pages.slice(0, 5).forEach((p, i) => {
    msg += (i+1) + '. ' + pagePathToName(p.dimensions[0]) + ' (' + p.metrics[1] + 'PV)\n';
  });

  const ce = data.events.filter(e =>
    !['page_view','session_start','first_visit','user_engagement','scroll'].includes(e.dimensions[0])
  );
  if (ce.length > 0) {
    msg += '\n🔘 クリック TOP5\n';
    ce.slice(0, 5).forEach((e, i) => {
      msg += (i+1) + '. ' + eventToName(e.dimensions[0]) + ' (' + e.metrics[0] + '回)\n';
    });
  }
  return msg;
}

// ─── ヘルパー ───
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
    'cta_click': '予約ボタン',
    'cta_gmap_click': 'Googleマップ',
    'modal_open': '店舗詳細',
    'search': '検索',
    'share_x': 'Xシェア',
    'share_line': 'LINEシェア',
    'share_copy': 'リンクコピー',
    'fav_add': 'お気に入り追加',
    'fav_remove': 'お気に入り解除',
  };
  return map[event] || event;
}

// ─── テスト（GASから手動実行） ───
function testLineMessage() {
  sendLineMessage('🧪 NAGOYA BITES レポートのテスト送信です。\nLINE連携が正常に動作しています！\n\n' + SITE_URL);
}
