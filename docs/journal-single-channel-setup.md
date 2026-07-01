# 日次ジャーナル生成の一本化手順（ISSUE-066）

## 背景

現在、ジャーナル生成経路が **2系統並走** している。

| 経路 | 起動方法 | 作業ディレクトリ |
|------|---------|----------------|
| ① launchd `com.nagoyabites.journal` | 毎朝 9:00 JST → `scripts/run_journal_local.sh` | `/Users/katagirijakutou/nagoya-bites`（メインrepo） |
| ② scheduled-task `nagoya-bites-journal-daily` | Claude Code on the Web のスケジューラ → journal-today SKILL.md | worktree 経由で cp |

この二重稼働が ISSUE-065（ジャーナル欠番5日）の真因だった（worktree→メインrepo の cp 残骸が `git pull` を停止させる）。
`run_journal_local.sh` に自己修復ロジック（ISSUE-065 恒久対策）を実装済みのため直近の再発は防がれているが、
二重稼働そのものは汚染の温床として残っている。

## 推奨：launchd 経路に一本化

| 比較軸 | ① launchd | ② scheduled-task |
|--------|----------|-----------------|
| API コスト | **ゼロ**（サブスク認証） | 毎回 API トークン消費 |
| 自己修復ロジック | **実装済み**（ISSUE-065） | なし |
| 観測性 | `.local-logs/journal-YYYY-MM-DD.log` で毎朝確認可能 | セッションログのみ |
| オーナー作業 | launchd plist は導入済み・変更不要 | **停止が必要（下記参照）** |

→ **launchd 側を正として、scheduled-task を停止する。**

---

## オーナー作業手順（scheduled-task の停止）

### ステップ 1: Claude Code on the Web でスケジューラを開く

1. [code.claude.com](https://code.claude.com) にアクセスしてログイン
2. 左サイドバーまたはプロジェクト設定から **「Scheduled Tasks」（スケジュール済みタスク）** を開く
3. `nagoya-bites-journal-daily` を探す

### ステップ 2: タスクを停止または削除

- タスクの横にある **「...」メニュー → 停止（Pause）または削除（Delete）** を選ぶ
- 削除を推奨（停止だと誤って再開されるリスクがある）

### ステップ 3: launchd の単独稼働を確認

```bash
# 翌朝 9:00 以降に実行（Mac でメインrepo のターミナルで）
tail -n 30 /Users/katagirijakutou/nagoya-bites/.local-logs/journal-$(date +%Y-%m-%d).log
```

正常な出力例：
```
2026-07-02 09:01:03 ✅ 生成・公開完了: journal/2026-07-02-xxxx.html
```

### ステップ 4: 数日間の観測チェックリスト

以下を毎朝確認し、3日連続で PASS したら一本化完了とみなす。

```
[ ] 2026-07-0X: journal/ に当日付き記事が追加されている
[ ] .local-logs/journal-2026-07-0X.log に ✅ 完了 が記録されている
[ ] data/journal_published.json の最新エントリが当日日付
[ ] 「worktree」「cp」「scheduled-task」関連のエラーがログに出ていない
```

---

## フォールバック：scheduled-task 側に一本化する場合

launchd を停止する場合（Mac を常時起動できない環境等）:

```bash
# launchd エージェントをアンロード
launchctl unload ~/Library/LaunchAgents/com.nagoyabites.journal.plist
```

この場合、`nagoya-bites-journal-daily` のスケジュールを **毎朝 9:00 JST（00:00 UTC）** に設定し直す。

---

## エージェントが直接変更できない理由

Claude Code のエージェントは `.claude/settings.json`（scheduled-task 設定）を
**自己改変ブロック**（セキュリティ機構）により直接編集できない。
同様に launchd plist（`~/Library/LaunchAgents/`）はオーナーの Mac ローカル環境にあり、
リモート実行環境からは到達できない。

このため、エージェントは **docs にまとめてオーナーへ依頼する** 形で担当を引き継ぐ。

---

## 関連

- ISSUE-066: agent-backlog.md 該当エントリ
- ISSUE-065: 真因となったデッドロックの詳細
- `scripts/run_journal_local.sh`: launchd 経路のスクリプト（ISSUE-065 自己修復ロジック実装済み）
