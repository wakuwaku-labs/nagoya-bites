'use strict';
/**
 * 店選びの後の行動のうち、予約送客（scripts/lib/reservation_exits.js）に入れないものの数え方（MEO-006・2026-10-15）。
 * 計画書 docs/meo-plan-2026-10.md の 8.1〜8.2 節。手順は docs/reservation-measurement.md。
 *
 *   map        … 地図ボタン（cta_gmap_click）。予約送客には入れない（判断の記録 0009）。
 *                同じ押下は outbound_click にも届くので、outbound_click は足さない（足すと 2 倍に数える）
 *   callLookup … 電話ボタンを押した後の番号の取得の結果（call_lookup {result}）。電話の送客（cta_call_click）とは別に数える
 *   geoSearch  … トップの「現在地」ボタン（geo_search {result}）。店には結びつかない。サイトは結果だけを送り、位置は送らない
 *
 * GA4 に登録済みのカスタムディメンションは store_name と link_domain だけ。location・link_kind・result は
 * 登録されるまで内訳を取れないので null にし、足りない名前を missingDimensions に残す（合計はイベント名だけで数えられる）。
 * 登録は GA4 の管理画面（オーナーの操作・登録は非遡及・docs/ga4-view-counts-setup.md）。
 *
 * 利用側: scripts/fetch_ga4_views.js（GA4 → data/store_referrals.json）、tests/store_actions.test.js。
 */

const MAP_EVENT = 'cta_gmap_click';
const CALL_LOOKUP_EVENT = 'call_lookup';
const GEO_EVENT = 'geo_search';
// 内訳に使う任意のカスタムディメンション（GA4 に登録されているときだけ問い合わせる）
const OPTIONAL_DIMENSIONS = {
  location: 'customEvent:location',
  link_kind: 'customEvent:link_kind',
  result: 'customEvent:result',
};

const DEFINITIONS = {
  actions: '店選びの後の行動を並べた 1 行（直近の集計期間）。予約＝ホットペッパー・食べログ・そのほかの予約サイトへのボタン、電話＝電話ボタン、地図＝地図ボタン。性質が違うので足し合わせない',
  map: '地図: 地図ボタン（cta_gmap_click）を押した回数。予約送客には入れない。outbound_click は足さない（同じ押下が 2 件になる）',
  callLookup: '電話の番号の取得: 電話ボタンを押した後に、店の番号を取れたか（call_lookup の result）。ok 以外は電話がかからなかった回',
  geoSearch: '現在地: トップの「現在地」ボタンを押した回数と結果（granted・denied・unsupported・error）。位置・エリア名は送っていない',
};

function toCount(v) {
  return parseInt(v, 10) || 0;
}

function namedValue(v) {
  const s = String(v == null ? '' : v).trim();
  return s && s !== '(not set)' ? s : '';
}

/**
 * 地図ボタンの押下を店ごとにまとめる。
 * @param {Array<{store:string, count:number|string}>} rows  GA4 の customEvent:store_name × eventCount の行（cta_gmap_click だけ）
 * @param {number} topN  上位の店の数
 * @returns {{total:number, unattributed:number, stores:number, top:Array<{store_name:string, count:number}>}}
 *   店名が取れない行（store_name を送っていなかった頃の店舗ページの本文のボタンなど）は unattributed に分ける
 */
function aggregateMapClicks(rows, topN = 10) {
  const byStore = new Map();
  let total = 0;
  let unattributed = 0;
  for (const r of rows || []) {
    const n = toCount(r.count);
    if (n <= 0) continue;
    total += n;
    const name = namedValue(r.store);
    if (!name) { unattributed += n; continue; }
    byStore.set(name, (byStore.get(name) || 0) + n);
  }
  const ranked = [...byStore.entries()]
    .map(([store_name, count]) => ({ store_name, count }))
    .sort((a, b) => (b.count - a.count) || a.store_name.localeCompare(b.store_name, 'ja'));
  return { total, unattributed, stores: ranked.length, top: ranked.slice(0, topN) };
}

/**
 * 値ごとの回数（{ 値: 回数 }）。値が無い行は '(not set)' にまとめる。多い順に並べる。
 * @param {Array<{key:string, count:number|string}>} rows
 */
function countBy(rows) {
  const m = new Map();
  for (const r of rows || []) {
    const n = toCount(r.count);
    if (n <= 0) continue;
    const k = namedValue(r.key) || '(not set)';
    m.set(k, (m.get(k) || 0) + n);
  }
  const out = {};
  [...m.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).forEach(([k, v]) => { out[k] = v; });
  return out;
}

