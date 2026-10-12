# NAGOYA BITES デザインシステム

正本チェーン: `data/design_system.json`（機械判定）→ `assets/css/nb.css`（実装）→ このファイル（人向け仕様）。
役職・運用は `agents/designer.md` 参照。背景・実測データは agent-backlog.md の `[DSN-001]` 参照。

---

## 1. なぜ刷新したか

2026-09-03、オーナー本人から「サイトが見にくい。文字が小さい、一画面の情報量が多い、字体が合っていない」
という指摘があり、本番サイトを実測したところ裏付けられた。

- トップページの可視文字の **76%が12px以下**
- モバイル1画面目に **888文字**（新聞の見出し欄より情報が多い）
- 検索結果の店舗カード1枚に **22個のテキスト要素**
- 見出し書体（Cormorant Garamond）に日本語フォールバックがなく、日本語部分はOS任せの明朝に落ちていた

刷新の目標は「読める・静か・揃う」の3つ。

---

## 2. 書体

| 役割 | スタック | 読み込みウェイト | 用途 |
|---|---|---|---|
| 見出し（display） | `'Cormorant Garamond','Shippori Mincho','Hiragino Mincho ProN','Yu Mincho',serif` | Cormorant 400/500/600＋italic 400、Shippori 500/600 | hero h1・セクション h2・モーダル店名・記事タイトル |
| 本文・UI | `'Noto Sans JP','Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic',sans-serif` | 400/500/700 | それ以外すべて |
| 等幅 | `'DM Mono',ui-monospace,Menlo,monospace` | 400/500 | 順位・件数・日付など数字と3語以内の欧文のみ。**日本語には使わない** |

Cormorant Garamond と Shippori Mincho を組み合わせているのは、両方とも線のコントラストが高い
オールドスタイル系の書体で、同じ行に混在しても「一つの声」に聞こえるため。

---

## 3. do / don't

**do**
- 日本語は Noto Sans JP、`letter-spacing:0`
- 意味を持つラベルは日本語（サイト全体の方針）で 13px 以上
- 操作要素（ボタン・リンク・チップ）は 44px 以上。高さは `min-height:var(--tap-min)` で指定する。`div` に委譲クリックを付けた部品（タグ・ジャンルのチップなど）も同じ（`button` / `a` だけを数えると見落とす）。見た目を変えたくない丸ボタン・ロゴ・ヘッダーのナビは、`::after` / `::before` で透明な当たり判定だけを広げる（`display:inline-flex` にすると、ロゴの語の間の空白が消える）。文中のリンクは対象外（WCAG 2.5.8）。確認は `node --test tests/index_tap_and_size.test.js`（トップの CSS・I-26e）
- 読む文字は 13px 以上（`var(--fs-xs)` 以上）。`var(--fs-2xs)`（12px）は写真クレジット・法的表示だけ。トップの CSS に 13px 未満の指定は置かない（同じテストが見る）
- font-size はすべてトークン（`var(--fs-*)`）を参照する
- 文字色のトークン（`--text`・`--ink`・`--muted`・`--dim`・`--gold`・`--gold2`）は、小さい文字に必要な 4.5:1 を、載る背景（`--bg`・`--bg2`・`--surface`・`--card`）のどれの上でも満たす（`--gold2` は `--surface` の上に置かない）。値を変える日は `node --test tests/design_tokens_contrast.test.js` が通ることを確かめる（I-26c・WCAG 2.1 AA 1.4.3）
- 見出しの段を飛ばさない（h1 → h2 → h3。h1 の次に h3、h2 の次に h4 を置かない）。見出しを持たない節（日次ジャーナルの店の一覧など）は、見えない h2（`class="visually-hidden"`）で節にする。確認は `node scripts/audit_heading_levels.js --check`（I-26f・夜間QA の soft）

**don't**
- font-size のリテラル値を新規に書かない（`12px` や `.8rem` を直接書かない）
- `:root` を再定義しない（nb.css の値を上書きしたい場合は `--page-` 接頭辞の新トークンを足す）
- 日本語に等幅フォントや `text-transform:uppercase` を使わない（トップの CSS は `tests/index_mono_font.test.js` が、等幅の規則は数字・記号・欧文だけを出す表のセレクターに限ることを静的に見る。実ブラウザでは `node docs/qa/uiux-2026-10/dmmono.js` が状態ごとに数える）
- 英語と日本語で同じ意味の見出しを二重に出さない
- 読み込んでいないフォントウェイトを指定しない（許可: 400/500/600/700）

