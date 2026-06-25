# 日次ジャーナル生成経路の一本化手順（ISSUE-066）

> 作成: 2026-06-25 by Orchestrator（毎朝9時 自動課題消化ルーティン）

---

## 現状（二重稼働）

| 経路 | 識別子 | 実行主体 | 認証 | コスト | 状態 |
|------|--------|---------|------|--------|------|
| ① ローカル launchd | `com.nagoyabites.journal` | 毎朝 9:00 JST, ローカル Mac | サブスク認証 (`claude --print`) | **ゼロ** | ✅ 稼働中（推奨） |
| ② claude.ai Web UI | `nagoya-bites-journal-daily` | クラウド scheduled-task | API 従量課金 | 有料 | ⚠️ 停止対象 |
| ③ GitHub Actions | `daily-journal.yml` | schedule コメントアウト済み | — | — | 🛑 既に停止 |

**問題**: 経路①②が同じ `journal/` を書くため、worktree→メインrepo の `cp` 残骸がメインrepoの `git pull` を破壊する相互汚染が発生する（ISSUE-065 真因）。

ISSUE-065 で launchd 側の自己修復処理（`scripts/run_journal_local.sh` L89–101）を追加し再発を防いだが、
二重稼働そのものは温床として残存しているため、経路②を停止して一本化する。

---

## 推奨構成（一本化後）

**経路①（launchd）を正とし、経路②（claude.ai scheduled-task）を停止する。**

理由:
- API課金ゼロ（サブスク認証で `claude --print` を使用）
- ISSUE-065 で自己修復ロジック（pull 前の untracked 除去）を追加済み
- 稼働実績が長く、リカバリ手順が整備されている

---

## 停止手順（オーナー 片桐 が実施）

### ステップ 1: claude.ai Web UI で scheduled-task を停止

1. <https://claude.ai> にログイン
2. 左サイドバー → **Scheduled Tasks**（または **Tasks**）を開く
3. タスク名 `nagoya-bites-journal-daily` を探す
4. **Pause（一時停止）** または **Delete（削除）** を実行

   > 最初は「一時停止」で 3 日間観測し、問題なければ削除を推奨。

### ステップ 2: launchd が単独で動いていることを確認

停止翌朝（9:00 JST 以降）に以下を確認:

```bash
# ローカル Mac で実行
# 最新 journal が今日の日付で公開されているか
ls -lt ~/nagoya-bites/journal/ | head -5

# launchd の終了コードを確認（0 = 成功）
launchctl list | grep nagoyabites

# または実行ログを確認
cat ~/.local-logs/journal-$(date +%Y-%m-%d).log | tail -20
```

サイト上での確認: <https://nagoya-bites.com> → 最新ジャーナル日付が今日になっていること。

### ステップ 3: 3 日後に agent-backlog.md を更新

```
ISSUE-066:
  status: done
  resolved: <日付>
  resolved_by: 片桐（手動 scheduled-task 停止）
```

---

## ロールバック手順（万一 launchd が止まった場合）

1. launchd plist を確認・再登録:

```bash
# plist が登録されているか確認
launchctl list | grep nagoyabites

# 未登録の場合は再登録
launchctl load ~/Library/LaunchAgents/com.nagoyabites.journal.plist
```

2. 手動でジャーナルを生成:

```bash
bash ~/nagoya-bites/scripts/run_journal_local.sh
```

3. どうしても launchd が動かない場合のみ、claude.ai の scheduled-task を一時的に再有効化する。

---

## 参照

- `scripts/run_journal_local.sh` — launchd から起動されるジャーナル生成スクリプト
- `.github/workflows/daily-journal.yml` — GitHub Actions（schedule は既にコメントアウト済み）
- `agent-backlog.md` ISSUE-065 — 真因分析と恒久対策の記録
- `agent-backlog.md` ISSUE-066 — 本チケット
