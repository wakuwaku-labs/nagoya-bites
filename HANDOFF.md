status: in_progress

# 目的
オーナー依頼「SEOの分析と、今後より伸ばすための戦略戦術を用いた改善点」（2026-10-09）。実測で分析し、90日の戦略・戦術を文書化し、P0 の計測バグを直し、残りを backlog → Linear に起票する。
（前のメモ「フィードバック triage の後始末」は status: done で完了済み。内容は git 履歴 20d03bd7a4 の HANDOFF.md を参照）

# 完了条件
- docs/seo-strategy-2026-10.md（分析・戦略・戦術・KPI）と docs/decisions/0007 がある
- 店舗ページの GA4 構文エラーを生成器で直し、生成ページのインライン JS 構文ゲート（lib・監査CLI・テスト・qa_gate）が npm test を通る
- 戦術 T2〜T15 が agent-backlog.md に起票され Linear に同期されている
- PR が作成されている（main への合流はテスト・QA 通過時のみ）

# できていること
- 分析完了（計画: ~/.claude/plans/seo-golden-dream.md）。要点:
  - P0: gen-store-pages.js:786 のテンプレートリテラル内 `\/\/` が生成物で `//` になり、店舗ページ 5,008 本のインライン script（gtag config・outbound_click）が構文エラーで不実行。2026-05-08 生成分から
  - 勝ち面は特集「一人飲み」1本（全クリックの25%）。デート特集が 11.5 位で1ページ目の手前。宴会・接待・忘年会は表示ほぼ0
  - ハブ699本は表示86・クリック1（sitemap 安定掲載は 09-28 から）。栄の8店に「JR釧路駅」等の駅名汚染
  - 検索流入は Bing 28% / Google 26.7% / Yahoo 11.3% / 生成AI 7.4%

# 次にやること
1. T1 修正（gen-store-pages.js:786）＋ゲート実装 → npm test
2. docs（seo-strategy-2026-10 / growth-plan 追記 / ADR 0007 / kpi-weekly）
3. backlog 起票（SEO-115〜）→ sync_backlog_to_linear.js dry-run → --apply
4. 独立レビュー → コミット → PR

# 試したが駄目だったこと
- （なし）

# 守るルール・判断メモ
- 5,008 ファイルの店舗ページはローカルで再生成しない（日次 build.yml の自動コミットと衝突する）。main 合流後の build.yml が gen-store-pages.js → gen_area_genre_pages.js の順で再生成する
- そのため、テストは「生成器の出力」と「テンプレート・既存の正常ページ」を検査し、コミット済みの stores/*.html は見ない（合流前は全件壊れているため）
- .linear.json は入れない。本リポジトリは agent-backlog.md → scripts/sync_backlog_to_linear.js が Linear 運用の正本（グローバル規約の「リポジトリ固有の決まりを優先」）
- SEO の判定指標は discovery 表示・クリック、被表示ハブ数、生成AI・Bing 経由セッション（総クリックと PV は GA4 再基線化まで比較しない）

# 関連ファイル
- ~/.claude/plans/seo-golden-dream.md（承認済み計画）
- gen-store-pages.js / scripts/qa_gate.js / .github/workflows/build.yml
- data/gsc_metrics.json / data/search_channel_metrics.json / data/site_metrics.json / data/area_genre_pages_manifest.json
- docs/growth-plan-2026-q4.md
