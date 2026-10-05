const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { projectForCategory } = require('../scripts/lib/linear_project_map');

const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/linear_issue_defaults.json'), 'utf8'));

test('primary category segment decides the project', () => {
  assert.equal(projectForCategory('SEO / data-quality', defaults), '検索から見つけてもらう');
  assert.equal(projectForCategory('data-quality / ux / seo', defaults), '実在と信頼を守る');
  assert.equal(projectForCategory('ops-monitoring / SEO', defaults), '運用を自動で回す');
  assert.equal(projectForCategory('バグ / 日次ジャーナル', defaults), '毎日の編集を止めない');
});

test('falls back to the whole category, then to the catch-all project', () => {
  assert.equal(projectForCategory('competitive / seo / brand', defaults), '検索から見つけてもらう');
  assert.equal(projectForCategory('brand', defaults), 'Nagoya Bites');
  assert.equal(projectForCategory(null, defaults), 'Nagoya Bites');
  assert.equal(projectForCategory('SEO', {}), null);
});

test('every rule names a project with an id and the catch-all is configured', () => {
  for (const rule of defaults.projectRules) {
    assert.ok(rule.project && /^[0-9a-f-]{36}$/.test(rule.projectId), rule.project);
    assert.ok(rule.keywords.length > 0);
  }
  assert.ok(defaults.projectName && defaults.projectId);
});

test('ASCII keywords match whole words only', () => {
  assert.equal(projectForCategory('social', defaults), 'Nagoya Bites'); // not "ci"
  assert.equal(projectForCategory('CI / data-pipeline', defaults), '運用を自動で回す');
  assert.equal(projectForCategory('ops-monitoring / ci', defaults), '運用を自動で回す');
});
