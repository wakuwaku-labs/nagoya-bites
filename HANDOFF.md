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
1. PR #759 と #762 は merge_chain.sh で順にマージ中（記録 /private/tmp/claude-501/-Users-katagirijakutou-orca-workspaces-nagoya-bites-sandworm/b5398d59-8bf7-4a05-8d12-08cf9ef90118/scratchpad/chain-759-762.log）。`gh pr view 759 762 --json state` で MERGED とビルドの成功を確かめる。STOP なら原因を見て再実行（CONFLICTING は該当 worktree で origin/main を取り込み直す）
2. #762 は design-qa 合格・軽微5件修正済み。マージ後に本番の記事末尾で部品が出ることを確かめる
3. W-F（書き手の事実台帳→S4-5 再測定）が作業中。PR が出たら（`gh pr list`）s4-5-calibration.md の前後の数字を確認してマージ（enforce にはしない）
4. 第2波の残り: S6-1 トップを記事中心に（#759 マージ後・index.html/build.js。決定2: 題の案を2〜3案画面つきで用意し推奨で実装、本人に最後に見せる）／S5-5 鮮度の見張り＋S7-1 信頼の指標＋S7-3 KPI 文書（#759・#760 の後）
5. 本線の統合 PR: registry 行（各 PR 本文の「registry に足す行」）・ADR 0072〜（各 PR 本文の「ADR に書く判断」）・旧 ADR 0010/0035/0032/0021/0015/0007 に「0069 で置き換え」追記・build.yml に棚卸し台帳の週次更新・取り下げ記事を sitemap から外す（gen-store-pages.js の journalFiles）
6. 全部終わったら Ondine #2051〜#2055 に report→done、最終チェック、本人へまとめて確認

## 最後に本人へまとめて聞くこと
- X の月額利用上限（X API 403 monthly spend cap）に達している→Billing で上限を上げるか（投稿・削除が通らない）
- 日曜をガイドの回に変えた（#754）／帯「AIが作成」の文言・店選びガイドの最少10店（#756）
- 焼き鳥2本の寄せ先 nagoya-yakitori／「業界人の推薦」系2本を kospa-insider へ／季節切れ4本は noindex しない／懐石・接待ランチ・予約困難の作り替え（#757・docs/plans/media-policy-2026-11/s5-3-candidates.md）
- 一覧の並びを駅から近い順に／「口コミ信頼度」の名前を残す／件数・時点が無い店は星を出さない／特集は番号を外したが並びは今月はスコア順のまま（来月の入れ替えでエリア順）（#759）
- S4-5 の enforce 切替（W-F の再測定結果つき）・自動修正の対象を重要な文に絞る・読み手のモデル固定
- 読者の声の実送信テスト（記事で「ひとこと」を1回送り Gmail に届くか）（#762）
- S6-1 の題の案
- 記事ページのフッターの「情報の誤りやご意見は こちら」の行を残すか（#762 で誤りを知らせる道が2つになった）

## 守るルール・判断メモ
- ワーカーは PR まで、マージは本線が merge_chain.sh で1本ずつ。本番の自動公開の条件は変えない（決定6）／削除は一覧を本人に見せてから／流入記事は足すだけ
- 並行で npm test を2つ走らせると note の見出し画像テストがブラウザの取り合いで落ちる（変更とは無関係）
- 特集を refresh_feature_rosters.js で作り直すと掲載店が入れ替わる（今月分は済み）。番号外しは機械的な置換で行う

## 関連ファイル
- docs/plans/media-policy-2026-11/03-implementation-plan.md・docs/decisions/0069・s4-5-calibration.md・s5-3-candidates.md・s6-2-claims-table.md
