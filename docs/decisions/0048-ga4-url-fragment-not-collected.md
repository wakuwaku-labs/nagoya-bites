# 0048 絞り込みの URL（# の後ろ）を GA4 に渡さないための仕組みは作らない。page_location を上書きしない

- 日付: 2026-10-15
- 状態: 採用
- 関連: Linear P-475 / backlog ISSUE-193 / `scripts/ga4_fragment_counts.js` / `.github/workflows/ga4-fragment-counts.yml` / `tests/ga4_fragment_counts.test.js` / index.html の nbBuildHash・pushHash・geoSearch

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
- 確かめていないこと: gtag.js が Google へ送る通信そのものに `#` の後ろが入っているか。手元のブラウザでは送信を捕まえられなかった。

## 決めたこと
1. 絞り込みの URL を GA4 に渡さないための仕組み（page_location の書き換え・`#` の削り取り・「現在地」の後だけ URL に書かない 等）は作らない。今は GA4 のデータに入っていないため。
2. index.html と GA4 のスニペット（`scripts/lib/ga_snippet.js`）は、page_location を自分で渡さない。
   - `location.href` などで上書きすると、検索語・エリア名・店の ID が GA4 に届き始める。
   - `tests/ga4_fragment_counts.test.js` が、両方のファイルに page_location の語が無いことを見る。
3. 数え直すときは、`.github/workflows/ga4-fragment-counts.yml`（手動・読み取りのみ）を動かす。出すのは件数だけ。

## 選ばなかった案と理由
- **「現在地」で選んだエリアを URL に書かない**: ブックマーク・共有できる絞り込みの URL（2026-05 から）と、手入力の検索と同じ動きを崩す。GA4 に入っていないので、得るものが無い。
- **page_location を `#` の無い URL で明示する**: 今の既定と結果が同じで、設定を 1 つ増やすだけ。
- **gtag の通信を手元で捕まえて確かめ切る**: 前回は送信が出ず判定できなかった。データに入っていないことは件数で確かめられたので、ここで止める。

## 見直す条件
- GA の設定を変えるとき（page_location・page_path を渡す、Google タグ マネージャーに移す 等）
- `#` を含む件数が 1 件以上になったとき（ワークフローで数え直す）
- GA4 の既定の動き（# の後ろを記録しない）が変わったと分かったとき
