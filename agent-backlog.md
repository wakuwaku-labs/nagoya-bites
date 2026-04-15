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

## エージェント実行ログ

| 日付 | エージェント | 実行内容 | 結果 |
|------|------------|---------|------|
| 2026-04-15 | Inspector | 初回サイト監査・バックログ初期化 | 9件の課題を検出 |
| 2026-04-15 | Orchestrator(FULL) | Hero修正・権威性バー・CTA修正・店舗別ページ1095件生成・sitemap 1→1097件・デプロイ | ✅ デプロイ済み (commit 3824014) |
| 2026-04-15 | Builder | ISSUE-001,002,003,004,009を実装（CSS修正）・sitemap 1100件 | ✅ デプロイ済み |
