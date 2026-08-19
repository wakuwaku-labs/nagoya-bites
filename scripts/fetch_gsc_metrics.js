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
const DEFAULT_SITE_URL = 'https://nagoya-bites.com/';
const LOOKBACK = parseInt(process.env.GSC_LOOKBACK_DAYS || '28', 10);
const OUT_PATH = path.join(__dirname, '..', 'data', 'gsc_metrics.json');

// 取得解像度（SEO-043）。
// 旧版は クエリ25件 / ページ15件しか取っておらず、上位が店名の指名検索で埋まるため
// シーンKWの表示実態が原理的に見えなかった（＝SEO-011 の効果を測れなかった）。
// API は 1 リクエストあたり最大 25,000 行。日次1回のジョブなのでコスト影響は無い。
const QUERY_ROW_LIMIT = parseInt(process.env.GSC_QUERY_ROW_LIMIT || '5000', 10);
const PAGE_ROW_LIMIT = parseInt(process.env.GSC_PAGE_ROW_LIMIT || '500', 10);
const PAGE_QUERY_ROW_LIMIT = parseInt(process.env.GSC_PAGE_QUERY_ROW_LIMIT || '5000', 10);
// ファイルサイズ抑制: 集計は全件で行い、生の行は上位のみ保存する
const QUERY_STORE_LIMIT = 300;
const PAGE_QUERY_FOCUS_PAGES = 15;
const PAGE_QUERY_PER_PAGE = 15;

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

/**
 * page×query の生行を「表示回数上位のページ」ごとにまとめる（SEO-043）。
 * API 認証なしでも検証できるよう純関数にして export する。
 *
 * pqRows は表示回数の降順で来るので、先頭から詰めれば各ページの上位クエリになる。
 * @param {Array} pqRows  [{ keys: [page, query], clicks, impressions, ctr, position }]
 * @param {Array} allPages [{ page, impressions, ... }] 表示回数降順
 */
function groupPageQueries(pqRows, allPages) {
  const focus = new Set((allPages || []).slice(0, PAGE_QUERY_FOCUS_PAGES).map(p => p.page));
  // SEO-058: トップページ（ホームURL）は表示回数の絶対値こそ大きいが、店舗ページ等
  // 個別URLの表示回数の方がさらに大きいことが多く、上位15件のランキングから漏れやすい。
  // 漏れると「トップページがどのクエリで18位前後に出ているか」が一切観測できず、
  // Strategic Skip（指名検索が大半）か rank_push 対象（discovery語で圏外滞留）かを
  // 判定できない（SEO-058）。表示回数の大小に関わらず必ず観測対象に含める。
  focus.add(DEFAULT_SITE_URL);
  if (process.env.GSC_SITE_URL && /^https?:\/\//.test(process.env.GSC_SITE_URL)) {
    focus.add(process.env.GSC_SITE_URL);
  }
  const byPage = new Map();
  (pqRows || []).forEach(r => {
    const [page, q] = r.keys || [];
    if (!focus.has(page)) return;
    const list = byPage.get(page) || [];
    if (list.length >= PAGE_QUERY_PER_PAGE) return;
    list.push({
      query: q,
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: Math.round((r.ctr || 0) * 10000) / 10000,
      position: Math.round((r.position || 0) * 10) / 10,
    });
    byPage.set(page, list);
  });
  return Array.from(byPage.entries()).map(([page, queries]) => ({ page, queries }));
}

// SEO-043: require されたときは終了しない（groupPageQueries を認証なしでテストするため）。
// CLI として起動されたときの挙動（未設定ならスキップして正常終了）は従来どおり。
if (!KEY_RAW && require.main === module) {
  console.log('GA4_SERVICE_ACCOUNT_KEY が未設定。GSC 集計をスキップします。');
  process.exit(0);
}

async function query(searchconsole, siteUrl, body) {
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: body,
  });
  return res.data.rows || [];
}

