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
const GA4_PROPERTY_ID = '533244445';
const LINE_CHANNEL_TOKEN = 'fgb0xGLaxbkgsFJoo2u/911FxfqiTwi7inkVDVElNUeZ4Usg2BhM18ocCiFVOZsxaKX6UqqB5NeFscV784eEFUOD9VhBtnUi/wV/0/kM62Z/ooyJW3whgeZVWFAHiF6MNbx07c8ZEgyPOLzI0pd1MQdB04t89/1O/w1cDnyilFU=';
const LINE_USER_ID = 'Ufa1112c027c42c13193f30ada3988b24';
const REPORT_EMAIL = '';  // Gmail送信も併用する場合はメールアドレスを設定（空ならLINEのみ）
const SITE_URL = 'https://wakuwaku-labs.github.io/nagoya-bites/';

// ─── LINE Messaging API でメッセージ送信 ───
function sendLineMessage(text) {
  if (!text || typeof text !== 'string' || text.length === 0) {
    Logger.log('LINE送信スキップ: textが空です');
    return;
  }
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: LINE_USER_ID,
    messages: [{ type: 'text', text: String(text) }]
  };
  const body = JSON.stringify(payload);
  Logger.log('送信body(先頭200): ' + body.substring(0, 200));
  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + LINE_CHANNEL_TOKEN,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    payload: body,
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

// ─── 健全性の基準値（素人でも良し悪しがわかる目安） ───
const BENCHMARKS = {
  bounceRate:      { good: 0.50, warn: 0.70 },  // 直帰率（低いほど良い）
  avgDuration:     { good: 60,   warn: 30   },  // 平均滞在秒（高いほど良い）
  pagesPerSession: { good: 2.0,  warn: 1.3  },  // 1訪問あたりページ数
  ctaRate:         { good: 0.03, warn: 0.01 },  // 予約ボタンクリック率（クリック/訪問者）
};

// 値を信号機アイコンに変換
function healthIcon(value, bench, reverseLowerIsBetter) {
  if (reverseLowerIsBetter) {
    if (value <= bench.good) return '🟢';
    if (value <= bench.warn) return '🟡';
    return '🔴';
  }
  if (value >= bench.good) return '🟢';
  if (value >= bench.warn) return '🟡';
  return '🔴';
}

// 秒数を「◯分◯秒」に変換
function secToText(sec) {
  const s = Math.round(sec);
  if (s < 60) return s + '秒';
  return Math.floor(s / 60) + '分' + (s % 60) + '秒';
}

// 曜日を日本語に
function weekdayJa(dateStr) {
  const w = ['日','月','火','水','木','金','土'];
  return w[new Date(dateStr).getDay()];
}

// 流入元を素人向け表記に
function sourceToName(src, medium) {
  const s = (src || '').toLowerCase();
  const m = (medium || '').toLowerCase();
  if (s === 'google' && m === 'organic') return 'Google検索';
  if (s === 'yahoo' && m === 'organic') return 'Yahoo検索';
  if (s === 'bing' && m === 'organic')  return 'Bing検索';
  if (m === 'organic') return s + '検索';
  if (s === '(direct)' || m === '(none)') return '直接アクセス（お気に入り等）';
  if (s.includes('t.co') || s.includes('twitter') || s.includes('x.com')) return 'X（旧Twitter）';
  if (s.includes('instagram')) return 'Instagram';
  if (s.includes('facebook')) return 'Facebook';
  if (s.includes('line')) return 'LINE';
  if (m === 'referral') return s + '（他サイトから）';
  return s + ' / ' + m;
}

function deviceToName(d) {
  if (d === 'mobile') return '📱 スマホ';
  if (d === 'desktop') return '💻 パソコン';
  if (d === 'tablet') return '📱 タブレット';
  return d;
}

