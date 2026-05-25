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

# ---- 0. 同時実行ロック（macOSにはflock無し → PIDfile方式）----
# 重複起動（前回の実行がハングしたままlaunchdが次回発火 等）を防ぐ。
LOCKFILE="${LOG_DIR}/run.lock"
if [ -f "$LOCKFILE" ]; then
  OLDPID=$(cat "$LOCKFILE" 2>/dev/null || echo "")
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    log "別の実行 (PID ${OLDPID}) が進行中です。終了します。"
    exit 0
  else
    log "古いロックファイル (PID ${OLDPID}) を除去します"
    rm -f "$LOCKFILE"
  fi
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT INT TERM

log "=== 日次ジャーナル ローカル生成開始 (PID $$) ==="
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

# 既知のビルド副産物（cross_check_flags.json / crosscheck.json）は claude/build の度に変動するため、
# pull 前に origin/main の版へ強制リセットして恒常的な UU 発生を断つ。
# （これらは build 系スクリプトが必要時に再生成するため、ローカル差分を捨ててOK）
git fetch origin main >>"$LOG" 2>&1 || die "git fetch origin main 失敗"
for f in data/cross_check_flags.json data/crosscheck.json; do
  if [ -f "$f" ] && ! git diff --quiet -- "$f"; then
    log "ビルド副産物 ${f} のローカル差分を捨てて origin/main の版にリセット"
    git checkout origin/main -- "$f" >>"$LOG" 2>&1 || true
  fi
done

if ! git pull --rebase --autostash origin main >>"$LOG" 2>&1; then
  log "git pull --rebase が失敗。状態:"
  git status -sb | tee -a "$LOG"
  die "origin/main の取り込みに失敗。手動で解消してください。"
fi

# pull 後の UU 再チェック（autostash 再適用で衝突した可能性）。発生したら die して以降の偽成功を防ぐ。
UNMERGED_AFTER=$(git ls-files --unmerged | wc -l | tr -d ' ')
if [ "$UNMERGED_AFTER" != "0" ]; then
  log "❌ pull --rebase --autostash の reapply で衝突が発生:"
  git diff --name-only --diff-filter=U | tee -a "$LOG"
  die "autostash 再適用で UU が ${UNMERGED_AFTER} 件発生。手動で解消してください。"
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
# (a) published.json に本日エントリが入ったか
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

