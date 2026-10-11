'use strict';
/**
 * GA4 の「決まった期間」の数字を取り直すための部品（UI・UX改修計画 I-02・第10章「数字の取り方」）。
 *
 * このファイルは通信しない。期間の組み立て・ページ種別と端末の分類・GA4 の行の集計だけを持ち、
 * 通信するスクリプト（scripts/ga4_baseline.js）とテスト（tests/ga4_baseline.test.js）が共有する。
 *
 * 計画の決まり（docs/uiux-overhaul-plan-2026-10.md の 10.2 節）:
 *   1. 変更を main に入れた日を D とする。前は D-28〜D-1、後は D+1〜D+28。D は数えない
 *   2. 店舗ページを含む GA4 の数字は 2026-10-09 以降だけ使う（それ以前は計測が止まっていた・SEO-115）。
 *      前の期間がそこまでさかのぼれないときは、取れる日数で前後の長さをそろえる
 *   3. 端末（スマホ・PC）とページの種類（URL の先頭で分ける）ごとに出す
 *   6. どちらかの期間で分子が 30件 未満なら向きを判定せず「保留」。30件は仮の値で、基線の分布を見て直す
 */

// 店舗ページの GA4 が正しく取れ始めた日（SEO-115・data/measurement_changes.json）
const STORE_PAGE_GA4_FROM = '2026-10-09';
// 件数が少ない指標を保留にする仮の値（10.2 節の 6。品質ゲート原則5: 分布を見て直す）
const LOW_COUNT = 30;
// GA4 のセッション指標が確定するまでの日数（scripts/fetch_ga4_views.js の SETTLED_LAG_DAYS と同じ）
const SETTLED_LAG_DAYS = 2;
// 集計の対象にするホスト（.gas-deploy/Code.js の HOST_FILTER と同じ）
const HOST_NAME = 'nagoya-bites.com';

// 数える行動のイベント（計画 7.7 節）。無いイベントは GA4 が 0 行を返すだけで害は無い
const EVENTS = [
  'search', 'sort_change', 'modal_open', 'fav_add', 'fav_remove',
  'share_x', 'share_line', 'share_copy',
  'outbound_click', 'cta_click', 'cta_reserve', 'cta_call_click', 'cta_gmap_click',
  'reserve_report_yes', 'reserve_report_no',
  'feature_store_click', 'journal_store_click', 'hub_store_click', 'internal_link_click',
  'reel_play', 'feedback_open', 'feedback_submit',
  // 計画で足すイベント（まだ送っていなくてよい。送り始めたら基線の「後」に出る）
  'filter_apply', 'zero_result', 'related_click', 'call_lookup',
];

const PAGE_TYPES = ['top', 'store', 'hub', 'stores-index', 'feature', 'features-index', 'journal', 'journal-index', 'other'];
const DEVICES = ['mobile', 'desktop', 'other'];

/** GA4 の pagePath（クエリ付きでもよい）→ ページ種別。URL の先頭で分ける（10.2 節の 3） */
function classifyPage(rawPath) {
  let p = String(rawPath || '').split('#')[0].split('?')[0];
  if (!p.startsWith('/')) return 'other';
  if (p === '/' || p === '/index.html') return 'top';
  if (p === '/stores/' || p === '/stores/index.html') return 'stores-index';
  if (p.startsWith('/stores/area/')) return 'hub';
  if (/^\/stores\/[^/]+\.html$/.test(p)) return 'store';
  if (p === '/features/' || p === '/features/index.html') return 'features-index';
  if (/^\/features\/[^/]+\.html$/.test(p)) return 'feature';
  if (p === '/journal/' || p === '/journal/index.html') return 'journal-index';
  if (/^\/journal\/[^/]+\.html$/.test(p)) return 'journal';
  return 'other';
}

/** GA4 の deviceCategory → mobile / desktop / other（タブレットなどは other にまとめる） */
function classifyDevice(raw) {
  const d = String(raw || '').toLowerCase();
  if (d === 'mobile') return 'mobile';
  if (d === 'desktop') return 'desktop';
  return 'other';
}

// ── 日付（GA4 の期間は YYYY-MM-DD。プロパティのタイムゾーンの日付として扱う） ──
function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) throw new Error(`日付は YYYY-MM-DD で書く: ${s}`);
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    throw new Error(`存在しない日付: ${s}`);
  }
  return t;
}
const DAY = 86400000;
function ymd(t) { return new Date(t).toISOString().slice(0, 10); }
function addDays(s, n) { return ymd(parseYmd(s) + n * DAY); }
function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / DAY); }

/** 今日（日本時間）の日付 */
function todayJst(now = Date.now()) { return ymd(now + 9 * 3600000); }

/** 値が確定している最後の日（今日の SETTLED_LAG_DAYS 日前） */
function lastSettledDay(today = todayJst()) { return addDays(today, -SETTLED_LAG_DAYS); }

