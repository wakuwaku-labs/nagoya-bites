# editorReason 自動収集パイプライン セットアップ手順（ISSUE-045）

> **このドキュメントの目的**
> 「ネット上の業界人知識を大量に集めて editorReason に自動反映する」パイプラインの
> 起動手順。コード側は **すべて実装・検証済み**。**新規の作業は不要**（既存の
> `GEMINI_API_KEY` だけで動く）。
>
> ISSUE-041 / 056（Google Places 自動取得）と同じ運用パターン。

## ISSUE-098 の経緯（2026-08-19・重要）

このパイプラインは3段階を経ています。最終的にたどり着いた現行版（3）だけ知っていれば
使えますが、同じ落とし穴を踏まないよう記録しておきます。

1. **初期実装**: Google CSE（Custom Search）+ Claude API（`ANTHROPIC_API_KEY`）前提で構築。
   → `ANTHROPIC_API_KEY` が13週連続で未設定のまま、CI上は毎回 success 判定という
   サイレント無稼働に気づかず放置されていた（新規Anthropicアカウント作成の手間が壁になっていた）
2. **1回目の修正**: 新規アカウント作成を避けるため、LLMを既存の `GEMINI_API_KEY`（無料枠）に
   切替。ただし検索部分はまだ Google CSE のまま