### 本文中の強調（DSN-004・2026-09）

journal / features の本文（`.art-body` / `.content`）が地の文だけで続くと読みにくいという
オーナー指摘を受けて追加。太字・マーカー・色・文字サイズの4種を用意し、要点にだけ絞って使う。

| 用途 | マークアップ | 見え方 |
|---|---|---|
| 事実・数字を強く見せる | `<strong>` | `var(--ink)` の黒 + font-weight 700 |
| その段落の結論を読み飛ばされないようにする | `<mark>` | gold のうっすらしたハイライト背景 |
| 判断軸・キーワードを地の文の色で目立たせる | `<span class="art-accent">` | `var(--gold2)` の文字色 + 600 |
| 価格・数量など見出し級に見せたい数字 | `<span class="art-num">` | 表示体（Cormorant Garamond）+ `var(--fs-lg)` + `var(--gold2)` |

**do**
- 1段落につき強調は1〜2箇所まで。効かせたい要点（数字・判断・結論）だけに絞る
- `<mark>` はその段落の「結論の一文」にのみ使う。複数使うと目が迷う
- 色はすべて `var(--gold2)` 系（サイトの唯一のアクセントカラー）。強調のたびに違う色を足さない

**don't**
- ほぼ全文を太字/マーカーにする（強調が効かなくなる = 何も強調していないのと同じ）
- 新しい色（赤・青など）を強調用に持ち込む。CTA配色（予約=gold、地図=blue）と混同させない
- font-size をリテラルで書く。`.art-num` 以外で文字サイズを変えたいときは既存トークンを使う

実装は `assets/css/nb.css` の `.art-body strong,.content strong` 以下（`.art-accent`/`.art-num` 定義の直前）。

---

## 4. 部品の解剖: 店舗カード（検索結果）

```
[写真 4:3]  左上: ジャンル 13px            右上: フラグ1つだけ
            左下: 撮影クレジット 12px       右下: 距離バッジ（距離ソート時のみ）
店名        17px/600 2行クランプ
メタ1行     エリア・価格帯・評価・信頼度を1行に
リード      14px/1.7 2行（編集部/業界人/プロの目利き、いずれか1つの接頭辞）
CTA         44px 予約 or 地図
media行     アイコンのみ、aria-labelでラベル維持
```

フラグの優先順位: 話題沸騰 > 注目上昇中/じわじわ人気 > 編集部推薦 > 業界人N名推薦 > プロの目利き。
実装は `index.html` の `buildCardHtml` 関数を参照。

### 店舗ページのエリア名・ジャンル名（I-14e・2026-10）

```
トップ › 錦・伏見・丸の内の居酒屋 › 店名          ← 行き先のハブの見出しと同じ（以前は「栄ｷﾀ錦/伏見丸の内/泉/東桜/新栄の居酒屋」）
エリア  愛知県 名古屋市 錦・伏見・丸の内
← 錦・伏見・丸の内の居酒屋をもっと見る
```

- 店舗ページに見えるエリア名・ジャンル名は、行き先のハブ（`stores/area/…`）の見出し「エリアのジャンル」と同じ名前にする。出す場所は4か所: パンくず・「もっと見る」・BreadcrumbList の名前・基本情報の「エリア」。見える文字と構造化データを食い違わせない。
- 名前の表は `scripts/lib/area_genre_pages.js` の `normalizeArea` / `normalizeGenre` の1本（正本は `data/area_genre_pages_policy.json` の `areas[].label`・`genres[].label`）。店舗ページの生成器に別の表を持たない。新しい地域名を拾うときは、方針ファイルの `match` に足す（スクリプトは触らない）。
- 例外1: 行政区の名前（「名古屋市中区」「西区」）は基本情報で元の表記のまま。元の表記がそのまま読めて、ハブの名前（「栄」など）より細かい。
- 例外2: どちらのハブにも当たらない店は、基本情報は元の表記のまま、「もっと見る」は「○○をもっと見る」（ジャンルだけ）。行き先がトップのジャンル絞り込み（エリアの条件は付かない）なので、文字にもエリア名を入れない。
- `<title>`・説明文のエリア名は別の表（`scripts/lib/area_label.js`）。検索結果での見え方のために整えてあるので、ここと混ぜない。

