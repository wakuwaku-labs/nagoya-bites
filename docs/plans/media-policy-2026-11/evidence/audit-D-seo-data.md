# 監査D: SEO と読者行動の実データ（取得済みデータのみ・2026-11-16 時点）

作業は読み取りのみ（リポジトリ変更なし。`node -e` 集計と、書き込まないことをソースで確認した `scripts/journal_title_experiment.js --report` のみ実行）。計算は全てスクリプト。

## 0. 先に知っておくべきデータの癖（判断を誤らせる要因）

| # | 事実 | 出所 |
|---|------|------|
| A | **GSC の全体クリック 1,811 には 11-06 の「不自然な約 430 クリック」が入っている。** store のクリックが 11-05 時点 430 → 11-06 時点 834（1 日で +404）。これは 28 日窓なので 12-04 頃まで残る。除くと実勢は約 1,400（28日）。 | `metrics_history.json` の `entries[].gsc.pageTypes.store.clicks`（11-03:394, 11-06:430, 11-07:834）。`search_ctr_rewrites.json` ondine-1066 `result.note` にも同じ記述 |
| B | **GA4 の「直接」が 11-11 以降に急増している。** 30日合計の direct は 11-11:1,037 → 11-12:1,951 → 11-15:4,036 → 11-16:4,452。dailyReference の 11-14 は 538 セッション・直帰率 0.875。GA4 30日 直帰率 0.305(11-09) → 0.667、平均滞在 111.9 秒(11-09) → 57.4 秒。**GSC のクリックは +180 なので、増えた GA4 は検索由来ではなく、ボットまたは計測の汚染の疑い**（原因は未特定・調査していない）。GA4 の合計・直帰率・滞在・回遊は 11-11 以降を使わない。 | `metrics_history.json` `search_channels`・`totals`、`site_metrics.json` `dailyReference` |
| C | GSC の `pages` は **クリック1以上の上位500ページだけ**。表示だけでクリック0のページ個別の数字は無い（`pagesFetched` 3,408 件中 500 件のみ保存）。種別の合計 (`pageTypes`) は全ページ分。 | `gsc_metrics.json` |
| D | GSC の `queries` は上位300件のみ保存（取得は 5,000 件）。クエリ単位で見えるクリックは 5,000 件で 1,139（全体 1,811 の 63%。残りは匿名化クエリ）。300件では 748。 | `gsc_metrics.json` `queries`・`intent.summary` |
| E | `pageQueries`（ページ別のクエリ）は **16 ページ分だけ**。ページ×クエリの突き合わせは限定的。 | `gsc_metrics.json` `pageQueries` |
| F | 特集の dateModified と git の最終コミット日は、一括処理（11-01 と 11-13 に特集の dateModified が 53 本更新、全 73 本の git 最終コミットが 11-13〜11-16）で上書きされており、**記事内容の実質更新日の指標にならない**。 | 後述 項目9 |
| 参考 | `git status` で `HANDOFF.md` が modified になっていた（開始時は clean 表示）。私は触っていない（フックによる更新と思われる）。 | |

---

## 1. 検索流入の推移

### 1-1. GSC（Google・28日窓・重ならない 28 日ごと）
出所: `data/metrics_history.json` `entries[].gsc.totals`（120 日分 2026-07-16〜11-16。GSC は 07-23 以降の 112 日分。07-16〜07-22 と 09-27 は GSC 欠け）。各値は「その日までの直近28日」。

| 窓（28日） | クリック | 表示 | CTR | 平均順位 |
|---|---|---|---|---|
| 06-25〜07-22 | 294 | 33,735 | 0.87% | 17.2 |
| 07-23〜08-19 | 483 | 40,524 | 1.19% | 15.4 |
| 08-20〜09-16 | 565 | 48,585 | 1.16% | 16.6 |
| 09-17〜10-14 | 767 | 40,329 | 1.90% | 11.1 |
| 10-15〜11-11 | 1,677 | 59,970 | 2.80% | 10.3 |
| 10-19〜11-15（最新） | 1,811 | 67,326 | 2.69% | 10.5 |

- 表示は 4 か月でほぼ 2 倍（33.7k → 67.3k）、クリックは 6.2 倍（294 → 1,811）。ただし 0-A のとおり最新の 2 窓には約 430 の異常クリックを含む。除外した実勢は 10-15〜11-11 で約 1,250、10-19〜11-15 で約 1,400（概算）。
- 1 日あたり表示 2,404（`totals.impressionsPerDay`）。

### 1-2. GA4（直近30日の窓・メトリクス履歴）
出所: `metrics_history.json` `entries[].totals`（30日窓）。

| 日付 | 30日セッション | 30日PV | 直帰率 | 回遊(PV/セッション) | 平均滞在(秒) |
|---|---|---|---|---|---|
| 07-16 | 401 | 477 | 0.444 | 1.19 | 86.8 |
| 08-20 | 899 | 1,267 | 0.384 | 1.41 | — |
| 09-20 | 1,370 | 1,954 | 0.292 | 1.43 | — |
| 10-11 | 1,529 | 1,901 | 0.283 | 1.24 | 124.3 |
| 11-09 | 3,447 | 4,429 | 0.305 | 1.28 | 111.9 |
| 11-16（汚染あり・0-B） | 7,657 | 8,768 | 0.667 | 1.15 | 57.4 |

