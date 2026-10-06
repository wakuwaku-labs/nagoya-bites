const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReport, retro, fetchIssues, render } = require('../scripts/linear_watchdog');

const policy = { staleDays: 14, dueSoonDays: 3, maxTodayPicks: 3, maxItemsPerSection: 5 };
const issue = (identifier, type, extra = {}) => ({
  identifier, title: identifier, url: `https://linear.app/x/${identifier}`, state: { type }, priority: 3,
  updatedAt: '2026-10-05T00:00:00Z', createdAt: '2026-09-01T00:00:00Z', completedAt: null, canceledAt: null,
  project: { name: 'Nagoya Bites' }, assignee: { name: 'owner' }, dueDate: null, ...extra,
});

test('healthy team is ok and has no problems', () => {
  const r = buildReport([issue('P-1', 'unstarted'), issue('P-2', 'started', { dueDate: '2026-10-08' })], '2026-10-06', policy);
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.dueSoon.map(i => i.identifier), ['P-2']); // due soon alone does not alert
});

test('overdue, urgent-not-started and stale each become a problem with items', () => {
  const r = buildReport([
    issue('P-1', 'unstarted', { dueDate: '2026-10-01' }),
    issue('P-2', 'backlog', { priority: 1 }),
    issue('P-3', 'started', { updatedAt: '2026-09-01T00:00:00Z' }),
    issue('P-4', 'completed', { dueDate: '2026-09-01', priority: 1, updatedAt: '2026-01-01T00:00:00Z' }),
  ], '2026-10-06', policy);
  assert.equal(r.ok, false);
  assert.deepEqual(r.problems.map(p => [p.kind, p.items.map(i => i.identifier)]),
    [['overdue', ['P-1']], ['urgent_not_started', ['P-2']], ['stale', ['P-3']]]);
  assert.equal(r.problems[0].items[0].daysLate, 5);
});

test('empty team is ok', () => {
  const r = buildReport([], '2026-10-06', policy);
  assert.equal(r.ok, true);
  assert.equal(r.activeCount, 0);
});

test('retro counts the last 7 days only and ignores future timestamps', () => {
  const rt = retro([
    issue('P-1', 'completed', { completedAt: '2026-10-01T10:00:00Z', createdAt: '2026-10-02T00:00:00Z' }),
    issue('P-2', 'completed', { completedAt: '2026-09-20T10:00:00Z' }),
    issue('P-3', 'canceled', { canceledAt: '2026-09-29T00:00:00Z' }),
    issue('P-4', 'unstarted', { createdAt: '2026-10-07T00:00:00Z' }),
  ], '2026-10-06');
  assert.deepEqual(rt.completed.map(i => i.identifier), ['P-1']);
  assert.equal(rt.canceled, 1);
  assert.equal(rt.created, 1);
});

test('fetchIssues follows pagination and surfaces API errors', async () => {
  const pages = [
    { data: { issues: { nodes: [issue('P-1', 'started')], pageInfo: { hasNextPage: true, endCursor: 'c1' } } } },
    { data: { issues: { nodes: [issue('P-2', 'started')], pageInfo: { hasNextPage: false, endCursor: null } } } },
  ];
  const seen = [];
  const ok = async (_url, init) => { seen.push(JSON.parse(init.body).variables.after); return { ok: true, status: 200, json: async () => pages.shift() }; };
  assert.deepEqual((await fetchIssues('P', 'k', ok)).map(i => i.identifier), ['P-1', 'P-2']);
  assert.deepEqual(seen, [null, 'c1']);

  const denied = async () => ({ ok: false, status: 401, json: async () => ({ errors: [{ message: 'Authentication required' }] }) });
  await assert.rejects(fetchIssues('P', 'bad', denied), /Linear API 401: Authentication required/);
});

test('render reports unreachable Linear instead of looking healthy', () => {
  assert.match(render({ error: 'LINEAR_API_KEY が設定されていません' }), /読めませんでした/);
});

test('issueFilter scopes to the project when configured', () => {
  const { issueFilter } = require('../scripts/linear_watchdog');
  assert.deepEqual(issueFilter('P', null), { team: { key: { eq: 'P' } } });
  assert.deepEqual(issueFilter('P', 'Nagoya Bites'), { team: { key: { eq: 'P' } }, project: { name: { eq: 'Nagoya Bites' } } });
});
