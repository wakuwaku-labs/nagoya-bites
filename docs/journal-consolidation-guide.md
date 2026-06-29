# NAGOYA BITES — ジャーナル生成の一本化ガイド（ISSUE-066）

> **作成日**: 2026-06-29  
> **対象**: オーナー（片桐）向け手順書  
> **経緯**: ISSUE-066「日次ジャーナル生成の二重稼働を一本化」

---

## 現状（2026-06-29 確認）

### 経路A — launchd（Mac ローカル）
| 項目 | 内容 |
|------|------|
| ジョブ名 | `com.nagoyabites.journal` |
| スクリプト | `scripts/run_journal_local.sh` |
| 実行タイミング | 毎朝 09:00 JST |
| 認証 | Claude CLI サブスク（API課金ゼロ） |
| ログ | `~/nagoya-bites/.local-logs/journal-YYYY-MM-DD.log` |

### 経路B — Claude Code scheduled-task（クラウド）
| 項目 | 内容 |
|------|------|
| タスクID | `nagoya-bites-journal-daily` |
| スキル | `journal-today.md` SKILL |
| 状態 | **2026-06-29 時点で自然消滅済み**（CronCreate の 7日有効期限切れ） |

**→ 二重稼働は自然解消。launchd が唯一の経路になっています。**

---

## 現在の問題

- 最終ジャーナル: `journal/2026-06-22-hatcho-miso-akamiso-katareru-mise.html`
- **6/23〜6/29（7日間）が欠番**（ISSUE-067）
- 原因候補: Mac がスリープ中 / launchd plist 未起動 / スクリプトのエラー

---

## オーナー確認手順

### 1. launchd の稼働確認

```bash
# plist が登録されているか
launchctl list | grep nagoya
# → 出力例: 73456  0  com.nagoyabites.journal

# 直近のログを確認
cat ~/nagoya-bites/.local-logs/journal-$(TZ=Asia/Tokyo date +%Y-%m-%d).log

# 過去のエラーを確認
ls -lt ~/nagoya-bites/.local-logs/ | head -10
tail -50 ~/nagoya-bites/.local-logs/journal-2026-06-22.log
```

### 2. plist が登録されていない場合の再起動

```bash
# plist ファイルのパスを確認
ls ~/Library/LaunchAgents/ | grep nagoya

# もし com.nagoyabites.journal.plist が存在するなら
launchctl load ~/Library/LaunchAgents/com.nagoyabites.journal.plist

# 今すぐ実行してテスト
launchctl start com.nagoyabites.journal
```

### 3. plist が存在しない場合の作成

`~/Library/LaunchAgents/com.nagoyabites.journal.plist` を以下の内容で作成：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.nagoyabites.journal</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/katagirijakutou/nagoya-bites/scripts/run_journal_local.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/katagirijakutou/nagoya-bites/.local-logs/launchd-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/katagirijakutou/nagoya-bites/.local-logs/launchd-stderr.log</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
```

その後：

```bash
launchctl load ~/Library/LaunchAgents/com.nagoyabites.journal.plist
launchctl start com.nagoyabites.journal  # テスト実行
```

---

## クラウド側タスクの再作成が必要な場合

launchd が使えない状況（Mac が常時起動でない など）の場合のみ、
Claude Code セッションでクラウド側タスクを再作成することを検討してください：

```
/cron
```

コマンドでスケジュール一覧を確認・管理できます。ただし **launchd と同時に有効にしないこと**
（ISSUE-066 の二重稼働問題が再発します）。

---

## ジャーナル欠番の対応

6/23〜6/29 の 7日間の欠番は、Claude Code セッションで journal-today SKILL を
過去日付指定で実行するか、ローカルで `run_journal_local.sh` を手動実行することで補完可能です。
詳細は **ISSUE-067** を参照してください。

---

## 関連ファイル

- `scripts/run_journal_local.sh` — launchd から呼ばれるメインスクリプト
- `.local-logs/journal-*.log` — 日次実行ログ（Mac ローカル）
- `data/journal_published.json` — 公開済みジャーナル台帳
- **ISSUE-067** — 6/23〜6/29 ジャーナル欠番の対応タスク
