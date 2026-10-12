#!/bin/zsh
# 使い方: docs/qa/uiux-2026-10/prod/wait_main.sh <ビルドの run id>
# main へのマージのあと、ビルドが終わり、bot のコミット 2 件（"auto-update store data"・"IndexNow"）が origin/main に入り、
# GitHub Pages の最新のビルドが origin/main の先頭と一致する（built）まで待つ。終わると最後に "exit=0" を出す。
# 次の PR は、この "exit=0" を見てからマージする（ビルドは走行 1 本＋待ち 1 本のため）。
id=$1
cd "$(git rev-parse --show-toplevel)" || exit 1
for i in $(seq 1 400); do
  s=$(gh run view $id --repo wakuwaku-labs/nagoya-bites --json status,conclusion --jq '"\(.status) \(.conclusion)"' 2>/dev/null)
  if [ "${s%% *}" = "completed" ]; then break; fi
  sleep 20
done
echo "run: $s"
for i in $(seq 1 40); do
  git fetch origin -q
  top=$(git log origin/main --format=%s -2 | tr '\n' '|')
  if echo "$top" | grep -q "IndexNow" && echo "$top" | grep -q "auto-update store data"; then break; fi
  sleep 15
done
echo "top2: $top"
head=$(git rev-parse origin/main)
for i in $(seq 1 40); do
  p=$(gh api repos/wakuwaku-labs/nagoya-bites/pages/builds/latest --jq '"\(.status) \(.commit)"' 2>/dev/null)
  if [ "${p%% *}" = "built" ] && [ "${p##* }" = "$head" ]; then break; fi
  sleep 15
done
echo "pages: $p  head=$head"
date
echo "exit=0"
