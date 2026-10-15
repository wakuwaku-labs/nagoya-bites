'use strict';
/**
 * scripts/ga4_fragment_counts.js
 *
 * GA4 が受け取ったページの URL（pageLocation）のうち、# の後ろ（フラグメント）を含むものを数える（P-475・ISSUE-193・2026-10-15）。
 * トップは絞り込みの状態を URL の # に書く（`#area=…&q=<検索語>&store=…`・index.html の nbBuildHash・history.replaceState）。
 * 「現在地」ボタンで位置から選んだエリアも `#q=<エリア名>` に入る。GA4 がこの URL をどれだけ受け取っているかを、事実で確かめる。
 *
 * 出すのは件数だけ。URL そのもの・利用者が打ち込んだ検索語・店の ID は表示しない（ジョブの記録は公開リポジトリで誰でも読める）。
 *   - q の値は「現在地」が選ぶエリア名（index.html の GEO_AREAS）かどうかだけで分ける。それ以外の値は「その他」として数えるだけ
 *   - # の後ろのキーは index.html が書くキー（genre・area・cond・tag・cap・q・store）だけ名前を出し、ほかは「その他のキー」にまとめる
 *   - プロパティ ID は出力に書かない（scripts/ga4_baseline.js と同じ）
 *
 * 使い方（GA4 の鍵は GitHub Secrets だけにあるので、実行は .github/workflows/ga4-fragment-counts.yml から）:
 *   node scripts/ga4_fragment_counts.js [--start YYYY-MM-DD|NdaysAgo] [--end YYYY-MM-DD|yesterday] [--json <出力先>]
 * 環境変数: GA4_SERVICE_ACCOUNT_KEY（サービスアカウント JSON 全文）・GA4_PROPERTY_ID（数字）。無いときは終了コード 2 で何も取らない。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// index.html の nbFilterParams と nbBuildHash が書くキー
const KNOWN_KEYS = ['genre', 'area', 'cond', 'tag', 'cap', 'q', 'store'];
// 対照: # を書いた後に送るイベント。filter_apply は applyFilters（→ pushHash が # を書く）の直後に必ず送る。
// これが 1 回以上あるのに # を含む URL が 0 なら、GA4 は # の後ろを受け取っていない（問い合わせの不具合ではない）
const CONTROL_EVENTS = ['filter_apply', 'modal_open', 'search', 'geo_search'];
const PAGE_LIMIT = 100000;
const MAX_ROWS = 500000;

/** index.html の GEO_AREAS（「現在地」が選ぶエリア名）を読む */
function readGeoAreas(html) {
  const start = html.indexOf('GEO_AREAS');
  if (start < 0) return [];
  const end = html.indexOf('};', start);
  const body = html.slice(start, end < 0 ? start + 5000 : end);
  const names = [];
  const re = /['"]?([^'"{},:\s]+)['"]?\s*:\s*\{\s*lat/g;
  let m;
  while ((m = re.exec(body))) names.push(m[1]);
  return names;
}

function safeDecode(s) {
  try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return String(s); }
}

/**
 * 1 つの URL を分ける。値は返さない（分類だけ）。
 * @returns {{fragment:boolean, keys:string[], q:'none'|'geo-area'|'other'}}
 */
function classifyLocation(url, geoNames) {
  const s = String(url || '');
  const i = s.indexOf('#');
  if (i < 0) return { fragment: false, keys: [], q: 'none' };
  const params = {};
  s.slice(i + 1).split('&').forEach((p) => {
    const j = p.indexOf('=');
    if (j < 1) return;
    params[p.slice(0, j)] = safeDecode(p.slice(j + 1));
  });
  const keys = Object.keys(params).map((k) => (KNOWN_KEYS.includes(k) ? k : '(その他のキー)'));
  let q = 'none';
  if (Object.prototype.hasOwnProperty.call(params, 'q') && params.q.trim()) {
    q = geoNames.includes(params.q.trim()) ? 'geo-area' : 'other';
  }
  return { fragment: true, keys: [...new Set(keys)], q };
}

