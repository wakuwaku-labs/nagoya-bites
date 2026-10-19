# editorReason 自動生成 draft レビュー（ISSUE-045）

> **生成**: 2026-10-19T22:18:17.247Z
> **対象**: 上位 50 候補 / 生成 44 件
> **結果**: OK 41 / INSUFFICIENT 3 / WARN 0 / ERR 6
> **自動マージ候補** (confidence ≥ 0.85): 15 件
> **人手レビュー要**: 26 件

## レビュー手順

1. 各 draft の editorReason / sources_used を確認
2. 採用する draft は `[approved]` 行を追加（または `[reject]`）
3. `node scripts/approve_editorreason_drafts.js` を実行 → editor_picks.json に反映
4. `node build.js` → `git push origin main` で公開

## draft 一覧

### ステーキハウス キッチンリボン（名古屋市瑞穂区 / ステーキ、洋食・★4.5）

- **status**: INSUFFICIENT_EVIDENCE ⚪ INSUFFICIENT
- **confidence**: 0.6
- **editorReason**: GOETHEで秋元康氏が絶賛する名古屋の老舗ステーキハウス。オーナーシェフの温かい人柄と、ステーキ皿やナイフに至るまで徹底したこだわりが、唯一無二の体験を創出。おかわり自由のガーリックライスも嬉しい。
- **insiderNote**: 半世紀にわたり愛される老舗。最高級A5等級黒毛和牛や松阪牛を熟練の技で焼き上げ、保温性の高い特注ステーキ皿とシャトーラギオールで提供。きめ細やかなおもてなしも魅力。
- **warnings**: 12件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_ステーキハウスキッチンリボン -->

---

### La Floraison de TAKEUCHI（名古屋市東区 / フランス料理・★4.4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 有名店で研鑽を積んだシェフが独立し、ミシュラン1つ星やゴ・エ・ミヨ7年連続掲載など、数々の栄誉に輝く実力派。高品質で普段使いできるフレンチを提供し、名古屋の食業界に新風を吹き込んでいます。
- **insiderNote**: 有名店で研鑽を積んだシェフは、ミシュラン1つ星やゴ・エ・ミヨ7年連続掲載など、数々の栄誉に輝く実力派。その確かな技術と情熱は、業界の「最強のパスポート」と評されます。
- **sources_used**:
  1. [シェフの有名店での研鑽と独立の経歴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEGEw0_K7Tz6f3XVsmENKunsFFieRKXDiZyyFxYRcMUuCfl9Uq8lms_UhbybZgchZa521z2KqWHbDyFFpQ_OvqLs3dkTnDx29IodtZeN5ng9TeWb86Vt06FNNALREO9IITr_Ktu)
     > フランスの「ラ・ピラミッド」を皮切りに、東京恵比寿の「タイユヴァン・ロブション」、名古屋の「ミクニ ナゴヤ」や「ラ グランターブル ドゥ キタムラ」といった国内外の名だたる有名店で研鑽を積み、名古屋の「グランファミーユ・シェ松尾」で5年間料理長を務めた後、2013年1月に独立オープン
  2. [ミシュラン1つ星、ゴ・エ・ミヨ7年連続掲載などの受賞歴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEKnLKE1gmliVp67G7dpHylSurduMhBQ04HhBnQXwHS0l4Yy39yVvi3YkzNPx-1frSurqHwe3INbN9XqQdbID3qny4M1troQAJCTkNm0M4sFQsEgNNbfkr5Pei5NxMzCWPtCqWrkdA=)
     > ミシュランガイドで1つ星を獲得した経歴があり、さらに「ゴ・エ・ミヨ」に7年連続（2018年〜）で掲載されています。また、食べログでは「百名店」（2021年・2023年）に選出され、「The Tabelog Award Bronze」にも2017年から2025年まで連続で選出されるなど、数々の栄誉に輝いています。
  3. [ミシュラン1つ星、ゴ・エ・ミヨ7年連続掲載などの受賞歴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH68EhJDNGS3naDy7u3A0oShlbjrRouCafNatIMG7qGFy8g0M9Txc9ANjKRTslc7FRxGG2fKCestQaMOp2_LUO6_f2fXyg14jzThyaLhEV47sET3GZqrQKrzrYjBZljNDYO)
     > ミシュランガイドで1つ星を獲得した経歴があり、さらに「ゴ・エ・ミヨ」に7年連続（2018年〜）で掲載されています。また、食べログでは「百名店」（2021年・2023年）に選出され、「The Tabelog Award Bronze」にも2017年から2025年まで連続で選出されるなど、数々の栄誉に輝いています。
  4. [高品質でお手頃価格のプチ・レストランというコンセプト](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEGEw0_K7Tz6f3XVsmENKunsFFieRKXDiZyyFxYRcMUuCfl9Uq8lms_UhbybZgchZa521z2KqWHbDyFFpQ_OvqLs3dkTnDx29IodtZeN5ng9TeWb86Vt06FNNALREO9IITr_Ktu)
     > 「高品質でお手頃価格のプチ・レストラン」をコンセプトに掲げ、グランメゾンほど敷居が高くなく、グルメな客層が普段使いできる店を目指しています。
  5. [名古屋の食業界に新風を吹き込んでいるという評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEKnLKE1gmliVp67G7dpHylSurduMhBQ04HhBnQXwHS0l4Yy39yVvi3YkzNPx-1frSurqHwe3INbN9XqQdbID3qny4M1troQAJCTkNm0M4sFQsEgNNbfkr5Pei5NxMzCWPtCqWrkdA=)
     > 名古屋フレンチに新たな風を吹き込んでいる
  6. [名古屋の食業界に新風を吹き込んでいるという評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH68EhJDNGS3naDy7u3A0oShlbjrRouCafNatIMG7qGFy8g0M9Txc9ANjKRTslc7FRxGG2fKCestQaMOp2_LUO6_f2fXyg14jzThyaLhEV47sET3GZqrQKrzrYjBZljNDYO)
     > 名古屋フレンチに新たな風を吹き込んでいる
  7. [シェフの経験が飲食業界における「最強のパスポート」と評されること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF9WGItlZkTntImCL_hPs9105W1TAUZooFgAOAJWKMXuPNThwYkqozbLi6gI9YO0WqLqIGxLIT1DpDO6gJSbPCbrz2DLUSN48YvLICt0K7Q6GGjeO1bGfYKwAgX)
     > その経験は飲食業界における「最強のパスポート」になるとも言われています。
- **warnings**: 3件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_lafloraisondetakeuchi -->

---

### つけ麺 燈 tou（名古屋市中区 / つけ麺、ラーメン・★）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 割烹を思わせる洗練された空間で、自家製麺と豚骨魚介ベースの濃厚スープ、締めには割りスープや追いチーズリゾットまで楽しめる。名古屋の地元メディアでも注目される、食体験全体にこだわったつけ麺専門店です。
- **insiderNote**: 名古屋のラーメン店を多数プロデュースする株式会社エフリードが手掛けており、麺やスープの素材、空間演出、食体験全体へのこだわりから、高い専門性と顧客満足への追求がうかがえます。
- **sources_used**:
  1. [割烹を思わせる空間演出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH6j3GtIQmxPClmScjQpsBeqiVRAx91E6Q2k1Nal4RbdVF5lT7vkhhg0Y2ZlDyUU3QexX8HU1Qh9-aduOYqBUPoRItKintzuzrZOfL93t79DPG8B02vXUvZ_B9TRqXS)
     > 割烹のような空間で濃厚つけ麺を楽しめる
  2. [自家製麺へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH6j3GtIQmxPClmScjQpsBeqiVRAx91E6Q2k1Nal4RbdVF5lT7vkhhg0Y2ZlDyUU3QexX8HU1Qh9-aduOYqBUPoRItKintzuzrZOfL93t79DPG8B02vXUvZ_B9TRqXS)
     > 麺には岩手県産・滋賀県産の小麦に、もち小麦「もち姫」と国産全粒粉を配合し、もちもちとした弾力、噛むほどに広がる小麦の香り、のど越しまでバランスよく仕上げた自家製麺を使用しています。
  3. [濃厚スープへのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH6j3GtIQmxPClmScjQpsBeqiVRAx91E6Q2k1Nal4RbdVF5lT7vkhhg0Y2ZlDyUU3QexX8HU1Qh9-aduOYqBUPoRItKintzuzrZOfL93t79DPG8B02vXUvZ_B9TRqXS)
     > スープは豚骨と魚介の旨みをじっくり炊き上げた濃厚なもので、ほのかな柚子の香りが後味を軽くし、小麦の風味を引き立てるように工夫されています。
  4. [地元メディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH6j3GtIQmxPClmScjQpsBeqiVRAx91E6Q2k1Nal4RbdVF5lT7vkhhg0Y2ZlDyUU3QexX8HU1Qh9-aduOYqBUPoRItKintzuzrZOfL93t79DPG8B02vXUvZ_B9TRqXS)
     > 「名古屋情報通」では、選べる濃厚スープのつけめん専門店としてオープンを報じました。
  5. [地元メディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzEW_Enhy8xOv8T4441xNdhFA60xltINf2C7WxDPbM_ls7vhLzPrXmuzjW0utJx4_fJMeNr3cf7MIzsFLUWP4gt64MWViM6MzSbr2YI6Dv1GaVWzmA9ZybkQ8=)
     > 「Dellows News」や「食べトピ」、「ベストカレンダー」も同様に開店情報を掲載しています。
- **warnings**: 4件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_つけ麺燈tou -->

---

### すし昇（名古屋市中区丸の内 / 寿司・★4.8）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: ミシュランプレート獲得の名古屋を代表する予約困難店。名店での経験と和食の素養を活かし、魚アレルギーを機に肉寿司を導入。魚と肉でシャリを使い分ける独創的なコースと、和洋折衷の食材の組み合わせで寿司の新たな可能性を切り開く。大将のパフォーマンスも魅力。
- **insiderNote**: 名店「寿司 日向」で経験を積んだ店主は、ミシュランプレート獲得の名古屋を代表する鮨職人。魚アレルギーを機に肉寿司を導入し、魚と肉でシャリを使い分けるなど、確かな技術と柔軟な発想で寿司の新たな可能性を切り開く姿勢は業界内でも高く評価されている。
- **sources_used**:
  1. [店主の経歴、ミシュランプレート獲得、予約困難店であること、肉寿司の導入とシャリの使い分け、独創的な食材の組み合わせ、パフォーマンスの評価、寿司の新たな可能性を切り開く姿勢、業界内での評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHaUCHBfgzETgtr6HoNWwUkN96wV1rZhhOD92t8qiQ6VoHGDIbiGdz1KuKbb066NclY4cQl1ME4KEbtf5pSWlywd89CxNMtiIYXRyRV_CLEdW4v9PegA3qIS47MpG9p)
     > 店主の伊藤昇平氏は、かつて名店「寿司 日向」の3代目店長として活躍し、30歳で独立しました。「すし昇」はミシュランプレートを獲得しており、「名古屋の鮨名店の一つで予約困難店」、「今や名古屋を代表する鮨屋」、「ミシュランが認めた本格的な寿司店」と評されています。2020年3月の移転後、店主が魚アレルギーになったことをきっかけに、肉を織り交ぜたコースへと提供スタイルが変化しました。肉寿司には魚用のシャ
  2. [ミシュランプレート獲得、予約困難店であること、和食経験と独創性、肉と魚でシャリを使い分ける特徴、パフォーマンスの評価、寿司の新たな可能性を切り開く姿勢、業界内での評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFtN1744i0l1c6fRFGIDehxqaMCMuttZ_nR9eyr9WNBhyueCK_qcxLp9FkTY5GPkDR1GLN9RDTl_2pDlDRC1rJe0rtGBq5YzZwqKHN_bkh1uhe5HsKkMb0Q1-NsKGhz19qu2FEqnQ==)
     > ミシュランプレートを獲得しており、名古屋の鮨名店の一つとして予約困難店としても知られています。和食職人としての経験と寿司職人としての技術、そして持ち前の料理人としてのセンスを融合させ、独創的な寿司や一品料理を生み出しています。正統派の鮨店とは一線を画し、お店のパフォーマンスや、魚と肉で巧みに使い分ける特徴的なシャリを楽しみたい方におすすめの店と評されています。大将のパフォーマンスやおもてなし、そし

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_すし昇 -->

---

### ノコスアレタージュ（名古屋市中村区名駅 / 洋菓子・パティスリー・★3.4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 実店舗オープン前からカリスマパティシエとして知られ、フランス菓子をベースに独自の解釈と素材へのこだわりが光る。旬のフルーツを活かした絶妙な甘さのスイーツは、不定期営業ながらも「幻のカフェ」と称され、常に行列が絶えない人気を誇る。
- **insiderNote**: 実店舗オープン前からカリスマパティシエとして名を馳せ、不定期営業ながら「幻のカフェ」と称される人気ぶり。陶芸家との共作器や、自宅でプロの味を再現できる「nokono粉」販売など、多角的な展開も注目される。
- **sources_used**:
  1. [店主が実店舗オープン前からカリスマパティシエとして知られていたこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFG0vkPX12sY94GJyEVnlAO6zj93uhu4WdrBEILT6fQgtqW7lhPeIvUbLKSkxOKFMjYKHinJnF7XlcSuHJBzDTi3N36pF8eC16XVKrHy04liEadSv29Naf_g9I5OTF12QykuhcL8ts=)
     > 実店舗オープン前から「愛知では有名なカリスマパティシエ」として知られていました。
  2. [フランス菓子をベースにした独自の解釈と素材へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHB87_AlOmLwTO-FY7ojUl8zAWVrChjyWwvoL7PhFjqn54x8Voi5uJRY8fWB9oZViO4pua1WQ3UQGbmNt-a6L-V08DuPqCXkNm-hnmYSYfL0iiSx5HMy2uY7mNOxdDte73ZcCsQuxTM)
     > フランス菓子をベースにしつつ、独自の解釈を加えた菓子作りに専念しています。素材へのこだわりも強く、「nokono粉」という焼き菓子用ミックス粉では、しっとりとした口当たりの北海道産小麦、コクを出すフランス産粗糖ときび砂糖、甘味と風味を加える北海道産生乳100%のバターミルクパウダー、味を整えるフランス産天日塩を使用するなど、プロフェッショナルによる配合がされています。
  3. [素材へのこだわりを示す「nokono粉」の存在](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF54GP2Elhzryv1dyXWtVDcleiuvQs51WSyGmYr9TUE3gs7X5ex5vThPD2tZBnl-WbSghmI56PIdEuj5ySiO5sc5xMcWmCgR_JfFnNcn0bIPaIl)
     > nokono粉
  4. [旬のフルーツを活かした絶妙な甘さのスイーツ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHB87_AlOmLwTO-FY7ojUl8zAWVrChjyWwvoL7PhFjqn54x8Voi5uJRY8fWB9oZViO4pua1WQ3UQGbmNt-a6L-V08DuPqCXkNm-hnmYSYfL0iiSx5HMy2uY7mNOxdDte73ZcCsQuxTM)
     > 提供されるスイーツは、旬のフルーツを主役にした季節限定のデザートが多く、例えば桃やマンゴーを使ったスープ、クープ、ショートケーキ、ヴェリーヌ、タルトなどがあります。スポンジにもマンゴーピューレを練り込むなど、手の込んだ味わいが特徴です。 多くのレビューでは、スイーツは「クドさがなく、絶妙な品のある甘さ」と評価されています。
  5. [旬のフルーツを活かした絶妙な甘さのスイーツ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQER5azQnV_kdegv5OPLSOnsp-8jfCtKcm_uyhZBnLafV7VrlDxKzICUKJVXp8l16_JveomjzyCvfw01Gy0nwTuOJsakULzSw9_Y2jWkNPF2_HNjXK3YmBxDhs_zRdrw922b6-vKrpdH8zUGJkPFk5s=)
     > 旬のフルーツを主役にした季節限定のデザートが多く、例えば桃やマンゴーを使ったスープ、クープ、ショートケーキ、ヴェリーヌ、タルトなどがあります。スポンジにもマンゴーピューレを練り込むなど、手の込んだ味わいが特徴です。 多くのレビューでは、スイーツは「クドさがなく、絶妙な品のある甘さ」と評価されています。
  6. [不定期営業ながら「幻のカフェ」と称される人気](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEx_yVZPJwTYTtzcbhu-jGo9FOyW9MKWrQKd_xDJTenYzXTk0mIWwgff95rdZ-8gtKF9Mn2WnUu5LPAXiLwIxj5JGqrew9EAoBC98WvPWIjSbbiLj5_3gKKCQ==)
     > 営業日は不定期で、月に半分程度しか営業しない月もあり、「幻のカフェ」と称されるほど入店が難しいことで知られています。
  7. [不定期営業ながら「幻のカフェ」と称される人気と行列](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHZ7-HcZ2IkT_Pnt-o-MDDQcArGwwcJf2zXUOHy0lpgw_3vjFrQDyaoI-RdCZYkgzNuw3JTyqDZuUKQbETA9vlsZFuRhYKqqC-VWUu68o7Wu_eY3w==)
     > 不定期営業や厳しい入店ルールにもかかわらず、常に行列ができ、ケーキが早期に完売することからも、その高い人気と料理人としての評価がうかがえます。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_ノコスアレタージュ -->

---

