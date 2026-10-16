const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan } = require('../scripts/sync_backlog_to_linear');

const state = (ids = {}) => ({ issues: ids, workspaceName: 'test', duplicateImports: [] });
const defaults = { projectName: 'Nagoya Bites', assigneeName: 'owner', dueDateDaysByPriority: { P1: 7, P2: 14 }, krLabelRules: [], roleLabels: { prefix: '担当:', roles: [], ownerActionLabel: '担当:オーナー作業', ownerActionKeywords: [] } };
const task = (id, status = 'ready', priority = 'P2', title = 'タスク') => ({ id, status, priority, title, line: 1 });
const liveIssue = (identifier, stateType = 'unstarted', stateName = 'Todo', priority = 3) => [identifier, { identifier, state: { type: stateType, name: stateName }, priority, title: `[${identifier}] タスク` }];

test('generates update when title/state/priority differ', () => {
  const tasks = [task('ISSUE-1', 'in_progress', 'P1')];
  const live = new Map([liveIssue('P-1', 'unstarted', 'Todo', 3)]);
  const s = state({ 'ISSUE-1': { identifier: 'P-1' } });
  const plan = buildPlan(tasks, live, s, defaults, '### [ISSUE-1] タスク\n');
  assert.equal(plan.length, 1);
  assert.equal(plan[0].action, 'update');
  assert.equal(plan[0].identifier, 'P-1');
});

test('does not update when Linear state is completed', () => {
  const tasks = [task('ISSUE-1', 'ready', 'P1')];
  const live = new Map([liveIssue('P-1', 'completed', 'Done', 2)]);
  const s = state({ 'ISSUE-1': { identifier: 'P-1' } });
  const plan = buildPlan(tasks, live, s, defaults, '### [ISSUE-1] タスク\n');
  assert.equal(plan.length, 0, 'completed Linear issue must not be updated');
});

test('does not update when Linear state is cancelled', () => {
  const tasks = [task('ISSUE-1', 'ready', 'P2')];
  const live = new Map([liveIssue('P-1', 'cancelled', 'Canceled', 3)]);
  const s = state({ 'ISSUE-1': { identifier: 'P-1' } });
  const plan = buildPlan(tasks, live, s, defaults, '### [ISSUE-1] タスク\n');
  assert.equal(plan.length, 0, 'cancelled Linear issue must not be updated');
});

test('does not update when Linear state is duplicate', () => {
  const tasks = [task('ISSUE-1', 'ready', 'P2')];
  const live = new Map([liveIssue('P-1', 'duplicate', 'Duplicate', 3)]);
  const s = state({ 'ISSUE-1': { identifier: 'P-1' } });
  const plan = buildPlan(tasks, live, s, defaults, '### [ISSUE-1] タスク\n');
  assert.equal(plan.length, 0, 'duplicate Linear issue must not be updated');
});

test('categorizes archived issues (not in live list) as archived, not update', () => {
  const tasks = [task('ISSUE-1', 'ready', 'P2')];
  const live = new Map(); // empty — issue is archived
  const s = state({ 'ISSUE-1': { identifier: 'P-1' } });
  const plan = buildPlan(tasks, live, s, defaults, '### [ISSUE-1] タスク\n');
  assert.equal(plan.length, 1);
  assert.equal(plan[0].action, 'archived', 'issue not in live list must be archived, not update');
  assert.equal(plan[0].identifier, 'P-1');
});

test('creates new issue for open tasks without a state entry', () => {
  const tasks = [task('ISSUE-2', 'ready', 'P2')];
  const live = new Map();
  const s = state({});
  const plan = buildPlan(tasks, live, s, defaults, '### [ISSUE-2] タスク\n');
  assert.equal(plan.length, 1);
  assert.equal(plan[0].action, 'create');
});

test('does not create issue for done tasks without a state entry', () => {
  const tasks = [task('ISSUE-3', 'done', 'P2')];
  const live = new Map();
  const s = state({});
  const plan = buildPlan(tasks, live, s, defaults, '### [ISSUE-3] タスク\n');
  assert.equal(plan.length, 0, 'done tasks with no Linear entry must not be created');
});

test('mix: archived and terminal are excluded, only open diff tasks produce actions', () => {
  const tasks = [
    task('ISSUE-A', 'ready', 'P1'), // archived (not in live)
    task('ISSUE-B', 'in_progress', 'P2'), // Linear is completed → skip
    task('ISSUE-C', 'ready', 'P2'), // differs → update
  ];
  const live = new Map([
    liveIssue('P-B', 'completed', 'Done', 3),
    ['P-C', { identifier: 'P-C', state: { type: 'unstarted', name: 'Backlog' }, priority: 4, title: '[ISSUE-C] タスク' }],
  ]);
  const s = state({ 'ISSUE-A': { identifier: 'P-A' }, 'ISSUE-B': { identifier: 'P-B' }, 'ISSUE-C': { identifier: 'P-C' } });
  const plan = buildPlan(tasks, live, s, defaults, '### [ISSUE-A] タスク\n### [ISSUE-B] タスク\n### [ISSUE-C] タスク\n');
  assert.deepEqual(plan.map(x => x.action), ['archived', 'update']);
  assert.equal(plan[0].identifier, 'P-A');
  assert.equal(plan[1].identifier, 'P-C');
});
