# Stop hook 導入手順（憲法の実体化・ORG-004）

## なぜ必要か

`agents/orchestrator.md` は長らく「`.claude/settings.json` の Stop hook が
`sync_backlog_to_notion.js --if-changed` を自動実行し `.notion_sync_pending` マーカーを立てる」
と記載してきたが、2026-06-02 の棚卸しで **`settings.json` も Stop hook も実在しなかった**ことが判明した
（`.claude/settings.local.json` は permissions のみで hook を持たない）。

つまり「課題が起票されたら絶対 Notion に反映される（技術的に保証）」という憲法の主張は、
**保証する実体が無いまま**だった。これは報連相・自己監査の信頼性を損なう乖離なので解消する。

エージェントは**自己改変ハードブロック**により `.claude/settings.json` を直接書けない
（自分の実行 hook を勝手に仕込めない安全機構）。そのためオーナーが手動で導入する。

## 導入手順

`.claude/settings.json` を新規作成し、以下を貼り付ける。
既に `settings.json` がある場合は `hooks` キーをマージする。

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && node scripts/sync_backlog_to_notion.js --if-changed | grep -q '\"changed\": true' && touch .notion_sync_pending || true"
          },
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && node scripts/audit_backlog_ids.js"
          }
        ]
      }
    ]
  }
}
```

## この hook が保証すること

1. **marker の実体化**: ターン終了時、`agent-backlog.md` が前回 sync から変わっていれば
   `.notion_sync_pending` マーカーを立てる → 次ターン Step 0 で `/sync-backlog` が必ず走る。
   - `sync_backlog_to_notion.js` 自体は純粋パーサーで marker を書かない（「判断しないスクリプト」の思想）。
     marker を立てるのは hook 層（shell）の責務として分離している。
2. **重複IDの早期検知**: ターン終了時に `audit_backlog_ids.js` が走り、並列起票の採番衝突を
   push 前に検知する（CI=build.yml より早い防壁）。

## 検証

```bash
# marker ロジックの疎通（backlog 未変更なら marker は立たない＝"no marker" が出れば正常）
node scripts/sync_backlog_to_notion.js --if-changed | grep -q '"changed": true' && echo "would touch marker" || echo "no marker (unchanged)"

# 重複ID検知（既知4件WL・新規0件なら EXIT: 0）
node scripts/audit_backlog_ids.js; echo "EXIT: $?"
```

## 注意

- `.claude/settings.json` は **git 管理される**（チーム共有の運用ルール）。
  `settings.local.json`（permissions・個人環境設定）とは別ファイル。
- hook の `command` は `$CLAUDE_PROJECT_DIR` を cwd にして相対パスで動く。worktree でも同様。
- hook 未導入でも、重複IDは **CI（build.yml の `audit_backlog_ids` ステップ）が最終防壁**として検知する。
  Stop hook は「より早い検知」と「marker 実体化」を足す位置づけ。
