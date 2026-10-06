status: done

# 目的
消費者フィードバック triage（2026-10-05 定期実行）の後始末として、残っていたリスク2件を解消する。
（前のメモ「Linear初心者向けの橋渡し」は status: done で完了済み。内容は git 履歴 7688e39ce8 以前の HANDOFF.md を参照）

# 完了条件
- ローカルの main が origin/main と一致している
- 稼働中の定期タスクの指示が Notion ではなく Linear 同期を指している

# できていること
- 2026-10-05 フィードバック triage: 新着0件（3段階の検索すべて0件）。心拍を push 済み（5a0c92576a）
- ローカル main の分岐を解消: 残っていた差分は HANDOFF.md の status 1行だけ。upstream は bot の自動コミットのみで重なりなし → rebase して push（7688e39ce8）。ahead/behind 0
- 定期タスクの指示を Linear 前提に更新（~/.claude/scheduled-tasks/ 配下・リポジトリ外）
  - nagoya-bites-feedback-triage-daily: Notion 同期 → sync_backlog_to_linear.js。古い Gmail クエリ記述（2d）を policy 参照に変更、心拍 Step 9 の明記、rebase 競合時は abort してワークツリーで作業する手順を追加
  - nagoya-bites-seo-triage-daily: Notion MCP 同期 → sync_backlog_to_linear.js

# 次にやること
- なし。nagoya-bites-solve-next-daily は無効化中のため Notion 記述を残している（再有効化するときは Linear 前提に書き換える）

- 2026-10-07 オーナー質問「Linear接続を他プロジェクトでも使いたい」。調査: Orca の Linear 接続はMac単位で全リポジトリ共通。スクリプトは workspace/team P/teamId を直書き、ブリーフィング・監視は team 単位で Project で絞っていない。提案: ①アプリごとに Linear Project を分ける（ADR 0003 見直し条件）②共通ルールを ~/.claude/CLAUDE.md へ ③スクリプトを `.linear.json` 設定で汎用化しユーザースキル `/linear-setup` で各リポジトリへ導入 ④LINEAR_API_KEY は org secret か各repoへ。どのプロジェクトから始めるかオーナー回答待ち。

# 試したが駄目だったこと
- 10/05 は git pull --rebase が HANDOFF.md の競合で停止 → abort して origin/main からのワークツリーで作業した

# 守るルール・判断メモ
- ローカル main で rebase が競合したら、自動では解消しない。abort してワークツリーで作業する（定期タスクの指示にも明記済み）

# 関連ファイル
- docs/feedback-triage-runbook.md / data/feedback_policy.json / data/feedback_health.json
- ~/.claude/scheduled-tasks/nagoya-bites-{feedback,seo}-triage-daily/SKILL.md