3. **2回目の修正（現行版）**: 実際に稼働させたところ、Google CSE が
   **"This project does not have the access to Custom Search JSON API"** で全滅。
   調査の結果、Google公式ドキュメント（[developers.google.com/custom-search/v1/overview](https://developers.google.com/custom-search/v1/overview)）に
   > "The Custom Search JSON API is closed to new customers."
   > "Existing Custom Search JSON API customers have until January 1, 2027 to transition to an alternative solution."
   と明記されており、**2025年に新規プロジェクトへの提供自体が停止されていた**と判明
   （コンソール上は有効化操作ができ「APIが有効です」と表示されるが、実際の呼び出しは拒否される）。
   → Google CSE を廃止し、`scripts/daily_store_discovery.js`（新店発掘パイプライン）と同じ
   **Gemini の Google検索グラウンディング機能**（無料枠・新規サインアップ不要）に置き換えた。
   `GOOGLE_CSE_KEY` / `GOOGLE_CSE_CX` はもう不要（Step1・2として作成した分は未使用のまま残っているが、削除しなくてよい）

---

## 設計（捏造禁止の安全策付き）

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. scripts/build_editorreason_drafts.js（週次 CI で実行）              │
│    入力: data/stores.json + 優先順スコアリング                          │
│    処理: scripts/lib/gemini_grounded_extractor.js が2段階で処理:       │
│      (a) Gemini + googleSearch tool で「店の業界視点情報」を自然文調査   │
│          → groundingChunks から実際に参照した URL 一覧を取得           │
│      (b) 同じ Gemini（tool無し）で 調査結果 + 実URL一覧 を渡し JSON抽出  │
│          → sources_used の URL がグラウンディングの実URLと一致するか   │
│            コード側で検証（LLMの自己申告を鵜呑みにしない）              │
│    出力: data/editorreason_drafts/{HPID}.json ← LLM draft + sources   │
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
| **引用元にない事実は書かない** | `gemini_grounded_extractor.js` のプロンプト | 各 claim に対応 URL を必須化 |
| **sources_used の URL は実際の検索結果と一致するかコード側検証** | 同上（新設・CSE版より強化） | LLMが存在しないURLを自己申告しても除外される |
| **2 ソース以上が原則** | プロンプト + post-validation | 単一ソースのみは confidence を下げる |
| **不十分なら拒否** | プロンプトで `INSUFFICIENT_EVIDENCE` 返答強制 | 捏造より「書かない」を選ぶ |
| **mediaFeatures 自動化禁止** | プロンプトで明示禁止 | 受賞歴等の検証必須情報は自動生成しない |
| **confidence < 0.85 は人手レビュー必須** | `approve_editorreason_drafts.js` | 高信頼以外は人手の目を通す |
| **`source: 'industry_automation'` で識別** | schema | 後から一括取消・監査可能 |
| **LOCAL_STORES 実在検証** | approve スクリプト | 架空店への誤追加防止 |
| **`automation.reviewed_by` で監査証跡** | approve スクリプト | 誰がいつ承認したか永続記録 |

---

## セットアップ（不要）

**新規に行う作業はありません。** `GEMINI_API_KEY` は既に GitHub Secrets に登録済み
（`scripts/daily_store_discovery.js` と共用）で、`scripts/build_editorreason_drafts.js` は
これだけで動きます。

万一 `GEMINI_API_KEY` が未設定の場合のみ、[aistudio.google.com/apikey](https://aistudio.google.com/apikey) で発行し
```bash
gh secret set GEMINI_API_KEY
```
で登録してください（値は貼らずにプロンプトで入力）。

### 手動実行

GitHub →「Actions」→「editorReason batch」→「Run workflow」（`workflow_dispatch`）

または、ローカルで（`GEMINI_API_KEY` を自分の環境から）:
```bash
export GEMINI_API_KEY=＜key＞
node scripts/build_editorreason_drafts.js --top 30
```

完了後 [docs/editorreason-drafts.md](editorreason-drafts.md) を確認。各 draft には：
- 🟢 `high-conf (自動マージ候補)` — confidence ≥ 0.85
- 🟡 `review-required` — 確認推奨
- ⚪ `INSUFFICIENT` — 採用不可
- 🔴 `WARN_RISK` — 閉店/スキャンダル等の警告

### レビュー & 承認

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

1. 上位 50 候補に対し Gemini 検索グラウンディング調査 + draft 生成
2. `docs/editorreason-drafts.md` を更新してコミット
3. あなたが確認 → `[approved]` 記入 → `approve_editorreason_drafts.js` 実行

**累積効果（想定）**:
- 週 50 件 × confidence 0.85 突破率次第。初回実測はまだ無いため、稼働後に
  `docs/editorreason-drafts.md` の OK/INSUFFICIENT 比率を見て歩留まりを確認すること
  （自己申告の見積もりで判断しない・CLAUDE.md 制約10）

---

## トラブルシュート

| 症状 | 原因 | 対処 |
|---|---|---|
| ログに「GEMINI_API_KEY 未設定」 | Secret 未登録 | `gh secret set GEMINI_API_KEY` |
| 全 draft が INSUFFICIENT_EVIDENCE | 検索グラウンディングで関連情報が見つからなかった、または `_debug.groundingUrls` が空 | `data/editorreason_drafts/{id}.json` の `_debug.researchText` を確認。店名の表記ゆれ（正式名 vs 通称）が原因のことがある |
| Gemini が 429（レート超過） | 無料枠 15回/分・1,500回/日 の上限 | `--top` を下げる、または実行間隔を空ける（コストは発生しない・待てば解消） |
| `sources_used` が期待より少ない | `N件のURLが実際の検索結果に無いため除外` 警告 | 正常動作（安全策）。LLMが検索結果にないURLを自己申告した場合に発動する |
| 過去のキャッシュがCSEエラーのまま再利用される | `data/editorreason_drafts/{id}.json` に古いエラー入りキャッシュが残っている | `build_editorreason_drafts.js` は warnings に API error 文言があるキャッシュを自動的に無視し再生成する（対応済み）。それでも怪しい場合は該当ファイルを削除して再実行 |

---

## 関連

- [[ISSUE-045]]（本パイプラインの起票元・editorReason カバー率引き上げ）
- [[ISSUE-098]]（Google CSE 提供終了の発見・Gemini 検索グラウンディングへの移行）
- ISSUE-040（mediaFeatures 捏造除去・本パイプラインの教訓元）
- `data/editor_picks.json` `_schema`（`sources` / `automation` フィールド定義）
- `agents/editor.md`（編集哲学・業界視点）
