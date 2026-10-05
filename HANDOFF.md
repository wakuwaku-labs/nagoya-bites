status: done

# 目的
Linear初心者でも、課題を見つけて内容を理解し、作業を依頼・確認・完了できる橋渡しを整える。

# 完了条件
- 初心者向けの短く実用的なLinear使い方ガイドがある。
- Linearの課題とagent-backlog.md、Orca CLI、開発作業の関係が一貫して説明される。
- はじめての課題選び・着手・質問・ブロック・完了の流れが明確。
- 既存運用ドキュメントから新ガイドへ迷わず進める。
- 既存状態を確認し、ドキュメント・設定の差分と残リスクを点検する。

# できていること
- 前回の移行は完了済み。Notion課題48件をLinearへ移行し、CIからQA課題を起票する仕組みも追加済み。
- 現在のブランチは `codex/handoff-done`。調査開始時は作業ツリーがクリーンで、今回の変更は未コミット。ブランチは `origin/main` と1コミットずつ分岐している。
- 既存の `docs/linear-task-workflow.md` と `/sync-backlog`、`/solve-next` を確認。詳細前提や開発者向け説明が多く、初心者が最初に選ぶ操作が見えにくい。
- `docs/linear-beginner-guide.md` を追加。課題の探し方、IDを使った依頼、進捗・質問・ブロック・完了の伝え方、Linearとbacklogの役割を説明。
- `/solve-next` がLinear Issue ID・backlog IDを受け取り、指定課題から開始できるように手順を拡張。引数なしの候補選定は従来どおり。
- `docs/linear-task-workflow.md` と `CLAUDE.md` から初心者ガイドへの導線を追加。
- Orca CLIでチーム/ワークスペースを確認。チーム「片桐若登」、キー `P`。現在、Linearのassigned filterでは該当課題0件。
- 最終確認でガイドの実例 `P-51` と `ISSUE-032` の対応台帳を照合。

# 次にやること
- 初心者向けガイドを起点に、Linear課題IDを伝えて作業を依頼する日常運用を始める。
- 必要ならLinear側の候補Issueを本人に割り当て、担当待ちの課題と着手可能な課題を分ける。

# 試したが駄目だったこと
- 最終確認で `npm test` を実行し、249件成功。`git diff --check` も成功。

# 守るルール・判断メモ
- Linearは進捗・担当・コメントの管理、`agent-backlog.md`は詳細仕様・受け入れ条件の正本。
- Notionは読み取りアーカイブ。Notion同期を通常運用に戻さない。
- LinearのローカルAPI書き込みはOrca CLI認証、GitHub Actionsは `LINEAR_API_KEY` Secretを使用する。
- 移行済みLinear課題の説明文は同期で上書きしない。
- 認証情報をログ・文書へ出さない。

# 関連ファイル
- `docs/linear-beginner-guide.md`
- `docs/linear-task-workflow.md`
- `CLAUDE.md`
- `.claude/commands/sync-backlog.md`
- `.claude/commands/solve-next.md`
- `scripts/sync_backlog_to_linear.js`
- `data/linear_sync_state.json`
