# editorReason 自動生成 draft レビュー（ISSUE-045）

> **生成**: 2026-11-10T01:19:51.555Z
> **対象**: 上位 50 候補 / 生成 49 件
> **結果**: OK 47 / INSUFFICIENT 2 / WARN 0 / ERR 1
> **自動マージ候補** (confidence ≥ 0.85): 16 件
> **人手レビュー要**: 31 件

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

### 焼肉ぽんが 名古屋伏見店（栄(ミナミ)/矢場町/大須/上前津 / 焼肉・ホルモン・★4.9）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 「焼肉TOKYO百名店」選出の実力派が名古屋に初出店。A5黒毛和牛を厳選し、個室で上質な焼肉体験を提供。米や野菜、タレにもこだわり、接待や記念日など特別なシーンに最適な一軒です。
- **insiderNote**: 「焼肉TOKYO百名店」選出の実力派ブランドが名古屋初進出。産地銘柄に縛られず厳選したA5黒毛和牛を最適な火入れとカットで提供。羽釜炊き伊賀米や手作りタレなど細部までこだわり、上質な焼肉体験を追求している。
- **sources_used**:
  1. [「焼肉ぽんが」ブランドが「焼肉TOKYO百名店」に選出された実績があり、名古屋に初出店した事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHTC3zrmQXhkIbhENoP33uKWf-1aJhA5MsI1B3L3lgw1bAnc2XvugdJ6c5ZkvEYMoPRwl6TmYfxZgmZ1qixVs6EmgARH1_Jkitj0HSGHYSs2BYtV5gPAFLUGBKmbws=)
     > 「ガジェット通信 GetNews」や「PR TIMES」では、2026年2月2日のグランドオープンと、東京の百名店選出店が名古屋に初出店すること、およびオープン記念キャンペーンについて報じられました。
  2. [「焼肉ぽんが」ブランドが「焼肉TOKYO百名店」に選出された実績があり、名古屋に初出店した事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHRtOZDMDKXmTeu-sGXXskdEDuIt3lzU_iDXbVC7CHn9wRKyuH-jSlHQ0MAWkKVRWWrJRGUKq0GM6kXYz6xGTcjNdoTfnopHIzq-_rsuOhEGadtBbMPn7TDATWEs6sWsWbBp1ZaN-1wklP_NWLE2ag0aJKA2A==)
     > 「ガジェット通信 GetNews」や「PR TIMES」では、2026年2月2日のグランドオープンと、東京の百名店選出店が名古屋に初出店すること、およびオープン記念キャンペーンについて報じられました。
  3. [その日最も良い状態の黒毛和牛を厳選し最適な切り出しで提供するこだわり、羽釜炊きの特A級伊賀米や契約農家直送野菜、手作りタレなど肉以外のこだわり、火入れへのこだわり、上質な焼肉体験の追求](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFgHej8Jw2ZM_YrnElJbtsDmrDejdI8rSMDMO0MPg1vQ5jSKmE1dgb2iwU-IX-Cr0K2_PzZmceuTihvIrNVGWmjmq8YTjG0mObg_oj5IhCq6XoieTgJklue8PK5y75EWa9fXA==)
     > 産地や銘柄に縛られず、その日最も良い状態の黒毛和牛を厳選して仕入れ、提供直前に各部位の魅力を最大限に引き出す最適な切り出しで提供しています。肉だけでなく、焼肉の体験を豊かにする要素として、羽釜で炊き上げる特A級「伊賀米」のごはんや、契約農家直送の減農・無農薬野菜、手作りのタレや薬味にもこだわっています。
  4. [その日最も良い状態の黒毛和牛を厳選し最適な切り出しで提供するこだわり、羽釜炊きの特A級伊賀米や契約農家直送野菜、手作りタレなど肉以外のこだわり、火入れへのこだわり、上質な焼肉体験の追求](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGiVTeg7CZMWn7gviK3jXjdf4v-T2_3uIKH5MtPv745gSv2GhhPV2Ekdo-Q7o4GPNE6Ud-gIfQ9_UPPfOaAGqcz3OoluPp-T0BLl3MS8Y35ylTiz79O6O00txLUrC1HPADqm-sr1zQ_Qwwbj9yiWrE0gCQdkdIZ)
     > 産地や銘柄に縛られず、その日最も良い状態の黒毛和牛を厳選して仕入れ、提供直前に各部位の魅力を最大限に引き出す最適な切り出しで提供しています。肉だけでなく、焼肉の体験を豊かにする要素として、羽釜で炊き上げる特A級「伊賀米」のごはんや、契約農家直送の減農・無農薬野菜、手作りのタレや薬味にもこだわっています。
  5. [「焼肉ぽんが」ブランドが「焼肉TOKYO百名店」に複数回選出された実績を持つ実力派である事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGNcjjHSKVhBXpul_ynHfetVxPcfJk0wVPsyFCepKCMY7twc-yUPXt6ipqmXkSRQamagyxVj01uHO-J3hOY9l4Jm9qN9DlhneK4KIZOul3yCe8ewisOUET1eRbOsCe6QrPDy9Uqp33cxehYtAzeLqnCJ_01Bg_HR-RbBZR7ntnwdFMFpApWbs-6hQj-a4j0lpP0qG6LCg==)
     > 「焼肉ぽんが」ブランドは、東京・目黒を拠点に人気を集め、「焼肉TOKYO百名店」に複数回選出された実績を持つ実力派です。
  6. [「焼肉ぽんが」ブランドが「焼肉TOKYO百名店」に複数回選出された実績を持つ実力派である事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFn-gQnTLt_3r2EXEfq5c_ytuSxcD2gTEQGIQyoagZwL-8nXNGjVfzrpj0-C43LuUJOq1JE3nJySbilatbGc19LzBq5-ANacWzknaw_wBVn7UbYu7hEMPWOJXogl-KuHzXFlt8Ghte_tA==)
     > 「焼肉ぽんが」ブランドは、東京・目黒を拠点に人気を集め、「焼肉TOKYO百名店」に複数回選出された実績を持つ実力派です。
  7. [「焼肉ぽんが」ブランドが「焼肉TOKYO百名店」に複数回選出された実績を持つ実力派である事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGksmT664NwhuvNR5Eksp3UPe3RzKChei4mSowhqFXYlIqF3fCVYzkIYtoQIEyeBgysnnUguPSY8F_ahkIKZlxW0uRH5iUJbFTXsoTn8P038fLf8MEUppgwGAC7hcCJ447qsSU=)
     > 「焼肉ぽんが」ブランドは、東京・目黒を拠点に人気を集め、「焼肉TOKYO百名店」に複数回選出された実績を持つ実力派です。
  8. [個室を中心としたプライベート空間で、接待や会食、記念日などの特別なシーンに適している事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEkkrq6a8GLrsLMEPaE6NELL1sFSL2v-d19Y3KDeeoq1bltf5LSwJjbEGQ5T98WYtsKxvKsqE-Iv0QHvWJHa4WZryFOxs4nVfHwtP1Vbv1Y0Hgy_XRoAwQ-Xr4ddKMDBxIJ)
     > 店内は個室を中心としたプライベート空間で、周囲を気にせず落ち着いて食事を楽しめるように設計されており、接待や会食、記念日などの特別なシーンに適しています。
  9. [A5国産黒毛和牛を提供し、個室空間で楽しめる事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFLRnSwjfqBJKsdFcklYO6NylD8RM6-Cyd1qY5GwTd98aG1ndS9_xqe85DhRjdNj4ZidXounj9ZpqvsipEYIQOzZlE_TPNhT1hcu0ru7DTexzQLZAtoS050M-kxL5Mp660xSRRSSV9U)
     > 公式ブログでもA5国産黒毛和牛を個室空間で楽しむことについて触れられています。
  10. [個室を中心としたプライベート空間で、接待や会食、記念日などの特別なシーンに適している事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHoYrflZ0hS5kQ3lLEvCdMrVKvRlSUAZBtcwsQIQc89GT6u-4LvdF686KAIQ0byR7tq7FHwPrPQhhftYlwBVSeRoxXNwNqz24j66wKoiWS7lwLT9BqROj54g6tLtCHC1cgHQ0ekLoD0fg==)
     > 店内は個室を中心としたプライベート空間で、周囲を気にせず落ち着いて食事を楽しめるように設計されており、接待や会食、記念日などの特別なシーンに適しています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J004613144 -->

---

### 味処おおたに（名古屋市中村区 / 日本料理・★4.4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 店主大谷氏が遊び心と新しさを追求し、異なる素材や調理法を融合させた和食を提供。一品ごとの満足度とコストパフォーマンスの高さが評価され、予約困難な人気店として地元に愛されています。
- **insiderNote**: 大谷氏の遊び心ある和食は、異なる素材の融合と新しさを追求。オープンキッチンでのライブ感ある調理や、一品ごとの満足度とコスパの高さも魅力。ミシュラン星獲得実績も持つ実力派です。
- **sources_used**:
  1. [店主の料理に対するこだわりとスタイル](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFeOAaRTy0nVv4JGIaiz6NalmvBDI9S_rh60N8pmdTXxdPEwkBWYh8hf0_8PaSZYU_0U9f_yZLBP3-J9Vd-9LpbUBwocmH1Y1nDlSmreMOf2fTJkd_9xfzy8MIXTJ-dqCWflw==)
     > 店主の大谷有弘氏は、「自分のスタイルを探し求め、遊び心のある和食をめざし、異なる素材や調理法が融合して生まれるハーモニーを大切にしている」と語っています。料理にかける気概は、厨房を取り囲むカウンター席という店舗の構えからも感じられます。
  2. [予約困難な人気店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGxKd2j9wza8J8E8SzyUSwdxqTPpkKRt1mP1u_RzMrw4gI-2dyE1ylvRHwqp2UD8-MujXjEM4gyavH2y5Gy0IPOos4sS5et46YSy3ivWjrq6edFgBYx3vLb3pU5YECuFDh7vBQ1-qjo7mV2IoFd0VaaQ2KaAwxUA==)
     > Rettyの口コミには「完全よやさのお店はなかなか予約取れませんがそれだけ価値があるお店と言う事ですよね」、「値段以上のクオリティ」「予約困難店」という記述があり、予約が取りにくい人気店であることがうかがえます。
  3. [予約困難な人気店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEv68bcHHzdvEDHyIryqKWs-wXd62JG8ZcfdWhQ8ucDgRJgvRDPqMlObz5F5VUlfo3rvzuN4lskGmfPDxNZvBSCFzCOtgh7P-33M0VlX_qItNDi2JiHouIFGczkza1M8h9F7S-3xdEY0l119FkbtjqCTNA=)
     > Rettyの口コミには「完全よやさのお店はなかなか予約取れませんがそれだけ価値があるお店と言う事ですよね」、「値段以上のクオリティ」「予約困難店」という記述があり、予約が取りにくい人気店であることがうかがえます。
  4. [ミシュラン星獲得を示唆する情報](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9L0q33sl-519emSnOw4qYv4gycc8so9-8e2LqunrKvmT247Lpwxi1SOqOW7OI9ezit_sgXUmgPIikSZBlSgp5MmPFcEA2ygcmwegdBkb6Nya4ZQpSTmeIFaxkuqqnc1bQ9NkELTPmdxeur2Vu)
     > 「ミシュラン愛知岐阜三重 特別版」で星を獲得した直後には、お祝いの花が店に飾られていたという情報もあります。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_味処おおたに -->

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

