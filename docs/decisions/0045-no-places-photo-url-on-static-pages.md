# 0045 書いた後に取り直さない面（ジャーナル・特集・sitemap-images.xml）に、Google Places の写真 URL を書かない

- 日付: 2026-10-15
- 状態: 採用（オーナーが 2026-10-15 に「案 1」を選んだ）
- 関連: Linear P-29 / PR #592（失効分の後始末）/ `scripts/lib/places_photo_url.js` / `scripts/audit_static_places_urls.js` / `data/journal_photo_policy.json`

## 背景
- Places の写真は「photo name は期限切れになりうる」「photo name をキャッシュしてはいけない」（Place Photos の公式説明。寿命の記載はない）。
- 2026-10-15 の実測: 公開ページの Places 写真 URL 164 件のうち 56 件が 403（59 ページ）。失効は時間で一律ではなく写真ごとに起きる（同じ週の記事で 200 と 403 が混在）。
- 毎日作り直す面（店舗ページ）は URL が毎日更新されるので壊れない。壊れたのは、書いたあとで取り直されない面（過去のジャーナル 18・特集 12・孤児の店舗ページ 29・sitemap-images.xml）だった。#592 が失効分を外した。

## 決めたこと
1. 書いた後に取り直さない面には、Places の写真 URL（`lh*.googleusercontent.com`・`places.googleapis.com`・`maps.googleapis.com/maps/api/place/photo`）を書かない。対象は日次ジャーナル（ヒーロー・本文写真・og:image）、特集（カード・顔・og:image）、sitemap-images.xml。毎日作り直す店舗ページは対象外。
2. 写真の選び方は、HotPepper の公式写真 → プレスリリース → 記事固有の図、の順。Places の写真しか無い店は、写真なしか図にする。他の店の写真は借りない（CLAUDE.md の写真の決まりは変えない）。
3. 実装:
   - `generate_daily_draft.js`: Places のヒーロー取得を廃止。手書きの hero_image_url / og_image が Places なら外す。
   - `scripts/lib/journal_photos.js`: 本文写真の候補から Places を外す（HotPepper のみ）。
   - `refresh_feature_rosters.js` / `build_features.js`: カードの写真と「写真あり」の数え方（ロスターの requirePhoto）から Places を外す。Places しか写真が無い店は、写真が必須の特集の入れ替え候補にならない。
   - `build_features.js`: sitemap-images.xml に Places の URL を入れない。
   - 検査: `validate_journal_draft.js` 15d（新しい記事に Places の URL があれば落とす）、`scripts/audit_static_places_urls.js --check`（journal・features・sitemap-images のファイルごとの件数が基準 `data/static_places_url_baseline.json` を超えたら落とす。build.yml で毎日）。
4. Places の API を呼ぶ量は増えず、むしろ減る（日次ジャーナルの Places 呼び出しがなくなる）。

## 結果（見込み）
- 直近 30 日（2026-09-15〜10-15）のジャーナル 30 本のうち、ヒーローが Places 由来だったのは 8 本（27%）、本文写真に Places があったのは 18 本。これらの日は、HotPepper に写真が無ければ写真なしになる（取り繕わない）。
- 写真が必須の特集では、Places しか写真が無い店は次回の入れ替えから候補に入らない（73 店が該当）。

## 見直す条件
- 写真なしの記事が増えて閲覧に響くと分かったとき（プレスリリースや図の手配を増やす。Places を戻すのではなく）。
- Places の規約が、写真の保存や URL の寿命について変わったとき。
