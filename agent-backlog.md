# NAGOYA BITES — Agent Backlog

> このファイルはエージェントが自律的に管理する課題トラッキングファイル。
> 手動での編集可能だが、エージェントが自動で追記・更新する。
> フォーマット: `status` は `ready` / `in_progress` / `done` / `wont_fix`

---

## 進行中・完了タスク

### [ISSUE-001] ヒーローセクションがモバイルで縦長すぎる ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-15
- `min-height:55vh` → `40vh`、padding も `90px 1.2rem 40px` → `80px 1.2rem 32px` に変更

### [ISSUE-002] filter-panel max-height 固定値 ✅
- **priority**: P2 → **status**: done
- **resolved**: 2026-04-15
- `max-height:600px` → `1200px` に変更（アニメーション維持）

### [ISSUE-003] .mcl クローズボタンCSS 重複定義 ✅
- **priority**: P3 → **status**: done
- **resolved**: 2026-04-15
- line 184 の 32px 定義を削除、line 319 の 44px 定義のみ残存

### [ISSUE-004] カードのモバイルパディング調整 ✅
- **priority**: P2 → **status**: done
- **resolved**: 2026-04-15
- `.card-tags` と `.card-cta` のモバイルパディングをカードベース（padding:12px）に合わせて修正

### [ISSUE-005] 構造化データ（JSON-LD）追加 ✅
- **priority**: P2 → **status**: done
- **resolved**: 2026-04-15
- `WebSite` + `SearchAction` の JSON-LD を追加済み

### [ISSUE-006] sitemap.xml の更新日確認 ✅
- **priority**: P2 → **status**: done
- **resolved**: 2026-04-15
- sitemap.xml lastmod 最新化・1100件に更新済み

### [ISSUE-007] about.html / contact.html デザイン未同期
- **priority**: P2 → **status**: ready
- **detected**: 2026-04-15
- about.html / contact.html にヘッダー・フッター改善あり（未コミット）

### [ISSUE-008] CTA ホットペッパーなし店舗対応 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-15
- HP URLがない店舗ではGoogleマップリンクに差し替え実装済み

### [ISSUE-009] IGエンベッド モバイルパフォーマンス ✅
- **priority**: P2 → **status**: done
- **resolved**: 2026-04-15
- モバイルで photo-grid を 2列表示に変更、3枚目を非表示に（iframe 2枚のみロード）

---

## 未着手タスク（ready）

### [ISSUE-007] about.html / contact.html のデザインがindex.htmlと未同期

- **priority**: P2
- **status**: ready
- **category**: visual
- **detected**: 2026-04-15
- **description**:
  git status で `about.html` と `contact.html` に未コミットの変更がある。
  これらのページは index.html のデザインアップデートと同期されているか不明。
- **acceptance**: 
  - about.html, contact.html を確認し、ヘッダー/フッター/フォントが index.html と統一されているか確認
  - 差異があれば修正してコミット
- **files**: `about.html`, `contact.html`

---

## バックログサマリー

| ID | タイトル | Priority | Status |
|----|---------|----------|--------|
| ISSUE-001 | ヒーローセクションがモバイルで縦長 | P1 | ✅ done |
| ISSUE-002 | filter-panel max-height 固定値 | P2 | ✅ done |
| ISSUE-003 | .mcl CSS重複 | P3 | ✅ done |
| ISSUE-004 | カードモバイルパディング調整 | P2 | ✅ done |
| ISSUE-005 | JSON-LD構造化データ未対応 | P2 | ✅ done |
| ISSUE-006 | sitemap.xml 更新日確認 | P2 | ✅ done |
| ISSUE-007 | about/contact.html デザイン未同期 | P2 | ready |
| ISSUE-008 | CTA ホットペッパーなし店舗対応 | P1 | ✅ done |
| ISSUE-009 | IGエンベッド モバイルパフォーマンス | P2 | ✅ done |

---

## 進行中タスク（追加）