/** 1つの期間（両端を含む）。確定済みかと、店舗ページの欠けにかかるかを一緒に返す */
function windowOf(start, end, { today = todayJst(), storeFrom = STORE_PAGE_GA4_FROM } = {}) {
  const days = daysBetween(start, end) + 1;
  if (days < 1) throw new Error(`終わり(${end})が始まり(${start})より前`);
  const warnings = [];
  const settled = end <= lastSettledDay(today);
  if (!settled) warnings.push(`終わり(${end})が確定前（確定しているのは ${lastSettledDay(today)} まで）。セッションの指標は最大${SETTLED_LAG_DAYS}日後に確定する`);
  if (start < storeFrom) warnings.push(`始め(${start})が ${storeFrom} より前。店舗ページの GA4 が欠けている日を含む（SEO-115）。店舗ページを含む数字は ${storeFrom} 以降で取り直す`);
  return { start, end, days, settled, includesStorePageGap: start < storeFrom, warnings };
}

/**
 * D の前後の期間（10.2 節の 1・2）。D は数えない。
 * 前が店舗ページの欠け（storeFrom より前）にかかるときは、取れる日数で前後の長さをそろえる。
 */
function windowPair(D, requestedDays = 28, { today = todayJst(), storeFrom = STORE_PAGE_GA4_FROM } = {}) {
  parseYmd(D);
  const reachable = daysBetween(storeFrom, D); // storeFrom〜D-1 の日数
  const days = Math.min(requestedDays, reachable);
  if (days < 1) throw new Error(`D(${D}) の前に、店舗ページの GA4 が取れた日（${storeFrom} 以降）が無い`);
  const notes = [];
  if (days < requestedDays) notes.push(`前を ${requestedDays} 日取れない（${storeFrom} から D の前日まで ${reachable} 日）。前後を ${days} 日にそろえた`);
  return {
    D, days, requestedDays,
    before: windowOf(addDays(D, -days), addDays(D, -1), { today, storeFrom }),
    after: windowOf(addDays(D, 1), addDays(D, days), { today, storeFrom }),
    notes,
  };
}

// ── GA4 の行 → 集計 ──
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function round(v, d = 3) { const k = Math.pow(10, d); return Math.round(v * k) / k; }

/** GA4 の runReport の行 → { dims: [...], mets: [...] }（googleapis と Apps Script の両方の形を許す） */
function rowsOf(res) {
  const data = (res && res.data) || res || {};
  return (data.rows || []).map(r => ({
    dims: (r.dimensionValues || []).map(x => x.value),
    mets: (r.metricValues || []).map(x => num(x.value)),
  }));
}

function emptyDevices() { return { mobile: 0, desktop: 0, other: 0 }; }

/** ページ種別 × 端末のセルに足し込む入れ物。cell('store','mobile') のように使う */
function grid(fields) {
  const g = {};
  PAGE_TYPES.forEach(t => { g[t] = {}; DEVICES.forEach(d => { g[t][d] = {}; fields.forEach(f => { g[t][d][f] = 0; }); }); });
  return g;
}

/** 端末とページ種別で合計し、"all" の行（端末の合計）を付ける */
function withTotals(g, fields) {
  const out = {};
  PAGE_TYPES.forEach(t => {
    out[t] = { all: {} };
    fields.forEach(f => { out[t].all[f] = 0; });
    DEVICES.forEach(d => {
      out[t][d] = { ...g[t][d] };
      fields.forEach(f => { out[t].all[f] += g[t][d][f]; });
    });
  });
  return out;
}

/**
 * 入口のページ種別ごとのセッション。dims = [deviceCategory, landingPage]、mets = [sessions, engagedSessions]
 * （ランディングページのレポートと同じ使い方。セッションは入口のページ1つにだけ数えられる）
 */
function aggregateLanding(rows) {
  const fields = ['sessions', 'engagedSessions'];
  const g = grid(fields);
  rows.forEach(r => {
    const t = classifyPage(r.dims[1]);
    const d = classifyDevice(r.dims[0]);
    g[t][d].sessions += r.mets[0];
    g[t][d].engagedSessions += r.mets[1];
  });
  const out = withTotals(g, fields);
  PAGE_TYPES.forEach(t => ['all', ...DEVICES].forEach(d => {
    const c = out[t][d];
    c.engagementRate = c.sessions > 0 ? round(c.engagedSessions / c.sessions) : null;
  }));
  return out;
}

/**
 * ページ種別ごとの表示。dims = [deviceCategory, pagePath]、mets = [screenPageViews, userEngagementDuration]
 * 表示と滞在（秒）は足し算してよい量だけを使う（ページごとの人数やセッションは足し算できない）
 */
