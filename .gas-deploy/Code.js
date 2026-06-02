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
 * 【STEP 9】（推奨）AIアドバイスを有効化する ― 無料でOK
 *   未設定でも動くが、設定すると「今日のアドバイス」をAIがその日の実データから
 *   具体的に書く（未設定時は内蔵のルールエンジンが動く）。
 *   1日1回のこの用途なら Gemini の無料枠で十分・完全無料・品質も実用十分。
 *
 *   ◆ 無料で始める（Gemini・推奨）
 *     1. https://aistudio.google.com/apikey でAPIキーを無料発行（Googleアカウントのみ）
 *     2. GASエディタ左「プロジェクトの設定（歯車）」→「スクリプト プロパティ」
 *     3. プロパティを追加: GEMINI_API_KEY = （発行したキー）
 *        （任意）GEMINI_MODEL = gemini-2.5-flash（未指定ならこの既定値）
 *     4. 関数「testAiAdvice」を実行し、LINEにAI生成アドバイスが届けば成功
 *
 *   ◆ Claudeを使う場合（有料・任意）
 *     ANTHROPIC_API_KEY を同様に設定。GEMINI と両方ある場合は Gemini を優先。
 *
 * =====================================================
 */

// ─── 設定（ここを変更する） ───
const GA4_PROPERTY_ID = '533244445';
const LINE_CHANNEL_TOKEN = 'fgb0xGLaxbkgsFJoo2u/911FxfqiTwi7inkVDVElNUeZ4Usg2BhM18ocCiFVOZsxaKX6UqqB5NeFscV784eEFUOD9VhBtnUi/wV/0/kM62Z/ooyJW3whgeZVWFAHiF6MNbx07c8ZEgyPOLzI0pd1MQdB04t89/1O/w1cDnyilFU=';
const LINE_USER_ID = 'Ufa1112c027c42c13193f30ada3988b24';
const REPORT_EMAIL = 'wakato1251999@gmail.com';  // Gmail送信も併用（空ならLINEのみ）。日次/週次レポートをメール化し、スケジュール起動したClaudeが読んでSEOトリアージ→Notion自動同期する入口にする
const SITE_URL = 'https://nagoya-bites.com/';
// 重要: このGASプロジェクトは単一スクリプトファイル（Code.js）で運用する。
// 同期ツールが作る重複ファイル（"Code 2.js" 等）がプロジェクトに混入すると、
// 同じ const/関数の二重宣言で "preparing top level objects" エラーになりコンパイル全体が落ちる。

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
  // 本番ドメインのみ集計（localhost / プレビュー環境を除外）
  const HOST_FILTER = {
    filter: {
      fieldName: 'hostName',
      stringFilter: { matchType: 'EXACT', value: 'nagoya-bites.com' },
    },
  };

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
    dimensionFilter: HOST_FILTER,
    metricAggregations: ['TOTAL'],  // totals を返すために必須
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 20,
  }, 'properties/' + GA4_PROPERTY_ID);

  const eventRequest = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [{ name: 'eventCount' }],
    dimensions: [{ name: 'eventName' }],
    dimensionFilter: HOST_FILTER,
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 30,
  }, 'properties/' + GA4_PROPERTY_ID);

  const sourceRequest = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    dimensionFilter: HOST_FILTER,
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  }, 'properties/' + GA4_PROPERTY_ID);

  const deviceRequest = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [{ name: 'activeUsers' }],
    dimensions: [{ name: 'deviceCategory' }],
    dimensionFilter: HOST_FILTER,
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
  const zero = { users: 0, pageviews: 0, sessions: 0, avgDuration: 0, bounceRate: 0, events: 0 };
  if (!response.totals || !response.totals[0] || !response.totals[0].metricValues) return zero;
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

// ─── アドバイス生成（AI主・ルールベース保険のハイブリッド） ───
// Script Properties に ANTHROPIC_API_KEY を入れると Claude がその日の実データから
// 具体策を書く。未設定 or 失敗時は下の強化版ルールエンジンに自動フォールバックする。
function generateAdvice(data, a, date, isWeekly) {
  const ai = generateAiAdvice(data, a, date, isWeekly);
  if (ai && ai.length) return ai;
  return generateRuleBasedAdvice(data, a, date);
}

// Script Property を安全に読む
function getProp(key, fallback) {
  try {
    const v = PropertiesService.getScriptProperties().getProperty(key);
    return v || fallback || '';
  } catch (e) { return fallback || ''; }
}

