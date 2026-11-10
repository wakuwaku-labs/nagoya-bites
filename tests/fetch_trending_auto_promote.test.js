'use strict';
// ISSUE-195: cmdAutoPromote() の基準日は JST 基準でなければならない。
// UTC と JST が日付をまたぐ瞬間（UTC 15:00 以降 = JST 00:00 以降）に、
// UTC 基準の計算は前日になり、3日の条件を満たす店が昇格されない。
//
// このテストは:
//   1. 日付の差分計算ロジックを直接テストする（UTC vs JST 境界）
//   2. fetch_trending_articles.js のソースに UTC 基準の today 計算が残っていないことを確認する
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// ---- ロジックの直接テスト ----

// cmdAutoPromote の日付差計算（JST固定ミッドナイト）を再現する
function daysSince(todayJst, detectedDate) {
  const ms = new Date(todayJst + 'T00:00:00+09:00') - new Date(detectedDate + 'T00:00:00+09:00');
  return ms / 86400000;
}

test('ISSUE-195: JST基準で3日経過の判定が正しく動く', () => {
  // 店の検出日: 2026-11-05
  // 実行日 JST: 2026-11-08 → 経過3日 → 昇格条件を満たす
  assert.strictEqual(daysSince('2026-11-08', '2026-11-05'), 3);
  assert.ok(daysSince('2026-11-08', '2026-11-05') >= 3, '3日経過で昇格されるべき');
});

test('ISSUE-195: UTC/JST 境界ケース — UTC が前日でも JST が3日目なら昇格される', () => {
  // 2026-11-07 JST 23:00 は 2026-11-07 UTC 14:00
  // この瞬間に UTC 基準の today は '2026-11-07'、JST 基準の today は '2026-11-07'（同じ）
  // ただし UTC 15:00:01 になると JST は '2026-11-08' だが UTC は '2026-11-07'
  //
  // 検出日 2026-11-05 に対して:
  //   - UTC today = '2026-11-07': days = 2 → 昇格されない（バグ）
  //   - JST today = '2026-11-08': days = 3 → 昇格される（正しい動作）
  const utcToday = '2026-11-07'; // UTC 2026-11-07T16:00:00Z = JST 2026-11-08 01:00
  const jstToday = '2026-11-08';
  const detected = '2026-11-05';

  const daysUtc = daysSince(utcToday, detected);
  const daysJst = daysSince(jstToday, detected);

  assert.strictEqual(daysUtc, 2, 'UTC 基準なら2日と判定（昇格されない）');
  assert.strictEqual(daysJst, 3, 'JST 基準なら3日と判定（昇格される）');
  assert.ok(daysJst >= 3, 'JST基準で条件を満たす');
  assert.ok(daysUtc < 3, 'UTC基準では条件を満たさない（=バグの症状）');
});

test('ISSUE-195: 1日経過・2日経過は昇格されない', () => {
  assert.strictEqual(daysSince('2026-11-06', '2026-11-05'), 1);
  assert.strictEqual(daysSince('2026-11-07', '2026-11-05'), 2);
  assert.ok(daysSince('2026-11-06', '2026-11-05') < 3);
  assert.ok(daysSince('2026-11-07', '2026-11-05') < 3);
});

// ---- ソースコードの検査 ----

test('ISSUE-195: fetch_trending_articles.js の cmdAutoPromote ブロックが UTC 基準の today を使っていない', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'fetch_trending_articles.js'),
    'utf8',
  );
  // cmdAutoPromote 関数のブロックだけを抜き出して検査する
  const fnStart = src.indexOf('function cmdAutoPromote()');
  assert.ok(fnStart >= 0, 'cmdAutoPromote 関数が見つからない');
  // 関数の終わりは次の 'function ' またはファイル末尾
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  const fnSrc = fnEnd >= 0 ? src.slice(fnStart, fnEnd) : src.slice(fnStart);
  // UTC 基準: new Date().toISOString() が today に使われていないこと
  assert.ok(
    !/const today\s*=\s*new Date\(\)\.toISOString\(\)/.test(fnSrc),
    'cmdAutoPromote で UTC 基準の today が使われている（JST 基準に修正すること・ISSUE-195）',
  );
});

test('ISSUE-195: fetch_trending_articles.js の cmdAutoPromote が JST 基準の today を使っている', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'fetch_trending_articles.js'),
    'utf8',
  );
  // JST 基準: Date.now() + 9 * 3600 * 1000 が含まれること
  assert.ok(
    /Date\.now\(\)\s*\+\s*9\s*\*\s*3600\s*\*\s*1000/.test(src),
    'JST 基準の日付計算（Date.now() + 9 * 3600 * 1000）が fetch_trending_articles.js に無い',
  );
});
