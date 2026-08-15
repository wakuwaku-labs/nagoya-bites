# Google Places API セットアップ手順（ISSUE-041 評価カバー率の起動）

> **このドキュメントの目的**
> Google 評価カバー率（現在 **15.3%** / 704 店）を引き上げる P1 タスク（ISSUE-056）の
> **唯一の未完了ステップ = `GOOGLE_PLACES_API_KEY` を GitHub Secrets に設定する**作業手順。
>
> コード側のパイプラインは **すべて実装・検証済み**。鍵を 1 つ設定するだけで、
> 週次 CI が自動で評価を取得し、`build.js` が空の `Google評価` を公式値で補完する。
> （2026-08-15・ISSUE-086: データ蓄積サイクル短縮のため月次→週次実行に変更）

---

## なぜこれが blocker なのか（背景）

ISSUE-041 の評価取得パイプラインは 3 段すべて完成している：

```
scripts/fetch_places.js        ← 全 4,593 店を対象に rating / 口コミ数 / 営業ステータスを取得
        ↓ data/places_resolved.json（キャッシュ）
build.js（line 1417 付近）       ← rating を空の「Google評価」フィールドに公式値で補完
        ↓
.github/workflows/weekly-places.yml    ← 毎週月曜に CI で自動実行・コミット
```

しかし `data/places_resolved.json` は **一度も生成されたことがない**
（git 履歴にも存在しない）。原因は `GOOGLE_PLACES_API_KEY` が GitHub Secrets に
未設定のため、`fetch_places.js` が `exit 0`（スキップ）し続けているから。

→ **鍵を設定すれば、コードを 1 行も変えずに評価カバー率が伸び始める。**

---

## セットアップ手順（リポジトリオーナーのみ・所要 10 分）

### Step 1: Google Cloud で Places API キーを発行

1. [Google Cloud Console](https://console.cloud.google.com/) にログイン
   - 既存プロジェクト `optimal-transit-447015-e9`（GA4/GSC で使用中）を流用してよい
2. 「API とサービス」→「ライブラリ」→ **Places API** を有効化
3. 「API とサービス」→「認証情報」→「認証情報を作成」→「API キー」
   - **HTTP リファラ制限は付けない**（サーバー側 = GitHub Actions から叩くため）
   - 用途を Places API に限定する「API の制限」は付けてよい（推奨）
4. 発行されたキー文字列をコピー

### Step 2: 無料枠を確認し、予算アラートを設定（必須・2026-08-15 更新）

> ⚠ **重要**: 2025-03 に Google は Maps Platform の一律 $200/月無料クレジットを廃止し、
> SKU（機能カテゴリ）ごとの個別無料枠に切り替えた。このドキュメントの旧版は廃止前の
> 前提で書かれていたため、**必ず自分のアカウントの実際の無料枠を確認してから予算を決めること**。
> `weekly-places.yml` の Step2（`--refresh`）は、これが未確認の間は既定 `PLACES_DETAILS_BUDGET=0`
> （課金ゼロ・実質一時停止）になっている。

1. Google Cloud Console →「お支払い」→「レポート」または「予算とアラート」で、
   現在のアカウントに適用されている無料枠・プロモクレジットの残高を確認する
   （新規アカウント特典の有無、SKU 別無料枠の状況はアカウントごとに異なる）
2. 「予算とアラート」で確認した無料枠に見合った金額（例: $20〜$50）で警告を設定
3. 想定コスト（本ワークフローの Step2 のみ）: Place Details（Basic+Atmosphere）
   ≈ $22/1000 リクエスト。`PLACES_DETAILS_BUDGET` を設定した件数 × 4.33週/月 × $22/1000
   が月間の見込み額（例: 425件/週 ≈ 月$40）
4. 確認・納得したら GitHub リポジトリ →「Settings」→「Secrets and variables」→
   「Actions」→「Variables」タブで `PLACES_DETAILS_BUDGET` を作成し、希望する
   週あたりの件数（例: `425`）を設定する。設定しなければ Step2 は課金ゼロのまま動き続ける

> 💡 初回コストを抑えたい場合は、まず `--limit` や `--max-details` で段階取得する（Step 4 参照）。

### Step 3: GitHub Secrets に登録

1. GitHub リポジトリ →「Settings」→「Secrets and variables」→「Actions」
2. 「New repository secret」
   - **Name**: `GOOGLE_PLACES_API_KEY`
   - **Secret**: Step 1 でコピーしたキー
3. 保存

### Step 4: 初回実行（手動トリガー）

週次スケジュール（毎週月曜）を待たずに、すぐ動かして確認できる：

1. GitHub →「Actions」→「Weekly Google Places fetch」
2. 「Run workflow」（`workflow_dispatch`）を押す
3. 完了後、ログ末尾の **「Google評価 カバレッジ見込み」** で取得結果を確認
4. `data/places_resolved.json` がコミットされ、次回 `build.js` 実行（週次パイプライン）で
   `index.html` の `Google評価` に反映される

#### ローカルで段階取得したい場合（任意）

```bash
export GOOGLE_PLACES_API_KEY=＜キー＞
node scripts/fetch_places.js --limit 200    # まず 200 店だけ取得して動作確認
node scripts/fetch_places.js                # 残り全件（増分・キャッシュ済みはスキップ）
node build.js                               # index.html に反映
```

---

## 効果の確認方法

- CI ログの「Google評価 カバレッジ見込み」ステップで、取得後の推定カバー率（%）が出る
- `build.js` 実行後、`index.html` の `Google評価` フィールド充足数が増える
- 週次 KPI（`docs/kpi-weekly.md`）に評価カバー率を転記して推移を追う

### acceptance（ISSUE-056）

- 6 ヶ月で Google 評価カバー率 **50% 以上**（4,593 × 50% ≒ 2,300 店）
- 上限は「Google に登録があり住所が名古屋市で一致する店」に依存（全店 100% にはならない）
- 住所不一致で却下された店は `places_resolved.json` に `rejected: true` で記録され、監査可能

---

## トラブルシュート

| 症状 | 原因 | 対処 |
|------|------|------|
| ログに「GOOGLE_PLACES_API_KEY 未設定」 | Secret 未登録 | Step 3 を実施 |
| `REQUEST_DENIED` | Places API 未有効化 / キー制限 | Step 1-2 を有効化、リファラ制限を外す |
| `OVER_QUERY_LIMIT` | クォータ超過 | 翌日再実行（増分で続きから取得） |
| カバー率が想定より低い | 住所不一致での却下が多い | `places_resolved.json` の `rejected` を確認・店名/住所の表記を点検 |

---

## 関連

- ISSUE-056（旧 ISSUE-041 ready 版）: Google 評価カバー率 15% → 50%
- ISSUE-048 / ISSUE-049: スコア信頼度（Places の口コミ数・履歴を利用）
- `docs/kpi-weekly.md`: カバー率推移の記録先
