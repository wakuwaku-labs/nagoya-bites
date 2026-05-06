---
description: agent-backlog.md の内容を Notion DB「課題トラッカー」に同期する。done になった課題は Notion からアーカイブ（非表示化）して残課題のみを表示。
---

# /sync-backlog — agent-backlog.md → Notion 同期

`agent-backlog.md`（マスター）の内容を Notion ダッシュボードに反映する。
このコマンドは `/solve-next` の冒頭でも自動的に呼ばれる。手動で同期したい時にも使える。

---

## 実行手順

### Step 1: 差分プランを取得

```bash
node scripts/sync_backlog_to_notion.js --if-changed
```

- `{"changed": false, ...}` が返った場合 → **何もせずに終了**。「Notionは最新です」とユーザーに報告
- `{"changed": true, plan: { creates, updates, archives }, ...}` が返った場合 → Step 2 へ

### Step 2: アーカイブ（done になった課題を Notion から消す）

`plan.archives` の各エントリに対して、`mcp__61895424-82d3-4b62-a9e3-719e9d42cb74__notion-update-page` を呼ぶ：

```
command: "update_properties"
page_id: <archives[i].page_id>
properties: {} (空でOK)
content_updates: []
```

**重要**: アーカイブは `notion-update-data-source` の `in_trash: true` ではなく、ページ単位で削除するため、現状の MCP ツール仕様では「ステータスを done に更新するだけ」で代替する場合がある。
**正しいアーカイブ手順**: Notion ページの archive は MCP の `update_page` 経由では直接できないため、**state ファイルから page_id_map のエントリを削除**することで「次回 sync で creates 扱いされない」状態にする。

→ 実装は次の通り：
1. `notion-update-page` でステータスを「done」相当の表現にする（このDBには done が無いので、ページのアイコンを ✅ に変えてタイトル先頭に "[DONE] " を付ける形でもよい）
2. 確実な削除には Notion UI 上で手動アーカイブを推奨。または将来的に Notion API 直接連携を実装。

**簡易実装**: 現時点では各 archive エントリに対して以下を実行：
- `notion-update-page` で `properties: {"タイトル": "✅ " + 既存タイトル}` に変更
- ページアイコンを ✅ に変更
- ステータス select に "done" 値を追加して設定する場合は事前に `notion-update-data-source` でオプション追加が必要

→ **シンプル運用**: archives の page_id をリスト化してユーザーに通知し、Notion 上で手動でゴミ箱に移すよう促す。並行して state ファイルから該当 ID を削除して、agent-backlog.md 上は done のままなので次回以降の sync で再生成されない。

### Step 3: 既存ページの更新（updates）

`plan.updates` の各エントリに対して、`mcp__61895424-82d3-4b62-a9e3-719e9d42cb74__notion-update-page` を呼ぶ：

```
command: "update_properties"
page_id: <updates[i].page_id>
properties: <updates[i].properties>
content_updates: []
```

content の差分更新は重い／壊れやすいため、**プロパティ（タイトル/ステータス/優先度/担当部署/日付）のみ更新**する。
本文は最初に作った時のまま残す（必要なら手動で編集）。

### Step 4: 新規ページ作成（creates）

`plan.creates` の各エントリを **1回の `notion-create-pages` 呼び出しでまとめて作成**：

```
parent: { type: "data_source_id", data_source_id: <plan.notion_data_source_id> }
pages: [
  {
    properties: <creates[i].properties>,
    icon: "📋" (ORG-) / "🔴" (P1-in_progress) / "🟡" (P1-blocked/partial) / "🟢" (P2/P3-ready) / "❌" (wont_fix),
    content: <creates[i].content>
  },
  ...
]
```

**注意**: `properties` の中で日付プロパティは `"date:検出日:start": "YYYY-MM-DD"` 形式（既に planner が出力済み）。

### Step 5: state を更新

create で取得した新しい page_id を state ファイルに記録：

```bash
node scripts/sync_backlog_to_notion.js --mark-synced \
  --add ID1=page-uuid-1 ID2=page-uuid-2 ... \
  --remove ARCHIVED-ID-1 ARCHIVED-ID-2 ...
```

`--add`: creates 分の page_id を追加
`--remove`: archives 分の ID を page_id_map から削除

### Step 6: 報告

ユーザーに簡潔に報告：

```
✅ Notion 同期完了
- 新規追加: N件
- 更新: M件
- アーカイブ対象: K件 (Notion 上で手動ゴミ箱移動を推奨)
- ダッシュボード: https://www.notion.so/35826260227a81e595aaf5d9fc4caa6c
```

---

## エラー時の挙動

- Notion API がエラーを返した場合：state ファイルは更新せず、ユーザーに失敗内容を報告して終了
- 部分的に成功した場合：成功分だけ `--mark-synced --add` で記録、失敗 ID は次回再試行

---

## このコマンドが「絶対反映」を担保する仕組み

1. Stop hook（`.claude/settings.json`）が agent-backlog.md の変更を検知して同期マーカーを立てる
2. 次回 Claude Code 起動時、または `/solve-next` 実行時に **自動的に `/sync-backlog` を最初に実行**
3. これにより「課題が起票されたら必ず Notion に反映される」が技術的に強制される
