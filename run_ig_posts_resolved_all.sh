#!/bin/bash
# scripts/fetch_ig_posts_resolved.js を全件処理するまで繰り返し実行
# data/instagram_resolved.json のアカウントURL解決済み全店を対象に
# 料理/内観スコアの高い投稿URLを data/instagram_posts.json に書き込む
set -eo pipefail
cd "$(dirname "$0")"
NODE=/opt/homebrew/bin/node

echo "Instagram投稿URL 全件取得開始（instagram_resolved.json ベース）"
while true; do
  $NODE scripts/fetch_ig_posts_resolved.js
  if [ ! -f .ig_posts_resolved_progress.json ]; then
    echo "全件完了！"
    break
  fi
  echo "--- 10秒後に次バッチ開始 ---"
  sleep 10
done
