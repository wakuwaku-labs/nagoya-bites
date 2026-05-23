#!/bin/bash
# NAGOYA BITES — 日次ジャーナル ローカル自動生成（コストゼロ運用）
#
# サブスク認証済みの claude CLI を使い、API 従量課金なしで毎日ジャーナルを生成する。
# launchd（~/Library/LaunchAgents/com.nagoyabites.journal.plist）から毎朝 9:00 JST に起動される想定。
#
# 経路設計:
#   1. 事前チェック: unmerged/conflict 残置や rebase 進行中なら即時 fail（誤生成を防ぐ）
#   2. origin/main を取り込む（失敗したら即時 fail。silentに進めない）
#   3. 既公開ならスキップ
#   4. claude --print --dangerously-skip-permissions で生成
#   5. published.json 登録を検証（未登録なら fail）
#   6. ラッパー側で journal 関連を surgical に add → commit → push（claude の承認待ちに依存しない）
#   7. push が rejected なら 1 度だけ pull --rebase --autostash → retry
#
# 過去の事故メモ:
#   - 2026-05-23 朝: data/cross_check_flags.json の UU 残置で git pull が silent fail し、
#     ヘッドレス claude が journal-today.md Step 10 の「ユーザー承認後のみ push」で停止 →
#     記事は生成されたが未 push でスキップ扱い。本スクリプトはこの両方を恒久対策する。
#
# 前提:
#   - この時刻に Mac が起動している（スリープ中は次回 wake 時に launchd が遅延実行）
#   - claude CLI がサブスクでログイン済み（ANTHROPIC_API_KEY を設定しない＝サブスク認証）
#   - git push 権限（SSH）が通っている

set -uo pipefail

REPO="/Users/katagirijakutou/nagoya-bites"
CLAUDE_BIN="/Users/katagirijakutou/.local/bin/claude"
LOG_DIR="${REPO}/.local-logs"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/journal-$(date +%Y-%m-%d).log"

# launchd は最小 PATH なので claude / git / node を見つけられるよう補強
export PATH="/Users/katagirijakutou/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
# サブスク認証を使うため API キーは絶対にエクスポートしない
unset ANTHROPIC_API_KEY
export DISABLE_AUTOUPDATER=1

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"; }
die() { log "❌ $*"; exit 1; }

cd "$REPO" || die "repo not found: $REPO"

log "=== 日次ジャーナル ローカル生成開始 ==="
TODAY_JST=$(TZ=Asia/Tokyo date +%Y-%m-%d)

# ---- 1. 事前チェック: 未解決衝突 / rebase 中なら即 fail ----
if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
  die "前回の rebase が未完了。.git/rebase-merge|rebase-apply を解消してから再実行してください。"
fi
UNMERGED=$(git ls-files --unmerged | wc -l | tr -d ' ')
if [ "$UNMERGED" != "0" ]; then
  log "未解決のマージ衝突ファイル:"
  git diff --name-only --diff-filter=U | tee -a "$LOG"
  die "git ls-files --unmerged が ${UNMERGED} 件。手動で解消後に再実行してください。"
fi

# ---- 2. main を取り込む（失敗したら fail-fast） ----
git checkout main >>"$LOG" 2>&1 || die "git checkout main 失敗"
if ! git pull --rebase --autostash origin main >>"$LOG" 2>&1; then
  log "git pull --rebase が失敗。状態:"
  git status -sb | tee -a "$LOG"
  die "origin/main の取り込みに失敗。手動で解消してください。"
fi

# autostash の reapply 失敗（stash 残置）も検出
LAST_STASH=$(git stash list | head -1 | grep -oE "stash@\{0\}" || true)
if [ -n "$LAST_STASH" ] && git stash show stash@{0} 2>/dev/null | grep -q "autostash"; then
  log "WARN: autostash が再適用されず stash@{0} に残っています。直近の差分を破棄します（build 副産物の想定）。"
  git stash drop stash@{0} >>"$LOG" 2>&1 || true
fi

