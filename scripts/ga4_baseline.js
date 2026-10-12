'use strict';
/**
 * ga4_baseline.js — GA4 の数字を「決まった期間・決まった区切り」で取り直す（UI・UX改修計画 I-02）
 *
 * data/site_metrics.json と data/store_referrals.json は「直近30日」を毎日書き直すので、
 * 改修の前後（D-28〜D-1 と D+1〜D+28）を比べるための決まった期間の数字は取れない。
 * このスクリプトが、期間を指定して同じ形の JSON を作る。判定の決まりは
 * docs/uiux-overhaul-plan-2026-10.md の 10.2 節「数字の取り方」。
 *
 * 使い方（GA4 の鍵は GitHub Secrets にあるので、実行は .github/workflows/ga4-baseline.yml が普通）:
 *   node scripts/ga4_baseline.js --window 2026-10-09 2026-10-20 [--label 名前] [--out ファイル]
 *   node scripts/ga4_baseline.js --pair 2026-11-10 [--days 28] [--label 名前] [--out ファイル]
 *       D(=2026-11-10) の前後。D は数えない。前が 2026-10-09 より前にかかるときは前後の長さをそろえる
 *   node scripts/ga4_baseline.js --dry-run --window 2026-10-09 2026-10-20     … 鍵なしで、送る問い合わせだけを見る
 *   node scripts/ga4_baseline.js --summary ファイル                              … 保存した JSON を表にして読む
 * 共通: --internal-filter active|testing|inactive|unknown （GA4 の「内部トラフィック」フィルタの状態。
 *       基線を取る前に管理画面で確かめて記録する。10.2 節の 5） / --allow-unsettled（確定前の日を含めてよい）
 *
 * 環境変数: GA4_SERVICE_ACCOUNT_KEY（サービスアカウント JSON 全文）・GA4_PROPERTY_ID（数字）。
 *   未設定なら何もせず終了コード 2（fetch_ga4_views.js のように黙って成功にしない。空の基線を作らないため）。
 *   プロパティ ID は出力に書かない（リポジトリは公開）。
 */
const fs = require('fs');
const L = require('./lib/ga4_baseline');
const { dedupeReservationClicks } = require('./lib/reservation_exits');

const INTERNAL_FILTER_STATES = ['active', 'testing', 'inactive', 'unknown'];
const MAX_DAYS = 365; // 前後それぞれの日数の上限（GA4 のデータの保持期間より短い）

// ── 引数 ──
function parseArgs(argv) {
  const a = { mode: null, days: 28, label: '', out: '', internalFilter: 'unknown', allowUnsettled: false, dryRun: false, summary: '' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new Error(`${k} に値が要る`); return argv[++i]; };
    if (k === '--window') { a.mode = 'window'; a.start = next(); a.end = next(); }
    else if (k === '--pair') { a.mode = 'pair'; a.D = next(); }
    else if (k === '--days') {
      // parseInt だと 1.5 → 1、7oops → 7 と読んでしまう。数字だけの文字列に限る
      const v = next();
      a.days = /^[0-9]+$/.test(v) ? Number(v) : NaN;
      if (!(a.days >= 1 && a.days <= MAX_DAYS)) throw new Error(`--days は 1 以上 ${MAX_DAYS} 以下の整数にする（${JSON.stringify(v)}）`);
    }
    else if (k === '--label') a.label = next();
    else if (k === '--out') a.out = next();
    else if (k === '--internal-filter') {
      a.internalFilter = next();
      if (!INTERNAL_FILTER_STATES.includes(a.internalFilter)) throw new Error(`--internal-filter は ${INTERNAL_FILTER_STATES.join('|')}`);
    }
    else if (k === '--allow-unsettled') a.allowUnsettled = true;
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--summary') { a.mode = 'summary'; a.summary = next(); }
    else throw new Error(`知らない引数: ${k}`);
  }
  if (!a.mode) throw new Error('--window START END か --pair D か --summary FILE のどれかが要る');
  return a;
}

// ── GA4 への問い合わせ（形だけ。通信は runReport を渡して行う） ──
const hostFilter = () => ({ filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: L.HOST_NAME } } });
const eventIn = names => ({ filter: { fieldName: 'eventName', inListFilter: { values: names } } });
const and = (...ex) => ({ andGroup: { expressions: ex } });

