'use strict';

/**
 * HotPepper 穴埋め（scripts/fill_missing_photos_from_hotpepper.js）の採否ゲートの単体テスト。
 *
 * このゲートが守るもの:
 *   「その写真は、本当にその店の写真か」。ISSUE-090（記事に一行触れただけの別店の
 *   販促バナーが記事の顔になった事故）と同じ失敗クラス＝**支店違い**をここで止める。
 *   HotPepper のキーワード検索は同一チェーンの別店舗を平気で返すため、店名ゲートだけでは
 *   足りず（長い屋号は Dice が支店差を飲み込む）、支店名トークンと区（〇〇区）の
 *   突き合わせを追加で必須にしている。
 *
 * 固定してあるのは全て実データ（data/manual_stores.json と data/stores.json の実在レコード）。
 * 閾値をいじって全部通るようにする改変を検知するのがこのテストの役目
 * （CLAUDE.md 品質ゲートの原則5）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { judgeCandidate, wards, promote, branchToken } = require('../scripts/fill_missing_photos_from_hotpepper.js');

// 実データ: data/manual_stores.json の写真なし店
const SHIRAKAWA = { '店名': 'しら河 浄心本店', 'エリア': '名古屋市西区', 'アクセス': '名古屋市西区浄心 浄心駅から徒歩約5分' };
const YOKOI_NISHIKI = { '店名': 'スパゲッティハウス ヨコイ 錦店', 'エリア': '錦', 'アクセス': '名古屋市営地下鉄東山線 栄駅より徒歩6分（名古屋市中区錦3-14-25 アサヒビル1F）' };
const KOMEDA = { '店名': 'コメダ珈琲 本店', 'エリア': '昭和区', 'アクセス': '名古屋市瑞穂区 / 地下鉄桜通線 桜山駅 徒歩圏内' };

// 実データ: data/stores.json の HotPepper 店（shop レコードの形に射影）
const shop = (id, name, address) => ({
  id, name, address,
  photo: { pc: { l: `https://imgfp.hotp.jp/IMGH/60/53/${id}/${id}_238.jpg` } },
  urls: { pc: `https://www.hotpepper.jp/${id}/` },
});
const SHIRAKAWA_JOSHIN = shop('P012716053', 'しら河 浄心本店', '愛知県名古屋市西区城西４-20-12');
const SHIRAKAWA_MEIEKI = shop('P038044093', 'しら河 名駅店', '愛知県名古屋市中村区名駅1-1-4');
const SHIRAKAWA_SAKAE = shop('P010239089', 'しら河 栄店', '愛知県名古屋市中区栄3-6-1');

test('同じ店（店名一致＋区一致）は採用する', () => {
  const r = judgeCandidate(SHIRAKAWA, SHIRAKAWA_JOSHIN);
  assert.equal(r.ok, true, `採用されるべきが落ちた: ${r.reason} ${r.detail}`);
  assert.match(r.photo, /_480\.jpg$/, '_480 へ格上げされていない');
});

test('支店違いは採用しない（同一チェーンの別店舗）', () => {
  for (const wrong of [SHIRAKAWA_MEIEKI, SHIRAKAWA_SAKAE]) {
    const r = judgeCandidate(SHIRAKAWA, wrong);
    assert.equal(r.ok, false, `支店違い「${wrong.name}」が採用された`);
  }
});

test('店名ゲートを通ってしまう支店違いを区で落とす', () => {
  // 屋号が長いと Dice が支店差を飲み込む（実測: ヨコイ 錦店 vs 名駅店 は閾値超え）。
  // 区が違えばここで止まる。
  const meieki = shop('P055555555', 'スパゲッティハウス ヨコイ 名駅店', '愛知県名古屋市中村区名駅3-1-1');
  const r = judgeCandidate(YOKOI_NISHIKI, meieki);
  assert.equal(r.ok, false, '別の区の支店が採用された');
  assert.equal(r.reason, 'branch-mismatch');
});

test('名古屋市外は落とす', () => {
  const outside = shop('P099999999', 'しら河 浄心本店', '岐阜県岐阜市橋本町1-1');
  assert.equal(judgeCandidate(SHIRAKAWA, outside).reason, 'out-of-area');
});

test('別の店は店名ゲートで落とす', () => {
  const other = shop('P088888888', '鮨 猪子', '愛知県名古屋市西区城西4-1-1');
  assert.equal(judgeCandidate(SHIRAKAWA, other).reason, 'name-mismatch');
});

test('写真が無い候補は採用しない（取り繕わない）', () => {
  const noPhoto = { ...SHIRAKAWA_JOSHIN, photo: { pc: { l: 'https://imgfp.hotp.jp/IMGH/noimage_580.gif' } } };
  assert.equal(judgeCandidate(SHIRAKAWA, noPhoto).reason, 'no-photo');
});

test('同じ区の別支店は支店名ゲートで落とす（区では分離できない）', () => {
  // ヨコイ 錦店（中区）と 住吉店（中区）は区が一致し、店名 Dice も 0.88 で閾値を超える。
  // 支店名トークンを見ないとここが通り抜け、別店の写真が店の顔になる（ISSUE-090 と同型）。
  const sumiyoshi = shop('P077777777', 'スパゲッティハウス ヨコイ 住吉店', '愛知県名古屋市中区栄3-10-11');
  const r = judgeCandidate(YOKOI_NISHIKI, sumiyoshi);
  assert.equal(r.ok, false, '同じ区の別支店が採用された');
  assert.equal(r.reason, 'branch-mismatch');
});

test('支店名トークンは空白区切りの末尾だけを見る', () => {
  assert.equal(branchToken('スパゲッティハウス ヨコイ 錦店'), '錦店');
  assert.equal(branchToken('しら河 浄心本店'), '浄心本店');
  assert.equal(branchToken('コメダ珈琲 本店'), '本店');
  // 空白の無い「◯◯店」は屋号の一部。支店名として扱うと正しい候補まで落ちる
  assert.equal(branchToken('コメダ珈琲店'), '');
  assert.equal(branchToken('餃子の王将'), '');
});

test('店側データに区が複数ある場合はいずれか一致で通す', () => {
  // コメダ珈琲 本店は エリア=昭和区 / アクセス=瑞穂区 と食い違っており、実住所は瑞穂区。
  // どちらか一致で通さないと、正しい店を取りこぼす。
  assert.deepEqual([...wards('名古屋市瑞穂区 / 地下鉄桜通線 桜山駅 徒歩圏内')], ['瑞穂区']);
  const komedaHonten = shop('P066666666', 'コメダ珈琲店 本店', '愛知県名古屋市瑞穂区上山町3-14-8');
  assert.equal(judgeCandidate(KOMEDA, komedaHonten).ok, true);
});

test('noimage は写真として扱わない', () => {
  assert.equal(promote('https://imgfp.hotp.jp/IMGH/noimage_238.jpg'), '');
  assert.equal(promote('https://imgfp.hotp.jp/IMGH/60/53/P012716053/P012716053_238.jpg'),
    'https://imgfp.hotp.jp/IMGH/60/53/P012716053/P012716053_480.jpg');
});
