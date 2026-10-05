---
description: agent-backlog.md の課題をLinearへ一方向同期する。Notionへの書き込みは行わない。
---

# /sync-backlog — agent-backlog.md → Linear

Notion課題トラッカーの48件はLinearへ移行済み。以後、Notionへ課題を作成・更新・退避しない。
このコマンドはOrca CLIを使って、backlogの状態・優先度をLinearへ反映する。
Linear側では担当者・コメント・作業ログを管理し、課題の詳細な受け入れ条件は`agent-backlog.md`を参照する。

## 手順

1. まず差分を表示する（読み取りのみ）:

   ```bash
   node scripts/sync_backlog_to_linear.js
   ```

2. Linearに接続でき、表示された作成・更新対象が妥当な場合だけ反映する:

   ```bash
   node scripts/sync_backlog_to_linear.js --apply
   ```

新規 `create` が含まれるときは、反映前に `CLAUDE.md` の「Linear Issue品質ルール」7項目を確認する。backlogの `owner` はLinear担当者本人の指定ではないため、実ユーザーを別途確定する。担当者・期日・Projectが不足していれば同期を実行せず、ユーザーに確認する。

3. Linearの全課題を再読み込みし、作成・更新数を照合する。CLIが`linear_write_unconfirmed`を返した場合は、エラー内の`nextSteps`に従って対象Issueを読み戻し、反映済みなら再送しない。

## ルール

- `data/linear_sync_state.json`が移行済みLinear Issueとの対応台帳。既存Issueの説明文は上書きしない。
- `ready`→Todo、`in_progress`/`partial`→In Progress、`done`→Done、`wont_fix`/`superseded`→Canceled。優先度はP0→Urgent、P1→High、P2→Medium、P3→Low。
- `blocked`はLinearに同名状態がないためTodoに置く。必要なら説明文とコメントでblockerを明記する。
- 新規の未完了backlog項目はLinear Issueを作る。終了済みの未登録項目は作らない。
- 元Notionの重複4件は、LinearのDuplicate状態とduplicate-of関係で保持する。
- Notion元データは監査用アーカイブとして残す。ページ移動・削除・データベース変更は行わない。
- `scripts/sync_backlog_to_notion.js`および`data/.notion_sync_state.json`は移行記録・ロールバック用に保持し、通常運用では実行しない。
