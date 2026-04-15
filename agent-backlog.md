# NAGOYA BITES — Agent Backlog

> このファイルはエージェントが自律的に管理する課題トラッキングファイル。
> 手動での編集可能だが、エージェントが自動で追記・更新する。
> フォーマット: `status` は `ready` / `in_progress` / `done` / `wont_fix`

---

## 進行中・完了タスク

_（Builder が実装済みのものはここに移動する）_

---

## 未着手タスク（ready）

### [ISSUE-001] ヒーローセクションがモバイルで依然として縦長すぎる

- **priority**: P1
- **status**: ready
- **category**: visual / ux
- **detected**: 2026-04-15
- **description**: 
  現在 `min-height:55vh`（768px以下）。375pxのiPhoneでも約400px以上ヒーローが占有し、
  カードが見えるまでのスクロール量が多い。スティッキー検索が表示されるまでに
  スクロールが必要で初回UXが悪い。
- **acceptance**: 
  - モバイルでページロード直後にカードが1〜2件見えるか、またはヒーローが圧縮されている
  - min-height を `auto` または `40vh` 以下に変更
  - デスクトップは現状維持
- **files**: `index.html` (`@media(max-width:768px)` の `.hero`)

---

### [ISSUE-002] filter-panel の max-height が固定値でコンテンツが切れる可能性

- **priority**: P2
- **status**: ready
- **category**: ux
- **detected**: 2026-04-15
- **description**: 
  `.filter-panel.open { max-height:600px }` と固定値になっている。
  将来的にタグ・ジャンルが増えた場合や、画面回転時にコンテンツが600px超になると
  フィルターの一部が見えなくなる。
- **acceptance**: 
  - `max-height` を `none` または十分大きな値（1200px）に変更
  - アニメーションが維持されること
- **files**: `index.html` (`.filter-panel.open`)

---

### [ISSUE-003] モーダルの `.mcl` クローズボタンCSS が2箇所に重複定義

- **priority**: P3
- **status**: ready
- **category**: visual
- **detected**: 2026-04-15
- **description**: 
  `.mcl` スタイルが `line 184`（32px定義）と `line 312`（44px定義）の2箇所に存在。
  後の定義が有効なので現状は44pxが適用されているが、コードの可読性が低く
  将来の修正時に混乱を招く。
- **acceptance**: 
  - 最初の `.mcl` 定義（line 184付近）を削除し、line 312 の定義のみ残す
  - クローズボタンが44x44pxで表示されること
- **files**: `index.html` (CSS内の `.mcl` 重複)

---

### [ISSUE-004] カードのモバイル向けパディング調整不足

- **priority**: P2
- **status**: ready  
- **category**: visual
- **detected**: 2026-04-15
- **description**:
  モバイルでの `.card-tags` と `.card-cta` に `padding: .4rem 1rem` がメディアクエリで
  設定されているが、カード自体は `padding:12px` の固定値。`.card-cta` のモバイルパディングが
  カードのベースパディングと合わず、左右マージンが二重になっている可能性。
  カードタグとCTAが他の要素と横位置がずれて見える。
- **acceptance**: 
  - 375pxでカード内すべての要素が揃った左右マージンで表示される
  - `.card-tags` と `.card-cta` のモバイルパディングをカードのbaseに合わせて修正
- **files**: `index.html` (`.card-tags`, `.card-cta` の `@media(max-width:768px)`)

---

### [ISSUE-005] 構造化データ（JSON-LD）が Organization のみで店舗情報が未対応

- **priority**: P2
- **status**: ready
- **category**: seo
- **detected**: 2026-04-15
- **description**:
  現在 `<script type="application/ld+json">` には `Organization` タイプのみ定義されている。
  `LocalBusiness` / `Restaurant` タイプの構造化データがないため、
  Google検索でリッチリザルト（星評価・営業時間）が表示されない。
  少なくともサイト全体を表す `WebSite` + `SearchAction` の構造化データを追加すれば
  Google検索でサイトリンク検索ボックスが表示される可能性がある。
