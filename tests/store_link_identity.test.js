'use strict';

/**
 * 外部リンク（食べログURL）の同一性判定に使う補助関数の単体テスト。
 *
 * この判定器が守るもの:
 *   「カードの食べログリンクは、本当にその店のページに飛ぶか」。
 *   2026-09-03 に68件、2026-09-20 のサンプル監査で Hot Pepper 由来店の約17%が
 *   別店・別支店を指していたことが判明している（ISSUE-131）。
 *
 * ここで固定するのは2つ。
 *   1. 住所の正規化（normalizeJpAddress）— Google Places の住所表記
 *      「愛知県名古屋市瑞穂区上山町３丁目１４−８」と、食べログ JSON-LD の
 *      「名古屋市瑞穂区」+「上山町3-14-8」が**同じ鍵に落ちる**こと。
 *      住所一致は店名の表記ゆれより強い同一性の証拠として使うので、
 *      ここが緩むと別の建物を同じ店だと判定してしまう。
 *   2. 予約ページの <title>「〇〇のご予約」から店名を取り出せること
 *      （接尾辞を残していたため、正しいリンクが不一致と報告されていた）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeJpAddress,
  tabelogNameFromTitle,
} = require('../scripts/lib/store_link_identity.js');

// ── 同じ建物として一致すべき対（実データ: Google Places 表記 vs 食べログ表記）──
const SAME_ADDRESS = [
  ['日本、〒467-0022 愛知県名古屋市瑞穂区上山町３丁目１４−８', '名古屋市瑞穂区上山町3-14-8', 'コメダ珈琲店 本店'],
  ['日本、〒454-0838 愛知県名古屋市中川区太平通５丁目４０', '名古屋市中川区太平通5-40', 'ラーメン山岡家 名古屋太平通店'],
  ['日本、〒461-0001 愛知県名古屋市東区泉２丁目２８−２４ 東和高岳 ビル 1F', '名古屋市東区泉2-28-24 サンシャインビル2F', 'ビル名・階数は比較に使わない'],
  ['日本、〒461-0004 愛知県名古屋市東区葵３丁目２−３０', '名古屋市東区葵3-2-30', '喫茶ユキ'],
];

// ── 別の建物として落とすべき対 ──
const DIFFERENT_ADDRESS = [
  ['愛知県名古屋市中川区太平通５丁目４０', '名古屋市港区宝神5-40', '区が違えば町名が同名でも別'],
  ['愛知県名古屋市東区葵３丁目２−３０', '名古屋市東区葵3-2-31', '番地が1つ違う'],
  ['愛知県名古屋市中区栄３丁目１−１', '名古屋市中区栄3-1', '番地の深さが違う（安全側に落とす）'],
];

test('normalizeJpAddress: Places 表記と食べログ表記が同じ鍵に落ちる', () => {
  for (const [placesAddr, tabelogAddr, label] of SAME_ADDRESS) {
    const a = normalizeJpAddress(placesAddr);
    const b = normalizeJpAddress(tabelogAddr);
    assert.notEqual(a, '', `${label}: Places 側が空に落ちている`);
    assert.equal(a, b, `${label}: ${placesAddr} ≠ ${tabelogAddr}`);
  }
});

test('normalizeJpAddress: 別の建物は一致しない', () => {
  for (const [x, y, label] of DIFFERENT_ADDRESS) {
    assert.notEqual(normalizeJpAddress(x), normalizeJpAddress(y), `${label}: 誤って一致した`);
  }
});

test('normalizeJpAddress: 番地が無い／空の入力は空文字（何も主張しない）', () => {
  // 空文字を返すことが「住所では判定できない」の表明。呼び出し側は
  // 空同士が一致したことにして採用してはならないため、ここを固定する
  assert.equal(normalizeJpAddress(''), '');
  assert.equal(normalizeJpAddress('愛知県名古屋市中区'), '');
  assert.equal(normalizeJpAddress(null), '');
  assert.equal(normalizeJpAddress(undefined), '');
});

test('tabelogNameFromTitle: 予約ページの「のご予約」接尾辞を落とす', () => {
  assert.equal(tabelogNameFromTitle('野ら田のご予約 - 栄/居酒屋 | 食べログ').name, '野ら田');
  assert.equal(tabelogNameFromTitle('尾張山荘くろぎのご予約 - 名鉄名古屋/日本料理 | 食べログ').name, '尾張山荘くろぎ');
  // 通常ページは従来どおり（読みがなの丸括弧は namesMatch 側が扱う）
  assert.equal(tabelogNameFromTitle('鮨処 紫雲 （しうん） | 食べログ').name, '鮨処 紫雲 （しうん）');
});

test('tabelogNameFromTitle: 【閉店】は閉店として扱う', () => {
  const r = tabelogNameFromTitle('【閉店】餃子歩兵 名古屋泉店 | 食べログ');
  assert.equal(r.closed, true);
  assert.equal(r.name, '餃子歩兵 名古屋泉店');
});
