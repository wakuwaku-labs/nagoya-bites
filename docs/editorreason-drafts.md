# editorReason 自動生成 draft レビュー（ISSUE-045）

> **生成**: 2026-10-13T00:39:40.641Z
> **対象**: 上位 50 候補 / 生成 45 件
> **結果**: OK 42 / INSUFFICIENT 2 / WARN 1 / ERR 5
> **自動マージ候補** (confidence ≥ 0.85): 15 件
> **人手レビュー要**: 27 件

## レビュー手順

1. 各 draft の editorReason / sources_used を確認
2. 採用する draft は `[approved]` 行を追加（または `[reject]`）
3. `node scripts/approve_editorreason_drafts.js` を実行 → editor_picks.json に反映
4. `node build.js` → `git push origin main` で公開

## draft 一覧

### キムラーメン（名古屋（名古屋駅/西区/中村区） / ラーメン・★4）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: キムラーメンは、背脂の甘みが特徴的な豚骨醤油スープと、喉越しの良い中太麺が高く評価されています。ランチタイムにはライスと数種類のお惣菜が食べ放題となり、顧客満足度を高めるサービスも魅力です。
- **insiderNote**: 店主は4種の味噌と酒粕を使った味噌だれや、背脂の甘みが特徴の豚骨醤油スープにこだわり、サイドメニューも充実。ランチのお惣菜食べ放題など、顧客満足度を高める工夫が光る。
- **sources_used**:
  1. [背脂の甘みが特徴的な豚骨醤油スープの評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGNS_BIZceHJzdbPSpAKo4HIDk_jvhRonksBPnDvTpMu0PMalj2n4IHFc8g3x0j7QnumAywaZaqAd2JrwRyHf41w-rPDNbKcyYuLMNxy0sFcRipFk95gGMETih4afbJ0BcS4buJVG3Al-6y1U80MWSy5w==)
     > 豚骨醤油スープは絶品で独特の背脂の甘みが癖になる味
  2. [豚骨醤油スープの濃厚さとバランス、中太麺の食感とスープとの絡みの評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGJA3JH2-dDU1iCrwugKYCKKaH0pxZc0EdLdZGa1PVSHM5ukpJLDeqtNZ1vlKmnn2jKygqec8Iabe31XxyiW4YpPGLp3sdhsEFmzIOpjwbJLlVxdj8XM9Zj82gcI4gmBNrgohcAcRGLWWBby5y8WimtdZ-NUztn8zk_tg==)
     > 濃厚でコクある出汁の旨みが効いたスープながらもコテコテ感はあまりなく、ボソッとした食感の中太麺と程よくジューシーで肉感もあるチャーシューも絡めながら美味しく堪能できる
  3. [喉越しの良い麺の評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzI5Kmai8ebT4rq57OoT8hME2M_Jk_ApYCgRWLvzI0tfA5-UuVFtRd4RUN_Tknl6L97cbMedmWJYoZaQCqN_QiYSvui6MUeStf8nDEXylbilwOEgqOKN1ayoqVi5O8Bmk12cBkcag-mQMxshWR4sOTpydo9RS6yejF)
     > 麺が旨～いΨ(￣∇￣)Ψ 素晴らしく喉越しの良い麺だがしっかりとスープを持ち上げてマジ旨！
  4. [ランチタイムのライスとお惣菜食べ放題サービス](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGNS_BIZceHJzdbPSpAKo4HIDk_jvhRonksBPnDvTpMu0PMalj2n4IHFc8g3x0j7QnumAywaZaqAd2JrwRyHf41w-rPDNbKcyYuLMNxy0sFcRipFk95gGMETih4afbJ0BcS4buJVG3Al-6y1U80MWSy5w==)
     > ランチタイムには、ライスと数種類のお惣菜が食べ放題となるサービスがあり
  5. [ランチタイムのライスとお惣菜食べ放題サービス](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGJA3JH2-dDU1iCrwugKYCKKaH0pxZc0EdLdZGa1PVSHM5ukpJLDeqtNZ1vlKmnn2jKygqec8Iabe31XxyiW4YpPGLp3sdhsEFmzIOpjwbJLlVxdj8XM9Zj82gcI4gmBNrgohcAcRGLWWBby5y8WimtdZ-NUztn8zk_tg==)
     > ランチタイムには、ライスと数種類のお惣菜が食べ放題となるサービスがあり
  6. [ランチタイムのライスとお惣菜食べ放題サービス](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzI5Kmai8ebT4rq57OoT8hME2M_Jk_ApYCgRWLvzI0tfA5-UuVFtRd4RUN_Tknl6L97cbMedmWJYoZaQCqN_QiYSvui6MUeStf8nDEXylbilwOEgqOKN1ayoqVi5O8Bmk12cBkcag-mQMxshWR4sOTpydo9RS6yejF)
     > ランチタイムには、ライスと数種類のお惣菜が食べ放題となるサービスがあり

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J000429965 -->

---

### de trente ans ドゥ トランタン（栄ｷﾀ錦/伏見丸の内/泉/東桜/新栄 / ダイニングバー・バル・★5）

- **status**: INSUFFICIENT_EVIDENCE ⚪ INSUFFICIENT
- **confidence**: 0
- **editorReason**: (なし)

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J004067208 -->

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

### ステーキハウス キッチンリボン（名古屋市瑞穂区 / ステーキ、洋食・★4.5）

- **status**: INSUFFICIENT_EVIDENCE ⚪ INSUFFICIENT
- **confidence**: 0.6
- **editorReason**: GOETHEで秋元康氏が絶賛する名古屋の老舗ステーキハウス。オーナーシェフの温かい人柄と、ステーキ皿やナイフに至るまで徹底したこだわりが、唯一無二の体験を創出。おかわり自由のガーリックライスも嬉しい。
- **insiderNote**: 半世紀にわたり愛される老舗。最高級A5等級黒毛和牛や松阪牛を熟練の技で焼き上げ、保温性の高い特注ステーキ皿とシャトーラギオールで提供。きめ細やかなおもてなしも魅力。
- **warnings**: 12件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_ステーキハウスキッチンリボン -->

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

### カーサ・オリーバ (CASA OLIVA)（名古屋市中区 / イタリアン・★2.8）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: コンラッド名古屋31階に位置し、名古屋の街並みを一望できる開放的な空間で、イタリアの伝統に根ざした本格料理を提供。素材への深い敬意と手仕事で魅力を引き出し、100種超の厳選ワインと共に上質な食体験を演出します。
- **insiderNote**: コンラッド名古屋内のレストランとして、ホテル総料理長監修のもと、本格イタリア料理を提供。素材へのこだわりと豊富なワインセレクションで、上質なダイニング体験を追求しています。
- **sources_used**:
  1. [本格イタリア料理へのこだわり、素材への敬意、手仕事、100種超のワイン、コンラッド名古屋31階の眺望、上質な空間、ホテル総料理長監修の事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH7elJx85Hmwm-zkl02Z7GeHqhbnEWgKVFr-bZD2S9Cr2PVAmOrZ1MEnihgCwSaTGonfYuuUHdFCDeHwIjIfZH1zyuUVB3WzsJL-BgT-SLKIVxjhR31xFWwpf2Gdhp9ZmZ7hFyJcPpWhMy8NSqlZtHM9vZSPTc=)
     > イタリアの豊かな食文化と伝統料理に根ざした本格イタリア料理を提供しています。素材への誠実さと深い敬意を大切にし、「丁寧な手仕事と火入れによって、一つひとつの素材が持つ魅力を引き出し、記憶に残る一皿へ」とこだわりを表現しています。伝統的な技法を重んじながらも、シンプルでありながら奥行きのある味わいを丁寧に描き出すことを目指しています。メニューには、手打ちパスタや旬のアンティパスト、職人技が息づくピッ
  2. [ジャンルがイタリアンであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEDs6bSnTD_qp3pNjBV-AnKdWLbUPUp-h3CV65PIPULFzAFelg0XNOMiYpqOpmnH2gzNth4-_xmo_hcjeV9Hph9MrR46rKxAhFecG4uaSahtL7rRNtC3vmjqCtoeMN01iPV3eiUm3xt)
     > イタリアン
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_カーサ・オリーバ(casaoliva) -->

---

