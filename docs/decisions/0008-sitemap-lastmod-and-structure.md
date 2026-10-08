# 0008 sitemap の lastmod は「内容が変わった日」にし、robots は sitemap.xml を直接指す

- 日付: 2026-10-09
- 状態: 採用
- 関連: Linear P-117 / [[SEO-121]] / `scripts/lib/sitemap_lastmod.js`・`gen-store-pages.js`・`scripts/gen_area_genre_pages.js`・`scripts/audit_sitemap_health.js`

## 背景
- 2026-10-09 時点で、`sitemap.xml` の 5,823 URL の `lastmod` は全件が生成日（2026-10-08）の1値だった。店舗ページの生成器とハブの生成器が、どちらも当日の日付を書いていたため。
- Google は信頼できない `lastmod` を無視する。その結果、「毎日全ページが更新された」と申告し続けていた。
- robots.txt は `sitemap-index.xml` を指していたが、このファイルは 2026-05-23 から更新されていなかった。束ねていた `sitemap-news.xml`（2 URL）も同日から止まっていた。これらを書くのは旧スクリプト `build_features.js` だけで、CI では動いていなかった。

## 決めたこと
- `lastmod` は、検証できる事実から決める。種類ごとの決め方は次のとおり。

  | 種類 | lastmod の決め方 |
  |---|---|
  | 店舗ページ | 生成した HTML が前回のファイルと違えば当日。同じなら前回の sitemap の値を引き継ぐ |
  | ハブ | `data/area_genre_pages_manifest.json` の `updated` |
  | 特集・記事 | JSON-LD の `dateModified`。無ければ `datePublished`。記事はファイル名の日付も使う |
  | 一覧ページ | 配下のページの最大値 |

- 日付が取れないページには `lastmod` を書かない（例: `about.html`、日付の無い特集）。推測では埋めない。
- 未来の日付は当日に丸める。日付は UTC で数える（生成器・台帳と同じ基準）。
- robots.txt は `sitemap.xml` を直接指す。
- `sitemap-index.xml` は固定ファイルとして残す。束ねるのは `sitemap.xml` と `sitemap-images.xml` だけで、`lastmod` は書かない。Search Console に登録済みの可能性があるため、ファイル自体は消さない。
- `sitemap-news.xml` は廃止する。当サイトは Google ニュースの掲載媒体ではない。
- `build_features.js` は、`sitemap.xml`・`sitemap-news.xml`・`sitemap-index.xml` を書かない。`sitemap-images.xml` は今も書く（それを書く唯一のスクリプトのため）。
- `build.js` は `sitemap.xml` を書かない。CI では `gen-store-pages.js` より先に動き、全 URL の lastmod を当日にして書き直していた。そのため、直後の生成器が引き継ぐ「前回の lastmod」が毎回消えていた。sitemap.xml を書くのは `gen-store-pages.js` と `scripts/gen_area_genre_pages.js`（ハブを追記）だけにする。
- 監査 `scripts/audit_sitemap_health.js` は、次の3つを異常とする: 全件が同じ日、形式不正、未来日。`--lastmod-only` を付けると通信せずに検査だけ行う。

## 選ばなかった案と理由
- **店舗ページの日付を git の最終コミット日から取る**
  - 5,000 ファイルに git log をかけると重い。
  - git はコミット日を返すだけで、内容が変わった日とは限らない。
  - 前回の HTML と比べれば、ネットワークも履歴も要らない。
- **特集の lastmod をファイルの内容ハッシュで決める**
  - 受け入れ条件どおり `dateModified` を使う。
  - 掲載店の入れ替えを `dateModified` に反映するのは [[SEO-131]] の範囲。
- **sitemap-images.xml を外す**
  - 4,165 URL のうち、今の sitemap に無いのは33件だけで、ほぼ健全だったため残す。

## 見直す条件
- [[SEO-131]] で特集の `dateModified` がロスターの更新と連動したら、特集の `lastmod` もそれに従う（コード変更は不要）。
- `sitemap-images.xml` の古さが問題になったら、生成を CI に移すか廃止する。