### ハウス・オブ・モン (HOUSE OF MON)（栄 / バー（ルーフトップ）・★）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 地上40階から名古屋の夜景を一望できるルーフトップバー。スマートカジュアルなドレスコードで、洗練された大人の空間を演出。宿泊者以外の予約は不可だが、その希少性が特別な夜を約束します。
- **insiderNote**: 三英傑の家紋を軸にした物語性あるカクテルは、経験豊かなミクソロジストの技が光る。単なる夜景バーに留まらない、深い世界観が魅力。
- **sources_used**:
  1. [地上40階のルーフトップバーから名古屋の夜景を一望できること、スマートカジュアルなドレスコードが推奨されていること、宿泊者以外の予約ができないこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHuEeI7Tyc2dBKTzatrl1N7p4xeJ-_Bh236dYN7AUeLJUNWJd_ycS0bzP03eVnt2Vw4XyjmauLYNJsuxOHT7jJV8wDy2wU6K4E59_vjcg7M5GMdgRS7qUAfWJWMxjATEtjw_ws-)
     > 名古屋のスカイラインを一望できる地上40階に位置し、魅惑的な室内空間と開放的なテラス席の両方を備えています。ドレスコードはスマートカジュアルが推奨されており、10歳未満の利用は不可、20歳未満は20時までの利用制限があります。宿泊者以外の予約は受け付けておらず、来店順の案内となりますが、コンラッド名古屋の宿泊者は空席状況に応じて予約が可能です。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認） / sources_used が 2 件未満（人手レビュー必須）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_ハウス・オブ・モン(houseofmon) -->

---

### 今池焼鳥 B7（今池 / 焼鳥・★4.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 今池で「本質的な価値」を追求し、長く愛される店を目指す本格焼鳥店。紀州備長炭で焼き上げる銘柄鶏とソムリエ厳選のペアリングで、「日常のひとつ、うえ」を記憶に残る体験として提供する。
- **insiderNote**: Mab社の「Bシリーズ」の一環として、今池で「本質的な価値」を追求。集客力より「通いたくなる価値」を重視し、常連客との関係性を丁寧に築き、長く愛される店を目指す戦略。
- **sources_used**:
  1. [Mab社のBシリーズ展開、今池での本質的価値追求、本格焼鳥の提供、ペアリングによる体験提供](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHeWwDBeWQsIIkDACkJ66U7_NeciJZWE09Rs1PLI1tvBaRCz3Kk3bYW2zj-ue0IS8owTUFN0S-RrSwaS_9B5XOlh2pZ4VMbb5PHBIsqybrza8h70ECuqI-YiDuo_2wFkjpHyFXUEOQpm-5j_ORqq9vl7xR_gNI=)
     > 運営会社である株式会社Mabは、「繁盛店を再現する」というコンセプトのもと、人材の採用・育成・店舗運営までを本部が担う独自のフランチャイズモデル「Bシリーズ」を展開しており、「今池焼鳥 B7」もその一環としています。名古屋コーチンを含む地鶏・銘柄鶏を中心に、丁寧な串打ちと紀州備長炭でじっくりと焼き上げた本格焼鳥を提供しています。料理の旨さ、サービスの心地よさ、「通いたくなる価値」がお客様自身の目と
  2. [「時間ごとの体験として記憶に残る焼鳥屋」を目指すコンセプト](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG3LkFWmkYeKrgSQWqgXFuWIFgyzP__bjUA1xqgaDZt6HV1kLDUdp5VUpD6UJjTK4vW8T_lZdyKhPwXqybUHs2lhdqbGoqQNCNl8oAc8lDJfajwbZxFXp5-dl050TNevuE-9t5jY5tseLWRmEp-lJHQCJb9QeQ=)
     > 「美味しい焼鳥を提供するだけの場所」ではなく、一過性の「映え」や話題性が消費される現代において、真正面から「旨い」焼鳥と実直に向き合うことを重視しています。また、気取らない今池の街で、背伸びすることなく上質な「時」を過ごしてもらうことを目指しており、「気軽さの延長」ではなく、「時間ごとの体験として記憶に残る焼鳥屋」となることを目標としています。
  3. [Mab社のBシリーズ展開](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGp_Uqch4zEuQj3wEnj8LAMdqD2NevzEuCcI7I8QNhhtEsPEH7RQ4PHZ2pQsci5MA7hyxpRSp6lduS9MD5XRUkzy5XoB_ULlDnnz8qHa7ruOIZT1n5qd7VXKLRRR6-7DRX-_D2NFj2JIQGpRgFd-G7s)
     > 株式会社Mabは、「繁盛店を再現する」というコンセプトのもと、人材の採用・育成・店舗運営までを本部が担う独自のフランチャイズモデル「Bシリーズ」を展開しており、「今池焼鳥 B7」もその一環としています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_今池焼鳥b7 -->

---

### サンドロップ (SUNDROP)（栄 / カフェ・バー（ロビーラウンジ）・★）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: コンラッド名古屋31階に位置し、洗練された空間と上質なサービスが魅力。パノラマビューと共に、ハリー・ウィンストンとのコラボアフタヌーンティーや夜のジャズ生演奏など、特別な体験を提供。ラグジュアリーホテルラウンジとして認知されています。
- **insiderNote**: ヒルトンのラグジュアリーブランド「コンラッド名古屋」の一部として、上質な空間とサービスを追求。ハリー・ウィンストンとのコラボや総料理長統括のメニューなど、ホテルならではの体験価値を提供しています。
- **sources_used**:
  1. [コンラッド名古屋31階に位置すること、パノラマビュー、ジャズ生演奏、洗練された空間](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFYlxxuoW8qXzXNsq6cGgGXA4n0oesIvWbLYwIbzq-JB1vj8-sG7sm_kO0jWUkLUYcWtt_gLRft4E6MRVxHqbda7Z2BNN7UNT7QFgaLSsajFKSvGPcwqBpSiaYiax5xAozxVd2r_a5TIQ-MtXynn_JWKZhjN4E=)
     > コンラッド名古屋の31階に位置するロビーラウンジ＆バー「サンドロップ」は、31階からのパノラマビューと自然光に包まれた開放的な空間が特徴です。夜にはジャズの生演奏で優雅なひとときを演出しています。
  2. [コンラッド名古屋31階に位置すること、パノラマビュー、ジャズ生演奏、洗練された空間、ラグジュアリーホテルラウンジとしての認知](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEHBdWb22zD5JAzkhfA2KLTNlaNTBu7DrmgHDU4uZDlE-RQwx6HFQvf1TDcSUxm55wJ_KNO136uaDxIezFBcvMlaZcwqNrioT-SFKT27JZED1PZTaNaqNJPCGHZat4wVpzP63F_ygJo5HZ0ZxhG)
     > コンラッド名古屋 31Fに位置するサンドロップは、31階からのパノラマビューと自然光に包まれた開放的な空間が特徴です。夜は柔らかな照明とジャズの生演奏が楽しめる落ち着いたバーとして、時間帯によって異なる雰囲気を提供しています。
  3. [ハリー・ウィンストンとのコラボアフタヌーンティー](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGTBUsHuVVgGIMUZWERxgjFZZ6V9-6wGVFSwZn5PPzcKtfX4tkJH5AfH_PjFpGw6vMbGqo_ub14Om4N3AQs4qlF8VNVGIJEZcmlcH3SCue4AQyIz_4TcfoIJE9FlcRKlYzk7ILMdG04K_Cmnfw=)
     > 世界最高峰のジュエラー「ハリー・ウィンストン」とのコラボレーションなど、特別な体験を提供しています。
  4. [ハリー・ウィンストンとのコラボアフタヌーンティー](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEM9XPK6XkNSppsMoPfG27tPq_w-odeYSHojSY0diuFq9y8XBr5BaSJC-zgPYyWGwSbToDQI8J8os_hTp7VJuny0hzDzj3h1aU9gcEyF6BlnL1k7W2O6OlAcpsymypc-7UKclMBoBIgO8Qe2rh3wvvKfJK8)
     > 世界最高峰のジュエラー「ハリー・ウィンストン」とのコラボレーションなど、特別な体験を提供しています。
  5. [ラグジュアリーホテルラウンジとしての認知](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE1I0IoF7JfUbHXgw5RJ6AjmihfGx9gihI0PjevOgAHv8-t1R5i3NSIFhPjCO-VFtH30z1hQA5E6ZQXD-AUy4HlVSQvCAyXgTRXJuL8suvBvFi4_NTtZVigywCZ7-w553d_3joFwQ==)
     > アフタヌーンティー専門サイトのTeafolioにも掲載されており、ラグジュアリーホテルラウンジとして認知されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_サンドロップ(sundrop) -->

---

### 築地すしくろ（栄 / 寿司・寿司酒場・★）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.95
- **editorReason**: 老舗「築地玉寿司」の新ブランドとして、東海地方初の「寿司酒場」スタイルを確立。熟練の職人技による本格寿司と高品質な逸品料理を、手頃な価格でカジュアルに楽しめる点が業界で注目されています。
- **insiderNote**: 老舗「築地玉寿司」の新ブランドとして、東海地方初の「寿司酒場」スタイルで出店。100年以上の歴史に裏打ちされた職人技と、カジュアルな提供スタイルが魅力です。
- **sources_used**:
  1. [「築地すしくろ」が老舗「築地玉寿司」の新ブランドであること、東海地方初出店の「寿司酒場」スタイルであること、高品質な素材を手頃な価格で提供していること、カジュアルに楽しめること、多彩な逸品料理があること、メディアで注目されていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG7iyebO8Ep4NwmcBz8eDJbrQAldv6rzAER9uBUGSRFQS4QXC5RV20HeO-uWgaNJReTwGwKKIRtsRcMYNPjUw2gKtg3F4VlXe1w_9nHrpB9gJx1bY4R_6frIvwB6NJJ1l3BKPBLN8KRpAokAba0OL3NjTLL7zc=)
     > 1924年（大正13年）に築地で創業し、100年以上の歴史を持つ「築地玉寿司」が手がける新ブランドです。
  2. [「築地すしくろ」が「築地玉寿司」の系列店であること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFiDqVqBIY3_fzBruwmGYYGS2aXZ6UbdEWUXWDdwwokXp5gOuZOOnBsNVCqSDq7L4etuN09fPE_ByH3x5fqhA-dWPVKHpjviJYasBN9bCob_oPtiRS78981FSW3VgubpWYuNAJt6S9h_Q==)
     > 「築地すしくろ」は、1924年（大正13年）に築地で創業し、100年以上の歴史を持つ「築地玉寿司」が手がける新ブランドです。
  3. [東海地方初出店であること、地元メディアで紹介されていること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHfMqGkc1LuBrMVLVIUwEpCqEjq_HjvZtVIlQE9EKTzrHu7pPnzn_xIfhXcL7sOZmqDax22xzkrYHkHv2UCBFc1VgTv7JAYnzmKEwQSAo0fjlzi0YleFp1dAg==)
     > 東海地方初出店やHAERAへのオープンが報じられています。
  4. [東海地方初出店の「寿司酒場」スタイルであること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG1liZ9cpAE4lrCNs8rcxKRWia1Ae3q3OGnriZ_l0KoB9wo6kJ9MbLWSglPx2rAIIYe19z1MUJImp8nD7Ey5_W6qAHTwiMRJl56ZCKk-Qf2w62Zq8L8o4PKYoGeboSiHGmkQrp_AhVj-Par0Kw0bev6Xts=)
     > 東海地方初出店となる「寿司酒場」というスタイルで、本格的な寿司とお酒をカジュアルに楽しめるのが特徴です。
  5. [熟練の職人技が評価されていること、コストパフォーマンスが良いこと、多彩な逸品料理があること、ライブ感のある体験ができること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFjB7FRBa7CwFd2YglOKdpCfHlZirKKTNTObP1pPRholt5HVO9YaheaMls1xNSd_gZak6TX8R-Hg3GYnC9UruEc2NHPkptPF5lcW_WOtid_j5pE5g-__svhNHiLhYfF9DDYf_nb-lc=)
     > メニュー構成、職人の丁寧な仕事、コストパフォーマンス、ホスピタリティなどが紹介されています。
  6. [高い技術を持つ料理人がいる（または求められている）こと。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGnjMcH4zvZU1MZf4d-1nT7vElkyWLK_XoAuuKj_Siv3EkpAIeZrUZoQkpX0OnsgL-N5B0qGmB913kjISFk-DKPcT4lkWP22IMkoIxkE97dtokp__9rbotkmeBdTrNpWVHfKcuVyn6Q3HwlFXTfT2U=)
     > 求人情報では「和食シェフ/料理人、調理師」の募集があり、「経験者歓迎」「有資格者歓迎」と記載されていることから、高い技術を持つ料理人が求められていることがうかがえます。
  7. [カジュアルに楽しめるスタイルであること、様々なシーンで利用できること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFX5jPwBYPASC7Msj3O9Rg3ZqDZ-umbc4UZlZTwvHERgmSeNgF3Ygm2tLafW4WBSHm8poOP0vD4u8e6PYphd1nYR_PQrRHCrFgCUgW19RGDSyE5qLEpeK_v3-NRu92U7ZBUyY2C)
     > カジュアルに本格的な江戸前寿司を楽しめる店として注目されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_築地すしくろ -->

