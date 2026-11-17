status: in_progress

# 基本方針の段階3〜7を完了まで実行する（Ondine #2051〜#2055・2026-11-17）

## 目的
本人 11-17「計画の完了まで早めに実行。承認・確認・質問はすべて終わってから最後にまとめて」。計画 docs/plans/media-policy-2026-11/03-implementation-plan.md の S3-1〜S7-3 を実装し main に入れる。

## 完了条件
各施策の⑪完了を満たし、npm test 通過・main 合流・本番確認。本人の承認が要るもの（S4-5 の enforce 切替・S5-3 の削除・S6-1 の題の案）は準備まで進めて最後にまとめて聞く。

## できていること
- 段階0〜2・削減は完了（#746〜#751）
- 11-17 朝のジャーナル HOLD（~/nagoya-bites の main に未 push の計画コミットが残り衝突）→ backup/main-local-2026-11-17 に退避し main を origin に合わせて再実行中

## 次にやること（並行の持ち分）
- W-A: S3-1→S3-2→S3-4（editorial_standard・journal/_template.html・generate_daily_draft.js・nb.css・note/x 引用）＋S4-4 の訂正履歴欄
- W-B: S3-3→S4-4（3分類・journal index・pick_daily_topic・取り下げ/訂正の道具）
- W-C: S4-1→S4-2→S4-3→S4-5 の測定まで（enforce にはしない）
- W-D: S5-1→S5-4（棚卸し台帳・一覧と店舗ページの順位/点数表示をやめる）
- W-E: S5-2・S5-3（削除は一覧だけ）・S6-2（features/ 担当）
- 第2波: S5-5・S6-1・S7-1〜3（本線）

## 守るルール・判断メモ
- ワーカーは PR まで。マージは本線が1本ずつ build.yml を待って行う。registry/CLAUDE.md 索引・ADR 番号は本線が統合時に付ける
- 本番の自動公開の条件は変えない（決定6）／削除は一覧を本人に見せてから／流入記事は足すだけ

## 最後に本人へまとめて聞くこと
- （作業中に追記）

## 関連ファイル
- docs/plans/media-policy-2026-11/03-implementation-plan.md・docs/decisions/0069