### めしや 浮世ばなれ（栄 / 居酒屋・和牛しゃぶしゃぶ・★）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 「浮世ばなれ」は、厳選食材と器、空間演出にまでこだわったコンセプトが光る繁盛店。坪売上トップクラスと評される料理は、八寸からしゃぶしゃぶまで抜群のクオリティで、地元メディアも注目する。
- **insiderNote**: 八寸の丁寧な仕事ぶりは割烹レベルと評され、料理のクオリティの高さは多くのユーザーから絶賛されている。
- **sources_used**:
  1. [コンセプト、厳選食材、器、空間演出へのこだわり、八寸の評価、繁盛店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGON-ow02j8m-9Jrc9XrjAGm-yvCEXy2pykRQW5gf33Mo1C9ZTS-X6uzy4dF-mmrtRpgdFY09bcDBqLfJbgn4iPmPSnoLJtlt6DAcCBamIeK4vnpE7jqmiDV0PQ96zxkpLAbWDJnwlXW-rhrHRcqTyy7Dvix2U=)
     > 「浮世（時世）から離れ、ただ食事と会話を楽しむ場を提供する」というコンセプトを掲げています。 厳選された肉、旬の魚介、季節の野菜にこだわり、特に名物の和牛イチボユッケには鹿児島県産の28ヶ月肥育の雌の黒毛和牛「薩摩ビーフ」を使用しています。 また、篠島しらすや季節の鮮魚、越前の二八蕎麦、円頓寺・麩柳商店特製の麩饅頭など、特定の産地や特製の食材を取り入れた献立も特徴です。 料理だけでなく、お茶にまで
  2. [おしゃれな空間演出へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGnd8pYTTe7-atsvRWAVWEtecuEYc_D0N1SewIRgmDUsMo8WbKI5_G4rjBgA5ngXGt_ml9cz6SpszFu9Gg_xdGmdauJg1qXAF-MdupGAHgUcjenAKnS2Gmj6AZgqJhvHiMbGKHhZhXnHw==)
     > 店内は落ち着いた雰囲気で、デートや女子会に適したおしゃれな空間と評されています。
  3. [おしゃれな空間演出へのこだわり、地元メディアでの注目](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG5naUVnPP-W6JWD3MKI441MbJPVqkFCAyXRkO54ap26SNX8SF6idgcemXHjJx4NdwLoDD8f4SW7k73DtodWdraSg202z8slcTi8YktFQACjA9lC22g171mvF4uoSu3rVoeJhxVMQ_fU4Bszx2ILgQXnw1VCxzpeCxN4m72k1w3zXAp5ygtkDaQE-ERBTXUcjzIfgvncqjwPSZz85PQI4SFzk0RBl3h6ihOg-TRnqQOz39Kwg==)
     > その他、「Lemon8」 や「うまいものブログ」 といったグルメブログやSNSでも、名古屋のおしゃれな居酒屋として取り上げられています。
  4. [繁盛店であること、坪売上トップクラス、料理の抜群のクオリティ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFXAUTffpDOL7u-YKg6KOos-CuJG2GVUYZEPOXsiZB151rXnvFbdx87jivFUYPPrTe36I1j4LMn6iH-qb8ZjNFPjXt5HpA652h4brpoq4iRA5udAEVl7bbM4DB55fFaGxU2mWVN)
     > グルメサイト「ヒトサラ」では、シェフの高橋堅斗氏が「めしや 浮世ばなれ」を「日本における坪売上のトップ3に入るのではないかと思う繁盛店」と評価しており、八寸からしゃぶしゃぶ、鯖寿司に至るまで「すべてが抜群のクオリティ」と絶賛しています。
  5. [料理の抜群のクオリティ、八寸の丁寧な仕事、割烹レベルの美味しさ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDNmF6p_qG6YRpLocyoHnrU8-gPwo5PfyAOZOLjPo6Si2PkFF-99WvPw2lIMJVIi-ZJd3kZLRs9R3lDXC0o6wSEVGhb6IGfdtCwfHUhvj5QTSxyq8Uk8K_UUeSmLLJE8h52d5cHaN4EC319SoLI8OixQ==)
     > Rettyの口コミでも、料理のレベルが非常に高く、見た目だけでなく味のクオリティも高いと多くのユーザーから評価されています。 八寸の「丁寧な仕事」や、全ての料理から感じられる「クオリティの高さ」が特筆されており、「割烹、小料理屋レベルの美味しさ」と評されることもあります。
  6. [地元メディアでの注目](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEHsSZcFF-BQ5Xw27J5LWzDphegkWExkL6VR2LpvzFsZU2dQGTfo-w9SRk8lRZyJZQr-2s9fp4U5snB8-tkjWey-qRIeLwPaGS80P8W61r-qr4sOCNntsp3SfYm85RECWlRm82XKqyGI_OuqGM=)
     > 名古屋を中心に東海地方のグルメ情報を紹介するウェブメディア「名古屋チャンネル」 や「NAGOYA BITES」 で紹介されています。
  7. [地元メディアでの注目](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEMDvZoWvBFayyXxLsbq6N8YweHRhSxt7EYjLMdPkKr3IpMYCEMRrdQAvmzDuOhB9HUeJifWg5DwgS9rpvP2OQQWOcuQHnqGQ1LbBEFzm3reTYxK8O_wO8KVq-biZf3amagM4RLDbzUg6GoOfb_FyJXPw05KBc=)
     > 名古屋を中心に東海地方のグルメ情報を紹介するウェブメディア「名古屋チャンネル」 や「NAGOYA BITES」 で紹介されています。
  8. [地元メディアでの注目](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE1fFdYu98whANj09v6HBk_LRdgSEhkl264kgHMb7B8vwP60ddgCKVhVfF3hkmqrcLaKDMpEmlEMS_C7xr_YsGdN9njwyc2GGiqMe_z1CPlTrlMEqOCrZQUrV71RBoljs6zGKhdUKX0-xSBYyBKB92A)
     > 地域情報誌「KELLY（ケリー）」では、その高い料理のクオリティとサービスが評判の人気店として、新店舗「瓦町久屋 浮世ばなれ」のオープンが報じられました。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_めしや浮世ばなれ -->

---

### 箱屋 名古屋駅前店（名古屋駅 / 居酒屋・★4.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 全席完全個室でプライベートな空間を提供し、名物の飛騨牛溶岩焼きや牛タンしゃぶしゃぶ、豊富な梅酒など、料理長のこだわりと顧客満足度を両立させた運営が評価される。
- **insiderNote**: 全席完全個室でインターホンによる効率的なサービスを提供。A5飛騨牛溶岩焼きや牛タンしゃぶしゃぶ、39種の梅酒など、素材と提供方法にこだわり、顧客満足度を高める工夫が随所に見られる。
- **sources_used**:
  1. [全席完全個室であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpE2UTKGv_G_0jZAnnX-Jenjc84uUhqa8XSPO7XOWBQKPebI0vHkvciOnkWg1KPnGs8ELA5aESq-RBVM1IX2ftRKvvOtU6Md3pb8p-ealiYLkkXX6b3ctqpqzQqS4sSJkd5EiV5qelBH4ns0gjrY3SzV0=)
     > 特に「牛タンしゃぶしゃぶ」や「飛騨牛の溶岩焼き」が名物料理として取り上げられ、個室の雰囲気や梅酒の種類の豊富さなどが評価されています。
  2. [飛騨牛の溶岩焼きが名物料理であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpE2UTKGv_G_0jZAnnX-Jenjc84uUhqa8XSPO7XOWBQKPebI0vHkvciOnkWg1KPnGs8ELA5aESq-RBVM1IX2ftRKvvOtU6Md3pb8p-ealiYLkkXX6b3ctqpqzQqS4sSJkd5EiV5qelBH4ns0gjrY3SzV0=)
     > 特に「牛タンしゃぶしゃぶ」や「飛騨牛の溶岩焼き」が名物料理として取り上げられ
  3. [牛タンしゃぶしゃぶが名物料理であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpE2UTKGv_G_0jZAnnX-Jenjc84uUhqa8XSPO7XOWBQKPebI0vHkvciOnkWg1KPnGs8ELA5aESq-RBVM1IX2ftRKvvOtU6Md3pb8p-ealiYLkkXX6b3ctqpqzQqS4sSJkd5EiV5qelBH4ns0gjrY3SzV0=)
     > 特に「牛タンしゃぶしゃぶ」や「飛騨牛の溶岩焼き」が名物料理として取り上げられ
  4. [梅酒の種類が豊富であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpE2UTKGv_G_0jZAnnX-Jenjc84uUhqa8XSPO7XOWBQKPebI0vHkvciOnkWg1KPnGs8ELA5aESq-RBVM1IX2ftRKvvOtU6Md3pb8p-ealiYLkkXX6b3ctqpqzQqS4sSJkd5EiV5qelBH4ns0gjrY3SzV0=)
     > 梅酒の種類の豊富さなどが評価されています。
  5. [料理長のこだわりが料理に反映されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF0r6O88lLY_hGgKlSB7j4Epk7mN3BYSA5l1cd7i29Rywmtx4147kxWhohswNgG8JVdLNhEitd2VTXU1QvcOXUcWogA6btyxzPMhWgSZEwLYUvEl4vMp98JjtTCfMcuhqFxwDRVI_7xPMm22v8=)
     > 旬の食材の美味しさを最大限に発揮し、料理人のこだわりを感じるコース
- **warnings**: 5件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J001217353 -->

---

### なだ万 茶寮 名駅店 JRセントラルタワーズ（名古屋（名古屋駅/西区/中村区） / 和食・★4.4）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 1830年創業の老舗「なだ万」の伝統を継承しつつ、「老舗はいつも新しい」を掲げ、現代的な日本料理を提供。料理長安東氏の技が光る懐石は、目と舌で楽しめ、きめ細やかなサービスと上質な空間で特別な食体験を約束します。
- **insiderNote**: 料理長安東氏はなだ万で研鑽を積み、伝統と革新を追求。グループ総料理長によるメディア露出も多く、ブランド全体の高い技術力と創造性が強みです。
- **sources_used**:
  1. [1830年創業の老舗「なだ万」の伝統を受け継ぎ、「老舗はいつも新しい」をモットーに現代的な日本料理を提供していること、料理長安東氏が伝統を守りつつ新しい料理に挑戦していること、懐石料理が目と舌で楽しめること、きめ細やかなサービスが提供されていること、顧客評価が高いこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH2nQzBciKATwDlBpHw-pPCvyOsmZ6aEpqrbShHrXTgory8WDkuW4UKLLqyOXXAslYVYUknQiyoZ7fLuLj1mVn3SUqeo333-0zwZSnykl5Wd3BUv_E07IniaCSi2N--qpk=)
     > 1830年創業の老舗料亭「なだ万」の伝統を受け継ぎ、「老舗はいつも新しい」をモットーに、伝統の味と技を現代的に進化させた新しい日本料理を提供しています。
  2. [1830年創業の老舗「なだ万」の伝統を受け継ぎ、「老舗はいつも新しい」をモットーに現代的な日本料理を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF6fm39UeCVThudW0uqdkubhMnIlClR_ap3yncpeME4ATxX_oHiS1VhBwSGy-Ly0M_XTSala_iGwAhbMKdjx5Q-H5KgULow1SMC16l8J1gK6PGsKs5leYUwjqzutu4JBo4LQ-x0gYfZcMA5-g==)
     > 創業1830年、日本料理の老舗「なだ万」。「老舗はいつも新しい」をモットーに、伝統の味と技を現代的に進化させた新しい日本料理を提供しています。
  3. [料理長が安東智則氏であること、なだ万で修行を積んだ経歴、伝統を守りつつ新しい料理に挑戦していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFvFEskX76mh0cmCWYEcGmj5F1pa-zNtqX1lMb1JbITWDaz2CKzZMdz2_eLgakHh-wlB0y3dMXv72JlzX_feCTQhCdkHqH7MwOHhZ8IjUDI-G2_R3OrJQOax1CXl1IEShLJ8M6P8g==)
     > 現在の料理長は安東智則氏です。同氏はなだ万に入社後、主に大阪のレストラン各店で修行を積み、なだ万厨房製造工場（関西）副料理長、大阪なだ万副料理長、梅田なだ万茶寮料理長を経て、2026年に名駅なだ万茶寮の料理長に就任しました。
  4. [和モダンで落ち着いた雰囲気の店内、テーブル席、カウンター席、個室など様々なシーンに対応できる空間が用意されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGlmvCrBzG7QzPd0kjZ9bT6FZ60HEn60hd-m3urzD6x-bfV3Og3LCiN_Z0ZQB2GhKsn9c9WGzhgAjuspzC9JE2b3fJqzp4t2i1RRmU9dNVIh9FjTtKDznqAX-AI9g==)
     > 和モダンで落ち着いた雰囲気の店内には、テーブル席、景色を一望できるカウンター席、個室など、様々なシーンに対応できる空間が用意されています。
  5. [和モダンで落ち着いた雰囲気の店内、テーブル席、カウンター席、個室など様々なシーンに対応できる空間が用意されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG28XPevr5vXEfJ42eanUFt-Cr1upnbnH26Bna5xfB_HVsjDYhf_uVD1LsBU2AakHBAxhiSWAWUebY3BW0EmqBiSmWtUegtXfEHKN5JloBGdA7cblDW3qoT1j8SIp8Qv8FqxckfwA==)
     > 和モダンで落ち着いた雰囲気の店内には、テーブル席、景色を一望できるカウンター席、個室など、様々なシーンに対応できる空間が用意されています。
  6. [和モダンで落ち着いた雰囲気の店内、テーブル席、カウンター席、個室など様々なシーンに対応できる空間が用意されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHkQkqQXxgC4wo9K727p3Zw_oB3xdBEUQhm_lQJLXk_5rsLquX8Jzv0flqEHvNYqHACrffwCBGrtCp9An4T1a43uYPQPE-_ZFsCHuFwyb5JkuGQgHDeU_Cw9K6T8QWqVb6fVnk0rx8DgQ==)
     > 和モダンで落ち着いた雰囲気の店内には、テーブル席、景色を一望できるカウンター席、個室など、様々なシーンに対応できる空間が用意されています。
  7. [和モダンで落ち着いた雰囲気の店内、テーブル席、カウンター席、個室など様々なシーンに対応できる空間が用意されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERwOPX4fj9m4DozPtoHGVDyJ55vtqNwWm8wSGnOS5ZoMbf7oTMAN-JoaK7LFNqbKDSPHrXeam-e24qtgZg47aLEA_CaxA8nXe6oGijj1vW21cOG_QOrQJdCNIj43LD-25GHuqPpiXMptS39NOKUZBR-XP1oGhTmH7wps114Q26)
     > 和モダンで落ち着いた雰囲気の店内には、テーブル席、景色を一望できるカウンター席、個室など、様々なシーンに対応できる空間が用意されています。
  8. [和モダンで落ち着いた雰囲気の店内、テーブル席、カウンター席、個室など様々なシーンに対応できる空間が用意されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_m4RiASZa6EAh8Jl4eQ5Q20B6mPlNOZNhIDCsQTE61nGSUz2dS3dJ8q6YwpNtn7fyJ4oW9FSHD2Sgsj-2F8qV_FCIGg44-p4Mt70JzCgUI5X0twFVIQD14YxtQSbCSlZQZR491qc=)
     > 和モダンで落ち着いた雰囲気の店内には、テーブル席、景色を一望できるカウンター席、個室など、様々なシーンに対応できる空間が用意されています。
  9. [懐石料理が一品一品目でも楽しめる工夫がされていること、きめ細やかなサービスが提供されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcuPzD1lkXAxdMOtmTYv68wRb4dCS43DC3nlngGqkjuL_0wvlB5W8EYC82x04D8X9yuhvLV8_ejYM0Libn2XRD8oPohO8uTxyOMrXkvHOFR-TJ_rjCNszrLS_2TGWqQIyMRu_DD164BezxP5hLNvCn4O4XclbnK98=)
     > 一品一品が目でも楽しめるよう工夫されており、野菜を蝶の形にするなど彩りにも配慮されています。少しずつ様々な料理を味わえるスタイルが魅力的で、味も上品であると評価されています。料理の提供スピードは適切で、会話を楽しみながら食事ができ、お茶の入れ替えも催促なしで行われるなど、きめ細やかなサービスが提供されています。
  10. [懐石料理が一品一品目でも楽しめる工夫がされていること、きめ細やかなサービスが提供されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFjFDY9EWYW3G3i7ryh9hi8-ETxm6zzzfJfXdQB9WrFWobXDX3Ig56lmsRq8jag38tOBCNtuKqZC58e5LQhFmJCM4ktgzAPNaL2_4xXPb92pa2Oi01sPp67z6B8S8-W1nr0551yEqRcxiKtB0L-Cw==)
     > 一品一品が目でも楽しめるよう工夫されており、野菜を蝶の形にするなど彩りにも配慮されています。少しずつ様々な料理を味わえるスタイルが魅力的で、味も上品であると評価されています。料理の提供スピードは適切で、会話を楽しみながら食事ができ、お茶の入れ替えも催促なしで行われるなど、きめ細やかなサービスが提供されています。
  11. [懐石料理が一品一品目でも楽しめる工夫がされていること、きめ細やかなサービスが提供されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFuEOBpwYiAYHxChcfstacAlYbibmGONrZ7WMGoosttb0XZG3ea_HkOL1lWHPSlouKah88jowm6T_e-rGnrjfpGVbtp-sE6b8S9_iM56pydhAihaFfl6KTVLKVe1cNsY8ASYlmGw2M=)
     > 一品一品が目でも楽しめるよう工夫されており、野菜を蝶の形にするなど彩りにも配慮されています。少しずつ様々な料理を味わえるスタイルが魅力的で、味も上品であると評価されています。料理の提供スピードは適切で、会話を楽しみながら食事ができ、お茶の入れ替えも催促なしで行われるなど、きめ細やかなサービスが提供されています。
  12. [懐石料理が一品一品目でも楽しめる工夫がされていること、きめ細やかなサービスが提供されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHd9f_4IyNIp6FQ3_hWh7asdq3X9evH28Z6oo_eDj7a4b5yigM7vRr-Pu0dXAL1CT0J80yTtIie9F0qvZFCv8370KDR6U88O-TC6m7R7gzEXToFzXr2_OkMer0yuu_310c)
     > 一品一品が目でも楽しめるよう工夫されており、野菜を蝶の形にするなど彩りにも配慮されています。少しずつ様々な料理を味わえるスタイルが魅力的で、味も上品であると評価されています。料理の提供スピードは適切で、会話を楽しみながら食事ができ、お茶の入れ替えも催促なしで行われるなど、きめ細やかなサービスが提供されています。
  13. [懐石料理が一品一品目でも楽しめる工夫がされていること、きめ細やかなサービスが提供されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFghA1sAwfxDOgDgcRVKbEqxoYcTEKgxnU5xD-TUFtF8eG-GX6hsGKzVF3FU1woy3I9UqHLPoWIlNtqhQta3O8_Mec3FygHIYsVLnv5N0y8FD6620uVg9w7TAnIlNLw2XFdHXPU)
     > 一品一品が目でも楽しめるよう工夫されており、野菜を蝶の形にするなど彩りにも配慮されています。少しずつ様々な料理を味わえるスタイルが魅力的で、味も上品であると評価されています。料理の提供スピードは適切で、会話を楽しみながら食事ができ、お茶の入れ替えも催促なしで行われるなど、きめ細やかなサービスが提供されています。
  14. [なだ万グループ総料理長・鈴木史氏がテレビ番組でデザート寿司を開発・披露したこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF_Kis1wemjwi-04bY8oeYkWBPfkc39nWgRIdLL9AsHSnDWkPxKgQrNgLR_MhfK5TtZ3a4B5JB9oXAtz_Nb44_q0NjpaF7u6AquI9rh7l0NkDFzWmXrk8_8pHYU)
     > なだ万総料理長・鈴木史氏が考案したデザート寿司「プリンロール」がテレビ番組で紹介され、期間限定で同店を含む2店舗で販売された際には、プレスリリースも配信されています。
  15. [なだ万グループ総料理長・鈴木史氏がテレビ番組でデザート寿司を開発・披露したこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9g16Zj5X8zSViE587Y-Ixd3qouuls9ZWoYKkKb8Y-A7zepU1qBfg16B8O9AG3O0qk9TO9a2zA17qpBFVVof_8k94DwZjz_Fg4TI-i-l_S_CUrV2JTpatxsRIzlOnuTal3Fng=)
     > なだ万総料理長・鈴木史氏が考案したデザート寿司「プリンロール」がテレビ番組で紹介され、期間限定で同店を含む2店舗で販売された際には、プレスリリースも配信されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J000394021 -->

---

### 次郎 名古屋駅店（名古屋（名古屋駅/西区/中村区） / 居酒屋・★）

