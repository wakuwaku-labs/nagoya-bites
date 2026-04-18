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
| 2026-04-18 | Orchestrator(EXPLICIT) | ISSUE-011/012-A/013 実装（多媒体クエリ30件超・Instagram検索URL・週次自動化・API申請手順docs） | ✅ PR#2 マージ済み |
| 2026-04-18 | Orchestrator(EXPLICIT) | docs/instagram-launch-kit.md 追加（Instagram運用コピペ素材集） | ✅ PR#3 マージ済み |
| 2026-04-18 | Inspector (2並列) | 全方位監査実施、技術/UX/SEO/コンテンツ/競合/季節の10カテゴリ評価、新課題7件検出 | ✅ ISSUE-014〜020 登録 |

---

## Inspector 2026-04-18 監査で検出された新課題

### [ISSUE-014] GW/春の季節特集コンテンツがゼロ 🔴
- **priority**: P1 → **status**: ready
- **category**: content
- **detected**: 2026-04-18
- **description**:
  4/18時点、GW（5/3-6）まで約2週間。春〜GW向け特集記事がゼロ件。
  「名古屋 GW グルメ」「名古屋 テラス 花見」「母の日 名古屋」等の高トラフィック検索で機会損失。
  既存の features/ はシーン別（宴会/デート/女子会 等）のみで季節軸が皆無。
- **impact**: GW前の検索ピーク機会損失。1年後まで同じチャンスなし。
- **acceptance**:
  - GW特集・春テラス・母の日の最低3本を 2026-04-25 までに公開
  - feature-strip への追加、sitemap.xml 登録
- **files**: `features/gw-2026.html`, `features/spring-terrace.html`, `features/mothers-day.html`, `index.html`, `sitemap.xml`

### [ISSUE-015] index.html が 7.2MB で巨大 — パフォーマンス劣化 🔴
- **priority**: P1 → **status**: ready
- **category**: performance
- **detected**: 2026-04-18
- **description**:
  4588件の LOCAL_STORES を inline 埋め込みしている結果、ファイルサイズが 7.2MB。
  TTFB遅延、初期レンダリングブロック、モバイル離脱要因。
- **impact**: Core Web Vitals 劣化、Lighthouse スコア低下、SEO順位への悪影響
- **acceptance**:
  - LOCAL_STORES を外部JSON化 + fetch 化、または段階的読み込み
  - 初期HTML < 1MB を目標
- **files**: `build.js`, `index.html`
- **note**: 大規模改修。慎重な設計と段階的実施が必要。

### [ISSUE-016] sitemap.xml に特集ページが未登録 🟡
- **priority**: P2 → **status**: ready
- **category**: seo
- **detected**: 2026-04-18
- **description**:
  sitemap.xml は URL 1件のみ（index.html）で、features/ 配下の8本の特集ページが未登録。
- **impact**: 特集ページのインデックス遅延、オーガニック流入 20-30% 機会損失
- **acceptance**:
  - build.js で sitemap.xml に全特集ページを自動追加
  - lastmod をビルド時に自動更新
- **files**: `build.js`, `sitemap.xml`

### [ISSUE-017] Google評価 84% 空白・推薦文 84% 空白 🔴
- **priority**: P1 → **status**: ready
- **category**: data
- **detected**: 2026-04-18
- **description**:
  4588店中 3868件（84.3%）がGoogle評価未取得、3862件（84.1%）がおすすめポイント未記入。
  「Google評価4.3以上厳選」「現役プロ監修」という訴求と実態が乖離。
- **impact**: 差別化要素が機能していない、信頼性毀損、CVR低下
- **acceptance**:
  - fetch_scores.js 実行で主要店舗のGoogle評価を埋める
  - write_recommendations.js 実行で推薦文を生成
  - TOP 500店の空白率を < 30% に
- **files**: `fetch_scores.js`, `write_recommendations.js`
- **note**: API KEY (Google Places / Anthropic) が必要。大規模実行は時間とAPI費用がかかる。

### [ISSUE-018] モーダルの店舗画像 alt が空（a11y違反）🟡
- **priority**: P2 → **status**: ready
- **category**: a11y
- **detected**: 2026-04-18
- **description**:
  `<img id="mi" src="" alt="">` が動的に店名を alt にセットされず空のまま。
  スクリーンリーダーで画像情報にアクセス不可。
- **impact**: WCAG 2.1 AA 非準拠、アクセシビリティスコア低下
- **acceptance**:
  - openM() で img.alt = storeName を設定
- **files**: `index.html`

### [ISSUE-019] 特集ページの og:image が全て icon-512.png で統一 🟡
- **priority**: P3 → **status**: ready
- **category**: seo
- **detected**: 2026-04-18
- **description**:
  各特集ページ（banquet.html 等）の og:image が `/icons/icon-512.png` のまま統一されていて、
  SNSシェア時のプレビュー訴求力が弱い。
- **acceptance**:
  - 各特集に独自の og:image（1店目の写真など）を設定
- **files**: `features/*.html`

### [ISSUE-020] title が98文字で長すぎる（SERP切れ）🟢
- **priority**: P3 → **status**: ready
- **category**: seo
- **detected**: 2026-04-18
- **description**:
  現在の `<title>` が98文字、モバイル検索結果で切れる（Google推奨55文字以内）。
- **acceptance**: 55文字以内に短縮
- **files**: `index.html`