function aggregatePages(rows) {
  const fields = ['views', 'engagementSec'];
  const g = grid(fields);
  rows.forEach(r => {
    const t = classifyPage(r.dims[1]);
    const d = classifyDevice(r.dims[0]);
    g[t][d].views += r.mets[0];
    g[t][d].engagementSec += r.mets[1];
  });
  const out = withTotals(g, fields);
  PAGE_TYPES.forEach(t => ['all', ...DEVICES].forEach(d => {
    const c = out[t][d];
    c.engagementSecPerView = c.views > 0 ? round(c.engagementSec / c.views, 2) : null;
  }));
  return out;
}

/** 端末ごとの全体の値。dims = [deviceCategory]、mets は metrics の名前と同じ並び */
function aggregateByDevice(rows, metricNames) {
  const out = { all: {} };
  DEVICES.forEach(d => { out[d] = {}; metricNames.forEach(m => { out[d][m] = 0; }); });
  rows.forEach(r => {
    const d = classifyDevice(r.dims[0]);
    metricNames.forEach((m, i) => { out[d][m] += r.mets[i]; });
  });
  metricNames.forEach(m => { out.all[m] = DEVICES.reduce((a, d) => a + out[d][m], 0); });
  return out;
}

/**
 * イベントごとの回数。dims = [eventName, deviceCategory, pagePath]、mets = [eventCount]
 * 戻り値: { name: { total, device: {mobile,desktop,other}, pageType: {...}, cell: {'store|mobile': n} } }
 */
function aggregateEvents(rows) {
  const out = {};
  rows.forEach(r => {
    const name = r.dims[0];
    const d = classifyDevice(r.dims[1]);
    const t = classifyPage(r.dims[2]);
    const n = r.mets[0];
    if (!out[name]) out[name] = { total: 0, device: emptyDevices(), pageType: {}, cell: {} };
    const e = out[name];
    e.total += n;
    e.device[d] += n;
    e.pageType[t] = (e.pageType[t] || 0) + n;
    const key = `${t}|${d}`;
    e.cell[key] = (e.cell[key] || 0) + n;
  });
  return out;
}

/** セッションごとの数え。dims = [eventName, deviceCategory]、mets = [eventCount, sessions]（そのイベントがあったセッション） */
function aggregateEventSessions(rows) {
  const out = {};
  rows.forEach(r => {
    const name = r.dims[0];
    const d = classifyDevice(r.dims[1]);
    if (!out[name]) out[name] = { eventCount: 0, sessions: 0, device: { mobile: { eventCount: 0, sessions: 0 }, desktop: { eventCount: 0, sessions: 0 }, other: { eventCount: 0, sessions: 0 } } };
    out[name].eventCount += r.mets[0];
    out[name].sessions += r.mets[1];
    out[name].device[d].eventCount += r.mets[0];
    out[name].device[d].sessions += r.mets[1];
  });
  return out;
}

/**
 * 予約送客（予約導線のクリック）。数え方の正本は scripts/lib/reservation_exits.js:
 * cta_click・cta_reserve（予約サイトへのリンク）と outbound_click を、ページ×リンク先で重ならないように数える。
 * dims = [deviceCategory, pagePath, eventName, customEvent:link_domain]、mets = [eventCount]。
 * 電話（cta_call_click）は events の側で数える。
 */
function aggregateReservation(rows, dedupe) {
  const byCell = {};
  rows.forEach(r => {
    const key = `${classifyPage(r.dims[1])}|${classifyDevice(r.dims[0])}`;
    if (!byCell[key]) byCell[key] = [];
    byCell[key].push({ path: r.dims[1], event: r.dims[2], domain: r.dims[3], count: r.mets[0] });
  });
  const cell = {};
  const device = emptyDevices();
  const pageType = {};
  let total = 0;
  Object.keys(byCell).forEach(key => {
    const n = dedupe(byCell[key]).deduped;
    const [t, d] = key.split('|');
    cell[key] = n;
    device[d] += n;
    pageType[t] = (pageType[t] || 0) + n;
    total += n;
  });
  return { total, device, pageType, cell };
}

/** 件数が LOW_COUNT 未満のセル（保留の候補）。値が 0 のセルは「無かった」のでそのまま出す */
function lowCountCells(cell, threshold = LOW_COUNT) {
  return Object.keys(cell).filter(k => cell[k] > 0 && cell[k] < threshold).sort();
}

module.exports = {
  STORE_PAGE_GA4_FROM, LOW_COUNT, SETTLED_LAG_DAYS, HOST_NAME, EVENTS, PAGE_TYPES, DEVICES,
  classifyPage, classifyDevice,
  parseYmd, addDays, daysBetween, todayJst, lastSettledDay, windowOf, windowPair,
  rowsOf, aggregateLanding, aggregatePages, aggregateByDevice, aggregateEvents, aggregateEventSessions,
  aggregateReservation, lowCountCells,
};
