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

**ISSUE-039 で確立した正規手順**：done になったページはデータソース外の親ページに退避する。
これにより課題トラッカーのダッシュボードビューから即座に消える（ページ自体は監査用に残存）。

#### Step 2-A: ページをデータソース外へ移動

`plan.archives` の page_id を全件まとめて 1回の `mcp__61895424-82d3-4b62-a9e3-719e9d42cb74__notion-move-pages` 呼び出しに渡す：

```
page_or_database_ids: [<archives[0].page_id>, <archives[1].page_id>, ...]
new_parent: { type: "page_id", page_id: "35826260-227a-81e5-95aa-f5d9fc4caa6c" }
```

- `35826260-227a-81e5-95aa-f5d9fc4caa6c` = 課題トラッカーの**親ページ**（`plan.notion_parent_page_id` と同値）
- 移動後、ページはデータソース（DB）の子ではなくなり、ダッシュボード一覧から消える
- ページの中身（タイトル / 本文 / アイコン）は全て保持される。後日参照したい時は親ページから辿れる

#### Step 2-B: タイトルにアーカイブ印を付与（任意・監査性向上）

各 archive エントリに対して `notion-update-page`（command: `update_properties`）でアイコンを `✅` に、タイトル先頭に `✅ ` を付ける。
失敗してもダッシュボードからの除去には影響しないため、エラーは無視して次に進む。

#### Step 2-C: 注意事項

- このDBの `ステータス` select には `done` 値が無く、`update_properties` で `ステータス: "done"` をセットしようとすると validation_error になる。状態変更で消そうとしないこと
- `notion-update-data-source` の `in_trash: true` は **データソース全体**の削除を意味するため絶対に使わない
- ページ単位のゴミ箱送り（trash）が必要なら、現状は Notion UI からの手動操作のみ。本フローの「親ページ退避」で運用上は十分

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
