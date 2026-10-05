const test = require('node:test');
const assert = require('node:assert/strict');
const { mergePendingIds, remainingPendingIds, taskBlock } = require('../scripts/sync_qa_findings_to_linear');

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
