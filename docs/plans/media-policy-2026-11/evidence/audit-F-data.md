# 監査F: データ層に「出所と日付」がどの粒度で残っているか

- 監査日: 2026-11-16（リポジトリ `/Users/katagirijakutou/orca/workspaces/nagoya-bites/pilotfish`・ブランチ `wakuwaku-labs/pilotfish`・読み取りのみ）
- 数字はすべて `node -e` で JSON を読んで数えた。分母は断りが無い限り `data/stores.json` の 5,041 店。
- 「空」は空文字・null・空配列・false を埋まっていないと数えた。
- 外部 API は呼んでいない。Hot Pepper の仕様だけ公式リファレンス（https://webservice.recruit.co.jp/doc/hotpepper/reference.html）を読んだ。

## 先に結論

1. **日付は「取得元ごとの中間ファイル」にはあるが、読者が見る `data/stores.json` にはほぼ通っていない。** stores.json にある日付は `reviewTrust.d`（Google 口コミ取得日・83.8%）と `追加日`（4.2%）だけ。
2. **Hot Pepper 由来の項目（営業時間・価格帯・席数・個室・コースなど）には店ごとの日付が無い。** 取得は毎日だが、記録は「回ごと」だけ。
3. **Google の★は 83% が 91〜180 日前の取得**。営業状態は別の仕組みで 30 日以内に確認しているが、掲載店の 59% しかカバーしていない。
4. **追加料金・利用条件の専用項目は Hot Pepper API に無い。** 自由記述の `budget_memo`（料金備考）はあるが、今は捨てている。
5. **提供スピード・接客・清潔感を言えるデータ源は無い。** 口コミ本文は規約上保存しておらず、取れるのも最新 5 件だけ。
6. **「情報の種類」「利用権限」は記録単位の欄が無い。** 方針ファイルと ADR にあるだけ。
7. ジャーナルの出典は記事 HTML にだけあり（91%）、登録簿 `journal_published.json` には 1 件も無い。事実と出典の対応は残っていない。

---

## 問い1: 8項目 × 4対象の現状

凡例: ○=残っている／△=一部／×=残っていない

### 店舗データ（`data/stores.json` 5,041 店と、その元の中間ファイル）

| 項目 | 判定 | フィールドと埋まり率 |
|---|---|---|
| 情報源 | △ | `ホットペッパーID` 4,852（96.3%）／`placeId` 4,602（91.3%）／`Instagram` 3,238（64.2%）／`食べログURL` 2,679（53.1%）／`情報源URL` 98（1.9%）／`mediaFeatures` 149（3.0%）。**項目ごとの出所（この営業時間はどこから来たか）は欄が無く、コードから推し量るしかない** |
| 取得日時 | △ | stores.json: `reviewTrust.d` 4,223（83.8%）・`追加日` 210（4.2%）だけ。中間ファイル: `places_resolved.json` の `fetchedAt` 5,767/5,767、`tabelog_resolved.json` の `resolvedAt` 4,676/4,676、`instagram_resolved.json` の `resolvedAt` 4,319/4,319、`ig_post_evidence.json` の `fetchedAt` 8,153/8,153。Hot Pepper は `hotpepper_fetch_log.json` の回ごとの `at` だけ（店ごとは無し） |
| 確認日時 | △ | `place_status.json` の `checkedAt` 3,003 件（掲載店の 2,980 = 59.1%）／`closed_stores.json` の `確認日` 111/111／`store_liveness_reviews.json` の `checkedAt` 37/37／`access_corrections.json` の `確認日` 1/1。stores.json には通っていない（`電話確認` 79.1%・`地図確認` 63.7% は判定結果で、日付ではない） |
| 根拠となる記述 | △ | `editor_picks.json` の `sources[].snippet`＋`supports` 275 件（166 店のうち 55 店）／`closed_stores.json` の `理由`＋`出典` 111/111／`store_liveness_reviews.json` の `why`＋`evidence` 37/37／`mediaFeatures[].title` 205 件。`おすすめポイント` 4,304（85.4%）には根拠の欄が無い |
| 情報の種類 | × | 欄が無い。近いものは `visitStatus` 152（3.0%）と `データソース` 98（1.9%）だけ |
| 確認状況 | △ | `営業ステータス` 4,584（90.9%）／`電話確認` 3,988（79.1%）／`地図確認` 3,210（63.7%）／`reviewTrust.c`（検証できた項目数）4,223（83.8%）。項目ごとの「確認済み／未確認」は無い |
| 更新の必要性 | △ | 店ごとの旗は無い。方針の値だけ: `place_status_policy.json` の `restaleDays`=30、`fetch_places.js` の `STALE_DAYS`=25、`editor_picks.json` の `有効期限` 166/166、`trending_stores.json` の `有効期限` 76/76 |
| 利用権限 | × | 記録単位の欄は無い。方針は `photo_policy.json`・`image_source_policy.json`・ADR 0045/0051/0056 にある。写真だけ `写真出所` 194（3.8%）・`写真クレジット` 189（3.7%） |

