#!/bin/bash
# Instagram投稿URL 一括取得 / 再評価
#   通常実行:    ./run_ig_posts_all.sh
#   既存値再評価: RESCORE=1 ./run_ig_posts_all.sh
#     （既に Sheets S列 にある投稿URLも料理/内観スコアで見直して差し替え）
set -eo pipefail
cd "$(dirname "$0")"
NODE=/opt/homebrew/bin/node

if [ "${RESCORE:-0}" = "1" ]; then
  echo "Instagram投稿URL 再評価モード（既存値も上書き対象）開始"
else
  echo "Instagram投稿URL 一括取得開始"
fi

while true; do
  RESCORE="${RESCORE:-0}" $NODE fetch_ig_posts.js
  if [ ! -f .ig_posts_progress.json ]; then
    echo "全行処理完了！"
    break
  fi
  echo "--- 10秒後に次バッチ開始 ---"
  sleep 10
done
