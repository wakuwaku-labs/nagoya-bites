# NAGOYA BITES — Agent Backlog

> このファイルはエージェントが自律的に管理する課題トラッキングファイル。
> 手動での編集可能だが、エージェントが自動で追記・更新する。
> フォーマット: `status` は `done` / `in_progress` / `done` / `wont_fix`

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
- **priority**: P2 → **status**: done
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

### [EDT-002] 編集部ピックフィールド追加（editor_picks.json） ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-20
- **category**: editorial / proof
- **description**:
  EDT-001 で公開した編集規約の原則（他メディア掲載実績・業界人の解釈力・選ばない勇気・編集部の来店実績）を
  個別店舗レベルで可視化するため、4 フィールドを追加。規約を claim から proof に転換。
- **new fields**:
  - `editorReason`: 掲載判断の根拠（60〜120字）
  - `mediaFeatures`: 他メディア掲載履歴 `[{name, year?, url?}]`
  - `insiderNote`: 業界人視点の解釈メモ（40〜100字）
  - `visitStatus`: `visited | interview | desk`（編集部の実感指標）
- **architecture**:
  - `data/editor_picks.json`（新規）: C案（trending_stores.json と同パターンのオーバーレイ）
  - `build.js`: trending マージブロック直後に editor_picks マージブロック追加
  - `index.html`: CSS 5クラス追加・モーダル 3ブロック + visitStatus 行・sort 優先度更新
- **mvp scope**: サンプル 5 店（あつた蓬莱軒/山本屋本店/まるは食堂/備長/矢場味仙）
- **long-term**: 全 4588 店カバーを目標。上位→ジャンル別→全体の順で段階拡充
- **files**:
  - `data/editor_picks.json`（新規）
  - `build.js`（+40行）
  - `index.html`（+100行）
- **follow-up**:
  - 上位 100 店への editor_picks 拡充（EDT-003）
  - editorial-policy.html から「編集部ピック一覧」への導線追加
  - `avoidedReason`（選ばない勇気の裏表示）フィールドを後続 PR で検討

### [EDT-001] 編集規約（マニフェスト）ページ新設 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-20
- **category**: editorial / differentiation
- **description**:
  「業界人運営」という差別化が claim のままで弱い問題を解決するため、編集規約ページを新設。
  匿名性をミシュラン型で「編集倫理の担保」として肯定的に提示し、
  編集部を集団軸（役職のみ開示）でブランド人格化する。
- **positioning shift**:
  - 武器を「現場取材量」ではなく「業界人の解釈力」として定義
  - 公開情報を業界知識で読み解くキュレーターとしての立ち位置
  - 実地訪問は編集判断の一要素（必須ではない）
- **content sections**:
  01. Editorial Principles（3柱）/ 02. Selection Criteria（5基準、他メディア実績を含む）
  / 03. Independence（金銭関係・広告の扱い）/ 04. Why Anonymous（匿名の理由・編集部構成）
  / 05. Inside Perspective（解釈力の宣言）/ 06. The Courage to Decline（ランキング非採用等）
  / 07. What We Never Do（NG 6項目）/ 08. Amendments
- **files**:
  - `features/editorial-policy.html`（新規）
  - `features/index.html`（Editorial カードを最上部に追加）
  - `index.html`（グローバルナビに Editorial リンクを追加）
- **follow-up**:
  - 将来 about.html を個人軸→集団軸へ段階移行（別タスク）
  - 各特集記事末から editorial-policy.html を参照する動線追加を検討
  - 「編集部が今月最も通った店」など実感指標の公開記事を作る

