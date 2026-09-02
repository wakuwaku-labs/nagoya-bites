'use strict';
/**
 * 話題フラグ/編集部推薦を許可してよいか（＝出典URLが後から第三者が検算できる実URLか）
 * を判定する唯一の情報源（ISSUE-120）。
 *
 * 背景: 2026-09-02、「焼きそばスタンド らふ」の出典URLに番組名等のテキストラベル
 * （例:「東海テレビ yum-yumグルメ」）しか無いまま、話題スコア80/100が「話題沸騰」
 * バッジとして本番カードに表示されていた。build.js（LOCAL_STORES/カード表示）側だけ
 * 判定を直したところ、data/manual_stores.json を直接読む pick_daily_trending5.js
 * （「今日の話題店」TOP5選定）はこのゲートを経由しないため、同じ店が編集部推薦タグ
 * 付きでTOP5に居座り続ける事故になった。判定器を1本に集約し、両方が同じ結果を返す
 * ことを保証する（CLAUDE.md 制約10・品質ゲート原則1「合否を分ける入力は後から第三者が
 * 確認できるものに限る」）。
 *
 * 出典URLが空配列（未記載）の店は対象外＝従来通り許容する。人手キュレーションの
 * 既存店（矢場とん本店等の著名店）まで一律に縛ると、実在が明らかな店の表示まで
 * 壊してしまうため（詳細は agent-backlog.md [ISSUE-120] の「意図的にやらなかったこと」）。
 * ここで弾くのは「出典を書いているのに検算できない」ケースだけに絞る。
 */
function hasVerifiableSource(sourceUrlsRaw) {
  const urls = Array.isArray(sourceUrlsRaw) ? sourceUrlsRaw : (sourceUrlsRaw ? [sourceUrlsRaw] : []);
  if (urls.length === 0) return true;
  return urls.some((u) => typeof u === 'string' && /^https?:\/\//.test(u));
}

module.exports = { hasVerifiableSource };
