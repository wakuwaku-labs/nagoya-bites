'use strict';
// ISSUE-143: HotPepper の中エリアは1,000件までしか取っておらず（Y200 は毎回ちょうど1,000件）、
// 「おススメ順」の並べ替えで境目の店が日ごとに出入りしていた。API のエラー（HTTP 200 の results.error）も
// 「0件」と読んで黙って打ち切っていた。件数が上限を超える中エリアは小エリアごとに取り直し、エラーはやり直して記録する
const test = require('node:test');
const assert = require('node:assert');
const hp = require('../scripts/lib/hotpepper_fetch');
const { churnFromSnapshots } = require('../scripts/hotpepper_fetch_report');

const shop = (id) => ({ id, name: id, address: '愛知県名古屋市中村区名駅1-1-1' });
const ids = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(5, '0')}`);

/**
 * 偽の API。middle: 中エリア → 店ID の並び（おススメ順）。small: 小エリア → {middle, ids}。
 * failOnce / failAlways: 'start=201' のような URL の断片で、エラーを返す呼び出しを決める
 */
function fakeApi({ middle = {}, small = {}, smallList = null, failOnce = [], failAlways = [] } = {}) {
  const calls = [];
  const failedOnce = new Set();
  const fetchJson = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const p = u.searchParams;
    const key = `${u.pathname}?${p.get('middle_area') || ''}|${p.get('small_area') || ''}|${p.get('start') || ''}`;
    for (const f of failAlways) if (url.includes(f)) return { results: { error: [{ code: 1000, message: `障害 key=${p.get('key')}` }] } };
    for (const f of failOnce) if (url.includes(f) && !failedOnce.has(key)) { failedOnce.add(key); return { results: { error: [{ code: 1000, message: '一時的な障害' }] } }; }
    if (u.pathname.includes('/small_area/')) {
      const list = smallList || Object.entries(small).filter(([, v]) => v.middle === p.get('middle_area')).map(([code, v]) => ({ code, name: code, middle_area: { code: v.middle } }));
      return { results: { small_area: list } };
    }
    const start = Number(p.get('start'));
    const count = Number(p.get('count'));
    const all = p.get('middle_area') ? (middle[p.get('middle_area')] || []) : (small[p.get('small_area')] || { ids: [] }).ids;
    return { results: { results_available: all.length, shop: all.slice(start - 1, start - 1 + count).map(shop) } };
  };
  return { fetchJson, calls };
}

const deps = (api, extra = {}) => ({ fetchJson: api.fetchJson, base: 'https://example.test/hotpepper', apiKey: 'SECRET', sleep: async () => {}, ...extra });

test('件数が1,000件を超える中エリアは小エリアごとに取り直し、すべて取る（中エリアの1,000件は先頭のまま）', async () => {
  const a = ids('JA', 600), b = ids('JB', 500), c = ids('JC', 350); // 合計1,450件
  const ranked = [...c, ...a, ...b]; // おススメ順（中エリアではこの順の先頭1,000件しか取れない）
  const api = fakeApi({ middle: { Y200: ranked }, small: { X1: { middle: 'Y200', ids: a }, X2: { middle: 'Y200', ids: b }, X3: { middle: 'Y200', ids: c }, X9: { middle: 'Y999', ids: ['JZ'] } } });
  const { shops, record } = await hp.fetchMiddleArea({ code: 'Y200', name: '名古屋駅' }, deps(api));
  assert.strictEqual(shops.length, 1450);
  assert.strictEqual(new Set(shops.map((s) => s.id)).size, 1450);
  assert.deepStrictEqual(shops.slice(0, 1000).map((s) => s.id), ranked.slice(0, 1000));
  assert.strictEqual(record.available, 1450);
  assert.strictEqual(record.viaMiddleArea, 1000);
  assert.strictEqual(record.smallAreas, 3);
  assert.strictEqual(record.fetched, 1450);
  assert.strictEqual(record.missing, 0);
  assert.deepStrictEqual(record.errors, []);
  assert.ok(!api.calls.some((u) => u.includes('start=1001')), '中エリアは1,000件より先を取りに行かない');
});

test('上限に届かない中エリアは小エリアを引かない', async () => {
  const api = fakeApi({ middle: { Y215: ids('JK', 329) } });
  const { shops, record } = await hp.fetchMiddleArea({ code: 'Y215', name: '金山' }, deps(api));
  assert.strictEqual(shops.length, 329);
  assert.strictEqual(record.smallAreas, 0);
  assert.strictEqual(api.calls.length, 4);
  assert.ok(!api.calls.some((u) => u.includes('/small_area/')));
});

test('API のエラー（HTTP 200 の results.error）は0件と読まず、やり直して取る', async () => {
  const api = fakeApi({ middle: { Y210: ids('JS', 983) }, failOnce: ['start=201'] });
  const { shops, record } = await hp.fetchMiddleArea({ code: 'Y210', name: '栄' }, deps(api));
  assert.strictEqual(shops.length, 983);
  assert.deepStrictEqual(record.errors, []);
  assert.strictEqual(api.calls.filter((u) => u.includes('start=201')).length, 2);
});

test('やり直しても取れないページは記録に残して次のページへ進み、API キーを残さない', async () => {
  const api = fakeApi({ middle: { Y205: ids('JN', 887) }, failAlways: ['start=301'] });
  const { shops, record } = await hp.fetchMiddleArea({ code: 'Y205', name: '錦' }, deps(api));
  assert.strictEqual(shops.length, 787);
  assert.strictEqual(record.errors.length, 1);
  assert.match(record.errors[0], /start=301/);
  assert.ok(record.errors.every((e) => !e.includes('SECRET')));
  assert.strictEqual(record.missing, 100);
  const short = hp.shortfalls({ areas: [record] });
  assert.strictEqual(short.length, 1);
  assert.match(short[0].reasons.join(' '), /エラー 1 件/);
});

test('続けて2ページ取れなければ、その検索をやめる', async () => {
  const api = fakeApi({ middle: { Y220: ids('JI', 607) }, failAlways: ['start=101', 'start=201'] });
  const { shops, record } = await hp.fetchMiddleArea({ code: 'Y220', name: '今池' }, deps(api));
  assert.strictEqual(shops.length, 100);
  assert.strictEqual(record.errors.length, 2);
  assert.ok(!api.calls.some((u) => u.includes('start=301')));
});

test('小エリアの一覧が絞り込まれていない（多すぎる）ときは使わず、中エリアの1,000件に留めて記録する', async () => {
  const many = Array.from({ length: hp.MAX_SMALL_AREAS + 1 }, (_, i) => ({ code: `X${i}`, name: `X${i}` }));
  const api = fakeApi({ middle: { Y200: ids('JA', 1200) }, smallList: many });
  const { shops, record } = await hp.fetchMiddleArea({ code: 'Y200', name: '名古屋駅' }, deps(api));
  assert.strictEqual(shops.length, 1000);
  assert.strictEqual(record.smallAreas, 0);
  assert.match(record.errors.join(' '), /絞り込みが効いていない/);
  assert.strictEqual(record.missing, 200);
});

test('取得の記録は直近 keep 回だけ残し、件数との差が2%以内なら取りこぼしと数えない', () => {
  let log = {};
  for (let i = 0; i < 35; i++) log = hp.appendRun(log, { at: `r${i}`, areas: [] }, 30);
  assert.strictEqual(log.runs.length, 30);
  assert.strictEqual(log.runs[0].at, 'r5');
  const short = hp.shortfalls({ areas: [
    { code: 'A', name: 'A', available: 1000, fetched: 985, errors: [] },
    { code: 'B', name: 'B', available: 1000, fetched: 979, errors: [] },
    { code: 'C', name: 'C', available: null, fetched: 0, errors: [] },
  ] });
  assert.deepStrictEqual(short.map((x) => x.code), ['B']);
});

test('出入りの集計: 消えた後に戻った ID と消えたままの ID を分けて数える', () => {
  const s = (date, list) => ({ date, ids: new Set(list) });
  const r = churnFromSnapshots([
    s('2026-10-01', ['J1', 'J2', 'J3']),
    s('2026-10-02', ['J1', 'J2', 'J4']), // J3 が消え J4 が増えた
    s('2026-10-03', ['J1', 'J3', 'J4']), // J2 が消え J3 が戻った
    s('2026-10-04', ['J1', 'J3', 'J4']),
  ]);
  assert.deepStrictEqual(r.steps.map((x) => [x.added, x.removed]), [[null, null], [1, 1], [1, 1], [0, 0]]);
  assert.strictEqual(r.returned, 1);
  assert.strictEqual(r.stillGone, 1);
});