### 特集の公開日・更新日・書き手（SEO-145・2026-10）

```
h1（題）
導入文
[部品] 公開 2026年4月15日   更新 2026年10月9日   執筆 NAGOYA BITES 編集部（現役の飲食店マネージャー）
meta 行  2026年版 / 現役飲食店マネージャー監修 / 名駅・栄・金山エリア対応
```

- 見た目は `assets/css/nb.css` の `.nb-byline`。13px（`--fs-xs`）、色は見出しまわりの地色を継承し、不透明度 .8。見出しを中央に寄せた特集でも左に揃える（隣の導入文・meta 行と同じ）。
- 中身は `scripts/lib/feature_byline.js` が JSON-LD の datePublished・dateModified から出す。画面に日付を手で書かない（`docs/decisions/0010-feature-dates-single-source.md`）。
- 更新日は公開日より後のときだけ出す。meta 行が空になった特集では、部品が見出しまわりの最後の行になり、下の余白が meta 行と同じになる（`.nb-byline--end`）。
- 狭い画面では「（現役の飲食店マネージャー）」が1つのかたまりで折り返す（`.nb-byline-note`）。

### 店舗ページの基本情報の行（I-14c・2026-10）

```
[部品] 営業時間        17:00～23:00
       定休日          日曜日、祝日                ← 営業時間の直後
       席数            40席
       宴会の収容人数  30名
       禁煙・喫煙      全面禁煙
       カード          利用可
       駐車場          あり：4台
       アクセス・特徴  …                          ← 最後のまま
```

- 部品は既存の `.info-cell`（ラベル 13px・値 15〜16px）。新しい CSS は無い。
- 中身は `scripts/lib/store_facts.js` の `basicFacts(store)` 1か所。`data/stores.json` の欄の事実だけを出し、欄が空の項目は行ごと出さない。カード・駐車場は「ある」としか持たない欄なので、持たない店で「不可」「なし」にはしない。値の意味は変えず、言い回しだけ整える（「日」→「日曜日」、「20」→「20席」、「あり ：4台」→「あり：4台」）。
- 定休日の欄は、営業時間の変更の案内や宣伝の文章が混ざる。曜日の並び・「なし」・「年中無休」「無休」・「不定休」として読めるものだけ出し、読めない文章は出さない（途中で切って出すこともしない）。「不定休」で始まる文は、案内が続いても「不定休」とだけ出す（「不定休はありません」のように打ち消す文は出さない）。「年中無休」「無休」は「年末年始を除く」のような例外が付くと意味が変わるので、例外つきは出さない。駐車場は、店が書いた但し書き（近隣のコインパーキングなど、店専用でない場合）を落とさない。
- 駐車場の説明は、ビルド（`build.js` の `hpAvailability`）が 60 文字で切って保存している。60 文字に届いた説明は文の途中で切れているので、出さずに「あり」だけにする（切れた文を店の言葉として出さない）。この長さの境目は `store_facts.js` の `SOURCE_CAP` で、テストが `build.js` の `.slice(0, 60)` と同じ値であることを見ている。
- 臨時休業（営業ステータス）は出さない。`data/stores.json` に取得日の欄が無く、数か月前の状態を日付なしで出すとどちらの向きにも誤解させるため。出すときは取得日を通す変更と一緒に決める。
- 行の順番は、定休日が営業時間の直後、そのほか（席数・宴会の収容人数・禁煙・喫煙・カード・駐車場）が電話の位置で、アクセス・特徴の前で終わる。

### 特集の「先に結論」（SEO-122・2026-10）

```
[部品] 先に結論：予算で選ぶなら                       ← 見出し 15〜16px・太字
       まずは気軽に（〜5,000円）                      ← ラベル 13px・金
       店名（店舗ページへのリンク）                    ← 15〜16px・太字・下線
       栄 / ダイニングバー・バル / 4001～5000円        ← 事実 14px
       …（2〜3行）
       下の掲載店から、価格帯ごとに…選んでいます       ← 注記 13px
       エリアとジャンルで探す  [名駅のイタリアン・フレンチ] [錦・伏見の…]   ← ハブへのリンク（高さ44px）
```

