'use strict';

/**
 * build.js の射影関数の単体テスト（店舗モーダル再設計・2026-09）。
 * ローカルには HOTPEPPER_API_KEY が無く `node build.js` で HotPepper 取得が走らないため、
 * 「API のレスポンス → 店舗レコード」の射影を fixture で検算する。
 *  - HotPepper の 定休日/最寄駅/席数/個室/設備 が落ちずに入ること
 *  - "なし"/"利用不可" 系の否定情報は空になり、出力（slimStoreForOutput）から消えること
 *  - 手動キュレーション店の 選定理由/おすすめシーン/価格帯目安 が既存レコードへ持ち越されること
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  hpShopToStoreRecord, manualStoreToRecord, mergeManualStores, hpAvailability, slimStoreForOutput,
} = require('../build.js');

const HP_SHOP = {
  id: 'J000000001',
  name: 'テスト居酒屋 栄店',
  address: '愛知県名古屋市中区栄3-1-1 テストビル2F',
  lat: 35.168, lng: 136.908,
  genre: { name: '居酒屋' },
  sub_genre: { name: '和食' },
  middle_area: { name: '栄' },
  budget: { name: '3001～4000円', average: '3500円' },
  open: '月～金: 17:00～翌0:00 土、日、祝日: 16:00～',
  close: '不定休（年末年始）',
  station_name: '栄',
  access: '地下鉄栄駅 8番出口より徒歩3分',
  catch: '名古屋コーチンと地酒 × 完全個室',
  capacity: 48,
  party_capacity: 40,
  private_room: 'あり ：4名～個室あり',
  card: '利用可',
  non_smoking: '全面禁煙',
  parking: 'なし ：近隣にコインパーキングあり',
  lunch: 'なし',
  course: 'あり',
  free_drink: 'あり',
  free_food: '利用不可',
  photo: { pc: { l: 'https://imgfp.hotp.jp/IMGH/00/00/P000000000/P000000000_238.jpg' } },
};

test('hpAvailability: 否定情報は空、肯定情報は短い文字列で残る', () => {
  assert.equal(hpAvailability('なし'), '');
  assert.equal(hpAvailability('利用不可'), '');
  assert.equal(hpAvailability('なし ：近隣にコインパーキングあり'), '');
  assert.equal(hpAvailability('あり ：4名～個室あり'), 'あり ：4名～個室あり');
  assert.equal(hpAvailability('利用可'), '利用可');
  assert.equal(hpAvailability(''), '');
  assert.equal(hpAvailability(undefined), '');
});

test('hpShopToStoreRecord: 予約判断に効く項目が射影される', () => {
  const rec = hpShopToStoreRecord(HP_SHOP);
  assert.equal(rec['店名'], 'テスト居酒屋 栄店');
  assert.equal(rec['定休日'], '不定休（年末年始）');
  assert.equal(rec['最寄駅'], '栄');
  assert.equal(rec['席数'], '48');
  assert.equal(rec['宴会収容'], '40');
  assert.equal(rec['個室'], 'あり ：4名～個室あり');
  assert.equal(rec['カード可'], '利用可');
  assert.equal(rec['禁煙'], '全面禁煙');
  assert.equal(rec['駐車場'], '');          // 「なし ：…」は否定情報なので空
  assert.equal(rec['ランチ'], '');
  assert.equal(rec['コース'], 'あり');
  assert.equal(rec['飲み放題'], 'あり');
  assert.equal(rec['食べ放題'], '');
  assert.equal(rec['キャッチ'], '名古屋コーチンと地酒 × 完全個室');
  assert.equal(rec['サブジャンル'], '和食');
  assert.equal(rec['平均予算'], '3500円');
  // 既存項目は退行しない
  assert.equal(rec['価格帯'], '3001～4000円');
  assert.equal(rec['住所'], '愛知県名古屋市中区栄3-1-1 テストビル2F');
  assert.equal(rec['写真URL'], 'https://imgfp.hotp.jp/IMGH/00/00/P000000000/P000000000_480.jpg');
});

test('hpShopToStoreRecord: 項目が無い店でも例外にならず空で埋まる', () => {
  const rec = hpShopToStoreRecord({ id: 'J1', name: 'x' });
  assert.equal(rec['定休日'], '');
  assert.equal(rec['席数'], '');
  assert.equal(rec['個室'], '');
  assert.equal(rec['最寄駅'], '');
  assert.deepEqual(Object.keys(slimStoreForOutput(rec)).filter(k => ['定休日', '席数', '個室', '駐車場', 'ランチ'].includes(k)), []);
});

test('slimStoreForOutput: 否定情報（空文字）は出力から消える', () => {
  const out = slimStoreForOutput(hpShopToStoreRecord(HP_SHOP));
  assert.ok(!('駐車場' in out));
  assert.ok(!('ランチ' in out));
  assert.ok(!('食べ放題' in out));
  assert.equal(out['個室'], 'あり ：4名～個室あり');
  assert.equal(out['定休日'], '不定休（年末年始）');
});

const MANUAL = {
  '店名': '手動の鮨店',
  'エリア': '伏見',
  '都道府県': '愛知県',
  'ジャンル': '寿司',
  'アクセス': '名古屋 伏見駅 徒歩5分',
  'キュレーター': 'editor',
  '追加日': '2026-09-01',
  '編集部推薦': true,
  '選定理由': '2026年3月にオープンしたばかりの新しい寿司店で、評価が既に高い。',
  '選定柱': 'PILLAR_A',
  'おすすめシーン': ['デート', '接待', '記念日'],
  '価格帯目安': '¥10,000〜¥15,000',
  '食べログ評価': 3.62,
};

test('manualStoreToRecord: 選定理由・おすすめシーン・価格帯目安・食べログ評価が射影される', () => {
  const rec = manualStoreToRecord(MANUAL);
  assert.equal(rec['選定理由'], MANUAL['選定理由']);
  assert.deepEqual(rec['おすすめシーン'], ['デート', '接待', '記念日']);
  assert.equal(rec['価格帯目安'], '¥10,000〜¥15,000');
  assert.equal(rec['食べログ評価'], '3.62');
  const rec2 = manualStoreToRecord({ '店名': 'a' });
  assert.equal(rec2['選定理由'], '');
  assert.deepEqual(rec2['おすすめシーン'], []);
  assert.deepEqual(slimStoreForOutput(rec2)['おすすめシーン'], []); // 空配列は空値扱いではない（runtime は length で判定）
});

test('mergeManualStores: 既存店（店名+エリア一致）へ編集情報を持ち越す', () => {
  const existing = [{ '店名': '手動の鮨店', 'エリア': '伏見', 'ホットペッパーID': 'J9', '価格帯': '' }];
  const added = mergeManualStores(existing, [manualStoreToRecord(MANUAL)], new Set(['J9']));
  assert.equal(added.length, 0);
  assert.equal(existing[0]['選定理由'], MANUAL['選定理由']);
  assert.deepEqual(existing[0]['おすすめシーン'], ['デート', '接待', '記念日']);
  assert.equal(existing[0]['価格帯目安'], '¥10,000〜¥15,000');
  assert.equal(existing[0]['食べログ評価'], '3.62');
  assert.equal(existing[0]['__manual'], true);
});
