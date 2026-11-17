status: in_progress

# 基本方針の段階3〜7を完了まで実行する（Ondine #2051〜#2055・2026-11-17）

## 目的
本人 11-17「計画の完了まで早めに実行。承認・確認・質問はすべて終わってから最後にまとめて」。計画 docs/plans/media-policy-2026-11/03-implementation-plan.md の S3-1〜S7-3 を実装し main に入れる。最初の依頼は「計画の進捗確認」と「今日のジャーナルが出ていない確認」（11-17 公開済み・本番 200 確認）。

## 完了条件
各施策の⑪完了を満たし、npm test 通過・main 合流・本番確認。本人の承認が要るものは準備まで進めて最後にまとめて聞く。各 Ondine 課題に report → done。

## できていること（main に入った）
- #755 特集テストの同期前失敗 / #758 Autopilot ブランチでもジャーナルを公開まで運ぶ / #761 pick_daily_topic の曜日が UTC でずれる
- #754 S3-3 3分類・S4-4 取り下げ/訂正 / #756 S3-1・S3-2・S3-4 / #757 S6-2・S5-2・S5-3(一覧だけ) / #760 S4-1〜S4-3 shadow・S4-5 測定（合格線未達）
- 11-17 ジャーナル公開（~/nagoya-bites の main を origin に合わせ、旧コミットは backup/main-local-2026-11-17）

## 次にやること
- 段階3〜7の実装は main・本番に入った（#754〜#766）。GAS も配備済み
- 本人 11-17 夕「全て推奨で」: 題 A のまま／S4-5 は台帳が1〜2週たまってから再測定（待つ）／推奨で決めた事項はすべてそのまま／季節切れ4本は noindex しない
1. 【済 #767・本番で転送確認・#2053 に report】寄せる2組（nagoya-yakitori-guide→nagoya-yakitori、industry-insiders-pick→kospa-insider）を作業役が worktree ~/nagoya-bites/.claude/worktrees/policy-s5-3-merge（ブランチ wakuwaku-labs/policy-s5-3-merge）で実装中。`gh pr list` で PR を見つけ、npm test・audit_stub_links・audit_internal_links の通過を確認して merge_chain.sh でマージ→本番で寄せ元が寄せ先へ飛ぶことを確認→Ondine #2053 に report（過去記事203本の見直しは継続中なので doing のまま）
2. 【report 済】Ondine #2052 は本人「推奨どおり待つ」。再測定は 2026-12-01 ごろ（実物の台帳 data/journal_claims/*.ledger.json が2週分たまってから claims_gate_calibrate.js）→その時に enforce の承認を聞く
3. X: 上限は上げなくてよい（毎日の投稿は 11-14 以降すべて成功。上限で止まったのは 11-13 の削除だけ）。11-13 に本人が頼んだ投稿 2120705656470810885 の削除は 11-17 に完了
4. iPhone 実機の確認（検索の帯・ひとこと欄の拡大・Gmail 着信）は本人の返事待ち
- merge_chain.sh: /private/tmp/claude-501/-Users-katagirijakutou-orca-workspaces-nagoya-bites-sandworm/b5398d59-8bf7-4a05-8d12-08cf9ef90118/scratchpad/merge_chain.sh

## 最後に本人へまとめて聞くこと
- X の月額利用上限（X API 403 monthly spend cap）に達している→Billing で上限を上げるか（投稿・削除が通らない）
- 日曜をガイドの回に変えた（#754）／帯「AIが作成」の文言・店選びガイドの最少10店（#756）
- 焼き鳥2本の寄せ先 nagoya-yakitori／「業界人の推薦」系2本を kospa-insider へ／季節切れ4本は noindex しない／懐石・接待ランチ・予約困難の作り替え（#757・docs/plans/media-policy-2026-11/s5-3-candidates.md）
- 一覧の並びを駅から近い順に／「口コミ信頼度」の名前を残す／件数・時点が無い店は星を出さない／特集は番号を外したが並びは今月はスコア順のまま（来月の入れ替えでエリア順）（#759）
- S4-5 の enforce 切替: 再測定は合格線を満たす（13/13 は機械が作った台帳での値）。推奨は本物の台帳が数日たまるまで shadow。自動修正の道 57%（enforce だとほぼ毎日価格文が「未確認」に書き直される）を許容するか／台帳を必須にするか・自動修正の対象を重要な文に絞る・読み手のモデル固定
- iPhone 実機でひとこと欄の拡大が無いか・読者の声の実送信テスト（記事で「ひとこと」を1回送り Gmail に届くか）（#762）
- S6-1 の題の案（推奨 A「飲食店選びの失敗を、情報の力で減らす。」・B/C は PR #764 本文）・スマホの最初の画面が文字だけになった点
- #765: apply_light（軽い数字の自動訂正）の有効化・悪化の許容の暫定値
- 記事ページのフッターの「情報の誤りやご意見は こちら」の行を残すか（#762 で誤りを知らせる道が2つになった）

## 守るルール・判断メモ
- ワーカーは PR まで、マージは本線が merge_chain.sh で1本ずつ。本番の自動公開の条件は変えない（決定6）／削除は一覧を本人に見せてから／流入記事は足すだけ
- 並行で npm test を2つ走らせると note の見出し画像テストがブラウザの取り合いで落ちる（変更とは無関係）
- 特集を refresh_feature_rosters.js で作り直すと掲載店が入れ替わる（今月分は済み）。番号外しは機械的な置換で行う

## 関連ファイル
- docs/plans/media-policy-2026-11/03-implementation-plan.md・docs/decisions/0069・s4-5-calibration.md・s5-3-candidates.md・s6-2-claims-table.md