// 日替わりで具体策の切り口を変えるためのシード（同じ数値が続いても毎日違う打ち手にする）
function daySeed(date) {
  const s = String(date || getDateStr(-1)).replace(/-/g, '');
  return parseInt(s, 10) || 0;
}
function rotate(arr, seed) {
  if (!arr || !arr.length) return '';
  return arr[((seed % arr.length) + arr.length) % arr.length];
}
// SEOで具体的に狙うロングテールKW（日替わりで提案を回す）
const SEO_KEYWORDS = [
  '「名古屋 接待 個室」', '「名古屋駅 宴会 コース」', '「栄 デート ディナー」',
  '「名古屋 誕生日 サプライズ」', '「名古屋 女子会 個室」', '「名古屋 大人数 飲み放題」',
  '「名古屋 隠れ家 居酒屋」', '「名古屋 記念日 レストラン」',
];

// 表示名で合算した人気ページ上位（プロンプト/ルール双方で使う・自己完結）
function topPagesForPrompt(pages, n) {
  const byName = {};
  (pages || []).forEach(p => {
    const name = pagePathToName(p.dimensions[0]);
    byName[name] = (byName[name] || 0) + (parseInt(p.metrics[1]) || 0);
  });
  return Object.keys(byName)
    .map(k => ({ name: k, pv: byName[k] }))
    .sort((x, y) => y.pv - x.pv)
    .slice(0, n);
}

// ─── ① AIアドバイス（Gemini無料枠を優先 → Claude → 失敗時null） ───
// Script Properties に GEMINI_API_KEY か ANTHROPIC_API_KEY のどちらかを入れれば有効化。
// GEMINI_API_KEY は Google AI Studio で無料発行でき、1日1回のこの用途なら完全無料。
function generateAiAdvice(data, a, date, isWeekly) {
  const prompt = buildAdvicePrompt(data, a, date, isWeekly);

  const geminiKey = getProp('GEMINI_API_KEY', '');
  if (geminiKey) {
    const r = callGeminiAdvice(geminiKey, getProp('GEMINI_MODEL', 'gemini-2.5-flash'), prompt);
    if (r) return r;
  }
  const claudeKey = getProp('ANTHROPIC_API_KEY', '');
  if (claudeKey) {
    const r = callClaudeAdvice(claudeKey, getProp('ANTHROPIC_MODEL', 'claude-sonnet-4-5-20250929'), prompt);
    if (r) return r;
  }
  return null;  // キー未設定 or 全滅 → ルールベースへ
}

// 現在有効なAIプロバイダ名（テスト表示用）
function aiProviderName() {
  if (getProp('GEMINI_API_KEY', '')) return 'Gemini';
  if (getProp('ANTHROPIC_API_KEY', '')) return 'Claude';
  return '';
}

// 共通: AI応答テキストから {"advice":[...]} を取り出す
function parseAdviceJson(text) {
  if (!text) return null;
  const raw = String(text).trim().replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  try {
    const obj = JSON.parse(raw);
    const advice = obj && obj.advice;
    if (!Array.isArray(advice) || advice.length === 0) return null;
    return advice.map(String).slice(0, 3);
  } catch (e) {
    Logger.log('AIアドバイスJSON解析失敗: ' + raw.slice(0, 200));
    return null;
  }
}

// Gemini（無料枠）: generateContent。JSON強制＋thinking無効でトークン枯渇を防ぐ
function callGeminiAdvice(apiKey, model, prompt) {
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    };
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('Geminiアドバイス失敗 HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
      return null;
    }
    const body = JSON.parse(res.getContentText());
    const cand = body.candidates && body.candidates[0];
    const part = cand && cand.content && cand.content.parts && cand.content.parts[0];
    return parseAdviceJson(part && part.text);
  } catch (e) {
    Logger.log('Gemini例外: ' + e);
    return null;
  }
}

// Claude: messages
function callClaudeAdvice(apiKey, model, prompt) {
  try {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model: model, max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('Claudeアドバイス失敗 HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
      return null;
    }
    const body = JSON.parse(res.getContentText());
    const block = (body.content || []).find(b => b.type === 'text');
    return parseAdviceJson(block && block.text);
  } catch (e) {
    Logger.log('Claude例外: ' + e);
    return null;
  }
}

