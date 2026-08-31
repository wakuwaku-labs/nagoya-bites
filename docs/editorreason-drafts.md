# editorReason 自動生成 draft レビュー（ISSUE-045）

> **生成**: 2026-08-31T22:44:50.556Z
> **対象**: 上位 50 候補 / 生成 44 件
> **結果**: OK 42 / INSUFFICIENT 2 / WARN 0 / ERR 6
> **自動マージ候補** (confidence ≥ 0.85): 15 件
> **人手レビュー要**: 27 件

## レビュー手順

1. 各 draft の editorReason / sources_used を確認
2. 採用する draft は `[approved]` 行を追加（または `[reject]`）
3. `node scripts/approve_editorreason_drafts.js` を実行 → editor_picks.json に反映
4. `node build.js` → `git push origin main` で公開

## draft 一覧

### 賛否両論 名古屋（名古屋市千種区 / 日本料理・★4.2）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 「和食界のユニクロ」を掲げる笠原将弘氏の哲学が息づく予約困難な日本料理店。伝統を踏まえつつ遊び心溢れる独創的な和食を、敷居を感じさせない雰囲気で提供。名古屋店独自の地元食材使いや、名物のデザート全種オーダー可など、再訪を促す工夫が光ります。
- **insiderNote**: 笠原氏の「腕・舌・遊び心」をモットーに、伝統と創意工夫が融合した唯一無二の和食を提供。弟子が活躍する場として多店舗展開し、名古屋店料理長も食育活動に注力。お品書きなしやデザート全種オーダー可など、顧客体験を重視する姿勢が伺えます。
- **sources_used**:
  1. [店主笠原氏が「敷居の高くない日本料理屋」を目指し、「和食界のユニクロ」と表現していること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF2Olrlqv9HFgZGk1ft61PNGn4h1qSs66SJ5kQzA5Fsoz0Xl88e5tb4QvyxyRDeogK6UcucXzQbQUW6SH4Kc5GRtgWTA--8IJHG7EOrKUbQO8-cIyUQfKLXE1RNn3BhCclcGn4UKhyd0cjnfj35)
     > 笠原氏は「敷居の高くない日本料理屋」を目指し、「和食界のユニクロ」と表現しています。
  2. [店舗が敷居の高さを感じさせないフレンドリーな雰囲気であること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFw2Oj-x8jMW-PouDW6pisvQ_XGeO8b0doTChH8j9qpJYbZ08H9S2bf7bogFN0DulGMwhLVKgJc2u6r0siyvYnivpX9swjC26_B5SvXXvy4vWRiTvEG-32mYxuJqSqxAMfShVV21w==)
     > 敷居の高さを感じさせないフレンドリーな雰囲気で、和食が初めての人でも気軽に訪れることができるとされています。
  3. [店主笠原氏のモットー「腕・舌・遊び心」に基づき、伝統と創意工夫を凝らした唯一無二の和食が提供されていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF2Olrlqv9HFgZGk1ft61PNGn4h1qSs66SJ5kQzA5Fsoz0Xl88e5tb4QvyxyRDeogK6UcucXzQbQUW6SH4Kc5GRtgWTA--8IJHG7EOrKUbQO8-cIyUQfKLXE1RNn3BhCclcGn4UKhyd0cjnfj35)
     > 笠原氏のモットーは「腕・舌・遊び心」であり、伝統を踏まえつつ創意工夫を凝らした、旬を感じる唯一無二の和食を提供しています。
  4. [和食の枠にとらわれない素材使いや斬新な組み合わせ、遊び心や季節感を重視した発想豊かな料理が提供されていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFw2Oj-x8jMW-PouDW6pisvQ_XGeO8b0doTChH8j9qpJYbZ08H9S2bf7bogFN0DulGMwhLVKgJc2u6r0siyvYnivpX9swjC26_B5SvXXvy4vWRiTvEG-32mYxuJqSqxAMfShVV21w==)
     > 和食の枠にとらわれない素材使いや斬新な組み合わせ、遊び心や季節感を重視した発想豊かな料理が提供されます。
  5. [名古屋店が東海4県を中心とした地元食材を使用し、東京本店とは異なる味わいを提供していること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFw2Oj-x8jMW-PouDW6pisvQ_XGeO8b0doTChH8j9qpJYbZ08H9S2bf7bogFN0DulGMwhLVKgJc2u6r0siyvYnivpX9swjC26_B5SvXXvy4vWRiTvEG-32mYxuJqSqxAMfShVV21w==)
     > 名古屋店では東海4県を中心とした地元食材を使用しており、東京本店とは異なる味わいを楽しめる点も特徴です。
  6. [和食店としては珍しい「デザート全種オーダー可」が名物サービスであること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFw2Oj-x8jMW-PouDW6pisvQ_XGeO8b0doTChH8j9qpJYbZ08H9S2bf7bogFN0DulGMwhLVKgJc2u6r0siyvYnivpX9swjC26_B5SvXXvy4vWRiTvEG-32mYxuJqSqxAMfShVV21w==)
     > 和食店としては珍しく、「デザート全種オーダー可」というサービスが名物の一つとなっています。
  7. [和食店としては珍しい「デザート全種オーダー可」が名物サービスであること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFpClyQFrPhquYqjVJ_MT0KgUzxl7OuOJRz83qDFooLzqaiHwVnhUKv7cgIVX7Z0DAFVo6vjQUMsjnKsDCxZiFbe0lCoQyfWtxKzPdrHXuKOX_SFs3vASU2Zw6GiKX17tB8qIL3WxIlkwSSW2DnvTvFu0w=)
     > 和食店としては珍しく、「デザート全種オーダー可」というサービスが名物の一つとなっています。
  8. [笠原氏が弟子たちの活躍の場として多店舗展開を進めていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF2Olrlqv9HFgZGk1ft61PNGn4h1qSs66SJ5kQzA5Fsoz0Xl88e5tb4QvyxyRDeogK6UcucXzQbQUW6SH4Kc5GRtgWTA--8IJHG7EOrKUbQO8-cIyUQfKLXE1RNn3BhCclcGn4UKhyd0cjnfj35)
     > 笠原氏は、弟子たちが活躍できる場を提供するために多店舗展開を進めており、名古屋店の成功がその大きな要因であったと語っています。
  9. [名古屋店の料理長がメディア出演や食育活動に積極的に取り組んでいること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF2Olrlqv9HFgZGk1ft61PNGn4h1qSs66SJ5kQzA5Fsoz0Xl88e5tb4QvyxyRDeogK6UcucXzQbQUW6SH4Kc5GRtgWTA--8IJHG7EOrKUbQO8-cIyUQfKLXE1RNn3BhCclcGn4UKhyd0cjnfj35)
     > 名古屋店の料理長である丹下陽介氏は、名古屋店を統括する傍ら、メディア出演や市町村とのコラボレーション、中部地区の小中学校での家庭科の授業（和食給食応援団として）も積極的に行っています。
  10. [お品書きを用意せず、提供直前まで料理の内容を秘密にしていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF2Olrlqv9HFgZGk1ft61PNGn4h1qSs66SJ5kQzA5Fsoz0Xl88e5tb4QvyxyRDeogK6UcucXzQbQUW6SH4Kc5GRtgWTA--8IJHG7EOrKUbQO8-cIyUQfKLXE1RNn3BhCclcGn4UKhyd0cjnfj35)
     > お品書きは用意せず、提供直前まで料理の内容を秘密にしています。
  11. [お品書きを伏せてお客様にワクワク感を提供していること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFw2Oj-x8jMW-PouDW6pisvQ_XGeO8b0doTChH8j9qpJYbZ08H9S2bf7bogFN0DulGMwhLVKgJc2u6r0siyvYnivpX9swjC26_B5SvXXvy4vWRiTvEG-32mYxuJqSqxAMfShVV21w==)
     > お品書きは提供直前まで伏せられており、お客様にワクワク感を提供しています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_賛否両論名古屋 -->

---

### 鮨 旬美 西川（名古屋市中村区 / 寿司 (江戸前鮨)・★4.7）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 「ミシュラン二つ星」や「The Tabelog Award Bronze」を複数年受賞する名古屋を代表する鮨の名店。地元食材を活かした「名古屋前鮨」の哲学と独創的な技で、客を驚かせ続ける実力派です。
- **insiderNote**: 「お客様に楽しく食事をしていただくこと」をビジョンに掲げ、20年以上腕を磨いた店主は「やりすぎくらいが丁度いい」と語る。緻密な仕事と独創性でファンを魅了。
- **sources_used**:
  1. [ミシュラン二つ星評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEfZxXEKtgqWCxs3FsSFpdN9PJiJkK0VF5n2Osg7xNFMMnCW5-9rmyB7N9y18HM4cA6O21V-IrqT5Mc616O4De3M6_k4l69mULv8zc2T10QZl5q5JhUncS0iM-trwPmuzVSoZX--AoJD7eCRXv1UDfHeQ==)
     > ミシュランで二つ星評価！名駅の「鮨旬美西川」で味わう、極上の寿司
  2. [名古屋を代表する鮨の名店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG4n-_2cnfb7cEiGfIOF7wijL4f81UnQ7ygosWarbji9pTN6v1u-zYDUw451VVn14rEXV22PIockWYL_AU5705NR6YJn4w9M4K60hlqYLjG4CuV9gzQoEvUL1_4Nh30FojVKRn30i1L0I3eohEN8w==)
     > 名古屋を代表する鮨の名店
  3. [The Tabelog Award Bronzeを複数年連続で受賞](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG4n-_2cnfb7cEiGfIOF7wijL4f81UnQ7ygosWarbji9pTN6v1u-zYDUw451VVn14rEXV22PIockWYL_AU5705NR6YJn4w9M4K60hlqYLjG4CuV9gzQoEvUL1_4Nh30FojVKRn30i1L0I3eohEN8w==)
     > The Tabelog Award Bronzeを複数年連続で受賞し、寿司EAST百名店にも選出されています。
  4. [「名古屋前鮨」の哲学と地元食材の活用](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG3w1mAKlkbubPf3Sy_EUX3vAvkb6VrYFIhYPLJg0fFgYQ4zCES1iYUA1m02iHrUWHOzrn6M0QhSYulVxcZ0--NWqurQrZD5GV-do7D-DhJ1vwoHQHE_6hsUpZFiwjrRcUPgiRK994XqIynMukdpIe4oWmN5puq_cnn5BAwNHUBGSUdJRmYyEo=)
     > 「東京でできる味ではなく、名古屋でしかできない鮨を提供する」という「名古屋前鮨」の哲学を持ち、愛知県の海の幸を中心に旬を見極めた上質な魚介を提供しています。
  5. [独創的な鮨を提供し客を驚かせている](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG4n-_2cnfb7cEiGfIOF7wijL4f81UnQ7ygosWarbji9pTN6v1u-zYDUw451VVn14rEXV22PIockWYL_AU5705NR6YJn4w9M4K60hlqYLjG4CuV9gzQoEvUL1_4Nh30FojVKRn30i1L0I3eohEN8w==)
     > こだわりと独創性で客を驚かす、江戸前寿司
  6. [独創的な一品を提供](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG3w1mAKlkbubPf3Sy_EUX3vAvkb6VrYFIhYPLJg0fFgYQ4zCES1iYUA1m02iHrUWHOzrn6M0QhSYulVxcZ0--NWqurQrZD5GV-do7D-DhJ1vwoHQHE_6hsUpZFiwjrRcUPgiRK994XqIynMukdpIe4oWmN5puq_cnn5BAwNHUBGSUdJRmYyEo=)
     > 「烏賊」の握りでは、白く透き通った烏賊に美しい雲丹を乗せ、その下に削ぎ切りされた烏賊の身とシャリを隠すという、「和菓子のように綺麗な鮨」と評される独創的な一品も提供されます。
  7. [緻密な仕事と独創性でファンを魅了](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG4n-_2cnfb7cEiGfIOF7wijL4f81UnQ7ygosWarbji9pTN6v1u-zYDUw451VVn14rEXV22PIockWYL_AU5705NR6YJn4w9M4K60hlqYLjG4CuV9gzQoEvUL1_4Nh30FojVKRn30i1L0I3eohEN8w==)
     > 「緻密な仕事に惚れ込むファンも多い」と評されており、「独創的な鮨」を提供することで客を驚かせています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_鮨旬美西川 -->

---

### エノテーカ ピンキオーリ 名古屋（名駅 / クラシックイタリアン・★4.1）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: ミシュラン一つ星獲得、国際ランキング「50 TOP ITALY」選出の名古屋を代表するイタリアン。本店譲りのワインと料理のマリアージュに加え、受賞歴あるシェフが地元の厳選素材で織りなす一皿は、特別な体験を約束します。
- **insiderNote**: フィレンツェ本店は三ツ星。名古屋店もミシュラン一つ星、さらに国際ランキング『50 TOP ITALY』に日本で唯一選出。統括調理長や料理長も受賞歴を持つ実力派で、ワインと料理のマリアージュは必見。
- **sources_used**:
  1. [名古屋店がミシュラン一つ星を獲得していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGi7iib9KV8SqSuznIkLIPmrY1afhNGNXNqt0OAx5eFHukzobmNFNcwlOfSglPa6V_B5g_mzSma4tCtpMxMHGQRcHipQg9QDaCKw8_wLpDgG066fPUY6zvrGCeJT4k4Yug6ppfDYAJJd-JFNQ==)
     > 名古屋店も「ミシュランガイド愛知特別版2019」で一つ星に選出されています。
  2. [国際的なイタリア料理ランキング「50 TOP ITALY 2026」に選出されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEkzBzyTmjDMDk9qmSs8tjHqHTHGtWhconESBQVljI1YNgynrnuILm9cTDHn3NfHjCh3WggRe6x9t8njFJrmSEkDaXJai2mE4Asf3IJcg-pX-38jt4aJouIgjsz41JqqU4hYEFPJ2e5-6W_Fe8IZytpuFNRQlk=)
     > 国際的なイタリア料理専門ランキング「50 TOP ITALY 2026」において、日本国内で唯一選出され、43位にランクインしました。
  3. [統括調理長兼製菓長の島光平氏と料理長の戸田直幸氏が受賞歴を持つこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEkzBzyTmjDMDk9qmSs8tjHqHTHGtWhconESBQVljI1YNgynrnuILm9cTDHn3NfHjCh3WggRe6x9t8njFJrmSEkDaXJai2mE4Asf3IJcg-pX-38jt4aJouIgjsz41JqqU4hYEFPJ2e5-6W_Fe8IZytpuFNRQlk=)
     > 統括調理長兼製菓長の島光平氏は、「Best Pastry Chef Award by Valrhona and PARIANI 2025」を受賞し、「パネットーネ ワールドチャンピオンシップ2025」の世界大会にも出場しました。料理長の戸田直幸氏は、「マンチーニパスタコンテスト」で最優秀賞を受賞しています。
  4. [料理とワインのマリアージュを体験できるワインコースが提供されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHV4uRP1DLYe-_DcFp35VsEB9JTRZV6XRs_dQY5zvn7Vb6G3w8jpGrNOVbUtQiUr7tQNv3GBTcuwFlYdSs5XeSoPBTe7BTx6AV0an3lXZ7mtXJ5TUMHkh_SkJl-9dw=)
     > 料理に合わせてワインを注ぐ「ワインコース」が提供され、コース全体を通じて料理とワインのマリアージュを体験できます。
  5. [フィレンツェ本店がミシュラン三ツ星を獲得していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGi7iib9KV8SqSuznIkLIPmrY1afhNGNXNqt0OAx5eFHukzobmNFNcwlOfSglPa6V_B5g_mzSma4tCtpMxMHGQRcHipQg9QDaCKw8_wLpDgG066fPUY6zvrGCeJT4k4Yug6ppfDYAJJd-JFNQ==)
     > フィレンツェ本店はミシュランガイドで三ツ星を獲得している名門リストランテです。
- **warnings**: 7件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_エノテーカピンキオーリ名古屋 -->

---

### 那古野 しば福や 名駅店 (なごの しばふくや めいえきてん)（名古屋市中村区 / ひつまぶし、丼もの、和食・★4.6）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 名古屋のうなぎ名店で修行を積んだ店主が、実家養殖業の知見とサラリーマン経験を活かし、型にはまらないうなぎ料理と本格和食を提供。本店はミシュラン認定の実績を持ち、上質な空間で幅広い客層に対応する点が業界から注目される。
- **insiderNote**: うなぎ養殖業出身で「うな富士」で修行した店主の確かな腕と、サラリーマン経験を活かした型にはまらないメニュー考案が強み。本店はミシュラン認定。上質な空間で幅広い客層に対応し、価格高騰下でも品質維持に努める姿勢は評価に値する。
- **sources_used**:
  1. [店主の経歴（実家がうなぎ養殖業、サラリーマン経験）、型にはまらないメニュー考案、本格和食の提供、上質な空間と幅広い客層への対応、本店のミシュラン認定](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHAW-557fM2C-Xe8-hA_2PXcG-RYDEiAXeSYmxt4jqm18qaSuKhQZ9DnZTQH-gQL20APovFDlfGhpCDgNItsL11Ft35RbccLuHQFzcUktRWGyFBlGj4rNoJBBgmPlemsQ==)
     > 店主である柴田哲滝氏は、実家がうなぎの養殖業を営んでいたため、幼少期からうなぎに親しんできました。大学卒業後、8年間サラリーマンを経験した後に、父親の背中を見てうなぎの世界へ飛び込んだと語っています。サラリーマン時代の経験が「うなぎ料理の型にはまらない」という強みとなり、画期的なメニュー考案に繋がっていると考えています。また、「極上のうなぎと本格和食を楽しめるお店」として、接待や特別な会食に最適な
  2. [店主の経歴（実家がうなぎ養殖業、サラリーマン経験）、型にはまらないメニュー考案、本格和食の提供、上質な空間と幅広い客層への対応、本店のミシュラン認定](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHD--2HxD94UA9-aAOUZecLfmD-TKIuimtPn9HMPRF5ZKnDD5Lo06vWmtFhq0hNectMiX6n6BYIyMFKGynMcnrX9gSVDyBvThIBNh-HQAEj564hvwV0ceI=)
     > 店主である柴田哲滝氏は、実家がうなぎの養殖業を営んでいたため、幼少期からうなぎに親しんできました。大学卒業後、8年間サラリーマンを経験した後に、父親の背中を見てうなぎの世界へ飛び込んだと語っています。サラリーマン時代の経験が「うなぎ料理の型にはまらない」という強みとなり、画期的なメニュー考案に繋がっていると考えています。また、「極上のうなぎと本格和食を楽しめるお店」として、接待や特別な会食に最適な
  3. [店主が名古屋のうなぎ名店「うな富士」で修行した経験](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQExVsUNdgQJnyqqMOgJpVdOKFVNMa0zmHwzQmc5MjfflxhyA60tYQqMHoaq7wdrBW1RgPDrTTMhbD_tpaxQwlrfG7fGNQwvoQfnjYd59S1B1YGn8g8i1PC4TXMbql0uDWgcoVuptA==)
     > 店主の柴田哲滝氏は、名古屋を代表するうなぎの名店「うな富士」で約15年間修行を積んだ経験があります。
  4. [店主が名古屋のうなぎ名店「うな富士」で修行した経験、本格和食の提供、本店のミシュラン認定](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGo7HwW9GM4G4s0Jw7O7PwvSwncMBegKyhrr8d2XzAwMMKSipnhFQZPotqwKtNYRTOKtm9Mvs6_9mnid0QDRhvZfZ9CP5obJskPshKhg7iUv2TuJ4I6qIrhVOY=)
     > 店主の柴田哲滝氏は、名古屋を代表するうなぎの名店「うな富士」で約15年間修行を積んだ経験があります。 「那古野 しば福や 名駅店」では、うなぎ料理だけでなく、割烹出身の料理人による季節感あふれる和食も提供しています。 本店である「うなぎ家 しば福や」は、オープン翌年の2019年にはミシュランガイドのビブグルマン部門に認定されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_那古野しば福や名駅店(なごのしばふくやめいえきてん) -->

---

