const test = require('node:test');
const assert = require('node:assert/strict');
const { mergePendingIds, remainingPendingIds, taskBlock, missingQaDefaults, dueDateFrom } = require('../scripts/sync_qa_findings_to_linear');

test('Linear sync retry queue merges pending and newly created IDs without duplicates', () => {
  assert.deepEqual(mergePendingIds(['QA-SEC-A', 'QA-SEC-B'], ['QA-SEC-B', 'QA-SEC-C']), [
    'QA-SEC-A', 'QA-SEC-B', 'QA-SEC-C',
  ]);
  assert.deepEqual(mergePendingIds(undefined, ['QA-SEC-A']), ['QA-SEC-A']);
  assert.deepEqual(mergePendingIds(['QA-SEC-A'], undefined), ['QA-SEC-A']);
});

test('Linear sync retry queue removes only IDs acknowledged after mapping is saved', () => {
  const ids = ['QA-SEC-A', 'QA-SEC-B', 'QA-SEC-C'];
  assert.deepEqual(remainingPendingIds(ids, 'QA-SEC-B'), ['QA-SEC-A', 'QA-SEC-C']);
  assert.deepEqual(remainingPendingIds(ids, 'missing'), ids);
});

test('Linear issue description ends at the next multi-segment QA ID heading', () => {
  const markdown = [
    '## 夜間QA検出課題（QA-*）',
    '',
    '### [QA-SEC-SECRET-KEY] Key warning',
    '- **priority**: P0 → **status**: ready',
    '- First finding body',
    '',
    '### [QA-SEC-NPM-AUDIT] Dependency warning',
    '- **priority**: P2 → **status**: ready',
    '- Second finding body',
    '',
    '## Other section',
  ].join('\n');

  assert.equal(taskBlock(markdown, 'QA-SEC-SECRET-KEY'), [
    '### [QA-SEC-SECRET-KEY] Key warning',
    '- **priority**: P0 → **status**: ready',
    '- First finding body',
  ].join('\n'));
});

test('nightly Linear creation stays queued until project, assignee, and priority deadlines exist', () => {
  assert.deepEqual(missingQaDefaults({ projectId: null, assigneeId: 'member', dueDateDaysByPriority: {} }, ['P0', 'P2']), [
    'projectId', 'dueDateDaysByPriority',
  ]);
  assert.deepEqual(missingQaDefaults({ projectId: 'project', assigneeId: 'member', dueDateDaysByPriority: { P0: 0, P2: 14 } }, ['P0', 'P2']), []);
});

test('nightly due dates use valid UTC calendar dates and nonnegative whole-day offsets', () => {
  assert.equal(dueDateFrom('2028-02-28', 1), '2028-02-29');
  assert.equal(dueDateFrom('2026-12-31', 1), '2027-01-01');
  assert.throws(() => dueDateFrom('2026-02-31', 1), /Invalid nightly QA date/);
  assert.throws(() => dueDateFrom('2026-10-05', -1), /Invalid due date offset/);
});

test('QA issues get KR and role labels resolved to ids; unknown or other-team labels are reported', () => {
  const { resolveLabelIds } = require('../scripts/sync_qa_findings_to_linear');
  const { labelsForTask, fieldsFromBlock } = require('../scripts/lib/linear_project_map');
  const defaults = require('../data/linear_issue_defaults.json');
  const block = '### [QA-SEC-1] x\n- **priority**: P2 → **status**: ready\n- **category**: Security\n- **owner**: DataKeeper\n';
  const names = labelsForTask(fieldsFromBlock(block), defaults);
  assert.deepEqual(names, ['KR:運用を自動で回す', '担当:DataKeeper']);
  const nodes = [
    { id: 'kr', name: 'KR:運用を自動で回す', team: null },
    { id: 'other', name: '担当:DataKeeper', team: { id: 'another-team' } },
  ];
  assert.deepEqual(resolveLabelIds(names, nodes, 'team'), { ids: ['kr'], missing: ['担当:DataKeeper'] });
  assert.deepEqual(resolveLabelIds([], nodes, 'team'), { ids: [], missing: [] });
});
