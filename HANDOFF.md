status: in_progress

# 目的
オーナー指示「こちらの確認なしで進めれるものはガンガン進めて」（2026-10-09）。SEO-116 配下と同日起票の課題のうち、オーナーの確認・操作が要らないものを順に実装し、main に合流させ、Linear を Done にする。
（前のメモ「SEO分析と90日の戦略・戦術」は status: done で完了済み。内容は git 履歴 ab273bc61d の HANDOFF.md を参照）

# 完了条件
- 下の「対象」の各課題が、テストと QA を通って main に合流し、agent-backlog.md が done、Linear が Done（結果コメントつき）になっている
- 日付待ち・オーナー待ちの課題は手を付けず、理由をここに残す

# できていること
（随時追記）

# 次にやること
対象（確認不要・実装可能）:
1. SEO-117 GSC の intent.kpi・pageTypes を metrics_history に日次で残す
2. SEO-119/120 栄7店の県外駅名の除去と駅名監査（取り込み元の特定を含む）
3. SEO-121 sitemap の lastmod を実更新日に・robots の Sitemap 整理
4. ISSUE-145 Linear 同期の200件上限を外す / ISSUE-146 孤児ページ一覧を CI のコミット対象へ
5. 以降: SEO-135 llms.txt・sameAs / SEO-136 IndexNow 対象拡大 / SEO-138 GA スニペット1本化 / SEO-139 aggregateRating・SearchAction / SEO-127 banquet 季節リード / SEO-131 特集の日付・署名 / SEO-124 ハブ本文 / SEO-122 date.html / SEO-137 ジャーナル title / SEO-134 結論ブロック

対象外（理由）:
- SEO-118（10-20 の GA4 再基線）・SEO-125（10-15 記録）・SEO-126/130/140（11-15 判定）・SEO-141（11-30 判定）: 日付待ち
- SEO-129 の反映・SEO-132 about.html: オーナー承認が要る
- SEO-067/098（BWT・UTM）: オーナー本人の操作
- SEO-115 の残り（GA4 で /stores/ の page_view 確認・夜間QA の緑）: 10-09 06:00 以降に結果を見て閉じる

# 試したが駄目だったこと
（随時追記）

# 守るルール・判断メモ
- 1課題（または密接な組）ごとに PR → squash merge。対話セッションは main 直 push 不可
- テンプレート・生成器の変更は Designer の QA-5 記録と `node scripts/audit_design_system.js --check` を通す（制約12）
- 店舗ページ約5,000本はローカルで再生成しない（CI の build.yml が再生成する）
- Linear の説明は同期で置き換わらない。訂正・結果はコメントで残す（`orca linear comment add` に --workspace を付けない）
- 店舗データの変更は一次情報で確かめたものだけ。確かめられなければ空欄に倒す（推測で書かない）

# 関連ファイル
- agent-backlog.md（SEO-116〜141・ISSUE-145/146）
- docs/seo-strategy-2026-10.md（戦術表 §3・KPI §4）
- docs/decisions/0007-seo-north-star-metrics.md
