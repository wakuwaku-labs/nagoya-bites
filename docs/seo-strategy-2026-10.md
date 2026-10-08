# SEO 戦略 2026-10（分析・戦略・戦術・KPI）

> 2026-10-09 作成（Orchestrator・MARKETING モード）。オーナー依頼「SEOの分析と、今後より伸ばすための戦略戦術を用いた改善点」への回答。
> **SEO の判定指標とチェックポイントの正本はこのドキュメント。** `docs/growth-plan-2026-q4.md`（2026-09-14）のチェックポイント（30日PV）は §4 に置き換える。
> 判断の記録は `docs/decisions/0007-seo-north-star-metrics.md`。課題は親 [[SEO-116]] の下に起票済み（§3）。
> 数値はすべて `data/*.json`（2026-10-08 生成）の実測で、出典を併記する。見立ては「推測」と明記する。再現方法は §5。

## 0. 結論

1. **計測が壊れていた。** 店舗ページ 5,008 本で GA4 のインライン script が構文エラーになり、2026-05-08 の生成分から一度も動いていなかった。[[SEO-115]] で生成器を直し、生成ページのインラインJS構文ゲートを CI・夜間QA・テスト・QAゲートに入れた。GA4 の PV・回遊・CTA は、真値で取り直すまで前後比較に使わない。
2. **勝っている面は特集「一人飲み」1本だけ。** Google のクリックの 25% を `features/nagoya-solo-dining.html` が稼ぐ。憲法が勝つ領域とする宴会・接待・個室・女子会の検索面はほぼ空白。新しい面を作るより、シグナルが出ている面（一人飲み・デート・ハブ）を濃くして絞る。
3. **検索面の量は揃ったが、質が無い。** 店舗 5,110 本とハブ 699 本の多くは自動要約だけの薄いページで、クエリが分かる Google の表示（全体の 45.9%）の 6 割は店名指名検索（CTR 0.61%）。ハブ 699 本は 28 日で表示 86・クリック 1。上位から濃くし、11-15 に実測でインデックス対象を絞る。

---

## 1. 分析（検証できる事実）

### 1-1 流入の全体像（GA4 30日）

| 指標 | 値 | 出典・補足 |
|---|---|---|
| セッション / PV | 1,388 / 1,770 | `data/site_metrics.json` `totals`。**店舗ページ分は含まれていない**（1-4 ①） |
| 30日セッションの推移 | 405（07-05）→ 1,388（10-08） | `data/metrics_history.json` `entries` |
| pages/session / 直帰率 | 1.28 / 27.4% | 同上の理由で歪んでいる |
| チャネル | 自然検索 67.1% / 直接 22.8% / 生成AI 7.4% / SNS 0.4% | `site_metrics.json` `channels.pct`。SNS は UTM 未設定（[[SEO-098]]） |
| 検索エンジン別 | **Bing 28.0%（390）/ Google 26.7%（372）/ Yahoo! 11.3%（157）/ 生成AI 7.4%（103）** | `data/search_channel_metrics.json` `engines` |

GSC が映すのは Google の分だけで、検索経由の 3 分の 1 強にとどまる。Yahoo! JAPAN は Google の索引を使うので個別の施策は要らない。

### 1-2 Google 検索の実態（GSC 28日・2026-09-10〜10-07）

| 項目 | 表示 | クリック | CTR | 平均順位 | 出典 |
|---|---|---|---|---|---|
| 全体 | 36,504 | 568 | 1.56% | 12.6 | `data/gsc_metrics.json` `totals` |
| 店舗ページ（2,998 ページ） | 27,907 | 268 | 0.96% | 13.0 | `pageTypes.store` |
| 特集（39 ページ） | 3,510 | 192 | 5.47% | 8.5 | `pageTypes.feature` |
| 　うち `nagoya-solo-dining` | 1,990 | 142 | — | 6.8 | `pages[]`。全クリックの 25% |
| ジャーナル（95 ページ） | 2,848 | 96 | 3.37% | 8.3 | `pageTypes.journal` |
| トップ | 2,289 | 12 | 0.52% | 21.5 | `pageTypes.home` |
| エリア×ジャンルハブ（27 ページ） | 86 | 1 | 1.16% | 15.0 | `pageTypes.area_hub`。本番 sitemap に安定して載ったのは 09-28 から（[[SEO-111]]）で、評価には早い |

