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
  const d = N.buildNoteDraft(entry, html, policy);
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