---

### かき氷 うと（栄マルエイガレリア店）（中区 栄 / かき氷・スイーツ・★）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 複数の地元グルメメディアで紹介されており、その注目度の高さが伺える。NAGOYA BITESでも取り上げられるなど、業界からの評価も高い。
- **insiderNote**: 複数の地元グルメメディアで連続して紹介されており、その注目度は高い。NAGOYA BITESでも取り上げられている。
- **sources_used**:
  1. [複数の地元グルメメディアで紹介されている事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGBR31mWB9bNpARwnVh5GxveZxitiwHuTtXWF4jcFQYcbqdl2P3LeP1sib9rw3Qn2fwVnxaM1QbpKI_q6Toqvq7tMwy2F4Og4M37iFTtyKIsJ_JBOmvdzr29xUK4quh)
     > 2026年5月時点で、「Walker+」「日刊KELLY」「名古屋情報通」の3媒体で連続して掲載されています。
  2. [NAGOYA BITESで紹介されている事実の補強](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHxdUsWySxrJw4m_CkzupVtEA5Eeul8vGXHh9hLcfbGnUP2KWSIHFU3lGZ4RDlw3ouOdfLbyB_ahEq0Y9TnHibQnaz6QAQAR8ziMtkY0TM4JBnRX5h41fl2G9e1z5Bfi9PmXoy9gKf3ktFPb5P4-vowJ2p8sR13)
     > 現役の飲食店マネージャーが編集する名古屋・愛知専門グルメガイド「NAGOYA BITES」でも紹介されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_かき氷うと（栄マルエイガレリア店） -->

---

### ソングバード (SONGBIRD)（栄 / カフェ・★）

- **status**: OK 🟡 review-required
- **confidence**: 0.8
- **editorReason**: 2026年7月31日開業のコンラッド名古屋31階に位置し、栄駅直結の利便性が魅力。ホテルならではの質の高いコーヒーやパティスリーを、気軽に楽しめるカジュアルな空間で提供。新規店のため口コミは少ないが、今後の注目が期待される一軒です。
- **insiderNote**: コンラッド名古屋31階というロケーションと栄駅直結の利便性は、集客において大きな強み。ホテルカフェとして質の高いスイーツを提供し、カジュアル利用を促す戦略が伺える。
- **sources_used**:
  1. [コンラッド名古屋の開業日と場所、駅直結の立地](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHvYTkL_Aj8dnZKgg69jua6b5g4gMKYnpSQMR5SagRX1hobsOeScoBi04_RUuWbJSXTyT5-4y1iydtfUdibpOY4IS4TK4Jeki7HkVKyLdL6_a6tT_yNfOnttua6fe8ORx-p58tM)
     > 2026年7月31日に開業した「コンラッド名古屋」の31階にあるカフェ＆テラスです。地下鉄栄駅に直結した「ザ・ランドマーク名古屋栄」内に位置しています。
  2. [コンラッド名古屋の開業日と場所、駅直結の立地](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF3QiXfWqf6rWgtzCEDAqw0U4pPr0zMA-d7xP4zlEdAxo5P4LJeqY_4vYBWeGfZfR46KAd1WrXix3hoA9KYk243RzAKn1M6LfwQfZu7f0Velxs9wk8AasEPk2YwpXM-qzWDQ1bS8SbzpkAwamJJqD_tOmaGafgm9wI=)
     > 2026年7月31日に開業した「コンラッド名古屋」の31階にあるカフェ＆テラスです。地下鉄栄駅に直結した「ザ・ランドマーク名古屋栄」内に位置しています。
  3. [提供されるメニューと空間のコンセプト](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHZ3K0HWr5_fhLH5g5y98CL4y3BbvPEcX4CkPyVqd4_iKBMEZCVAw9g3ASgs9UH-vWUzR8yLIRBYAtqp1Fk3REjjtHigP4P5QRsc4SVeFG9WxwcFLfshUa9d6Iv--r3CGLGVkexNkyDzQ==)
     > 香り高いコーヒー、パティスリー、エスプレッソ、ティラミス、季節のジェラートなどのスイーツを提供している点が挙げられます。レストランほどフォーマルではない、気軽に立ち寄れるカジュアルな空間とされており、滞在中のリフレッシュや待ち合わせに適しています。
  4. [提供されるメニューと空間のコンセプト](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEMwNWadXiW5yRm2JkjwoKFna8sXKeSKpBVWAFe-H3CMllNieLriy8vKvI4yRP4swQkolZjCIyNrBbLXTpJ3nH6sz3HulA0UQq7boFqJN4OT1ZgUGpxyCOnoZav)
     > 香り高いコーヒー、パティスリー、エスプレッソ、ティラミス、季節のジェラートなどのスイーツを提供している点が挙げられます。レストランほどフォーマルではない、気軽に立ち寄れるカジュアルな空間とされており、滞在中のリフレッシュや待ち合わせに適しています。
  5. [Google口コミ評価や件数が取得できていない状況](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHZ3K0HWr5_fhLH5g5y98CL4y3BbvPEcX4CkPyVqd4_iKBMEZCVAw9g3ASgs9UH-vWUzR8yLIRBYAtqp1Fk3REjjtHigP4P5QRsc4SVeFG9WxwcFLfshUa9d6Iv--r3CGLGVkexNkyDzQ==)
     > 「NAGOYA BITES」ではGoogleの口コミ評価や件数が取得できていないため、「口コミ信頼度」が判定できないと記載されています。
  6. [AutoReserveで口コミがまだ投稿されていない状況](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHI4ep15iFsloK69Za4OwQPHxHIjrCAjWGUsalh2KZdsc0HswMuVfCaq4WWbFlSbeAdVZb8pd43kRdJ3Cpe8qXTCOcm3mOfwHAVn0KsWA1XxOfJC-6u0epO1BqTtbuIvTSegEfEUI3tCP1-cXKlAlr7zKBgCKZN)
     > また、「AutoReserve」では口コミがまだ投稿されていない状況です。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_ソングバード(songbird) -->

---

### 焼き鳥 大五郎（栄(ミナミ)/矢場町/大須/上前津 / 居酒屋・★4.7）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 名駅・伏見の人気店で経験を積んだ店主が、一本一本手打ちで丁寧に串を打ち、こだわりの炭火で焼き上げる絶妙な焼き鳥を提供。特に白肝はオリーブオイルとトリュフ塩で味わう逸品。昼飲みや貸切にも対応し、幅広いシーンで利用できる。
- **insiderNote**: 人気店での経験を持つ店主が、手打ち・炭火にこだわり抜いた焼き鳥を提供。白肝の味付けも特徴的で、昼飲みや貸切対応など利用シーンの幅広さも魅力。
- **sources_used**:
  1. [店主が名古屋駅や伏見の人気店で経験を積んだこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7txtfEMMDLG8Fj0-evFSxJNfa7wP1xgF22QOOzjaSMVIXJ9yH-EL9S1fPgzEUGSEfaKCBRX_G9z_50_ENzCDW7su1iqEIzZVrIR-6Pu5cUxNjIT6JuOY83T45XdNPXejD3Y2ZgueZNMFenVxbs8OfBNaZQoVZtvlGXLc5J94nCH6TBUYvF8GEO8437h3ehw==)
     > 店主は、名古屋駅や伏見の人気店で経験を積んだ後に独立して店をオープンしました。
  2. [一本一本手打ちで串に刺し、厳選した炭火で焼き上げるこだわり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7txtfEMMDLG8Fj0-evFSxJNfa7wP1xgF22QOOzjaSMVIXJ9yH-EL9S1fPgzEUGSEfaKCBRX_G9z_50_ENzCDW7su1iqEIzZVrIR-6Pu5cUxNjIT6JuOY83T45XdNPXejD3Y2ZgueZNMFenVxbs8OfBNaZQoVZtvlGXLc5J94nCH6TBUYvF8GEO8437h3ehw==)
     > 一本一本丁寧に手打ちで串に刺し、厳選した炭火で焼き上げることにこだわっています。
  3. [白肝がオリーブオイルとトリュフ塩で味付けされていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7txtfEMMDLG8Fj0-evFSxJNfa7wP1xgF22QOOzjaSMVIXJ9yH-EL9S1fPgzEUGSEfaKCBRX_G9z_50_ENzCDW7su1iqEIzZVrIR-6Pu5cUxNjIT6JuOY83T45XdNPXejD3Y2ZgueZNMFenVxbs8OfBNaZQoVZtvlGXLc5J94nCH6TBUYvF8GEO8437h3ehw==)
     > 特に白肝は、甘みと脂身が特徴で、オリーブオイルとトリュフ塩で味付けされています。
  4. [白肝がオリーブオイルとトリュフ塩で味付けされていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG_98CRJY7uWST7Nh9aLzS9I_Wpv3sMe-vPoT5gfy2PUGBaa-AX4Z6gFNikBZpFBHkQslKDZDfSlTnb_dRurT6LQW1koS2FdTjYczIY8O9v4ZMCefWFVrsxclgL_k7OyJ8vfw==)
     > 特に白肝は、甘みと脂身が特徴で、オリーブオイルとトリュフ塩で味付けされています。
  5. [土日祝日の昼飲み対応](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7txtfEMMDLG8Fj0-evFSxJNfa7wP1xgF22QOOzjaSMVIXJ9yH-EL9S1fPgzEUGSEfaKCBRX_G9z_50_ENzCDW7su1iqEIzZVrIR-6Pu5cUxNjIT6JuOY83T45XdNPXejD3Y2ZgueZNMFenVxbs8OfBNaZQoVZtvlGXLc5J94nCH6TBUYvF8GEO8437h3ehw==)
     > 土日祝日は12時から昼飲みが可能で、生ビールやハイボールなどを楽しめます。
  6. [土日祝日の昼飲み対応](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG_98CRJY7uWST7Nh9aLzS9I_Wpv3sMe-vPoT5gfy2PUGBaa-AX4Z6gFNikBZpFBHkQslKDZDfSlTnb_dRurT6LQW1koS2FdTjYczIY8O9v4ZMCefWFVrsxclgL_k7OyJ8vfw==)
     > 土日祝日は12時から昼飲みが可能で、生ビールやハイボールなどを楽しめます。
  7. [10名からの貸切対応](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7txtfEMMDLG8Fj0-evFSxJNfa7wP1xgF22QOOzjaSMVIXJ9yH-EL9S1fPgzEUGSEfaKCBRX_G9z_50_ENzCDW7su1iqEIzZVrIR-6Pu5cUxNjIT6JuOY83T45XdNPXejD3Y2ZgueZNMFenVxbs8OfBNaZQoVZtvlGXLc5J94nCH6TBUYvF8GEO8437h3ehw==)
     > また、10名からの貸切にも対応しています。
  8. [10名からの貸切対応](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG_98CRJY7uWST7Nh9aLzS9I_Wpv3sMe-vPoT5gfy2PUGBaa-AX4Z6gFNikBZpFBHkQslKDZDfSlTnb_dRurT6LQW1koS2FdTjYczIY8O9v4ZMCefWFVrsxclgL_k7OyJ8vfw==)
     > 10名からの貸切にも対応しています。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J003611005 -->

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