検索意図別（`intent.summary`・GSC から取得した 3,809 クエリが対象）。クエリが分かる表示は 16,747 で、全表示 36,504 の 45.9%。残りは Google がクエリを伏せた表示なので、下の割合は「クエリが分かる表示」に占める割合:

| 意図 | 表示 | クエリ判明分に占める割合 | クリック | CTR | 平均順位 |
|---|---|---|---|---|---|
| 店名指名（navigational） | 10,016 | 59.8% | 61 | 0.61% | 16.1 |
| その他 | 5,199 | 31.0% | 58 | 1.12% | 15.5 |
| **発見型（discovery）** | **1,532** | 9.1% | **91** | 5.94% | 9.7 |

発見型はクエリが分かる表示の 1 割だが、クエリが分かるクリック 210 の 43% を占める。うち 73 クリックは「一人飲み」系の 16 クエリ（`intent.examples.discovery`）。サイトの目的（名古屋×シーンで店を見つけてもらう）に合う検索はここで、北極星指標に置く（§2）。

### 1-3 シーン別の検索面（`queries[]` の上位 300 クエリの語含有・表示加重の平均順位）

| 語 | 表示 | クリック | 順位 | 状態 |
|---|---|---|---|---|
| 一人・1人飲み | 1,101 | 95 | 6.2 | 唯一の勝ち面。ただし「名古屋駅 一人飲み」（56 表示）は `nagoya-solo-dining` に 10.3 位で着地し、名駅版 `meieki-hitori-nomi` はページ全体で 13 表示・15.5 位。**派生面が親と食い合っている** |
| デート | 88 | 5 | 12.1 | `features/date.html` が「名古屋 デート ディナー」（51 表示）で 11.5 位。**1 ページ目の手前** |
| 居酒屋 / 焼肉 | 48 / 16 | 7 / 4 | 8.8 / 14.9 | 小さい。ハブが育てば取れる面（推測） |
| バー / カフェ | 142 / 138 | 1 / 1 | — | **ほぼ全部が店名指名**（例: bar bond 18、boobar2nd）。ジャンル探索の需要はまだ観測されていない |
| 宴会・接待・女子会・忘年会・誕生日 | 0 | 0 | — | **Moat の中心が空白**。接待系特集 6 本で 26 表示・0 クリック（[[SEO-090]] で「7本目は作らない」と判断済み） |

バーとカフェの行は `scripts/gsc_query_intent.js` の分類器で意図別に分けた値（ハンバーグ・バーガーを除く・英字の bar / cafe を含む）。

### 1-4 技術SEO・データ品質の発見（重要度順）

| # | 発見 | 根拠 | 影響 |
|---|---|---|---|
| ① **P0** | 店舗ページ 5,008 本のインライン script が構文エラーで丸ごと不実行（`gtag('config')` と外部リンク計測を含む） | `gen-store-pages.js` のテンプレートリテラル内の `\/\/` が生成物で `//` になり、`/^https?:///i` の後ろがコメント化。2026-05-08 生成分から。特集・ジャーナル・ハブの同じスニペットは正しい | GA4 の全指標が店舗ページ分を欠いたまま判断されてきた。GSC の Google クリック 568 と GA4 の Google セッション 372 の乖離と整合。**[[SEO-115]] で修正済み** |
| ② | 栄エリアの 7 店のアクセス文に「JR釧路駅」「JR神田駅」など県外の駅名が入っており、ハブ本文に「最寄り駅…釧路駅（2軒）」と出ている | `data/stores.json` の `アクセス`、`stores/area/sakae/izakaya-budget-3000.html` | 店舗ページ・JSON-LD・ハブの三重露出。現行の監査は都道府県しか見ず、駅名を見ていない |
| ③ | `sitemap.xml` の `lastmod` が 5,823 URL 全件で生成日（2026-10-08 の1値）。robots.txt が指す `sitemap-index.xml` と `sitemap-news.xml`（2 URL）は 2026-05-23 から更新されていない | `sitemap.xml`、`git log` | Google は信頼できない lastmod を無視する。新設ハブの発見を自ら遅らせている（推測） |
| ④ | FAQPage のリッチリザルトは 2026-05-07 以降 Google 検索に表示されない。サイトリンク検索ボックスも 2024-11 に終了 | Google 公式ドキュメント（§6） | 特集とハブの FAQ JSON-LD は順位・表示に効かない。画面上の FAQ は AI 引用のために残す |
| ⑤ | 店舗ページの独自本文は「おすすめポイント」1 行だけ。`editorReason` か `insiderNote` を持つ店は 152 店（3.1%） | `data/stores.json` 4,909 件 | 薄さの正体は独自本文の欠如。価格帯・Google評価・写真のうち 2 つ以上が空で編集コメントも無い店は 24 店だけで、一括 noindex の根拠は無い |
| ⑥ | ハブ 699 本の本文は件数・予算帯・最寄駅の自動要約だけ。条件ページ 598 本（有効 586・stub 12）のうち、有効ページで掲載 10 軒未満が 89 本、10〜19 軒が 244 本 | `scripts/gen_area_genre_pages.js`、`data/area_genre_pages_manifest.json` | 「薄い自動生成ページ 699 本」。スパムアップデートが続く年（§1-5）のリスク |
| ⑦ | 特集の鮮度が検証できない。`dateModified` が 05-22 固定か欠落で、月次で入れ替わるロスターと連動しない。画面に公開日・更新日・書き手が無く、`about.html` に運営者像の本文が無い | `features/nagoya-solo-dining.html`、`features/date.html`、`about.html` | AI の概要では「誰が・いつ」が引用の材料。title の【2026年版】と矛盾する |
| ⑧ | 店舗ページの `aggregateRating` が Google 口コミ由来 | `gen-store-pages.js` | 自サイト外の評価をレビュー構造化データに使う扱いは、Google の方針で確認が要る |
| ⑨ | 読めない URL（`store-<16進>`）177 本、別店への転送ページ 99 本 | `stores/` | 優先度は低い |

