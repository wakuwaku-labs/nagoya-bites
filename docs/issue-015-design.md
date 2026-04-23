# ISSUE-015 設計書 — index.html 7.2MB 削減

> **ゴール**: 初期HTMLサイズを < 800KB に圧縮し、Core Web Vitals を改善してSEO順位とモバイル体験を底上げする。
> **方針**: 低リスク → 中リスク の **3段階** で実施。各段階独立にリリース＆検証可能にする。
> **非目標**: フィルター・検索・モーダル・Instagramエンベッド・Google評価表示・話題ソート・editor_picks の挙動を**一切変えない**。

---

## 現状分析

### サイズ内訳（計測: 2026-04-22）

| 項目 | サイズ | 備考 |
|------|--------|------|
| index.html 全体 | **7.2MB** (7,428KB) | |
| うち LOCAL_STORES (JSON) | **4.85MB** (4,850KB) | 4,586店 × 平均1,110B |
| CSS + 静的HTML + JS | 2.4MB | 今回の対象外（ただし一部最適化余地あり） |

### LOCAL_STORES 内の削減可能領域

| カテゴリ | サイズ | 備考 |
|---------|--------|------|
| `TikTok検索` / `X検索` / `Instagram検索` URL | **2.19MB** | **コードで未使用**。render時に `tiktokSearchUrl(r)` 等が常に再計算する（[index.html:3838-3842](index.html:3838)） |
| 空フィールド（build.jsで強制クリア済み） | 約350KB | `Instagram投稿URL`・`内観写真URL`・`料理写真URL1/2` — sanitizeStore で全件空、render側は空分岐済み |
| `公開フラグ` | 約140KB | build時点でFALSEは除外済み。loadStoresの再フィルタも冗長 |
| `英語名` | 約50KB | JSON-LD alternateName で使用。保持推奨 |

→ **コード無修正** で build.js からこれらを出力しないだけで、**約 2.5〜2.7MB 削減（52%減）** 可能。

### 既存機能で LOCAL_STORES を参照している箇所

| 行 | 箇所 | 役割 |
|----|------|------|
| [3322](index.html:3322) | `init()` | `loadStores(LOCAL_STORES)` — 起動時に全件ロード |
| [3325](index.html:3325) | `loadStores` | `ALL_STORES`・`FILTERED` を初期化、フィルタタブ生成、`injectDynamicJsonLd`、`applyFilters` |
| [3338](index.html:3338) | `injectDynamicJsonLd` | SEO/LLMO 用 JSON-LD 挿入（全件or一部） |
| [3860〜](index.html:3860) | `buildCardHtml` | カード描画 |
| [4015〜](index.html:4015) | `openM` | モーダル描画（写真URL群・IG投稿URL 参照） |

### 依存する参照フィールド（削除NG）

```
店名・ジャンル・エリア・都道府県・価格帯・営業時間・アクセス・
ホットペッパーID・写真URL・Instagram・食べログURL・備考・タグ・
Google評価・おすすめポイント・トレンドスコア・トレンドラベル・
話題フラグ・編集部推薦・editorReason・mediaFeatures・
insiderNote・visitStatus・英語名（JSON-LD）
```

---

## 段階設計

### Phase 1 — デッドデータ・空フィールドの build.js 出力抑制 🟢 低リスク

**狙い**: 無修正のコードで動作可能な「ゴミ出力の停止」。回帰ゼロを目指す。

**変更範囲**: `build.js` のみ

**実装**:
1. `build.js` に `serializeStores(stores)` ヘルパーを追加。以下を LOCAL_STORES 書き込み時にストリップ:
   - `TikTok検索` / `X検索` / `Instagram検索`（未使用URL）
   - `Instagram投稿URL` / `内観写真URL` / `料理写真URL1` / `料理写真URL2`（sanitizeで全件空）
   - `公開フラグ`（build時にFALSE除外済み）
   - 空文字列（`""`）のフィールド全般（render側は `|| ''` の `falsy` 分岐で既に耐性あり）

2. `loadStores(stores)` の `公開フラグ !== 'FALSE'` フィルタを残置（将来の再導入に備え防御的に維持）

**期待効果**:
- index.html: 7.2MB → **約 4.5〜4.7MB**（2.5〜2.7MB 削減、36〜37%減）
- LCP 改善（推定 -0.5〜-1.0s）
- Lighthouse Performance +5〜10pt

**QA チェックリスト**:
- [ ] `node build.js` 正常終了
- [ ] 店舗数 ≥ 4,500件（実装前比 -1% 以内）
- [ ] LOCAL_STORES サイズが JSON として 2.2〜2.5MB に収まる
- [ ] preview でフィルター・モーダル・Instagram・TikTok・X・Google・食べログ・ホットペッパーの全リンクが生成されクリック先が正当
- [ ] JSON-LD が alternateName 含めて出力
- [ ] 「今週の話題店」「トレンドソート」「編集部ピック」表示が不変

**ロールバック**: build.js の1関数を差し戻すだけ。

**期間**: 1〜2日（実装 + QA + デプロイ）

---

### Phase 2 — 外部JSON化＋初期インラインは TOP50 のみ 🟡 中リスク

**狙い**: 初期 HTML を 800KB 以下に圧縮し、残りはバックグラウンドで段階取得。

**変更範囲**: `build.js` + `index.html`

