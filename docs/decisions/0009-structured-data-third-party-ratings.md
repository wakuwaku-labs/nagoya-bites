# 0009 Google の口コミの評価を構造化データに出さず、SearchAction を外す

- 日付: 2026-10-09
- 状態: 採用
- 関連: Linear P-135 / [[SEO-139]] / `gen-store-pages.js`・`index.html`・`tests/structured_data_policy.test.js`

## 背景
- 店舗ページ（2026-10-09 時点で 4,628 本）とトップのモーダルの Restaurant の JSON-LD に、`aggregateRating` が入っていた。値は `Google評価` と `口コミ数`、つまり Google の口コミの集計。
- トップの WebSite の JSON-LD には `SearchAction`（サイトリンク検索ボックス）が入っていた。`urlTemplate` は `https://nagoya-bites.com/#q={search_term_string}`。

## 確かめたこと（2026-10-09 に確認）
- Google「Review snippet (Review, AggregateRating) structured data」（ページの最終更新は 2026-09-08 UTC）: https://developers.google.com/search/docs/appearance/structured-data/review-snippet
  - 技術的なガイドライン: "Don't aggregate reviews or ratings from other websites."
  - 地域のお店と組織のガイドライン: "Ratings must be sourced directly from users." "Don't rely on human editors to create, curate, or compile ratings information for local businesses."
  - "If you use `AggregateRating`, users should be able to see that aggregate rating on the page."
- Google 検索セントラル ブログ「Farewell, Sitelinks Search Box」（2024-10-21）: https://developers.google.com/search/blog/2024/10/sitelinks-search-box
  - 本文は同じ記事の developers.google.cn 版で読んだ。2024-11-21 から表示をやめる。構造化データは残しても検索で問題は起きず、Search Console のエラーにもならない。外してもよい。サイト名は WebSite の構造化データで引き続き扱う。

## 決めたこと
- Google の口コミの評価は `aggregateRating` に入れない。店舗ページとトップのモーダルの両方から外す。理由は、方針の "Don't aggregate reviews or ratings from other websites." に当たるため。
- 画面の★と口コミ件数の表示は残す。外すのは構造化データだけ。
- 口コミ信頼度（独自に算定した参考指標・`additionalProperty`）は評価の集計ではないので、そのまま残す。
- 当サイトの読者から評価を集める仕組みは作らない（CLAUDE.md の Strategic Skip「匿名口コミの大量集積」）。そのため、今後も `aggregateRating` は出さない。
- `SearchAction` は外す。WebSite の `name`・`url`・`publisher` は残す。サイト名に使われるため。
- 読めない URL（`stores/store-<16進>.html` 177 本）は今回変えない。
  - 変えると、旧 URL ごとに転送ページが要る。GitHub Pages にはサーバー側の転送が無い。
  - それまでに積み上がった評価を一度手放すことにもなる。
  - 一方で、Search Console の 28 日（09-10〜10-07）で表示が出ているのは 7 本だけ（表示 115・クリック 9）。変えて得られるものを測る材料が乏しい。

## 選ばなかった案と理由
- `aggregateRating` を残し、出典を Google と書き添える案: 方針は出典の書き方ではなく、他のサイトの評価を集めて載せること自体を禁じている。
- `ratingCount` の無い店だけ外す案: 件数の有無に関係なく、評価が Google の口コミの集計である点は同じ。

## 見直す条件
- Google のレビュー スニペットの方針が、他のサイトの評価の扱いを変えたとき。
- 店舗ページの CTR（`data/gsc_metrics.json` の `pageTypes.store`。28 日で 0.96%、09-10〜10-07）が、外した後の 28 日で大きく下がったとき。★のリッチリザルトが実際に出ていたかは、検索での見え方を取得していないため確かめられない。
- 読めない URL の店に、検索の表示がまとまって付き始めたとき。
