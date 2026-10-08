'use strict';
// SEO-136: IndexNow の送信対象を「前回送ってから内容が変わったハブ」と
// 「ページに出ている編集コメントが変わった店舗ページ」に広げることの検査
const test = require('node:test');
const assert = require('node:assert');
const I = require('../scripts/indexnow_ping');

const O = 'https://nagoya-bites.com';
const hub = (p, type, hash, updated = '2026-10-08', status = 'active') => ({ path: `stores/area/${p}`, type, contentHash: hash, updated, status });
const manifest = {
  pages: [
    hub('index.html', 'root', 'r1'),
    hub('meieki/izakaya-koshitsu.html', 'condition', 'c1', '2026-10-09'),
    hub('meieki/izakaya.html', 'genre', 'g1'),
    hub('meieki/index.html', 'area', 'a1'),
    hub('sakae/bar.html', 'genre', 'g2'),
    hub('sakae/bar-koshitsu.html', 'condition', 'c2', '2026-10-09', 'stub'),
    hub('sakae/missing.html', 'genre', 'g3'),
  ],
};
const exists = (rel) => !rel.includes('missing');

test('ハブ: 公開中で、前回送った contentHash と違うものだけ。前回送った日が古い順、同じなら索引→エリア→ジャンル→条件', () => {
  const state = {
    hubs: {
      'stores/area/index.html': { hash: 'r1', at: '2026-10-01' }, // 変わっていない
      'stores/area/sakae/bar.html': { hash: 'old', at: '2026-10-05' }, // 変わった・前回 10-05
      'stores/area/meieki/izakaya.html': { hash: 'old', at: '2026-10-02' }, // 変わった・前回 10-02
    },
    stores: {},
  };
  const t = I.hubTargets(manifest, state, exists);
  assert.deepStrictEqual(t.map((x) => x.key.replace('stores/area/', '')), [
    'meieki/index.html', // 未送信（前回なし）の中では エリア → 条件
    'meieki/izakaya-koshitsu.html',
    'meieki/izakaya.html', // 前回 10-02
    'sakae/bar.html', // 前回 10-05
  ]);
  assert.ok(!t.some((x) => x.key.includes('bar-koshitsu')), 'stub は送らない');
  assert.ok(!t.some((x) => x.key.includes('missing')), 'ファイルが無いページは送らない');
});

test('店舗ページ: 編集コメントがページに出ていて、前回送った文から変わったものだけ', () => {
  const stores = [
    { 店名: 'A', slug: 'a', editorReason: '業界人が通う「本物」の店 & 名店' },
    { 店名: 'B', slug: 'b', editorReason: 'ページには出ていない理由' },
    { 店名: 'C', slug: 'c', insiderNote: '送信済みと同じメモ' },
    { 店名: 'D', slug: 'd', editorReason: 'サイトマップに無い店' },
    { 店名: 'E', slug: 'e' }, // コメント無し
    { 店名: 'A2', slug: 'a', editorReason: '業界人が通う「本物」の店 & 名店' }, // 同じページを二重に数えない
  ];
  const pages = {
    'stores/a.html': '<p>業界人が通う「本物」の店 &amp; 名店</p>',
    'stores/b.html': '<p>別の本文</p>',
    'stores/c.html': '<p>送信済みと同じメモ</p>',
    'stores/d.html': '<p>サイトマップに無い店</p>',
  };
  const sitemapLocs = new Set(['a', 'b', 'c', 'e'].map((s) => `${O}/stores/${s}.html`));
  const first = I.storeTargets(stores, { hubs: {}, stores: {} }, { sitemapLocs, readPage: (k) => pages[k] || null, toSlug: (s) => s.slug });
  assert.deepStrictEqual(first.pending.map((x) => x.key), ['stores/a.html', 'stores/c.html']);
  assert.strictEqual(first.notOnPage, 1); // B はデータにあってもページに出ていない
  // c の文を送った記録があれば、c は対象から外れる
  const sigC = first.pending.find((x) => x.key === 'stores/c.html').sig;
  const again = I.storeTargets(stores, { hubs: {}, stores: { 'stores/c.html': { sig: sigC, at: '2026-10-08' } } }, { sitemapLocs, readPage: (k) => pages[k] || null, toSlug: (s) => s.slug });
  assert.deepStrictEqual(again.pending.map((x) => x.key), ['stores/a.html']);
});