### レミニセンス (Reminiscence)（名古屋市東区 / フランス料理・★4.5）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 「カンテサンス」「ハジメ」で研鑽を積んだ葛原シェフが、「余韻と記憶」をコンセプトに独自のフレンチを提供。ミシュラン2つ星、ゴ・エ・ミヨ「明日のグランシェフ賞」など権威ある賞を多数受賞し、全国トップクラスの評価を誇る名店です。
- **insiderNote**: 東西の名店で研鑽を積んだ葛原シェフは、ミシュラン2つ星、ゴ・エ・ミヨ「明日のグランシェフ賞」など権威ある評価を多数獲得。全国トップクラスの技術で、現代フレンチの枠を超えた独自の世界観を追求しています。
- **sources_used**:
  1. [葛原シェフが東京「カンテサンス」と大阪「ハジメ」で研鑽を積んだこと、ミシュラン2つ星を獲得していること、ゴ・エ・ミヨで評価されていること、食べログで全国トップクラスの評価を得ていること、そして「余韻と記憶」をコンセプトにしていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG4C78ec94WGCBbn4DjuCsRToXy9gzXzQ8prqbOUhHNY2c-skCEW0UNab6G8vFP_xlpgIJDJcgB8a5mWRmr76Pb5i9RfTq1FPSEzuI_sZpgCjavY1DPAPWzaXaStC5sxikEjZijnpqk452eO3E=)
     > オーナーシェフ葛原将季氏は、東京の「レストラン カンテサンス」と大阪の「レストラン ハジメ」という日本フレンチ界の二大巨頭として知られる名店で研鑽を積みました。
  2. [葛原シェフが東京「カンテサンス」と大阪「ハジメ」で研鑽を積んだこと、ミシュラン2つ星を獲得していること、ゴ・エ・ミヨで評価されていること、食べログで全国トップクラスの評価を得ていること、そして「余韻と記憶」をコンセプトにしていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGeJ3zJ0mM0kE7lv1cfRqSBvL1UXv0q_eYaTCtnESP3C9ExVH4V8A5hrCmVDaCimnhgpKi-0eYx3F-Qye3ksa87qkh_zboMDK-gPctfGnLcoayz-Tjuc-scBj4YJPWg6qyKfQgIe9s=)
     > 葛原シェフは、東京の「レストラン カンテサンス」と大阪の「レストラン ハジメ」という日本フレンチ界の二大巨頭として知られる名店で研鑽を積みました。
  3. [ゴ・エ・ミヨで毎年16.5点（3トック）を獲得し、2026年度には「明日のグランシェフ賞」を受賞していること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHJn2XJh7i7RKK3r1JnPGKEUZorJ5FuV06rUqbmLspUxUBFH0Jqab0KFkpdyPblWFC43nRofnxdf2dZ91EFIyu2S0p6XjCYEl8VXSotrUFpgcQSPYAcbl-jXMmfTkx0F3995cZBe4Gh3l2V0z2kiT8U)
     > ゴ・エ・ミヨでは毎年16.5点（3トック）を獲得し、2026年度には「明日のグランシェフ賞」を受賞しています。
  4. [食べログアワードでsilverを連続受賞し、フレンチ・イノベーティブ部門で全国トップクラスの評価を得ていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGOVGI-j7Wszcrbo2rRmkbBoJ-iqSFcn1IC48BXyEX6toTk8JTRfqVbeq1_cygWU9RmEE2E9JPcmTMfx7B83SWshWt9inGfoY7fDZVwG0yKsij4iRFQ_I5OwIGmJkkztaTodc6pljEP)
     > 食べログアワード2022ではsilverを受賞し、8年連続で食べログシルバーの評価を受けています。フレンチ部門、イノベーティブ部門ともに全国でトップクラスの評価を得ており、フレンチ全国7位、イノベーティブ全国7位にランクインしています。
  5. [葛原シェフが「余韻と記憶」をコンセプトに、現代フレンチの枠を超えた独自の世界観と繊細な技術を追求していること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHC6bBe-3yXP1slje1Vi6YNMIrAESDQgGkOQqIlbSmCyL9VbMJz1RcbIpOX-3wOjSgq8velQNcueDTt3tHJpI1kPfcBeQIZefYKc1VkAYtNNWCxOS5y_tUHcS7MwTG4K-gVw8JA3H9wOgBYSPFV)
     > 葛原シェフの料理は、「余韻と記憶」というコンセプトに基づき、五感に深く刻まれる物語のような体験を提供すると評されています。0.1度単位で温度を見極める火入れや、素材の可能性を最大限に引き出す繊細な技術を駆使し、現代フレンチの枠に収まらない独自の世界観を追求しています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_レミニセンス(reminiscence) -->

---

### 壺中天（名古屋市東区 / フランス料理・★4.6）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 名古屋のフレンチを牽引する名店。ミシュラン一つ星、ゴ・エ・ミヨ3トックを獲得し、オーナーシェフと若手シェフの二名体制で、伝統を継承しつつ「今の時代を彩る料理」を追求し続けている点が業界から高く評価されています。
- **insiderNote**: 上井・河村両シェフの世代を超えた協業が、伝統と革新を両立する「今の時代を彩る料理」を生み出しています。フランスでの豊富な経験がその情熱を支えています。
- **sources_used**:
  1. [オーナーシェフと若手シェフの二名体制、伝統と進化の追求、「今の時代を彩る料理」のアップデート、ミシュラン1ツ星・ゴ・エ・ミヨ3トック獲得、名古屋の名店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHPdWszCR6QTpqHxmKNEb7Uu1za-qa1P4ooiowmeqqPd1XDHJq6uNdBi32OUlI6XDjgR2Fn0AiSsAoTQjekrOVIcJqtIk-1-Bfdku4J3zCRkKP2hftDyqupXHAP4r58GTPjUaetlL1zkD3wXXw=)
     > 「壺中天」は、伝統的なフランス料理を追求しつつ、常に進化する一皿を提供しているレストランです。オーナーシェフの上井克輔氏とシェフの河村英幸氏の二名体制で料理が作られています。…世代の異なる両シェフは、フランスでの経験を経て日本でフランス料理を作り上げることへの情熱を共有しており、上井シェフはフランス料理が時代を映す料理であるため、世代の感性も重要だと語り、河村シェフへのリスペクトを示しています。彼
  2. [ミシュラン1ツ星・ゴ・エ・ミヨ3トック獲得](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGxjXO3JlmgkRlHFuL8J7liVgHMVnpP3aEnxjpqaELCP4Yinbu8wLMvfXvjD2YMK3u2dhMJVOpCCwoN_3ufzTiayvrDaEfYWXqjdwc7AchbApoyDPzQEGL4VhnT4y5HRZ0=)
     > ミシュランガイド愛知・岐阜・三重2019特別版で1ツ星を獲得しており、ゴ・エ・ミヨ2025では3トック（16/20点）の評価を受けています。
  3. [オーナーシェフと若手シェフの二名体制、伝統と進化の追求、「今の時代を彩る料理」のアップデート](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHFZ5HX986wzeecTRY5wLwjLxBHvCjgQYAGzynQ2jpGD7EWXheq9E32cSR01cMXXTCQawvySyItk9tNQJZ-Zrvv5uBSFb8XMYXZ2ZzKsyLXpvWA)
     > オーナーシェフの上井克輔氏とシェフの河村英幸氏の二名体制で料理が作られています。…世代の異なる両シェフは、フランスでの経験を経て日本でフランス料理を作り上げることへの情熱を共有しており、上井シェフはフランス料理が時代を映す料理であるため、世代の感性も重要だと語り、河村シェフへのリスペクトを示しています。彼らは「今の時代を彩る料理」のアップデートを重ねています。
  4. [名古屋の賓客に愛される名店であること、ミシュラン1ツ星獲得](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGppwPKnIyIYh-x1FZNOin_jpvZY8j5ImiXxIpXYgN76Z71T9uuBLQvCGPsVMynoKC2QigGumEjL443nqh7LqPUsU-iJ-5G1oeriJ8V1vY1520OpTskb38tnkDiaRRbSkjU6cMYw8qk9zwW9g==)
     > 「壺中天」は、名古屋の賓客に愛されてきた名店として知られています。…「ミシュラン一つ星として認められた名古屋の有名フレンチ」として取り上げられています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_壺中天 -->

---

### トゥ・ラ・ジョア イズム（名古屋市中区 / イノベーティブ・フレンチ、創作料理・★4.6）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: シェフ須本氏が顧客カルテに基づき二度と同じ料理を出さない唯一無二のコースを提供。名古屋で最も予約困難な完全紹介制ながら、食べログアワード受賞歴も持つ、美食の芸術家による感動体験が魅力。
- **insiderNote**: シェフは医療用遠心分離機や丸ごと食材購入など、常識外の手間を惜しまず、分子ガストロノミーも取り入れた創作料理を展開。空間デザインも一流で、美食クリエイターの異名を持つ。
- **sources_used**:
  1. [顧客カルテに基づく唯一無二の料理提供](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEC9MZB2pzDV2Syokn1YzY4tj5Bde9bo7c3VoRPrm5sG4WHZ-jHEBSByl71ufF1bx2W-5QfDq2n_TpWB4R94efTxaVPBYpI-QaoVlgzfZNYLpLlJfS77Gf2899j0D3lV2rOXAjz-b6P8LNTRpbvU387dg==)
     > 独創性が高く、他の店と同じような料理は一切出さず、完璧な顧客管理のもと、顧客ごとに異なるメニューを提供している点が特筆されます。
  2. [顧客カルテに基づく唯一無二の料理提供](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHfU_xEqivrnoifELvJOEYQ8YolARj-ckLJAyGNUWS-vgzUE-2rtlQI9RdF876k92sus7uWFXpjVTA5qF9FGf1xAMnio55fFB6Q0QS7B_Ltt3vuRv7gpIOZttYDe2pwkJ0wM406z3tHGevlKLf1f1jRtg6eQRXraArP)
     > 独創性が高く、他の店と同じような料理は一切出さず、完璧な顧客管理のもと、顧客ごとに異なるメニューを提供している点が特筆されます。
  3. [名古屋で最も予約困難な完全紹介制](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEC9MZB2pzDV2Syokn1YzY4tj5Bde9bo7c3VoRPrm5sG4WHZ-jHEBSByl71ufF1bx2W-5QfDq2n_TpWB4R94efTxaVPBYpI-QaoVlgzfZNYLpLlJfS77Gf2899j0D3lV2rOXAjz-b6P8LNTRpbvU387dg==)
     > 「名古屋で最も予約が取れないレストラン」の一つとして知られており、一見客お断りの完全紹介制で、電話番号も非公開です。
  4. [名古屋で最も予約困難な完全紹介制](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHfU_xEqivrnoifELvJOEYQ8YolARj-ckLJAyGNUWS-vgzUE-2rtlQI9RdF876k92sus7uWFXpjVTA5qF9FGf1xAMnio55fFB6Q0QS7B_Ltt3vuRv7gpIOZttYDe2pwkJ0wM406z3tHGevlKLf1f1jRtg6eQRXraArP)
     > 「名古屋で最も予約が取れないレストラン」の一つとして知られており、一見客お断りの完全紹介制で、電話番号も非公開です。
  5. [食べログアワード受賞歴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1zR9LvcIgLFKCOuAe3Qw0brXNV3d9QY_MKxhUwXmYg_nuOrAlBfvxrgYNXUHN5wtF_Ip8Hmb5tz-Wnl8lBh8UM8W0I0wI-Wxb27wJiThx8znbWAJvzXgfffswf5Q=)
     > The Tabelog Award 2023 Bronze
  6. [食べログアワード受賞歴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG5XRbx6nOFsZ9NbEUog0ViJiiOAUadE54ByJENLB903fTpzp7J8ITcb1yhnOLYNEvuQd5dsKpO3CHzq3f_hPrF1-IWsVrcSHgfNKEjUzNIwo-AW3RUjkfvJaxjReHfGo-s1_03H_imidNIyg==)
     > The Tabelog Award 2023 Bronze
  7. [食べログアワード受賞歴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFxE8kUbwMti-_hNW1jHL6jHXp8bz4KYMTPDRC3U2VCAQZ6yQu1UqvyqILUTFbmCs2qyg_oMTsw76LthJewij0WXs9v3RBMkOKTyXw2EhssNQL4fO-se9-VjDG9wVH4cigE6MJAKA==)
     > The Tabelog Award 2023 Bronze
  8. [食べログアワード受賞歴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE0gporxXDZsEEjlPnEWWpjPxn4ZrFjPZBxVFY8kpNaye1pearG_ju8cTYGIxF1vKuXzYafKZunzJ1nx_XbBC0N-bEMbONkTdQcbLe-Fp8o29-x4vgTQ9-WwmedH_UqydvwMYNINOuQLw==)
     > The Tabelog Award 2023 Bronze
  9. [前身店の食べログアワード受賞歴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEC9MZB2pzDV2Syokn1YzY4tj5Bde9bo7c3VoRPrm5sG4WHZ-jHEBSByl71ufF1bx2W-5QfDq2n_TpWB4R94efTxaVPBYpI-QaoVlgzfZNYLpLlJfS77Gf2899j0D3lV2rOXAjz-b6P8LNTRpbvU387dg==)
     > 前身である「トゥ・ラ・ジョア」は食べログ4.5超え、「食べログアワード2017〜2021 SILVER」を受賞した名店でした。
  10. [前身店の食べログアワード受賞歴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHfU_xEqivrnoifELvJOEYQ8YolARj-ckLJAyGNUWS-vgzUE-2rtlQI9RdF876k92sus7uWFXpjVTA5qF9FGf1xAMnio55fFB6Q0QS7B_Ltt3vuRv7gpIOZttYDe2pwkJ0wM406z3tHGevlKLf1f1jRtg6eQRXraArP)
     > 前身である「トゥ・ラ・ジョア」は食べログ4.5超え、「食べログアワード2017〜2021 SILVER」を受賞した名店でした。
  11. [一流の空間デザイン](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEC9MZB2pzDV2Syokn1YzY4tj5Bde9bo7c3VoRPrm5sG4WHZ-jHEBSByl71ufF1bx2W-5QfDq2n_TpWB4R94efTxaVPBYpI-QaoVlgzfZNYLpLlJfS77Gf2899j0D3lV2rOXAjz-b6P8LNTRpbvU387dg==)
     > ディズニーシーに携わった人物が空間デザインを手掛けたという情報もあります。
  12. [一流の空間デザイン](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHfU_xEqivrnoifELvJOEYQ8YolARj-ckLJAyGNUWS-vgzUE-2rtlQI9RdF876k92sus7uWFXpjVTA5qF9FGf1xAMnio55fFB6Q0QS7B_Ltt3vuRv7gpIOZttYDe2pwkJ0wM406z3tHGevlKLf1f1jRtg6eQRXraArP)
     > ディズニーシーに携わった人物が空間デザインを手掛けたという情報もあります。
  13. [シェフが「美食クリエイター」と評されている](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEC9MZB2pzDV2Syokn1YzY4tj5Bde9bo7c3VoRPrm5sG4WHZ-jHEBSByl71ufF1bx2W-5QfDq2n_TpWB4R94efTxaVPBYpI-QaoVlgzfZNYLpLlJfS77Gf2899j0D3lV2rOXAjz-b6P8LNTRpbvU387dg==)
     > シェフ須本氏は「美食の芸術家」 や自称「美食クリエイター」 と評されています。
  14. [シェフが「美食クリエイター」と評されている](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHfU_xEqivrnoifELvJOEYQ8YolARj-ckLJAyGNUWS-vgzUE-2rtlQI9RdF876k92sus7uWFXpjVTA5qF9FGf1xAMnio55fFB6Q0QS7B_Ltt3vuRv7gpIOZttYDe2pwkJ0wM406z3tHGevlKLf1f1jRtg6eQRXraArP)
     > シェフ須本氏は「美食の芸術家」 や自称「美食クリエイター」 と評されています。
- **warnings**: 3件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_トゥ・ラ・ジョアイズム -->

---

### 京味もと井（名古屋市千種区 / 日本料理・★4.6）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 1
- **editorReason**: 京都での研鑽と素材への徹底したこだわりが光る。ゴ・エ・ミヨ連続掲載の予約困難店で、自由闊達な京料理を古民家空間で堪能できる。
- **insiderNote**: ゴ・エ・ミヨ連続掲載が示す通り、店主の京都での研鑽と素材へのこだわり、日々進化を追求する矜持が業界で高く評価されている。
- **sources_used**:
  1. [店主が京都の名店で10年間修業したこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFLVKAbCbIE_ZwccSLht2B1HBCmFCqlWQX20RuxafyYDzbGe0U-vYL4qaD9GEDk33ZuxwTw0LiLz2EGnc_wUL5U7NS4s1BAuciMkRUscL_8YVaXIyb3Ua60wAhwyxLW5ASxDDCA74e1THZMqud2)
     > 店主の本井将樹氏は、京都の名店で10年間修業を積み
  2. [店主が京都の名店で10年間修業したこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHMySECqqxR0Nvzobvde-2KeGR3398GMkEZJL7kjnmi315GrfZAWnZsxSC9oAa2eMtmELjAxi5BwH-7u7ZgVU1CDF7mVBm1XlCdtXRYGI5gsUUoijpDZ2-_GdnY2R36)
     > 京都の名店で10年間修業を積んだ店主
  3. [素材への徹底したこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFLVKAbCbIE_ZwccSLht2B1HBCmFCqlWQX20RuxafyYDzbGe0U-vYL4qaD9GEDk33ZuxwTw0LiLz2EGnc_wUL5U7NS4s1BAuciMkRUscL_8YVaXIyb3Ua60wAhwyxLW5ASxDDCA74e1THZMqud2)
     > 食材には徹底的にこだわると述べています。魚介の多くは三重県紀伊長島の仲買人から直接仕入れ、朝水揚げされた内容を聞き、予約に合わせて注文したものが夕方には店に届くシステムを採用しています。野菜や米も独自のルートを持ち、南知多の農家の有機野菜や無農薬米を使用し、季節に応じて九条ネギや聖護院かぶらなどの京野菜も取り入れています。
  4. [素材への徹底したこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHiTy7STR61eqW34NX4vwCMV9GOd9R-M6hDAe1rHTc4Lt7p3bx8AJ_ZTvVeSp9nALJZg5ZRWMMzeICAr1q5eQB1xSnm_J22bZw3sTmMy3_JGsIJhJkvb0Bl)
     > 食材は、魚介は三重県紀伊長島の仲買人から直接仕入れ、野菜は南知多の農家の有機野菜や無農薬米を使用
  5. [ゴ・エ・ミヨに連続掲載されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFLVKAbCbIE_ZwccSLht2B1HBCmFCqlWQX20RuxafyYDzbGe0U-vYL4qaD9GEDk33ZuxwTw0LiLz2EGnc_wUL5U7NS4s1BAuciMkRUscL_8YVaXIyb3Ua60wAhwyxLW5ASxDDCA74e1THZMqud2)
     > フランス発のレストランガイド「ゴ・エ・ミヨ（Gault & Millau）」には2022年から2026年まで連続で掲載されており、2026年掲載時点での評価は15.5/20点（3トック：素晴らしいレストランに相当）です。
  6. [ゴ・エ・ミヨに連続掲載されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEGBHxlN8s5911Afu7LSIefna_jEedGjzx0ZpT8Q8C71lT1rfbaiAPyAnWCbaB9rIr3ag1x6dnRhwQHm_uh39CeYhEY4z_p_HDan1xSkb9oaRyUwacPSKF9i3yqwpgKjnIRrPr9FDpn5SKw8ead2N5G)
     > ゴ・エ・ミヨ2026掲載店
  7. [予約困難店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFLVKAbCbIE_ZwccSLht2B1HBCmFCqlWQX20RuxafyYDzbGe0U-vYL4qaD9GEDk33ZuxwTw0LiLz2EGnc_wUL5U7NS4s1BAuciMkRUscL_8YVaXIyb3Ua60wAhwyxLW5ASxDDCA74e1THZMqud2)
     > 「予約困難店」としても知られています。
  8. [予約困難店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9wwUwpXP3Exftl224c9P64Nzk5K2w0CBIbD0kGo_XwruT4pamceG4kWmxpFPNvdBpMeG9sZ27V7kh4iz00YJ81QOPyaCiZm6osT4OT6kYom1lAf5k0nKdWNbqtqzxzEnPrMIjQw==)
     > 予約困難店
  9. [料理が「自由闊達」と評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFLVKAbCbIE_ZwccSLht2B1HBCmFCqlWQX20RuxafyYDzbGe0U-vYL4qaD9GEDk33ZuxwTw0LiLz2EGnc_wUL5U7NS4s1BAuciMkRUscL_8YVaXIyb3Ua60wAhwyxLW5ASxDDCA74e1THZMqud2)
     > その料理は「自由闊達な料理」と表現され
  10. [料理が「自由闊達」と評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEGBHxlN8s5911Afu7LSIefna_jEedGjzx0ZpT8Q8C71lT1rfbaiAPyAnWCbaB9rIr3ag1x6dnRhwQHm_uh39CeYhEY4z_p_HDan1xSkb9oaRyUwacPSKF9i3yqwpgKjnIRrPr9FDpn5SKw8ead2N5G)
     > 自由闊達な料理
  11. [築85年の古民家を改装した空間であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGudWjZvXItfoeNO7y4GeQTraPxf7chsbBk827aiKGbCXomVo68YyV0qe9wnSp9KH9EJCx_aXkY68WQ8f2rPWdXFCRyd1rehQx-VHXAAw5BplaUQadpagfiNNomlR6eHjYaQjXecV0_uJ-v4Q==)
     > 築85年の古民家を改装した160坪の壮麗な日本家屋で営業しており
  12. [築85年の古民家を改装した空間であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHMySECqqxR0Nvzobvde-2KeGR3398GMkEZJL7kjnmi315GrfZAWnZsxSC9oAa2eMtmELjAxi5BwH-7u7ZgVU1CDF7mVBm1XlCdtXRYGI5gsUUoijpDZ2-_GdnY2R36)
     > 築85年の古民家を改装した壮麗な日本家屋

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_京味もと井 -->

---

