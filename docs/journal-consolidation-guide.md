# 日次ジャーナル生成 一本化 手順書

> ISSUE-066 のオーナー（片桐）向け手順書  
> 作成: 2026-06-27

## 背景と現状

ジャーナル生成経路が現在2系統並走しており、ISSUE-065 のデッドロック事故の温床となっています。

| 経路 | 仕組み | 認証 | 作業ディレクトリ |
|------|--------|------|----------------|
| ① launchd | `com.nagoyabites.journal`（毎朝9:00 JST） → `scripts/run_journal_local.sh` | Claude サブスク（API課金ゼロ） | メインrepo `/Users/katagirijakutou/nagoya-bites` |
| ② scheduled-task | `nagoya-bites-journal-daily`（`.claude/settings.json` の Schedule 設定） → `journal-today` SKILL.md + worktree | Claude Code remote | worktree（クラウド一時環境） |

ISSUE-065 の恒久対策（`run_journal_local.sh` の自己修復ロジック）でデッドロックは再発不能化済みですが、2系統が同じ `journal/` に書くことで相互汚染が発生し得ます。

## 推奨アクション：scheduled-task（②）を停止して launchd（①）に一本化

**理由：** launchd 側は API 課金ゼロ・実績あり・自己修復ロジック済み。

### 手順

1. **scheduled-task の停止**（Claude Code の設定から削除）

   `.claude/settings.json`（`/Users/katagirijakutou/.claude/settings.json` またはプロジェクト内）を開き、以下のような Schedules エントリを探して削除する：

   ```json
   {
     "id": "nagoya-bites-journal-daily",
     ...
   }
   ```

   > Claude Code Web の場合は「設定 → スケジュール」から `nagoya-bites-journal-daily` を無効化・削除する

2. **launchd の確認**

   ```bash
   # launchd エージェントが正常に読み込まれているか確認
   launchctl list | grep nagoyabites

   # 次回実行ログをリアルタイム確認（翌朝9:00以降）
   tail -f /Users/katagirijakutou/nagoya-bites/.local-logs/journal-$(date +%Y-%m-%d).log
   ```

3. **数日の観測**

   3日間、launchd 単独で `journal/YYYY-MM-DD-*.html` が毎朝追加されていることを確認する。

   ```bash
   # 最新3件のジャーナルを確認
   ls -lt journal/ | head -5
   ```

4. **完了確認後 ISSUE-066 を done に**

   問題なければ `agent-backlog.md` の ISSUE-066 を `status: done` に更新する（または `/solve-next` で対応）。

## 逆方向：scheduled-task（②）に一本化する場合

launchd を停止する場合：

```bash
# launchd を無効化
launchctl unload ~/Library/LaunchAgents/com.nagoyabites.journal.plist

# plist ファイルを削除または無効化（再起動後も適用される）
```

> ただし scheduled-task 側は API 課金（claude --print）が発生し得るため、launchd 側（サブスク認証）の継続を推奨

## 参考：ISSUE-065 の自己修復ロジック（既実装）

`scripts/run_journal_local.sh` の pull 直前に「origin/main に正本がある untracked ファイルを除去」する処理が L89-101 に追加済み。もし worktree から cp した残骸が残っても次回実行で自動除去されます。

```
git ls-files --others --exclude-standard | while read f; do
  if git cat-file -e origin/main:"$f" 2>/dev/null; then
    rm -f "$f"
  fi
done
```

## 完了の目安

scheduled-task 停止後、3日間の観測で日次ジャーナルが途切れなければ ISSUE-066 は done です。
