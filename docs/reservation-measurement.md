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

`location`: `card` / `card_media` / `modal` / `modal_media` / `store_page` / `feature` / `journal`。

GA4 に登録済みのカスタムディメンションは `store_name` と `link_domain` だけで、店舗×経路はこの2つで取れる。`store_id`・`location` は未登録でも送っておき、必要になったら登録する（登録は非遡及・`docs/ga4-view-counts-setup.md`）。

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
