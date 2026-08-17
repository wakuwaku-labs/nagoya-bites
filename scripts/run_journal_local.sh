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

# ---- ハング対策の時間設定（2026-08-17 の事故）----
# 08-17 09:00 の実行が claude 呼び出しの直後で固まり、6時間47分ものあいだ CPU をほとんど
# 使わないまま応答を返さなかった。当時の実装には制限時間が無く、3回リトライも
# ネットワーク一時エラー判定も「呼び出しが戻ってくること」が前提だったため一度も発火しない。
# さらに PID ロックを握ったままだったので、翌朝以降の実行もすべて exit 0 で黙ってスキップされる
# 状態だった（1日の欠番ではなく、人が殺すまで無期限に止まる故障）。
CLAUDE_TIMEOUT_SEC="${CLAUDE_TIMEOUT_SEC:-1800}"   # 生成1回あたりの上限（30分）
STALE_LOCK_SEC="${STALE_LOCK_SEC:-5400}"           # これを超えたロックはハングとみなす（90分）

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"; }

# macOS には coreutils の timeout が無いため、バックグラウンド実行＋見張りで代替する。
# 制限時間を超えたら TERM → 5秒後に KILL し、専用の終了コード 124 を返す。
run_with_timeout() {
  local limit="$1"; shift
  "$@" >>"$LOG" 2>&1 &
  local cpid=$! waited=0
  while kill -0 "$cpid" 2>/dev/null; do
    if [ "$waited" -ge "$limit" ]; then
      log "⏱ ${limit}秒を超えても応答がないため打ち切ります（PID ${cpid}）"
      kill "$cpid" 2>/dev/null
      sleep 5
      kill -9 "$cpid" 2>/dev/null
      wait "$cpid" 2>/dev/null
      return 124
    fi
    sleep 10
    waited=$((waited + 10))
  done
  wait "$cpid"
}
die() { log "❌ $*"; record_health "die" "$*"; notify "日次ジャーナル停止" "$*"; exit 1; }

# ---- 実行状態を「Mac の外から見える場所」に記録する（ISSUE-084）----
# 2026-08-12 の教訓: 失敗の証跡（HOLD メモ・実行ログ）は .local-logs/ にしか無く、
# そこは .gitignore 対象＝この Mac から一歩も出なかった。警報は鳴っていたが誰にも聞こえず、
# 08-05〜09 の5日欠番も 08-10〜12 の3日欠番も、オーナーがサイトを見て気づくまで放置された。
# そこで実行結果を tracked ファイルに書いて push し、サーバ側の監視
# （.github/workflows/journal-watchdog.yml）が「原因つきで」Issue を起票できるようにする。
HEALTH_FILE="${REPO}/data/journal_health.json"
# hold() は最後に die() を呼ぶ。素直に書くと die 側の汎用メッセージが
# 「認証切れ」等の具体的な理由を上書きしてしまうため、最初の記録を勝たせる。
HEALTH_RECORDED=0
record_health() {
  [ "$HEALTH_RECORDED" = "1" ] && return 0
  HEALTH_RECORDED=1
  local status="$1" reason="$2"
  node -e '
    const fs = require("fs");
    const [file, date, status, reason] = process.argv.slice(1);
    fs.writeFileSync(file, JSON.stringify({
      description: "日次ジャーナル ローカル実行(launchd)の最終状態。journal-watchdog.yml が原因表示に使う。",
      date, status, reason,
      recorded_at: new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace("Z", "+09:00"),
    }, null, 2) + "\n");
  ' "$HEALTH_FILE" "${TODAY_JST:-unknown}" "$status" "$reason" 2>>"$LOG" || return 0
}

# 状態ファイルだけを surgical に push する。記事本体の commit/push とは独立させ、
# 失敗しても本処理を止めない（監視は published.json 側でも成立するため）。
push_health() {
  git add data/journal_health.json >>"$LOG" 2>&1 || return 0
  git diff --staged --quiet -- data/journal_health.json && return 0
  git -c user.name="NAGOYA BITES Daily" -c user.email="daily@nagoya-bites" \
      commit -m "chore(journal): ローカル実行状態を記録 ${TODAY_JST:-unknown} [skip actions]" \
      -- data/journal_health.json >>"$LOG" 2>&1 || return 0
  if ! git push origin main >>"$LOG" 2>&1; then
    git pull --rebase --autostash origin main >>"$LOG" 2>&1 \
      && git push origin main >>"$LOG" 2>&1 \
      || log "⚠️ journal_health.json の push に失敗（監視は published.json 側で継続します）"
  fi
}