### ジャーナル（記事 HTML 193 本・登録簿 `journal_published.json` 185 件）

| 項目 | 判定 | フィールドと埋まり率 |
|---|---|---|
| 情報源 | △ | 記事 HTML の `<div class="source-note">` 176/193（91.2%）・リンク 938 本（中央値 5 本）。**登録簿の `sources` は 0/185、`data/journal_candidates/*.json`（129 ファイル）にも 0 件**。無い 17 本は 2026-04-21〜05-14 |
| 取得日時 | × | 無い。`source-date` は出典側の掲載日（938 本のうち 773 本 = 82.4%）で、こちらが読んだ日ではない |
| 確認日時 | × | 事実ごとの確認日は無い。記事全体の `datePublished`・`dateModified` は 193/193 |
| 根拠となる記述 | × | 引用文・事実と出典の対応は無い。本文に脚注や出典番号がある記事は 0/193 |
| 情報の種類 | × | 無い |
| 確認状況 | △ | 登録簿の `gate_note` 68/185・`gate` 14/185（採点の合否で、事実の確認状況ではない） |
| 更新の必要性 | × | 無い |
| 利用権限 | △ | ヒーロー写真の `data-hero-source` 77/193（hotpepper 39・press 23・figure 8・places 7）・`data-hero-store` 68/193 |

### 特集（`features/*.html` 73 本・`feature_rosters.json` 46 特集）

| 項目 | 判定 | フィールドと埋まり率 |
|---|---|---|
| 情報源 | △ | 選び方は `feature_rosters.json` の `scoreWeights`・`gates`・`scene`（46/46）で決まる。店ごとの出典は無い。本文に「出典／情報源」の語があるのは 3/73 |
| 取得日時 | × | 無い |
| 確認日時 | △ | JSON-LD の `dateModified` 71/73。画面に「最終更新」が見えるのは 1/73 |
| 根拠となる記述 | × | 店ごとの選定理由は保存していない（点数で機械的に選ぶ） |
| 情報の種類 | × | 無い |
| 確認状況 | △ | 掲載店が stores.json に実在するかは監査 `audit_feature_stores.js` で確かめる（結果の日付は店に付かない） |
| 更新の必要性 | △ | 月 1 回の入れ替え（`feature_rosters.json` の `_README`）。`featured.json` の `season` 8/13 |
| 利用権限 | × | 無い（Places の写真 URL を書かない決めは ADR 0045） |

### 写真（stores.json の `写真URL` 4,883 = 96.9%）

| 項目 | 判定 | フィールドと埋まり率 |
|---|---|---|
| 情報源 | ○ | URL のホストで分かる: `imgfp.hotp.jp` 4,694／`lh3.googleusercontent.com` 189。Places の 189 枚は `写真出所` 189/189（places-owner 114・places-user 75）。Hot Pepper の写真で `写真出所` があるのは 5/4,694 |
| 取得日時 | △ | stores.json は 0 件。`manual_stores.json` の `写真取得日` 170/215、`pending_stores.json` 114/148 |
| 確認日時 | △ | `manual_stores.json` の `写真確認日` 214/215・`HP写真確認日` 125/215。Hot Pepper 写真全体は `hotpepper_master_probe.json`（`probedAt` 2026-08-05・4,596 枚・1 回きり） |
| 根拠となる記述 | △ | `写真クレジット` 189（Places の 189 枚は 189/189） |
| 情報の種類 | △ | `写真出所` の値で「店が出した写真／客の写真」を分ける（Places の 189 枚だけ） |
| 確認状況 | △ | `dead_photo_urls.json`（配信終了の台帳）・`photo_url_liveness_report.json` |
| 更新の必要性 | × | 無い |
| 利用権限 | △ | 写真ごとの欄は無い。出所ごとの決めは `photo_policy.json`・`image_source_policy.json`・CLAUDE.md の写真の優先順 |

