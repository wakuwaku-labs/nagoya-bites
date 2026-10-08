'use strict';
// SEO-119/120: アクセス文の駅名監査（scripts/lib/station_names.js / scripts/audit_station_names.js）
const test = require('node:test');
const assert = require('node:assert');
const { auditAccess, loadSets, normalize } = require('../scripts/lib/station_names');
const { run } = require('../scripts/audit_station_names');
const { applyAccessCorrections, loadCorrections } = require('../scripts/lib/access_corrections');

const outsideOf = (access) => auditAccess(access).outside.map((t) => t.station);

// SEO-119 の修正前データ（エリア「栄」として載っていた他都市の店）
const SEO119_BEFORE = [
  ['韓国居酒屋 テヤン', 'JR釧路駅出口より徒歩約18分', '釧路'],
  ['焼鳥 串っ子', 'JR釧路駅出口より徒歩約19分', '釧路'],
  ['炉ばた 浜っ子', 'JR釧路駅出口より徒歩約14分', '釧路'],
  ['七輪酒肴こいき', 'JR釧路駅出口より徒歩約18分', '釧路'],
  ['てんまや', 'JR釧路駅出口より徒歩約15分', '釧路'],
  ['居酒屋ダイニング あひる', 'JR釧路駅出口より徒歩約18分', '釧路'],
  ['KANDA SHOTEN カンダショウテン', 'JR神田(東京)駅東口より約1分', '神田'],
];

test('SEO-119 の7店はすべて県外の駅名として検出する', () => {
  for (const [name, access, station] of SEO119_BEFORE) {
    assert.deepStrictEqual(outsideOf(access), [station], name);
  }
});

test('駅を伴わない地名・ホテル名は見ない（鳥しげ 錦本店の「東京第一ホテル錦」）', () => {
  const r = auditAccess('栄駅1番出口から徒歩3分　東京第一ホテル錦 の1階にございます。');
  assert.deepStrictEqual(r.outside, []);
  assert.deepStrictEqual(r.tokens.map((t) => [t.token, t.kind]), [['栄', 'aichi']]);
});

test('仙台の中野栄・宮崎の都城など、県外の駅を見分ける', () => {
  assert.deepStrictEqual(outsideOf('JR仙石線中野栄駅出口より徒歩約5分'), ['中野栄']);
  assert.deepStrictEqual(outsideOf('都城駅より徒歩1分｡都城ｽﾃｰｼｮﾝﾎﾃﾙの隣｡'), ['都城']);
  assert.deepStrictEqual(outsideOf('小田栄駅12分/川崎新町駅16分/川崎駅徒歩17分'), ['小田栄', '川崎新町', '川崎']);
});

test('名古屋の表記ゆれ・旧駅名・路線名つきの書き方は県外にしない', () => {
  const nagoya = [
    '地下鉄東山駅・鶴舞駅「伏見駅」4番出口徒歩1分', // 「東山線」の書き損じ（京都の東山駅ではない）
    'あおなみ線競馬場前駅1.3キロ', // 路線名で県内と分かる
    '名古屋ガイドウェイバス下島駅出口より徒歩約10分',
    '市役所駅7番出口から徒歩3分', // 名古屋城駅の旧名
    '地下鉄名城線神宮西駅から徒歩5分', // 熱田神宮西駅の旧名
    '大曾根駅徒歩5分', // 曾/曽
    '地下鉄｢栄｣駅から徒歩5分', // 半角かぎ括弧
    'あおなみ線ささしまライブ駅から徒歩約11分（中村区名駅南3丁目）（名駅南 / 名古屋市内）',
    '桜通線国際ｾﾝﾀｰ駅から徒歩3分', // 半角カナ
    '地下鉄東山線星ケ丘駅から徒歩2分', // 星ヶ丘
    '名古屋市営地下鉄名城線 黒川(愛知)駅４出口より徒歩約15分',
    '金山総合駅から徒歩3分',
    'JR名駅から徒歩5分',
    '桜通線〔久屋大通〕駅から徒歩2分',
  ];
  for (const access of nagoya) assert.deepStrictEqual(outsideOf(access), [], access);
});

test('表記ゆれの正規化（漢字に挟まれたケ・が・ヶを1つにする）', () => {
  assert.strictEqual(normalize('星が丘'), normalize('星ヶ丘'));
  assert.strictEqual(normalize('茶屋ケ坂'), normalize('茶屋ヶ坂'));
  assert.strictEqual(normalize('ケーブル八瀬'), 'ケーブル八瀬'); // 語頭のケは変えない
});

test('駅名リストは出典つきで、県内と県外のみが重ならない', () => {
  const sets = loadSets();
  assert.ok(sets.source && sets.source.includes('HeartRails'), '出典がある');
  assert.ok(sets.aichi.size >= 400 && sets.outside.size >= 5000);
  for (const n of ['名古屋', '栄', '金山', '伏見', '名古屋城', '熱田神宮伝馬町']) assert.ok(sets.aichi.has(normalize(n)), n);
  for (const n of sets.aichi) assert.ok(!sets.outside.has(n), `重複: ${n}`);
});

test('監査は対応済み（閉店リスト）と例外を除き、残った県外だけで落ちる', () => {
  const stores = [
    { 店名: 'A', ホットペッパーID: 'J1', アクセス: 'JR釧路駅出口より徒歩約18分' },
    { 店名: 'B', ホットペッパーID: 'J2', アクセス: '飯田駅３出口より徒歩約3分' },
    { 店名: 'C', ホットペッパーID: 'J3', アクセス: '地下鉄東山線栄駅から徒歩3分' },
    { 店名: 'D', ホットペッパーID: 'J4', アクセス: '麻布十番駅 4番出口 徒歩2分' },
  ];
  const r = run({ stores, closed: [{ ホットペッパーID: 'J1' }], exceptions: [{ ホットペッパーID: 'J2' }] });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.checked, 2);
  assert.deepStrictEqual(r.outside.map((o) => [o.hotpepperId, o.stations]), [['J4', ['麻布十番']]]);
  const clean = run({ stores: stores.slice(2, 3) });
  assert.strictEqual(clean.ok, true);
});

test('アクセス文の訂正は取り込み元の文が一致するときだけ当たる', () => {
  const corrections = [{ ホットペッパーID: 'J9', 元のアクセス: '新羽島駅徒歩7分', アクセス: '' }];
  const stores = [
    { ホットペッパーID: 'J9', アクセス: '新羽島駅徒歩7分' },
    { ホットペッパーID: 'J8', アクセス: '新羽島駅徒歩7分' },
  ];
  assert.strictEqual(applyAccessCorrections(stores, corrections), 1);
  assert.deepStrictEqual(stores.map((s) => s['アクセス']), ['', '新羽島駅徒歩7分']);
  const fixedUpstream = [{ ホットペッパーID: 'J9', アクセス: '本郷駅から徒歩10分' }];
  assert.strictEqual(applyAccessCorrections(fixedUpstream, corrections), 0);
  assert.strictEqual(fixedUpstream[0]['アクセス'], '本郷駅から徒歩10分');
});

test('data/access_corrections.json の訂正は推測で文を書かない形（空欄か出典つき）', () => {
  for (const c of loadCorrections()) {
    assert.ok(c['出典'] && c['理由'] && c['確認日'], c['店名']);
    assert.notStrictEqual(c['元のアクセス'], c['アクセス']);
  }
});