### [ISSUE-010] 話題店データ機能の立ち上げ ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-17
- **description**:
  - `data/trending_stores.json` を新設（話題店マスター・人間編集可能）
  - `build.js` にトレンドJSONマージ処理・`calcTrendScore` 改訂（話題フラグで +40）
  - `index.html`: 「🔥 今週の話題店」セクション化、buildTrendRanking を話題フラグ優先、デフォルトソートを話題フラグ→トレンドスコア→おすすめ文→Google評価に改修
  - `scripts/fetch_hotpepper_popular.js` 新設（HP 人気順収集）
  - `scripts/fetch_trending_articles.js` 新設（Web記事取り込み運用ヘルパー）
  - 初期キュレーション7件：あつた蓬莱軒/山本屋本店/山本屋総本家/矢場とん/まるは食堂/矢場味仙/備長
- **files**: `data/trending_stores.json`, `build.js`, `index.html`, `scripts/fetch_hotpepper_popular.js`, `scripts/fetch_trending_articles.js`

### [ISSUE-011] 多媒体トレンド連携 ✅
- **priority**: P2 → **status**: done
- **resolved**: 2026-04-18
- **description**:
  食べログ本体の直接スクレイピングは ToS リスクのため回避。代わりに「第三者メディア」
  （dressing / macaroni / ヒトサラ / OZmall / retrip / icotto / TV番組公式 / PR TIMES /
  ナゴレコ / サブロー / note 等）からトレンド店名を拾う方針に転換。
  `scripts/fetch_trending_articles.js` の検索クエリを既存10件から30件超に拡張（カテゴリ別）。
  利用規約リスクなしで広く店名を収集可能に。
- **files**: `scripts/fetch_trending_articles.js`

### [ISSUE-012] Instagram 話題度連携 🔄
- **priority**: P2 → **status**: in_progress
- **detected**: 2026-04-17 / **phase_a_done**: 2026-04-18
- **description**:
  Phase A（実装済み）: 各店モーダルに Instagram ハッシュタグ検索リンクを表示。
  `build.js` が全店に `Instagram検索` URL を自動付与（既存 TikTok検索/X検索 と同パターン）。
  ユーザーが即クリックで Instagram の話題度を確認可能。
  
  Phase B（申請プロセス）: Facebook Developers App の Business Review 申請手順を
  `docs/instagram-api-setup.md` にドキュメント化。承認後は Graph API Hashtag Search で
  投稿数を自動収集し `data/trending_stores.json` の `話題スコア` に反映する実装雛形も用意。
- **next_action**: wakuwaku-labs 代表アカウントで Facebook App 作成・審査申請
- **files**: `build.js`, `index.html`, `docs/instagram-api-setup.md`

### [ISSUE-013] 話題店の週次リフレッシュ自動化 ✅
- **priority**: P3 → **status**: done
- **resolved**: 2026-04-18
- **description**:
  `.github/workflows/weekly-pipeline.yml` に Step 0（`fetch_hotpepper_popular.js` 実行）と
  Step 0.5（`data/trending_stores.json` 自動コミット）を追加。毎週月曜9時JSTに Hot Pepper
  人気順から候補収集 → 自動コミット → 続けて build.js が話題フラグを反映。
  `continue-on-error: true` + `|| true` でソフト失敗する設計（API障害で全体停止しない）。
- **files**: `.github/workflows/weekly-pipeline.yml`

---

## エージェント実行ログ

| 日付 | エージェント | 実行内容 | 結果 |
|------|------------|---------|------|
| 2026-04-15 | Inspector | 初回サイト監査・バックログ初期化 | 9件の課題を検出 |
| 2026-04-15 | Orchestrator(FULL) | Hero修正・権威性バー・CTA修正・店舗別ページ1095件生成・sitemap 1→1097件・デプロイ | ✅ デプロイ済み (commit 3824014) |
| 2026-04-15 | Builder | ISSUE-001,002,003,004,009を実装（CSS修正）・sitemap 1100件 | ✅ デプロイ済み |
| 2026-04-17 | Orchestrator(EXPLICIT) | ISSUE-010 話題店データ機能立ち上げ（JSON/build.js/UI/scripts/キュレーション7件） | ✅ PR#1 マージ済み |
| 2026-04-18 | Orchestrator(EXPLICIT) | ISSUE-011/012-A/013 実装（多媒体クエリ30件超・Instagram検索URL・週次自動化・API申請手順docs） | ⏳ QAゲート予定 |