### 肉たらし 栄店（栄(ミナミ)/矢場町/大須/上前津 / 居酒屋・★4.7）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 顧客ニーズに応え、日々メニューを改訂し人気を探求する姿勢が強み。個室で提供される豊富な肉寿司食べ飲み放題は、高いコストパフォーマンスで支持され、主要グルメサイトでも多数紹介されています。
- **insiderNote**: 顧客の要望に応じたメニュー改訂と価格へのこだわりが、食べ飲み放題の人気の秘訣。主要グルメサイトでの露出も高く、集客戦略が成功している。旬の鮮魚提供も差別化ポイント。
- **sources_used**:
  1. [顧客の要望に応じたメニュー改訂、価格へのこだわり、旬の鮮魚提供、食べ飲み放題の人気の秘訣、主要グルメサイト掲載](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHG1KJzswxeHJPFc8Us3dKpzjSo5nrH_ORZFgVxfx5eJzGg0OGlAo0BbAyj-Pa4TIpDv-nd0qhSsMJBOF1GJ6WrGliRNhoGKd9dJOMxEPjcBhoRsURdDxe3txvWqzZE)
     > お客様の声を元に日々メニューを改訂し、常に求められている人気メニューを探求することで、食べ飲み放題の人気の秘訣としています。一人でも多くのお客様にご利用頂けるよう、価格にもこだわっております。店主の目利きで厳選した旬の鮮魚もご提供しております。
  2. [個室提供](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFcyK3H-Fh78-RLNdBVpOCC3xeBX2rdVKFSMagMHNVKTqJt3Tnx-ukH2HCbTu_pKHW1yrnsRSRGoR50COtev-qslRSoz99wzBfw91dX5Mc5JTwtRDqX8UPR6cckdmCymagBvg==)
     > 全席個室or半個室
  3. [肉寿司食べ放題、コストパフォーマンスの高さ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGpNzgZG34C0cS2PEEs81z7CaBZ3-NSyD6ErDC_XusUVzuRMuL64t1jcNYZJn1jF9anXG2U7VcqSJSwkOdSG-3G40a3yn7c9oSez-s8zYgYFvh9UCw3AFQNzsIHo3beT6G98KFJgw==)
     > 名古屋市中区 ｜ 「肉たらし 栄店」 コスパ最強の肉寿司食べ放題コース！
  4. [主要グルメサイト掲載](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHYy3t93LwY4X3oF1KDAesl-55WC42Bhorf7SqpziIYmVqudqVW88aHbszehui6KaxzS5XKhJJYN2huhVXEQXAk6oAPLtqsMCN3nM3KwG9s43fuAotbYyJUX8T2laW7aQCMA8s_VAe12gGg1aXbv5rEmfXdazCoj_q2Og==)
     > Rettyに掲載
  5. [主要グルメサイト掲載](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFJKk5VynJJTXaYdXtBzufc6fRHgqYHmGlJLRH6HPjQHtSwDNmrauqN5U2SHuDFgXOpoe4PXluvI_SJ9wuJFhog20r5718uORK3J4LCP-mw8-5yo37n226jKtbiVLQbaE_2QZo0pZwm8fijHf-5dg8=)
     > じゃらんnetに掲載
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J003851859 -->

---

### おしゃべりバー（栄(ミナミ)/矢場町/大須/上前津 / バー・カクテル・★4.8）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 「日本一敷居の低いバー」を掲げ、多様な人々が集い交流できる場を提供。店主の情熱と人柄が魅力で、ノンアルコールにも注力し、幅広い客層に支持される独自のバー体験を創出しています。
- **insiderNote**: 飲食店未経験から「日本一敷居の低いバー」を創り上げた店主の情熱と、来店客を巻き込むコミュニティ形成力が成功の鍵。コイン制や紹介文など、独自の仕掛けも秀逸です。
- **sources_used**:
  1. [「日本一敷居の低いバー」というコンセプト](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkk_UUFSbzavXYzcgFPrTY37Y_84MAC0yj1pOWy3snHzCyWhzqIV74mtvr-pC_kHDWsYiMG5XVLmEIpED9Lk_a6I37-6kp-tTodv0Q1JRXuQXWc2nRucMVRzyJ-r-UYI2p3ou0eFSfcwJDoUPbLvA=)
     > 「おしゃべりバー」の店主は木下翔平さんで、「日本一敷居の低いバー」をコンセプトに掲げています。
  2. [多様な人々が集まり交流できる場であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkk_UUFSbzavXYzcgFPrTY37Y_84MAC0yj1pOWy3snHzCyWhzqIV74mtvr-pC_kHDWsYiMG5XVLmEIpED9Lk_a6I37-6kp-tTodv0Q1JRXuQXWc2nRucMVRzyJ-r-UYI2p3ou0eFSfcwJDoUPbLvA=)
     > 「おしゃべりバー」では、「可能性が広がる場所」として、世界一周した旅人、プロギャンブラー、イベンター、お笑い芸人、Youtuber、アイドル、会社の社長、医師、介護士、看護師、事務員、サラリーマン、OL、公務員、大学生、専業主婦、子連れ、フリーターなど、多様なバックグラウンドを持つ人々が集まり、人生の可能性を広げる機会を提供しています。
  3. [多様な人々が集まり交流できる場であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpRw9-BF26NdEyNVxJWueqxDdAlGeGrxHJzTjvsx2ftpxSE24DDf7fNiSKXhQdqr8Pa1vwupgUOfD0t0Vy80tPSSisOw2i6WTk1RYWTmw2_PlrQRw0leXjPHfC1IAx5D3KtvdaDPNDVws0LDgi5NHwph7JSXmmYEoB4EpnHa7FmnmkpQxmphfgqm8g2Hv1BkuET8iEme0A6Vq2i_Q3va1ZW_DkNjb_BHx29yGnARDu_cZ5N7QeyrYlJB7OalbHOK3uZ1wmuY6rjVEElguo6U_vn0MhX_kVo77s5NclAUDoP-ldJDZTCty2yRKqCWDyDoV5QT59YqCvtQjPEq8jFIYiNPVDxuhTq8O7dsbxf6xT)
     > 「おしゃべりバー」は、「友達作りができる場所」として広く認識されています。スタッフはフランクな人柄で、会話のきっかけ作りをサポートしています。
  4. [店主の情熱](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkk_UUFSbzavXYzcgFPrTY37Y_84MAC0yj1pOWy3snHzCyWhzqIV74mtvr-pC_kHDWsYiMG5XVLmEIpED9Lk_a6I37-6kp-tTodv0Q1JRXuQXWc2nRucMVRzyJ-r-UYI2p3ou0eFSfcwJDoUPbLvA=)
     > バーの成功のためには1日2時間睡眠で働くほどの情熱を持つ一方で、準備の多くを友人に手伝ってもらうなど、周囲の力を借りることも厭わない人物像がうかがえます。
  5. [店主の人柄](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpRw9-BF26NdEyNVxJWueqxDdAlGeGrxHJzTjvsx2ftpxSE24DDf7fNiSKXhQdqr8Pa1vwupgUOfD0t0Vy80tPSSisOw2i6WTk1RYWTmw2_PlrQRw0leXjPHfC1IAx5D3KtvdaDPNDVws0LDgi5NHwph7JSXmmYEoB4EpnHa7FmnmkpQxmphfgqm8g2Hv1BkuET8iEme0A6Vq2i_Q3va1ZW_DkNjb_BHx29yGnARDu_cZ5N7QeyrYlJB7OalbHOK3uZ1wmuY6rjVEElguo6U_vn0MhX_kVo77s5NclAUDoP-ldJDZTCty2yRKqCWDyDoV5QT59YqCvtQjPEq8jFIYiNPVDxuhTq8O7dsbxf6xT)
     > 口コミでは「店長さんがとても良い方」「気さくでおしゃべりも絶え間なく喋り続けてしまう」と評されており、その親しみやすい人柄が居心地の良い空間作りに貢献していることがうかがえます。
  6. [ノンアルコールドリンクへの注力](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkk_UUFSbzavXYzcgFPrTY37Y_84MAC0yj1pOWy3snHzCyWhzqIV74mtvr-pC_kHDWsYiMG5XVLmEIpED9Lk_a6I37-6kp-tTodv0Q1JRXuQXWc2nRucMVRzyJ-r-UYI2p3ou0eFSfcwJDoUPbLvA=)
     > 緊急事態宣言下でアルコール提供ができない時期には、店長が研究を重ねて美味しいノンアルコールドリンクを提供していたという評価もあります。
  7. [ノンアルコールドリンクへの注力](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpRw9-BF26NdEyNVxJWueqxDdAlGeGrxHJzTjvsx2ftpxSE24DDf7fNiSKXhQdqr8Pa1vwupgUOfD0t0Vy80tPSSisOw2i6WTk1RYWTmw2_PlrQRw0leXjPHfC1IAx5D3KtvdaDPNDVws0LDgi5NHwph7JSXmmYEoB4EpnHa7FmnmkpQxmphfgqm8g2Hv1BkuET8iEme0A6Vq2i_Q3va1ZW_DkNjb_BHx29yGnARDu_cZ5N7QeyrYlJB7OalbHOK3uZ1wmuY6rjVEElguo6U_vn0MhX_kVo77s5NclAUDoP-ldJDZTCty2yRKqCWDyDoV5QT59YqCvtQjPEq8jFIYiNPVDxuhTq8O7dsbxf6xT)
     > 特に、アルコール提供ができない期間に店長が研究を重ねて提供したノンアルコールドリンクも「とてもおいしかった」と評価されています。
  8. [幅広い客層に支持されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkk_UUFSbzavXYzcgFPrTY37Y_84MAC0yj1pOWy3snHzCyWhzqIV74mtvr-pC_kHDWsYiMG5XVLmEIpED9Lk_a6I37-6kp-tTodv0Q1JRXuQXWc2nRucMVRzyJ-r-UYI2p3ou0eFSfcwJDoUPbLvA=)
     > 客層は20代から60代と幅広く、男女比は男性がやや多めの6:4です。ナンパや勧誘目的ではなく、純粋に友達や話し相手を求める人が集まる場所とされています。
  9. [幅広い客層に支持されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpRw9-BF26NdEyNVxJWueqxDdAlGeGrxHJzTjvsx2ftpxSE24DDf7fNiSKXhQdqr8Pa1vwupgUOfD0t0Vy80tPSSisOw2i6WTk1RYWTmw2_PlrQRw0leXjPHfC1IAx5D3KtvdaDPNDVws0LDgi5NHwph7JSXmmYEoB4EpnHa7FmnmkpQxmphfgqm8g2Hv1BkuET8iEme0A6Vq2i_Q3va1ZW_DkNjb_BHx29yGnARDu_cZ5N7QeyrYlJB7OalbHOK3uZ1wmuY6rjVEElguo6U_vn0MhX_kVo77s5NclAUDoP-ldJDZTCty2yRKqCWDyDoV5QT59YqCvtQjPEq8jFIYiNPVDxuhTq8O7dsbxf6xT)
     > 初めて来店する人、女性一人での来店、ノンアルコールドリンクのみの利用も歓迎しており、敷居の低いバーとして運営されています。客層は20代から60代と幅広く、男女比は男性がやや多めの6:4です。
  10. [飲食店未経験からバーを始めたことと店主の情熱](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkk_UUFSbzavXYzcgFPrTY37Y_84MAC0yj1pOWy3snHzCyWhzqIV74mtvr-pC_kHDWsYiMG5XVLmEIpED9Lk_a6I37-6kp-tTodv0Q1JRXuQXWc2nRucMVRzyJ-r-UYI2p3ou0eFSfcwJDoUPbLvA=)
     > 飲食店での経験や資金が全くない状態からバーを始めたとされています。バーの成功のためには1日2時間睡眠で働くほどの情熱を持つ一方で、準備の多くを友人に手伝ってもらうなど、周囲の力を借りることも厭わない人物像がうかがえます。
  11. [飲食店未経験からバーを始めたことと「日本一敷居の低いバー」というコンセプト](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpRw9-BF26NdEyNVxJWueqxDdAlGeGrxHJzTjvsx2ftpxSE24DDf7fNiSKXhQdqr8Pa1vwupgUOfD0t0Vy80tPSSisOw2i6WTk1RYWTmw2_PlrQRw0leXjPHfC1IAx5D3KtvdaDPNDVws0LDgi5NHwph7JSXmmYEoB4EpnHa7FmnmkpQxmphfgqm8g2Hv1BkuET8iEme0A6Vq2i_Q3va1ZW_DkNjb_BHx29yGnARDu_cZ5N7QeyrYlJB7OalbHOK3uZ1wmuY6rjVEElguo6U_vn0MhX_kVo77s5NclAUDoP-ldJDZTCty2yRKqCWDyDoV5QT59YqCvtQjPEq8jFIYiNPVDxuhTq8O7dsbxf6xT)
     > 「おしゃべりバー」の店主は木下翔平さんで、「日本一敷居の低いバー」をコンセプトに掲げています。飲食店での経験や資金が全くない状態からバーを始めたとされています。
  12. [来店客を巻き込むコミュニティ形成力](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkk_UUFSbzavXYzcgFPrTY37Y_84MAC0yj1pOWy3snHzCyWhzqIV74mtvr-pC_kHDWsYiMG5XVLmEIpED9Lk_a6I37-6kp-tTodv0Q1JRXuQXWc2nRucMVRzyJ-r-UYI2p3ou0eFSfcwJDoUPbLvA=)
     > 来店客もバーを一緒に作り上げる仲間として尊重する「フランクな場所」であることを重視しています。
  13. [来店客を巻き込むコミュニティ形成力](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpRw9-BF26NdEyNVxJWueqxDdAlGeGrxHJzTjvsx2ftpxSE24DDf7fNiSKXhQdqr8Pa1vwupgUOfD0t0Vy80tPSSisOw2i6WTk1RYWTmw2_PlrQRw0leXjPHfC1IAx5D3KtvdaDPNDVws0LDgi5NHwph7JSXmmYEoB4EpnHa7FmnmkpQxmphfgqm8g2Hv1BkuET8iEme0A6Vq2i_Q3va1ZW_DkNjb_BHx29yGnARDu_cZ5N7QeyrYlJB7OalbHOK3uZ1wmuY6rjVEElguo6U_vn0MhX_kVo77s5NclAUDoP-ldJDZTCty2yRKqCWDyDoV5QT59YqCvtQjPEq8jFIYiNPVDxuhTq8O7dsbxf6xT)
     > 店長は顔が広く、来店客同士の交流を促す役割も果たしているようです。
  14. [コイン制と店内紹介文という独自の仕掛け](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkk_UUFSbzavXYzcgFPrTY37Y_84MAC0yj1pOWy3snHzCyWhzqIV74mtvr-pC_kHDWsYiMG5XVLmEIpED9Lk_a6I37-6kp-tTodv0Q1JRXuQXWc2nRucMVRzyJ-r-UYI2p3ou0eFSfcwJDoUPbLvA=)
     > 料金システムとして、チャージした金額に応じてドリンクと交換できる「コイン制」を導入しているようです。店内には、これから何かを頑張りたいという人々の紹介文が貼られており、他のバーにはないユニークなポイントと評されています。
  15. [コイン制と店内紹介文という独自の仕掛け](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpRw9-BF26NdEyNVxJWueqxDdAlGeGrxHJzTjvsx2ftpxSE24DDf7fNiSKXhQdqr8Pa1vwupgUOfD0t0Vy80tPSSisOw2i6WTk1RYWTmw2_PlrQRw0leXjPHfC1IAx5D3KtvdaDPNDVws0LDgi5NHwph7JSXmmYEoB4EpnHa7FmnmkpQxmphfgqm8g2Hv1BkuET8iEme0A6Vq2i_Q3va1ZW_DkNjb_BHx29yGnARDu_cZ5N7QeyrYlJB7OalbHOK3uZ1wmuY6rjVEElguo6U_vn0MhX_kVo77s5NclAUDoP-ldJDZTCty2yRKqCWDyDoV5QT59YqCvtQjPEq8jFIYiNPVDxuhTq8O7dsbxf6xT)
     > 料金システムとして、チャージした金額に応じてドリンクと交換できる「コイン制」を導入しているようです。店内には、これから何かを頑張りたいという人々の紹介文が貼られており、他のバーにはないユニークなポイントと評されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J001285296 -->

