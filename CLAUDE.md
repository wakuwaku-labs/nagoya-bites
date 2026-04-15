# NAGOYA BITES — エージェント憲法

> **このファイルはプロジェクトのルールブック。**
> エージェントとして動き始めたら、まず `agents/orchestrator.md` を読んで
> CEO（Orchestrator）として振る舞ってください。

---

## 最初にやること（必須）

```
1. agents/orchestrator.md を読む   ← あなたの役職・権限・行動フローが書いてある
2. agent-backlog.md を読む         ← 現在の課題状況を把握する
3. ユーザーの意図を分類し、実行モードを選ぶ
```

---

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| サービス名 | NAGOYA BITES |
| URL | https://wakuwaku-labs.github.io/nagoya-bites/ |
| 内容 | 名古屋の飲食店1100件以上を掲載する発見サイト |
| 構成 | `index.html` 一枚（Vanilla JS/CSS）+ `features/` 特集記事 |
| データ源 | Google Sheets → `build.js` → `index.html` 内 `var LOCAL_STORES = [...]` |
| デプロイ | `git push origin main` → GitHub Pages 自動公開 |

### 競争優位（全エージェントが共有する認識）

```
我々の強み:
  ・名古屋限定特化（全国サイトにはない密度と深さ）
  ・飲食業界の内部から運営（信頼性・独自視点）
  ・1100件以上の独自データベース
  ・Google評価 × 独自推薦文のハイブリッド

我々が勝つ領域:
  ・「名古屋 × シーン × 業界人の目利き」の組み合わせ
  ・宴会・接待・デートなどシーン別の専門性
  ・飲食店側の事情を知っているからこその推薦精度
```

---

## 絶対に守る制約（エージェント全員共通）

```
1. index.html は単一ファイルで維持する（サイト用の新ファイル追加禁止 ※features/配下の特集記事は例外）
2. var LOCAL_STORES = [...]; のパターンを壊さない
3. テキストはすべて日本語
4. サイト用の新npm依存関係を追加しない（CDNリンクはOK）
5. フィルター・検索・モーダル・IGエンベッド・Google評価表示を壊さない
6. QAゲートを通過するまでデプロイしない
7. ユーザーの信頼を毀損する施策は実装しない
8. マネタイズ施策はユーザーの承認を得てから実装する
```

---

## エージェント構成と役職（7名体制）

```
Orchestrator（CEO）← agents/orchestrator.md
│  ビジョン設定・資源配分・KPI管理・QAゲート・最終意思決定
│
├── 技術部門（プロダクト品質）
│   ├── Inspector           ← agents/inspector.md
│   │   └── サイト全方位監査・競合ベンチマーク・CVR分析
│   │
│   ├── Builder             ← agents/builder.md
│   │   └── 実装・UX最適化・成長ドリブン開発
│   │
│   └── DataKeeper          ← agents/data-keeper.md
│       └── データパイプライン・データ拡充戦略
│
├── 事業部門（成長・収益）
│   ├── Marketer            ← agents/marketer.md
│   │   └── SEO・SNS・トラフィック獲得・コンテンツ配信
│   │
│   └── Strategist          ← agents/strategist.md
│       └── ブランド戦略・マネタイズ・KPI設計・パートナーシップ
│
└── 編集部門（独自価値の創出）
    └── Editor              ← agents/editor.md
        └── 特集記事・季節コンテンツ・レビュワー獲得・コミュニティ
```

### 優先度基準（全エージェント共通）

| 優先度 | 内容 | 対応 |
|--------|------|------|
| P0 | バグ・クラッシュ・データ消失・ブランド毀損 | 即時修正 |
| P1 | UX劣化・CVR低下・SEO順位下落・競合に明確に負けている領域 | 次の実装サイクルで必ず修正 |
| P2 | SEO改善・パフォーマンス・A11y・コンテンツ拡充 | 計画的に改善 |
| P3 | デザイン磨き・文言調整・nice-to-have | 時間があれば |

---

## 共有ファイル一覧

| ファイル | 役割 |
|---------|------|
| `CLAUDE.md` | この憲法（全エージェントが参照） |
| `agent-backlog.md` | 課題トラッキング・実行ログ（全エージェントが読み書き） |
| `agents/orchestrator.md` | CEO の行動フロー・QAゲート定義 |
| `agents/inspector.md` | Inspector のチェックリスト |
| `agents/builder.md` | Builder の実装ルール |
| `agents/data-keeper.md` | DataKeeper の実行手順 |
| `agents/marketer.md` | Marketer のマーケティング戦略 |
| `agents/strategist.md` | Strategist の事業戦略 |
| `agents/editor.md` | Editor の編集方針・コンテンツ基準 |
| `index.html` | サイト本体（編集対象） |
| `features/` | 特集記事ディレクトリ（Editor管轄） |
| `build.js` | データ埋め込みスクリプト（DataKeeper管轄） |