# 目の前に居る場合の即時シグナル。届かない環境（離席・スリープ）もあるため、
# これは補助であって主経路ではない。主経路はあくまで watchdog の Issue → メール。
notify() {
  local title="$1" msg="$2"
  osascript -e "display notification \"${msg//\"/}\" with title \"NAGOYA BITES — ${title//\"/}\"" >/dev/null 2>&1 || true
}

# HOLD: 「公開はしないが、当日中に人が気づける形で残す」終了経路（ISSUE-077 / C）。
# 旧実装は die するだけだったため、記事が出ていない事実に数日後まで誰も気づかなかった
# （7/24 の停止が発覚したのは 7/27）。HOLD メモを固定パスに書き出し、次回実行時にも警告する。
hold() {
  local reason="$1"
  local holdfile="${LOG_DIR}/HOLD-${TODAY_JST}.md"
  {
    echo "# 日次ジャーナル HOLD — ${TODAY_JST}"
    echo
    echo "- 検出時刻: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "- 理由: ${reason}"
    echo
    echo "## 状況"
    echo "- 記事HTML: $(ls journal/${TODAY_JST}-*.html 2>/dev/null || echo '(なし)')"
    echo "- SNS原稿 : $(ls docs/daily-posts/${TODAY_JST}.md 2>/dev/null || echo '(なし)')"
    echo "- 実行ログ: ${LOG}"
    echo
    echo "## 手動で公開する場合の手順"
    echo '```bash'
    echo "cd ${REPO}"
    echo "node scripts/validate_journal_draft.js journal/${TODAY_JST}-<slug>.html docs/daily-posts/${TODAY_JST}.md"
    echo "node scripts/register_journal_entry.js journal/${TODAY_JST}-<slug>.html"
    echo "node scripts/build_journal_index.js"
    echo "git add -A && git commit -m 'journal: ${TODAY_JST}' && git push origin main"
    echo '```'
    echo
    echo "解消したらこのファイルを削除してください（残っている限り毎朝の実行で警告が出ます）。"
  } > "$holdfile"
  log "🛑 HOLD: ${reason}"
  log "   HOLDメモを書き出しました: ${holdfile}"
  # HOLD メモはこの Mac の外に出ない（.local-logs/ は .gitignore 対象）。
  # 状態ファイルを push して、サーバ側の watchdog が原因つきで通知できるようにする。
  record_health "hold" "$reason"
  push_health
  notify "本日の記事は未公開（HOLD）" "$reason"
  die "本日は公開を見送りました（HOLD）。${holdfile} を確認してください。"
}

cd "$REPO" || die "repo not found: $REPO"

# ---- 0. 同時実行ロック（macOSにはflock無し → PIDfile方式）----
# 重複起動（前回の実行がハングしたままlaunchdが次回発火 等）を防ぐ。
LOCKFILE="${LOG_DIR}/run.lock"
if [ -f "$LOCKFILE" ]; then
  OLDPID=$(cat "$LOCKFILE" 2>/dev/null || echo "")
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    # 「PID が生きている＝正常に作業中」とは限らない（2026-08-17 の事故）。
    # ハングしたプロセスがロックを握り続けると、以降の実行が毎日 exit 0 で黙って
    # スキップされ、失敗としても記録されない。経過時間でハングを見分けて奪い返す。
    LOCK_MTIME=$(stat -f %m "$LOCKFILE" 2>/dev/null || echo 0)
    LOCK_AGE=$(( $(date +%s) - LOCK_MTIME ))
    if [ "$LOCK_MTIME" -gt 0 ] && [ "$LOCK_AGE" -ge "$STALE_LOCK_SEC" ]; then
      log "⚠️ PID ${OLDPID} は生存中だがロック取得から ${LOCK_AGE}秒 経過。ハングとみなし強制終了して引き継ぎます。"
      kill "$OLDPID" 2>/dev/null
      sleep 5
      kill -9 "$OLDPID" 2>/dev/null
      rm -f "$LOCKFILE"
    else
      log "別の実行 (PID ${OLDPID}) が進行中です。終了します。"
      exit 0
    fi
  else
    log "古いロックファイル (PID ${OLDPID}) を除去します"
    rm -f "$LOCKFILE"
  fi
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT INT TERM

