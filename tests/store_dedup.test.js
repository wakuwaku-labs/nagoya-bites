'use strict';

/**
 * 重複レコード統合（scripts/lib/store_dedup.js・ISSUE-132 acceptance②③）の単体テスト。
 * HOTPEPPER_API_KEY 不要（build.js を通さずに統合ロジックだけを検査する）。
 *
 * 固定している対は data/stores.json（2026-10-05）の実データ由来。
 *   - 統合すべき: 「尾張山荘 くろぎ」（店名完全一致・片方だけ食べログURL）など
 *   - 統合してはいけない: 区が食い違う / HotPepper が別店として載せている / 1号店と2号店
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dedupeStores, judgePair, mergeGroup, wardOf, looseName } = require('../scripts/lib/store_dedup.js');

const manual = (o) => ({ 'キュレーター': '編集部', '編集部推薦': true, '話題フラグ': true, '話題スコア': 85, ...o });

test('店名完全一致の組は統合され、片方にしか無い食べログURLが残るカードに乗る', () => {
  const a = manual({ '店名': '尾張山荘 くろぎ', 'エリア': '名古屋市中村区', placeId: 'P1', '食べログURL': 'https://tabelog.com/aichi/A2301/A230101/23000001/', 'Instagram': 'https://www.instagram.com/kurogi/', 'おすすめポイント': '編集部の推薦文' });
  const b = { '店名': '尾張山荘 くろぎ', 'エリア': '名駅', placeId: 'P1', '価格帯': '10000円〜', '緯度': '35.1', '経度': '136.8' };
  const r = dedupeStores([a, b]);
  assert.equal(r.stores.length, 1);
  const s = r.stores[0];
  assert.equal(s['食べログURL'], a['食べログURL']);
  assert.equal(s['Instagram'], a['Instagram']);
  assert.equal(s['価格帯'], '10000円〜');
  assert.equal(r.merged.length, 1);
  assert.deepEqual(r.merged[0].reasons, ['name_exact']);
});

test('HotPepper 側を残しても、手動キュレーション店の編集部フィールドは失われない', () => {
  // HotPepper 側の方がフィールドが多い＝こちらが残る
  const hp = { '店名': '松軒亭', 'エリア': '栄ｷﾀ錦/伏見丸の内/泉/東桜/新栄', '住所': '愛知県名古屋市千種区千種１-21-6', 'ホットペッパーID': 'J004576942', placeId: 'P2', 'おすすめポイント': 'HotPepperのキャッチ文', '席数': '20', '定休日': '月', '平均予算': '5000円', 'コース': 'あり', '禁煙': '全席禁煙', mediaFeatures: [{ url: 'https://a.example/1', name: 'A' }] };
  const m = manual({ '店名': '松軒亭', 'エリア': '名古屋市千種区', 'おすすめポイント': '編集部の推薦文', editorReason: '業界人の理由', insiderNote: 'メモ', visitStatus: 'visited', '選定理由': '理由', 'おすすめシーン': ['接待'], 'トレンド情報源': ['https://b.example/'], mediaFeatures: [{ url: 'https://b.example/2', name: 'B' }, { url: 'https://a.example/1', name: 'A' }] });
  const r = dedupeStores([hp, m]);
  assert.equal(r.stores.length, 1);
  const s = r.stores[0];
  assert.equal(s['ホットペッパーID'], 'J004576942', '情報の多い HotPepper 側が残る');
  assert.equal(s['キュレーター'], '編集部');
  assert.equal(s['編集部推薦'], true);
  assert.equal(s['話題フラグ'], true);
  assert.equal(s['話題スコア'], 85);
  assert.equal(s['おすすめポイント'], '編集部の推薦文', '編集部の文が HotPepper の文より優先');
  assert.equal(s.editorReason, '業界人の理由');
  assert.equal(s.insiderNote, 'メモ');
  assert.equal(s.visitStatus, 'visited');
  assert.equal(s['選定理由'], '理由');
  assert.deepEqual(s['おすすめシーン'], ['接待']);
  assert.deepEqual(s['トレンド情報源'], ['https://b.example/']);
  assert.deepEqual(s.mediaFeatures.map((x) => x.url).sort(), ['https://a.example/1', 'https://b.example/2'], '掲載メディアは和集合（重複なし）');
});

test('既に値のあるフィールドは上書きしない／写真は束ごと補う', () => {
  const base = { '店名': '珈琲 ぶりこ', 'エリア': '栄(ミナミ)/矢場町/大須/上前津', '住所': '愛知県名古屋市中区大須2-1', 'ホットペッパーID': 'J000108015', placeId: 'P3', 'Google評価': '4.1', '席数': '10', '定休日': '火' };
  const other = { '店名': '珈琲ぶりこ', 'エリア': '名古屋市中区', placeId: 'P3', 'Google評価': '3.0', '写真URL': 'https://img.example/x.jpg', '写真出所': 'places-owner', '写真クレジット': '珈琲ぶりこ' };
  const { base: out, filled } = mergeGroup([base, other]);
  assert.equal(out['Google評価'], '4.1');
  assert.equal(out['写真URL'], 'https://img.example/x.jpg');
  assert.equal(out['写真出所'], 'places-owner');
  assert.equal(out['写真クレジット'], '珈琲ぶりこ');
  assert.ok(filled.includes('写真URL'));
});

test('写真URL を持つ側の写真クレジットに、別レコードのクレジットを混ぜない', () => {
  const base = { '店名': 'X', 'エリア': '名古屋市中区', '写真URL': 'https://hp.example/a.jpg', '席数': '1', '定休日': '月' };
  const other = { '店名': 'X', 'エリア': '名古屋市中区', '写真URL': 'https://places.example/b.jpg', '写真クレジット': '別人', '写真出所': 'places-user' };
  const { base: out } = mergeGroup([base, other]);
  assert.equal(out['写真URL'], 'https://hp.example/a.jpg');
  assert.equal(out['写真クレジット'], undefined);
  assert.equal(out['写真出所'], undefined);
});

test('区が食い違う組は統合しない（とんかつ朱寿: 手動=中村区 / HotPepper住所=名東区）', () => {
  const a = manual({ '店名': 'とんかつ朱寿', 'エリア': '名古屋市中村区', placeId: 'P4' });
  const b = { '店名': 'とんかつ朱寿', 'エリア': '本山・覚王山・藤が丘', '住所': '愛知県名古屋市名東区香流２-１０１５', 'ホットペッパーID': 'J004558109', placeId: 'P4' };
  const v = judgePair(a, b);
  assert.equal(v.ok, false);
  assert.equal(v.blocker, 'ward_conflict');
  assert.equal(dedupeStores([a, b]).stores.length, 2);
});

test('placeId が食い違う同名店は統合しない', () => {
  const v = judgePair({ '店名': 'もも', placeId: 'A' }, { '店名': 'もも', placeId: 'B' });
  assert.equal(v.blocker, 'placeId_conflict');
});

test('HotPepper が別々のIDで載せている、名前の違う店は placeId が同じでも統合しない', () => {
  const pairs = [
    ['居酒屋 権兵衛 名駅店', '権兵衛 名駅南店'],
    ['Cafe & Bar ゆきっち はなれ', 'Cafe & Bar ゆきっち'],
    ['シャンタムール サウス', 'シャンタムール'],
  ];
  for (const [x, y] of pairs) {
    const v = judgePair(
      { '店名': x, 'ホットペッパーID': 'J1', placeId: 'P', '住所': '愛知県名古屋市中村区名駅1' },
      { '店名': y, 'ホットペッパーID': 'J2', placeId: 'P', '住所': '愛知県名古屋市中村区名駅1' });
    assert.equal(v.ok, false, `${x} / ${y}`);
  }
});

test('1号店と2号店は統合しない', () => {
  const v = judgePair({ '店名': 'YOHAKU COFFEE 今池2号店', placeId: 'P' }, { '店名': 'YOHAKU COFFEE 今池1号店', placeId: 'P' });
  assert.equal(v.ok, false);
});

test('placeId 一致でも、表記揺れ以上に名前が違い区の裏付けも無ければ統合しない', () => {
  const v = judgePair(
    { '店名': '完全個室居酒屋 哉月', 'エリア': '名古屋市中村区', placeId: 'P' },
    { '店名': '居酒屋 哉月', 'エリア': '栄', 'ホットペッパーID': 'J001143580', placeId: 'P' });
  assert.equal(v.ok, false);
  assert.equal(v.blocker, 'no_corroboration');
});

test('placeId 一致＋名前一致＋同じ区なら統合する（読み仮名併記）', () => {
  const v = judgePair(
    { '店名': '那古野 しば福や 名駅店 (なごの しばふくや めいえきてん)', 'エリア': '名古屋市中村区', placeId: 'P' },
    { '店名': '那古野 しば福や 名駅店', 'エリア': '名古屋（名古屋駅/西区/中村区）', '住所': '愛知県名古屋市中村区名駅３丁目２３－１', 'ホットペッパーID': 'J003671888', placeId: 'P' });
  assert.equal(v.ok, true);
  assert.equal(v.reason, 'placeid_match');
});

test('全角空白だけが違う HotPepper の二重掲載は統合する', () => {
  const v = judgePair(
    { '店名': '英吉利西屋 本店', 'ホットペッパーID': 'J004510140', placeId: 'P' },
    { '店名': '英吉利西屋　本店', 'ホットペッパーID': 'J004678947', placeId: 'P' });
  assert.equal(v.ok, true);
});

test('推移的な結合でも区が食い違うレコードは同じグループに入れない', () => {
  const a = { '店名': '店A', 'エリア': '名古屋市中区', placeId: 'P' };
  const b = { '店名': '店A', placeId: 'P' };
  const c = { '店名': '店A', 'エリア': '名古屋市東区' };
  // a=b, b=c は候補だが a と c は区が違う → c は統合されない
  const r = dedupeStores([a, b, c]);
  assert.equal(r.stores.length, 2);
});

test('名前も placeId も違う店には触れない（入力をそのまま返す）', () => {
  const list = [{ '店名': 'A', placeId: '1' }, { '店名': 'B', placeId: '2' }, { '店名': 'C' }];
  const r = dedupeStores(list);
  assert.equal(r.stores.length, 3);
  assert.equal(r.merged.length, 0);
});

test('決定的: 同じ入力から同じ結果', () => {
  const mk = () => [
    { '店名': '串たつ 金山駅店', 'ホットペッパーID': 'J003763594', placeId: 'P', 'Instagram': 'x' },
    { '店名': '串たつ 金山駅店', 'ホットペッパーID': 'J000029144', placeId: 'P' },
  ];
  const r1 = dedupeStores(mk()), r2 = dedupeStores(mk());
  assert.deepEqual(r1.stores, r2.stores);
  assert.deepEqual(r1.merged, r2.merged);
});

test('補助関数: 区の読み取りと店名の表記揺れ', () => {
  assert.equal(wardOf({ '住所': '愛知県名古屋市中村区名駅4' }), '中村区');
  assert.equal(wardOf({ 'エリア': '名古屋市中区錦' }), '中区');
  assert.equal(wardOf({ 'エリア': '昭和区 川名' }), '昭和区');
  assert.equal(wardOf({ 'エリア': '名古屋（名古屋駅/西区/中村区）' }), '');
  assert.equal(wardOf({ 'エリア': '中川区・港区' }), '');
  assert.equal(looseName('焼肉　SEJONG　錦店　（セジョン）'), looseName('焼肉 SEJONG 錦店 セジョン'));
});

test('冪等: 統合済みの結果にもう一度かけても何も統合されず件数が変わらない（再発防止の決定的チェック）', () => {
  const list = [
    { '店名': '串たつ 金山駅店', 'ホットペッパーID': 'J003763594', placeId: 'P', 'Instagram': 'x' },
    { '店名': '串たつ 金山駅店', 'ホットペッパーID': 'J000029144', placeId: 'P' },
    { '店名': '別の店', placeId: 'Q' },
  ];
  const once = dedupeStores(list);
  assert.equal(once.stores.length, 2);
  const twice = dedupeStores(once.stores);
  assert.equal(twice.merged.length, 0);
  assert.equal(twice.stores.length, once.stores.length);
});
