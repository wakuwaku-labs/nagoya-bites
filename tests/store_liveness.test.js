'use strict';

/**
 * 営業実体監査のテキスト判定（scripts/audit_store_liveness.js の classifyText）の単体テスト。
 *
 * このゲートが守るもの:
 *   閉店した店が掲載され続けること（2026-06-11「餃子歩兵 名古屋泉店」混入の再発防止）。
 *   HARD 判定は CI を止める＝**以降のステップが全て skip される**ため、
 *   誤検出はデータの commit & push ごと止めてしまう（2026-08-28〜29 に実際に発生し、
 *   写真を含む一切の書き戻しが8日間止まっていた）。
 *   よって「見逃さないこと」と同じ重みで「誤って止めないこと」も守る必要がある。
 *
 * 固定してあるのは実データ由来の対。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyText } = require('../scripts/audit_store_liveness.js');

test('状態欄が閉店を宣言していれば HARD（掲載不可）', () => {
  assert.equal(classifyText({ '営業状況': '2026年2月閉業' }).level, 'hard');
  assert.equal(classifyText({ '営業ステータス': '閉店済' }).level, 'hard');
});

test('地の文だけに閉店ワードがあり、状態欄が無ければ従来どおり HARD', () => {
  const r = classifyText({ 'おすすめポイント': '2023年9月に閉業した名店。' });
  assert.equal(r.level, 'hard');
  assert.equal(r.種別, '閉店ワード');
});

test('状態欄が開店を明言していれば、地の文の閉店ワードは WARN に落とす', () => {
  // 実データ: まるや本店 名古屋駅メイチカ店（2026-08-28 追加・2026年9月4日オープンの新店）。
  // 紹介文の「閉業」は名鉄百貨店＝別の店の話であり、この店の状態ではない。
  const r = classifyText({
    '営業状況': '2026年9月4日オープン',
    'おすすめポイント': '2026年2月の名鉄百貨店閉業で閉店した名駅店へ寄せられた1,000件超の声に応えた再出店で、名古屋駅地下街メイチカに構える。',
  });
  assert.equal(r.level, 'warn', 'オープン予定の新店が閉店確定と判定された');
  assert.match(r.詳細, /閉業/);
  assert.match(r.詳細, /2026年9月4日オープン/, '判断根拠（状態欄の文言）が記録に残っていない');
});

test('状態欄が開店を明言していても、状態欄自身の閉店ワードは HARD のまま', () => {
  // 「オープン」の一語で閉店宣言を無効化できてしまうと抜け穴になる。
  // 免除されるのはあくまで**地の文**の語だけであることを固定する。
  const r = classifyText({ '営業状況': '2026年9月オープン、2026年12月閉業' });
  assert.equal(r.level, 'hard');
  assert.equal(r.種別, '閉店ワード(状態欄)');
});

test('移転・一時休業は WARN（店は存続しうる）', () => {
  assert.equal(classifyText({ 'おすすめポイント': '2026年に移転しました。' }).level, 'warn');
  assert.equal(classifyText({ '備考': '一時休業中' }).level, 'warn');
});

test('該当ワードが無ければ何も返さない', () => {
  assert.equal(classifyText({ 'おすすめポイント': '名古屋の老舗うなぎ店。' }), null);
  assert.equal(classifyText({}), null);
});