// データを分析して各種指標を計算
function analyze(data) {
  const t = data.totals;
  const pps = t.sessions > 0 ? t.pageviews / t.sessions : 0;

  const nonBaseEvents = data.events.filter(e =>
    !['page_view','session_start','first_visit','user_engagement','scroll'].includes(e.dimensions[0])
  );
  const ctaEvent = data.events.find(e => e.dimensions[0] === 'cta_click');
  const gmapEvent = data.events.find(e => e.dimensions[0] === 'cta_gmap_click');
  const modalEvent = data.events.find(e => e.dimensions[0] === 'modal_open');
  const ctaCount = ctaEvent ? parseInt(ctaEvent.metrics[0]) : 0;
  const gmapCount = gmapEvent ? parseInt(gmapEvent.metrics[0]) : 0;
  const modalCount = modalEvent ? parseInt(modalEvent.metrics[0]) : 0;
  const ctaRate = t.users > 0 ? ctaCount / t.users : 0;

  // 流入元の内訳
  const srcTotal = data.sources.reduce((s, r) => s + parseInt(r.metrics[1] || 0), 0);
  let organicSessions = 0;
  let directSessions = 0;
  let socialSessions = 0;
  data.sources.forEach(r => {
    const src = (r.dimensions[0] || '').toLowerCase();
    const med = (r.dimensions[1] || '').toLowerCase();
    const ses = parseInt(r.metrics[1] || 0);
    if (med === 'organic') organicSessions += ses;
    else if (src === '(direct)' || med === '(none)') directSessions += ses;
    else if (/twitter|t\.co|x\.com|instagram|facebook|line/.test(src)) socialSessions += ses;
  });
  const organicPct = srcTotal > 0 ? organicSessions / srcTotal : 0;
  const socialPct = srcTotal > 0 ? socialSessions / srcTotal : 0;

  // デバイス
  const devTotal = data.devices.reduce((s, d) => s + parseInt(d.metrics[0]), 0);
  const mobile = data.devices.find(d => d.dimensions[0] === 'mobile');
  const mobilePct = devTotal > 0 && mobile ? parseInt(mobile.metrics[0]) / devTotal : 0;

  return {
    pagesPerSession: pps,
    nonBaseEvents,
    ctaCount, gmapCount, modalCount, ctaRate,
    organicPct, socialPct, mobilePct,
    srcTotal, devTotal,
  };
}

