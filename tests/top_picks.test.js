'use strict';
/**
 * tests/top_picks.test.js — I-24（P-399）トップの「今日の話題店」「よく見られている店」を描く部品
 * （scripts/lib/top_picks.js）と、index.html の区画へ書く生成器（scripts/build_top_picks.js）。
 *
 * 確かめること:
 *   1. 注目の理由は「検算できる事実」だけ（別サイトの数・確認した日）。作れない部分は出さない
 *   2. 選定の 1 件を店舗データに結ぶ（店名が 1 件ならそれ・複数ならエリア・決められなければ出さずに理由を返す）
 *      ＝ build.js の焼き込みが落としていた「小菜一碟」（エリア表記が違う）も拾える
 *   3. 店舗ページへのリンクは、ページの h1 が本人の店名のときだけ。誘導ページは辿り、確かめられなければ #q= に落とす
 *   4. 1 枚のカード: 文字を逃がす・客の写真には撮影者を出す・写真が無ければ「写真準備中」
 *   5. 写真の URL: index.html の nbImage / nbSrcset と同じ規則（同じ入力で突き合わせる）。Google の写真だけ大きさを指定し直す
 *   6. よく見られている店は、閲覧数の下限にそろわなければ区画ごと出さない
 *   7. 生成器は目印の間だけを書き換え、2 回続けても同じ（冪等）。目印が無ければ警告に出す
 *
 * 注意: 「いまの index.html の区画が、いまのデータと同じ」ことは検査しない。routine の PR（話題店の発掘など）は
 * data/ だけを変えて index.html を作り直さないため、検査すると自動マージが止まる。作り直しは build.js が毎日行う。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const TP = require('../scripts/lib/top_picks.js');
const BTP = require('../scripts/build_top_picks.js');
const { renderRedirectStub } = require('../scripts/lib/store_orphans.js');

const ROOT = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── 1. 出典の別サイト数・確認した日・理由の行 ───────────────────────────
test('siteOf: 登録ドメインに丸める（ssl.tabelog.com と tabelog.com は同じサイト）', () => {
  assert.strictEqual(TP.siteOf('https://tabelog.com/aichi/A2301/A230101/23000001/'), 'tabelog.com');
  assert.strictEqual(TP.siteOf('https://ssl.tabelog.com/x'), 'tabelog.com');
  assert.strictEqual(TP.siteOf('https://www.retty.me/area/PRE23/'), 'retty.me');
  assert.strictEqual(TP.siteOf('https://example.co.jp/a'), 'example.co.jp');
  assert.strictEqual(TP.siteOf('https://news.example.co.jp/a'), 'example.co.jp', 'co.jp は 3 つで丸める');
  assert.strictEqual(TP.siteOf('https://a.b.example.com/x'), 'example.com');
});

test('siteOf: URL でないもの・http(s) 以外・ドットの無いホストは空', () => {
  for (const bad of ['', 'not a url', 'ftp://example.com/x', 'javascript:alert(1)', 'http://localhost/x', null, undefined, 42]) {
    assert.strictEqual(TP.siteOf(bad), '', String(bad));
  }
});

test('sourceSites: 別サイトの数だけ数える（同じサイトは 1 つ・URL でないものは数えない）', () => {
  const urls = ['https://tabelog.com/a', 'https://ssl.tabelog.com/b', 'https://retty.me/c', 'junk', ''];
  assert.strictEqual(TP.sourceSites(urls).length, 2);
  assert.strictEqual(TP.sourceSites([]).length, 0);
});

test('addDays / shortDate: 暦の計算（月またぎ・年またぎ）と、読めない日付は空', () => {
  assert.strictEqual(TP.addDays('2026-10-13', -9), '2026-10-04');
  assert.strictEqual(TP.addDays('2026-10-01', -1), '2026-09-30');
  assert.strictEqual(TP.addDays('2026-01-01', -1), '2025-12-31');
  assert.strictEqual(TP.addDays('2026-10-13', 0), '2026-10-13');
  assert.strictEqual(TP.addDays('bad', 1), '');
  assert.strictEqual(TP.shortDate('2026-10-05'), '10/5');
  assert.strictEqual(TP.shortDate('2026-12-31'), '12/31');
  assert.strictEqual(TP.shortDate('x'), '');
});

test('reasonFor: 作れない部分は出さない。両方作れなければ空（根拠の無い語は書かない）', () => {
  assert.strictEqual(TP.reasonFor({ siteCount: 2, detectedOn: '2026-10-05' }), '2サイトで紹介・10/5に確認');
  assert.strictEqual(TP.reasonFor({ siteCount: 1, detectedOn: '' }), '1サイトで紹介');
  assert.strictEqual(TP.reasonFor({ siteCount: 0, detectedOn: '2026-10-05' }), '10/5に確認');
  assert.strictEqual(TP.reasonFor({ siteCount: 0, detectedOn: '' }), '');
  for (const text of [TP.reasonFor({ siteCount: 3, detectedOn: '2026-10-04' })]) {
    assert.ok(!/人気|話題沸騰|媒体|注目度|スコア/.test(text), '検算できない語を使わない: ' + text);
  }
});

// ── 2. 選定の 1 件 → 店舗データ ─────────────────────────────────────────
test('resolvePickStore: 店名が 1 件ならエリア表記が違っても結ぶ（build.js の焼き込みが落としていた小菜一碟）', () => {
  const stores = [{ 店名: '小菜一碟', エリア: '東区・相生町' }, { 店名: '別の店', エリア: '栄' }];
  const r = TP.resolvePickStore({ 店名: '小菜一碟', エリア: '名古屋市東区相生町' }, stores);
  assert.strictEqual(r.store, stores[0]);
  assert.strictEqual(r.why, '');
});

test('resolvePickStore: 同名が複数ならエリアが合う 1 件、決められなければ null と理由（黙って落とさない）', () => {
  const a = { 店名: 'まるや', エリア: '栄' }, b = { 店名: 'まるや', エリア: '大須' };
  assert.strictEqual(TP.resolvePickStore({ 店名: 'まるや', エリア: '大須' }, [a, b]).store, b);
  const un = TP.resolvePickStore({ 店名: 'まるや', エリア: '名駅' }, [a, b]);
  assert.strictEqual(un.store, null);
  assert.ok(/2 件/.test(un.why), un.why);
  const none = TP.resolvePickStore({ 店名: 'ない店', エリア: '栄' }, [a, b]);
  assert.strictEqual(none.store, null);
  assert.ok(none.why.length > 0);
  assert.strictEqual(TP.resolvePickStore({}, [a]).store, null);
  assert.strictEqual(TP.resolvePickStore(null, [a]).store, null);
  // 店名の無い選定が、店名の無いレコードと「どちらも undefined」で結ばれない
  assert.strictEqual(TP.resolvePickStore({ エリア: '栄' }, [{ エリア: '栄' }]).store, null);
  assert.strictEqual(TP.resolvePickStore({ 店名: '' }, [{ 店名: '' }]).store, null);
});

test('collectSourceUrls: 同名が複数のときはエリアが合う記録だけ（別の店の出典を混ぜない）', () => {
  const trending = [
    { 店名: 'まるや', エリア: '栄', 出典URL: ['https://tabelog.com/a'] },
    { 店名: 'まるや', エリア: '大須', 出典URL: ['https://retty.me/b'] },
    { 店名: '一軒', 出典URL: ['https://hamoni.jp/c', 'https://ikyu.com/d'] },
    { 店名: '壊れた', 出典URL: 'not-an-array' },
  ];
  const manual = [{ 店名: '一軒', 出典URL: ['https://tabelog.com/e'] }];
  assert.deepStrictEqual(TP.collectSourceUrls('まるや', '大須', [trending, manual]), ['https://retty.me/b']);
  assert.deepStrictEqual(TP.collectSourceUrls('まるや', '名駅', [trending, manual]), []);
  assert.deepStrictEqual(TP.collectSourceUrls('一軒', '', [trending, manual]), ['https://hamoni.jp/c', 'https://ikyu.com/d', 'https://tabelog.com/e']);
  assert.deepStrictEqual(TP.collectSourceUrls('壊れた', '', [trending]), []);
  assert.deepStrictEqual(TP.collectSourceUrls('一軒', '', undefined), []);
});

// ── 3. 店舗ページへのリンク ─────────────────────────────────────────────
function pages(map) { return (slug) => (Object.prototype.hasOwnProperty.call(map, slug) ? map[slug] : null); }
const h1 = (name) => `<html><body><h1>${name}</h1></body></html>`;

test('resolvePageHref: ページの h1 が本人の店名なら、そのページへ', () => {
  const href = TP.resolvePageHref({ 店名: '小菜一碟' }, { toSlug: () => 'abc', readPage: pages({ abc: h1('小菜一碟') }) });
  assert.strictEqual(href, 'stores/abc.html');
});

test('resolvePageHref: スラグが重なって -2 になった店は、h1 で本人のページを選ぶ', () => {
  const href = TP.resolvePageHref({ 店名: 'B店' }, { toSlug: () => 'x', readPage: pages({ x: h1('A店'), 'x-2': h1('B店') }) });
  assert.strictEqual(href, 'stores/x-2.html');
});

test('resolvePageHref: 誘導ページ（古い ID）は誘導先を辿る。辿った先が別の店なら使わない', () => {
  const stub = renderRedirectStub('new-slug', '小菜一碟');
  const ok = TP.resolvePageHref({ 店名: '小菜一碟' }, { toSlug: () => 'old', readPage: pages({ old: stub, 'new-slug': h1('小菜一碟') }) });
  assert.strictEqual(ok, 'stores/new-slug.html');
  const other = TP.resolvePageHref({ 店名: '小菜一碟' }, { toSlug: () => 'old', readPage: pages({ old: stub, 'new-slug': h1('別の店') }) });
  assert.strictEqual(other, 'index.html#q=' + encodeURIComponent('小菜一碟'));
});

test('resolvePageHref: 誘導ページが自分自身・循環を指していても止まる', () => {
  const loop = renderRedirectStub('loop', 'x');
  const href = TP.resolvePageHref({ 店名: 'x' }, { toSlug: () => 'loop', readPage: pages({ loop }) });
  assert.strictEqual(href, 'index.html#q=x');
});

test('resolvePageHref: 確かめられなければ検索のディープリンク（店名は URL の形に逃がす）', () => {
  const href = TP.resolvePageHref({ 店名: 'A & B/店' }, { toSlug: () => 'none', readPage: pages({}) });
  assert.strictEqual(href, 'index.html#q=' + encodeURIComponent('A & B/店'));
  assert.ok(!href.includes(' ') && !href.includes('&B'));
});

test('resolvePageHref: 店名の「&」は h1 の &amp; に直して比べる', () => {
  const href = TP.resolvePageHref({ 店名: 'A & B' }, { toSlug: () => 's', readPage: pages({ s: h1('A &amp; B') }) });
  assert.strictEqual(href, 'stores/s.html');
});

test('areaLabel / genreLabel: 先頭の「名古屋市」を外す・ジャンルは最初の区切りまで', () => {
  assert.strictEqual(TP.areaLabel({ エリア: '名古屋市中区丸の内' }), '中区丸の内');
  assert.strictEqual(TP.areaLabel({ エリア: '東区・相生町' }), '東区・相生町');
  assert.strictEqual(TP.areaLabel({}), '');
  assert.strictEqual(TP.genreLabel({ ジャンル: 'カフェ・ベーカリー' }), 'カフェ');
  assert.strictEqual(TP.genreLabel({ ジャンル: '寿司' }), '寿司');
  assert.strictEqual(TP.genreLabel({}), '');
});

// ── 4. 1 枚のカード ─────────────────────────────────────────────────────
const model = (over) => Object.assign({
  name: 'テスト店', area: '中区', areaRaw: '名古屋市中区', genre: '寿司', href: 'stores/t.html',
  photo: 'https://imgfp.hotp.jp/IMGH/1/2/P0/P0_480.jpg', credit: '', reason: '2サイトで紹介・10/5に確認', eager: true,
}, over);

test('renderCard: 実リンク・店名の属性・理由の行は「・」の後だけで折り返せる', () => {
  const html = TP.renderCard(model(), 'trend_today');
  assert.ok(html.includes('<a class="tp-card" href="stores/t.html" data-store="テスト店" data-area="名古屋市中区" data-source="trend_today">'));
  assert.ok(html.includes('<span class="tp-name">テスト店</span>'));
  assert.ok(html.includes('<span class="tp-reason"><span>2サイトで紹介</span>・<span>10/5に確認</span></span>'));
  assert.ok(html.includes('alt="テスト店"'), 'alt は店名（写真が切れたとき店ごとの面に差し替える処理が店名で探す）');
  assert.ok(!html.includes('loading="lazy"'), '先頭の数枚は遅延させない');
  assert.ok(TP.renderCard(model({ eager: false }), 'ranking').includes('loading="lazy"'));
});

test('renderCard: 店名・エリア・理由に HTML の記号が入っても逃がす', () => {
  const html = TP.renderCard(model({ name: '<b>"A"&\'B\'</b>', area: '<i>x</i>', reason: '1サイトで紹介<script>' }), 'trend_today');
  assert.ok(!/<b>|<i>|<script>/.test(html), html);
  assert.ok(html.includes('&lt;b&gt;&quot;A&quot;&amp;&#39;B&#39;&lt;/b&gt;'));
});

test('renderCard: 客が投稿した写真には撮影者を出す（&amp; は戻してから 1 回だけ逃がす）。ない写真は「写真準備中」', () => {
  const store = { 店名: 'S', エリア: '栄', ジャンル: '和食', 写真URL: 'https://lh3.googleusercontent.com/place-photos/abc=s1600-w1200', 写真出所: 'places-user', 写真クレジット: '世界のユウイチロウ&amp;co' };
  const html = TP.renderCard(TP.cardModel(store, { href: 'stores/s.html', reason: '', eager: true }), 'trend_today');
  assert.ok(html.includes('📷 世界のユウイチロウ&amp;co</span>'), html);
  assert.ok(!html.includes('&amp;amp;'), '二重に逃がさない');
  const owner = TP.renderCard(TP.cardModel(Object.assign({}, store, { 写真出所: 'places-owner' }), { href: 'x', reason: '', eager: true }), 'trend_today');
  assert.ok(!owner.includes('photo-credit'), 'オーナーが載せた写真にはクレジットを出さない');
  const none = TP.renderCard(model({ photo: '' }), 'trend_today');
  assert.ok(none.includes('<span class="tp-none" aria-hidden="true">写真準備中</span>'));
  assert.ok(!none.includes('<img'));
});

test('renderCard: 理由が空ならその行を出さない', () => {
  assert.ok(!TP.renderCard(model({ reason: '' }), 'trend_today').includes('tp-reason'));
});

// ── 5. 写真の URL ───────────────────────────────────────────────────────
function nbFns() {
  const names = ['nbImage', 'nbSrcset'];
  const ctx = vm.createContext({});
  const cdn = INDEX.match(/\nvar NB_IMG_CDN="[^"]+";/);
  assert.ok(cdn, 'index.html の NB_IMG_CDN の定義が見つからない');
  vm.runInContext(cdn[0], ctx);
  for (const n of names) {
    const head = '\nfunction ' + n + '(';
    assert.strictEqual(INDEX.split(head).length - 1, 1, n + ' は 1 つだけ');
    const a = INDEX.indexOf(head) + 1;
    const b = INDEX.indexOf('\n}\n', a);
    vm.runInContext(INDEX.slice(a, b + 2), ctx);
  }
  return ctx;
}

test('nbImage / nbSrcset: 部品の写しが index.html の関数と、実データの全 URL で同じ結果になる', () => {
  const ctx = nbFns();
  const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
  const urls = new Set(['', null, undefined, 'data:image/png;base64,AAAA', '/assets/x.jpg', 'https://wsrv.nl/?url=x&w=10',
    'https://imgfp.hotp.jp/IMGH/1/2/P0/P0.jpg', 'https://imgfp.hotp.jp/IMGH/1/2/P0/P0_238.jpg?x=1', 'http://example.com/a.jpg',
    'https://lh3.googleusercontent.com/place-photos/abc=s1600-w1200']);
  for (const s of stores) if (s['写真URL']) urls.add(s['写真URL']);
  assert.ok(urls.size > 100, '実データの URL を読めている: ' + urls.size);
  // 変わった URL（データに紛れた不正な文字など）で両方が同じように例外を出す場合も「同じ結果」と数える
  const run = (fn) => { try { return { value: fn() }; } catch (e) { return { error: e.name }; } };
  for (const u of urls) {
    for (const w of [280, 560, undefined]) assert.deepStrictEqual(run(() => TP.nbImage(u, w)), run(() => ctx.nbImage(u, w)), `nbImage ${u} ${w}`);
    assert.deepStrictEqual(run(() => TP.nbSrcset(u, [280, 560])), run(() => ctx.nbSrcset(u, [280, 560])), `nbSrcset ${u}`);
  }
});

test('googleSized: Google マップの写真 CDN の末尾の大きさの指定だけ差し替える。ほかの URL は触らない', () => {
  const base = 'https://lh3.googleusercontent.com/place-photos/AO7kbWFn0NA4BoS2fVTvVFLbpLYQd31oH-s_9';
  assert.strictEqual(TP.googleSized(base + '=s1600-w1200', 480), base + '=w480');
  assert.strictEqual(TP.googleSized(base + '=w400', 480), base + '=w480');
  assert.strictEqual(TP.googleSized(base + '=s0', 320), base + '=w320');
  assert.strictEqual(TP.googleSized('https://lh3.googleusercontent.com/grass-cs/AAB=s1600-w1200', 480), 'https://lh3.googleusercontent.com/grass-cs/AAB=w480');
  for (const same of [base, 'https://imgfp.hotp.jp/IMGH/1/2/P0/P0.jpg', 'http://lh3.googleusercontent.com/x=s1', 'https://example.com/lh3.googleusercontent.com/x=s1', '', 'data:image/png;base64,AAAA']) {
    assert.strictEqual(TP.googleSized(same, 480), same, same);
  }
  assert.strictEqual(TP.googleSized(undefined, 480), '');
});

test('cardImage: Google の写真は幅を指定し直し（src=w480・srcset=w320/w480）、ほかは index.html と同じ規則', () => {
  const g = TP.cardImage('https://lh3.googleusercontent.com/place-photos/abc=s1600-w1200');
  assert.strictEqual(g.src, 'https://lh3.googleusercontent.com/place-photos/abc=w480');
  assert.strictEqual(g.srcset, 'https://lh3.googleusercontent.com/place-photos/abc=w320 320w, https://lh3.googleusercontent.com/place-photos/abc=w480 480w');
  const hp = 'https://imgfp.hotp.jp/IMGH/1/2/P0/P0_238.jpg';
  const o = TP.cardImage(hp);
  assert.strictEqual(o.src, TP.nbImage(hp, 560));
  assert.strictEqual(o.srcset, TP.nbSrcset(hp, [280, 560]));
  assert.ok(o.src.startsWith('https://wsrv.nl/'));
});

// ── 今日の話題店 ────────────────────────────────────────────────────────
function trendInput(over) {
  const stores = [
    { 店名: '小菜一碟', エリア: '東区・相生町', ジャンル: '四川料理', 写真URL: 'https://lh3.googleusercontent.com/place-photos/a=s1600-w1200', 写真出所: 'places-owner' },
    { 店名: 'ゆみちの店', エリア: '名駅南', ジャンル: 'カフェ（ベーカリー）', 写真URL: 'https://lh3.googleusercontent.com/place-photos/b=s1600-w1200', 写真出所: 'places-user', 写真クレジット: 'ゆみち' },
    { 店名: 'まるや', エリア: '栄', ジャンル: '居酒屋' },
    { 店名: 'まるや', エリア: '大須', ジャンル: '居酒屋' },
  ];
  const picks = [
    { 順位: 1, 店名: '小菜一碟', エリア: '名古屋市東区相生町', 鮮度日数: 8 },
    { 順位: 2, 店名: 'ゆみちの店', エリア: '名駅南', 鮮度日数: 9 },
    { 順位: 3, 店名: 'まるや', エリア: '名駅' },
    { 順位: 4, 店名: '消えた店', エリア: '栄' },
  ];
  return Object.assign({
    date: '2026-10-13', picks, stores,
    records: [[{ 店名: '小菜一碟', 出典URL: ['https://tabelog.com/a', 'https://retty.me/b'] }], []],
    pageHref: (s) => 'stores/' + encodeURIComponent(s['店名']) + '.html',
  }, over);
}

test('buildTrendPicks: 選定の順に並べ、決められない店は出さずに理由を返す。1 位が落ちない', () => {
  const r = TP.buildTrendPicks(trendInput());
  assert.deepStrictEqual(r.cards.map((c) => c.name), ['小菜一碟', 'ゆみちの店']);
  assert.deepStrictEqual(r.skipped.map((s) => s.name), ['まるや', '消えた店']);
  assert.ok(r.skipped.every((s) => s.why));
  assert.ok(r.html.includes('<section class="trend-picks" id="trend-picks" aria-labelledby="trend-picks-title">'));
  assert.ok(r.html.includes('<h2 id="trend-picks-title">今日の話題店</h2>'));
  assert.ok(r.html.includes('<span class="trend-picks-date">10/13更新</span>'));
  assert.strictEqual((r.html.match(/<li class="tp-item">/g) || []).length, 2);
  assert.ok(r.html.includes('2サイトで紹介'), '出典の別サイト数');
  assert.ok(r.html.includes('10/5に確認'), '2026-10-13 の 8 日前');
  assert.ok(r.html.includes('📷 ゆみち'));
  assert.ok(!/順位|1位|TOP|人気|話題沸騰/.test(r.html.replace('今日の話題店', '')), '順位や根拠の無い語を出さない');
});

test('buildTrendPicks: 選定が空・全部決められないなら区画ごと出さない', () => {
  assert.strictEqual(TP.buildTrendPicks(trendInput({ picks: [] })).html, '');
  const all = TP.buildTrendPicks(trendInput({ picks: [{ 店名: '消えた店' }] }));
  assert.strictEqual(all.html, '');
  assert.strictEqual(all.skipped.length, 1);
});

test('buildTrendPicks: 先頭の 3 枚は遅延させず、4 枚目からは loading=lazy', () => {
  const stores = []; const picks = [];
  for (let i = 1; i <= 5; i++) { stores.push({ 店名: '店' + i, エリア: '栄', ジャンル: '和食', 写真URL: 'https://lh3.googleusercontent.com/p/' + i + '=s1600-w1200' }); picks.push({ 順位: i, 店名: '店' + i, エリア: '栄' }); }
  const r = TP.buildTrendPicks(trendInput({ stores, picks }));
  const imgs = r.html.match(/<img [^>]*>/g);
  assert.strictEqual(imgs.length, 5);
  assert.deepStrictEqual(imgs.map((t) => t.includes('loading="lazy"')), [false, false, false, true, true]);
});

// ── 6. よく見られている店 ───────────────────────────────────────────────
function viewStores(counts) { return counts.map((n, i) => ({ 店名: '店' + (i + 1), エリア: '栄', ジャンル: '和食', 閲覧数: String(n) })); }
const POLICY = { minViewsPerStore: 10, minStoresToShow: 5, maxStores: 10 };
const viewIn = (counts, over) => TP.buildViewRanking(Object.assign({ stores: viewStores(counts), policy: POLICY, lookbackDays: 30, pageHref: () => 'stores/x.html' }, over));

test('buildViewRanking: 下限（1 店 10 回以上・5 店以上）にそろわなければ区画ごと出さない', () => {
  // 2026-10-13 の実測に近い形: 閲覧のあった 37 店のうち 10 回以上は 1 店だけ
  const today = [12].concat(new Array(36).fill(1));
  assert.strictEqual(viewIn(today).html, '');
  assert.strictEqual(viewIn([30, 20, 15, 12]).html, '', '4 店では出さない');
  assert.strictEqual(viewIn([30, 20, 15, 12, 9]).html, '', '9 回の店は数えない');
  assert.strictEqual(viewIn([]).html, '');
});

test('buildViewRanking: そろった日は多い順に最大 10 店・同数は店名順・下限未満の店は混ぜない', () => {
  // 下限（10 回）以上は 11 店。上限の 10 店で切るので、同数 10 回の 2 店のうち店名順で後ろの 1 店が落ちる
  const r = viewIn([50, 40, 30, 20, 10, 10, 9, 3, 1, 25, 15, 11, 12, 13]);
  assert.strictEqual(r.cards.length, 10);
  assert.deepStrictEqual(r.cards.map((c) => c.name), ['店1', '店2', '店3', '店10', '店4', '店11', '店14', '店13', '店12', '店5']);
  assert.ok(!r.cards.some((c) => c.name === '店6'), '同数なら店名順');
  assert.ok(r.cards.every((c) => Number(c.reason.match(/(\d+)回閲覧/)[1]) >= 10), '下限未満の店は入らない');
  assert.ok(r.html.includes('<h2 id="ranking-picks-title">よく見られている店</h2>'));
  assert.ok(r.html.includes('<span class="trend-picks-date">直近30日</span>'));
  assert.ok(r.html.includes('30日で50回閲覧'));
  assert.ok(r.html.includes('data-source="ranking"'));
  assert.ok(r.html.includes('id="ranking-picks"'));
  assert.ok(!/views|TOP ?10|Top ?10/.test(r.html));
});

test('buildViewRanking: 同じ回数の店は店名の五十音順（入力の順に左右されない）', () => {
  const mk = (name) => ({ 店名: name, エリア: '栄', ジャンル: '和食', 閲覧数: '10' });
  const stores = ['わ店', 'あ店', 'こ店', 'い店', 'さ店'].map(mk);
  const r = TP.buildViewRanking({ stores, policy: POLICY, lookbackDays: 30, pageHref: () => 'stores/x.html' });
  assert.deepStrictEqual(r.cards.map((c) => c.name), ['あ店', 'い店', 'こ店', 'さ店', 'わ店']);
});

test('buildViewRanking: 方針が空・壊れていても既定（10 回・5 店・10 店）で動く', () => {
  assert.strictEqual(viewIn([50, 40, 30, 20, 10], { policy: {} }).cards.length, 5);
  assert.strictEqual(viewIn([50, 40, 30, 20], { policy: {} }).html, '');
  assert.ok(viewIn([50, 40, 30, 20, 10], { policy: {}, lookbackDays: undefined }).html.includes('30日で50回閲覧'));
});

test('data/ranking_display_policy.json: 下限の既定が数で入っている（閾値の変更はこの JSON で行う）', () => {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ranking_display_policy.json'), 'utf8'));
  for (const k of ['minViewsPerStore', 'minStoresToShow', 'maxStores']) assert.ok(Number.isInteger(p[k]) && p[k] > 0, k);
  assert.ok(p.minViewsPerStore >= 10 && p.minStoresToShow >= 5, '件数の少ない日に数字を盛らない（品質ゲート原則3）');
});

// ── 7. 生成器（目印の間だけを書く・冪等） ───────────────────────────────
function fixtureRoot(indexHtml) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'top-picks-'));
  fs.mkdirSync(path.join(dir, 'data'));
  fs.mkdirSync(path.join(dir, 'stores'));
  fs.writeFileSync(path.join(dir, 'index.html'), indexHtml);
  const w = (f, o) => fs.writeFileSync(path.join(dir, 'data', f), JSON.stringify(o));
  w('daily_trending5.json', { date: '2026-10-13', stores: [{ 順位: 1, 店名: '小菜一碟', エリア: '名古屋市東区相生町', 鮮度日数: 8 }] });
  w('stores.json', [{ 店名: '小菜一碟', エリア: '東区・相生町', ジャンル: '四川料理', 写真URL: 'https://lh3.googleusercontent.com/place-photos/a=s1600-w1200', 閲覧数: '3' }]);
  w('trending_stores.json', { stores: [{ 店名: '小菜一碟', 出典URL: ['https://tabelog.com/a', 'https://retty.me/b'] }] });
  w('manual_stores.json', { stores: [] });
  w('view_counts.json', { lookbackDays: 30 });
  w('ranking_display_policy.json', POLICY);
  fs.writeFileSync(path.join(dir, 'stores', 'saisai.html'), h1('小菜一碟'));
  return dir;
}
const SKELETON = '<main>\nA\n<!-- TREND_PICKS_START -->\nold\n<!-- TREND_PICKS_END -->\nB\n<!-- VIEW_RANKING_START -->\nold2\n<!-- VIEW_RANKING_END -->\nC\n</main>';
const quiet = { log: () => {}, warn: () => {} };

test('生成器: 目印の間だけを書き換え、外は 1 バイトも変えない。2 回続けても同じ', () => {
  const dir = fixtureRoot(SKELETON);
  try {
    const r1 = BTP.main(Object.assign({ root: dir, toSlug: () => 'saisai' }, quiet));
    assert.strictEqual(r1.changed, true);
    const out = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(out.startsWith('<main>\nA\n<!-- TREND_PICKS_START -->\n<section class="trend-picks"'));
    assert.ok(out.includes('href="stores/saisai.html"'));
    assert.ok(out.includes('2サイトで紹介'));
    assert.ok(out.includes('<!-- TREND_PICKS_END -->\nB\n<!-- VIEW_RANKING_START -->\n<!-- VIEW_RANKING_END -->\nC\n</main>'), '下限に届かない区画は空にする');
    const r2 = BTP.main(Object.assign({ root: dir, toSlug: () => 'saisai' }, quiet));
    assert.strictEqual(r2.changed, false, '冪等');
    assert.strictEqual(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), out);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('生成器: write:false なら index.html を書かない（--check / --dry-run の元）', () => {
  const dir = fixtureRoot(SKELETON);
  try {
    const r = BTP.main(Object.assign({ root: dir, write: false, toSlug: () => 'saisai' }, quiet));
    assert.strictEqual(r.changed, true);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), SKELETON);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('生成器: 目印が無ければ作り直さず、警告に出す。決められない店も警告に出す', () => {
  const dir = fixtureRoot('<main>目印なし</main>');
  const warns = [];
  try {
    const r = BTP.main({ root: dir, toSlug: () => 'saisai', log: () => {}, warn: (m) => warns.push(m) });
    assert.strictEqual(r.changed, false);
    assert.deepStrictEqual(r.missing, ['<!-- TREND_PICKS_START -->', '<!-- VIEW_RANKING_START -->']);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), '<main>目印なし</main>');
    assert.strictEqual(warns.length, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  const dir2 = fixtureRoot(SKELETON);
  const warns2 = [];
  try {
    fs.writeFileSync(path.join(dir2, 'data', 'daily_trending5.json'), JSON.stringify({ date: '2026-10-13', stores: [{ 順位: 1, 店名: '小菜一碟', エリア: 'x', 鮮度日数: 1 }, { 順位: 2, 店名: '消えた店', エリア: 'y' }] }));
    BTP.main({ root: dir2, toSlug: () => 'saisai', log: () => {}, warn: (m) => warns2.push(m) });
    assert.ok(warns2.some((m) => m.includes('消えた店')), warns2.join('\n'));
  } finally { fs.rmSync(dir2, { recursive: true, force: true }); }
});

test('生成器: データのファイルが無い・壊れていても落ちない（区画を空にして警告）', () => {
  const dir = fixtureRoot(SKELETON);
  try {
    fs.writeFileSync(path.join(dir, 'data', 'daily_trending5.json'), '{ broken');
    fs.rmSync(path.join(dir, 'data', 'view_counts.json'));
    fs.rmSync(path.join(dir, 'data', 'ranking_display_policy.json'));
    const r = BTP.main(Object.assign({ root: dir, toSlug: () => 'saisai' }, quiet));
    assert.strictEqual(r.trend.cards.length, 0);
    assert.ok(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes('<!-- TREND_PICKS_START -->\n<!-- TREND_PICKS_END -->'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('patchRegion: 目印の間を差し替える。目印が無い・逆順なら null', () => {
  const m = ['<!--S-->', '<!--E-->'];
  assert.strictEqual(BTP.patchRegion('a<!--S-->x<!--E-->b', m, 'N'), 'a<!--S-->\nN\n<!--E-->b');
  assert.strictEqual(BTP.patchRegion('a<!--S-->x<!--E-->b', m, ''), 'a<!--S-->\n<!--E-->b');
  assert.strictEqual(BTP.patchRegion('ab', m, 'N'), null);
  assert.strictEqual(BTP.patchRegion('<!--E-->x<!--S-->', m, 'N'), null);
});
