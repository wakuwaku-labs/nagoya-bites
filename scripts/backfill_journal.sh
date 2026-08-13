#!/bin/bash
# NAGOYA BITES — 日次ジャーナルの欠番バックフィル
#
# 使い方: bash scripts/backfill_journal.sh 2026-08-10
#
# なぜ専用スクリプトなのか（ISSUE-084）:
#   欠番のバックフィルはこれまで2回とも「その場でアドホックに手順を組む」形でやっていた
#   （2026-08-10 に4日分、2026-08-12 に2日分）。毎回同じ判断をやり直すのは、
#   run_journal_local.sh が積み上げてきた事故対策（validator を迂回しない・記事HTMLの
#   実在確認・偽の成功ログを出さない）を毎回書き直すことでもあり、抜けが入りやすい。
#   ここに固定して、通常運用と同じゲートを必ず通るようにする。
#
# 通常運用（run_journal_local.sh）との違いは「基準日」だけ:
#   - 採点の基準日に対象日を渡す（--date）。実行日で採点すると、その日には新しかった
#     ニュースが「N日前の古い話」と判定され recency と dedup が不当に下がる
#   - published.json に backfilled フィールドを残し、後から「これは遡って書いた記事」だと分かるようにする
#
# 品質ゲートは通常運用と同一。validator を迂回しないし、通らなければ公開しない。

set -uo pipefail

REPO="/Users/katagirijakutou/nagoya-bites"
CLAUDE_BIN="/Users/katagirijakutou/.local/bin/claude"
LOG_DIR="${REPO}/.local-logs"
mkdir -p "$LOG_DIR"

export PATH="/Users/katagirijakutou/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
unset ANTHROPIC_API_KEY   # サブスク認証を使う（通常運用と同じ）
export DISABLE_AUTOUPDATER=1

TARGET="${1:-}"
if ! echo "$TARGET" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "Usage: bash scripts/backfill_journal.sh YYYY-MM-DD" >&2
  exit 1
fi

LOG="${LOG_DIR}/backfill-${TARGET}.log"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"; }
die() { log "❌ $*"; exit 1; }

cd "$REPO" || die "repo not found: $REPO"

TODAY_JST=$(TZ=Asia/Tokyo date +%Y-%m-%d)
[ "$TARGET" = "$TODAY_JST" ] && die "当日は run_journal_local.sh を使ってください（このスクリプトは過去日専用）"
[ "$TARGET" \> "$TODAY_JST" ] && die "未来日は指定できません: $TARGET"

log "=== 欠番バックフィル開始: ${TARGET} ==="

