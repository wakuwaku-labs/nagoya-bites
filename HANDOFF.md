status: in_progress

# 目的
Nagoya Bitesの課題管理をNotionからLinearへ移行し、Linearを唯一の作業トラッカーにする。

# 完了条件
- Notionの課題トラッカー全件を漏れなくLinearへ移す。課題本文・ID・状態・優先度・カテゴリ・担当部署・日付を保持する。
- Linear上で件数・必須フィールド・課題本文を照合する。
- 自動起票・同期ルールをLinearへ向け直し、Notionを課題管理に使わない状態にする。
- 元データは移行検証後も安全なアーカイブとして残す。

# できていること
- Linearワークスペース「片桐若登」、チーム「片桐若登」（key `P`）を確認。Orca CLI経由で接続・操作可能。
- Notionの課題トラッカー`collection://6d73b2cb-579b-4772-8ef5-453ccc16833a`を特定。Notionクエリで48行を確認。重複IDやbacklogとの不一致が含まれるため、単純な現行backlog再作成ではなく48行を一件ずつ照合して移す。
- 48件すべてのページ本文を取得。ID、元Notion URL、状態、優先度、カテゴリ、担当部署、検出日・解決日を説明文に保持したCSVを`/tmp/notion-to-linear.csv`に作成。
- 2026-10-05、Orca CLI `linear save-issue` で48件をLinearチーム`P`に作成。Linear上でチームの全52件のうち、移行元ID付き48件を確認。全件の説明文に元Notion URL・ID・属性を保持。
- 状態はTodo 29件、In Progress 17件、Blocked 2件。LinearチームにBlocked状態がないため、Blocked 2件はTodoへ置き、元状態は説明文に保持。優先度は全件を対応付け。
- Orca CLIのLinear接続が利用可能。`LINEAR_API_KEY` 環境変数は未設定のため、CSVインポーター用APIキーは未用意だが、Orca経由の移行には不要だった。
- リポジトリの`agent-backlog.md`を課題定義の正本として使い、Notion同期は`sync_backlog_to_notion.js`、`.notion_sync_state.json`、Claudeルール／CIに埋め込まれている。
- ユーザーがNotionからLinearへの全件移行を明示した。対象は会話文脈上、Notionの課題トラッカーとそれを維持する運用経路。

# 次にやること
- 48件の件名・ID・本文・状態・優先度を元CSVと突合し、重複ID行も別Issueとして残っていることを確認する。
- `agent-backlog.md`、Claudeコマンド／ルール、CI、自動化のNotion同期先を棚卸しし、Linearを進捗管理の唯一の画面にする運用へ切替える。Notion向け書き込みは、Linear側の完全照合と切替後に停止する。
- Linear Issue URLを記録してbacklogから参照できるようにする。backlogを課題仕様の正本として維持するなら、Issue IDによる片方向同期手段を用意する。CIから使う場合は安全なLinear認証を設定する。
- `data/.notion_sync_state.json`とNotion同期実装はロールバック／アーカイブ用に保持し、運用先変更の根拠と手順を文書化する。

# 試したが駄目だったこと
- この実行環境にLinear専用MCPコネクタは見当たらない。Orca CLIの接続は利用できる。
- NotionのAI検索と複数データソースクエリは現プランで利用不可。課題DBの単一データソースqueryと通常の検索/fetchは利用可能。
- `@linear/import` CLIはLinear APIで401となったため使用しなかった。Orca CLI経由で48件を作成できた。

# 守るルール・判断メモ
- Notionの課題トラッカーを削除・アーカイブするのは、Linear側の全件照合と運用切替が完了してからにする。元データを先に消さない。
- 元課題IDはLinearのタイトル/説明に残す。Notion 48件には同一ID重複が確認されているため、Linear内で衝突を隠さずNotion URLも移行記録に含める。
- LinearにBlocked状態はない。今回の2件はTodoにマップした上で、説明文のNotionステータスを残した。専用状態の追加可否または別の運用表現を切替前に決める。
- 既存backlogは選定器と詳細仕様の正本として使われる。Linearを唯一の進捗管理先にしつつ、双方向二重更新を避ける片方向連携を設計する。

# 関連ファイル
- `agent-backlog.md`
- `scripts/next_task.js`
- `scripts/sync_backlog_to_notion.js`
- `data/.notion_sync_state.json`
- `CLAUDE.md`
- `docs/feedback-triage-runbook.md`