log "=== 日次ジャーナル ローカル生成開始 (PID $$) ==="
TODAY_JST=$(TZ=Asia/Tokyo date +%Y-%m-%d)

# 過去の HOLD が未解消なら毎朝知らせる（気づかないまま欠番が積み上がるのを防ぐ）
PREV_HOLDS=$(ls "${LOG_DIR}"/HOLD-*.md 2>/dev/null | grep -v "HOLD-${TODAY_JST}.md" || true)
if [ -n "$PREV_HOLDS" ]; then
  log "⚠️ 未解消の HOLD が残っています（過去に公開を見送った日があります）:"
  echo "$PREV_HOLDS" | tee -a "$LOG"
  log "   内容を確認し、対応後に該当ファイルを削除してください。"
fi

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

# pull が "untracked working tree files would be overwritten by merge" → Aborting で
# 恒常的に死ぬデッドロックを断つ。原因は journal-today SKILL.md Step10 等が
# worktree→main へ cp した記事ファイルが main に未追跡で残り、後で origin/main 側に
# 同名でコミットされると pull が拒否されること（2026-06-18〜22 のジャーナル停止の真因）。
# origin/main に正本がある untracked は安全に削除してよい（消えても origin/main から復元される）。
# --exclude-standard により .gitignore 対象（node_modules / .local-logs 等）は触らない。
PRUNED=0
while IFS= read -r -d '' uf; do
  if git cat-file -e "origin/main:$uf" 2>/dev/null; then
    rm -f -- "$uf" && PRUNED=$((PRUNED+1))
  fi
done < <(git ls-files --others --exclude-standard -z)
[ "$PRUNED" -gt 0 ] && log "pull 前クリーンアップ: origin/main に正本のある untracked ファイル ${PRUNED} 件を除去（cp残骸・衝突防止）"

# 前回実行が生成後・commit前（例: validator FAIL）に die した場合、その差分が
# working tree に残ったまま次回実行を迎える。--autostash はこの残置差分を毎回
# stash→pop するだけで根治しないため、日をまたいで別の変更（他エージェントが
# 触った agent-backlog.md 等）と衝突し、reapply 失敗で pull ごと死ぬ
# （2026-07-24 の実事故: agent-backlog.md で UU 発生・9時ジョブが以後停止）。
# ここで「起動時点で残っている汚れ」は前回実行の残骸として名前付き stash に
# 退避し、pull はクリーンな working tree に対して行う（--autostash は保険として残す
# が、通常は空振りになるはず）。stash は pop せず残す＝データは失わず、
# 必要なら `git stash list` から手動で拾える。
if [ -n "$(git status --porcelain)" ]; then
  DEBRIS_MSG="auto-cleanup-debris-$(TZ=Asia/Tokyo date +%Y%m%d-%H%M%S)"
  log "起動時点で working tree に残置差分を検出。前回実行の残骸として stash に退避します: ${DEBRIS_MSG}"
  git status --porcelain | tee -a "$LOG"
  git stash push -u -m "$DEBRIS_MSG" >>"$LOG" 2>&1 \
    && log "退避完了。git stash list で確認できます（pop はしません）。" \
    || log "⚠️ stash 退避に失敗しましたが続行します（pull 側の --autostash に委ねます）。"
fi