### ミクニナゴヤ（名古屋市中村区 / フランス料理・★4.5）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: フランス料理界の巨匠、三國清三氏がプロデュースするミシュラン一つ星レストラン。日本の風土と旬の食材を活かした「キュイジーヌ・ナチュレル」は、ヘルシーかつ独創的。ホテル高層階からの絶景と上質なサービスで、非日常の食体験を約束します。
- **insiderNote**: 三國清三シェフの「キュイジーヌ・ナチュレル」は、素材本来の魅力を最大限に引き出す独創的なアプローチ。地元メディアでも注目され、現在の料理長も地元の食材を活かした料理で特別な体験を提供しています。
- **sources_used**:
  1. [三國清三氏がプロデュースするレストランであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1Jetdj1cOta8q3AANjad-QFXFPxeO90AALIbBbNCJAiFIdyI-z92M4dgDDERh2efW39LggvBnCfjroG-jo91u_HIVkWBVI5TsgDeTLjRug_ipq9RelEVC7eOC6ahb1G0T12nA-Pzqhw==)
     > フランス料理界の第一人者である三國清三氏がプロデュースするレストランです。
  2. [三國清三氏がプロデュースするレストランであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdUXVyTf30Lf-WE945Bxpntr3nvpUbjZBCwjFZtgmJ92l_Ag0wuPlEiTrZUhls8WNVRvAKoq7vhyk8eD_3Kbn-Lrvsqy_Joywd8yzcKxQN6D7ggBi5IhUdsIKucBeS4wEIVuMMHOZfjKwo86k=)
     > フレンチの巨匠・三國清三氏がプロデュースする名古屋屈指のフレンチレストランとして紹介されています。
  3. [ミシュラン一つ星を獲得していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1Jetdj1cOta8q3AANjad-QFXFPxeO90AALIbBbNCJAiFIdyI-z92M4dgDDERh2efW39LggvBnCfjroG-jo91u_HIVkWBVI5TsgDeTLjRug_ipq9RelEVC7eOC6ahb1G0T12nA-Pzqhw==)
     > 『ミシュランガイド 愛知・岐阜・三重 特別版2019』で一つ星を獲得しています。
  4. [ミシュラン一つ星を獲得していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdUXVyTf30Lf-WE945Bxpntr3nvpUbjZBCwjFZtgmJ92l_Ag0wuPlEiTrZUhls8WNVRvAKoq7vhyk8eD_3Kbn-Lrvsqy_Joywd8yzcKxQN6D7ggBi5IhUdsIKucBeS4wEIVuMMHOZfjKwo86k=)
     > 『ミシュランガイド愛知・岐阜・三重2019特別版』で一つ星を獲得
  5. [「キュイジーヌ・ナチュレル」をポリシーとし、日本の風土と四季の食材を取り入れ、素材本来の魅力を最大限に引き出す独創的な料理を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1Jetdj1cOta8q3AANjad-QFXFPxeO90AALIbBbNCJAiFIdyI-z92M4dgDDERh2efW39LggvBnCfjroG-jo91u_HIVkWBVI5TsgDeTLjRug_ipq9RelEVC7eOC6ahb1G0T12nA-Pzqhw==)
     > その料理哲学は「キュイジーヌ・ナチュレル（自然と同化した料理）」をポリシーとし、ヘルシーでありながらも美味しく、重すぎない上品さと奥行き、コクのある味わいを追求しています。伝統的なフランス料理に日本の風土と四季が育んだ食材を取り入れ、素材本来の魅力を最大限に引き出すアプローチを大切にしています。また、レシピに素材を当てはめるのではなく、素材そのものから料理が創り出されるという考え方で、独創的な一皿
  6. [「キュイジーヌ・ナチュレル」をポリシーとし、日本の風土と四季の食材を取り入れ、素材本来の魅力を最大限に引き出す独創的な料理を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdUXVyTf30Lf-WE945Bxpntr3nvpUbjZBCwjFZtgmJ92l_Ag0wuPlEiTrZUhls8WNVRvAKoq7vhyk8eD_3Kbn-Lrvsqy_Joywd8yzcKxQN6D7ggBi5IhUdsIKucBeS4wEIVuMMHOZfjKwo86k=)
     > 「キュイジーヌ・ナチュレル（自然と同化した料理）」をポリシーとし、日本の風土と四季が育んだ食材を取り入れ、素材本来の魅力を最大限に引き出すアプローチを大切にしています。
  7. [ホテル高層階からの絶景と非日常的な食事体験を提供していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1Jetdj1cOta8q3AANjad-QFXFPxeO90AALIbBbNCJAiFIdyI-z92M4dgDDERh2efW39LggvBnCfjroG-jo91u_HIVkWBVI5TsgDeTLjRug_ipq9RelEVC7eOC6ahb1G0T12nA-Pzqhw==)
     > 名古屋マリオットアソシアホテルの52階に位置し、地上52階からの絶景とアール・ヌーボー様式の優雅なインテリアに囲まれた空間で、非日常的な食事体験を提供しています。
  8. [名古屋マリオットアソシアホテルの52階に位置していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHA18OAnDWwgJWB9pRGM6xzg6vG5pdh2JtXodSqOvVNk1XbFWBn019d8i2i-AbRV7a8UhZGVfo049zk1yUovqPc6ZH-ChTcnZpyBQOgF8MSW3i2t5E4L0TaI9D5qLZ89mo-)
     > 名古屋マリオットアソシアホテルの52階にあるミクニナゴヤ
  9. [スマートで丁寧なサービスと細やかな配慮があること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1Jetdj1cOta8q3AANjad-QFXFPxeO90AALIbBbNCJAiFIdyI-z92M4dgDDERh2efW39LggvBnCfjroG-jo91u_HIVkWBVI5TsgDeTLjRug_ipq9RelEVC7eOC6ahb1G0T12nA-Pzqhw==)
     > サービスはスマートで丁寧と評価されており、例えば、歯の悪い客のために食材を小さくカットしたり、メニューの一品一品を丁寧に説明したりするなど、細やかな配慮も行われています。
  10. [地元メディア「ナゴレコ」で紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdUXVyTf30Lf-WE945Bxpntr3nvpUbjZBCwjFZtgmJ92l_Ag0wuPlEiTrZUhls8WNVRvAKoq7vhyk8eD_3Kbn-Lrvsqy_Joywd8yzcKxQN6D7ggBi5IhUdsIKucBeS4wEIVuMMHOZfjKwo86k=)
     > 名古屋最大規模のローカルメディア「ナゴレコ」で、フレンチの巨匠・三國清三氏がプロデュースする名古屋屈指のフレンチレストランとして紹介されています。
  11. [地元メディア「名駅経済新聞」で紹介されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFiH5aC-n7Vs0paPfSfU6vreHx1kp_QTEsjMTInwbHmkOKfYTUcqyPAbpidtVPDWdVCxzIebJwwKPSupNqOQLu6m1qRe9XcuMAfPIxTDP0ZdA2YdZ9uzLS8_8OzpBMeFu1o5eI5)
     > 「名駅経済新聞」では、映画「至福のレストラン／三つ星トロワグロ」とタイアップしたメニュー提供が報じられています。
  12. [現在の料理長である中村優之氏が地元の食材を活かした料理にこだわりを持っていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1Jetdj1cOta8q3AANjad-QFXFPxeO90AALIbBbNCJAiFIdyI-z92M4dgDDERh2efW39LggvBnCfjroG-jo91u_HIVkWBVI5TsgDeTLjRug_ipq9RelEVC7eOC6ahb1G0T12nA-Pzqhw==)
     > 現在の料理長は中村優之氏で、地元の食材を活かした料理で客に特別な思い出を提供したいという抱負を語っています。
- **warnings**: 3件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_ミクニナゴヤ -->

---

