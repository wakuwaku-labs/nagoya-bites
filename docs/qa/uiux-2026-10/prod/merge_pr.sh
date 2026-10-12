#!/bin/zsh
# PR を main へマージする前の確認と、マージ（P-323）。手で続けて行っていた「ビルドが走っていないか見る →
# 衝突を見る → マージする → 新しいビルドの run id を探す」を 1 本にしたもの。
#
# 使い方:
#   docs/qa/uiux-2026-10/prod/merge_pr.sh <PR番号> [--dry-run]
#   docs/qa/uiux-2026-10/prod/merge_pr.sh --check-adr <基準の ref> <PR の先頭の ref>    # 判断の記録の番号だけ調べる
#
# 確認（1 つでも外れたらマージせず、理由を出して exit 1。--dry-run は確認だけでマージしない）:
#   1. PR が OPEN・下書きではない・base が main
#   2. Build & Deploy が走っても待ってもいない（走行 1 本＋待ち 1 本の枠。別のセッションのマージもここで分かる）
#   3. origin/main の先頭 2 件が bot のコミット（前のビルドの終わり）で、GitHub Pages の最新のビルドが先頭と一致している
#   4. origin/main に対して衝突しない（git merge-tree）
#   5. PR が足した判断の記録（docs/decisions/NNNN-*.md）の番号が、origin/main の番号とも PR の中でも重ならない
#      （2026-10-13、別のセッションが 0027 を先に入れて自分の 0027 と重なった。これを止める）
# マージのあと、新しいビルドの run id を出す。続けて次を実行する:
#   perl -e 'alarm 285; exec @ARGV' zsh docs/qa/uiux-2026-10/prod/wait_main.sh <run id>    # exit=0 が出るまで繰り返す
#   zsh docs/qa/uiux-2026-10/prod/post_merge_checks.sh --tests --smoke                        # 最新の main で監査
set -u
REPO=wakuwaku-labs/nagoya-bites
cd "$(git rev-parse --show-toplevel)" || exit 1

# PR（先頭の ref）が足した判断の記録の番号が、基準の ref にある番号や PR の中の別のファイルと重なるものを出す。重なれば 1。
adr_collisions() {
  local base=$1 head=$2 f n others seen="" rc=0
  local -a added
  added=(${(f)"$(git diff --name-only --diff-filter=A "$base"..."$head" -- docs/decisions 2>/dev/null | grep -E '^docs/decisions/[0-9]{4}-.+\.md$')"})
  for f in $added; do
    [[ -n $f ]] || continue
    n=${f:t}; n=${n[1,4]}
    others=$(git ls-tree --name-only "$base" docs/decisions/ | grep -E "^docs/decisions/${n}-" | grep -v -x -F "$f")
    if [[ -n $others ]]; then echo "番号 $n が重なる: $f ⇔ ${others//$'\n'/ }（基準 $base）"; rc=1; fi
    if [[ " $seen " == *" $n "* ]]; then echo "番号 $n が PR の中で重なる: $f"; rc=1; fi
    seen="$seen $n"
  done
  return $rc
}

if [[ ${1:-} == --check-adr ]]; then
  [[ $# -eq 3 ]] || { echo "使い方: merge_pr.sh --check-adr <基準の ref> <PR の先頭の ref>"; exit 2; }
  if adr_collisions "$2" "$3"; then echo "判断の記録の番号: 重なりなし"; exit 0; fi
  exit 1
fi

N=${1:-}; [[ $N == <-> ]] || { echo "使い方: merge_pr.sh <PR番号> [--dry-run]"; exit 2; }
dry=0; [[ ${2:-} == --dry-run ]] && dry=1
fail=0
ok() { echo "✓ $1"; }
ng() { echo "✗ $1"; fail=1; }

git fetch origin -q || { echo "git fetch に失敗した"; exit 1; }
info=$(gh pr view "$N" --repo $REPO --json state,isDraft,headRefName,headRefOid,baseRefName --jq '[.state,(.isDraft|tostring),.headRefName,.headRefOid,.baseRefName]|@tsv') || { echo "PR #$N を読めない"; exit 1; }
state=$(echo "$info" | cut -f1); draft=$(echo "$info" | cut -f2); branch=$(echo "$info" | cut -f3); oid=$(echo "$info" | cut -f4); base=$(echo "$info" | cut -f5)

# 1. PR の状態
if [[ $state == OPEN && $draft == false && $base == main ]]; then ok "PR #$N は OPEN・下書きではない・base は main（$branch）"
else ng "PR #$N: state=$state 下書き=$draft base=$base"; fi

# 2. ビルドが走っても待ってもいない
busy=$(gh run list --workflow=build.yml --repo $REPO --limit 8 --json databaseId,status --jq '.[]|select(.status!="completed")|"\(.databaseId)(\(.status))"' | tr '\n' ' ')
if [[ -z $busy ]]; then ok "Build & Deploy は走っても待ってもいない"
else ng "Build & Deploy が動いている: $busy— 終わって bot コミットが入ってから"; fi

# 3. 前のビルドの bot コミットと Pages
top=$(git log origin/main --format=%s -2 | tr '\n' '|')
if [[ $top == *IndexNow* && $top == *"auto-update store data"* ]]; then ok "origin/main の先頭 2 件は bot のコミット"
else ng "origin/main の先頭 2 件が bot のコミットではない: $top"; fi
head=$(git rev-parse origin/main)
pages=$(gh api repos/$REPO/pages/builds/latest --jq '"\(.status) \(.commit)"' 2>/dev/null)
if [[ ${pages%% *} == built && ${pages##* } == $head ]]; then ok "GitHub Pages の最新のビルドは origin/main の先頭（${head[1,10]}）と一致"
else ng "GitHub Pages がまだ先頭に追いついていない: ${pages:-取得できない}（先頭 ${head[1,10]}）"; fi

# 4. 衝突
if git merge-tree --write-tree origin/main "$oid" >/dev/null 2>&1; then ok "origin/main に対して衝突しない"
else ng "origin/main に対して衝突する（git merge-tree）— origin/main を取り込んでから"; fi

# 5. 判断の記録の番号
adr=$(adr_collisions origin/main "$oid")
if [[ $? -eq 0 ]]; then ok "判断の記録の番号は重ならない"
else echo "$adr" | sed 's/^/    /'; ng "判断の記録の番号が重なる — 振り直してから"; fi

if (( fail )); then echo "マージしない（上の ✗ を直してから）"; exit 1; fi
if (( dry )); then echo "dry-run: 確認はすべて通った（マージはしていない）"; exit 0; fi

gh pr merge "$N" --repo $REPO --merge --subject "Merge pull request #$N from wakuwaku-labs/$branch" --body "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" || { echo "gh pr merge に失敗した"; exit 1; }
sha=$(gh pr view "$N" --repo $REPO --json mergeCommit --jq .mergeCommit.oid)
id=""
for i in $(seq 1 30); do
  id=$(gh run list --workflow=build.yml --repo $REPO --limit 5 --json databaseId,headSha --jq ".[]|select(.headSha==\"$sha\")|.databaseId" | head -1)
  [[ -n $id ]] && break
  sleep 4
done
echo "merged: #$N ${sha[1,10]}  $(date '+%H:%M:%S')"
if [[ -n $id ]]; then
  echo "build: $id"
  echo "次: perl -e 'alarm 285; exec @ARGV' zsh docs/qa/uiux-2026-10/prod/wait_main.sh $id   # exit=0 まで繰り返す"
else
  echo "build: 見つからない（gh run list --workflow=build.yml --limit 3 で確かめる）"
fi
exit 0
