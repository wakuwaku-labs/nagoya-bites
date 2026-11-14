'use strict';

/**
 * GAS 日次レポート: 直接アクセスの急増（機械的な訪問の疑い）を判定・助言から外す（2026-11-14）。
 *
 * 2026-11-11 の LINE レポートは、訪問 826 回のうち 692 回が直接アクセス（普段は約 18 回）で、
 * 直帰率 88%・滞在 24 秒から「🔴 苦戦中」と判定し、その数字から施策を出していた。
 * .gas-deploy/Code.js を vm で読み込み、その日の形の数字で本文を作って確かめる。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '.gas-deploy', 'Code.js'), 'utf8');

function loadGas(runReport) {
  const ctx = {
    Logger: { log() {} },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 503, getContentText: () => '' }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    AnalyticsData: { Properties: { runReport: runReport || (() => ({})) } },
    GmailApp: { sendEmail() {} },
    console,
  };
  vm.createContext(ctx);
  // const/let はコンテキストの外から見えないので、使う関数を最後に globalThis へ出す
  vm.runInContext(SRC + '\n;globalThis.__gas = { formatDailyReport, detectDirectSpike, excludeDirectSpike, shiftDateStr, formatWeeklyReport, detectDirectSpikeRange, excludeDirectSpikeWeek, withDirectExclusion, fetchGA4Report, directSpikeNote };', ctx);
  return ctx.__gas;
}

const row = (dims, mets) => ({ dimensions: dims, metrics: mets.map(String) });

// 2026-11-11 の形（直帰率・滞在・訪問・流入元は LINE のレポートと同じ値）
function data1111() {
  const settledTotals = { users: 816, pageviews: 867, sessions: 826, avgDuration: 24, bounceRate: 0.88, events: 3000 };
  return {
    pages: [row(['/features/nagoya-solo-dining.html'], ['15', '19']), row(['/journal/2026-11-08-x.html'], ['10', '12'])],
    events: [row(['modal_open'], ['17']), row(['cta_call_click'], ['1']), row(['cta_gmap_click'], ['8'])],
    sources: [],
    devices: [row(['desktop'], ['740']), row(['mobile'], ['76'])],
    totals: { users: 816, pageviews: 867, sessions: 826, avgDuration: 24, bounceRate: 0.88, events: 3000 },
    outboundByDomain: [],
    reserveClicks: [row(['/', 'cta_click', 'hotpepper.jp'], ['8'])],
    settled: {
      date: '2026-11-11',
      totals: settledTotals,
      sources: [
        row(['(direct)', '(none)'], ['680', '692']),
        row(['google', 'organic'], ['50', '53']),
        row(['bing', 'organic'], ['40', '43']),
        row(['yahoo', 'organic'], ['20', '22']),
        row(['chatgpt.com', 'ai-assistant'], ['10', '10']),
      ],
    },
  };
}

// 直前14日は直接アクセス 15〜21 回、当日は 692 回（直帰 0.97・滞在 5 秒・閲覧 700）
function directRows(todaySessions) {
  const rows = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(Date.UTC(2026, 10, 11 - i)).toISOString().slice(0, 10).replace(/-/g, '');
    rows.push(row([d], [15 + (i % 7), 20, 60, 0.4]));
  }
  rows.push(row(['20261111'], [todaySessions, 700, 5, 0.97]));
  return rows;
}

test('shiftDateStr は月をまたいでも正しく日をずらす', () => {
  const g = loadGas();
  assert.equal(g.shiftDateStr('2026-11-01', -14), '2026-10-18');
  assert.equal(g.shiftDateStr('2026-03-01', -1), '2026-02-28');
});

test('普段の約38倍の直接アクセスは急増と判定し、普段の揺れは判定しない', () => {
  const g = loadGas();
  const sp = g.detectDirectSpike(directRows(692), '2026-11-11');
  assert.equal(sp.spiking, true);
  assert.equal(sp.median, 18);
  const calm = g.detectDirectSpike(directRows(60), '2026-11-11');
  assert.equal(calm.spiking, false, '普段の3倍強でも上乗せが100回未満なら鳴らさない');
  assert.equal(g.detectDirectSpike([], '2026-11-11'), null);
});

test('急増の日: 判定・読まれ方・流入元・助言は直接アクセスを除いた値になる', () => {
  const g = loadGas();
  const spike = g.detectDirectSpike(directRows(692), '2026-11-11');
  const data = g.excludeDirectSpike(data1111(), spike);
  const msg = g.formatDailyReport(data, '2026-11-11');

  assert.doesNotMatch(msg, /苦戦中/, '機械的な訪問で「苦戦中」と判定しない');
  assert.match(msg, /直接アクセスの急増を除いた判定/);
  assert.match(msg, /直接アクセスを除いた値で出しています/);
  // 直接アクセスを除いた直帰率: (0.88*826 - 0.97*692) / 134 ≈ 41%
  const bounce = Number(msg.match(/すぐ帰った人の割合: (\d+)%/)[1]);
  assert.ok(bounce >= 38 && bounce <= 44, `直帰率 ${bounce}%`);
  assert.doesNotMatch(msg, /直接アクセス（お気に入り等）/, '流入元の TOP3 から直接アクセスを外す');
  assert.match(msg, /この日は出しません/, '予約の率は分母が膨らむので出さない');
  assert.doesNotMatch(msg, /予約ボタンが訪問/);
  assert.match(msg, /⚠️ 直接アクセスが普段の約38倍/);
  // 見張り（scripts/lib/gas_deploy_trace.js）が読む確定値ラベルは今までどおり
  assert.match(msg, /【読まれ方（確定値・2026-11-11）】/);
});

test('急増でない日は今までどおり（数字を置き換えない）', () => {
  const g = loadGas();
  const d = data1111();
  const same = g.excludeDirectSpike(d, g.detectDirectSpike(directRows(60), '2026-11-11'));
  assert.equal(same, d);
  const msg = g.formatDailyReport(same, '2026-11-11');
  assert.match(msg, /すぐ帰った人の割合: 88%/);
  assert.doesNotMatch(msg, /直接アクセスを除いた/);
});

test('助言の文言: 押された回数を書き、店の選び方の禁止語を出さない', () => {
  const g = loadGas();
  const msgs = [];
  // 日によって選ばれる打ち手が替わる（rotate）ので、数日分を作って全部を見る
  for (let day = 1; day <= 9; day++) {
    const d = data1111();
    const date = '2026-11-0' + day;
    d.settled.date = date;
    msgs.push(g.formatDailyReport(d, date));
  }
  const all = msgs.join('\n');
  assert.doesNotMatch(all, /ほぼ未クリック/);
  assert.match(all, /予約ボタンが訪問816人中8回しか押されていない/);
  assert.doesNotMatch(all, /現役|業界人|目利き/);
  assert.doesNotMatch(all, /訪問826件/);
});

test('見張りの直帰率の照合: 直接アクセスを除いたと名乗る日は判定しない・名乗らない日は今までどおり', () => {
  const { analyzeNumeric, analyzeReport } = require('../scripts/lib/gas_deploy_trace');
  const ref = { bounceRate: 0.88, sessions: 826 };
  const g = loadGas();
  const spiked = g.formatDailyReport(g.excludeDirectSpike(data1111(), g.detectDirectSpike(directRows(692), '2026-11-11')), '2026-11-11');
  const r1 = analyzeNumeric(spiked, ref).find((m) => m.key === 'bounce_rate_divergence');
  assert.equal(r1.verdict, 'indeterminate');
  const r2 = analyzeNumeric('↩️ すぐ帰った人の割合: 42% 🟢', ref).find((m) => m.key === 'bounce_rate_divergence');
  assert.equal(r2.verdict, 'not_deployed');
  // 新しい本文は新コードの痕跡で deployed、旧コードの文言は not_deployed
  const keys = (body) => analyzeReport(body).matched.map((m) => m.key + ':' + m.verdict);
  assert.ok(keys(spiked).includes('direct_spike_notice:deployed'));
  assert.ok(keys('🔴 予約ボタンが訪問816人中ほぼ未クリック（1.0%）').includes('cta_almost_none_old_label:not_deployed'));
});

// ── 週次（2026-11-14）: 11/11 を含む週。11/5〜11/11 の週と、その前の週 10/29〜11/4 ──
function weekData(sessions, bounce, direct) {
  return {
    pages: [row(['/features/nagoya-solo-dining.html'], ['15', '19'])],
    events: [row(['modal_open'], ['17'])],
    sources: [row(['(direct)', '(none)'], [String(direct), String(direct)]), row(['google', 'organic'], ['200', '250']), row(['bing', 'organic'], ['40', '43'])],
    devices: [row(['desktop'], ['700']), row(['mobile'], ['300'])],
    totals: { users: 900, pageviews: Math.round(sessions * 1.2), sessions, avgDuration: 30, bounceRate: bounce, events: 3000 },
    outboundByDomain: [],
    reserveClicks: [],
  };
}
// 10/15〜11/11 の直接アクセス。普段は 15〜21 回、11/11 だけ 692 回（直帰 0.97・滞在 5 秒）
function directRowsWeek() {
  const rows = [];
  for (let i = 0; i <= 27; i++) {
    const d = new Date(Date.UTC(2026, 10, 11 - i)).toISOString().slice(0, 10).replace(/-/g, '');
    rows.push(i === 0 ? row([d], [692, 700, 5, 0.97]) : row([d], [15 + (i % 7), 20, 60, 0.4]));
  }
  return rows;
}

test('週次: 急増の日だけを合算し、普段の週は null', () => {
  const g = loadGas();
  const sp = g.detectDirectSpikeRange(directRowsWeek(), '2026-11-05', '2026-11-11');
  assert.deepEqual(Array.from(sp.dates), ['2026-11-11']);
  assert.equal(sp.sessions, 692);
  assert.equal(g.detectDirectSpikeRange(directRowsWeek(), '2026-10-29', '2026-11-04'), null);
});

test('週次: 11/11 を含む週は断り書きが出て、直帰率・訪問回数・流入元は除外後の値になる', () => {
  const g = loadGas();
  const rows = directRowsWeek();
  // 今週: 訪問 1100（うち直接 692+通常日分）。直帰率は直接の 0.97 に引かれて 0.76
  const raw = weekData(1100, 0.76, 692 + 90);
  const prev = weekData(400, 0.42, 110);
  const sp = g.detectDirectSpikeRange(rows, '2026-11-05', '2026-11-11');
  const spPrev = g.detectDirectSpikeRange(rows, '2026-10-29', '2026-11-04');
  const data = g.excludeDirectSpikeWeek(raw, sp);
  const prevData = g.excludeDirectSpikeWeek(prev, spPrev);
  assert.equal(prevData, prev, '先週は急増なし＝数字を置き換えない');
  const msg = g.formatWeeklyReport(data, prevData, '2026-11-05', '2026-11-11', null);

  assert.match(msg, /直接アクセスを除いた/);
  assert.match(msg, /2026-11-11/);
  // 直帰率: (0.78*1100 - 0.97*692) / 408 ≈ 0.4 → 40% 前後（除外前は 78%）
  const bounce = Number(msg.match(/すぐ帰った率: (\d+)%/)[1]);
  assert.ok(bounce >= 38 && bounce <= 44, `直帰率 ${bounce}%`);
  assert.match(msg, /訪問回数: 408（先週 400）/);
  assert.doesNotMatch(msg, /苦戦中/);
  assert.doesNotMatch(msg, /減速中/);
  assert.match(msg, /⚠️ 直接アクセスが普段の約/);
  // 流入元: 直接は 782-692=90 回だけ残り、google が先頭
  assert.match(msg, /🥇 .*(google|Google)/i);
});

test('週次: 急増の無い週は今までどおり（断り書きなし）', () => {
  const g = loadGas();
  const raw = weekData(500, 0.55, 90);
  const same = g.excludeDirectSpikeWeek(raw, null);
  assert.equal(same, raw);
  const msg = g.formatWeeklyReport(same, weekData(480, 0.5, 90), '2026-10-29', '2026-11-04', null);
  assert.doesNotMatch(msg, /直接アクセスを除いた/);
  assert.match(msg, /すぐ帰った率: 55%/);
});

// 2026-11-14 本人「急に増えた数字分が含まれている」: 訪問した人・ページ数・人気ページ・行動・デバイスも
// GA4 の取得の段階で、急増の日の直接アクセスを除く
test('急増の日は GA4 の全部の取得から、その日の直接アクセスを除く', () => {
  const reqs = [];
  const g = loadGas((req) => { reqs.push(JSON.parse(JSON.stringify(req))); return {}; });
  g.fetchGA4Report('2026-11-12', '2026-11-12', ['2026-11-12']);
  assert.equal(reqs.length, 7);
  reqs.forEach((r) => {
    const s = JSON.stringify(r.dimensionFilter);
    assert.match(s, /notExpression/);
    assert.match(s, /"\(direct\)"/);
    assert.match(s, /"20261112"/);
    assert.match(s, /nagoya-bites\.com/, 'ホストの絞り込みは残す');
  });
  reqs.length = 0;
  g.fetchGA4Report('2026-11-10', '2026-11-10');
  reqs.forEach((r) => assert.doesNotMatch(JSON.stringify(r.dimensionFilter), /notExpression/, '急増でない日は今までどおり'));
});

test('全部を除いた日は「すべて除いた」と書き、予約の率も出す', () => {
  const g = loadGas();
  const spike = g.detectDirectSpike(directRows(692), '2026-11-11');
  spike.allExcluded = true;
  const d = data1111();
  // 取得の段階で除いた後の形（訪問者・デバイスは人の訪問だけ）
  d.totals = { users: 130, pageviews: 170, sessions: 134, avgDuration: 70, bounceRate: 0.4, events: 400 };
  d.devices = [row(['mobile'], ['70']), row(['desktop'], ['60'])];
  const msg = g.formatDailyReport(g.excludeDirectSpike(d, spike), '2026-11-11');
  assert.match(msg, /この日の数字はすべて直接アクセスを除いた値で出しています/);
  assert.doesNotMatch(msg, /除けないので/);
  assert.match(msg, /訪問した人: 130人/);
  assert.doesNotMatch(msg, /この日は出しません/);
  assert.match(msg, /訪問100人あたり予約行動/);
  assert.doesNotMatch(msg, /苦戦中/);
});

// 2026-11-14 本人「文字化けしている」: GmailApp は 4バイトの絵文字を化けさせる。件名・テキスト版から外し、HTML 版は文字参照で残す
test('レポートのメールは絵文字を化けない形で送る', () => {
  const sent = [];
  const ctx = { Logger: { log() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) }, UrlFetchApp: {}, AnalyticsData: { Properties: { runReport: () => ({}) } },
    GmailApp: { sendEmail: (...a) => sent.push(a) }, console };
  vm.createContext(ctx);
  vm.runInContext(SRC + '\n;globalThis.__s = sendReportEmail;', ctx);
  ctx.__s('📊 NAGOYA BITES 日次レポート 2026-11-12', '📊 NAGOYA BITES\n👥 訪問した人: 130人\n⏱ 平均滞在時間: 1分 🟢\n<a>&');
  const [to, subject, body, opts] = sent[0];
  assert.equal(subject, 'NAGOYA BITES 日次レポート 2026-11-12');
  assert.doesNotMatch(body, /[\u{10000}-\u{10FFFF}]/u);
  assert.match(body, /^訪問した人: 130人$/m);
  assert.match(body, /⏱ 平均滞在時間/, '3バイトの記号は化けないので残す');
  assert.doesNotMatch(opts.htmlBody, /[\u{10000}-\u{10FFFF}]/u);
  assert.match(opts.htmlBody, /&#x1F4CA;/);
  assert.match(opts.htmlBody, /&lt;a&gt;&amp;/);
  assert.ok(to);
});