---

### 和ダイニング みつ橋（栄(ミナミ)/矢場町/大須/上前津 / 和食・★4.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 季節の旬を大切にする職人の技が光る和食店。臨場感あるカウンターから個室まで多様な席種で、一人から大人数、接待まで幅広いシーンに対応。地元メディアでの紹介も多く、安定した人気と評価を誇る。
- **insiderNote**: 旬の食材へのこだわりと職人の技、多様な席種で幅広い客層に対応できる点が強み。地元メディア露出も多く、集客力も期待できる。
- **sources_used**:
  1. [季節の旬を重視した食材へのこだわり、職人の技、カウンター席や個室を含む多様な席種、幅広いシーンでの利用可能性、ホットペッパーグルメでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEAx17Gu-tEi2JEDZZpP3lqztr5RVlgpQ1o6chj5Gb2dXHhY6-drmPSooLvtQt4_AqbE4aXapxr2pZcQ6aSawMudrcDkw2KU7w1Yv7wxWSn4ffTMS6tid3uEBiD-XYjJ6o5by0Vxf-vLMCStQzG)
     > 季節ごとに旬の食材を心ゆくまで味わえるよう、仕入れから調理まで一貫したこだわりを持っています。特に「春」「夏」「秋」「冬」それぞれの季節の「旬」を重視しています。職人が調理する様子を見ながら食事ができる臨場感あふれるカウンター席があり、一人での利用も歓迎されています。 また、木を基調とした落ち着いた雰囲気の広々としたテーブル席は少人数から20名までの大人数に対応可能で、2名用のボックス席や6名まで
  2. [季節の旬を重視した食材へのこだわり、職人の技、カウンター席や個室を含む多様な席種、幅広いシーンでの利用可能性、楽天ぐるなびでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEh7ZGxVsavRe00eDrUCmm4O6k5MGJqvnYwsztNhE7pWokQaXEpq1EMigocnrt1s3N7elWki98ekF4r0LSyvjvVENmd9--mndCwgowPjeJVEZnFrOZJUFGRyuGJjl7r)
     > 季節ごとに旬の食材を心ゆくまで味わえるよう、仕入れから調理まで一貫したこだわりを持っています。特に「春」「夏」「秋」「冬」それぞれの季節の「旬」を重視しています。職人が調理する様子を見ながら食事ができる臨場感あふれるカウンター席があり、一人での利用も歓迎されています。 また、木を基調とした落ち着いた雰囲気の広々としたテーブル席は少人数から20名までの大人数に対応可能で、2名用のボックス席や6名まで
  3. [CBCテレビでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGuUnpqTzhJ7YF6EnYypVLkUJdWDgBo4siAaf9j7HPzLq230URo3CYl3DAqIKQRaTBX74c1VhFhQI_qv0gxtZvW9j3F8YG5z9PaTkX-PafBoPUzzx1azg9PZtwFzLx9fddFCqN_WVWlo9lRaWXpaTNn)
     > CBCテレビ「うまい！の極み」: 2026年1月10日に放送された回で紹介されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J003648049 -->

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

### おばんざい おでん 蕎麦　あづみ　名古屋伏見店（栄ｷﾀ錦/伏見丸の内/泉/東桜/新栄 / 居酒屋・★3.9）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 旬の食材を活かしたおばんざいやこだわりのあご出汁おでん、本格蕎麦を日本酒と共に楽しめる蕎麦居酒屋。伏見駅徒歩1分の好立地で、多様なシーンに対応する完全個室も完備しており、幅広い客層に支持されるでしょう。
- **insiderNote**: 旬の食材を活かした手作り料理とこだわりの出汁、厳選日本酒で差別化。伏見駅徒歩1分の好立地と多様な個室は、ビジネス・プライベート両面で集客力が高く、主要グルメメディアでの露出も強み。
- **sources_used**:
  1. [旬の食材を用いたおばんざい、こだわりのあご出汁おでん、自家製醤油かえしを使用した蕎麦を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHV1KMxWSYaPgRhccSl2o61cUFTKwH9rpX8KK9HC3EQ-WFPxXOptaFk_EG5HgDv5XCbu3Pr6wZRJIjW1IWQ5CL5eo7Tt3Qo-Ytb9fP4BJ-dkiAWhQMUlph5dmFa7g==)
     > 旬の食材を用いた日替わりのおばんざいをはじめ、こだわりのあご出汁おでんや自家製醤油かえしを使用した蕎麦、他では味わえない趣向を凝らした逸品料理を多数提供しています。
  2. [旬の食材を用いたおばんざい、こだわりのあご出汁おでん、自家製醤油かえしを使用した蕎麦を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEU4ikc2IW-p7GsWaPT-1wvuZgru-sd5XhPK1tlp7GtGL2lLvxueZnGX2nqAu6j0T5qZgE4PyhJgrGXJFztye4G7G8GbgtpP9Rr8Zj35SUtXAwdAU7W4wB14TLUDlIT2J1LSxmF4Afu)
     > 旬の食材を用いた日替わりのおばんざいをはじめ、こだわりのあご出汁おでんや自家製醤油かえしを使用した蕎麦、他では味わえない趣向を凝らした逸品料理を多数提供しています。
  3. [毎日変わる手作りのおばんざい、濃厚なあご出汁おでん、本格的な蕎麦を日本酒と共に味わえる蕎麦居酒屋であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFD18M7YMcJ9mRFvLVApXCGUkvL7MxoQPRdoRR5o-X1Df2K1yJn0e9IjLUt4NLvv2XN9yFDXAgu77-CellbfGy0VKDuSefKkIsFkD5NpUjzvWf3TeO_48bPw3ozITZfWaTtvCn511yF)
     > 毎日変わる手作りのおばんざい、濃厚なあご出汁おでん、本格的な蕎麦を日本酒と共に味わえる蕎麦居酒屋です。
  4. [2名から最大24名まで利用可能な完全個室を完備し、接待や各種宴会など様々なシーンに対応できること、および伏見駅から徒歩1分という利便性の高い立地であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEwnb3rogz4nXLKFJnaIULjDejkjihMS_2gjry-Ta-VYfMO83nHI5wNmA54yMFXIinogDAM_RO2n70Q497wkD9LsEiYy45AlCM6FsnXUKWWBjgfEi_B2wwGrvpS-NyunSXiONpAHBQ=)
     > 2名様～最大24名様までご利用可能な完全個室を完備。接待や歓迎会、各種宴会、会食、デートなど様々なシーンに対応しております。伏見駅から徒歩1分という利便性の高い立地も特徴です。
  5. [2名から最大24名まで利用可能な完全個室を完備し、接待や各種宴会など様々なシーンに対応できること、および伏見駅から徒歩1分という利便性の高い立地であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHdeVMQC2FYOvpYyJJQXFKRmKxZUKeOX25X5f0EBh1TQyyvwzqXWmHP9nMKVWCG9R9cvB4nmOB79_Sqi-wt4hR3WWnwj-3bP7SfNjpk98AeuwBeEf_t9DtxIydrhuU=)
     > 2名様～最大24名様までご利用可能な完全個室を完備。接待や歓迎会、各種宴会、会食、デートなど様々なシーンに対応しております。伏見駅から徒歩1分という利便性の高い立地も特徴です。
  6. [主要なグルメメディアに多数掲載されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE6TYrNFsoOwhmp2wCRw2TAW8clSrsGqYr7c_bz5FyBh4dVLtlGiOEEMp7iGh61Cj1BvKHiz0myrFOEDE3q8JZl7hU1c2lGgzbfFjNSHuFAmw2Pokx9HdlFehcJ4zA4CTMYvgc=)
     > ホットペッパーグルメ、楽天ぐるなび、一休.comレストラン、Retty、ヒトサラ、PayPayグルメ、Let's ENJOY TOKYOなどの主要なグルメメディアに掲載されています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J003624387 -->

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

