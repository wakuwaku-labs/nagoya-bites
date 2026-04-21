#!/bin/bash
# ================================================================
# Nagoya Bites — スコア自動取得 完全セットアップ
# 実行方法: bash setup.sh
# ================================================================
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DONE_FILE="$DIR/.setup_done"

# Homebrew の PATH を確実に通す（Apple Silicon / Intel 両対応）
[[ -f /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
[[ -f /usr/local/bin/brew    ]] && eval "$(/usr/local/bin/brew shellenv)"

# gcloud の PATH を通す
[[ -f /opt/homebrew/share/google-cloud-sdk/path.bash.inc ]] && source /opt/homebrew/share/google-cloud-sdk/path.bash.inc
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"

# Apple Silicon Mac では arch -arm64 で brew を実行する
if [[ "$(uname -m)" == "x86_64" ]] && [[ -f /opt/homebrew/bin/brew ]]; then
  BREW="arch -arm64 /opt/homebrew/bin/brew"
else
  BREW="brew"
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }
step()    { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

# ── 進捗管理（再実行時のスキップ） ────────────────────────────────
done_flag() { grep -qx "$1" "$DONE_FILE" 2>/dev/null; }
mark_done() { echo "$1" >> "$DONE_FILE"; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Nagoya Bites スコア自動取得 セットアップ      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ================================================================
# STEP 1: Homebrew
# ================================================================
step "STEP 1/8: Homebrew のインストール"
if done_flag "brew"; then
  success "Homebrew は設定済みです（スキップ）"
elif command -v brew &>/dev/null; then
  success "Homebrew は既にインストールされています"
  mark_done "brew"
else
  info "Homebrew をインストールします..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon の場合 PATH を通す
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  fi
  success "Homebrew をインストールしました"
  mark_done "brew"
fi

# ================================================================
# STEP 2: Node.js
# ================================================================
step "STEP 2/8: Node.js のインストール"
if done_flag "node"; then
  success "Node.js は設定済みです（スキップ）"
elif command -v node &>/dev/null; then
  success "Node.js は既にインストールされています: $(node --version)"
  mark_done "node"
else
  info "Node.js をインストールします..."
  $BREW install node
  success "Node.js をインストールしました: $(node --version)"
  mark_done "node"
fi

# ================================================================
# STEP 3: npm パッケージ
# ================================================================
step "STEP 3/8: npm パッケージのインストール"
if done_flag "npm_packages"; then
  success "npm パッケージは設定済みです（スキップ）"
else
  info "clasp（GAS デプロイツール）をインストールします..."
  npm install -g @google/clasp

  info "プロジェクトの依存パッケージをインストールします..."
  cd "$DIR" && npm install
  cd "$DIR"

  success "npm パッケージをインストールしました"
  mark_done "npm_packages"
fi

# ================================================================
# STEP 4: Google Cloud CLI
# ================================================================
step "STEP 4/8: Google Cloud CLI のインストール"
if done_flag "gcloud"; then
  success "gcloud は設定済みです（スキップ）"
elif command -v gcloud &>/dev/null; then
  success "gcloud は既にインストールされています: $(gcloud --version | head -1)"
  mark_done "gcloud"
else
  info "Google Cloud CLI をインストールします..."
  $BREW install --cask google-cloud-sdk
  # PATH を通す
  source "$(brew --prefix)/share/google-cloud-sdk/path.zsh.inc" 2>/dev/null || true
  success "Google Cloud CLI をインストールしました"
  mark_done "gcloud"
fi

# ================================================================
# STEP 5: Google Cloud 認証 & プロジェクト設定
# ================================================================
step "STEP 5/8: Google Cloud 認証 & プロジェクト設定"
if done_flag "gcloud_project"; then
  PROJECT_ID=$(cat "$DIR/.gcp_project_id" 2>/dev/null || "")
  success "GCP プロジェクトは設定済みです: $PROJECT_ID（スキップ）"
else
  info "Google アカウントでログインします（ブラウザが開きます）..."
  gcloud auth login --quiet
  gcloud auth application-default login --quiet

  echo ""
  echo "既存の GCP プロジェクト一覧:"
  gcloud projects list --format="table(projectId,name)" 2>/dev/null || true
  echo ""
  read -p "使用するプロジェクトID（新規作成する場合は空欄でEnter）: " PROJECT_ID

  if [[ -z "$PROJECT_ID" ]]; then
    PROJECT_ID="nagoya-bites-$(date +%s)"
    info "新規プロジェクトを作成します: $PROJECT_ID"
    gcloud projects create "$PROJECT_ID" --name="Nagoya Bites"
    success "プロジェクトを作成しました: $PROJECT_ID"

    echo ""
    echo "請求先アカウントの一覧:"
    gcloud billing accounts list
    echo ""
    read -p "請求先アカウントID（例: AABBCC-DDEEFF-001122）: " BILLING_ID
    gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ID"
    success "請求先アカウントを紐付けました"
  fi

  gcloud config set project "$PROJECT_ID"
  echo "$PROJECT_ID" > "$DIR/.gcp_project_id"
  success "GCP プロジェクトを設定しました: $PROJECT_ID"
  mark_done "gcloud_project"
fi

PROJECT_ID=$(cat "$DIR/.gcp_project_id")

# ================================================================
# STEP 6: Places API 有効化 & APIキー作成
# ================================================================
step "STEP 6/8: Google Places API 有効化 & APIキー作成"
if done_flag "places_api_key"; then
  API_KEY=$(cat "$DIR/.places_api_key" 2>/dev/null || "")
  success "Places API キーは設定済みです: ${API_KEY:0:8}...（スキップ）"
else
  info "Places API を有効化します..."
  gcloud services enable places.googleapis.com --project="$PROJECT_ID"
  success "Places API を有効化しました"

  info "APIキーを作成します..."
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
  TOKEN=$(gcloud auth print-access-token)

  # REST API でキーを作成
  CREATE_RESPONSE=$(curl -sX POST \
    "https://apikeys.googleapis.com/v2/projects/$PROJECT_NUMBER/locations/global/keys" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"displayName\": \"Nagoya Bites Places\",
      \"restrictions\": {
        \"apiTargets\": [{\"service\": \"places.googleapis.com\"}]
      }
    }")

  OPERATION_NAME=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || echo "")

  if [[ -z "$OPERATION_NAME" ]]; then
    warn "APIキーの自動作成に失敗しました"
    warn "https://console.cloud.google.com/apis/credentials で手動作成してください"
    read -p "作成したAPIキーを貼り付けてください: " API_KEY
  else
    # オペレーション完了を待つ
    info "APIキーの作成を待っています..."
    sleep 5

    # 最新のキーを取得
    KEYS_RESPONSE=$(curl -s \
      "https://apikeys.googleapis.com/v2/projects/$PROJECT_NUMBER/locations/global/keys" \
      -H "Authorization: Bearer $TOKEN")

    KEY_NAME=$(echo "$KEYS_RESPONSE" | python3 -c "
import sys,json
keys = json.load(sys.stdin).get('keys', [])
nagoya = [k for k in keys if 'Nagoya' in k.get('displayName','')]
print(nagoya[0]['name'] if nagoya else (keys[0]['name'] if keys else ''))
" 2>/dev/null || echo "")

    if [[ -n "$KEY_NAME" ]]; then
      KEY_RESPONSE=$(curl -s \
        "https://apikeys.googleapis.com/v2/${KEY_NAME}/keyString" \
        -H "Authorization: Bearer $TOKEN")
      API_KEY=$(echo "$KEY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('keyString',''))" 2>/dev/null || echo "")
    fi

    if [[ -z "$API_KEY" ]]; then
      warn "APIキーの自動取得に失敗しました"
      read -p "Google Cloud Console からAPIキーを貼り付けてください: " API_KEY
    fi
  fi

  echo "$API_KEY" > "$DIR/.places_api_key"

  # gas_scores.js にAPIキーを埋め込む
  sed -i '' "s/YOUR_GOOGLE_PLACES_API_KEY/$API_KEY/" "$DIR/gas_scores.js"
  success "APIキーを gas_scores.js に設定しました: ${API_KEY:0:8}..."
  mark_done "places_api_key"
fi

API_KEY=$(cat "$DIR/.places_api_key")

# ================================================================
# STEP 7: Google Apps Script へデプロイ（clasp）
# ================================================================
step "STEP 7/8: Google Apps Script へデプロイ"
if done_flag "clasp_push"; then
  success "GAS へのデプロイは完了済みです（スキップ）"
  warn "スクリプトを更新したい場合は: bash setup.sh --push のみ実行"
else
  info "clasp にログインします（ブラウザが開きます）..."
  clasp login

  echo ""
  read -p "スプレッドシートのID（URLの /spreadsheets/d/{ここ}/edit）: " SHEET_ID

  # GAS プッシュ用の作業ディレクトリ
  PUSH_DIR="$DIR/.gas_push"
  mkdir -p "$PUSH_DIR"

  # appsscript.json（GASプロジェクト設定）
  cat > "$PUSH_DIR/appsscript.json" <<'APPSSCRIPT'
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
APPSSCRIPT

  # スクリプトファイルをコピー
  cp "$DIR/gas_scores.js"  "$PUSH_DIR/gas_scores.js"
  cp "$DIR/gas_tagging.js" "$PUSH_DIR/gas_tagging.js"

  # GASプロジェクトを作成 or 既存に紐付け
  if [[ ! -f "$PUSH_DIR/.clasp.json" ]]; then
    info "GAS プロジェクトを作成します..."
    cd "$PUSH_DIR"
    clasp create --type sheets --title "Nagoya Bites Scripts" --parentId "$SHEET_ID"
    cd "$DIR"
    # .clasp.json を保存
    cp "$PUSH_DIR/.clasp.json" "$DIR/.clasp.json" 2>/dev/null || true
  else
    cp "$DIR/.clasp.json" "$PUSH_DIR/.clasp.json"
  fi

  info "GAS にプッシュします..."
  cd "$PUSH_DIR"
  clasp push --force
  cd "$DIR"

  rm -rf "$PUSH_DIR"
  success "Google Apps Script にデプロイしました"
  mark_done "clasp_push"
fi

# ================================================================
# STEP 8: 再プッシュ専用モード（--push フラグ）
# ================================================================
if [[ "${1:-}" == "--push" ]]; then
  step "STEP 8/8: スクリプトを再プッシュ"
  PUSH_DIR="$DIR/.gas_push"
  mkdir -p "$PUSH_DIR"
  cp "$DIR/gas_scores.js"  "$PUSH_DIR/gas_scores.js"
  cp "$DIR/gas_tagging.js" "$PUSH_DIR/gas_tagging.js"
  cp "$DIR/.clasp.json"    "$PUSH_DIR/.clasp.json" 2>/dev/null || error ".clasp.json がありません。先に setup.sh を実行してください"

  cat > "$PUSH_DIR/appsscript.json" <<'APPSSCRIPT'
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
APPSSCRIPT

  cd "$PUSH_DIR" && clasp push --force
  cd "$DIR" && rm -rf "$PUSH_DIR"
  success "再プッシュ完了"
fi

# ================================================================
# 完了メッセージ
# ================================================================
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   セットアップ完了！                                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "【次のステップ】"
echo ""
echo "  1. スプレッドシートを開く"
echo "  2. 「拡張機能」→「Apps Script」を開く"
echo "  3. runScores() を実行 → Google評価 が自動で書き込まれます"
echo "  4. runTagging() を実行 → タグ が自動で書き込まれます"
echo ""
echo "【Instagram投稿数も自動取得したい場合】"
echo "  Meta for Developers でアクセストークンを取得し:"
echo "  gas_scores.js の INSTAGRAM_ACCESS_TOKEN に貼り付けて"
echo "  bash setup.sh --push を実行してください"
echo ""
echo "【設定ファイル】"
echo "  GCPプロジェクト : $DIR/.gcp_project_id"
echo "  APIキー         : $DIR/.places_api_key"
echo "  GASプロジェクト : $DIR/.clasp.json"
echo ""