if ! git pull --rebase --autostash origin main >>"$LOG" 2>&1; then
  log "git pull --rebase が失敗。状態:"
  git status -sb | tee -a "$LOG"
  git diff --name-only --diff-filter=U | tee -a "$LOG"

  # 中断した rebase を必ず畳んでから終わる（ISSUE-079）。
  # 旧実装は die するだけで rebase 中断状態を放置していたため、リポジトリが
  # 「rebase in progress」のまま丸一日残り、翌朝の実行はもちろん seo-triage 等の
  # 他ルーチンまで巻き込んで全停止した（2026-07-31 に実発生。7/30 の未 push コミットが
  # agent-backlog.md で衝突 → 以後すべてブロック）。
  # abort すればローカルコミットは失われず、作業ツリーは健全な状態に戻るので、
  # 少なくとも「1日分の記事が出ない」だけで済み、翌朝は自動で再試行できる。
  if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
    log "中断した rebase を abort して作業ツリーを健全な状態へ戻します（ローカルコミットは保持）。"
    git rebase --abort >>"$LOG" 2>&1 \
      && log "rebase --abort 完了。リポジトリはクリーンです。" \
      || log "⚠️ rebase --abort に失敗。手動で解消してください。"
  fi
  hold "origin/main の取り込みに失敗（衝突）。rebase は abort 済みなのでリポジトリは操作可能な状態です。未 push のローカルコミットが origin と衝突していないか確認してください。"
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
# ネットワーク瞬断（socket closed / FailedToOpenSocket 等）は claude 側の一時的な通信エラーで、
# 認証切れ（401 Invalid authentication credentials）とは別物。前者はリトライで復旧するが、
# 後者はリトライしても無駄なので即座に諦める（2026-07-14/07-15 のネットワーク瞬断による
# 欠番を教訓に導入。認証エラーまでリトライすると失敗ログが埋もれて気づくのが遅れる）。
#
# 2026-08-10 追記（08-05 / 08-07 / 08-08 / 08-09 の4日欠番の真因）:
#   claude CLI が実際に吐いたのは "API Error: Connection closed mid-response." で、
#   下の一時エラー判定パターンのどれにも当たらなかった。結果 MAX_CLAUDE_ATTEMPTS=3 の
#   リトライが一度も発火せず、瞬断1回で即 HOLD → その日の記事がゼロになっていた。
#   「リトライ機構はあるのに、エラー文言の形が変わると丸ごと空振りする」という壊れ方なので、
#   文言を足すときは実ログ（.local-logs/journal-YYYY-MM-DD.log）の原文に合わせること。
#
# 2026-08-12 追記（08-10 / 08-11 / 08-12 の3日欠番の真因）:
#   claude CLI が "Failed to authenticate: OAuth session expired and could not be refreshed"
#   を返し、認証切れとして即 HOLD になっていた。これはコードでは復旧できず、
#   Mac で対話ログインし直す以外に手が無い（＝人が気づくことが唯一の復旧経路）。
#   にもかかわらず通知経路が .local-logs/ しか無かったため3日間気づかれなかった。
#   下のプリフライトで「生成に40分費やす前に」認証を確かめ、
#   watchdog（サーバ側）が同じ朝のうちに Issue でオーナーに知らせる構成にした。

# ---- 3.5 認証プリフライト ----
# 認証切れは本番生成を回す前に判る。先に確かめれば、原因が「認証」だと確定した
# 状態で即座に HOLD でき、長い生成ログの中に埋もれない。
log "claude 認証プリフライトを実行（サブスク認証の有効性を確認）"
PREFLIGHT_OUT=$("$CLAUDE_BIN" --print "ok" --dangerously-skip-permissions 2>&1)
PREFLIGHT_RC=$?
if [ "$PREFLIGHT_RC" != "0" ]; then
  echo "$PREFLIGHT_OUT" >>"$LOG"
  # 認証切れだけを特別扱いする。ネットワーク瞬断ならリトライ機構のある本番ループに委ねる。
  if echo "$PREFLIGHT_OUT" | grep -qE "Invalid authentication credentials|Failed to authenticate|OAuth session expired"; then
    hold "claude の認証が切れています（OAuth session expired）。コードでは復旧できません。Mac で 'claude' を対話起動してログインし直してください。確認: claude --print \"ok\" が応答すればOK。"
  fi
  log "⚠️ プリフライトは失敗しましたが認証エラーではないため本番生成に進みます（リトライ機構に委ねる）: RC=${PREFLIGHT_RC}"
else
  log "✅ 認証プリフライト OK"
fi

# ---- 3.6 中間成果物チェック（ISSUE-085: 接続断後の再開最適化）----
# 接続断のリトライ時に全工程をやり直す無駄を防ぐ。
# 前回実行が残した中間成果物を確認し、前回の到達点以降から再開する。
# ① 下書きHTML が存在 → claude 全工程をスキップし Step 5 の自動復旧に委ねる（最速）
# ② 採点済み候補(PASS)が存在 → リサーチ+候補生成をスキップする短縮プロンプトで再開
# ③ どちらも無し → 通常フロー（変更なし）
# ログに [RESUME] / [NEW] を出力するので、再開か新規かを後から識別できる（acceptance ③）
SKIP_CLAUDE=0
RESUME_FROM_CANDIDATES=0

