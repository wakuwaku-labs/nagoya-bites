'use strict';
// I-11（P-267）: 店舗ページのヒーロー写真に、Google マップの写真の撮影者を出す。
// - 出す・出さないの判定（既存の photo_policy の判定器を使い、新しい基準は足さない）
// - HTML への出し方（エスケープ・文字参照の復元・文字化けと既定値は出さない）
// - 生成器との結線（クレジットのあるページだけ包む・CSS を足す。それ以外は1バイトも変えない）
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { photoCreditOf, renderPhotoCredit, decodeEntities, PHOTO_CREDIT_CSS } = require(path.join(ROOT, 'scripts', 'lib', 'photo_credit.js'));
const { renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
const { auditHtml } = require(path.join(ROOT, 'scripts', 'lib', 'inline_js.js'));
const { loadStores } = require(path.join(ROOT, 'scripts', 'lib', 'load_stores.js'));
const { isPlacesPhotoUrl } = require(path.join(ROOT, 'scripts', 'lib', 'photo_policy.js'));

const PLACES = 'https://lh3.googleusercontent.com/place-photos/AAAA=s1600-w1200';
const HOTPEPPER = 'https://imgfp.hotp.jp/IMGH/12/34/P000000000/P000000000_480.jpg';
const BASE = { '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋', 'おすすめポイント': '炭火の焼き鳥が看板。' };

test('Google マップの写真で、利用者の投稿と記録された店は「利用者」として撮影者を出す', () => {
  const c = photoCreditOf({ ...BASE, '写真クレジット': '山田太郎', '写真出所': 'places-user' }, PLACES);
  assert.deepEqual(c, { name: '山田太郎', kind: 'user' });
});

test('出所の記録が無くても、クレジットの名前が店名と合わなければ「利用者」、合えば「店」', () => {
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': 'TOMO' }, PLACES).kind, 'user');
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': 'テスト酒場' }, PLACES).kind, 'owner');
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': 'テスト酒場', '写真出所': 'places-owner' }, PLACES).kind, 'owner');
});

test('HotPepper の写真・写真なしには出さない（店が媒体に出した素材）', () => {
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': '山田太郎', '写真出所': 'places-user' }, HOTPEPPER), null);
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': '山田太郎' }, '/assets/store-figures/_fallback.svg'), null);
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': '山田太郎' }, ''), null);
  assert.equal(photoCreditOf(null, PLACES), null);
});

test('クレジットが空・既定値（Google Maps）・文字化けのときは出さない（誤った帰属を出さない）', () => {
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': '' }, PLACES), null);
  assert.equal(photoCreditOf({ ...BASE }, PLACES), null);
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': '   ' }, PLACES), null);
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': 'Google Maps' }, PLACES), null);
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': 'google maps' }, PLACES), null);
  assert.equal(photoCreditOf({ ...BASE, '写真クレジット': 'ROCCA\uFFFD\uFFFD古屋店' }, PLACES), null);
});

test('データに残る HTML の文字参照は1回だけ元に戻し、出すときに必ずエスケープし直す', () => {
  assert.equal(decodeEntities('L&#39;atelierK'), "L'atelierK");
  assert.equal(decodeEntities('世界のユウイチロウ&amp;co'), '世界のユウイチロウ&co');
  assert.equal(decodeEntities('&amp;#39;'), '&#39;', '二重に戻さない');
  assert.equal(decodeEntities('&#x27;&lt;'), "'<");
  assert.equal(decodeEntities('&#99999999;'), '&#99999999;', '範囲外の文字参照はそのまま');
  const html = renderPhotoCredit({ ...BASE, '写真クレジット': '世界のユウイチロウ&amp;co', '写真出所': 'places-user' }, PLACES);
  assert.ok(html.includes('📷 世界のユウイチロウ&amp;co</span>'), '画面には & と出る（&amp;amp; にならない）');
  assert.ok(!html.includes('&amp;amp;'));
});

test('クレジットに HTML が入っていても、タグとして出ない', () => {
  const html = renderPhotoCredit({ ...BASE, '写真クレジット': '<img src=x onerror=alert(1)>"\'', '写真出所': 'places-user' }, PLACES);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;'));
  assert.equal((html.match(/</g) || []).length, 2, '開きタグと閉じタグの span の2つだけ');
});

test('帯の見た目: 利用者と店で title が違い、表に見える文字は撮影者名だけ', () => {
  const user = renderPhotoCredit({ ...BASE, '写真クレジット': 'TOMO' }, PLACES);
  const owner = renderPhotoCredit({ ...BASE, '写真クレジット': 'テスト酒場' }, PLACES);
  assert.match(user, /^<span class="photo-credit" title="Google マップの利用者が投稿した写真です">📷 TOMO<\/span>$/);
  assert.match(owner, /^<span class="photo-credit" title="Google マップに掲載されている写真です">📷 テスト酒場<\/span>$/);
});

test('CSS: 文字は --fs-xs（13px）で、リテラルの font-size を使わない。写真の中に収まる', () => {
  assert.ok(/font-size:var\(--fs-xs\)/.test(PHOTO_CREDIT_CSS));
  assert.ok(!/font-size:\s*\d/.test(PHOTO_CREDIT_CSS), 'font-size の直書きは禁止（デザインシステム）');
  assert.ok(/\.hero-wrap\{position:relative;\}/.test(PHOTO_CREDIT_CSS));
  assert.ok(/max-width:calc\(100% - 24px\)/.test(PHOTO_CREDIT_CSS), '狭い画面で写真からはみ出さない');
  assert.ok(/pointer-events:none/.test(PHOTO_CREDIT_CSS), '写真の操作を邪魔しない');
});

test('renderStorePage: Google マップの写真の店は、ヒーローを包んで撮影者と CSS を出す', () => {
  const s = { ...BASE, '写真URL': PLACES, '写真クレジット': 'TOMO', '写真出所': 'places-user', '写真幅': 1200 };
  const html = renderStorePage(s, 'J-test', [], []);
  assert.ok(/<div class="hero-wrap"><img class="hero-img" src="[^"]+"[^>]*><span class="photo-credit" title="[^"]+">📷 TOMO<\/span><\/div>/.test(html));
  assert.ok(html.includes('.hero-wrap{position:relative;}'));
  assert.ok(html.includes('.photo-credit{position:absolute;'));
  // 既存のスクリプト（patch_static_store_photos.js など）が見る <img class="hero-img" src="…"> の形は変わらない
  assert.ok(/<img\s+class="hero-img"\s+src="([^"]+)"/.test(html));
  assert.deepEqual(auditHtml(html, { filename: 'render:photo-credit' }).violations, []);
});