// AIに渡すプロンプト（その日の実データ＋サイトの強みを与え、汎用論を禁止する）
function buildAdvicePrompt(data, a, date, isWeekly) {
  const t = data.totals;
  const period = isWeekly ? 'この1週間' : (String(date || getDateStr(-1)) + '（前日）');

  const topPages = topPagesForPrompt(data.pages, 5)
    .map((p, i) => '  ' + (i + 1) + '. ' + p.name + ' … ' + p.pv + '回閲覧').join('\n') || '  (データなし)';

  const srcLines = (data.sources || []).slice(0, 5).map(s => {
    const pct = a.srcTotal > 0 ? Math.round((parseInt(s.metrics[1]) || 0) / a.srcTotal * 100) : 0;
    return '  - ' + sourceToName(s.dimensions[0], s.dimensions[1]) + ': ' + s.metrics[1] + '訪問 (' + pct + '%)';
  }).join('\n') || '  (データなし)';

  const devLines = (data.devices || []).map(d => {
    const pct = a.devTotal > 0 ? Math.round((parseInt(d.metrics[0]) || 0) / a.devTotal * 100) : 0;
    return deviceToName(d.dimensions[0]) + ' ' + pct + '%';
  }).join(' / ');

  return [
'あなたはNAGOYA BITES（名古屋の飲食店1100軒超を業界人が厳選して紹介する発見サイト）専属のグロース/SEOアナリストです。',
'このサイトのオーナー（現役の飲食関係者・Web分析は素人）に向けて、' + period + 'のアクセス解析データから「今日やるべき具体的な改善策」を提案してください。',
'',
'# サイトの構造（打ち手はこの実装に即して具体的に書く）',
'- index.html 一枚に全店舗を掲載。検索／エリア・シーンのフィルタ／店舗詳細モーダル／予約ボタン(cta_click)／Googleマップ導線(cta_gmap_click)／Instagramエンベッドあり',
'- features/ にシーン別特集（名駅・栄・宴会・個室・接待・誕生日・デート・女子会・大人数 など20本）',
'- journal/ に日次ジャーナル記事（毎日1本公開）',
'- docs/daily-posts/ にSNS投稿原稿（Note／Instagram／X）が毎日用意されている',
'',
'# このサイトの強み（提案はこの路線を伸ばす方向で）',
'- 広告ゼロ・PR記事ゼロの編集独立性／現役飲食人による「業界人の目利き」',
'- シーン別（接待・宴会・デート・個室）の専門性。大手ポータルが書けない独自KW（例: 名古屋 接待 個室）で勝つ',
'- 追わない領域（提案しない）: 匿名口コミの大量集積・クーポン経済・高級セグメント特化',
'',
'# ' + period + 'の実データ',
'- 訪問者: ' + t.users + '人 ／ ページ閲覧: ' + t.pageviews + ' ／ 訪問回数(セッション): ' + t.sessions,
'- 1訪問あたり閲覧: ' + a.pagesPerSession.toFixed(1) + 'ページ（目安2以上が良好）',
'- 平均滞在: ' + secToText(t.avgDuration) + '（目安60秒以上）',
'- 直帰率: ' + Math.round(t.bounceRate * 100) + '%（目安50%未満が良好・70%超は要注意）',
'- 予約ボタンクリック: ' + a.ctaCount + '回 ／ マップ: ' + a.gmapCount + '回 ／ 店舗詳細を開いた: ' + a.modalCount + '回' + (a.outboundCount ? ' ／ 外部リンク: ' + a.outboundCount + '回' : ''),
'- 予約クリック率（予約÷訪問者）: ' + (a.ctaRate * 100).toFixed(1) + '%（目安3%）',
'- 検索流入比率: ' + Math.round(a.organicPct * 100) + '% ／ SNS流入比率: ' + Math.round(a.socialPct * 100) + '%',
'- デバイス: ' + (devLines || '不明'),
'',
'## 人気ページ TOP5',
topPages,
'',
'## 流入元 TOP5',
srcLines,
'',
'# 出力ルール',
'- 効果が大きい順に、改善策をちょうど3件。',
'- 各項目は次の2行を改行(\\n)で繋いだ1つの文字列にする:',
'    1行目: 状況の要約（絵文字 🔴/🟡/🟢/💡 で始め、上の実データの数値を必ず1つ引用する）',
'    2行目: 「　👉 」で始まる、今日この実装で着手できる超具体的な打ち手（どのページ・どのKW・どの要素を、どう変えるか）',
'- 毎日同じ提案にならないよう、データで最も差が出ている点に焦点を当てる。汎用論・精神論は禁止。',
'- データに無い数字を創作しない。訪問者が少ない日は「母数が少ないので◯◯を試す実験」という温度感にする。',
'- 専門用語を避け、素人が読んで即動ける日本語で。各項目は120字以内。',
'- 出力はJSONのみ。前後に説明文やコードフェンス(```)を付けない。',
'',
'# 出力フォーマット（JSONのみ）',
'{"advice": ["🔴 直帰率が72%…\\n　👉 …", "🟡 …\\n　👉 …", "🟢 …\\n　👉 …"]}',
  ].join('\n');
}

