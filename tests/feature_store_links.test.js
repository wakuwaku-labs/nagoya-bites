'use strict';
// 特集の店カード → 店舗ページのリンク漏れ 0 と、店一覧の構造化データ（ItemList）の url が
// 実在する店舗ページを指すことを守る。変換は scripts/link_feature_store_cards.js（冪等・通信なし）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES = path.join(ROOT, 'features');
const { loadStores } = require('../scripts/lib/load_stores');
const { listCards, buildStrictResolver, storeSlug, livePage, listItemListBlocks } = require('../scripts/lib/feature_card_links');
const { processHtml } = require('../scripts/link_feature_store_cards');
const { featureStoreOnclick } = require('../scripts/lib/feature_tracking');

const ctx = { resolve: buildStrictResolver(loadStores()), root: ROOT };
const files = fs.readdirSync(FEATURES).filter((f) => f.endsWith('.html') && f !== 'index.html');

test('店舗ページが実在する店カードは、特集からそのページへリンクしている（結べる店のリンク漏れ 0）', () => {
  const leaks = [];
  for (const f of files) {
    const html = fs.readFileSync(path.join(FEATURES, f), 'utf8');
    for (const c of listCards(html)) {
      if (c.linkedSlug) continue;
      const store = ctx.resolve(c.name);
      if (store && livePage(ROOT, storeSlug(store))) leaks.push(`${f}: ${c.name}`);
    }
  }
  assert.deepEqual(leaks, []);
});

test('変換は冪等で、今の特集に直す物が残っていない', () => {
  for (const f of files) {
    const html = fs.readFileSync(path.join(FEATURES, f), 'utf8');
    const r = processHtml(html, f.replace(/\.html$/, ''), ctx);
    assert.equal(r.html === html, true, `${f} にまだ直す物がある`);
  }
});

test('ItemList の url は、実在する店舗ページ（誘導ページでない）だけを指す', () => {
  let withUrl = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(FEATURES, f), 'utf8');
    for (const b of listItemListBlocks(html)) {
      const json = JSON.parse(b.body);
      for (const it of json.itemListElement || []) {
        if (!it.url) continue;
        withUrl++;
        const m = it.url.match(/^https:\/\/nagoya-bites\.com\/stores\/([^/]+)\.html$/);
        assert.ok(m, `${f}: 店舗ページの URL ではない ${it.url}`);
        assert.ok(livePage(ROOT, m[1]), `${f}: 実在しない・誘導ページ ${it.url}`);
      }
    }
  }
  assert.ok(withUrl > 0);
});

test('ItemList の全項目が url を持つ（店舗ページの無い店だけの例外を除く）', () => {
  // 店舗ページに結べる店が無い項目（新店など）は url を付けない。例外は店名で明示し、増えたら気づく
  const allowed = new Set(['nagoya-kaoawase-washoku:日本料理 旬彩']);
  const missing = [];
  for (const f of files) {
    const html = fs.readFileSync(path.join(FEATURES, f), 'utf8');
    for (const b of listItemListBlocks(html)) {
      for (const it of JSON.parse(b.body).itemListElement || []) {
        if (!it.url && !allowed.has(`${f.replace(/\.html$/, '')}:${it.name}`)) missing.push(`${f}: ${it.name}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('ItemList の url は、同じページの店カードのリンク先と一致する（画面にない店を載せない）', () => {
  for (const f of files) {
    const html = fs.readFileSync(path.join(FEATURES, f), 'utf8');
    const cards = listCards(html);
    if (!cards.length) continue;
    const linked = new Set(cards.map((c) => c.linkedSlug).filter(Boolean));
    for (const b of listItemListBlocks(html)) {
      for (const it of JSON.parse(b.body).itemListElement || []) {
        if (!it.url) continue;
        const slug = it.url.match(/stores\/([^/]+)\.html$/)[1];
        // 店カードの無い形の特集（リスト形式）は対象外。店カードがあるページは、載せた店が画面に出ている
        assert.ok(linked.has(slug), `${f}: ItemList の ${it.name} が画面の店カードに無い`);
      }
    }
  }
});

test('結べない店（店舗ページが無い）にはリンクを足さない', () => {
  const html = `<div class="store-list">
      <div class="store-card">
        <div class="store-info">
          <h3 class="store-name">実在しない新店テスト 名古屋店</h3>
          <p class="store-desc">説明</p>
        </div>
      </div>
    </div>`;
  const r = processHtml(html, 'x', ctx);
  assert.equal(r.html, html);
  assert.equal(r.linkSkipped.length, 1);
});

test('同じ看板の別支店・語の一部だけ一致する別の店には結ばない', () => {
  const stores = [{ 店名: '日本料理 旬彩', ホットペッパーID: 'J900000001' }, { 店名: '旬彩倶楽部 鱗', ホットペッパーID: 'J900000002' }, { 店名: '炉端焼き 燻銀 栄店', ホットペッパーID: 'J900000003' }, { 店名: '炉端焼き 燻銀 金山店', ホットペッパーID: 'J900000004' }];
  const resolve = buildStrictResolver(stores);
  assert.equal(resolve('旬彩'), null, '先頭一致は店名が1店だけに絞れるときだけ。「旬彩」は2店に当たる');
  assert.equal(resolve('炉端焼き 燻銀'), null, '支店名のない看板だけでは結ばない');
  assert.equal(resolve('炉端焼き 燻銀 栄店').店名, '炉端焼き 燻銀 栄店');
  assert.equal(resolve('日本料理旬彩').店名, '日本料理 旬彩');
});

test('追加するリンクは、計測の流儀（feature_store_click・店の値は ID）と同じ文字列', () => {
  const store = loadStores().find((s) => /^J\d+$/.test(s['ホットペッパーID'] || '') && livePage(ROOT, s['ホットペッパーID']));
  const html = `<div class="store-list">
      <div class="store-card">
        <div class="store-info">
          <h3 class="store-name">${store['店名']}</h3>
          <p class="store-desc">説明</p>
        </div>
      </div>
    </div>`;
  const r = processHtml(html, 'nagoya-test', ctx);
  const id = store['ホットペッパーID'];
  if (r.linked.length === 1) {
    assert.ok(r.html.includes(`href="https://nagoya-bites.com/stores/${id}.html"`));
    assert.ok(r.html.includes(`onclick="${featureStoreOnclick(id, 'nagoya-test')}"`));
  }
});

test('月次の店入れ替えの ItemList 置換は、空白・改行の入った書き方も扱う', () => {
  const { replaceItemList } = require('../scripts/refresh_feature_rosters');
  const list = [{ store: { 店名: 'テスト店', ホットペッパーID: 'J000000001' } }];
  for (const src of [
    '<script type="application/ld+json">{"@context": "https://schema.org", "@type": "ItemList", "name": "n", "numberOfItems": 9, "itemListElement": [{"@type": "ListItem", "position": 1, "name": "古い店"}]}</script>',
    '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "ItemList",\n  "numberOfItems": 9,\n  "itemListElement": [\n    {"@type":"ListItem","position":1,"name":"古い店"}\n  ]\n}\n</script>',
  ]) {
    const out = replaceItemList(src, list);
    assert.ok(out.includes('"name":"テスト店","url":"https://nagoya-bites.com/stores/J000000001.html"'), out);
    assert.ok(!out.includes('古い店'));
    assert.match(out, /"numberOfItems"\s*:\s*1/);
    JSON.parse(out.replace(/<\/?script[^>]*>/g, ''));
  }
});