# (b) 本日エントリの slug を取得して、対応する journal/<slug>.html が実在するか確認
TODAY_SLUG=$(node -e "
  const p = require('./data/journal_published.json');
  const e = (p.entries||[]).find(x=>x.date==='${TODAY_JST}');
  process.stdout.write(e ? (e.slug||'') : '');
")
if [ -z "$TODAY_SLUG" ]; then
  die "published.json に本日エントリはあるが slug が空。整合性異常。"
fi
ARTICLE_HTML="journal/${TODAY_SLUG}.html"
if [ ! -f "$ARTICLE_HTML" ]; then
  # ドラフト残置のケースを救済（claude が Step 7 の mv に失敗した想定）
  DRAFT="journal/drafts/${TODAY_SLUG}.html"
  if [ -f "$DRAFT" ]; then
    log "本番に未移動のドラフトを発見。journal/ へ昇格します。"
    mv "$DRAFT" "$ARTICLE_HTML" || die "ドラフト昇格に失敗: $DRAFT → $ARTICLE_HTML"
  else
    die "記事HTMLが見つかりません: $ARTICLE_HTML（drafts/ にもなし）。生成異常。"
  fi
fi
log "✅ 記事HTML確認: $ARTICLE_HTML"

# (c) docs/daily-posts/<date>.md が実在するか
DAILY_MD="docs/daily-posts/${TODAY_JST}.md"
if [ ! -f "$DAILY_MD" ]; then
  die "SNS原稿が見つかりません: $DAILY_MD。生成異常。"
fi

# (d) 独立 validator（claude が PASS を主張しても、ラッパーが独立に検証）
if ! node scripts/validate_journal_draft.js "$ARTICLE_HTML" "$DAILY_MD" >>"$LOG" 2>&1; then
  die "validator が FAIL を返しました（ラッパー側の独立検証）。$LOG の末尾を確認してください。"
fi
log "✅ ラッパー独立 validator PASS"

# (e) 記事 slug が feed.xml に載っているか。漏れていれば build_journal_index.js を走らせて救済。
if ! grep -q "${TODAY_SLUG}" journal/feed.xml 2>/dev/null; then
  log "feed.xml に ${TODAY_SLUG} が見当たらないため build_journal_index.js を再実行"
  node scripts/build_journal_index.js >>"$LOG" 2>&1 || die "build_journal_index.js が失敗"
  if ! grep -q "${TODAY_SLUG}" journal/feed.xml 2>/dev/null; then
    die "再生成しても feed.xml に ${TODAY_SLUG} が出現せず。状態異常。"
  fi
  log "✅ feed.xml に ${TODAY_SLUG} を確認（再生成後）"
fi

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

# ステージに差分が無ければ「claude が既に commit 済み」の可能性。
# その場合は HEAD が origin/main より進んでいるはずなので、未push分を push する。
if git diff --staged --quiet; then
  # 念のため origin の最新を取得（push前提条件の比較に必要）
  git fetch origin main >>"$LOG" 2>&1 || true
  AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
  REMOTE_HAS=$(git log origin/main --oneline -- "journal/${TODAY_JST}-"*.html 2>/dev/null | head -1)
  if [ "$AHEAD" -gt 0 ]; then
    log "ローカル HEAD が origin/main より ${AHEAD} コミット進んでいます（claude が commit 済み）。push します。"
    if ! git push origin main >>"$LOG" 2>&1; then
      log "push 拒否。pull --rebase --autostash で再同期して再 push します。"
      git pull --rebase --autostash origin main >>"$LOG" 2>&1 || die "再同期に失敗"
      git push origin main >>"$LOG" 2>&1 || die "再 push に失敗"
    fi
    log "🚀 既存ローカルコミットを main へ push 完了。"
    exit 0
  elif [ -n "$REMOTE_HAS" ]; then
    log "origin/main に既に本日記事のコミットあり: ${REMOTE_HAS}"
    exit 0
  else
    die "ステージ差分なし・HEAD は origin と同位・origin にも本日記事なし。状態が不明のため手動確認してください。"
  fi
fi

# commit: 失敗（UU 残置や hook エラー等）したら必ず die する。
# 旧コードは exit 状態を見ずに進み、後続の push が no-op で「Everything up-to-date」を
# 返したため、ラッパーが「🚀 成功」と偽の成功ログを出してしまっていた（2026-05-25 事故）。
if ! git -c user.name="NAGOYA BITES Daily" -c user.email="daily@nagoya-bites" \
       commit -m "journal: ${TODAY_JST} — ローカル自動生成（launchd）" >>"$LOG" 2>&1; then
  log "❌ git commit が失敗しました。直近の状態:"
  git status -sb | tee -a "$LOG"
  die "commit 失敗。手動で原因を確認してください。"
fi

# 念のため、commit 後 HEAD が実際に origin/main より進んだか検証（黙って commit が空だった等を弾く）
AHEAD_AFTER_COMMIT=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
if [ "$AHEAD_AFTER_COMMIT" -lt 1 ]; then
  die "commit 完了とされたが HEAD が origin/main を超えていません。状態不明。"
fi

# 記事HTML が今回のコミットに含まれているか（メタデータだけ commit のリンク切れを防ぐ）
if ! git diff --name-only "origin/main..HEAD" | grep -q "^${ARTICLE_HTML}$"; then
  log "コミット範囲に ${ARTICLE_HTML} が含まれていません:"
  git diff --name-only "origin/main..HEAD" | tee -a "$LOG"
  die "記事HTMLが未コミット。site でリンク切れになるため push しません。"
fi

# push: rejected なら 1回だけ pull --rebase --autostash して retry
if ! git push origin main >>"$LOG" 2>&1; then
  log "push 拒否。pull --rebase --autostash で再同期して再 push します。"
  git pull --rebase --autostash origin main >>"$LOG" 2>&1 || die "再同期に失敗"
  # 再同期後も UU が出ていないか確認
  UU_RETRY=$(git ls-files --unmerged | wc -l | tr -d ' ')
  [ "$UU_RETRY" != "0" ] && die "再同期で UU 発生。手動解消してください。"
  git push origin main >>"$LOG" 2>&1 || die "再 push に失敗"
fi

# 最終検証: origin に本当に反映されたか
git fetch origin main >>"$LOG" 2>&1 || true
if ! git log origin/main --oneline -1 -- "journal/${TODAY_JST}-"*.html >/dev/null 2>&1 || \
   [ -z "$(git log origin/main --oneline -- "journal/${TODAY_JST}-"*.html 2>/dev/null)" ]; then
  die "push 後も origin/main に本日記事の commit が見えません。状態を手動確認してください。"
fi

log "🚀 main へ push 完了（origin に本日記事の commit を確認）。"
exit 0
