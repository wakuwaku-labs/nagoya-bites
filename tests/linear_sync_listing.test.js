'use strict';
// ISSUE-145: Linear 同期の一覧取得が200件で止まらないこと・不完全な一覧では同期しないことの検査
const test = require('node:test');
const assert = require('node:assert');
const { listAllIssues } = require('../scripts/sync_backlog_to_linear');

const make = (from, n) => Array.from({ length: n }, (_, i) => ({ identifier: `P-${from + i}` }));

test('--limit を付けずに一覧を取る（200件を超えても1回で返れば、そのまま全件使う）', () => {
  const calls = [];
  const issues = listAllIssues(args => {
    calls.push(args);
    return { issues: make(1, 250), truncated: false, meta: { limit: null, returned: 250, hasMore: false, partial: false, workspaceErrors: [] } };
  });
  assert.strictEqual(issues.length, 250);
  assert.strictEqual(calls.length, 1);
  assert.ok(!calls[0].includes('--limit'), '--limit を付けない');
});

test('続きがあれば nextCursor で辿り、全ページをつなぐ', () => {
  const pages = [
    { issues: make(1, 200), truncated: true, meta: { hasMore: true, nextCursor: 'c1' } },
    { issues: make(201, 200), truncated: true, meta: { hasMore: true, nextCursor: 'c2' } },
    { issues: make(401, 30), truncated: false, meta: { hasMore: false } },
  ];
  const calls = [];
  const issues = listAllIssues(args => { calls.push(args); return pages[calls.length - 1]; });
  assert.strictEqual(issues.length, 430);
  assert.deepStrictEqual(new Set(issues.map(i => i.identifier)).size, 430);
  assert.strictEqual(calls[1][calls[1].indexOf('--cursor') + 1], 'c1');
  assert.strictEqual(calls[2][calls[2].indexOf('--cursor') + 1], 'c2');
});

test('打ち切られたのに続きの cursor が無い一覧では同期しない', () => {
  assert.throws(() => listAllIssues(() => ({ issues: make(1, 200), truncated: true, meta: { hasMore: true } })), /truncated/);
});

test('一部のワークスペースが読めなかった一覧（partial）では同期しない', () => {
  assert.throws(() => listAllIssues(() => ({ issues: make(1, 10), truncated: false, meta: { hasMore: false, partial: true } })), /partial/);
  assert.throws(() => listAllIssues(() => ({ issues: make(1, 10), truncated: false, meta: { hasMore: false, workspaceErrors: [{ code: 'x' }] } })), /partial/);
});

test('ページが終わらないときは上限で止めて同期しない', () => {
  let n = 0;
  assert.throws(() => listAllIssues(() => ({ issues: make(++n, 1), truncated: true, meta: { hasMore: true, nextCursor: `c${n}` } }), 5), /did not finish/);
});