test('renderStorePage: HotPepper の写真・写真なしの店は、包みも CSS も撮影者も出さない（1バイトも変えない）', () => {
  for (const photo of [HOTPEPPER, '']) {
    const s = { ...BASE, '写真URL': photo, '写真クレジット': '山田太郎', '写真出所': 'places-user' };
    const html = renderStorePage(s, 'J-test', [], []);
    assert.ok(!html.includes('hero-wrap'), `photo=${photo}`);
    assert.ok(!html.includes('photo-credit'), `photo=${photo}`);
    if (photo) {
      assert.ok(/<body>\n[\s\S]*?\n\n<img class="hero-img"/.test(html), 'ヒーローはこれまでどおり本文の直下');
    } else {
      // I-10c: 写真の無い店はヒーローを出さない（汎用の画像も出さない）
      assert.ok(!/<img class="hero-img"/.test(html), '写真の無い店はヒーローを出さない');
    }
  }
});

test('実データ: Google マップの写真の店は、読めるクレジットがあれば必ず出る。それ以外の店には出ない', () => {
  const stores = loadStores();
  let withCredit = 0; let skipped = 0; let others = 0;
  for (const s of stores) {
    const places = isPlacesPhotoUrl(s['写真URL']);
    if (!places && others >= 40) continue; // 写真が Google マップでない店は一部だけ描画する
    const html = renderStorePage(s, 'J-test', [], []);
    const has = html.includes('<span class="photo-credit"');
    if (places) {
      const expected = photoCreditOf(s, String(s['写真URL']).replace(/(imgfp\.hotp\.jp\/.+?)_(?:58|100|168|238|320)\.jpg/, '$1_480.jpg')) !== null;
      assert.equal(has, expected, `${s['店名']}: 撮影者の有無が判定と食い違う`);
      if (has) withCredit++; else skipped++;
    } else {
      others++;
      assert.ok(!has && !html.includes('hero-wrap'), `${s['店名']}: Google マップの写真でないのに撮影者が出ている`);
    }
  }
  assert.ok(withCredit >= 100, `撮影者が出る店が少なすぎる: ${withCredit}`);
  assert.ok(skipped <= 5, `撮影者を出せない Google マップの写真の店が多い（クレジットの欠落・文字化け）: ${skipped}`);
});
