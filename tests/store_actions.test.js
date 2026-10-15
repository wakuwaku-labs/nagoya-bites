'use strict';
// MEO-006: 予約・電話・地図を別々に数える（scripts/lib/store_actions.js）、「現在地」ボタンは結果だけを送る（index.html）、
// 計測のファイルの鮮度（scripts/check_metrics_freshness.js）。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sa = require(path.join(ROOT, 'scripts', 'lib', 'store_actions.js'));
const fresh = require(path.join(ROOT, 'scripts', 'check_metrics_freshness.js'));
const { nbMapLinkKind } = require(path.join(ROOT, 'scripts', 'lib', 'map_link.js'));

test('地図: 店ごとにまとめ、店名の無い行は unattributed に分ける。上位は回数の多い順', () => {
  const m = sa.aggregateMapClicks([
    { store: '店B', count: '3' }, { store: '店A', count: 3 }, { store: '(not set)', count: 4 },
    { store: '', count: 1 }, { store: '店B', count: 2 }, { store: '店C', count: 0 },
  ], 2);
  assert.deepEqual(m, { total: 13, unattributed: 5, stores: 2, top: [{ store_name: '店B', count: 5 }, { store_name: '店A', count: 3 }] });
});

test('並べた 1 行: 予約はホットペッパー・食べログ・そのほかの予約サイト、電話と地図は別の欄。足し合わせない', () => {
  const row = sa.actionsRow({ hotpepper: 64, tabelog: 9, tel: 2, other: 1, total: 76 }, { total: 22 });
  assert.deepEqual(row, { reserve: 74, reserveBySite: { hotpepper: 64, tabelog: 9, other: 1 }, tel: 2, map: 22 });
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'total'), false, '合計の欄を作らない');
});

test('値ごとの回数: 値が無い行は (not set) にまとめ、多い順', () => {
  assert.deepEqual(sa.countBy([{ key: 'ok', count: 2 }, { key: 'quota', count: 5 }, { key: '', count: 1 }, { key: 'ok', count: 4 }]),
    { ok: 6, quota: 5, '(not set)': 1 });
});

function fakeGa4({ dims, rows }) {
  const calls = [];
  return {
    calls,
    properties: {
      getMetadata: async () => ({ data: { dimensions: dims.map((apiName) => ({ apiName })) } }),
      runReport: async ({ requestBody }) => {
        const names = requestBody.dimensions.map((d) => d.name);
        const events = requestBody.dimensionFilter.filter.inListFilter.values;
        calls.push({ names, events });
        const key = names.join('|') + '@' + events.join(',');
        return { data: { rows: (rows[key] || []).map(([vals, n]) => ({ dimensionValues: vals.map((value) => ({ value })), metricValues: [{ value: String(n) }] })) } };
      },
    },
  };
}

test('取得: 未登録のディメンション（location・link_kind・result）では問い合わせず、内訳は null・名前を残す。outbound_click は問い合わせない', async () => {
  const ga = fakeGa4({
    dims: ['eventName', 'customEvent:store_name', 'customEvent:link_domain'],
    rows: {
      'customEvent:store_name@cta_gmap_click': [[['店A'], 3], [['(not set)'], 2]],
      'eventName@call_lookup,geo_search': [[['call_lookup'], 7], [['geo_search'], 4]],
    },
  });
  const out = await sa.fetchStoreActions(ga, '123', '30daysAgo', { hotpepper: 5, tabelog: 1, tel: 2, other: 0 });
  assert.deepEqual(out.missingDimensions, ['location', 'link_kind', 'result']);
  assert.deepEqual(out.actions, { reserve: 6, reserveBySite: { hotpepper: 5, tabelog: 1, other: 0 }, tel: 2, map: 5 });
  assert.equal(out.map.unattributed, 2);
  assert.equal(out.map.byLocation, null);
  assert.equal(out.map.byLinkKind, null);
  assert.deepEqual(out.callLookup, { total: 7, byResult: null });
  assert.deepEqual(out.geoSearch, { total: 4, byResult: null });
  for (const c of ga.calls) {
    assert.ok(!c.names.some((n) => /location|link_kind|result/.test(n)), '未登録の名前で問い合わせない: ' + c.names);
    assert.ok(!c.events.includes('outbound_click'), 'outbound_click は数えない');
  }
});

