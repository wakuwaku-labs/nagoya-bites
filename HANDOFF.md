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
  - #422 SEO-145（特集の公開日・更新日・書き手の部品・P-153 Done）。SEO-131（P-127）も Done
  - #424 SEO-146（特集の掲載件数の表記を実数に日次でそろえる・scripts/sync_feature_counts.js・P-154 Done）
  - #425 SEO-147（ジャーナル・店舗ページから特集へのリンク文の件数。生成器が relabelForSlug を通す・ジャーナル17本をそろえた・build.yml に --target stores・夜間QA soft。P-156 は In Progress）
  - #428 SEO-137（ジャーナルの title の前30字の規則・判定器・上位15本の書き換え・台帳・P-133 Done。比較は SEO-148＝P-157・11-06）
  - #427 SEO-122（デート特集の掲載店を FAQ の約束にそろえ、冒頭に予算別の結論を機械で置く・docs/decisions/0011・P-118 Done）
  - #426 SEO-124（ハブ685本に編集部の見分け方・選定理由の別枠・予算帯と最寄り駅の表。FAQPage の JSON-LD を外した。QA で本文の幅の未指定と最寄り駅の集計も直した・P-120 Done）
  - #416 SEO-143（店舗ページに「編集部の選定理由」）・#418 SEO-139（aggregateRating と SearchAction を外す・docs/decisions/0009）・#419 IndexNow が -2/-3 の店舗ページを探す・#420 SEO-127（banquet の 11・12月リードと幹事チェックリスト）・#421 SEO-131 その1（掲載店の入れ替えで dateModified を進める）
  - #433 ISSUE-157（丸の内店・柳橋本店の泉本店の食べログリンク・ISSUE-158〜160 起票）
  - #432 ISSUE-155/156（特集・ジャーナルの別の店を指す食べログリンク8件・毎日数える監査）
  - #431 DSN-007（幅 900px 以下でパンくずとフッターのリンク群が画面外に消えていた・375px の横幅が 750px。nb.css の nav の規則を #main-nav だけに。P-155 Done＋コメント。本番で 375px の横幅 375・パンくずとフッター表示を確認）
- Linear: P-115/P-116/P-138/P-113/P-140/P-131/P-132/P-134 は Done（結果コメントつき）。P-117（SEO-121）は In Progress で、本番確認待ち
- 起票: ISSUE-147（P-142・Places の古い誤紐付け・オーナー承認が要る）／ISSUE-148（P-143・スプレッドシート経由の住所検査）／SEO-142（P-144・sameAs。公式アカウントの URL をオーナーが示すまで待ち）／SEO-143（P-145・店舗ページに editorReason が出ていない）／SEO-144（P-146・index.html と静的ページの localStorage 例外で GA が止まる）

