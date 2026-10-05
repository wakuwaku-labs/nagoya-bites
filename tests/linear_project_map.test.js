const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { krLabelForCategory, isKrLabel } = require('../scripts/lib/linear_project_map');

const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/linear_issue_defaults.json'), 'utf8'));

test('primary category segment decides the KR label', () => {
  assert.equal(krLabelForCategory('SEO / data-quality', defaults), 'KR:検索から見つけてもらう');
  assert.equal(krLabelForCategory('data-quality / ux / seo', defaults), 'KR:実在と信頼を守る');
  assert.equal(krLabelForCategory('ops-monitoring / SEO', defaults), 'KR:運用を自動で回す');
  assert.equal(krLabelForCategory('バグ / 日次ジャーナル', defaults), 'KR:毎日の編集を止めない');
});

test('falls back to the whole category, otherwise no label', () => {
  assert.equal(krLabelForCategory('competitive / seo / brand', defaults), 'KR:検索から見つけてもらう');
  assert.equal(krLabelForCategory('brand', defaults), null);
  assert.equal(krLabelForCategory(null, defaults), null);
  assert.equal(krLabelForCategory('SEO', {}), null);
});

test('ASCII keywords match whole words only', () => {
  assert.equal(krLabelForCategory('social', defaults), null); // not "ci"
  assert.equal(krLabelForCategory('CI / data-pipeline', defaults), 'KR:運用を自動で回す');
});

test('config: one project for everything, KR labels are prefixed', () => {
  assert.equal(defaults.projectName, 'Nagoya Bites');
  assert.match(defaults.projectId, /^[0-9a-f-]{36}$/);
  for (const rule of defaults.krLabelRules) {
    assert.ok(isKrLabel(rule.label), rule.label);
    assert.ok(rule.keywords.length > 0);
  }
  assert.equal(isKrLabel('Bug'), false);
});