# チェック A: 下書き HTML が存在すれば claude をスキップし Step 5 の自動復旧に委ねる
DRAFT_HTML=""
for f in "journal/drafts/${TODAY_JST}"-*.html; do
  [ -e "$f" ] && DRAFT_HTML="$f" && break
done
if [ -n "$DRAFT_HTML" ]; then
  DRAFT_SLUG=$(basename "$DRAFT_HTML" .html)
  DRAFT_DEST="journal/${DRAFT_SLUG}.html"
  log "🔄 [RESUME] 中間成果物を検出: 下書きHTML = ${DRAFT_HTML}"
  log "   claude 全工程をスキップ。ラッパーの検証フロー（Step 5）へ直接移行します。"
  if [ ! -f "$DRAFT_DEST" ]; then
    mv "$DRAFT_HTML" "$DRAFT_DEST" \
      && log "   下書きを journal/ へ昇格しました: ${DRAFT_DEST}" \
      || log "⚠️ 昇格失敗。Step 5 の自動復旧フローで再試行します。"
  fi
  SKIP_CLAUDE=1
fi

# チェック B: 採点済み候補が存在し PASS 候補があれば、リサーチ+候補生成をスキップして執筆から再開
CANDIDATES_JSON="data/journal_candidates/${TODAY_JST}.json"
if [ "$SKIP_CLAUDE" = "0" ] && [ -f "$CANDIDATES_JSON" ]; then
  BEST_SCORE=$(node -e "
    try {
      const d = require('./${CANDIDATES_JSON}');
      const ranked = d.ranked || [];
      const passing = ranked.find(c => c.verdict === 'PASS');
      process.stdout.write(passing ? String(passing.total) : '0');
    } catch(e) { process.stdout.write('0'); }
  " 2>/dev/null || echo "0")
  if [ "${BEST_SCORE}" -ge 95 ] 2>/dev/null; then
    log "🔄 [RESUME] 中間成果物を検出: 採点済み候補 = ${CANDIDATES_JSON}（最高スコア: ${BEST_SCORE}）"
    log "   Step 2〜3（リサーチ・候補生成）をスキップし、Step 3.5（写真調査）以降から再開します。"
    RESUME_FROM_CANDIDATES=1
  else
    log "[NEW] 候補JSON(${CANDIDATES_JSON})を検出しましたが PASS 候補なし（最高スコア: ${BEST_SCORE}）。通常フローで再生成します。"
  fi
fi
[ "$SKIP_CLAUDE" = "0" ] && [ "$RESUME_FROM_CANDIDATES" = "0" ] && log "[NEW] 中間成果物なし。通常フローで生成します。"

PROMPT=$(tail -n +5 .claude/commands/journal-today.md)
if [ "$RESUME_FROM_CANDIDATES" = "1" ]; then
  RESUME_HEADER="【前回実行の中間成果物から再開 — [RESUME from candidates: ${TODAY_JST}]】
data/journal_candidates/${TODAY_JST}.json に採点済みの候補アングルが保存されています。
Step 2（テーマ取得）と Step 3（候補生成・採点）は完了済みです。
このファイルを読んで最高スコアの PASS 候補を確認し、journal-today.md の Step 3.5（写真調査）以降から作業を再開してください。
再開である旨を実行ログの冒頭に「[RESUME from candidates: ${TODAY_JST}]」と記録してください。"
  PROMPT="${RESUME_HEADER}

${PROMPT}"
  log "再開プロンプトを使用します（Step 3.5 以降から再開）"
fi

if [ "$SKIP_CLAUDE" = "0" ]; then
  MAX_CLAUDE_ATTEMPTS=3
  CLAUDE_ATTEMPT=1
  while :; do
    log "claude 生成を開始（サブスク認証・--dangerously-skip-permissions・試行 ${CLAUDE_ATTEMPT}/${MAX_CLAUDE_ATTEMPTS}）"
    run_with_timeout "$CLAUDE_TIMEOUT_SEC" \
      "$CLAUDE_BIN" --print "$PROMPT" --dangerously-skip-permissions
    CLAUDE_RC=$?
    log "claude 終了コード: ${CLAUDE_RC}"
    if [ "$CLAUDE_RC" = "0" ]; then
      break
    fi
    # 124 = run_with_timeout による打ち切り。ログには何も出ないまま止まるため、
    # 下のネットワークエラー判定（ログの文字列を見る）ではリトライ対象にならない。
    # ハングは再試行で直ることが多いので、ここで明示的に再試行へ回す。
    if [ "$CLAUDE_RC" = "124" ]; then
      if [ "$CLAUDE_ATTEMPT" -ge "$MAX_CLAUDE_ATTEMPTS" ]; then
        log "応答なしが ${MAX_CLAUDE_ATTEMPTS} 回続いたため諦めます。"
        record_health "hang" "claude が ${CLAUDE_TIMEOUT_SEC}秒 応答せず（${MAX_CLAUDE_ATTEMPTS}回連続）"
        break
      fi
      log "応答なしのため 30秒待機してリトライします。"
      sleep 30
      CLAUDE_ATTEMPT=$((CLAUDE_ATTEMPT + 1))
      continue
    fi
    if grep -qE "Invalid authentication credentials|Failed to authenticate" "$LOG"; then
      log "認証エラーを検出。リトライしても復旧しないため即座に諦めます。"
      break
    fi
    if [ "$CLAUDE_ATTEMPT" -ge "$MAX_CLAUDE_ATTEMPTS" ]; then
      log "最大試行回数（${MAX_CLAUDE_ATTEMPTS}）に到達。諦めます。"
      break
    fi
    if ! grep -qE "socket connection was closed|Connection closed mid-response|Connection error|stream (was )?(closed|interrupted)|FailedToOpenSocket|ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|network|Unable to connect to API|API Error: 5[0-9][0-9]|Overloaded" "$LOG"; then
      log "既知のネットワーク一時エラーではないためリトライしません。"
      break
    fi
    log "ネットワーク一時エラーを検出。30秒待機してリトライします。"
    sleep 30
    CLAUDE_ATTEMPT=$((CLAUDE_ATTEMPT+1))
  done
else
  log "🔄 [RESUME] claude 全工程をスキップしました（下書きHTMLから直接 Step 5 へ）"
fi

# ---- 5. 検証 ----
# (a) published.json に本日エントリが入ったか
OK=$(node -e "
  try {
    const p = require('./data/journal_published.json');
    process.stdout.write((p.entries||[]).some(e=>e.date==='${TODAY_JST}') ? '1' : '0');
  } catch (e) { process.stdout.write('0'); }
")
if [ "$OK" != "1" ]; then
  # ---- 自動復旧（ISSUE-077 / C: never-stop 保証）----
  # 「記事は完成しているのに published.json が未登録」= エージェントが登録前に停止した状態。
  # 実例: 2026-07-22（validator の誤検知で die → 本番404）/ 2026-07-27（95点ゲート未達で
  # 承認待ち。ヘッドレスなので誰も答えられない）。成果物が揃っていて独立 validator が
  # PASS するなら、ラッパー側で登録して通常フローに戻す。
  # ※ validator は迂回しない。品質ゲートを通らないものは HOLD にして公開しない。
  log "published.json に ${TODAY_JST} が未登録。エージェントが登録前に停止した可能性があるため、成果物からの自動復旧を試みます。"

  RESCUE_HTML=""
  for f in journal/"${TODAY_JST}"-*.html; do
    [ -e "$f" ] && RESCUE_HTML="$f" && break
  done
  RESCUE_MD="docs/daily-posts/${TODAY_JST}.md"

  if [ -z "$RESCUE_HTML" ]; then
    hold "記事HTML（journal/${TODAY_JST}-*.html）が存在しない。生成そのものが失敗しています。"
  fi
  if [ ! -f "$RESCUE_MD" ]; then
    hold "SNS原稿（${RESCUE_MD}）が存在しない。生成が途中で止まっています。記事HTML=${RESCUE_HTML}"
  fi

  log "成果物を検出: ${RESCUE_HTML} / ${RESCUE_MD}"
  log "独立 validator で公開可否を判定します（品質ゲートは迂回しません）。"
  if ! node scripts/validate_journal_draft.js "$RESCUE_HTML" "$RESCUE_MD" >>"$LOG" 2>&1; then
    hold "validator が FAIL。品質ゲートを通らないため公開しません。詳細は ${LOG} の末尾を確認してください。"
  fi
  log "✅ validator PASS。ラッパー側で published.json に登録します。"

  node scripts/register_journal_entry.js "$RESCUE_HTML" --by-wrapper >>"$LOG" 2>&1 \
    || hold "published.json への登録に失敗しました（register_journal_entry.js）。"

  node scripts/build_journal_index.js >>"$LOG" 2>&1 \
    || hold "索引・フィードの再生成に失敗しました（build_journal_index.js）。"

  OK=$(node -e "
    try {
      const p = require('./data/journal_published.json');
      process.stdout.write((p.entries||[]).some(e=>e.date==='${TODAY_JST}') ? '1' : '0');
    } catch (e) { process.stdout.write('0'); }
  ")
  if [ "$OK" != "1" ]; then
    hold "登録処理は成功したのに published.json に ${TODAY_JST} が反映されていません。状態異常です。"
  fi
  log "🔧 自動復旧に成功しました。通常フロー（検証 → commit → push）に合流します。"
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

# ---- 5f. 関連記事リンクを更新（SEO-046）----
# 新記事公開後に全記事の <div class="related"> を「直近3本の他記事＋特集リンク」に更新する。
# 失敗しても記事公開を止めないため非ブロッキング（|| true）。
log "関連記事リンクを更新（refresh_journal_related.js）"
node scripts/refresh_journal_related.js >>"$LOG" 2>&1 || log "⚠️ refresh_journal_related.js 失敗（非ブロッキング）"

# ---- 5g. サイト紹介文を記事冒頭に注入（SEO-008）----
# 「NAGOYA BITES — 名古屋の厳選1,100店超…」1行 + index.html リンクを art-body 先頭に設置。
# 検索流入で入ったユーザーがサイト全体を知らないまま離脱するのを防ぐ。
# 失敗しても記事公開を止めないため非ブロッキング（|| true）。
log "サイト紹介文を記事冒頭に注入（add_journal_site_intro.js）"
node scripts/add_journal_site_intro.js "$ARTICLE_HTML" >>"$LOG" 2>&1 || log "⚠️ add_journal_site_intro.js 失敗（非ブロッキング）"

# ---- 5h. OGP画像を SNS が描画できる形に確定させる ----
# X / Facebook / LINE は og:image の SVG を描画しない。図解を hero にした日は
# そのままだとSNS共有でサムネイルが出ず、日次ジャーナルの主要導線の CTR を落とす。
# 記事HTMLは claude が直接書く経路もある（generate_daily_draft.js を通らない）ため、
# ラッパー側でも独立に正規化する（validator と同じ「ラッパーが独立に担保する」方針）。
# 記事公開そのものは止めないため非ブロッキング。取りこぼしは CI の --check が拾う。
# --only で当日分だけに絞るのは必須。過去記事まで書き換えると surgical な git add から漏れ、
# 作業ツリーが汚れたまま翌日を迎えて git pull が死ぬ（過去に複数回起きた故障モード）。
log "OGP画像を正規化（render_og_figures.js → normalize_og_images.js）"
node scripts/render_og_figures.js --only "$TODAY_JST" >>"$LOG" 2>&1 || log "⚠️ render_og_figures.js 失敗（非ブロッキング）"
node scripts/normalize_og_images.js --only "$TODAY_JST" >>"$LOG" 2>&1 || log "⚠️ normalize_og_images.js 失敗（非ブロッキング）"

# ---- 6. ラッパーが commit & push を確実に実行 ----
# claude (journal-today.md Step 10) は「ユーザー承認後のみ push」と定義されているため
# ヘッドレスでは承認者が居らず未 push 終了になる。それを補うため、ここで強制 commit/push する。
# 未追跡 junk（root の *.html や " 2.json" 等）の混入を防ぐため surgical に指定。
log "ラッパー側で commit & push を実行（claude の承認待ちフローを迂回）"

# 正常公開を記録する。ファイルは下の TRACKED_UPDATES に含めて通常のコミットに同乗させる
# （単独 push はしない＝作業ツリーを汚したまま翌朝を迎えることが無いようにする）。
record_health "ok" "正常に公開"

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
  data/journal_health.json
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
# refresh_journal_related.js が更新した他記事の関連リンクも含める（SEO-046）
git add journal/ 2>>"$LOG" || true

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
