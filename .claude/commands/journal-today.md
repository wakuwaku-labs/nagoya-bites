---
description: NAGOYA BITES の今日のジャーナル記事とSNS原稿を生成する
---

# /journal-today

NAGOYA BITES の今日のジャーナル記事1本と、Note/Instagram/Xの投稿原稿を生成する。
コストゼロ運用前提(Claude API有料プラン不要、SNS API不要、全て手動コピペ投稿)。

## 実行手順

以下の順で作業すること。Editor エージェントとして振る舞う。

### 1. コンテキスト読込
- `agents/orchestrator.md` を読む（CEO としての責務を思い出す）
- `agents/editor.md` の「日次運用」章を読む（独自性3要件と新規店舗追加フロー）
- `CLAUDE.md` の「絶対に守る制約」を再確認（匿名運営 EDT-001 を守る）

### 2. 今日のテーマと候補取得
```bash
node scripts/pick_daily_topic.js
```
出力の JSON を読み、以下を決定:
- `theme` (today_one / industry_insider / weekly_digest / seasonal / flexible)
- `candidates` (LOCAL_STORES の候補 or 外部媒体候補)
- `column` (業界裏側テーマ時、使用するコラム ID)
- `seasonal` (該当日なら season ヒント)
- `recent_store_ids` / `recent_themes` (30日以内の重複を避ける)

### 3. 候補店選定と追加データ取得
- テーマが `today_one` or `weekly_digest` なら候補店を1-5軒選定する
- LOCAL_STORES に該当がない話題店を採用する場合、以下を **必ず** `data/pending_stores.json` の `pending[]` に追記:
  ```json
  {
    "店名": "...",
    "ジャンル": "...",
    "エリア": "...",
    "情報源": "https://他メディアの記事URL",
    "おすすめポイント": "...",
    "営業状況": "営業中",
    "追加日": "YYYY-MM-DD",
    "journal_url": "journal/YYYY-MM-DD-slug.html",
    "merged": false
  }
  ```
- 外部媒体から引用する場合、記事末尾の `sources` に情報源URLを必ず明記

### 3.5. 写真候補の調査

input.json の `photo_suggestions[]` に含めるため、以下を調査してから記事執筆に進む。

**`today_one` / `weekly_digest` テーマ（店舗あり）の場合**:
1. LOCAL_STORES の該当店舗の `公式Instagram` フィールドを確認 → URLがあれば `store_instagram` タイプで追加
2. Google Maps 検索URL（`https://www.google.com/maps/search/<店名>+<エリア>`）を `google_maps` タイプで追加
3. 推奨撮影シーン3点を `shot_type` タイプで提案:
   - 例: ①看板料理のアップ ②店内の雰囲気（カウンター/テーブル） ③外観・暖簾・看板

**`industry_insider` / `seasonal` / `flexible` テーマ（店舗なし）の場合**:
1. テーマに合うフリー素材キーワード（日本語＋英語）を `stock_keyword` タイプで提案
   - 例 `industry_insider`: 「コース料理 テーブル 俯瞰」「restaurant course meal japan」
   - Unsplash 検索URL（`https://unsplash.com/s/photos/<keyword>`）を `url` フィールドに記載
2. 記事コンセプトに合う撮影イメージを `shot_type` タイプで2点提案

> **⚠️ 権利確認を必ず案内する**: 他メディア・飲食店公式サイトからの写真転載は不可。
> Unsplash は商用利用可・クレジット記載推奨。Instagram の公式アカウント写真はリポスト申請が必要。

### 4. 記事本文の執筆(Editor として)

**独自性3要件(`today_one` テーマ時は必須)**:
1. **価格帯の読み方** — コース vs アラカルト、ドリンク別 vs 飲み放題の判断軸を具体的に
2. **オペの裏側** — 席配置・予約の取り方・繁忙時間帯・回転意識を業界人視点で
3. **シーン適性** — 接待/デート/一人飲みのどれに向き、なぜ向くかを明示

