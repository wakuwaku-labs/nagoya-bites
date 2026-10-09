'use strict';
// ISSUE-182: 特集・ジャーナル・エリア×ジャンルのページ・トップから誘導ページ（古い ID）へのリンクを数える
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findStubLinks, renderRedirectStub } = require('../scripts/lib/store_orphans');

function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stub-links-'));
  const w = (rel, body) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), body); };
  w('stores/J000000001.html', renderRedirectStub('J000000002', '新しい店'));
  w('stores/J000000002.html', '<!DOCTYPE html><html><body><h1>新しい店</h1></body></html>');
  w('features/a.html', [
    '<a href="../stores/J000000001.html">詳細</a><a href="../stores/J000000001.html">もう一度</a>',
    '<script type="application/ld+json">{"url":"https://nagoya-bites.com/stores/J000000001.html"}</script>',
    '<a href="../stores/J000000002.html">今の店</a>',
    '<a href="https://jouhou.nagoya/J000000001-coffee/">出典</a>',
  ].join('\n'));
  w('journal/b.html', '<a class="store-link" href="../stores/J000000001.html">店舗ページを見る</a>');
  w('stores/area/sakae/izakaya.html', '<a href="../../J000000001.html">店</a><a href="../../J000000002.html">店</a>');
  w('index.html', '<a href="stores/J000000002.html">店</a>');
  return root;
}

test('誘導ページへのリンクを、ページと ID ごとに数える（相対・絶対の両方・外部の URL は数えない）', () => {
  const root = site();
  const r = findStubLinks(root);
  assert.strictEqual(r.pages, 4);
  const rows = Object.fromEntries(r.found.map((x) => [x.page, x]));
  assert.deepStrictEqual(Object.keys(rows).sort(), ['features/a.html', 'journal/b.html', 'stores/area/sakae/izakaya.html']);
  assert.strictEqual(rows['features/a.html'].count, 3);
  assert.strictEqual(rows['features/a.html'].target, 'J000000002');
  assert.strictEqual(rows['journal/b.html'].count, 1);
  assert.strictEqual(rows['stores/area/sakae/izakaya.html'].slug, 'J000000001');
  assert.deepStrictEqual(r.kept, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('確かめて残すと決めた組は数えずに別枠へ。誘導先が変わった組は数え直す', () => {
  const root = site();
  const keep = { page: 'journal/b.html', slug: 'J000000001', target: 'J000000002', decision: 'keep', reason: '住所が別の店', issue: 'ISSUE-181' };
  const r = findStubLinks(root, { reviewed: [keep] });
  assert.ok(!r.found.some((x) => x.page === 'journal/b.html'));
  assert.deepStrictEqual(r.kept.map((x) => [x.page, x.slug, x.reason]), [['journal/b.html', 'J000000001', '住所が別の店']]);
  // 誘導先が記録と違えば数える
  const moved = findStubLinks(root, { reviewed: [Object.assign({}, keep, { target: 'J000000009' })] });
  assert.ok(moved.found.some((x) => x.page === 'journal/b.html'));
  // decision が keep でない記録は効かない
  const other = findStubLinks(root, { reviewed: [Object.assign({}, keep, { decision: 'undecided' })] });
  assert.ok(other.found.some((x) => x.page === 'journal/b.html'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('公開中のページに、確かめていない誘導ページへのリンクが無い', () => {
  const root = path.join(__dirname, '..');
  const { loadReviewed } = require('../scripts/audit_stub_links');
  const r = findStubLinks(root, { reviewed: loadReviewed(path.join(root, 'data', 'stub_link_reviewed.json')) });
  assert.deepStrictEqual(r.found, []);
});