### 1-5 外部環境（2026）

- 日本で AI による概要が出る検索では、1 位の CTR が半年で 62.7% 下がった（Ahrefs・2026-06）。「1 位を取る」より「引用される」「Google 以外で取る」の価値が上がった。当サイトは既に生成AI 7.4%・Bing 28% を持つ。ChatGPT の検索は Bing の索引を使うので、Bing 施策と相乗する（推測）。
- 2026 年はコアアップデートが 3 月と 5 月、スパムアップデートが 6 月と 9 月（9/24 開始）にあった。薄い自動ページを増やす施策は逆効果になる。

### 1-6 成長プラン（09-14）のチェックポイントとの照合

10-15 の「30日PV 4,000」は未達が確定している（1,770・店舗ページ分は未計測）。PV は [[SEO-115]] の合流後に真値で取り直し、判定指標を §2 の北極星指標に置き換える（[[SEO-043]] の判定基準を正式化）。

---

## 2. 戦略（何で勝つか）

### 北極星指標（総クリック・PV の代わり）

総クリックは店名指名検索の増減と混ざり、PV は計測が直るまで比較できない。SEO の成否は次の 4 つで判定する。

| 指標 | 現状 | 出典 |
|---|---|---|
| 発見型の表示 / クリック（28日） | 1,532 / 91 | `gsc_metrics.json` `intent.kpi` |
| 表示が出たハブの数 / ハブの表示（28日） | 27 本 / 86 | `gsc_metrics.json` `pageTypes.area_hub` |
| 生成AI 経由セッション（30日） | 103 | `search_channel_metrics.json` `engines` |
| Bing 経由セッション（30日） | 390 | 同上 |

### 4本柱

| 柱 | 方針 | 効く事実 |
|---|---|---|
| A 計測を直す | 店舗ページの GA4 を直し、GSC の意図別・ページ種別を日次で残し、計測復旧の段差を効果測定から切り離し、Bing を観測に載せる。直すまで新しい PV 目標を置かない | 1-4 ①、1-1 |
| B 勝ち面を濃くして絞る | 「一人飲み」が勝つ型（1 シーン 1 本・エリア節・実在店・業界視点の選定理由）を、需要が実測で立っている順に写す。デート（11.5 位→1 ページ目）→ 名駅一人飲みの食い合い解消 → 忘年会（既存 `banquet.html` の強化だけ・11-30 に撤退判定）。バー・カフェはジャンル需要が観測されてから | 1-3 |
| C 量より質 | 店舗とハブを上位から濃くする（GSC の表示順に編集コメントと編集辞書を付ける。編集コメントはオーナーが承認した分だけ載せ、insiderNote は AI に書かせない）。薄いまま増やさない。ハブは 11-15 に実測でインデックス対象と noindex を分ける（削除しない） | 1-4 ②⑤⑥、1-5 |
| D Google の外を取る | Bing Webmaster Tools 登録（オーナー）と IndexNow の対象拡大、llms.txt と特集冒頭の結論で AI に引用されやすくする、特集に更新日と書き手を出す | 1-1、1-4 ⑦、1-5 |

