'use strict';
const test = require('node:test');
const assert = require('node:assert');
const SO = require('../scripts/lib/store_orphans');

const active = new Map([['J1', 'とん八 栄店'], ['J2', 'カフェ 温'], ['J3', 'カフェ 温']]);
const names = { A: 'とん八 栄店', B: '旧店', C: '矢場とん 本店', D: 'カフェ 温', E: '閉店した店', F: '店 X' };

test('classifyOrphans: 統合・同名・保留・内部リンク・削除を分ける', () => {
  const r = SO.classifyOrphans({
    orphans: ['M', 'A', 'B', 'C', 'D', 'E', 'F'],
    activeNameBySlug: active,
    mergedKeptBySlug: { M: 'J2', B: 'GONE' },
    manualNames: ['矢場とん 本店'],
    readName: s => names[s] || '',
    linkedSlugs: new Set(['F']),
  });
  assert.deepStrictEqual(r.redirect.M, { to: 'J2', why: 'merge', name: 'カフェ 温' });
  assert.strictEqual(r.redirect.A.to, 'J1');
  assert.ok(!r.redirect.D, '同名が複数の現役店に当たるときは誘導しない');
  assert.deepStrictEqual(r.hold.sort(), ['C', 'F']);
  assert.deepStrictEqual(r.delete.sort(), ['B', 'D', 'E']);
});

test('誘導ページは判別でき、誘導先を取り出せる', () => {
  const h = SO.renderRedirectStub('J1', 'とん八');
  assert.ok(SO.isRedirectStub(h));
  assert.strictEqual(SO.stubTarget(h), 'J1');
  assert.ok(h.includes('rel="canonical" href="https://nagoya-bites.com/stores/J1.html"'));
  assert.ok(h.includes('http-equiv="refresh"'));
  assert.ok(!SO.isRedirectStub('<html></html>'));
});
