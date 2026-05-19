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

### 2.5. 最新情報リサーチ（X / 最新メディア — 必須）

Step 2 で確定したテーマ・ジャンル・エリアをキーに、**直近1週間** の話題を WebSearch / WebFetch で取りに行く。**ここで集めた情報を Step 4 の本文執筆に必ず反映する**。

#### 2.5a. クエリ生成
```bash
node scripts/fetch_trending_articles.js suggest-queries <theme> [genre] [area]
```
→ `after:YYYY-MM-DD` 付きの WebSearch クエリを 5-8 本、JSON で出力。

代表的なクエリパターン（自動生成）:
- `site:x.com 名古屋 <ジャンル> after:YYYY-MM-DD`
- `site:twitter.com 名古屋 <エリア> 新店 after:YYYY-MM-DD`
- `site:note.com 名古屋 <ジャンル> after:YYYY-MM-DD`
- `site:prtimes.jp 名古屋 <ジャンル> オープン after:YYYY-MM-DD`
- `名古屋 <エリア> 話題 <今月>月`
- `名古屋 <ジャンル> 行列 OR 予約困難 after:YYYY-MM-DD`

#### 2.5b. WebSearch → WebFetch 実行
- 各クエリで **WebSearch** → 上位 5 件の URL を確認
- 関連性の高い URL を **WebFetch** で本文取得（X 投稿は OG/抜粋のみで可）
- フォールバック順序: **X → Note → PR TIMES → dressing/macaroni/retrip → メディア記事**

#### 2.5c. リサーチノートを `/tmp/research-notes-YYYY-MM-DD.md` に保存
```markdown
# 最新情報リサーチ YYYY-MM-DD（テーマ: today_one / ジャンル: 寿司 / エリア: 栄）

## X / Twitter（直近7日）
- 「〇〇店の◯◯が美味すぎる」https://x.com/... (YYYY-MM-DD, RT 50+)

## Note / PR TIMES / メディア
- dressing: 「タイトル」https://... (YYYY-MM-DD) — 要点1行
- PR TIMES: 「新店オープン」https://... (YYYY-MM-DD) — 要点1行

## 抽出された話題店候補
- 店名A（栄, 寿司）— X で 50RT、Google 4.5
- 店名B（名駅, バー）— Note 特集で2記事言及
```

#### 2.5d. 候補の自動取り込み（任意）
新規話題店が見つかった場合、JSON で一括取り込み：
```bash
# /tmp/buzz.json の例:
# [{"店名":"〇〇","エリア":"栄","ジャンル":"寿司","出典URL":["https://x.com/..."],"話題スコア":85}]
node scripts/fetch_trending_articles.js ingest-json /tmp/buzz.json
```
→ `data/trending_stores.json` の `stores[]` または `candidates[]` に追加、`出典URL` も保存。

### 3. 候補アングル生成 → 採点 → **95点ゲート**（必須）

Step 2.5 のリサーチノートを踏まえ、**いきなり1本を執筆せず、5本の候補アングル → 採点 → 95点以上の1本のみ採用** という品質ゲートを通す。

#### 3a. 候補アングル5本を `/tmp/journal-candidates-YYYY-MM-DD.json` に書き出す
本文はまだ書かない（リード150字 + angle 1行 + ソース3件以上のみ）。

```json
[
  {
    "id": "c1",
    "theme": "today_one",
    "title_draft": "...",
    "lead_draft": "150字程度",
    "angle": "業界人視点の切り口を1行（価格帯・席・予約・シーン等のキーワードを含めるとスコアが上がる）",
    "main_store": { "name": "...", "id": "", "area": "...", "genre": "..." },
    "column_id": "(industry_insider テーマ時のみ)",
    "sources": [{"label": "...", "url": "...", "date": "YYYY-MM-DD"}],
    "trending_signals": { "x_mentions": 12, "media_count": 3, "buzz_score": 85 }
  }
]
```

#### 3b. 採点
```bash
node scripts/score_journal_candidates.js /tmp/journal-candidates-YYYY-MM-DD.json
```
- 重複ゲート（HARD FAIL）: 同一店舗90日 / 同一コラム180日 / タイトル類似 / リード類似 → 即失格
- 採点ルーブリック: 最新性25 / 話題性25 / 独自性20 / ブランド整合15 / 執筆実現性10 / 新規性5
- 結果は `data/journal_candidates/YYYY-MM-DD.json` に保存

#### 3c. 95点ゲート（**当日公開スキップは禁止**）
- 最高スコア **≥ 95**: 採用 → Step 3.5（写真調査）へ
- 最高スコア **< 95**: **95点に到達するまで** 以下を繰り返す（公開スキップ禁止）:
  1. **第1ラウンド**: Editor がリサーチノートを再読し、追加で 5本の候補を生成 → 再採点
  2. **第2ラウンド**: WebSearch クエリを **拡張**（隣接エリア・隣接ジャンル）し research-notes を増補 → さらに 5本追加 → 再採点
  3. **第3ラウンド（救援プール）**: `data/editorial_column_backlog.json` の未使用コラム（業界裏側）から候補を機械生成し、Step 2.5 の最新ソース3件を注入
  4. **第4ラウンド（最終救援）**: 救援プール候補に最新ソースを **追加で3件以上手動投入** して再採点。**ここで必ず 95+ を出す**