- 見た目は `assets/css/nb.css` の `.nb-conclusion`。白地に金の左線で、すぐ下の「選び方のポイント」（`.tips-box`・灰地）と区別する。文字はすべてトークン（13px 以上）。
- 中身は `scripts/apply_feature_conclusions.js` が `data/feature_conclusions.json` の行の条件（価格帯）で、その日の一覧（ItemList）から選んで書く。手で書かない。月次の掲載店の入れ替えにも同じ日のビルドで追従する。
- 店について書くのは `data/stores.json` の事実（エリア・ジャンル・価格帯・個室）だけ。条件に合う店が無い行は出さず、2行未満なら部品ごと出さない。
- 置き場所は `.art-body` の先頭（`<!-- NB_CONCLUSION:START -->` 〜 `END`）。

### 店舗ページの最初の画面の要約（I-14a・2026-10）

```
[居酒屋]                                              ← ジャンルの札（既存）
店名                                                  ← h1
★4.3 （Google・39件） [口コミ信頼度 B]                  ← 出典と件数は 13px・補助の色
栄駅から徒歩3分・予算3001～4000円                       ← 14px・本文の色（1行）
[個室あり] [飲み放題あり] [30名以上の宴会可]            ← 条件のラベル（最大4つ・押せない）
```

- 店名の下の行（`.store-glance`）に、★の隣の出典と口コミ件数（`.score-note`）、駅からの距離と予算を1行（`.store-facts`）、データにある条件のラベル（`.store-chips`）を出す。以前は★が何の評価で何件なのかも、どこにあっていくらぐらいかも、画面を下へ進めないと分からなかった。★の `div`（`.score`）と口コミ信頼度の札（`.ccs-badge`）は従来のまま（構造化データのテストと公開文言の監査が頼る）。
- **出すのは `data/stores.json` の項目から決める事実だけ**。データが無い項目は行ごと出さない（「不明」も「—」も書かない）。評価が無い店に件数だけは出さない。
- 駅名は愛知県内の駅名リスト（`data/station_names.json`・`scripts/lib/station_names.js`）に載っているものだけ出す。8文字で切れた駅名・記号つき・地名が混ざった抽出結果・県外の駅は出さない（間違った駅名を最初の画面に出さない）。旧駅名・通称は今の駅名にそろえる（ハブの最寄り駅の表と同じ）。徒歩が15分を超える店は距離を出さない。
- 予算は価格帯の文字列をそのまま「予算○○」にする（ページの `<title>` と同じ書き方）。
- 条件のラベルはハブ（`stores/area/`）と同じ判定器（`scripts/lib/area_genre_pages.js`）と同じ語（`data/area_genre_pages_policy.json` の `label`）を使う。決め手になりやすい順（個室 → 飲み放題 → 30名以上 → 深夜営業 → ランチ → 日曜営業 → 駐車場 → 全席禁煙 → 食べ放題 → 喫煙できる店）に最大4つ。距離と予算の条件は1行の事実で出ているので繰り返さない。ジャンルも札で出ているので繰り返さない。
- **ラベルは押せない**（リンクにもボタンにもしない）。行き先の無いものを押せそうに見せない。画面の読み上げには `aria-label="この店の条件"` の一覧として伝わる。見た目は `.tag` と同じ（13px・枠線・灰地）。
- 文字はすべてトークン（`--fs-xs` 13px・`--fs-sm` 14px）。幅が狭ければラベルは折り返す。
- 守っているテスト: `tests/store_page_glance.test.js`。

### 電話するボタンの結果の行（I-36・2026-10）

```
[部品] [HotPepperで予約]
       [電話する]  [Googleマップ]
       この店の電話番号は Google に登録がありません。Googleマップで確かめられます。   ← 13px・本文色
```

- 見た目は `assets/css/nb.css` の `.nb-call-status`。13px（`--fs-xs`）、本文の色。ボタンの下に1行だけ出す。トップのクイックビュー・スマホの追従バー・店舗ページの3か所で同じ部品。
- 押したあと、確かめている間は「電話番号を確かめています…」、取れなかったときは理由と次の手（Googleマップ）を出す。文は `scripts/lib/call_button_snippet.js` の1か所にある（`index.html` と店舗ページが同じものを読む）。番号を取れて発信するときは何も出さない。
- 空のときは画面に場所を取らず（余白も増やさない）、読み上げのためにページの中には置いておく（`role="status"`）。文が入ると1行を取る。アイコンだけのボタン（追従バー）でも、結果はこの行で見える。
- 色は赤にしない（店の落ち度ではなく、電話番号を確かめられなかっただけ。叱る色にしない）。