// 改善アドバイスを自動生成
function generateAdvice(data, a) {
  const tips = [];
  const t = data.totals;

  // 直帰率
  if (t.bounceRate > BENCHMARKS.bounceRate.warn) {
    tips.push('🔴 直帰率が高すぎます。トップページの第一印象（写真・キャッチコピー・表示速度）を見直しましょう');
  } else if (t.bounceRate > BENCHMARKS.bounceRate.good) {
    tips.push('🟡 直帰率やや高め。ファーストビューに「何のサイトか」が伝わる一言を追加を検討');
  }

  // 滞在時間
  if (t.avgDuration < BENCHMARKS.avgDuration.warn) {
    tips.push('🔴 滞在時間が短すぎます。見せたい情報が埋もれていないか・重いページがないかチェック');
  }

  // 1訪問あたりページ数
  if (a.pagesPerSession < BENCHMARKS.pagesPerSession.warn) {
    tips.push('🟡 1人が見るページ数が少なめ。関連店舗・関連特集への導線を強化すると回遊が伸びます');
  }

  // 予約ボタンクリック率
  if (t.users >= 20) {
    if (a.ctaRate < BENCHMARKS.ctaRate.warn) {
      tips.push('🔴 予約ボタンがほぼ押されていません。ボタンの位置・色・文言を見直し');
    } else if (a.ctaRate < BENCHMARKS.ctaRate.good) {
      tips.push('🟡 予約クリック率が業界平均以下。店舗カードの上にも予約導線を追加してみては？');
    }
  }

  // 流入元
  if (a.srcTotal >= 20) {
    if (a.organicPct < 0.30) {
      tips.push('🔴 Google検索からの流入が少なめ。特集記事のタイトル・見出しにキーワード（「名古屋 宴会」等）を盛り込みましょう');
    } else if (a.organicPct >= 0.70) {
      tips.push('🟢 Google検索からの流入が強い。SEOは順調、このまま特集記事を増やして拡大を');
    }
    if (a.socialPct < 0.05) {
      tips.push('🟡 SNSからの流入がほぼゼロ。X/Instagramで新着店舗や特集を週1回でも投稿を');
    }
  }

  // デバイス
  if (a.mobilePct > 0.85) {
    tips.push('💡 訪問者の9割近くがスマホ。PCでの見栄えより、スマホでの片手操作・タップしやすさを最優先に');
  }

  // トップページの偏り
  const topPage = data.pages[0];
  if (topPage && t.pageviews > 0) {
    const topPct = parseInt(topPage.metrics[1]) / t.pageviews;
    if (topPct > 0.75) {
      tips.push('🟡 トップページに人が集中しすぎ。特集記事や店舗詳細への導線が弱い可能性');
    }
  }

  // 特集ページが伸びている場合
  const featurePage = data.pages.find(p => /features\//.test(p.dimensions[0]));
  if (featurePage && parseInt(featurePage.metrics[1]) >= 20) {
    tips.push('🟢 特集「' + pagePathToName(featurePage.dimensions[0]) + '」が伸びてます。同テーマのSNS投稿・類似特集の追加でさらに強化を');
  }

  if (tips.length === 0) {
    tips.push('🟢 目立った課題なし。このまま運用を継続しつつ、特集記事の追加で流入の幅を広げましょう');
  }

  return tips.slice(0, 4);  // LINE長すぎ防止
}

// 全体の一言まとめ
function overallVerdict(data, a) {
  const t = data.totals;
  let score = 0;
  if (t.bounceRate <= BENCHMARKS.bounceRate.good) score++;
  else if (t.bounceRate > BENCHMARKS.bounceRate.warn) score--;
  if (t.avgDuration >= BENCHMARKS.avgDuration.good) score++;
  else if (t.avgDuration < BENCHMARKS.avgDuration.warn) score--;
  if (a.pagesPerSession >= BENCHMARKS.pagesPerSession.good) score++;
  else if (a.pagesPerSession < BENCHMARKS.pagesPerSession.warn) score--;
  if (t.users >= 20 && a.ctaRate >= BENCHMARKS.ctaRate.good) score++;
  else if (t.users >= 20 && a.ctaRate < BENCHMARKS.ctaRate.warn) score--;

  if (t.users < 5) return '😶 訪問者がまだ少なく判定困難';
  if (score >= 2) return '🟢 好調です！この調子で';
  if (score <= -2) return '🔴 苦戦中 — テコ入れが必要';
  return '🟡 普通 — 改善余地あり';
}

// ─── 日次レポート フォーマット（素人向け） ───
function formatDailyReport(data, date) {
  const t = data.totals;
  const a = analyze(data);

  let msg = '📊 NAGOYA BITES｜昨日のサイト状況\n';
  msg += '📅 ' + date + '（' + weekdayJa(date) + '）\n';
  msg += '━━━━━━━━━━━━━━━\n';
  msg += '🏁 一言: ' + overallVerdict(data, a) + '\n\n';

  msg += '【サイトの人気度】\n';
  msg += '👥 訪問した人: ' + t.users + '人\n';
  msg += '📄 見られたページ数: ' + t.pageviews + '\n';
  msg += '　└ 1人あたり ' + a.pagesPerSession.toFixed(1) + 'ページ ' +
    healthIcon(a.pagesPerSession, BENCHMARKS.pagesPerSession) + '\n';
  msg += '⏱ 平均滞在時間: ' + secToText(t.avgDuration) + ' ' +
    healthIcon(t.avgDuration, BENCHMARKS.avgDuration) + '\n';
  msg += '　（30秒未満＝読まれてない危険信号）\n';
  msg += '↩️ すぐ帰った人の割合: ' + Math.round(t.bounceRate * 100) + '% ' +
    healthIcon(t.bounceRate, BENCHMARKS.bounceRate, true) + '\n';
  msg += '　（70%超＝要注意、50%未満＝良好）\n\n';

  msg += '【人気だったページ TOP5】\n';
  data.pages.slice(0, 5).forEach((p, i) => {
    const medal = ['🥇','🥈','🥉','④','⑤'][i] || (i+1);
    msg += medal + ' ' + pagePathToName(p.dimensions[0]) + '（' + p.metrics[1] + '回閲覧）\n';
  });

  if (a.nonBaseEvents.length > 0) {
    msg += '\n【ユーザーの行動】\n';
    if (a.modalCount) msg += '👀 店舗詳細を開いた: ' + a.modalCount + '回\n';
    if (a.ctaCount)   msg += '🔘 予約ボタン押した: ' + a.ctaCount + '回\n';
    if (a.gmapCount)  msg += '🗺 マップ開いた: ' + a.gmapCount + '回\n';
    if (t.users >= 20) {
      msg += '　→ 訪問100人あたり予約行動 約' + (a.ctaRate * 100).toFixed(1) + '人 ' +
        healthIcon(a.ctaRate, BENCHMARKS.ctaRate) + '\n';
    }
  }

  if (data.sources.length > 0) {
    msg += '\n【どこから来た？ TOP3】\n';
    data.sources.slice(0, 3).forEach((s, i) => {
      const medal = ['🥇','🥈','🥉'][i];
      const pct = a.srcTotal > 0 ? Math.round(parseInt(s.metrics[1]) / a.srcTotal * 100) : 0;
      msg += medal + ' ' + sourceToName(s.dimensions[0], s.dimensions[1]) +
        '（' + s.metrics[1] + '訪問 / ' + pct + '%）\n';
    });
  }

  if (data.devices.length > 0) {
    msg += '\n【デバイス】\n';
    data.devices.forEach(d => {
      const pct = a.devTotal > 0 ? Math.round(parseInt(d.metrics[0]) / a.devTotal * 100) : 0;
      msg += deviceToName(d.dimensions[0]) + ': ' + pct + '%  ';
    });
    msg += '\n';
  }

  msg += '\n━━━━━━━━━━━━━━━\n';
  msg += '💡 今日のアドバイス\n';
  generateAdvice(data, a).forEach(tip => { msg += '・' + tip + '\n'; });

  return msg;
}

// ─── 週次レポート フォーマット（素人向け） ───
function formatWeeklyReport(data, prevData, startDate, endDate) {
  const t = data.totals;
  const pt = prevData.totals;
  const a = analyze(data);
  const uc = pt.users > 0 ? Math.round((t.users - pt.users) / pt.users * 100) : 0;
  const pc = pt.pageviews > 0 ? Math.round((t.pageviews - pt.pageviews) / pt.pageviews * 100) : 0;
  const sc = pt.sessions > 0 ? Math.round((t.sessions - pt.sessions) / pt.sessions * 100) : 0;
  const arrow = (v) => v >= 20 ? '🚀 +' + v + '%' :
                       v > 5   ? '📈 +' + v + '%' :
                       v >= -5 ? '→ ' + (v >= 0 ? '+' : '') + v + '%' :
                       v > -20 ? '📉 ' + v + '%' : '⚠️ ' + v + '%';

  let msg = '📊 NAGOYA BITES｜週次レポート\n';
  msg += '📅 ' + startDate + ' 〜 ' + endDate + '\n';
  msg += '（先週比: ' + getDateStr(-14) + '〜' + getDateStr(-8) + '）\n';
  msg += '━━━━━━━━━━━━━━━\n';
  msg += '🏁 一言: ' + overallVerdict(data, a) + '\n\n';

  msg += '【今週 vs 先週】\n';
  msg += '👥 訪問者: ' + t.users + '人（先週 ' + pt.users + '人）' + arrow(uc) + '\n';
  msg += '📄 閲覧数: ' + t.pageviews + '（先週 ' + pt.pageviews + '）' + arrow(pc) + '\n';
  msg += '🔄 訪問回数: ' + t.sessions + '（先週 ' + pt.sessions + '）' + arrow(sc) + '\n';
  msg += '⏱ 平均滞在: ' + secToText(t.avgDuration) + ' ' +
    healthIcon(t.avgDuration, BENCHMARKS.avgDuration) + '\n';
  msg += '↩️ すぐ帰った率: ' + Math.round(t.bounceRate * 100) + '% ' +
    healthIcon(t.bounceRate, BENCHMARKS.bounceRate, true) + '\n\n';

  msg += '【人気ページ TOP5】\n';
  data.pages.slice(0, 5).forEach((p, i) => {
    const medal = ['🥇','🥈','🥉','④','⑤'][i] || (i+1);
    msg += medal + ' ' + pagePathToName(p.dimensions[0]) + '（' + p.metrics[1] + '回）\n';
  });

  if (a.nonBaseEvents.length > 0) {
    msg += '\n【ユーザーの行動】\n';
    if (a.modalCount) msg += '👀 店舗詳細: ' + a.modalCount + '回\n';
    if (a.ctaCount)   msg += '🔘 予約ボタン: ' + a.ctaCount + '回\n';
    if (a.gmapCount)  msg += '🗺 マップ: ' + a.gmapCount + '回\n';
  }

  if (data.sources.length > 0) {
    msg += '\n【流入元 TOP3】\n';
    data.sources.slice(0, 3).forEach((s, i) => {
      const medal = ['🥇','🥈','🥉'][i];
      const pct = a.srcTotal > 0 ? Math.round(parseInt(s.metrics[1]) / a.srcTotal * 100) : 0;
      msg += medal + ' ' + sourceToName(s.dimensions[0], s.dimensions[1]) + '（' + pct + '%）\n';
    });
  }

  msg += '\n━━━━━━━━━━━━━━━\n';
  msg += '💡 今週のアドバイス\n';
  generateAdvice(data, a).forEach(tip => { msg += '・' + tip + '\n'; });

  // 成長の判定
  if (pt.users >= 10) {
    msg += '\n📌 成長ステータス: ';
    if (uc >= 20) msg += '🚀 急成長中';
    else if (uc > 5) msg += '📈 順調に伸びてます';
    else if (uc >= -5) msg += '→ 横ばい（次の一手が必要）';
    else msg += '📉 減速中（原因調査を）';
    msg += '\n';
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
