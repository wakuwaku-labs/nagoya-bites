status: in_progress

# 目的
オーナー依頼（2026-10-11）「実際の見た目を判断して、より感覚的で能動的に操作できる見た目に。細かい部分・文字が多すぎるのでアイコンや記号を使う。AIっぽさは絶対になくす。他サイト参考可」。
（前のメモ「確認なしで進められる課題の消化」は status: done。内容は git 履歴 6e7cec6945 の HANDOFF.md）

# 完了条件
- DSN-008（P-212）配下の DSN-009〜012（P-213〜216）の acceptance を満たし、PR に 390px / 1280px の前後スクショ
- `npm test`・`audit_design_system.js --check`・`audit_inline_js_syntax.js --check` が通る
- 制約5の機能（フィルター・検索・モーダル・IG・Google評価・媒体リンク）を実際に操作して確認

# できていること
- 現状確認（390px・1280px）。見つけた問題は agent-backlog.md の DSN-008 背景に記録
- DSN-009 の原因特定: `.grid{grid-template-columns:1fr}`（index.html:828）で列が中身の最小幅に引っ張られ、カード 642px・scrollWidth 658px
- backlog 起票・Linear 同期済み（P-212〜216）

# 次にやること（2026-10-11 実装・確認済み・オーナーの確認待ち）
1. 実装済み・目視確認済み（390px/1280px）: DSN-009〜012 すべて。コミット d379224b39・e05a1db04f まで
2. 検査: npm test 494/0・audit_design_system --check・audit_inline_js_syntax --check（全ページ）すべて通過。制約5（シーン/検索/絞り込み/カードの媒体リンクとGoogle評価/詳細の6媒体/IG）を操作して確認・JSエラー0
3. 実測（375px・焼肉）: カード高さ 808→506px、文字 231→183、44px未満のタップ対象 250→92、12px以下の文字 5%→2%、ページ幅 658→390（DSN-009）
4. 前後比較ページ: https://claude.ai/artifact/EwB9RuwsgSpFd1eNPLus5t（非公開）。スクショは scratchpad/shots.js（headless Chrome を CDP で操作）で再生成できる
5. PR を作成済み → オーナーが見て OK なら main に合流（＝本番公開）。合流後に backlog の DSN-008〜012 を done・Linear 同期（P-212〜216 Done）・HANDOFF を done
6. オーナーに確かめたいこと: 女子会のアイコン（ワイングラス）・信頼の帯の文言「現役の店長が編集」

# 試したが駄目だったこと
- Chrome の resize_window は効かない（最大化）。headless の画面はインストール案内の背景（#pwa-install-backdrop）が全面を暗くするので消してから撮る。scratchpad/m/index.html の 390px iframe（同一オリジンにするため repo を site/ に symlink・port 8766）で見る

# 守るルール・判断メモ
- 「AI菩薩」は音声入力の誤変換で「AIっぽさ」と解釈
- AIっぽさの具体: グラデーション＋光彩のボタン、字間を空けた小見出し＋罫線、見出しごとの説明の添え書き、宣言調の黒帯、イタリックの英字飾り（Daily 等）、絵文字
- アイコンは絵文字を使わず線画 SVG（Lucide・ISC）を index.html 内スプライトに（制約1・4）。font-size は var(--fs-*) のみ、可視文字 13px 以上、タップ 44px 以上（制約12）
- ホットペッパーのクレジットは規約で必須なので消さない
- 店のデータ・信頼度の判定は変えない
- main への合流＝本番公開なので、PR を作ってオーナーの確認を待つ

# 関連ファイル
- index.html（CSS 〜1300行・buildCardHtml 9746行付近）／assets/css/nb.css／data/design_system.json／agents/designer.md