### トゥ・ラ・ジョア イズム (Tou La Joie Ism)（名古屋市中区 / イノベーティブ・フレンチ・★4.6）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 「美食クリエイター」須本シェフが手掛ける、同じ客には二度と同じ料理を出さない独創的なイノベーティブフレンチ。The Tabelog Award 2023 Bronze受賞に裏打ちされた高い評価と、完全紹介制の「予約絶望店」という希少性が、業界内外で注目を集めています。
- **insiderNote**: 「美食クリエイター」須本シェフの独創性は、医療用遠心分離機を用いた調理法にも表れる。完全紹介制で電話番号非公開、同じ客には二度と同じ料理を出さない徹底した顧客管理は、まさに「予約絶望店」の所以。
- **sources_used**:
  1. [シェフが「美食クリエイター」と称されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHKq9_AlZM9RXcGM7JBD8G50AjwqZ3cGriNsnFKE8zW3NOIqWQm-JMmGls4yZWR_C5er27ElNnDrb-v2Ig0w7j5G0pCgPS1wkqsSotmbTrtMyGKkTqR9aREddlyUrOx6OdGmn2ePD9xjllZy-pQ8g=)
     > 彼は自らを「美食クリエイター」と称し、その料理は「美食の芸術家」が紡ぐ一期一会の創作料理と評されています。
  2. [シェフの料理が「唯一無二の須本ワールド」と評されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGhiviySgcfu8qrw6eqfjbU_1W1MTcm23HPEjZyfNxOR49KAoasgeLvPAE1gZqVAS2Q8JLZbKMbE9S9QnLtcrgHMZYgmwwtWE15XqrxPEKslaBCMGUKrYNdV-MK)
     > 唯一無二の須本ワールド
  3. [同じ客には二度と同じ料理を出さないというシェフのポリシー](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHKq9_AlZM9RXcGM7JBD8G50AjwqZ3cGriNsnFKE8zW3NOIqWQm-JMmGls4yZWR_C5er27ElNnDrb-v2Ig0w7j5G0pCgPS1wkqsSotmbTrtMyGKkTqR9aREddlyUrOx6OdGmn2ePD9xjllZy-pQ8g=)
     > 特に注目すべきは、同じ客には二度と同じ料理を出さないというシェフのポリシーで、完璧な顧客管理のもと、来店ごとに異なるメニューが提供されます。
  4. [The Tabelog Award 2023 Bronzeを受賞していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHKq9_AlZM9RXcGM7JBD8G50AjwqZ3cGriNsnFKE8zW3NOIqWQm-JMmGls4yZWR_C5er27ElNnDrb-v2Ig0w7j5G0pCgPS1wkqsSotmbTrtMyGKkTqR9aREddlyUrOx6OdGmn2ePD9xjllZy-pQ8g=)
     > 食べログでは、オープンから半年で4.15の評価を獲得し、「The Tabelog Award 2023 Bronze」を受賞しています。
  5. [完全紹介制で「予約絶望店」と評されるほどの予約の難しさがあること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHKq9_AlZM9RXcGM7JBD8G50AjwqZ3cGriNsnFKE8zW3NOIqWQm-JMmGls4yZWR_C5er27ElNnDrb-v2Ig0w7j5G0pCgPS1wkqsSotmbTrtMyGKkTqR9aREddlyUrOx6OdGmn2ePD9xjllZy-pQ8g=)
     > 「トゥ・ラ・ジョア イズム」も「一見さんお断りの完全紹介制レストラン」であり、電話番号も非公開とされています。過去に訪問したことがある人のみ予約が可能で、「予約絶望店」と評されるほどの予約の難しさがあります。
  6. [医療用遠心分離機を用いた独創的な調理法](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHKq9_AlZM9RXcGM7JBD8G50AjwqZ3cGriNsnFKE8zW3NOIqWQm-JMmGls4yZWR_C5er27ElNnDrb-v2Ig0w7j5G0pCgPS1wkqsSotmbTrtMyGKkTqR9aREddlyUrOx6OdGmn2ePD9xjllZy-pQ8g=)
     > 料理の中には、医療用の遠心分離機を使用して透明感を追求した鮑肝のコンソメなど、独創的な調理法も取り入れられています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_トゥ・ラ・ジョアイズム(toulajoieism) -->

---

### トゥ・ラ・ジョア（名古屋市中区栄 / イノベーティブ・フレンチ・★4.6）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: シェフ須本氏が「唯一無二のひと皿」を信条とし、来店客ごとに異なる料理を提供するイノベーティブ・フレンチ。その独創性と徹底したこだわりが「日本屈指の超予約困難店」として高い評価を得ています。
- **insiderNote**: シェフ須本氏の「唯一無二のひと皿」という哲学が、来店客ごとのカルテ作成やワインへの深いこだわりとして具現化。その結果、「日本屈指の超予約困難店」として業界内外から絶大な支持を得ています。
- **sources_used**:
  1. [シェフ須本氏の「唯一無二のひと皿」という信条、来店客ごとに異なる料理の提供、カルテ作成、ワインへのこだわり、イノベーティブ・フレンチであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQElJnTf5EtmMgUPSppDrVXoE8MCOWk5-y5ohNJfE925-rX7ohOU3tLq1rEWB4u4oGEHGddmIAub4Fygrbx8VUngS5s0BJF-tMr_2k0Dx-M3NZZdCSnGw0c7nyoFPluA7SmCr_ZJnj5a5JA=)
     > シェフ須本一信氏が「同じ料理は二度と出ない。唯一無二のひと皿」を信条とし、来店客ごとに異なる唯一無二の料理を提供するため、一人ひとりのカルテを作成している徹底ぶりです。 厳選された旬の食材を用い、その日だけのコース料理を提供しています。 料理は単なる美味しさだけでなく、味、見た目、香り、食感など五感すべてで楽しめる「満足を超えた感動の創造」を追求しており、料理を「アートであり、化学であり、そして料
  2. [「日本屈指の超予約困難店」であること、料理の独創性、唯一無二の世界観が高く評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHeW13m6-kXVN_vCBirzgpIpA5L7nHLj60Tj0KJiHIwIWfjq-xHP9YV4Z7VSolVu7Ze-dHtq1mJcM72YRTylLODpn_0qttO-nnAuieGkvCtvssB-QDFy_8inhJFGOn_wYk2aVFush23o-qcdOD_sM4cF_Y=)
     > 「トゥ・ラ・ジョア」は完全予約制のフュージョンレストランであり、その予約の困難さから「予約絶望店」「日本屈指の超予約困難店」として広く知られています。 初めての来店は、過去に訪問したことがある客との同伴か、常連客からの紹介が原則とされており、電話番号も非公開です。 毎年12月1日に翌1年分の予約が一斉に開始されますが、即座に埋まってしまう状況です。 提供されるのはコース料理のみで、ソムリエが料理と
  3. [グルメサイトでの高い評価と受賞歴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQZzS-CrRC2EsYnTsslLHYDu63DICtGO5MH1UX1W6mB0NtxosECIpjobTeE02ZVCKLDTd0zngVtB3aK2eZiJ1KSrFmBuxoX1F25mfAZWpVZ9ocueXW6PrPCPgxTMvPiJkCRRe0930=)
     > 「トゥ・ラ・ジョア」は、グルメサイトで高い評価を得ています。旧店舗は「食べログ」で4.5を超える評価を獲得し、「食べログアワード2017〜2021 SILVER」を受賞しています。 新店舗の「トゥ・ラ・ジョア イズム」もオープン半年で4.15の評価を得ており、「The Tabelog Award 2023 Bronze」を受賞しています。
  4. [Rettyでの高い評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFN1TnX7In_TI-s3T7Ih9iJaMAdOxHc0OF6zl76bzeulI4gVVaK4GMX0MQtk2gfIe_Shbr0c9qQALU8XQ0xOH_121nxYnNa3QTHG7EM6Z3tmmG3bQjKOdHTIZNJADpLgK4VexecV6UTY9RvWhmEP2VTPV0=)
     > 「Retty」でもオススメ度98%と高い評価を受けており、多くの口コミが寄せられています。
  5. [Rettyでの高い評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGLL44pATrC30ipHe_vmIuWaohLruJ35awO8OFQIHU2rQT3nSgzqkR8m3tTtPHaZEFXjEJCjYrjdzICAGU9CbwrdyX6VSN6HiMxzdPO6j7WPbA0hUpe0HQoE1V0pDnMvoIRYcZPR0LDQECih5lczGpPKuofVZqGmQ4gpMo=)
     > 「Retty」でもオススメ度98%と高い評価を受けており、多くの口コミが寄せられています。
- **warnings**: 3件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_トゥ・ラ・ジョア -->

---

### KimiTote (キミトテ)（名古屋市昭和区 / フレンチ・★4.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 新栄の名店「シェ・トト」出身シェフが、音響にもこだわり抜いた空間で提供するフレンチ。季節感あふれるシンプルな料理は、一皿ごとに技術と情熱が光り、大人向けの落ち着いた雰囲気で特別な時間を演出します。
- **insiderNote**: 新栄の名店「シェ・トト」で腕を振るったシェフが、音響プロデュースまで手掛けるこだわり。料理だけでなく、空間全体の質を追求する姿勢が伺えます。
- **sources_used**:
  1. [シェフが新栄の名店「シェ・トト」出身であること、音響にこだわりがあること、季節に寄り添ったシンプルなフランス料理を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFF-cOxtCyFAPb0-ICxfATCyPMld1pDk-ywAOuwsscdTrrYWP_nMpusCf5zpGZwUvb_R0zJL4TCpQNHfTElM66nL9sHeNOXIDz_EMmETeqoiPuAM2QvfICs81UlXOPwc-mOcbO9ETjkmZa0)
     > シェフは新栄の有名店「シェ・トト」で腕を振るっていた方で、音響にもこだわりがあるそうで、心地よいジャズが流れる空間で、季節に寄り添ったシンプルなフランス料理をゆっくりと楽しめます。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認） / sources_used が 2 件未満（人手レビュー必須）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_kimitote(キミトテ) -->

---

### 食堂 灯ル（名古屋市中村区 / 和食、定食、土鍋ごはん・★4.3）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 「第二の食卓」をコンセプトに、炊きたての土鍋ごはんを中心とした和定食を提供。朝昼夜で異なる利用シーンに対応し、旬の素材を活かした質の高い料理が魅力。地元メディアでも注目され、日常に寄り添う食堂として期待されます。
- **insiderNote**: 「第二の食卓」を掲げ、朝昼夜で異なる利用シーンに対応する提供スタイルが特徴。土鍋ごはんや旬の素材にこだわり、オープン時から複数の地元メディアで紹介されており、注目度の高さが伺えます。
- **sources_used**:
  1. [「第二の食卓」コンセプト、土鍋ごはん中心の和定食、朝昼夜の提供スタイル、旬の素材へのこだわり、地元メディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFLbJNW2YuJ-V2kTSp3Z3_dYA-3IUjvZP6TaLBti4f6NQERl4MRUykaNRjGLf5cwTV_OE_n9K7cnGkdzhiqDwLTsecO29liu7szWJnzKALAMh2bmTk5KCkKfhMT)
     > 「食堂 灯ル」は、「第二の食卓」をコンセプトに掲げ、街の人々の日常に寄り添い、温かな灯りをともす食堂を目指しています。炊き立ての土鍋ごはんを中心とした和定食を提供し、日常を照らすやさしい一膳、ほっと落ち着くひとときを提供することにこだわっています。旬の食材を使った派手さはないものの、素朴な料理の数々が日常を明るく照らすとされています。名物の銀鮭定食や味噌カツ煮、伊勢真鯛を使った一品など、素材にこだ
  2. [「第二の食卓」コンセプト、土鍋ごはん中心の和定食、朝昼夜の提供スタイル、旬の素材へのこだわり、地元メディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGsGlP2dNlESx9o0J2kKGAzryizOKLJ6T-ulWfDd3AoiPKZHPabY5stxJ-WOUsNHeTYuf2ln9VY7xKcQpt6Vh4BURgQjPFFrpNh0mZgpZ2ZMS5TIvI6MuJ6EAGUvTukLmnJ3HF6XeJ5rrL713wDQspI2sNWdw==)
     > 「食堂 灯ル」は、「第二の食卓」をコンセプトに掲げ、街の人々の日常に寄り添い、温かな灯りをともす食堂を目指しています。炊き立ての土鍋ごはんを中心とした和定食を提供し、日常を照らすやさしい一膳、ほっと落ち着くひとときを提供することにこだわっています。旬の食材を使った派手さはないものの、素朴な料理の数々が日常を明るく照らすとされています。名物の銀鮭定食や味噌カツ煮、伊勢真鯛を使った一品など、素材にこだ
  3. [地元メディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFudMPuUfhRAeFRTDFHIf3azuYEDaUh08SnY91Yc8TzvxUGddGc7xogkDCPx5BVpBaUihCcnqBdDVYIUQidzyh40uD9gv4SvHgwtUiQyegE7ukxA4pyIOcwsNrbSfiJ_fk=)
     > 「名古屋情報通」では「ご褒美定食を朝から味わえる店」として、開店直前の内覧会の様子とともに詳細が報じられています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_食堂灯ル -->

---

### 大衆酒場 やまと 名古屋駅前店（名駅 / 大衆酒場・居酒屋・★4.4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: リーズナブルな価格設定と驚異的なコストパフォーマンスで、幅広い客層に支持される大衆酒場。名物の味噌串カツ、餃子、唐揚げは、素材と製法にこだわり、料理人も認める品質。活気ある雰囲気と明朗会計で、誰もが気軽に楽しめる一軒だ。
- **insiderNote**: お通し代・席料なし、ハッピーアワー80円など、顧客サービスを徹底。残業が少ないほど給料がアップする「働き方奨励金制度」を導入し、従業員の働き方にも配慮している点は注目に値する。
- **sources_used**:
  1. [リーズナブルな価格設定、活気ある雰囲気、三大名物のコストパフォーマンス、顧客サービス（お通し代・席料なし、ハッピーアワー、チンチロリン）、従業員の働き方への配慮（働き方奨励金制度）](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFlGbZn6X3yKkkKw4F3D3c3n3D3ubp5vGvniufmpUirvJzAUYxIdCD9mbydhp7CJlIidUc8_K5F7zaeFAMOIvIc-6feuEIIBpowSmv3ni1Vt5dl-UNXu_NkaKNduDieo_Sz-w==)
     > お財布に優しい価格設定も魅力としています。活気あふれる雰囲気とリーズナブルな価格帯が特徴で、特に「味噌串カツ」「餃子」「唐揚げ」の三大名物は驚異的なコストパフォーマンスを誇り
  2. [名物料理（唐揚げ、餃子）の素材と製法へのこだわり、明朗会計と丁寧な接客、アットホームな雰囲気](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG0UO-k62Ty5hQ1bE821hRLeKoZvJpjrXDzJlZ8ZYoUIU8OpXGLeqdNQAioQXmaWQ6iVFOf_0UhmbUgze_XwFA5-LgeOGsDiMjp8W7g7rXXqnivDko3Bmq9ZmTl35PyLN34xKwauA==)
     > 名物の唐揚げは鶏のムネ肉を使用することで、脂が少なくヘルシーに味わえるよう工夫されており、外はふわっと、中はジューシーながらも軽やかな食感が特徴です。餃子は毎日当日の分だけ仕込み、キャベツを中心とした野菜たっぷりの餡で、毎日食べても飽きがこないように作られています。メニューは全体的にボリューミーで満足感があり、串カツは一本単位でオーダーできるため、様々な種類を楽しめます。明朗会計と丁寧な接客により
  3. [コストパフォーマンスの高さ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGyNEjgKmeDwGIxLRiok9dsbbSH2oprMy0O_UdEazaQGDLKypnFYiZUkFZiTR9fhtL3FGi0pSu1KpIEGOY30dY4LN27vnQQQOMUpSemQGjopQ3h6z4HxgbYWAPdw6z_rO34cU0VuaV1E_-87epMgkO0Iw==)
     > 「ナゴレコ」では、「名駅の「大衆酒場やまと」はコスパ最強の居酒屋」として紹介されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_大衆酒場やまと名古屋駅前店 -->

---

### 鉄板焼 那古亭（名駅 / 鉄板焼ステーキ・★4.3）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 名古屋マリオットアソシアホテル高層階に位置し、A5ランク和牛など厳選高級食材を熟練料理人が目の前で調理。圧倒的なライブ感と高評価の料理、名古屋の眺望が魅力で、主要グルメサイトでも多数の口コミを集める。
- **insiderNote**: 熟練料理人が目の前で繰り広げる圧倒的なライブパフォーマンスは、単なる食事ではなく、五感で楽しむ体験を創出。食材の焼き加減や出汁、塩への丁寧なこだわりも光る。
- **sources_used**:
  1. [一休.comレストランで「料理・味」が高評価を得ている。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG8PWhX7xsf-9CFb_n_IGGnpVAkrRzT9GlAZHiDPKogK-HYiSMnyEDyf9jEVXsP3B-r7mz9kd9DRxr__l4myKBC84u8YirpjK5Nc7VN-dQ8s82Qj8SXsnNXpShJL-CEk30MZ74j7A==)
     > 一休.comレストランでは「料理・味」が4.22と高得点を得ています。
  2. [PayPayグルメで高評価を得ている。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHsp3LSVf0f_Di6v5rtFNhqe4ZevNQI1h7K-vAUShHIYvDOhWCqvZoE5NiQDT1wHRcgjNTkv1r25bXeOkGwqQHw9_Yy1z3y0EVq54F-Dq022pqnrTy_iTtMO1x8FfnzW_1zIgvUYgcJ3BNngQ==)
     > PayPayグルメでは4.37と高得点を得ています。
  3. [Rettyの口コミで、焼き加減や出汁、塩へのこだわり、シェフの手仕事が評価されている。主要グルメサイトで多数の口コミを集めている。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGJPDDECtPXf-lexlfVt5dhWdmVBPfwkjCVKiMkK7AX_UXBG0DEnoVPGLVQNKARnPLrxQ76bKkfmjeeOTQb98moBd3iWeEygl_2umtUoAv4TS0jF27BOhBhQ9DGuLtzdiU4Vhfu1SkEm8PNVEkL_Qhqsg=)
     > Rettyの口コミでは、「焼き加減、出汁や塩などのこだわり」や「シェフの手仕事が引き立つ料理」が評価されており、A5ランクのフィレステーキが「絶品で今まで食べた事のない美味しさ」と称賛されています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_鉄板焼那古亭 -->

---

### restaurant.m（栄 / クラシック × モダンフレンチ・★4.7）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: ミシュラン星獲得シェフが手掛けるクラシック×モダンフレンチ。確かな技術と情熱で東海食材を昇華させ、早くも地元メディアで高く評価される注目の一軒。
- **insiderNote**: オーナーシェフ小林氏はミシュラン星やゴ・エ・ミヨ3トックの実績を持ち、クラシックな技法を現代に昇華させる手腕は業界でも高く評価されています。
- **sources_used**:
  1. [シェフのクラシックとモダンフレンチを融合させたコンセプト、東海地方の旬の食材へのこだわり、クラシック技法の現代への昇華、シェフの料理への情熱、ミシュラン星・ゴ・エ・ミヨ獲得実績、業界からの高い評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFtQyX3UBISNokpX15h_T4HjamgbzpCUfgz3NbuL_evRcX28vArhRmsM-GviNVZauK8arrX7DxYNmChAFksBvCOFZrrbv0fkjLVEmAsNiTcbelR)
     > オーナーシェフの小林誠氏は、自身が修行してきたクラシックフレンチとモダンフレンチを軸に、「クラシック・モダン」をコンセプトとして料理を提供しています。多様化する現代における「美味しい」を常に追求し、東海地方の旬の食材を中心に、最も美味しく仕上がる調理法で仕上げることにこだわっています。また、クラシックなソースに不可欠な「フォンドボー」「コンソメ」「ヴォライユ」などの手間のかかる出汁やソースを丁寧に
  2. [クラシックとモダンフレンチを融合させたコンセプト、東海地方の旬の食材の使用、シェフの確かな技術、シェフの料理への情熱、クラシック技法の現代への昇華](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGY_XkPwNbNJ1smFINJ2jzD7d_SWG6zgTdqLlFyeL8waz-FXVHnxGFB5aTDnTUx3OwGokIvTVKk7pfiaykPDWP0S6cxlh1RbnHjYX_g1iC1fgpwVDXfwLlDjSaKhQ==)
     > 「restaurant.m」では、クラシックフレンチの技法を大切にしつつ、現代の感性を取り入れたモダンフレンチを融合させた料理を提供しています。東海地区でシェフ自らが厳選した旬の食材を中心に調理され、素材の持ち味を最大限に引き出すための調理法や盛り付けにもこだわりが見られます。スタッフは素朴でゲストを妙に緊張させない対応をしつつ、技術の高い料理を提供することで、幅広い客層に支持されています。
  3. [シェフの確かな技術](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFnhRixDyKf_oH8Swz86Sz28FXR5mR56U2HaY-KRbQi-CeKMPCfJi-zyo7yEQHS6-bqDyv_ZldemOhuc8_suyHsvAAb-Zq5QR_5xgqSvEUEUm-c_Oc8VqLp5VtKS644UdLlE72R2NWXu4A=)
     > スタッフは素朴でゲストを妙に緊張させない対応をしつつ、技術の高い料理を提供することで、幅広い客層に支持されています。
  4. [地元メディアでの高い評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGrbkEPgttNhDV8mBO68KjDT1cwZaFN28VeA0Zq655yuAGKIRiCDX3IuYMU7m8Vae64pi9pwVLX3svf57BVmfOe9PIuXgfV30d1gSuxBlM6MHydHX1n-67isG4FdwJOCJB1mQZBwDMUd_A=)
     > 2025年8月10日時点の口コミでは食べログの百名店にも選出され、3.94という非常に高い評価を得ています。
  5. [シェフのミシュラン星・ゴ・エ・ミヨ獲得実績、業界からの高い評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFVMcW3dy-LLU6ya32RdARX2nnuaBe2Q9GvF2lsI_TXwCUK9tgRKqLxNJh8q1XUvPFUWZLHycLGt5otOkwz4smkBPf5iQHggDhbeEJTGdvLl801CnqMj_QUrkQIQs7Fno0dDY_hhv1OmVY2534=)
     > オーナーシェフの小林誠氏は1978年名古屋市生まれで、1998年に調理師学校を卒業後、「レストラン シェ・コーベ」に入社しました。2008年には同店の料理長に就任し、2019年にはJAL新ジャパンプロジェクトで国内線ファーストクラス機内食を監修するとともに、ミシュラン東海版で1つ星を獲得しています。さらに2020年にはゴ・エ・ミヨで15点3トックを獲得する実績を持ちます。2023年に「シェ・コーベ
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_restaurant.m -->