---

## 問い2: 読者の5つの失敗について、今のデータで言えること・言えないこと

### ① サクラ・信頼性の低い口コミ

言えること（`data/crosscheck.json`・`trust_display_policy.json`）:
- 4,223 店（83.8%）に口コミ信頼度がある。段階は B 1,904／C 917／D 641／A 456／SS 184／判定材料不足 121。付いていない店は 818。
- 入力は 9 項目。Google の★と件数、最新 5 件の★と投稿日、取得履歴、メディア掲載、口コミの指紋（ハッシュ）の重なり。すべて第三者が検算できる事実。

言えないこと:
- **個々の口コミが本物かどうかは判定していない。** `features/integrity-method.html` 自身が「機械で測れるのは件数・★・直近の傾向・分布…であって、個別レビューの真贋ではありません」と書いている。
- 材料が薄い。`places_history.json` 5,533 店のうち、取得が 1 回だけの店が 4,957（89.6%）。3 回以上は 291（5.3%）で、「口コミの増え方」はほとんどの店で判定保留。
- 口コミの記録 25,402 件のうち、本文の長さを持つのは 4,090 件（16.1%）、文面のハッシュを持つのは 2,936 件（11.6%）。
- 内部の旗（`cross_check_flags.json` 363 店。同じ投稿者名が複数店・同じ文面が複数店など）はサイトに出していない。
- 食べログの口コミは取っていない。

### ② 宣伝写真と実際の違い

- 写真 4,883 枚のうち 4,694 枚（96.1%）が Hot Pepper の写真＝店が媒体に出した宣材。Places の店側写真 114、客の写真 75（1.5%）。
- 「宣材と実物の差」を示す欄は無い。客の写真は「店側の写真が無い店の代替枠」としてだけ使う決め（`photo_policy.json` の `allowUserPhotoFallback`）。
- Instagram の埋め込みは 1,725 店（34.2%）。店の公式アカウントの投稿が中心で、これも宣材寄り。
- **外部情報だけで「実物との違い」を言う材料は無い。**

### ③ 追加料金・利用条件

Hot Pepper グルメサーチ API の仕様（公式リファレンスで確認）:
- お通し・席料・サービス料・チャージ・コース料金・時間制限・予約条件の**専用項目は無い**。
- 近い項目は `budget_memo`（料金備考。公式の例が「お通し代300円」）、`other_memo`（その他設備）、`shop_detail_memo`（備考）、`charter`（貸切）。自由記述で、内容の定義は無い。
- `course`・`free_drink`・`free_food` は「あり／なし」と短い補足だけ。

今の保存（`build.js` の `hpShopToStoreRecord` 599〜660 行）:
- 保存している: 店名・ジャンル・サブジャンル・エリア・住所・緯度経度・`budget.name`・`budget.average`・`open`・`close`・`station_name`・`access`・`catch`・`capacity`・`party_capacity`・`private_room`・`card`・`non_smoking`・`parking`・`lunch`・`course`・`free_drink`・`free_food`・`id`・`photo.pc.l`。
- **捨てている: `budget_memo`・`other_memo`・`shop_detail_memo`・`charter`・`horigotatsu`・`tatami`・`wifi`・`barrier_free`・`child`・`pet`・`english`・`midnight`・`urls`・`coupon_urls` ほか。** `build.js` に `budget_memo` の参照は無い。
- 「なし」「不可」の値は空にして落とす（`hpAvailability`）。補足は 60 文字で切る。

今のデータで見えている範囲:
- `コース` 2,933（58.2%）・`飲み放題` 2,388（47.4%）・`個室` 1,006（20.0%）・`食べ放題` 534（10.6%）・`禁煙` 4,240（84.1%）。
- 自由記述のどこかに料金・条件の語（お通し・席料・チャージ・サービス料・個室料・時間制・要予約・完全予約制など）がある店は **76 店（1.5%）**。11 個の欄を正規表現で数えた。

言えないこと:
- コースの値段・時間制限・予約の締切は API に無い。ジャーナルは Hot Pepper のコースのページを人（生成する AI）が読んで出典に載せている。
- `budget_memo` が実際にどれだけ埋まっているかは、API を呼んでいないので確かめていない。

### ④ 提供スピード