### 料亭 か茂免 (かもめ)（名古屋市東区白壁 / 日本料理、料亭・★4.6）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 1928年創業の老舗料亭。広大な敷地と庭園を望む完全個室で、極上のプライベート空間を提供。三代目主人が「おもてなし」を重視し、空間全体で客をもてなす。高い評価を得る料理長が伝統に新風を吹き込む、名古屋を代表する格式ある一軒。
- **insiderNote**: 三代目主人は代々店を維持する厳しさを感じつつ、この店ならではの「おもてなし」を大切にしています。料理だけでなく、空間全体で客をもてなすこだわりが、人生の節目に帰ってこられる場所でありたいという願いに繋がっています。
- **sources_used**:
  1. [1928年創業の老舗料亭であること、三代目主人がおもてなしを重視し、店を維持する厳しさを感じていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEGBGRGyhCyBkncJvG6_g20utUEoK-8iPMz8i5WbpqUNkbI5_RuHDCCyipuIw-g1tuu7ZhhC5fLRDHyMtY57_gff_NiZhHW_KNwhWBqihcQPvdnIvNAPJo4)
     > 三代目主人である船橋識光氏は、代々店を維持していく厳しさを痛感しつつも、この店だからこそ感じられる価値ある「おもてなし」を一層大切にしたいというこだわりを持っています。
  2. [高い評価を得る料理長が伝統に新風を吹き込んでいること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGM6Es0Q_5MAuRDUbUGUkc74UB9btKhpLPZcYsP4IlEPztPD9dD9fJTHXMfYMVfjQX-PahvjxcXznvP4BeJetWiGAjGjKNKUwNJodr60ms0AmFcexrb2toZzBuSTRAPajAkq5bEn7dzEBTK9PrvR5JHlR5p8LhD3FJ-xMDTnVf54Btkw5wrkmxT4IyLZXdjOJw9YkVjWfoC1VQHxg0HSfoZp-c-05M8gmcWHiL0j3dQkd55OLpiRhMMUvcUmD9Qt7ds-lsKjVnFzHfuVcDK5HmFTkUi9I1AaZE9BCJciw6Ph2bywyB-uxr22Jf49W1J9RFGH5_rg4hCIMMDlloPAoSKkpt_wP7zPld0WqN5OsWnKZZM3HMGvKHPF02J)
     > 現在の料理長は猪口真弥氏です。彼は、長い伝統を持つか茂免に新しい風を吹き込み、「温故知新」の精神でお客様により魅力ある料亭だと思ってもらえるよう精進していると述べています。
  3. [高い評価を得る料理長がいること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHum2f0M8kdID2bhhhs0gKH1Oq8mBmx8I1O5uUUaZglGc9cNTdKSVJqBTEqUkqa2TIKmqSMYGPge0E9Wx9SgXAbYzE9X_cLEXgMP4qXcZDUIiiFH4AR9IR1t9R43TMZw0Yk-wZJ)
     > 料理の味に対する評価も高く、一休.comレストランのクチコミでは「料理・味」の項目で5点満点中4.93点を獲得しています。
  4. [名古屋市東区白壁にある料亭であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFCVApbvgduGjmNqpzoHtvpLLEYFqcmqOVb_DMSlSv3LWozAS7gONF2lKSMQkicWzkAGbIwtf-m2wQGCnZGm9UUARAYXlIiH5xRMKIloS13bSaMBpHqLauRRjo8NYVE8rGadgrwQz6R10VKkEX5LsHhdSPD)
     > 料亭 か茂免（りょうてい かもめ）は、愛知県名古屋市東区白壁にある料亭。
  5. [1928年創業の老舗料亭であること、三代目主人がおもてなしを重視していること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHXna3KLmrH00E10IsRQ_t1WRJXJq6W-O4xdh-5opAxqkPFHzgk2nvS52lz-MIT48-CauxGBUc-6sAvCwbpO8E7anzHzqgfmfAAuc1lQySdxcaYjaxAZAP5K9X1cu8Lip6idD8WEFQFyiho)
     > 名古屋市東区白壁に位置する料亭か茂免は、昭和3年（1928年）創業の老舗料亭です。
- **warnings**: 3件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_料亭か茂免(かもめ) -->

---

### 尾頭橋 すみや（中川区・港区 / 和食・★4.4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: ミシュラン一つ星を獲得したベテラン料理人が営む和食店。40年以上の経験で培われた確かな技術で、厳選された旬の素材を五感で味わえる逸品に昇華。特に長崎県産すっぽん料理は必食。完全予約制で上質な時間を約束します。
- **insiderNote**: 店主・角谷氏は40年以上の経験を持ちながら「日々修業」と語る求道者。素材と器で季節を表現し、五感で楽しませる和食は、日本酒セラーの厳選銘柄と共に。夜は1日3組限定で、きめ細やかなおもてなしが期待できる。
- **sources_used**:
  1. [ミシュラン一つ星獲得、ベテラン料理人、熟達した割烹料理、素材と器で季節を魅せる和食](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHdIT9dIHYFi0-tz3j7R919zCbRG_E5hULE1YFDwn5tY8DkP0x0nLKoz1V-Zjc5S1t40IHvX-3JvyTbLHv8LsgQZplb_VSVFyIGwBV-6dI5hxRRLH24bp0cLTkgXje-CGRaKvNMUw-12NfIgwZd)
     > 「ミシュランガイド愛知・岐阜・三重2019特別版」で一つ星を獲得した実力店
  2. [ミシュラン一つ星獲得](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEehk-YtmE5egDGdiRXWwR5x4vSJypOlQxW6yM3QIlDTMuHHTfmo7lQQll5LN2Cu4LmuK57H60k5_aOGpm_OrlcdXpaLt2-CXs3AoGsUSzGAWd3PwXDGCRIHlROY4wi9-K073B05Bj1zXvOoA7BRUgSHK8=)
     > ミシュランガイド愛知・岐阜・三重2019特別版で一つ星を獲得
  3. [店主の40年以上の経験、日々修業の姿勢、厳選された旬の素材、五感で楽しむ和食、長崎県産すっぽん料理、完全予約制、1日3組限定、日本酒セラー完備](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4rzzPx4evf1micBXWBNhypSgyXNeFEYTm_wOQ5m9HG_EB1gPREpdzTBs432H1ikexAMv57WjUff907swwt55BqZiXDDMm-re9HhoQEAXzAWZ-Q81sFiiPQIL2Aw==)
     > 店主である角谷進氏は、18歳から日本料理の世界に入り、40年以上にわたり和食と向き合い続けています。食材の持ち味を最大限に活かすことを信条とし、魚介類は天然もの、野菜は有機野菜や地元愛知県産を中心に厳選して使用しています。料理は味だけでなく、五感すべてで季節を感じられる特別な時間を提供することを目指しており、素材と器で季節を表現することにもこだわっています。開業から17年経った現在も「日々修業の身
  4. [熟達した割烹料理、素材と器で季節を魅せる和食](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHdV8UDP9S1nSZveXF4-1izKgLCi329xsz9JUA2nyhkYXx4F5HKnJotXJDUyloZqdt7mNMxYHdDGz-0xhdLLzNxGL8soMg3vgtta3JJwi_RiQfNp-Z6QQ9qi49JCMm7LLPxiETUlOkwJMJvzC3L)
     > 素材と器で季節を魅せる、熟達した割烹料理
  5. [長崎県産すっぽん料理、完全予約制、1日3組限定、日本酒セラー完備](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE9DJ5HfcFu8ch7EWwYJLS7v6vZ_xLRj9MoLWM1xY_RuD1SgxWIE10b1vkmIl5g9pMLtkWPZT1QhSNwyfwgZhEqkqXTlASV1eoh6G0kkgYNAUhzOu8Qn6h97DxfJduVEsA4xFLpG_JS)
     > 長崎県から取り寄せた極上の露地すっぽんを丁寧に調理し、すっぽん本来の繊細で豊かな味わいを引き出すことに注力しています。完全予約制で、夜席は行き届いたサービスを提供するため1日3組限定としています。日本酒セラーを完備し、厳選された約20種類の日本酒を最適な状態で提供しています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J003516273 -->

---