> 救援プール（業界裏側コラム）は構造的に「独自性20点満点・ブランド整合15点満点」を取りやすい設計のため、最新ソースさえ揃えば 95+ に必ず到達できる。**当日公開ゼロという結果はワークフロー上発生しない。**

#### 3d. 採用候補の確定と pending_stores 登録
採用された候補1本のみ、Step 3.6 → Step 4（本文執筆）に進む。

採用候補の `main_store` が LOCAL_STORES に無い話題店の場合、以下を **必ず** `data/pending_stores.json` の `pending[]` に追記:
```json
{
  "店名": "...",
  "ジャンル": "...",
  "エリア": "...",
  "アクセス": "〇〇駅 徒歩X分（名古屋市〇区）",
  "価格帯": "1001～2000円",
  "情報源": "https://他メディアの記事URL",
  "おすすめポイント": "...",
  "営業状況": "営業中",
  "追加日": "YYYY-MM-DD",
  "journal_url": "journal/YYYY-MM-DD-slug.html",
  "merged": false
}
```

> **⚠️ `アクセス` は必須**（CLAUDE.md「品質フィルタ通過条件」）。最寄り駅+徒歩分数を入れ、文字列に必ず「名古屋」または名古屋固有駅名を含める。未指定時は `merge_pending_stores.js` がエリアから補完するが、可能な限り元情報源から手動で記入する。
>
> `価格帯` は推定でよいので入れる（「1001～2000円」等）。空だと予算フィルタに引っかからない。

外部媒体から引用する場合、記事末尾の `sources` に情報源URL（と掲載日 `date`）を必ず明記。

### 3.6. 写真調査 — **実店舗写真の取得を必須化**

**ジャーナル記事は店舗の実写真を使う**（編集独立性・読者信頼の担保）。汎用ストック写真（Unsplash / Pexels）は店舗紹介テーマでは使わない。validator が `images.unsplash.com` 等を検出すると FAIL する。

#### `today_one` / `weekly_digest` テーマ（店舗あり）— 以下のいずれか1つを必ず取得

**優先1: Instagram 公式 embed**（最も推奨・Instagram規約上明確に許可）
- 店舗公式アカウントの**特定の投稿URL**（`/p/XXX/` または `/reel/XXX/`）を見つける
- input.json `stores[0].instagram_post_url` に設定
- Instagram の `embed.js` を使った埋め込みは規約上明示的に許可されている: https://help.instagram.com/1521786464576692

**優先2: HotPepper 公式写真**（LOCAL_STORES に登録済みの店）
- LOCAL_STORES の `写真URL` フィールドの `imgfp.hotp.jp/...` URL
- input.json `stores[0].photo_url` に設定

**優先3: Google Maps Places API 写真**（環境変数 `GOOGLE_MAPS_API_KEY` 設定時）
- generate_daily_draft.js が自動取得（store.name + area で検索 → Places Photo）
- 自動なので追加設定不要、ただし API key が必要

**優先4: 店舗から許諾を取得した独自URL**
- 店舗 owner に連絡 → 許諾を得た上で input.json `stores[0].photo_url` に設定

**Instagram 投稿URLの探し方**:
1. 店舗の公式 IG アカウント URL を確認（LOCAL_STORES `公式Instagram` / Web検索）
2. アカウントページで看板料理が映る投稿を1件選ぶ
3. その投稿の URL（`https://www.instagram.com/p/XXX/` または `/reel/XXX/`）をコピー
4. input.json に貼り付け

> **⚠️ 禁止事項**: 他メディア（dressing/macaroni/retrip等）の記事内写真の転用は著作権侵害。店舗公式サイトの写真も無許諾転載不可。Instagram は **公式embed.js経由のみ** 許可（スクリーンショット・画像ダウンロードは不可）。

#### `industry_insider` / `seasonal` / `flexible` テーマ（店舗なし）の場合
- 店舗が紐づかないため、Unsplash の curated ストック写真でOK（validator では item 15 がスキップされる）
- `stock_keyword` タイプ + Unsplash 検索URL（`https://unsplash.com/s/photos/<keyword>`）を `photo_suggestions[]` に追加
- 撮影イメージを `shot_type` タイプで2点提案

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

**最新情報の引用（必須）**:
- 本文 1-2 箇所で「2026年X月時点で〜」「直近では…と話題に」「先週〜」など、Step 2.5 で得た最新情報を必ず引用する
- input.json の `sources[]` に **最低3件**、うち **最低1件** は直近30日以内の記事を含める（各ソースに `date` フィールドを設定）
- validator がチェックする（最新情報フレーズ不在 / sources 3件未満は FAIL）

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
✅ ジャーナル公開完了: https://nagoya-bites.com/journal/YYYY-MM-DD-slug.html

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