- **取れるデータ源は無い。** Hot Pepper API に項目が無い。Google の口コミ本文は保存しておらず、取れるのも最新 5 件。stores.json にも当たる欄が無い。

### ⑤ 接客・清潔感・料理の総合品質

- 言えるのは Google の★と件数（4,133 店・82.0%）と、その★を信じてよいかの段階だけ。
- 接客・清潔感の内訳は Places API に無い。食べログの点数は 26 店（0.5%・手入力）。
- 訪問済みの店は 4 店（問い5）。

---

## 問い3: 口コミ・SNS 投稿の取得方法と、規約・著作権上の今の扱い

### Google の口コミ
- 取得: Places Details の `reviews`（最新 5 件）。`scripts/fetch_places.js` 186〜220 行。
- **本文と投稿者名は保存していない。** 保存するのは `rating`・`time`・`relativeTime` と、本文の長さ・言語・誘導語の有無・文面と投稿者名のハッシュ。
- 理由（`fetch_places.js` 60〜72 行・`scripts/lib/review_fingerprint.js` 9〜15 行）: Google Maps Platform の規約が口コミと投稿者情報の保存を禁じているため。公開リポジトリに第三者の本文・氏名を残さないため。
- サイトにも本文は出していない。
- **未決の点**: ADR 0051（2026-10-18）は、`name`・`formatted_address`・`Google評価`・`口コミ数` の保存を「決められない」としている。規約の例外の条文を読めていないため。判断を頼む課題 ISSUE-194 は `agent-backlog.md` 316 行で `status: ready` のまま。
- ADR 0051 の表には `places_history.json` の履歴と `latestReviews`（★・投稿日・ハッシュ）が載っていない。`review_fingerprint.js` は規約の文を「names, ratings, reviews … must be requested live rather than warehoused」と引いており、★の保存も同じ条文に当たりうる。

### 食べログ
- 取得: `scripts/resolve_tabelog.js` が食べログの検索ページ（`tabelog.com/aichi/rstLst/?sw=店名`）を読み、店名と住所で照合して URL だけ保存。API ではない。
- 口コミ本文は取っていない（`features/editorial-policy.html`「食べログ・Retty 等の口コミ本文は一切取得せず」）。
- `食べログ評価` は 26 店だけ（手入力の店から）。
- 食べログの利用規約についての決めは、ADR 0012・0013 を「規約」で探したが見つからなかった。

### Instagram
- アカウントの特定: 検索結果から（`fetch_ig_urls.js` が Yahoo 検索を開く。`instagram_resolved.json` の `method` Q1 など・`resolvedBy: google` 1,668）。
- 投稿の取得: `scripts/select_ig_posts.js` が `instagram.com/api/v1/users/web_profile_info` を読む（公式の Graph API ではない）。
- 表示: embed.js の埋め込みだけ。画像のダウンロードは禁止（`photo_policy.json` の `prohibited`）。
- **キャプション本文は保存している。** `ig_post_evidence.json` に 7,939 件（8,153 件中）、`instagram_posts.json` に 61 件。目的は「その店の料理・内装が分かる投稿か」の判定の証跡（`ig_post_policy.json` の `evidence_rule`）。git の無視対象ではない（公開リポジトリに入る）。
- キャプションの保存についての規約上の決め（ADR）は見つからなかった。

### メディア掲載
- 取得: `scripts/fetch_media_appearances.js` が Google ニュース・note・はてなブックマークの RSS を読む。保存は媒体名・題・URL・年だけ（本文なし）。160 店・`lastFetchedAt` 2026-11-16。
- URL の多くは Google ニュースの転送 URL で、元記事の URL ではない。

---

## 問い4: 「確認日」を読者に出せる項目・出せない項目と、鮮度

### 日付があり、出せる項目

| 項目 | 日付の欄 | 今サイトに出ているか |
|---|---|---|
| Google の★・件数 | `places_resolved.json` の `fetchedAt`／`reviewTrust.d` | 出ている（「Google口コミ取得日」「口コミ最終確認」） |
| 営業状態 | `place_status.json` の `checkedAt` | 出ていない（stores.json に日付が通っていない。`scripts/lib/store_facts.js` 21〜23 行に理由） |
| 閉店の判断 | `closed_stores.json` の `確認日`・`出典` | 出ていない（店ごと外す） |
| 食べログのリンク | `tabelog_resolved.json` の `resolvedAt` | 出ていない |
| Instagram のアカウント・投稿 | `resolvedAt`・`fetchedAt` | 出ていない |
| 選定理由（editorReason） | `editor_picks.json` の `検出日`・`sources[].fetched_at` | 出ていない |
| 話題の店 | `trending_stores.json` の `検出日` 76/76 | 一部（「◯日前に掲載」） |
| 手動で足した店 | `追加日` 210 店 | 出ていない |
| ジャーナル | 公開日・出典の掲載日 | 出ている |
| 特集 | `dateModified` | 画面では 1/73 |

