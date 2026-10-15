# 予約送客の計測（ISSUE-149・正本）

名古屋バイツは予約を自分で受けない。食べログやホットペッパーのように「予約が入ったら店へ通知が行く」出口を持たないので、**予約が成立したかどうかは自分たち側からは見えない**。この文書は、店に作業を頼まず、アフィリエイトも使わずに、自分たち側だけで正直に持てる数字の定義と、その仕組みをまとめる。判断の経緯は `docs/decisions/0009-reservation-measurement-tiers.md`。

## 3段階の数字（混ぜない）

| 段階 | 中身 | 性質 | 置き場所 |
|---|---|---|---|
| 予約送客 `exits` | その店の予約導線（HotPepper の店舗ページ・食べログの店舗ページ・電話）を押した回数 | GA4 のイベント。第三者が検算できる事実（制約10） | `data/store_referrals.json` |
| 予約申告 `reports` | 予約導線から戻った人が「予約した／していない」と答えた数 | お客様の自己申告。「少なくともこれだけ予約された」という下限 | 同上 |
| 予約成立 | 実際に予約が入った数 | **計測しない**（観測経路が無い） | — |

- 検索ページへのリンク（HotPepper のキーワード検索・食べログの検索）は、その店の予約導線ではないので送客に数えない。
- 店舗別の集計に `outbound_click` は使わない。同じクリックが `cta_click` と二重に届くため。
- `link_domain` の無い古い `cta_click` / `cta_reserve` はホットペッパー扱い（ISSUE-149 以前、これらはホットペッパーのボタンにしか付いていなかった）。

## 送るイベント（全ページ共通の語彙）

| イベント | 経路 | パラメータ |
|---|---|---|
| `cta_click` | HotPepper / 食べログ | `store_name` `store_id` `link_domain`（`www.hotpepper.jp` / `tabelog.com`） `location` |
| `cta_reserve` | ジャーナルの「この店を予約する」 | 同上（`location: journal`） |
| `cta_call_click` | 電話 | 同上（`link_domain: tel`、`store_id` は placeId） |
| `reserve_report_yes` / `reserve_report_no` | 予約申告 | 同上（申告のきっかけになった導線の値） |

`location`: `card` / `card_media` / `modal` / `modal_media` / `store_page` / `store_page_bar` / `feature` / `journal` / `hub`。

- `hub`（I-08・UI・UX改修計画）: エリア×ジャンルのハブ（`stores/area/…`）の「ホットペッパーで予約」。以前は `hub_store_click` を送っており、予約送客の集計に入らなかった。`scripts/gen_area_genre_pages.js` の `hubReserveOnclick()` が、ほかのページと同じ `cta_click` を送る（押したハブのパスは `hub` パラメータ）。変えた日は `data/measurement_changes.json` に書く。
- `store_page_bar`（I-14b・UI・UX改修計画）: スマホの店舗ページで画面の下に貼り付く行動バー（予約・電話・地図）。本文のリンク欄（`store_page`）と分けて数える。予約の `cta_click`・電話の `cta_call_click`（`call_lookup` も）・地図の `cta_gmap_click` に同じ値が付く。バーは幅 768px 以下だけ出るので、PC のクリックは従来どおり `store_page` のまま。バーの電話は予約先のある店にも出る（本文の電話ボタンは従来どおり予約先の無い店だけ）ため、電話の送客は変えた日から増える見込み。変えた日は `data/measurement_changes.json` に書く（マージ・日次ビルドの後に、実際の日付と証跡で）。
- 予約ではない内部リンクのクリックは別の名前で送る（予約送客に混ぜない）: 特集 → 店舗ページ `feature_store_click {store, feature}`、ジャーナル → 店舗ページ `journal_store_click {store, journal}`（I-08）。`store` はどちらもリンク先のスラグ（ホットペッパーID。無い店は `stores/<スラグ>.html` のスラグ）で、店名では送らない。

GA4 に登録済みのカスタムディメンションは `store_name` と `link_domain` だけで、店舗×経路はこの2つで取れる。`store_id`・`location` は未登録でも送っておき、必要になったら登録する（登録は非遡及・`docs/ga4-view-counts-setup.md`）。

## 予約送客に入れない行動（MEO-006・2026-10-15）

店選びの後の行動のうち、予約ではないものは別の欄で数える（足し合わせない）。数え方の正本は `scripts/lib/store_actions.js`、計画は `docs/meo-plan-2026-10.md` の 8.1〜8.2 節。

