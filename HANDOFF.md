status: in_progress

# 店のデータの正しさ・検索流入・送客の計画（旧 MEO 計画）の実装（2026-10-15〜）

（前のメモ「X 自動投稿」「2026-10-13 自律実行ラン」は status: archived。内容は git 履歴 2038657fa1 の HANDOFF.md）

## 目的
- 計画書 `docs/meo-plan-2026-10.md`（改訂版）をオーナーが承認した（2026-10-15「計画（改訂版）の返事: 1=A / 2=A（先に止める） / 3=A（標本で 1 割以上が別の店だった帯は、確かめが済むまで出さない）」）。計画 9 章の順で実装する
- 順番: B1 の電話の部分（済）→ A1 状態を数える（済）→ A2 帯ごとの標本 150 組（済）→ B1 の評価・口コミ信頼度（判断 3・作業中）→ B3 スイッチと夜間 QA → B2 地図リンク → C1 計測。A3 は済み

## 完了条件
- 電話: 不一致と一致率 0.3 未満の帯の店に電話ボタンが出ない（本番で実例 5 店を確かめる）。店数・店舗ページ数は変わらない
- A1・A2: 状態ごとの数のコマンド、帯ごとの標本 150 組の記録（根拠つき）、判断 3 の表
- 評価: 判断 3 の基準で帯ごとに出す・出さない。B3・B2・C1 は計画書の確かめ方どおり
- 各段階は PR で 1 本ずつ入れ、ビルドの後に本番で確かめる

## できていること
- PR #602（マージ済み 2026-10-15 11:17Z）: `scripts/lib/place_binding.js`・`data/place_binding_policy.json`・電話の関門・ADR 0046・計画書・`docs/seo-traffic-inventory-2026-10.md`（A3）。電話ボタンが消えるのは 297 店（不一致 32・要確認の低い帯 265）
- マージ後の本番ビルド run 38726252524 は 11:28Z 時点で実行中（バックグラウンドで完了待ち）
- ブランチ `wakuwaku-labs/meo-a1-states`（main ca5e59f503 から）:
  - コミット 752bc15a32: `audit_places_binding.js --states [--json]`（状態ごとの数・機能ごとに使う状態・取得日 90 日超の評価）と `--sample N --seed S`（帯ごとに決まった種で選ぶ）＋テスト 2 件
  - 未コミット: `data/places_binding_reviewed.json` に標本 150 組の判定を書いた（sample=A2-2026-10-15・evidence・storeUrl・googleUrl・checkedUrls）。same→keep（住所の裏付けがあるときだけ）／different→reject／unknown と裏付けなしの same→undecided。`_doc` を keep 対応に書き換えた
- A2 の結果（seed 20261015・帯ごとに 30 組）:
  | 帯 | 母数 | 同じ | 別の店 | 決められない | 判断 3 |
  |---|---|---|---|---|---|
  | 一致率 0.3 未満（sim-0＋sim-lt-0.3） | 310 | 22 | 3 | 5 | 出さない（3/30＝1 割） |
  | 0.3〜0.6 | 700 | 29 | 1 | 0 | 出す |
  | 0.6 以上 | 383 | 28 | 2 | 0 | 出す（別の店の 2 組は掲載の住所が空） |
  | 支店名の食い違い | 33 | 26 | 1 | 3 | 出す |
  | 店名が合う（比べ用） | 3,081 | 28 | 0 | 2 | — |
  - 追加の確かめ: 一致率 0.3 以上の要確認で掲載の住所が空の店（203 店）から 30 組（seed 20261016）→ 同じ 28・別 0・決められない 2。細かい帯は作らない
  - 結果の元: scratchpad の `a2/results/*.json`・`a2/band_*.json`・`a2/sample.json`・`a2/band_no-address.json`（追加分の結果はまだファイルにしていない＝会話の通知の中）

## 次にやること
1. 追加の 30 組（住所が空）も reviewed に書く（same→keep・evidence store-page／unknown→undecided）
2. B1 の評価・口コミ信頼度: policy に `rating`・`trust`（allowReviewBands は sim-0.3-0.6・sim-ge-0.6・branch-conflict）。build.js の電話の判定の直後・トレンドスコアの前で、状態が不一致か許していない要確認の店は Google評価・口コミ数を空にし、places_history を使わない（placesRejectedKeys に足す）。trust を許さない店は reviewTrust を付けない（index.html・gen-store-pages.js は無ければ要素ごと出さない）。状態 none（紐付けなし）は触らない。スイッチ show:false は全店で止める
3. テスト・`--states` で影響の数・ADR 0046 に判断 3 の表を追記（新しい番号は使わない）・計画書に A2 の表
4. npm test・audit_design_system・audit_inline_js_syntax → PR → 本番ビルドが終わっていることを確かめてマージ → 本番で確かめる
5. 本番の電話の確かめ（run 38726252524 の後）: `node scripts/audit_phone_links.js`、実例 5 店（屋上酒場ホシノシタ・bindi ビンディー・BAR EVE イブ・CCC シーシーシー・木村屋 錦）の店舗ページとトップのクイックビュー、店数と店舗ページ数
6. B3（夜間 QA に状態の数・スイッチ）→ B2 → C1。backlog・Linear（P-467 MEO-003 を進める）を更新

## 試したが駄目だったこと
- `orca linear save-issue` の作成時の `--parent-id` は効かない（作成後に付け直す）。書き込みは linear_write_unconfirmed でも反映されていることが多い。必ず読み戻す
- `node scripts/sync_backlog_to_linear.js --apply` は使わない（ISSUE-189＝P-471）
- python3 の標準入力に日本語の長い行を渡すと SyntaxError。スクリプトはファイルに書き、`# -*- coding: utf-8 -*-` を付ける
- zsh で `echo =====` はエラー（= で始まる語）。区切りは `echo "-----"`
- `gh run watch` は途中で exit 1 で抜けることがある。`until [ status = completed ]` のループで待つ
- 担当の出力ファイルは JSONL の記録。結果は scratchpad の `a2/extract.js` で取り出す

## 守るルール・判断メモ
- 判断の記録 0037（近い順は外した）は守る。位置の使いやすさは保留（計画書 8.5 節）
- 判断 3=A: 標本で 30 組のうち 3 組以上（1 割以上）が別の店だった帯は、評価・口コミ信頼度を確かめが済むまで出さない。「決められない」は別の店に数えない（数は別に書く）
- 不一致・要確認の店で、ボタンは無効にせず要素ごと出さない（読み上げ）
- keep を書くのは住所の裏付けがあるときだけ（掲載の住所が空で店舗ページも見ていない same は undecided）
- このセッションで自分の作業ブランチを一度 `git push -f` した（ルール違反）。以後は merge で取り込み、強制 push しない。最終報告で触れる
- placeId が無いのに評価が出ている店が 30 店ある（出どころ未調査）。最終報告で触れる

## 関連ファイル
- docs/meo-plan-2026-10.md（計画書）・docs/decisions/0046-place-binding-states.md・scripts/lib/place_binding.js・data/place_binding_policy.json・data/places_binding_reviewed.json・scripts/audit_places_binding.js・scripts/lib/phone_link.js・build.js（1411〜1452 行 Places の反映、1547〜1562 行 電話、1600〜1630 行 口コミ信頼度）
- agent-backlog.md の MEO-001〜006 ／ Linear P-465〜P-470
