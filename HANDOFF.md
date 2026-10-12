status: blocked

# 目的
オーナーの依頼（2026-10-12）「日次ジャーナルをもとに X へ毎日の発信を投稿まで全自動にしたい。まず計画書を、確認事項と現状調査をしっかり行ったうえで作って」への対応。
（前のメモ「GA4 訪問者増の検証」は status: done。内容は git 履歴 c49bf60faf の HANDOFF.md）

# 完了条件
- 現状調査（ジャーナルの公開フロー・既存のSNS資産・写真ルール・X API の最新条件）を終える
- 計画書 `docs/x-auto-posting-plan-2026-10.md` を書き、確認事項を番号つきでまとめる
- 実装はオーナーの確認後（費用・アカウント認証が絡むため）

# できていること
- 調査（リポジトリ／X API 公式の料金・ルール）を終え、計画書 `docs/x-auto-posting-plan-2026-10.md` を作成
- backlog に SNS-001〜005 を起票し、Linear に P-293（親）と P-294〜297（子）を作成（全体の同期 --apply は他の課題を 86 件更新しようとしたため使わず、SNS だけを同じ引数で作成）
- npm test 1061 件通過

# 次にやること
- オーナーの確認（計画書 11 章 #1〜#8。特に #1 既存の外部の仕組みと二重にならないか、#3 費用）を待つ
- 決まったら P-294（オーナーの鍵の発行）と並行して P-295（スクリプト）から実装

# 試したが駄目だったこと
- `node scripts/sync_backlog_to_linear.js --apply` は使わない: このワークツリーの同期状態では SNS 以外に 86 件の更新・5 件の重複処理が出る（Linear 側で進んだ状態を戻す恐れ）
- Orca の接続が1回切れた（SNS-004）。一覧で重複が無いのを確かめてから作り直した

# 守るルール・判断メモ
- SNS投稿はオーナーがリポジトリ外の別の仕組みで運用中（2026-09-14 確認・memory sns-posting-outside-repo-utm）。重複投稿にならないよう、既存の仕組みとの関係を確認事項の筆頭に置く
- 写真: HotPepper 写真の複製保存・再配信は規約で禁止 → X への画像アップロードは使わず、リンクカード（og:image）で見せる方向
- 課金（X API）とオーナーのアカウント認証は本人にしかできない
- X API は 2026-02 頃に従量課金へ。リンク付き投稿 0.20 ドル/回（docs.x.com の料金ページで 2026-10-12 に確認）
- 過去の方針「外部発信は自動化しない」（SEO-055 ④・SEO-098）を覆すので、実装時に docs/decisions/0023 を書く（P-297）

# 関連ファイル
- docs/x-auto-posting-plan-2026-10.md（計画書）
- scripts/run_journal_local.sh / scripts/generate_daily_draft.js / data/journal_sns_draft_policy.json / docs/sns-utm-convention.md
