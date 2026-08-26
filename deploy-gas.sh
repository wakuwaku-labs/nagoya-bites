#!/bin/bash
# GAS（Google Apps Script）へ .gas-deploy/Code.js を反映する
# 事前に setup-gas-deploy.sh を1回だけ実行して認証＆プロジェクトリンクを済ませておくこと
#
# ⚠️ 2026-08-24 修正（SEO-069）— 以前このスクリプトは
#      cp "Google分析オートLINE送信.js" .gas-deploy/Code.js && clasp push
#    という順序で動いていた。ところが実際の修正はすべて .gas-deploy/Code.js 側に入っており
#    （SEO-047 / SEO-057 / SEO-062 / SEO-063 の4コミットとも）、リポジトリ root の
#    「Google分析オートLINE送信.js」は 2026-06-02 を最後に更新が止まっていた。
#    つまり**このスクリプトを実行すると3ヶ月ぶんの修正を消したうえで旧コードをGASへ送る**
#    状態になっていた。デプロイの正本は .gas-deploy/Code.js の1本に統一する。

set -e
cd "$(dirname "$0")"
PROJECT_DIR=".gas-deploy"
SRC="$PROJECT_DIR/Code.js"

if [ ! -f "$PROJECT_DIR/.clasp.json" ]; then
  echo "❌ 初回セットアップが未完了です。先に ./setup-gas-deploy.sh を実行してください。"
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "❌ $SRC が見つかりません。"
  exit 1
fi

# ── 送る直前に「送ろうとしているコードが本当に修正入りか」を機械で確かめる ──
# 制約10（合否は検証できる事実で）に従い、data/gas_deploy_policy.json が
# 「新コードでしか出ない痕跡」として定義しているものを、ソース側の実装で照合する。
echo "🔍 反映待ちの修正がソースに入っているか確認します…"
MISSING=0
check_marker() {
  if grep -q "$2" "$SRC"; then
    echo "   ✅ $1"
  else
    echo "   ❌ $1 がソースに見つかりません"
    MISSING=1
  fi
}
check_marker "SEO-047 直帰率の母数ゲート"      "MIN_SESSIONS_FOR_RATE_ALERT"
check_marker "SEO-057 生成AI流入ラベル"        "生成AI（ChatGPT等）"
check_marker "SEO-062 直帰率の集計バグ修正"    "bounceRate"
check_marker "SEO-063 GA4しきい値の集約"       "isGa4Unknown"
check_marker "SEO-076 確定済みの日から取る"    "SETTLED_LAG_DAYS"

if [ "$MISSING" = "1" ]; then
  echo ""
  echo "🛑 中止しました。修正が欠けたコードをGASへ送ると、旧バグが本番に戻ります。"
  echo "   git status / git log -- $SRC を確認してください。"
  exit 1
fi

echo ""
echo "📤 $SRC を GAS へ push します…"
cd "$PROJECT_DIR"
clasp push -f

echo ""
echo "✅ GASへの反映完了！"
echo "   → https://script.google.com/home/projects で確認"
echo ""
echo "翌朝のレポートが届いたら、反映されたかを機械で確認できます:"
echo "   node scripts/check_gas_deploy_health.js"