- **status**: OK 🟡 review-required
- **confidence**: 0.75
- **editorReason**: 「次郎 名古屋駅店」は、お客様にとって最高のひとときを提供することにこだわり、ラグジュアリーな空間で多様なシーンに対応できる店舗づくりを追求。コストパフォーマンスに優れたコース料理も魅力で、幅広いニーズに応える居酒屋として注目されます。
- **insiderNote**: 店主は最高のひとときと多様なシーンへの対応、こだわりの空間提供を重視。ラグジュアリーな雰囲気とコスパの良いコースで顧客満足度を高める戦略が見えます。
- **sources_used**:
  1. [顧客体験の質へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGHfFGd2WkBic2ta6rAE_oEo7pgI9mIu87ZtDuX0jkHAOyT2HCgKtrqAsBAY-isHj2h_yzS0A1LNBYQGFXfih3saSAbaGwp2g16mjS9wX2p14bHZmwB4hBV1j7-bh3Q8m6tsQ==)
     > お客様にとって最高のひとときを提供することにこだわっています。
  2. [多様な利用シーンへの対応](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFjsqfBjZrgY7f5HjdF2NqUSi2jB9C3S4GMYdHW_NrseyB8fObLSYc96kWO4El5ny5GwPRx-XupEMqoa5OenvANYqxwM5KQKpuLMvHxKgo6-gGHZDadsGpeCA0y1hrQrh3M7HVNL6e4ZEZ5Q-zz8pYw)
     > どのようなシーンにも対応できる店舗づくりを心掛けているとのことです。
  3. [空間演出へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGHfFGd2WkBic2ta6rAE_oEo7pgI9mIu87ZtDuX0jkHAOyT2HCgKtrqAsBAY-isHj2h_yzS0A1LNBYQGFXfih3saSAbaGwp2g16mjS9wX2p14bHZmwB4hBV1j7-bh3Q8m6tsQ==)
     > こだわりの空間」を提供しているとされています。
  4. [ラグジュアリーな空間の提供](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFjsqfBjZrgY7f5HjdF2NqUSi2jB9C3S4GMYdHW_NrseyB8fObLSYc96kWO4El5ny5GwPRx-XupEMqoa5OenvANYqxwM5KQKpuLMvHxKgo6-gGHZDadsGpeCA0y1hrQrh3M7HVNL6e4ZEZ5Q-zz8pYw)
     > 雰囲気の良いラグジュアリーな空間での飲食を特徴としています。
  5. [二次会など多様なシーンでの利用可能性](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE8qXR_xXoIt9vs_5yNht4BDg8YMOWZB6RZvofH6HUGeHKFrBzr_omOxaR-rDzibEz9DeTFN6TIuBeqrzOBxrpQH4eXS9A8o3vOpQB8a_DLBHKLgAGg-vJkJ0GFPGiGD1vul7FnGqP2m3vHbsg7isdQ)
     > 二次会などでの利用も可能で、様々なシーンに対応できる店舗を目指しています。
  6. [コストパフォーマンスに優れたコース料理の提供](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE8qXR_xXoIt9vs_5yNht4BDg8YMOWZB6RZvofH6HUGeHKFrBzr_omOxaR-rDzibEz9DeTFN6TIuBeqrzOBxrpQH4eXS9A8o3vOpQB8a_DLBHKLgAGg-vJkJ0GFPGiGD1vul7FnGqP2m3vHbsg7isdQ)
     > コストパフォーマンスに優れたコース料理も用意されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J001245796 -->

---

### 九州小町 名古屋駅（名古屋駅 / 居酒屋・★3.4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 「九州小町 名古屋駅」は、熊本直送の馬刺しや国産白モツのもつ鍋など、九州料理へのこだわりが際立つ。名古屋駅から徒歩3分の好立地と多様な個室は、ビジネスからプライベートまで幅広いニーズに対応し、主要グルメサイトでの高評価も集客力を裏付ける。
- **insiderNote**: 熊本直送の馬刺しや国産白モツのもつ鍋など、素材へのこだわりで他店との差別化を図る。駅近の好立地と多様な個室で、幅広いシーンに対応し集客力を高めている。
- **sources_used**:
  1. [熊本直送の馬刺しや国産白モツのもつ鍋へのこだわり、名古屋駅からの好立地、多様な個室の存在、および主要グルメサイトでの高評価を裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFCLNiiVVa4RB3wMgspnlMr_NdOjuDL2aKrWvuvabi9j6K6YFam2fsZF5PlfDp3SPz95TOdrMT4AZndDFvtI3m1rfLWzEcqqWp769788L2-BC_0nAWwIouxkKm1_FJHyO4f7Q==)
     > 「九州小町 名古屋駅」では、熊本県から直送される「本物の馬刺し」を提供することにこだわり、他店との違いを強調しています。また、もつ鍋についても「ぷりぷりの国産白モツだけ」を使用し、5時間かけて煮込む秘伝の出汁にこだわっているとされています。この飲食店は、JR名古屋駅から徒歩3分の場所に位置し、アクセスが良いのが特徴です。店内には2名から最大60名まで対応可能な完全個室が多数用意されており、女子会、
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認） / sources_used が 2 件未満（人手レビュー必須）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J000711621 -->

---

### 燈り 名古屋駅店（名古屋駅 / 居酒屋・★）

- **status**: INSUFFICIENT_EVIDENCE ⚪ INSUFFICIENT
- **confidence**: 0
- **editorReason**: 「燈り 名古屋駅店」に関する業界視点の情報は、今回の調査では確認できませんでした。店主のこだわりや提供スタイルの特徴、地元メディアでの紹介、料理人としての評価といった情報は現状見当たらず、詳細なコメントは控えさせていただきます。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J003985252 -->

---

### 豚匠 名古屋駅店（名古屋（名古屋駅/西区/中村区） / 居酒屋・★）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 厳選国産豚にこだわり、しゃぶしゃぶやサムギョプサルでその旨みを最大限に引き出す。少人数から団体まで対応可能な個室やサプライズ演出、全国の日本酒飲み放題など、多様なニーズに応えるサービスと空間提供が強み。
- **insiderNote**: 厳選国産豚へのこだわりと、個室やサプライズ、日本酒飲み放題など多様な顧客ニーズに対応する提供スタイルが強み。グルメメディアでの紹介も多く、集客力も期待できる。
- **sources_used**:
  1. [厳選国産豚の使用としゃぶしゃぶ・サムギョプサルでの提供](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGME_MoF3P9laidLiiSSIMarUMPIhecNS3d4YPYrrvpTFaMCcXn6mA2ulI8mca0JdT-rH9NczY7e_dTu3h2sNizaXJb4XMqV_pd8o1wtSd5docdlB8DtbYxic0aspqQ7svhqTzgGJw=)
     > 厳選国産豚を堪能できるしゃぶしゃぶとサムギョプサル
  2. [厳選国産豚の品質へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEJ7BMTNP4bNFuqMMv5_GjsD2H9fQ5ItfGUMbUT8ZuvtffVEJsAdjYpXvIKcYmGmHMwNLY4dgF3NKFmh7HOYgtz-h6nuZvFS3ePYMh7qIuAyLFBnHBKDu9i2iWo6cFT0uGqC0IX3B0M8wASDUc=)
     > きめ細やかな肉質と上品な脂の甘みが特徴の厳選国産豚
  3. [しゃぶしゃぶの出汁やタレ、〆へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE27FoBHMWLSeH3_GGoe-J5IOE0NcAhiPbRnt97rQFY8eUsITj_gKhzSlwxoj4hyfWwMkuIIhnccAFWnCio2wXVEd75D3PVxrv6VuPNA9OIX4sgv0uxQymU77PQOv-6wQA48YoHPRP6o4yupGNrLVCxuDNhcAOYTn1_n4Jdw3Sxfr6w)
     > 肉本来の旨みを引き立てる出汁やタレにも妥協せず、〆の特製ラーメンまでこだわり抜いた提供
  4. [サムギョプサルの焼き方へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEb_dthoesl7NH9WehDkVCZsMp0fhMoM8Bb7YlXSmQNuOjxweYYwC2KvcIpQ8fk4_P8vx5tQ07fZCslZ5ZSMWK39b4RHq0jW7jKgZLvpdS9XARmi4cuJCsAMdDjm_Uif0EmsXaJtqhM2lYbSg==)
     > 厳選国産豚の旨みと食感を最大限に引き出す焼き方にこだわっており
  5. [多様な人数に対応する個室の存在](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGME_MoF3P9laidLiiSSIMarUMPIhecNS3d4YPYrrvpTFaMCcXn6mA2ulI8mca0JdT-rH9NczY7e_dTu3h2sNizaXJb4XMqV_pd8o1wtSd5docdlB8DtbYxic0aspqQ7svhqTzgGJw=)
     > 少人数から団体まで対応可能な大小様々な個室席を完備
  6. [個室が多様な利用シーンに対応](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEJ7BMTNP4bNFuqMMv5_GjsD2H9fQ5ItfGUMbUT8ZuvtffVEJsAdjYpXvIKcYmGmHMwNLY4dgF3NKFmh7HOYgtz-h6nuZvFS3ePYMh7qIuAyLFBnHBKDu9i2iWo6cFT0uGqC0IX3B0M8wASDUc=)
     > デートや合コン、接待、各種宴会など、利用シーンや人数に合わせて満足できるお席をご提供
  7. [誕生日・記念日向けのサプライズ演出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGME_MoF3P9laidLiiSSIMarUMPIhecNS3d4YPYrrvpTFaMCcXn6mA2ulI8mca0JdT-rH9NczY7e_dTu3h2sNizaXJb4XMqV_pd8o1wtSd5docdlB8DtbYxic0aspqQ7svhqTzgGJw=)
     > 誕生日や記念日には、メッセージ付きの特製デザートプレートを無料でご提供
  8. [花火・音楽・照明を使ったサプライズ演出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEJ7BMTNP4bNFuqMMv5_GjsD2H9fQ5ItfGUMbUT8ZuvtffVEJsAdjYpXvIKcYmGmHMwNLY4dgF3NKFmh7HOYgtz-h6nuZvFS3ePYMh7qIuAyLFBnHBKDu9i2iWo6cFT0uGqC0IX3B0M8wASDUc=)
     > 花火や音楽、照明を使ったサプライズ演出も行っております
  9. [全国の日本酒を含む飲み放題の提供](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGME_MoF3P9laidLiiSSIMarUMPIhecNS3d4YPYrrvpTFaMCcXn6mA2ulI8mca0JdT-rH9NczY7e_dTu3h2sNizaXJb4XMqV_pd8o1wtSd5docdlB8DtbYxic0aspqQ7svhqTzgGJw=)
     > 全国47都道府県から取り寄せた日本酒を含む2時間の飲み放題
  10. [コース料理に飲み放題が付いていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEJ7BMTNP4bNFuqMMv5_GjsD2H9fQ5ItfGUMbUT8ZuvtffVEJsAdjYpXvIKcYmGmHMwNLY4dgF3NKFmh7HOYgtz-h6nuZvFS3ePYMh7qIuAyLFBnHBKDu9i2iWo6cFT0uGqC0IX3B0M8wASDUc=)
     > 多くが2時間の飲み放題付き
  11. [厳選国産豚の使用](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGME_MoF3P9laidLiiSSIMarUMPIhecNS3d4YPYrrvpTFaMCcXn6mA2ulI8mca0JdT-rH9NczY7e_dTu3h2sNizaXJb4XMqV_pd8o1wtSd5docdlB8DtbYxic0aspqQ7svhqTzgGJw=)
     > 厳選国産豚を堪能できるしゃぶしゃぶとサムギョプサル
  12. [厳選国産豚の品質](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEJ7BMTNP4bNFuqMMv5_GjsD2H9fQ5ItfGUMbUT8ZuvtffVEJsAdjYpXvIKcYmGmHMwNLY4dgF3NKFmh7HOYgtz-h6nuZvFS3ePYMh7qIuAyLFBnHBKDu9i2iWo6cFT0uGqC0IX3B0M8wASDUc=)
     > きめ細やかな肉質と上品な脂の甘みが特徴の厳選国産豚
  13. [個室の充実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGME_MoF3P9laidLiiSSIMarUMPIhecNS3d4YPYrrvpTFaMCcXn6mA2ulI8mca0JdT-rH9NczY7e_dTu3h2sNizaXJb4XMqV_pd8o1wtSd5docdlB8DtbYxic0aspqQ7svhqTzgGJw=)
     > 少人数から団体まで対応可能な大小様々な個室席を完備
  14. [サプライズ演出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGME_MoF3P9laidLiiSSIMarUMPIhecNS3d4YPYrrvpTFaMCcXn6mA2ulI8mca0JdT-rH9NczY7e_dTu3h2sNizaXJb4XMqV_pd8o1wtSd5docdlB8DtbYxic0aspqQ7svhqTzgGJw=)
     > 誕生日や記念日には、メッセージ付きの特製デザートプレートを無料でご提供
  15. [日本酒飲み放題](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGME_MoF3P9laidLiiSSIMarUMPIhecNS3d4YPYrrvpTFaMCcXn6mA2ulI8mca0JdT-rH9NczY7e_dTu3h2sNizaXJb4XMqV_pd8o1wtSd5docdlB8DtbYxic0aspqQ7svhqTzgGJw=)
     > 全国47都道府県から取り寄せた日本酒を含む2時間の飲み放題
  16. [ブログでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHPLX34mn78J8Ig1_WmSnhEs_d5i4zMY0iEd7SWtOzgqGiGYd2YfedsDijidexwc1FgHz48MfNAxMDsheBuzDs_eVwwv_0Zfo5quS0EdXsl24KQD6h8jmA5Ods8CxmRWlIjdHo8MC9cPHkkdRde)
     > スーパーフードエキスパート・フードアナリストである「黒帯さんになぁれ」氏のブログで、「みかわもち豚のしゃぶしゃぶを主役に、角煮と黒毛和牛のミスジユッケを堪能した」という内容で紹介されています。
  17. [Instagramでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFVjjZ_AAk37a5amFpedtnZw_pVz82NexmA_UjHAnpEera2q3CkVqaAjiUFzwxFWm8X3ddG6sv3uimu2YIi9XwWOPxa3VjbZWFzLWhBTimzi_Y5EeQaSbXlI-zzcw9U4RnJ2w==)
     > Instagramのグルメアカウント「nao_guru_25」でも、豚しゃぶだけでなく一品料理も充実している点や個室の利用シーンについて紹介されています。
  18. [ホットペッパーグルメへの掲載](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGME_MoF3P9laidLiiSSIMarUMPIhecNS3d4YPYrrvpTFaMCcXn6mA2ulI8mca0JdT-rH9NczY7e_dTu3h2sNizaXJb4XMqV_pd8o1wtSd5docdlB8DtbYxic0aspqQ7svhqTzgGJw=)
     > 大手グルメサイトであるホットペッパーグルメに掲載されており、メニューやクーポン、口コミ情報が紹介されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J004577162 -->

---

### de trente ans ドゥ トランタン（栄ｷﾀ錦/伏見丸の内/泉/東桜/新栄 / ダイニングバー・バル・★5）

- **status**: INSUFFICIENT_EVIDENCE ⚪ INSUFFICIENT
- **confidence**: 0
- **editorReason**: (なし)

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J004067208 -->

---

### やんやん 焼き小籠包専門店 名駅本店（名駅南 / 中華・点心・★）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 中国国家資格「特級点心師」が手掛ける焼き小籠包は、生地から餡、包み方まで全てにこだわり、通常の約2倍のスープを包み込む「日本一」と称される逸品。熟練の技が光る本場の味を名古屋で楽しめます。
- **insiderNote**: 国家特級点心師が温度・湿度を管理し、小麦粉と水の量を調整する熟練の技で本場の味を再現。たっぷりのスープを包む均一な皮の技術も秀逸。イートイン・テイクアウトに加え、Uber Eats対応で多様なニーズに応えます。
- **sources_used**:
  1. [特級点心師が手作りし、生地から焼き方までこだわり、日本一と称される約2倍のスープを包む焼き小籠包であること。点心師が温度・湿度管理や水分量調整で本場の味を再現し、破れにくい皮を作る技術を持つこと。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG2A3EyS6O2MnhZPWbJw4_qYASwgDcuuaXAhFcoz8HHMKCmbzV5RDELHvNTCxblSO-M0Y7XmijnsLadZjl871Um_wU7X0wJQyPdD5F_rqsd5YC8Ksa920xBPHgooPOa5L5nDj7lAWGKwK8xzQ==)
     > 「やんやん 焼き小籠包専門店 名駅本店」は、中国で取得に最低15年かかるとされる国家資格「特級点心師」が中心となり、焼き小籠包やワンタンを注文を受けてから一つ一つ手作りしています。特に焼き小籠包においては、「日本一」と称されるほどのスープの量を誇り、生地作りから餡作り、包み方、蒸し方、焼き方まで全ての工程にこだわり、通常の焼き小籠包の約2倍のスープを包み込むことを可能にしています。餡には肉の赤身と
  2. [中国国家資格「特級点心師」が在籍し、熟練の技で本場の味を再現し、日本一スープの多い焼き小籠包を提供していること。小麦粉の水分量を手の感覚で調整する専門知識や、破れにくい均一な皮を作る技術が評価されていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzfuslH7CFFndHRz7uWw-P_IgnS4QE29Hz1UwMww473EzEPXqTs0db4hwTyiOwvAEWm7lZedvReMuvmtpamZe3rdDJQfyM9zAZ0lmLpR5SLLDBoRnsBYTe6GJSR5nU)
     > 「やんやん 焼き小籠包専門店 名駅本店」は、中国の国家資格で最高級とされる「国家特級点心師」が在籍しており、その熟練の技が評価されています。この点心師は「点心のプロ中のプロ」と称され、小麦粉の水分量を手の感覚で調整できるほどの専門知識と技術を持っているとされています。温度や湿度を管理しながら本場の味を再現する技術や、たっぷりのスープを包み込んでも破れにくい均一な皮を作る技術は、その高い評価の根拠と
  3. [「日本一スープの多い焼き小籠包」というキャッチフレーズが多くの地元グルメメディアやSNSで注目されていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQYNdYZEOT7YZphrXnrp5Kada7XDXHXQ95ebOjVeX6CGqLKJz_YlW-lKfA16wqs_vTxsOIrCpYtQ-5bpu5Yh2fYx4ZYn04IQXP2JhXcieZZRYDesAa6SkAevFAUpzeTE3P1m_18KOlZ0Y82ERnhpoqZA==)
     > 「やんやん 焼き小籠包専門店 名駅本店」は、東海テレビ、「食いしん坊の名古屋B級Life」、「ナゴレコ」、「NAGOYA. (ナゴヤドット)」、「Retty」、「KELLY Web」、「ホットペッパーグルメ」、「名古屋情報通」、「Lemon8 App」、および複数のTikTokやInstagramのグルメアカウント、Amebaブログ「40代独身 手取り21万事務職の株式投資と食べ歩き」など、多くの
  4. [Uber Eatsでのデリバリーに対応していること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHkNR_ELD6RIfv9r9qQ5a-fA0GMO8YVlDvkBXdrnIn3DjxCx_OH3mFjvuWoHCL6swvYjPjR71naQ0dOHqKDucpm9NkcEJkrHQsRzjBHCOHGGJZ6S92D1H4yNJu7sfS4BF_1REehsrXg_XCuRpxhyKzQy6-XZ4YeuKPcTliBENbGpGKRsiFYB4w5kO30JE33FC5RAU2FegWrjAlaa-hXGU0kapzDbezybRrBIwNSFUAmc1yAaLB3nthFQs1REhu-TDjoFZAn36eL9Zv2jjvcNzOLCWWBu28NvLUMOstA8-nEmgKY2tmvYTkUbwscBQ==)
     > Uber Eatsでのデリバリーも可能です。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_やんやん焼き小籠包専門店名駅本店 -->

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

### とんかつ朱寿（本山・覚王山・藤が丘 / 和食・★4.8）

