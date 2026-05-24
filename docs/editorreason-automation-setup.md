# editorReason 自動収集パイプライン セットアップ手順（ISSUE-045）

> **このドキュメントの目的**
> 「ネット上の業界人知識を大量に集めて editorReason に自動反映する」パイプラインの
> 起動手順。コード側は **すべて実装・検証済み**。2 つの API キーを設定するだけで起動する。
>
> ISSUE-041 / 056（Google Places 自動取得）と同じ運用パターン。

---

## 設計（捏造禁止の安全策付き）

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. scripts/build_editorreason_drafts.js（週次 CI で実行）              │
│    入力: data/stores.json + 優先順スコアリング                          │
│    処理: Google CSE で業界系クエリ実行 → Claude API で「引用ベース       │
│         draft」生成                                                    │
│    出力: data/industry_sources/{HPID}.json  ← 検索エビデンス           │
│          data/editorreason_drafts/{HPID}.json ← LLM draft + sources   │
│          docs/editorreason-drafts.md ← 人手レビュー用                  │
└─────────────────────────────────────────────────────────────────────┘
                          ↓ レビュー（あなた）
┌─────────────────────────────────────────────────────────────────────┐
│ 2. scripts/approve_editorreason_drafts.js                             │
│    入力: docs/editorreason-drafts.md の [approved] 印                  │
│    処理: draft → data/editor_picks.json に追加（sources 必須）         │
│           audit: source='industry_automation' / automation.reviewed_by │
│    出力: data/editor_picks.json                                       │
└─────────────────────────────────────────────────────────────────────┘
                          ↓ build.js → CI
