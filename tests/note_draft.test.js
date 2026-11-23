'use strict';
const test = require('node:test');
const assert = require('node:assert');
const N = require('../scripts/lib/note_draft');

const policy = N.loadPolicy();
const entry = { slug: '2026-10-21-x', title: '伏見の店で読む', date: '2026-10-21' };
const html = `<h1 class="art-title">伏見の店で<em>読む</em></h1><p class="art-lead">導入文。</p>
<div class="art-body"><p class="nb-site-intro">x</p>
<h2>節1</h2><p>営業は<strong>17:00</strong>からです。</p><h2>節2</h2><p>二つ目。</p>
<div class="insider-box"><ul><li>ポイント1</li></ul></div><div class="store-list"></div></article>`;

test('excerpt: 最初の節とポイントだけ載せ、残りは元記事へ誘導する', () => {
  const d = N.buildNoteDraft(entry, html, { ...policy, body: { ...policy.body, mode: 'excerpt', sections: 1 } });
  assert.match(d.body, /## 節1/);
  assert.doesNotMatch(d.body, /節2/);
  assert.match(d.body, /この先は元記事で読めます/);
  assert.match(d.body, /\*\*17:00\*\*/);
  assert.match(d.body, /utm_source=note/);
  assert.ok(d.tags.includes('伏見'));
});

test('検査: 記事に無い数字・使えない言い方・UTM欠落を止める', () => {
  const art = N.htmlToText(html);
  const d = N.buildNoteDraft(entry, html, policy);
  assert.deepStrictEqual(N.validateNoteDraft(d, { policy, articleText: art }), []);
  const bad = { ...d, body: d.body + '\n業界人が厳選した98店' };
  const f = N.validateNoteDraft(bad, { policy, articleText: art }).join(' ');
  assert.match(f, /wording/);
  assert.match(f, /numbers_not_in_article:98/);
  assert.match(N.validateNoteDraft({ ...d, body: 'a' }, { policy, articleText: art }).join(' '), /utm_missing/);
});

test('タグ: 公式の目安5個まで。題名の前に出る地名・テーマから選び、記事に無い語は付けない', () => {
  const t = (title, stores = []) => N.tagsFor({ title }, policy, stores);
  // 題名の前に出る地名を選ぶ（「栄・久屋大通」なら栄）。テーマも出てくる順
  assert.deepStrictEqual(t('栄・久屋大通のハロウィン、スノーピークカフェでデート'), ['名古屋グルメ', '名古屋', '栄', 'ハロウィン', 'カフェ']);
  // 同じ位置なら長い語（栄生を栄と取り違えない）
  assert.strictEqual(t('栄生の新しい店')[2], '栄生');
  // 題名に地名が無ければ店のエリア、テーマが無ければ店のジャンル。足りない分は埋め草
  assert.deepStrictEqual(t('昼だけ開く一軒', [{ 'エリア': '大須', 'ジャンル': '中華' }]), ['名古屋グルメ', '名古屋', '大須', '中華料理', 'グルメ']);
  // 何も当たらなければ基本タグ＋埋め草だけ（関係の無い語を足さない）
  assert.deepStrictEqual(t('ある店の話'), ['名古屋グルメ', '名古屋', 'グルメ']);
  for (const tag of t('栄の居酒屋で一人飲み、手羽先とどて煮のデート向けランチ')) assert.doesNotMatch(tag, /[-・\s]/);
  assert.ok(t('栄の居酒屋で一人飲み、手羽先とどて煮のデート向けランチ').length <= policy.tags.max);
});

test('タグ: 記事の店は data/stores.json の店舗IDで引く（無い ID は空で止めない）', () => {
  assert.deepStrictEqual(N.storesOf({ store_ids: ['__no_such_id__'] }), []);
  assert.deepStrictEqual(N.storesOf({}), []);
});

// 見出し画像に使える店の実物写真（docs/decisions/0056）
const fig = (kind, source, src, cap = '写真: 提供 テスト社（<a href="https://prtimes.jp/main/html/rd/p/1.html">プレスリリース</a>より）') =>
  `<figure class="art-${kind}-img" data-${kind === 'hero' ? 'hero' : 'photo'}-source="${source}" data-${kind === 'hero' ? 'hero' : 'photo'}-store="店A">\n  <img src="${src}" alt="x">\n  <figcaption class="art-img-credit">${cap}</figcaption>\n</figure>`;
const PR = 'https://prcdn.freetls.fastly.net/release_image/1/2/a.jpg';
const HP = 'https://imgfp.hotp.jp/IMGH/00/86/P1/P1.jpg';

test('見出し写真: プレスリリースの写真（ヒーロー優先）だけを、クレジットつきで選ぶ', () => {
  const p = N.articlePhoto(fig('body', 'press', PR + '?b') + fig('hero', 'press', PR), policy);
  assert.strictEqual(p.src, PR);
  assert.strictEqual(p.kind, 'hero');
  assert.strictEqual(p.credit, '提供 テスト社（プレスリリースより）');
  assert.strictEqual(p.creditUrl, 'https://prtimes.jp/main/html/rd/p/1.html');
  assert.strictEqual(p.store, '店A');
  // ヒーローがホットペッパー（規約で note に上げられない）なら、本文のプレスリリースの写真を使う
  assert.strictEqual(N.articlePhoto(fig('hero', 'hotpepper', HP) + fig('body', 'press', PR), policy).kind, 'body');
});

test('見出し写真: ホットペッパー・Places・配信元の違う画像・クレジットの無い写真は使わない', () => {
  assert.strictEqual(N.articlePhoto(fig('hero', 'hotpepper', HP), policy), null);
  assert.strictEqual(N.articlePhoto(fig('hero', 'places', 'https://lh3.googleusercontent.com/x.jpg'), policy), null);
  assert.strictEqual(N.articlePhoto(fig('hero', 'press', 'https://example.com/a.jpg'), policy), null);
  assert.strictEqual(N.articlePhoto(fig('hero', 'press', PR, '写真: 提供 テスト社'), policy), null);
  assert.strictEqual(N.articlePhoto(html, policy), null);
});

test('見出し写真: 本文に記事と同じクレジットを書き、元記事の行だけがリンクカードになる', () => {
  const withPhoto = html.replace('<div class="art-body">', fig('hero', 'press', PR) + '<div class="art-body">');
  const d = N.buildNoteDraft(entry, withPhoto, policy);
  assert.strictEqual(d.photo.src, PR);
  const credit = d.body.split('\n').find((l) => l.startsWith('見出し画像: '));
  assert.strictEqual(credit, '見出し画像: 提供 テスト社（プレスリリースより） https://prtimes.jp/main/html/rd/p/1.html');
  assert.doesNotMatch(credit, N.CARD_LINE);
  assert.match(d.body.split('\n').pop(), N.CARD_LINE);
  assert.deepStrictEqual(N.validateNoteDraft(d, { policy, articleText: N.htmlToText(withPhoto) }), []);
  // 写真の無い記事は従来どおり（クレジットの行を足さない）
  const plain = N.buildNoteDraft(entry, html, policy);
  assert.strictEqual(plain.photo, null);
  assert.doesNotMatch(plain.body, /見出し画像/);
  // 見出し画像を使わない設定なら、写真もクレジットも付けない
  assert.strictEqual(N.buildNoteDraft(entry, withPhoto, { ...policy, eyecatch: false }).photo, null);
});

test('見出し写真: 写真を入れられなかった日は、本文からクレジットの行だけを外す', () => {
  const withPhoto = html.replace('<div class="art-body">', fig('hero', 'press', PR) + '<div class="art-body">');
  const d = N.buildNoteDraft(entry, withPhoto, policy);
  const body = N.dropPhotoCredit(d.body);
  assert.doesNotMatch(body, /見出し画像:/);
  assert.match(body, /元記事: https:\/\/nagoya-bites\.com/);
  assert.doesNotMatch(body, /\n{3,}/);
  assert.strictEqual(N.dropPhotoCredit(N.buildNoteDraft(entry, html, policy).body), N.buildNoteDraft(entry, html, policy).body);
});

// ── 店ごとの形（body.mode=stores・2026-11-23）────────────────────────────
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function igRoot(posts, resolved) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-note-ig-'));
  fs.mkdirSync(path.join(dir, 'data'));
  fs.writeFileSync(path.join(dir, 'data/instagram_posts.json'), JSON.stringify(posts));
  fs.writeFileSync(path.join(dir, 'data/instagram_resolved.json'), JSON.stringify(resolved));
  return dir;
}
const storeHtml = `<h1 class="art-title">今池の店</h1><p class="art-lead">導入。</p><div class="art-body">
<h2>店A（徒歩1分）</h2><p>店Aの説明。</p><p>営業は17時から。予算は3,000円。</p><p><strong>行く前のひとこと</strong>: 日曜休み。（<a href="../stores/J001.html">店舗ページ</a>）</p>
<h2>店B（徒歩2分）</h2><p>店Bの説明。</p><p><strong>行く前のひとこと</strong>: 禁煙。（<a href="../stores/J002.html">店舗ページ</a>）</p>
<h2>店C（徒歩3分）</h2><p>店Cの説明。</p><p><strong>行く前のひとこと</strong>: 現金のみ。（<a href="../stores/J003.html">店舗ページ</a>）</p>
<h2>店D（徒歩4分）</h2><p>店Dの説明。</p><p><strong>行く前のひとこと</strong>: 予約がおすすめ。（<a href="../stores/J004.html">店舗ページ</a>）</p>
<h2>選ぶときの目安</h2><p>まとめ。</p>
<div class="store-list"></div></article>`;

