#!/bin/bash
# NAGOYA BITES — 週次エージェントパイプライン
# 使い方: bash run-agents.sh
# スケジュール実行: crontab -e で以下を追加
#   0 9 * * 1 bash ~/Desktop/nagoya-bites/run-agents.sh >> ~/Desktop/nagoya-bites/agent-run.log 2>&1

set -e
cd "$(dirname "$0")"

echo "=============================="
echo "NAGOYA BITES Agent Pipeline"
echo "$(date '+%Y-%m-%d %H:%M:%S') JST"
echo "=============================="

# ── STEP 1: DataKeeper ──────────────────────────
echo ""
echo "[1/3] DataKeeper: データ更新中..."
node build.js
echo "DataKeeper: 完了"

# ── STEP 2 & 3: Inspector + Builder (Claude Code) ──
# Claude Code CLI を使って Inspector → Builder の順で実行
echo ""
echo "[2/3] Inspector + Builder: Claude Code 起動中..."

# Claude Code がインストールされている場合
if command -v claude &> /dev/null; then
  claude --print "
あなたは NAGOYA BITES の自律改善エージェントです。
まず CLAUDE.md を読んでプロジェクト全体を把握してください。

次に以下の順序で実行してください:

1. **Inspector**: agents/inspector.md の手順に従い、
   index.html と agent-backlog.md を読み、
   サイトを監査して新しい課題を agent-backlog.md に追記する

2. **Builder**: agents/builder.md の手順に従い、
   agent-backlog.md の status:ready かつ priority:P0 または P1 の課題を
   優先度順にすべて実装する

3. 実装後: git add index.html agent-backlog.md && git commit && git push

制約:
- index.html は単一ファイルで維持（新ファイル禁止）
- var LOCAL_STORES = [...] を壊さない
- テキストはすべて日本語
- フィルター・検索・モーダルを壊さない
"
else
  echo "警告: claude コマンドが見つかりません"
  echo "Claude Code をインストールするか、手動でエージェントを実行してください"
  echo "インストール: npm install -g @anthropic-ai/claude-code"
fi

echo ""
echo "=============================="
echo "Pipeline 完了: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================="