---

### 日本料理 𡈽方（名古屋市中区 / 日本料理、懐石・会席料理・★4.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: ミシュラン三つ星を獲得し、名古屋の日本料理界を牽引する名店。完全予約制のカウンター8席で、素材の味を最大限に引き出す割烹スタイルが国内外の食通を魅了しています。
- **insiderNote**: ミシュラン三つ星を「唯一、本物の中の本物」と評され、メディア露出を避ける予約困難店。素材を尊重し、未来を見据えるサステナブルな料理哲学も注目されます。
- **sources_used**:
  1. [ミシュラン三つ星を獲得していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7qnaFCqf4CtP5E5mNP3i0yvCnM0zA6jgOZw7zVGGarugi5DDDbYcDe5r0UmC10R67SFVizDAl_6bywKi-5mZTYoyyBTpGkS73kBx1OzsWob74dxz_935oXNyxnkSsY3KeHbqxCb7CEabFbwsuYHK1eLE=)
     > 「日本料理 𡈽方」はミシュラン三つ星を獲得しています。
  2. [ミシュラン三つ星を獲得していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHv9vmyHctUXTFloMFit31vd-SdnoTc6atwFAIeBsqPLxLPIpnKY9rD3g7AVHkCuLwLzCa-usY3hb9hrFHJwkEAbl_UMRrML-E6V-fqF5hwDC9tkcZ8rc844RIgDlXh1ofPkw==)
     > 「日本料理 𡈽方」はミシュラン三つ星を獲得しています。
  3. [完全予約制、カウンター8席の割烹スタイルであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGiLsyyu881O1NaiKJFJsjYq2c1-a5LU5lD6sAQbjeZbX_HxbrBzWaBdXjthrR8xZZAMb9KEj0iw54Pb8KUPT-oTyMmWQJySjT-z2GjhpZz7GhxYjx-HkT4943ZQR5MmLdhflMtnn-jDg==)
     > 「日本料理 𡈽方」は完全予約制で、席はカウンターのみ8席です。 料理人が目の前で調理し、出来立てを提供する割烹スタイルであると考えられます。
  4. [完全予約制、カウンター8席の割烹スタイルであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF5Ck9ufxHWnEqSQcZzyWj62gM9P0_scEfeQF5e6xP94TGTNNA6P3uzxZxdLd3QI8aGhjNCtl5I58yrMI0i1BpywnHimXTXYXw_9erl5ZD2bL1QKvLLBxbTZpljc4Q=)
     > 「日本料理 𡈽方」は完全予約制で、席はカウンターのみ8席です。 料理人が目の前で調理し、出来立てを提供する割烹スタイルであると考えられます。
  5. [ミシュラン三つ星の評価、予約困難であること、メディア露出を避けていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7qnaFCqf4CtP5E5mNP3i0yvCnM0zA6jgOZw7zVGGarugi5DDDbYcDe5r0UmC10R67SFVizDAl_6bywKi-5mZTYoyyBTpGkS73kBx1OzsWob74dxz_935oXNyxnkSsY3KeHbqxCb7CEabFbwsuYHK1eLE=)
     > 「Retty」の口コミでは、東海ミシュランにおいて数少ない「正当な評価」「唯一、本物の中の本物の三つ星獲得」と評されています。 また、「予約が取れないことでも有名で、メディア露出を避けている」とされ、「日本料理の頂点に位置する」と評されています。
  6. [素材を尊重し、未来を見据えるサステナブルな視座を持つ料理哲学であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGtFKUHyiURXALUrQ2WBBGh_7Bt8WaZ-gcZY0zYGMv2ZxJdbuljSn4aFYXhYeNXS987LVy_Cfx0bfqcDZxZ5troWtC6VvG6JceqjeIMOELuk9Dz8_d7UV-SYzaDzEHXCSXTFDY=)
     > この哲学には、素材を尊重し、文化をつなぎ、未来を見据えるサステナブルな視座が息づいていると評されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_日本料理𡈽方 -->

---

### ひつまぶし 登河 那古野本店（丸の内 / うなぎ・ひつまぶし・★4.3）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 伝統的な「地焼き」の職人技と厳選食材へのこだわりが、多くのメディアや利用客から高く評価されています。特に「ヒトサラ」と「ねとらぼ」のランキングで愛知県1位を獲得しており、その実力は折り紙付きです。
- **insiderNote**: 築90年の古民家を改装した趣ある空間で、日本庭園を眺めながら食事ができる点は、観光客のおもてなしにも最適。入手困難な日本酒のラインナップも魅力です。
- **sources_used**:
  1. [職人の技と地焼き、厳選食材へのこだわりが高く評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQELLpzvATWNWu29ONugcf_I0QEmX5u2Ui9UqPgfZrN3IDDJgyiuH3zzXJtQADSIppp-LgB-u6wD6T_xCuAXVqcmVwzy81FOzFGleCyu4d4M-lbTrK_OXfjOS8fnzNE=)
     > 同店の料理は、その「職人の技」が高く評価されています。特に、備長炭による「地焼き」で、鰻の皮をパリッと香ばしく、身をふっくらと仕上げる技術は、多くのレビューで絶賛されています。厳選された上質な鰻の選定や、奥三河どりを一羽一羽丁寧に手作業で捌くといった、食材へのこだわりと調理の丁寧さも評価の対象となっています。
  2. [ヒトサラとねとらぼのランキングで愛知県1位であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG2o8Sk7EFDOo6bDjfPl1yeNYbDt_Zg9vAZ3n7-zO0mTmF8Ei774tk6YV6B6_zP02YoiTFSxGqYc7yFI57dxtMfehZwWo8PHf5EUsl0LLtX8mAuRjhZovnyupzG)
     > 料理人の顔が見えるグルメメディア「ヒトサラ」と「ねとらぼ」が発表した「愛知県のうなぎの名店」人気ランキング（2023年11月版）では1位を獲得しています。
  3. [ヒトサラとねとらぼのランキングで愛知県1位であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE1d14robjIInx0E9VDS3D3UUOtIy5cDlPfvuqy1WhTh-RmbHUxj57fCC00zfMX-PGSfsoo2d2cVOWfKgXdrNU5_uenVyLTxfUUeASi8CStXhyA3WOToE_CBLUEppv4aCfjKj4EUbhb4bT_J779UIOS)
     > 料理人の顔が見えるグルメメディア「ヒトサラ」と「ねとらぼ」が発表した「愛知県のうなぎの名店」人気ランキング（2023年11月版）では1位を獲得しています。
  4. [各種グルメサイトでの高評価や利用客からの絶賛](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQELLpzvATWNWu29ONugcf_I0QEmX5u2Ui9UqPgfZrN3IDDJgyiuH3zzXJtQADSIppp-LgB-u6wD6T_xCuAXVqcmVwzy81FOzFGleCyu4d4M-lbTrK_OXfjOS8fnzNE=)
     > 各種グルメサイトでの評価も高く、「一休.comレストラン」では総合評価4.05（5点満点中、10件の口コミに基づく）、サービス評価4.00を獲得しています。また、「macaroni」では4.3点（5点満点中、267件の口コミに基づく）、「ヒトサラ」と「ねとらぼ」のランキングでは愛知県のうなぎの名店で1位に選ばれています。利用客からは、鰻の「絶妙にパリッとして、身はふんわり脂がのってめっちゃ美味しい
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_ひつまぶし登河那古野本店 -->

---

### 那古野 みつ林（名古屋市西区那古野 / 懐石・会席料理、日本料理・★4.5）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 京都で研鑽を積んだ職人気質の店主が、那古野の地でカウンター越しに五感で楽しむ日本料理を提供。一皿一皿に込めた手仕事と、お客様一人ひとりに寄り添う細やかなおもてなしが、高い評価を得ています。
- **insiderNote**: 京都の老舗旅館で研鑽を積んだ店主は、那古野を和食の街にしたいという思いで店を構えた。カウンターで「一魂一味」を貫き、出汁や水にも徹底的にこだわる職人気質が光る。
- **sources_used**:
  1. [店主の那古野という立地への思い、カウンターへのこだわり、一魂一味の姿勢、手仕事へのこだわり、お客様への細やかな気配り、出汁や水へのこだわり、そして店主の職人気質な姿勢](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFj_sK0EsNtVTNQG-_LmXU8_bt8u3qXsQb_Z99ZfWN2BzWgdhiL1730qQMGuCJbAuYa1HtQO4MByWpJCzrqjedXAy7ILNrGZeCzxWIWcJeBBIxAYhXaQqo9A9G6Zw==)
     > 店主の三ッ林学氏は、賑やかすぎず静かで隠れ家的な場所を求めて那古野に店を構えました。名古屋駅から近く都心でありながら古い町並みが残る那古野の珍しさと将来性に魅力を感じたといいます。店名の頭に「那古野」を冠したのは、京都の祇園のように那古野も和食の店が集まり、街全体で盛り上がることで「あの街に行けば何かおいしいものに出会える、楽しい時間が過ごせる」場所になってほしいという思いがあるためです。また、三
  2. [店主の京都での修業経験と職人気質な評価、カウンター中心の提供スタイル、五感で楽しむ季節感、お客様への心からのおもてなし、料理への繊細な仕事](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEnY1ISYPSbv_Ynb0y_pAboNnuyUf5XzriBj7Aah7kVOcn_U746wOzUINqRKo85chbbY1VVa7-3rCu2FUdixxt6yQhPDZ__wYPCYibA22KFXVcurxi6t78G8z_iuXH2GLXqTnecmqrSQ9T_)
     > 「那古野 みつ林」はカウンター席が中心のスタイルで、料理人がお客様の食べるタイミングや反応を見ながら、温かいものは温かいうちに、最も美味しい状態で提供することを重視しています。 料理は食べるペースに合わせて手際よく仕上げられ、絶妙な間合いで供されます。 季節感を五感で楽しめるような工夫が凝らされており、例えば節分の時期には稲荷の狐を蕪で表現し、狐が好むとされるからしで菜の花を和え、鬼が嫌う柊の緑を
  3. [複数のグルメサイトでの高い総合評価、料理の美味しさ、繊細な仕事、季節感、店主の細やかな気配りや丁寧な接客](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGD1DUNwekx8dLUUqDLPaGcPU-bAzPSUMbqcrk98b_1fcGjvBQFYa8mBG7nfjrqsjpr7kO3_UsvRbfDkrchWN0XffmpPLsx51LT55H7Vz_gVRXaOvGH4iGy8RZ7OA==)
     > 一休.comレストランやPayPayグルメのクチコミでは、総合評価が4.38/5.0と高く、料理の美味しさ、繊細な仕事、季節感、そして店主の細やかな気配りや丁寧な接客（見送りなど）が特に評価されています。
  4. [複数のグルメサイトでの高い総合評価、料理の美味しさ、繊細な仕事、季節感、店主の細やかな気配りや丁寧な接客](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHoSdTB94BCPukx8SIRrMcFWl533UrmU-0YdBPrSy37YL7DJSMW4PW_XY5iFjbRTxyu3SlgaLLXT8T1PINq---JoekdTnL_cPXogj8UgqiV_FurZtljGuQstZAoMAvB3dOQhQ==)
     > 一休.comレストランやPayPayグルメのクチコミでは、総合評価が4.38/5.0と高く、料理の美味しさ、繊細な仕事、季節感、そして店主の細やかな気配りや丁寧な接客（見送りなど）が特に評価されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_那古野みつ林 -->

---

### 花いち（名古屋市西区 / 割烹料理・★4.7）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 店主の「七里の地物」と「作りたて」への揺るぎないこだわりが、素材の持ち味を最大限に引き出すシンプルかつ繊細な和食を生み出しています。全国の食通を魅了する超予約困難な名店です。
- **insiderNote**: 料理人歴50年の大ベテランが貫く「七里の地物」「作りたて」の美学。その卓越した技と哲学が、多くの食通を魅了し、超予約困難な人気を誇ります。
- **sources_used**:
  1. [超予約困難店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEWw1lWRlVXnZzecuL9IdJObNr7TWb3LtSI01ff7ySo6THBtyGJDZvTk1RwiAxAkIe4DEKQNbtYag4WtnVW-WoImuxLrE7TwTfTrPjsAMjp4TcshDIOeJckGnui2y_myh7E3MzUKvT4YfARQ-t8wv0jDKxiDRfW)
     > 2年先まで予約が埋まるほどの超予約困難店です。
  2. [全国から客が訪れる名店であり、その人気から予約困難であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE5X8atYwWbRFVWILhq_P-NJsP9Hy6EcQZsxVOoseS4zyxjPDIcI98-hc5yb96o09ytT2DCWm2xAdsFQg5ScyCDJI89O9XTEztngk3339i2xw33qt1zR4Xqag==)
     > 全国から客が訪れる名店として広く認知されています。
  3. [著名な食通が店主のこだわりや料理を評価していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQExLRcS9FJdUswnTky5m5h8fE-Fu2q00rDSnziChH-cztmDOXdpFjQRs9BMjUqj29CeAVIPOacvQ9bNVIvv8YPz5WjAB0VXB4Z0Sshnz0JPrl_DK58OCtIDc5a76iBCueXuvyG_pp6x3EhLQJeTmyQy1tY2ReAF_NEQU1l8Jmq4hW0QghjpGlXC0a09jb26ZxXyTcx54HL-DTkulpyKdziL0U0=)
     > マッキー牧元公式サイト
  4. [著名なグルメサイトが店主のこだわりや料理を評価していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpkjL8tRQ9st5ZfKGKphhkXzKP3X29HIGp04JarwFygS9bgrJB227GE7fUEFtPK6CVSQtnRAQ7rhrlXPwLph7dMg0LG5b9mul6DNv4bCV0HHKBEALfN2U9PLqAZL3xoXlkiQ==)
     > すしログ

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_花いち -->

---

### 鮨てんび（名古屋市千種区 / 寿司・★4.4）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 「すし昇」と「麺屋はなび」のトップがプロデュース。高級寿司のクオリティを保ちつつ、6,600円という驚きの価格で提供し、若年層の取り込みに成功。素材と技術へのこだわりも強く、名古屋の寿司業界に新風を吹き込む注目店だ。
- **insiderNote**: ミシュラン獲得の「すし昇」と人気ラーメン店「麺屋はなび」の異業種コラボ。高級寿司の質を保ちつつ、若年層も手が届く価格設定で市場を広げる戦略は注目に値する。
- **sources_used**:
  1. [「すし昇」と「麺屋はなび」の代表者によるプロデュースであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHeX2woyvL_90ikMT1GBl9e9bOcn-2BsmOkNsXOdAJeHa2CQODwcY_bM_HjVrzhdl7wbHDIao1EjPoynRjVKPIO9WfKb5mdtc1evrkQO6pJb47RywPIZPh2PL4kSSo=)
     > 「名古屋情報通」では、東区・車道にオープンした店舗が「麺屋はなび」の新山直人氏と「すし昇」の伊藤昇平氏の共同プロデュースによる注目店として紹介されました。
  2. [「すし昇」と「麺屋はなび」の代表者によるプロデュースであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGmQmUFTeUq2fHAtOv7LCmoA8pS45q7po3p0bhsCu9-F-ohAzP_CyFT-BJsc-Nep8fyYdfMuJkDMjPfKFC-a6AfOAclM8MjxLpWxDrtGgrdLmm8PW2REw==)
     > 「鮨てんび」は、ミシュランプレートを獲得した「すし昇」の大将である伊藤昇氏と、「麺屋はなび」を手がけた新山直人氏のコラボレーションによって生まれました。
  3. [高級寿司の品質と6,600円という価格設定によるコストパフォーマンスの高さ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHNs7QqS7oY7TZznACvl8Ifclctngmd5kap14QhFwz04j2tThIdUXCt9QS8bm9ofLmRdIyPXbBurVa9p4EqzhFqkp0IwzhjJNM3u7Knhz9Y9yDabLoH-XVkkk8P)
     > 「おいでよ名古屋の食べ歩きログ」では、カジュアルに高級寿司が楽しめる店として取り上げられています。
  4. [高級寿司の品質と6,600円という価格設定によるコストパフォーマンスの高さ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFJL-z2vsm68I-8Gn1j-E1M_SSPmj3NSTs6cCO8xi_uWtvtj38VOLB4Sxm70qnvjcddFPOmCWVqkD-Gy-ydReASWmbwdVfu8VuiAOYz3EbdB3GbfoV2yGqjmWNqUK_911eEuH_MmRhhpCJmVVuMFoLFOET3oZsiIo_Yupc=)
     > 特に今池店のおまかせコースは6,600円（税込）という価格で、豊富なネタと多彩な料理が楽しめると好評です。
  5. [高級寿司の品質と6,600円という価格設定によるコストパフォーマンスの高さと若年層への訴求](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1FuodxJn4t5P7_IHeOaCWl-ghKunDTyMSuvZQWMv5NnbW2f7YxptadYDcm_Xu4NyOqBb6zzs_QTVa-oN57GbDzZ0XO-eibMaosJEZg-7mVI6uyumNzrWVs1cr5Nygp7tJ9ZNWNq3DULxPso_6rWphJaXVgFUwrUVTKYKdA7MzR5KFhgNJs8eoIruG8nkobG-WgAOrjX4ImZDfkrLrquBEUY1s3D0i2sVMjw==)
     > 高級寿司のクオリティを保ちつつ、シンプルな価格設定で若年層の取り込みに成功していると評価されています。
  6. [季節の最高素材、自家製醤油、赤白シャリの使い分けなど、素材と技術へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF6235ivWm2eVme-RKVhoY7xznBi6GuAgHtJrgcF_pJL0aWHPgmGO0qJB9fWCACCPtHxnvoLrQYECrZmj-rcqMNEH35EJHWTHhOehsmZCEjig1hpMafHLV0F0quQOo=)
     > 「鮨てんび」では、魚介の新鮮さと質の追求にこだわり、季節ごとの最高の素材を取り入れています。寿司の握りにおいては、職人の技術と丁寧な仕事にこだわり、素材の持ち味を最大限に引き出し、見た目の美しさ、食感、味わいのバランスを重視しています。醤油は店内で自家製し、シャリには赤と白で異なる種類の米を使用することで、それぞれのネタに適した旨みと食感を実現しています。
  7. [季節の最高素材、自家製醤油、赤白シャリの使い分けなど、素材と技術へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEKpj4d24eeO2-bfYg2UXDaB50k8frfrqCU6ZtbgeonLnMYI_JQrKs4nqc2AmZC7IIPmiTbpAr2Ns8Lv07Tuz6WMiBADIAT1w6Y97TC8Hq43RCNyvVbtMmoSvKHIy1L75T2Tsplb3skloOQnx8g8vQFvehCzcCjgw8_Ty6xYEtV)
     > 「鮨てんび」では、魚介の新鮮さと質の追求にこだわり、季節ごとの最高の素材を取り入れています。寿司の握りにおいては、職人の技術と丁寧な仕事にこだわり、素材の持ち味を最大限に引き出し、見た目の美しさ、食感、味わいのバランスを重視しています。醤油は店内で自家製し、シャリには赤と白で異なる種類の米を使用することで、それぞれのネタに適した旨みと食感を実現しています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_鮨てんび -->

---