- **status**: OK 🟡 review-required
- **confidence**: -
- **editorReason**: 店主の銘柄豚・米への深いこだわりと、羽釜炊きご飯や低温調理といった丁寧な提供スタイルが、高い顧客満足度と地元メディアでの注目を集めています。きめ細やかな接客も魅力です。
- **insiderNote**: 店主はキッチンカー経験を経て店舗をオープンし、客との直接の触れ合いを大切にしています。食材への探求心も高く、五ツ星お米マイスターからのアドバイスも取り入れています。
- **sources_used**:
  1. [店主のキッチンカー経験、客との触れ合いを重視する姿勢、銘柄豚・米の選定へのこだわり、お米マイスターからのアドバイス、低温調理と羽釜炊きご飯の提供スタイル、丁寧な接客、地元メディアでの紹介を裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEa4k0bl20qZrBrK4MnCCq8ulhvbGfSMBueo8h46e335PbXTJg2nwb_fNb2nHFc7rtovZxwDdEQer-VOrcBMxCMLRL7uVQlKCAW0xsc0VBdcFbSBHqGRzuLK3bFfZM2VUSoVDv_Vk6eLfT00PdeD-PZiXdRTofzLBhvwyfJTcSQHJ8GXHMKrPhZx1ShlVFql7oNY6Xv2Qg86p5EE7WrvtdyiyicGJEcLDfdZfImILNbSt82ApRVKKh9Xq1XdJtCN-5rqE3WkKjvk_ZSFS0NZToRZZVI7KRkoja5uTvi7A==)
     > 店主は以前、キッチンカーでだし巻き玉子サンドを販売するなどの経験を経て、客との直接の触れ合いを大切にしたいという思いから、長年の夢であった店舗を持つことを実現させました。店主は毎月変わる銘柄豚と銘柄米の選定に強いこだわりを持っており、特に千葉県産の「林SPF豚」のような珍しい銘柄豚を取り扱うなど、肉への並々ならぬこだわりがうかがえます。また、米についてもとんかつとの相性を意識して厳選し、五ツ星お米
  2. [店主のキッチンカー経験、客との触れ合いを重視する姿勢、銘柄豚・米の選定へのこだわり、お米マイスターからのアドバイス、低温調理と羽釜炊きご飯の提供スタイル、地元メディアでの紹介を裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFKi9JqZFNuThFI0oomxaXyjQjZ7-UROWVumwnY19_Z7k6KGWNdp97E49pR2HFD609Q2Yx6G5wjaJ68hwf83hAX6DK06gJzKAbHY2_tqZLQMV-bKYiI9yySjYAEsSgWAtk=)
     > 店主は以前、キッチンカーでだし巻き玉子サンドを販売するなどの経験を経て、客との直接の触れ合いを大切にしたいという思いから、長年の夢であった店舗を持つことを実現させました。店主は毎月変わる銘柄豚と銘柄米の選定に強いこだわりを持っており、特に千葉県産の「林SPF豚」のような珍しい銘柄豚を取り扱うなど、肉への並々ならぬこだわりがうかがえます。また、米についてもとんかつとの相性を意識して厳選し、五ツ星お米
  3. [東海テレビ「yum-yumグルメ」での紹介を裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEtzOBGIayI33VKm_mfEpNHxhAxY1rzI2MOnvr6unf8Wg51pcTJsPICoQ_1Hhw9nUUtfplhkfV0GnGjt5ZHmv7qCSGFAimUdJ6z5-BJAJ2NCu33IYvUIdhBJ6KghlsXMkQXtJxTQEebDCbm9g==)
     > 「とんかつ朱寿」は、東海テレビの「yum-yumグルメ」で紹介されています。
  4. [東海テレビ「yum-yumグルメ」での紹介を裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFT1DrHAB_8KxHQ6z380VkoR0hEAxXcjDBb5LFy2FZPeL3pTZuGHCC6Ewy_4XykX2TYS6VPAisXatWHd8g5MsT8f0HVGKGS9mD27uPt7yC4Mb_EOBREDwmK1u_aKUcJ2QguQBoE3uxzA5tpPZUY3uB0OtW6G_-sdSj6wQz2)
     > 「とんかつ朱寿」は、東海テレビの「yum-yumグルメ」で紹介されています。
  5. [店主の真面目さ、こだわり、接客の質の高さが高評価されていることを裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGM8R64eoRIdUWFk_V0PGGhBJAr_jXVwqbqZGArkQgTWaXtsAPcK-cWfAm0QzKx1xY6sm7DXqrWqLn4_az75myAreWkuiBygc0_NvKhKKhYtMX7BN6NXVh1ehGIxLRypD0EgzOREQrDFPMfDo6-shQF7YpI2CpvDT85VWc43RuKFlAPwVWWu8XKCqo69qXzSG9bvuehmnFJvAQkOZLdYyoUkxcmVc5tj9Pu1Zxt4VAEIc-x5fTjz6pC5vRNnF8XdlXd-CBxmXVylg_GFZJ2jK8NZxRVwJJ7OqbuwkHCyFWk6A4Q6LXbXXjnV7k1vY6D)
     > 客からは「店主さんの接客が物凄く心地よかった」、「店主の真面目さと良い意味でのこだわりが繁盛店たる所以」といった評価が見られます。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J004558109 -->

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

### ぴよりんshop（名駅 / スイーツ専門店・★4.1）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 名古屋の新名物として、名古屋コーチンの卵を贅沢に使った本格的な味わいと、手作業で生み出す愛らしい見た目を両立。SNSでの自然発生的な話題化や新店舗展開で、ブランド価値を高め続けている点が注目されます。
- **insiderNote**: 名古屋を代表するスイーツを目指し、素材と手作りにこだわる。SNSでの自然発生的な話題化に加え、新店舗で世界観を深掘りし、ブランド力を強化する戦略は注目に値する。
- **sources_used**:
  1. [名古屋の新名物スイーツとして紹介されていること、SNSでの話題化が知名度向上に貢献したこと、名古屋コーチンの卵を使用し本格的な味わいであること、手作りであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHdofwULVsFrLDLR2NEgIuVIhqRQW08N4QWRDu0KREp5pw5m3cokgNu7tKOWxGOHoBhpn46ShavmvS5DSnw8LK75mUGlX7TGotsJXL59_7ex1E2evwBrrnf-SyVhhvPTjnqodnrZLlPM5I2)
     > 「ぴよりん」は「名古屋の新名物スイーツ」として、地元グルメメディアで広く紹介されています。特に、2019年頃からSNSで「#ぴよりんチャレンジ」が話題になったことや、2021年に将棋の藤井聡太棋士が対局中のおやつに「ぴよりんアイス」を選んだことがニュースとなり、全国的な知名度を獲得しました。名古屋コーチンの卵を使用することで「他にはない、なめらかでしっかりとした味わいのプリンが生まれる」とされてお
  2. [「ぴよりんvillage」のオープンを通じて、ぴよりんの世界観やブランドの魅力を伝える取り組みが行われていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEqaQ2eJ4vVA75dkJ_OrqqSWOKv6O7SQblVKYfBWdI4sDpIxfZZvaAWqseD3jj7bqxNB6GSKuy6K2fXqpoFy9NGoQO55NAbIWBbW38L8rnsuXp9eFEz)
     > ぴよりんの世界観やブランドの魅力を深く伝えたいという課題意識から、公式サイトのリニューアルや「ぴよりんvillage」のオープンを通じて、ぴよりんの誕生から現在までの歩みをストーリーとして紹介することにも力を入れています。
  3. [複合型新店舗「ぴよりんvillage」がオープンしたこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHb8MPoTUCQj7Q0wZChyX6wwV2XMm8PGI1QPSNhYnXf2BuqIO-MCh1vtEjGGHoQ_sMb5SgWB569xon4tH-MnbXPMq6EiaEb85-cRqtW3-2Qrmgwb1k6NA==)
     > 2026年6月15日には、名古屋駅中央コンコースにカフェと物販を組み合わせた複合型新店舗「ぴよりんvillage」がオープンしました。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_ぴよりんshop -->

---

### 焼肉神宮 金山本店（金山・神宮前・熱田区 / 焼肉・ホルモン・★4.1）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 食べログ百名店に最多4度選出、HOTレストラン2025も受賞する実力店。名物生ハンバーグが話題を呼び、金山で予約困難な人気を誇ります。その確かな実績と話題性が、業界からの高い評価を裏付けています。
- **insiderNote**: 品質第一主義を掲げ、厳選素材と徹底した品質管理を徹底。オーナーの食べ歩きがメニュー進化に影響を与え、地域社会との調和も重視する経営姿勢が伺えます。
- **sources_used**:
  1. [食べログ百名店とHOTレストラン受賞、名物生ハンバーグが話題である事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGfPhVPWn0HCsjtngwjfuAGPMUd_uxzySxFM-q85nX4GotHZ7XGQmqi065o3Gs-bl8gSzm7ya27JeYUHJiqFnrk5zdIalZ8WLsjieDKZcwcEYZK1oMMtyi1tNACDEigyaNx1an4kA==)
     > 「食べログ百名店」には2025年に最多4度目の選出を果たしており、「HOTレストラン2025」も受賞しています。特に、4個500円の「名物生ハンバーグ」が話題となっており、食べログ百名店に選ばれる理由の一つとして挙げられています。
  2. [金山で予約困難な人気店である事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEu4QWq17RM0ZieoHx8IQOyN2Vd9a5-JXthJb-hmRTXk-NYD1_E9l4T2SIKoAR9nIQuaUBGTTJpmdZ9FXXL0iqdZrQu7VjwILyMqoxSuRQOIThEH4MQtYOKTT6xoOpvwZXev_fMSA==)
     > Instagramのグルメアカウント「ナゴグル」でも紹介されており、金山で予約が取りづらいほどの超人気店であることが伝えられています。
  3. [金山で予約困難な人気店である事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGuckaJWLTLLv5Y52C7_bR_xSgMjUV-g09tMR-YLRcZMWeivDCQHpaTxTqKzvvev2yMCeM03sKA4flRkqu1HDJpFA_4mpMUvAd9gDQ14bJD30l0L1qzX2A0DazoOz63vGaUL5z9r9O6zlhj)
     > Instagramのグルメアカウント「ナゴグル」でも紹介されており、金山で予約が取りづらいほどの超人気店であることが伝えられています。
  4. [品質第一主義、厳選素材と品質管理、オーナーの食べ歩き、地域社会との調和と地域貢献への姿勢](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGAkatCYr62_aEdvvWjx0SjcHfpWQcJkFEs6GzMsGu0MaM8TRhcj-HJhuv6k5Fhn6tD7xpmFPUa6g8IC2MqQdWTMuZkirtK5f1hopC6uxCz80IxxWU=)
     > 同店は「品質第一主義」を掲げ、厳選された素材と徹底した品質管理により、最高の食体験を提供することを目指しています。オーナーは食べ歩きが好きであるとされており、これがメニューの進化にも影響を与えている可能性があります。地域社会との調和を大切にし、地元の食材を積極的に取り入れ、地域に愛される店作りを目指すとともに、地域経済の発展にも貢献しています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J001265259 -->

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

### 覚王山カフェ Ji.Coo. ジクー（本山・覚王山・藤が丘 / イタリアン・フレンチ・★3.9）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 味・サービスへの妥協なき追求と、日本紅茶協会認定の高品質な紅茶、旬の食材を活かした手作り料理が魅力。モーニングからディナーまで通し営業で、幅広いシーンで利用できる利便性も兼ね備え、地元メディアでの紹介も多数。
- **insiderNote**: 日本紅茶協会「おいしい紅茶の店」認定や、無農薬野菜・自然農法野菜へのこだわりは、品質追求の姿勢が明確。通し営業で多様なニーズに応える点も評価できる。
- **sources_used**:
  1. [コーヒー・紅茶の提供スタイルへのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFN-RwGspD7jHWshp9RnYv3ZtgbJO7gjxxtdTo47_R2Dh3Td54Wrwh4JXBm814NkAuoQe10nOahb39oa-mW0MRuPez7CYdu8g5U4uH8KEwviF3tK6pZt_6EKtz7fgLDwABj2Q==)
     > コーヒーは注文を受けてから一杯ずつペーパードリップで丁寧に淹れ、紅茶は2つのポットを使い分けることで、2杯目以降も渋くならないよう工夫されています。
  2. [モーニングからディナーまでの通し営業](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFN-RwGspD7jHWshp9RnYv3ZtgbJO7gjxxtdTo47_R2Dh3Td54Wrwh4JXBm814NkAuoQe10nOahb39oa-mW0MRuPez7CYdu8g5U4uH8KEwviF3tK6pZt_6EKtz7fgLDwABj2Q==)
     > モーニングからランチ、ディナーまで幅広い時間帯で利用できる通し営業を行っており、朝から夜遅くまで営業しています。
  3. [日本紅茶協会「おいしい紅茶の店」認定](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFN-RwGspD7jHWshp9RnYv3ZtgbJO7gjxxtdTo47_R2Dh3Td54Wrwh4JXBm814NkAuoQe10nOahb39oa-mW0MRuPez7CYdu8g5U4uH8KEwviF3tK6pZt_6EKtz7fgLDwABj2Q==)
     > 日本紅茶協会から「おいしい紅茶の店」として認定されています。
  4. [自然農法野菜へのこだわりと料理の品質](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFN-RwGspD7jHWshp9RnYv3ZtgbJO7gjxxtdTo47_R2Dh3Td54Wrwh4JXBm814NkAuoQe10nOahb39oa-mW0MRuPez7CYdu8g5U4uH8KEwviF3tK6pZt_6EKtz7fgLDwABj2Q==)
     > 自然農法の新鮮野菜を使用した料理が魅力とされており、特に「特製煮込みハンバーグ」は肉汁たっぷりで絶品と評されています。
  5. [味・サービスへの妥協なき追求](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzLpzwfXaFetLs0NuscP3oFhbx8DVrTphoKto5htd3x0-35QXCYuSNosI1lmRbbwiFzdsToWd9DAR3sFQlhR0dIW6koOXp1hljXxWQ0IxBcW5cH9f4L7tO)
     > 「覚王山カフェ Ji.Coo. ジクー」は、味・サービスともに妥協せず本物を追求し続けています。
  6. [日本紅茶協会「おいしい紅茶の店」認定と紅茶へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzLpzwfXaFetLs0NuscP3oFhbx8DVrTphoKto5htd3x0-35QXCYuSNosI1lmRbbwiFzdsToWd9DAR3sFQlhR0dIW6koOXp1hljXxWQ0IxBcW5cH9f4L7tO)
     > 紅茶は厳選された茶葉と淹れ方にこだわり、日本紅茶協会から「おいしい紅茶の店」として認定されています。
  7. [旬の食材を活かした手作りスイーツ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzLpzwfXaFetLs0NuscP3oFhbx8DVrTphoKto5htd3x0-35QXCYuSNosI1lmRbbwiFzdsToWd9DAR3sFQlhR0dIW6koOXp1hljXxWQ0IxBcW5cH9f4L7tO)
     > スイーツは旬の食材を厳選し、手間ひまをかけて手作りされており、低糖質のメニューも推奨されています。
  8. [無農薬野菜や自然農法野菜へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzLpzwfXaFetLs0NuscP3oFhbx8DVrTphoKto5htd3x0-35QXCYuSNosI1lmRbbwiFzdsToWd9DAR3sFQlhR0dIW6koOXp1hljXxWQ0IxBcW5cH9f4L7tO)
     > 無農薬野菜や自然農法の新鮮野菜にこだわり、体にも心にも優しい、安心して食べられるメニューを提供しています。
  9. [モーニングからディナーまでの通し営業](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFSpZKaOk9ZYaceR_6yLFZWPFxiFIQOtL7oEOHD2NdxfO8SNf2pXOMX-PxgEvdUcwTMjLpmoVTFkADBijC4FF4WsGDo9LWVLWO8Gf1FJVsuuC57BHH9sNd2amjKoWD7_ViAp2iKl381xzmUC_zw)
     > モーニングからランチ、ディナーまで幅広い時間帯で利用できる通し営業を行っており、朝から夜遅くまで営業しています。
  10. [地元グルメメディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTOpAievXRakL2jZHZkhFhh2IvwiPDJEb34RsUqpPGpC5nU7hcwZZGwXlBlEcL5IbnRu2JISIiZ7Pvzm63IJULveiUi-lAKr859HDbs3glW7sFrJdApb7Q0oieewYP10l4ABobydwXI2Q-tdGiAc5bF5AoNPUpf7pwvQ==)
     > Retty（レッティ）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J000397154 -->

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

### 喫茶リヨン（名古屋市中村区名駅 / 喫茶店、モーニング・★3.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 「苦肉の策」として始めた「終日モーニング」が名古屋のモーニングブームを牽引し、その革新性は「モーニング喫茶」の商標登録にも表れています。多くのメディアで紹介され、名古屋を代表する喫茶店として確立された、業界注目の店舗です。
- **insiderNote**: 前オーナーから引き継ぎ「終日モーニング」を成功させた店主の経営手腕と、49年間の喫茶店経営経験が光る。品質へのこだわりと商標登録は、業界における模範的な取り組みと言える。
- **sources_used**:
  1. [多くのメディアで取り上げられている事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzR7snnhsimmIVwxK5BjEhL8O1hrNduvaJPIHtMYCznEDsE4EnhV247elIzs-ilGTNyWuUyRgBbEIr_SZivuqutMInM1YR9YhW1IG3pccCvVo5dDw9giTtYdg2jOrCgEw4)
     > 雑誌や本などの多くのメディアで取り上げられることが多くなり
  2. [名古屋を代表する喫茶店としてメディアで頻繁に取り上げられている事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEmKKK_1SlIPmvNB7qR8tgBITOS-BtRUzoOf0MlMfqiQcBT8ZnZLS4kMepxsqTOXX44SK0W2dlabf-oEr5aBZpnWEVplyoqtp4Q5JWzKS6oVj61rK0BUw_QHgBO1F3lYOLc27s48bTBP4v_HwL0CU4GQRx8dB0NzRU=)
     > 芸能人や各メディアでも頻繁に取り上げられる、名古屋市を代表するモーニング喫茶
  3. [品質へのこだわりとして「本間製食パン」を使用している事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEW1C6oyo6m65R1h_jHpyN8Oq6Vu1AoWwmqiSRXn8RFDHXbChOr7GKqpWb9fmJ6QbuxuZZ2EmodYcTCTKvy5SAW7TcNJjqYzCyRhALPUxH552sNlQ21Z7zjTbqWNlFkzS8VL9YHTfZ42meRPdXDoQ-P52Htdtq_8obBBu1_Jw1q3-UXUT15pf1J2AfMBpLIcYhzd8mlemtXYe5M0syX7mVP4aessHEMaOfGRx4tE4S5QlbvjApUzKzwrOkoq29tBdQUwx6a0rIHwmW1RQUmJjOGK4RPLIY=)
     > 「サービスといっても質を落とさず美味しさを提供したい」というこだわりから、プレスサンドにはふわふわとした食感が楽しめる「本間製食パン」を使用しています。
- **warnings**: 6件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_喫茶リヨン -->

---

