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

test('readH1: 逃がして書かれた店名を元に戻して読み、& を含む店名でも孤児の誘導先に結べる', () => {
  assert.strictEqual(SO.readH1('<h1>ROCCA &amp; FRIENDS</h1>'), 'ROCCA & FRIENDS');
  assert.strictEqual(SO.readH1('<h1 class="x">TT&quot; a &lt;Store&gt; it&#39;s</h1>'), 'TT" a <Store> it\'s');
  // 二重に戻さない（&amp;lt; は &lt; のまま）
  assert.strictEqual(SO.readH1('<h1>A &amp;lt; B</h1>'), 'A &lt; B');
  assert.strictEqual(SO.readH1('<p>no h1</p>'), '');
  const r = SO.classifyOrphans({
    orphans: ['OLD'],
    activeNameBySlug: new Map([['NEW', 'Cafe & Bar ゆきっち']]),
    mergedKeptBySlug: {},
    manualNames: [],
    readName: () => SO.readH1('<h1>Cafe &amp; Bar ゆきっち</h1>'),
    linkedSlugs: new Set(),
  });
  assert.deepStrictEqual(r.redirect.OLD, { to: 'NEW', why: 'samename', name: 'Cafe & Bar ゆきっち' });
});

// 項目14: 孤児ページの noindex（非破壊・冪等・元に戻せる）
test('addOrphanNoindex: <head> に1行足し、何度かけても同じで、removeOrphanNoindex で元に戻る', () => {
  const html = '<!DOCTYPE html>\n<html><head>\n<meta charset="UTF-8">\n<title>店 | NAGOYA BITES</title>\n</head><body>x</body></html>\n';
  const once = SO.addOrphanNoindex(html);
  assert.ok(SO.isOrphanNoindexed(once));
  assert.match(once, /<meta name="robots" content="noindex,follow">/);
  assert.strictEqual(SO.addOrphanNoindex(once), once, '冪等');
  assert.strictEqual(SO.removeOrphanNoindex(once), html, '戻すと完全に元の内容');
  assert.strictEqual(SO.removeOrphanNoindex(html), html, '印が無ければ何もしない');
});

test('addOrphanNoindex: 既に noindex の案内ページと誘導ページ以外の入力は触らない', () => {
  const notice = '<head><meta name="robots" content="noindex"><title>x</title></head>';
  assert.strictEqual(SO.addOrphanNoindex(notice), notice);
  const noTitle = '<head><meta charset="utf-8"></head>';
  assert.ok(SO.addOrphanNoindex(noTitle).includes('nb-orphan-noindex'));
  assert.strictEqual(SO.removeOrphanNoindex(SO.addOrphanNoindex(noTitle)), noTitle);
});