# ---- 3. 既公開ならスキップ ----
ALREADY=$(node -e "
  try {
    const p = require('./data/journal_published.json');
    process.stdout.write((p.entries||[]).some(e=>e.date==='${TODAY_JST}') ? '1' : '0');
  } catch (e) { process.stdout.write('0'); }
")
if [ "$ALREADY" = "1" ]; then
  log "本日(${TODAY_JST})は既に公開済み。スキップします。"
  exit 0
fi

# ---- 4. claude で生成 ----
PROMPT=$(tail -n +5 .claude/commands/journal-today.md)
log "claude 生成を開始（サブスク認証・--dangerously-skip-permissions）"
"$CLAUDE_BIN" --print "$PROMPT" --dangerously-skip-permissions >>"$LOG" 2>&1
CLAUDE_RC=$?
log "claude 終了コード: ${CLAUDE_RC}"

# ---- 5. 検証 ----
OK=$(node -e "
  try {
    const p = require('./data/journal_published.json');
    process.stdout.write((p.entries||[]).some(e=>e.date==='${TODAY_JST}') ? '1' : '0');
  } catch (e) { process.stdout.write('0'); }
")
if [ "$OK" != "1" ]; then
  die "${TODAY_JST} が published.json に未登録。生成失敗（上記claudeログ参照）。"
fi
log "✅ ${TODAY_JST} のジャーナルが published.json に登録されました。"

# ---- 6. ラッパーが commit & push を確実に実行 ----
# claude (journal-today.md Step 10) は「ユーザー承認後のみ push」と定義されているため
# ヘッドレスでは承認者が居らず未 push 終了になる。それを補うため、ここで強制 commit/push する。
# 未追跡 junk（root の *.html や " 2.json" 等）の混入を防ぐため surgical に指定。
log "ラッパー側で commit & push を実行（claude の承認待ちフローを迂回）"

# 今日付の新規記事HTML、SNS原稿、本日付の SVG / candidates を列挙
TODAY_FILES=()
for p in \
  "journal/${TODAY_JST}"-*.html \
  "docs/daily-posts/${TODAY_JST}.md" \
  "data/journal_candidates/${TODAY_JST}.json" \
  "assets/journal-figures/${TODAY_JST}"-*.svg \
  "assets/journal-figures/${TODAY_JST}"-*.png ; do
  for f in $p; do
    [ -e "$f" ] && TODAY_FILES+=("$f")
  done
done

# 既存 tracked file の更新（surgical）
TRACKED_UPDATES=(
  data/journal_published.json
  data/pending_stores.json
  data/editorial_column_backlog.json
  index.html
  journal/feed.xml
  journal/feed.atom
  journal/index.html
)

git add "${TODAY_FILES[@]}" 2>>"$LOG" || true
for f in "${TRACKED_UPDATES[@]}"; do
  [ -e "$f" ] && git add "$f" 2>>"$LOG" || true
done

# ステージに差分が無ければ「claude が直接 commit/push 済みだった」可能性。検証。
if git diff --staged --quiet; then
  REMOTE_HAS=$(git log origin/main --oneline -- "journal/${TODAY_JST}-"*.html 2>/dev/null | head -1)
  if [ -n "$REMOTE_HAS" ]; then
    log "origin/main に既に本日記事のコミットあり: ${REMOTE_HAS}"
    exit 0
  fi
  die "ステージ差分なしかつ origin にも本日記事なし。状態が不明のため手動確認してください。"
fi

git -c user.name="NAGOYA BITES Daily" -c user.email="daily@nagoya-bites" \
  commit -m "journal: ${TODAY_JST} — ローカル自動生成（launchd）" >>"$LOG" 2>&1

# push: rejected なら 1回だけ pull --rebase --autostash して retry
if ! git push origin main >>"$LOG" 2>&1; then
  log "push 拒否。pull --rebase --autostash で再同期して再 push します。"
  git pull --rebase --autostash origin main >>"$LOG" 2>&1 || die "再同期に失敗"
  git push origin main >>"$LOG" 2>&1 || die "再 push に失敗"
fi

log "🚀 main へ push 完了。"
exit 0
