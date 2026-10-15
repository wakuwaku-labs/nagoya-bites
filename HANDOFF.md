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
- PR #602（電話の関門）・#603（写真の持ち主をホットペッパーIDでも照らす・本番停止の直し）・#604（評価・口コミ信頼度の関門）・#605（B3 スイッチと夜間 QA＋B2 地図リンクを公式の形に）をマージ済み・すべて本番で確かめた
- 電話: 止めた店 297（後に A2 の keep で 278）。実例 5 店（ホシノシタ J004633161・bindi J001291877・BAR EVE J004634436・CCC J004403718・木村屋 錦 J001278470）は電話ボタンなし、朱寿 J004558109 はあり
- 評価: 消した店 404・口コミ信頼度を付けない店 417・特集の★を外した 20 件
- B2 の本番確認（run 38734163945 成功の後）: 地図リンクに place_id を付けた店 3,205（要確認 1,291・不一致 133 は検索の形）。実例 5 店の店舗ページは検索の形、朱寿は query_place_id つき。本番のデータで設定が許していない状態の店は電話 0・評価 0・信頼度 0・地図 0（紐付けの無い店の評価 30 は P-473）
- 起票: ISSUE-191＝P-473、ISSUE-192＝P-474。P-467・P-468 Done
- C1（MEO-006）作業中・ブランチ wakuwaku-labs/meo-c1-metrics（origin/main 4f80abd029 から・未コミット）:
  - scripts/lib/map_link.js に nbMapLinkKind（place_id／search）。index.html の地図ボタン 6 か所に store_id（nbStoreKey）と link_kind。店舗ページ（本文・行動バー）は mapClickAttr で store_id（スラグ）・store_name・location・link_kind。ジャーナルの生成器 2 本も link_kind・store_id
  - index.html の geoSearch に nbGeoTrack（geo_search {result}: granted・denied・unsupported・error）。位置・エリア名は送らない
  - 新しい scripts/lib/store_actions.js（地図・call_lookup・geo_search の集計と fetchStoreActions。未登録のディメンションは getMetadata で確かめて問い合わせない・null と missingDimensions）。fetch_ga4_views.js が store_referrals.json に actions・map・callLookup・geoSearch を書く
  - 新しい scripts/check_metrics_freshness.js と夜間 QA の soft metrics-freshness
  - docs/kpi-weekly.md の表・docs/reservation-measurement.md の節・CLAUDE.md の行
  - テスト: tests/store_actions.test.js（8 件）・行動バーとカードのテストを更新。e2e docs/qa/meo-2026-10/e2e_geo_search.js は 3 場面とも通過（許可のとき URL は #q=名古屋駅 になる＝既存の動き）
  - npm test は直す前に 10 件失敗（カードのテストに nbStoreKey が無かった）→ 直した。全体の再実行がまだ

## 次にやること
1. C1: npm test 全体・design・inline js → コミット → PR → マージ（ビルド中でないことを確かめる）→ 本番で店舗ページの onclick に store_id・link_kind、トップに geo_search があるか
2. P-469（MEO-005）に B3・B2 の本番確認をコメント（項目 5 の閾値は 10-29 以降なので Done にしない）。P-470（MEO-006）に C1 の結果をコメント。backlog の MEO-006 を更新
3. オーナーに頼むこと: GA4 にカスタムディメンション location・link_kind・result（イベントスコープ）を登録（内訳はその日から・非遡及）
4. 最終報告に入れる: 297→278 店の電話停止・404 店の評価停止・417 店の信頼度停止（正しい店も含む）・強制 push 1 回・30 店（P-473）・取得日 90 日超 3,880 店・ジャーナルの★ 5 件は書き換えない・会席の特集の訂正（9 店で組む）・PR #603 の本番停止の直し・急な減りの閾値は 10-29 以降・公開済みのジャーナルの地図リンクは古い形のまま・cleanArea のコメントの例が実際と違う（直していない）・「現在地」で URL に #q=エリア名が書かれる（GA4 の自動の page_view が送るかは未確認）

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