### 一魚魚一 名古屋駅（名古屋（名古屋駅/西区/中村区） / 居酒屋・★）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 柳橋市場直送の新鮮な魚介を「レア天ぷら串」や「焼うお」など独創的な調理法で提供。20種の日本酒セルフ飲み放題や個別盛りコースで顧客体験も充実。地元メディアでの紹介も多く、注目度の高い一軒です。
- **insiderNote**: 柳橋市場直送の魚にこだわり、レア天ぷら串や焼うおなど新しい魚料理を提案。オリジナルいなり寿司や厳選藁焼きも名物。個別盛りコースや日本酒セルフ飲み放題など、顧客ニーズに応える提供スタイルも特徴。
- **sources_used**:
  1. [柳橋市場直送の新鮮な魚介、レア天ぷら串、焼うお、独創的な料理、個別盛りコース、20種の日本酒セルフ飲み放題](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAEjsKjB8poNkL2cCsQzttH76Uzy9dh8xaMp-ZnkcSu5xLZrJXlU8S8QBLPST4W5xkK6-oxovMwVw-e1iydhyF2JJ-6fe88-EWLnoYG1FOFhju9HXWY3z2zK-VlOfnaOWlkA==)
     > 「一魚魚一 名古屋駅」は、柳橋市場から直送される新鮮な魚を仕入れていることにこだわっています。刺身で食べられる魚介類を串打ちし、素材ごとに下味を変えて旨さを引き出す「レア天ぷら串」が名物です。また、焼肉や焼鳥のようにタレに漬けて表面を軽く炙る「焼うお」という新しい魚介類の美味しさを提案しており、生で食べられる魚にひと手間加えることで、新しい美味しさを提案する独創的な料理が自慢です。コース料理は一人
  2. [柳橋市場直送の新鮮な魚介、レア天ぷら串、焼うお、独創的な料理、個別盛りコース、20種の日本酒セルフ飲み放題](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFNThi40qE4kLoUR6ImcX2PnOduTBy0Vj6lqAQVIGnwBIA4uza4q7ncr6tDEV9aYC8NAoJ2ddp9ebiCzGabNDSchXQ6DaZ7rXtym1oRkscW1f5ofDqGhXQL6NAas8WU)
     > 「一魚魚一 名古屋駅」は、柳橋市場から直送される新鮮な魚を仕入れていることにこだわっています。刺身で食べられる魚介類を串打ちし、素材ごとに下味を変えて旨さを引き出す「レア天ぷら串」が名物です。また、焼肉や焼鳥のようにタレに漬けて表面を軽く炙る「焼うお」という新しい魚介類の美味しさを提案しており、生で食べられる魚にひと手間加えることで、新しい美味しさを提案する独創的な料理が自慢です。コース料理は一人
  3. [地元グルメメディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEkw2BNgDz5tUyoP2VxpaQLf8SxQ5VKDzr4e2VotgfbMhDYBGWjWx3dty5-uxj6WpTLU8O7hviZxiwd1dKpbNPhvFN1HORvb9lCarJfZi5bdNtm8R5nsUG-XZVPWLYqMklAD7GaY95R0cRm-Q==)
     > 東海テレビの「yum-yumグルメ」
  4. [地元グルメメディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEeG4oDoHLIRq1SWqu33FnnjXeIAVZgDcmfFmTFJvh2XKz9xpP9naQPQoXmFV7EVVN6esaaXlvensAPUkyKnlBX07vGE0pr65zJlUmFeaBR2B_XoqXQhRjbuMt0fNdJJ76n-msx3PqA97uViaZU)
     > 名古屋最大級のWebメディア「ナゴレコ」
  5. [地元グルメメディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTgPtez7qPueEyEDBsWpmA8q74zn1maI7T8x1EGztJeoDJj77lzm2Buh9q7qNQXH95PJgrNJv4rasgsO7jufaJJfj65_wEMdTV4SGKS7Ez6cDz6AUncltCjoY6El3-foU5w8d932A=)
     > YouTubeチャンネル「【海鮮天国】名古屋駅すぐ『一魚魚一』の絶品ランチを堪能」

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J003498668 -->

---

### おばんざいBar Place（栄ｷﾀ錦/伏見丸の内/泉/東桜/新栄 / 創作料理・★4.7）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: Google評価4.7と高評価のおばんざいバー。毎日日替わりの手作り料理は家庭的な味わいでお酒との相性も抜群。一人でも安心して過ごせるアットホームな空間が、多くの客に「第3の居場所」として支持されています。
- **insiderNote**: 看護師から転身した店主が「居場所」作りにこだわるコンセプトが、Google評価4.7と高い口コミ信頼度に繋がっています。毎日日替わりの手作り料理も魅力。
- **sources_used**:
  1. [毎日日替わりの手作り料理を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHaDYWDuRVx1uUsrpKXcnfOz6ffT6nPubPF8KjfNv9CdQX6Xms-obK9xGAAJIGxwOF7ncqh5Jstv66ULq6MxYnTAZKMxR8mafNLdwdKAUS-JB55UoXztbbZZ0kFAeNYTteEfb4I8OyNaA==)
     > 毎日日替わりで、手作り料理を提供
  2. [手作りおばんざいが家庭的な味わいでお酒との相性も抜群であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHaDYWDuRVx1uUsrpKXcnfOz6ffT6nPubPF8KjfNv9CdQX6Xms-obK9xGAAJIGxwOF7ncqh5Jstv66ULq6MxYnTAZKMxR8mafNLdwdKAUS-JB55UoXztbbZZ0kFAeNYTteEfb4I8OyNaA==)
     > 手作りのおばんざいはどれもお酒との相性が抜群とされています。温かみのある家庭的な味わいが特徴です。
  3. [一人でも安心して過ごせるアットホームな空間であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHaDYWDuRVx1uUsrpKXcnfOz6ffT6nPubPF8KjfNv9CdQX6Xms-obK9xGAAJIGxwOF7ncqh5Jstv66ULq6MxYnTAZKMxR8mafNLdwdKAUS-JB55UoXztbbZZ0kFAeNYTteEfb4I8OyNaA==)
     > アットホームで居心地の良い空間作りを重視しており、初めての客でも安心して楽しめる雰囲気です。
  4. [店主が看護師から転身し「居場所」作りにこだわるコンセプトであること、多くの客に「第3の居場所」として支持されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE6QRou7dmV5U_2s0HvKAUu2ahAm7S9JeGmwQLJEGzGZJWUVcwQvUuAzyWh3F5GYxUKVo9RPnWzZfT-SsJnjjH2qOviW0U7ENBnNq-VZoy5LE8viw2VskfBaSASp0iSUKeQ6Nzwen1ETSBrMiAZsLM=)
     > 店主のなつみさんは、25歳で看護師のキャリアを辞め、このおばんざいバーを開業しました。命の現場を見てきた経験から「死ぬことに比べたら、大抵のことはかすり傷」という強い信念を持ち、来店客にとっての「居場所」を作ることにこだわっています。
- **warnings**: 6件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J003498103 -->

---

### muse ミューズ 名古屋栄はなれ店（栄(ミナミ)/矢場町/大須/上前津 / カフェ・スイーツ・★4.8）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: シーシャカフェ＆バーとして、リゾート風の非日常空間と100種以上のシーシャ、そして自家製スイーツの質の高さが魅力。翌朝5時までの営業で、夜カフェから終電後まで多様なニーズに応え、地元メディアでも注目される人気店です。
- **insiderNote**: シーシャカフェ＆バーとして、リゾート風の空間と自家製スイーツで差別化。翌朝5時までの営業や貸切対応で多様なニーズを捉え、地元メディアでの露出も高い。
- **sources_used**:
  1. [リゾート風の空間づくり、100種類以上のシーシャフレーバー、翌朝5時までの長時間営業、複数の地元グルメメディアでの紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHeanWlwg8Y_wGzQHg_NmFdWiQ_FfdCDFyQFJpyObY7C5Fxyf106LfiPR0PPjEGH6BXUt-tdUTfr7OdbXHaGT7YfSafAdJfcsH1K948XFjf1IylnAZc8o_bNjVyrG8MS2o2dIATPAOlIZU-UejoWvxe5rsfiW86mFlFHkZkmk0=)
     > シーシャだけでなく、心身ともにリラックスできる空間づくりにこだわっています。大きな木を配したリゾート風のインテリアやウッドデッキ、ハンモック席を設けることで、非日常的な癒しの時間を提供することを目指しています。ノンニコチンフレーバーを含む100種類以上の豊富なフレーバーを取り揃え、厳選された機材を使用することで、濃く柔らかな煙を楽しめるよう工夫されています。営業時間は翌朝5時までと長く、夜カフェと
  2. [自家製スイーツへのこだわりと人気、地元グルメメディア（ナゴレコ）での紹介](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFI3PfvLURXuX3dETNpX7-zDHgxSK_faRdHNvPB2qYhhew6luSYqyDxSApYMc6uqTn01TyJha1ztxTuSikUfhi1kg_8DYBtYxto6c23Fm1RQDO9JWVaILcBt8nafYTrvUhpCJx-0z3z)
     > 特に「自家製」と銘打たれたスイーツは、お店のこだわりとして強調されています。「芋ばたぁジェラートサンド」は1日10食限定の人気メニューとして紹介されています。ナゴレコでは、その癒しの空間や自家製スイーツが取り上げられています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J003828618 -->

---