| イベント | 中身 | パラメータ | `data/store_referrals.json` の欄 |
|---|---|---|---|
| `cta_gmap_click` | 地図ボタン（トップのカード・クイックビュー・店舗ページ・行動バー・ジャーナル） | `store_name` `store_id` `location` `link_kind`（`place_id`＝確認済みの紐付けの place_id つき／`search`＝店名＋住所の検索だけ）。店舗ページは `link_url` も | `map`（合計・店名の無い分 `unattributed`・上位の店 `top`・場所ごと `byLocation`・形ごと `byLinkKind`） |
| `call_lookup` | 電話ボタンを押した後に番号を取れたか（`scripts/lib/call_button_snippet.js`） | `result`（`ok`・`quota`・`not_found` など） | `callLookup`（合計・結果ごと `byResult`） |
| `geo_search` | トップの「現在地」ボタン | `result` だけ（`granted`・`denied`・`unsupported`・`error`）。**緯度・経度・選んだエリア名は送らない**（`tests/store_actions.test.js` が確かめる） | `geoSearch`（合計・結果ごと `byResult`） |

- `actions` は予約（ホットペッパー・食べログ・そのほかの予約サイト）・電話・地図を並べた 1 行（直近30日）。週次の表（`docs/kpi-weekly.md`）に写す。地図に伸ばす目標は置かない。
- 地図は予約送客に入れない（判断の記録 0009）。同じ押下は `outbound_click` にも届くので、`outbound_click` は足さない。
- `location`・`link_kind`・`result` は GA4 に未登録。未登録の名前で問い合わせるとレポートごと失敗するため、`fetch_ga4_views.js` は GA4 のメタデータで登録を確かめ、未登録の内訳は `null` にして名前を `missingDimensions` に残す（合計はイベント名だけで数えられる）。登録すると、その日から内訳が入る（非遡及）。
- 4 つの計測のファイル（`view_counts.json`・`site_metrics.json`・`store_referrals.json`・`gsc_metrics.json`）の `generatedAt` が 2 日より古ければ、夜間QA の soft（`metrics-freshness`・`scripts/check_metrics_freshness.js`）が赤になる。

## 予約申告プロンプト（自分たち側だけで作る「出口」）

- 実装は `scripts/lib/reservation_ask_snippet.js` の1本。予約導線の onclick で `nbReserveExit(イベント名, パラメータ)` を呼ぶと、GA4 に送ったうえで「どの店の導線を押したか」をそのタブの sessionStorage に覚える。
- 20秒〜30分のうちにタブへ戻ってきたら、画面下に「〈店名〉の予約はできましたか？」を出す。同じ店は1日1回まで。20秒で消え、閉じても何も送らない。オーナーの確認（`nb_internal`）では出さない。
- 埋め込み先: index.html（`node scripts/lib/reservation_ask_snippet.js --apply index.html`・テストが反映漏れを検出）、店舗ページ（`gen-store-pages.js`）、特集（`scripts/add_feature_tracking.js`）、ジャーナル（`scripts/generate_daily_draft.js`）。見た目は `assets/css/nb.css` の `.nb-reserve-ask`。
- 申告は掲載順位・口コミ信頼度に使わない（プロンプトにもそう書いている）。

## 集計と報告

- `scripts/fetch_ga4_views.js` が毎日（build.yml）`data/store_referrals.json` を書く。直近30日の店舗別・経路別の送客と申告、当月累計を持つ。店名が取れない送客（ISSUE-149 以前の店舗ページ）は `unattributedExits` に分ける。
- 週次レポート（GAS・`.gas-deploy/Code.js`）に「予約送客 上位の店」3店と予約申告の件数を出す。GAS 本体への反映はオーナーの操作（`docs/gas-deploy-verification-runbook.md`）。
- 日次・週次レポートの「🔘 予約ボタン」（GAS の `ctaCount`）は、予約導線イベント（`cta_click`・`cta_reserve`）と予約サイトへの `outbound_click` を**ページ×リンク先ごとに大きい方**で数える（ISSUE-152）。予約ボタンは `<a href="https://…">` なので、押した1回は `outbound_click` にも同じ1回として届く。足すと2回になる。大きい方を取ると、ボタン（両方に届く）とボタン以外の予約サイトへのリンク（特集の店名リンクなど・`outbound_click` だけに届く）を1回ずつ数えられる。数え方は `scripts/lib/reservation_exits.js` の `dedupeReservationClicks` が正本で、GAS は同じものの複製（`tests/reservation_exits.test.js` が文面と結果の一致を検査）。直した日から35日、レポートに注記が出る。
- `data/site_metrics.json` の `cta.reservationOverlap7d` に、直近7日の足し算（`naiveSum`）・重ならない数え方（`deduped`）・重なり（`overlap`）を毎日残す。

## 選ばなかった出口

- 店に通知・タグ・専用番号を入れてもらう: 店の手間になる（オーナー判断で除外）。
- アフィリエイトの成果通知: 成立数を検証できる唯一の経路だが、収益化しない方針に反する。「報酬を受け取らない計測専用」なら将来検討（制約8でオーナー承認が要る・未着手）。
- 自前の050転送番号: 月額費用がかかり、店の公式番号ではない番号を載せることになり信頼を損ねる。