### 名駅 すし継（名古屋市中村区 / 寿司、海鮮、日本料理・★4.4）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 1
- **editorReason**: 「名駅 すし継」は、伝統的な江戸前寿司と赤酢シャリにこだわり、豊洲直送の旬の食材で本格的な味を提供。名駅エリア初の雲丹食べ放題ランチや、名店「石司」厳選マグロも魅力。職人技を間近で楽しめるカウンター席や個室も完備し、多様なシーンで利用可能です。
- **insiderNote**: 名駅エリア初の雲丹食べ放題ランチは集客の目玉。名店「石司」からのマグロ仕入れは品質へのこだわりを示す。一方で接客の改善は課題か。
- **sources_used**:
  1. [伝統的な江戸前寿司と赤酢シャリへのこだわり、豊洲直送の旬の食材提供、職人技を間近で見られるカウンター席、個室完備の事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFsFNi7nw3EZFpm5SM_gZ5myghunVXJeTPzjvxUZGmnJ_RRhW8AbZVxJ94fGmVYD0H-7jDrdhZ9MX5Em9OZa_X07PdxZ7NSHR5qTWETasmBzasKQZvet_gWo-XLnvMHDU2eWujavopP)
     > 伝統的な江戸前寿司を心ゆくまでお楽しみいただけます。旬の食材は豊洲から仕入れに近い状態で直送され、一流の生産者たちとの連携により、食材が最も輝く形で新鮮な寿司を提供することにこだわっています。本格江戸前寿司は、伝統の江戸前本来の赤酢シャリがネタと調和した逸品とされています。
  2. [伝統的な江戸前寿司と赤酢シャリへのこだわり、職人技を間近で見られるカウンター席、個室完備の事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHbr0_rySwi1xWWSlgKiIVxY3x_ggFOzlvrgaXMdxvS-dlFDb1xAEJiPe6CJFHUBL7O4ajsYg4zLZ4Ys2NEcjD21XN9mJBLvqhgK52rz18iwmbY8kayRF0FAALpyi1VDwberfQ=)
     > 伝統を踏襲した赤酢シャリとネタが調和した、本格江戸前寿司をご堪能ください
  3. [名駅エリア初の雲丹食べ放題ランチの提供の事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEVSivjnV6fmbRsZa1Z5dqDPeP-r9l5VFJv5eJCPGWAJtTyoQ5AGBLdXZoX39PXCpy_MRgjarALFWdUXqZuJMxFzlQh03vqy1a49c1YTxDnuikR)
     > ランチタイムには、雲丹食べ放題のランチコースも提供されており、これは名駅エリアで初の試みとされています。
  4. [名駅エリア初の雲丹食べ放題ランチの提供の事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG-ks7PRF3sF8dM1xHy-cPO88NzY85fwum51FWwEdecLLK-D1gZhd3cQfev1G9JK5AN6xumTntPBF27OZsdvDPYkWlK5umxbyGyf8sr3CciwkMQI8c--KkZi5-llA4=)
     > ランチタイムには、雲丹食べ放題のランチコースも提供されており、これは名駅エリアで初の試みとされています。
  5. [名駅エリア初の雲丹食べ放題ランチの提供の事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEh_C454uV0zCUYDYXiH5IYL9fqx_bYxDuu9rhDxnqozLFERnq8Fyu8bgl1BvbNR9FlaXq6AxQ3kLp4AEUGSlqzc7umiq6c3Ce3P_kJGoZJAawB1yVI3dCMvf1-Ryte_CaglgwkH44T)
     > ランチタイムには、雲丹食べ放題のランチコースも提供されており、これは名駅エリアで初の試みとされています。
  6. [名店「石司」から厳選仕入れされたマグロの提供の事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEJYbKHBgnrLhSvG8byP67t8x7DieN3KGHYBg9vHNWI8xLByFZ5KkT8GROuI3C3d4Nz26NupHXha3oyjAqfh3h9Lu3TyinriVAecNwzh2VAk8ZmjxRTNXJAKRTitA==)
     > 特に、マグロは名店「石司」から厳選仕入れされており、濃厚な旨味とサッパリ感を両立し、赤酢シャリとのバランスが絶妙と評されています。
  7. [名店「石司」から厳選仕入れされたマグロの提供の事実](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHmhZYnkpoEkSmrX7g8eRvM2ibHWcXp4Q_Kiefp0kUuIwMnpNmaM2b5o_bHoE5pdmIqk_QFeFwy-N7XX2l4d9ad7D_bPr8AXY3xJRsGaD5rDhzH-dUIOd6p-J6-2wMkRul63OsG)
     > マグロは名店「石司」から厳選仕入れされており、濃厚な旨味とサッパリ感を両立し、赤酢シャリとのバランスが絶妙と評されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_名駅すし継 -->

---

### 右江田（うえだ）（名古屋市中川区 / 寿司・★4.4）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: ミシュラン三つ星を獲得し、名古屋を代表する江戸前鮨の頂点に君臨する名店。店主の無駄なく美しい所作から繰り出される、握りに重心を置いた独自の構成が全国の食通を魅了します。完全予約制で希少性も高い一軒です。
- **insiderNote**: 店主の上田直季氏は日本料理店での修業を経て、独自の鮨を追求。赤酢シャリを軸に握りに重心を置く構成で、ミシュラン三つ星や食べログアワード受賞歴を持つ名古屋屈指の名店です。
- **sources_used**:
  1. [ミシュラン三つ星獲得、名古屋を代表する江戸前鮨の頂点、全国指折りの店、無駄なく美しい所作、握り重心の独自構成、完全予約制](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF3T-4UaKhCEdttfi2lDqZBJ03R3noyTSfzldWMFvUGFZ1NZG8B3j-X0EC1ssA45IYdpg4BLDyQIaOS7E7db54rLyVnuZzFV6_Gj99sC_7OkJ3gd-v6tAKp)
     > ミシュランガイドで三つ星を獲得している名店であり、名古屋を代表する江戸前鮨の頂点とされています。全国の数ある鮨店の中でも指折りの店と高く評価されており、食べログでは寿司EAST百名店への選出歴やThe Tabelog Awardの受賞歴も確認できます。料理人としては「無駄がなく所作も美しい鮨職人」と評され、大将の心温まる丁寧な接客も高く評価されています。つまみを絞って握りに重心を置く構成を掲げ、屋
  2. [ミシュラン三つ星獲得、名古屋を代表する江戸前鮨の頂点、全国指折りの店、無駄なく美しい所作、握り重心の独自構成、完全予約制](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEmH2qHR6bP1NkfgR0ozi41qyzxpZ0xPf6I0p9baOg1GmP2SAR7RxhP08r4PoPDEyW0tmGviWWRWj4qoq7ueCHacmlLngI9MgukUgI1w1jOX4rEogbzEqO1D-eH)
     > ミシュランガイドで三つ星を獲得している名店であり、名古屋を代表する江戸前鮨の頂点とされています。全国の数ある鮨店の中でも指折りの店と高く評価されており、食べログでは寿司EAST百名店への選出歴やThe Tabelog Awardの受賞歴も確認できます。料理人としては「無駄がなく所作も美しい鮨職人」と評され、大将の心温まる丁寧な接客も高く評価されています。つまみを絞って握りに重心を置く構成を掲げ、屋
  3. [ミシュラン三つ星獲得、名古屋を代表する江戸前鮨の頂点、完全予約制](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEYngcbNhhZhC93gydTB2wNf9tmEtgL0T-sjRfUuvmeHILAHBQq9fBPMvRH14hicVpFOBsYWCzfllXszqO7Job0kmg1xeyOeKeaaj73HbS3NLYd4lad1ADuBxX0JeMV-aOn)
     > ミシュランガイドで三つ星を獲得している名店であり、名古屋を代表する江戸前鮨の頂点とされています。完全予約制です。
  4. [完全予約制](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFXI0sRN0F7Tl7uu2Zs7IpyS-FRCSTc56Og9PNdaeKAvzR-_QZJkRF0zCPLBJvMPF2wHNNQpEp7lU9bWwXqjXRHBZkhswIxq9W6c45r9wtT48tg2GPblx0XZnsikKXlmoZvig9bAv4awqfNnaBk8a8JQ3fZm5o=)
     > 完全予約制です。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_右江田（うえだ） -->

---

