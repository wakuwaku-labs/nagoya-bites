#!/bin/bash
# GAS（Google Apps Script）へ Google分析オートLINE送信.js を自動デプロイする
# 事前に setup-gas-deploy.sh を1回だけ実行して認証＆プロジェクトリンクを済ませておくこと

set -e
cd "$(dirname "$0")"
PROJECT_DIR=".gas-deploy"

if [ ! -f "$PROJECT_DIR/.clasp.json" ]; then
  echo "❌ 初回セットアップが未完了です。先に ./setup-gas-deploy.sh を実行してください。"
  exit 1
fi

# ソースファイルを deploy ディレクトリにコピーして clasp push
cp "Google分析オートLINE送信.js" "$PROJECT_DIR/Code.js"

cd "$PROJECT_DIR"
clasp push -f

echo ""
echo "✅ GASへの反映完了！"
echo "   → https://script.google.com/home/projects で確認"
