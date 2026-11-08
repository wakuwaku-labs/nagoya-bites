'use strict';
// ISSUE-195: cmdAutoPromote() の基準日が UTC だと JST深夜0〜9時にずれる問題の修正確認
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// jstDateString の実装を直接テストするため、スクリプトから切り出して検証
function jstDateStringFrom(now) {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// cmdAutoPromote の日数判定ロジックを純関数として抽出（スクリプト本体と同一アルゴリズム）
function daysElapsed(today, detectedDate) {
  const ms = new Date(today + 'T00:00:00+09:00') - new Date(detectedDate + 'T00:00:00+09:00');
  return ms / 86400000;
}

test('jstDateString — JST深夜0:30(UTC前日15:30)は翌日のJST日付を返す', () => {
  // 2026-11-09 00:30 JST = 2026-11-08 15:30 UTC
  const utcMs = Date.UTC(2026, 10, 8, 15, 30, 0); // months are 0-indexed
  assert.strictEqual(jstDateStringFrom(utcMs), '2026-11-09');
});

test('jstDateString — UTC 00:00 は前日のJST日付（JST 09:00）を返す', () => {
  // 2026-11-09 00:00 UTC = 2026-11-09 09:00 JST → same JST date
  const utcMs = Date.UTC(2026, 10, 9, 0, 0, 0);
  assert.strictEqual(jstDateStringFrom(utcMs), '2026-11-09');
});

test('jstDateString — UTC 14:59 は前日の JST 23:59 を返す', () => {
  // 2026-11-08 14:59 UTC = 2026-11-08 23:59 JST
  const utcMs = Date.UTC(2026, 10, 8, 14, 59, 0);
  assert.strictEqual(jstDateStringFrom(utcMs), '2026-11-08');
});

test('daysElapsed — 検出日から3日経過でプロモート条件を満たす（ISSUE-195 再現ケース）', () => {
  // JST 2026-11-08 00:30 に実行。検出日 2026-11-05。
  // UTC基準だと today=2026-11-07（前日）→ elapsed=2日 → プロモート不可（バグ）
  // JST基準だと today=2026-11-08 → elapsed=3日 → プロモート可（修正後）
  const utcMs = Date.UTC(2026, 10, 7, 15, 30, 0); // 2026-11-07 15:30 UTC = 2026-11-08 00:30 JST
  const todayJst = jstDateStringFrom(utcMs);
  assert.strictEqual(todayJst, '2026-11-08');
  const days = daysElapsed(todayJst, '2026-11-05');
  assert.strictEqual(days, 3);
});

test('daysElapsed — 同じ状況でUTC基準なら2日になる（修正前のバグを再現）', () => {
  const utcMs = Date.UTC(2026, 10, 7, 15, 30, 0);
  // UTC基準での today（バグのある旧実装）
  const todayUtc = new Date(utcMs).toISOString().slice(0, 10);
  assert.strictEqual(todayUtc, '2026-11-07');
  const days = daysElapsed(todayUtc, '2026-11-05');
  assert.strictEqual(days, 2); // 旧実装では2日 → プロモート不可
});

test('fetch_trending_articles.js — jstDateString 関数が定義されている', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'fetch_trending_articles.js'),
    'utf8'
  );
  assert.ok(src.includes('function jstDateString()'), 'jstDateString が定義されていること');
  assert.ok(src.includes('9 * 3600 * 1000'), 'JST オフセット (+9h) が使われていること');
});

test('fetch_trending_articles.js — cmdAutoPromote が new Date().toISOString() を直接使っていない', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'fetch_trending_articles.js'),
    'utf8'
  );
  // cmdAutoPromote 関数の範囲だけを取り出して確認
  const fnStart = src.indexOf('function cmdAutoPromote()');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  const fnBody = fnEnd > -1 ? src.slice(fnStart, fnEnd) : src.slice(fnStart);
  assert.ok(
    !fnBody.includes('new Date().toISOString().slice(0, 10)'),
    'cmdAutoPromote は new Date().toISOString() を直接使ってはいけない'
  );
  assert.ok(fnBody.includes('jstDateString()'), 'cmdAutoPromote が jstDateString() を使っていること');
});