### 喫茶ゾウメシ（西区 / レトロ喫茶・クリームソーダ・★4.2）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 老舗味噌蔵が運営し、味噌の魅力を若い世代に伝えるコンセプトが秀逸。レトロとモダンが融合した空間で、SNS映えするクリームソーダや家族連れへの配慮も抜かりない。
- **insiderNote**: 老舗味噌蔵のオーナーが「若い世代に味噌の美味しさを」と立ち上げ。一つひとつ丁寧なこだわりと、子連れ客への座敷席やタッチパネル予約など、顧客体験への配慮が光る。
- **sources_used**:
  1. [老舗味噌蔵「今井醸造」が運営し、「若い世代に味噌の美味しさを知ってほしい」というコンセプト、一つひとつのこだわり、レトロとモダンが融合した空間、SNSで人気のクリームソーダ、家族連れへの配慮、タッチパネル予約システム導入](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHWRwalgX19sSpfypsikJ1g7UAw4bFo_FAnq__eLuIxJ6R1cHgbXA7_QVG3YvwiKmLsoX7vlWtK3NVJT_iCq9imJoVUO6t2o3fkw3apyZc1GkrcWiqYN_E9hQE2XnGg9MB8Xy_O6Uw5uDI=)
     > 「喫茶ゾウメシ」は、愛知県西尾市にある老舗味噌蔵「今井醸造」が運営する喫茶店です。オーナーである今井醸造三代目の今井氏は、「若い世代にもっと気軽に本物の味噌の美味しさを知ってほしい」という切実な思いから、このカフェを立ち上げました。彼らは「一つひとつを丁寧に、しっかりとこだわって」という気持ちを大切にしています。また、子連れの客層を意識し、「名古屋駅近くだからこそ座敷を増やしたい」というオーナーの
  2. [老舗味噌蔵「今井醸造」が運営し、「若い世代に味噌の美味しさを知ってほしい」というコンセプト、レトロとモダンが融合した空間、SNSで人気のクリームソーダ、家族連れへの配慮](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEo8cE-tB5mETkmeJENTHfbD4NqkjjN_lmXRz8yDVKurM2IlpD6KzZAXCbnTsTbWem1JLZLxk1lE_IBn88vb4_I8BfE3Ql1mIdH4dUQwjFwwokGxCDya3kgae4e)
     > 愛知県西尾市の老舗味噌蔵「今井醸造」が手がける喫茶店「喫茶ゾウメシ」。「若い世代にもっと気軽に本物の味噌の美味しさを知ってほしい」という思いからオープンした「喫茶ゾウメシ」は、レトロな純喫茶の雰囲気を残しつつ、現代的なおしゃれなデザインを融合させた空間が特徴です。象のクッキーが乗ったカラフルなクリームソーダは、SNSでも人気を集めるフォトジェニックな一品。広々とした座敷席や子供用の椅子、おもちゃを
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_喫茶ゾウメシ -->

---

### ROCCA & FRIENDS CREPERIE to TEA 名古屋店（錦 / クレープ・ティードリンク・★3.9）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 素材にこだわった作りたてクレープとフォトジェニックなドリンクが魅力。地元グルメメディアやSNSで広く紹介され、Instagramフォロワー数もクレープ専門店としてトップクラス。高い集客力と話題性を兼ね備えた注目店です。
- **insiderNote**: 地元グルメメディアで多数紹介され、SNSでも話題。Instagramフォロワー数がクレープ専門店としてトップクラスであり、集客力とブランド力構築に成功している。
- **sources_used**:
  1. [SNSでの話題性、Instagramフォロワー数の多さ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGCmIWBSvW4nafhjA9Tf63R5LXxrTOrSTT6HNVGczNE_bvK8cxxuCtCG6eYWIKSNpv02Y3xla6GQZ1I07QLwturd0DFpmEZFPio5QJRFy0CfnIP2JIkca7R1BWYRffBLmZF0XLOezsOtWn2HLQHiQ==)
     > SNSでも話題のクレープ専門店として注目されており、Instagramのフォロワー総数はまもなく1万人に達し、クレープ専門店としてはトップクラスのフォロワーに支持されています。
  2. [複数の地元グルメメディアでの紹介、SNSでの話題性、Instagramフォロワー数の多さ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQER6N2qrpkQYITdOTh9L8TPIcGitlt3Ngtvj5pzNgcjy1lsFYn0rp3fv4IFm3vAjE3avLH66_JPRhHDI5LLHifzoa0GNXbGjLMV6QeY_dPr99sRMZy1NPhlbZ7KK3mSQS05_XK9ZTYJ9601eEnl72N0JNGG_wD6BxCACA==)
     > 「ROCCA & FRIENDS CREPERIE to TEA 名古屋店」は、複数の地元グルメメディアで紹介されています。「おいしいなごや」、「ナゴレコ」、「Lemon8 App」、「KUTSULOG」、「愛知名古屋咲楽（さくら）SAKURA MediaJapan」、「名古屋情報通」などで取り上げられています。また、SNSでも話題のクレープ専門店として注目されており、Instagramのフォロワ

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_rocca&friendscreperietotea名古屋店 -->

---

### Seoul Kitchen ソウルキッチン（東桜 / 韓国料理・★3.6）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 本場の味を研究し尽くした料理人が、厳選食材で日本人向けにアレンジしたモダンコリアンを提供。赤ワインで香りづけするサムギョプサルや一人鍋など、独自の工夫と幅広いメディア露出で名古屋の韓国料理シーンを牽引しています。
- **insiderNote**: 本場の味を研究し、厳選食材で日本人向けに昇華させたモダンコリアンは、メディア露出も豊富。赤ワイン香るサムギョプサルなど、独自の工夫が光る。
- **sources_used**:
  1. [幅広いメディアで紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdnNiWifXNVDQDmDhV4Wla2bFC6yNiigU4YuREZnTdXrzmPXpnG5xZvCg8YvYiTJtKoYvAEI-1fhAkdcs-EOHOH7EoEHRDSG8OtzfuwgMpwir-dTSWYlRWoVliAbRacvO8YTLp-IN-Gh6A)
     > RadiChubu-ラジチューブ-」: 店長の福地さんがインタビューを受けています。
  2. [本場の味を研究し日本人向けにアレンジしたモダンコリアンを提供し、赤ワインで香りづけするサムギョプサルや一人鍋があること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEbm1U0Yuk-DyMUhcLtk8Kacjm7uYUnLG7SNY82ppVwlJEAEQR5sPuv2OSdkF5uRQNCcvaHhzQwVn0nAXzcwWbA9lBeGL1lZYyBLw8szfjBGVg1XY1jjAnrQfdBKnguH14ZTbF9ok-p3D1IhqizFls=)
     > 料理人は本場の韓国料理をしっかりと勉強し、研究し尽くした者が担当しています。…本場の味を日本人向けに美味しく食べやすくアレンジした「モダンコリアンレストラン」として提供しています。…サムギョプサル: …焼き上げの際に赤ワインで香りづけをするのが特徴です。…一人鍋料理: チーズタッカルビやタッカンマリ（白）など、一人でも楽しめる鍋料理が人気です。
  3. [幅広いメディアで紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE8NE1Ro_sNJ7JN22fxAQSBd0Hbpo8nEvsD5v75MN5yLTTwNuK9GxIdBZb_YWPOEWPDBlPGQW4KUXsjYgEMHe7rjHbCGdln8egaOVomY5xv4yYCifWLM3r0KH9GPFXPQlBCbYisV-E=)
     > テレビ番組: メ～テレの番組「ドデスカ！」または「ドデスカ＋」の「うましゅんランチ」というコーナーで、スンドゥブチゲランチが紹介され、その様子はYouTubeチャンネルでも公開されています。
  4. [本場の味を日本人向けにアレンジしたモダンコリアンを提供し、赤ワインで香りづけするサムギョプサルが独自の工夫であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE302Jmf6-v1aS8MB-aaA25gHzuO4TFwg3aNf_egEcdFVrZq_iMfhv_KiHkfWlU-p4rfl18QNgSSePFpEHkJyzopXTNxycOMqBF3DqPBnfZDjiDUN5cHEaVcrqeGeV-XXc5hg==)
     > 「新しい思想で創る モダンコリアンレストラン」と表現され、本場の味をそのままに提供しつつ、日本人の口に合うように工夫されている点が評価されています。…サムギョプサルの調理法については、「焼き上げの際に赤ワインで香りづけをしているのがソウルキッチンの特徴。蒸発する赤ワインの香りが豚肉の香ばしさを引き立てます」と、独自の工夫が評価されています。
  5. [幅広いメディアで紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEqqQ8W-tJxuQ-JF8NI1s94jeF5b1PbxhL61eewxD6BlMkBA2C22WuTCAwJizTStWPNCPFqK3GsVRIsz10SAeZDeVDTTFod7DmjYBPmqoPPGmKNxqiZcKO9)
     > DIME」: 「名古屋で人気の韓国料理の店10選」の一つとして掲載されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_seoulkitchenソウルキッチン -->

---

### 鮨 銀座おのでら 名古屋店（栄 / 江戸前鮨・★4.5）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 「銀座から世界へ」をコンセプトに掲げ、ロサンゼルス店がミシュラン2つ星を獲得するなど世界で認められる「鮨 銀座おのでら」の名古屋店。地元メディアも注目する、その確かな実力とブランド力は業界でも際立っています。
- **insiderNote**: 統括総料理長 坂上暁史氏の「一口ごとにドラマを創りたい」という思いを継承し、名古屋店の料理長 藤田拓也氏も総本店で修業。ベテランの握り手が心地よい接客で、鮨のサイズや好みに合わせた対応力も評価されています。
- **sources_used**:
  1. [「鮨 銀座おのでら」の「銀座から世界へ」というコンセプト](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH5xo9es-En81EsXlvDGTAbpKdnYPNgzMhmV4YBB7jLdWM3g7TqYR5lK_K62S7UZOHHTpdLeMnhOlMPBMdk39pgTTjqDONszRj7vkKj1jMJqStxGbWbAbfRMnU-UYhHhNStNA==)
     > 「鮨 銀座おのでら 名古屋店」は、「銀座から世界へ」をコンセプトに、鮨を通じて日本文化を世界に伝えることを目指しています。
  2. [「鮨 銀座おのでら」グループのロサンゼルス店がミシュラン2つ星を獲得した事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGw3skTcInuIIJjak1EKZRLwzSACTICKGUWDgdKcleWMgbRFLEHNj-s0u9wRnel7eNKaPC6h1ksoo4YIDu2SZlHis-Ol9jwP80FZYNGeFlK5A-nTJVyqsTXOcgBYjx4pQ==)
     > 「鮨 銀座おのでら」グループとしては、ロサンゼルス店が「ミシュランガイド カリフォルニア2022」において2つ星を獲得しており、その高い技術と評価が世界的に認められています。
  3. [「鮨 銀座おのでら」グループのロサンゼルス店がミシュラン2つ星を獲得した事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEbdJBeJ603dbVrqIbdaJnmOLCCbl7z7E6MfvHpEIo9Pjpj776AYAxdu9t6hZwCBVZZ198oO69EvqdhGCHKoGK-rlN5Bv4iIR8FJk6T4vnHJIwdDBTWmfSucyTvrnleXW5mQNVt)
     > 「鮨 銀座おのでら」グループとしては、ロサンゼルス店が「ミシュランガイド カリフォルニア2022」において2つ星を獲得しており、その高い技術と評価が世界的に認められています。
  4. [「鮨 銀座おのでら」グループのロサンゼルス店がミシュラン2つ星を獲得した事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGeHPHzaTQsHDvVwpyRmWVFzei1WZSJAkH9f4GI8P-6lTb8POlB_vTkkrxzOJa85oj95pWu3C_FEU6QYqCxEI3BBmbaNcCJPFIU8oruczwAE1OLNL2Tv3wi2GUV1Y0h9I0G_CgTNhwiKQZBcQ==)
     > 「鮨 銀座おのでら」グループとしては、ロサンゼルス店が「ミシュランガイド カリフォルニア2022」において2つ星を獲得しており、その高い技術と評価が世界的に認められています。
  5. [「鮨 銀座おのでら」が世界で認められているという評価と地元メディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF1OIikpEUVjDac1RLQTOzhvoP0ImK5flFf5yS0q5TBGLFumLwSoLtkdemSFWmLqGa0wuKN_cpXPbCswPq0oHgmGtDCKC_r49QGZAoVOup68_vwRbzGu-HJ-Xg9LY3Wdhk06p0-2kaR)
     > 「鮨 銀座おのでら 名古屋店」は、「食べログマガジン」で「世界でも認められている『鮨 銀座おのでら』が、名古屋に初出店！」として紹介されています。
  6. [地元メディア（名古屋情報通）での注目](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEUD8KZ04CEjKrtQMbIM_AS44r075_jRwr7avhJiePrrxN46BkAN6Nl3jPwW5lmPwjsZz_De1JmFg6EbM_56yuWo9eivVCjcPdeLFnbJqAlvbhHP5z0yASPxW_0m3rKZW-zkcU15D0=)
     > 系列の「廻転鮨 銀座おのでら 名古屋店」のオープンが「名古屋情報通」で報じられるなど、地元メディアでも注目されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_鮨銀座おのでら名古屋店 -->

---

### 大銀杏 栄店（栄 / 焼鳥・★3.7）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 食べログ「焼き鳥 百名店」に連続選出され、Rettyでも高評価を得る実力店。備長炭の強火力で素早く焼き上げる職人技が光り、名物の希少部位や一品料理も充実。地元メディアでもトップクラスと評される人気店だ。
- **insiderNote**: シェフの口コミでは、丁寧な仕込みと鮮度の良い鶏肉、塩、炭火の火力へのこだわりが伝わると高評価。品質とリーズナブルさを両立し、特に手羽先は「日本一」と評される。
- **sources_used**:
  1. [食べログ「焼き鳥 百名店」に2年連続選出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHOxTOWgRjIlLHktkq3CU6f2EamZdablz0qxu1dINMrABKZPYBLZ40rSLABihQ4RLDYzQsqgSR1XRZHMMFD08B8JTEEW_0Nv5a1VtKM2bqcyvqBhKoTR_GXHML4KrMgHWYX)
     > 「大銀杏 栄店」は、食べログの「焼き鳥 百名店」に2018年と2019年に2年連続で選出されています。
  2. [食べログ「焼き鳥 百名店」に2年連続選出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHc5Jpz4I7m58oMtspHip197tGeOX68cxNEL7tItl3Z8hyO6gfpCQTH1MEFcKDqNopI7_o-pPNgtHZ29iUmf_PG1Pc4Nu6PuFbjTpttYLfBHipwVgOSLIQaJEm6xLN6TByd3to9x_cI9MXphW6tLiYkIFmzPrGj)
     > 「大銀杏 栄店」は、食べログの「焼き鳥 百名店」に2018年と2019年に2年連続で選出されています。
  3. [食べログ「焼き鳥 百名店」に2年連続選出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEPbX_FKeDpGjZAaIZkfGvBqNmnjD4YmGIamfkH7R45i3u7DsYDUQ21woNnpTc5JMLa__VxYcRUwlHahz8rC2rgRf8xNGjjo03dllgecUD9QG3Qb3eRq1aANtHf0Eqw6CBCeB355w==)
     > 「大銀杏 栄店」は、食べログの「焼き鳥 百名店」に2018年と2019年に2年連続で選出されています。
  4. [食べログ「焼き鳥 百名店」に2年連続選出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8f16UuvkzhIZ62jl1jC74xAQPRUUljhnITmaC6fxJWiof_vodlmZJ513R6MAFtY-KeeVo3tf_bOEAC26NmAkmjBdF9Vs1FfFbtW5UZpJiRCF0TqRrduw92_C7Me_ygWNklbw04ypzbvOgHUhjeRPfPzwM_w==)
     > 「大銀杏 栄店」は、食べログの「焼き鳥 百名店」に2018年と2019年に2年連続で選出されています。
  5. [Rettyで高評価を得る](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGpETz_xUt2UO4E99HPr6oWhabfMay86-Hh3p1qUzTqp0nfrqwniPKdtQDqcbrZwfIPBj4njxS84DHvoi_HPEnQfke9nK5bpDMh5YTwSUN1WDPzPmHZaoYY6ifMZo11T3pSzQ_pixfQc89WcSU3fZOohRo=)
     > Rettyでは、食に詳しい人のオススメが集まった上位2%の店舗として紹介されており、4.06/5と高い評価を得ています。
  6. [Rettyで高評価を得る](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGgMfJGa0_0AnpXollb77DXogj6xea27rDCpiwm6VjmfN4rcGUsLsXNmKZl-Xvcm66zWf_wte2XeAMXswXS2-ud-9Rj2iT_EVa_p-frH4EIDrTHUumyXtTpeXj27hvbuhwykwaS2appxE19G3I0rhuuJhKJVto7hw_2uw==)
     > Rettyでは、食に詳しい人のオススメが集まった上位2%の店舗として紹介されており、4.06/5と高い評価を得ています。
  7. [備長炭の強火力で素早く焼き上げる職人技](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFVQItu2g0EoOo41MH-OEYunsH4aJoReHJgyuDRSbdG3uu_qiD_VNueghhlmnTdU18DAOcvBA7K3b6fCnXXaRLRJg5zD1fFPA_GxxGZnNskW-xM0mvrHXug2Ig-)
     > 焼き方においては、職人が特注した火力の強い特大の焼き台で良質な備長炭を使用し、素早く焼き上げることで旨味を閉じ込めています。
  8. [備長炭の強火力で素早く焼き上げる職人技](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGpETz_xUt2UO4E99HPr6oWhabfMay86-Hh3p1qUzTqp0nfrqwniPKdtQDqcbrZwfIPBj4njxS84DHvoi_HPEnQfke9nK5bpDMh5YTwSUN1WDPzPmHZaoYY6ifMZo11T3pSzQ_pixfQc89WcSU3fZOohRo=)
     > 串物は一本一本丁寧に串打ちされ、備長炭の強火力で素早く焼き上げられます。
  9. [名物の希少部位や一品料理も充実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFVQItu2g0EoOo41MH-OEYunsH4aJoReHJgyuDRSbdG3uu_qiD_VNueghhlmnTdU18DAOcvBA7K3b6fCnXXaRLRJg5zD1fFPA_GxxGZnNskW-xM0mvrHXug2Ig-)
     > メニューには、名物の「ちょうちん」や「仔羊の柚子胡椒焼き」、「うずらの卵」など、他ではなかなか味わえない希少部位や変わり種も揃っています。串料理の他にも、様々な一品料理や締めの食事も用意されています。
  10. [名物の希少部位や一品料理も充実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGpETz_xUt2UO4E99HPr6oWhabfMay86-Hh3p1qUzTqp0nfrqwniPKdtQDqcbrZwfIPBj4njxS84DHvoi_HPEnQfke9nK5bpDMh5YTwSUN1WDPzPmHZaoYY6ifMZo11T3pSzQ_pixfQc89WcSU3fZOohRo=)
     > メニューには、名物の「ちょうちん」や「仔羊の柚子胡椒焼き」、「うずらの卵」など、他ではなかなか味わえない希少部位や変わり種も揃っています。串料理の他にも、様々な一品料理や締めの食事も用意されています。
  11. [地元メディアでもトップクラスと評される人気店](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEqcN5BmIRo-Yl8nPDFQ3meAjGvYMLtVT7oDoF82FnM350WQB4jkIZddvf5Z_rlUaztzMdZLqxolgI1V0_Ki-9NOP05kApECBERIvrKNDj2-UltPAnhWOMlxYPg)
     > 「いとログ」では「名古屋でもトップクラスの焼き鳥店」の一つとして紹介されています。
  12. [地元メディアでもトップクラスと評される人気店](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHOxTOWgRjIlLHktkq3CU6f2EamZdablz0qxu1dINMrABKZPYBLZ40rSLABihQ4RLDYzQsqgSR1XRZHMMFD08B8JTEEW_0Nv5a1VtKM2bqcyvqBhKoTR_GXHML4KrMgHWYX)
     > 「フードアナリスト矢澤博之の美食巡り【やざわの歩きかた】」でも、名古屋で人気の高い店舗として取り上げられています。
  13. [シェフの口コミによる丁寧な仕込み、素材・火力へのこだわり、品質とリーズナブルさの両立、手羽先の高評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEPbX_FKeDpGjZAaIZkfGvBqNmnjD4YmGIamfkH7R45i3u7DsYDUQ21woNnpTc5JMLa__VxYcRUwlHahz8rC2rgRf8xNGjjo03dllgecUD9QG3Qb3eRq1aANtHf0Eqw6CBCeB355w==)
     > 「ヒトサラ」に掲載されたシェフの口コミでは、「大銀杏 栄店」は一本ずつ丁寧に仕込みがされた美味しい焼き鳥店であり、鮮度の良い鶏肉、塩、炭火の火力、どれをとっても調理に気を使っていることが伝わると評価されています。その品質にもかかわらずリーズナブルである点が人気を集めており、特に塩でいただく「手羽先」の串焼きは「個人的には日本一」と評されています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_大銀杏栄店 -->

---