// このサイトに対応する候補プロパティ（URL プレフィックス / ドメインプロパティ）を、
// アクセス可能なものの中から抽出する。GSC_SITE_URL 明示時はそれ単独。
function candidateProperties(accessible) {
  if (process.env.GSC_SITE_URL) return [process.env.GSC_SITE_URL];
  const mine = accessible.filter(u => u.includes('nagoya-bites'));
  return mine.length ? mine : [DEFAULT_SITE_URL];
}

// 候補が複数あるとき（URL プレフィックスとドメインプロパティの両方に SA が追加された等）、
// 実際に impressions を持つ方を選ぶ。片方が空プロパティでも取りこぼさないための保険。
// 候補1件なら余計な API を叩かずそのまま返す。
async function pickBestProperty(searchconsole, candidates, dateRange) {
  if (candidates.length === 1) return candidates[0];
  let best = candidates[0], bestImp = -1;
  for (const url of candidates) {
    let imp = 0;
    try {
      const rows = await query(searchconsole, url, { ...dateRange, dimensions: [] });
      imp = (rows[0] && rows[0].impressions) || 0;
    } catch (e) {
      console.log(`  候補 ${url} の総計取得に失敗（スキップ）: ${e.message}`);
      continue;
    }
    console.log(`  候補 ${url}: impressions=${imp}`);
    if (imp > bestImp) { best = url; bestImp = imp; }
  }
  return best;
}