/**
 * GA4 の行（eventName × pageLocation × eventCount）を件数にまとめる。
 * @param {Array<{event:string, location:string, count:number|string}>} rows
 */
function aggregate(rows, geoNames) {
  const out = {
    rows: 0,
    otherBucket: 0, // GA4 が値の種類の多さで (other) にまとめた行
    events: { withFragment: 0, qGeoArea: 0, qOther: 0, qNone: 0 },
    byKey: {},
    byEvent: {}, // { eventName: { withFragment, qGeoArea, qOther } }
  };
  for (const r of rows || []) {
    const n = parseInt(r.count, 10) || 0;
    if (n <= 0) continue;
    out.rows++;
    if (r.location === '(other)') { out.otherBucket += n; continue; }
    const c = classifyLocation(r.location, geoNames);
    if (!c.fragment) continue;
    out.events.withFragment += n;
    const qKey = c.q === 'geo-area' ? 'qGeoArea' : c.q === 'other' ? 'qOther' : 'qNone';
    out.events[qKey] += n;
    for (const k of c.keys) out.byKey[k] = (out.byKey[k] || 0) + n;
    const ev = String(r.event || '(not set)');
    const e = out.byEvent[ev] || (out.byEvent[ev] = { withFragment: 0, qGeoArea: 0, qOther: 0 });
    e.withFragment += n;
    if (c.q === 'geo-area') e.qGeoArea += n;
    if (c.q === 'other') e.qOther += n;
  }
  return out;
}

/** 件数だけの要約（Markdown）。URL・検索語・店の ID は入れない */
function summarize(result) {
  const a = result.counts;
  const lines = [];
  lines.push(`## GA4 が受け取った URL の # の後ろ（P-475）`);
  lines.push('');
  lines.push(`- 期間: ${result.start} 〜 ${result.end}（取得 ${result.fetchedAt}）`);
  lines.push(`- 期間のイベントの合計: ${result.totalEvents}（うち page_view ${result.totalPageViews}）`);
  const ctl = result.controlEvents || {};
  lines.push(`- 対照（# を書いた後に送るイベントの回数。filter_apply は # を書いた直後に必ず送る）: ${CONTROL_EVENTS.map((e) => `${e} ${ctl[e] || 0}`).join('・')}`);
  lines.push(`- URL に # を含むイベント: ${a.events.withFragment}`);
  lines.push(`  - q がエリア名（「現在地」が選ぶ ${result.geoAreas.length} 個のどれか。検索欄に同じ名前を打った分も入るので、「現在地」の分の上限）: ${a.events.qGeoArea}`);
  lines.push(`  - q がそれ以外（手入力の検索語など。値は出さない）: ${a.events.qOther}`);
  lines.push(`  - q なし: ${a.events.qNone}`);
  if (a.otherBucket) lines.push(`- GA4 が (other) にまとめた分（分類できない）: ${a.otherBucket}`);
  lines.push('');
  lines.push('| # の後ろのキー | イベント数 |');
  lines.push('|---|---|');
  const keys = Object.entries(a.byKey).sort((x, y) => y[1] - x[1]);
  if (!keys.length) lines.push('| （なし） | 0 |');
  for (const [k, n] of keys) lines.push(`| ${k} | ${n} |`);
  lines.push('');
  lines.push('| イベント | # あり | q=エリア名 | q=それ以外 |');
  lines.push('|---|---|---|---|');
  const evs = Object.entries(a.byEvent).sort((x, y) => y[1].withFragment - x[1].withFragment).slice(0, 20);
  if (!evs.length) lines.push('| （なし） | 0 | 0 | 0 |');
  for (const [ev, e] of evs) lines.push(`| ${ev} | ${e.withFragment} | ${e.qGeoArea} | ${e.qOther} |`);
  lines.push('');
  lines.push(`取得した行: ${a.rows}${result.truncated ? '（上限で打ち切り。件数は下限）' : ''}`);
  return lines.join('\n');
}

