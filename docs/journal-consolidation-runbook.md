# 日次ジャーナル生成の二重稼働解消手順書（ISSUE-066）

> 作成: 2026-08-04 / オーナー操作必須タスク

## 背景

ジャーナル生成経路が2系統並走しており、ISSUE-065（rebase デッドロック）の温床となっている。

| 経路 | 動作場所 | スケジュール | スクリプト |
|---|---|---|---|
| **A. launchd** | オーナーの Mac | 毎朝 9:00 JST | `scripts/run_journal_local.sh` |
| **B. scheduled-task** | クラウド（Claude Code Web） | 毎朝（設定次第） | `journal-today` SKILL |

**推奨**: A（launchd）を正とし、B（scheduled-task）を停止する。
- launchd は API 課金ゼロ（サブスク認証）
- クラウド側は API 従量課金が発生しうる
- どちらが先に動いても `journal/` を書くため、両者が競合するとデッドロックが起きる

---

## 手順

### Step 1: scheduled-task を停止する（クラウド側・オーナー操作）

**方法 A: Claude Code Web**
1. https://code.claude.ai にログイン
2. 左ペイン「Scheduled Tasks」（またはプロジェクト設定）を開く
3. `nagoya-bites-journal-daily` を見つけて停止 or 削除

**方法 B: Claude Code デスクトップアプリ**
1. アプリを開き、対象プロジェクト（nagoya-bites）の設定を開く
2. スケジュール設定から `nagoya-bites-journal-daily` を無効化

> ⚠️ `.claude/settings.json` はエージェントの自己改変ブロック対象のため、このリポジトリでエージェントが自動変更することはできない。オーナー本人の操作が必要。

### Step 2: launchd が正常稼働していることを確認する

```bash
# Mac のターミナルで実行
launchctl list | grep nagoyabites
# → com.nagoyabites.journal が表示されれば登録済み

# 直近のログを確認
cat ~/nagoya-bites/.local-logs/journal-$(date +%Y-%m-%d).log 2>/dev/null || echo "今日のログなし"
```

もし launchd が停止・未登録の場合:
```bash
# plist を再ロード
launchctl load ~/Library/LaunchAgents/com.nagoyabites.journal.plist
```

### Step 3: 数日観測

scheduled-task 停止後、3〜5日間 launchd 単独で日次公開が継続することを確認する。

確認コマンド:
```bash
# 最新の公開記事日付を確認
node /Users/katagirijakutou/nagoya-bites/scripts/register_journal_entry.js --list 2>/dev/null | tail -5
```

毎日 `journal/` に新しい HTML が追加されており、GitHub Actions が green であれば正常。

### Step 4: agent-backlog.md を done に更新

確認が取れたら、ISSUE-066 を `status: done` に変更して `/sync-backlog` を実行する。

---

## 逆の場合（scheduled-task を正とする場合）

1. launchd の停止:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.nagoyabites.journal.plist
   ```
2. scheduled-task の設定を維持

ただし、クラウド scheduled-task は API 従量課金が発生するため、コストに注意。

---

## 関連

- ISSUE-065: rebase デッドロックの原因（二重稼働による worktree 汚染）
- `scripts/run_journal_local.sh`: launchd 経路のスクリプト（ISSUE-065 で rebase abort 安全化済み）
- `journal-today.md`: scheduled-task 経路の SKILL