/** 1つの期間に送る問い合わせの一覧（名前 → 本体）。landingDim は入口ページの次元名 */
function buildRequests(win, landingDim = 'landingPagePlusQueryString') {
  const dateRanges = [{ startDate: win.start, endDate: win.end }];
  const host = hostFilter();
  return {
    landing: { dateRanges, dimensions: [{ name: 'deviceCategory' }, { name: landingDim }], metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }], dimensionFilter: host },
    pages: { dateRanges, dimensions: [{ name: 'deviceCategory' }, { name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'userEngagementDuration' }], dimensionFilter: host },
    totalsByDevice: { dateRanges, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'engagedSessions' }, { name: 'screenPageViews' }, { name: 'userEngagementDuration' }], dimensionFilter: host },
    totalsAll: { dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'engagedSessions' }, { name: 'screenPageViews' }, { name: 'userEngagementDuration' }, { name: 'eventCount' }], dimensionFilter: host },
    eventSessions: { dateRanges, dimensions: [{ name: 'eventName' }, { name: 'deviceCategory' }], metrics: [{ name: 'eventCount' }, { name: 'sessions' }], dimensionFilter: and(host, eventIn(L.EVENTS)) },
    events: { dateRanges, dimensions: [{ name: 'eventName' }, { name: 'deviceCategory' }, { name: 'pagePath' }], metrics: [{ name: 'eventCount' }], dimensionFilter: and(host, eventIn(L.EVENTS)) },
    reservation: { dateRanges, dimensions: [{ name: 'deviceCategory' }, { name: 'pagePath' }, { name: 'eventName' }, { name: 'customEvent:link_domain' }], metrics: [{ name: 'eventCount' }], dimensionFilter: and(host, eventIn(['cta_click', 'cta_reserve', 'outbound_click'])) },
  };
}

/** ページ送りをして全部の行を取る（rowCount に達するまで） */
async function fetchAll(runReport, body, { pageSize = 10000, maxPages = 50 } = {}) {
  const rows = [];
  let offset = 0;
  for (let i = 0; i < maxPages; i++) {
    const res = await runReport({ ...body, limit: String(pageSize), offset: String(offset) });
    const data = (res && res.data) || res || {};
    const got = L.rowsOf(res);
    rows.push(...got);
    offset += got.length;
    if (!got.length || offset >= (Number(data.rowCount) || 0)) break;
  }
  return rows;
}

const LANDING_DIMS = ['landingPagePlusQueryString', 'landingPage'];

async function fetchLanding(runReport, win, notes) {
  let lastErr;
  for (const dim of LANDING_DIMS) {
    try {
      const rows = await fetchAll(runReport, buildRequests(win, dim).landing);
      return { rows, dim };
    } catch (e) { lastErr = e; notes.push(`入口ページの次元 ${dim} が使えなかった: ${e.message}`); }
  }
  throw lastErr;
}

const round = (v, d = 3) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

/** セッション・表示・滞在から、比べやすい形の値を作る（割合は足し算できないので分子と分母から作る） */
function withRatios(c) {
  const s = c.sessions || 0;
  return {
    ...c,
    engagementRate: s > 0 ? round(c.engagedSessions / s) : null,
    bounceRate: s > 0 ? round(1 - c.engagedSessions / s) : null,
    pagesPerSession: s > 0 ? round(c.screenPageViews / s, 2) : null,
    engagementSecPerSession: s > 0 ? round(c.userEngagementDuration / s, 1) : null,
  };
}

/** 1つの期間の報告を作る。runReport(body) → GA4 の応答 */
async function reportWindow(runReport, win, opts = {}) {
  const notes = [];
  const land = await fetchLanding(runReport, win, notes);
  const req = buildRequests(win, land.dim);
  const get = name => fetchAll(runReport, req[name]);

  const [pages, totalsByDeviceRows, totalsAllRows, eventSessionRows, eventRows] = await Promise.all([
    get('pages'), get('totalsByDevice'), get('totalsAll'), get('eventSessions'), get('events'),
  ]);

  let reservationRows = null;
  try { reservationRows = await get('reservation'); }
  catch (e) { notes.push(`予約送客の内訳を取れなかった（link_domain のカスタムディメンション未登録など）: ${e.message}`); }

  const mNames = ['activeUsers', 'sessions', 'engagedSessions', 'screenPageViews', 'userEngagementDuration'];
  const byDevice = L.aggregateByDevice(totalsByDeviceRows, mNames);
  const all = totalsAllRows[0] ? Object.fromEntries([...mNames, 'eventCount'].map((m, i) => [m, totalsAllRows[0].mets[i]])) : Object.fromEntries([...mNames, 'eventCount'].map(m => [m, 0]));
  const totals = { all: withRatios(all), device: {} };
  L.DEVICES.forEach(d => { totals.device[d] = withRatios(byDevice[d]); });
  // 端末ごとの activeUsers は、複数の端末を使った人を二重に数える。全体の人数は all を使う
  totals.note = '端末別の activeUsers は複数の端末を使う人を二重に数える。全体の人数は all を使う';

  const events = L.aggregateEvents(eventRows);
  const eventSessions = L.aggregateEventSessions(eventSessionRows);
  const reservation = reservationRows ? L.aggregateReservation(reservationRows, dedupeReservationClicks) : null;

  const low = { threshold: L.LOW_COUNT, events: {}, reservation: reservation ? L.lowCountCells(reservation.cell) : null };
  Object.keys(events).forEach(n => { const c = L.lowCountCells(events[n].cell); if (c.length) low.events[n] = c; });

  return {
    window: { start: win.start, end: win.end, days: win.days, settled: win.settled, includesStorePageGap: win.includesStorePageGap, warnings: win.warnings },
    totals,
    landing: L.aggregateLanding(land.rows),
    pages: L.aggregatePages(pages),
    events,
    eventSessions,
    reservation,
    lowCount: low,
    notes,
    landingDimension: land.dim,
  };
}

