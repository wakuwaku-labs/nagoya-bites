#!/bin/zsh
# マージのあとの確認を、最新の origin/main に対して流す（P-323）。手で毎回行っていた「新しい作業用 worktree に main を出す →
# node_modules をつなぐ → 監査を流す → 片付ける」を 1 本にしたもの。
#
# 使い方: docs/qa/uiux-2026-10/prod/post_merge_checks.sh [--tests] [--smoke]
#   既定: 監査 5 本（デザインシステム・生成ページのインライン JS・共通クローム・デザインシステムの適用・404 ページ）
#   --tests : npm test も流す（約 1 分）
#   --smoke : 本番のスモーク（prod_smoke.js の 12 件）も流す。これは本番を読むだけで、手元の worktree には依らない
# どれかが外れたら FAIL と最後の数行を出し、最後に exit 1。一時の worktree は、node_modules のリンクを外してから片付ける。
# ビルドと Pages がまだ終わっていないと、main の先頭が bot のコミットの前の版になる。wait_main.sh の exit=0 のあとに流す。
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
here=$(pwd)
want_tests=0; want_smoke=0
for a in "$@"; do
  case $a in
    --tests) want_tests=1 ;;
    --smoke) want_smoke=1 ;;
    *) echo "使い方: post_merge_checks.sh [--tests] [--smoke]"; exit 2 ;;
  esac
done

git fetch origin -q || { echo "git fetch に失敗した"; exit 1; }
tmp=$(mktemp -d "${TMPDIR:-/tmp}/nb-postmerge.XXXXXX") || exit 1
wt=$tmp/main
git worktree add -q --detach "$wt" origin/main || { rmdir "$tmp" 2>/dev/null; exit 1; }
ln -s "$here/node_modules" "$wt/node_modules"
cleanup() {
  rm -f "$wt/node_modules"
  git worktree remove --force "$wt" >/dev/null 2>&1
  rm -rf "$tmp"
}
trap cleanup EXIT

bad=0
run() { # 名前 実行する場所 コマンド...
  local name=$1 where=$2; shift 2
  if ( cd "$where" && "$@" ) >"$tmp/out.txt" 2>&1; then echo "PASS $name"
  else echo "FAIL $name"; tail -5 "$tmp/out.txt" | cut -c1-200 | sed 's/^/    /'; bad=$((bad+1)); fi
}

echo "main: $(git -C "$wt" rev-parse --short HEAD)  $(git -C "$wt" log -1 --format=%s | cut -c1-70)"
run "audit_design_system --check" "$wt" node scripts/audit_design_system.js --check
run "audit_inline_js_syntax --check" "$wt" node scripts/audit_inline_js_syntax.js --check
run "apply_site_chrome --check" "$wt" node scripts/apply_site_chrome.js --check
run "apply_design_system --check" "$wt" node scripts/apply_design_system.js --check
run "gen_404_page --check" "$wt" node scripts/gen_404_page.js --check
(( want_tests )) && run "npm test" "$wt" npm test
(( want_smoke )) && run "prod_smoke（本番）" "$here" perl -e 'alarm 150; exec @ARGV' node docs/qa/uiux-2026-10/prod/prod_smoke.js
if (( bad )); then echo "FAIL: $bad 件"; exit 1; fi
echo "ok: すべて通った"
exit 0