### 珈琲 ぶりこ（栄(ミナミ)/矢場町/大須/上前津 / カフェ・スイーツ・★3.9）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 築70年以上の古民家をリノベーションした趣ある空間で、地元の八丁味噌や自家製発酵食品にこだわったメニューを提供。ランチからスイーツまで質の高い料理が揃い、多数のメディアで紹介される名古屋を代表するカフェとして注目されています。
- **insiderNote**: 築70年以上の古民家をリノベーションした空間で、地元の八丁味噌や自家製発酵食品を取り入れたメニューが特徴。多数のメディアで紹介されており、質の高い料理と独自の空間演出で地域に根差したカフェとして評価されています。
- **sources_used**:
  1. [築70年以上の古民家をリノベーションした町屋カフェであること、昭和レトロな空間であること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdsY8kC76POhRuF_uqp45J2w-J3TWat2-fX6yfkfy-m_ZZNn9FplGOiYVXxNBlY6ZccNXM2VBhZJ1ulk_VacJTBsvDmzb4jnMrSMKPox99V83yZTJVloTNk4mQb566fmkp8C_S8tXMgaatoEhjcpaS)
     > 「珈琲 ぶりこ」は、築70年または75年の古民家をリノベーションした町屋カフェとして知られています。店内は昭和レトロな空間が特徴で、ゆったりとした雰囲気が魅力です。
  2. [築70年以上の古民家をリノベーションした町屋カフェであること、昭和レトロな空間であること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGPtSkgPUrSxEXFDhAzy6n3Tc4XTMzWGbEnYBG6_tc45pkuj3gWJ9n_MLzGm-Fbr-4WjQGeAjcwoPaX7xqsM5HsPzFGYmsobq8KIRC6RNZ4uHylE1ITTZy7HhiSnhYnmlMohIrwa_t1FaM7VA==)
     > 「珈琲 ぶりこ」は、築70年または75年の古民家をリノベーションした町屋カフェとして知られています。店内は昭和レトロな空間が特徴で、ゆったりとした雰囲気が魅力です。
  3. [地元の八丁味噌を使用していること、自家製の発酵食品を取り入れたメニューを提供していること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdsY8kC76POhRuF_uqp45J2w-J3TWat2-fX6yfkfy-m_ZZNn9FplGOiYVXxNBlY6ZccNXM2VBhZJ1ulk_VacJTBsvDmzb4jnMrSMKPox99V83yZTJVloTNk4mQb566fmkp8C_S8tXMgaatoEhjcpaS)
     > 「一汁三菜膳」の味噌には、岡崎の伝統製法である八丁味噌と有機八丁生味噌の2種類をブレンドしており、地元愛とこだわりが感じられると評されています。また、自家製の発酵食品を取り入れたフードやドリンクを提供しており、自家製発酵レモンを使ったハニーリモーネや、注文を受けてから点てる抹茶ラテ、抹茶ソーダなどが楽しめます。
  4. [地元の八丁味噌を使用していること、自家製の発酵食品を取り入れたメニューを提供していること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGPtSkgPUrSxEXFDhAzy6n3Tc4XTMzWGbEnYBG6_tc45pkuj3gWJ9n_MLzGm-Fbr-4WjQGeAjcwoPaX7xqsM5HsPzFGYmsobq8KIRC6RNZ4uHylE1ITTZy7HhiSnhYnmlMohIrwa_t1FaM7VA==)
     > 「一汁三菜膳」の味噌には、岡崎の伝統製法である八丁味噌と有機八丁生味噌の2種類をブレンドしており、地元愛とこだわりが感じられると評されています。また、自家製の発酵食品を取り入れたフードやドリンクを提供しており、自家製発酵レモンを使ったハニーリモーネや、注文を受けてから点てる抹茶ラテ、抹茶ソーダなどが楽しめます。
  5. [自家製の発酵食品を取り入れたメニューを提供していること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEmerrtTsbnLdajrqceVO49fBJ0hyRw5eNN3qKTQh0nNIYZAalE9oGIoF-IRaRJkj5KxhWVuwtRkuj6KjUotNtz5nZOG6J7fpaSAh2xHXON_JYvczSGJVfX3Ab-scCDMXX0CzYfoz4D0eybCVAQZobteue8zYUN_Q==)
     > 発酵食品を積極的に取り入れており、「身体にも嬉しい食事が頂けます」という声もあります。
  6. [自家製ケーキやパフェ、ランチメニューの質の高さが評価されていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdsY8kC76POhRuF_uqp45J2w-J3TWat2-fX6yfkfy-m_ZZNn9FplGOiYVXxNBlY6ZccNXM2VBhZJ1ulk_VacJTBsvDmzb4jnMrSMKPox99V83yZTJVloTNk4mQb566fmkp8C_S8tXMgaatoEhjcpaS)
     > 料理の質については、自家製のケーキやパフェが「とても美味しい」と評価されており、特に抹茶のチーズケーキは好評です。ランチの「自家製豚角煮のひつまぶし」は、3日間かけて煮込まれた豚角煮が「トロトロ、ホロホロにほどける」と評され、甘じょっぱいタレと相まって「最高にごはんが進む」とされています。
  7. [自家製ケーキやパフェ、ランチメニューの質の高さが評価されていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGPtSkgPUrSxEXFDhAzy6n3Tc4XTMzWGbEnYBG6_tc45pkuj3gWJ9n_MLzGm-Fbr-4WjQGeAjcwoPaX7xqsM5HsPzFGYmsobq8KIRC6RNZ4uHylE1ITTZy7HhiSnhYnmlMohIrwa_t1FaM7VA==)
     > 料理の質については、自家製のケーキやパフェが「とても美味しい」と評価されており、特に抹茶のチーズケーキは好評です。ランチの「自家製豚角煮のひつまぶし」は、3日間かけて煮込まれた豚角煮が「トロトロ、ホロホロにほどける」と評され、甘じょっぱいタレと相まって「最高にごはんが進む」とされています。
  8. [複数の地元グルメメディアや情報サイト、テレビ番組で紹介されていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdsY8kC76POhRuF_uqp45J2w-J3TWat2-fX6yfkfy-m_ZZNn9FplGOiYVXxNBlY6ZccNXM2VBhZJ1ulk_VacJTBsvDmzb4jnMrSMKPox99V83yZTJVloTNk4mQb566fmkp8C_S8tXMgaatoEhjcpaS)
     > 「珈琲 ぶりこ」は、複数の地元グルメメディアや情報サイトで紹介されています。具体的には、「旅サラダPLUS 観光・お出かけSPOT」、「じゃらんnet」、「Retty（レッティ）」、「ホットペッパーグルメ」、「ことりっぷ」、「フォートラベル」、「名古屋情報通」、「NAVITIME Travel」、「ナゴレコ」、「HAMONI」、「テレビ愛知 大須探検隊」、「ニッショー」などで取り上げられています。
  9. [複数の地元グルメメディアや情報サイトで紹介されていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEIFiZDLQKEaj3DqGPXUSJdPGu5jllSNcpumAY_Xzn3fSpvy402cOoWfwpgUTjjgSFlRYxNdCBAoUdXfMWsYhJZWpn1AQwlzvx69AHzgYc_v7hYss_h1P0SZWYbM6OB5wne-RYFMitPUCI=)
     > 「珈琲 ぶりこ」は、複数の地元グルメメディアや情報サイトで紹介されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J000108015 -->

---

### 喫茶、食堂、民宿。なごのや（名古屋市西区 / カフェ、定食・食堂、居酒屋・★4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 老舗喫茶店を継承し、喫茶・食堂・民宿を複合させた「街の社交場」として、地域活性化に貢献。名物たまごサンドは復刻のこだわりとグッズ展開で、単なるメニューを超えた魅力を発信している。
- **insiderNote**: インバウンド事業経験を持つ店主が、老舗喫茶を継承し地域活性化を目指す。複合施設として多様な人々が集う「街の社交場」を創出し、名物たまごサンドのブランディングも秀逸。
- **sources_used**:
  1. [老舗喫茶店「西アサヒ」を継承し、地域活性化を目指していること、名物たまごサンドが復刻メニューであること、店主がインバウンド事業経験者であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEu1vYf3uzhRYhPTXeZxeNynF_2uO71ZomZxP-ZtYi4GSiAnsJYdNWhKhXSToLGtxf74IJi3SYpwwBcwzwJRmgkwnKnVxxof9mMY7cJEJpbKsiyced2Ni90EX4PP7Si68tz5WG2e2k=)
     > 昭和7年創業の老舗喫茶店「西アサヒ」の大部分を受け継いでおり、西アサヒが培ってきた良さを尊重しつつ、時代に合わせて新しいものを取り入れることにこだわっています。店名「なごのや」には、円頓寺商店街で100年続く新たな老舗となること、そしてお年寄りから若者、日本国内から全世界の人々まで、誰もが集い居心地よく過ごせる「家のような場所」にしたいという想いが込められています。名物である「たまごサンド」は、西
  2. [喫茶・食堂・民宿の複合施設であり、「街の社交場」を目指していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHYK6WmAqkXhZ8dOLndTpcQ7fYB-VdosmUNS1JzDqiQsiIz0N6apvRctjClOhPi2tYw8141S9P_w6FT0ODZorokTE_4SEh5aYqEFzVQfeoFsN9wgtxz_oipW2gDd3q8)
     > 「喫茶、食堂、民宿。なごのや」は、その名の通り、喫茶、食堂、民宿の機能を併せ持つ複合施設です。1階は喫茶・食堂、2階は宿泊施設となっており、地域の人々と世界中の人々が自由に交流できる「街の社交場」となることを目指しています。
  3. [たまごサンドのグッズ展開によるブランディング](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHy_s5zYiLleATRneLIV7hGSPfc3NseCy9EZ2hcrIsJ91AOS3oqhsJjgguUsS_M2DNpzf0ebxyKBDgGeoX7y2o4TuNj_3ByZjpbBuACFoMsuTfLHpU=)
     > たまごサンド柄のオリジナルグッズ「タマゴサンドコレクション」を制作・販売するなど、単なる料理に留まらない魅力を発信しています。
  4. [ゲストハウス兼喫茶店という複合施設であり、地域活性化の拠点としての役割を担っていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGdupT5GAmg8PNTM0tjn8fMiXCqzK3EmhoxtyBxM8AYBiZBYDgT0wfyTbvDKI4UROMkBR4bQXSttiq_tIABFdUpArSeZqTHGRuuesNWmc1elzg3IbKtHqIdgpdxbAVQEUyA4NE-w_w=)
     > インバウンド観光に特化した情報サイト「やまとごころ.jp」では、「古き良き商店街にあるゲストハウス兼喫茶店に、たくさんの“人”が集まる理由」と題し、地域活性化の拠点としての役割が紹介されています。
  5. [たまごサンドが名物であり、円頓寺の交流拠点であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHtcUY4nDBmJMEJ0XkrL9Ayu4luLtZeZPj1Sa6vvAERH5WpF5KCEwnZzC2IRyb9YzDwmhYWahTi9tPhwsqNBZMp5nqdqLmfX8i1Pfz3_AdlnEgXbg6ZkrkKQnE=)
     > 名古屋の観光ガイド「エキ・シロ」では、「ふわふわのタマゴサンドが名物！円頓寺の交流拠点」として掲載されています。
  6. [老舗喫茶店を継いだ宿であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE27NDSPa-DDo2faQVD3UqzS9XRlw9L7fiesaQRawfYTa_1_sO0vI4tAOjIjmt6wtak3iVB8ipsvLnTjpdDY38n3ynV1e5706rc3BLbSX0K5XU6byCwuTbSeXQqjAsWGSuWSRY7kDUV)
     > ゲストハウス専門サイト「GUEST HOUSE」や「FootPrints」でも、老舗喫茶店を継いだ宿として、たまごサンドと共に紹介されています。
- **warnings**: 3件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_喫茶、食堂、民宿。なごのや -->

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

### キング軒 名古屋大須店（大須 / 汁なし担担麺・★3.8）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 広島発の汁なし担担麺専門店として、「30回混ぜる」独自の食べ方を推奨。辛さのカスタマイズ性も高く、多数の地元メディアで紹介されるなど、大須エリアで高い注目を集めている。
- **insiderNote**: 「ザ・広島ブランド」認定店として、短時間提供オペレーションとカスタマイズ性で大須のランチ・回遊需要に合致。名古屋大須店限定メニューも展開し、全国展開を加速する戦略が注目される。
- **sources_used**:
  1. [キング軒が広島発の汁なし担担麺専門店であり、30回混ぜる食べ方を推奨していること、および複数の地元グルメメディアで紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEyt7tH0gDN68ttx-w9epb1qcQphOi8AG__s1MY0fUEPK0rGOsNHTDBgiAViGWO0mpUdaXCjKRNMuUfGPqLAOQ16ZXXDp9nP7_ADAX20cauYg5_5keVS-OUwt1IDcUeJCE72wbT07-b5F3-yJxNGrSP3YHKMFcKOtcbulkfFKA3CZOUw6gkMD6VqjTV64tfqfBzteTlEGjdYGw9Kxi3CyLUYwBmYonbO08xVPcELZjjc45ikX5uRhrM1lbDgwzlr3YOAOyiXMFN9_a8n5efkmAQEwIKPEGm22r-t44ZyciLw5QSRePb4pEmstD2IMk1mLE3pL-WqyL8rAbyUZ5_yfb19DZWDY5QFh5T4_39gw8=)
     > 広島の“中毒メシ”が上陸！「キング軒」20号店が4/3オープン。30回混ぜて完成する「汁なし担担麺」のシビれる旨さを体感せよ！
  2. [30回混ぜる食べ方を推奨していること、短時間提供オペレーションとカスタマイズ性が大須エリアの需要に合致すること、名古屋大須店限定メニューがあること、および全国展開を加速する方針であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdTvo31sELCYRRvSYXrLRskPDC_U95gu8ETGbo7heZpXKZ7oOoSYG2amZDi22TLDKQBvDYB3DwcDP5Anpum8ilVrlowQbLxtNGs2amHU1lNY0jydRTCS9GHkizRUIupA==)
     > 株式会社キングファクトリーグループ代表の尾関剛氏は、「キング軒の汁なし担担麺は、お好きな辛さをお選び頂き、30回混ぜる工程も含めて楽しんでいただける一杯」とコメントしています。
  3. [キング軒が広島発の汁なし担担麺専門店であり、辛さを好みに応じて選べるカスタマイズ性があること、および複数の地元グルメメディアで紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFM5EYOfhPpb38m0hYp6sEH5eHSbgszWBYJdfuoYbwSIrkLIduFXT3Xch8G1EF1JifKx4GKH1_GBjl0nRsq5IL6mgLz9-0gmjSCUcT7TzqJw6gML4kn2GvHs7nqB7x7)
     > 広島発「汁なし担担麺」の「キング軒 名古屋大須店」誕生！辛さも楽しみ方も自由自在
  4. [キング軒が広島発の汁なし担担麺専門店であり、辛さを好みに応じて選べるカスタマイズ性があること、および複数の地元グルメメディアで紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGl19cd-74daz_EILwMbH5kVcIwxanZqZpQsNpkmK2v-LEPX4wEH2Qk-0jNNLzsxCQtyS3HHVvUKg-hefBvZZ_dlno0Q55GUcYAe3Tv2jPKGyajbJAlzH4O1zGHfC6DpThrmeBu)
     > 広島発「汁なし担担麺」の「キング軒 名古屋大須店」誕生！辛さも楽しみ方も自由自在
  5. [キング軒が広島発の汁なし担担麺専門店であり、複数の地元グルメメディアで紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGzTVLOEXalFxxvT9-I-40XCpQPc_hkWO6gB5JCZsXh2K4w6pM1pPzKe734Cpp_pIjSNxyB2_JpKtsSI_H5lvECoI_BXzAIhmMqLC3fq51pR8pEdDjxDDKz3ALDykY=)
     > 広島名物・汁なし担担麺専門『キング軒』の名古屋2号店が大須にオープン！
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_キング軒名古屋大須店 -->

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

### 名駅立呑 おお島（名駅 / 立ち飲み・海鮮・★4.1）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 名古屋では珍しい完全立ち飲みスタイルで、柳橋直送の鮮魚や熟練板前が手仕込みする酒肴をリーズナブルに提供。老舗居酒屋のDNAを受け継ぎ、質の高い和食を気軽に楽しめる点が業界注目の理由です。
- **insiderNote**: 名古屋で3代続く老舗居酒屋の実家を持つ大将が、割烹品質の鮮魚と手仕込み料理を立ち飲みで提供。そのこだわりが光ります。
- **sources_used**:
  1. [名古屋では珍しい完全立ち飲みスタイルであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIpeJCQznn1pd575L21C5tohccZfdaI3NFP1PHG6X3Is2eX9P-dhAiBtIT7KnUT0eNCkbMhNURjb3dsW5Ud-757cIy3L-iyIivyAHEpXa2s3nbgBdeYQ==)
     > 名古屋ではまだ珍しい「完全立呑みスタイル」の気軽な和食店です。
  2. [名古屋では珍しい完全立ち飲みスタイルであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFadGqzN5BYzpfl834Szf93XO6KOnwsaVqEvUJz0wGo90ocWqV3Cys5lMI674R3fgzZxGzQE3pk3o62Ib2NypJYEnkz-W1G8L1dFSB_K13ByJ_1hNB-UtDzByP3ou0UYvvGPP4=)
     > 名古屋ではまだ珍しい「完全立呑みスタイル」の気軽な和食店です。
  3. [柳橋直送の鮮魚を割烹品質で低価格提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIpeJCQznn1pd575L21C5tohccZfdaI3NFP1PHG6X3Is2eX9P-dhAiBtIT7KnUT0eNCkbMhNURjb3dsW5Ud-757cIy3L-iyIivyAHEpXa2s3nbgBdeYQ==)
     > 柳橋の卸店から系列の割烹と同じ品質の鮮魚を仕入れ、立ち飲みスタイルならではの低価格で提供している点
  4. [柳橋直送の鮮魚を割烹品質で低価格提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFadGqzN5BYzpfl834Szf93XO6KOnwsaVqEvUJz0wGo90ocWqV3Cys5lMI674R3fgzZxGzQE3pk3o62Ib2NypJYEnkz-W1G8L1dFSB_K13ByJ_1hNB-UtDzByP3ou0UYvvGPP4=)
     > 柳橋の卸店から系列の割烹と同じ品質の鮮魚を仕入れ、立ち飲みスタイルならではの低価格で提供している点
  5. [熟練板前が手仕込みの酒肴を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIpeJCQznn1pd575L21C5tohccZfdaI3NFP1PHG6X3Is2eX9P-dhAiBtIT7KnUT0eNCkbMhNURjb3dsW5Ud-757cIy3L-iyIivyAHEpXa2s3nbgBdeYQ==)
     > 長年和食の板前として腕を振るう大将が、日本酒によく合う酒肴の数々を毎日気合を入れて仕込んでいるとされています。
  6. [熟練板前が手仕込みの酒肴を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFadGqzN5BYzpfl834Szf93XO6KOnwsaVqEvUJz0wGo90ocWqV3Cys5lMI674R3fgzZxGzQE3pk3o62Ib2NypJYEnkz-W1G8L1dFSB_K13ByJ_1hNB-UtDzByP3ou0UYvvGPP4=)
     > 長年和食の板前として腕を振るう大将が、日本酒によく合う酒肴の数々を毎日気合を入れて仕込んでいるとされています。
  7. [手仕込み料理の質の高さ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIF_JfiA0XjMXhAL3dwBx32oT9t2Zi9QldpgAH8GtQEK-rz4CdGTktr2IevU69dRjH8NOT3FquUaQUnpg5gsY93exIlLF7HeDrWzxyCkq3yLImfw9Y-ZlYOjdU74_mAif0bA==)
     > 提供される料理は「既製品がないのでは？」と感じさせるほど手作り感があり、「名店の予感」と評されています。
  8. [老舗居酒屋のDNAを受け継ぐ店主の背景](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIpeJCQznn1pd575L21C5tohccZfdaI3NFP1PHG6X3Is2eX9P-dhAiBtIT7KnUT0eNCkbMhNURjb3dsW5Ud-757cIy3L-iyIivyAHEpXa2s3nbgBdeYQ==)
     > 運営会社である大島食品の代表、大島真氏は、名古屋で3代続く老舗居酒屋の実家を持つ背景があり、その経験が店のこだわりにも繋がっていると考えられます。
  9. [老舗居酒屋のDNAを受け継ぐ店主の背景](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFadGqzN5BYzpfl834Szf93XO6KOnwsaVqEvUJz0wGo90ocWqV3Cys5lMI674R3fgzZxGzQE3pk3o62Ib2NypJYEnkz-W1G8L1dFSB_K13ByJ_1hNB-UtDzByP3ou0UYvvGPP4=)
     > 運営会社である大島食品の代表、大島真氏は、名古屋で3代続く老舗居酒屋の実家を持つ背景があり、その経験が店のこだわりにも繋がっていると考えられます。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_名駅立呑おお島 -->

