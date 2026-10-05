---
description: agent-backlog.md から優先度最高の未着手タスクを選び、対応するLinear Issueを更新しながら実装→QA→デプロイまで進める。
---

# /solve-next — 次の1件を解く

NAGOYA BITES の組織として、滞留タスクを順次消化するためのコマンド。
**1ターン1件の原則**：1回の実行で1課題のみ処理する（暴走防止）。次を解きたければ再度 `/solve-next` を実行。

---

## 実行フロー（必ずこの順番）

### Step 1: Linear Issueを確認

`agent-backlog.md`の選定結果を取得し、対象IDでLinearを検索する:

```bash
node scripts/next_task.js
orca linear search "<選定したID>" --workspace all --limit 10 --json
```

`[ID]`が一致し、Duplicate状態ではないLinear Issueを対応先にする。現在状態・優先度・担当者を読み込む。複数候補やID不一致があれば作業開始前に止めて照合する。Notion同期は行わない。

### Step 2: 次に解くタスクを選定

`agent-backlog.md` を読み、以下の優先順で1件選ぶ：

1. **優先度**: P0 → P1 → P2 → P3
2. **ステータス**: `ready` を最優先 / `in_progress` (停滞中) / `partial` (続き) / `blocked` はスキップ
3. **検出日**: 同じ条件なら検出日が古い順（塩漬けを優先消化）
4. **wont_fix と done は対象外**

選定したタスクをユーザーに告げる：
```
🎯 次に解くタスク: [ID] タイトル
   優先度: PX / 担当: XXX / 検出日: YYYY-MM-DD（経過 N 日）
   開始してよいですか？（明示的な YES がなければ実装に進まない）
```

**重要**: ユーザーの明示的な承認なしに実装に進まない。

### Step 3: 着手宣言

ユーザー承認後、Linear Issueとagent-backlog.mdの当該タスクを `In Progress` / `in_progress` に更新（既に着手済みならスキップ）。

```bash
orca linear status set <Linear-ID> --to "In Progress" --workspace <workspace-id> --json
```

### Step 4: 担当エージェント仕様書を読む

選定タスクの owner（担当部署）に応じて該当ファイルを読み込む：

- Builder → `agents/builder.md`
- Editor → `agents/editor.md`
- DataKeeper → `agents/data-keeper.md`
- Inspector → `agents/inspector.md`
- Marketer → `agents/marketer.md`
- Strategist → `agents/strategist.md`
- Orchestrator → `agents/orchestrator.md`

エージェント仕様書を **読まずに実装に進むことは禁止**。

### Step 5: 実装

タスクの description / acceptance を満たす最小限の変更を実装する。
**スコープを広げない**：「ついでに」の追加修正は別タスク化（agent-backlog.md に新規 ID で追記）。

### Step 6: QA ゲート（orchestrator.md の規定通り）

実装後、以下の5項目を必ず確認：

| QA | チェック内容 | NG時 |
|---|---|---|
| QA-1 | `node build.js` が正常終了するか | STOP・修正 |
| QA-2 | LOCAL_STORES 件数が 5%以上減少していないか | STOP・原因究明 |
| QA-3 | git diff で意図しない変更が入っていないか | STOP・整理 |
| QA-4 | JS構文エラーがないか（モバイル/デスクトップ表示崩れ含む） | STOP・修正 |
| QA-5 | UX劣化（CTA導線・モバイル表示）がないか | STOP・修正 |

サイト本体に変更がないタスク（ORG-XXX 等）は QA-1〜5 を「該当なし」として通過扱い。

### Step 7: デプロイ

QA通過後：

```bash
git add <変更ファイル群>
git commit -m "[agent] <ID>: <変更内容の要約>"
git push origin HEAD:main
```

`agent-backlog.md` 自体も忘れずに add する。

### Step 8: agent-backlog.md を done に更新

選定タスクの status を `done` に書き換え、`resolved: YYYY-MM-DD` を追記：

```markdown
### [<ID>] <タイトル> ✅
- **priority**: PX → **status**: done
- **resolved**: 2026-MM-DD
- **resolved_by**: <commit hash or PR#>
- ... (既存 description は維持)
```

### Step 9: エージェント実行ログを更新（ORG-001 の責務）

`agent-backlog.md` 末尾の「エージェント実行ログ」表に1行追加：

```markdown
| 2026-MM-DD | <Owner>(/solve-next) | <ID> 実装・デプロイ | ✅ commit <hash> |
```

これは ORG-001（CEO の実行ログ運用再開）の自動履行でもある。

### Step 10: Linearを完了状態にする

QA通過後、対応するLinear Issueを`Done`にし、backlogの`status: done`と`resolved`情報を更新する。必要な実装ログ・PRリンク・判断メモをIssueに残す。Notionは更新・アーカイブしない。

```bash
orca linear status set <Linear-ID> --to Done --workspace <workspace-id> --json
```

### Step 11: 完了報告（orchestrator.md の報告フォーマット使用）

```
## 🎯 /solve-next 完了レポート

**処理タスク**: [<ID>] <タイトル>
**実行モード**: solve-next（<Owner> 起動）

### 実施内容
- （箇条書き）

### QAゲート結果
- build.js: ✅ / 該当なし
- 店舗件数: XXX件（前回比: ±X）
- 差分チェック: ✅
- UX劣化チェック: ✅ / 該当なし

### デプロイ
- ステータス: ✅ デプロイ済み
- commit: <hash>
- URL: https://nagoya-bites.com/

### Linear 反映
- ✅ <Linear Issue ID> をDoneに更新
- Linear Issue: <URL>

### 次の推奨アクション（CEO判断）
- 次に `/solve-next` を実行すれば: [<次のID>] <タイトル>（PX）
- もしくは別モード: [INSPECT / DATA / FULL / EMERGENCY 等の提案]
```

---

## 1ターン1件の原則

- 暴走防止のため、1回の `/solve-next` で処理するのは **必ず1件のみ**
- 連続して解きたい場合は、ユーザーが再度 `/solve-next` を叩く
- 「全部やって」と言われた場合は `/solve-next` を1件処理した後、「次も続けますか？」と確認

---

## 該当タスクが無い場合

`ready` / `in_progress` / `partial` のタスクが0件の場合：

```
🎉 残課題なし！
- 全ての P0/P1/P2/P3 タスクが完了またはアーカイブ済み
- 新規課題を発見するには `/inspect` または Inspector エージェント起動を推奨
```

---

## エラー時の挙動

- Step 6 (QA) で失敗 → 修正サイクル繰り返し。3回失敗で STOP・ユーザーに判断を仰ぐ
- Step 7 (push) で失敗 → ローカル commit は残し、ユーザーに手動 push を促す
- Linear更新で失敗 → 実装の完了状態を報告し、Issueの現在状態を読み戻してから必要な更新だけ再実行する