### 店舗ページの行動バー（I-14b・2026-10）

```
[部品] 画面の下に貼り付く帯（幅 768px 以下だけ）
       [ ホットペッパーで予約 ]  [☎ 電話する]  [📍 地図]      ← 予約が一番手（金の塗り）
       いまは電話番号を確かめられません。Googleマップで確かめられます。   ← 電話の結果（帯の上に1行だけ出る）
```

- 見た目は `assets/css/nb.css` の `.nb-action-bar`（高さの目安はトークン `--action-bar-h`）。ボタンは `.nb-bar-btn`（高さ 52px）、一番手は `.nb-bar-primary`（金の塗り・`--fs-md`）、二番手・三番手は `.nb-bar-sub`（アイコンの下に 13px の文字）。色・余白・文字の大きさはトークンだけで書く。
- 中身は `gen-store-pages.js` の `buildActionBar()` の1か所が作る。ボタンの出し分けは計画 7.3 節の表のとおり、店の種類で4通り。
  1. 予約先と電話がある … `[予約（塗り）][電話する][地図]`
  2. 予約先だけ … `[予約（塗り）][地図]`
  3. 予約先が無く電話がある … `[電話する（塗り）][地図]`
  4. どれも無い … `[地図を開く（塗り）]`
- 予約のラベルは、ホットペッパーがあれば「ホットペッパーで予約」、無く食べログだけなら「食べログで予約・確認」（食べログは予約できない店もあるため「確認」を添える）。電話は、Google の店舗情報から番号を引けると確かめられた店（`callOk`）だけに出す。押したときだけ番号を問い合わせる（ページを開いただけでは問い合わせない）。
- 置き場所は `<body>` の直下、フッターの後ろ（`<main>` の外）。`position:sticky;bottom:0` なので、画面の下に貼り付き、ページの終わりでは自分の場所に収まってフッターを隠さない。PC では出さない（本文のリンク欄の操作は変えない）。ヘッダーのドロワーは帯より上に重なる。予約申告のプロンプトは帯の上に持ち上げる。
- 電話の結果の行（`.nb-call-status`）は、帯の中では一番上の行に出る。ラベルが入る間（「確認中…」）はボタンを押せなくする。
- 読み上げ: 帯は `role="region"` と「{店名}の予約・電話・地図」のラベルを持ち、ボタンは「{店名}に電話する」「{店名}の地図をGoogleマップで開く」のように店名つきで読まれる。アイコンは `aria-hidden`。
- 計測: 帯の予約・電話・地図は `location: store_page_bar`（本文の `store_page` と分けて数える）。語彙は `docs/reservation-measurement.md`。

### 店舗ページの「口コミ信頼度」の畳み（I-14d・2026-10）

```
口コミ信頼度                                         ← h2
B 80 / 100 — Google★4.3（39件）は、おおむね参考にできます。   ← 段階・点数・助言の1行
検証 5/9項目 ・ Google口コミ取得日 2026-06-01          ← 13px・補助の色
─────────────────────────────────────
＋ 内訳を見る（9つの検証項目）                          ← summary・押す所は44px以上
```

- 店舗ページでは、段階・点数・助言の1行と「検証 N/9項目」の1行だけを見せ、内訳（項目の行・読み方の注記・掲載データの充実度の別枠）は `<details class="trust-details">` に入れて**既定で閉じる**（`open` を付けない）。以前は内訳が約900pxの高さで開きっぱなしで、「予約・情報を確認」の節が約1,000px下に押されていた（スマホ幅 390px で 約1,040px、PC 幅 1280px で 約580px 短くなる）。
- 開閉の型はトップのクイックビュー（`index.html` の `.cross-check-box`）と同じ: 左に「＋／－」（`::before`・金色）、標準の三角は出さない（`list-style:none`・`::-webkit-details-marker`）、押す所は `var(--tap-min)`（44px）以上、文字は `var(--fs-sm)`。フォーカスの枠は `nb.css` の `:focus-visible`（金色 2px）をそのまま使う（`outline:none` にしない）。見た目の規則は店舗ページ生成器（`gen-store-pages.js`）のページ内 CSS にある。
- **中身は HTML に残す**（畳むだけ）。検索エンジンも画面の読み上げも、閉じたままで項目の行を読める。観測できなかった項目の行も消さない（行ごとに理由が違うので、1行にまとめない）。
- 「検証 N/9項目」の行は閉じたままでも見せる。段階がいくつの項目に基づくかが、段階の重みを読む手がかりになるため。
- 見出しは「口コミ信頼度」（内訳の見出しではなく、この節の見出し）。公開文言の監査（`scripts/audit_trust_wording.js`）は `<div class="trust-breakdown">` から `<div class="links-section">` までの禁止語を検査し、見出し `<h2>口コミ信頼度</h2>` を新しい形式のページの目印に数える。
- 開いた回数は計測していない（開閉のイベントは足していない）。
- 守っているテスト: `tests/store_page_trust_fold.test.js`。

