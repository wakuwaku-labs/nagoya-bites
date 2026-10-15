status: in_progress

# 店のデータの正しさ・検索流入・送客の計画（旧 MEO 計画）の実装（2026-10-15〜）

（前のメモ「X 自動投稿」「2026-10-13 自律実行ラン」は status: archived。内容は git 履歴 2038657fa1 の HANDOFF.md）

## 目的
- 計画書 `docs/meo-plan-2026-10.md`（改訂版）をオーナーが承認した（2026-10-15「計画（改訂版）の返事: 1=A / 2=A（先に止める） / 3=A（標本で 1 割以上が別の店だった帯は、確かめが済むまで出さない）」）。計画 9 章の順で実装する
- 順番: B1 の電話の部分（済）→ A1 状態を数える（済）→ A2 帯ごとの標本 150 組（済）→ B1 の評価・口コミ信頼度（済）→ B3 スイッチと夜間 QA（済）→ B2 地図リンク（作業中）→ C1 計測。A3 は済み

## 完了条件
- 電話: 不一致と一致率 0.3 未満の帯の店に電話ボタンが出ない（本番で実例 5 店を確かめる）。店数・店舗ページ数は変わらない
- A1・A2: 状態ごとの数のコマンド、帯ごとの標本 150 組の記録（根拠つき）、判断 3 の表
- 評価: 判断 3 の基準で帯ごとに出す・出さない。B3・B2・C1 は計画書の確かめ方どおり
- 各段階は PR で 1 本ずつ入れ、ビルドの後に本番で確かめる

## できていること
- PR #602（電話の関門）・#603（写真の持ち主をホットペッパーIDでも照らす・本番停止の直し）・#604（評価・口コミ信頼度の関門＝判断 3=A・状態ごとの数・標本の記録・特集の★を外す sync_feature_scores.js）をマージ済み
- 電話の本番確認（run 38728803531 の後）: 止めた店 297（不一致 33・一致率 0.3 未満 264）、audit_phone_links の古い欄 0・未反映 0、実例 5 店で店舗ページとデータに電話ボタンなし（とんかつ朱寿はあり）。店数 5,005→5,002 はホットペッパーの掲載の変化（3 店・閉店リストではない）
- 起票: ISSUE-191＝P-473（紐付けの無い店の評価 30 店。26 はスプレッドシートの列・4 は手動の店）、ISSUE-192＝P-474（会席の特集の候補 9<10。入れ替えは 9 店で組み「N選」は sync_feature_counts が合わせる）。P-467（MEO-003）Done・P-468（MEO-004）In Progress。data/linear_sync_state.json に対応を足した
- ブランチ wakuwaku-labs/meo-b3-switch（main a1eb3b2895 から・上流なし・push 済みの 1 コミット）:
  - B3 済（コミット済み）: place_binding.js に gateFor（関門の決め方を 1 本に）、audit_places_binding.js --states に violations・noBinding・switches と --check、nightly_qa.js に soft の place-binding-states、ADR 0046 の 8、CLAUDE.md、backlog MEO-005 を in_progress。npm test 1,745 通過。全部のスイッチを切ると電話・評価・信頼度が全店で消えることを実データで確かめた
  - B2 作業中（未コミット）: 新しい scripts/lib/map_link.js（NB-MAP-CORE: cleanArea・cleanStoreName を index.html から移した＋nbMapAddress・nbMapUrl＝api=1&query=店名 住所［&query_place_id は「地図確認」の欄がある店だけ］、annotateMapLinks、--apply/--check）。index.html は NB-MAP-EMBED に置き換え済み・gmap は nbMapUrl を呼ぶ。gen-store-pages.js は nbMapUrl(s)（属性は escapeHtml）
## 次にやること
1. B2 の残り: policy に features.map（show:true・allowReviewBands: []＝確認済みだけ）／gateFor の「紐付けなしは止めない」を rating・trust だけにする（今は phone 以外すべて）／build.js で電話の直後に annotateMapLinks／states() に map を足す／tests/map_link.test.js（符号化 & # 空白 全角・place_id の有無・住所の優先順・index.html の埋め込みのずれ）／ジャーナルの生成器 2 本（generate_daily_draft.js:119・add_journal_store_cta.js:51）も nbMapUrl に／CLAUDE.md・ADR・計画書／npm test・audit_design_system・inline_js
2. B3+B2 を 1 本の PR にしてもよい（B3 は push 済み）。PR #604 の本番ビルド run 38731812421 の成功（バックグラウンド buc64gl0g が待っている）を確かめてからマージ
3. PR #604 の本番確認: audit_places_binding --states --check が 0、評価が消えた店（ホシノシタ J004633161 など）の店舗ページ・トップのカードで★と札なし、比べ用 とんかつ朱寿 J004558109 はあり、特集の★（sync_feature_scores --check が 0）、画面写し 390px と 1280px、audit_page_weight
4. B2 の本番確認: 実例 5 店で地図リンクが正しい店を開く（place_id つきと無し）
5. C1（MEO-006）: 予約・電話・地図を別々に毎日数える・地図ボタンの店名の欠け・「現在地」の押下（位置は送らない）
6. 最終報告に入れる: 297 店の電話停止・404 店の評価停止（正しい店も含む）・強制 push 1 回・30 店（P-473）・取得日 90 日超 3,880 店・ジャーナルの★ 5 件は書き換えない・会席の特集の訂正（前に「飛ばして今の掲載を残す」と書いたのは誤り）・PR #603 の本番停止の直し・急な減りの閾値は 10-29 以降

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
- placeId が無いのに評価が出ている店が 30 店ある（P-473 で扱う）。最終報告で触れる

## 関連ファイル
- docs/meo-plan-2026-10.md（計画書）・docs/decisions/0046-place-binding-states.md・scripts/lib/place_binding.js・data/place_binding_policy.json・data/places_binding_reviewed.json・scripts/audit_places_binding.js・scripts/lib/phone_link.js・build.js（1411〜1452 行 Places の反映、1547〜1562 行 電話、1600〜1630 行 口コミ信頼度）
- agent-backlog.md の MEO-001〜006 ／ Linear P-465〜P-470
