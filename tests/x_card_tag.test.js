'use strict';
// ADR 0084: --card-tag は URL に v=<目印> を足して、X にリンクカードの写真を読み直させる（utm はそのまま）。
const test = require('node:test');
const assert = require('node:assert');
const X = require('../scripts/lib/x_post');

const policy = { siteBase: 'https://nagoya-bites.com', utm: { source: 'x', medium: 'social' } };
const entry = { slug: '2026-11-23-imaike-solo-izakaya-5' };

test('目印が無ければ今までどおり、あれば v= を足す', () => {
  const plain = new URL(X.utmUrl(entry, policy, 'picks'));
  assert.strictEqual(plain.searchParams.get('v'), null);
  const tagged = new URL(X.utmUrl({ ...entry, cardTag: 'p2' }, policy, 'picks'));
  assert.strictEqual(tagged.searchParams.get('v'), 'p2');
  assert.strictEqual(tagged.searchParams.get('utm_content'), 'picks');
  assert.strictEqual(tagged.searchParams.get('utm_campaign'), entry.slug);
  assert.strictEqual(`${tagged.origin}${tagged.pathname}`, X.articleUrl(entry, policy));
});