### 焼き鳥屋 鳥蔵（栄(ミナミ)/矢場町/大須/上前津 / 和食・★4.6）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 紀州備長炭で丁寧に焼き上げる本格焼き鳥を提供。ホットペッパーやぐるなびなど複数のグルメメディアに掲載され、ネット予約にも対応しており、高い集客力と利便性を兼ね備えています。
- **insiderNote**: 奥美濃赤地鶏の刺身や紀州備長炭での焼き上げは、素材と技術へのこだわりを示す。豊富なドリンク、多様な席種、QR決済対応で幅広い客層に対応できる。
- **sources_used**:
  1. [紀州備長炭の使用](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGzWVxlPjbpdWMvF6tqnDVNBs7kGcrAdMkqrQc_LrfVQJOSB19-XOZm3JRv6YcYYjP824lMyk7ESVkVCjSA8RHo3R-5gSx4Uj8XTLS_5qSLZyFyC0f52M9i)
     > 炭には紀州備長炭を使用し、鶏に備長炭の香りを乗せることで鶏の旨みを増し、火力の強い備長炭でしか味わえない焼き鳥を提供しています。
  2. [紀州備長炭での焼き上げ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFx_Vm-QCYwfNDxMVQt2HLj9TmcU1MTAm-OzCWQzvqre6XXjvzk56g5kQzWlBCKeeYWduPZUKM6xM7ut8zJDr5zm7MK3iB-JrW2a6ak89n9p_f8WAT6RNYPOCTDbpoQJbGn2Ju2HCbMCWu9vlsMZm7hE9o=)
     > 焼き鳥は紀州備長炭で丁寧に焼き上げられ、特に白きもはレア感を残して焼き上げるのが特徴で、「抜群に美味しい」と評価されています。
  3. [複数のグルメメディア掲載とネット予約対応](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFR5emgizvFa2uSNRr9gEWXt5rHfOBWCjK6QeqXiH76iI_yyTEDXyu461pBx_8h32rMsfMJML03Ne4p1OetrlpEk2ARoFATEO7FW_2MOsxip9X2gXiqp-Y4FOINSxud)
     > 「焼き鳥屋 鳥蔵」は、ホットペッパーグルメ、Retty、楽天ぐるなび、じゃらんnet、エキテン、ヒトサラといった複数の地元グルメメディアに掲載されており、ネット予約も可能です。
  4. [複数のグルメメディア掲載とネット予約対応](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGZlGSmJjlxl-PSWVkXSQMmiSHjKLJwfl9BKKIMbmjqngRoaXUYxWmJLGM9Q8OFKWqZRNVrvLp-hpnKwK2u_jtmRecbAKWl-QL6bfHk94yZLkFi2C50GoC56UdzMLE_Cfx8Dw==)
     > 「焼き鳥屋 鳥蔵」は、ホットペッパーグルメ、Retty、楽天ぐるなび、じゃらんnet、エキテン、ヒトサラといった複数の地元グルメメディアに掲載されており、ネット予約も可能です。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J001259913 -->

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

### Reminiscence (レミニセンス)（名古屋市中区 / フランス料理・★4.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 「カンテサンス」「HAJIME」で研鑽を積んだ葛原シェフが、「余韻と記憶」をコンセプトに紡ぐストーリー仕立てのフランス料理。ミシュラン二つ星、ゴ・エ・ミヨ「明日のグランシェフ賞」獲得の実力で、東海地方の厳選食材を独自の感性で昇華させる名古屋を代表する一軒です。
- **insiderNote**: 若くして独立し、ミシュラン二つ星、ゴ・エ・ミヨ「明日のグランシェフ賞」を獲得した葛原シェフ。修業先の技法に留まらず、愛知県の鰻を独自の表現で提供するなど、自身の世界観を追求する姿勢が際立ちます。
- **sources_used**:
  1. [葛原シェフが「Quintessence（カンテサンス）」と「HAJIME（ハジメ）」で研鑽を積んだこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG2OPtjZn3vIJON9GuhjGUWfd4FKhUnZZgFgltliM-2PVekjTuasfxFQtNp9iuvRFmJMIDaMnTFikMudHxN7o7TXJ5JxPfvGh76C0oClRcqwA9QmjQ9fKiUTA07F6xUVkWRiz6LP7TR)
     > オーナーシェフの葛原将季氏は、東京の「Quintessence（カンテサンス）」と大阪の「HAJIME（ハジメ）」という、日本のフレンチ界を代表する二つの名店で研鑽を積みました。
  2. [葛原シェフが「Quintessence（カンテサンス）」と「HAJIME（ハジメ）」で研鑽を積んだこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4N666h_u7InmNWrzSaFduI1ShuhpdX2w4CRJ1p7UXATAWxErR8V3TysVbLmmaYjy9RJudQiV9cbarUKUqQvyA4pDV1NlHdxulCyvRq8mHd-b-Yo4a0-G3RBiuq2cTNdegpuBTvrruTV3v6pk=)
     > オーナーシェフの葛原将季氏は、東京の「Quintessence（カンテサンス）」と大阪の「HAJIME（ハジメ）」という、日本のフレンチ界を代表する二つの名店で研鑽を積みました。
  3. [「余韻と記憶」をコンセプトにしたストーリー仕立てのフランス料理であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF60kOPhguPSd0yQLMgRfqoJ4NKG277ggmF2QgTokch8qaxEuPRSIhLqP_xVTMq8BSkEzU9hnppbBBvD7zFU3H__FbHjV-scS43G-L3vu99VrgvBI38t7sRxenPH5QOhsPNO5SVCQ==)
     > 「レミニセンス」の料理は「余韻と記憶」をテーマとしたストーリー仕立てのフランス料理です。
  4. [ミシュラン二つ星、ゴ・エ・ミヨ「明日のグランシェフ賞」を獲得していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQExp7fh2OvaySVwTW7BfoYA0IGR0FnBvnjcoWZjPbGl-uiFp8HmE3WKHjfFiP4bigaJKJPRxttr4C6JyZaCWuepgfT-JINRcDu5E4f3j_rnSNAdsb43QSKLUD-t8vGpRm9kfCgWSFXd)
     > ミシュランガイドでは2021年、2022年と連続で二つ星を獲得しています。ゴ・エ・ミヨでは毎年16.5点（3トック）を獲得し、2026年度には「明日のグランシェフ賞」を受賞しています。
  5. [ゴ・エ・ミヨ「明日のグランシェフ賞」を獲得していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEi11ZYhG5vWes5PvrbNdhghK3VFPKVBly39tdTtv1lqmTTiOOzpISCzacLhjQzvxM5ZO9jUelvJagXu1VjNru5Yu88Ue0XHDkqSAz1gc127Lz6NvjPI7eNWA82559tryoRptqa6iY-4YdjgrSnLtA=)
     > ゴ・エ・ミヨでは毎年16.5点（3トック）を獲得し、2026年度には「明日のグランシェフ賞」を受賞しています。
  6. [東海地方の最高の生産物を料理に取り入れていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQExp7fh2OvaySVwTW7BfoYA0IGR0FnBvnjcoWZjPbGl-uiFp8HmE3WKHjfFiP4bigaJKJPRxttr4C6JyZaCWuepgfT-JINRcDu5E4f3j_rnSNAdsb43QSKLUD-t8vGpRm9kfCgWSFXd)
     > 愛知、静岡、岐阜、三重といった東海地方の最高の生産物を料理に取り入れています。
  7. [東海地方の最高の生産物を料理に取り入れていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE8b2O_yYAkd2jdTrht1cQliZSDxoAXfQdzxL_89WYTeFspbY23dCKvLYHxA1VpQrp7KWixc7vuQYncWeOEwy5a8atkBDF7exK4CUSFcA__71gNkxmdms-9J_ZU_Q==)
     > 愛知、静岡、岐阜、三重といった東海地方の最高の生産物を料理に取り入れています。
  8. [愛知県で最も人気のあるフレンチレストランの一つと評されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQExp7fh2OvaySVwTW7BfoYA0IGR0FnBvnjcoWZjPbGl-uiFp8HmE3WKHjfFiP4bigaJKJPRxttr4C6JyZaCWuepgfT-JINRcDu5E4f3j_rnSNAdsb43QSKLUD-t8vGpRm9kfCgWSFXd)
     > 彼は30代前半という若さで独立し、愛知県で最も人気のあるフレンチレストランの一つと評されています。
  9. [愛知県で最も人気のあるフレンチレストランの一つと評されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE8b2O_yYAkd2jdTrht1cQliZSDxoAXfQdzxL_89WYTeFspbY23dCKvLYHxA1VpQrp7KWixc7vuQYncWeOEwy5a8atkBDF7exK4CUSFcA__71gNkxmdms-9J_ZU_Q==)
     > 彼は30代前半という若さで独立し、愛知県で最も人気のあるフレンチレストランの一つと評されています。
  10. [葛原シェフが30代前半で独立したこと](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQExp7fh2OvaySVwTW7BfoYA0IGR0FnBvnjcoWZjPbGl-uiFp8HmE3WKHjfFiP4bigaJKJPRxttr4C6JyZaCWuepgfT-JINRcDu5E4f3j_rnSNAdsb43QSKLUD-t8vGpRm9kfCgWSFXd)
     > 彼は30代前半という若さで独立し
  11. [愛知県の鰻を店の顔とし、修業先では使わない食材で自身の個性を出していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQExp7fh2OvaySVwTW7BfoYA0IGR0FnBvnjcoWZjPbGl-uiFp8HmE3WKHjfFiP4bigaJKJPRxttr4C6JyZaCWuepgfT-JINRcDu5E4f3j_rnSNAdsb43QSKLUD-t8vGpRm9kfCgWSFXd)
     > 特に、愛知県の鰻をこの店の顔ともいえる料理として提供しており、これは修業先では使わない食材で、葛原シェフの「自分の色を出す」という意識の表れとされています。
  12. [愛知県の鰻を店の顔とし、修業先では使わない食材で自身の個性を出していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE8b2O_yYAkd2jdTrht1cQliZSDxoAXfQdzxL_89WYTeFspbY23dCKvLYHxA1VpQrp7KWixc7vuQYncWeOEwy5a8atkBDF7exK4CUSFcA__71gNkxmdms-9J_ZU_Q==)
     > 特に、愛知県の鰻をこの店の顔ともいえる料理として提供しており、これは修業先では使わない食材で、葛原シェフの「自分の色を出す」という意識の表れとされています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_reminiscence(レミニセンス) -->

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