┌─────────────────────────────────────────────────────────────────────┐
│ index.html / data/stores.json の editorReason フィールドに反映          │
└─────────────────────────────────────────────────────────────────────┘
```

## 安全策（ISSUE-040 教訓の継承）

過去に「mediaFeatures に検証できない受賞歴が混入」事故（ISSUE-040 で全 27 件空配列化）があったため、本パイプラインには以下の安全策を組み込んでいます。

| 安全策 | 実装箇所 | 効果 |
|---|---|---|
| **引用元 URL 必須** | `anthropic_extractor.js` のプロンプト | 各 claim に対応 URL を必須化 |
| **2 ソース以上が原則** | LLM プロンプト + post-validation | 単一ソースのみは confidence を下げる |
| **不十分なら拒否** | LLM プロンプトで `INSUFFICIENT_EVIDENCE` 返答強制 | 捏造より「書かない」を選ぶ |
| **mediaFeatures 自動化禁止** | プロンプトで明示禁止 | 受賞歴等の検証必須情報は自動生成しない |
| **confidence < 0.85 は人手レビュー必須** | `approve_editorreason_drafts.js` | 高信頼以外は人手の目を通す |
| **`source: 'industry_automation'` で識別** | schema | 後から一括取消・監査可能 |
| **LOCAL_STORES 実在検証** | approve スクリプト | 架空店への誤追加防止 |
| **`automation.reviewed_by` で監査証跡** | approve スクリプト | 誰がいつ承認したか永続記録 |

---

## セットアップ手順（リポジトリオーナーのみ・所要 20 分）

### Step 1: Google Custom Search Engine（CSE）を作成

1. [programmablesearchengine.google.com](https://programmablesearchengine.google.com/) にアクセス
2. 「新しい検索エンジン」を作成
   - 名前: `nagoya-bites-industry-search`
   - 「ウェブ全体を検索」を **ON**
   - 言語: 日本語
3. 作成後、「概要」→ **検索エンジン ID（cx）** をコピー
4. 任意で「サイトの優先順位」に名古屋系メディアを追加（精度向上）:
   - `nagoyareco.com`（ナゴレコ）
   - `nagoya-info.com`（名古屋情報通）
   - `kelly-net.jp`（日刊KELLY）
   - `webotonano.jp`（WEB大人の名古屋）
   - `prtimes.jp`（プレスリリース）
   - `note.com` / `hatenablog.com`（個人ブログ）

### Step 2: Google Cloud で Custom Search JSON API を有効化

1. [Google Cloud Console](https://console.cloud.google.com/) →（ISSUE-056 と同じ `optimal-transit-447015-e9` プロジェクト流用可）
2. 「API とサービス」→「ライブラリ」→ **Custom Search API** を有効化
3. 「認証情報」→「API キーを作成」（HTTP リファラ制限なし）

**コスト**:
- 無料枠 100 クエリ/日
- 有料 $5 / 1000 クエリ
- 1 店あたり 5 クエリ → 週 50 店処理で **250 クエリ/週 ≈ $1.25/月**

### Step 3: Anthropic API キーを取得

1. [console.anthropic.com](https://console.anthropic.com/) でアカウント作成
2. 「API Keys」→「Create Key」
3. 月次予算上限を設定（推奨: $30/月）

**コスト見積**:
- 1 店あたり ~1,500 input tokens + ~500 output tokens
- Sonnet 4.5 = $3/M input, $15/M output → 1 店 ~$0.012
- 週 50 店 → **~$2.4/月**

### Step 4: GitHub Secrets に登録

GitHub リポジトリ →「Settings」→「Secrets and variables」→「Actions」で以下 3 つを登録:

| Secret name | 値 |
|---|---|
| `GOOGLE_CSE_KEY` | Step 2 の API キー |
| `GOOGLE_CSE_CX` | Step 1 の検索エンジン ID（cx） |
| `ANTHROPIC_API_KEY` | Step 3 の API キー |

### Step 5: 初回手動実行

GitHub →「Actions」→「editorReason batch」→「Run workflow」（`workflow_dispatch`）

または、ローカルで:
```bash
export GOOGLE_CSE_KEY=＜key＞
export GOOGLE_CSE_CX=＜cx＞
export ANTHROPIC_API_KEY=＜key＞
node scripts/build_editorreason_drafts.js --top 30
```

完了後 [docs/editorreason-drafts.md](editorreason-drafts.md) を確認。各 draft には：
- 🟢 `high-conf (自動マージ候補)` — confidence ≥ 0.85
- 🟡 `review-required` — 確認推奨
- ⚪ `INSUFFICIENT` — 採用不可
- 🔴 `WARN_RISK` — 閉店/スキャンダル等の警告

### Step 6: レビュー & 承認

docs/editorreason-drafts.md 内のコメント行：
```
<!-- [approved] OR [reject]  ← この行を編集してレビュー結果を記入。store_id: J00xxxxx -->
```
を、`[approved]` または `[reject]` に書き換える。

または高信頼分を一括承認:
```bash
node scripts/approve_editorreason_drafts.js --auto-high-conf
```

その後:
```bash
node build.js                    # editor_picks → LOCAL_STORES マージ
git add data/editor_picks.json
git commit -m "approve editorReason batch YYYY-MM-DD"
git push origin main
```

---

## 週次自動運用（CI スケジュール）

`.github/workflows/editorreason-batch.yml` が **毎週月曜 18:00 UTC（JST 火 3:00）** に自動実行：

1. 上位 50 候補に対し discover + draft 生成
2. `docs/editorreason-drafts.md` を更新して PR 作成（または直接コミット）
3. あなたが PR を確認 → `[approved]` 記入 → マージ
4. マージ後の post-job が approve_editorreason_drafts.js を実行（オプション）

**累積効果**:
- 週 50 件 × confidence 0.85 突破率 50% → 週 25 件追加
- **約 1 年で 1,300 件追加 → editorReason カバー率 30% 到達**

---

## トラブルシュート

| 症状 | 原因 | 対処 |
|---|---|---|
| ログに「GOOGLE_CSE_KEY 未設定」「ANTHROPIC_API_KEY 未設定」 | Secret 未登録 | Step 4 を実施 |
| 全 draft が INSUFFICIENT_EVIDENCE | CSE 検索結果が空 or 関連度低 | Step 1 で名古屋系メディアをサイト優先順位に追加 |
| confidence が常に低い | snippet 短すぎる / 業界視点情報なし | 検索クエリを `lib/google_cse.js:discoverIndustryEvidence` で調整 |
| API クォータ超過 | CSE 100 クエリ/日 上限 | 有料化 or `--top` を下げる |
| LLM コストが想定超 | Anthropic API のトークン使用量 | Anthropic console で予算アラート設定 |

---

## 関連

- ISSUE-045（本パイプラインの起票元・editorReason カバー率引き上げ）
- ISSUE-040（mediaFeatures 捏造除去・本パイプラインの教訓元）
- `data/editor_picks.json` `_schema`（`sources` / `automation` フィールド定義）
- `agents/editor.md`（編集哲学・業界視点）