/** 条件の記録（10.2 節の 7: 数字と一緒に、期間・区切り・使ったイベント名・取った日を残す） */
function conditionsOf(opts) {
  return {
    hostName: L.HOST_NAME,
    internalTrafficFilter: opts.internalFilter || 'unknown',
    storePageGa4From: L.STORE_PAGE_GA4_FROM,
    segmentation: { device: L.DEVICES, pageType: L.PAGE_TYPES, classifier: 'scripts/lib/ga4_baseline.js の classifyPage / classifyDevice' },
    events: L.EVENTS,
    reservationDefinition: 'scripts/lib/reservation_exits.js の dedupeReservationClicks（cta_click・cta_reserve・outbound_click をページ×リンク先で重ならないように数える）。電話は events.cta_call_click',
    lowCountThreshold: L.LOW_COUNT,
    notes: [
      '期間は GA4 プロパティのタイムゾーンの日付',
      'internalTrafficFilter が active でないとき、オーナーと作業者の訪問（セッション）が分母に混ざる（docs/ga4-internal-traffic-verification.md）',
      '中央値（1セッションで見た店の数など）は Data API では取れない。平均で代える',
    ],
  };
}

async function runBaseline(runReport, args, now = Date.now()) {
  const today = L.todayJst(now);
  const base = { schema: 'nb-ga4-baseline/1', label: args.label || '', fetchedAt: new Date(now).toISOString(), conditions: conditionsOf(args) };
  if (args.mode === 'window') {
    const win = L.windowOf(args.start, args.end, { today });
    if (!win.settled && !args.allowUnsettled) throw new Error(`${win.warnings[0]}（確定前の日を含めるなら --allow-unsettled）`);
    return { ...base, mode: 'window', ...(await reportWindow(runReport, win)) };
  }
  const pair = L.windowPair(args.D, args.days, { today });
  const out = { ...base, mode: 'pair', D: pair.D, days: pair.days, requestedDays: pair.requestedDays, pairNotes: pair.notes };
  // 前の期間も、window と同じく確定前の日を含むなら止める（確定前の数字を基線にしない）
  if (!pair.before.settled && !args.allowUnsettled) throw new Error(`前の期間（${pair.before.start}〜${pair.before.end}）: ${pair.before.warnings[0]}（確定前の日を含めるなら --allow-unsettled）`);
  out.before = await reportWindow(runReport, pair.before);
  if (pair.after.settled || args.allowUnsettled) out.after = await reportWindow(runReport, pair.after);
  else { out.after = null; out.pairNotes.push(`後の期間（${pair.after.start}〜${pair.after.end}）はまだ確定していないので取っていない`); }
  return out;
}