- 注意: 店舗ページの GA4 は 2026-05-08〜10-09 は構文エラーで欠測（`measurement_changes.json` SEO-115）。10-09 以前と以後の PV は比較不能。
- 回遊は 1.2〜1.5 で推移し、一度も 2 を超えていない（`site_metrics.json` `benchmarks.pagesPerSession.good=2`）。直近の健全値は 1.28。

### 1-3. Google 以外のシェア
出所: `data/search_channel_metrics.json` `search_only`（2026-11-16・直近30日・検索系 3,079 セッション）。
- Google 1,304（42.4%）／Bing 913（29.7%）／Yahoo! 589（19.1%）／生成AI 248（8.1%）／DuckDuckGo 25（0.8%）。
- つまり **GSC が見えるのは検索系セッションの約 4 割だけ**。Bing+Yahoo+生成AI で約 57%。`blind_spots`: Bing Webmaster Tools の登録は要オーナー操作（未実施）。
- 推移: Bing は 07-27 が 176 で最大だった（Google 50）。Google は 08-27 に Bing を逆転し 11-16 で 1,304。生成AI は 88〜251 の間（11-05 の 208 から 11-16 の 248 へ緩やかに上昇）。
- チャネル別の生成AI: chatgpt.com 165、openai 73+5（`site_metrics.json` `sourceBreakdown`）。

---

## 2. ページ種別の内訳

出所: `gsc_metrics.json` `pageTypes`（全ページ分・28日 10-19〜11-15）と、リポジトリのファイル数。

| 種別 | ファイル数 | 表示がある本数 | クリック1以上の本数* | クリック | 表示 | CTR | 平均順位 | クリック構成比 |
|---|---|---|---|---|---|---|---|---|
| 特集 | 73 | 46 | 21 | 433 | 7,487 | 5.78% | 8.1 | 23.9% |
| ジャーナル | 195（記事193） | 111 | 45 | 398 | 15,090 | 2.64% | 8.2 | 22.0% |
| 店舗ページ | 5,288（うち noindex 143） | 3,152 | 約601 | 948 | 43,850 | 2.16% | 11.3 | 52.3% |
| エリア一覧(ハブ) | 805（うち noindex 656） | 96 | 約15 | 23 | 687 | 3.35% | 15.3 | 1.3% |
| トップ | 1 | 1 | 1 | 10 | 497 | 2.01% | 39.0 | 0.6% |
| その他 | — | 2 | 0 | 0 | 3 | 0 | 5.0 | 0 |

\* 「クリック1以上の本数」は、`pages` が「クリック降順の上位500」で最小クリック 1、残りのクリック合計が 182（1,811−1,629）であることから逆算（500 件の外は各 1 クリック以下）。店舗 428+173=601、ハブ 5+10=15、特集 21、ジャーナル 45。**逆算値であり直接の保存値ではない**。

- **0クリックのページ数（表示ありのうち）**: 店舗 3,152−601＝約2,551、ジャーナル 66、特集 25、ハブ約81。**特集 25 本の 0クリックページは表示合計がわずか約131**（7,487−7,356）。つまり特集 73 本のうち 52 本（71%）は検索にほぼ出ていない。
- 店舗ページ: 約5,280 本中、表示ありは 3,152（約60%）、クリックありは約601（約11%）。表示なしは約2,136 本（sitemap 5,042 本ベースなら約1,890 本）。店舗ページの 1 本あたり最大は 12 クリック。クリック分布（上位500内の店舗428本）: 1 クリック 236本・2 クリック 125本・3 クリック 35本・4 クリック 11本・5 以上 21本。**上位 10 店舗ページの合計 82 クリック＝店舗クリックの 8.6% で、店舗は「薄く広い」構造**。
- **クリックの集中度（全体 1,811）**: 上位1ページ（特集 nagoya-solo-dining）268＝14.8%、上位3ページ 403＝22.3%、上位10ページ 600＝**33.1%**、上位20ページ 712＝39.3%。
- 特集内の集中: solo-dining 1 本で特集クリックの 62%（268/433）。ジャーナル内: 上位3本で 41.5%、上位10本で 69.1%。
- ジャーナルのクリックは**直近2か月に公開した記事が大半**: 公開月別クリック 2026-11:144（11本）／10月:215（19本）／09月:1（1本）／08月:14／07月:3／06月:6／05月:15（上位500内）。公開 2 か月以内で 359/398＝90%。古い記事は少数。
- 順位帯別クリック（上位500ページ内）: 1〜3位 1／4〜10位 1,180／11〜20位 398／21位以下 50。**1〜3位ほぼゼロ**＝上位表示ではなく 1 ページ目の中下位でクリックを得ている。

---

## 3. 上位記事と流入キーワード

### 3-1. クリック上位20ページ
出所: `gsc_metrics.json` `pages`（28日）。主なクエリは `pageQueries` がある 16 ページの範囲のみ。

