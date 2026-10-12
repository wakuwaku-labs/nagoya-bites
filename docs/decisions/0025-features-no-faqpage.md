# 0025 特集には FAQPage の構造化データを出さない（画面のよくある質問は残す）

- 日付: 2026-10-13
- 状態: 採用
- 関連: Linear P-317（親 P-235・UI・UX全面改修）/ 計画 I-34・4.4 節 #9 / `build_features.js`（`injectFAQ`）/ `scripts/gen_industry_features.js` / `scripts/audit_feature_schema_alignment.js` / `tests/feature_no_faqpage.test.js` / `scripts/gen_area_genre_pages.js`（ハブ側の同じ決定・SEO-124）

## 背景
- 特集（`features/*.html`）64 本が、FAQPage の構造化データ（JSON-LD）を持っていた（2026-10-13 に数えた）。エリア×ジャンル×条件のハブページ（`stores/area/`）は SEO-124 で「FAQPage を出さない」と決めてあり（`scripts/gen_area_genre_pages.js` の注記: Google は 2026-05-07 から FAQ のリッチリザルトを表示しない）、同じ種類のページで扱いが分かれていた。
- 構造化データは画面に見える内容と一致していなければならない。特集の中には、FAQPage の JSON-LD があるのに画面に「よくある質問」が無いページ（`review-trust.html`）もあり、一致していなかった。
- 特集の FAQPage は、書く側が 2 系統あり（`build_features.js` の `injectFAQ` と `scripts/gen_industry_features.js`）、そのほかに特集へ一括で足す単発のスクリプトが 3 本あった。画面の質問と構造化データの 2 か所を、毎回そろえて保つ必要があった。
- オーナーの決定（2026-10-13・計画 4.4 節 #9）:「特集のFAQPage: 出さない（ハブページと同じ）（おすすめどおり）」。

## 決めたこと
1. **特集に FAQPage の JSON-LD を出さない。** 64 本から外した（489 行の削除・追加 0 行）。ほかの JSON-LD（Article・ItemList・BreadcrumbList など）と画面の表示は変えていない。外す前後で 64 本すべてについて、残りの JSON-LD の中身と画面の本文が同じであることを突き合わせた。
2. **画面の「よくある質問」は残す。** 読者が読む情報（予約・人数・予算などの疑問への答え）で、決定の範囲は構造化データだけ。
3. **書く側を直す。** `build_features.js` の `injectFAQ` は画面の質問だけを差し込み、過去に差し込んだ `<!-- FAQ-LD:START/END -->` の区画があれば消す。`scripts/gen_industry_features.js` も JSON-LD を出さない（画面の質問 3 つは同じ）。特集へ FAQPage を一括で足す `scripts/apply_faq_per_topic.js` は、実行しても何も書かずに止まる。JSON-LD から画面の質問を起こす `scripts/sync_visible_faq_from_jsonld.js` は、対象が無くなった（注記を足した）。
4. **検査で止める。** `scripts/audit_feature_schema_alignment.js` は、特集の FAQPage を違反（`faqpage_not_allowed_in_feature`）として数える（`build.yml` が日次で実行）。`tests/feature_no_faqpage.test.js` が `npm test`（blocking）で、(a) 特集に FAQPage が無いこと（配列・`@graph` の中も見る）、(b) 画面の質問が減っていないこと、(c) 書く側が FAQPage を書き戻さないこと、(d) 単発のスクリプトが動かないことを見る。
5. **`dateModified` は上げない。** 画面に見える内容が変わっていない（構造化データだけの変更）ため。
6. **範囲外（残す）**: トップページ・`faq.html`・ジャーナル 3 本の FAQPage。オーナーの決定は「特集」と「ハブと同じ」であり、これらは含まれない（`audit_feature_schema_alignment.js` はジャーナルの FAQPage を引き続き画面との一致で見る）。

## 選ばなかった案と理由
- **出し続ける**: Google が FAQ のリッチリザルトを表示しないので、検索に出る見た目は変わらない。一方で、ハブと扱いが分かれ、2 か所の同期（画面と構造化データ）の手間と、`review-trust.html` のように画面と一致しないページを生む余地が残る。
- **画面の FAQ も一緒に消す**: 読者が使う情報であり、決定の範囲を超える。
- **Bing・生成 AI のために残す**: FAQPage をそれらが使っているという、第三者が検算できる事実を持っていない（制約 10 と同じ考え方）。北極星指標（生成 AI 経由・Bing 経由のセッション）の変化で確かめる。

## 見直す条件
- Google・Bing・生成 AI の引用のどれかで FAQPage が効くと、検証できる事実で確かめられたとき。戻すときは、特集とハブを同時に、画面の質問と一致する形で（`data/feature_faqs.json` から生成して）戻す。手で書かない。
- 画面の質問を増やす・直すときは、構造化データを足さず、`data/feature_faqs.json` か記事に直接書く。