**設計**:
1. `build.js` が2系統を生成:
   - `data/stores.json`（全件、Phase 1 スリム化後で約 2.2MB）
   - index.html 内 `var LOCAL_STORES_TOP = [...]`（TOP 50のみ、約 60KB）
     - 並び順: 話題フラグ → 編集部推薦 → トレンドスコア → Google評価
     - これが LCP 圏＝ファーストビューの全カード
2. `index.html` 側:
   ```js
   var ALL_STORES = []; // 全件（後から流し込み）
   var BOOTSTRAP_STORES = LOCAL_STORES_TOP; // 初期描画用

   function init() {
     loadStores(BOOTSTRAP_STORES);        // まず TOP50 だけで全UI起動
     fetchFullCatalog();                  // 非同期で残りを取得
   }
   function fetchFullCatalog() {
     fetch('data/stores.json')
       .then(r => r.json())
       .then(full => {
         ALL_STORES = full.filter(s => s['公開フラグ'] !== 'FALSE');
         rebuildFilterIndexes();          // エリア/ジャンル/タグ選択肢を再構築
         applyFilters();                  // 現在のフィルタ条件で再描画
         injectDynamicJsonLd(ALL_STORES); // JSON-LD 全件化
       })
       .catch(e => console.warn('full catalog load failed', e));
   }
   ```
3. `rebuildFilterIndexes()` はフィルタ選択肢（エリア・ジャンル・タグ・人数）を ALL_STORES から再生成。初期 TOP50 と全件でカテゴリが増えるため。
4. ユーザーが検索/フィルタ操作をフェッチ完了前に行った場合:
   - fetch 中フラグ `LOADING_FULL = true` を立て、完了時に適用済みフィルタを再評価
   - UI的にローディングインジケータは出さない（ゼロ遅延演出）

**期待効果**:
- index.html: 4.5MB → **約 600〜700KB**（6.5〜6.6MB 削減、89〜90%減）
- 初期 TTFB 改善 → -50〜-70%
- LCP 改善 → 推定 -1.5〜-3.0s（モバイル）
- SEO: Core Web Vitals の "Good" 区分入り見込み

**リスクと対策**:

| リスク | 対策 |
|--------|------|
| fetch が失敗すると全件表示できない | TOP50 は常にインラインなので**劣化運用**として機能する。コンソール警告と静かにフォールバック |
| クローラーが全件インデックスできない | **重要**: sitemap.xml に stores/{slug}.html が全件登録済み（既存）。クローラーはそちらを辿る。index.html は TOP50＋内部リンク集で十分 |
| フィルタ選択肢が初期と後期で変わる | rebuildFilterIndexes 完了まで、増える選択肢を軽くハイライトするアニメーションで違和感を消す（nice-to-have） |
| URLハッシュで深いフィルタ状態がブックマークされていた場合 | fetchFullCatalog 完了後に applyFilters を呼び直すため、初期描画 50件 → 非同期で全件再評価、の流れで復元される |

**QA チェックリスト**:
- [ ] 初期 HTML が < 800KB
- [ ] 初期描画で TOP50 が話題フラグ優先で並ぶ
- [ ] fetch 完了後、件数・フィルタ選択肢が正しく増える
- [ ] オフライン時に TOP50 で動作（Service Worker 既存）
- [ ] Lighthouse Performance > 75（モバイル）・> 90（PC）

**期間**: 3〜5日（設計レビュー + 実装 + QA + 慎重なデプロイ）

---

### Phase 3 — ジャンル別チャンク化 ⚪ P3（機会あれば）

**狙い**: 初期 data/stores.json も重いので、ユーザー操作に応じてチャンク取得。

**設計概要**:
- `data/stores/izakaya.json` / `data/stores/yakiniku.json` / ... にジャンル分割
- ユーザーのジャンルフィルタ選択に応じて fetch
- 「全ジャンル」選択時は全チャンクを並列 fetch

**判断基準**: Phase 2 のデプロイ後、GA4 で初期描画後のエンゲージ率・CVR を計測。もし全件 fetch が効いてないなら Phase 3 へ。効いているならスキップ。

---

## 段階サマリー

| Phase | リスク | 削減サイズ | 目標達成 | 期間 |
|-------|--------|-----------|---------|------|
| 1: build.js の出力スリム化 | 🟢 低 | −2.5MB（36%減） | 4.5MB（未達）| 1〜2日 |
| 2: 外部JSON + TOP50インライン | 🟡 中 | −4.0MB（89%減） | **800KB（達成）** | 3〜5日 |
| 3: ジャンル別チャンク化 | 🟠 中 | 数百KB追加削減 | — | 1週間 |

**推奨**: Phase 1 は即日実装。Phase 1 デプロイ後 1週間観察（GA4 で UU・LCP・離脱率の変化）してから Phase 2 へ。

---

## 次アクション

1. [ISSUE-015-P1] Phase 1 の build.js 実装（担当: Builder、期間: 2日）
2. [ISSUE-015-P2] Phase 2 の設計レビュー & 実装（担当: Builder、期間: 5日、Phase 1 の観察後に着手）
3. [ISSUE-015-P3] Phase 3 はバックログに ready で保留（Phase 2 後に判断）

QAゲートは各 Phase 独立。LOCAL_STORES 件数の減少、フィルタ/モーダル/ソートの回帰を最重点で検査する。
