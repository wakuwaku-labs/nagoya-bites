'use strict';

/**
 * 店名の同一性判定（scripts/lib/store_name_match.js）の単体テスト。
 *
 * この判定器が守るもの:
 *   「その写真・そのデータは、本当にその店のものか」。ここが緩むと
 *   **別の店の写真がその店の顔になる**（ISSUE-090 と同型の事故）。
 *   Places 経路（fetch_manual_store_photos.js）と HotPepper 経路
 *   （fill_missing_photos_from_hotpepper.js）が同じこの1本を共有する。
 *
 * 固定してあるのは全て実データ由来の対。2026-08-29 に、写真の無い店 119件を
 * 既存カタログの HotPepper 4,796件へ総当たりした結果、素の部分一致が
 * 4件の別店を「同一店」と判定していた（下の WRONG 群）。閾値を緩めて
 * 全部通るようにする改変を検知するのがこのテストの役目
 * （CLAUDE.md 品質ゲートの原則5）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { namesMatch, latinSkeleton, kanaSkeleton, phoneticKey, bilingualVariants } = require('../scripts/lib/store_name_match.js');

// ── 同一店として通すべき対（実データ）──
const SAME = [
  ['矢場とん 本店', '矢場とん 本店', '完全一致'],
  ['しら河 浄心本店', 'しら河 浄心本店', '完全一致'],
  ['コメダ珈琲 本店', 'コメダ珈琲店 本店', '屋号の「店」の有無'],
  ['那古野 しば福や 名駅店 (なごの しばふくや めいえきてん)', '那古野 しば福や 名駅店', '読み仮名の併記'],
  ['かき氷 うと（栄マルエイガレリア店）', 'かき氷 うと 栄 マルエイガレリア店', '括弧内が支店名'],
  ['LIGNIN', 'LIGNIN リグニン', 'ローマ字＋カナ併記'],
  ['LYCHI', 'LYCHI ライチ', 'ローマ字＋カナ併記'],
  ['サウィ食堂', 'サウィ食堂 名古屋栄店', '支店名の付加'],
  ['SAKE BAR 結 -MUSUBI-', 'SAKE BAR 結 MUSUBI 伏見店', '装飾記号と支店名'],
  ['覚王山カフェ Ji.Coo', '覚王山カフェ Ji.Coo. ジクー', '読みの付加'],
  ['TRUNK COFFEE', 'トランクコーヒー', '検証済みエイリアス（カナ↔ローマ字）'],
  ['しら河 浄心本店', 'うなぎ 和食 しら河 浄心本店', 'ジャンル語が前に付いた形（末尾で一致）'],
  ['喫茶リヨン', 'モーニング喫茶 リヨン', '修飾語が前に付いた形（末尾で一致）'],
];

// ── 別店として落とすべき対（すべて実測で誤判定していたもの）──
const DIFFERENT = [
  ['旬彩料理 澤', '彩', '1文字が部分一致しただけ'],
  ['レストランくるみ', 'カフェトラ', '「レス“トラ”ン」にコアが刺さる'],
  ['焼肉酒場 番長', '手羽先番長 名古屋錦店', 'ジャンル語を落とした2文字コアが刺さる'],
  ['矢場とん 本店', 'レストランわらじや 矢場とん', '別屋号の中に名前が含まれるだけ'],
  ['ラーメン 山岡家 名古屋', 'ラーメン山岡家 宝神店', 'どの支店か特定できない'],
  ['THE CUPS SAKAE', 'CAFE&PASTA THE CUPS Q', '同一チェーンの別業態'],
  ['ふじ寿し', 'ふじホルモン', '先頭2文字が共通なだけ'],
  ['矢場とん 本店', '昔の矢場とん 大須', '別屋号が有名店名を途中に含む（先頭一致でない）'],
  ['かき氷 うと（栄マルエイガレリア店）', '亀屋 栄 マルエイガレリア店', '一致しているのは商業施設名であって店名ではない'],
  ['矢場とん 本店', 'レストランわらじや 矢場とん', '末尾では一致するが、屋号が相手の3割しか占めない'],
  ['鮨 いちかわ', '天麩羅いちかわ', 'ジャンルが違う同姓の別店'],
];

test('同一店を取りこぼさない', () => {
  for (const [a, b, note] of SAME) {
    assert.equal(namesMatch(a, b).ok, true, `${note}: 「${a}」と「${b}」が別店と判定された`);
  }
});

test('別店を同一店と判定しない', () => {
  for (const [a, b, note] of DIFFERENT) {
    const r = namesMatch(a, b);
    assert.equal(r.ok, false, `${note}: 「${a}」と「${b}」が同一店と判定された (sim ${r.sim})`);
  }
});

test('自分自身とは必ず一致する', () => {
  for (const [a] of [...SAME, ...DIFFERENT]) {
    assert.equal(namesMatch(a, a).ok, true, `「${a}」が自分自身と一致しない`);
  }
});

test('空の相手は一致させない', () => {
  assert.equal(namesMatch('しら河 浄心本店', '').ok, false);
  assert.equal(namesMatch('', '').ok, false);
});

test('部分一致には下限があり、根拠として弱い一致は数えない', () => {
  // 4文字未満は長さに関わらず不可（「彩」「トラ」「番長」で実際に誤判定していた）
  assert.equal(namesMatch('あいうえお料理店', 'あいう').ok, false);
  // 4文字以上でも、相手の半分に満たなければ不可
  assert.equal(namesMatch('あいうえ', 'あいうえおかきくけこさしす').ok, false);
  // 半分以上を占めるなら可
  assert.equal(namesMatch('あいうえ', 'あいうえおかき').ok, true);
});

// ── ローマ字表記 ↔ カタカナ表記（ISSUE-097・2026-10-05）──
// 閾値（Dice 0.85）も包含の下限も動かさず、比較に使う「読み」（子音の骨格）を増やした。
// 下の DIFFERENT 群は、実装途中にカタログ5,024店の総当たりで**実際に誤一致した**対。
// 縛り（一方は英字だけ・他方はカナだけ／一般語を除いた骨格4文字以上／併記から切り出した形は
// 末尾一致不可）を緩めるとここが落ちる。
const PHONETIC_SAME = [
  ['PASTA MANIA 大須店', 'パスタマニア大須店', 'VERIFIED_ALIASES に無い支店でもローマ字↔カナで一致'],
  ['Reminiscence', 'レミニセンス', '英字だけ ↔ カナだけ'],
  ['LA VAGABONDE', 'ラ・ヴァガボンド', '英字だけ ↔ カナだけ（ヴ/b・l/r の畳み込み）'],
  ['Seoul Kitchen ソウルキッチン', 'ソウルキッチン', '併記の片方だけを名乗る相手'],
  ['wakamaru ワカマル 栄店', 'ワカマル 栄店', '併記の片方＋支店名'],
];
const PHONETIC_DIFFERENT = [
  ['PASTA MANIA 鶴舞店', 'パスタマニア 大須店', '読みは同じでも支店名（漢字部分）が違う'],
  ['Cafe MARI カフェマリ', 'Cafe MARU（カフェ マル）', '併記名同士・母音だけ違う別店（実測）'],
  ['AOI CAFE アオイカフェ', 'Yaya Cafe ヤヤカフェ', '一般語（cafe）の骨格だけで一致していた別店（実測）'],
  ['UNO cafe ウノカフェ', 'nana cafe ナナ カフェ', '同上（実測）'],
  ['BAR Ad\'E バー アデ', 'Bar DAY バーデイ', '同上（実測）'],
  ['Alan. アラン 栄', 'Rin リン 栄', '短い屋号の骨格衝突（実測）'],
  ['KITSUNE キツネ', '吉音 KITSUNE', '併記から切り出した「kitsune」が別店の末尾に刺さる（錦3 vs 栄4・実測）'],
  ['hangout ハングアウト', '邦ロックバー Hangout', '同上（中村区 vs 中区・実測）'],
  ['MARU', 'マル', '骨格が短すぎる（mr）'],
  ['Cafe ABC ラシック', 'ラシック', 'カナが読みでなく施設名のときは併記扱いしない'],
  ['Cafe Mari', 'カフェマル', '一般語を除くと骨格が4文字に満たない'],
];

test('ローマ字↔カタカナ: 同じ店の表記違いを拾う', () => {
  for (const [a, b, note] of PHONETIC_SAME) {
    assert.equal(namesMatch(a, b).ok, true, `${note}: 「${a}」と「${b}」が別店と判定された`);
    assert.equal(namesMatch(b, a).ok, true, `${note}（逆向き）: 「${b}」と「${a}」が別店と判定された`);
  }
});

test('ローマ字↔カタカナ: 読みの一致で別店を通さない', () => {
  for (const [a, b, note] of PHONETIC_DIFFERENT) {
    for (const [x, y] of [[a, b], [b, a]]) {
      const r = namesMatch(x, y);
      assert.equal(r.ok, false, `${note}: 「${x}」と「${y}」が同一店と判定された (sim ${r.sim})`);
    }
  }
});

test('ローマ字↔カタカナ: 骨格化の単体', () => {
  assert.equal(latinSkeleton('PASTA MANIA'), kanaSkeleton('パスタマニア'));
  assert.equal(latinSkeleton('Seoul Kitchen'), kanaSkeleton('ソウルキッチン'));
  assert.equal(latinSkeleton('Reminiscence'), kanaSkeleton('レミニセンス'));
  // 漢字・数字は骨格化しない（支店名の差を残す）
  assert.notEqual(phoneticKey('PASTA MANIA 鶴舞店').key, phoneticKey('パスタマニア大須店').key);
  // 施設名がカナで並んでいるだけの店名からは変種を作らない
  assert.deepEqual(bilingualVariants('Cafe ABC ラシック'), []);
});
