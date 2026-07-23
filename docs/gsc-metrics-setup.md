# GSC 検索パフォーマンス取得 — セットアップ手順

`scripts/fetch_gsc_metrics.js` が Google Search Console の検索パフォーマンス
（clicks / impressions / CTR / 平均掲載順位 / トップクエリ / トップページ）を
日次で `data/gsc_metrics.json` に書き出す。GA4 の `site_metrics.json` と対になり、
organic 流入改善（ISSUE-054 / ISSUE-068）の効果測定の本体となる。

> **なぜ最優先か（ISSUE-068）**: 2026-07 時点で organic が最大チャネル（58.9%）になり、
> しかも検索流入の内訳は **Bing 131 > Google 70** と Bing が Google を上回る異常値。
> GSC が見えないと「Google 側で何のクエリで何位に出ているか／インデックスされているか」が
> 完全に盲点のまま SEO 判断を続けることになる。ここを開通させるのが最優先。

---

## 🔑 オーナーが行う作業（一度だけ・所要5分）

GA4 連携でサービスアカウントは既に存在するため、**新規作成は不要**。以下 2 つだけ。

### 追加すべきサービスアカウント（CI ログで確定済み）

```
nagoya-bites-ga4@optimal-transit-447015-e9.iam.gserviceaccount.com
```

（このメールは秘密情報ではない。GA4 用 JSON キーの `client_email` と同一。
　万一変わった場合は `data/gsc_metrics.json` の `serviceAccountToAdd` フィールド、
　または CI ログ「使用中のサービスアカウント: …」で最新値を確認できる）

### 1. サービスアカウントを GSC のユーザーに追加

直リンク（プロパティ `nagoya-bites.com` のユーザー管理画面）:

- URL プレフィックス型の場合:
  https://search.google.com/search-console/users?resource_id=https://nagoya-bites.com/
- ドメインプロパティ型の場合:
  https://search.google.com/search-console/users?resource_id=sc-domain:nagoya-bites.com

手順:
1. 上記を開く（どちらのプロパティ型で登録済みか不明なら両方確認）
2. 「ユーザーを追加」
3. 上のサービスアカウントのメールを **「制限付き」以上**の権限で追加

> **プロパティ型はどちらでも OK**。スクリプトが `sites.list()` で自動判別し、
> URL プレフィックス（`https://nagoya-bites.com/`）でもドメインプロパティ
> （`sc-domain:nagoya-bites.com`）でも、アクセスできる方を自動で使う。
> `GSC_SITE_URL` シークレットの設定は基本不要（明示したい場合のみ設定）。

### 2. GCP で Search Console API を有効化

直リンク（プロジェクト `optimal-transit-447015-e9` の API ライブラリ）:

https://console.cloud.google.com/apis/library/searchconsole.googleapis.com?project=optimal-transit-447015-e9

「有効にする」を押すだけ。

---

## ✅ 反映確認（オーナー作業のあと）

### 方法A: CI を手動実行（推奨・キー不要）

GitHub の Actions → 「Build & Deploy」→ Run workflow。完了後 `data/gsc_metrics.json` に
`totals`（clicks / impressions …）が入っていれば成功。ログの
「アクセス可能な GSC プロパティ(N): …」で N≥1 になっていれば追加成功のサイン。

### 方法B: ローカルで単発実行（キーを持っている場合）

```bash
export GA4_SERVICE_ACCOUNT_KEY="$(cat /path/to/key.json)"
node scripts/fetch_gsc_metrics.js
cat data/gsc_metrics.json
```

---

## 仕組み

```
[毎日 build.yml の "Fetch GSC search performance" ステップ]
        ↓ GA4_SERVICE_ACCOUNT_KEY を流用して Search Console API を叩く
   scripts/fetch_gsc_metrics.js
        ↓ sites.list() でアクセス可能プロパティを自動判別
        ↓ URLプレフィックス / ドメインプロパティのどちらでも自動選択
   data/gsc_metrics.json 更新（CI が commit）
```

## トラブルシューティング

`data/gsc_metrics.json` に `error` フィールドが残る場合、CI ログの診断行を見る:

- **「アクセス可能な GSC プロパティ(0): (なし＝SA未追加の可能性大)」**
  → 手順1が未完了。サービスアカウントがまだ GSC ユーザーに追加されていない
- **「sites.list 取得失敗（Search Console API 未有効化の可能性）」**
  → 手順2が未完了。GCP で Search Console API を有効化する
- **プロパティは見えるが searchanalytics でエラー**
  → 権限が「所有者/フル」でなくても「制限付き」で検索パフォーマンスは読めるはず。
    それでも出る場合は `GSC_SITE_URL` を明示（`sc-domain:nagoya-bites.com` など）
- **`totals` が全部 0**: GSC データは 2〜3 日遅延する。`GSC_LOOKBACK_DAYS`（既定 28）の
  範囲にデータがあるか確認

## GSC_SITE_URL シークレット（任意）

- 未設定なら `sites.list()` の結果から自動選択（推奨・触らなくてよい）
- 明示したい場合のみ GitHub Secrets `GSC_SITE_URL` に設定
  - URL プレフィックス: `https://nagoya-bites.com/`
  - ドメインプロパティ: `sc-domain:nagoya-bites.com`

## 取得できないもの（注意）

- **インデックス被覆数**（数千 URL のうち何件登録されたか）はこの API では一括取得不可。
  URL Inspection API は 1URL ずつ・クォータ厳しめのため、被覆の全体像は当面 GSC 画面で確認する。
  本スクリプトは「実際に表示・クリックされているクエリ/ページ」= 実効的に価値のある面を取得する。
