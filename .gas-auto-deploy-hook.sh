#!/bin/bash
# Claude Code の PostToolUse フックから呼ばれる。
# Edit/Write で "Google分析オートLINE送信.js" を変更したら
# 自動で GAS にデプロイする。

# stdin から tool_input JSON を読む
INPUT=$(cat)

# file_path を抽出（jq があればそれで、なければ grep）
FILE_PATH=""
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# GASファイル以外は何もしない
case "$FILE_PATH" in
  *"Google分析オートLINE送信.js"*) ;;
  *) exit 0 ;;
esac

# デプロイ実行（セットアップ未完了ならスキップ）
DEPLOY_SCRIPT="/Users/katagirijakutou/Desktop/nagoya-bites/deploy-gas.sh"
if [ ! -f "/Users/katagirijakutou/Desktop/nagoya-bites/.gas-deploy/.clasp.json" ]; then
  echo "[auto-deploy] セットアップ未完了（setup-gas-deploy.sh を実行してください）" >&2
  exit 0
fi

"$DEPLOY_SCRIPT" 2>&1 | tail -5 >&2
