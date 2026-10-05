const test = require('node:test');
const assert = require('node:assert/strict');
const { plan } = require('../scripts/assign_linear_projects');

const defaults = { projectName: '受け皿', projectRules: [{ project: '検索', keywords: ['seo'] }, { project: '信頼', keywords: ['trust'] }] };
const issue = (identifier, title, extra = {}) => ({ identifier, title, state: { type: 'unstarted' }, project: null, description: '', ...extra });

test('assigns by backlog category, then Notion category, then the catch-all', () => {
  const items = plan([
    issue('P-1', '[SEO-1] a'),
    issue('P-2', '[ISSUE-9] b', { description: '**Notionカテゴリ:** trust\n' }),
    issue('P-3', '[ISSUE-8] c', { description: '**Notionカテゴリ:** 未設定\n' }),
  ], [{ id: 'SEO-1', category: 'SEO / 計測' }], defaults);
  assert.deepEqual(items.map(i => i.project), ['検索', '信頼', '受け皿']);
});

test('never touches issues that already have a project, are closed, or are not ours', () => {
  const items = plan([
    issue('P-1', '[SEO-1] a', { project: { name: 'X' } }),
    issue('P-2', '[SEO-2] b', { state: { type: 'completed' } }),
    issue('P-3', 'Get familiar with Linear'),
  ], [], defaults);
  assert.deepEqual(items, []);
});