---

### コーヒーハウス KAKO 花車本店（名駅 / 自家焙煎喫茶・モーニング・★3.9）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 名古屋で初めて自家焙煎を導入した1972年創業の老舗喫茶店。店主の「なんでもないことを丁寧に」という信念のもと、コーヒー豆から自家製コンフィチュール、あんこまで手作りにこだわり、喫茶店百名店にも選出されるなど、名古屋の喫茶店文化を牽引する存在として高く評価されています。
- **insiderNote**: 名古屋初の自家焙煎を導入した老舗として、店主の「なんでもないことを丁寧に」という信念が、コーヒー豆の選定から自家製コンフィチュールまで徹底されています。喫茶店百名店選出や料理人からの高評価も納得です。
- **sources_used**:
  1. [1972年創業の老舗珈琲専門店であり、手づくりに努めてきたこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFwqHXxgvq6iXKHwQy2zAMFVrXt8mz01wMlEd4UkzARrVasgRdSk_3SU9uycrJzDnsrndf33u3qCkw39n9ixRNpnwMsiZ5o7BGFkPvfFykk3cFJ1xAreqbnPgIR1Jp7OVRMKk8Mw_77gbCOfsKd8RWCD20eUlz4XJTuWb-MEh0c6CI=)
     > 現店主である土屋賞蔵氏は、1972年の開店以来、「新鮮さ」「生豆」「水」にこだわり、一貫して「手づくり」に努めてきた老舗の珈琲専門店として店を営んでいます。
  2. [店主の「なんでもないことを一つずつ丁寧にやれば、必ずおいしくなる」という信念](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFwqHXxgvq6iXKHwQy2zAMFVrXt8mz01wMlEd4UkzARrVasgRdSk_3SU9uycrJzDnsrndf33u3qCkw39n9ixRNpnwMsiZ5o7BGFkPvfFykk3cFJ1xAreqbnPgIR1Jp7OVRMKk8Mw_77gbCOfsKd8RWCD20eUlz4XJTuWb-MEh0c6CI=)
     > 土屋氏は「なんでもないことを一つずつ丁寧にやれば、必ずおいしくなる」という信念を持ち、毎朝5時半から仕事を開始しています。
  3. [名古屋で初めて自家焙煎を導入し、コーヒー豆の厳選やハンドピックにこだわること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFwqHXxgvq6iXKHwQy2zAMFVrXt8mz01wMlEd4UkzARrVasgRdSk_3SU9uycrJzDnsrndf33u3qCkw39n9ixRNpnwMsiZ5o7BGFkPvfFykk3cFJ1xAreqbnPgIR1Jp7OVRMKk8Mw_77gbCOfsKd8RWCD20eUlz4XJTuWb-MEh0c6CI=)
     > コーヒー豆に関しては、名古屋で初めて自家焙煎を導入したとされており、生豆の厳選はもちろん、焙煎前には欠点豆を一粒一粒手作業で取り除く「ハンドピック」を行っています。
  4. [自家製コンフィチュールやあんこへの深いこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFwqHXxgvq6iXKHwQy2zAMFVrXt8mz01wMlEd4UkzARrVasgRdSk_3SU9uycrJzDnsrndf33u3qCkw39n9ixRNpnwMsiZ5o7BGFkPvfFykk3cFJ1xAreqbnPgIR1Jp7OVRMKk8Mw_77gbCOfsKd8RWCD20eUlz4XJTuWb-MEh0c6CI=)
     > 名物の自家製コンフィチュール（ジャム）についてもこだわりが深く、イチゴやキウイなどは素材選びから行い、銅鍋でじっくり煮詰めています。定番のマーマレードは、ジュースを作るために絞った新鮮なオレンジの皮を下処理して活用しています。あんこは三温糖を使用し、隠し味にドイツの岩塩を加えることで、甘さ控えめに仕上げ、深煎りのコーヒーとの相性も考慮されています。
  5. [老舗喫茶店であり、名古屋初の焙煎コーヒーを提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGUGbcbZeJq7F849d2Fcb3bSmwenJJeOonEN9EUmErNV7zWpZjZVYZPy1gtVva85-5XIDmEqdmC2Ql-SMw6cVh44fXf3XjTFaHYoCDRSxbduy7ZpE5MLlVpDawlRbU=)
     > NAGOYA.（ナゴヤドット）では「【名駅】老舗喫茶店『コーヒーハウス かこ 花車本店』で名古屋初の焙煎コーヒーと新感覚名物を」というタイトルで紹介され
  6. [名古屋で初めて自家焙煎を導入した老舗喫茶店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFal7FE98DWLkxxmg7b4Ww_HvvupdMh4tU5kd06FjLOlJNwZqnBaN2yGDnwFUvsBAt6AZvR4FLxYJFRco_e_hLPSjzC0EJ3GJ-ych81i0OLFzIHEWfc9eGh70_IIPllvUjqj5ET2rVE-TVBdsW2ERo=)
     > Life Designs（ライフデザインズ）では「名古屋で初めて自家焙煎を導入した老舗喫茶店「コーヒーハウスかこ 花車本店」」としてその歴史とこだわりが紹介されています。
  7. [地元グルメメディアでレトロな喫茶店として紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1bumG7IV7NmW6GWbd8fLhIft62xIugDfFvmEZsqEze3z0V6xpARC6rvzxXzzEEfPAuOlp8RNcgfTmeZ2e1JgizBaAKNDEw6kn0ViinjyrEpSX11QVXtuQ8Hleb9oU9eBSCxLRxm2SceKg-E8VV2e7jahydA==)
     > 「コーヒーハウス KAKO 花車本店」は、複数の地元グルメメディアで紹介されています。ニッショーでは「名古屋のモーニングならここ！レトロな喫茶店『コーヒーハウスKAKO（かこ） 花車本店』のシャンティールージュスペシャルが、見た目も華やかでおすすめです」として取り上げられています。
  8. [Rettyや食べログの喫茶店百名店に選出され、名古屋の喫茶店文化を牽引する存在として評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE7Sn8JYJxrGs4BPIHUKMRhtqaPo-ua7fwTPRL1fXrDPeDv7SMlpFwzdR_C6_stwkl7uvhHSzKx0tcwx0TKumixyN5Ve5RsOeeuOuDCdfQkqwIhmheCAgz7iBqfasg777Z51zqj0fzxbMsd6zkW0kK8Wg==)
     > Rettyや食べログの喫茶店百名店にも選出されており、名古屋の喫茶店文化を牽引する存在として評価されています。
  9. [店主の信念と、自家製コンフィチュール、あんこ、自家焙煎コーヒーへの深いこだわりが多くのメディアで高く評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGc_kF3vytujzlKDDF4hiTsxngjzHIEiLFQRD4J6HSLxwszHZxS9YzvUNbeFk20cvllzVYSoHkw1Xc4GzZnCiJYOldbICs5muqDEZN4-2zlh1sTmef6Fm1tbHKZa0PyrtEbY-kN)
     > 店主の土屋賞蔵氏の「なんでもないことを一つずつ丁寧にやれば、必ずおいしくなる」という言葉に代表される、自家製コンフィチュールやあんこ、そして自家焙煎コーヒーへの深いこだわりは、多くのメディアで高く評価されています。
  10. [料理人からも満足度の高い評価を受けていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGc_kF3vytujzlKDDF4hiTsxngjzHIEiLFQRD4J6HSLxwszHZxS9YzvUNbeFk20cvllzVYSoHkw1Xc4GzZnCiJYOldbICs5muqDEZN4-2zlh1sTmef6Fm1tbHKZa0PyrtEbY-kN)
     > グルメサイト「ヒトサラ」では、「コーヒーショップ カコ 花車本店を実際に訪れたシェフの口コミを紹介。ここでしか食べられない料理がある、サービスが絶妙、雰囲気が抜群など、料理人も満足のお店の口コミです。」とあり、料理人からも満足度の高い評価を受けていることが示唆されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_コーヒーハウスkako花車本店 -->

---

### LA VAGABONDE -ラ・ヴァガボンド-（名古屋市中区千代田 / フランス料理・★4.4）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.95
- **editorReason**: 名古屋の美食家を魅了する予約困難なフレンチ。ミシュラン二つ星、ゴ・エ・ミヨ連続掲載の実績が、岩本シェフの独創的で美しい料理と徹底した品質管理の証。特別な体験を求める客層に響く。
- **insiderNote**: ミシュラン二つ星、ゴ・エ・ミヨ連続掲載の評価は、岩本シェフの独創的なフレンチと、1日3組限定で品質を徹底する姿勢の表れ。予約困難な状況がその価値を物語る。
- **sources_used**:
  1. [岩本シェフの独創的で美しいフレンチ料理のコンセプト](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG_YsZyYEw3XMTC5wukd2QLDiwtD55Qrv6ktrYhu4Z_gqHfRx7WyLhltyF9Hk7qVQYUcpGCGdUj3csAn2sqfoza1wl9vEIhPlvZhchrV_-7TRh7C-gPOXEqEroS0HNrErA=)
     > 「LA VAGABONDE -ラ・ヴァガボンド-」は、名古屋市中区千代田に位置するフレンチレストランで、オーナーシェフは岩本龍介氏です。店名の「ヴァガボンド」はフランス語で「放浪者」や「旅人」を意味し、岩本シェフの独創的で美しいフレンチ料理にそのコンセプトが活かされています。
  2. [名古屋の美食家間で評判の「予約の取れないフレンチの名店」であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG_YsZyYEw3XMTC5wukd2QLDiwtD55Qrv6ktrYhu4Z_gqHfRx7WyLhltyF9Hk7qVQYUcpGCGdUj3csAn2sqfoza1wl9vEIhPlvZhchrV_-7TRh7C-gPOXEqEroS0HNrErA=)
     > 「LA VAGABONDE -ラ・ヴァガボンド-」は、名古屋の鶴舞にある人気のフレンチレストランとして知られています。2011年4月14日のオープン後まもなく、名古屋の美食家たちの間で評判となり、「予約の取れないフレンチの名店」と呼ばれるようになりました。
  3. [ミシュランガイド愛知で二つ星を獲得し、ゴ・エ・ミヨに連続掲載されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG_YsZyYEw3XMTC5wukd2QLDiwtD55Qrv6ktrYhu4Z_gqHfRx7WyLhltyF9Hk7qVQYUcpGCGdUj3csAn2sqfoza1wl9vEIhPlvZhchrV_-7TRh7C-gPOXEqEroS0HNrErA=)
     > ミシュランガイド愛知では二つ星を獲得しており、フランス発の本格レストランガイド「ゴ・エ・ミヨ（Gault & Millau）」にも掲載され、16/20点という高評価を得ています。ゴ・エ・ミヨには2022年から2026年まで連続して掲載されています。
  4. [1日3組限定でサービスと料理の品質維持に努めていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG_YsZyYEw3XMTC5wukd2QLDiwtD55Qrv6ktrYhu4Z_gqHfRx7WyLhltyF9Hk7qVQYUcpGCGdUj3csAn2sqfoza1wl9vEIhPlvZhchrV_-7TRh7C-gPOXEqEroS0HNrErA=)
     > 1日の予約組数を3組に限定しており、座席数14席に対して入店人数を常に制限することで、サービスと料理の品質維持に努めています。
  5. [ゴ・エ・ミヨに掲載されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGFcQCBmaYE5Qv8izcnd2oG5YPFtESGGkrZJoxtHxn31zN-C1HkIoZalHuFTAx11EhiJdHRDZKd5tpZvnrhwDEJNFEtV_p2eJfk1SYxY6RzJ2zh692FJyw85M0cRJNstXyFF4aTlY3AW4ctEjy9PbG6)
     > ゴ・エ・ミヨ2026掲載店
  6. [ミシュラン二つ星、ゴ・エ・ミヨ掲載の予約困難なフレンチであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG93YqJYsTd4zerEabPu3TE4h3u8FRDr-3111r_baZdNVzrcA6vMaRpAjsMEaQJu02-MwFe2GhGuXA5nITlW5UvhQipSwUBOZdU_AwhzrKH76fLWohzSxf2dS0GkU-5_HSYqDREwBn0Kih1oocbZDTc-hvkplumnlXMqw==)
     > ミシュラン二つ星、ゴ・エ・ミヨ掲載の予約困難なフレンチ

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_lavagabonde-ラ・ヴァガボンド- -->

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

### ハウセスト ライフ＋カフェ（名古屋市南区 / カフェ、喫茶・★4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 賃貸住宅会社が運営するカフェとして、良質なインテリア空間で過ごす「スペシャルなひととき」を提供。厳選されたコーヒー豆や地元有名店のパン、見た目も楽しい「トーストトリオ」など、細部までこだわり、顧客の暮らしに心地よさをプラスする複合的な価値創造が光ります。
- **insiderNote**: 賃貸住宅会社が手掛けるカフェとして、単なる飲食提供に留まらず、インテリアや暮らしの相談もできる複合業態。顧客のライフスタイルに寄り添う提案力が強みです。
- **sources_used**:
  1. [賃貸住宅運営会社が手掛ける、インテリア空間を楽しむカフェであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEYhml6Fbn_QaKUDQi0CI2xuJiwMckoCIfNA3SPFjW7r0FDvE38viQ-pO9oD8vFCY2TMxm7Yty7ZD-iNvMh-cAgX1MdgISpmXb49lGO9-DQwyQGljMbdQP0lMqtvf7S7EVHnQ==)
     > 名古屋市南区にある「ハウセスト ライフ＋カフェ」は、賃貸住宅運営やインテリアコーディネートを手がける会社が運営しており、コーヒーなどを味わいながら良質なインテリア空間を楽しむことをコンセプトにしたカフェです。
  2. [厳選されたコーヒー豆やパンの使用、および「トーストトリオ」などの工夫されたモーニングメニュー](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEYhml6Fbn_QaKUDQi0CI2xuJiwMckoCIfNA3SPFjW7r0FDvE38viQ-pO9oD8vFCY2TMxm7Yty7ZD-iNvMh-cAgX1MdgISpmXb49lGO9-DQwyQGljMbdQP0lMqtvf7S7EVHnQ==)
     > 提供されるコーヒーは、高浜市の「スギコーヒーロースティング」の豆を使用し、ハンドドリップかフレンチプレスの抽出方法を選べるブレンドや、キャラメルマキアートなどの甘いドリンクも人気です。パンは瑞穂区の「シャルムベーカリー・ポンシェ」の食パンを使用しており、モチモチの食感が特徴です。モーニングサービスでは、ドリンクにバタートーストかシュガートーストが付き、追加料金で小倉トーストやチーズトーストに変更も
  3. [モーニングの「トーストトリオ」が地元グルメメディアで注目されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHWF2kZVibQDN-NGkT5ibHhifcKyjMvDRiklPaoooeqMTUWW0aPvJuC-nW_0UPG8NHJ1rdhw03hBuk46xb1L2EL7uxktmlA42e9V8-0E9LHyiXiwftv12RgEeZaxRlgKVD0X54VMWwK1bUjb3wM4QXbyg==)
     > 特に、モーニングの「トーストトリオ」や野菜たっぷりのオープンサンド、季節のフルーツを使ったデザートなどが注目されています。
  4. [おしゃれな空間デザイン、ゆっくり過ごせる雰囲気、器へのこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEYhml6Fbn_QaKUDQi0CI2xuJiwMckoCIfNA3SPFjW7r0FDvE38viQ-pO9oD8vFCY2TMxm7Yty7ZD-iNvMh-cAgX1MdgISpmXb49lGO9-DQwyQGljMbdQP0lMqtvf7S7EVHnQ==)
     > 店内は木の温もりを感じる明るい空間で、2名席中心の10席ほどの小さな店内は、おしゃれな雰囲気です。席の間隔や空気感が柔らかく、急いで食べて出る感じになりにくいため、一人でも居やすく、友人との会話も自然にゆっくりになるといった、心が整うような「スペシャルなひととき」を過ごせる空間が提供されています。コーヒーの器にもこだわりが見られ、毎回異なるカップで提供されることを楽しみにしている利用客もいます。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_ハウセストライフ＋カフェ -->

---

