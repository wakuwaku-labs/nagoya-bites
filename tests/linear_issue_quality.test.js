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
