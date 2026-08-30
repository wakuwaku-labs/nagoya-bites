'use strict';

/**
 * 店舗写真の採用基準（scripts/lib/photo_policy.js）の単体テスト。
 *
 * この基準が守るもの:
 *   「Google Places の写真には店舗オーナーが上げた宣材と、客が上げたスマホ写真が混在する。
 *     客の写真は実写として載せない」（2026-08-16 オーナー決定）
 *
 * ここでの回帰は「客の写真がサイトに出る」という形で表に出るため、
 * 実データから採った実例をそのまま固定する。閾値をいじって全部通るようにする改変を
 * 検知するのがこのテストの役目（CLAUDE.md 品質ゲートの原則5）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isOwnerAttribution, judgePlacesPhoto, pickPhoto, attributionName, loadPolicy } = require('../scripts/lib/photo_policy.js');

// ── オーナー投稿として採用されるべきクレジット（すべて実データ由来）──
const OWNER_CASES = [
  ['勝手口 河内屋', '勝手口 河内屋', '', '完全一致'],
  ['矢場とん', '矢場とん 本店', '', '店名が支店名を含む'],
  ['福恩麻辣湯 名古屋大曽根店', '福恩麻辣湯 大曽根店', '', '支店名・地名の表記ゆれ'],
  ['トランクコーヒー', 'TRUNK COFFEE', '', '検証済みエイリアス（カナ↔ローマ字）'],
  ['ひつまぶし 名古屋 備長 エスカ店', 'ひつまぶし名古屋備長 エスカ店', '', '空白の入り方の違い'],
];

// ── 客の投稿として除外されるべきクレジット（すべて実データ由来）──
const USER_CASES = [
  ['Yuzuki Arai', 'コメダ珈琲 本店', '', '欧文の個人名'],
  ['masayuki nakazato', '喫茶マウンテン', '', '欧文の個人名（小文字）'],
  ['加藤晶峰', '喫茶ユキ', '', '和文の個人名'],
  ['邦章みかん', '麺や 六三六', '', 'ハンドルネーム'],
  ['ni co', '麺屋まつり 名古屋店', '', '短いハンドルネーム'],
  ['鉄道王', 'カツサンド、タバタ', '', 'ハンドルネーム'],
  ['すばるうまうま', 'YUBUNE coffee', '', 'ハンドルネーム'],
  ['Skywalker天行者', '麺屋はなび', '', '和欧混在ハンドル'],
  ['Google Maps', '何かの店', '', '帰属不明時の既定値はオーナー証明にならない'],
  ['', '何かの店', '', 'クレジット空はオーナー証明にならない'],
];

test('オーナー投稿のクレジットを採用する', () => {
  for (const [credit, name, en, note] of OWNER_CASES) {
    const r = isOwnerAttribution(credit, name, en);
    assert.equal(r.owner, true, `${note}: "${credit}" vs "${name}" が除外された (sim ${r.sim})`);
  }
});

test('客が投稿した写真のクレジットを除外する', () => {
  for (const [credit, name, en, note] of USER_CASES) {
    const r = isOwnerAttribution(credit, name, en);
    assert.equal(r.owner, false, `${note}: "${credit}" vs "${name}" が採用された (sim ${r.sim})`);
  }
});

test('judgePlacesPhoto: 客投稿は not-owner-photo で落ちる', () => {
  const store = { 店名: 'コメダ珈琲 本店', 英語名: '' };
  const photo = { width: 1600, height: 1200, html_attributions: ['<a href="#">Yuzuki Arai</a>'] };
  const r = judgePlacesPhoto(photo, attributionName(photo), store);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-owner-photo');
});

test('judgePlacesPhoto: オーナー投稿は通る', () => {
  const store = { 店名: '勝手口 河内屋', 英語名: '' };
  const photo = { width: 1600, height: 1200, html_attributions: ['<a href="#">勝手口 河内屋</a>'] };
  const r = judgePlacesPhoto(photo, attributionName(photo), store);
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'owner-photo');
});

test('judgePlacesPhoto: 基準未満の解像度は too-small で落ちる', () => {
  const store = { 店名: '勝手口 河内屋', 英語名: '' };
  const photo = { width: 320, height: 240, html_attributions: ['<a href="#">勝手口 河内屋</a>'] };
  const r = judgePlacesPhoto(photo, attributionName(photo), store);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'too-small');
});

test('attributionName: html_attributions からタグを剥がす', () => {
  assert.equal(attributionName({ html_attributions: ['<a href="https://maps.google.com/x">山田太郎</a>'] }), '山田太郎');
  assert.equal(attributionName({ authorAttributions: [{ displayName: '店の名前' }] }), '店の名前');
  assert.equal(attributionName({}), '');
});

test('ポリシーは「客投稿の除外」を有効にしたままである', () => {
  // 基準そのものを黙って無効化する変更を検知する
  const p = loadPolicy();
  assert.equal(p.places.requireOwnerAttribution, true, 'requireOwnerAttribution が無効化されている');
  assert.ok(p.places.attributionMatchThreshold >= 0.8, '一致閾値が緩められている');
  assert.equal(p.prohibited.aiUpscale, true, 'AI超解像の禁止が解除されている');
});

// ── 代替枠（客投稿）の階層 ─────────────────────────────
// 2026-08-30 オーナー承認で追加。オーナー写真が**1枚も無い店に限り**客投稿を採る。
// ここが緩むと「オーナー写真があるのに素人写真を載せる」状態になるため、
// 優先順位が守られていることを実データ由来の例で固定する。
const KOMEDA = { '店名': 'コメダ珈琲 本店' };
const ph = (w, credit) => ({ photo: { width: w, height: Math.round(w * 0.75) }, attribution: credit });

test('オーナー写真があれば必ずそちらを採る（客投稿が先頭でも）', () => {
  const r = pickPhoto([
    ph(2000, 'Yuzuki Arai'),          // 客投稿が先頭
    ph(1600, 'コメダ珈琲 本店'),       // オーナー写真は後ろ
  ], KOMEDA);
  assert.equal(r.picked.tier, 'owner');
  assert.equal(r.picked.attribution, 'コメダ珈琲 本店');
});

test('オーナー写真が1枚も無ければ客投稿を代替枠として採る', () => {
  const r = pickPhoto([ph(2000, 'Yuzuki Arai'), ph(1600, 'masayuki nakazato')], KOMEDA);
  assert.equal(r.picked.tier, 'user');
  assert.equal(r.picked.attribution, 'Yuzuki Arai', '走査順の最初の候補を採っていない');
});

test('クレジットの無い写真は代替枠にもしない（判定根拠が残らないため）', () => {
  assert.equal(pickPhoto([ph(2000, '')], KOMEDA).picked, null);
  assert.equal(pickPhoto([ph(2000, 'Google Maps')], KOMEDA).picked, null);
});

test('代替枠はオーナー写真より解像度の下限が高い', () => {
  const p = loadPolicy().places;
  assert.ok(p.userPhotoMinWidthPx > p.minWidthPx, '代替枠の下限がオーナー写真以下になっている');
  // オーナー写真の下限(800)は超えるが代替枠の下限(1200)に届かない幅は採用しない
  assert.equal(pickPhoto([ph(1000, 'Yuzuki Arai')], KOMEDA).picked, null);
  assert.equal(pickPhoto([ph(1400, 'Yuzuki Arai')], KOMEDA).picked.tier, 'user');
});

test('解像度不足で落ちた写真は代替枠の候補にもしない', () => {
  // too-small は「客投稿かどうか」以前の問題なので、代替枠へ回さない
  const r = pickPhoto([ph(400, 'Yuzuki Arai')], KOMEDA);
  assert.equal(r.picked, null);
});