### BRIANZA NAGOYA HAERA（名古屋市中区錦 / モダンイタリアン・★3）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: ミシュラン選出実績を持つ奥野シェフ率いるBrianza Groupの名古屋店。煌びやかな空間でモダンイタリアンを提供し、多数のグルメメディアやラグジュアリーモール「HAERA」への出店で注目を集める。
- **insiderNote**: 奥野シェフは料亭出身で、イタリア全州を巡りミシュラン店で研鑽を積んだ実力者。Brianza Groupの他店舗はミシュラン選出実績があり、経営コンサルティングも手掛けるなど、その手腕は業界内で高く評価されている。
- **sources_used**:
  1. [モダンイタリアン提供、煌びやかな空間、多数のグルメメディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGcO0qxeqfZuiR4GaJ68J_gmtpX196tTSIgnPAo0yGAvloxeFIP1znM7C0J8sMnR1rHq4XAGOmYYCOkF5AspGtMzJvfyiMOsJdfWU6P8D9KQU9ZpdOB7b2m5OdktSP-6nBpt7YnfEnZirTSSAfzKeJ6)
     > 「伝統と革新が出会う、イタリアンの新しい定番」をコンセプトに、モダンイタリアンを提供しています。名古屋のパノラマビューを望む煌びやかな空間で、ランチとディナーのコース料理が提供されます。「BRIANZA NAGOYA HAERA」は、一休.comレストラン、エキサイト、TRILL、ライブドアニュース、アットプレス、TableCheck などのグルメ情報サイトやニュースメディアで紹介されています。
  2. [モダンイタリアン提供、煌びやかな空間、多数のグルメメディアでの紹介、ラグジュアリーモール「HAERA」への出店](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHiEH_IonQVSx7shYW6KHeiey3R8gg9K5P8DGtWMGzZQME2x8eiE3r5PlBYSQ2eo_CmISD1pDkc6yWjHoftDhLmuVhnOSiKXES3cEe7as6xRCxzuRFKNSo4Vem5ye-Wp1I=)
     > 「伝統と革新が出会う、イタリアンの新しい定番」をコンセプトに、モダンイタリアンを提供しています。名古屋のパノラマビューを望む煌びやかな空間で、ランチとディナーのコース料理が提供されます。「BRIANZA NAGOYA HAERA」は、一休.comレストラン、エキサイト、TRILL、ライブドアニュース、アットプレス、TableCheck などのグルメ情報サイトやニュースメディアで紹介されています。ま
  3. [奥野シェフが率いるBrianza Groupのミシュラン選出実績、奥野シェフの経歴、経営コンサルティング活動](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHxw7Oe83JMCekn3e-qQAbFevBaQAl55gGICxtpEvrqn_b8SQKOQsnJjhrYpFUFk29WHopXxUFTj8ZPHyl9m8Cu0680iQD96ycbpC71bXe2ppNKVTENSawi53m4v-15yhvz)
     > オーナーシェフ奥野義幸が率いるBrianza Groupは、La BrianzaとDepTH brianzaが2年連続でミシュランセレクテッドに選出されています。奥野氏は和歌山県の料亭に生まれ育ち、アメリカの大学を卒業後にイタリア料理の世界へ転身。イタリア全州を巡り郷土料理を学び、ミシュラン1つ星・2つ星を獲得した8店舗で経験を積んでいます。オーナーシェフとしてイタリアンを軸とした「奥野スタイル」
  4. [多数のグルメメディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGnH2xtSU12SLxoFFEeLjM3ZfD9_7-wvulqKq0fMP2LmJcjy7V2WvDtePc942nM93qAvkQliDdvCWVQxecrd-eG_cg_CrYyZMkqP9W1uOJ0t5meZvh1k2Y39ImqFJLquMUK)
     > 「BRIANZA NAGOYA HAERA」は、一休.comレストラン、エキサイト、TRILL、ライブドアニュース、アットプレス、TableCheck などのグルメ情報サイトやニュースメディアで紹介されています。
  5. [ラグジュアリーモール「HAERA」への出店](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHvYccrrqxGpwKXJPSlwyUV9H0gGEAXG-13ajCez6RjWXrWIWqaJP9Rot3a26ZoJ8Y7fmgAsixvkB3o1GcRLbPPB2cMtVZd4rz-hlI79qJV2g7kakijTK-31-Qfw6tXfrHJ0k8Cc6G0Tw==)
     > また、「HAERA」という新たなラグジュアリーモール内にオープンした店舗としても注目されています。
  6. [奥野シェフが率いるBrianza Groupのミシュラン選出実績](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGcoq-VOksgZsY3eIGywUS_16klxNM3dXYd7rRPIsHb2piTO2hE8_hZCwO1NF-15DBcTiiT0K-QNqHGwOyMPOMCok7HXUq_Se-qXICIneubYBVzi_T4hqUhFnbWZCVz6OE7yrVh26RHNSOOw5t63aM7JdI=)
     > オーナーシェフの奥野義幸氏は、「名店を率いる」と評されており、彼が手掛けるBrianza Groupは、「La Brianza」と「DepTH brianza」が2年連続でミシュランセレクテッドに選出されています。
  7. [多数のグルメメディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEmHxRjOxuQP6xtenAj6cSStamU4E3B3u16RyCFj-edDsmohsItSbYQ-svc09KuzAHQYuOgmIk0KTC8IublyMHOeV_3nK4e98MXqDD2r7iuHV3Bvw7CpEcrKZr5-p8=)
     > 「BRIANZA NAGOYA HAERA」は、一休.comレストラン、エキサイト、TRILL、ライブドアニュース、アットプレス、TableCheck などのグルメ情報サイトやニュースメディアで紹介されています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_brianzanagoyahaera -->

---

### 名古屋コーチン鶏料理 清水 名古屋店（名古屋市中村区 / 鶏料理（名古屋コーチン、水炊き、鶏しゃぶしゃぶ、鶏すき焼き）・★4.3）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 名古屋駅直結の大名古屋ビルヂングに位置し、和モダンな完全個室で上質な名古屋コーチン料理を堪能できる。熟練シェフのこだわりが詰まった水炊きや鶏すき焼きは、スタッフによるフルサービスで最高の状態で提供され、接待や特別な日に最適だ。
- **sources_used**:
  1. [名古屋駅直結の大名古屋ビルヂングに位置し、和モダンな空間で名古屋コーチン料理を提供していること、友人や家族との利用に適していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFwdpbtS0hFEfmGMjTKXUqjA6GXDN-faTY93CJb7uK6a1NGWimZZyrScEEFWXsXPgygnn2atba5RyMTUNOJPvioyWt25lseOHd5m2-b1pX68cbshVKm3RC4qSjPyM1lDNubYBOlQKtIrLni4PY=)
     > 名古屋駅直結の大名古屋ビルヂングにあり、日本三大地鶏の王様「名古屋コーチン」の旨みを凝縮した熟撰水炊きや、秘伝の割下で味わう鶏すき焼きなどをコースで堪能できると紹介しています。和モダンで落ち着く空間で、友人や家族とゆったり語らうひとときを過ごせる点も強調されています。
  2. [大名古屋ビルヂングに位置し、名古屋コーチン料理を提供していること、名物の鶏鍋料理はスタッフが全て調理するフルサービスであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGq-e2kBG1CVGmzAfSdtC3wFyK13ng8mkckifYrxw4-okMYybGLKNnB9Xyu3_tsJb-b-VUiHY7ymK7W221-ZVKHrGudYDC2BYbMDVUWVl26GslGKrQCiCUf9420sK7Ks8PvXlyukGxD0Pkcbg==)
     > 「大名古屋ビルヂング」3階に2026年4月にオープンした名古屋コーチンや厳選鶏を使った鶏料理店として紹介されており、名物の鶏鍋料理はスタッフが全て作ると説明されています。特に「名古屋コーチンの水炊き」が一押しで、厳選した手羽先と香味野菜、名古屋コーチンのガラを加えて炊いた、旨味・コク・香りのバランスが取れた鶏白湯スープが自慢とされています。
  3. [名古屋駅直結で完全個室を完備していること、観光や出張、接待など多様なシーンに最適であること、熟練スタッフによるフルサービスであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEM5DmO-F0aUW8fAtbLYlbc262nvoh2GAt5sb1tkp8B2aOhLqlFlfu-cm6evPF0-mJKcFzBsfSLPZxbq5rlNMxDzWQ9MD6DEgFwUKGDJGDua1pgyFfcOALQ1FAofn8=)
     > 名古屋駅直結で喧騒を忘れさせる静謐な完全個室を完備しており、観光や出張、仕事終わりの夜、家族での贅沢な食事、国内外の賓客をもてなす宴に最適であると紹介されています。熟練のスタッフが目の前で丁寧に鍋料理を仕上げる点や、有名銘柄から希少なものまで揃う二十種の日本酒も魅力として挙げられています。
  4. [名古屋駅直結のモダンな個室空間であること、大切な方のおもてなしや記念日におすすめであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF33qW-0qVxv2bKNfQ4yy3_jrb2sg6qZ465VcVzhCuVKFq7OcclN176pNXgV31GR4nS4MClEjUEoxpPLQl_NnDfgmeCWKBKGgKBCu81o6gJYukYjwPwqGAp9ZNnhBQ1qrZtPK8=)
     > 名古屋駅直結のモダンな個室空間で、極上地鶏で名古屋を贅沢に味わい尽くせる店として紹介されており、大切な方のおもてなしや記念日にもおすすめとされています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_名古屋コーチン鶏料理清水名古屋店 -->

---

### 裏の山の木の子 名古屋（名古屋市中村区 / きのこ火鍋専門店・★4.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 和だしベースの「日式きのこ火鍋」は、薬膳・麻辣スープを選べ、優しい味わいが特徴。約14種のきのこを美しく盛り付けた「きのこバスケット」は写真映えも抜群。タレ場で味をカスタマイズできる体験型要素や、森をイメージした落ち着いた空間も魅力です。東海エリア初出店として注目されています。
- **insiderNote**: 「空想オーナー」のコンセプトは、多店舗展開を前提としたブランド運営の明確な基軸となり、判断基準を明確にする役割を担っている点は、飲食業界におけるブランディング戦略として注目に値します。
- **sources_used**:
  1. [日式きのこ火鍋の和だしベース、薬膳・麻辣スープ、優しい味わい](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbNvWz_uMx8bMy2EbhTQaePXZUlo9WIfHmqZ6km9TSAjVALReOobRlf6uBh2Lk2qtPL3yI95wd9JWo9SrcbuKsIbjb3HlGbxKC7g9_Hu2mmF36q76bM_78Z-UIyRtX7miEYVdLjTXTsV8V0yvMIHjhkNcXBB18nME=)
     > 昆布やしいたけをベースにした和だしに、薬膳や麻辣の2種類のスープを用意し、一般的な中華火鍋とは異なる優しい味わいを提供しています。
  2. [日式きのこ火鍋の和だしベース、薬膳・麻辣スープ、優しい味わい](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKX3SUdl8L-53zA3aodrSjR3JrzHy79a-vkhEfOjUfyMx9hMsw5a0lkCAgDpzUZQQEKxtSy0_xgSeG5LL0KfaO5N5CSOfHCu21UsyysA14LyDFn3-Ur4z0OlDKoCIWkBBqrwOeGdR8gFkCHDxUVQPm341OAA==)
     > 昆布やしいたけをベースにした和だしに、薬膳や麻辣の2種類のスープを用意し、一般的な中華火鍋とは異なる優しい味わいを提供しています。
  3. [きのこバスケットの美しさ、写真映え](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbNvWz_uMx8bMy2EbhTQaePXZUlo9WIfHmqZ6km9TSAjVALReOobRlf6uBh2Lk2qtPL3yI95wd9JWo9SrcbuKsIbjb3HlGbxKC7g9_Hu2mmF36q76bM_78Z-UIyRtX7miEYVdLjTXTsV8V0yvMIHjhkNcXBB18nME=)
     > 約14種類のきのこが花束のように美しく盛り付けられており、写真映えする華やかさがあります。
  4. [きのこバスケットの美しさ、写真映え](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKX3SUdl8L-53zA3aodrSjR3JrzHy79a-vkhEfOjUfyMx9hMsw5a0lkCAgDpzUZQQEKxtSy0_xgSeG5LL0KfaO5N5CSOfHCu21UsyysA14LyDFn3-Ur4z0OlDKoCIWkBBqrwOeGdR8gFkCHDxUVQPm341OAA==)
     > 約14種類のきのこが花束のように美しく盛り付けられており、写真映えする華やかさがあります。
  5. [タレ場でのカスタマイズ体験](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbNvWz_uMx8bMy2EbhTQaePXZUlo9WIfHmqZ6km9TSAjVALReOobRlf6uBh2Lk2qtPL3yI95wd9JWo9SrcbuKsIbjb3HlGbxKC7g9_Hu2mmF36q76bM_78Z-UIyRtX7miEYVdLjTXTsV8V0yvMIHjhkNcXBB18nME=)
     > 十数種類の調味料や薬味が並ぶ「タレ場」が設けられており、顧客が自由に組み合わせて自分好みの味をカスタマイズできる体験型の空間を提供しています。
  6. [タレ場でのカスタマイズ体験](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKX3SUdl8L-53zA3aodrSjR3JrzHy79a-vkhEfOjUfyMx9hMsw5a0lkCAgDpzUZQQEKxtSy0_xgSeG5LL0KfaO5N5CSOfHCu21UsyysA14LyDFn3-Ur4z0OlDKoCIWkBBqrwOeGdR8gFkCHDxUVQPm341OAA==)
     > 十数種類の調味料や薬味が並ぶ「タレ場」が設けられており、顧客が自由に組み合わせて自分好みの味をカスタマイズできる体験型の空間を提供しています。
  7. [森をイメージした落ち着いた空間](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbNvWz_uMx8bMy2EbhTQaePXZUlo9WIfHmqZ6km9TSAjVALReOobRlf6uBh2Lk2qtPL3yI95wd9JWo9SrcbuKsIbjb3HlGbxKC7g9_Hu2mmF36q76bM_78Z-UIyRtX7miEYVdLjTXTsV8V0yvMIHjhkNcXBB18nME=)
     > 店内は木目や自然素材が多く取り入れられ、森の中をイメージした落ち着いた空間で、都会的でありながら温かみのある「大人の隠れ家」のような雰囲気を演出しています。
  8. [森をイメージした落ち着いた空間](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKX3SUdl8L-53zA3aodrSjR3JrzHy79a-vkhEfOjUfyMx9hMsw5a0lkCAgDpzUZQQEKxtSy0_xgSeG5LL0KfaO5N5CSOfHCu21UsyysA14LyDFn3-Ur4z0OlDKoCIWkBBqrwOeGdR8gFkCHDxUVQPm341OAA==)
     > 店内は木目や自然素材が多く取り入れられ、森の中をイメージした落ち着いた空間で、都会的でありながら温かみのある「大人の隠れ家」のような雰囲気を演出しています。
  9. [東海エリア初出店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbNvWz_uMx8bMy2EbhTQaePXZUlo9WIfHmqZ6km9TSAjVALReOobRlf6uBh2Lk2qtPL3yI95wd9JWo9SrcbuKsIbjb3HlGbxKC7g9_Hu2mmF36q76bM_78Z-UIyRtX7miEYVdLjTXTsV8V0yvMIHjhkNcXBB18nME=)
     > 東海エリア初出店として、複数のグルメメディアで紹介されています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J004634124 -->

---

### 炭焼 うな富士 栄HAERA店（名古屋市中区 / うなぎ (炭焼うなぎ)・★4.3）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: うなぎ激戦区名古屋で、創業者のこだわりが光る厳選「青うなぎ」と秘伝のタレ、熟練の地焼きで高い評価を確立。栄の中心地で安定した品質と多様な利用シーンを提供し、幅広い層に支持される名店。
- **insiderNote**: 創業者の養鰻業者との関係で厳選「青うなぎ」を安定供給。秘伝のタレと熟練の地焼きで、食べログ百名店選出の安定した高品質を栄の中心地で提供。
- **sources_used**:
  1. [創業者のこだわり、厳選された青うなぎの安定した仕入れ、秘伝のタレ、地焼きの調理法](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGR6SbckJ6JDtLkNbomXqyTtFKeSBmi-U_gloH39kvkhKFW5i5FP_qE4n0xm2y7kzpA0Cry96L1F072B66OML6EKuAHpmk2QHRCBhlhPrVuCk47hTQ_ZRIR_dWbLQY=)
     > 「炭焼 うな富士」の創業者は、うなぎの飼料メーカーでの経験から養鰻業者との関係を築き、一般的なうなぎよりも3割以上大きい厳選された「青うなぎ」の安定した仕入れを実現しています。創業者の「お客様にお腹一杯に旨いうなぎを食べてもらいたい」という強い想いと、最高のおもてなしを提供することへのこだわりが受け継がれています。また、全国のうなぎを食べ歩き、名古屋で好まれる味を独自に研究して完成させた門外不出の
  2. [多様な利用シーンへの対応、安定した品質](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH8Swf_SLCuaHg5uh4iwTkNyXduWF0sl_1QVJRALq5h1VqEdH1LiMyXdv3XkL12IgbqB99fGsHRNTkm_DkOD5HrhUx8vsJjN88a0Wplqh8Q3OV0gJR66md4oWihSg==)
     > 店内は漆喰や古材を用いた古民家風の落ち着いた空間で、テーブル席、カウンター席、個室を備え、様々なシーンに対応しています。個室は利用料金が設定されています。
  3. [多様な利用シーンへの対応、安定した品質](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGYuOCURV1b6MnRCJpkcMpq8hpWj050syFGs-pku2_WKQ_5oQkl9eXBovgD2dLTfckzpksBwXVyLw_e60ovCFEJGB-6Ctf5EdRQThWaOle8Mlhy58UxljcChi9-tyFULqaZKTaowjQE_4s=)
     > 店内は漆喰や古材を用いた古民家風の落ち着いた空間で、テーブル席、カウンター席、個室を備え、様々なシーンに対応しています。個室は利用料金が設定されています。
  4. [栄の中心地での立地](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGeRuWWY6r9k2If5LHjPm4sm81bUNPZ20eYq8Nbrqqr-40npHzG-_7uBdRVXJ6p9Glp3RrQCGZVOWKxX5q3QKWuTtg6DY4fbhIeAdu4xsbTjPBN8sF9Xd6zFz55iYD2)
     > 名古屋情報通では、栄HAERA店が窓際席からの眺望や限定メニューに注目して紹介されました。
  5. [創業者のこだわり、厳選された青うなぎの安定した仕入れ、秘伝のタレ、地焼きの調理法](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGcLL89hlLYrxmcIgTgQEvozDfT0eyckHZHWFIcp9XQ_ovFNClvkNZx-luAndeybaQ0okM7-sOvd47btIBpUozPdeOZgfrV1MYEGCJmpyLxPEJ1RavYl1Km2BGvwv6rKToyb75DIGTGSB7UfUSqNFhQvyo=)
     > 「炭焼 うな富士」の創業者は、うなぎの飼料メーカーでの経験から養鰻業者との関係を築き、一般的なうなぎよりも3割以上大きい厳選された「青うなぎ」の安定した仕入れを実現しています。創業者の「お客様にお腹一杯に旨いうなぎを食べてもらいたい」という強い想いと、最高のおもてなしを提供することへのこだわりが受け継がれています。また、全国のうなぎを食べ歩き、名古屋で好まれる味を独自に研究して完成させた門外不出の
  6. [高い評価の確立、食べログ百名店選出](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFXOSOvobs9KTtKX72RYZl9aS4WgW5HRKjdOLkGY4R1cx8yoL3B34RzFJ05DUR5H1j5yfF2oqAcijiQ2RcsqpXan7cVZk-Feiqia02fHkzVkYi0RoBNshhQTQZ1BS6ZovAPQQvPz6HxfiUIVy4=)
     > 「炭焼 うな富士」は、創業からわずか25年でミシュランガイドに掲載され、食べログ百名店にも複数回選出されるなど、「うなぎ激戦区」である愛知県で高い評価を得ています。
  7. [栄の中心地での立地、多様な利用シーンへの対応](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHC-YmcXbevIe6gWbeWC51ZbyKSNXSsFUlvGSTvqlwV4tXiZDrCyAi6aUWOZA6dUuuSM8GbQ6KT1m5Ov17sMElOwrWPKVHU-FhvH6t1p9lN7e--zlgFxwJvvAFP2TBEtRKV__omznnPrhJmxopxAqhJ6v3cqQ==)
     > PR TIMESでは、名古屋市内7店舗目として栄の中心部にオープンすることや、観光や会食など様々な利用シーンに対応する店舗として誕生することが報じられています。
  8. [創業者のこだわり、厳選された青うなぎの安定した仕入れ、秘伝のタレ、地焼きの調理法](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFXLXH1Ud-NH_FLVMZET7S0zdcXdLKY6JzpQA9lMgFTGmfFGMnqKRcWkY01F4IANfAvITKVDVEcDfe3lEmtxQgAv-O1vrjSzkVJzszwu_X6srpP2Aq1bpuSx251UTE8Dh0UVqTixFv9X_A=)
     > 「炭焼 うな富士」の創業者は、うなぎの飼料メーカーでの経験から養鰻業者との関係を築き、一般的なうなぎよりも3割以上大きい厳選された「青うなぎ」の安定した仕入れを実現しています。創業者の「お客様にお腹一杯に旨いうなぎを食べてもらいたい」という強い想いと、最高のおもてなしを提供することへのこだわりが受け継がれています。また、全国のうなぎを食べ歩き、名古屋で好まれる味を独自に研究して完成させた門外不出の
  9. [安定した品質、高い評価の確立](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEiDFrKiEy-oWCE8wK8NbEY_7VLD09l6kn7bwY7pptlp4lq0rJTRIjvcP7mtaeM_Y6nToFqQeV4FlQ72q-63h8_E2B_evJQO9nwwyof7M4rqv7a3eSuUFhJjoeFtWl8awOYVs8k)
     > 栄HAERA店においても、「どの店舗でも安定した焼き」「安心・安定のクオリティ」と評価されており、職人の努力によって高い品質が維持されていることがうかがえます。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_炭焼うな富士栄haera店 -->