### 日付が無く、今のままでは出せない項目

- **Hot Pepper 由来の全項目**（営業時間・定休日・価格帯・席数・禁煙・個室・コース・飲み放題・カード・駐車場・写真）。店ごとの取得日が無い。
- `おすすめポイント` 4,304 店・`タグ` 4,811 店・`トレンドスコア`・`トレンドラベル`。作った日も出所も無い。
- 写真（stores.json の 4,883 枚すべて。取得日が通っていない）。

### 鮮度の分布

- Hot Pepper: 直近 30 回の取得は 2026-11-12〜11-16（1 日に複数回）。最新は 2026-11-16・5,834 件。
- **Google の★を出している 4,132 店の取得からの日数: 7 日以内 94（2.3%）／8〜30 日 293（7.1%）／31〜90 日 297（7.2%）／91〜180 日 3,448（83.4%）。**
- `reviewTrust.d`: 2026-05-22 が 3,093 店（73.2%）。
- 営業状態: 3,003 件すべて 30 日以内（7 日以内 700／8〜14 日 798／15〜30 日 1,505）。1 日 100 件・30 日で取り直す設定。掲載店のカバーは 59.1%。
- 食べログのリンク: 2026-04 が 2,268／05 が 1,336／09 が 981／10 が 91。
- Instagram のアカウント: 2026-04 が 2,651／05 が 1,668。それ以後の取り直しは無い。
- 閉店の確認日: 2026-08 が 70／10 が 36／11 が 3／06 が 2。

---

## 問い5: 訪問の有無

`visitStatus` の分布（stores.json）:
- 無し 4,889（97.0%）
- `desk`（公開情報ベース）85
- `desk_automated`（公開情報ベース・自動収集）53
- `industry_known`（業界内で評判）10
- `visited`（訪問済）4
- `interview`（店主取材済）0

元の `editor_picks.json`（166 店）は visited 5・desk 94・industry_known 12・desk_automated 55。

表示: **使われている。** トップのモーダル（`index.html` 5920 行）、店舗ページ（`gen-store-pages.js` 614 行）、エリア×ジャンルのハブ（`scripts/lib/editor_reason.js`）が同じ語で出す。`features/editorial-policy.html` は「訪問済」を「編集部が実際に訪れた店」と説明している。

事実として確かめられた点:
- 訪問日・訪問者・訪問の証跡の欄は無い。
- visited の 5 店はすべて `検出日` が 2026-04-20〜21 で、`source` も `sources` も空。
- `insider_reviews.json` の `stores` は 0 件。

確認できなかったこと: この 5 店に実際の訪問があったかどうか。データからは裏づけも否定もできない。

---

## 問い6: そのまま使える資産と、足りないもの

### そのまま使える資産

- **取得日つきのデータ**: `places_resolved.json`（`fetchedAt` 全件）・`place_status.json`（`checkedAt`・店名と住所の照合結果つき）・`tabelog_resolved.json`・`instagram_resolved.json`・`ig_post_evidence.json`。
- **根拠の引用つきのデータ**: `editor_picks.json` の `sources[]`（url・snippet・supports・fetched_at の 4 点・275 件）。新方針の「根拠となる記述」の形にそのまま当たる。
- **確認日と出典つきの判断記録**: `closed_stores.json`（111 件）・`store_liveness_reviews.json`（37 件・取得した事実つき）・`access_corrections.json`。
- **「確かめられない紐付けは出さない」仕組み**: `place_binding_policy.json` と ADR 0046（帯ごとに 30 組を目で確かめた標本つき）。
- **検証できた範囲を数字で出す表示**: 口コミ信頼度の「検証 n 項目」と取得日。
- **写真の出所の判定**: `photo_policy.json`・`写真出所`・`写真クレジット`。
- **訂正の受け口と台帳**: `feedback_log.json`（4 件）・`dispute_requests.json`（0 件）。
- **既存の監査**: `audit_feature_stores.js`・`audit_store_link_identity.js`・`audit_places_binding.js`・`audit_photo_policy.js`・`audit_trust_wording.js`・`audit_selection_wording.js`。