// GA4 の日付の書き方（YYYY-MM-DD・NdaysAgo・yesterday・today）だけを受け付ける
const DATE_RE = /^(\d{4}-\d{2}-\d{2}|\d{1,4}daysAgo|yesterday|today)$/;

function parseArgs(argv) {
  const get = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
  const out = { start: get('--start', '30daysAgo'), end: get('--end', 'yesterday'), json: get('--json', '') };
  for (const k of ['start', 'end']) {
    if (!DATE_RE.test(out[k])) throw Object.assign(new Error(`--${k} は YYYY-MM-DD・NdaysAgo・yesterday・today のどれか: ${out[k]}`), { exitCode: 2 });
  }
  return out;
}

async function fetchRows(runReport, start, end) {
  const rows = [];
  let offset = 0;
  let truncated = false;
  for (;;) {
    const res = await runReport({
      dimensions: [{ name: 'eventName' }, { name: 'pageLocation' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'pageLocation', stringFilter: { matchType: 'CONTAINS', value: '#' } } },
      dateRanges: [{ startDate: start, endDate: end }],
      limit: String(PAGE_LIMIT),
      offset: String(offset),
    });
    const got = (res.data.rows || []).map((row) => ({
      event: row.dimensionValues[0].value,
      location: row.dimensionValues[1].value,
      count: row.metricValues[0].value,
    }));
    rows.push(...got);
    const total = parseInt(res.data.rowCount, 10) || 0;
    offset += got.length;
    if (!got.length || offset >= total) break;
    if (offset >= MAX_ROWS) { truncated = true; break; }
  }
  return { rows, truncated };
}

async function fetchTotals(runReport, start, end) {
  const res = await runReport({
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dateRanges: [{ startDate: start, endDate: end }],
    limit: '1000',
  });
  let total = 0;
  let pageViews = 0;
  const control = {};
  for (const row of res.data.rows || []) {
    const n = parseInt(row.metricValues[0].value, 10) || 0;
    const name = row.dimensionValues[0].value;
    total += n;
    if (name === 'page_view') pageViews += n;
    if (CONTROL_EVENTS.includes(name)) control[name] = (control[name] || 0) + n;
  }
  return { total, pageViews, control };
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exit(e.exitCode || 2); }
  const env = process.env;
  if (!env.GA4_SERVICE_ACCOUNT_KEY || !env.GA4_PROPERTY_ID) {
    console.error('GA4_SERVICE_ACCOUNT_KEY と GA4_PROPERTY_ID が要る（GitHub Secrets。.github/workflows/ga4-fragment-counts.yml から実行する）。何も取っていない。');
    process.exit(2);
  }
  let credentials;
  try { credentials = JSON.parse(env.GA4_SERVICE_ACCOUNT_KEY); }
  catch (e) { console.error('GA4_SERVICE_ACCOUNT_KEY が JSON として読めない（中身は表示しない）'); process.exit(2); }
  const { google } = require('googleapis');
  const auth = new google.auth.JWT({ email: credentials.client_email, key: credentials.private_key, scopes: ['https://www.googleapis.com/auth/analytics.readonly'] });
  const data = google.analyticsdata({ version: 'v1beta', auth });
  const runReport = (body) => data.properties.runReport({ property: `properties/${env.GA4_PROPERTY_ID}`, requestBody: body });

  const geoAreas = readGeoAreas(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
  if (!geoAreas.length) throw new Error('index.html から GEO_AREAS を読めない');
  const { rows, truncated } = await fetchRows(runReport, args.start, args.end);
  const totals = await fetchTotals(runReport, args.start, args.end);
  const result = {
    start: args.start, end: args.end, fetchedAt: new Date().toISOString(),
    geoAreas, truncated, totalEvents: totals.total, totalPageViews: totals.pageViews, controlEvents: totals.control,
    counts: aggregate(rows, geoAreas),
  };
  console.log(summarize(result));
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(result, null, 2));
}

module.exports = { KNOWN_KEYS, CONTROL_EVENTS, readGeoAreas, classifyLocation, aggregate, summarize, parseArgs, fetchRows, fetchTotals };

if (require.main === module) {
  main().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
}
