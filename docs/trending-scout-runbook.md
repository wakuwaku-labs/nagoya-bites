# 話題店発掘 runbook

> このファイルが運用の**正本**。`.claude/commands/*.md` はエージェント自己改変ブロックで
> 新規作成・編集ができないため、`/trending-scout` のようなスラッシュコマンド化はできない
> （試みても拒否される想定）。任意で体験を良くしたい場合は、この runbook の内容をユーザーが
> 手動で `.claude/commands/trending-scout.md` にコピーしてください（機能上の違いは生まない）。
>
> 運用ポリシーの単一の情報源は `data/trending_scout_policy.json`。運用ルールを変えたい場合は
> このファイルではなく `data/trending_scout_policy.json` を編集する（`feedback_policy.json` と
> 同じ規約）。クエリ一覧の単一の情報源は `scripts/lib/trending_queries.js`。

## これは何のためのループか（2026-09-11 新設の経緯）

オーナーから「今日の話題店がずっと同じラインナップ」と報告があり調査したところ、
トップページ `📰 今日の話題店` の選定（`scripts/pick_daily_trending5.js`）自体は毎朝
正しく動いていたが、その**材料**である `data/trending_stores.json` は2026-04-21以来
7店のまま、`data/manual_stores.json` の編集部推薦167店のうち121店は2026-08-21の
一括登録から出典URLが一度も追加されていなかった。新規話題店を発掘して取り込む
半自動パイプライン（`scripts/fetch_trending_articles.js`）は以前から存在したが、
**誰にも定期的に回されていなかった**——これが根本原因。

このループは、その `fetch_trending_articles.js` を定期的に回す責務を担う。
WebSearch/WebFetch は Claude Code の Agent 専用ツールで GitHub Actions のような
サーバレス環境からは実行できないため、GitHub Actions ではなく**スケジュール済み
Claude ルーチン**（`/seo-triage` や `docs/feedback-triage-runbook.md` と同じ方式）
として運用する。

---

## 前提（このループの記憶）

- データの正本: `data/trending_stores.json`（`stores[]`=話題フラグ付与済み・`candidates[]`=
  LOCAL_STORES未マッチの未登録店）
- クエリ一覧の単一の情報源: `scripts/lib/trending_queries.js`
- 運用ポリシー: `data/trending_scout_policy.json`（クエリローテーション件数・自動昇格閾値・
  心拍の許容欠測日数。毎回読む）
- 決定的ヘルパー: `node scripts/trending_scout.js`（今日投げるクエリの算出 / 心拍書き込み / 健診）
- 既存の取り込みパイプライン: `node scripts/fetch_trending_articles.js`（`ingest-json` で
  LOCAL_STORES マッチング、`auto-promote` で条件達成した候補を話題フラグ=true に昇格）
- 生存確認（このループが動いているかの記録）: `data/trending_scout_health.json`（心拍・
  毎回更新してコミット）
- サーバ側監視: `.github/workflows/trending-scout-watchdog.yml`（毎日14:00 JST。心拍が滞ると
  Issue 起票＝オーナーにメール。復旧で自動クローズ）。判定器は
  `node scripts/check_trending_scout_health.js`
- 下流: `scripts/pick_daily_trending5.js`（毎朝5:30 JST・`.github/workflows/daily-trending5.yml`）
  が `話題フラグ=true` かつ検証可能な出典URLを持つ店を材料にTOP5を選ぶ。このループは
  その材料を絶やさないための**供給側**であり、TOP5の選定ロジック自体には触れない

---

## 実行フロー（必ずこの順番）

### Step 0: ポリシーと今日のクエリをロード

```bash
node scripts/trending_scout.js --policy
node scripts/trending_scout.js --next-queries
```

`--next-queries` は年間通算日（JST）起点で `queries[]`（現行37件）から `queries_per_run`
件（既定6件）を決定的にローテーションして返す。実測7日で全クエリを巡回する設計のため、
引数なしでそのまま使えばよい。

### Step 1: WebSearch で候補を探す