### やらないこと

- 接待・個室特集の 7 本目（[[SEO-090]]）と忘年会の新規特集
- FAQPage・サイトリンク検索ボックスの構造化データへの投資
- 条件ページの追加量産と、店舗ページの一括 noindex
- 店名指名検索の 1 位争い（Strategic Skip・公式サイトに譲る）
- Yahoo! 個別の施策（Google の索引のため）
- AI 超解像・汎用ストック写真（制約9）、クーポン・予約特典（Strategic Skip）

---

## 3. 戦術（90日・優先順）

親課題は [[SEO-116]]（90日計画）。期限は `data/linear_issue_defaults.json` の既定値か、判定日が決まっているものはその日。
Linear の番号は、SEO-116 が P-111、SEO-115 が P-112、SEO-117〜SEO-141 が P-113〜P-137（番号の差は4）。

| # | 施策 | 課題 | 担当 | 期限 |
|---|---|---|---|---|
| T1 | 店舗ページの GA4 を直し、生成ページのインラインJS構文ゲートを入れる | [[SEO-115]]（P0・2026-10-09 に PR #403〜#405 で合流済み。GA4 での確認待ち） | Builder | 2026-10-09 |
| T2 | GSC の意図別・ページ種別を日次の指標履歴に残す | [[SEO-117]] | DataKeeper | 2026-10-15 |
| T2 | GA4 の計測復旧による段差を効果測定から切り離し、継続中の施策（SEO-095・SEO-099）の基線を取り直す | [[SEO-118]] | Marketer | 2026-10-20 |
| T3 | 栄の 7 店のアクセス文を一次情報で確かめて直す | [[SEO-119]] | DataKeeper | 2026-10-15 |
| T3 | アクセス文の駅名が愛知県内の駅かを監査する | [[SEO-120]] | Builder | 2026-10-15 |
| T4 | sitemap の lastmod を実際の更新日にし、止まった sitemap-news を外す | [[SEO-121]] | Builder | 2026-10-15 |
| T5 | デート特集を 1 ページ目に上げる（新規作成はしない） | [[SEO-122]] | Editor | 2026-10-15 |
| T6 | 名駅一人飲みの食い合いを解く | [[SEO-087]] に追記 | Editor | — |
| T7 | ハブ 699 本を濃くし、11-15 にインデックス対象を絞る | 親 [[SEO-123]]・子 [[SEO-124]] [[SEO-125]] [[SEO-126]] | Builder・Editor・Marketer | 2026-11-15 |
| T8 | Bing Webmaster Tools 登録と Instagram の UTM（オーナー作業） | [[SEO-067]] [[SEO-098]] に追記 | オーナー | — |
| T9 | 忘年会: `banquet.html` を幹事視点で強化する | [[SEO-127]] | Editor | 2026-10-22 |
| T10 | 店舗ページを GSC の表示上位から濃くする | 親 [[SEO-128]]・子 [[SEO-129]] [[SEO-130]] | Editor・DataKeeper | 2026-11-20 |
| T11 | 特集に公開日・更新日・書き手を出し、dateModified をロスターと連動させる | [[SEO-131]] | Builder・Designer | 2026-10-22 |
| T11 | `about.html` に運営者像を書く（匿名のまま） | [[SEO-132]] | Editor | 2026-10-22 |
| T12 | AI 引用と Bing を取りに行く | 親 [[SEO-133]]・子 [[SEO-134]] [[SEO-135]] [[SEO-136]] | Marketer・Builder・Editor | 2026-10-22 |
| T13 | ジャーナルの title の前 30 字に検索語を寄せる | [[SEO-137]] | Editor・Builder | 2026-10-22 |
| T14 | GA スニペット 4 コピーを 1 本にまとめる | [[SEO-138]] | Builder | 2026-11-07 |
| T15 | Google 口コミ由来の aggregateRating と SearchAction を方針に照らして整理する | [[SEO-139]] | Marketer | 2026-11-07 |
| CP | 11-15 チェックポイントで北極星指標を判定する | [[SEO-140]] | Marketer | 2026-11-15 |
| CP | 11-30 に忘年会面の継続・撤退を判定する | [[SEO-141]] | Marketer | 2026-11-30 |