### とんかつ朱寿（名古屋市中村区 / とんかつ・★4.8）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 月替わりの銘柄豚と五ツ星お米マイスター厳選の釜炊きご飯が特徴。店主の真摯なこだわりがメディアでも多数紹介され、繁盛店たる所以と評価されています。
- **insiderNote**: キッチンカー経験を持つ店主が、五ツ星お米マイスター厳選米を釜炊きで提供。低温・高温の二段揚げや塩麹豚汁など、真摯なこだわりが繁盛の秘訣と評価されています。
- **sources_used**:
  1. [月替わりの銘柄豚と釜炊きご飯が特徴であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF88qzQRJgfYk4lbksxNI46JMza1KS-TbHGnOyZn-SnanmTR7g_2UCbHgEJVe0Z95s9yKLiYC6senVaJYVY-grBDEIRUezi-woSoOs577cUayASTJ2lMysp687luq60EhHOQMWN_b2mboZ7Lg==)
     > 月替わりの銘柄豚と釜炊きご飯が人気
  2. [月替わりの銘柄豚と釜炊きご飯が特徴であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEphgETFddApzX8o-OEcq4GRmqaQ7AzvzPWvHmpF7DtAyZhulBLyp3UsjhA8mX2hvGFrao7Xez2b4VMyn4nUMoAtMJBy6lS7Z1FQOPB1Faf7ldIglHAeotVOpwffDNeq1ygk7NspboJq97KmKh1cqB7x1ZJL3S9KleIav6p)
     > 月替わりの銘柄豚と釜炊きご飯が人気
  3. [銘柄豚と銘柄米が特徴であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFoIL7jx5kJONaxOi-V5uebVEjv5GUnv_o4w7FVh6PVEW5mFJEs2KhnWXrhnJYZHREMy43GcpaH6QmuiocoDQmXPFkUEJFj_fiZ9-z2DXp2rM_Eb5--71EEjMXyn7p5d5k=)
     > 銘柄豚・銘柄米の豚カツ専門店
  4. [店主のこだわりが繁盛の理由と評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERj7QFzWRh36gkpLHs5okc18gD4fFNgwrbsXkdvyj78s5Wa51ILo3MM7182dJZ08FTxiPQPWhc3bUo4xe1HjwrdWdrU6bvtObujFscjLhDx1H4xFGzBFpKdjQks0EK6z07Ws-u9KRHurdPrKbQZg1imUqqBiLkZfAe9w==)
     > 店主の「真面目さと良い意味でのこだわりが繁盛店たる所以」と評価されています
  5. [店主のこだわりが繁盛の理由と評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG9VBOhipdu-OGLs9-69N_4R7QPkCN5ouu1_qqfK_-jAMKkPpggk1OFunC83sPjeRbzAQB3nuAN5BVYn_eXgBNNgpMz7ANMQPmv6nlwd-dfEuUjTiADCAnjPNvIcz5nzQ5D8QGvGDFnEojATCMktWMUTP8=)
     > 店主の「真面目さと良い意味でのこだわりが繁盛店たる所以」と評価されています
  6. [メディアで紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF88qzQRJgfYk4lbksxNI46JMza1KS-TbHGnOyZn-SnanmTR7g_2UCbHgEJVe0Z95s9yKLiYC6senVaJYVY-grBDEIRUezi-woSoOs577cUayASTJ2lMysp687luq60EhHOQMWN_b2mboZ7Lg==)
     > 東海テレビの「yum-yumグルメ」で紹介されています
  7. [メディアで紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEphgETFddApzX8o-OEcq4GRmqaQ7AzvzPWvHmpF7DtAyZhulBLyp3UsjhA8mX2hvGFrao7Xez2b4VMyn4nUMoAtMJBy6lS7Z1FQOPB1Faf7ldIglHAeotVOpwffDNeq1ygk7NspboJq97KmKh1cqB7x1ZJL3S9KleIav6p)
     > 東海テレビNEWSでは「月替わりの銘柄豚と釜炊きご飯が人気…“その時だけ”の味を楽しむ“極みのとんかつ御膳”の店」として取り上げられました
  8. [メディアで紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFoIL7jx5kJONaxOi-V5uebVEjv5GUnv_o4w7FVh6PVEW5mFJEs2KhnWXrhnJYZHREMy43GcpaH6QmuiocoDQmXPFkUEJFj_fiZ9-z2DXp2rM_Eb5--71EEjMXyn7p5d5k=)
     > 「名古屋情報通」では「豚汁とキャベツがおかわり自由！銘柄豚・銘柄米の豚カツ専門店『とんかつ 朱寿』名東区・香流にオープン」という見出しで紹介されています

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_とんかつ朱寿 -->

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

### 鰻 木屋（名古屋市中区 / うなぎ・★4.2）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 江戸末期創業の老舗「鰻 木屋」は、秘伝のたまり醤油タレと備長炭で焼き上げる厳選鰻が特徴。注文後に捌くこだわりと、中詰め丼で二種の食感を楽しませる工夫は、職人の一徹な姿勢を感じさせ、名古屋屈指の名店と評される所以です。
- **insiderNote**: 創業以来継ぎ足す秘伝のたまり醤油タレ、備長炭での焼き上げ、玄米精米など、素材と製法への徹底したこだわりが、名古屋の鰻文化を牽引する老舗の風格を際立たせています。
- **sources_used**:
  1. [江戸末期創業の老舗であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEW25R8CUiOEmEtXkocpI5yfq2yczMvn7j2hsR0s5eBkT6g6MINfQ9xNc4MAdyE_VO9LAL5HbWHdbho9da4nfYV5A7hIy7GwddeGpqNTw5o0vD1KdgorElBN8bqAe81wT4pJTrhj-FUcdayOfA-S8CSJafnRvTjt-cMGzo=)
     > 「鰻 木屋」は江戸末期創業の老舗うなぎ料理専門店です。
  2. [江戸末期創業の老舗であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQgnrS1dR7HBmwwq3yTpKTvqKerEssjsYHlsvq5RNx70P-paxMJusiSr0vWAslK3SqoshkhSJd9qx6voWnBYbfWotW4d9cD6hf5NZi0CbjhuRb-kAJ_DSw0n1tymTu)
     > 「鰻 木屋」は江戸末期創業の老舗うなぎ料理専門店です。
  3. [秘伝のたまり醤油タレであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEW25R8CUiOEmEtXkocpI5yfq2yczMvn7j2hsR0s5eBkT6g6MINfQ9xNc4MAdyE_VO9LAL5HbWHdbho9da4nfYV5A7hIy7GwddeGpqNTw5o0vD1KdgorElBN8bqAe81wT4pJTrhj-FUcdayOfA-S8CSJafnRvTjt-cMGzo=)
     > タレは創業以来継ぎ足している秘伝のもので、たまり醤油を使用しているのが特徴です。
  4. [秘伝のたまり醤油タレであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQgnrS1dR7HBmwwq3yTpKTvqKerEssjsYHlsvq5RNx70P-paxMJusiSr0vWAslK3SqoshkhSJd9qx6voWnBYbfWotW4d9cD6hf5NZi0CbjhuRb-kAJ_DSw0n1tymTu)
     > タレは創業以来継ぎ足している秘伝のもので、たまり醤油を使用しているのが特徴です。
  5. [備長炭で焼き上げる厳選鰻であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEW25R8CUiOEmEtXkocpI5yfq2yczMvn7j2hsR0s5eBkT6g6MINfQ9xNc4MAdyE_VO9LAL5HbWHdbho9da4nfYV5A7hIy7GwddeGpqNTw5o0vD1KdgorElBN8bqAe81wT4pJTrhj-FUcdayOfA-S8CSJafnRvTjt-cMGzo=)
     > 厳選したうなぎを仕入れ、井戸水でさらして臭みを取り、備長炭で焼き上げています。
  6. [備長炭で焼き上げる厳選鰻であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQgnrS1dR7HBmwwq3yTpKTvqKerEssjsYHlsvq5RNx70P-paxMJusiSr0vWAslK3SqoshkhSJd9qx6voWnBYbfWotW4d9cD6hf5NZi0CbjhuRb-kAJ_DSw0n1tymTu)
     > 厳選したうなぎを仕入れ、井戸水でさらして臭みを取り、備長炭で焼き上げています。
  7. [注文後に捌くこだわりがあること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEW25R8CUiOEmEtXkocpI5yfq2yczMvn7j2hsR0s5eBkT6g6MINfQ9xNc4MAdyE_VO9LAL5HbWHdbho9da4nfYV5A7hIy7GwddeGpqNTw5o0vD1KdgorElBN8bqAe81wT4pJTrhj-FUcdayOfA-S8CSJafnRvTjt-cMGzo=)
     > 注文を受けてから鰻をさばいて焼くため、料理の提供までに30分以上かかる場合があります。
  8. [注文後に捌くこだわりがあること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQgnrS1dR7HBmwwq3yTpKTvqKerEssjsYHlsvq5RNx70P-paxMJusiSr0vWAslK3SqoshkhSJd9qx6voWnBYbfWotW4d9cD6hf5NZi0CbjhuRb-kAJ_DSw0n1tymTu)
     > 注文を受けてから鰻をさばいて焼くため、料理の提供までに30分以上かかる場合があります。
  9. [中詰め丼で二種の食感を楽しませる工夫があること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEW25R8CUiOEmEtXkocpI5yfq2yczMvn7j2hsR0s5eBkT6g6MINfQ9xNc4MAdyE_VO9LAL5HbWHdbho9da4nfYV5A7hIy7GwddeGpqNTw5o0vD1KdgorElBN8bqAe81wT4pJTrhj-FUcdayOfA-S8CSJafnRvTjt-cMGzo=)
     > 提供スタイルとしては「中詰め丼（まむし丼）」が特徴的で、ご飯の中にうなぎの蒲焼が1〜2切れ入っており、これによりカリッとした食感と、ご飯の中で蒸されてふわふわになった食感の両方を楽しめる工夫がされています。
  10. [中詰め丼で二種の食感を楽しませる工夫があること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQgnrS1dR7HBmwwq3yTpKTvqKerEssjsYHlsvq5RNx70P-paxMJusiSr0vWAslK3SqoshkhSJd9qx6voWnBYbfWotW4d9cD6hf5NZi0CbjhuRb-kAJ_DSw0n1tymTu)
     > 提供スタイルとしては「中詰め丼（まむし丼）」が特徴的で、ご飯の中にうなぎの蒲焼が1〜2切れ入っており、これによりカリッとした食感と、ご飯の中で蒸されてふわふわになった食感の両方を楽しめる工夫がされています。
  11. [職人の一徹な姿勢が評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEW25R8CUiOEmEtXkocpI5yfq2yczMvn7j2hsR0s5eBkT6g6MINfQ9xNc4MAdyE_VO9LAL5HbWHdbho9da4nfYV5A7hIy7GwddeGpqNTw5o0vD1KdgorElBN8bqAe81wT4pJTrhj-FUcdayOfA-S8CSJafnRvTjt-cMGzo=)
     > 「創業以来一徹な職人の姿勢が生み出した極上の逸品」と評されています。
  12. [職人の一徹な姿勢が評価されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQgnrS1dR7HBmwwq3yTpKTvqKerEssjsYHlsvq5RNx70P-paxMJusiSr0vWAslK3SqoshkhSJd9qx6voWnBYbfWotW4d9cD6hf5NZi0CbjhuRb-kAJ_DSw0n1tymTu)
     > 「創業以来一徹な職人の姿勢が生み出した極上の逸品」と評されています。
  13. [名古屋屈指の名店と評されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEW25R8CUiOEmEtXkocpI5yfq2yczMvn7j2hsR0s5eBkT6g6MINfQ9xNc4MAdyE_VO9LAL5HbWHdbho9da4nfYV5A7hIy7GwddeGpqNTw5o0vD1KdgorElBN8bqAe81wT4pJTrhj-FUcdayOfA-S8CSJafnRvTjt-cMGzo=)
     > 名古屋屈指の鰻の名店として紹介されており、「名古屋名物」の一つとしても挙げられています。
  14. [名古屋屈指の名店と評されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQgnrS1dR7HBmwwq3yTpKTvqKerEssjsYHlsvq5RNx70P-paxMJusiSr0vWAslK3SqoshkhSJd9qx6voWnBYbfWotW4d9cD6hf5NZi0CbjhuRb-kAJ_DSw0n1tymTu)
     > 名古屋屈指の鰻の名店として紹介されており、「名古屋名物」の一つとしても挙げられています。
  15. [お米を玄米で仕入れてお店で精米していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEW25R8CUiOEmEtXkocpI5yfq2yczMvn7j2hsR0s5eBkT6g6MINfQ9xNc4MAdyE_VO9LAL5HbWHdbho9da4nfYV5A7hIy7GwddeGpqNTw5o0vD1KdgorElBN8bqAe81wT4pJTrhj-FUcdayOfA-S8CSJafnRvTjt-cMGzo=)
     > お米にもこだわりがあり、玄米で仕入れてお店で精米し、釜で炊いているとのことです。
  16. [お米を玄米で仕入れてお店で精米していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQgnrS1dR7HBmwwq3yTpKTvqKerEssjsYHlsvq5RNx70P-paxMJusiSr0vWAslK3SqoshkhSJd9qx6voWnBYbfWotW4d9cD6hf5NZi0CbjhuRb-kAJ_DSw0n1tymTu)
     > お米にもこだわりがあり、玄米で仕入れてお店で精米し、釜で炊いているとのことです。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_鰻木屋 -->

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