Step 0 で得た各クエリを WebSearch にかけ、以下に該当する**実在しそうな新規の話題**を拾う:
- 新店オープン（プレスリリース・地域メディア記事）
- SNS（X/Instagram/TikTok）での行列・予約困難・バズの言及
- 雑誌・TV番組・グルメメディアでの特集

明らかに無関係な検索結果（イベント告知、他都市の店、既存の使い回し記事）は読み飛ばす。

### Step 2: WebFetch で裏取りする（**省略しない**）

> CLAUDE.md「架空店ブロック」と同じ規律。検索結果一覧のタイトル・スニペットだけで
> 店名を確定させない。

Step 1 で見つけた有望な記事URLを WebFetch し、次を確認する:
- 店名（正確な表記）
- エリア（名古屋のどのエリアか）
- 何が話題なのか（新規開店日・SNSでの言及内容・掲載媒体名）

確認できないものは候補から外す。もっともらしい店名をWebSearchの断片から推測で
補完しない。

### Step 3: 取り込み用JSONを作る

Step 2 で裏取りできた候補を、`fetch_trending_articles.js ingest-json` の入力形式で
一時ファイル（例: `/tmp/trending_leads.json`）に書く:

```json
[
  {
    "店名": "正確な店名",
    "エリア": "分かれば記入（空でも可）",
    "出典URL": ["https://実在確認した記事のURL"],
    "トレンド情報源": ["メディア記事"],
    "話題スコア": 70,
    "コメント": "何が話題なのかを一言で"
  }
]
```

### Step 4: 取り込み実行

```bash
node scripts/fetch_trending_articles.js ingest-json /tmp/trending_leads.json
```

- **LOCAL_STORES（`data/stores.json`）に既に実在する店**は自動で `trending_stores.json`
  の `stores[]` に追加される（`話題フラグ=false`・`_auto:true`。まだ非表示、Step 5 で
  条件を満たせば自動昇格）
- **LOCAL_STORES に無い店**は `candidates[]` に追加されるだけで**それ以上は何もしない**。
  実在検証（`GOOGLE_MAPS_API_KEY` 経由の店名+住所+業態の三重検証）を経ないまま
  `manual_stores.json` へ追加しない（架空店ブロック・CLAUDE.md 制約）。新規店の正式
  追加は別ワークフロー（Editor/DataKeeper が `agents/editor.md` の「実在検証は必須」
  手順で対応）

`data/trending_scout_policy.json` の `caps`（既定: 新規店5件/新規候補10件）を超えて
取り込んだ場合も処理自体は止めない。Step 8 のレポートで超過を明示する。

### Step 5: 自動昇格を実行

```bash
node scripts/fetch_trending_articles.js auto-promote
```

`_auto:true` かつ検出から3日以上経過・出典URL2件以上が貯まった候補だけを
`話題フラグ=true` に昇格する（=即日1本のURLだけで昇格させない。日をまたいで
裏付けが増えたものだけを通す、という段階ゲート）。

### Step 6: 既存の凍結店舗にも目を配る（任意・余力があれば）

`data/trending_stores.json` / `data/manual_stores.json` の既存店で、検出日が
古いまま新しい媒体露出が無いか思い当たるものがあれば、Step 1-2 と同じ要領で
出典URLを追記してよい（`検出日` は `pick_daily_trending5.js` が翌朝自動で繰り上げる）。
これは Step 1-5 の主フローとは独立した任意の上乗せ。

### Step 7: コミット & push

```bash
git add data/trending_stores.json
git commit -m "[trending-scout] 話題店発掘: <日付>（新規N件/候補M件/昇格K件）"
git pull --rebase origin main
git push
```

pull --rebase で競合した場合、対象が `data/trending_stores.json` のみであれば
（他の自動ループと同時に走ることは想定していないため通常は起きない）、
内容を人力でマージするか、リトライで解消する。

### Step 8: レポートを提示

