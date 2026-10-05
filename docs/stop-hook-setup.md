# Stop hookとLinear同期

Notion課題トラッカーからLinearへの移行に伴い、旧手順のNotion同期hookは導入しないでください。
以前のNotion用Stop hook設定例は廃止しました。`.claude/settings.json`にも課題同期hookはありません。

Linearへの反映はOrca CLI接続が利用できるローカル環境から、差分確認のうえ手動実行します。

```bash
node scripts/sync_backlog_to_linear.js
node scripts/sync_backlog_to_linear.js --apply
```

重複IDの監査は引き続きCIの `scripts/audit_backlog_ids.js` が行います。Notion用の
`scripts/sync_backlog_to_notion.js` と `.notion_sync_pending` は移行資料として残しますが、実行しません。