| # | ページ | クリック | 表示 | CTR | 順位 | 主なクエリ（クリック/表示） |
|---|---|---|---|---|---|---|
| 1 | features/nagoya-solo-dining | 268 | 3,139 | 8.5% | 6.1 | 名古屋 一人飲み 57/325、名古屋 1人飲み 22/156、〃 男 9/92 |
| 2 | journal/11-08 もちり（圧釜うどん） | 73 | 2,879 | 2.5% | 7.3 | 圧釜うどん もちり 11/293、〃栄店 5/98（すべて店名） |
| 3 | journal/10-26 ビストロ ディア | 62 | 514 | 12.1% | 7.2 | bistro dia 13/77、ビストロダイア 久屋大通 6/23（店名） |
| 4 | features/date | 48 | 626 | 7.7% | 9.9 | 名古屋 ご飯 デート 7/15、名古屋 ディナー デート 6/25 |
| 5 | features/nagoya-tebasaki | 33 | 1,636 | 2.0% | 6.8 | 風来坊 やまちゃん 2/52 等（クエリ合計10＝大半が匿名） |
| 6 | journal/10-13 ひものや官兵衛 | 30 | 1,235 | 2.4% | 7.5 | ひものや官兵衛 伏見 9/378（店名） |
| 7 | journal/10-18 さく蛸 | 30 | 1,651 | 1.8% | 8.5 | さく蛸 黒川 9/633（店名） |
| 8 | features/nagoya-autumn-2026 | 22 | 164 | 13.4% | 6.3 | 秋 外食 おすすめ 1/1（クエリ上は 1 のみ） |
| 9 | journal/11-03 アメリ | 20 | 195 | 10.3% | 4.9 | クエリ上 1 クリックのみ（匿名化が多い） |
| 10 | features/nagoya-miso-nikomi-udon | 14 | 926 | 1.5% | 11.3 | 山本屋本店 総本家 違い 3/458 |
| 11 | journal/11-05 定番チューン | 14 | 639 | 2.2% | 9.5 | 定番チューン 11/191 |
| 12 | journal/11-10 ススル | 13 | 525 | 2.5% | 7.3 | ススル 東別院 1/4 等 |
| 13 | journal/10-12 街仲食堂 | 12 | 309 | 3.9% | 7.7 | なかがわ 街仲食堂 1/8 |
| 14 | stores/J004612794（ナショナルベーカリー） | 12 | 392 | 3.1% | 9.7 | 店名各種 |
| 15 | journal/10-24 ハウスオブモン | 11 | 267 | 4.1% | 7.2 | ハウスオブモン 名古屋 2/36 |
| 16 | stores/J004576448 | 11 | 615 | 1.8% | 8.4 | — |
| 17 | トップ | 10 | 497 | 2.0% | 39 | 店名等 |
| 18 | journal/05-31 grill-tsubaki | 10 | 111 | 9.0% | 6.3 | — |
| 19 | journal/10-30 hisaya-taichung | 10 | 111 | 9.0% | 6.6 | — |
| 20 | features/kospa-insider | 9 | 152 | 5.9% | 8.1 | — |

### 3-2. クエリ上位30（`queries`）
上位から: 名古屋 一人飲み 57／名古屋 1人飲み 22／bistro dia 13／定番チューン 12／圧釜うどん もちり 11／さく蛸 黒川 9／ひものや官兵衛 伏見 9／名古屋 1人飲み 男 9／名古屋 ご飯 デート 7／名古屋 一人飲み 男 7／名古屋一人飲み 7／bistro dia /salon de m 6／ビストロダイア 久屋大通 6／一人飲み 6／一人飲み 名古屋 6／名古屋 ディナー デート 6／名古屋 デート ディナー 6／名古屋1人飲み 6／名古屋駅 一人飲み 6／じゃんけんポーカー今池店 レビュー 5（表示 2,025・CTR 0.25%）／やきまる亭 5／一魚魚一 はなれ 5／名古屋 1人飲み おすすめ 5／名古屋 女子会 5／名古屋駅 ディナー デート 5／圧釜うどん もちり 栄店 5／雪月花 名古屋 閉店 5／1人飲み 4／かえるの九八郎 4／しゃぶしゃぶいちばん 名駅南店 4。

### 3-3. 意図別のクリック割合
**(a) 5,000 クエリ全体（`intent.summary`・クエリが見えるクリック 1,139 件）**。分類は `scripts/gsc_query_intent.js`（辞書 `data/journal_seo_keywords.json` 2026-09-14、店名辞書 `stores.json`）。分類は 3 区分（navigational／discovery／other）で、ご依頼の 5 分類とは違う。

| 区分 | クエリ数 | 表示 | クリック | クリック割合 | CTR | 順位 |
|---|---|---|---|---|---|---|
| 店名（指名・navigational） | 3,121 | 23,659 | 747 | **65.6%** | 3.16% | 11.3 |
| ジャンル×エリア／シーン（discovery） | 270 | 2,367 | 226 | **19.8%** | 9.55% | 8.8 |
| その他 | 1,609 | 9,204 | 166 | 14.6% | 1.80% | 11.4 |