### 飛騨牛一頭家 馬喰一代 名古屋WEST（名古屋市中村区 / 焼肉・★4.2）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 精肉業60年の歴史を持つ「馬喰一代」は、独自の「目利き」と「一頭買い」で最高級「最とび牛」を提供。トレーサビリティ公開や全席個室の高級空間で、質の高い飛騨牛を安心して楽しめる点が業界で評価されています。
- **insiderNote**: 精肉業60年の歴史に裏打ちされた「目利き」と「一頭買い」で、最高級「最とび牛」を安定供給。トレーサビリティ公開や生産者への感謝を明示し、顧客信頼を築く経営手腕は注目に値します。
- **sources_used**:
  1. [全席個室または半個室の高級感ある空間](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIFsoWen5dJCt9XKS52MKwA8ZtoqL3UyQLNxREI--753zq1sM9pjKc5bYXmVDm5k7Z58F1uC6SC7pueL84Aw4cCz-R5z4PwxcEbctMrbrbYJJjBTB09Sqb5ozRdB6ZKFs0dOw=)
     > 店内は全席個室または半個室となっており、プライバシーが保たれた落ち着いた空間を提供しています。明るすぎず適度な暗さで落ち着ける雰囲気で、木目調で黄金に輝き、きらびやかで高級感がある内装です。
  2. [全席個室または半個室の高級感ある空間](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF9ZgImemf8QahU2Q9vPYSGwmMCImOAR0eLXEEZZOkpDKWaKDMzmJQvviuWYyDUsc4d34CHmUzOddGx6mMlalQJEoCT4IOgIcFewVVIkNj_UZMgOj75LPnEGA==)
     > 店内は全席個室または半個室となっており、プライバシーが保たれた落ち着いた空間を提供しています。明るすぎず適度な暗さで落ち着ける雰囲気で、木目調で黄金に輝き、きらびやかで高級感がある内装です。
- **warnings**: 2件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_飛騨牛一頭家馬喰一代名古屋west -->

---

### コンパル 大須本店（名古屋市中区大須 / 喫茶店、カフェ、サンドイッチ・★4.2）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 名古屋の喫茶文化を牽引する老舗として、創業以来「変わらない味と心地よい時間」を提供。コーヒーは社長監修の秘伝ブレンドを熟練スタッフが淹れ、サンドイッチも専門シェフをスカウトするなど、徹底した品質へのこだわりが光る。
- **insiderNote**: コーヒーは社長が毎日味を確認し、企業秘密のブレンドを「かえし」二度ドリップで淹れる。サンドイッチも専門シェフをスカウトし、注文ごとに手作り。品質維持への徹底した姿勢が伺える。
- **sources_used**:
  1. [名古屋の喫茶文化を牽引する老舗という評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFMj_lWSXFTs_-NB8yECKJxsWhX59gN_IBXv2tbTSgVtaugBCa5g-GTiLJclERYV1tUOVfDzfR5yL2x6NNuN7Hlkg296Ot1lRAimQAaFqj510K1bnMMWXEdCoGTyD5wiE15CaCizRnERCA=)
     > 名古屋では知らない人のいない絶品
  2. [名古屋の喫茶文化を牽引する老舗という評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGxrkVHhev33fIs-ArNWjrdwoqA5aCYOWfl4qnVp3T14man2KuH-XuH1VlKQuat1gC46NmNNepLPo9bWgty9Ws5vkwRbL6Sc8sTr5u-PkOr1Y4XWEIPmdpZB5Om7ePMC-TBsEIN1pJ7Alb2lKgQ46bWcrOpOdhv03BFoY2M)
     > 名古屋の喫茶文化を築き上げてきたとも言うべき、地元では誰もが知っている名店
  3. [創業以来変わらない味と心地よい時間を提供し、コーヒーは社長監修の秘伝ブレンドを熟練スタッフが淹れ、サンドイッチも専門シェフをスカウトするなど、徹底した品質へのこだわりがあること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFnRfUDYmlmRBM90JEx_J7S4BiMkowjfgI0mkXT69cjyIOTDsSlxZRLgaKeF2nnZDEJ9kOR1Xofc9GQ04Hl-d5JS_HrHadtXITzfJz6mMOdxKPYbMVzwXugjNqrzu7yIOeW)
     > 創業以来、『変わらない味と心地よい時間を提供すること』を心がけており、コーヒーの味は毎日社長が確認し、ブレンドや焙煎を調整するなど、創業社長から受け継がれるこだわりを継承しています。…長年レストランで勤務していたシェフをスカウトし、昭和35年（1960年）から本格的なメニュー展開を始めました。…『かえし』と呼ばれる二度ドリップする独自の手法でコーヒーを淹れており、この手法で最適な味わいになるよう豆

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J000430215 -->

---

### 餃子歩兵 名古屋錦店（栄 / 餃子専門店・★3.7）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: スタッフが長期間の研修と日々のトレーニングを重ね、最高の状態で提供する技術を習得。一口サイズのパリパリジューシーな餃子は、にんにく不使用の生姜餃子で女性客のニーズにも応える。
- **insiderNote**: 京都本店はミシュランビブグルマンに3年連続選出。名古屋店もスタッフが長期間の研修と日々のトレーニングを重ね、最高の餃子を提供できるよう技術習得に注力している。
- **sources_used**:
  1. [名古屋店のスタッフが最高の餃子提供のために研修とトレーニングを積んでいること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGfEkSoB1PvEU5I_c5ybI-VAOuGD0PHzg4VPf4OncDvqvwdI5vQOmnqplar7IH9Ith9CNs3G6Tfded3Kg3Pvk2FGj89giiVkNY8L6C1seM77HZT-sy8IfVnBy1iZ-tmSg==)
     > お客様に最高の状態で餃子を提供できるよう、スタッフは長期間の研修を受け技術を習得しており、名古屋のスタッフも日々トレーニングを重ねています。
  2. [一口サイズでパリパリ、ジューシーな餃子の特徴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGfEkSoB1PvEU5I_c5ybI-VAOuGD0PHzg4VPf4OncDvqvwdI5vQOmnqplar7IH9Ith9CNs3G6Tfded3Kg3Pvk2FGj89giiVkNY8L6C1seM77HZT-sy8IfVnBy1iZ-tmSg==)
     > 餃子は一口サイズで、パリパリとした食感とジューシーさを引き出す焼き加減にもこだわり
  3. [一口サイズでパリパリ、ジューシーな餃子の特徴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHYaEvDmjSTNeSevt17rm1F0kLAC3wiUAouX3NfmIWkcyqZBOCIcLW2ZSb8LT7BoGl9YvT3vi47cztzpDeFEy86zijugu5A0fFB4BjjDZgaD3kYdloyf19PDZuFE4bJ7A==)
     > 餃子は小ぶりな一口サイズで、皮はパリパリ、中はジューシーな食感が特徴です。
  4. [一口サイズでパリパリ、ジューシーな餃子の特徴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFne9Rwp7zic-wQ8OgdgvLxwAxEvtvxnvskNHP0pTNjA9vlGMkkE8e3HenR8y3g9X9JCoRWKnDBymsX2VLuJ8FLJarKzfqEumhljAI8qdsAi7-RLv05u-RT4Q==)
     > 餃子は小ぶりな一口サイズで、皮はパリパリ、中はジューシーな食感が特徴です。
  5. [にんにく不使用の生姜餃子があること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGfEkSoB1PvEU5I_c5ybI-VAOuGD0PHzg4VPf4OncDvqvwdI5vQOmnqplar7IH9Ith9CNs3G6Tfded3Kg3Pvk2FGj89giiVkNY8L6C1seM77HZT-sy8IfVnBy1iZ-tmSg==)
     > にんにく不使用で生姜を効かせた餃子の2種類を用意しています。特に生姜ぎょうざは特製味噌だれとの相性が良いとされています。
  6. [生姜餃子が女性客に人気であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHYaEvDmjSTNeSevt17rm1F0kLAC3wiUAouX3NfmIWkcyqZBOCIcLW2ZSb8LT7BoGl9YvT3vi47cztzpDeFEy86zijugu5A0fFB4BjjDZgaD3kYdloyf19PDZuFE4bJ7A==)
     > 生姜ぎょうざはにんにくを使用せず、特製の味噌だれで提供されるため、匂いを気にせず食べたい女性客に特に人気があります。
  7. [生姜餃子が女性客に人気であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFne9Rwp7zic-wQ8OgdgvLxwAxEvtvxnvskNHP0pTNjA9vlGMkkE8e3HenR8y3g9X9JCoRWKnDBymsX2VLuJ8FLJarKzfqEumhljAI8qdsAi7-RLv05u-RT4Q==)
     > 生姜ぎょうざはにんにくを使用せず、特製の味噌だれで提供されるため、匂いを気にせず食べたい女性客に特に人気があります。
  8. [スタッフが最高の餃子提供のために研修とトレーニングを積んでいること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHNuKJeDyfvedBtZNhYhhgKN63f9AIevpHq2rP731LNVa8eoE676fl3dZofmlKwM9QrrSk18Nke44FsjRVuuIJGFjWlzUyxO49v4mjOXI1kbdxW)
     > スタッフは餃子を最高の状態で提供するために長期間の研修と日々のトレーニングを積んでおり、技術習得に力を入れていることがうかがえます。
  9. [本店がミシュランガイドのビブグルマンに選出されていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHNuKJeDyfvedBtZNhYhhgKN63f9AIevpHq2rP731LNVa8eoE676fl3dZofmlKwM9QrrSk18Nke44FsjRVuuIJGFjWlzUyxO49v4mjOXI1kbdxW)
     > 本店である京都・祇園の店舗は、2017年から3年連続で「ミシュランガイド」のビブグルマンに選出されています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_餃子歩兵名古屋錦店 -->

