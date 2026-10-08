'use strict';
// SEO-117: 日次の指標履歴に GSC の集計値を残し、北極星4指標を履歴から出せることの検査
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractGsc, readGscMetrics, northStarFrom } = require('../scripts/track_metrics');
const { latestByDate, fill } = require('../scripts/backfill_gsc_history');

const GSC = {
  generatedAt: '2026-10-08T19:16:07.132Z',
  dateRange: { startDate: '2026-09-10', endDate: '2026-10-07' },
  totals: { clicks: 601, impressions: 37983, ctr: 0.0158, position: 12.5 },
  intent: { kpi: { discovery_impressions: 1617, discovery_clicks: 98, discovery_impressions_share: 9.3 }, summary: {}, examples: [] },
  pageTypes: { area_hub: { pages: 28, clicks: 1, impressions: 87 }, store: { pages: 3057 } },
  queries: [{ query: 'x' }], pages: [{ page: 'y' }],
};

test('GSC の集計値だけを取り出す（クエリ表・ページ表は持たない）', () => {
  const g = extractGsc(GSC);
  assert.deepStrictEqual(Object.keys(g).sort(), ['dateRange', 'generatedAt', 'intent_kpi', 'pageTypes', 'totals']);
  assert.strictEqual(g.intent_kpi.discovery_clicks, 98);
  assert.strictEqual(g.pageTypes.area_hub.pages, 28);
  assert.strictEqual(extractGsc({ dateRange: {} }), null, 'totals が無ければ記録しない');
});

test('GSC のファイルが無い・壊れているときは null（GA4 側のスナップショットを止めない）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsc-'));
  assert.strictEqual(readGscMetrics(path.join(dir, 'none.json')), null);
  fs.writeFileSync(path.join(dir, 'bad.json'), '{');
  assert.strictEqual(readGscMetrics(path.join(dir, 'bad.json')), null);
  fs.writeFileSync(path.join(dir, 'ok.json'), JSON.stringify(GSC));
  assert.strictEqual(readGscMetrics(path.join(dir, 'ok.json')).totals.clicks, 601);
});

test('北極星4指標: 最新と N 日前の行を比べ、GSC の無い古い行は null にする', () => {
  const entries = [
    { date: '2026-09-01', search_channels: { bing: 250, ai_assistant: 80 } },
    { date: '2026-09-10', search_channels: { bing: 293, ai_assistant: 88 }, gsc: extractGsc({ ...GSC, intent: { kpi: { discovery_impressions: 1000, discovery_clicks: 60 } }, pageTypes: { area_hub: { pages: 10, impressions: 30 } } }) },
    { date: '2026-10-08', search_channels: { bing: 401, ai_assistant: 106 }, gsc: extractGsc(GSC) },
  ];
  const r = northStarFrom(entries, 28);
  assert.strictEqual(r.latest.date, '2026-10-08');
  assert.strictEqual(r.prior.date, '2026-09-10');
  assert.deepStrictEqual(r.delta, { discovery_impressions: 617, discovery_clicks: 38, hub_pages: 18, hub_impressions: 57, ai_sessions: 18, bing_sessions: 108 });
  assert.strictEqual(r.gsc_history_since, '2026-09-10');
  const old = northStarFrom(entries, 35);
  assert.strictEqual(old.prior.date, '2026-09-01');
  assert.strictEqual(old.prior.discovery_clicks, null);
  assert.ok(!('discovery_clicks' in old.delta), 'null の指標は差を出さない');
  assert.strictEqual(northStarFrom([], 28).total_days, 0);
});

test('埋め戻し: 日ごとに最後の版を使い、gsc のある行は上書きしない', () => {
  const v = (sha, at, clicks) => ({ sha, gsc: { generatedAt: at, totals: { clicks } } });
  const byDate = latestByDate([v('a'.repeat(40), '2026-09-01T03:00:00Z', 1), v('b'.repeat(40), '2026-09-01T19:00:00Z', 2), v('c'.repeat(40), '2026-09-02T19:00:00Z', 3)]);
  assert.strictEqual(byDate.get('2026-09-01').gsc.totals.clicks, 2);
  const entries = [{ date: '2026-09-01' }, { date: '2026-09-02', gsc: { totals: { clicks: 99 } } }, { date: '2026-09-03' }];
  assert.strictEqual(fill(entries, byDate), 1);
  assert.strictEqual(entries[0].gsc.totals.clicks, 2);
  assert.strictEqual(entries[0].gsc.backfilledFrom, 'bbbbbbbbbb');
  assert.strictEqual(entries[1].gsc.totals.clicks, 99, '既存の gsc は触らない');
  assert.strictEqual(entries[2].gsc, undefined, '版の無い日は埋めない');
});