---

## 5. 新規ページの雛形

新しい静的ページ（root 直下、または `features/`）を作るときは以下の `<head>` をベースにする。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ページタイトル｜NAGOYA BITES</title>
<meta name="description" content="...">
<link rel="canonical" href="https://nagoya-bites.com/....html">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#7a5c10">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Shippori+Mincho:wght@500;600&family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/nb.css">
<style>
/* ページ固有のCSSのみ。トークンはnb.cssのものを参照する。font-sizeのリテラル値は書かない */
</style>
</head>
<body>
<a class="skip-link" href="#main-content">本文へスキップ</a>
<header>
  <a class="logo" href="/index.html">Nagoya <em>Bites</em></a>
  <nav>
    <a href="/index.html">店舗一覧</a>
    <a href="/journal/index.html">ジャーナル</a>
    <a href="/features/index.html">特集</a>
    <a href="/features/editorial-policy.html">編集規約</a>
    <a href="/about.html">運営について</a>
  </nav>
</header>
<main id="main-content">
  <!-- ページ本体 -->
</main>
<footer>
  <div class="fl2">Nagoya <em>Bites</em></div>
  <div class="footer-links">
    <a href="/about.html">運営について</a>
    <a href="/faq.html">よくある質問</a>
    <a href="/contact.html">お問い合わせ</a>
    <a href="/privacy-policy.html">プライバシー</a>
  </div>
  <div class="fc">© 2026 Nagoya Bites. All Rights Reserved.</div>
