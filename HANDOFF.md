status: in_progress

# 目的
オーナー指示「こちらの確認なしで進めれるものはガンガン進めて」（2026-10-09）。SEO-116 配下と同日起票の課題のうち、オーナーの確認・操作が要らないものを順に実装し、main に合流させ、Linear を Done にする。
（前のメモ「SEO分析と90日の戦略・戦術」は status: done で完了済み。内容は git 履歴 ab273bc61d の HANDOFF.md を参照）

# 完了条件
- 下の「対象」の各課題が、テストと QA を通って main に合流し、agent-backlog.md が done、Linear が Done（結果コメントつき）になっている
- 日付待ち・オーナー待ちの課題は手を付けず、理由をここに残す

# できていること
- 合流済み（2026-10-09）:
  - #408 SEO-119/120（他都市23店の除外・駅名監査）
  - #409 ISSUE-145（Linear 全件取得）
  - #410 SEO-117（GSC を指標履歴へ・`track_metrics.js --north-star`）
  - #411 SEO-121（lastmod を内容が変わった日に・build.js の sitemap 書き出し停止・robots→sitemap.xml・news 削除）
  - #412 SEO-119 残り（孤児23本削除）＋ ISSUE-146（孤児一覧を CI のコミット対象へ）
  - #413 SEO-135（llms.txt にハブの全階層・数値の出典と更新日・sitemap.xml）
  - #414 SEO-136（IndexNow: 前回送った値を data/indexnow_state.json に記録し、変わったハブ・編集コメントが変わった店舗ページを送る）
  - #415 SEO-138（GA スニペットを scripts/lib/ga_snippet.js の1本に。localStorage を try/catch で囲む）
- Linear: P-115/P-116/P-138/P-113/P-140/P-131/P-132/P-134 は Done（結果コメントつき）。P-117（SEO-121）は In Progress で、本番確認待ち
- 起票: ISSUE-147（P-142・Places の古い誤紐付け・オーナー承認が要る）／ISSUE-148（P-143・スプレッドシート経由の住所検査）／SEO-142（P-144・sameAs。公式アカウントの URL をオーナーが示すまで待ち）／SEO-143（P-145・店舗ページに editorReason が出ていない）／SEO-144（P-146・index.html と静的ページの localStorage 例外で GA が止まる）

# 次にやること
1. SEO-121 の本番確認: 次の build.yml の後に `node scripts/audit_sitemap_health.js --lastmod-only --check` が exit 0 → backlog done・P-117 Done
2. SEO-115 の残り: 10-09 06:00 の夜間QA（inline-js）と `data/site_metrics.json` の topPages に /stores/ が出るか → done・P-112 Done
3. 実装中: SEO-143（店舗ページに「編集部の選定理由」の節。141店に出る・insiderNote は出さない）→ PR。合流後、build.yml の再生成を待って `node scripts/indexnow_ping.js --recent 2` の stores.comment_not_on_page が 141 → 3 前後になれば done・P-145 Done
   その後: SEO-139 aggregateRating・SearchAction → SEO-127 banquet 季節リード → SEO-131 特集の日付・署名 → SEO-124 ハブ本文 → SEO-122 date.html → SEO-137 ジャーナル title → SEO-134 結論ブロック → SEO-144
4. 夜間QA の station-names が緑で続いたら hard に上げる

対象外（理由）:
- SEO-118（10-20 の GA4 再基線）・SEO-125（10-15 記録）・SEO-126/130/140（11-15 判定）・SEO-141（11-30 判定）: 日付待ち
- SEO-129 の反映・SEO-132 about.html・ISSUE-147: オーナー承認が要る
- SEO-067/098（BWT・UTM）: オーナー本人の操作

# 試したが駄目だったこと
- `git merge origin/main` は、作業ツリーに未コミットの変更があると "Merge with strategy ort failed" で止まる。先にコミットしてから取り込む
- CI は孤児ページを削除しない（`--redirect-orphans` のみ）。データから外した店のページは、判定器で「削除対象」と確かめてから手で消す
- agent-backlog.md を python の heredoc で書き換えると Non-UTF-8 の SyntaxError。node で fs.readFileSync(…,'utf8') を使えば通る
- `refresh_feature_rosters.js --only=…` は `data/feature_roster_health.json` を1本分で上書きする。実行後に git checkout で戻す

# 守るルール・判断メモ
- 1課題（または密接な組）ごとに PR → squash merge。対話セッションは main 直 push 不可
- テンプレート・生成器の変更は Designer の QA-5 記録と `node scripts/audit_design_system.js --check` を通す（制約12）
- 店舗ページ約5,000本はローカルで再生成しない（CI の build.yml が再生成する）
- Linear の説明は同期で置き換わらない。訂正・結果はコメントで残す（`orca linear comment add` に --workspace を付けない）
- 店舗データの変更は一次情報で確かめたものだけ。確かめられなければ空欄に倒す（推測で書かない）
- 既存の不一致（特集の「うなぎのしろむら 泉店」→ stores.json は「泉本店」）は本作業の前から main にある。別途確認

# 関連ファイル
- agent-backlog.md（SEO-116〜141・ISSUE-145〜148）
- docs/seo-strategy-2026-10.md（戦術表 §3・KPI §4）
- docs/decisions/0007-seo-north-star-metrics.md
