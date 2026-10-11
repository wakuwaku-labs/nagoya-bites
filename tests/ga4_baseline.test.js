'use strict';
// UI・UX改修計画 I-02: GA4 の数字を「決まった期間・決まった区切り」で取り直す scripts/ga4_baseline.js。
// 通信はしない。偽の runReport で、問い合わせの形・ページ送り・期間の組み方・集計を確かめる。
const test = require('node:test');
const assert = require('node:assert');

const L = require('../scripts/lib/ga4_baseline');
const B = require('../scripts/ga4_baseline');

// ── 分類 ──
test('classifyPage: URL の先頭でページ種別に分ける（クエリ・ハッシュは無視）', () => {
  const cases = {
    '/': 'top', '/index.html': 'top', '/?q=ramen': 'top',
    '/stores/J004660861.html': 'store', '/stores/awayuki.html?x=1': 'store', '/stores/store-e9aea820e98a80e5.html': 'store',
    '/stores/area/sakae/izakaya.html': 'hub', '/stores/area/': 'hub',
    '/stores/': 'stores-index', '/stores/index.html': 'stores-index',
    '/features/nagoya-solo-dining.html': 'feature', '/features/': 'features-index', '/features/index.html': 'features-index',
    '/journal/2026-10-11-x.html': 'journal', '/journal/': 'journal-index', '/journal/index.html': 'journal-index',
    '/faq.html': 'other', '/editorial-policy.html': 'other', '(not set)': 'other', '': 'other', '/stores/a/b.html': 'other',
  };
  for (const [p, t] of Object.entries(cases)) assert.strictEqual(L.classifyPage(p), t, p);
});

test('classifyPage: ページ種別の一覧に無い値を返さない', () => {
  for (const p of ['/', '/stores/x.html', '/stores/area/a/b.html', '/features/', '/journal/', '/zzz']) {
    assert.ok(L.PAGE_TYPES.includes(L.classifyPage(p)), p);
  }
});

test('classifyDevice: スマホ・PC・その他', () => {
  assert.strictEqual(L.classifyDevice('mobile'), 'mobile');
  assert.strictEqual(L.classifyDevice('Desktop'), 'desktop');
  assert.strictEqual(L.classifyDevice('tablet'), 'other');
  assert.strictEqual(L.classifyDevice('smart tv'), 'other');
  assert.strictEqual(L.classifyDevice(undefined), 'other');
});

// ── 期間 ──
test('windowPair: D の前後 28 日。D は数えない', () => {
  const p = L.windowPair('2026-11-20', 28, { today: '2026-12-31' });
  assert.deepStrictEqual([p.before.start, p.before.end], ['2026-10-23', '2026-11-19']);
  assert.deepStrictEqual([p.after.start, p.after.end], ['2026-11-21', '2026-12-18']);
  assert.strictEqual(p.before.days, 28);
  assert.strictEqual(p.after.days, 28);
  assert.strictEqual(p.days, 28);
  assert.deepStrictEqual(p.notes, []);
  assert.strictEqual(p.before.includesStorePageGap, false);
});

test('windowPair: 前が 2026-10-09 より前にかかるときは、取れる日数で前後をそろえる', () => {
  const p = L.windowPair('2026-10-20', 28, { today: '2026-12-31' });
  assert.strictEqual(p.days, 11); // 10-09〜10-19
  assert.deepStrictEqual([p.before.start, p.before.end], ['2026-10-09', '2026-10-19']);
  assert.deepStrictEqual([p.after.start, p.after.end], ['2026-10-21', '2026-10-31']);
  assert.strictEqual(p.before.days, p.after.days);
  assert.ok(p.notes[0].includes('28'));
  assert.strictEqual(p.before.includesStorePageGap, false);
});

test('windowPair: 店舗ページが取れた日より前の D は作れない', () => {
  assert.throws(() => L.windowPair('2026-10-09', 28), /取れた日/);
  assert.throws(() => L.windowPair('2026-09-01', 28), /取れた日/);
});