</footer>
</body>
</html>
```

作成後は `node scripts/audit_design_system.js --check` を必ず通す。手順の全体は `agents/designer.md` 参照。

---

## 6. 密度の目安（数値目標）

| 指標 | 目標 |
|---|---|
| 可視文字が12px未満 | 0件 |
| 12px以下の割合 | 10%以下 |
| モバイル1画面目の文字数 | 500文字以下 |
| 検索結果カードの要素数 | 12以下 |
| 操作要素の高さ | 44px以上 |

計測は `node scripts/measure_typography.js` で行う。

## 7. サイト共通クローム（DSN-003・2026-09）

ヘッダー（ロゴ・ハンバーガー・ナビ）・パンくず・フッターは、`scripts/lib/site_chrome.js` を唯一の正本とする。**ナビ項目・フッターのリンク先はここだけに書く**。HTML に直接書かない。

```
主要ナビ（5項目）: 店舗を探す / 特集 / ジャーナル / 編集規約 / 運営について
補助ナビ（≤900px ドロワーのみ）: よくある質問 / お問い合わせ
フッター3群: 探す / 読む / 編集部
```

既存ページへの適用は `scripts/apply_site_chrome.js`（`apply_design_system.js` と同じ冪等スイープモデル）。

```bash
node scripts/apply_site_chrome.js --dry-run [--only root|features|journal|stores]
node scripts/apply_site_chrome.js [--only <dir>]
node scripts/apply_site_chrome.js --check          # 冪等性確認（CI 向け）
node scripts/lib/site_chrome.js --render header --depth 1 --active features   # 雛形出力
```

ヘッダー/パンくず/フッターは `<!-- NB-CHROME:HEADER|BREADCRUMB|FOOTER|SCRIPT:START/END -->` マーカーで囲む。新規ページ・新規生成器はこのマーカーを維持し、`renderHeader`/`renderBreadcrumb`/`renderFooter`/`chromeScript` を呼ぶこと。ナビの該当項目には `aria-current="page"` を付け、`class="active"` は使わない。

**「本文へスキップ」と `<main>` もクロームが出す（I-26a・2026-10-12）。** `renderHeader` は先頭に `<a href="#main-content" class="skip-link">本文へスキップ</a>`、最後（`</header>` の直後）に `<main id="main-content">` の開きを出し、`renderFooter` は最初に `</main>` を出す。ヘッダーとフッターは `<body>` の直下で隣り合うので、その間の本文がそのまま `<main>` の中に入る。ページ側で `<main>` を書かない。例外が2つある。

* **ページ自身が `<main>` を持つ**（`contact.html`・`privacy-policy.html` など）: `renderHeader({ main: false })`・`renderFooter({ main: false })` にして、自前の `<main>` に `id="main-content"` を付ける。`apply_site_chrome.js` はこれを自動で判定して揃える（`id` が別の値なら `main_id_conflict` で知らせる）。
* **トップ（`index.html`）**: `<body>` の先頭に自前の「本文へスキップ」を持つので、ヘッダーのブロックでは出さない（`renderHeader({ skipLink: false })`）。

`<main>` で包むために、ヘッダーの終わりとフッターの始まりで**開いている要素の並びが同じ**でなければならない（`<article>` を開けたまま閉じ忘れると、フッターが article の中に入って `<main>` と交差する）。`tests/skip_link_main.test.js` が静的ページ（トップ・運営系・特集）と、生成器の出力（店舗ページ・ハブ・日次ジャーナル）でこれを検査する。スキップリンクは `nb.css` の `.skip-link`（画面の外に置き、フォーカスが当たると左上に出る）が持つ。

**`<nav>` の規則はヘッダーの `#main-nav` だけに当てる（DSN-007・2026-10-09）。** パンくず・フッターのリンク群（`nav.nb-footer-group`）・目次（`nav.nb-toc`）も `<nav>` 要素なので、素の `nav{…}` にレイアウト（横並び・間隔・中央寄せ）やドロワー（`position:fixed`）を書くと、それらまで同じ形になる。DSN-003 から 2026-10-09 まで、幅 900px 以下ではパンくずとフッターのリンク群が画面外に置かれて見えず、スマホのレイアウト幅も 375px で 750px に広がっていた。素の `nav a` に残してよいのは文字の見た目（書体・太さ・色）だけ。

**パンくずは折り返さず 1 行にする（I-37・2026-10-12）。** `.breadcrumb` は `white-space:nowrap`・`overflow-x:auto` で、入りきらないときは横にスクロールする（右端は `mask-image` で薄く消し、続きがあることを示す。フォーカスの移動で薄い所に隠れないよう `scroll-padding-inline` をフェードと同じ幅にする）。折り返すと、Web フォントが届くたびに行数が変わって下の部分が動く（CLS。ハブで 0.65、エリア名が長い店の店舗ページで 0.13）。ページ側の CSS で `.breadcrumb` に `flex-wrap:wrap` や `white-space:normal` を戻さない（`tests/breadcrumb_oneline.test.js`）。今いるページの名前（右端）は、すぐ下の h1 と同じ言葉なので、隠れても迷わない。押す範囲（幅 900px 以下で 44px）と構造化データ（BreadcrumbList）は変えない。

閉じたドロワーは `display:none` にする。画面の外に置いておくだけ（`right:-100%` でも `transform` でも）だと、スマホのレイアウト幅がその分広がる。開くときのスライドは `@starting-style` と `transition-behavior:allow-discrete` で出す（未対応のブラウザでは即時に開閉する）。確かめるときは、幅 375px の `isMobile` 表示で `document.documentElement.scrollWidth` が 375 であることを見る。

記事系ページ（journal・features）の本文組版は `assets/css/nb.css` の記事システム（`.art-hero` / `.art-title` / `.art-body` / `.store-card` / `.related` / `.topcta` 等）が所有する。ページ固有の `<style>` にはこれらのセレクタのトップレベル定義を書かない。journal は `journal/_template.html` の `<style>` を正本とし、既存記事へは冪等スイープで揃える。features は SEO-042 TOP-CTA（`add_feature_top_cta.js`）・SEASONAL_NOTE（`build_featured.js`）・新顔バッジ（`refresh_feature_rosters.js`）の注入 CSS をマーカー行のみにし、実装は nb.css 側に置く。
