/**
 * gas_gmail_report.js
 *
 * Google Apps Script（GAS）で動かすスクリプト。
 * GA4 Data API からNAGOYA BITESのアクセスデータを取得し、
 * Gmailで日次/週次レポートを自動送信する。
 *
 * =====================================================
 * セットアップ手順（5分で完了）
 * =====================================================
 *
 * 【STEP 1】GA4のプロパティIDを確認
 *   1. https://analytics.google.com/ にアクセス
 *   2. 左下「管理」→ プロパティ設定 → プロパティの詳細
 *   3. 「プロパティID」（数字）をメモ
 *   → 下の GA4_PROPERTY_ID に設定
 *
 * 【STEP 2】Google Apps Script にデプロイ
 *   1. https://script.google.com/ で新しいプロジェクトを作成
 *   2. プロジェクト名を「NAGOYA BITES レポート」に変更
 *   3. このファイルの内容をすべてコピー＆ペースト
 *   4. GA4_PROPERTY_ID と REPORT_EMAIL を設定
 *   5. 左メニュー「サービス」→「+」→「Google Analytics Data API」を検索して追加
 *   6. 関数「sendDailyReport」を選択して ▶ 実行（初回は権限承認が必要）
 *   7. Gmailにレポートが届いたことを確認
 *   8. 左メニュー「トリガー」→「+トリガーを追加」
 *      - 関数: sendDailyReport
 *      - イベントソース: 時間主導型
 *      - 時間ベースのトリガー: 日付ベースのタイマー
 *      - 時刻: 午前9時〜10時
 *   9. 週次レポートも欲しい場合はもう1つトリガーを追加
 *      - 関数: sendWeeklyReport
 *      - 時間ベースのトリガー: 週ベースのタイマー
 *      - 曜日: 月曜日、時刻: 午前9時〜10時
 *
 * =====================================================
 */

// ─── 設定（ここを変更する） ───
const GA4_PROPERTY_ID = '143787045';  // GA4のプロパティID（ストリーム画面で確認した数字）
const REPORT_EMAIL = '';  // レポート送信先メールアドレス（空なら自分のGmailに送信）
const SITE_URL = 'https://wakuwaku-labs.github.io/nagoya-bites/';

// ─── 日次レポート（毎朝Gmail送信） ───
function sendDailyReport() {
  const yesterday = getDateStr(-1);
  const data = fetchGA4Report(yesterday, yesterday);
  const report = formatDailyReport(data, yesterday);
  const to = REPORT_EMAIL || Session.getActiveUser().getEmail();
  GmailApp.sendEmail(to, '📊 NAGOYA BITES 日次レポート ' + yesterday, report);
  Logger.log('日次レポート送信完了: ' + to);
}

// ─── 週次レポート（毎週月曜Gmail送信） ───
function sendWeeklyReport() {
  const endDate = getDateStr(-1);
  const startDate = getDateStr(-7);
  const data = fetchGA4Report(startDate, endDate);
  const prevData = fetchGA4Report(getDateStr(-14), getDateStr(-8));
  const report = formatWeeklyReport(data, prevData, startDate, endDate);
  const to = REPORT_EMAIL || Session.getActiveUser().getEmail();
  GmailApp.sendEmail(to, '📊 NAGOYA BITES 週次レポート ' + startDate + '〜' + endDate, report);
  Logger.log('週次レポート送信完了: ' + to);
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

  let msg = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  msg += '📊 NAGOYA BITES 日次レポート\n';
  msg += '📅 ' + date + '\n';
  msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  msg += '【サマリー】\n';
  msg += '  👥 ユーザー数:     ' + t.users + '人\n';
  msg += '  📄 ページビュー:   ' + t.pageviews + ' PV\n';
  msg += '  🔄 セッション数:   ' + t.sessions + '\n';
  msg += '  ⏱ 平均滞在時間:   ' + duration + '秒\n';
  msg += '  ↩️ 直帰率:         ' + bounce + '%\n';
  msg += '\n';

  msg += '【人気ページ TOP5】\n';
  data.pages.slice(0, 5).forEach((p, i) => {
    const name = pagePathToName(p.dimensions[0]);
    const pv = p.metrics[1];
    msg += '  ' + (i + 1) + '. ' + name + ' (' + pv + ' PV)\n';
  });
  msg += '\n';

  const customEvents = data.events.filter(e =>
    !['page_view', 'session_start', 'first_visit', 'user_engagement', 'scroll'].includes(e.dimensions[0])
  );
  if (customEvents.length > 0) {
    msg += '【ボタンクリック TOP5】\n';
    customEvents.slice(0, 5).forEach((e, i) => {
      const name = eventToName(e.dimensions[0]);
      msg += '  ' + (i + 1) + '. ' + name + ' (' + e.metrics[0] + '回)\n';
    });
    msg += '\n';
  }

  if (data.sources.length > 0) {
    msg += '【流入元 TOP3】\n';
    data.sources.slice(0, 3).forEach((s, i) => {
      msg += '  ' + (i + 1) + '. ' + s.dimensions[0] + ' / ' + s.dimensions[1] + ' (' + s.metrics[1] + 'セッション)\n';
    });
    msg += '\n';
  }

  if (data.devices.length > 0) {
    msg += '【デバイス比率】\n';
    const total = data.devices.reduce((sum, d) => sum + parseInt(d.metrics[0]), 0);
    data.devices.forEach(d => {
      const pct = total > 0 ? Math.round(parseInt(d.metrics[0]) / total * 100) : 0;
      const icon = d.dimensions[0] === 'mobile' ? '📱' : d.dimensions[0] === 'desktop' ? '💻' : '📟';
      msg += '  ' + icon + ' ' + d.dimensions[0] + ': ' + pct + '%\n';
    });
    msg += '\n';
  }

  msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  msg += '🔗 ' + SITE_URL + '\n';
  msg += '📈 https://analytics.google.com/\n';
  return msg;
}

