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

# ---- ローカル main にだけある「よその」コミットを退避する（Ondine #2338）----
# 2026-10-12・10-15・11-20 の HOLD はどれも同じ型だった: 対話の会話が ~/nagoya-bites の main へ
# 作業ブランチをローカルで合流したり直接コミットしたりして、origin に無いコミットが残る。
# 翌朝の取り込みがそれと衝突して HOLD になり、記事・X・note が丸1日出なかった。
# 取り込めた場合も、そのコミットはジャーナルの push に乗って PR も QA も通らず本番へ出てしまう。
#
# 約束:
#   - origin/main に無いコミットを「ジャーナル自身のもの」と「よそのもの」に分ける
#       ジャーナル自身 = 作者が daily@nagoya-bites、または触ったファイルがすべてジャーナルの持ち分
#       origin/main を取り込んだだけの merge は数えない（中身は origin にある）
#   - よそのものが1つも無ければ何もしない（前日の push 失敗で残った記事は、従来どおり取り込み後に push）
#   - よそのものがあれば、今の main を backup/main-<日時> に残し（消さない）、main を origin/main に合わせ、
#     ジャーナル自身のコミットだけを積み直す。積み直せないものは backup に残したまま捨てる
#   - main の付け替えができないとき（作業ツリーの差分が邪魔をする等）は何も変えずに失敗を返す
# 結果は JOURNAL_QUARANTINE_BRANCH / JOURNAL_QUARANTINE_FOREIGN（件名の一覧・改行区切り）/
# JOURNAL_QUARANTINE_DROPPED（積み直せなかった自前のコミット数）に入れる。
JOURNAL_OWN_AUTHOR_EMAIL="${JOURNAL_OWN_AUTHOR_EMAIL:-daily@nagoya-bites}"
JOURNAL_OWN_PATH_RE="${JOURNAL_OWN_PATH_RE:-^(journal/|docs/daily-posts/|data/journal_|data/x_post_|data/pending_stores\.json|data/editorial_column_backlog\.json|data/photo_pipeline_health_local\.json|data/note_post_health\.json|assets/journal-figures/|assets/x-cards/)}"

journal_commit_is_own() {
  local c="$1" email f
  email="$(git log -1 --format=%ae "$c")"
  [ "$email" = "$JOURNAL_OWN_AUTHOR_EMAIL" ] && return 0
  local any=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    any=1
    [[ "$f" =~ $JOURNAL_OWN_PATH_RE ]] || return 1
  done < <(git diff-tree --no-commit-id --name-only -r "$c")
  [ "$any" = "1" ]
}

# origin/main を取り込んだだけの merge か（1つ目以外の親がすべて origin/main に含まれる）
journal_commit_is_sync_merge() {
  local c="$1" p first=1
  for p in $(git log -1 --format=%P "$c"); do
    if [ "$first" = "1" ]; then first=0; continue; fi
    git merge-base --is-ancestor "$p" origin/main || return 1
  done
  return 0
}

journal_quarantine_foreign_commits() {
  JOURNAL_QUARANTINE_BRANCH=""
  JOURNAL_QUARANTINE_FOREIGN=""
  JOURNAL_QUARANTINE_DROPPED=0
  local c own=() foreign=() nparents
  while IFS= read -r c; do
    [ -z "$c" ] && continue
    nparents=$(git log -1 --format=%P "$c" | wc -w | tr -d ' ')
    if [ "$nparents" -gt 1 ]; then
      journal_commit_is_sync_merge "$c" && continue
      foreign+=("$c")
    elif journal_commit_is_own "$c"; then
      own+=("$c")
    else
      foreign+=("$c")
    fi
  done < <(git rev-list --reverse --topo-order origin/main..HEAD)

  [ ${#foreign[@]} -eq 0 ] && return 0

  local branch
  branch="backup/main-$(TZ=Asia/Tokyo date +%Y%m%d-%H%M%S)"
  local n=1
  while git show-ref --verify --quiet "refs/heads/$branch"; do branch="${branch%-r*}-r$n"; n=$((n+1)); done
  git branch "$branch" HEAD >>"$LOG" 2>&1 || { log "退避用ブランチ ${branch} を作れませんでした"; return 1; }

  for c in ${foreign[@]+"${foreign[@]}"}; do
    JOURNAL_QUARANTINE_FOREIGN+="$(git log -1 --format='%h %s' "$c")"$'\n'
  done

  if ! git checkout -q -B main origin/main >>"$LOG" 2>&1; then
    log "main を origin/main に合わせられませんでした（作業ツリーの差分が邪魔をしている可能性）。main はそのままです。"
    git branch -D "$branch" >>"$LOG" 2>&1 || true
    JOURNAL_QUARANTINE_FOREIGN=""
    return 1
  fi
  JOURNAL_QUARANTINE_BRANCH="$branch"

  # macOS の /bin/bash 3.2 は set -u のとき空の配列を "${own[@]}" で展開すると unbound variable で落ちる。
  # 2026-11-22 はジャーナル自身のコミットが0件（よそのコミットだけ）で、ここで落ちて記事が出なかった。空でも落ちない書き方にする
  for c in ${own[@]+"${own[@]}"}; do
    if ! git cherry-pick --empty=drop "$c" >>"$LOG" 2>&1; then
      git cherry-pick --abort >>"$LOG" 2>&1 || true
      JOURNAL_QUARANTINE_DROPPED=$((JOURNAL_QUARANTINE_DROPPED+1))
      log "ジャーナル自身のコミット $(git log -1 --format='%h %s' "$c") は積み直せませんでした（${branch} に残っています）"
    fi
  done
  log "origin に無いよそのコミット ${#foreign[@]} 件を ${branch} に退避し、main を origin/main に合わせました（ジャーナル自身のコミット ${#own[@]} 件は積み直し）。"
  return 0
}