test('店舗ページ: 同じ slug の2店目以降（-2・-3）は、h1 の店名でその店のページを探す', () => {
  const stores = [
    { 店名: '喫茶リヨン', slug: 'kissa', editorReason: 'リヨンの理由' },
    { 店名: '喫茶ユキ', slug: 'kissa', editorReason: 'ユキの理由' },
    { 店名: '喫茶マウンテン', slug: 'kissa', editorReason: 'ページの無い店の理由' },
  ];
  const pages = {
    'stores/kissa.html': '<h1>喫茶リヨン</h1><p>リヨンの理由</p>',
    'stores/kissa-2.html': '<h1>喫茶ユキ</h1><p>ユキの理由</p>',
  };
  const sitemapLocs = new Set(['kissa', 'kissa-2'].map((s) => `${O}/stores/${s}.html`));
  const opts = { sitemapLocs, readPage: (k) => pages[k] || null, toSlug: (s) => s.slug };
  assert.strictEqual(I.storePageFor(stores[1], opts).key, 'stores/kissa-2.html');
  const r = I.storeTargets(stores, { hubs: {}, stores: {} }, opts);
  assert.deepStrictEqual(r.pending.map((x) => x.key), ['stores/kissa-2.html', 'stores/kissa.html']);
  assert.strictEqual(r.notOnPage, 0); // マウンテンは h1 が当たらず基本のページ（リヨン）に落ち、二重に数えない
});

test('上限: トップ/索引 → ジャーナル → 店舗 → ハブの順に 200 件で止め、内訳を返す', () => {
  const many = { pages: Array.from({ length: 300 }, (_, i) => hub(`x/p${String(i).padStart(3, '0')}.html`, 'condition', `h${i}`)) };
  const stores = [{ 店名: 'A', slug: 'a', editorReason: '理由の文' }];
  const r = I.collectTargets({
    days: 0, now: Date.now(), state: { hubs: {}, stores: {} }, manifest: many, stores,
    sitemapLocs: new Set([`${O}/stores/a.html`]), readPage: () => '<p>理由の文</p>', exists: () => true, toSlug: (s) => s.slug,
  });
  assert.strictEqual(r.urls.length, I.MAX_URLS);
  assert.deepStrictEqual(r.urls.slice(0, 4), [`${O}/`, `${O}/journal/`, `${O}/features/`, `${O}/stores/a.html`]);
  assert.deepStrictEqual(r.breakdown.stores, { selected: 1, pending: 1, comment_not_on_page: 0 });
  assert.deepStrictEqual(r.breakdown.hubs, { selected: 196, pending: 300 });
  assert.strictEqual(r.sent.hubs.length, 196);
});

test('記録: 送った分だけを書き、公開中でなくなったハブの記録は消す', () => {
  const state = { hubs: { 'stores/area/old.html': { hash: 'z', at: '2026-09-01' }, 'stores/area/keep.html': { hash: 'k', at: '2026-10-01' } }, stores: {} };
  const sent = { hubs: [{ key: 'stores/area/new.html', hash: 'n' }], stores: [{ key: 'stores/a.html', sig: 's' }] };
  const next = I.recordSent(state, sent, '2026-10-09', new Set(['stores/area/new.html', 'stores/area/keep.html']));
  assert.deepStrictEqual(next.hubs, {
    'stores/area/keep.html': { hash: 'k', at: '2026-10-01' },
    'stores/area/new.html': { hash: 'n', at: '2026-10-09' },
  });
  assert.deepStrictEqual(next.stores, { 'stores/a.html': { sig: 's', at: '2026-10-09' } });
});

test('ページ本文の比較: 文字参照を戻し、空白をそろえる', () => {
  assert.strictEqual(I.pageText('<p>A &amp; B&#39;s\n  &quot;店&quot;</p>'), '<p>A & B\'s "店"</p>');
});
