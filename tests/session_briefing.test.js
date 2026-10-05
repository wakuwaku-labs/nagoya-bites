const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, daysBetween } = require('../scripts/session_briefing');

const policy = { staleDays: 14, dueSoonDays: 3, maxTodayPicks: 3, maxItemsPerSection: 5 };
const issue = (identifier, type, extra = {}) => ({
  identifier, title: identifier, state: { type }, priority: 3, updatedAt: '2026-10-05T00:00:00Z', project: null, assignee: null, dueDate: null, ...extra,
});

test('daysBetween counts calendar days across month boundaries', () => {
  assert.equal(daysBetween('2026-09-30T23:00:00Z', '2026-10-01'), 1);
  assert.equal(daysBetween('2026-10-06', '2026-10-06'), 0);
});

test('classify flags overdue, due soon, urgent, stale and ignores closed issues', () => {
  const r = classify([
    issue('P-1', 'unstarted', { dueDate: '2026-10-01' }),
    issue('P-2', 'started', { dueDate: '2026-10-09' }),
    issue('P-3', 'unstarted', { priority: 1 }),
    issue('P-4', 'backlog', { updatedAt: '2026-09-01T00:00:00Z' }),
    issue('P-5', 'completed', { dueDate: '2026-09-01', priority: 1 }),
    issue('P-6', 'canceled', { updatedAt: '2025-01-01T00:00:00Z' }),
    issue('P-7', 'unstarted', { dueDate: '2026-10-10' }),
  ], '2026-10-06', policy);

  assert.equal(r.activeCount, 5);
  assert.deepEqual(r.overdue.map(i => [i.identifier, i.daysLate]), [['P-1', 5]]);
  assert.deepEqual(r.dueSoon.map(i => i.identifier), ['P-2']); // P-7 is 4 days out
  assert.deepEqual(r.urgentNotStarted.map(i => i.identifier), ['P-3']);
  assert.deepEqual(r.stale.map(i => i.identifier), ['P-4']);
  assert.deepEqual(r.picks.map(p => p.identifier), ['P-1', 'P-3', 'P-2']);
  assert.equal(r.missing.project, 5);
});

test('classify handles an empty Linear team', () => {
  const r = classify([], '2026-10-06', policy);
  assert.equal(r.activeCount, 0);
  assert.deepEqual(r.picks, []);
});

test('picks do not repeat an issue that matches several reasons', () => {
  const r = classify([issue('P-9', 'unstarted', { priority: 1, dueDate: '2026-10-01' })], '2026-10-06', policy);
  assert.deepEqual(r.picks, [{ identifier: 'P-9', title: 'P-9', reason: '期限切れ' }]);
});
