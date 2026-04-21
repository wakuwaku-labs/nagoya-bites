#!/bin/bash
# ================================================================
# auth.sh — Google 認証ステップ（Terminal.app で実行してください）
# 実行方法: bash ~/Desktop/nagoya-bites/auth.sh
# ================================================================
set -eo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

# PATH を通す
[[ -f /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:/opt/homebrew/bin:$PATH"
[[ -f /opt/homebrew/share/google-cloud-sdk/path.bash.inc ]] && source /opt/homebrew/share/google-cloud-sdk/path.bash.inc

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Nagoya Bites — Google 認証セットアップ        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── STEP A: gcloud 認証 ───────────────────────────────────────────
echo -e "${CYAN}━━━ STEP A: Google Cloud ログイン ━━━${NC}"
if gcloud auth print-access-token &>/dev/null; then
  success "gcloud は既にログイン済みです（スキップ）"
else
  info "ブラウザが開きます。Google アカウントでログインしてください..."
  gcloud auth login
  gcloud auth application-default login
  success "gcloud ログイン完了"
fi

# ── STEP B: GCP プロジェクト設定 ──────────────────────────────────
echo ""
echo -e "${CYAN}━━━ STEP B: GCP プロジェクト設定 ━━━${NC}"
PROJECT_ID=""
if [[ -f "$DIR/.gcp_project_id" ]]; then
  PROJECT_ID=$(cat "$DIR/.gcp_project_id")
  success "プロジェクト設定済み: $PROJECT_ID（スキップ）"
else
  echo ""
  echo "既存の GCP プロジェクト一覧:"
  gcloud projects list --format="table(projectId,name)" 2>/dev/null || true
  echo ""
  read -p "使用するプロジェクトID（新規作成する場合は空欄でEnter）: " PROJECT_ID

  if [[ -z "$PROJECT_ID" ]]; then
    PROJECT_ID="nagoya-bites-$(date +%s)"
    info "プロジェクトを作成します: $PROJECT_ID"
    gcloud projects create "$PROJECT_ID" --name="Nagoya Bites"

    echo ""
    echo "請求先アカウントの一覧:"
    gcloud billing accounts list
    echo ""
    read -p "請求先アカウントID（例: AABBCC-DDEEFF-001122）: " BILLING_ID
    gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ID"
  fi

  gcloud config set project "$PROJECT_ID"
  echo "$PROJECT_ID" > "$DIR/.gcp_project_id"
  success "プロジェクトを設定しました: $PROJECT_ID"
fi

# ── STEP C: Places API 有効化 & APIキー作成 ───────────────────────
echo ""
echo -e "${CYAN}━━━ STEP C: Places API & APIキー ━━━${NC}"
PROJECT_ID=$(cat "$DIR/.gcp_project_id")

if [[ -f "$DIR/.places_api_key" ]]; then
  API_KEY=$(cat "$DIR/.places_api_key")
  success "APIキー設定済み: ${API_KEY:0:8}...（スキップ）"
else
  info "Places API を有効化します..."
  gcloud services enable places.googleapis.com --project="$PROJECT_ID"

  info "APIキーを作成します..."
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
  TOKEN=$(gcloud auth print-access-token)

  CREATE_RESPONSE=$(curl -sX POST \
    "https://apikeys.googleapis.com/v2/projects/$PROJECT_NUMBER/locations/global/keys" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"displayName\":\"Nagoya Bites Places\",\"restrictions\":{\"apiTargets\":[{\"service\":\"places.googleapis.com\"}]}}")

  sleep 5

  KEYS_RESPONSE=$(curl -s \
    "https://apikeys.googleapis.com/v2/projects/$PROJECT_NUMBER/locations/global/keys" \
    -H "Authorization: Bearer $(gcloud auth print-access-token)")

  KEY_NAME=$(echo "$KEYS_RESPONSE" | python3 -c "
import sys,json
keys = json.load(sys.stdin).get('keys', [])
nagoya = [k for k in keys if 'Nagoya' in k.get('displayName','')]
print(nagoya[0]['name'] if nagoya else (keys[0]['name'] if keys else ''))
" 2>/dev/null || echo "")

  API_KEY=""
  if [[ -n "$KEY_NAME" ]]; then
    KEY_RESP=$(curl -s \
      "https://apikeys.googleapis.com/v2/${KEY_NAME}/keyString" \
      -H "Authorization: Bearer $(gcloud auth print-access-token)")
    API_KEY=$(echo "$KEY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('keyString',''))" 2>/dev/null || echo "")
  fi

  if [[ -z "$API_KEY" ]]; then
    echo ""
    echo "⚠ APIキーの自動取得に失敗しました"
    echo "  https://console.cloud.google.com/apis/credentials を開いて"
    echo "  「APIキーを作成」→キーをコピーしてください"
    echo ""
    read -p "APIキーを貼り付け: " API_KEY
  fi

  echo "$API_KEY" > "$DIR/.places_api_key"
  # gas_scores.js にキーを埋め込む
  sed -i '' "s/YOUR_GOOGLE_PLACES_API_KEY/$API_KEY/" "$DIR/gas_scores.js"
  success "APIキーを設定しました: ${API_KEY:0:8}..."
fi

# ── STEP D: clasp ログイン ─────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━ STEP D: Google Apps Script ログイン ━━━${NC}"
if [[ -f ~/.clasprc.json ]]; then
  success "clasp は既にログイン済みです（スキップ）"
else
  info "ブラウザが開きます。Google アカウントでログインしてください..."
  /opt/homebrew/bin/clasp login
  success "clasp ログイン完了"
fi

# ── STEP E: GAS にデプロイ ────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━ STEP E: Google Apps Script にデプロイ ━━━${NC}"
if [[ -f "$DIR/.clasp.json" ]]; then
  success ".clasp.json が存在します。デプロイを実行します..."
else
  echo ""
  read -p "スプレッドシートのID（URLの /spreadsheets/d/{ここ}/edit）: " SHEET_ID
  PUSH_DIR="$DIR/.gas_push"
  mkdir -p "$PUSH_DIR"
  cd "$PUSH_DIR"
  /opt/homebrew/bin/clasp create --type sheets --title "Nagoya Bites Scripts" --parentId "$SHEET_ID"
  cp "$PUSH_DIR/.clasp.json" "$DIR/.clasp.json"
  cd "$DIR"
  rm -rf "$PUSH_DIR"
fi

PUSH_DIR="$DIR/.gas_push"
mkdir -p "$PUSH_DIR"
cp "$DIR/gas_scores.js"  "$PUSH_DIR/gas_scores.js"
cp "$DIR/gas_tagging.js" "$PUSH_DIR/gas_tagging.js"
cp "$DIR/.clasp.json"    "$PUSH_DIR/.clasp.json"

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

cd "$PUSH_DIR"
/opt/homebrew/bin/clasp push --force
cd "$DIR"
rm -rf "$PUSH_DIR"

# 完了フラグを立てる
grep -qx "gcloud_project" "$DIR/.setup_done" 2>/dev/null || echo "gcloud_project" >> "$DIR/.setup_done"
grep -qx "places_api_key" "$DIR/.setup_done" 2>/dev/null || echo "places_api_key" >> "$DIR/.setup_done"
grep -qx "clasp_push"     "$DIR/.setup_done" 2>/dev/null || echo "clasp_push"     >> "$DIR/.setup_done"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   認証セットアップ完了！                                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "【次のステップ】"
echo "  1. スプレッドシートを開く"
echo "  2. 「拡張機能」→「Apps Script」を開く"
echo "  3. runScores() を実行 → Google評価 が自動書き込まれます"
echo "  4. runTagging() を実行 → タグ が自動書き込まれます"
echo ""
