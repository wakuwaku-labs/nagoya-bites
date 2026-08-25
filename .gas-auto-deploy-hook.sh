#!/bin/bash
# Claude Code の PostToolUse フックから呼ばれる。
# Edit/Write で GAS の正本 ".gas-deploy/Code.js" を変更したら自動で GAS にデプロイする。
#
# ⚠️ 2026-08-25 修正（SEO-073）— 以前このフックは
#   (a) 監視対象が root の "Google分析オートLINE送信.js"（＝2026-06-02 で凍結した旧ミラー。
#       deploy-gas.sh が既に「正本は .gas-deploy/Code.js」と宣言しており、本番ソースではない）
#   (b) 参照パスが /Users/katagirijakutou/Desktop/nagoya-bites/（リポジトリ移転前の旧パス）
#   という二重の逆配線で、本番ソースを編集しても発火せず、かつ .clasp.json 存在チェックが
#   必ず失敗して毎回 exit 0 していた＝「動いているように見えて常に無稼働」。
#   移転で壊れないよう、パスはスクリプト自身の位置から解決する。

set -u

# スクリプト自身の位置＝リポジトリ root（ハードコードしない）
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# stdin から tool_input JSON を読む
INPUT=$(cat)

# file_path を抽出（jq があればそれで、なければ grep）
FILE_PATH=""
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# GAS の正本以外は何もしない
case "$FILE_PATH" in
  *".gas-deploy/Code.js") ;;
  *) exit 0 ;;
esac

# デプロイ実行（セットアップ未完了ならスキップ）
DEPLOY_SCRIPT="$REPO_DIR/deploy-gas.sh"
if [ ! -f "$REPO_DIR/.gas-deploy/.clasp.json" ]; then
  echo "[auto-deploy] セットアップ未完了（./setup-gas-deploy.sh を実行してください）" >&2
  exit 0
fi

"$DEPLOY_SCRIPT" 2>&1 | tail -5 >&2