---

### 鮨 土方（名古屋市東区 / 寿司・★4.4）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 1
- **editorReason**: 名古屋の鮨文化を牽引するミシュラン二つ星獲得の超予約困難店。素材の持ち味を鮮明に押し出す力強い握りと、3種の赤酢をブレンドした個性的なシャリが食通を魅了し続けています。
- **insiderNote**: 東京で修業を積んだ30代の店主が、仕込みから握りまで一人で担う「必殺仕事人」。週4日、夜6席一回転のみの営業で、常連客が次回予約を取るため新規予約は極めて困難です。
- **sources_used**:
  1. [ミシュラン二つ星獲得](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqopm7D2HG_UUoQhGLRpT-KNGo1r3oJ7OPVHQvCr8qgl8oUiA21FRKvpmC_XlC0fS9FHHkpFnUYq-sTtgL8HAMbZbuXllt3XcUriPTEBrwKj6DzixN3l5bvVcuc5AibV70zBEfyDz9qHAVoTlLf6XMy5Zcp7Qqqc4lCX-m4T3F-_sH99nY6Qab2kiQhCwa-xMasx3IMOOdmG2-JxUCMcisf0knzRZ24Pw4_hRy8uvsBWycvNddtncisybwd0UAm0HOdbRnHw-VDbGlv_CcSWsmKo20DjP9oKtcRdbx3OwrPpUxGkx8dbk0mlz3xnPr2EPTPmL6VllgeXrqLjt-vMheVqVn)
     > ミシュランガイド愛知・岐阜・三重2019特別版で二つ星を獲得しています。
  2. [ミシュラン二つ星獲得](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEjPRJUlJjKdM3MOazmM5PAy2aVM4f6a9DcX_70rS0T5IaOp6m8lhueJU4p4ymgxjv_jSbTmbwW-SKsWdj0CRAKVwRzRqu3wOuY9kZgMyk17X9wxOpAVe9j3A==)
     > 名古屋でミシュラン二つ星を獲得する人気の鮨店
  3. [超予約困難店](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqopm7D2HG_UUoQhGLRpT-KNGo1r3oJ7OPVHQvCr8qgl8oUiA21FRKvpmC_XlC0fS9FHHkpFnUYq-sTtgL8HAMbZbuXllt3XcUriPTEBrwKj6DzixN3l5bvVcuc5AibV70zBEfyDz9qHAVoTlLf6XMy5Zcp7Qqqc4lCX-m4T3F-_sH99nY6Qab2kiQhCwa-xMasx3IMOOdmG2-JxUCMcisf0knzRZ24Pw4_hRy8uvsBWycvNddtncisybwd0UAm0HOdbRnHw-VDbGlv_CcSWsmKo20DjP9oKtcRdbx3OwrPpUxGkx8dbk0mlz3xnPr2EPTPmL6VllgeXrqLjt-vMheVqVn)
     > 週4日、夜の6席を一回転のみで営業する予約困難店として知られています。
  4. [名古屋の鮨文化を語る上で欠かせない一軒、超予約困難店](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGJb74sPvOaHP1lHMdSMWlKJpqyRPoyjFb-iTAPIvatHm9OcGQtGneLUNTa93_zqRLQBEiZz889hOtAkI6928yVCLaRGzHxMGIilYHtSFmn-JCD_CdIJXn_qk4URFj9Id6t4mU=)
     > 名古屋の鮨文化を語る上で外せない一軒」「超予約困難店」
  5. [名古屋の鮨文化を語る上で欠かせない一軒、超予約困難店](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGudl7tcNjM7pGuGDWq49hfbk3LBS-KduIuWefWl0E1Rr0nbXAJqFil6yAmetGjiVoUWzJmexmN8kM_kX27zzCr6Wtoqy4f2tZeHi6feRkZW8dgqiQr0NOelSH6uWj6RpX7shP-y99ofhOw7e8=)
     > 名古屋の鮨文化を語る上で外せない一軒」「超予約困難店」
  6. [素材の持ち味を鮮明に押し出す力強い握り](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqopm7D2HG_UUoQhGLRpT-KNGo1r3oJ7OPVHQvCr8qgl8oUiA21FRKvpmC_XlC0fS9FHHkpFnUYq-sTtgL8HAMbZbuXllt3XcUriPTEBrwKj6DzixN3l5bvVcuc5AibV70zBEfyDz9qHAVoTlLf6XMy5Zcp7Qqqc4lCX-m4T3F-_sH99nY6Qab2kiQhCwa-xMasx3IMOOdmG2-JxUCMcisf0knzRZ24Pw4_hRy8uvsBWycvNddtncisybwd0UAm0HOdbRnHw-VDbGlv_CcSWsmKo20DjP9oKtcRdbx3OwrPpUxGkx8dbk0mlz3xnPr2EPTPmL6VllgeXrqLjt-vMheVqVn)
     > 彼の鮨は、端正にまとめるというよりも、素材の持ち味を鮮明に押し出す力強さが魅力と評されています。
  7. [3種類の赤酢をブレンドした個性的なシャリ](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqopm7D2HG_UUoQhGLRpT-KNGo1r3oJ7OPVHQvCr8qgl8oUiA21FRKvpmC_XlC0fS9FHHkpFnUYq-sTtgL8HAMbZbuXllt3XcUriPTEBrwKj6DzixN3l5bvVcuc5AibV70zBEfyDz9qHAVoTlLf6XMy5Zcp7Qqqc4lCX-m4T3F-_sH99nY6Qab2kiQhCwa-xMasx3IMOOdmG2-JxUCMcisf0knzRZ24Pw4_hRy8uvsBWycvNddtncisybwd0UAm0HOdbRnHw-VDbGlv_CcSWsmKo20DjP9oKtcRdbx3OwrPpUxGkx8dbk0mlz3xnPr2EPTPmL6VllgeXrqLjt-vMheVqVn)
     > シャリは意図的に少々かために炊かれ、3種類の赤酢をブレンドすることで「土方」の個性を確立しており
  8. [シャリの際立った特徴](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHCGROB--GGrfPE8CIHKHo0o3YD1lzxapeZAIJMG3QZWJIGavMtJGymUNSpTi5rsX2ULHLrkOZmqtDnoSitF2qEwzYHRYy2EXrIce0E-QFQl9oA2P20bOEmGiV5uEgOaSMibXVGS9ubFFQ5-_lOP7EUMxPerOmq_lUX4HLJkkmEYlg1bAL9Rw==)
     > シャリの際立った特徴
  9. [東京で修業を積んだ30代の店主](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqopm7D2HG_UUoQhGLRpT-KNGo1r3oJ7OPVHQvCr8qgl8oUiA21FRKvpmC_XlC0fS9FHHkpFnUYq-sTtgL8HAMbZbuXllt3XcUriPTEBrwKj6DzixN3l5bvVcuc5AibV70zBEfyDz9qHAVoTlLf6XMy5Zcp7Qqqc4lCX-m4T3F-_sH99nY6Qab2kiQhCwa-xMasx3IMOOdmG2-JxUCMcisf0knzRZ24Pw4_hRy8uvsBWycvNddtncisybwd0UAm0HOdbRnHw-VDbGlv_CcSWsmKo20DjP9oKtcRdbx3OwrPpUxGkx8dbk0mlz3xnPr2EPTPmL6VllgeXrqLjt-vMheVqVn)
     > 店主は東京で修業を積んだ後、名古屋で開業した30代の料理人であるとされています。
  10. [仕込みから握りまで一人で担う「必殺仕事人」](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqopm7D2HG_UUoQhGLRpT-KNGo1r3oJ7OPVHQvCr8qgl8oUiA21FRKvpmC_XlC0fS9FHHkpFnUYq-sTtgL8HAMbZbuXllt3XcUriPTEBrwKj6DzixN3l5bvVcuc5AibV70zBEfyDz9qHAVoTlLf6XMy5Zcp7Qqqc4lCX-m4T3F-_sH99nY6Qab2kiQhCwa-xMasx3IMOOdmG2-JxUCMcisf0knzRZ24Pw4_hRy8uvsBWycvNddtncisybwd0UAm0HOdbRnHw-VDbGlv_CcSWsmKo20DjP9oKtcRdbx3OwrPpUxGkx8dbk0mlz3xnPr2EPTPmL6VllgeXrqLjt-vMheVqVn)
     > 仕込みから握りまでご主人が一人で担う体制で、営業日以外の日も毎日朝から仕込みを行う「必殺仕事人」と称されるほどのこだわりを持っています。
  11. [週4日、夜6席一回転のみの営業で、常連客が次回予約を取るため新規予約は極めて困難](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqopm7D2HG_UUoQhGLRpT-KNGo1r3oJ7OPVHQvCr8qgl8oUiA21FRKvpmC_XlC0fS9FHHkpFnUYq-sTtgL8HAMbZbuXllt3XcUriPTEBrwKj6DzixN3l5bvVcuc5AibV70zBEfyDz9qHAVoTlLf6XMy5Zcp7Qqqc4lCX-m4T3F-_sH99nY6Qab2kiQhCwa-xMasx3IMOOdmG2-JxUCMcisf0knzRZ24Pw4_hRy8uvsBWycvNddtncisybwd0UAm0HOdbRnHw-VDbGlv_CcSWsmKo20DjP9oKtcRdbx3OwrPpUxGkx8dbk0mlz3xnPr2EPTPmL6VllgeXrqLjt-vMheVqVn)
     > 週4日、夜の6席を一回転のみで営業する予約困難店として知られています。常連客が来店時に次回予約を取るため、新規予約は非常に難しいとされています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_鮨土方 -->