```
## 🔦 話題店発掘（<日付>）

今日のクエリ: <queries[]をそのまま列挙>

### ✅ 既存店にマッチ・自動反映待ち（N件）
| 店名 | エリア | 出典 |
|------|--------|------|

### 🆕 未登録の新規候補（LOCAL_STORES未マッチ・M件）
| 店名 | 出典 | 備考 |
|------|------|------|
（実在検証を経ないと掲載できないため、正式追加は別途 Editor/DataKeeper へ）

### ⬆️ 今回自動昇格（K件・話題フラグ=true化）
| 店名 | 検出からの経過日数 | 出典URL件数 |
|------|---------------------|--------------|

---
次アクション:
- このまま `node scripts/pick_daily_trending5.js dryrun` で明日のTOP5候補への影響を確認できる
- 未登録の新規候補を正式に載せたい場合は Editor に実在検証を依頼
- ループの健診は `node scripts/check_trending_scout_health.js`
```

### Step 9: 心拍を記録する（**新規0件の日も必ず・スキップ禁止**）

```bash
node scripts/trending_scout.js --health-write '{
  "queries": [<Step0で使ったクエリ>],
  "leads_found": <Step1-2で裏取りできた候補数>,
  "matched_existing": <Step4でstoresに追加された数>,
  "new_candidates": <Step4でcandidatesに追加された数>,
  "promoted": <Step5で自動昇格した数>
}'
```

WebSearch/WebFetch自体が失敗した場合（ツールエラー・認証切れ等）はこちら
（**0件と報告しない**）:
```bash
node scripts/trending_scout.js --health-write '{"status":"error","reason":"<エラー内容>"}'
```

そのうえで `data/trending_scout_health.json` を**コミットする**（Step 7 の git add に含める）。

**なぜ0件の日こそ書くのか**: 新規リードが無い日はコミットする成果物が心拍しか無い。
心拍を書かないと「ルーチンが動いて0件だった」と「ルーチンが動かなかった」が
**外から区別できない**。このファイルが push されて初めて
`.github/workflows/trending-scout-watchdog.yml` がサーバ側（＝このループの全故障
モードから独立した場所）で鮮度を見て、滞ったら Issue を起票できる（＝オーナーに
メールが届く）。CLAUDE.md「無人自動化の監視を設計するときの原則」原則1・2・4の適用。

---

## 重要な原則

- **鵜呑み禁止**: WebSearchのタイトル・スニペットだけで店名を確定させない。Step 2 の
  WebFetchによる裏取りは省略可能な保険ではなく手順の一部
- **架空店を作らない**: LOCAL_STORES に無い店は `candidates[]` に留め置くだけ。
  実在検証を経ずに `manual_stores.json` へ自動追加しない
- **段階ゲート**: 1本のURLだけで即昇格させない（Step 5・3日以上経過＋2URL以上）。
  正直な最良の成果物（裏取りが1件しか無い日）にも逃げ道を用意する（ISSUE-077 の教訓）
- **ヘッドレスで止まらない**: 応答できる人がいない前提で動く。判断に迷っても
  承認待ちで停止せず、「候補から外す」か「candidates に留め置く」のどちらかに倒す
- **選定ロジックには触れない**: このループは `trending_stores.json` を太らせるだけ。
  TOP5の選び方（鮮度・多媒体露出のスコアリング）は `scripts/pick_daily_trending5.js` の
  責務のまま変更しない
- **心拍を書かずに終了しない**: 0件の日も Step 9 は実行する。書かない終了は
  「静かな失敗」と区別がつかない

---

## エラー時

- WebSearch/WebFetchが使えない（ツール障害・認証切れ） → 0件と報告せず
  `status: "error"` で心拍を書いて終了。watchdog の Issue が唯一の復旧経路になる
- `ingest-json` / `auto-promote` がエラーを返す → 内容を記録し、その回の取り込みは
  スキップして Step 9 に進む（ループ全体を止めない）
- push が競合する → `data/trending_stores.json` のみの競合であれば内容をマージして
  再試行。他ファイルまで競合していたら無理に解消せず、状況をそのままレポートして終了
