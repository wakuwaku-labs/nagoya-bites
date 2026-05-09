# GA4 グローバル閲覧数ランキング — セットアップ手順

「みんなが見ている店 TOP 10」セクションは GA4 の `modal_open` イベントを店舗別に集計してランキング化します。
本ドキュメントは初回セットアップに必要な GCP 側の作業を記録します。

## 仕組み

```
ユーザー modal 開封 → gtag('event','modal_open',{store_name})
                            ↓
                       GA4 (G-3LCZNGZPWJ)
                            ↓
   [毎日3:00 JST] scripts/fetch_ga4_views.js が GA4 Data API を叩く
                            ↓
                  data/view_counts.json 更新
                            ↓
                  build.js が各店舗に「閲覧数」を焼き込む
                            ↓
              index.html の buildRanking() が描画
```

## 必要な GitHub Secrets

| Secret 名 | 内容 |
|---|---|
| `GA4_PROPERTY_ID` | GA4 プロパティ ID（数字のみ。例: `123456789`） |
| `GA4_SERVICE_ACCOUNT_KEY` | GCP サービスアカウントの JSON キー（全文を貼り付け） |

## GCP セットアップ（一度だけ）

### 1. サービスアカウントを作成

1. https://console.cloud.google.com/iam-admin/serviceaccounts でプロジェクトを選択
2. 「サービスアカウントを作成」→ 名前 `nagoya-bites-ga4-reader` 等
3. 「キーを追加」→「新しいキーを作成」→ JSON → ダウンロード
4. JSON ファイルの中身をそのまま GitHub Secrets `GA4_SERVICE_ACCOUNT_KEY` に貼り付け

### 2. GA4 Data API を有効化

GCP コンソールで該当プロジェクトの「API とサービス」から
**Google Analytics Data API** を有効化。

### 3. GA4 プロパティへサービスアカウントを招待

1. https://analytics.google.com で該当プロパティを開く
2. 「管理」→「プロパティのアクセス管理」
3. サービスアカウントのメール（`xxx@xxx.iam.gserviceaccount.com`）を「閲覧者」権限で追加

### 4. カスタムディメンション「store_name」を登録

GA4 上で:
1. 「管理」→「カスタム定義」→「カスタムディメンションを作成」
2. 設定:
   - **ディメンション名**: `store_name`
   - **範囲**: イベント
   - **イベントパラメータ**: `store_name`
3. 反映には 24-48 時間かかる場合あり

## 動作確認

ローカルで動作確認するには:

```bash
export GA4_SERVICE_ACCOUNT_KEY="$(cat /path/to/key.json)"
export GA4_PROPERTY_ID="123456789"
node scripts/fetch_ga4_views.js
cat data/view_counts.json | head -30
```

## トラブルシューティング

- **`view_counts.json` が空 / 全店舗カウント 0**:
  - カスタムディメンション `store_name` の登録から 48 時間経過しているか確認
  - GA4 のリアルタイムレポートで `modal_open` イベントが届いているか確認
- **API 認証エラー**:
  - サービスアカウントが GA4 プロパティに招待されているか
  - GA4 Data API が有効化されているか
- **ランキングが表示されない**:
  - `data/view_counts.json` の `counts` に値があるか
  - `index.html` の各店舗データに `"閲覧数":N` が焼き付いているか（build.js のログを確認）
