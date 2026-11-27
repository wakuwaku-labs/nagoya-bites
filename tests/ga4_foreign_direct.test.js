'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { FOREIGN_DIRECT_FILTER, addExclusion, excludeForeignDirect } = require('../scripts/lib/ga4_foreign_direct');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('除外の条件は LINE レポート（GAS）の FOREIGN_DIRECT_FILTER と同じ', () => {
  const m = read('.gas-deploy/Code.js').match(/const FOREIGN_DIRECT_FILTER = (\{[\s\S]*?\n\});/);
  assert.ok(m, 'GAS の定義が見つかる');
  const gas = vm.runInNewContext('(' + m[1] + ')');
  assert.deepEqual(JSON.parse(JSON.stringify(gas)), FOREIGN_DIRECT_FILTER);
});

test('絞り込みの無い取得には NOT(海外の直接) だけを足す', () => {
  const body = { metrics: [{ name: 'sessions' }] };
  assert.deepEqual(addExclusion(body).dimensionFilter, { notExpression: FOREIGN_DIRECT_FILTER });
  assert.equal(body.dimensionFilter, undefined, '元の依頼は書き換えない');
});

test('元の絞り込みは AND で残し、すべての runReport に入る', async () => {
  const own = { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'modal_open' } } };
  const calls = [];
  const client = excludeForeignDirect({
    properties: {
      getMetadata: async (p) => p,
      runReport: async (p) => { calls.push(p); return { data: {} }; },
    },
  });
  await client.properties.runReport({ property: 'properties/1', requestBody: { dimensionFilter: own } });
  assert.equal(calls[0].property, 'properties/1');
  assert.deepEqual(calls[0].requestBody.dimensionFilter, { andGroup: { expressions: [own, { notExpression: FOREIGN_DIRECT_FILTER }] } });
  assert.deepEqual(await client.properties.getMetadata({ name: 'n' }), { name: 'n' });
});

test('fetch_ga4_views.js は除外を通したクライアントだけを使う', () => {
  const src = read('scripts/fetch_ga4_views.js');
  assert.match(src, /const analyticsdata = excludeForeignDirect\(google\.analyticsdata\(/);
  assert.equal(src.match(/google\.analyticsdata\(/g).length, 1);
});