test('取得: 登録済みなら、場所・リンクの形・結果ごとの回数を入れる', async () => {
  const ga = fakeGa4({
    dims: ['customEvent:store_name', 'customEvent:location', 'customEvent:link_kind', 'customEvent:result'],
    rows: {
      'customEvent:store_name@cta_gmap_click': [[['店A'], 3]],
      'customEvent:location@cta_gmap_click': [[['store_page'], 2], [['card'], 1]],
      'customEvent:link_kind@cta_gmap_click': [[['place_id'], 1], [['search'], 1], [['(not set)'], 1]],
      'eventName@call_lookup,geo_search': [[['call_lookup'], 3], [['geo_search'], 2]],
      'eventName|customEvent:result@call_lookup,geo_search': [[['call_lookup', 'ok'], 2], [['call_lookup', 'quota'], 1], [['geo_search', 'denied'], 2]],
    },
  });
  const out = await sa.fetchStoreActions(ga, '123', '30daysAgo', {});
  assert.deepEqual(out.missingDimensions, []);
  assert.deepEqual(out.map.byLocation, { store_page: 2, card: 1 });
  assert.deepEqual(out.map.byLinkKind, { '(not set)': 1, place_id: 1, search: 1 });
  assert.deepEqual(out.callLookup, { total: 3, byResult: { ok: 2, quota: 1 } });
  assert.deepEqual(out.geoSearch, { total: 2, byResult: { denied: 2 } });
});

test('地図リンクの形: query_place_id があれば place_id、無ければ search', () => {
  assert.equal(nbMapLinkKind('https://www.google.com/maps/search/?api=1&query=x&query_place_id=ChIJ'), 'place_id');
  assert.equal(nbMapLinkKind('https://www.google.com/maps/search/?api=1&query=x'), 'search');
  assert.equal(nbMapLinkKind(undefined), 'search');
});

// index.html の geoSearch を取り出して、位置の取得の結果ごとに送る値を確かめる（送るのは result だけ）
function runGeo(mode) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('function nbGeoTrack(');
  const end = html.indexOf('\n}\n', html.indexOf('function geoSearch()')) + 3;
  assert.ok(start > 0 && end > start, 'geoSearch が見つからない');
  const sent = [];
  const el = () => ({ value: '', innerHTML: '', classList: { add() {}, remove() {} } });
  const els = { 'geo-btn': el(), si: el(), si2: el() };
  const geo = {
    getCurrentPosition(ok, ng) {
      if (mode === 'granted') ok({ coords: { latitude: 35.1709, longitude: 136.8815 } });
      else if (mode === 'denied') ng({ code: 1 });
      else ng({ code: 3 });
    },
  };
  const ctx = {
    navigator: mode === 'unsupported' ? {} : { geolocation: geo },
    document: { getElementById: (id) => els[id] || null },
    trackEvent: (name, params) => sent.push([name, params]),
    showToast() {}, applyFilters() {},
    GEO_AREAS: { '名駅': { lat: 35.1709, lng: 136.8815 }, '栄': { lat: 35.1681, lng: 136.9086 } },
    NB_PIN_SVG: '',
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(start, end) + '\ngeoSearch();', ctx);
  return { sent, els };
}

test('「現在地」: 押下ごとに geo_search を 1 回だけ、result だけを送る（緯度・経度・エリア名は送らない）', () => {
  for (const [mode, result] of [['granted', 'granted'], ['denied', 'denied'], ['timeout', 'error'], ['unsupported', 'unsupported']]) {
    const { sent, els } = runGeo(mode);
    assert.deepEqual(JSON.parse(JSON.stringify(sent)), [['geo_search', { result }]], mode); // vm の中の値は別の realm なので JSON で比べる
    const text = JSON.stringify(sent);
    assert.doesNotMatch(text, /35\.|136\.|名駅|栄|lat|lng/, `${mode}: 位置・エリア名を送らない`);
    if (mode === 'granted') assert.equal(els.si.value, '名駅', '絞り込みは今までどおり');
  }
});

test('鮮度: generatedAt が 2 日より古い・無い・読めないファイルは赤', () => {
  const now = Date.parse('2026-10-15T12:00:00Z');
  const rows = fresh.judge([
    { file: 'a', generatedAt: '2026-10-14T03:00:00Z' },
    { file: 'b', generatedAt: '2026-10-13T11:59:00Z' },
    { file: 'c' },
    { file: 'd', error: 'ファイルが無い' },
  ], now);
  assert.deepEqual(rows.map((r) => r.ok), [true, false, false, false]);
  assert.equal(rows[1].reason, '2 日より古い');
  assert.deepEqual(fresh.FILES, ['data/view_counts.json', 'data/site_metrics.json', 'data/store_referrals.json', 'data/gsc_metrics.json']);
});
