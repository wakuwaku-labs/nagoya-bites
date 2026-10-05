const test = require('node:test');
const assert = require('node:assert/strict');
const { plan } = require('../scripts/assign_linear_projects');

const defaults = {
  projectName: 'Nagoya Bites',
  assigneeId: 'owner-id',
  retiredProjects: ['検索'],
  krLabelRules: [{ label: 'KR:検索', keywords: ['seo'] }, { label: 'KR:信頼', keywords: ['trust'] }],
};
const issue = (identifier, title, extra = {}) => ({ identifier, title, state: { type: 'unstarted' }, project: null, labels: [], description: '', ...extra });

test('moves unset or retired projects to Nagoya Bites and adds a KR label', () => {
  const items = plan([
    issue('P-1', '[SEO-1] a'),
    issue('P-2', '[ISSUE-9] b', { project: { name: '検索' }, description: '**Notionカテゴリ:** trust\n' }),
    issue('P-3', '[ISSUE-8] c', { description: '**Notionカテゴリ:** 未設定\n' }),
  ], [{ id: 'SEO-1', category: 'SEO / 計測' }], defaults);
  assert.ok(items.every(i => i.assignee === 'owner-id'));
  assert.deepEqual(items.map(i => [i.identifier, i.project, i.krLabel]), [
    ['P-1', 'Nagoya Bites', 'KR:検索'],
    ['P-2', 'Nagoya Bites', 'KR:信頼'],
    ['P-3', 'Nagoya Bites', null],
  ]);
});

test('is idempotent and never overrides a human choice', () => {
  const items = plan([
    issue('P-1', '[SEO-1] a', { project: { name: 'Nagoya Bites' }, labels: [{ name: 'KR:信頼' }], assignee: { id: 'x' } }), // already done
    issue('P-2', '[SEO-2] b', { project: { name: '別の案件' }, assignee: { id: 'someone' } }), // human choices kept
    issue('P-3', '[SEO-3] c', { state: { type: 'completed' } }),
    issue('P-4', 'Get familiar with Linear'),
  ], [{ id: 'SEO-2', category: 'SEO' }], defaults);
  assert.deepEqual(items.map(i => [i.identifier, i.project, i.krLabel]), [['P-2', null, 'KR:検索']]);
});

test('adds role labels from backlog owner or Notion department, but keeps existing role labels', () => {
  const withRoles = { ...defaults, roleLabels: { prefix: '担当:', roles: ['Builder', 'Editor'], ownerActionLabel: '担当:オーナー作業', ownerActionKeywords: ['片桐'] } };
  const done = { project: { name: 'Nagoya Bites' }, labels: [{ name: 'KR:信頼' }], assignee: { id: 'x' } };
  const items = plan([
    issue('P-1', '[SEO-1] a', done),
    issue('P-2', '[ISSUE-9] b', { ...done, description: '**Notion担当部署:** Editor\n' }),
    issue('P-3', '[SEO-3] c', { ...done, labels: [{ name: 'KR:信頼' }, { name: '担当:Editor' }] }),
  ], [{ id: 'SEO-1', owner: '片桐 ← Builder' }, { id: 'SEO-3', owner: 'Builder' }], withRoles);
  assert.deepEqual(items.map(i => [i.identifier, i.roleLabels]), [
    ['P-1', ['担当:オーナー作業', '担当:Builder']],
    ['P-2', ['担当:Editor']],
  ]);
});
