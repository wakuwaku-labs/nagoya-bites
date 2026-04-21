#!/bin/bash
# fetch_ig_urls.js を全行処理するまで自動繰り返し実行
set -eo pipefail

cd "$(dirname "$0")"
NODE=/opt/homebrew/bin/node

echo "Instagram URL 一括取得開始"
while true; do
  $NODE fetch_ig_urls.js
  EXIT=$?
  if [ $EXIT -ne 0 ]; then
    echo "エラーで終了 (exit $EXIT)"
    break
  fi
  # 進捗ファイルが消えたら完了
  if [ ! -f .ig_progress.json ]; then
    echo "全行処理完了！"
    break
  fi
  echo "--- 15秒後に次バッチ開始 ---"
  sleep 15
done