効果の見立て（いずれも推測）: T5 は順位 11.5→8 で表示 2〜3 倍、T6 は「名古屋駅 一人飲み」10 位→5 位台、T10 は店名指名の CTR 0.61%→1.0%（28 日で +100 クリック前後）、T12 は生成AI 経由 103→150/30日、T13 はジャーナル CTR 3.4%→4.5%。

---

## 4. KPI とチェックポイント

目標値は推測。判定は §2 の北極星指標で行い、総クリックは使わない（[[SEO-043]]）。

| 日付 | 到達条件 | 未達のとき |
|---|---|---|
| 10-15 | [[SEO-115]] が合流済み。表示が出たハブの数を記録（[[SEO-125]]・T7 の基線） | — |
| 10-20 | GA4 の真値で基線を取り直す（PV は比較しない）。[[SEO-117]] が稼働 | — |
| 11-15 | 発見型 表示 1,532→2,500・クリック 91→150。表示が出たハブ ≥ 50 本。`date.html` が 10 位以内。ハブのインデックス対象が確定。PV（店舗込み）4,500 | ハブのインデックス状況を Bing と GSC で確かめ、T7 の本文強化を優先する |
| 11-30 | 「忘年会」「宴会」を含む検索の表示 ≥ 50 なら継続 | T9 を撤退する |
| 12-15 | 発見型 表示 4,000・クリック 250。表示が出たハブ ≥ 150 本。生成AI 経由 ≥ 150/30日。PV 7,000 | 2027-Q1 の計画に作り直す（月間 10 万 PV は 2027-Q2 のまま） |

---

## 5. 数値の再現方法

北極星4指標は日次の指標履歴（`data/metrics_history.json`）から1コマンドで出る（[[SEO-117]]・最新と N 日前の比較）。GSC 由来の値は 2026-10-09 から日次で記録し、それ以前は git に残る `data/gsc_metrics.json` の各日の版から埋め戻した（`backfilledFrom` にコミットを記録・版が無い日は空欄）。

```bash
# 北極星4指標（発見型の表示とクリック・表示が出たハブ・生成AI・Bing）の最新と28日前
node scripts/track_metrics.js --north-star --days 28
# GSC の全体・ページ種別・意図別（28日）
node -e 'const g=require("./data/gsc_metrics.json");console.log(g.dateRange,g.totals,g.pageTypes,g.intent.kpi,g.intent.summary)'
# 検索エンジン別（30日）
node scripts/search_channel_metrics.js --report
# GA4 の全体とチャネル（30日）
node -e 'const s=require("./data/site_metrics.json");console.log(s.totals,s.channels)'
# 生成ページのインラインJS（GA4 が動くか）
node scripts/audit_inline_js_syntax.js --check
```

シーン別の表（1-3）は `gsc_metrics.json` の `queries[]` を語で絞り、表示とクリックを足し、順位を表示で加重平均した値。

---

## 6. 外部出典

- Ahrefs「AI 概要で Google 検索 1 位の CTR が半年で激減、日本 クリック率が −62.7% に減少」 https://ahrefs.com/blog/ja/ai-overviews-reduce-clicks-june-2026/
- Google 検索セントラル「FAQ（FAQPage）の構造化データ」 https://developers.google.com/search/docs/appearance/structured-data/faqpage
- Google 検索セントラル「AI 機能とウェブサイト」 https://developers.google.com/search/docs/appearance/ai-features
- Search Engine Journal「Google Confirms March 2026 Core Update Is Complete」 https://www.searchenginejournal.com/google-confirms-march-2026-core-update-is-complete/571459/
- Search Engine Journal「Google Launches Core Update Amid I/O AI Search Overhaul」 https://www.searchenginejournal.com/google-launches-core-update-amid-i-o-ai-search-overhaul/575589/
- Search Engine Journal「Google Begins Rolling Out The June 2026 Spam Update」 https://www.searchenginejournal.com/google-begins-rolling-out-the-june-2026-spam-update/519632/
- Search Engine Roundtable「Google September 2026 Spam Update」 https://www.seroundtable.com/google-september-2026-spam-update-42163.html