// ── 表（Actions の要約・読む用） ──
function pct(v) { return v == null ? '—' : `${(v * 100).toFixed(1)}%`; }
function summaryOf(rep, title) {
  const w = rep.window;
  const lines = [`### ${title}（${w.start}〜${w.end}・${w.days}日・${w.settled ? '確定済み' : '確定前を含む'}）`, ''];
  w.warnings.forEach(x => lines.push(`- ⚠️ ${x}`));
  rep.notes.forEach(x => lines.push(`- ⚠️ ${x}`));
  lines.push('', '| 端末 | セッション | 表示 | 動きのあったセッション | 直帰 | 表示/セッション | 滞在秒/セッション |', '|---|---:|---:|---:|---:|---:|---:|');
  ['all', ...L.DEVICES].forEach(d => {
    const c = d === 'all' ? rep.totals.all : rep.totals.device[d];
    lines.push(`| ${d} | ${c.sessions} | ${c.screenPageViews} | ${pct(c.engagementRate)} | ${pct(c.bounceRate)} | ${c.pagesPerSession ?? '—'} | ${c.engagementSecPerSession ?? '—'} |`);
  });
  lines.push('', '| 入口のページ種別 | セッション | 動きのあったセッション | 表示 | 滞在秒/表示 |', '|---|---:|---:|---:|---:|');
  L.PAGE_TYPES.forEach(t => {
    const a = rep.landing[t].all; const p = rep.pages[t].all;
    if (!a.sessions && !p.views) return;
    lines.push(`| ${t} | ${a.sessions} | ${pct(a.engagementRate)} | ${p.views} | ${p.engagementSecPerView ?? '—'} |`);
  });
  lines.push('', '| イベント | 回数 | セッション数 | スマホ | PC |', '|---|---:|---:|---:|---:|');
  Object.keys(rep.events).sort((a, b) => rep.events[b].total - rep.events[a].total).forEach(n => {
    const e = rep.events[n]; const s = rep.eventSessions[n];
    lines.push(`| ${n} | ${e.total} | ${s ? s.sessions : '—'} | ${e.device.mobile} | ${e.device.desktop} |`);
  });
  if (rep.reservation) lines.push('', `予約送客（重ならない数え方）: 合計 ${rep.reservation.total}・スマホ ${rep.reservation.device.mobile}・PC ${rep.reservation.device.desktop}`);
  const lowN = Object.keys(rep.lowCount.events).length;
  lines.push('', `件数が ${rep.lowCount.threshold} 件未満のセルがあるイベント: ${lowN} 種類（向きを判定せず「保留」にする候補）`);
  return lines.join('\n');
}
function summaryOfFile(json) {
  const parts = [`## GA4 基線${json.label ? `: ${json.label}` : ''}（取った日時 ${json.fetchedAt}）`, '', `内部トラフィックのフィルタ: ${json.conditions.internalTrafficFilter}`, ''];
  if (json.mode === 'pair') {
    json.pairNotes.forEach(x => parts.push(`- ${x}`));
    parts.push('', summaryOf(json.before, '前'));
    if (json.after) parts.push('', summaryOf(json.after, '後'));
  } else parts.push(summaryOf(json, '期間'));
  return parts.join('\n');
}

// ── 実行 ──
async function makeRunReport(env = process.env) {
  let credentials;
  // JSON.parse の失敗メッセージは入力の一部を含む。鍵の断片が公開リポジトリの Actions のログに残らないよう、固定の文言にする
  // require('googleapis') より先に検査する（googleapis が無い環境でも鍵のエラーが先に出るように）
  try { credentials = JSON.parse(env.GA4_SERVICE_ACCOUNT_KEY); }
  catch (e) { throw new Error('GA4_SERVICE_ACCOUNT_KEY が JSON として読めない（中身は表示しない）'); }
  const { google } = require('googleapis');
  const auth = new google.auth.JWT({ email: credentials.client_email, key: credentials.private_key, scopes: ['https://www.googleapis.com/auth/analytics.readonly'] });
  await auth.authorize();
  const data = google.analyticsdata({ version: 'v1beta', auth });
  return body => data.properties.runReport({ property: `properties/${env.GA4_PROPERTY_ID}`, requestBody: body });
}

async function main(argv = process.argv.slice(2), env = process.env) {
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error(e.message); return 1; }

  if (args.mode === 'summary') { console.log(summaryOfFile(JSON.parse(fs.readFileSync(args.summary, 'utf8')))); return 0; }

  if (args.dryRun) {
    const today = L.todayJst();
    const wins = args.mode === 'window' ? [['期間', L.windowOf(args.start, args.end, { today })]] : (p => [['前', p.before], ['後', p.after]])(L.windowPair(args.D, args.days, { today }));
    wins.forEach(([n, w]) => { console.log(`# ${n}: ${w.start}〜${w.end}（${w.days}日・${w.settled ? '確定済み' : '確定前を含む'}）`); w.warnings.forEach(x => console.log(`# ⚠️ ${x}`)); console.log(JSON.stringify(buildRequests(w), null, 1)); });
    return 0;
  }

  if (!env.GA4_SERVICE_ACCOUNT_KEY || !env.GA4_PROPERTY_ID) {
    console.error('GA4_SERVICE_ACCOUNT_KEY と GA4_PROPERTY_ID が要る（GitHub Secrets。.github/workflows/ga4-baseline.yml から実行する）。何も取っていない。');
    return 2;
  }
  let result;
  try { result = await runBaseline(await makeRunReport(env), args); }
  catch (e) { console.error(`GA4 の基線を取れなかった: ${e.message}`); return 1; }
  const text = JSON.stringify(result, null, 1) + '\n';
  if (args.out) { fs.writeFileSync(args.out, text); console.error(`書き出した: ${args.out}`); } else process.stdout.write(text);
  return 0;
}

if (require.main === module) main().then(c => process.exit(c));

module.exports = { MAX_DAYS, parseArgs, buildRequests, fetchAll, fetchLanding, reportWindow, runBaseline, conditionsOf, withRatios, summaryOfFile, main, INTERNAL_FILTER_STATES };
