# 0078 トップと特集の顔は、記事・掲載店の実写（ホットペッパー公式写真の URL 参照）にする

- 日付: 2026-11-17
- 状態: 採用（本人の依頼 2026-11-17・Ondine #2097）
- 関連: 0072（トップの最初の画面は記事を先に）／CLAUDE.md 写真ソースの優先順・ヒーロー写真の絶対条件／`data/feature_faces.json`・`scripts/lib/feature_face.js`・`scripts/apply_feature_faces.js`・`scripts/build_journal_index.js`・`scripts/build_featured.js`・`tests/feature_faces.test.js`・`tests/top_articles_first.test.js`

## 背景
- 本人の指摘: トップを開いても写真がなく、サイトの様子が五感に伝わらない。11/17 のジャーナルがトップから見えない。特集の顔が図（グラデーションに文字の SVG）で、話題がイメージできない。
- 11/17 の記事は不具合で消えていたのではなく、0072 のトップ最上段の一覧（TOP_ARTICLES）の1行目に文字だけで出ていた。下のカード一覧は重複を避けて同じ記事を外すため、カードだけ見ると最新が 11/16 に見えた。

## 決めたこと
1. トップ最上段の記事の行は、日付の新しい順に並べ、写真が確かな記事だけ写真つきの行にする。写真は記事の顔（`figure.art-hero-img`）に帰属の証跡（`data-hero-source`・`data-hero-store`）とクレジットがあり、出所がホットペッパー公式写真のものだけ。プレスリリース写真（約1MB・最初の画面に重い）と Places（URL が失効する）は使わない。写真が無い行は文字のまま（取り繕わない）。1行目だけ `fetchpriority="high"`、幅・高さを持つ。
2. 特集の顔は、その特集の掲載店（特集ページの店カード）のホットペッパー公式写真を URL で参照する。加工・切り抜き・自ホストはしない（CSS の object-fit のみ）。どの写真にするかは人が候補を見て決め（`data/feature_faces.json`）、機械では良し悪しを判定しない。出所は「写真: 店名（ホットペッパーグルメ）」と書く。
3. 反映は生成器で行う（特集ページ・特集一覧は `apply_feature_faces.js`、トップの特集ストリップは `build_featured.js`）。手で書かない。決めた店が月次の入れ替えで掲載から外れたら、先頭の店で代えて警告を出す（ビルドは止めず、目での再確認を促す）。
4. 掲載店の写真を持たない特集（`keepFigure`・編集方針や信頼の説明など）は図のまま。手で入れた別の写真の顔は触らない。ロゴの寄せ集めなど顔にふさわしくないと判断した3本だけ `replaceHero` で置き換える。
5. 動画は置かない。最初の画面の重さ・出所の証跡のある Instagram 埋め込みが無い・`page_weight_policy` の上限のため。置くなら下の方に Instagram 埋め込み（embed.js）だけ。
6. OG 画像は対象外（別の決まり・0065）。

## 選ばなかった案と理由
- 生成画像・汎用ストック・他メディアの写真: CLAUDE.md の禁止事項。
- 写真を自ホストして切り抜く: ホットペッパーの規約が加工・複製保存を禁じる。
- 写真の良し悪しを機械（画素解析）で選ぶ: 販促バナーと料理写真を分けられないと実測済み（制約10）。

## 見直す条件
- ホットペッパーの写真 URL が失効し、顔が崩れる店が増えたとき。
- 手で入れた顔（ロゴの寄せ集めなど）が多い特集（同じ写真を8本で使い回している例あり）を、次の段階で同じ仕組みに寄せる。

## 戻し方
1. `data/feature_faces.json` の `faces` から該当の特集を消し、`node scripts/build_featured.js`・このPRの前のコミットの `features/<slug>.html`・`features/index.html` に戻す。
2. トップの行の写真は `scripts/build_journal_index.js` の `TOP_PHOTO_SOURCES` を空にして `node scripts/build_journal_index.js` を実行する。