### THE CUPS SAKAE（名古屋市中区 / カフェ・★4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 「CAFE&PASTA THE CUPS Q」としてリニューアルし、コーヒーのこだわりはそのままに、運営会社の強みである本格イタリアン料理やこだわりのパスタ、スイーツが加わった点が業界視点での魅力。広々としたおしゃれな空間も兼ね備え、カフェ利用から食事まで多角的なニーズに応えます。
- **insiderNote**: 「株式会社QUINCI」運営により、本格イタリアンと自社ベーカリーのパンを導入。旧来のバリスタのこだわりも継承し、専門性の高いカフェとして進化しています。
- **sources_used**:
  1. [「CAFE&PASTA THE CUPS Q」としてリニューアルオープンしたこと、以前のコーヒーのこだわりはそのままに本格イタリアン料理やパスタが加わったこと、広々としたおしゃれな空間であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQER2Nr8ndoB3GZuY-TwCYhjnCSRLL2bUSs3V4jsExS8Q6Y0VAyPfOPaKqjwfmMfTNZM_cCaRbnPF8Nwz_IJht94841xrKK12_vX2QaffxGr0DLhlu0Bx5r164XX-qQo5aQ=)
     > 2023年3月1日より「CAFE&PASTA THE CUPS Q」としてリニューアルオープンしています。以前の「THE CUPS」の魅力を引き継ぎつつ、新たなメニューが提供されています。以前の「THE CUPS」のコーヒーのこだわりはそのままに、本格的なイタリアン料理やこだわりのパスタが加わっています。
  2. [旧THE CUPSのコーヒーへのこだわり、バリスタの技術、広々としたおしゃれな空間であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHVvG9e1DHi-rJl3mk4mbxI6SziPYM6q8NWYSWinJCQ5D1UHCTqcgUk8OS1hxj9lhZqScPTw6foCcoZHosmpi_CFWSz9bNl5GiOQkRq5km894umlULJ8qY_MDN2KBCTfWgKi_k6dg0=)
     > 「THE CUPS」は、当初「これまでにない新しいカフェ」を目指して作られました。良質なコーヒーと「体に効く」野菜をコンセプトにした「VEGE WORKS」というサラダを提供し、野菜ソムリエ監修のもと、サラダを主菜として提案していました。また、バリスタの個性を重視し、客の好みに合わせてコーヒーを提供するサービスマンとしての役割を大切にしていました。店内は広々としており、Wi-Fiが完備され、一部の
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_thecupssakae -->

---

### アロマフレスカ名古屋（栄 / イタリアン・★4）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: ミシュランプレート獲得の名古屋を代表するイタリアン。銀座本店譲りの素材を活かす哲学と、旬の香りを大切にする料理が魅力。窓からの眺望やソムリエ厳選ワインで特別な時間を演出します。
- **insiderNote**: 銀座本店がミシュラン一つ星を獲得する「アロマフレスカ」グループの一員。歴代シェフが素材を活かす哲学を受け継ぎ、現料理長も伝統と自身の感性を融合させています。
- **sources_used**:
  1. [ミシュランプレート獲得、銀座本店がミシュラン一つ星であるアロマフレスカグループの一員であること、グループの素材を活かす哲学、旬の香りを大切にする料理、現料理長が伝統と感性を融合させていること、窓からの眺望、ソムリエ厳選ワインの提供を裏付けます。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzycv5vGXag1xOO0kKRrRI3P2UzdZp9XRUX4isSOJ-1e3pYyWhhUJQVmE67vO2KPKklbryg5Fcy3SUh2Q-hpEIXcfGL-X5I4z3fy7fYU4cnhIF7otA32XFZ8JLYroZjeJga0eNvHK1V5F6JGLDGAdzZ4YkQeT2xrRtcLTC_BbtWtYmvuPocXKa9KDau8CNhJ-Puk2WPlhjDzTrl-cX1uUEfwyGljM45DF-v2co)
     > 「アロマフレスカ名古屋」は、「ミシュランガイド愛知・岐阜・三重2019 特別版」において「ミシュランプレート」として掲載されたイタリア料理の名店です。 「アロマフレスカ」グループの一員であり、同グループは東京や熱海に7店舗のイタリアンレストランを展開しています。 銀座の「アロマフレスカ」は、オーナーシェフ原田慎次氏が率いるミシュラン一つ星の名店であり、素材の持ち味を大切にする調理法で知られています
  2. [ミシュランプレート獲得とソムリエ厳選ワインの提供を裏付けます。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHRQwXG1doPnv6aIwOw0cD8YCgG3RelCUWJLtlaoHO1tw7yyKG3SwzZzZIqZomTODRZFjc2JdLp4rgrNjLDHIoTeU8dTwsC58grw1K54zWSaBp3TjTSljib0Mb9hQ==)
     > 「ミシュランガイド愛知・岐阜・三重2019特別版」掲載店。ソムリエ厳選ワイン。
  3. [旬の食材へのこだわりと香りを大切にする料理哲学を裏付けます。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG-V7v6bQkSnE2dU6ki-dRxOD0iDWNa_RZH-7VpOLT5LyhHwFrTdJnGZp4eqx4VU99ifYcG-Hzjr_5v2F_8quWSABDffsrRXHA7VzmAm63LlNYhgeplTer2Z6bnGjLNV9D2sLWkMQC_AOY=)
     > 2022年には「RadiChubu-ラジチューブ-」で紹介され、当時のシェフである久永勇太氏が、開店15周年を迎えた同店の香りを大切にする料理や旬の食材へのこだわりについて語っています。
  4. [銀座本店がミシュラン一つ星であるアロマフレスカグループの一員であること、グループの素材を活かす哲学、歴代シェフがその哲学を受け継いでいることを裏付けます。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH7feS2PUg5dVRfHyAL5l3QPdyXqMV3J5ODHQrM8cCCg2cqpZSd8VXTrKqzTb6BZ7eDyPcrqVrN6NxGgRivXkXJy0RIDDFAoy7QgdEPvqfIhh86SnCj5Rcn4i92lcSEPU4brOBqT0fSMlDLd3GMIZZeaYMA0Q8=)
     > アロマフレスカグループの公式サイト。オーナーシェフ原田慎次氏の紹介や、素材の持ち味を大切にする調理法、グループ店舗展開について記載があります。
  5. [松坂屋名古屋店本館10階に位置し、窓からの眺望が魅力であることを裏付けます。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdo8Tii8zJC5LOl3p7c67iAYhPYAUcoGmKPFqy9vHeS0NMWTXqxPbslMnHUij_DGUXOxWi5sTwicQLpbZBSB4Qwe5TG0LjmY0H3eRz1FmOHaj2LINuVrzsszVlQQfq1vj6tECPlFOgEcUn89us9vZ9wWsd2Rs-Cc4yUA==)
     > 松坂屋名古屋店本館10階に位置する店舗情報。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_アロマフレスカ名古屋 -->

---

### 鮨うおのたな（丸の内 / 江戸前おまかせ鮨・★4.8）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 老舗料亭「河文」の系譜を汲む隠れ家で、本格江戸前鮨を堪能できる一軒。旬素材へのこだわりと繊細な技巧が光り、ミシュラン星付き店も手掛ける運営会社の確かなノウハウが支える質の高い顧客体験を提供しています。
- **insiderNote**: 東京で修業した女性職人が腕を振るい、その所作の美しさと心地よい会話が魅力。運営会社の顧客体験重視の育成が、洗練された握りを生み出しています。
- **sources_used**:
  1. [老舗料亭「河文」の系譜を汲む隠れ家的な立地と空間、旬素材へのこだわりと繊細な技巧](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF0guNNaWv8Nb5stEd2qkpQQcBr9v155axIMTpIx3D5cet2wPoWdJsQ7CXFUcFxRTt921ynBKcw9E96Lo3-p71Qa32Da_N4d_2oMGSuwGfQ47nJRlsC-vPadJB2gagwyYKGJc79t6_Jm4aIuK9hEw==)
     > 「鮨うおのたな」は、400年続く老舗料亭「河文」の勝手口から入り、居酒屋「河内屋」の隣の扉を開くと現れる、看板もない隠れ家のような寿司処です。店内はカウンター席のみの洗練された空間で、老舗の品格と現代的な感性が調和しています。「鮨うおのたな」では、四季折々の旬素材や希少魚を用い、温度や香り、器の美しさまで計算し尽くされた繊細な一貫を提供することにこだわっています。
  2. [運営会社Plan・Do・Seeがミシュラン星付き店も手掛けるノウハウを持つこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEr5wxgiYduV3OSzPVcVQDlan5HbxoZ1EF3dlj6PbauL2nmwdej3YLsvvtVMtlC_5Gs859UcIm6QSPvpVUK-PvwiJIiVqpzlz-k9fmuUxN8H28Jgl3BB48ndfVkhhqz95Q0zLrFec2PmDTiIF-M5NEpoBvsmJvJ)
     > 運営会社である株式会社Plan・Do・Seeは、ミシュラン一つ星店『鮨麻布』の姉妹店も展開しており、世界に通用する「本物」の技術や運営ノウハウを身につける機会を提供しています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_鮨うおのたな -->

---

### kitchen HAKUGA（名古屋市中区 / 鉄板焼き・★4.7）

- **status**: OK 🟡 review-required
- **confidence**: 0.8
- **editorReason**: 家族経営の温かい雰囲気の中、フレンチの技法と鉄板焼きの豪快さを融合させた「鉄板創作フレンチ」を提供。洋食屋の懐かしい味も感じさせる独創的な料理は、地元グルメメディアでも「今いちばんアツい」と高く評価されています。
- **insiderNote**: オーナーシェフは経験を積んで独立し、父と共に家族で「鉄板創作フレンチ」を提供。完全予約制で顧客に寄り添う姿勢と、地元メディアでの注目度の高さが伺えます。
- **sources_used**:
  1. [家族で店を経営していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAmRh7OHo8c63Kx8upTls03CyeHDxbb3_3IJtvVlnldqpEbU652d4m2CkSt18BQpchfYLKmW9K-3w0maCaSO9BtvYKW5FBb7rE9DyUBK93smlzDAYRgz0GxxLINUv2)
     > 父の博明氏はスープやカレーを得意とする実力派シェフであり、雅博氏と共に厨房に立っています。弟の諭氏はソムリエを目指して修行中、妹の美来氏は給仕を務めるなど、家族で店を経営しています。
  2. [家族経営でアットホームな雰囲気であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEORT3ngo01xPn3iMWTqYBog13issrSA7qoE_Ip4w8b-SjrwnC8e1KYQGdZzMiiCpELgtRwok_FLtgBTgJVArhHTNBF-5ZMFnW9pzgWdCQHpG7BSX25OApy2LM=)
     > 家族で営むアットホームな鉄板焼き店
  3. [フレンチテイストと鉄板ダイニングの融合による「鉄板創作フレンチ」を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAmRh7OHo8c63Kx8upTls03CyeHDxbb3_3IJtvVlnldqpEbU652d4m2CkSt18BQpchfYLKmW9K-3w0maCaSO9BtvYKW5FBb7rE9DyUBK93smlzDAYRgz0GxxLINUv2)
     > スタイリッシュなフレンチテイストに鉄板ダイニングの豪快さ、洋食屋の懐かしい味、そして家族の温かさを融合させた「鉄板創作フレンチ」を提供しています。
  4. [「鉄板創作フレンチ」というジャンルであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEORT3ngo01xPn3iMWTqYBog13issrSA7qoE_Ip4w8b-SjrwnC8e1KYQGdZzMiiCpELgtRwok_FLtgBTgJVArhHTNBF-5ZMFnW9pzgWdCQHpG7BSX25OApy2LM=)
     > どこか懐かしさのある”鉄板創作フレンチ”は一興の価値がある
  5. [洋食屋の懐かしい味を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAmRh7OHo8c63Kx8upTls03CyeHDxbb3_3IJtvVlnldqpEbU652d4m2CkSt18BQpchfYLKmW9K-3w0maCaSO9BtvYKW5FBb7rE9DyUBK93smlzDAYRgz0GxxLINUv2)
     > 洋食屋の懐かしい味
  6. [斬新な発想と繊細な味わいの独創的な料理であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEORT3ngo01xPn3iMWTqYBog13issrSA7qoE_Ip4w8b-SjrwnC8e1KYQGdZzMiiCpELgtRwok_FLtgBTgJVArhHTNBF-5ZMFnW9pzgWdCQHpG7BSX25OApy2LM=)
     > フレンチの枠にとらわれない斬新な発想と確かな技量、知識を持つ一家が提供する「繊細な味わいが楽しめる創作フレンチ」として認識されています。
  7. [地元メディアで「今いちばんアツい」と高く評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHgrnuP6-2xPCGlNLWhIN-tZoETzQKPJqGtP772HNXL4ypmZgCiRBid3wBo0NxETRNBMsSLWZwQsMXFwpNjUSvOTKKKQcx0s0EHpPfHBtt-jyEc1YpN3hMwxEy1QwnTpWeRjxuhOjAW_7l86hOElelhhC581-c0MuqAJtkUJsYKjYr4xloWtDgfWcADLzg0nnaaB-mUOUlV9Q==)
     > ライフスタイルコミュニティ「Lemon8」では「名古屋で“今いちばんアツい”と言われるおしゃれ系鉄板焼き」として紹介され
  8. [地元グルメメディアに掲載され、評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEORT3ngo01xPn3iMWTqYBog13issrSA7qoE_Ip4w8b-SjrwnC8e1KYQGdZzMiiCpELgtRwok_FLtgBTgJVArhHTNBF-5ZMFnW9pzgWdCQHpG7BSX25OApy2LM=)
     > 「kitchen HAKUGA」は、グルメ情報サイト「ヒトサラ」や実名型グルメサービス「Retty」に店舗情報が掲載されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_kitchenhakuga -->

---

### 山本屋総本家 本家（名古屋市中区 / 味噌煮込みうどん・★4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 創業大正14年の老舗として伝統の味噌煮込みうどんを守りつつ、新メニュー開発やイベント出店で進化を続ける。こだわりの味噌だしと「生きたうどん」は、名古屋めしを代表する名品として広く認知されている。
- **insiderNote**: 創業100年近い老舗として伝統の味を守りつつ、新メニュー開発やイベント出店など積極的な挑戦を続ける経営姿勢は注目に値する。家庭料理を名品に昇華させた探求心も評価される。
- **sources_used**:
  1. [創業年と伝統を守っていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHQt3WuT2E63wdJZPuNljYYLR6pC3qejXE1Tvu0G7wZ_MklIFw6NsZJY19kilGvYYrAEcqMq4vSWXjtw38h2HOK0HyZP0YaK1ANu5OV03N0bEZaw8xL8mqhjHM=)
     > 大正14年（1925年）の創業以来、伝統の味を守り続けています。
  2. [創業年と伝統を守っていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE2TDhaz4hkErNBTcDQy2XRnKhqGLonu08PRasqrWK4LMYNtFjDdC2HFKY_yw6udhNb58l3FPlEmfdjmlmZlwBCUs_NwlexPfcd3od5NQ1YrLpZ7jg=)
     > 大正14年（1925年）の創業以来、伝統の味を守り続けています。
  3. [新メニュー開発やイベント出店による進化](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHQt3WuT2E63wdJZPuNljYYLR6pC3qejXE1Tvu0G7wZ_MklIFw6NsZJY19kilGvYYrAEcqMq4vSWXjtw38h2HOK0HyZP0YaK1ANu5OV03N0bEZaw8xL8mqhjHM=)
     > 名古屋めしイベントへの出店、新メニューの開発、ギフト商品の販売など、新しいことにも積極的に挑戦し、進化を続けています。
  4. [新メニュー開発やイベント出店による進化](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE2TDhaz4hkErNBTcDQy2XRnKhqGLonu08PRasqrWK4LMYNtFjDdC2HFKY_yw6udhNb58l3FPlEmfdjmlmZlwBCUs_NwlexPfcd3od5NQ1YrLpZ7jg=)
     > 名古屋めしイベントへの出店、新メニューの開発、ギフト商品の販売など、新しいことにも積極的に挑戦し、進化を続けています。
  5. [味噌だしと「生きたうどん」のこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHQt3WuT2E63wdJZPuNljYYLR6pC3qejXE1Tvu0G7wZ_MklIFw6NsZJY19kilGvYYrAEcqMq4vSWXjtw38h2HOK0HyZP0YaK1ANu5OV03N0bEZaw8xL8mqhjHM=)
     > 愛知県岡崎産のカクキュー八丁味噌と地元銘産の白味噌をブレンドしたコクのある味噌だしを使用し、国内産小麦粉100％で塩を一切使わずに打たれた、歯ごたえのある硬い麺が特徴です。この麺は「生きたうどん」と称され、粉と水だけで作られているため、生のまま直接煮込むことができます。
  6. [名古屋の味噌煮込みうどんの有名店として認知されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEcD9HxpaEX_YDqjwMMdBLAwKp3IpAUmRyuUIKZsij6Tp2qQihhicnZpQvYYBm1DTvPc48u70q_I-Jqo8zerQxmpuHSsyX0KoNIX0MkDcrJpq43iV-6C7cxUcUvbYPCUK6G_q0EqKA=)
     > 名古屋の味噌煮込みうどんの「テッパン」として「山本屋総本家」と「山本屋本店」の二大有名店が挙げられています。
  7. [名古屋のご当地グルメとして人気店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHUgQI2C3uPoTLiclD6Vh4ffGTFWGVwFTAQ9l9GFg8yKosjLN3afqO3zbtc7nlVCN7h3rPy9rdk4tLKZF0h49OPYtqBcRVRBP_N1V0mZytyMXs5EfUny-qB5GJWM2-uUJJiJJtQT3rFtWU=)
     > 名古屋の絶品ご当地グルメが楽しめる人気店の一つとして掲載されています。
  8. [家庭料理を名品に育て上げた探求心](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHQt3WuT2E63wdJZPuNljYYLR6pC3qejXE1Tvu0G7wZ_MklIFw6NsZJY19kilGvYYrAEcqMq4vSWXjtw38h2HOK0HyZP0YaK1ANu5OV03N0bEZaw8xL8mqhjHM=)
     > 家庭料理であった味噌煮込みうどんを「名品」に育て上げた味づくりの探求と、細部にわたるこだわりが、代々の経営者の努力によって支えられてきたとされています。
- **warnings**: 3件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_山本屋総本家本家 -->

---

### LAYER'S レイヤーズ 丸の内本店（丸の内 / ハンバーガー専門店・★4.2）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 東京有名店で修行したオーナーが名古屋にグルメバーガー文化を導入し、8件もの独立者を輩出。厳選素材と手作りにこだわり、2022年には食べログ百名店に選出された、まさに名古屋グルメバーガーの王道店です。
- **insiderNote**: 東京の有名バーガー店「BROZERS'」で修行したオーナーが、名古屋にグルメバーガー文化を根付かせ、8件もの独立者を輩出した功績は業界でも高く評価されています。
- **sources_used**:
  1. [オーナーの修行経験、名古屋グルメバーガーの先駆け、独立者輩出、厳選素材と手作りへのこだわり、名古屋グルメバーガーの王道、2022年食べログ百名店選出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGrZBCPNs6uGCTD-w6ksaCnTvMeKltICDVwIDrO528_-BGj8Zsnb8aDwys6zYK176u1vn_93Lj-A0Gex_4vW79GHAPeoLHZNfnUKTVaqaQbQFsulxGrlN0tnvBJMWwgSUErbyYxDlEK29sd5VOrrCk=)
     > オーナーは東京の有名バーガー店「BROZERS'」で修行し、名古屋にグルメバーガー文化を導入した先駆者であり、8件もの独立者を輩出している。厳選素材と手作りにこだわった「本格ハンバーガー体験が楽しめるお店」として評価されており、提供されるハンバーガーは「名古屋グルメバーガーの王道」や「王道の絶品ハンバーガー」と評され、2022年には食べログのハンバーガー百名店に選ばれるなど、その品質は広く認められ
  2. [オーナーの修行経験、名古屋グルメバーガーの先駆け、独立者輩出、名古屋グルメバーガーの王道、2022年食べログ百名店選出、厳選素材と手作りへのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHeXpESlMLtbE2naCuTIUJvzOiGcc-7H0oSf-q9pwQSIo8cFeBOgZJRTqqjxPkkuWJDsb75dGo4VygsFzfQ3lIHNZZaA3M2W8QTgcPPB4-QWzr_MNVcTTPCX75EZ3yY1HpIXVOiMDbzxOU2c_ytjZv_P_yjMKzdOXhBmmjsFY-bMQ==)
     > オーナーは東京の有名バーガー店「BROZERS'」で修行し、名古屋にグルメバーガー文化を導入した先駆者であり、8件もの独立者を輩出している。提供されるハンバーガーは「名古屋グルメバーガーの王道」や「王道の絶品ハンバーガー」と評され、2022年には食べログのハンバーガー百名店に選ばれるなど、その品質は広く認められています。厳選素材と手作りにこだわった「本格ハンバーガー体験が楽しめるお店」として評価さ
  3. [2022年食べログ百名店選出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGWMF8nrX7Wr0xN5q_55PONZL8Gt1a7BLwy8p9trKYRqhlNbPMTXTvVPiLhf9ndkofssYLQJVns5htfdzoUONOtzPe2obMUuU5NLa2paA8BQaoyuAqcNEPnwMDGITnJhCD7b2PMyl_fxtF6rSk=)
     > 「LAYER'S レイヤーズ 丸の内本店」は、2022年に食べログのハンバーガー百名店に選出されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_layer'sレイヤーズ丸の内本店 -->

