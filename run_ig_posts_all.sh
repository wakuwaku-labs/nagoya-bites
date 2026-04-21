#!/bin/bash
set -eo pipefail
cd "$(dirname "$0")"
NODE=/opt/homebrew/bin/node

echo "Instagram投稿URL 一括取得開始"
while true; do
  $NODE fetch_ig_posts.js
  if [ ! -f .ig_posts_progress.json ]; then
    echo "全行処理完了！"
    break
  fi
  echo "--- 10秒後に次バッチ開始 ---"
  sleep 10
done