test('windowOf: 確定前・店舗ページの欠けにかかる期間は注意を出す', () => {
  const w = L.windowOf('2026-10-01', '2026-10-12', { today: '2026-10-13' });
  assert.strictEqual(w.days, 12);
  assert.strictEqual(w.settled, false); // 10-11 までが確定
  assert.strictEqual(w.includesStorePageGap, true);
  assert.strictEqual(w.warnings.length, 2);
  const ok = L.windowOf('2026-10-09', '2026-10-11', { today: '2026-10-13' });
  assert.strictEqual(ok.settled, true);
  assert.deepStrictEqual(ok.warnings, []);
  assert.throws(() => L.windowOf('2026-10-12', '2026-10-09'), /前/);
});

test('日付: 書き方と存在しない日付を弾く', () => {
  assert.throws(() => L.parseYmd('2026-1-1'), /YYYY-MM-DD/);
  assert.throws(() => L.parseYmd('2026-02-30'), /存在しない/);
  assert.strictEqual(L.addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(L.daysBetween('2026-10-09', '2026-11-06'), 28);
  assert.strictEqual(L.todayJst(Date.UTC(2026, 9, 11, 16, 0, 0)), '2026-10-12'); // 日本時間では翌日
});

// ── 偽の GA4 ──
const R = (dims, mets) => ({ dimensionValues: dims.map(value => ({ value })), metricValues: mets.map(value => ({ value: String(value) })) });
const CANNED = {
  'deviceCategory,landingPagePlusQueryString': [R(['mobile', '/stores/J1.html?utm_source=x'], [10, 6]), R(['desktop', '/'], [4, 3]), R(['mobile', '/stores/area/sakae/izakaya.html'], [2, 1])],
  'deviceCategory,pagePath': [R(['mobile', '/stores/J1.html'], [12, 120]), R(['desktop', '/'], [5, 60]), R(['mobile', '/features/a.html'], [3, 30])],
  'deviceCategory': [R(['mobile', ], [9, 12, 7, 17, 180]), R(['desktop'], [4, 4, 3, 5, 60])],
  '': [R([], [13, 16, 10, 22, 240, 200])],
  'eventName,deviceCategory': [R(['modal_open', 'mobile'], [8, 5]), R(['cta_click', 'mobile'], [3, 3]), R(['cta_call_click', 'mobile'], [40, 30])],
  'eventName,deviceCategory,pagePath': [R(['cta_click', 'mobile', '/stores/J1.html'], [3]), R(['modal_open', 'desktop', '/'], [8]), R(['cta_call_click', 'mobile', '/stores/J1.html'], [40])],
  'deviceCategory,pagePath,eventName,customEvent:link_domain': [
    R(['mobile', '/stores/J1.html', 'cta_click', 'www.hotpepper.jp'], [3]),
    R(['mobile', '/stores/J1.html', 'outbound_click', 'www.hotpepper.jp'], [3]), // 同じ1回が両方に届く
  ],
};
function fakeGa4(overrides = {}) {
  const calls = [];
  const run = async body => {
    calls.push(body);
    const key = (body.dimensions || []).map(d => d.name).join(',');
    const spec = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : CANNED[key];
    if (spec instanceof Error) throw spec;
    if (typeof spec === 'function') return spec(body);
    if (!spec) throw new Error(`想定外の問い合わせ: ${key}`);
    return { data: { rows: spec, rowCount: spec.length } };
  };
  run.calls = calls;
  return run;
}

// ── 問い合わせの形 ──
test('buildRequests: すべての問い合わせが期間とホストで絞られ、イベントは一覧に絞られる', () => {
  const win = L.windowOf('2026-10-09', '2026-10-20', { today: '2026-11-01' });
  const req = B.buildRequests(win);
  assert.deepStrictEqual(Object.keys(req).sort(), ['events', 'eventSessions', 'landing', 'pages', 'reservation', 'totalsAll', 'totalsByDevice'].sort());
  for (const [name, body] of Object.entries(req)) {
    assert.deepStrictEqual(body.dateRanges, [{ startDate: '2026-10-09', endDate: '2026-10-20' }], name);
    const s = JSON.stringify(body.dimensionFilter);
    assert.ok(s.includes('"hostName"') && s.includes('nagoya-bites.com'), `${name}: ホストで絞る`);
  }
  assert.ok(JSON.stringify(req.events.dimensionFilter).includes('inListFilter'));
  assert.ok(req.events.dimensionFilter.andGroup.expressions[1].filter.inListFilter.values.includes('cta_click'));
  assert.deepStrictEqual(req.reservation.dimensionFilter.andGroup.expressions[1].filter.inListFilter.values, ['cta_click', 'cta_reserve', 'outbound_click']);
  assert.ok(req.reservation.dimensions.some(d => d.name === 'customEvent:link_domain'));
  assert.strictEqual(req.landing.dimensions[1].name, 'landingPagePlusQueryString');
  assert.strictEqual(B.buildRequests(win, 'landingPage').landing.dimensions[1].name, 'landingPage');
});

test('fetchAll: rowCount に達するまでページを送る', async () => {
  const all = [1, 2, 3, 4, 5].map(i => R(['mobile', `/p${i}`], [i]));
  const seen = [];
  const run = async body => {
    seen.push([body.limit, body.offset]);
    const off = Number(body.offset);
    const rows = all.slice(off, off + 2);
    return { data: { rows, rowCount: all.length } };
  };
  const rows = await B.fetchAll(run, { dateRanges: [] }, { pageSize: 2 });
  assert.strictEqual(rows.length, 5);
  assert.deepStrictEqual(seen, [['2', '0'], ['2', '2'], ['2', '4']]);
  assert.deepStrictEqual(rows[4], { dims: ['mobile', '/p5'], mets: [5] });
});

test('fetchAll: 0行なら1回で止まる', async () => {
  let n = 0;
  const rows = await B.fetchAll(async () => { n++; return { data: {} }; }, {});
  assert.deepStrictEqual(rows, []);
  assert.strictEqual(n, 1);
});

test('入口ページの次元が使えないときは代わりの次元で取り直し、その理由を残す', async () => {
  const win = L.windowOf('2026-10-09', '2026-10-11', { today: '2026-11-01' });
  const run = fakeGa4({
    'deviceCategory,landingPagePlusQueryString': new Error('Field landingPagePlusQueryString is not a valid dimension'),
    'deviceCategory,landingPage': CANNED['deviceCategory,landingPagePlusQueryString'],
  });
  const notes = [];
  const out = await B.fetchLanding(run, win, notes);
  assert.strictEqual(out.dim, 'landingPage');
  assert.strictEqual(out.rows.length, 3);
  assert.ok(notes[0].includes('landingPagePlusQueryString'));
});

test('入口ページの次元がどちらも使えないときは失敗にする（黙って空の基線を作らない）', async () => {
  const win = L.windowOf('2026-10-09', '2026-10-11', { today: '2026-11-01' });
  const run = fakeGa4({
    'deviceCategory,landingPagePlusQueryString': new Error('bad 1'),
    'deviceCategory,landingPage': new Error('bad 2'),
  });
  await assert.rejects(() => B.fetchLanding(run, win, []), /bad 2/);
});

// ── 集計 ──
test('reportWindow: 端末とページ種別に分け、割合は分子と分母から作る', async () => {
  const win = L.windowOf('2026-10-09', '2026-10-20', { today: '2026-11-01' });
  const rep = await B.reportWindow(fakeGa4(), win);

  // 全体
  assert.strictEqual(rep.totals.all.sessions, 16);
  assert.strictEqual(rep.totals.all.engagementRate, 0.625);
  assert.strictEqual(rep.totals.all.bounceRate, 0.375);
  assert.strictEqual(rep.totals.all.pagesPerSession, 1.38);
  assert.strictEqual(rep.totals.all.engagementSecPerSession, 15);
  assert.strictEqual(rep.totals.device.mobile.sessions, 12);
  assert.strictEqual(rep.totals.device.desktop.engagedSessions, 3);
  assert.strictEqual(rep.totals.device.other.sessions, 0);
  assert.strictEqual(rep.totals.device.other.engagementRate, null, '0 セッションの割合は 0 ではなく null');

  // 入口のページ種別（クエリは無視）
  assert.strictEqual(rep.landing.store.mobile.sessions, 10);
  assert.strictEqual(rep.landing.store.all.engagementRate, 0.6);
  assert.strictEqual(rep.landing.top.desktop.sessions, 4);
  assert.strictEqual(rep.landing.hub.mobile.sessions, 2);
  assert.strictEqual(rep.landingDimension, 'landingPagePlusQueryString');

  // 表示
  assert.strictEqual(rep.pages.store.mobile.views, 12);
  assert.strictEqual(rep.pages.store.all.engagementSecPerView, 10);
  assert.strictEqual(rep.pages.feature.all.views, 3);

  // イベント
  assert.strictEqual(rep.events.cta_click.total, 3);
  assert.strictEqual(rep.events.cta_click.cell['store|mobile'], 3);
  assert.strictEqual(rep.events.modal_open.device.desktop, 8);
  assert.strictEqual(rep.eventSessions.modal_open.sessions, 5);
  assert.strictEqual(rep.eventSessions.cta_call_click.device.mobile.sessions, 30);

  // 予約送客: 同じ1回が cta_click と outbound_click の両方に届くので足し算しない
  assert.strictEqual(rep.reservation.total, 3);
  assert.strictEqual(rep.reservation.pageType.store, 3);
  assert.strictEqual(rep.reservation.device.mobile, 3);
  assert.strictEqual(rep.reservation.cell['store|mobile'], 3);

  // 件数が少ないセル（30件未満）を保留の候補として残す
  assert.strictEqual(rep.lowCount.threshold, 30);
  assert.deepStrictEqual(rep.lowCount.reservation, ['store|mobile']);
  assert.deepStrictEqual(rep.lowCount.events.cta_click, ['store|mobile']);
  assert.strictEqual(rep.lowCount.events.cta_call_click, undefined, '40件は保留にしない');
  assert.deepStrictEqual(rep.notes, []);
});

test('reportWindow: 予約送客の内訳が取れなくても、ほかの数字は返し、理由を残す', async () => {
  const win = L.windowOf('2026-10-09', '2026-10-20', { today: '2026-11-01' });
  const run = fakeGa4({ 'deviceCategory,pagePath,eventName,customEvent:link_domain': new Error('Field customEvent:link_domain is not a valid dimension') });
  const rep = await B.reportWindow(run, win);
  assert.strictEqual(rep.reservation, null);
  assert.strictEqual(rep.lowCount.reservation, null);
  assert.strictEqual(rep.totals.all.sessions, 16);
  assert.ok(rep.notes.some(n => n.includes('link_domain')));
});

test('ページ種別の合計は、全体の表示の合計と一致する（取りこぼしが無い）', async () => {
  const win = L.windowOf('2026-10-09', '2026-10-20', { today: '2026-11-01' });
  const rep = await B.reportWindow(fakeGa4(), win);
  const sumViews = L.PAGE_TYPES.reduce((a, t) => a + rep.pages[t].all.views, 0);
  assert.strictEqual(sumViews, 20); // 12 + 5 + 3
  const sumLanding = L.PAGE_TYPES.reduce((a, t) => a + rep.landing[t].all.sessions, 0);
  assert.strictEqual(sumLanding, 16); // 10 + 4 + 2
});

// ── 全体の流れ ──
const NOW = Date.UTC(2026, 11, 1, 3, 0, 0); // 2026-12-01 12:00 JST

test('runBaseline --window: 確定前の日を含むと止まる（--allow-unsettled で通す）', async () => {
  const args = B.parseArgs(['--window', '2026-11-25', '2026-11-30', '--label', 't']);
  await assert.rejects(() => B.runBaseline(fakeGa4(), args, NOW), /確定前/);
  const ok = await B.runBaseline(fakeGa4(), B.parseArgs(['--window', '2026-11-25', '2026-11-30', '--allow-unsettled']), NOW);
  assert.strictEqual(ok.window.settled, false);
  assert.ok(ok.window.warnings.length > 0);
});

test('runBaseline --window: 期間・区切り・条件・取った日を残し、プロパティの ID は書かない', async () => {
  const args = B.parseArgs(['--window', '2026-10-09', '2026-10-20', '--label', 'before', '--internal-filter', 'inactive']);
  const out = await B.runBaseline(fakeGa4(), args, NOW);
  assert.strictEqual(out.schema, 'nb-ga4-baseline/1');
  assert.strictEqual(out.label, 'before');
  assert.strictEqual(out.mode, 'window');
  assert.strictEqual(out.fetchedAt, new Date(NOW).toISOString());
  assert.deepStrictEqual([out.window.start, out.window.end, out.window.days], ['2026-10-09', '2026-10-20', 12]);
  assert.strictEqual(out.conditions.internalTrafficFilter, 'inactive');
  assert.strictEqual(out.conditions.hostName, 'nagoya-bites.com');
  assert.deepStrictEqual(out.conditions.segmentation.device, ['mobile', 'desktop', 'other']);
  assert.ok(out.conditions.events.includes('cta_click'));
  assert.ok(!/propert/i.test(JSON.stringify(out.conditions)), '鍵・プロパティの話を出力に入れない');
  assert.ok(!('property' in out));
  JSON.parse(JSON.stringify(out)); // JSON として書ける
});

test('runBaseline --pair: 前後を別々に取り、後が確定前なら取らずに理由を書く', async () => {
  // D=2026-12-10。後は 12-11〜 で、NOW(12-01) より先
  const future = await B.runBaseline(fakeGa4(), B.parseArgs(['--pair', '2026-12-10', '--days', '7']), NOW);
  assert.strictEqual(future.mode, 'pair');
  assert.strictEqual(future.days, 7);
  assert.deepStrictEqual([future.before.window.start, future.before.window.end], ['2026-12-03', '2026-12-09']);
  assert.strictEqual(future.after, null);
  assert.ok(future.pairNotes.some(n => n.includes('確定していない')));

  // D=2026-11-10 で 7 日。後は 11-11〜11-17 で確定済み
  const both = await B.runBaseline(fakeGa4(), B.parseArgs(['--pair', '2026-11-10', '--days', '7']), NOW);
  assert.ok(both.after && both.after.window.settled);
  assert.strictEqual(both.before.window.days, both.after.window.days);
});

// ── 引数・実行 ──
test('parseArgs: 期間の指定の仕方と、書き間違いを弾く', () => {
  assert.deepStrictEqual(B.parseArgs(['--window', '2026-10-09', '2026-10-20']).mode, 'window');
  assert.strictEqual(B.parseArgs(['--pair', '2026-11-10']).days, 28);
  assert.strictEqual(B.parseArgs(['--pair', '2026-11-10', '--days', '14']).days, 14);
  assert.throws(() => B.parseArgs([]), /どれか/);
  assert.throws(() => B.parseArgs(['--window', '2026-10-09']), /値が要る/);
  assert.throws(() => B.parseArgs(['--pair', '2026-11-10', '--days', '0']), /1 以上/);
  assert.throws(() => B.parseArgs(['--pair', '2026-11-10', '--internal-filter', 'maybe']), /active/);
  assert.throws(() => B.parseArgs(['--bogus']), /知らない引数/);
});

function capture(fn) {
  const out = [], err = [];
  const lg = console.log, er = console.error, w = process.stdout.write;
  console.log = (...a) => out.push(a.join(' ')); console.error = (...a) => err.push(a.join(' '));
  return Promise.resolve().then(fn).then(code => ({ code, out: out.join('\n'), err: err.join('\n') }))
    .finally(() => { console.log = lg; console.error = er; process.stdout.write = w; });
}

test('main: 鍵が無いときは何も取らず終了コード 2（成功に見せない）', async () => {
  const r = await capture(() => B.main(['--window', '2026-10-09', '2026-10-20'], {}));
  assert.strictEqual(r.code, 2);
  assert.ok(r.err.includes('GA4_SERVICE_ACCOUNT_KEY'));
  assert.strictEqual(r.out, '');
});

test('main: 鍵が JSON として読めないとき、鍵の中身をログに出さない（公開リポジトリの Actions のログに残らないように）', async () => {
  // JSON.parse の失敗メッセージは入力の先頭を含む（Node 20: Unexpected token 'P', "PRIVATE..." is not valid JSON）
  const secret = 'PRIVATEKEYFRAGMENT';
  const r = await capture(() => B.main(['--window', '2026-10-09', '2026-10-09'], { GA4_SERVICE_ACCOUNT_KEY: secret, GA4_PROPERTY_ID: '123456789' }));
  assert.strictEqual(r.code, 1);
  assert.ok(r.err.includes('GA4_SERVICE_ACCOUNT_KEY'), r.err);
  assert.ok(!r.err.includes(secret), r.err);
  assert.ok(!r.err.includes('123456789'), r.err);
});

test('main --dry-run: 鍵なしで、送る問い合わせだけを表示する', async () => {
  const r = await capture(() => B.main(['--dry-run', '--window', '2026-10-09', '2026-10-20'], {}));
  assert.strictEqual(r.code, 0);
  assert.ok(r.out.includes('2026-10-09〜2026-10-20'));
  assert.ok(r.out.includes('"startDate": "2026-10-09"'));
  assert.ok(r.out.includes('nagoya-bites.com'));
});

test('main: 書き間違いは終了コード 1', async () => {
  const r = await capture(() => B.main(['--window'], {}));
  assert.strictEqual(r.code, 1);
});

test('summaryOfFile: 保存した結果を表にして読める', async () => {
  const out = await B.runBaseline(fakeGa4(), B.parseArgs(['--window', '2026-10-09', '2026-10-20', '--label', 'before']), NOW);
  const md = B.summaryOfFile(out);
  assert.ok(md.includes('GA4 基線: before'));
  assert.ok(md.includes('| all | 16 |'));
  assert.ok(md.includes('| store |'));
  assert.ok(md.includes('| cta_click |'));
  assert.ok(md.includes('予約送客'));
  const pair = await B.runBaseline(fakeGa4(), B.parseArgs(['--pair', '2026-11-10', '--days', '7']), NOW);
  const pmd = B.summaryOfFile(pair);
  assert.ok(pmd.includes('### 前') && pmd.includes('### 後'));
});

test('lowCountCells: 30件未満だけが保留の候補。ちょうど30件は含めず、0件は「無かった」ので含めない', () => {
  const cell = { 'store|mobile': 29, 'store|desktop': 30, 'hub|mobile': 31, 'top|mobile': 0, 'journal|mobile': 1 };
  assert.deepStrictEqual(L.lowCountCells(cell), ['journal|mobile', 'store|mobile']);
  assert.deepStrictEqual(L.lowCountCells(cell, 31), ['journal|mobile', 'store|desktop', 'store|mobile']);
  assert.deepStrictEqual(L.lowCountCells({}), []);
});