---

### オーベルジュ・ド・リル ナゴヤ（名古屋市中村区 / フレンチ・★4.2）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: フランス本店がミシュラン三つ星を50年以上維持する名店の海外初出店。エーベルラン家の「おもてなしの精神」を名古屋の料理長が継承し、本店と変わらぬ味わいを表現。名古屋屈指の絶景と森田恭通氏デザインのエレガントな空間で、特別な体験を提供します。
- **insiderNote**: フランス本店がミシュラン三つ星を50年以上維持する名門。名古屋の料理長は本店のエーベルラン家が掲げる「レストランは家族」という精神を受け継ぎ、その伝統を守りつつ進化を追求しています。
- **sources_used**:
  1. [名古屋屈指の絶景を望む立地であること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8rlQiZLxPKp9DGaaHeYT1M0WdFQXvDl6YN2YhhPmQonL4nne9aTmOayHqwbNACWcP3xoQppq7WIsAeu4H4bTLvTXFklaK9zTjRjU7mcAtFo-5SXVY79lbAEgT8EYoGOHUHe0AFKMaen5KFN2B)
     > ミッドランドスクエア42階に位置し、名古屋屈指の絶景を望む天空のレストランです。
  2. [名古屋屈指の絶景を望む立地であること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGctjYf5fwrDTUY5B9y01RX_iMYnIZD-Lhgq5sBiCG9VQu52m3JJFI3rHvxj7yZl1qNITyYsCmVsjWWD6JagD0Xf4IvfX9MMqgRi39AzmgZkc0S3YMhaRj1NXYEtZHIbfplnJRB0j-d6PABSqUTVzE=)
     > ミッドランドスクエア42階に位置し、名古屋屈指の絶景を望む天空のレストランです。
  3. [森田恭通氏が内装を手掛けたエレガントな空間であること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8rlQiZLxPKp9DGaaHeYT1M0WdFQXvDl6YN2YhhPmQonL4nne9aTmOayHqwbNACWcP3xoQppq7WIsAeu4H4bTLvTXFklaK9zTjRjU7mcAtFo-5SXVY79lbAEgT8EYoGOHUHe0AFKMaen5KFN2B)
     > 内装は世界的に活躍するインテリアデザイナー森田恭通氏が手掛け、「親しみやすいエレガント」をテーマに、木の温もりとエレガントな雰囲気を演出するオリーブの木製シャンデリアが特徴です。
  4. [森田恭通氏が内装を手掛けたエレガントな空間であること。](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGctjYf5fwrDTUY5B9y01RX_iMYnIZD-Lhgq5sBiCG9VQu52m3JJFI3rHvxj7yZl1qNITyYsCmVsjWWD6JagD0Xf4IvfX9MMqgRi39AzmgZkc0S3YMhaRj1NXYEtZHIbfplnJRB0j-d6PABSqUTVzE=)
     > 内装は世界的に活躍するインテリアデザイナー森田恭通氏が手掛け、「親しみやすいエレガント」をテーマに、木の温もりとエレガントな雰囲気を演出するオリーブの木製シャンデリアが特徴です。
- **warnings**: 6件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_オーベルジュ・ド・リルナゴヤ -->

---

### 鮨屋 とんぼ 住吉店（名古屋市中区 / 寿司・★4）

- **status**: WARN_RISK 🔴 WARN_RISK
- **confidence**: 1
- **editorReason**: (なし)
- **warnings**: 対象店舗は2026年9月12日をもって閉店しています。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_鮨屋とんぼ住吉店 -->

---

### CANALIA trattoria＆cafe（名古屋市中村区 / 炭火焼きイタリアン、カフェ・★4）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: バルニバービが培った知見を活かし、水辺の新たな交流拠点を創出。愛知県産食材の炭火焼きグリルを主役に、ランチからディナーまで多様なシーンに対応するオールデイダイニングです。広大な空間とテラス席、ウェディング対応など、多機能な大型ソーシャルダイニングとして注目されます。
- **insiderNote**: バルニバービが「tonarino」などで培った知見を活かし、水辺の交流拠点を創出。愛知県産食材の炭火焼きを主役に、オールデイダイニングとして多様なニーズに応える大型ソーシャルダイニングです。
- **sources_used**:
  1. [株式会社バルニバービが運営し、水辺の交流拠点を創出していること、広大な空間と多様な機能を持つこと、バルニバービの経験が料理に活かされていること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAy691Vviy20udqg8v1l5rVYZXYVdf1VuDl-mIojs5x8RSijccyYrcas6KzOctOlDTIczOnTJBWRtTYeO1P5437OEgZ31Ms3-RouaHPqhBQdPND4f9VFJ96KNMlmdWHub5Qmm4nIVU5pbjWCTkrAR8QYLulQ==)
     > 株式会社バルニバービが運営する「CANALIA trattoria＆cafe」は、名城公園の「tonarino」などで培った「都市と自然をつなぐ賑わい創出」の知見を活かし、中川運河沿いに新たな交流拠点を創出します。
  2. [愛知県産食材の炭火焼きグリルが主役であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH0M3YIOmswiVhukWsc1q_ai04NW07lQbH7wLUwb_x-2Xs99gA-VcuTlcao0vqKh2NeZwGxP_lxwD7yG3Z5tdWljt70adAxrjUdBANomg==)
     > 愛知県が誇る田原牛をはじめ、知多牛、奥三河どり、知多ハッピーポークなどの地元愛知県産の厳選食材を豊富に使用し、素材の旨味を最大限に引き出す炭火焼きグリルを主役としたイタリアンを提供します。
  3. [オールデイダイニングであること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEaZ1jh9pk3FCfrkRdWdUvEAP4Um21WELqFefsQn1LxmZJ2WKRQl2iRrEmMsqdjMACygk5MdpLEcMPZEdlwF-JicZOuBIWpzo3jg8pO073hfsrMBtyUyrx8lPu1bmiTmwMamMHKDlZPTdO897aUuKW2nnz8r8zd6SgsOxg=)
     > 日常使いから特別なパーティーまで、多様なシーンに対応する「オールデイダイニング」として展開しています。
- **warnings**: 1件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_canaliatrattoria＆cafe -->

---

