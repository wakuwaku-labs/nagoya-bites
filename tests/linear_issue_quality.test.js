const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBacklog } = require('../scripts/next_task');
const { isValidDueDate, missingCreateFields } = require('../scripts/sync_backlog_to_linear');

test('backlog parser reads explicit Linear assignee, due date, and project', () => {
  const [task] = parseBacklog([
    '### [SEO-123] 検索結果から閉店店舗を除外する',
    '- **priority**: P1 → **status**: ready',
    '- **assignee**: wakato1251999',
    '- **due**: 2026-10-12',
    '- **project**: Nagoya Bites',
  ].join('\n'));

  assert.equal(task.assignee, 'wakato1251999');
  assert.equal(task.dueDate, '2026-10-12');
  assert.equal(task.project, 'Nagoya Bites');
  assert.deepEqual(missingCreateFields(task), []);
});

test('issue creation rejects missing metadata and impossible calendar dates', () => {
  assert.equal(isValidDueDate('2028-02-29'), true);
  assert.equal(isValidDueDate('2026-02-29'), false);
  assert.equal(isValidDueDate('2026-13-01'), false);
  assert.deepEqual(missingCreateFields({ assignee: 'user', dueDate: '2026-02-31', project: 'Project' }), ['dueDate']);
  assert.deepEqual(missingCreateFields({ assignee: null, dueDate: null, project: null }), ['assignee', 'dueDate', 'project']);
});

test('create defaults fill assignee and due date but never guess a project', () => {
  const { withCreateDefaults } = require('../scripts/sync_backlog_to_linear');
  const defaults = { assigneeName: 'me', dueDateDaysByPriority: { P0: 1, P1: 7, P2: 14, P3: 30 }, projectByCategory: { SEO: '検索から見つけてもらう' }, projectName: null };

  const seo = withCreateDefaults({ priority: 'P1', category: 'SEO' }, defaults, '2026-10-06');
  assert.equal(seo.assignee, 'me');
  assert.equal(seo.dueDate, '2026-10-13');
  assert.equal(seo.project, '検索から見つけてもらう');
  assert.deepEqual(missingCreateFields(seo), []);

  const unmapped = withCreateDefaults({ priority: 'P2', category: 'data-quality' }, defaults, '2026-12-25');
  assert.equal(unmapped.dueDate, '2027-01-08');
  assert.deepEqual(missingCreateFields(unmapped), ['project']);

  const explicit = withCreateDefaults({ priority: 'P3', assignee: 'someone', dueDate: '2026-11-01', project: 'X', category: 'SEO' }, defaults, '2026-10-06');
  assert.deepEqual([explicit.assignee, explicit.dueDate, explicit.project], ['someone', '2026-11-01', 'X']);

  const noPriority = withCreateDefaults({ category: 'SEO' }, defaults, '2026-10-06');
  assert.equal(noPriority.dueDate, '2026-10-20');
  assert.deepEqual(missingCreateFields(withCreateDefaults({ priority: 'P1' }, {}, '2026-10-06')), ['assignee', 'dueDate', 'project']);
});