async function main() {
  const { google } = require('googleapis');
  const credentials = JSON.parse(KEY_RAW);
  // 診断用: GSC に追加すべき正しい SA メールをログで確定させる（メールは秘密情報ではない）
  console.log(`使用中のサービスアカウント: ${credentials.client_email}`);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  await auth.authorize();

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  // このサービスアカウントがアクセスできるプロパティを列挙（permission 問題の切り分けに決定的）。
  // ここが空なら「SA が GSC のユーザーにまだ追加されていない」と即断できる。
  let accessible = [];
  try {
    const siteList = await searchconsole.sites.list();
    accessible = (siteList.data.siteEntry || [])
      .filter(s => s.permissionLevel && s.permissionLevel !== 'siteUnverifiedUser')
      .map(s => s.siteUrl);
    console.log(`アクセス可能な GSC プロパティ(${accessible.length}): ${accessible.join(', ') || '(なし＝SA未追加の可能性大)'}`);
  } catch (e) {
    console.log(`sites.list 取得失敗（Search Console API 未有効化の可能性）: ${e.message}`);
  }

  // GSC データは 2〜3 日遅延するため、終端は余裕を持たせる
  const startDate = isoDaysAgo(LOOKBACK);
  const endDate = isoDaysAgo(1);
  const dateRange = { startDate, endDate };

  const candidates = candidateProperties(accessible);
  const siteUrl = await pickBestProperty(searchconsole, candidates, dateRange);
  console.log(`対象プロパティ: ${siteUrl}`);

  // 1) 総計（ディメンションなし → 1 行）
  const totalRows = await query(searchconsole, siteUrl, { ...dateRange, dimensions: [] });
  const t = totalRows[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const totals = {
    clicks: t.clicks || 0,
    impressions: t.impressions || 0,
    ctr: Math.round((t.ctr || 0) * 10000) / 10000,
    position: Math.round((t.position || 0) * 10) / 10,
    impressionsPerDay: Math.round(((t.impressions || 0) / LOOKBACK) * 10) / 10,
  };

  // 2) クエリ（表示回数順）
  //    SEO-043: rowLimit 25 → QUERY_ROW_LIMIT。上位25件は全件が店名の指名検索で埋まっており、
  //    SEO-011 で狙うシーンKW（接待/宴会/個室…）が表示を得ても、指名検索を押しのけて
  //    上位25に入るまで観測できない＝**施策の効果を測る手段が無い**状態だった。
  //    全件取ったうえで意図別に集計する（下の 5) intent）。
  const queryRows = await query(searchconsole, siteUrl, {
    ...dateRange, dimensions: ['query'], rowLimit: QUERY_ROW_LIMIT,
    orderBy: [{ field: 'impressions', descending: true }],
  });
  const allQueries = queryRows.map(r => ({
    query: r.keys[0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: Math.round((r.ctr || 0) * 10000) / 10000,
    position: Math.round((r.position || 0) * 10) / 10,
  }));
  const topQueries = allQueries.slice(0, 25); // 既存の読み手との後方互換

  // 3) ページ（表示回数順）
  const pageRows = await query(searchconsole, siteUrl, {
    ...dateRange, dimensions: ['page'], rowLimit: PAGE_ROW_LIMIT,
    orderBy: [{ field: 'impressions', descending: true }],
  });
  const allPages = pageRows.map(r => ({
    page: r.keys[0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: Math.round((r.ctr || 0) * 10000) / 10000,
    position: Math.round((r.position || 0) * 10) / 10,
  }));
  const topPages = allPages.slice(0, 15); // 既存の読み手との後方互換

  // 4) ページ × クエリ（SEO-043）
  //    「どのページが、どのクエリで、何位に出ているか」。トップページは 2,262表示・
  //    順位23.4・6クリック（推定取りこぼし57クリック＝当時の総クリックの2割超）と
  //    単体で最大の伸びしろだが、**何のクエリで3ページ目にいるのかが分からず手が打てなかった**。
  let pageQueries = [];
  try {
    const pqRows = await query(searchconsole, siteUrl, {
      ...dateRange, dimensions: ['page', 'query'], rowLimit: PAGE_QUERY_ROW_LIMIT,
      orderBy: [{ field: 'impressions', descending: true }],
    });
    pageQueries = groupPageQueries(pqRows, allPages);
  } catch (e) {
    console.log(`ページ×クエリの取得に失敗（スキップ）: ${e.message}`);
  }

  // 5) 検索意図の内訳（SEO-043）— SEO-011 の効果測定器
  //    discovery（シーン語 / エリア語×ジャンル語）の 表示・クリック が伸びているかで判定する。
  //    総クリックは指名検索の増減で簡単に動くため、施策の効果判定には使わない。
  let intent = null;
  try {
    const { classifyQueries } = require('./gsc_query_intent');
    intent = classifyQueries(allQueries);
  } catch (e) {
    console.log(`検索意図の集計に失敗（スキップ）: ${e.message}`);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    siteUrl,
    dateRange,
    lookbackDays: LOOKBACK,
    totals,
    topQueries,
    topPages,
    // SEO-043 で追加した高解像度データ
    queries: allQueries.slice(0, QUERY_STORE_LIMIT),
    queriesFetched: allQueries.length,
    pages: allPages,
    pageQueries,
    intent,
    benchmarks: BENCHMARKS,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`gsc_metrics.json 更新: clicks=${totals.clicks} / impressions=${totals.impressions} / CTR=${(totals.ctr*100).toFixed(1)}% / 平均順位=${totals.position}`);
}

if (require.main === module) main().catch(err => {
  console.error('GSC 集計エラー:', err.message);
  // 追加すべき正確な SA メールをエラー JSON にも埋め込む（オーナーが gsc_metrics.json だけで完結できるように）
  let saEmail = '(GA4_SERVICE_ACCOUNT_KEY の client_email)';
  try { saEmail = JSON.parse(KEY_RAW).client_email; } catch (_) {}
  // まだ正常データが無い（未存在 or エラースタブ）場合のみ最新エラーで更新する。
  // 既に totals 入りの正常データがある場合は、transient エラーで上書きしない。
  let hasGoodData = false;
  try { hasGoodData = !!(JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')).totals); } catch (_) {}
  if (!hasGoodData) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      siteUrl: process.env.GSC_SITE_URL || DEFAULT_SITE_URL,
      error: err.message,
      serviceAccountToAdd: saEmail,
      hint: `GSC の「設定→ユーザーと権限」で ${saEmail} を「制限付き」以上で追加し、GCP で Search Console API を有効化してください。ドメインプロパティ登録の場合は GitHub Secrets GSC_SITE_URL を sc-domain:nagoya-bites.com に設定。詳細は docs/gsc-metrics-setup.md。`,
      totals: null,
    }, null, 2));
  }
  process.exit(0);
});

module.exports = { groupPageQueries };
