'use strict';
// ISSUE-195: cmdAutoPromote の today が UTC 日付でなく JST 日付を使っていること。
// 00:00–09:00 JST（UTC 前日）の境界で誤って昇格を1日スキップしないか確認する。

const test = require('node:test');
const assert = require('node:assert');

// テスト用に cmdAutoPromote の判定ロジックだけを切り出す（ファイル I/O なし）
function jstDateFromTimestamp(ts) {
  return new Date(ts + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function shouldPromote(detectedDateJst, nowTs) {
  const today = jstDateFromTimestamp(nowTs);
  const ms = new Date(today + 'T00:00:00+09:00') - new Date(detectedDateJst + 'T00:00:00+09:00');
  const days = ms / 86400000;
  return days >= 3;
}

// JST 2026-11-13T05:00:00 = UTC 2026-11-12T20:00:00
// JST では 11-13（3日前検出 = 11-10 → days=3 → 昇格すべき）
// UTC では 11-12（3日前検出 = 11-10 → days=2 → 旧バグは昇格しなかった）
const UTC_PREV_DAY = Date.UTC(2026, 10, 12, 20, 0, 0); // JST 2026-11-13 05:00

test('JST 午前5時（UTC 前日）でも、JST 基準で3日前の店を昇格する', () => {
  const detectedJst = '2026-11-10'; // JST 3日前
  assert.ok(shouldPromote(detectedJst, UTC_PREV_DAY), '昇格すべきなのに昇格しなかった（UTC 日付で判定されている）');
});

test('JST 午前5時で、JST 基準でちょうど2日前の店は昇格しない', () => {
  const detectedJst = '2026-11-11'; // JST 2日前（3日未満）
  assert.ok(!shouldPromote(detectedJst, UTC_PREV_DAY), '昇格すべきでないのに昇格した');
});

test('JST 日中（UTC と同日）で、3日前の店を昇格する', () => {
  const nowTs = Date.UTC(2026, 10, 13, 6, 0, 0); // JST 2026-11-13 15:00
  const detectedJst = '2026-11-10';
  assert.ok(shouldPromote(detectedJst, nowTs), '通常ケースで昇格しなかった');
});

test('fetch_trending_articles.js の cmdAutoPromote は Date.now()+9h でJST日付を使っている', () => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'scripts', 'fetch_trending_articles.js'),
    'utf8'
  );
  const match = src.match(/function cmdAutoPromote\(\)[^}]*?const today[^\n]+/s);
  assert.ok(match, 'cmdAutoPromote が見つからない');
  assert.match(
    match[0],
    /Date\.now\(\)\s*\+\s*9\s*\*\s*3600\s*\*\s*1000/,
    'cmdAutoPromote の today が UTC（new Date().toISOString()）のまま。JST に直す'
  );
});
