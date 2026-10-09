'use strict';

/**
 * 外部リンク（食べログURL）の同一性判定に使う補助関数の単体テスト。
 *
 * この判定器が守るもの:
 *   「カードの食べログリンクは、本当にその店のページに飛ぶか」。
 *   2026-09-03 に68件、2026-09-20 のサンプル監査で Hot Pepper 由来店の約17%が
 *   別店・別支店を指していたことが判明している（ISSUE-131）。
 *
 * ここで固定するのは3つ。
 *   1. 住所の正規化（normalizeJpAddress）— Google Places の住所表記
 *      「愛知県名古屋市瑞穂区上山町３丁目１４−８」と、食べログ JSON-LD の
 *      「名古屋市瑞穂区」+「上山町3-14-8」が**同じ鍵に落ちる**こと。
 *      住所一致は店名の表記ゆれより強い同一性の証拠として使うので、
 *      ここが緩むと別の建物を同じ店だと判定してしまう。
 *   2. 予約ページの <title>「〇〇のご予約」から店名を取り出せること
 *      （接尾辞を残していたため、正しいリンクが不一致と報告されていた）。
 *   3. 名前が一致しても住所が別の場所なら、別の支店のページとして落とすこと（ISSUE-159）。
 *      食べログの題名に支店名が無い店は、どの支店の名前とも一致してしまう
 *      （実例: 「うなぎのしろむら 丸の内店」に東区の泉本店のページ）。住所の比較は
 *      same / different / unknown の3値で、表記ゆれで説明できる組は unknown（落とさない）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeJpAddress,
  tabelogNameFromTitle,
  parseJpAddress,
  compareJpAddress,
  judgeTabelogHtml,
  hasBranchSuffix,
  ourBranchOnly,
  linkCacheKey,
} = require('../scripts/lib/store_link_identity.js');
const { collect } = require('../scripts/audit_tabelog_branch_mismatch.js');

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

// ── 住所の構造比較（ISSUE-159）──────────────────────────────────────
test('parseJpAddress: 市・区・町名・番地に分ける', () => {
  assert.deepEqual(parseJpAddress('日本、〒467-0022 愛知県名古屋市瑞穂区上山町３丁目１４−８'),
    { pref: '愛知県', city: '名古屋市', ward: '瑞穂区', town: '上山町', nums: ['3', '14', '8'] });
  assert.deepEqual(parseJpAddress('愛知県清須市西枇杷島町花咲２２'),
    { pref: '愛知県', city: '清須市', ward: '', town: '西枇杷島町花咲', nums: ['22'] });
  // 漢数字の丁目・大字・字
  assert.deepEqual(parseJpAddress('名古屋市中区栄三丁目5-1').nums, ['3', '5', '1']);
  assert.equal(parseJpAddress('愛知県名古屋市守山区大字上志段味字東谷2107-1').town, '上志段味東谷');
  // 全角空白は番地の区切り（「錦２　5-34」を「錦25-34」に潰さない・実データ）
  assert.deepEqual(parseJpAddress('愛知県名古屋市中区錦２　5-34　今枝ビルB1F').nums, ['2', '5', '34']);
  assert.equal(parseJpAddress('愛知県名古屋市緑区白土401　1F').nums[0], '401');
  assert.equal(parseJpAddress(''), null);
  assert.equal(parseJpAddress(null), null);
});

// [我々の住所, 食べログ側の住所, 説明, 期待する reason]
const ADDRESS_SAME = [
  ['日本、〒460-0002 愛知県名古屋市中区丸の内２丁目８−２７', '名古屋市中区丸の内2-8-27', 'Places 表記と食べログ表記'],
  ['愛知県名古屋市中区錦２　5-34　今枝ビルB1F', '名古屋市中区錦2-5-34', '全角空白で区切った番地'],
  ['愛知県名古屋市緑区白土401　1F', '名古屋市緑区白土401', '番地の後ろの階数'],
  ['名古屋市中区栄三丁目5-1', '名古屋市中区栄3-5-1', '漢数字の丁目'],
  ['愛知県名古屋市千種区星ヶ丘元町１６－５０', '名古屋市千種区星が丘元町16-50', 'ヶ と が'],
];
const ADDRESS_DIFFERENT = [
  ['愛知県名古屋市中区丸の内２丁目８−２７', '名古屋市東区泉1-18-41', 'しろむら 丸の内店に泉本店のページ（ISSUE-157）', 'ward'],
  ['愛知県名古屋市熱田区四番２丁目2番26号-1 イツフジハイツ1階', '清須市西枇杷島町古城2-10-7', '六番町店に清須市の本店のページ', 'city'],
  ['愛知県名古屋市中区錦３丁目17-3　サンプラザビル１階', '泉1-17-3', '番地の後ろが同じでも町名が違う（本店に泉店のページ）', 'town'],
  ['愛知県名古屋市熱田区金山町２丁目１－６', '金山町1-16-16', '同じ町の別の丁目', 'block'],
];
const ADDRESS_UNKNOWN = [
  ['愛知県名古屋市熱田区金山町１－１１－６', '金山1-11-6', '「金山町」と「金山」（区が無いと決められない）', 'town-notation'],
  ['愛知県名古屋市守山区四軒屋1-102', '四軒家1-102', '屋 と 家', 'town-notation'],
  ['愛知県名古屋市中川区中郷２－１０７', '新家2-107', '番地が同じで町名が違う', 'same-number'],
  ['', '名古屋市中区栄3-1-1', '我々の住所が無い', 'unparsable'],
  ['愛知県名古屋市中区', '栄3-1-1', '番地が無い', 'unparsable'],
];

test('compareJpAddress: 同じ場所は same', () => {
  for (const [ours, page, label] of ADDRESS_SAME) {
    assert.equal(compareJpAddress(ours, page).verdict, 'same', `${label}: ${ours} ↔ ${page}`);
  }
});

test('compareJpAddress: 表記ゆれで説明できない違いだけ different', () => {
  for (const [ours, page, label, reason] of ADDRESS_DIFFERENT) {
    assert.deepEqual(compareJpAddress(ours, page), { verdict: 'different', reason }, label);
  }
});

test('compareJpAddress: 決められない組は unknown（推測で落とさない）', () => {
  for (const [ours, page, label, reason] of ADDRESS_UNKNOWN) {
    assert.deepEqual(compareJpAddress(ours, page), { verdict: 'unknown', reason }, label);
  }
});

// 食べログの店舗ページ（題名と JSON-LD の住所だけを持つ最小の形）
function tabelogPage(title, locality, street) {
  const ld = { '@context': 'http://schema.org', '@type': 'Restaurant', name: title, address: { '@type': 'PostalAddress', addressLocality: locality, streetAddress: street } };
  return `<html><head><title>${title}</title><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body></body></html>`;
}
const IZUMI_PAGE = tabelogPage('うなぎのしろむら - 高岳/うなぎ | 食べログ', '名古屋市東区', '泉1-18-41');

test('judgeTabelogHtml: 名前が一致しても住所が別の場所なら別の支店として落とす', () => {
  const r = judgeTabelogHtml(IZUMI_PAGE, 'うなぎのしろむら 丸の内店', { address: '愛知県名古屋市中区丸の内２丁目８−２７' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'branch-address-mismatch');
  assert.equal(r.addressVerdict, 'different');
  assert.equal(r.matchedAddressRaw, '名古屋市東区泉1-18-41');
});

test('judgeTabelogHtml: 住所が同じ店・住所を渡さない呼び出し・決められない組は従来どおり', () => {
  const same = judgeTabelogHtml(IZUMI_PAGE, 'うなぎのしろむら 泉本店', { address: '愛知県名古屋市東区泉１丁目１８−４１' });
  assert.equal(same.ok, true);
  assert.equal(same.via, 'name+address');
  // 住所が無ければ名前だけで判定する（何も主張しない）
  assert.equal(judgeTabelogHtml(IZUMI_PAGE, 'うなぎのしろむら 丸の内店', {}).ok, true);
  // 町名の表記ゆれは unknown のまま通す
  const kanayama = tabelogPage('とりべゑ 金山店 - 金山/焼き鳥 | 食べログ', '名古屋市熱田区', '金山1-11-6');
  const u = judgeTabelogHtml(kanayama, 'とりべゑ 金山店', { address: '愛知県名古屋市熱田区金山町１－１１－６' });
  assert.equal(u.ok, true);
  assert.equal(u.addressVerdict, 'unknown');
  // 閉店は住所より先に閉店として扱う
  const closed = tabelogPage('【閉店】うなぎのしろむら - 高岳/うなぎ | 食べログ', '名古屋市東区', '泉1-18-41');
  assert.equal(judgeTabelogHtml(closed, 'うなぎのしろむら 泉本店', { address: '愛知県名古屋市東区泉1-18-41' }).reason, 'closed');
});

test('ourBranchOnly: 我々だけが支店名を持つ組（解決器の取り違え防止）', () => {
  assert.equal(ourBranchOnly('うなぎのしろむら 柳橋本店', 'うなぎのしろむら'), true);
  // 読み仮名の丸括弧は支店名の判定から外す
  assert.equal(ourBranchOnly('東京竹葉亭 名古屋店', '東京竹葉亭 名古屋店 （とうきょうちくようてい）'), false);
  assert.equal(hasBranchSuffix('那古野 しば福や 名駅店 (なごの しばふくや めいえきてん)'), true);
  assert.equal(ourBranchOnly('碧亭', '碧亭'), false);
});

test('audit_tabelog_branch_mismatch: キャッシュに残る「一致」も住所で数え直す', () => {
  const URL_IZUMI = 'https://tabelog.com/aichi/A2301/A230102/23056889/';
  const URL_KANAYAMA = 'https://tabelog.com/aichi/A2301/A230106/23000001/';
  const URL_JUDGED = 'https://tabelog.com/aichi/A2301/A230101/23000002/';
  const URL_NOADDR = 'https://tabelog.com/aichi/A2301/A230101/23000003/';
  const URL_UNCHECKED = 'https://tabelog.com/aichi/A2301/A230101/23000004/';
  const stores = [
    { 'ホットペッパーID': 'J1', '店名': 'うなぎのしろむら 丸の内店', '住所': '愛知県名古屋市中区丸の内2-8-27', '食べログURL': URL_IZUMI },
    { 'ホットペッパーID': 'J2', '店名': 'うなぎのしろむら 泉本店', '住所': '愛知県名古屋市東区泉1-18-41', '食べログURL': URL_IZUMI },
    { 'ホットペッパーID': 'J3', '店名': 'とりべゑ 金山店', '住所': '愛知県名古屋市熱田区金山町１－１１－６', '食べログURL': URL_KANAYAMA },
    { 'ホットペッパーID': 'J4', '店名': '照合器が落とした店', '住所': '愛知県名古屋市中区栄3-1-1', '食べログURL': URL_JUDGED },
    { 'ホットペッパーID': '', '店名': '手動の店', '食べログURL': URL_NOADDR },
    { 'ホットペッパーID': 'J6', '店名': 'まだ照合していない店', '住所': '愛知県名古屋市中区栄3-1-1', '食べログURL': URL_UNCHECKED },
    { 'ホットペッパーID': 'J7', '店名': '検索ページ', '住所': '愛知県名古屋市中区栄3-1-1', '食べログURL': 'https://tabelog.com/rstLst/?sw=x' },
  ];
  const cache = {
    // ISSUE-159 より前の記録（正規化した住所だけを持つ）
    [linkCacheKey('tabelog', URL_IZUMI, 'うなぎのしろむら 丸の内店')]: { ok: true, matchedName: 'うなぎのしろむら', matchedAddress: '泉1-18-41' },
    [linkCacheKey('tabelog', URL_IZUMI, 'うなぎのしろむら 泉本店')]: { ok: true, matchedName: 'うなぎのしろむら', matchedAddress: '泉1-18-41' },
    [linkCacheKey('tabelog', URL_KANAYAMA, 'とりべゑ 金山店')]: { ok: true, matchedName: 'とりべゑ', matchedAddressRaw: '名古屋市熱田区金山1-11-6' },
    [linkCacheKey('tabelog', URL_JUDGED, '照合器が落とした店')]: { ok: false, reason: 'branch-address-mismatch', addressReason: 'ward', matchedAddressRaw: '名古屋市東区泉1-1-1' },
    [linkCacheKey('tabelog', URL_NOADDR, '手動の店')]: { ok: true, matchedAddress: '栄3-1-1' },
  };
  const r = collect(cache, stores);
  assert.deepEqual(r.counts, { linked: 6, checked: 5, compared: 4, same: 1, unknown: 1, different: 2 });
  assert.deepEqual(r.different.map((d) => [d.id, d.reason]), [['J1', 'town'], ['J4', 'ward']]);
  assert.deepEqual(r.unknown.map((u) => u.id), ['J3']);
});
