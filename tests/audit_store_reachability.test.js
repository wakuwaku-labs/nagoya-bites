'use strict';

/**
 * I-25（判断の記録 0039）: トップから店舗ページまで、リンクを何回たどれば着くかを数える監査の判定。
 * 実際のツリーは読まない（生成済みのページは CI が npm test の後に作り直す）。小さな偽のツリーで、
 * 深さ・誘導ページの除外・掲載外の孤児・トップだけの差し替えを確かめる。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const audit = require('../scripts/audit_store_reachability');
const { listPublishedPages } = require('../scripts/lib/published_pages');
const { renderRedirectStub } = require('../scripts/lib/store_orphans');

const page = (links, title = 'x') => `<!doctype html><html lang="ja"><head><title>${title}</title></head><body>${links.map((h) => `<a href="${h}">l</a>`).join('')}</body></html>`;

function writeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-'));
  for (const [rel, html] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, html);
  }
  return root;
}

// トップ → 一覧の入口と店 J001 / 入口 → エリア → 店 J002・J003（J002 は似た店 J004 へ）/ J005 は誰からもリンクされない
// J006 は J002 への誘導ページ（古い ID・J001 からリンクされる）/ J007 は掲載から外れた店の孤児ページで、J001 から 1 本リンクされる
const FILES = {
  'index.html': page(['stores/area/index.html', 'stores/J001.html', 'features/a.html']),
  'stores/area/index.html': page(['meieki/index.html', '../../index.html']),
  'stores/area/meieki/index.html': page(['../../J002.html', '../../J003.html#card', 'https://nagoya-bites.com/stores/J003.html', '../../../index.html']),
  'stores/J001.html': page(['../index.html', 'J007.html', 'J006.html']),
  'stores/J002.html': page(['J004.html', '../index.html?utm=1']),
  'stores/J003.html': page([]),
  'stores/J004.html': page(['J002.html']),
  'stores/J005.html': page(['J002.html']),
  'stores/J006.html': renderRedirectStub('J002', '店'),
  'stores/J007.html': page([]),
  'features/a.html': page(['../stores/J003.html', 'https://example.com/stores/J005.html', 'mailto:a@example.com', '#top']),
};
const PUBLIC = new Set(['J001', 'J002', 'J003', 'J004', 'J005'].map((id) => `stores/${id}.html`));

test('resolveHref: 相対・サイトの絶対 URL・ディレクトリ・ハッシュと検索語つきを、公開ページのパスにする。外のリンクは対象外', () => {
  const r = audit.resolveHref;
  assert.equal(r('index.html', 'stores/area/index.html'), 'stores/area/index.html');
  assert.equal(r('stores/area/meieki/index.html', '../../J001.html'), 'stores/J001.html');
  assert.equal(r('stores/area/meieki/index.html', '../../../index.html#q=x'), 'index.html');
  assert.equal(r('features/a.html', '../'), 'index.html');
  assert.equal(r('features/a.html', './'), 'features/index.html');
  assert.equal(r('index.html', 'stores/area/'), 'stores/area/index.html');
  assert.equal(r('index.html', 'https://nagoya-bites.com'), 'index.html');
  assert.equal(r('index.html', 'https://www.nagoya-bites.com/features/?a=1'), 'features/index.html');
  assert.equal(r('stores/J1.html', 'J2.html?utm=1#a'), 'stores/J2.html');
  for (const h of ['https://example.com/x', '//example.com/x', '#top', 'mailto:a@example.com', 'tel:0000', 'javascript:void(0)', '?x=1', '']) {
    assert.equal(r('index.html', h), null, h);
  }
});

test('bfsDepths: 最短の回数。届かないページは入らない。ループがあっても止まる', () => {
  const adj = new Map([
    ['index.html', new Set(['a', 'b'])],
    ['a', new Set(['c', 'index.html'])],
    ['b', new Set(['c'])],
    ['c', new Set(['d', 'a'])],
    ['d', new Set()],
    ['z', new Set(['a'])],
  ]);
  const d = audit.bfsDepths(adj);
  assert.deepEqual([...d.entries()], [['index.html', 0], ['a', 1], ['b', 1], ['c', 2], ['d', 3]]);
  assert.ok(!d.has('z'));
});

test('distribution: 深さの小さい順・届かないは最後。キーのない深さは出さない', () => {
  const depth = new Map([['p1', 3], ['p2', 1], ['p3', 3], ['p4', 10]]);
  const d = audit.distribution(['p1', 'p2', 'p3', 'p4', 'p5'], depth);
  assert.deepEqual(Object.entries(d), [['1', 1], ['3', 2], ['10', 1], ['unreachable', 1]]);
});

test('summarize: 誘導ページは数えない。掲載外の孤児は「掲載中の店」に入れない。届かない掲載中の店を出す', () => {
  const root = writeTree(FILES);
  const pages = listPublishedPages({ root });
  const graph = audit.buildGraph(pages);
  assert.deepEqual([...graph.stubs], ['stores/J006.html'], '誘導ページの判定はファイルそのもの');
  const r = audit.summarize(pages, graph, PUBLIC);
  // 現役: J001〜J005・J007 の 6 本（誘導ページ J006 は除く）
  assert.equal(r.activeStorePages, 6);
  assert.equal(r.publicStorePages, 5);
  // J001: トップが直接リンク＝1 / J003: トップ → 特集 → 店＝2 / J002: トップ → 入口 → エリア → 店＝3 / J004: J002 の似た店＝4
  assert.deepEqual(r.depthOfPublicStorePages, { 1: 1, 2: 1, 3: 1, 4: 1, unreachable: 1 });
  assert.deepEqual(r.unreachablePublic, ['stores/J005.html'], 'J005 は J002 へはリンクするが、誰からもリンクされない');
  // 孤児 J007 は J001 からリンクされる（深さ 2）。全体では届かないのは J005 だけ
  assert.deepEqual(r.depthOfActiveStorePages, { 1: 1, 2: 2, 3: 1, 4: 1, unreachable: 1 });
  assert.deepEqual(r.otherPagesDepthByType.feature, { 1: 1 });
  assert.deepEqual(r.otherPagesDepthByType.hub, { 1: 1, 2: 1 });
});

test('buildGraph: トップだけ別の版に差し替えて数えられる（置き換えの前後を同じ道具で比べる）', () => {
  const root = writeTree(FILES);
  const oldTop = path.join(root, 'old-top.html');
  // 前のトップは、掲載中の全店へ直接リンクしていた
  fs.writeFileSync(oldTop, page([...PUBLIC].map((p) => p)));
  const pages = listPublishedPages({ root });
  const before = audit.summarize(pages, audit.buildGraph(pages, { topFile: oldTop }), PUBLIC);
  const after = audit.summarize(pages, audit.buildGraph(pages), PUBLIC);
  assert.deepEqual(before.depthOfPublicStorePages, { 1: 5 });
  assert.equal(before.unreachablePublic.length, 0);
  assert.deepEqual(after.depthOfPublicStorePages, { 1: 1, 2: 1, 3: 1, 4: 1, unreachable: 1 });
  assert.equal(after.unreachablePublic.length, 1, '置き換えで届かなくなる店が出ることを、数字で見られる');
});

test('CLI: --top-file が実在しないときは、数えずに終了コード 2', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'audit_store_reachability.js'), '--top-file', path.join(os.tmpdir(), 'no-such-top-file.html')], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--top-file/);
});
