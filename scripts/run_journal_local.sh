#!/bin/bash
# NAGOYA BITES — 日次ジャーナル ローカル自動生成（コストゼロ運用）
#
# サブスク認証済みの claude CLI を使い、API 従量課金なしで毎日ジャーナルを生成する。
# launchd（~/Library/LaunchAgents/com.nagoyabites.journal.plist）から毎朝 9:00 JST に起動される想定。
#
# GitHub Actions 版（.github/workflows/daily-journal.yml）は ANTHROPIC_API_KEY（有料）が必要なため
# 課金回避としてローカル launchd をジャーナル生成の主経路にする。
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

cd "$REPO" || { log "ERROR: repo not found: $REPO"; exit 1; }

log "=== 日次ジャーナル ローカル生成開始 ==="

# 最新の main を取り込む（ローカル変更があれば一旦退避）
git checkout main >>"$LOG" 2>&1
git pull --rebase --autostash origin main >>"$LOG" 2>&1 || log "WARN: git pull に失敗（続行）"

TODAY_JST=$(TZ=Asia/Tokyo date +%Y-%m-%d)

# 既に本日分が published.json に登録済みならスキップ（重複生成防止）
ALREADY=$(node -e "
  try {
    const p = require('./data/journal_published.json');
    const hit = (p.entries || []).some(e => e.date === '${TODAY_JST}');
    process.stdout.write(hit ? '1' : '0');
  } catch (e) { process.stdout.write('0'); }
")
if [ "$ALREADY" = "1" ]; then
  log "本日(${TODAY_JST})は既に公開済み。スキップします。"
  exit 0
fi

# journal-today.md の本文（front matter 1-4行を除く）をプロンプトとして渡す
PROMPT=$(tail -n +5 .claude/commands/journal-today.md)

log "claude 生成を開始（サブスク認証・--dangerously-skip-permissions）"
"$CLAUDE_BIN" --print "$PROMPT" --dangerously-skip-permissions >>"$LOG" 2>&1
CLAUDE_RC=$?
log "claude 終了コード: ${CLAUDE_RC}"

# 検証: 本日分が published.json に登録されたか（サイレント失敗の検知）
OK=$(node -e "
  try {
    const p = require('./data/journal_published.json');
    const hit = (p.entries || []).some(e => e.date === '${TODAY_JST}');
    process.stdout.write(hit ? '1' : '0');
  } catch (e) { process.stdout.write('0'); }
")
if [ "$OK" = "1" ]; then
  log "✅ ${TODAY_JST} のジャーナルが published.json に登録されました。"
  exit 0
else
  log "❌ ${TODAY_JST} が published.json に未登録。生成失敗の可能性（上記ログ参照）。"
  exit 1
fi
