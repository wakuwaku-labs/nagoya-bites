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

- 2026-10-07 「Linear接続を他プロジェクトでも使う」→ 実施済み。ブリーフィング・監視を Project 単位に絞った（誤報 #381 は自動クローズ確認）。汎用キット `~/.claude/skills/linear-setup/`（`/linear-setup`・`.linear.json` で設定・テスト4件）と、グローバル `~/.claude/CLAUDE.md` の「Linear 運用（全プロジェクト共通）」を追加。2026-10-07 に5リポジトリ（自動トークン節約・自動スリープスイッチ・その日の予約まとめ・CPU節約ツール・AI動画作成）へ導入・各 main にコミット済み。空の KR 用 Project 4つは改名して再利用（ISSUE-137/P-64 解決）。今後の新規リポジトリは Claude が自動導入。ADR 0006
- 2026-10-07 追加: 新しいアプリ・フォルダ（git でなくても）と Codex にも拡張。install.js が Linear の Project を自動作成（API キー `~/.config/linear/api_key` は 2026-10-07 にオーナーが配置済み・疎通確認済み）。Codex 用ルールは `~/.codex/AGENTS.md`、キットは `~/.codex/skills/linear-setup`（リンク）。動画生成プロジェクトの汎用テンプレ39件はオーナー判断で全件 Canceled

# 試したが駄目だったこと
- 10/05 は git pull --rebase が HANDOFF.md の競合で停止 → abort して origin/main からのワークツリーで作業した

# 守るルール・判断メモ
- ローカル main で rebase が競合したら、自動では解消しない。abort してワークツリーで作業する（定期タスクの指示にも明記済み）

# 関連ファイル
- docs/feedback-triage-runbook.md / data/feedback_policy.json / data/feedback_health.json
- ~/.claude/scheduled-tasks/nagoya-bites-{feedback,seo}-triage-daily/SKILL.md