---

### スパゲッティハウス ヨコイ KITTE名古屋店（名駅 / あんかけスパゲッティ・★3.8）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 「あんかけスパゲッティ」の元祖として、創業者のこだわりが詰まった唯一無二の味を提供。なごやめしを代表する存在として広く認知され、地元メディアでも多数紹介。三代目による効率化や多角的な事業展開で、その魅力を発信し続けている。
- **insiderNote**: 三代目によるタブレット注文導入で店舗運営を効率化。ソースや乾麺販売、東京進出、物産展出店など、あんかけスパゲッティの発展と浸透に積極的で、業界での存在感を高めている。
- **sources_used**:
  1. [創業者のこだわりや歴史が地元メディアで紹介されている点](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF_F9LKJDdVgVYgKxMuBme2LM2_jKp1xyCuPJIUQs9yEbivf4iC8Mn0xnXJf3_T5uKo5xOE6VFlovG8Z_NZuKJLtIUew-vDRIL6IMg04_fMCoutS5SFWzm80WM4v61zkAaBvoPhtdw8stz-orMU1xzDykRKkmPvATaD-B8=)
     > CBCマガジン（CBCテレビ）では、その歴史や「ミラカン」の誕生秘話が取り上げられるなど、地元メディアで深く掘り下げられています。
  2. [あんかけスパゲッティの元祖であり、なごやめしの代表格として認知されている点](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGMpsVUS1s9nBDMstUdiNfFfqWP-meK9YRCXFqb1evRUJMib0WVtkGSQFA6Q8WswhKhfVq4fGIRZZmxrWM1er-2NDX0fEP-nQedYxXgoz5pZEPMg_-_SQU_jRg_GBlnTomovH8sM8Kj8g==)
     > 「あんかけスパゲッティ」の元祖として、名古屋のB級グルメや「なごやめし」の代表格として広く認知されています。
  3. [あんかけスパゲッティの元祖であり、なごやめしの代表格として認知されている点](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG1pYT_Bv4CzS-1iIHx0EML1TqXRFABFCmaUmXbc9QpKtYvKFz5rCRehcnPI0zB1r8z6HeMTfBULaKdq3NGge8U8D7-hRUzBnK4nbS6VZJoi30WBiQq775ZRZcERoq0pEqRMEP4_w9mIN5BU0s1ls8ZDuktss946PzBBainewCaxppx0qBmjFb0e3wcLjTms4UJ988DVv_UeED5x-Trc7MveTTDco-olfxDYNo5-fmq2Bjkfs3NF9tkE1nSwsv3Qoa2qd5x5Zt24Ee25L6t0Qk1FpHbIFndMXe9ZsGBBtcUB1mltK8X1QCjF6J452he9c0GoqYz3c8reN6NDdahvidq2ETpEKOb-NVIsK21Angj)
     > 「あんかけスパゲッティ」の元祖として、名古屋のB級グルメや「なごやめし」の代表格として広く認知されています。
  4. [創業者のオリジナルミートソースと極太麺へのこだわり、およびあんかけスパゲッティの発展に向けた積極性](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGTd-OIV0AibEz4cpzHGDQVX-pBH6G0eGaCviTK-98j6uCmbTMd71BwXqw8itqcSYTWQKy-cUE6ofbYFBFGQsi5pJvlzdRK5bGNqHsCET3PkpZox8jb7qG4mQ==)
     > そのこだわりは、野菜と肉をじっくり煮込み、10日以上熟成させて仕上げるピリ辛で濃厚なオリジナルミートソースと、2.2mmのオリジナル極太麺にあります。
  5. [三代目による店舗運営効率化の取り組みと、あんかけスパゲッティの発展に向けた積極性](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEX9Z2RKiJMU-O_L1zWEyjTxINlAfApKg-kt4GhjgwxR30X1D5BU0pkJ5U4pUuTWUpztfLDVwuAGTY_MIsJG87FWnXIRiVDhDrsVNmEd8fhsbTcs3Fy6GsLBao0xcPdTVxz-karCNsrfffZ)
     > 三代目である横井慎也氏は、コロナ禍を経て店舗運営の効率化を図るため、タブレット注文システムの導入に積極的に取り組み、オーダーの効率化やミスの削減、外国人従業員やアルバイトのホール業務対応の簡素化を実現しています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_スパゲッティハウスヨコイkitte名古屋店 -->

---

### スパゲッティハウス ヨコイ 錦店（錦 / あんかけスパゲッティ・★3.9）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: あんかけスパゲッティの元祖として、創業者の情熱と試行錯誤から生まれた名古屋を代表する一皿。2日がかりで煮込み熟成させる特製ソースと極太麺が織りなす伝統の味は、三代目に受け継がれ進化を続けています。
- **insiderNote**: 創業者の「熱いものは熱く」のこだわりが、でんぷんの絶妙な配合によるソースのとろみを生んだ。三代目は伝統を守りつつ進化を追求し、名古屋めしを牽引する。
- **sources_used**:
  1. [あんかけスパゲッティの元祖であること、創業者の情熱と試行錯誤、ソースの製法とこだわり、三代目の伝統と進化の姿勢、名古屋めしとしての地位確立](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEV_DnBSYC6AcVAofPbFTwav4mpUjKMZ4h14uT1lD-F2mfImGrxwwLIFgmK5QDKNGAGLSqVV2gv8JKDXv8A2tKbMjyGV2pH_G7qINwuDJuoxoiyKI25wdeOPlIuSCaL-h_bOGQK_TuLUsjvyEyB7b6KEsza1I1DeDBZbpE=)
     > 「スパゲッティハウス ヨコイ」は、創業者の横井博氏があんかけスパゲッティを生み出しました。横井氏は、日本にイタリアンを根付かせたいという思いから、自身の得意なデミグラスソースとミートソースをアレンジし、約2年の試行錯誤を経て現在のあんかけスパゲッティを完成させました。ソースは、野菜7、トマト2、肉1の割合で厳選された材料を2日がかりで煮込み、1週間冷蔵庫で熟成させることで、旨味が凝縮され、なめらか
  2. [あんかけスパゲッティの元祖であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHkB50TKz9QySvyvcpghcE7QNh-nou62aeCC4gnmRxji56evR9U8guH95hAVtI5A55vHAbtaOZ-2SjO8fEGtN4dM0aeKukc27fT1RQjm-wTivrzLPrsz5c7vJD867yOXz7UaC3AxZKBMw==)
     > 名古屋のご当地グルメ「あんかけスパゲッティ」の元祖として広く知られており
  3. [創業者の情熱と試行錯誤、料理へのこだわり、名古屋めしとしての地位確立](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHE1zC9_LZQ7ClQH_jtDEpIOX8CSHkw8CWb1KxpoBQB0Mr7ySg0dytZXWK1I6vkl22reI2hSNRzz_HaMz17ggNxhCt4p3mcWP_V4teKM-BYo3rHk2uWKBwUtzy0GCHKVHpI9yA=)
     > 創業者の横井博氏は、名古屋国際ホテルの洋食部門でシェフを務めた経験を持ち、日本にイタリアンを広めたいという強い思いから、あんかけスパゲッティを考案しました。彼の料理へのこだわりは、「熱いものは熱く、冷たいものは冷たく」提供するという信念にも表れています。この創業者の情熱と試行錯誤によって生み出されたあんかけスパゲッティは、名古屋の食文化を代表する「名古屋めし」としての地位を確立しました。
  4. [極太麺の特徴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9nq7P8x3kiMOgi9FF5sl2I0lVuvKC-0Ws8KCLqlFWUQsHXEXpXuc6MrbJkcOZ5_FNRJt0USnwXe-cxjdlE3Dc-rAHffnXJj7lahCzNZOTyDKvR6LoA4362x2lQ1HFENrSfkK3hKNdAEMoZ7aKQBKZuNFDpPX4XNGY1pNnouDS_hvIZw==)
     > 特に、2.2mmのオリジナル極太麺はソースとの相性が抜群とされています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_スパゲッティハウスヨコイ錦店 -->

---

### BOUL'ANGE 名古屋タカシマヤゲートタワーモール店（名駅 / ブーランジェリー・★2.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 名古屋駅直結の好立地で、通勤・ランチ需要に応えるサンドや限定商品を充実。ベイクルーズグループ運営によるフランス製法を取り入れた高品質なパンと、多様なライフスタイルに寄り添う商品開発力は、業界注目のブーランジェリーだ。
- **insiderNote**: ベイクルーズグループが手掛けるブランドとして、アパレル事業で培ったライフスタイル提案力を飲食に活かしている。フードシェアリングサービス活用で社会貢献も意識しており、業界の注目株だ。
- **sources_used**:
  1. [名古屋駅直結の立地、通勤・ランチ需要に応えるサンドや限定商品の充実、ベイクルーズグループ運営、フランス製法を取り入れたパン、多様なライフスタイルに寄り添う商品開発力、フードシェアリングサービス活用による社会貢献意識](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHQvLzT5vwL2ooxKy8JsyxtCo571vUiEhl4ogmAUUTeUGEqGPGcfiUihXWy-OlAOpA--dA4lfLKkrMno5iDOMfoOGubmcJYkUMqBWjI0RYIMbIiaeSNVCz4Nm_-9mTIZQOziAIdhKRXz3f98Wn76_4DOmsnU-E=)
     > 名古屋駅直結というアクセスしやすい立地が特徴で、通勤・通学前やランチタイム、仕事帰りなど、幅広いシーンで気軽に立ち寄れる店舗を目指しています。同店限定商品として、ロール状に巻いて丸く成形された「Roll bun（ロール バン）」が6種類のフレーバーで、また、外は軽やかで中はねっとりとした食感が特徴の「チューイークッキー」が3種類のフレーバーで提供されています。オフィスワーカーのランチ需要に応えるた
  2. [名古屋駅直結の立地、オフィスワーカーのランチ需要に応えるサンドや限定商品の充実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGWIF2XmniSiH830cfZOS5YyvDQGoiHRiaTWcPxd_8GDg-SiL8d-toPCeYW_UrT2Teb9VZnWLvC-DNl40XaXTYfKsdMBAet-3V0-IjoSWb9SKUQzps9pdQg4khKcspp)
     > 名古屋駅直結のタカシマヤゲートタワーモールにオープン。オフィスワーカーのランチ需要に応えるため、ボリューム感のあるサンドや、同店限定の「Roll bun（ロール バン）」や「チューイークッキー」も提供されます。
  3. [名古屋駅直結の立地、オフィスワーカーのランチ需要に応えるサンドや限定商品の充実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFH4nVBGQ4w4YhGnldJQXskFItItb9HxxziTt2JOOIOgLyb0dQQlBVOudLmmKGNTwBIDMBwq7OaBP3qDQbZYZECKOUQ-WrvFohdKE-1u7RLQDslOtfZkAzEkUR5tc1mdi9UmCKKAwYzFw==)
     > 名古屋駅直結のタカシマヤゲートタワーモールにオープン。オフィスワーカーのランチ需要に応えるため、ボリューム感のあるサンドや、同店限定の「Roll bun（ロール バン）」や「チューイークッキー」も提供されます。
  4. [ベイクルーズグループ運営、多様なライフスタイルに寄り添う商品開発力](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGtfBjDOq2GwU02Lq2AKxO69yfYJu_ck0Aod6OPZwfoYsrc559fELab1sGVxDUV_FnXeFivqHIoMLJLhHkSCwbCQQSVLyWOmiA7ZO-d_Qwp5jzzkh1FqW30C-oagpF2ubfXDyHYSIM=)
     > 株式会社ベイクルーズ
  5. [ベイクルーズグループ運営、フランス製法を取り入れたパン](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzyOCVgw4p2H4SZNSOMYI8iLw49qZzbBNAdSmE4ZqsXCrStR7i7Y7O0ILiFwyFKbuO5h71mn4wFnIwcgn2KhqMp5FxhuDiRkaSWnMVJ-BXtUM2ASlS4F3edCT8wtrcB4DXAbcjni3h6OeVU-uHdlEa5g==)
     > 株式会社ベイクルーズ初のオリジナルブーランジェリーとして誕生し、パン作りの本場であるフランスの製法を取り入れていると紹介されています。
  6. [ベイクルーズグループ運営、フランス製法を取り入れたパン](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEyUWElQ21ivVCTwHIjG12MCQj0UWah_Q1unY-K1oW4bTAP_LsEQHt7zjsW36zGjqQNVvvI5BHQcF2u8oTESQhVh6_gjoyrxyHcQU_dc21ArPCNHAfrm_vJmImSiNMjkKCZ)
     > 株式会社ベイクルーズ初のオリジナルブーランジェリーとして誕生し、パン作りの本場であるフランスの製法を取り入れていると紹介されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_boul'ange名古屋タカシマヤゲートタワーモール店 -->

---

### 淡 如雲 (アワイ ジョウン)（名古屋市西区 / 肉割烹 (イノベーティブ)・★4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: ミシュラン1ツ星を獲得し、数ヶ月先まで予約困難な名古屋屈指の人気店。和の技術を駆使した独自の肉割烹は、食通を唸らせる唯一無二の存在として注目されています。
- **insiderNote**: 嵐山吉兆で研鑽を積んだ店主は、無添加・無化調、塩不使用で素材の力を引き出す独自の肉割烹を確立。和のエイジングや発酵技術を駆使し、茶の湯で締めくくる食体験は、業界内外から高い評価を得ています。
- **sources_used**:
  1. [ミシュラン1ツ星を獲得していること、数ヶ月先まで予約でいっぱいの人気店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEPVkB1672mMO-ZrffHs94cGhf4ftJ99KOLf9JwuQY7g4RBB0ZpI_0aA1ybxeuYilrtpaxXchtqY4gJbwzTO_qkiSge-68vvetakowC8JupHgEq8xEidm-_REIAsOtH9mZPr0RQv0FAHHY=)
     > 「タケマシュラン」では、ミシュラン1ツ星を獲得し、数ヶ月先まで予約でいっぱいの名古屋でも屈指の人気店として紹介されています。
  2. [肉割烹というスタイルで新たな風を吹き込んでいる今注目の気鋭店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHgptuX-eifHxCUGcwuKQovEU5GUU9xQ_NcWX7xr9xVL5YrJTN6QHJT_tZnnCoTa-zZFaYAHJt1exdbloAPYLd6R2ZkY-kDuMCqQrRHN6QP8FtZzL4QKxA66O3NtgO9xFBO0n77320LuLKw)
     > 「WEB大人の名古屋」では、「肉割烹というスタイルで新たな風を吹き込んでいる今注目の気鋭店」として、店主の経歴や料理へのこだわり、店舗の雰囲気などが詳しく紹介されています。
  3. [名古屋で予約困難な話題のお店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG1KvOFhdzEwAvXK_PDNIhWRxOPtSdtHOq8LSJ7RzxT1kPjHmchUDtCwQjX45_UnadWm_fKpr9Ee5G7VhUTFQfrzyHseW3DAzci6hngugsXG_DzN_qD4WGi_1iRmBFoeq-sf2U0l0Xhf-V2Oajzzns=)
     > 「芦屋セレブ女優今堀恵理オフィシャルブログ」でも、名古屋で予約困難な話題のお店として紹介され、コース内容や料理の感想が綴られています。
  4. [塩や胡椒を一切使わず、発酵や熟成といった和の技術を駆使して肉の旨味を最大限に引き出す独自のアプローチであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHgptuX-eifHxCUGcwuKQovEU5GUU9xQ_NcWX7xr9xVL5YrJTN6QHJT_tZnnCoTa-zZFaYAHJt1exdbloAPYLd6R2ZkY-kDuMCqQrRHN6QP8FtZzL4QKxA66O3NtgO9xFBO0n77320LuLKw)
     > 塩や胡椒を一切使わず、発酵や熟成といった和の技術を駆使して肉の旨味を最大限に引き出す独自のアプローチは、「オリジナリティがあるつかめそうでつかめない料理」と評されています。肉割烹でありながらフレンチの要素も感じさせる新ジャンルとも言われています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_淡如雲(アワイジョウン) -->

---

### 日本料理 旬彩（名古屋市中区 / 日本料理、懐石・会席料理・★5）

- **status**: INSUFFICIENT_EVIDENCE ⚪ INSUFFICIENT
- **confidence**: 0
- **editorReason**: (なし)

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_日本料理旬彩 -->

---

### 尾張山荘 くろぎ（名古屋市中村区 / 日本料理、割烹・★5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 東京の名店「くろぎ」オーナーシェフ黒木純氏が手掛ける新業態。名古屋駅前ながら古民家を移築した山荘のような空間で、京料理と愛知の食材を融合させた名古屋限定コースが楽しめる。特別な日に相応しい一軒。
- **insiderNote**: 本店オーナー黒木純氏はミシュラン星獲得、アイアンシェフで注目。料理長由水氏は「くろぎ上海」総料理長として高い評価を得た実力者。
- **sources_used**:
  1. [東京の名店「くろぎ」の新業態であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE13M08Jo1G2BvIpoVrFasGnquqLbPZHGkYgHuVY85TjMf4qGFviBOb8VNUadIY9wX6k-LEZUahnETb_Zjnbkw8_yBAlpa4l_Vm7xYriNA1cm5N71sOMh74kTYItO_pp-QYc4S130dycynfc6jToNvMqs2NF8_u)
     > 東京の名店「くろぎ」の新業態として、名古屋駅前に「尾張山荘 くろぎ」がオープン。
  2. [東京の名店「くろぎ」の新業態であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF6tL5FLt7pNom1S5TDBdHJku7gBI1u_8pTxjMUsTkwzyCo5_RCc70RZ4_fk0hgj6USyAwUo3JyopCs00bd2OTIbQUyiBUlAjesSXS4uxM0TOJxqPEmMrnEDieE_N4XuUqyeNTrSRHIae5aOfI1ShBV6mp_WgqcMgEJ4jNFr7r2Y1nrQQ==)
     > 東京の名店「くろぎ」の新業態「尾張山荘 くろぎ」が名古屋駅前にオープン！
  3. [東京の名店「くろぎ」のオーナーシェフ黒木純氏が手掛ける新業態であること、古民家を移築した山荘のような空間であること、京料理と愛知の食材を融合させた名古屋限定コースが提供されること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGYPNpk_izryZtkzGvINeGevLiy8uT-r6IEYjCIXNyud2EHmQD5eCqAJ1x0qPQ7CVSlzGEAZB-tlN93tJo4EmyQ5GfIC-3ZSx0BMiPvhkZOJEXhsm0g0KHmpWSqwWbCmcAkFiRXL5Z4T9K2MXcdU-dRhCqJAUg=)
     > 東京の日本料理店「くろぎ」のオーナーシェフ黒木純氏が手掛ける新業態「尾張山荘 くろぎ」が、2026年7月24日(金)に名古屋駅前に開業します。
名古屋駅前という立地でありながら、築100年以上の古民家から移築した建材をふんだんに用いた店内は、山荘のような落ち着いた空間を演出。
料理は、京料理の趣と愛知県の食材を融合させた名古屋限定のコースが提供されます。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_尾張山荘くろぎ -->

---