/**
 * 予約・電話・地図を並べた 1 行。足し合わせない（docs/kpi-weekly.md の週次の表と同じ並び）。
 * @param {{hotpepper:number, tabelog:number, tel:number, other:number}} exits  reservation_exits の totals.exits
 * @param {{total:number}} map  aggregateMapClicks の結果
 */
function actionsRow(exits, map) {
  const e = exits || {};
  return {
    reserve: (e.hotpepper || 0) + (e.tabelog || 0) + (e.other || 0),
    reserveBySite: { hotpepper: e.hotpepper || 0, tabelog: e.tabelog || 0, other: e.other || 0 },
    tel: e.tel || 0,
    map: map ? map.total : 0,
  };
}

/**
 * GA4 のメタデータ（getMetadata の dimensions[].apiName）から、登録済みの任意ディメンションと足りないものを分ける。
 * @param {Iterable<string>} apiNames
 * @returns {{available:object, missing:string[]}}  available は { location: true, ... }、missing は送る値の名前
 */
function optionalDimensionStatus(apiNames) {
  const have = new Set(apiNames || []);
  const available = {};
  const missing = [];
  for (const [param, apiName] of Object.entries(OPTIONAL_DIMENSIONS)) {
    if (have.has(apiName)) available[param] = true;
    else missing.push(param);
  }
  return { available, missing };
}

// 予約・電話・地図を別々の欄に（MEO-006・計画書 8.2 節）。地図は予約送客に入れず、outbound_click も足さない。
// location・link_kind・result は GA4 に登録されているときだけ内訳を取る（未登録の名前で問い合わせるとレポートごと失敗するため、
// 先にメタデータで確かめる）。登録されていない内訳は null にし、名前を missingDimensions に残す。
async function fetchStoreActions(analyticsdata, property, startDate, exits) {
  const meta = await analyticsdata.properties.getMetadata({ name: `properties/${property}/metadata` });
  const dims = optionalDimensionStatus((meta.data.dimensions || []).map(d => d.apiName));
  const report = async (dimensions, events) => {
    const res = await analyticsdata.properties.runReport({
      property: `properties/${property}`,
      requestBody: {
        dimensions: dimensions.map(name => ({ name })),
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: events } } },
        dateRanges: [{ startDate, endDate: 'today' }],
        limit: '10000',
      },
    });
    return (res.data.rows || []).map(row => ({ keys: row.dimensionValues.map(v => v.value), count: row.metricValues[0].value }));
  };
  const OPT = OPTIONAL_DIMENSIONS;

  const map = aggregateMapClicks(
    (await report(['customEvent:store_name'], [MAP_EVENT])).map(r => ({ store: r.keys[0], count: r.count })));
  const byKey = async (apiName) => countBy(
    (await report([apiName], [MAP_EVENT])).map(r => ({ key: r.keys[0], count: r.count })));
  map.byLocation = dims.available.location ? await byKey(OPT.location) : null;
  map.byLinkKind = dims.available.link_kind ? await byKey(OPT.link_kind) : null;

  // 電話の番号の取得と「現在地」は、イベント名ごとの合計と（登録されていれば）result ごとの回数
  const resultEvents = [CALL_LOOKUP_EVENT, GEO_EVENT];
  const totals = {};
  for (const r of await report(['eventName'], resultEvents)) totals[r.keys[0]] = (totals[r.keys[0]] || 0) + (parseInt(r.count, 10) || 0);
  const byResult = {};
  if (dims.available.result) {
    const rows = await report(['eventName', OPT.result], resultEvents);
    for (const ev of resultEvents) {
      byResult[ev] = countBy(rows.filter(r => r.keys[0] === ev).map(r => ({ key: r.keys[1], count: r.count })));
    }
  }
  const resultBlock = (ev) => ({ total: totals[ev] || 0, byResult: dims.available.result ? byResult[ev] : null });

  return {
    actionDefinitions: DEFINITIONS,
    actions: actionsRow(exits, map),
    map,
    callLookup: resultBlock(CALL_LOOKUP_EVENT),
    geoSearch: resultBlock(GEO_EVENT),
    missingDimensions: dims.missing,
  };
}

module.exports = {
  MAP_EVENT, CALL_LOOKUP_EVENT, GEO_EVENT, OPTIONAL_DIMENSIONS, DEFINITIONS,
  aggregateMapClicks, countBy, actionsRow, optionalDimensionStatus, fetchStoreActions,
};
