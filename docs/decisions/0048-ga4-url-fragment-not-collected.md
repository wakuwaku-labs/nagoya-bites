# 0048 絞り込みの URL（# の後ろ）を GA4 に渡さないための仕組みは作らない。page_location を上書きしない

- 日付: 2026-10-15
- 状態: 採用
- 関連: Linear P-475 / backlog ISSUE-193 / `scripts/ga4_fragment_counts.js` / `.github/workflows/ga4-fragment-counts.yml` / `tests/ga4_fragment_counts.test.js` / `docs/qa/meo-2026-10/e2e_gtag_fragment.js` / index.html の nbBuildHash・pushHash・geoSearch

## 背景
- トップは絞り込みの状態を URL の `#` の後ろに書く（`#genre=…&q=<検索語>&store=<店の ID>`・`history.replaceState`）。
- 「現在地」ボタンで位置から選んだエリアも `#q=<エリア名>` に入る。
- 「現在地」の計測（geo_search）は結果だけを送り、緯度・経度・エリア名は送らない（MEO-006）。それでも、GA4 が URL（page_location）ごとエリア名を受け取っていれば、おおよその位置が GA4 に残ることになる。
- 2026-10-15 に CI の GA4 の鍵で数えた（run 38756893135・38760363890）。期間は 30daysAgo〜yesterday。
  - 全イベント 11,144 件（page_view 2,229 件）のうち、pageLocation に `#` を含むものは **0 件**。`q=` も `store=` も 0 件。
  - 同じ期間に `#` を書いた後に送るイベントはあった。
    - filter_apply 1 回。applyFilters が `#` を書いた直後に必ず送る。
    - search 32 回・modal_open 48 回。検索や絞り込みの後に送るものを含む。
  - よって、GA4 のデータ（レポート・Data API）には、`#` の後ろが入っていない。
  - 当サイトの GA の設定は page_location を自分で渡していない（gtag の既定のまま）。外部の解説も「GA4 は既定で # の後ろを記録しない」と書く（Google の公式文書では確かめていない）。
- 2026-10-16 に、gtag.js が Google へ送る通信そのものも確かめた（`docs/qa/meo-2026-10/e2e_gtag_fragment.js`）。
  - 本物の gtag.js を読み込み、「現在地」を押して URL を `#q=名古屋駅&store=<店の ID>` にした後の送信（geo_search・modal_open・user_engagement）を、ページの中で横取りして見た。GA4 へは送っていない。
  - どの送信もページの URL（dl）に `#` が無く、`q=<エリア名>` も無かった。gtag.js は既定で `#` の後ろを送らない。
  - わざと `gtag('set', {page_location: location.href})` を足すと、dl に `#q=名古屋駅&store=…` が入り、道具は失敗を出した。page_location を自分で渡すと届き始めることも、実物で確かめた。
  - 前回（2026-10-15）は、ブラウザの通信の横取りと sendBeacon の置き換えだけで見ていて、読み込み時の page_view の後の送信を捕まえられなかった。今回はページの中で fetch も横取りした（gtag.js は fetch で送っていた）。
  - modal_open は店名と店のエリアを送る。店の情報で、利用者の位置ではない。

## 決めたこと
1. 絞り込みの URL を GA4 に渡さないための仕組み（page_location の書き換え・`#` の削り取り・「現在地」の後だけ URL に書かない 等）は作らない。今は GA4 のデータに入っていないため。
2. index.html と GA4 のスニペット（`scripts/lib/ga_snippet.js`）は、page_location を自分で渡さない。
   - `location.href` などで上書きすると、検索語・エリア名・店の ID が GA4 に届き始める。
   - `tests/ga4_fragment_counts.test.js` が、両方のファイルに page_location の語が無いことを見る。
3. 数え直すときは、`.github/workflows/ga4-fragment-counts.yml`（手動・読み取りのみ）を動かす。出すのは件数だけ。
4. 通信そのものを確かめ直すときは、`node docs/qa/meo-2026-10/e2e_gtag_fragment.js` を手元で動かす（本物の gtag.js を読むのでネットにつながった端末で。GA4 へは送らない）。

## 選ばなかった案と理由
- **「現在地」で選んだエリアを URL に書かない**: ブックマーク・共有できる絞り込みの URL（2026-05 から）と、手入力の検索と同じ動きを崩す。GA4 に入っていないので、得るものが無い。
- **page_location を `#` の無い URL で明示する**: 今の既定と結果が同じで、設定を 1 つ増やすだけ。

## 見直す条件
- GA の設定を変えるとき（page_location・page_path を渡す、Google タグ マネージャーに移す 等）
- `#` を含む件数が 1 件以上になったとき（ワークフローで数え直す）
- GA4 の既定の動き（# の後ろを記録しない）が変わったと分かったとき
- gtag.js の更新の後に `e2e_gtag_fragment.js` が失敗を出したとき