### 焼肉 飛騨牛一頭家 馬喰一代 名古屋WEST（名古屋市中村区名駅 / 焼肉、飛騨牛・★4.3）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 精肉業60年の歴史を持つ「馬喰一代」は、A5ランクを超える「最とび牛」を一頭買いし、希少部位を手頃に提供。トレーサビリティも公開し、品質への徹底したこだわりが光る。和モダンな個室は接待にも最適だ。
- **insiderNote**: 枝肉高額購買日本一の実績と、900頭に1頭の特別感を追求する料理人のこだわりが、唯一無二の飛騨牛体験を約束する。
- **sources_used**:
  1. [精肉業60年の歴史](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFcJYr8NNCWEDHeI-niudQnJkpjBx3JKz1UuOcc_d7BIiC41hBswIT1JUxc8uHqi8PuJ9pFp0NdjGM8_hyhUJDyx2bgb5ucRSkFPe8c-zsVzNdYMlym9FMS6ziJPK5AJJrKk1IJFhhiXC3W_cuNJkuFc_Y=)
     > 岐阜で精肉業を始めて六十年、地元の誇りである飛騨牛への情熱を胸に、百年続く店を目指すという志のもと、「馬喰一代」は始まりました。
  2. [A5ランクを超える「最とび牛」を一頭買い](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGHjGewghytnM8o5xAoLikTfcwFuwZ24dkEZmST-1RppVXqez5sE9AKqcEEBlp7NMHlARUYoQ9vyB5LWi_oxZaDN9Plr_5IEYdtqpAtVu5L1rLILr2wSdc0NU1O408=)
     > A5ランクの中でもさらに最高ランクの「最とび牛」の提供にこだわり、一頭買いを行っています。
  3. [A5ランクを超える「最とび牛」を一頭買い](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG6NhqtHQTFzdU__iCg07n1Yu4kSveEA1SMyZkb0JyT4CrXbArsxbD42TU0-iUwNZyBQWpUpc7pPgCguNYMAsJ-7s6d4kDw1NuI2TiSYgMPeHwMDeimBWYz6bKHb1wKm6JUQgAv6g==)
     > A5ランクの中でもさらに最高ランクの「最とび牛」の提供にこだわり、一頭買いを行っています。
  4. [トレーサビリティの公開](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE-7uMUfIzjseIEGujJz--HYbIQCbPqZqiiFpuY1HdUnN0nT8eLJ7guyoHyr4O4sFM7actxce7YImfxzrDUc82YxB4dFbTKLnhh6ooFCm9wjyVNHyEYU9V-fF9omdz6gZs=)
     > 牛肉のトレーサビリティにも力を入れており、セリ購入リストを公開し、個体識別番号から牛の出生地や育成者を確認できるようにしています。
  5. [トレーサビリティの公開](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEX-SyUuuxCw1xqxzuWQfxFnFehoPdmNy6utMS4Vz1eT74Vs4v6j0zSyv326TfBFEtB4cnmvBWcfkF4oL7K4Ii1pNY3GSJ_MnPsmU7tkeSEW6PmjZVIl7Vu5w==)
     > 牛肉のトレーサビリティにも力を入れており、セリ購入リストを公開し、個体識別番号から牛の出生地や育成者を確認できるようにしています。
  6. [和モダンな個室が接待に最適](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGCNJGY1JeyBAyD-OWkx6uJqgQoYlWaDmhb0IBuvLYV3eSVUlCD3TBQ3CFSI-a48wMVZno698p6G4RNw-lf98E5n5k2mMeVbKmbgyzMdRoG9iZyTNGwQsQGzuvP)
     > 店内は和モダンで洗練された空間で、個室も多く備えられており、接待などにも利用されています。
  7. [和モダンな個室が接待に最適](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQETls26IQ7yFkwhO2Asmp1kV8fMKHtfdFV6RC3CAPYc7cAaorGr3mvnIqGFUILAErlNI5VbPlYcHpyrXwb_BYn25DuV2-Qr_1IwyoLNFeQ_fETWe7h46hGlGtZD5p_Kr7q5eZEi4CY=)
     > 店内は和モダンで洗練された空間で、個室も多く備えられており、接待などにも利用されています。
  8. [枝肉高額購買日本一の実績](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFcJYr8NNCWEDHeI-niudQnJkpjBx3JKz1UuOcc_d7BIiC41hBswIT1JUxc8uHqi8PuJ9pFp0NdjGM8_hyhUJDyx2bgb5ucRSkFPe8c-zsVzNdYMlym9FMS6ziJPK5AJJrKk1IJFhhiXC3W_cuNJkuFc_Y=)
     > 枝肉高額購買日本一である「馬喰一代」として、その美味しさをより広く、より丁寧に届けることを使命としています。
  9. [900頭に1頭の特別感を追求する料理人のこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGCNJGY1JeyBAyD-OWkx6uJqgQoYlWaDmhb0IBuvLYV3eSVUlCD3TBQ3CFSI-a48wMVZno698p6G4RNw-lf98E5n5k2mMeVbKmbgyzMdRoG9iZyTNGwQsQGzuvP)
     > 深尾氏は、900頭の中で1頭しかいないと言われる、同店でしか味わえない特別感のあるお肉にこだわっていると述べています。
  10. [900頭に1頭の特別感を追求する料理人のこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQETls26IQ7yFkwhO2Asmp1kV8fMKHtfdFV6RC3CAPYc7cAaorGr3mvnIqGFUILAErlNI5VbPlYcHpyrXwb_BYn25DuV2-Qr_1IwyoLNFeQ_fETWe7h46hGlGtZD5p_Kr7q5eZEi4CY=)
     > 深尾氏は、900頭の中で1頭しかいないと言われる、同店でしか味わえない特別感のあるお肉にこだわっていると述べています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_焼肉飛騨牛一頭家馬喰一代名古屋west -->

---

### 旬魚旬菜 庵（名古屋市中村区 / 居酒屋、魚介料理・海鮮料理・★3.4）

- **status**: INSUFFICIENT_EVIDENCE ⚪ INSUFFICIENT
- **confidence**: 0
- **editorReason**: (なし)
- **warnings**: 検索グラウンディングで関連URLが見つからなかった

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_旬魚旬菜庵 -->

---

### 焼肉やっちゃん　名駅西口店（名古屋（名古屋駅/西区/中村区） / 焼肉・ホルモン・★4.9）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 店主厳選の国産牛を目の前で厚切りカットする板前焼肉スタイルが魅力。関西で百名店に選出された名店の味を、ライブ感と共に堪能できる。
- **insiderNote**: 店主の目利きによる厳選肉と、目の前で厚切りカットする板前焼肉スタイルは、肉への深い見識と提供へのこだわりを示す。百名店選出の実績も評価が高い。
- **sources_used**:
  1. [店主の目利きによる国産牛厳選とチルド仕入れのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEx7bCxIJdAmOV_zIoyvuWksjD1L-eZaE8l5q-DGlZk8ncSw8isGoPTbNykz1PtwTD6rTAA2lKQWD3MaYfAjh2NIAPmilzBZr7mzF6bNBjn-IvFBkyuVX02)
     > 仕入れに一切妥協せず、その日の最も良質な国産牛を店主の目利きで厳選していることがこだわりとして挙げられています。特に、タンとハラミは上質な肉をチルドで仕入れることで、肉本来の旨味と柔らかさを保ち、鮮度抜群の美味しさを提供しているとされています。
  2. [店主の目利きによる国産牛厳選とチルド仕入れのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQErcspatYYzgmvo5tyBLbFXzVcZdvfEC-kwPcq9xSKnl_DHV6MzCgy33ZcM1AaV0NrfDOtQ0rQvNj4MaHnD1-bR5c33QWnXfaP4unEvppcAPsULBb2fox5qzoF_Bb46beIBIVpEJLVf5HjA92wCCZ4NH6EC8k8=)
     > 「焼肉やっちゃん」グループ全体として、仕入れに一切妥協せず、その日の最も良質な国産牛を店主の目利きで厳選していることがこだわりとして挙げられています。特に、タンとハラミは上質な肉をチルドで仕入れることで、肉本来の旨味と柔らかさを保ち、鮮度抜群の美味しさを提供しているとされています。
  3. [店主の目利きによる国産牛厳選とチルド仕入れのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcn-6gUesdvKlZBIDZUn9k0VrchlEzGMd5Ax75SwIZ3YDThhiRNbbPOhf7mHNJSqA12JNpmk0WQPOj_fuO21EjgLj7oDeaQNhW3wtXognyZrPqiKV--6nM0Isa8U-b)
     > 「焼肉やっちゃん」グループ全体として、仕入れに一切妥協せず、その日の最も良質な国産牛を店主の目利きで厳選していることがこだわりとして挙げられています。特に、タンとハラミは上質な肉をチルドで仕入れることで、肉本来の旨味と柔らかさを保ち、鮮度抜群の美味しさを提供しているとされています。
  4. [目の前で厚切り肉をカットする板前焼肉スタイルとライブ感](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEx7bCxIJdAmOV_zIoyvuWksjD1L-eZaE8l5q-DGlZk8ncSw8isGoPTbNykz1PtwTD6rTAA2lKQWD3MaYfAjh2NIAPmilzBZr7mzF6bNBjn-IvFBkyuVX02)
     > お客様の目の前で肉をぶ厚くカットするカウンタースタイルの焼肉店です。この「板前焼肉」スタイルは、圧倒的なライブ感を味わえるのが魅力とされています。
  5. [目の前で厚切り肉をカットする板前焼肉スタイルとライブ感](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQErcspatYYzgmvo5tyBLbFXzVcZdvfEC-kwPcq9xSKnl_DHV6MzCgy33ZcM1AaV0NrfDOtQ0rQvNj4MaHnD1-bR5c33QWnXfaP4unEvppcAPsULBb2fox5qzoF_Bb46beIBIVpEJLVf5HjA92wCCZ4NH6EC8k8=)
     > お客様の目の前で肉をぶ厚くカットするカウンタースタイルの焼肉店です。この「板前焼肉」スタイルは、圧倒的なライブ感を味わえるのが魅力とされています。
  6. [目の前で厚切り肉をカットする板前焼肉スタイルとライブ感](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcn-6gUesdvKlZBIDZUn9k0VrchlEzGMd5Ax75SwIZ3YDThhiRNbbPOhf7mHNJSqA12JNpmk0WQPOj_fuO21EjgLj7oDeaQNhW3wtXognyZrPqiKV--6nM0Isa8U-b)
     > お客様の目の前で肉をぶ厚くカットするカウンタースタイルの焼肉店です。この「板前焼肉」スタイルは、圧倒的なライブ感を味わえるのが魅力とされています。
  7. [関西で百名店に選出され、芸能人にも愛されている名店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEx7bCxIJdAmOV_zIoyvuWksjD1L-eZaE8l5q-DGlZk8ncSw8isGoPTbNykz1PtwTD6rTAA2lKQWD3MaYfAjh2NIAPmilzBZr7mzF6bNBjn-IvFBkyuVX02)
     > 「焼肉やっちゃん」は、関西で「百名店」に選出され、数多くの芸能人やスポーツ選手にも愛されている焼肉の名店と紹介されています。
  8. [関西で百名店に選出され、芸能人にも愛されている名店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQErcspatYYzgmvo5tyBLbFXzVcZdvfEC-kwPcq9xSKnl_DHV6MzCgy33ZcM1AaV0NrfDOtQ0rQvNj4MaHnD1-bR5c33QWnXfaP4unEvppcAPsULBb2fox5qzoF_Bb46beIBIVpEJLVf5HjA92wCCZ4NH6EC8k8=)
     > 「焼肉やっちゃん」は、関西で「百名店」に選出され、数多くの芸能人やスポーツ選手にも愛されている焼肉の名店と紹介されています。
  9. [関西で百名店に選出され、芸能人にも愛されている名店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcn-6gUesdvKlZBIDZUn9k0VrchlEzGMd5Ax75SwIZ3YDThhiRNbbPOhf7mHNJSqA12JNpmk0WQPOj_fuO21EjgLj7oDeaQNhW3wtXognyZrPqiKV--6nM0Isa8U-b)
     > 「焼肉やっちゃん」は、関西で「百名店」に選出され、数多くの芸能人やスポーツ選手にも愛されている焼肉の名店と紹介されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J004559178 -->

---

### 赤酢寿司と炉端　個室居酒屋　魚炉裏　栄店（栄 / 居酒屋・★4.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 本格的な赤酢寿司と職人技の炉端焼きを、全席個室の空間でリーズナブルに提供。深夜まで営業し、多様なニーズに応える点が強み。
- **insiderNote**: 本格的な江戸前寿司をリーズナブルに提供し、職人技の炉端焼きも二枚看板。全席個室で深夜まで営業しており、幅広い客層に対応できる点が強み。
- **sources_used**:
  1. [本格的な赤酢寿司と職人技の炉端焼きをリーズナブルに提供していることを裏付ける。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGxjgaHUL-qag5qgGjqJgrZQjUt03PJDEiHYYv8KwDT5sdhb54khPIF0vOYmdny4duvMSL-OZJtrPiB-nazHoHAOmCM4I3UQW9t6r06iATDKW-P)
     > 「赤酢寿司と炉端 個室居酒屋 魚炉裏 栄店」では、本格的な江戸前寿司をリーズナブルな価格で提供することにこだわっています。また、炉端焼きにおいては、職人が焼き方一つで大きく左右される味を追求し、食材の特徴を捉えて最も美味しい状態を提供することに注力しています。
  2. [本格的な赤酢寿司と職人技の炉端焼きをリーズナブルに提供していることを裏付ける。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8RED7IQEz1y_k2sWn7zax3tm7PJEGY0eEQRbo5FFf7c4kg3oV7oyb5Owe7j7mA8mmyBNB59EyiEXPgsV-0N7flWNYmmj1aeriZ0pf3RWSN266VuMGK36s)
     > 「赤酢寿司と炉端 個室居酒屋 魚炉裏 栄店」では、本格的な江戸前寿司をリーズナブルな価格で提供することにこだわっています。また、炉端焼きにおいては、職人が焼き方一つで大きく左右される味を追求し、食材の特徴を捉えて最も美味しい状態を提供することに注力しています。
  3. [全席個室の空間で料理を提供していることを裏付ける。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHbd0lbrQBXO-sv_OKrKw1iEACScHeplCji2K8mujEouaIGdf158HcKIUiB6H6UCVyANm5mBz-wMnDpriRnDt3msQ8AKz4XX9eP_YDOjNIMBPxhIYxqkfHdl0ewc_2yqMAMGRWv1Ohg2iyyRtPCCES_fUIaXFYE7N4TSUgCHQ==)
     > 全室個室で赤酢寿司と炉端焼きが楽しめる居酒屋としてレビューされています。
  4. [深夜まで営業していることを裏付ける。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGxjgaHUL-qag5qgGjqJgrZQjUt03PJDEiHYYv8KwDT5sdhb54khPIF0vOYmdny4duvMSL-OZJtrPiB-nazHoHAOmCM4I3UQW9t6r06iATDKW-P)
     > 深夜まで営業しているため、仕事帰りなど遅い時間でも利用しやすい店舗です。
  5. [深夜まで営業していることを裏付ける。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8RED7IQEz1y_k2sWn7zax3tm7PJEGY0eEQRbo5FFf7c4kg3oV7oyb5Owe7j7mA8mmyBNB59EyiEXPgsV-0N7flWNYmmj1aeriZ0pf3RWSN266VuMGK36s)
     > 深夜まで営業しているため、仕事帰りなど遅い時間でも利用しやすい店舗です。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J004445406 -->

---

### BULMARO（栄(ミナミ)/矢場町/大須/上前津 / バー・カクテル・★5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 複数の主要グルメメディアに掲載され、NAGOYA BITESの「名古屋のバー・ワインバー10選」や「一人飲み完全ガイド」にも選出されるなど、業界からの注目度が高い一軒。フレンドリーな接客で、飲み会や誕生日パーティー、2軒目利用など幅広いシーンで支持されています。
- **insiderNote**: NAGOYA BITESの「バー・ワインバー10選」や「一人飲み完全ガイド」に選出されるなど、地元メディアからの評価も高く、業界内での注目度も伺えます。
- **sources_used**:
  1. [BULMAROのスタッフがフレンドリーであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFYdPk85dRofS5JQSLTvSjxLzQeDam9qIME0iGj91ctRxcjx9k9-Yz1krTogUnDCAQMmWAIZjwQhXJNxZMyySyfN70zxKRUaehdudUE36KHAmyq0AdXU0nhicUz3Rnf2kjGsfzERA==)
     > スタッフはフレンドリーで、利用客は楽しい時間を過ごせると評価しています。
  2. [BULMAROが飲み会や誕生日パーティー、2軒目利用など幅広いシーンで利用されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFYdPk85dRofS5JQSLTvSjxLzQeDam9qIME0iGj91ctRxcjx9k9-Yz1krTogUnDCAQMmWAIZjwQhXJNxZMyySyfN70zxKRUaehdudUE36KHAmyq0AdXU0nhicUz3Rnf2kjGsfzERA==)
     > 飲み会や誕生日パーティーにも利用でき、ペルー料理も提供されています。また、2軒目の利用にもおすすめされています。
- **warnings**: 4件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J001286582 -->

---

### 串カツ田中 名古屋駅西口店（名古屋（名古屋駅/西区/中村区） / 居酒屋・★4.7）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 串カツ田中 名古屋駅西口店は、「チンチロリンハイボール」や客が参加できる「自分で作るポテトサラダ」など、ユニークな提供スタイルが特徴。お子様連れも歓迎し、家族層からビジネス層まで幅広い客層を取り込む戦略的な店舗運営が評価されます。
- **insiderNote**: 名古屋駅西口店は、愛知県内初の直営店として地域展開の拠点。チェーン全体の「田中家の味」を軸に、客参加型メニューや家族向けサービスで幅広い層にアプローチする戦略が伺えます。
- **sources_used**:
  1. [チンチロリンハイボール、客参加型メニュー、お子様連れ歓迎](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHBUq6ZRzmXndqK0djBi1bRkv8Zs2601XQ_jNWPIFk0kWkRwfJ60-CGsAXDEhvF11al3pDEFBKT-vivmk4oUw7ojQZJpfFE3EXyirEgP0gCNBFUZEsuoBlxj5o5y2zpCe9L9xZwVXyJlwVJu32nFivwJp8=)
     > チンチロリンハイボール、自分で作るポテトサラダ、自分で焼く卵焼き、お子様連れも歓迎
  2. [チンチロリンハイボール、客参加型メニュー、お子様連れ歓迎、幅広い客層を取り込む戦略的な店舗運営](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF0E4ufyZ7sgnwhvpa1gV-sM2xvriVk4_psw-C3u1vCyQ6D6Zoug6U-l0yIZdVLIX4KXNoY0r4Ww193yRG2PPNjHdnXGKQGLJPCS6-AxSOOeZHbtgWiu5cRKJam8ZkuDS-pjA==)
     > チンチロリンハイボール、自分で作るポテトサラダ、自分で焼く卵焼き、お子様連れも歓迎、飲みパス、超絶ハッピーアワー
  3. [チンチロリンハイボール、客参加型メニュー、お子様連れ歓迎](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHyU0TwxzTEk0F4F09d1SajXBuOD-5lwAa__BZRDW2bseBmbHCWo53PnRABs-kGmkLU2fDx2wgK_zF1oMWOTfQ2UjzlwHKmlkgQXxrSRrm9kFFFU88D9NK5IFDzGdv2GolQLhc6Ez6CHcRKgN1UUoM=)
     > チンチロリンハイボール、自分で作るポテトサラダ、自分で焼く卵焼き、お子様連れも歓迎
  4. [愛知県内初の直営店として地域展開の拠点](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFKrVPdqWwzlsaRpJnlWf86VU34EGPxG1cn4Ei_PbdA7P2ZtIucNyTecu_sGVfQHp0NZEaRZpdwA4c71X-7G_qGGfMwrzXm4kAB-Jg0MlEk_3jUckzgbsAiVel0A4_sXg==)
     > 愛知県内初の直営店として2017年4月1日にオープンし、愛知県周辺での出店を進める拠点となることが期待されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J001189969 -->

---

### 個室炭火焼肉 伏見屋飛騨牛 別邸 名駅3丁目（名古屋（名古屋駅/西区/中村区） / 焼肉・ホルモン・★4.9）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 東海地区のブランド和牛「飛騨牛」に特化し、店長兼料理長が肉のカットからタレまでこだわり抜く。完全個室で多様なシーンに対応し、食べログマガジン等で高評価を得る実力派。系列店展開も注目される。
- **insiderNote**: 株式会社AJドリームクリエイトが手掛ける肉専門ブランドの一つ。飛騨牛に特化し、完全個室で幅広い客層を狙う戦略が成功。系列店の展開も順調で、ブランド力強化が伺える。
- **sources_used**:
  1. [飛騨牛へのこだわり、店長兼料理長の専門性、運営会社のブランド展開、食べログマガジンでの高評価、系列店展開の背景](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH61ZZ38u8WlhlZjiIo_wow1TUiAQ6suGZpoSNjsIESZQwWSRkgiCknwnOLe2h55ndSKkYAu2znsCsyJbA1ydwzqp0zGlPVhVxL-0MRhT1KT74r7PEGXpK-4BabHV-XRmfXfrCqwjc=)
     > 「個室炭火焼肉 伏見屋飛騨牛 別邸 名駅3丁目」は、東海地区のブランド和牛である「飛騨牛」の美味しさを地元の人々に知ってもらうことをコンセプトに掲げています。店長兼料理長の吉本康雄氏は、飛騨牛の「脂の甘み」と、融点が低く口溶けが良く後味がさっぱりとする「オレイン酸」の含有量の多さを特徴として挙げています。肉のカット方法、オリジナルのタレ、そして白米に至るまで、「飛騨牛を最高の状態で食べてもらうこと
  2. [運営会社のブランド展開、系列店展開](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHx9otnw0mkafXSrouwT223oxxAdUSYQDnMudHIzUEWL6783DsHRROtaosMkW48Ue2uo6RoyDicxKxNAA09716s-XmhQoyChChBSJzFuNhHm9JlidouZHg06saQUIr-botUU-BW6F9tgE_S)
     > 運営会社である株式会社AJドリームクリエイトは、「前沢牛舎 伏見屋」や「ニクバルダカラ」など、肉を主役としたブランドを展開しています。同系列の「飛騨牛焼肉 伏見屋本店」が2026年4月にオープンしたことも報じられており、ブランドの展開が注目されています。
  3. [完全個室での提供、メディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGORAPWjQJp_c17ZAKG1OMD1hDvIbNni4V5ItS6OA5yuym_TOuvRJsHkumbWE5AjlziIajYR8i9j5lL9aJAoaMJuD56ZmNeobIxkJcmKvlnJeHEXDKS9VZ3ew1DrQkejxkSAavMIKhy5MY51mlXsqiYZmjvzHWK_0h35nmPcsgBtMLZOQ==)
     > Lemon8アプリでは、2023年1月と5月に訪問記事が投稿されており、個室の利用しやすさや特定のメニューが推奨されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J001201866 -->

---