// ─── ② ルールベースアドバイス（AIフォールバック／実数値・実ページ・実流入元を引用） ───
function generateRuleBasedAdvice(data, a, date) {
  const t = data.totals;
  const seed = daySeed(date);
  const cand = [];  // { sev, text } sev が大きいほど優先

  const tops = topPagesForPrompt(data.pages, 1);
  const topPageName = tops[0] ? tops[0].name : 'トップページ';
  const topPagePv = tops[0] ? tops[0].pv : 0;
  const topSrcRow = data.sources && data.sources[0];
  const topSrcName = topSrcRow ? sourceToName(topSrcRow.dimensions[0], topSrcRow.dimensions[1]) : null;
  const featureRow = (data.pages || []).find(p => /features\//.test(p.dimensions[0]));
  const featureName = featureRow ? pagePathToName(featureRow.dimensions[0]) : null;
  const featurePv = featureRow ? (parseInt(featureRow.metrics[1]) || 0) : 0;
  const hasJournal = (data.pages || []).some(p => /journal\//.test(p.dimensions[0]));

  // 直帰率
  if (t.bounceRate > BENCHMARKS.bounceRate.warn) {
    const gap = Math.round((t.bounceRate - BENCHMARKS.bounceRate.good) * 100);
    const acts = [
      'ファーストビューに「名古屋の飲食店1100軒を“現役の飲食人”が厳選」と一言入れ、3秒で価値を伝える',
      '最初の画面に人気特集（' + (featureName || '宴会・接待特集') + '）への大きめボタンを置き、次の一歩を作る',
      '冒頭の店舗カードを「🔥話題沸騰」の店から並べ、最初の3枚で離脱を止める',
    ];
    cand.push({ sev: 95, text: '🔴 すぐ帰る人が' + Math.round(t.bounceRate * 100) + '%（目標50%・あと' + gap + 'pt下げたい）\n　👉 ' + rotate(acts, seed) });
  } else if (t.bounceRate > BENCHMARKS.bounceRate.good) {
    cand.push({ sev: 60, text: '🟡 直帰率' + Math.round(t.bounceRate * 100) + '%とやや高め\n　👉 一番見られた「' + topPageName + '」の冒頭に、関連特集リンクを1本足して回遊のきっかけを作る' });
  }

  // 滞在時間
  if (t.avgDuration < BENCHMARKS.avgDuration.warn) {
    const acts = [
      '「' + topPageName + '」の表示速度を確認（画像の遅延読込・Instagramエンベッドの貼りすぎを見直す）',
      '店舗カードに業界人の一言（editorReason）を1行表示し、読みたくなる引きを作る',
      '最新の日次ジャーナルをトップ上部に差し込み、読み物として滞在を伸ばす',
    ];
    cand.push({ sev: 85, text: '🔴 平均滞在' + secToText(t.avgDuration) + '（目標1分・読まれず離脱の疑い）\n　👉 ' + rotate(acts, seed) });
  }

  // 回遊（1訪問あたりページ数）
  if (a.pagesPerSession < BENCHMARKS.pagesPerSession.warn && t.sessions >= 10) {
    cand.push({ sev: 70, text: '🟡 1人あたり' + a.pagesPerSession.toFixed(1) + 'ページしか見ていない（目標2）\n　👉 店舗詳細モーダルの下に「近くの似た店3軒」を出し、横移動を促す' });
  }

  // 予約クリック
  if (t.users >= 20) {
    if (a.ctaRate < BENCHMARKS.ctaRate.warn) {
      const acts = [
        '予約ボタンを店舗カードの写真直下（最も押される位置）へ移動する',
        'ボタン文言を「予約する」→「空席・予約をみる」に変え、心理的ハードルを下げる',
        '店舗詳細モーダルを閉じる直前に、予約導線をもう一度見せる',
      ];
      cand.push({ sev: 90, text: '🔴 予約ボタンが訪問' + t.users + '人中ほぼ未クリック（' + (a.ctaRate * 100).toFixed(1) + '%）\n　👉 ' + rotate(acts, seed) });
    } else if (a.ctaRate < BENCHMARKS.ctaRate.good) {
      cand.push({ sev: 55, text: '🟡 予約クリック率' + (a.ctaRate * 100).toFixed(1) + '%（目標3%）\n　👉 人気の「' + topPageName + '」だけでも上部に予約導線を増設する' });
    }
  }

  // 流入元・SEO
  if (a.srcTotal >= 15) {
    if (a.organicPct < 0.30) {
      cand.push({ sev: 80, text: '🔴 Google検索からの流入が' + Math.round(a.organicPct * 100) + '%と少なめ\n　👉 既存特集のタイトルとh1に ' + rotate(SEO_KEYWORDS, seed) + ' を入れ、本文の最初の2行にも自然に1回使う' });
    } else if (a.organicPct >= 0.70) {
      cand.push({ sev: 30, text: '🟢 検索流入' + Math.round(a.organicPct * 100) + '%と好調\n　👉 勢いに乗せて ' + rotate(SEO_KEYWORDS, seed + 3) + ' を狙う新特集を仕込み、検索の面を広げる' });
    }
    if (a.socialPct < 0.05) {
      cand.push({ sev: 50, text: '🟡 SNSからの流入がほぼゼロ\n　👉 ' + (featureName || '今日のジャーナル') + 'をInstagram/Xに「画像1枚＋一言」で投稿（docs/daily-posts の原稿を流用）' });
    } else if (a.socialPct >= 0.25) {
      cand.push({ sev: 35, text: '🟢 SNS流入が' + Math.round(a.socialPct * 100) + '%と強い\n　👉 反応が出たテーマで連投し、プロフィールのサイトURL固定を確認する' });
    }
  }

  // 流入チャネルの集中リスク
  if (topSrcName && a.srcTotal >= 20 && topSrcRow) {
    const topSesPct = Math.round((parseInt(topSrcRow.metrics[1]) || 0) / a.srcTotal * 100);
    if (topSesPct >= 70) {
      cand.push({ sev: 45, text: '🟡 流入の' + topSesPct + '%が「' + topSrcName + '」に集中（1本足は危険）\n　👉 手薄な' + (a.organicPct < 0.3 ? 'Google検索' : 'SNS') + 'にもう1本の柱を作る' });
    }
  }

  // 伸びている特集をさらに伸ばす
  if (featureRow && featurePv >= 15) {
    cand.push({ sev: 40, text: '🟢 「' + featureName + '」が' + featurePv + '回読まれ好調\n　👉 同テーマをSNS投稿しつつ、隣接特集（例: 個室→接待）への内部リンクを足す' });
  }

  // トップ集中
  if (tops[0] && t.pageviews > 0) {
    const topPct = Math.round(topPagePv / t.pageviews * 100);
    if (topPct > 75 && !/特集|features|ジャーナル|journal/.test(topPageName)) {
      cand.push({ sev: 42, text: '🟡 閲覧の' + topPct + '%が「' + topPageName + '」に集中（奥のページに流れていない）\n　👉 トップに特集・ジャーナルへの導線ブロックを1つ追加する' });
    }
  }

  // モバイル
  if (a.mobilePct > 0.85) {
    cand.push({ sev: 25, text: '💡 訪問の' + Math.round(a.mobilePct * 100) + '%がスマホ\n　👉 ボタンの高さ44px以上・横スクロールが出ていないかをスマホ実機で確認する' });
  }

  // 課題が無い日は「攻めの一手」を日替わりで
  if (cand.length === 0) {
    const grow = [
      rotate(SEO_KEYWORDS, seed) + ' を狙う特集を1本企画する',
      hasJournal ? '反応が出た日次ジャーナルのテーマを、特集記事に格上げする' : '日次ジャーナルを再開し、毎日1本の更新リズムを取り戻す',
      '人気の「' + topPageName + '」と相性の良い隣接特集への内部リンクを増やす',
      (featureName || '今日の話題店') + 'をInstagram/Xに投稿し、新規の入口を1つ増やす',
    ];
    cand.push({ sev: 10, text: '🟢 目立った課題なし。攻めに転じる日\n　👉 ' + rotate(grow, seed) });
  }

  // 優先度の高い順に、詳しくなった分は上位3件に絞る
  return cand.sort((x, y) => y.sev - x.sev).slice(0, 3).map(c => c.text);
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
  generateAdvice(data, a, date).forEach(tip => { msg += '・' + tip + '\n'; });

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
  generateAdvice(data, a, endDate, true).forEach(tip => { msg += '・' + tip + '\n'; });

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
  if (!path) return '(不明)';
  const map = {
    '/': '🏠 トップページ',
    '/index.html': '🏠 トップページ',
    '/nagoya-bites/': '🏠 トップページ',
    '/nagoya-bites/index.html': '🏠 トップページ',
    '/features/': '📋 特集一覧',
    '/features/index.html': '📋 特集一覧',
    '/nagoya-bites/features/': '📋 特集一覧',
    '/nagoya-bites/features/index.html': '📋 特集一覧',
    '/features/meieki.html': '🏢 名駅特集',
    '/features/sakae.html': '🌆 栄特集',
    '/features/banquet.html': '🍻 宴会特集',
    '/features/private-room.html': '🚪 個室特集',
    '/features/entertainment.html': '🤝 接待特集',
    '/features/birthday.html': '🎂 誕生日特集',
    '/features/date.html': '💑 デート特集',
    '/features/girls-party.html': '👯 女子会特集',
    '/features/large-group.html': '👥 大人数特集',
    '/features/hard-to-book.html': '🔥 予約困難店特集',
    '/about.html': 'About',
    '/faq.html': 'Q&A',
    '/contact.html': 'Contact',
    '/editorial-policy.html': '編集方針',
    '/concierge.html': '接待コンシェルジュ',
  };
  if (map[path]) return map[path];

  // /nagoya-bites/ prefix ありの旧パスも吸収
  const stripped = path.replace(/^\/nagoya-bites/, '');
  if (stripped !== path && map[stripped]) return map[stripped];

  // ジャーナル
  const journalMatch = /^\/(?:nagoya-bites\/)?journal\/(.+)\.html$/.exec(path);
  if (journalMatch) return '📓 ' + journalMatch[1];

  // 特集（マップにない新特集）
  const featureMatch = /^\/(?:nagoya-bites\/)?features\/(.+)\.html$/.exec(path);
  if (featureMatch) return '📰 特集: ' + featureMatch[1];

  // 店舗ページ
  const storeMatch = /^\/(?:nagoya-bites\/)?stores\/(.+)\.html$/.exec(path);
  if (storeMatch) return '🍽 店舗: ' + storeMatch[1];

  return path;
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

// AIアドバイスの動作確認（昨日のデータでアドバイスのみをLINE送信）
// Script Properties に ANTHROPIC_API_KEY を入れると Claude が、未設定ならルールベースが動く
function testAiAdvice() {
  const yesterday = getDateStr(-1);
  const data = fetchGA4Report(yesterday, yesterday);
  const a = analyze(data);
  const provider = aiProviderName();
  const ai = generateAiAdvice(data, a, yesterday, false);
  const tips = (ai && ai.length) ? ai : generateRuleBasedAdvice(data, a, yesterday);
  let msg = '🧪 アドバイス生成テスト（' + yesterday + '）\n';
  msg += '使用エンジン: ' + (ai && ai.length ? '🤖 AI（' + provider + '）' : (provider ? '⚠️ AI失敗→ルールベース' : '📐 ルールベース（APIキー未設定）')) + '\n';
  msg += '━━━━━━━━━━━━━━━\n';
  tips.forEach(tip => { msg += '・' + tip + '\n'; });
  sendLineMessage(msg);
  Logger.log(msg);
}

// ─── トリガー再設定（GASから1回だけ手動実行する） ───
// 配信時刻を「毎朝8時台（JST・8:00頃）」に統一する。
// 既存の sendDailyReport / sendWeeklyReport トリガーを削除して作り直すので、
// 何度実行しても重複トリガーは増えない（冪等）。
// nearMinute(0) で 8:00 付近（±15分）に寄せるため、後段の Claude SEOトリアージ（8:30）が
// 確実に「配信後」に走る。タイムゾーンは appsscript.json の Asia/Tokyo に従う。
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'sendDailyReport' || fn === 'sendWeeklyReport') {
      ScriptApp.deleteTrigger(t);
    }
  });
  // 日次: 毎日 8:00 頃
  ScriptApp.newTrigger('sendDailyReport')
    .timeBased().everyDays(1).atHour(8).nearMinute(0).create();
  // 週次: 毎週月曜 8:00 頃
  ScriptApp.newTrigger('sendWeeklyReport')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).nearMinute(0).create();
  Logger.log('トリガー再設定完了: 日次=毎日8:00頃 / 週次=月曜8:00頃（JST）');
}
