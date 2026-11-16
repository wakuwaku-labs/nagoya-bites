# 0068 名古屋バイツの基本方針を、文面を作る仕組みと投稿前の検査に入れる

- 日付: 2026-11-16
- 状態: 採用（本人 2026-11-16「名古屋バイツのこれからの案は、これに添えるような案や台本作りを出すようにして欲しい」。Ondine #2041）
- 関連: docs/brand-policy/nagoya_bites.md（原文）/ data/brand_policy/nagoya_bites.json（要点・避ける言い回し）/ scripts/lib/brand_policy.js / SNS分析ツール config/brand-policy/（写し元・Ondine #2040）/ 0047（X の文面）

## 背景
- 本人が「名古屋バイツ 基本方針」を示した。SNS分析ツール側（動画の台本・週次の企画）は対応済み。このリポジトリ（X の自動投稿・日次ジャーナル・note）は未対応だった。

## 決めたこと
1. 原文と要点は SNS分析ツールの config/brand-policy/ から**そのまま写す**（docs/brand-policy/nagoya_bites.md・data/brand_policy/nagoya_bites.json）。書き換えは写し元と一緒に行う。写し元がある端末では tests/brand_policy.test.js が一致を確かめる。
2. 指示文に要点を入れる: X（docs/x-post-prompt.md の節＋write_x_draft.js が避ける言い回しの一覧を付ける）、日次ジャーナル（run_journal_local.sh の起動時の見出し・journal-today.md の Step 1・agents/editor.md の冒頭章）。
3. 避ける言い回し（行った・食べたように見せる／点数・順位／煽り）を投稿前の検査で止める。面ごとの止め方:
   - X の本文・返信・保存した文面（x_post.js の validatePost・validateReplies・checkDraft）と SNS の投稿案（validate_journal_draft.js の md）: 3種類すべて止める。
   - 日次ジャーナルの記事（validate_journal_draft.js 5c）と記事から機械で作る note（note_draft.js）: 行った・煽りは止める。順位の語は記事では警告だけ、note では見ない。店カードの Google 評価の表示（★4.1。制約5で壊さない部品）は対象外。
4. 理由（実測・2026-10〜11 の記事 47 本）: 行った・煽りの語は 0 本。順位の語は 3 本で、すべて出典つきの事実の引用（「全国1位」の産地、コンテストの「2位」、店が自分で言う「リピート率No.1」）。止めると正しい記事まで HOLD になる（品質ゲート原則3・4）。★ は店カードの評価表示で 16 か所。X の保存した文面 29 本は 0 本。

## 見直し
- 記事で順位の語の警告が「事実の引用でない」使い方で出るようになったら、記事でも止めるかを決め直す。