---

### 日々担々 守山店（名古屋市守山区 / 汁なし担々麺専門店・★4）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 「日々担々」は、本格的な旨辛担々麺を追求し、濃厚なごまだれや特製ミンチにこだわるブランドです。守山店では、麺とタレを事前に和え「一番美味しい状態」で提供する工夫が光ります。無料のご飯で「追い飯」を推奨するなど、顧客体験を重視。複数店舗展開やメディア露出も多く、地域での注目度が高い一軒です。
- **insiderNote**: 「日々担々」は名古屋市内で複数店舗を連続オープンし、1号店は行列ができる人気ブランド。守山店では、麺とタレを事前に和えることで「一番美味しい状態」を提供するなど、顧客満足度を高める工夫が見られます。
- **sources_used**:
  1. [「日々担々」ブランドのコンセプト、素材へのこだわり、「米と担々麺」のキャッチコピーと食べ方提案](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG3sNngLf_ntgEG3EimYagj06sSyj_Pb8ReW2Peoz55avidifCJl5Ju8fYyr1BflI86AUj6Ipi9p6S6HrTdwrY-B2Cj-oJPlfi7TfIVR82FBHkHalGQ1ljHWy5PhQ_CiXju_sQ1iT2_mE6oTvbdGdj6sF-K4sjLOnmMmQOy)
     > 『旨さと辛さが欲しい人に、何度でも食べたくなる担々麺を届ける』ことをテーマに掲げ、本格的で愛される担々麺を徹底的に追求しています。濃厚なねりごま、唐辛子の刺激的な辛さが特徴のラー油、四川の芽菜（ヤーサイ）と自家製甜麺醤で仕上げた特製ミンチを使用している点が特徴です。また、『米と担々麺』をキャッチコピーとし、担々麺と熱々のご飯を一緒に楽しむスタイルを提案しています。
  2. [「日々担々」ブランドのコンセプト、素材へのこだわり、「米と担々麺」のキャッチコピーと食べ方提案](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHQ3lBXWFe-Hc8ZNhce6AMDWB63XOF8BMYYlnz3SVXIOobYanffFuIbZA2chusabzDseFblm6yAzHBEu2tkbER5JaKEvjSCwAIXaoBXZ5aT5bSXPOgknSfF5SI5dOsTaMEaNkNWiqqdZ8cxL2iNaMjZB3Mtix4=)
     > 『日々担々』は、『旨さと辛さが欲しい人に、何度でも食べたくなる担々麺を届ける』ことをテーマに掲げ、本格的で愛される担々麺を徹底的に追求しています。濃厚なねりごま、唐辛子の刺激的な辛さが特徴のラー油、四川の芽菜（ヤーサイ）と自家製甜麺醤で仕上げた特製ミンチを使用している点が特徴です。また、『米と担々麺』をキャッチコピーとし、担々麺と熱々のご飯を一緒に楽しむスタイルを提案しています。
  3. [「日々担々」ブランドの複数店舗展開とコンセプト](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF34gBcJ543yEufqdx6moKc_3zsLmQiHX1UPu47gljjj70iAKuDAKhpdu4oWLmNkElMQqjfcsIG8g0rcTeITEjwaFpMlM4vRLdi8DBxEagtovDkG2gAJcqjUwyhA32Sy5V18bOJCCF_bl3RkqSKz0U=)
     > 『日々担々』ブランドが名古屋市内に複数店舗を連続オープンしたことが報じられ、ブランドのコンセプトが紹介されています。
  4. [守山店の提供スタイル（麺とタレが混ぜられた状態）、無料ご飯と「追い飯」推奨](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHyxoFSq1SqAqR7nzbQGrPnMEBxqSooa-AczvoWkV5vMsnNVx0cpqnkbAcn6Ld_I-tx4PVLNNZqMHGroINpf-lAdL0iYsp0ekw91gHKNCeHNaVxCshaSGW6F0x3ncRDOKfUWN6ODTtujM4x1yMbZewCoOnGVFU=)
     > 守山店では、担々麺は提供時にすでに麺とタレが混ぜられた状態で提供されます。全ての担々麺にはご飯（150gまたは200g）が無料で付いてきます。これは「米と担々麺」というコンセプトに基づき、残ったタレやミンチをご飯にかけて「追い飯」として楽しむことを推奨するものです。
  5. [守山店の提供スタイル（麺とタレが混ぜられた状態）、無料ご飯と「追い飯」推奨](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFhjxIX4Wh7t8-jiRzgGKLAKGOUqvV4s6UCRVG7_ux-JBtOEIm8pAhO43GfYPExwHgv965LL1VG4Xy8duZW1ENicGLPBa54iZYNkPFeU1m7IdDDahl1qH99zzpOU1zADzlUjKtKOrwA2L2dV1UvKQ==)
     > 守山店では、担々麺は提供時にすでに麺とタレが混ぜられた状態で提供されます。全ての担々麺にはご飯（150gまたは200g）が無料で付いてきます。これは「米と担々麺」というコンセプトに基づき、残ったタレやミンチをご飯にかけて「追い飯」として楽しむことを推奨するものです。
  6. [守山店の提供スタイル（麺とタレが混ぜられた状態）、無料ご飯と「追い飯」推奨](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHMcTDjAJn6H0B4ihdQoKhmBKIFQCrZjMkvhur-Ye1IYVLahp8IK9XURVFUII_XsFGv_kjgLtrxGqjuD2lKC21SHrVZiUSN9DEVmj3zY_CN1wREP2XLn-Qa8bnYf9_2XbJ3B_u88YVwRLKkQr5Hng==)
     > 守山店では、担々麺は提供時にすでに麺とタレが混ぜられた状態で提供されます。全ての担々麺にはご飯（150gまたは200g）が無料で付いてきます。これは「米と担々麺」というコンセプトに基づき、残ったタレやミンチをご飯にかけて「追い飯」として楽しむことを推奨するものです。
  7. [地元メディアでの紹介（ケーブルテレビ、YouTube）](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGBydOwV1eTQ04Tr6sXotj8JmxbPDYdrn3KxzXxEGsVruFpDO6aCS6Qq-yeedIO-hqgS6rvjjHR_-yPRDMvKaYk__ZipG5GCyZjsLQ04bwfZ-qzSnWqZ6wGLgJDWo8WtU_PzlJlLu4=)
     > ケーブルテレビの地域情報番組「そらまめ通信」では、「エリアごはん『日々坦々 守山店』」として紹介され、YouTubeでも公開されています。
  8. [地元グルメブログでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGvliSJ8OjwBxRUbvO17oVeukguYlTE_IZE5a_cwMNEsb6QCiqTkTHoIyNGX40Su4YCsEUCgKLtqejM318RBuZyzAvPo1Q17Ma5IwimeQXo7UbS1yiEgpSnE7x4W496Ei77CKs2Zv0oDgDAh2Jw)
     > 「サリーの名古屋グルメ日記」では、「四川 日々担々」が本格的な痺れる辛さの担々麺を味わえる店として言及されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_日々担々守山店 -->

---

### The Living Room with SKY BAR（名古屋市中村区 / カフェ、バー、ダイニングバー・★4.1）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 地上80mからの絶景と共に、東海食材を活かしたモダンオリエンタルな創作料理が楽しめるオールデイダイニング。朝食からバータイムまで、多様なシーンで非日常的な体験を提供し、顧客のニーズに応える柔軟なスタイルが魅力です。
- **insiderNote**: 東海食材と世界スパイスを融合したモダンオリエンタル料理で「トリプリング」を提案。地上80mの「JAPANESE FUTURE」空間は、主要グルメサイトやSNSで広く紹介され、推し活需要も捉えています。
- **sources_used**:
  1. [地上80mからの絶景、東海食材を活かしたモダンオリエンタルな創作料理、非日常的な体験、トリプリングの提案、JAPANESE FUTURE空間](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHa0vSg0uXSgmdF2187i-jwFdxvXwG8uCh2gRE7zt38sMULXDT4pZ4KPemKNgQbfLguDenhLXYUSddSp1vTXHt0tlzeTclr-llAH00gHcJqBhjS7y0lRYt7yk2)
     > 東海4県の食材を地中海料理へとアレンジし、非日常的な体験を提供することにこだわっています。特に、愛知県産の食材や調理法を取り入れつつ、世界各国のスパイスや調理法を融合させたモダンオリエンタルなメニューを提供しています。また、料理にスパイスとオリエントワインを組み合わせた「トリプリング」という新しいスタイルを提案しています。旬の食材を活かし、世界各国の調理法とスパイスを取り入れた、枠にとらわれないオ
  2. [地上80mからの絶景、東海食材を活かしたモダンオリエンタルな創作料理、非日常的な体験、トリプリングの提案、JAPANESE FUTURE空間](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEU6OH7lphM5M9NRpihJ-T05srJtAsf067ScgXOdC27UTQ3Hj464fTmNxZC_lSE96YtoVAdpn-N_Asz8ebLi915l94Q742ZYDUhajpNrFqN_b7WQgewPa6MbojYPJo=)
     > 東海4県の食材を地中海料理へとアレンジし、非日常的な体験を提供することにこだわっています。特に、愛知県産の食材や調理法を取り入れつつ、世界各国のスパイスや調理法を融合させたモダンオリエンタルなメニューを提供しています。また、料理にスパイスとオリエントワインを組み合わせた「トリプリング」という新しいスタイルを提案しています。旬の食材を活かし、世界各国の調理法とスパイスを取り入れた、枠にとらわれないオ
  3. [オールデイダイニング、多様な利用シーン](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFnAnRiuTk70eygViKjjYlwWqNn_DTlKIgi5YgR1-QWAHvF26bo9RebiVoOpF5rsxwxfKpFe3_UkEPlx2mDJpaSC87svxTu0qRW1x68_dek5HPUPDSilAp9iuxrSl07v9LhWaFl7zDawRSv6w==)
     > 「The Living Room with SKY BAR」は、朝食からバータイムまで利用できるオールデイダイニングとして運営されています。提供される料理は、東地中海の中東料理をモチーフに、東海4県の食材を使用したモダンオリエンタル料理が特徴です。提供スタイルとしては、季節ごとにテーマが変わるアフタヌーンティーが人気です。ランチでは、サラダ・前菜・デザートブッフェ・ドリンクバーが付くプランがありま
  4. [推し活カフェとしての紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFotwUMRPksMoP2IJ4FvCxs_xYTIt4IP10xXWpkqFIn7uqF5-X6_oeZ3JzTMxgBu4g6uQ9Da4ewvlEhkU-LWcJla9Eww4rxrsjjwVOSR4BvXFIA7Zqw8sai6W0AlOOhDBNUOGksIWhtiGJUAeo7cR4edRsQIhsFUXfGRyRu7D6eOtIKFEU=)
     > 「imako推し活カフェ」という推し活カフェに特化したウェブサイトでも、推し活に優しいカフェとして紹介されています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_thelivingroomwithskybar -->

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

### Pizzeria mimi (ピッツェリア ミミ)（名古屋市東区筒井 / ピッツェリア / イタリアン・★4.3）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 菓子店Lyckaから誕生したPizzeria mimiは、パン職人とパティシエが協業する独自の生地が特徴。2人で1枚を創り上げるスタイルと、クラウドファンディングで実現した開業背景も注目される新店だ。
- **insiderNote**: 菓子店Lyckaの新ブランドとして、パン職人とパティシエが「2人で1枚」を創る独自のピザスタイルが魅力。クラウドファンディングで実現した開業も注目される。
- **sources_used**:
  1. [菓子店Lyckaの新ブランドであること、パン職人とパティシエが協力した生地が特徴であること、クラウドファンディングで開店資金を調達したこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGWC3p-mUiBl-MxnUe5wJKz8ougCU-M11ws7t7TCemgW9OrheHM7t29uACa6uYy102FhejSwgElLb-Rhd8hVsQnSHAndUwPQRnwCvXzdkVM9k__w8xw3niRs9M-GwnEQQ==)
     > スコーンと焼き菓子で評判の「Lycka」から生まれたこと、パン職人とパティシエが協力した生地が特徴であることなどが報じられています。また、クラウドファンディングを通じて開店資金を調達していたことも伝えられており
  2. [菓子店Lyckaの新ブランドであること、パン職人とパティシエが協力した生地が特徴であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHXbNSoX6gaazz674adFzPeSXa9krAXKPTl0hNysw__z4iEFLMCx9rsP86GELZKpTxDjHmZGnzaWKOpL-9BOGM1XIZKS5TQTsMgyUlVTMrmn84ntNptnCQkwLNgnC3yFh5FP46kd_Q=)
     > スコーンと焼き菓子で評判の「Lycka」から生まれたこと、パン職人とパティシエが協力した生地が特徴であることなどが報じられています。
  3. [菓子店Lyckaの新ブランドであること、パン職人とパティシエが協力した生地が特徴であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG8dS458v6j-dhmpaSpdQLEE2Ttp9yQusWiSMZngbsSu_WllJo2sPpH9IR-BxlJe5aH2wvTTwfLtQIXyjvstS5-VDiuaXFj40GBV_XBY3g8Qyvh9RmLwd-8Ytx_-QzlNlcWTbT76tyTBW7zu5UHm_q3kpA=)
     > スコーンと焼き菓子で評判の「Lycka」から生まれたこと、パン職人とパティシエが協力した生地が特徴であることなどが報じられています。
  4. [「2人で1枚を作る」という独自の提供スタイル](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHYIuRILyjePWaKE3jI4pvMZQGLAfHOgx51edTNCrnXMBemURSM8PdqTK2Yr573cwa8KAAhRKgb-3IM11_u_ez0-NAj6EkdCOoefwl_AWEEiesXbtJpvyHHoV7upVKJuOFjcHQV)
     > 2人で1枚を作るという考え方
- **warnings**: 3件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_pizzeriamimi(ピッツェリアミミ) -->

---

### オステリア ラマンテ（名古屋市中区 / イタリアン・★4.3）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: アットホームな雰囲気で本格イタリアンを提供する人気店。厳選された旬の素材を活かした炭火焼き肉や豊富なアラカルトが魅力。食べログ百名店選出実績や主要グルメサイトでの高評価が、その実力を裏付けています。
- **insiderNote**: 各地で研鑽を積んだシェフが旬の厳選素材を使い、本格的ながら肩ひじ張らないイタリアンを提供。子連れに優しいグローバルゲート店など、多様なニーズに応える展開も注目です。
- **sources_used**:
  1. [アットホームな雰囲気で本格イタリアンを提供する点、厳選素材と炭火焼き肉、旬の食材へのこだわり、豊富なアラカルト、各地で研鑽を積んだシェフについて裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHN0gX3hOFOggv1gBZ2JxMwnVQERpBG-GXZ5p_geF2YKIVa-T2TzzHgQtBQaXy1d-I0v-87D-qG7p5KEnQaFZm8a1lmUrWF8m7vn7zL5DVbFxuqXkjF)
     > 「アットホームの中に本物を」をテーマに掲げ、肩ひじ張らないカジュアルな店内で、人懐こく温かい接客を心がけています。提供される料理は、高級店に引けを取らない手の込んだ本格的なイタリア料理です。仕入れにこだわった厳選素材を使用しており、特に炭火焼きの肉（牛、豚、仔羊など）は名物とされています。旬の食材や体に優しい食材を一番に提供したいという思いがあり、各地で研鑽を積んだシェフたちが厳選を行っています。
  2. [食べログ百名店選出実績と主要グルメサイトでの高評価について裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEC2o-b5ZTtQYCz2ZC1kZSwJiWy362te_zANQoRvSfqc4At_UZtHK67uHltpNu-05mkBmGRYFRjB1jZco0MY8RewIRh1-oVsmpw0jumpa25dKoVwZBCEqXS5ImmvzU5SE5DiKDk6CJqfQ==)
     > 本店は「食べログ百名店」に選出された実績があります。主要なグルメサイトである食べログ、ホットペッパーグルメ、一休.com、AutoReserve、Retty、じゃらんnet、楽天ぐるなび、ヒトサラなどに掲載されており、高い評価を受けています。
  3. [主要グルメサイトでの高評価について裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEq7z-SicA3pDIk0KXCuMrgMT-f-CkEbE9OqtF53c1QsUBh8B0XobPghrbYDRfSfhNXmQqC1_P4j6ncFGRCcaY0Mmj6hyXh3t4JVxnHPTr-iRI7_vD74SyW5FCL-u2vfGt-GQ==)
     > 主要なグルメサイトである食べログ、ホットペッパーグルメ、一休.com、AutoReserve、Retty、じゃらんnet、楽天ぐるなび、ヒトサラなどに掲載されており、高い評価を受けています。
  4. [地元グルメメディアでの紹介と人気店であることについて裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGFQuRtJFbKQx5yj-e_Y9Ni9Wwk7d7rDwJ8QKWxj7dNi-R1VgAbrkDPI_FnPIlr_OHWv0Gb0hVzqPBjZJh9F9jUjQ9d_wYgAfDGGecnQnmhGN9nOZoIIsFiGaNmjCL-N3lt)
     > 「名古屋情報通」や「ナゴレコ」といった地元のグルメメディアでも、本格的なイタリアンが楽しめる人気店として紹介されています。
  5. [食べログ百名店選出実績について裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH7GQdyPLxCYj8Nn9Gz4ExVuOr8RgljjlIWbLwUN86qz_ao4Hh7IP6BhfZTmtYCJCxLf7hJGEO41ztYPEQ9iZixTJaqFtnI2JY45YCaNHeRMsTXRodcILoeSxFzBRI7iv8vvA88P2x-C0wooII=)
     > 本店は「食べログ百名店」に選出された実績があります。
  6. [地元グルメメディアでの紹介と人気店であることについて裏付けています。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEjQl8UeQekCIThqRruOZys_2tSHdRS_X_Gn4y4rlQ9tDVy7h4i9YbFvgs6pZKjYDSUkffvKak68-2SxdYx5dDGlpEMikRLZt0lVDsqlCVZ7kXJde07T6Gh_ND1bv1UupfvsTllrW3bKtJU3P2B)
     > 「名古屋情報通」や「ナゴレコ」といった地元のグルメメディアでも、本格的なイタリアンが楽しめる人気店として紹介されています。
- **warnings**: 4件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_オステリアラマンテ -->

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