### 足りないもの

**A. 既存の項目に日付を足すだけで済む**
- Google の★・件数の取得日を、信頼度の無い店でも stores.json に通す。
- 営業状態の `checkedAt` を stores.json に通す（`store_facts.js` が出さない理由がこれ）。
- Hot Pepper 由来の項目に、店ごとの「最後に API で見えた日」を付ける。
- 食べログのリンク・Instagram のアカウントの `resolvedAt` を通す。
- 写真の取得日・確認日を通す。
- ジャーナルの `sources[]` を登録簿に残す（今は HTML にしか無い）。「読んだ日」を足す。
- 特集の画面に更新日を出す（`dateModified` は 71/73 にある）。

**B. 取得元を足す必要がある**
- 追加料金・利用条件: Hot Pepper の `budget_memo`・`other_memo`・`shop_detail_memo`・`charter` を保存する（今は捨てている。同じ API 呼び出しに入っているので呼び出しは増えない）。自由記述なので、分類は別に要る。
- コースの値段・時間制限・予約条件: グルメサーチ API には無い。店のページや公式サイトを個別に読む経路が要る。
- 「情報の種類」（事実・口コミ・分析・未確認）と「利用権限」: 記録単位の欄を新しく作る。
- `おすすめポイント`（4,304 店）の出所と作った日。
- 訂正履歴の公開: 台帳はあるが、公開ページは見つからなかった（サイト直下と `features/` を「訂正履歴・修正履歴」で検索して 0 件）。
- 訪問の証跡（日付・誰が）: `visitStatus` を使い続けるなら要る。

**C. 外部からは取れない**
- 提供スピード。
- 接客・清潔感の内訳。
- 宣材写真と実物の差。
- 個々の口コミの真贋。
- Google の口コミ本文の保存（規約）。取れるのも最新 5 件だけ。
- Instagram の画像の保存（方針で禁止。埋め込みだけ）。

---

## 監査中に見つけた食い違い（事実）

- **検証項目の数**: `trust_display_policy.json` の `checks` は 9 項目で、全 4,223 店の `reviewTrust.c` が「n/9」。一方 `features/review-trust.html` と `features/integrity-method.html` は「検証 n/7項目」「7 つの検証項目」と書いている。
- **「口コミ最終確認」の日付**: モーダルの末尾（`index.html` 6207 行）は `reviewTrust.d` を「口コミ最終確認」として出す。73.2% の店で 2026-05-22 のまま。
- **登録簿と記事の数**: `journal_published.json` は 185 件、`journal/` の日付つき HTML は 193 本。差の 8 本の理由は調べていない。
- **選定理由の出典 URL**: `data/editorreason_drafts/`（174 ファイル）の `sources_used[].url` は Vertex AI の転送 URL で、元記事の URL ではない。

## 確認できなかったこと

- Hot Pepper の `budget_memo` などが実際にどれだけ埋まっているか（API を呼ばない条件のため）。
- Hot Pepper の 4,852 店が全部その日の取得で見えているか（`build.js` に「前の回の記録」を持ち越す処理があり、店ごとの最終取得日は分からない）。
- Instagram のキャプション本文がサイトに文字として出ているか（保存は確認。表示は未確認）。
- ISSUE-194（Places の保存の可否）のその後の判断。backlog では `ready` のまま。
- 食べログ・Instagram の利用規約に照らした可否（リポジトリ内に決めが見つからなかった。規約そのものは読んでいない）。
- `places_binding_reviewed.json`・`dead_photo_urls.json`・`tabelog_branch_reviewed.json` の件数と日付の持ち方（存在だけ確認）。

## 推測（事実と分けて）

- Hot Pepper の項目は毎日取り直しているので、ビルド日を「取得日」として出せる見込みが高い。ただし上の持ち越しの扱いを確かめてからになる。
- Google の★の取り直しは今の速さ（`places_resolved.json` の `fetchedAt` が 2026-10 に 445 件、11 月は 16 日までで 264 件）だと、★を出している 4,132 店の一巡に 8〜9 か月かかる計算になる。予算の設定値そのものは確かめていない。