- **acceptance**: 
  - `WebSite` + `SearchAction` の JSON-LD を追加
  - Google Rich Results Testで検証通過
- **files**: `index.html` (JSON-LD ブロック)

---

### [ISSUE-006] sitemap.xml の更新日確認

- **priority**: P2
- **status**: ready
- **category**: seo
- **detected**: 2026-04-15
- **description**:
  `sitemap.xml` の `<lastmod>` が最終デプロイ日から更新されていない可能性。
  データ更新（build.js実行）のたびに lastmod も自動更新されるべき。
- **acceptance**: 
  - `build.js` 実行後に sitemap.xml の lastmod が現在日付に自動更新される
  - または sitemap.xml を手動確認して必要なら更新
- **files**: `sitemap.xml`, `build.js`（オプション: 自動更新処理を追記）

---

### [ISSUE-007] about.html / contact.html のデザインがindex.htmlと未同期

- **priority**: P2
- **status**: ready
- **category**: visual
- **detected**: 2026-04-15
- **description**:
  git status で `about.html` と `contact.html` に未コミットの変更がある。
  これらのページは index.html のデザインアップデートと同期されているか不明。
  スタイルが古いままの可能性がある。
- **acceptance**: 
  - about.html, contact.html を確認し、ヘッダー/フッター/フォントが index.html と統一されているか確認
  - 差異があれば修正してコミット
- **files**: `about.html`, `contact.html`

---

### [ISSUE-008] カードCTAの「ホットペッパーで予約」がホットペッパーリンクなし店舗でも表示される

- **priority**: P1
- **status**: ready
- **category**: ux / content
- **detected**: 2026-04-15
- **description**:
  一部の店舗はホットペッパーのURLが登録されていない。
  その場合、CTAボタンのリンク先が空や無効になっている可能性がある。
  リンクがない店舗ではCTAボタンを非表示にするか、Googleマップリンクに差し替えるべき。
- **acceptance**: 
  - HP URLがない店舗ではCTAボタンを非表示にする
  - または代替としてGoogleマップリンクを表示する
- **files**: `index.html` (カードレンダリングJS部分)

---

### [ISSUE-009] Instagramエンベッドがモバイルでパフォーマンス問題を引き起こす可能性

- **priority**: P2
- **status**: ready
- **category**: performance
- **detected**: 2026-04-15
- **description**:
  モーダル内の photo-grid に3つのIGエンベッドiframeがある。
  モバイルでは768px以下で1カラムに変更されているが、3つのiframeが縦並びになり
  スクロール量が増えてUXが低下する可能性。
  また IntersectionObserver でのlazy loadが実装されているか確認が必要。
- **acceptance**: 
  - モバイルでは photo-grid を 1×3 から 1×2（最初の2枚のみ表示）に変更、または横並び2列
  - IntersectionObserver の実装を確認
- **files**: `index.html` (`.photo-grid @media(max-width:768px)`)

---

## バックログサマリー

| ID | タイトル | Priority | Status |
|----|---------|----------|--------|
| ISSUE-001 | ヒーローセクションがモバイルで縦長 | P1 | ready |
| ISSUE-002 | filter-panel max-height 固定値 | P2 | ready |
| ISSUE-003 | .mcl CSS重複 | P3 | ready |
| ISSUE-004 | カードモバイルパディング調整 | P2 | ready |
| ISSUE-005 | JSON-LD構造化データ未対応 | P2 | ready |
| ISSUE-006 | sitemap.xml 更新日確認 | P2 | ready |
| ISSUE-007 | about/contact.html デザイン未同期 | P2 | ready |
| ISSUE-008 | CTA ホットペッパーなし店舗対応 | P1 | ready |
| ISSUE-009 | IGエンベッド モバイルパフォーマンス | P2 | ready |

---

## エージェント実行ログ

| 日付 | エージェント | 実行内容 | 結果 |
|------|------------|---------|------|
| 2026-04-15 | Inspector | 初回サイト監査・バックログ初期化 | 9件の課題を検出 |
