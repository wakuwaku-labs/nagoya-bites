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
- `docs/brand-policy/nagoya_bites.md`（名古屋バイツの基本方針の原文）を読む。記事・SNS原稿はこれに沿って書く（宣伝でなく読者の判断材料／事実・口コミ・分析・未確認を分ける／行っていない店を行ったように見せない／点数・順位で並べない／注意点も書く）
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

### 3. 候補アングル生成 → 採点 → **品質ゲート**（必須）

Step 2.5 のリサーチノートを踏まえ、**いきなり1本を執筆せず、5本の候補アングル → 採点 → ゲートを通った1本のみ採用** という品質ゲートを通す。

#### 3a. 候補アングル5本を `/tmp/journal-candidates-YYYY-MM-DD.json` に書き出す
本文はまだ書かない（リード150字 + angle 1行 + ソース3件以上のみ）。

```json
[
  {
    "id": "c1",
    "theme": "today_one",
    "title_draft": "...",
    "lead_draft": "150字程度",
    "angle": "切り口を1行（価格帯・席・予約・シーン等のキーワードを含めるとスコアが上がる）",
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
- 週の投稿の予定（SNS分析ツールの next.json）の題材が使えるときは、題材に明確に一致する候補に **並べ替えだけ** +2（同判定帯の同点・僅差のタイブレーク。total・判定・失格は不変）。結果の `plan_topic`・`plan_topic_bonus` に記録。`--no-plan-topic` で切る
- 結果は `data/journal_candidates/YYYY-MM-DD.json` に保存

#### 3c. 品質ゲート（採点の基準は `data/journal_gate_policy.json` が正本。旧「95点固定」は廃止済み）
- PASS: 採用 → Step 3.5（写真調査）へ
- PASS_WITH_NOTE: 採用（公開は続けるが、足りない点を記録に残す）
- HOLD（基準に届かない）: 次の順で試す。それでも駄目なら**その日は出さない**（根拠の薄い記事で日次の頻度を守らない。基本方針・`docs/decisions/0069` 決定6）。本人宛ての課題にして理由を残す
  1. 自動で直す（足りない出典・確認日・注意点を足す）
  2. 題材を替えて1回だけ書き直す（隣接エリア・隣接ジャンルで research-notes を増補）
- 出典のない数字（話題度など）を積んで基準を通さない（CLAUDE.md 品質ゲート原則1）

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
> `価格帯` は出典で確かめられた場合だけ入れる（「1001～2000円」等）。確かめられないときは空のままにし、本文に「推定」「未確認」と明記する（根拠の無い価格を事実として載せない・基本方針 原則3・9）。

外部媒体から引用する場合、記事末尾の `sources` に情報源URL（と掲載日 `date`）を必ず明記。

### 3.6. 写真調査 — **実写真の取得を必須化（全テーマ共通）**

**ジャーナル記事は全テーマで実写真を使う**（CLAUDE.md 制約 #9 / 編集独立性・読者信頼の担保）。汎用ストック写真（Unsplash / Pexels / loremflickr / Pixabay 等）は **テーマを問わず** 新規使用禁止。validator 項目15 が `images.unsplash.com` / `images.pexels.com` / `loremflickr.com` / `pixabay.com` を検出すると **全テーマで** FAIL する。

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

#### `industry_insider` / `seasonal` / `flexible` テーマ（店舗なし）の場合 — **Unsplash 例外は廃止**

非店舗テーマでも汎用ストック写真は使わない。優先順は以下:

1. **代表店舗の Instagram embed** — テーマを象徴する 1 店舗を選んで投稿を使う（実写最優先）
   - 例: 「閑散期の使い方」コラムなら、平日昼に空席が映る店舗の公式 IG 投稿を 1 件
2. **編集部の取材写真** — `/assets/journal-photos/<date>-<slug>.jpg` に self-host
3. **記事固有のイメージ図**（最終手段） — `/assets/journal-figures/<date>-<slug>.svg` に self-host
   - 記事テーマを説明する図解・構造図・インフォグラフィック等
   - 汎用ストック画像の寄せ集めや、Unsplash 画像をベースに加工したものは不可
   - input.json には `stores[0].photo_url: "/assets/journal-figures/<date>-<slug>.svg"` の形で設定

4 つの優先順すべてを試行しても入手できない場合のみ Orchestrator に相談（公開延期 or theme 変更を含む）。「店舗が紐づかないから Unsplash」は不可。

### 4. 記事本文の執筆(Editor として)

**独自性3要件(`today_one` テーマ時は必須)**:
1. **価格帯の読み方** — コース vs アラカルト、ドリンク別 vs 飲み放題の判断軸を具体的に
2. **オペの裏側** — 席配置・予約の取り方・繁忙時間帯・回転意識を運営の面から
3. **シーン適性** — 接待/デート/一人飲みのどれに向き、なぜ向くかを明示

**匿名運営の維持**:
- オーナー名・大将名・シェフ名を本文に書かない
- 署名は「編集部」で統一（個人名・肩書は書かない）

**文字数ガイド**:
- 今日の1軒: 700-1000字
- 業界の裏側: 500-900字
- 週次ダイジェスト: 800-1200字
- 季節短信: 300-600字

**最新情報の引用（必須）**:
- 本文 1-2 箇所で「2026年X月時点で〜」「直近では…と話題に」「先週〜」など、Step 2.5 で得た最新情報を必ず引用する
- input.json の `sources[]` に **最低3件**、うち **最低1件** は直近30日以内の記事を含める（各ソースに `date` フィールドを設定）
- validator がチェックする（最新情報フレーズ不在 / sources 3件未満は FAIL）

**事実台帳（claims_ledger・S4-1）**: 記事の事実ごとに「どの出典のどの記述で確かめたか」を input.json の `claims_ledger[]` に出す。機械が後から推測するより、書いた本人が出典を見ながら対にする方が正確（検査の見落としが減る）。
- 対象は来店前に重要な文を優先: 価格・飲み放題などの時間・席数・個室・予約条件・営業時間・定休日・開店日。沿革や件数など重要でない文は後回しでよい
- 各行: `{"text": "本文の文をそのまま写す", "source_url": "sources の URL", "quote": "出典の該当記述を出典のとおりに120字まで"}`
- quote は出典のページにある文字をそのまま写す（言い換えない・要約しない）。出典の全文は写さない
- 出典を見ていない・取得できなかった文は台帳に入れない（創作しない）。その文は本文でも「未確認」と書く
- 台帳は `data/journal_claims/YYYY-MM-DD.ledger.json` に書き出され、公開後の照合（verify_article_claims.js）が対で確かめる。出さない日は警告だけで、公開は止まらない

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

### 10. コミット＆プッシュ（手動実行のときだけ。無人実行は承認を求めず、ラッパーの手順に従う・CLAUDE.md 品質ゲート原則6）
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
  - 汎用ストック写真（Unsplash 等）は使わない（制約9）。実写が無ければ記事専用の図にする

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