### [ISSUE-018] 外部検索URL（Instagram/食べログ/TikTok/X）が公式アカウントに辿り着けない ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-19
- **report**: ユーザーから「店舗のIGボタンを押しても検索結果が出ない」報告
- **root cause**: `店名` フィールドに読み仮名（例: "壺中天 こちゅうてん"）が混入しており、外部サービスの検索クエリAND条件にひっかかってヒットせず
- **fix Phase 1 (PR #8)**: `エリア` の生データ混入を除去、検索クエリを「店名 + 名古屋」固定に
- **fix Phase 2 (このPR)**:
  - `cleanStoreName()` ヘルパーで読み仮名・パレン括り読み・ダッシュ括り読みを除去
  - `scripts/resolve_instagram.js` でビルド時に各店の公式IGアカウントURLを Yahoo!検索経由で事前解決
  - `data/instagram_resolved.json` にキャッシュ
  - `build.js` のサニタイズ後に解決済みURLをマージ
  - `instagramSearchUrl(r)` は既に `r['Instagram']` を最優先するため、render時に直リンとして使われる
  - 解決失敗店舗は `cleanStoreName + 名古屋` の検索URLにフォールバック
- **next steps (フォローアップ)**:
  - `node scripts/resolve_instagram.js` の長時間バッチ走行（4585店、〜4-5h）
  - 食べログ・TikTok・Xの公式URL事前解決（同パターン）
  - 自動再解決のCI化

---

## 未着手タスク（done）

### [ISSUE-007] about.html / contact.html のデザインがindex.htmlと未同期

- **priority**: P2
- **status**: done ✅
- **category**: visual
- **detected**: 2026-04-15
- **resolved**: 2026-04-23
- **description**:
  git status で `about.html` と `contact.html` に未コミットの変更がある。
  これらのページは index.html のデザインアップデートと同期されているか不明。
- **acceptance**: 
  - about.html, contact.html を確認し、ヘッダー/フッター/フォントが index.html と統一されているか確認
  - 差異があれば修正してコミット
- **resolved_by**: PR #30 `claude/issue-007-design-sync`
  - about.html: preconnect / Apple meta / nav active color / nav links 統一
  - contact.html: OG tags / JSON-LD ContactPage / nav links 統一
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
| ISSUE-007 | about/contact.html デザイン未同期 | P2 | done |
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

### [ISSUE-038] 「今日の話題店」TOP5 日次ピックアップ機構 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-05-06
- **description**:
  既存「🔥 今週の話題店」セクションを「📰 今日の話題店」枠として作り替え、
  毎朝5:30 JSTに5店を自動選出。**Google評価は使わず**、「鮮度」と「多媒体露出」だけで選定。
  - スコア: 鮮度50点 + 多媒体露出35点 + 編集部推薦10点 + 既存話題スコア5点 - 連日ペナ15点
  - 候補プール: trending_stores.json + manual_stores.json（話題フラグ true & 期限内）
  - 過去7日のピック履歴を `data/daily_trending5.json` に保持し連日ペナルティに使用
  - UI: 各カードに鮮度バッジ「⏱ 3日前」と媒体数バッジ「📚 4媒体」を表示
- **files**: `scripts/pick_daily_trending5.js`(新規), `data/daily_trending5.json`(新規),
  `build.js`(L905周辺・L1100周辺結線), `index.html`(L1090セクション + buildTrendRanking 全面置換),
  `.github/workflows/daily-trending5.yml`(新規), `agents/data-keeper.md`, `agents/editor.md`
- **次サイクル宿題**:
  - サザンクラウン（栄）の Nagoya 実体が LOCAL_STORES に無くマッチ失敗中。Editor が Hot Pepper等で正しい栄店データを補完
  - `出典URL[]` が空配列の店が多く、媒体数スコアが「トレンド情報源[]」依存。`fetch_trending_articles.js` の自動反映強化（別ISSUE）

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
| 2026-05-07 | Orchestrator(/solve-next) | ISSUE-027 競合認識フレームを6カテゴリ制に更新（CLAUDE.md / orchestrator.md / 4分類施策判断追加） | ✅ デプロイ済み |

---

## Inspector 2026-04-23 監査で検出された新課題

### [ISSUE-022] journal/feed.xml lastBuildDate が固定値 ❌ 誤検出
- **priority**: P2 → **status**: wont_fix
- **resolved**: 2026-04-23（誤検出として却下）
- **description**: 確認の結果、`scripts/build_journal_index.js` で既に `new Date().toUTCString()` を動的注入していた。

### [ISSUE-023] trending_stores.json 有効期限チェック未実装 ❌ 誤検出
- **priority**: P2 → **status**: wont_fix
- **resolved**: 2026-04-23（誤検出として却下）
- **description**: `build.js` に既に有効期限チェックが実装済み（trending/manual/pending すべて）。

### [ISSUE-024] stores/*.html の og:image がホットペッパー固定
- **priority**: P3 → **status**: ready
- **category**: SEO・OGP
- **detected**: 2026-04-23
- **description**: stores/ 1095店舗の og:image が全て `https://imgfp.hotp.jp/IMGH/...`。SNS シェア時の visuals が単調で差別化にならない。Hot Pepper 画像のホットリンクは規約違反リスクもあり。
- **fix**: ジャンル別・エリア別のデフォルト OG画像（自家製）を用意し、写真URL未設定店はこれをフォールバック

### [ISSUE-025] stores/ ページの meta description が過少 ✅
- **priority**: P3 → **status**: done (2026-04-24)
- **category**: SEO
- **detected**: 2026-04-23
- **resolution**: `gen-store-pages.js` の `buildDescription()` を刷新。`scripts/patch_store_descriptions.js` で 714 件を一括パッチ。変更前: 平均 ~60 字 → 変更後: 100-119 字（おすすめポイント + エリア/ジャンル/価格 + Google評価 + タグ + CTA）。
- **files**: `gen-store-pages.js`, `scripts/patch_store_descriptions.js`, `stores/*.html` (714件)

### [ISSUE-026] journal feed が RSS2.0 のみで Atom 1.0 なし
- **priority**: P3 → **status**: done (2026-04-23)
- **category**: 標準準拠
- **detected**: 2026-04-23
- **resolution**: `scripts/build_journal_index.js` に `buildAtomFeed()` 追加、`journal/feed.atom` を並行生成。`journal/index.html` に `<link rel="alternate" type="application/atom+xml">` を追加。
- **files**: `scripts/build_journal_index.js`, `journal/index.html`, `journal/feed.atom`

---

## Inspector 2026-04-18 監査で検出された新課題

### [ISSUE-021] features/ インデックスページに季節特集3本が未登録 ✅
- **priority**: P1 → **status**: done
- **category**: seo / ux
- **resolved**: 2026-04-22
- **description**:
  トップ [index.html](index.html) の feature-strip には GW 2026・母の日・春テラスの季節特集が掲載済みだったが、
  [features/index.html](features/index.html)（特集一覧ページ）の article-grid と JSON-LD ItemList には未登録で、
  特集一覧ページから季節コンテンツに辿り着けない機会損失が発生していた。
- **fix**:
  - 季節3カードを article-grid の先頭に追加（金のシーズンバッジ付き、`is-season` クラスで強調）
  - JSON-LD ItemList を 6 → 12 件に拡張（GW・母の日・春テラス・編集規約・名駅・栄を追加）
  - CTA 文言の古い「全1095店舗」表記を修正
- **files**: `features/index.html`

### [ISSUE-014] GW/春の季節特集コンテンツがゼロ ✅
- **priority**: P1 → **status**: done
- **category**: content
- **resolved**: 2026-04-22（先行公開＋ISSUE-021 で features/ 一覧登録完了）
- **description**:
  `features/gw-2026.html`・`features/spring-terrace.html`・`features/mothers-day.html` の3本を公開済み。
  トップの feature-strip 先頭に配置済み。ISSUE-021 で features/ 一覧にも登録。
- **files**: `features/gw-2026.html`, `features/spring-terrace.html`, `features/mothers-day.html`, `index.html`, `features/index.html`, `sitemap.xml`

### [ISSUE-015] index.html が 7.2MB で巨大 — パフォーマンス劣化 🔴
- **priority**: P1 → **status**: in_progress（設計完了・段階実装へ）
- **category**: performance
- **detected**: 2026-04-18 / **designed**: 2026-04-22
- **description**:
  4586件の LOCAL_STORES (4.85MB) を inline 埋め込みしている結果、ファイルサイズが 7.2MB。
  TTFB遅延・LCP 劣化・モバイル離脱要因。
- **impact**: Core Web Vitals 劣化、Lighthouse スコア低下、SEO順位への悪影響
- **design_doc**: `docs/issue-015-design.md`（3段階の段階実装計画）
- **key_insight**: 計測の結果、`TikTok検索`・`X検索`・`Instagram検索` の3フィールド (2.19MB) は
  レンダー時に常に `tiktokSearchUrl(r)` 等で再計算されており、焼き付けデータは**完全に未使用**。
  加えて sanitizeStore で強制クリアされる5フィールドも空のまま出力されている。
  → コード無修正でも build.js のシリアライズ最適化だけで **2.5〜2.7MB 削減 (36〜37%減)** 可能。
- **phases**:
  - [ISSUE-015-P1] build.js の出力スリム化（低リスク）→ 4.5MB へ
  - [ISSUE-015-P2] 外部JSON化 + TOP50 インライン（中リスク）→ 800KB 以下へ
  - [ISSUE-015-P3] ジャンル別チャンク化（P3、機会あれば）

### [ISSUE-015-P1] build.js の LOCAL_STORES 出力スリム化 🟢
- **priority**: P1 → **status**: done
- **category**: performance
- **detected**: 2026-04-22
- **description**:
  未使用の検索URL3種と空フィールドを LOCAL_STORES 出力から除去する。
  index.html のコードは一切変更しない（渡ってこない値は既に `|| ''` 分岐で扱えている）。
- **strip fields**:
  - `TikTok検索` / `X検索` / `Instagram検索`（render 時に再計算される未使用URL）
  - `Instagram投稿URL` / `内観写真URL` / `料理写真URL1` / `料理写真URL2`（sanitizeで全件空）
  - `公開フラグ`（build 時に FALSE 除外済み）
  - 空文字列 (`""`) フィールド
- **acceptance**:
  - index.html サイズ < 5MB（目標 4.5MB）
  - 店舗数・フィルタ・モーダル・全外部リンク・JSON-LD が回帰なし
  - Lighthouse Performance が +5pt 以上
- **files**: `build.js`

### [ISSUE-015-P2] 外部JSON化 + TOP50 インライン方式 🟡
- **priority**: P1 → **status**: blocked（P1完了＆観察後に着手）
- **category**: performance
- **detected**: 2026-04-22
- **description**:
  Phase 1 デプロイ後 1週間 GA4 で UU / LCP / 直帰率を観察してから着手。
  `data/stores.json` を新設、index.html には TOP50 のみインラインし、残りは fetch で遅延読み込み。
  詳細は `docs/issue-015-design.md` 参照。
- **acceptance**: 初期 HTML < 800KB、全機能の動作維持、Lighthouse Performance > 75 (mobile)
- **files**: `build.js`, `index.html`, `data/stores.json`（新規）

### [ISSUE-016] sitemap.xml に特集ページが未登録 ✅
- **priority**: P2 → **status**: done
- **category**: seo
- **resolved**: 2026-04-22
- **description**:
  検証の結果、build.js には features/・journal/・stores/ の自動列挙ロジックが既に実装済み。
  現状 sitemap.xml には 1,115 URL 登録（features:13 / journal:3 / stores:1,095 / 静的:4）。
  ビルド毎に lastmod と URL リストが再生成される。
- **files**: `build.js:947-1017`, `sitemap.xml`

### [ISSUE-017] Google評価 84% 空白・推薦文 84% 空白 🟡
- **priority**: P1 → **status**: partial
- **category**: data
- **resolved**: 2026-04-18（Phase 1 完了）
- **Phase 1 完了内容**:
  - 実態調査の結果、ユーザーが最初に目にする TOP 50（デフォルトソート）の空白は **話題店7件に限定** されていた
  - `data/trending_stores.json` に「おすすめポイント」フィールドを追加 + 7店のハンドキュレーション推薦文
  - `build.js` の merge loop を拡張し、空白時のみ推薦文を補完（既存データ上書きはしない）
  - **結果**: TOP50 の NoPoint 14%→**0%**、TOP200 も 3.5%→**0%**
- **残課題**:
  - 全体 84% 空白（非ユーザー可視の低トレンド店中心）は未対応
  - Google評価は手入力せず空欄維持（捏造回避、後日 Google Places API で別フェーズ予定）
- **files**: `data/trending_stores.json`, `build.js`

### [ISSUE-018] モーダルの店舗画像 alt が空（a11y違反）✅
- **priority**: P2 → **status**: done
- **category**: a11y
- **resolved**: 2026-04-18
- **description**:
  `<img id="mi" src="" alt="">` が動的に店名を alt にセットされず空のまま。
- **fix**: openM() で `miEl.alt = 店名 + ' - ' + ジャンル + 'の写真'` を動的にセット

### [ISSUE-019] 特集ページの og:image が全て icon-512.png で統一 ✅
- **priority**: P3 → **status**: done
- **category**: seo
- **resolved**: 2026-04-18
- **fix**: 全11特集ページに独自の og:image（各特集の代表店写真）を設定。7ユニーク画像でカバー。

### [ISSUE-020] title が98文字で長すぎる（SERP切れ）✅
- **priority**: P3 → **status**: done
- **category**: seo
- **resolved**: 2026-04-18
- **fix**: 全特集ページのタイトルを50-75文字に短縮（【2025年版】・現役経営者監修を削除）

---

## 日次ジャーナル運用（CTN-DAILY-*）

NAGOYA BITES の毎日更新パイプライン。`/journal-today` スラッシュコマンドで起動、
Editor が記事＋SNS原稿を生成 → ユーザー承認 → git push → Note/Instagram/X へ手動コピペ投稿。
コストゼロ運用（Claude API 有料プラン不要、SNS API 不要）。

### [CTN-DAILY-001] journal/ 基盤構築 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-20
- **owner**: Builder
- **deliverables**: journal/_template.html / journal/index.html / journal/feed.xml 生成基盤

### [CTN-DAILY-002] data/ 初期JSONファイル群 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-20
- **owner**: DataKeeper
- **deliverables**: journal_queue.json / editorial_column_backlog.json(50本ストック) /
  journal_published.json / pending_stores.json / hashtag_pool.json / seasonal_events.json

### [CTN-DAILY-003] 日次運用スクリプト群 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-20
- **owner**: Builder + DataKeeper
- **deliverables**: pick_daily_topic.js / generate_daily_draft.js / validate_journal_draft.js /
  build_journal_index.js / merge_pending_stores.js / audit_journal.js

### [CTN-DAILY-004] docs/daily-posts/ テンプレ＋README ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-20
- **owner**: Marketer
- **deliverables**: _template.md(Note/IG/X 3原稿) + README.md(手動運用手順、10,000フォロワー戦略)

### [CTN-DAILY-005] /journal-today スラッシュコマンド ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-20
- **owner**: Orchestrator
- **deliverables**: .claude/commands/journal-today.md(11ステップ実行フロー)

### [CTN-DAILY-006] build.js 拡張 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-20
- **owner**: Builder
- **deliverables**: pending_stores.json のマージ処理 / sitemap.xml に journal/ 追加

### [CTN-DAILY-007] index.html に Journal 動線追加 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-20
- **owner**: Builder
- **deliverables**: ナビに Journal リンク / トップに最新3件セクション(LATEST_JOURNAL マーカー)

### [CTN-DAILY-008] agents/editor.md 日次運用章 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-20
- **owner**: Editor
- **deliverables**: テーマローテ表 / 独自性3要件 / 新規店舗追加フロー / 匿名運営徹底

### [CTN-DAILY-009] 初週7日分の人間下書き
- **priority**: P1 → **status**: done
- **detected**: 2026-04-20
- **owner**: Editor (人間運営側)
- **description**: Editor の few-shot 学習素材として、初週7日分(2026-04-21〜04-27)の
  記事を人間が手で下書き。以後の AI ドラフト品質を底上げ
- **blocks**: 本番運用開始を7日遅らせてでも実施する価値あり

### [CTN-DAILY-010] 連続7日の運用検証
- **priority**: P1 → **status**: done
- **detected**: 2026-04-20
- **owner**: Orchestrator
- **description**: `/journal-today` → validator PASS → push → SNS投稿 を7日連続できるか検証
- **完了条件**: 7日連続で journal_published.json に entry 追加、SNS3媒体に投稿完了

### [CTN-DAILY-011] 月次監査パイプライン統合
- **priority**: P2 → **status**: done
- **detected**: 2026-04-20
- **owner**: DataKeeper
- **description**: `.github/workflows/weekly-pipeline.yml` に `scripts/audit_journal.js` と
  `scripts/merge_pending_stores.js` のドライラン実行を月曜に追加。閉店店舗検出時は
  該当journal記事末尾に脚注を自動追記
- **注意**: LLM は呼ばない(コストゼロ維持)。純ロジックのみ

---

## 2026-04-22 夜間バッチ実行ログ（tonight-batch）

### [BATCH-001] Restaurant JSON-LD モーダル動的注入 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-22
- **owner**: Builder
- **description**: `index.html` の `openM()` 関数内に36行の IIFE を追加。モーダル開閉時に `<script id="modal-store-jsonld" type="application/ld+json">` を動的生成・置換。@type Restaurant, name, servesCuisine, priceRange, address, url, aggregateRating（Google評価）を含む。リッチリザルト獲得でCTR +30% を狙う。
- **files**: `index.html`

### [BATCH-002] GitHub Actions 日次ジャーナル自動化 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-22
- **owner**: Builder + Orchestrator
- **description**: `.github/workflows/daily-journal.yml` を新設。毎日22:00 UTC (翌朝7:00 JST) に自動実行。`journal/YYYY-MM-DD-*.html` の存在チェックで重複防止。`/journal-today` スラッシュコマンドのプロンプトを `claude --print` で実行。生成ファイルをコミット&プッシュ。ローカルRoutine(9:00 JST)と併用でフェイルセーフ構成。
- **files**: `.github/workflows/daily-journal.yml`

### [BATCH-003] ISSUE-015-P1 build.js 出力スリム化 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-22
- **owner**: Builder
- **description**: `slimStoreForOutput()` 関数を build.js に追加。TikTok検索/X検索/Instagram検索（2.19MB）＋ sanitize空フィールド8種 + 公開フラグを出力から除去。index.html 7.14MB → 0.90MB（87.3%削減）。index.html の render コードは一切変更なし（未使用フィールドは既に `|| ''` 分岐で扱える）。
- **files**: `build.js`, `index.html`（再ビルド）

### [BATCH-004] ISSUE-007 about/contact デザイン統一 ✅
- **priority**: P2 → **status**: done
- **resolved**: 2026-04-22（前回バッチ）
- **files**: `about.html`, `contact.html`

### [BATCH-005] Day3 ジャーナル公開 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-23
- **owner**: Editor
- **description**: `journal/2026-04-23-small-seats-famous-restaurants.html` 公開。テーマ「カウンター6席、テーブル2卓」が名物店に多い理由（業界の裏側コラム・COL-SEAT-001）。BlogPosting + BreadcrumbList JSON-LD。journal/index.html, sitemap.xml 更新済み。

### [BATCH-007] 業界人レビュー投稿フォーム（Formspree）✅
- **priority**: P2 → **status**: done
- **resolved**: 2026-04-24
- **owner**: Builder
- **description**: モーダル内に業界人向け投稿フォームを実装。GitHub Issue Form を廃止し、Formspree（contact.html と同一エンドポイント）経由でメール受信 → 編集部モデレーション → insider_reviews.json 追記 → ビルド → 公開のフローを確立。フォームトグル・バリデーション・送信中 UI・成功/エラーメッセージ実装。
- **files**: `index.html`, `data/insider_reviews.json`, `.github/ISSUE_TEMPLATE/insider-review.yml`（削除）

### [BATCH-008] ISSUE-025 meta description 拡張 ✅
- **priority**: P3 → **status**: done
- **resolved**: 2026-04-24
- **owner**: Builder
- **description**: `gen-store-pages.js` の `buildDescription()` 刷新 + `scripts/patch_store_descriptions.js` で 714 件の stores/*.html を一括パッチ。~60字 → 100-119字。おすすめポイント＋エリア/ジャンル/価格帯＋Google評価＋タグ＋CTA。
- **files**: `gen-store-pages.js`, `scripts/patch_store_descriptions.js`, `stores/*.html` (714件)

### [BATCH-006] ロングテール特集3本公開 ✅
- **priority**: P1 → **status**: done
- **resolved**: 2026-04-23
- **owner**: Editor
- **description**: P1計画の「ロングテールLP3本新設」を実施。
  1. `features/nagoya-lunch-washoku.html`（名古屋ランチ和食おすすめ10選 / 10店 / Google評価4.4以上）
  2. `features/birthday-surprise.html`（名古屋誕生日サプライズ10選 / 10店 / Google評価4.6〜5.0）
  3. `features/osu-food-walk.html`（大須食べ歩き10選 / 10店 / コースプランつき）
  各記事: Article + ItemList + BreadcrumbList + FAQPage JSON-LD, 内部リンク, related-links。
  features/index.html に3カード追加（numberOfItems 12→15）。sitemap.xml に4URL追加。
- **files**: `features/nagoya-lunch-washoku.html`（新規）, `features/birthday-surprise.html`（新規）, `features/osu-food-walk.html`（新規）, `features/index.html`, `journal/index.html`, `sitemap.xml`

---

## 競合分析（2026-05-06）から追加された課題

> 出典: `docs/competitive-analysis-2026-05-06.md`
> 6カテゴリ × 6軸の全方位ベンチマークを実施し、消費者の選択経路（大手ポータル・マップ系・地域メディア・SNS・個人ブログ・生成AI）と比較。
> 4分類（Catch-up / Strategic Skip / Moat / Quality Gap）に整理し、以下の課題を抽出。

### [ISSUE-027] CLAUDE.md / orchestrator.md の競合認識フレームを6カテゴリ制に更新 ✅

- **priority**: P1 → **status**: done
- **category**: competitive / brand
- **detected**: 2026-05-06
- **resolved**: 2026-05-07
- **resolved_by**: /solve-next（Orchestrator）
- **description**:
  CLAUDE.md と agents/orchestrator.md は競合を「タベログ・ホットペッパー・Retty・Google Maps」の4社に限定していたが、実際の消費者選択経路はSNS（ナゴレコIG 20万・ナゴグルTikTok 10万超）、地域メディア（ナゴレコ・大人の名古屋・名古屋情報通3,522記事）、生成AI引用まで広がっている。フレーム自体を6カテゴリ制に更新し、戦わない領域（匿名口コミ・クーポン経済・高級セグメント・女性向け装飾）も明示。
- **resolution**:
  - CLAUDE.md「競争優位」を 6カテゴリ制に書き換え。Moat 5項目・Strategic Skip 6項目を明記
  - agents/orchestrator.md 経営哲学 Q2 を 6カテゴリ参照に更新
  - 「競合の弱点」セクションを 6カテゴリ × 主要プレイヤー網羅に拡張（食べログ/ホットペッパー/Retty/ヒトサラ/一休/ぐるなび/OZmall/まとめ系/Maps/ナゴレコ/大人の名古屋/名古屋情報通/SNS/個人ブログ/生成AI）
  - 「4分類で施策を判断する」セクション新設（Catch-up / Strategic Skip / Moat / Quality Gap）
- **files**: `CLAUDE.md`, `agents/orchestrator.md`
- **owner**: Orchestrator
- **ref**: `docs/competitive-analysis-2026-05-06.md` 第 6章

### [ISSUE-028] SNS 公式アカウント（Instagram / X）の開設と日次連動運用

- **priority**: P1
- **status**: ready（要ユーザー判断）
- **category**: competitive / marketing
- **detected**: 2026-05-06
- **description**:
  消費者の発見導線の半分以上が SNS に移行している中、NAGOYA BITES の SNS は事実上ゼロ。ナゴレコ IG 20万、名古屋情報通 X、ナゴグル TikTok 10万超に対して、我々はジャーナル日次更新という素材があるのに外に出していない。Instagram と X 公式アカウントを開設し、`docs/daily-posts/` の既存原稿を日次クロスポストする運用を立ち上げる。TikTok は次フェーズ。
- **impact**: 月間 UU 1.5〜3倍ポテンシャル、指名検索数の継続的増加、AI 引用候補化の前提条件
- **acceptance**: IG / X アカウント開設、運用テンプレート（投稿時刻・ハッシュタグ規則・スポンサー受理 NG ルール）整備、初回 30投稿の制作完了
- **files**: 新規運用（コード変更なし）。`docs/sns-playbook.md` を新規作成検討
- **owner**: Marketer 主導 + Editor 連携
- **blocker**: アカウント名・運用方針はユーザー承認が必要
- **ref**: `docs/competitive-analysis-2026-05-06.md` 推奨アクション #1

### [ISSUE-029] editor_picks を 5店 → 100店規模に段階拡充

- **priority**: P1
- **status**: ready
- **category**: competitive / data / editorial
- **detected**: 2026-05-06
- **description**:
  業界視点（editorReason / mediaFeatures / insiderNote / visitStatus）は他競合 30+ サイトを調査した中で唯一無二の Moat だが、現在 5店止まりで「製品として薄い」状態。100店あれば「どのジャンルでも業界人推薦が見つかる」体感が出て、Moat が初めて消費者に届く。EDT-002 のフォローアップ。
- **impact**: モーダル開封時の体感価値の劇的向上。editorial-policy の proof としての説得力。
- **acceptance**: `data/editor_picks.json` を 100店規模に拡充（6月末50店・9月末100店の段階目標）。各エントリは editorReason 60〜120字 + mediaFeatures + insiderNote 必須
- **files**: `data/editor_picks.json`, `build.js` の処理確認
- **owner**: Editor 主導 + DataKeeper 連携

### [ISSUE-030] 「業界人視点」コンテンツの SNS 用ショートフォーマット化

- **priority**: P1
- **status**: ready
- **category**: competitive / content / marketing
- **detected**: 2026-05-06
- **description**:
  ナゴレコ・名古屋情報通の SNS は「店舗紹介」止まり。我々は insiderNote / editorReason という他にない解釈層があるので、「なぜこの店は予約困難なのか」「業界人だけが知る◯◯の見極め」型のショートフォーマット（Instagram 9:16・X 画像+140字）でテンプレ化する。コンテンツ × チャネルの掛け算で SNS と Moat を同時に活かす。
- **impact**: SNS フォロワー獲得 + ブランド認知 + AI Overviews 引用候補化の同時達成
- **acceptance**: テンプレ設計書 + 初回 30投稿の制作完了。ISSUE-028 と並走
- **files**: `docs/sns-content-template.md`（新規）
- **owner**: Editor + Marketer

### [ISSUE-031] ロングテール独自 KW での SEO 1位獲得戦略

- **priority**: P1
- **status**: ready
- **category**: competitive / seo
- **detected**: 2026-05-06
- **description**:
  「名古屋 居酒屋」「名古屋 個室」など競合過密 KW（食べログ・ホットペッパー・ヒトサラ・OZmall・くふうトリップが TOP10 占有）は追わず、「名古屋 業界人 推薦」「名古屋 飲食人 おすすめ」「名古屋 予約困難 理由」「名駅 接待 失敗しない」など我々しか書けない KW で 1位を取りに行く。既存特集 20本の URL/タイトル/見出しを再設計し、新規ロングテール特集 5本を追加。
- **impact**: 中期で月間 UU 1.5〜2倍。AI 引用元としての権威性向上。
- **acceptance**: 6ヶ月で独自 KW 5本以上で Google TOP3、Search Console で順位追跡
- **files**: `features/*.html`（既存リライト）, `features/index.html`, `sitemap.xml`
- **owner**: Marketer + Editor

### [ISSUE-032] editorial-policy の対外発信と Google Search Console 整備

- **priority**: P2
- **status**: ready
- **category**: competitive / seo / brand
- **detected**: 2026-05-06
- **description**:
  WebSearch で `site:nagoya-bites.com` がゼロヒット → サイト全体のインデックス・サイトリンク獲得が不十分の可能性。editorial-policy.html を「現役飲食人による編集規約」としてプレスリリース・note・業界メディア寄稿で外部発信し、被リンク獲得 + Search Console で順位とサイトリンク表示を取りに行く。AI 引用と SEO の両輪を権威性で攻める。
- **impact**: AI Overviews 引用候補化、指名検索数の継続的増加、長期ドメインオーソリティ
- **acceptance**: 6ヶ月で外部被リンク 30本、指名検索月間 100回、Google Search Console のクエリレポート整備
- **files**: 外部施策中心（コード変更なし）。`docs/press-release-2026.md` 草稿
- **owner**: Strategist + Marketer

### [ISSUE-033] 推薦文カバー率 16% → 50% への引き上げ（D1 / Quality Gap）

- **priority**: P1
- **status**: ready（既存 ISSUE-017 の昇格・更新）
- **category**: competitive / data / content
- **detected**: 2026-05-06（再評価）
- **description**:
  ISSUE-017 で「推薦文 84% 空白」を P1 計上していたが、競合分析の結果、推薦文は食べログ口コミ・ナゴレコ記事と直接競合する Quality Gap として最重要級と再評価。`fill_recommendations.js` / `gen_recommendations_text.js` の生成ロジックを再点検し、優先度上位 1,000店から推薦文を埋めていく。
- **impact**: Moat（業界視点）の体感品質が劇的に向上。SEO ロングテール KW のヒット率向上。
- **acceptance**: 6ヶ月で推薦文カバー率 50% 以上
- **files**: `fill_recommendations.js`, `gen_recommendations_text.js`, `data/manual_stores.json`
- **owner**: DataKeeper 主導 + Editor 監修
- **note**: 既存 ISSUE-017 とマージ。本 ISSUE-033 を採用、ISSUE-017 は status:duplicate へ

### [ISSUE-034] 「2026年最新」型の鮮度シグナル強化（lastmod / pubDate / 年号）

- **priority**: P2
- **status**: ready
- **category**: competitive / seo / content
- **detected**: 2026-05-06
- **description**:
  「名古屋 グルメ おすすめ 2026」KW で TOP10 を tabemaro / kelly-net / jalan ニュース / くふうトリップが「2026年最新」型タイトルで占拠している。我々の特集記事のタイトルに「2026年版」を入れる、Article 構造化データの datePublished / dateModified を四半期ごとに更新する、sitemap.xml の lastmod を継続的に更新する仕組みを整備。
- **impact**: 鮮度 KW での順位上昇、Discover / News 系流入の獲得
- **acceptance**: 既存特集 20本のタイトルとメタを 2026年版に更新、sitemap.xml lastmod の自動更新スクリプト整備
- **files**: `features/*.html`, `sitemap.xml`, `build.js`
- **owner**: Marketer + Builder

### [ISSUE-035] シーン分類の細粒度化（推し活 / ママ会 / 撮影会 / オフ会など）

- **priority**: P2
- **status**: ready
- **category**: competitive / ux / content
- **detected**: 2026-05-06
- **description**:
  OZmall は「女子会／推し活／ママ会」、ホットペッパーは「カップルシート」「大人の隠れ家」など細粒度シーン分類を持つ。我々のシーンは「デート／女子会／接待／誕生日／GW／母の日」止まり。「推し活」「オフ会」「同窓会」「両家顔合わせ」「壮行会」など名古屋の生活シーンに合うタグを 5〜10個追加。既存 LOCAL_STORES のタグ層に追加するか、特集記事として新設するかは Builder と Editor で判断。
- **impact**: ロングテール検索流入の獲得、フィルター粒度の差別化
- **acceptance**: シーンタグ 5〜10個追加、または対応する特集記事を 3本以上新設
- **files**: `index.html`（フィルター層）, `data/manual_stores.json`（タグ追加）, `features/*.html`（新規）
- **owner**: Builder + Editor

### [ISSUE-036] og:image の店舗個別自家製化（既存 ISSUE-024 の昇格）

- **priority**: P2
- **status**: ready（既存 ISSUE-024 の優先度引き上げ）
- **category**: competitive / seo / brand
- **detected**: 2026-05-06（再評価）
- **description**:
  競合分析で SNS シェア時の「映え」設計が D3 Quality Gap として浮上。stores/*.html の og:image がホットペッパー画像固定では、SNS シェア時にホットペッパーのブランドが拡散される。NAGOYA BITES オリジナルの店舗個別 og:image を生成（店名 + 業界人推薦バッジ + 価格帯ラベル等の合成）。1,096店すべてのスケールに対応する自動生成スクリプト要。
- **impact**: SNS シェア時のブランド一貫性、SNS 経由のサイト流入の質向上
- **acceptance**: og:image 生成スクリプト整備、1,096店すべてに自家製画像配信
- **files**: `assets/og/*`（新規生成）, `gen-store-pages.js`, `stores/*.html`
- **owner**: Builder + DataKeeper
- **note**: 既存 ISSUE-024（P3）から P2 に昇格。本 ISSUE-036 が後継

### [ISSUE-037] 戦わない領域（Strategic Skip）の明文化と過剰追従の防止

- **priority**: P3
- **status**: ready
- **category**: competitive / governance
- **detected**: 2026-05-06
- **description**:
  競合分析で「追わない判断」を 6項目特定（匿名口コミ大量集積 / クーポン経済 / 高級セグメント特化 / 女性向け装飾演出 / 雑誌印刷連動 / 月刊スピード）。今後 Marketer や Editor が個別施策を提案する際に、これらの領域に過剰追従しないよう、CLAUDE.md または `agents/strategist.md` に「戦わない領域」セクションを明記する。
- **impact**: 戦略の一貫性維持、リソース無駄遣いの防止
- **acceptance**: CLAUDE.md または agents/strategist.md に Strategic Skip 6項目を明記
- **files**: `CLAUDE.md`, `agents/strategist.md`
- **owner**: Strategist + Orchestrator
- **ref**: `docs/competitive-analysis-2026-05-06.md` 第 3章 B 節

---

## 組織運営課題（ORG-XXX）— 2026-05-06 検出

agent-backlog.md の実行ログが 2026-04-18 で停止し、Marketer / Strategist 部門の起票実績がゼロ、未完了タスクが15〜20日塩漬け、という組織運営上の構造課題を Orchestrator が検出。
連携の仕組みは整っているが「事業の方向性を考える層」と「集客する層」が稼働していないため、毎日サイトが進化しても事業ゴールへの到達が判定できていない。

### [ORG-001] CEO の実行ログ運用を再開する
- **priority**: P1 → **status**: ready
- **detected**: 2026-05-06
- **owner**: Orchestrator
- **category**: 組織
- **description**:
  agent-backlog.md の「エージェント実行ログ」表が 2026-04-18 で更新停止。
  実際には 5/4 (11件) / 5/5 (7件) / 5/6 (17件) のコミットがあるのに、議事録に1行も追記されていない。
  Orchestrator が orchestrator.md で自ら定めた報告フォーマットを守っていない状態。
- **acceptance**:
  - 4/19〜5/6 の活動を「エージェント実行ログ」表に1行ずつ追記する
  - Stop hook 経由で「ターン終了時に必ず実行ログを更新する」運用フローを orchestrator.md に明記
  - 以後は `/solve-next` 実行ごとに自動で実行ログ行を追加するロジックを solve-next コマンドに組み込む
- **files**: `agent-backlog.md`, `agents/orchestrator.md`, `.claude/commands/solve-next.md`

### [ORG-002] Strategist に月次 KPI スナップショット業務を持たせる
- **priority**: P1 → **status**: ready
- **detected**: 2026-05-06
- **owner**: Strategist
- **category**: 組織 / 戦略
- **description**:
  orchestrator.md で「月間UU」「CTAクリック率」が北極星指標と定義されているのに、
  agent-backlog.md には実測値の記録が一度も存在しない。「目標値あり・計測値なし」状態。
  Strategist の起票実績は 0件で、事実上稼働していない。
- **acceptance**:
  - 毎月1日に Strategist が `STR-MONTHLY-YYYY-MM` として KPI スナップショットを agent-backlog.md に追記する運用を agents/strategist.md に明記
  - 初回は 2026-05-01 時点のベースライン値を Google Analytics / Search Console から取得して記録
  - スナップショット項目: 月間UU / セッション / CTA クリック数 / 指名検索数 / 上位10キーワード順位 / 掲載店舗数 / 特集記事数
- **files**: `agents/strategist.md`, `agent-backlog.md`

### [ORG-003] Marketer に週次 SEO/SNS チェック業務を持たせる
- **priority**: P1 → **status**: ready
- **detected**: 2026-05-06
- **owner**: Marketer
- **category**: 組織 / マーケティング
- **description**:
  Marketer の起票実績は 0件。orchestrator.md で MARKETING モードと役割は定義済みだが、
  「いつ・何をきっかけに・何を起票するか」のトリガーが決まっていないため起動されない。
- **acceptance**:
  - 毎週月曜に Marketer が `MKT-WEEKLY-YYYY-WW` として「SEO順位 + SNSエンゲージメント + トラフィック流入元」のチェックレポートを agent-backlog.md に追記する運用を agents/marketer.md に明記
  - レポートで「順位下落」「エンゲージメント急落」「機会キーワード発見」があれば個別に `MKT-XXX` を起票
  - GitHub Actions の `weekly-pipeline.yml` にトリガーを組み込み、月曜のパイプラインで Marketer が必ず動く仕組みにする
- **files**: `agents/marketer.md`, `agent-backlog.md`, `.github/workflows/weekly-pipeline.yml`

### [ISSUE-039] /sync-backlog のアーカイブ処理を notion-move-pages ベースに刷新 ✅
- **priority**: P1 → **status**: done
- **category**: ops / notion
- **detected**: 2026-05-07
- **resolved**: 2026-05-07
- **resolved_by**: /solve-next フォローアップ（Orchestrator）
- **description**:
  ISSUE-027 を done にした際、`/sync-backlog` の Step 2 が「タイトルに ✅ を付けるだけ」で実際には Notion ダッシュボードからページを取り除けず、ユーザーから「ノーションから削除されてない」指摘を受けた。
  Notion DB のステータス select に `done` 選択肢が無いため、`update_properties` でステータス変更も不可（validation_error）。
- **resolution**:
  - 緊急対応: `notion-move-pages` で ISSUE-027 を親ページ（35826260-227a-81e5-95aa-f5d9fc4caa6c）へ移動 → ダッシュボードから消滅確認
  - 恒久対応: `.claude/commands/sync-backlog.md` Step 2 を `notion-move-pages` ベースに書き換え
  - `/solve-next` Step 10 のリファレンスも更新
- **files**: `.claude/commands/sync-backlog.md`, `.claude/commands/solve-next.md`, `agent-backlog.md`
- **owner**: Orchestrator

---

## Notion ダッシュボード連携

このバックログは [Notion DB「課題トラッカー」](#) に常時自動同期される。
詳細な運用ルールは [agents/orchestrator.md](agents/orchestrator.md) の「Notion ダッシュボード運用」章を参照。

- 同期スクリプト: [scripts/sync_backlog_to_notion.js](scripts/sync_backlog_to_notion.js)
- 1件ずつ解く: `/solve-next` スラッシュコマンド
- agent-backlog.md が**マスター**、Notion は確認用ダッシュボード
- `status: done` になった課題は Notion からアーカイブされて表示から消える