test('stores: 全部の店の節を、説明とひとことだけで載せ、公式 Instagram が一致する店に写真カードを置く', () => {
  const root = igRoot({
    J001: { postUrl: 'https://www.instagram.com/shop_a/p/AAA/' },
    J002: { postUrl: 'https://www.instagram.com/other_shop/p/BBB/' }, // 公式と違うアカウントの投稿 → 付けない
    J003: { postUrl: 'https://www.instagram.com/shop_c/p/CCC/' },
  }, {
    J001: { instagram: 'https://www.instagram.com/shop_a/' },
    J002: { instagram: 'https://www.instagram.com/shop_b/' },
    J003: { instagram: '', failed: true, rejectedInstagram: 'https://www.instagram.com/shop_c/' }, // 別の支店と確かめて外した
  });
  const p = { ...policy, _root: root, body: { ...policy.body, mode: 'stores', storePhotos: true }, closing: '毎朝出しています！' };
  const d = N.buildNoteDraft({ slug: '2026-11-23-x', title: '今池の店', date: '2026-11-23' }, storeHtml, p);
  for (const s of ['店A', '店B', '店C', '店D', '選ぶときの目安']) assert.match(d.body, new RegExp('## ' + s));
  assert.doesNotMatch(d.body, /営業は17時から/); // 細かい数字の段落は元記事へ
  assert.match(d.body, /\*\*行く前のひとこと\*\*: 日曜休み。\n/); // 「（店舗ページ）」は付けない
  assert.match(d.body, /## 店A（徒歩1分）\n\n\[写真\] https:\/\/www\.instagram\.com\/shop_a\/p\/AAA\/ 写真: 店の公式Instagram（@shop_a）/);
  assert.doesNotMatch(d.body, /other_shop|shop_b|shop_c/);
  assert.strictEqual(d.cards, 1);
  assert.match(d.body, /毎朝出しています！/);
  assert.match(d.body, /元記事の店ごとの欄/);
  // 写真の行と決まり文句は、記事の数字の照合に掛けない（アカウント名の数字で落ちない）
  const withDigits = { ...d, body: d.body.replace('@shop_a', '@shop_a2025') };
  assert.deepStrictEqual(N.validateNoteDraft(withDigits, { policy: p, articleText: N.htmlToText(storeHtml) }), []);
});

test('stores: storePhotos=false なら写真カードを置かない／Instagram の台帳が無くても止めない', () => {
  const p = { ...policy, _root: fs.mkdtempSync(path.join(os.tmpdir(), 'nb-note-none-')), body: { ...policy.body, mode: 'stores' } };
  const d = N.buildNoteDraft({ slug: 's', title: 't', date: '2026-11-23' }, storeHtml, p);
  assert.strictEqual(d.cards, 0);
  assert.match(d.body, /## 店D/);
  const off = N.buildNoteDraft({ slug: 's', title: 't', date: '2026-11-23' }, storeHtml, { ...p, body: { ...p.body, storePhotos: false } });
  assert.doesNotMatch(off.body, /\[写真\]/);
});

test('policy: 本番の設定は店ごとの形で、締めの一文は記事の言い方の検査を通る', () => {
  assert.strictEqual(policy.body.mode, 'stores');
  assert.ok(policy.closing && policy.closing.includes('！'));
});

test('見出し画像: 店の実物写真が無い日は、記事の街の自由ライセンスの写真（無ければ default）。日付で回し、クレジットは数字の照合に掛けない', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-note-area-'));
  fs.mkdirSync(path.join(root, 'data'));
  const c = (n) => ({ thumb1600: `https://upload.wikimedia.org/x/${n}.jpg`, author: 'User:Foo 2019', license: 'CC BY-SA 4.0', page: `https://commons.wikimedia.org/wiki/File:${n}.jpg` });
  fs.writeFileSync(path.join(root, 'data/note_area_photos.json'), JSON.stringify({ areas: { 今池: [c('i1'), c('i2')], default: [c('d1')], 栄: [{ ...c('bad'), thumb1600: 'https://example.com/x.jpg' }] } }));
  const p = { ...policy, _root: root, body: { ...policy.body, mode: 'stores' } };
  const a = N.areaPhoto({ title: '今池で一人飲み', date: '2026-11-23' }, p, [], root);
  const b = N.areaPhoto({ title: '今池で一人飲み', date: '2026-11-24' }, p, [], root);
  assert.strictEqual(a.area, '今池');
  assert.notStrictEqual(a.src, b.src); // 日付で回る
  assert.match(a.credit, /Foo/); assert.doesNotMatch(a.credit, /User:/); // 「:」はリンクカードの行と取り違えるので外す
  assert.strictEqual(N.areaPhoto({ title: '名古屋の鍋', date: '2026-11-23' }, p, [], root).area, 'default');
  assert.strictEqual(N.areaPhoto({ title: '名古屋の鍋', date: '2026-11-23' }, p, [{ エリア: '今池・千種' }], root).area, '今池'); // 店のエリア
  assert.strictEqual(N.areaPhoto({ title: '栄の店', date: '2026-11-23' }, p, [], root).area, 'default'); // Commons 以外の URL は使わない
  const d = N.buildNoteDraft({ slug: 's', title: '今池の店', date: '2026-11-23' }, storeHtml, p);
  assert.strictEqual(d.photo.kind, 'area');
  assert.match(d.body, /^見出し画像: 今池の街の写真 — .*CC BY-SA 4\.0.*題の文字を重ねています.* https:\/\/commons/m);
  assert.doesNotMatch(d.body.split('\n').find((l) => l.startsWith('見出し画像:')), N.CARD_LINE); // 末尾のカードにならない
  assert.deepStrictEqual(N.validateNoteDraft(d, { policy: p, articleText: N.htmlToText(storeHtml) }), []);
  // 台帳が無ければ見出し画像は今までどおり題だけの図（止めない）
  assert.strictEqual(N.areaPhoto({ title: '今池', date: '2026-11-23' }, p, [], fs.mkdtempSync(path.join(os.tmpdir(), 'nb-x-'))), null);
});

test('stores: 店の欄が無い1軒の記事は、導入の後に店のカードを置き、節は2段落までにする', () => {
  const root = igRoot({ J009: { postUrl: 'https://www.instagram.com/shop_z/p/ZZZ/' } }, { J009: { instagram: 'https://www.instagram.com/shop_z/' } });
  const one = `<h1 class="art-title">1軒</h1><p class="art-lead">導入。</p><div class="art-body"><h2>節1</h2><p>一。</p><p>二。</p><p>三。</p><h2>節2</h2><p>四。</p></div></article>`;
  const d = N.buildNoteDraft({ slug: 's', title: '1軒', date: '2026-11-23', store_ids: ['J009'] }, one, { ...policy, _root: root, body: { ...policy.body, mode: 'stores' } });
  assert.match(d.body, /導入。\n\n\[写真\] https:\/\/www\.instagram\.com\/shop_z\/p\/ZZZ\//);
  assert.doesNotMatch(d.body, /三。/);
  assert.match(d.body, /四。/);
  assert.strictEqual(d.cards, 1);
});
