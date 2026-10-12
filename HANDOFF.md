status: in_progress

# 目的
オーナーの依頼（2026-10-12）「日次ジャーナルをもとに X へ毎日の発信を投稿まで全自動にしたい。まず計画書を、確認事項と現状調査をしっかり行ったうえで作って」への対応。
（前のメモ「GA4 訪問者増の検証」は status: done。内容は git 履歴 c49bf60faf の HANDOFF.md）

# 完了条件
- 現状調査（ジャーナルの公開フロー・既存のSNS資産・写真ルール・X API の最新条件）を終える
- 計画書 `docs/x-auto-posting-plan-2026-10.md` を書き、確認事項を番号つきでまとめる
- 実装はオーナーの確認後（費用・アカウント認証が絡むため）

# できていること
- 調査を2本並行で開始（リポジトリ / X API の Web 調査）

# 次にやること
- 調査結果で計画書を書く → コミット → Linear に起票

# 試したが駄目だったこと
- なし

# 守るルール・判断メモ
- SNS投稿はオーナーがリポジトリ外の別の仕組みで運用中（2026-09-14 確認・memory sns-posting-outside-repo-utm）。重複投稿にならないよう、既存の仕組みとの関係を確認事項の筆頭に置く
- 写真: HotPepper 写真の複製保存・再配信は規約で禁止 → X への画像アップロードは使わず、リンクカード（og:image）で見せる方向
- 課金（X API）とオーナーのアカウント認証は本人にしかできない

# 関連ファイル
- docs/x-auto-posting-plan-2026-10.md（計画書・作成予定）
- scripts/run_journal_local.sh / scripts/generate_daily_draft.js / data/journal_sns_draft_policy.json / docs/sns-utm-convention.md
