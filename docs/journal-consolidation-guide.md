# 日次ジャーナル生成 — 二重稼働の解消手順（オーナー向け）

> **ISSUE-066 対応手順書**  
> 作成日: 2026-06-23 / 対象: 片桐（オーナー）

---

## 背景

現在、日次ジャーナル（`journal/*.html`）は **2つの経路が並走**している。

| 経路 | 起動元 | 時刻 | 実行場所 | コスト |
|------|--------|------|----------|--------|
| **① launchd** | `com.nagoyabites.journal` plist | 毎朝 9:00 JST | ローカル Mac | ゼロ（サブスク認証） |
| **② scheduled-task** | Claude Code ウェブ/スケジューラ | 別時刻 | クラウド | API従量課金あり |

経路①は `scripts/run_journal_local.sh` を実行する。ISSUE-065 の修正で強固な自己修復ロジックが実装済みで、安定稼働している。

経路②は `journal-today` SKILL（worktree 経由）を実行し、記事ファイルを `cp` でメインrepoに残す。この cp 残骸が翌日 `git pull` を阻害し、ISSUE-065 の根本原因だった（現在は自己修復で再発不能化済み、しかし相互汚染の温床として残存）。

---

## 推奨方針

> **経路① launchd を正として残し、経路② scheduled-task を停止する**

理由:
- ① API課金ゼロ（サブスク認証 `--dangerously-skip-permissions`）
- ① pull → 生成 → push の整合性を厳密に管理（エラー時は即 fail）
- ② を止めても ① が毎朝9時に確実に動くため穴は生じない
- 二重稼働を解消することで相互汚染クラスの障害リスクをゼロに近づける

---

## 手順

### Step 1: scheduled-task `nagoya-bites-journal-daily` を停止する

**Claude Code ウェブ（code.claude.com）での操作:**

1. `https://code.claude.com` にログイン
2. 左サイドバーの「Scheduled tasks」または「スケジュール済みタスク」を開く
3. タスク一覧から `nagoya-bites-journal-daily`（または類似名）を見つける
4. タスクを **Pause（一時停止）** または **Delete（削除）** する
   - まず Pause で様子を見て、問題なければ Delete を推奨
5. `nagoya-bites-seo-triage-daily`（21:01 起動のSEOトリアージ）は**停止しない**

> **注意**: 上記タスク名は推定。実際の名前はスケジューラUI で確認してください。

### Step 2: launchd が単独で動いているか数日観測する

- 翌朝 9:00 以降に `journal/` に当日付のファイルが生成されているか確認
- `.local-logs/journal-YYYY-MM-DD.log`（ローカルMac上）でエラーがないか確認
- `data/journal_published.json` に当日エントリが追加されているか確認
- 3〜5日連続で問題なければ一本化完了

### Step 3: ISSUE-066 を done 化する

3〜5日の観測が完了したら、`agent-backlog.md` の ISSUE-066 を以下のように更新する：

```
- **status**: done
- **resolved**: YYYY-MM-DD
- **resolved_by**: オーナー手動（launchd 一本化）
```

---

## launchd の動作確認方法（Mac）

```bash
# plist の状態確認
launchctl list | grep nagoyabites

# ログ確認（最新）
cat ~/nagoya-bites/.local-logs/journal-$(date +%Y-%m-%d).log

# 手動テスト実行（ドライラン確認目的）
bash ~/nagoya-bites/scripts/run_journal_local.sh
```

---

## もし逆にした場合（scheduled-task を正とする場合）

経路② を残して経路① を停止する場合は:

1. Mac で launchd をアンロード: `launchctl unload ~/Library/LaunchAgents/com.nagoyabites.journal.plist`
2. `scripts/run_journal_local.sh` を今後は手動確認用途にのみ使用
3. Claude Code の scheduled-task 設定で SKILL `journal-today` が実行されることを確認

ただし経路②はAPIコストが発生するため、経路①の維持を強く推奨する。

---

## 関連ファイル

| ファイル | 説明 |
|---------|------|
| `scripts/run_journal_local.sh` | 経路①の実体スクリプト（自己修復ロジック実装済み） |
| `~/Library/LaunchAgents/com.nagoyabites.journal.plist` | launchd 設定（Mac上） |
| `.local-logs/journal-*.log` | 経路①の実行ログ（Mac上・gitignore済み） |
| `data/journal_published.json` | 公開済みジャーナルの記録 |
| `.claude/commands/journal-today.md` | 経路②のSKILL定義 |

---

## 参考 ISSUE

- [ISSUE-065] 日次ジャーナル停止（真因特定・恒久対策・欠番5本復旧）— **done**
- [ISSUE-066] 二重稼働一本化（本手順書）— **in_progress（オーナー手動操作待ち）**
