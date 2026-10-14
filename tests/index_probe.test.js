'use strict';
// P-437: 登録状況の日次観測の純関数（通信なしで検算できる部分）
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../scripts/lib/index_probe');

const NOW = Date.parse('2026-10-20T00:00:00Z');
const row = (group, verdict, extra) => ({ group, verdict, coverageState: verdict === 'PASS' ? 'Submitted and indexed' : 'Crawled - currently not indexed', ...extra });

test('pickSample: 実行のたびに同じ順・重複なし・exclude を選ばない・n 件まで', () => {
  const urls = Array.from({ length: 50 }, (_, i) => `https://x/${i}`);
  const a = lib.pickSample(urls, 10, ['https://x/3']);
  const b = lib.pickSample(urls.slice().reverse().concat(urls), 10, ['https://x/3']);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.length, 10);
  assert.ok(!a.includes('https://x/3'));
  assert.strictEqual(new Set(a).size, 10);
  assert.deepStrictEqual(lib.pickSample(urls, 0), []);
  assert.deepStrictEqual(lib.pickSample(null, 5), []);
});

test('pickSample: 見本は入力の先頭ではなくハッシュ順（先頭の偏りを持ち込まない）', () => {
  const urls = Array.from({ length: 200 }, (_, i) => `https://x/${String(i).padStart(3, '0')}`);
  const s = lib.pickSample(urls, 20);
  assert.notDeepStrictEqual(s, urls.slice(0, 20));
});

test('summarizeInspection: indexStatusResult の事実だけを取り出し、無ければ null', () => {
  const s = lib.summarizeInspection({ inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: '2026-10-19T01:00:00Z', pageFetchState: 'SUCCESSFUL', googleCanonical: 'https://x/', extra: 1 } } });
  assert.deepStrictEqual(s, { verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: '2026-10-19T01:00:00Z', pageFetchState: 'SUCCESSFUL', googleCanonical: 'https://x/' });
  assert.strictEqual(lib.summarizeInspection({}), null);
  assert.strictEqual(lib.summarizeInspection(null), null);
  assert.strictEqual(lib.summarizeInspection({ inspectionResult: {} }), null);
});

test('summarizeGroups: 登録は verdict=PASS だけ・最近クロールは 7 日以内・取得失敗は分母から外す', () => {
  const g = lib.summarizeGroups({
    a: row('s', 'PASS', { lastCrawlTime: '2026-10-19T00:00:00Z' }),
    b: row('s', 'PASS', { lastCrawlTime: '2026-10-12T23:59:59Z' }),
    c: row('s', 'NEUTRAL', { lastCrawlTime: '2026-10-13T00:00:00Z' }),
    d: { group: 's', error: 'quota' },
    e: row('h', 'FAIL'),
  }, NOW);
  assert.deepStrictEqual(g.s, { inspected: 3, errors: 1, indexed: 2, crawledRecently: 2, byState: { 'Submitted and indexed': 2, 'Crawled - currently not indexed': 1 } });
  assert.strictEqual(g.h.indexed, 0);
  assert.strictEqual(g.h.crawledRecently, 0);
});

test('isCrawledRecently: 壊れた日付・無い日付は最近クロールに数えない', () => {
  assert.strictEqual(lib.isCrawledRecently({ lastCrawlTime: 'x' }, NOW), false);
  assert.strictEqual(lib.isCrawledRecently({}, NOW), false);
  assert.strictEqual(lib.isCrawledRecently(null, NOW), false);
  assert.strictEqual(lib.isCrawledRecently({ lastCrawlTime: '2026-10-13T00:00:00Z' }, NOW), true);
});

test('updateHistory: 同じ日は置き換え・日付順・120 日より古い行は切る', () => {
  let h = [{ date: '2026-01-01', groups: {} }, { date: '2026-10-18', groups: { s: { n: 1 } } }];
  h = lib.updateHistory(h, '2026-10-19', { s: { n: 2 } });
  h = lib.updateHistory(h, '2026-10-19', { s: { n: 3 } });
  assert.deepStrictEqual(h.map((x) => x.date), ['2026-10-18', '2026-10-19']);
  assert.strictEqual(h[1].groups.s.n, 3);
  assert.deepStrictEqual(lib.updateHistory(null, '2026-10-19', {}).map((x) => x.date), ['2026-10-19']);
});

test('見本の一覧（data/index_probe_urls.json）は、面ごとに重複が無く、unreachable と control が重ならない', () => {
  const d = require('../data/index_probe_urls.json');
  for (const [g, list] of Object.entries(d.groups)) {
    assert.ok(list.length > 0, `${g} が空`);
    assert.strictEqual(new Set(list).size, list.length, `${g} に重複`);
    for (const u of list) assert.match(u, /^https:\/\/nagoya-bites\.com\//, `${g}: ${u}`);
  }
  const un = new Set(d.groups.unreachable_after_i25);
  assert.ok(d.groups.control_store.every((u) => !un.has(u)), 'control に unreachable が混ざっている');
});

test('interleave: 面を順番に 1 件ずつ回し、途中で打ち切っても全部の面から引ける', () => {
  const q = lib.interleave({ a: ['a1', 'a2', 'a3'], b: ['b1'], c: ['c1', 'c2'] });
  assert.deepStrictEqual(q.map((x) => x.url), ['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
  assert.deepStrictEqual(q.slice(0, 3).map((x) => x.group), ['a', 'b', 'c']);
  assert.deepStrictEqual(lib.interleave({}), []);
  assert.deepStrictEqual(lib.interleave(null), []);
});

test('isDayComplete: 今日の行が見本の 9 割以上を引けていれば済み・少ない行や別の日は済みでない', () => {
  const g = (n) => ({ a: { inspected: n, errors: 0, indexed: 0, crawledRecently: 0, byState: {} } });
  const h = [{ date: '2026-10-14', groups: g(15) }, { date: '2026-10-15', groups: g(226) }];
  assert.strictEqual(lib.isDayComplete(h, '2026-10-15', 251), true);
  assert.strictEqual(lib.isDayComplete(h, '2026-10-14', 251), false);
  assert.strictEqual(lib.isDayComplete(h, '2026-10-16', 251), false);
  assert.strictEqual(lib.isDayComplete([{ date: '2026-10-15', groups: g(225) }], '2026-10-15', 251), false);
  assert.strictEqual(lib.isDayComplete(h, '2026-10-15', 0), false);
  assert.strictEqual(lib.isDayComplete(undefined, '2026-10-15', 251), false);
});

test('shouldReplaceDay: 同じ日の行は前より多く引けたときだけ置き換える（上限に当たった回が全件の行を消さない）', () => {
  const g = (n) => ({ a: { inspected: n, errors: 0, indexed: 0, crawledRecently: 0, byState: {} } });
  const h = [{ date: '2026-10-15', groups: g(240) }];
  assert.strictEqual(lib.shouldReplaceDay(h, '2026-10-15', g(15)), false);
  assert.strictEqual(lib.shouldReplaceDay(h, '2026-10-15', g(240)), false);
  assert.strictEqual(lib.shouldReplaceDay(h, '2026-10-15', g(241)), true);
  assert.strictEqual(lib.shouldReplaceDay(h, '2026-10-16', g(1)), true);
  assert.strictEqual(lib.shouldReplaceDay([], '2026-10-15', g(1)), true);
});
