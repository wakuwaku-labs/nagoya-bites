# 日次ジャーナル（scripts/run_journal_local.sh）の「origin/main を取り込む」処理の唯一の実装。
# bash から source して使う（単体では実行しない）。呼び出し側が log() と $LOG を定義している前提。
#
# 2026-10-10 の欠番の真因（ISSUE-187）:
#   ローカルの main（launchd が動くチェックアウト）に、対話セッションのブランチを合流した
#   174 コミットが載っていた。origin 側は同じ内容が squash マージで入っているため、
#   `git pull --rebase` は 97 コミットを再適用しようとして同じファイルの add/add で衝突し、
#   その日の記事が出なかった。rebase は「コミットの列」を再生するので、内容が同じでも
#   履歴の形が違えば衝突する。merge は「木」を3者比較するので同じ状況でも通る。
#   さらに、その後の health の push 再同期が `pull --rebase` を abort せずに die し、
#   rebase 途中のまま翌朝を迎えて事前チェック（rebase 進行中は即 fail）に止められる状態だった。
#
# 約束:
#   - まず rebase で取り込む（履歴が直線のまま保たれる通常ケース）
#   - 衝突したら rebase を必ず畳み、merge で取り込み直す
#   - どちらも駄目なら、rebase / merge の進行中状態を残さず（作業ツリーを健全に戻して）失敗を返す
journal_abort_inprogress_git() {
  local gd
  gd="$(git rev-parse --git-dir 2>/dev/null)" || return 0
  if [ -d "$gd/rebase-merge" ] || [ -d "$gd/rebase-apply" ]; then
    git rebase --abort >>"$LOG" 2>&1 || true
  fi
  if [ -f "$gd/MERGE_HEAD" ]; then
    git merge --abort >>"$LOG" 2>&1 || true
  fi
}

journal_sync_origin_main() {
  if git pull --rebase --autostash origin main >>"$LOG" 2>&1; then
    return 0
  fi
  log "git pull --rebase が失敗。衝突の中身:"
  git diff --name-only --diff-filter=U 2>/dev/null | head -20 | tee -a "$LOG"
  journal_abort_inprogress_git

  log "rebase を畳みました。履歴の形が違うだけの可能性があるため merge で取り込み直します。"
  if git pull --no-rebase --no-edit --autostash origin main >>"$LOG" 2>&1; then
    log "merge で origin/main を取り込みました。"
    return 0
  fi
  log "merge でも取り込めませんでした。衝突の中身:"
  git diff --name-only --diff-filter=U 2>/dev/null | head -20 | tee -a "$LOG"
  journal_abort_inprogress_git
  return 1
}