- discovery は表示シェア 6.7% なのにクリック割合 19.8%。**CTR は店名の約 3 倍**（9.55% vs 3.16%）。

**(b) 上位300クエリ（クリック 748）を私が 5 分類に分け直した結果**（同じ判定器の `classifyOne` を使用。`scene:` を含む＝シーン、エリア語×ジャンル語のみ＝ジャンル×エリア）:

| 分類 | クエリ数 | クリック | 割合(748比) |
|---|---|---|---|
| 店名（指名） | 238 | 467 | 62.4% |
| シーン（一人飲み・デート・女子会等） | 29 | 202 | 27.0% |
| ジャンル×エリア | 3 | 5 | 0.7% |
| 新店・話題系の語（新店/オープン/話題/閉店） | 1（閉店 1 件） | 5 | 0.7% |
| その他 | 29 | 69 | 9.2% |

- **シーンのクリックの 77% が「一人飲み」系**（一人飲み/1人飲み/ひとり飲み の 19 クエリで 156 クリック・表示 1,273）。デート系は 7 クエリ 36 クリック、女子会 5、接待/宴会/個室/忘年会 2。
- **ジャンル×エリアのクリックはほぼゼロ**（3 クエリ 5 クリック）。例: 「焼肉 名駅西」表示41・クリック0・順位 43.8、「焼肉 南区浜田町」表示36・クリック0。
- **新店・話題系のクエリでの流入は取得データ上ほぼ無い**（「新店」「オープン」「話題」を含む上位300のクエリは 0 件。「雪月花 名古屋 閉店」が 5 クリック）。
- 分類の限界: 「その他」29 件のうち「さく蛸 黒川」(9)「雪月花 名古屋 閉店」(5)「ビストロダイア」(4)「ワイン蔵厨房 cave」(4)「もちり」(3)など**実際は店名のクエリが辞書に載らず「その他」に落ちている**。店名の割合は実際は上の値より高い。

---

## 4. 検索意図との一致

- ページ別クエリのある 16 ページで、クエリ意図とページ種別の対応（クリックの内訳）:
  - **特集 solo-dining（268 クリック）**: クエリはすべて discovery（一人飲み）。意図と一致。ここがサイトで唯一「シーン検索を特集が受けている」例。特集 date も discovery（デート 38 クリック）で一致。
  - **ジャーナルは店名クエリを受けている**: ビストロ ディア（navigational 28）、もちり（34）、定番チューン（12）、ひものや官兵衛（18）、ハウスオブモン（7）。すなわち **店名で検索した人が、その店の「店舗ページ」ではなく「ジャーナル記事」に着地している**（例: 「bistro dia」→ ジャーナル 10-26 に 13 クリック、順位 8.8。店舗ページ側は同クエリで出ていない）。店舗ページ側 stores/J004612794 は店名クエリ（navigational 9）で着地しているので、店舗ページが検索で勝つ店と、記事が勝つ店が混在。
  - 特集 nagoya-miso-nikomi-udon の主要クエリは「山本屋本店 総本家 違い」（店名比較）。特集 nagoya-tebasaki は「風来坊 やまちゃん」（店名）。ジャンル特集が店名クエリを拾っている。
  - ジャンル特集（焼肉・焼鳥・バー等）は一覧上でクリックほぼ無し（項目5）。
- GSC 全体の **CTR 修正候補**（`gsc_opportunities.json`・28日）: ctr_fix クエリ 1 件（「じゃんけんポーカー今池店 レビュー」表示 2,025・クリック 5・順位 7.7・期待 CTR 3.4%・取りこぼし推定 64.6 クリック）＋地名なし 2 件（ひものや官兵衛 伏見／さく蛸 黒川）。ctr_fix ページ 5 件（手羽先特集・もちり・さく蛸・ひものや官兵衛・ススル。取りこぼし推定 35.7／35.1／19.5／14.4／6.7）。**rank_push（2〜3ページ目で高表示）はクエリ 0 件、ページ 1 件のみ**（nagoya-miso-nikomi-udon・順位 11.3・表示 926・上乗せ推定 11.9 クリック）。**つまり「順位を少し上げればクリックが伸びる」候補自体が少ない**。
- ホームページへの検索流入: 順位平均 39 位・クリック 10・クエリは店名中心（`homeQueries`）。

---

## 5. 記事の重複・類似（カニバリ）

- 同じクエリで複数ページが出ている例: ページ別クエリのある 16 ページでは「bistro dia」が ジャーナル 10-26（13/75・順位 8.8）とジャーナル 11-03 アメリ（0/1）の 2 ページ。**カニバリが顕在化している実害は確認できていない**。ただし `pageQueries` が 16 ページ分しかなく、全体の検証はできない（取得不可。ページ×クエリの全件が要る＝GSC API の `page`×`query` 取得で追加取得は無料・要 `fetch_gsc_metrics.js` の取得対象拡張）。
- 特集の同ジャンル 2 本組（出所: `gsc_metrics.json` `pages`・28日。0 クリックのページは上位500の外なので「クリック0（表示は不明）」）:

| 組 | 結果 |
|---|---|
| nagoya-yakiniku / nagoya-yakiniku-guide | **両方クリック0** |
| nagoya-yakitori / nagoya-yakitori-guide | yakitori 2 クリック（表示64・順位12.9）／guide 0 |
| nagoya-bar / nagoya-bar-guide | **両方クリック0** |
| nagoya-izakaya / nagoya-dining-bar | 両方 0 |
| nagoya-sushi-guide / nagoya-seafood | 両方 0 |
| 接待系 5 本（concierge・lunch・secret・settai-guide・meieki-business-dinner） | **5 本全てクリック0**。ADR 0007 の「6 本で 26 表示・0 クリック」と同じ |
| 一人飲み系（solo-dining 268／meieki-hitori-nomi 4／sakae-hitori-nomi 0／kanayama-hitori-nomi 0） | 親（solo-dining）に集中。エリア別 2 本は 0 |
| birthday / birthday-surprise | 0／4（表示24・順位18.8） |
| 業界系（industry-insiders-pick 0／industry-pick-izakaya 3／dining-professionals 0／kospa-insider 9） | 低調 |
| banquet / large-group / enmkai-kanji | 全て 0 |

- 結論: **特集 73 本のうち、クリックのある 21 本の大半（nagoya-solo-dining と date の 2 本で 73%）。ジャンル別の「ガイド」と通常版の 2 本組は、どちらもほとんど検索で拾われていない**。順位が 1 ページ目に入っている特集は solo-dining・date・tebasaki・autumn の 4 本ほど。
- ジャーナル同士の類似: 取得データでは判定不能（`pageQueries` 不足）。

---

## 6. インデックス状況

### 6-1. 標本調査（Google URL Inspection）
出所: `data/index_probe.json`（調査日 2026-11-16 00:17Z・標本 251 URL・履歴 33 日 2026-10-14〜11-16）。標本は 10-14 に固定した見本（`index_probe_urls.json`）。

| 群 | 標本 | インデックス済(PASS) | 率 | 内訳 |
|---|---|---|---|---|
| 店舗（トップから辿れる・対照 control_store） | 100 | 81 | **81%** | 「クロール済み・インデックス未登録」19 |
| 店舗（I-25 でトップからのリンクが無くなる群） | 100 | 85 | **85%** | 同 15 |
| ジャーナル | 20 | 19 | 95% | 未認識 1 |
| ハブ（エリア一覧） | 30 | 3 | 10% | 「noindex 除外」13・「URL が Google に認識されていません」14・登録 3 |
| トップ | 1 | 1 | 100% | |

- 推移: 店舗 control は 10-14 に 96/100 → 10-23 に 68/99 → 10-31 に 77/100 → 11-08 に 82/100 → 11-16 に 81/100（10-23 の下落から回復、10-14 の水準には戻っていない）。ハブ標本は 10-14 に 1/30 → 11-16 に 3/30。
- ハブの標本 30 は **noindex 化前に選んだ見本**（13 本が今は noindex）で、現在 indexable な 149 本の代表ではない。
- 標本誤差: 100 件中 81 の場合、95% 区間はおよそ ±8 ポイント（72〜88%）。全 5,145 本（5,288−noindex 143）に当てはめた推定インデックス済み店舗は約 4,200 本（概算・区間 3,700〜4,500）。

### 6-2. noindex と sitemap
出所: `grep` と `sitemap.xml` の `<loc>` 集計（2026-11-16 のワークツリー）。