### グリルつばき（名古屋市中村区 / 和牛洋食、ステーキ、ハンバーグ・★3.2）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.9
- **editorReason**: 肉のエキスパート田中覚氏が「最高の和牛で本気の洋食をつくる」を掲げた新店。岐阜の百名店「洋食つばき」の流れを汲み、名店「雪月花」展開企業が手掛ける。五感を刺激するカウンターで、和牛洋食の新たな魅力を体験できる。
- **insiderNote**: 肉のエキスパート・BOSS田中覚氏が「和牛洋食」を提案。岐阜の「洋食つばき」や「雪月花」を展開する田中屋フードサービスの新店舗である点が注目される。
- **sources_used**:
  1. [肉のエキスパート田中覚氏が和牛洋食を提案していること、五感を刺激するカウンター席が特徴であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3oWWhVY1Yz7rv3XwF1Beea41O1HoK7I-e2YmwL6nVIdP5I1Qy3bMAJOSZWksjHDHrnIt0QQK1qrhWNCHbBu6v8-gyevl6oRl5iKm3liLwgjvhMANYlEm1hfwT5xuvRHxDlR2rfF-0GA==)
     > 肉のエキスパート・BOSS田中覚氏が自ら買い付ける最高峰の和牛と、古き良きオーセンティックな洋食を融合させた「和牛洋食」という新たな世界を提案しています。
  2. [肉のエキスパート田中覚氏が「最高の和牛で本気の洋食をつくる」をコンセプトに掲げていること、岐阜の百名店「洋食つばき」の流れを汲むこと、名店「雪月花」などを展開する株式会社田中屋フードサービスの新店舗であること、五感を刺激するカウンター席が特徴であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEsftT1h3SrKvIttS2vXpseRnZAdh01yc0xGENBDh6PnxlJKdYmyfo696kaTXRLDvWyvSs6EJN5OVh-PWpwlLvMLTsYIDMp3r3GCl2XwO22z8IDjiLBCu5kVr8gAAuHGzZh6eguMMeoVbTvuTjyAotQIotDFI0=)
     > 肉師と呼ばれる代表・田中覚さんが「最高の和牛で、本気の洋食をつくる」をコンセプトに、2024年5月28日（火）にオープンした「グリルつばき」。岐阜で高い評価を得て「食べログ 百名店」にも選出されている「洋食つばき」の流れをくむ店舗であり、名店「雪月花」などを展開する「株式会社田中屋フードサービス」がはじめた新店舗です。
  3. [肉のエキスパート田中覚氏が和牛洋食を提案していること、「最高の和牛で本気の洋食をつくる」をコンセプトに掲げていること、岐阜の百名店「洋食つばき」の流れを汲むこと、名店「雪月花」などを展開する株式会社田中屋フードサービスの新店舗であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHk7SR8gOPdQ793d3xUrL5NbEspP-scXBPDBJ6HCm7RruqLAGwo59hl6FwqcQqruWq1QCHhalhari_oy5djK4CofFwxw4CqIZbD2_g6_dwR1dvs0hGSp0mOuwCsyhlsg==)
     > 肉のエキスパート・BOSS田中覚氏が自ら買い付ける最高峰の和牛と、古き良きオーセンティックな洋食を融合させた「和牛洋食」という新たな世界を提案しています。コンセプトは「最高の和牛で、本気の洋食をつくる」と掲げられています。この店は、岐阜で高い評価を得て「食べログ 百名店」にも選出されている「洋食つばき」の流れをくむ店舗であり、また「名店『雪月花』などを展開する『株式会社田中屋フードサービス』がはじ

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_グリルつばき -->

---

### 橦木町 しみず（名古屋市東区 / 寿司、日本料理・★4.7）

- **status**: OK 🟡 review-required
- **confidence**: 0.6
- **editorReason**: 清水陽介氏の長年の研鑽に裏打ちされた確かな腕と、日本料理の王道を大切にしつつも挑戦を続ける姿勢が、開業以来予約困難な人気を博し、ゴ・エ・ミヨや食べログアワードで高く評価されています。
- **insiderNote**: 清水氏の料理は、一人で担うとは思えないほど手が込んでおり、妥協のない仕事ぶりが評価されています。撮影禁止のスタイルも、料理への集中を促します。
- **sources_used**:
  1. [清水氏の経歴と研鑽期間](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHkHicuzui3-OupSnWPEVUWX6EjU7TiEiqxplNIKCm5gA6tF52MneFrwPuxA0a-LfMRpvz9QjEWN_9EDEZnXgroYPvXu8JcfPu-NpPXH6EfkyoREhogXsBQZApZgwM2SaBpPU1ndHrC4TM6dXTvkBglrg==)
     > 大阪の「本湖月」で11年、岐阜の「たか田八祥」で6年間研鑽を積んだ実力派の料理人、清水陽介氏。
  2. [清水氏の経歴と研鑽期間](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG0479yolghHNLt5DB1too2r0Vzae9q-7JSDqBHh7dum94VfAWT7Jnbw4YfgVfCG9uHEaDs7h0EvJcUoU8fJH7Ct0QPyvNEMzeoT_fdelf3c5xlmQ8oa-NDlXOmYMwvUvmkg_Yh06Ex)
     > 大阪の「本湖月」で11年、岐阜の「たか田八祥」で6年間研鑽を積んだ実力派の料理人、清水陽介氏。
  3. [日本料理の王道を大切にしつつ挑戦を続ける姿勢](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHkHicuzui3-OupSnWPEVUWX6EjU7TiEiqxplNIKCm5gA6tF52MneFrwPuxA0a-LfMRpvz9QjEWN_9EDEZnXgroYPvXu8JcfPu-NpPXH6EfkyoREhogXsBQZApZgwM2SaBpPU1ndHrC4TM6dXTvkBglrg==)
     > 日本料理の王道を大切にしつつも、常に「今しかできない挑戦」として、当たり前を疑い、より良い料理を追求し、チャレンジングな一品をコースに組み込むことに力を入れています。
  4. [予約困難な人気店であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH4-G1FL-MYb1pPVDYL4Qoe3XIR4PSnN_H5KMItIM4dq-YZQkRVmlwoGj2mJhK-REA6OBlYGwVEADDWy8JCP6SvQJnCzpiz980zt522YD3MnqvYktOBga7xAcBUbA==)
     > 予約困難な人気店として紹介されており
  5. [人気店であることの間接的な証拠、および食べログアワード受賞](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG0479yolghHNLt5DB1too2r0Vzae9q-7JSDqBHh7dum94VfAWT7Jnbw4YfgVfCG9uHEaDs7h0EvJcUoU8fJH7Ct0QPyvNEMzeoT_fdelf3c5xlmQ8oa-NDlXOmYMwvUvmkg_Yh06Ex)
     > オープンからわずか1年で「The Tabelog Award 2023」のBest New Entryを受賞したことが報じられています。
  6. [ゴ・エ・ミヨでの高い評価](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEcgtluRfcemcJhizhHvk1HzeFtwLdCWsZH0m1sJQnZtmVjtkQMLMXI2G4xKgB0e1c6hE2whagmXPTEv1jcwaMsxWDDGdcaC8vL9KblyxjFPfWo5LEbOXPdA89IwUJBdLLDgKNdv7303df8LYGYOpoZ)
     > フランス発の本格レストランガイド「ゴ・エ・ミヨ」には2023年から2026年まで連続で掲載されており、15.5/20点という高い評価を受けています。
  7. [料理の質の高さと妥協のない仕事ぶり](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH4-G1FL-MYb1pPVDYL4Qoe3XIR4PSnN_H5KMItIM4dq-YZQkRVmlwoGj2mJhK-REA6OBlYGwVEADDWy8JCP6SvQJnCzpiz980zt522YD3MnqvYktOBga7xAcBUbA==)
     > 料理は一人で担っているとは思えないほど手が込んでおり、妥協がなく、一つの食材を使い切るサステナブルな意志も感じられると評価されています。
  8. [料理の撮影が原則禁止であること](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHkHicuzui3-OupSnWPEVUWX6EjU7TiEiqxplNIKCm5gA6tF52MneFrwPuxA0a-LfMRpvz9QjEWN_9EDEZnXgroYPvXu8JcfPu-NpPXH6EfkyoREhogXsBQZApZgwM2SaBpPU1ndHrC4TM6dXTvkBglrg==)
     > 料理の撮影は原則として禁止されています。
- **warnings**: 3件のURLが実際の検索結果に無いため除外（要確認）

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: manual_橦木町しみず -->

---
