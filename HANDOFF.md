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
1. ✅ T1 修正＋ゲート（commit b536405024）。npm test 309件通過。デザイン監査は CI と同じ条件で通過
2. ✅ docs（seo-strategy-2026-10 / growth-plan 追記 / ADR 0007 / kpi-weekly）
3. ✅ 起票: SEO-115〜141・ISSUE-145/146 を Linear P-111〜P-140 に作成（親子26件設定済み）。既存 P-24/P-32/P-57/P-58/P-59 にコメント。重複 P-139 は Duplicate 化。ISSUE-096（P-36）は Linear が Done・backlog が in_progress のため同期から外した
4. ✅ 独立レビューの指摘対応（中3件・軽微5件）: 再生成されない孤児16本も1行修正（CI 相当の全件シミュレーションで現役4,909本も違反0）、59.8% の分母を「クエリが分かる表示（全体の45.9%）」に訂正、SEO-129 をオーナー承認経路に限定、検査器の data-src・コメント・type 引数・ルート全ページ対応。npm test 312件通過
5. ✅ Linear P-111・P-125・P-112 にコメント。PR #403 を合流（208f72697e・03:00 JST 前）
6. 合流後の build（run 37818977796）で 13 本が孤児化して壊れたまま残った → 後続 PR で1行置換 ← 今ここ。合流後の次の build のログで監査が ok:true なら、build.yml の continue-on-error を外す PR（用意した差分は scratchpad の build_blocking.yml）。GA4 で /stores/ の page_view 確認（オーナー）と夜間QA の緑は Linear P-112 で追う

# 試したが駄目だったこと
- 合流前に手元の data/stores.json で孤児を数えて直しても足りなかった。CI の build は店舗データを更新してから再生成するため、手元で現役だった 13 店が CI では孤児になり、壊れた形で残った。孤児の手当ては合流後の main で数え直す
- CI の監査ステップは continue-on-error のため、API のステップ結果が success でも監査は失敗していた。合否はログの ok と違反数で見る

# 守るルール・判断メモ
- 5,008 ファイルの店舗ページはローカルで再生成しない（日次 build.yml の自動コミットと衝突する）。main 合流後の build.yml が gen-store-pages.js → gen_area_genre_pages.js の順で再生成する
- そのため、テストは「生成器の出力」と「テンプレート・既存の正常ページ」を検査し、コミット済みの stores/*.html は見ない（合流前は全件壊れているため）
- .linear.json は入れない。本リポジトリは agent-backlog.md → scripts/sync_backlog_to_linear.js が Linear 運用の正本（グローバル規約の「リポジトリ固有の決まりを優先」）
- SEO の判定指標は discovery 表示・クリック、被表示ハブ数、生成AI・Bing 経由セッション（総クリックと PV は GA4 再基線化まで比較しない）

- 栄の駅名汚染は8店ではなく7店（鳥しげ 錦本店の「東京第一ホテル錦」は誤検出）。効果台帳に SEO-095/099/105 の行は無い（実際は SEO-003・ISSUE-067・SEO-060・DSN-003）。薄い店は定義どおりに数えると24店
- 起票の構成（2026-10-09 決定）: 親 SEO-116（90日計画）の下に作業を並べる。中間の親は T7（ハブ）・T10（店舗）・T12（AI/Bing）だけ。T6 は SEO-087、T8 は SEO-067/098、T10c は SEO-095 に追記して新規にしない（同じ課題は追記の規則）
- 「バー」「カフェ」を含む検索はほぼ店名指名（バー142表示中141）。ジャンル需要は未観測と書く（計画時の「ハブが取るべき面」は誤り）
- 手元のデザイン監査が stores/J003560485.html 等で落ちるのは、CI がコミットしない data/store_page_orphans.json が古いため（CI では作り直されて通る）。ISSUE-146 で起票する
- Linear 同期は一覧 200 件で打ち切ると止まる作り（現在109件）。ISSUE-145 で起票する

# 関連ファイル
- ~/.claude/plans/seo-golden-dream.md（承認済み計画）
- gen-store-pages.js / scripts/qa_gate.js / .github/workflows/build.yml
- data/gsc_metrics.json / data/search_channel_metrics.json / data/site_metrics.json / data/area_genre_pages_manifest.json
- docs/growth-plan-2026-q4.md
