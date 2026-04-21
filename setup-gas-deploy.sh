#!/bin/bash
# 初回1回だけ実行：GAS への自動デプロイ用セットアップ
# - clasp login（Google OAuth）
# - 既存のGASプロジェクトとリンク（scriptId入力）or 新規作成

set -e
cd "$(dirname "$0")"
PROJECT_DIR=".gas-deploy"
mkdir -p "$PROJECT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " NAGOYA BITES GAS 自動デプロイ セットアップ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# STEP 1: clasp login
if [ ! -f "$HOME/.clasprc.json" ]; then
  echo "【STEP 1】Googleアカウントにログイン"
  echo "  ブラウザが開きます。普段使っているGoogleアカウントで許可してください。"
  echo ""
  clasp login
else
  echo "✅ STEP 1: すでにログイン済み"
fi

echo ""

# STEP 2: プロジェクトとリンク
cd "$PROJECT_DIR"

if [ ! -f ".clasp.json" ]; then
  echo "【STEP 2】GASプロジェクトを選ぶ"
  echo ""
  echo "  すでにGASプロジェクトがある場合:"
  echo "    → https://script.google.com/home でプロジェクトを開き、"
  echo "      URL の .../d/XXXXXXXX/edit の XXXXXXXX が ScriptID です"
  echo ""
  echo "  新規に作る場合は、空欄のまま Enter を押してください。"
  echo ""
  read -p "ScriptID（空欄=新規作成）: " SCRIPT_ID

  if [ -z "$SCRIPT_ID" ]; then
    echo ""
    echo "▶ 新規GASプロジェクトを作成中..."
    clasp create --title "NAGOYA BITES レポート" --type standalone --rootDir .
  else
    echo ""
    echo "▶ 既存プロジェクトをクローン中..."
    clasp clone "$SCRIPT_ID" --rootDir .
  fi
else
  echo "✅ STEP 2: プロジェクトリンク済み"
fi

cd ..

echo ""
echo "【STEP 3】最新コードを GAS にアップロード"
./deploy-gas.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ セットアップ完了！"
echo ""
echo " 今後は、Claude がファイルを編集するたびに"
echo " 自動で GAS に反映されるようになりました。"
echo ""
echo " 手動で反映したい時は:"
echo "   ./deploy-gas.sh"
echo ""
echo " GASエディタ:"
echo "   https://script.google.com/home/projects"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