**匿名運営の維持**:
- オーナー名・大将名・シェフ名を本文に書かない
- 「業界人」「編集部」で統一

**文字数ガイド**:
- 今日の1軒: 700-1000字
- 業界の裏側: 500-900字
- 週次ダイジェスト: 800-1200字
- 季節短信: 300-600字

### 5. ドラフト生成

input.json を一時ファイル `/tmp/journal-input.json` に書き、以下を実行:

```bash
node scripts/generate_daily_draft.js /tmp/journal-input.json
```

input.json のスキーマは `scripts/generate_daily_draft.js` の先頭コメントを参照。

### 6. 自動QAを走らせる

```bash
node scripts/validate_journal_draft.js journal/drafts/YYYY-MM-DD-slug.html docs/daily-posts/YYYY-MM-DD.md
```

FAIL が出たら該当箇所を修正してから再実行。PASS するまで先に進まない。

### 7. ドラフトを本番に移動
```bash
mv journal/drafts/YYYY-MM-DD-slug.html journal/YYYY-MM-DD-slug.html
```

### 8. 公開ログとindex更新

`data/journal_published.json` の `entries[]` に今日のエントリを追記:
```json
{
  "slug": "YYYY-MM-DD-slug",
  "date": "YYYY-MM-DD",
  "theme": "...",
  "title": "...",
  "description": "...",
  "store_ids": [],
  "pending_store_keys": [],
  "column_id": "",
  "published_at": "ISO8601"
}
```

```bash
node scripts/build_journal_index.js
```

### 9. ビルドとユーザー承認
```bash
node build.js
```

ユーザーにドラフト結果を**必ず見せて**承認を仰ぐ:
- 生成されたHTMLファイルのパス
- validator の結果
- docs/daily-posts/YYYY-MM-DD.md の中身プレビュー
- pending_stores.json に追記した店がある場合はその店名リスト

### 10. コミット＆プッシュ(ユーザー承認後のみ)
```bash
git add journal/ data/journal_published.json data/pending_stores.json docs/daily-posts/ index.html sitemap.xml
git commit -m "journal: YYYY-MM-DD — <テーマ短縮> <主題>"
git push origin HEAD:main
```

### 11. SNS投稿案内

ユーザーに以下を伝える:
```
✅ ジャーナル公開完了: https://wakuwaku-labs.github.io/nagoya-bites/journal/YYYY-MM-DD-slug.html

次に docs/daily-posts/YYYY-MM-DD.md を開いて、下記3つに手動コピペ投稿してください:
  1. Note: note.com
  2. Instagram: 画像を添えて投稿（Reels週3本目標）
  3. X: スレッド形式で投稿

📷 写真候補は docs/daily-posts/YYYY-MM-DD.md の「## 写真候補」セクションを確認してください。
  - store_instagram / google_maps リンクで実在写真を調達
  - stock_keyword / Unsplash URLでフリー素材を検索

詳細ルール: docs/daily-posts/README.md
```

---

## 失敗時のリカバリ

| 失敗 | 対応 |
|---|---|
| pick_daily_topic が空の候補を返す | 手動で LOCAL_STORES か trending_stores.json を見て候補を Editor が選ぶ |
| validator が PASS しない | 該当項目の修正後、再度 validator → PASS まで繰り返す |
| ビルドエラー | `node build.js` のエラーメッセージを読んで該当箇所を修正 |
| 途中でセッション切断 | 再度 `/journal-today` を実行。journal/drafts/ に残っているなら Step 6 から再開 |

## このコマンドの設計原則

- LLM コストゼロ: すべて Claude Code セッション内で完結
- SNS APIコストゼロ: 投稿は全て手動コピペ
- 店舗データは話題性優先: LOCAL_STORES 外OK、pending 経由で自動取り込み
- 匿名運営 EDT-001 を絶対に破らない