| 種別 | ファイル数 | noindex | sitemap 掲載 |
|---|---|---|---|
| 店舗ページ（stores/*.html） | 5,288 | 143（`noindex,follow`・ADR 0063・現役でない旧店舗） | 5,042 |
| ハブ（stores/area/**） | 805 | **656（81.5%）** | 149 |
| 特集 | 73 | 0 | 73 |
| ジャーナル | 195 | 0 | 194 |
| ルート直下 | — | 404.html・privacy-policy.html | `about.html` 1 ＋ トップ 1 |
| 合計 | — | 801（stores 143＋ハブ 656＋root 2 ＝ 801） | 5,460（sitemap.xml） |

- `sitemap-index.xml`: sitemap.xml と sitemap-images.xml（画像 4,900 件）の 2 本。
- ハブ noindex は 11-12 の KPI メモ時点で 498、現在 656 と増えている（`docs/kpi-weekly.md` 11-12 記載 vs 実ファイル）。
- `data/noindex_candidates.json`（10-25・127 候補・A9/B118）は「今回は実施しない・12-15 に再判断」（`docs/kpi-weekly.md` 11-12）。`store_page_orphans.json` は孤児 143（アクティブスラッグ 5,041）。`indexnow_state.json` は更新済み（IndexNow は Bing 向け配信）。

---

## 7. 構造化データ

出所: 実ファイルの JSON-LD を全件パース（`stores/`・`stores/area/`・`features/`・`journal/`）。index.html は grep のみ。

| 種別 | 本数 | 使っている型 |
|---|---|---|
| 店舗 | 5,288 | **Restaurant** 5,182・BreadcrumbList 5,183・`sameAs` 付き 5,039・`geo` 付き 18（Restaurant 無しの 106 本は一覧 CollectionPage 1 本＋転送ページ等と思われる。内訳は未確認） |
| ハブ | 805 | ItemList 776・BreadcrumbList 786・CollectionPage 11 |
| 特集 | 73 | **Article 71**（author＝Organization 71・datePublished 71・dateModified 71）・ItemList 65・BreadcrumbList 73・CollectionPage 1・Service 1（offers 1） |
| ジャーナル | 195 | **BlogPosting 194**（author＝Organization 194・datePublished/dateModified 194）・BreadcrumbList 195・FAQPage 3・Blog 1 |
| トップ（index.html） | 1 | JSON-LD 5 ブロック: WebSite 2・Organization 2・ItemList 1・BreadcrumbList 1・Place 5・City 1・WebPage 1・ImageObject 2（grep のため概数） |

- **評価（aggregateRating）はどこにも出していない**（店舗・トップ・特集・ハブ全て 0）。Review 型も 0。ADR 0009-structured-data-third-party-ratings（2026-10-09）で、Google の口コミ集計を `aggregateRating` に入れないと決定（Google ガイドライン "Don't aggregate reviews or ratings from other websites"）。**画面の★と口コミ件数は残し、構造化データだけ外す**。口コミ信頼度は `additionalProperty`（評価の集計ではない）。当サイトの読者から評価を集める仕組みは作らない方針。
- **author は Organization**（個人・Person ではない）。`citation` は 0（特集・ジャーナルともに無し）。`mentions` も無し。`dateModified` は有るが 項目9 のとおり一括更新が混ざる。Article の `about`・`image`・`inLanguage` は特集にあり（キー: headline, description, author, publisher, url, datePublished, dateModified, image, inLanguage, about）。
- **FAQPage**: 特集 0（ADR 0025-features-no-faqpage・2026-10-13・64 本から削除）、ハブ 0（SEO-124）、ジャーナル 3、トップ・faq.html にあり。ADR 0007 で FAQPage とサイトリンク検索ボックスへの投資を「やらないこと」に指定。SearchAction は外した（ADR 0009）。
- 店舗の Restaurant のキー: name, servesCuisine, address, image, url, description, priceRange, openingHours, acceptsReservations, sameAs。`telephone` なし・`aggregateRating` なし・`menu`/`hasMenu` なし。
- トップは ADR 0029（見える事実だけ）で整理済み。

---

## 8. 読者の回遊と店舗への遷移（GA4）

### 8-1. 取れている数字
出所: `site_metrics.json`（30日・11-16）、`store_referrals.json`（30日）、`docs/qa/uiux-2026-10/baseline/ga4-2026-10-12-before-28d.json`（09-13〜10-10・店舗ページ欠測日を含む）。

- 1訪問あたり閲覧: 1.15（11-16・汚染込み）／1.28（11-09）。基線 10-12: 1.22。**健全値 2.0 に届いていない**。
- 直帰率: 0.305（11-09）／基線 0.287／0.667（11-16・汚染）。エンゲージメント率 0.713・1 セッションあたりエンゲージ時間 43.8 秒（基線）。平均セッション 112 秒（11-09）→ 57 秒（11-16・汚染込み）。
- チャネル別 CTA クリック率（outboundClicks/sessions）: 全体 5.3%（outbound 404）、organic 9.8%、direct 1.2%、social 21.7%（`site_metrics.json` `cta`）。**直接のセッション増は CTA を押さない**。
- **予約・地図・電話（`store_referrals.json`・30日）**: 予約送客 165（ホットペッパー148・食べログ17）、電話 7、地図 135（63 店。圧釜うどん もちり 栄店23・うな祥22）。電話番号の取得 6 回すべて成功。予約成立は計測しない（ADR 0009-reservation-measurement-tiers）。予約申告 yes 0／no 2。現在地ボタン 0 回。
- **遷移元ページ**（`site_metrics.json` `cta.byPage`・outbound）: ジャーナル 10-26 ビストロ ディア 59（prtimes.jp 47・google 11）、ジャーナル 11-08 もちり 29、stores/J004090251 22、features/nagoya-kaoawase-washoku 13（tabelog）、トップ 11、solo-dining 11。outbound の外部ドメイン: ホットペッパー 138・Google 128・PR TIMES 49・食べログ 41・Instagram 24。
- **記事→店舗への遷移**: 基線（09-13〜10-10）で `feature_store_click` 170 回／123 セッション、`outbound_click` 139／84、`modal_open` 56／21、`cta_click` 45／30、`internal_link_click` 25／18、`cta_gmap_click` 22／18、`hub_store_click` 3／3、`cta_reserve` 5／5。（11-16 時点の再取得は未保存。`journal_store_click`・`related_click` はリポジトリ内に基線値なし。）`view_counts.json` の modal_open は 50 件（30日）で店ごとに 1〜3 回。
- 検索流入の「質」: **検索流入のうち CTA を押す割合は organic 9.8%**。
- 計測イベント（`gtag`/`trackEvent` を grep・実コード）:
  - index.html: search・sort_change・modal_open・outbound_click・filter_apply・fav_add・fav_remove・share_x・share_line・share_copy・reel_play・internal_link_click・geo_search・zero_result・feedback_open・feedback_submit、cta 系（cta_click/cta_reserve/cta_call_click/cta_gmap_click）、reserve_report_yes/no。
  - 特集: feature_store_click・feature_cta_click・internal_link_click・feature_body/related/faq/journal・**scroll_depth（25/50/75/100% 到達）**。
  - ジャーナル: journal_store_click・journal_related・journal_index・**scroll_depth**。店舗ページ（gen-store-pages.js）: cta_click・cta_gmap_click・feature_store_match・feature_counts・internal_link_click（`scroll_depth` は店舗ページに無し）。`assets/js/store-link-tracking.js`: outbound_click。
  - scroll_depth のあるページ: 特集 73/73・ジャーナル 195/195・店舗 0。

### 8-2. 取れていない／未計測
| 項目 | 状態 | 取るのに必要なもの |
|---|---|---|
| **再訪問率（新規 vs リピート）** | **未計測（リポジトリに値が無い）**。GA4 側には `newVsReturning` 等があるが、取得スクリプト（`scripts/fetch_ga4_views.js`・`ga4_baseline.js`）が要求していない | 取得クエリに `newVsReturning` / `firstSessionDate` 等を足す（コード修正のみ・GA4 API は無料・既存のサービスアカウントで可） |
| **記事ごとの滞在時間** | **ページ別の `userEngagementDuration` は基線では取得（`pages` 項目）しているが、日次の `site_metrics.json` には保存していない**（保存は合計の avgSessionDuration のみ） | 日次取得にページ別の滞在を足す |
| **スクロール深度** | **イベント（scroll_depth）は特集・ジャーナルに実装済みだが、集計値はリポジトリに保存されていない**（基線の `eventSessions` の対象 `L.EVENTS` に scroll_depth が入っていない） | `L.EVENTS` に scroll_depth を足して取得。GA4 のカスタムディメンション `percent` の登録が要るか未確認（登録は無料・GA4 管理画面の操作＝オーナー操作） |
| **「役に立った」評価** | **未実装（計測もUIも無い）**。近いものは `reserve_report_yes/no`（予約したか）だけで、記事への満足度ではない | UI 追加（index.html／記事テンプレ）＋イベント。匿名・個人情報なしで可。ただし制約1（ファイル追加禁止）・デザイン系統の制約あり |
| 記事→店舗ページの遷移の最新値 | 基線 10-12 のみ。日次保存なし | 日次取得にイベント別・ページ種別別を足す |
| Bing・Yahoo の検索語 | 未取得（GSC は Google のみ）。Bing Webmaster 未登録 | Bing Webmaster Tools 登録（無料・オーナー操作・`blind_spots`） |
| 生成AI 経由の引用状況（どの質問で引用されたか） | 未取得 | 公開手段なし。セッション数のみ（248）が取れる |

---

## 9. 既存記事の更新状況

出所: 特集 `features/*.html` 全 73 本と、ジャーナル 193 記事の JSON-LD（`datePublished`/`dateModified`）、`git log -1 --format=%cs`（特集のみ全数・読み取り）。基準日 2026-11-16。

### 特集 73 本
| 指標 | 7日以内 | 8〜30日 | 31〜89日 | 90日以上 | なし |
|---|---|---|---|---|---|
| dateModified | 23 | 32 | 6 | **10** | 2 |
| git 最終コミット | 73 | 0 | 0 | 0 | 0 |

- **git の最終コミットは全 73 本が 11-13〜11-16**。11-12〜11-13 に特集全本へ及ぶ一括変更（フッターのホットペッパー表記・X フォロー1行・og:image・構造化データなど）が入ったため。**実質的な内容更新の指標にならない**。
- dateModified の月別: 2026-11:53（うち 11-01 に 30 本・11-13 に 21 本・11-12 に 2 本＝**一括更新の塊**）／10月:5／08月:4／07月:2／05月:6／04月:1。
- datePublished 月別: 4月:19／5月:45／6月:1／8月:1／9月:1／10月:2／11月:2（**特集の約 88%（64/73）は 4〜5 月に公開**）。dateModified≠datePublished は 59 本。
- **dateModified が 90日以上前の特集は 10 本。そのうちクリックのある 5 本**: nagoya-tebasaki 33（dateModified 07-28。手羽先は表示 1,636・CTR 2.0% の ctr_fix 候補）／nagoya-kaoawase-washoku 4（07-25）／nagoya-industry-pick-izakaya 3（05-08）／nagoya-kakuozan 1（05-15）／no-fake-reviews 1（08-18）。（※ 07-28 は基準日から 111 日。）
- ジャーナル更新: 193 記事の公開月別本数（dateModified≠datePublished の本数）: 4月 11（1）／5月 35（3）／6月 27（1）／7月 12（1）／8月 31（5）／9月 30（1）／10月 31（0）／11月 16（0）。**合計 12 本のみが公開後に更新**（約 6%）。公開ペース: 約 30 本/月、4 月の 11 は開始月の端数。

---

## 10. 効果を前後比で見分けられる規模の目安

方法: 「同じ表示回数 n の 2 つの期間（前後）で、クリック率 p を二項分布（クリックは独立）と仮定した差の検定」。差の標準誤差 = √(2p(1−p)/n)。検出力 50% 相当（片側の臨界値 1.96）と検出力 80%（1.96+0.84）の「必要な相対変化」を計算。期間は 28 日同士（表示 n は現行 28 日値を使用）と、7日同士（n を 1/4）。**実際には、順位の変動・検索語構成・季節・11-06 のような異常値が加わって分散はこの近似より大きく、ここの数字は下限（最良の場合）**。

| 対象 | 28日 表示 | 28日 クリック | CTR | 28日vs28日: 偶然と区別できる相対変化（検出力50%/80%） | 7日vs7日（検出力80%） | 週あたりクリック |
|---|---|---|---|---|---|---|
| 全体 | 67,326 | 1,811 | 2.69% | 6%／9% | 18% | 453 |
| 店舗ページ全体 | 43,850 | 948 | 2.16% | 9%／13% | 25% | 237 |
| ジャーナル全体 | 15,090 | 398 | 2.64% | 14%／20% | 39% | 100 |
| 特集全体 | 7,487 | 433 | 5.78% | 13%／18% | 37% | 108 |
| 発見型クエリ全体 | 2,367 | 226 | 9.55% | 18%／25% | 50% | 57 |
| 上位特集 1 本（solo-dining） | 3,139 | 268 | 8.54% | 16%／23% | 46% | 67 |
| ジャーナル 1 本（典型・表示約 525／13 クリック） | 525 | 13 | 2.48% | 76%／108% | 217% | 3 |
| ハブ全体 | 687 | 23 | 3.35% | 57%／81% | 162% | 6 |

- 読み方: **特集・ジャーナルの「群」の CTR は 28 日同士で相対 +20% 前後（検出力 80%）動かなければ偶然と区別できない。ジャーナル 1 本・ハブ・個別特集の小さな変更は 28 日でも +76% 以上でないと偶然と区別できず、事実上測れない。** 店舗ページ全体なら 13% 程度の変化まで検出できる。
- 既存の実例: SEO-137（ジャーナル題の書き換え）の比較は、書き換え対象 15 本 の CTR 1.85%（表示 2,001）→ 現在の見える 7 本 1.02%（表示 2,159）、参照群 5 本 7.08% で、**この規模でも結論は出ていない**（`journal_title_experiment.js --report`。順位も 8.97 → 9.48 で変化、7 本は上位500から外れ 8 本が欠測＝比較が崩れている）。Ondine #1066（題・説明文の書き直し 6 本）は止める条件（CTR 2.28% → 1.69%・表示ベース 5,087 → 6,435、クリック 116 → 109）に当たり **11-13 に元へ戻された**（`search_ctr_rewrites.json` ondine-1066 `result`。手羽先特集だけは 1.62% → 1.80% で上がっていたが一緒に戻した）。
- 実務上の目安: 前後比で見るなら (1) 28 日以上、(2) 群で数十本以上まとめて変更、(3) 順位・クエリ構成を揃える（順位が 1 ポイント変わると CTR は数十%動く）、(4) 11-06 のような異常日を除外（0-A）。

---

## 付録: 参照ファイル一覧
- `data/gsc_metrics.json`（取得 2026-11-16T10:56Z、期間 10-19〜11-15）、`data/gsc_opportunities.json`、`data/search_channel_metrics.json`、`data/site_metrics.json`、`data/metrics_history.json`（120 日）、`data/store_referrals.json`、`data/view_counts.json`、`data/index_probe.json`、`data/index_probe_urls.json`、`data/noindex_candidates.json`、`data/store_page_orphans.json`、`data/journal_title_experiment.json`、`data/search_ctr_rewrites.json`、`data/measurement_changes.json`、`docs/kpi-weekly.md`（11-12 チェックポイント）、`docs/qa/uiux-2026-10/baseline/ga4-2026-10-12-before-28d.json`、ADR 0007・0009（2 本）・0025・0029・0063。
- 集計スクリプト（私が書いた一時スクリプト・リポジトリ外）: `/private/tmp/claude-501/-Users-katagirijakutou-orca-workspaces-nagoya-bites-pilotfish/2a312aaa-1101-4b18-b1f4-99b843c5e6cf/scratchpad/` の `q.js` `pq.js` `ld.js` `upd.js` ほか。
- 未読・未確認: `effect_ledger.json` は個別施策の基線で、今回の集計には使っていない（`docs/seo-traffic-inventory-2026-10.md`・`growth-plan-2026-q4.md`・`seo-strategy-2026-10.md` も全文は読んでいない）。internal link 監査スクリプト（`audit_internal_links.js`・`refresh_journal_related.js`・`lib/related_stores.js`）は実行せず、内部リンク数の集計はしていない。
