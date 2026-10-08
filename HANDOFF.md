status: in_progress

# 目的
オーナー指示「こちらの確認なしで進めれるものはガンガン進めて」（2026-10-09）。SEO-116 配下と同日起票の課題のうち、オーナーの確認・操作が要らないものを順に実装し、main に合流させ、Linear を Done にする。
（前のメモ「SEO分析と90日の戦略・戦術」は status: done で完了済み。内容は git 履歴 ab273bc61d の HANDOFF.md を参照）

# 完了条件
- 下の「対象」の各課題が、テストと QA を通って main に合流し、agent-backlog.md が done、Linear が Done（結果コメントつき）になっている
- 日付待ち・オーナー待ちの課題は手を付けず、理由をここに残す

# できていること
- SEO-119/120（実装済み・PR 前）: 駅名監査 `scripts/audit_station_names.js`（判定器 `scripts/lib/station_names.js`・駅名リスト `data/station_names.json`＝HeartRails Express・取得 `scripts/fetch_station_names.js`）。夜間QA に soft で追加。全店照合で県外の店23店を HotPepper の所在地で確かめ `data/closed_stores.json` へ。名古屋の2店は例外（ふじなが）とアクセス訂正（和食さと・`data/access_corrections.json`・build.js で適用）。焼き鳥特集2本・hard-to-book・予約困難特集・editor_picks から串っ子/のんきを除去。npm test 321/321・監査 0 店
- 後回しの起票: ISSUE-147（Places の古い誤紐付け・口コミ信頼度が変わるためオーナー承認が要る）／ISSUE-148（スプレッドシート経由の行を HotPepper の住所で検査）

# 次にやること
1. SEO-119/120 を PR → squash merge → Linear 同期（SEO-120 Done・SEO-119 は CI 再生成後に `grep -rlE '釧路駅|神田\(東京\)' stores/*.html stores/area` が 0 件で Done）
2. ISSUE-146 → ISSUE-145 → SEO-117 → SEO-121 → SEO-135/136/138/139/127/131/124/122/137/134
3. SEO-115 の残り: 10-09 06:00 の夜間QA（inline-js）と `data/site_metrics.json` の topPages に /stores/ が出るかを見て閉じる
4. 夜間QA の station-names が緑で続いたら hard に上げる

対象外（理由）:
- SEO-118（10-20 の GA4 再基線）・SEO-125（10-15 記録）・SEO-126/130/140（11-15 判定）・SEO-141（11-30 判定）: 日付待ち
- SEO-129 の反映・SEO-132 about.html・ISSUE-147: オーナー承認が要る
- SEO-067/098（BWT・UTM）: オーナー本人の操作

# 試したが駄目だったこと
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
