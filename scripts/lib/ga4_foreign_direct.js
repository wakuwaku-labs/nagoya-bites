'use strict';
/**
 * 海外（countryId が JP 以外・国が不明を含む）からの「直接アクセス」を GA4 の集計から除く。
 * 機械的な訪問とみる判断は docs/decisions/0066（2026-11-23 の追記）。
 * LINE の日次・週次レポート（.gas-deploy/Code.js の FOREIGN_DIRECT_FILTER）と同じ条件。変えるときは両方を変える。
 *
 * 利用側: scripts/fetch_ga4_views.js、tests/ga4_foreign_direct.test.js。
 */

const FOREIGN_DIRECT_FILTER = {
  andGroup: {
    expressions: [
      { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'EXACT', value: '(direct)' } } },
      { notExpression: { filter: { fieldName: 'countryId', stringFilter: { matchType: 'EXACT', value: 'JP' } } } },
    ],
  },
};

/** runReport の requestBody に除外を足した写しを返す（元の絞り込みは AND で残す） */
function addExclusion(requestBody) {
  const exclude = { notExpression: FOREIGN_DIRECT_FILTER };
  const own = requestBody.dimensionFilter;
  return { ...requestBody, dimensionFilter: own ? { andGroup: { expressions: [own, exclude] } } : exclude };
}

/** すべての runReport に除外が入る GA4 クライアントを返す（取得を足しても除外し忘れない） */
function excludeForeignDirect(analyticsdata) {
  const { properties } = analyticsdata;
  return {
    properties: {
      getMetadata: (params) => properties.getMetadata(params),
      runReport: (params) => properties.runReport({ ...params, requestBody: addExclusion(params.requestBody) }),
    },
  };
}

module.exports = { FOREIGN_DIRECT_FILTER, addExclusion, excludeForeignDirect };