# 次にやること
1. SEO-147（P-156）: 本番確認済み（CI の再生成で店舗ページがそろい、main で --check --target stores が exit 0）。backlog done・P-156 Done＋コメント済み
2. SEO-122（P-118）: #427 で合流・P-118 Done＋コメント済み。達成条件4（4週後の順位）は SEO-140（11-15）で記録する。冒頭の結論の仕組み（scripts/apply_feature_conclusions.js・data/feature_conclusions.json・nb.css .nb-conclusion）は SEO-134 で他の特集へ広げる（docs/decisions/0011）
3. SEO-115 の残り（P-112）: 達成条件5は満たした（10-09 の夜間QA で inline-js が ✅ hard）。残りは達成条件3（GA4 で /stores/ の page_view。10-10 以降の metrics_history の段差かオーナー確認）。満たしたら P-112 を Done にする
4. SEO-137（P-133）: #428 で合流・P-133 Done＋結果コメント済み。11-06 の比較は SEO-148（P-157・Todo・期限 11-06）。`node scripts/journal_title_experiment.js --report` で比べる
4b. #432 で合流（ISSUE-155/156・P-159/P-160 Done＋コメント）: 特集・ジャーナルの別の店を指す食べログリンク8件を外し・差し替え、しろむら 泉店→泉本店をそろえ、照合キャッシュで数える監査（scripts/audit_page_store_links.js）を夜間QA に soft で追加。親 ISSUE-154（P-158）は 10-10 の夜間QA で架空店監査と page-store-links が緑なら Done。次は ISSUE-157（P-161・丸の内店と柳橋本店に付いた泉本店の食べログ 23056889 を外す）→ ISSUE-148 → SEO-134 → ISSUE-153 → SEO-144。ISSUE-143 の調査はやり直す
4c. #433 で合流（ISSUE-157・P-161 は In Progress）: 丸の内店と柳橋本店から泉本店の食べログ 23056889 を外し、tabelog_resolved.json と manual_tabelog_resolved.json を failed にした。次のビルドの後に main の data/stores.json で J004026662 の食べログURLが空のままなら backlog done・P-161 Done。9/17 のジャーナルの情報源を HotPepper 丸の内店に差し替え・泉本店の本文写真2枚を外した。名前は合っても別の支店を指す食べログリンク56件を ISSUE-158（P-162・親）・159（P-163・判定器）・160（P-164・外す）として起票し、Linear で親子をつないだ（同期スクリプトは親子を作らないので orca linear save-issue --parent-id で）。次の候補の先頭は ISSUE-159
4d. #435 で合流（ISSUE-159・P-163）: 照合器に住所の3値比較（same/different/unknown）。名前一致でも住所が different なら branch-address-mismatch。キャッシュを読み直す CLI scripts/audit_tabelog_branch_mismatch.js（45件・unknown 16件・一覧は scratchpad の branch45.json）・夜間QA soft（tabelog-branch）・docs/decisions/0012。ISSUE-157（P-161）は合流後のビルドで J004026662 の食べログURLが空のままと確かめ done。次は ISSUE-161（下）→ ISSUE-160（45件を1件ずつ確かめて外す。clear_broken_tabelog_links.js は対象外なので ID 指定で。サガミ 有松店・嘉文 徳重店・めんらんどは移転前後の住所の可能性）
4e. #436 で合流（ISSUE-161・P-165 In Progress）: build.yml の checkout に ref: main。合流後の最初のビルド（37878933280・#435 のビルドの後ろで待ち）のログで +refs/heads/main を取っていれば backlog done・P-165 Done＋コメント
4f. ISSUE-160（P-164）作業中: 食べログは手元から 403（レート制限と見て回避しない）。照合キャッシュの食べログ側の事実（9/20 取得の題名・住所）と、今日取った HotPepper 掲載45件（scratchpad の hp45.json・座標つき）で判定。国土地理院の住所検索で距離を測り、めんらんど（19m）・嘉文 徳重店（同じ支店名・字で291m）・サガミ 有松店（同じ支店名・字名 境松）は同じ店として残す。残り42件を外す（4層: stores.json・tabelog_resolved.json を failed・stores/*.html・manual_stores）。残す3件は確認済みとして記録し、監査が数えないようにする（data/tabelog_branch_reviewed.json を作る予定）
4g. 10-09 03:40 時点: 記録と ID 指定で外す仕組みは 9daef2a1e9（未 push）。データを外す実行（clear_broken_tabelog_links.js --reviewed）は main のビルド 37878933280 の完了後に origin/main を取り込んでから。外した後は監査 0件・audit_page_store_links --check・npm test を確かめて PR
4h. 次に起票して直すもの（ISSUE-160 の後）:
  - ISSUE-162: ホットペッパーの題名の末尾「＜ネット予約可＞」で hotpepperNameFromTitle が丸括弧を外せず、短い店名の正しいリンク7件が name-mismatch（10-09 の日次監査）。末尾の「＜…＞」を外せば7件とも一致・ほかの22件は変わらない（scratchpad で確認）
  - ISSUE-163（P1・ISSUE-158 の子）: 日次の照合（build.yml の audit_store_link_identity.js --limit 60）が食べログから 10-05 以降すべて HTTP 403（10-09 は53件中53件）。対象を店の並び順に取り、失敗中の組を毎日先に照合するので、新しいリンク20件は一度も照合されていない。食べログの一致2,540件は 09-03（23件）・09-20（2,517件）のもので、11-02 から古くなり、403 で照合し直すと fetch-error で上書きされて事実が消える（支店違い・別の店の監査が数えなくなる＝偽の緑）。直し方: 取得失敗では前の判定を残す・連続403で止める・最後に試した日で間隔をあける・古い順に照合・成功しなかったことを報告と夜間QA に出す。403 は回避しない
  - ISSUE-158 は達成条件3（日次の監査が新しい支店違いを数える）が実際には動いていないため、ISSUE-163 が済むまで閉じない
4i. 10-09 03:55: ISSUE-161 は確認済み（run 37878933280 は起点 e69a6ab178 ではなく main の最新 e92dc86ab9＝前の回の生成物の上から始まり、push は rebase 不要で通った）→ backlog done・P-165 Done にする。ISSUE-160 は外す実行済み（未コミット・stores.json 42件・stores/*.html 42本・tabelog_resolved 42件 failed）。確認: 監査 different 0（確かめ済み3）・page-store-links exit 0・変わった店は42件の食べログURLだけ・42本の script 180個に構文エラー0・残す3件と正しい支店11件はリンクのまま
4j. 新しく見つけた（起票する）: (1) ISSUE-165: 食べログのページ経由で解決した Instagram（data/instagram_resolved.json の method TBG-*・974件）のうち、店の食べログURLが今は別（外した等）なのに、その Instagram を表示している店が320件。ブランド共通の公式（磯丸水産）は問題が小さいが、別の支店のアカウント（餃子のかっちゃん 名古屋駅南口2号店→kacchan_sakae）や別の店（碧亭 栄→midori_tei_miyoshi）がある。どこまで許すかの基準が要る (2) ISSUE-166: 照合で名前が一致しなかった食べログリンク33件（sim>0 で 9/20 の後始末の対象外・人の確認待ち）。例 MAVERICK HALL J000739645 → ELLE HALL Dining 名古屋駅西口店のページ
4k. 10-09 #440 で合流（fba87a6e56）: ISSUE-162/163/164 done（P-166/167/168 Done＋コメント）。ISSUE-160 は main で42件が外れたままと確かめ done（P-164 Done＋コメント）。取得できなかった回は判定を残す・HTTP 404/410 は判定扱い・食べログ先→未照合→古い順・7日あけ・5件で止める・--health [--json]・夜間QA soft link-audit-health・専用の監視 link-audit-watchdog.yml（30日超で Issue 1件・毎日は知らせない・復旧で閉じる）・docs/decisions/0013。ISSUE-158（P-162）は達成条件3（日次の照合で実際に数える）が食べログの 403 で確かめられず in_progress のまま（コメント済み）。ISSUE-167（P-171・Todo）を起票。linear_sync_state の P-171 はブランチにコミット済み（d832f8ec40・未 push）
4l. 10-09 #441 で合流（31de0bc0ef）: ISSUE-167 done（P-171 Done＋コメント）。34件を店舗IDごとに外した（tabelog_branch_reviewed.json に issue: ISSUE-167・kind closed-other 14/closed-same 19/not-found 1）。報告の不一致は33件（食べログの名前違いだけ・ISSUE-166）。ISSUE-162 の追記（エリア名の入れ子の丸括弧・ソラリウム）も同じPR（P-166 にコメント）。#440 のコードは CI で狙いどおり動いた（食べログ5件で403→やめる・ホットペッパー55件取得）。ISSUE-168（P-172・Todo・同じ店の閉店19件の営業を一次情報で確かめる）を起票。次のビルドの後に main で34件が外れたままか確かめる。linear_sync_state の P-172 はブランチにコミット済み（4bf96ab405・未 push）
4m. 10-09 ISSUE-168 を ISSUE-169（P-173）と ISSUE-170（P-174）に分け P-172 の子にした（c8ea939298・未 push）。ISSUE-169 の確認を終えた: data/store_liveness_reviews.json（新規・19件の判定と根拠・取った日時/URL/状態/名前/住所）。閉店12（女子大寿司→Aoi・パル8・みふね・黒猫屋・あっとバーグ・すし乾山・貝しぐれ・STEPS・羅針盤・上海湯包小館・新京・新九）／営業中2（KollaBo・Hug＝六田1丁目204へ移転と見られ住所が古い）／決められない5（HANARE・金鯱うなぎ・shin・Harbor・カラオケレインボー）。閉店の基準は「名前と住所が合う独立した2つ以上の情報源が閉店を示し、それより後の営業の痕跡が無い」（_doc に記載）。ISSUE-170: data/closed_stores.json に12件を追加済み（未コミット）。次: data/stores.json から12件を外す・stores/<id>.html 12本を削除（features/journal からのリンクは無いと確認済み・hub と index.html の導線は CI が作り直す）→ audit_store_liveness・audit_closed_store_mentions・npm test → PR。後で起票: ①Hug の住所 ②決められない5店を30日後に確かめ直す ③places_resolved.json の business_status が 05-22 から古いまま（19件中10件が閉業に変わっていた・Basic だけの定期更新・オーナー確認） ④日次のリンク照合で HotPepper の shopState【閉店】を数える（オーナー確認不要・次に実装）
4n. 10-09 #442 で合流（5e509a3bbf）: ISSUE-169 done（P-173 Done＋コメント）・ISSUE-170 は main のビルド 37886320956 の後に「12件が data/stores.json・stores/*.html・sitemap に無い」「audit_store_liveness exit 0」「ISSUE-167 の34件も外れたまま」を確かめて done（P-174 Done）→ 親 ISSUE-168（P-172）も Done。起票: ISSUE-171（P-175・Hug の住所）・172（P-176・決められない5店を 11-09 までに確かめ直す）・173（P-177・Places の営業状態の定期更新・オーナー確認が先）・174（P-178・下）
4o. ISSUE-174（P-178）作業中（未コミット）: scripts/lib/store_link_identity.js に hotpepperShopStateFromHtml・judgeHotpepperHtml（名前が合うページの【閉店】→ reason closed／合わなければ name-mismatch のまま closed は事実で残す）・checkHotpepperId は opts.fetchHtml で差し替え可。scripts/audit_store_link_identity.js に summarizeClosures（hotpepper.closed／notFound＝HTTP 404/410 の掲載終了）・レポートの closures・--closures（照合せず件数・閉店があれば exit 1）。残り: テスト（store_link_identity.test.js に判定、audit_store_link_identity.test.js に 404 と集計）・夜間QA soft（hotpepper-closures）・CLAUDE.md の行・backlog・PR・P-178 Done
4p. ISSUE-174 は #443 で合流（5a9f9807a7）・backlog done・P-178 Done＋コメント済み。ISSUE-170/168 も main で確かめて done（P-174・P-172 Done）
4q. #444 で合流（10-09 06:10）: ISSUE-166（P-170 Done＋コメント）・子の ISSUE-175/176/177 は done（完了済みの子は同期スクリプトが Linear に作らない設計なので、親のコメントにまとめた）。食べログ14件を店舗IDごとに外し（stores.json・stores/*.html・tabelog_resolved failed）、照合の報告は keep の組を reviewedKeep に分ける。照合キャッシュの ＢＡＲ  ＣＯＭ’Ｓ を保存済みの題名から判定し直した。残りの食べログ不一致は三國（決められない・403 が解けたら ISSUE-158 で）。次のビルドの後に main で14件が戻っていないこと・報告に reviewedKeep が出ることを確かめる
4r. ISSUE-178（P-179・P1）: PR #445（未合流・10-09 06:15 作成）。まるゆ（J003450558・錦3-18-16）はホットペッパーが【閉店】、公式 Instagram の住所は熱田区池内町4-1（約3.6km 南）、Google の店舗情報も熱田で営業中（住所が違うので根拠に数えない）→ 移転閉店として closed_stores.json に入れ、stores.json・stores/J003450558.html・sitemap から外した。扱いは docs/decisions/0014（取り込み元が閉店なら外す・生きていれば住所を直す＝ISSUE-171）。移転先を載せるかは ISSUE-179（P3・Editor/DataKeeper）。次: main のビルド 37891115455（#444 の後・実行中）が終わってから #445 を合流 → Linear 同期（ISSUE-179 作成・P-179 は In Progress）→ その次のビルドの後に main で J003450558 が stores.json・stores/・sitemap・stores/area から消えたままか、#444 の14件の食べログURLが戻っていないか、報告に reviewedKeep が出るかを確かめ、ISSUE-178 done・P-179 Done＋コメント
4s. その後 ISSUE-148（着手済み・未コミット: scripts/lib/spreadsheet_address_gate.js と tests/spreadsheet_address_gate.test.js。残りは build.js の main への組み込み・ログ・CLAUDE.md・PR・CI ログで達成条件4）→ SEO-134 → ISSUE-153 → SEO-144。zsh は `node $c` の $c を分割しない（ループで引数つきコマンドを回すと MODULE_NOT_FOUND）。/tmp への書き出しは避け scratchpad を使う
5. 夜間QA の station-names が緑で続いたら hard に上げる（10-09 が初めての ✅。10-10 も緑なら上げる）
6. 最後に: 創業者の実名が index.html の Organization JSON-LD に出ている件をオーナーへ報告（変更しない）

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
- 既存の不一致（特集の「うなぎのしろむら 泉店」→ stores.json は「泉本店」・fathers-day-2026 と nagoya-kaoawase-washoku）は本作業の前から main にある。最後に起票する
- `git checkout -- features/` は手で直した特集まで戻す。build_featured.js の試し実行の後は、そのファイルだけを戻す
- 特集の日付は JSON-LD だけが正本（docs/decisions/0010）。画面の日付は scripts/apply_feature_byline.js が出す。手で書かない
- 8 本の datePublished 2025-04-15 は年の誤記だった（最初のコミットは 2026-04-15）。数日のずれは誤りと言い切れないので直さない

# 関連ファイル
- agent-backlog.md（SEO-116〜141・ISSUE-145〜148）
- docs/seo-strategy-2026-10.md（戦術表 §3・KPI §4）
- docs/decisions/0007-seo-north-star-metrics.md
