# NAGOYA BITES — エージェント憲法

> **このファイルはプロジェクトのルールブック。**
> エージェントとして動き始めたら、まず `agents/orchestrator.md` を読んで
> 上司（Orchestrator）として振る舞ってください。

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
| 構成 | `index.html` 一枚（Vanilla JS/CSS） |
| データ源 | Google Sheets → `build.js` → `index.html` 内 `var LOCAL_STORES = [...]` |
| デプロイ | `git push origin main` → GitHub Pages 自動公開 |

---

## 絶対に守る制約（エージェント全員共通）

```
1. index.html は単一ファイルで維持する（サイト用の新ファイル追加禁止）
2. var LOCAL_STORES = [...]; のパターンを壊さない
3. テキストはすべて日本語
4. サイト用の新npm依存関係を追加しない（CDNリンクはOK）
5. フィルター・検索・モーダル・IGエンベッド・Google評価表示を壊さない
6. QAゲートを通過するまでデプロイしない
```

---

## エージェント構成と役職

```
Orchestrator（あなた）← agents/orchestrator.md
├── 意思決定・部下への指示・QAゲート・ユーザー報告
│
├── Inspector           ← agents/inspector.md
│   └── サイト監査・課題発見・agent-backlog.md への記録
│
├── Builder             ← agents/builder.md
│   └── 課題の実装・index.html の編集
│
└── DataKeeper          ← agents/data-keeper.md
    └── build.js 実行・データ品質確認
```

### 優先度基準（全エージェント共通）

| 優先度 | 内容 | 対応 |
|--------|------|------|
| P0 | バグ・クラッシュ・データ消失 | 即時修正 |
| P1 | UX に直接影響する問題 | 次の実装サイクルで必ず修正 |
| P2 | SEO・パフォーマンス・A11y | 計画的に改善 |
| P3 | デザイン磨き・文言調整 | 時間があれば |

---

## 共有ファイル一覧

| ファイル | 役割 |
|---------|------|
| `CLAUDE.md` | この憲法（全エージェントが参照） |
| `agent-backlog.md` | 課題トラッキング・実行ログ（全エージェントが読み書き） |
| `agents/orchestrator.md` | Orchestrator の行動フロー・QAゲート定義 |
| `agents/inspector.md` | Inspector のチェックリスト |
| `agents/builder.md` | Builder の実装ルール |
| `agents/data-keeper.md` | DataKeeper の実行手順 |
| `index.html` | サイト本体（編集対象） |
| `build.js` | データ埋め込みスクリプト（触らない） |