// ─── 週次レポート フォーマット ───
function formatWeeklyReport(data, prevData, startDate, endDate) {
  const t = data.totals;
  const pt = prevData.totals;
  const userChange = pt.users > 0 ? Math.round((t.users - pt.users) / pt.users * 100) : 0;
  const pvChange = pt.pageviews > 0 ? Math.round((t.pageviews - pt.pageviews) / pt.pageviews * 100) : 0;
  const arrow = (v) => v > 0 ? '📈 +' + v + '%' : v < 0 ? '📉 ' + v + '%' : '→ 横ばい';

  let msg = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  msg += '📊 NAGOYA BITES 週次レポート\n';
  msg += '📅 ' + startDate + ' 〜 ' + endDate + '\n';
  msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  msg += '【サマリー（先週比）】\n';
  msg += '  👥 ユーザー:   ' + t.users + '人 ' + arrow(userChange) + '\n';
  msg += '  📄 PV:         ' + t.pageviews + ' ' + arrow(pvChange) + '\n';
  msg += '  🔄 セッション: ' + t.sessions + '\n';
  msg += '  ⏱ 平均滞在:   ' + Math.round(t.avgDuration) + '秒\n';
  msg += '  ↩️ 直帰率:     ' + Math.round(t.bounceRate * 100) + '%\n\n';

  msg += '【人気ページ TOP5】\n';
  data.pages.slice(0, 5).forEach((p, i) => {
    msg += '  ' + (i + 1) + '. ' + pagePathToName(p.dimensions[0]) + ' (' + p.metrics[1] + ' PV)\n';
  });
  msg += '\n';

  const customEvents = data.events.filter(e =>
    !['page_view', 'session_start', 'first_visit', 'user_engagement', 'scroll'].includes(e.dimensions[0])
  );
  if (customEvents.length > 0) {
    msg += '【ボタンクリック TOP5】\n';
    customEvents.slice(0, 5).forEach((e, i) => {
      msg += '  ' + (i + 1) + '. ' + eventToName(e.dimensions[0]) + ' (' + e.metrics[0] + '回)\n';
    });
    msg += '\n';
  }

  if (data.sources.length > 0) {
    msg += '【流入元】\n';
    data.sources.slice(0, 5).forEach((s, i) => {
      msg += '  ' + (i + 1) + '. ' + s.dimensions[0] + ' / ' + s.dimensions[1] + ' (' + s.metrics[1] + ')\n';
    });
    msg += '\n';
  }

  msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  msg += '🔗 ' + SITE_URL + '\n';
  msg += '📈 https://analytics.google.com/\n';
  return msg;
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
function testReport() {
  const to = REPORT_EMAIL || Session.getActiveUser().getEmail();
  GmailApp.sendEmail(to,
    '🧪 NAGOYA BITES レポートテスト',
    'これはテスト送信です。\nGmail連携が正常に動作しています！\n\n' + SITE_URL
  );
  Logger.log('テスト送信完了: ' + to);
}
