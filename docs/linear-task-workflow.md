# Linear課題管理の運用

初めて使う場合は、先に[Linearはじめてガイド](linear-beginner-guide.md)を読む。日々の作業はLinear上の課題を指定して依頼できる。同期スクリプトの実行は通常不要。

## 移行方針

- Linearワークスペース「片桐若登」、チーム `P` を、進捗の確認・状態更新・担当者・コメントの管理場所にする。
- `agent-backlog.md` は詳細仕様、受け入れ条件、トリアージ記録、採番の正本として残す。Backlog IDとLinear Issue IDを対応台帳 `data/linear_sync_state.json` で結ぶ。
- Notion課題トラッカー48件はLinearへ移行済み。元のNotionページは監査用の読み取りアーカイブとして残し、Notionへの作成・更新・移動・削除はしない。
- Notionへの同期状態ファイルと同期プランナーはロールバック資料として残すが、通常運用では使用しない。

## Issueの品質基準

すべての新規Issueは、[`CLAUDE.md`](../CLAUDE.md)の「Linear Issue品質ルール」に従う。タイトルは動詞で書き、Linear担当者・期限・初期状態・Project・背景・達成条件をそろえる。30分を超える作業は親Issueとsub-issueへ分ける。不明な担当者・期限・適切なProjectがある場合は値を推測して起票しない。対話では確認し、CIでは不足項目を報告して保留する。

## 使い方

```sh
# backlogからLinearへの変更を確認（書き込みなし）
node scripts/sync_backlog_to_linear.js

# 表示された変更をLinearへ反映
node scripts/sync_backlog_to_linear.js --apply

# 次の作業候補
node scripts/next_task.js

# Linear上の課題を検索・確認
orca linear search "SEO-114" --workspace all --limit 10 --json
orca linear issue P-5 --full --json
```

新しい課題は `agent-backlog.md` に必要な仕様を記録し、`/sync-backlog` または上記同期コマンドからLinearへ登録する。手動起票はbacklog項目に `**assignee**`、`**due**`、`**project**` を明記する。未設定なら同期スクリプトは新規Issueを作成せず、不足項目を表示する。夜間QAの自動起票は `data/linear_issue_defaults.json` にLinear Project ID・担当者ID・優先度ごとの期限日数を設定するまで新規Issueを保留し、IDを `data/linear_sync_pending.json` に保持する。設定後はLinearへ登録し、対応台帳をコミットする。Linear上の作業開始・完了時はIssueの状態とbacklogのstatusを揃える。同期スクリプトは既存の移行説明文を保持し、移行元の本文を上書きしない。

## 状態・優先度の対応

| Backlog | Linear |
|---|---|
| `ready` | Todo |
| `in_progress` | In Progress |
| `partial` | In Progress |
| `blocked` | Todo（blockerを説明文またはコメントに記載） |
| `done` | Done |
| `wont_fix` / `superseded` | Canceled |
| P0 / P1 / P2 / P3 | Urgent / High / Medium / Low |

移行元IDが重複していた4件は、別々の記録として残し、後続IssueにLinearの`duplicate-of`関係を付けた。Notion移行課題に加え、backlog側にあった未完了8件もLinearに登録した。

## 制約

- ローカル同期はOrca CLIの認証を使う。GitHub Actionsの夜間QA同期は `LINEAR_API_KEY` Actions secretを使う。値をリポジトリやログへ出さず、Linearへの書き込み権限を持つキーをGitHub Actions secretsに登録する。
- `linear_write_unconfirmed` が返った場合は、エラーに示されたIssueを読み戻し、変更済みなら再送しない。
- Linearの`Blocked`状態は未設定。必要に応じてTodoと説明・コメントでブロック理由を見えるようにする。