# ---- 1. すでに公開済みなら何もしない（冪等）----
ALREADY=$(node -e "
  try {
    const p = require('./data/journal_published.json');
    process.stdout.write((p.entries||[]).some(e=>e.date==='${TARGET}') ? '1' : '0');
  } catch (e) { process.stdout.write('0'); }
")
if [ "$ALREADY" = "1" ]; then
  log "${TARGET} は既に published.json に登録済みです。何もしません。"
  exit 0
fi

# ---- 2. 生成（成果物が既にあるなら作り直さない）----
# validator FAIL で止まった後、原因（例: 掲載店が pending_stores.json に未登録）を人が直して
# 再実行する、という流れが実際に起きる（2026-08-11 の復旧で発生）。そこで毎回ゼロから
# 生成し直すと、直した対象とは別の記事が出来上がって作業が無駄になる。
# 記事HTMLとSNS原稿が揃っているなら生成を飛ばして検証から再開する。
EXISTING=""
for f in journal/"${TARGET}"-*.html; do
  [ -e "$f" ] && EXISTING="$f" && break
done
if [ -n "$EXISTING" ] && [ -f "docs/daily-posts/${TARGET}.md" ]; then
  log "既存の成果物を検出したため生成をスキップし、検証から再開します: ${EXISTING}"
  SKIP_GENERATION=1
else
  SKIP_GENERATION=0
fi

if [ "$SKIP_GENERATION" = "0" ]; then
# journal-today の本文をそのまま使い、前置きで「基準日」だけ差し替える。
# プロンプトを複製せず正本を参照することで、通常運用と編集方針がズレないようにする。
BASE_PROMPT=$(tail -n +5 .claude/commands/journal-today.md)
PROMPT="【重要・バックフィル実行】
これは欠番の遡及生成です。本日は ${TODAY_JST} ですが、**対象日は ${TARGET}** です。
以下の手順書の「今日」を全て **${TARGET}** と読み替えて実行してください。

守ること:
- 記事ファイル名は journal/${TARGET}-<slug>.html
- SNS原稿は docs/daily-posts/${TARGET}.md
- published_at は ${TARGET}T08:00:00+09:00
- 採点は必ず基準日を渡す: node scripts/score_journal_candidates.js <候補file> --date ${TARGET}
- リサーチは ${TARGET} 時点で判明していた情報を使う。${TARGET} より後に出た情報を
  「その日のニュース」として書かない（遡って書いた記事だが、内容は当日の視点で成立させる）
- gate_note に「${TODAY_JST} にバックフィル」と明記する
- **commit / push はしないでください**。ラッパー側で行います

---

${BASE_PROMPT}"

MAX_ATTEMPTS=3
ATTEMPT=1
while :; do
  log "claude 生成を開始（試行 ${ATTEMPT}/${MAX_ATTEMPTS}・対象日 ${TARGET}）"
  "$CLAUDE_BIN" --print "$PROMPT" --dangerously-skip-permissions >>"$LOG" 2>&1
  RC=$?
  log "claude 終了コード: ${RC}"
  [ "$RC" = "0" ] && break
  if grep -qE "Invalid authentication credentials|Failed to authenticate|OAuth session expired" "$LOG"; then
    die "認証が切れています。Mac で 'claude' を対話起動してログインし直してください。"
  fi
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    die "最大試行回数（${MAX_ATTEMPTS}）に到達しました。"
  fi
  # 一時エラー判定は run_journal_local.sh と同じ文言集合を使う（ISSUE-083）
  if ! grep -qE "socket connection was closed|Connection closed mid-response|Connection error|stream (was )?(closed|interrupted)|FailedToOpenSocket|ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|network|Unable to connect to API|API Error: 5[0-9][0-9]|Overloaded" "$LOG"; then
    die "既知のネットワーク一時エラーではないため中断します。${LOG} を確認してください。"
  fi
  log "ネットワーク一時エラーを検出。30秒待機してリトライします。"
  sleep 30
  ATTEMPT=$((ATTEMPT+1))
done
fi   # SKIP_GENERATION

# ---- 3. 成果物の実在確認 ----
ART=""
for f in journal/"${TARGET}"-*.html; do
  [ -e "$f" ] && ART="$f" && break
done
[ -z "$ART" ] && die "記事HTMLが生成されていません: journal/${TARGET}-*.html"
MD="docs/daily-posts/${TARGET}.md"
[ -f "$MD" ] || die "SNS原稿が生成されていません: ${MD}"
log "成果物: ${ART} / ${MD}"

# ---- 4. 品質ゲート（通常運用と同一・迂回しない）----
if ! node scripts/validate_journal_draft.js "$ART" "$MD" >>"$LOG" 2>&1; then
  log "   よくある原因: 記事の掲載店が data/pending_stores.json に未登録"
  log "   （その場合は実在を一次情報で確認してから追記し、このスクリプトを再実行してください。"
  log "    成果物は残っているので生成はスキップされ、検証から再開します）"
  die "validator が FAIL。品質ゲートを通らないため公開しません。${LOG} の末尾を確認してください。"
fi
log "✅ validator PASS"

# ---- 5. 登録 ----
if [ "$(node -e "
  try {
    const p = require('./data/journal_published.json');
    process.stdout.write((p.entries||[]).some(e=>e.date==='${TARGET}') ? '1' : '0');
  } catch (e) { process.stdout.write('0'); }
")" != "1" ]; then
  log "published.json に未登録のため、ラッパー側で登録します。"
  node scripts/register_journal_entry.js "$ART" \
    --gate-note "${TODAY_JST} にバックフィル（欠番復旧）。" >>"$LOG" 2>&1 \
    || die "register_journal_entry.js が失敗しました。"
fi

# backfilled フィールドを立てる（後から「遡って書いた記事」だと判別できるようにする）
node -e "
  const fs = require('fs');
  const P = 'data/journal_published.json';
  const p = JSON.parse(fs.readFileSync(P, 'utf8'));
  const e = (p.entries || []).find(x => x.date === '${TARGET}');
  if (!e) { console.error('entry not found'); process.exit(1); }
  e.backfilled = '${TODAY_JST}';
  fs.writeFileSync(P, JSON.stringify(p, null, 2) + '\n');
  console.log('backfilled = ${TODAY_JST} を記録');
" >>"$LOG" 2>&1 || die "backfilled フィールドの記録に失敗しました。"

# ---- 6. 索引・フィード・関連リンク ----
node scripts/build_journal_index.js >>"$LOG" 2>&1 || die "build_journal_index.js が失敗しました。"
node scripts/refresh_journal_related.js >>"$LOG" 2>&1 || log "⚠️ refresh_journal_related.js 失敗（非ブロッキング）"

# 記事が索引に載ったか（偽の成功で終わらせない）
SLUG=$(basename "$ART" .html)
grep -q "$SLUG" journal/feed.xml 2>/dev/null || die "feed.xml に ${SLUG} が出現しません。状態異常です。"
log "✅ feed.xml に ${SLUG} を確認"

log "✅ バックフィル完了: ${TARGET} (${ART})"
log "   commit / push はまだです。差分を確認してから行ってください。"
exit 0
