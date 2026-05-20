# GSC 検索パフォーマンス取得 — セットアップ手順

`scripts/fetch_gsc_metrics.js` が Google Search Console の検索パフォーマンス
（clicks / impressions / CTR / 平均掲載順位 / トップクエリ / トップページ）を
日次で `data/gsc_metrics.json` に書き出す。GA4 の `site_metrics.json` と対になり、
organic 流入改善（ISSUE-054）の効果測定の本体となる。

## 仕組み

```
[毎日3:00 JST] build.yml の "Fetch GSC search performance" ステップ
        ↓ GA4_SERVICE_ACCOUNT_KEY を流用して Search Console API を叩く
   scripts/fetch_gsc_metrics.js
        ↓
   data/gsc_metrics.json 更新（CI が commit）
```

## 必要な作業（一度だけ）

GA4 連携でサービスアカウントは既に存在するため、**新規作成は不要**。以下 2 つだけ。

### 1. サービスアカウントを GSC のユーザーに追加

1. https://search.google.com/search-console でプロパティ `nagoya-bites.com` を開く
2. 「設定」→「ユーザーと権限」→「ユーザーを追加」
3. サービスアカウントのメール（`xxx@xxx.iam.gserviceaccount.com`）を
   **「制限付き」以上**の権限で追加
   - メールアドレスは GA4 用サービスアカウント JSON の `client_email` と同じ

### 2. GCP で Search Console API を有効化

GCP コンソール → 該当プロジェクト → 「API とサービス」→
**Google Search Console API** を有効化。

### （任意）GSC_SITE_URL シークレット

- 既定値は `https://nagoya-bites.com/`（URL プレフィックスプロパティ・HTML ファイル認証済み）
- ドメインプロパティを使う場合のみ、GitHub Secrets `GSC_SITE_URL` に
  `sc-domain:nagoya-bites.com` を設定する

## 動作確認

```bash
export GA4_SERVICE_ACCOUNT_KEY="$(cat /path/to/key.json)"
node scripts/fetch_gsc_metrics.js
cat data/gsc_metrics.json
```

## トラブルシューティング

- **`gsc_metrics.json` に `error` フィールドが入る**:
  - サービスアカウントが GSC のユーザーに追加されているか
  - Search Console API が有効化されているか
  - `GSC_SITE_URL` がプロパティの形式（URL プレフィックス vs ドメイン）と一致しているか
- **全部 0**: GSC データは 2〜3 日遅延する。`GSC_LOOKBACK_DAYS`（既定 28）の範囲にデータがあるか確認

## 取得できないもの（注意）

- **インデックス被覆数**（4,973 URL のうち何件登録されたか）はこの API では一括取得不可。
  URL Inspection API は 1URL ずつ・クォータ厳しめのため、被覆の全体像は当面 GSC 画面で確認する。
  本スクリプトは「実際に表示・クリックされているクエリ/ページ」= 実効的に価値のある面を取得する。
