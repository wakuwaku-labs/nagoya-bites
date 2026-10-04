status: in_progress

# 目的
Linearを活用し、Nagoya Bitesの作業を見つけやすく、着手・継続・完了しやすくする。

# 完了条件
- Linearと既存の課題管理（`agent-backlog.md`／Notion）の役割を整理する。
- Linear上で作業を始める導線を整え、少なくとも1件の具体的タスクを次の行動まで分解する。
- Codex連携の要否を確認し、承認された範囲で実施する。

# できていること
- Linearワークスペース「片桐若登」、チーム「片桐若登」を確認。
- Linearの担当タスクは0件、チームのProjectsも0件。
- Linearには「Connect Codex」の案内がある。
- リポジトリでは`agent-backlog.md`が課題の詳細・優先度・受け入れ条件を管理し、`scripts/next_task.js`が着手候補を選ぶ。採用課題のNotion同期も既存ルールに記載されている。
- `node scripts/next_task.js --all`で2026-10-05時点の候補を確認。直近のready候補にはSEO-114（ジャーナル末尾の地域リンク不整合）がある。
- LinearをCodexに接続するとワークスペースへのアクセスが追加されるため、ユーザーの判断待ち。

# 次にやること
- ユーザーの選択を受け、Linear連携を承認された範囲で有効化するか、既存システムと二重管理しない運用案をまとめる。
- Linearを使う場合は、まず単一の課題（例: SEO-114）で、目的・受け入れ条件・次の一手を記載したパイロットを行う。
- 正本をどこにするか、Linearと`agent-backlog.md`／Notionの同期方法を決める。同期方法が決まるまで同じ課題を複数箇所に新規登録しない。

# 試したが駄目だったこと
- この実行環境にLinear専用MCPコネクタは見当たらなかった。
- Linearの画面上から担当タスクとProjects一覧を確認したが、既存タスク・プロジェクトはなかった。

# 守るルール・判断メモ
- `agent-backlog.md`とNotionには既存の自動化・運用規則がある。Linearを加える前に正本と同期責任を決め、二重管理を避ける。
- ワークスペースへのCodex接続はアクセス範囲を拡大する操作なので、ユーザーの明示的な選択を待つ。
- Linearのステータスは実作業の状態と一致させる。作業していない課題を進行中にしない。

# 関連ファイル
- `agent-backlog.md`
- `scripts/next_task.js`
- `CLAUDE.md`
- `docs/feedback-triage-runbook.md`
