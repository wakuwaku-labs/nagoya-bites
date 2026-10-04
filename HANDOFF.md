status: in_progress

# 目的
Nagoya Bitesの課題管理をNotionからLinearへ移行し、Linearを唯一の作業トラッカーにする。

# 完了条件
- Notionの課題トラッカー全件を漏れなくLinearへ移す。課題本文・ID・状態・優先度・カテゴリ・担当部署・日付を保持する。
- Linear上で件数・必須フィールド・課題本文を照合する。
- 自動起票・同期ルールをLinearへ向け直し、Notionを課題管理に使わない状態にする。
- 元データは移行検証後も安全なアーカイブとして残す。

# できていること
- Linearワークスペース「片桐若登」、チーム「片桐若登」を確認。Linearの担当タスク・Projectsは0件。
- Notionの課題トラッカー`collection://6d73b2cb-579b-4772-8ef5-453ccc16833a`を特定。Notionクエリで48行を確認。重複IDやbacklogとの不一致が含まれるため、単純な現行backlog再作成ではなく48行を一件ずつ照合して移す。
- 48件すべてのページ本文を取得。ID、元Notion URL、状態、優先度、カテゴリ、担当部署、検出日・解決日を本文とラベルに残し、Linearの標準状態・優先度へ対応づけるCSVを`/tmp/notion-to-linear.csv`に作成。
- Linear公式の`@linear/import` CLIを調査。Linear CSV形式で全件インポートできる。現在のCLI認証は401となり、Linear APIキーが必要。
- リポジトリの`agent-backlog.md`を課題定義の正本として使い、Notion同期は`sync_backlog_to_notion.js`、`.notion_sync_state.json`、Claudeルール／CIに埋め込まれている。
- ユーザーがNotionからLinearへの全件移行を明示した。対象は会話文脈上、Notionの課題トラッカーとそれを維持する運用経路。

# 次にやること
- Linearの全チーム権限APIキーを新規作成する必要があるか、ユーザーの確認待ち。
- 48件を内容照合し、重複ID・終了済み・ローカルbacklogにない課題を保持したまま識別する。
- Linearに移行し、件数と主要フィールドを照合する。
- Notion自動同期・説明文・運用手順をLinearへ置き換え、既存stateはロールバック用に保管する。
- Linearへのリンクを`agent-backlog.md`に追記し、backlogを定義・選定のソース、Linearを進捗・作業の唯一の管理画面にするか、両方を一方向同期する構成を実装する。

# 試したが駄目だったこと
- この実行環境にLinear専用MCPコネクタは見当たらない。LinearアプリにはConnect Codexの導線がある。
- NotionのAI検索と複数データソースクエリは現プランで利用不可。課題DBの単一データソースqueryと通常の検索/fetchは利用可能。
- Linear CLIをCSV選択まで進めたが、既存認証はLinear APIで401になり、データ書き込み前に停止した。

# 守るルール・判断メモ
- Notionの課題トラッカーを削除・アーカイブするのは、Linear側の全件照合と運用切替が完了してからにする。元データを先に消さない。
- 元課題IDはLinearのタイトル/説明に残す。Notion 48件には同一ID重複が確認されているため、Linear内で衝突を隠さずNotion URLも移行記録に含める。
- 既存backlogは選定器と詳細仕様の正本として使われる。Linearを唯一の進捗管理先にしつつ、双方向二重更新を避ける片方向連携を設計する。

# 関連ファイル
- `agent-backlog.md`
- `scripts/next_task.js`
- `scripts/sync_backlog_to_notion.js`
- `data/.notion_sync_state.json`
- `CLAUDE.md`
- `docs/feedback-triage-runbook.md`
