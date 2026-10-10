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

# 次にやること（2026-10-11 利用上限で中断・WIP コミット済み・未確認）
1. 実装済み（未目視）: アイコンスプライト（body 直後）／ヒーロー（説明文削除・検索アイコン・シーンのタイル・エリアのピン）／信頼の帯をアイコン4項目に／見出しの添え書き削除／ジャーナル見出し・カードの装飾／桜ゼロ宣言をアイコンの3項目に／話題店カードの重複行削除／カード（メタにアイコン・特集を1リンク・一致行なし・予約＋地図＋媒体を1行 .card-actions）／HP クレジットを結果の下 #hpc-foot へ／「この検索の解釈」見出しと2つ目のリセット削除／末尾に DSN-008 の CSS 上書きブロック（.grid の minmax(0,1fr) で DSN-009 修正）
2. scratchpad の 390px iframe（port 8765/8766 のサーバは要再起動）で目視: 検索結果上部の空白・カードの .card-actions の左右余白・タイルのはみ出し・no-sakura の配色
3. 「この条件で通知」をアイコンのみに（文言を span で包む）・#fb-fab をアイコンの丸に
4. DSN-012 モーダル（予約は主ボタン・電話/地図を横並び・基本情報の行にアイコン）未着手
5. npm test（ベースラインは scratchpad/test_before.log）・measure_typography・制約5の操作確認 → PR（前後スクショ）→ オーナー確認後に合流
6. 済んだら backlog の DSN-008〜012 を done・Linear 同期・HANDOFF を done

# 試したが駄目だったこと
- Chrome の resize_window は効かない（最大化）。scratchpad/m/index.html の 390px iframe（同一オリジンにするため repo を site/ に symlink・port 8766）で見る

# 守るルール・判断メモ
- 「AI菩薩」は音声入力の誤変換で「AIっぽさ」と解釈
- AIっぽさの具体: グラデーション＋光彩のボタン、字間を空けた小見出し＋罫線、見出しごとの説明の添え書き、宣言調の黒帯、イタリックの英字飾り（Daily 等）、絵文字
- アイコンは絵文字を使わず線画 SVG（Lucide・ISC）を index.html 内スプライトに（制約1・4）。font-size は var(--fs-*) のみ、可視文字 13px 以上、タップ 44px 以上（制約12）
- ホットペッパーのクレジットは規約で必須なので消さない
- 店のデータ・信頼度の判定は変えない
- main への合流＝本番公開なので、PR を作ってオーナーの確認を待つ

# 関連ファイル
- index.html（CSS 〜1300行・buildCardHtml 9746行付近）／assets/css/nb.css／data/design_system.json／agents/designer.md
