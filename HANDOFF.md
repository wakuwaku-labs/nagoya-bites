status: blocked

# MEO（Google マップ・ローカル検索）実装計画（2026-10-15〜）

（前のメモ「X 自動投稿」「2026-10-13 自律実行ラン」は status: archived。内容は git 履歴 2038657fa1 の HANDOFF.md）

## 目的
オーナーの依頼（2026-10-15）「MEO対策として、現状の数字や過去の調査をしっかりした上で、より向上するような実装計画をしてほしい。計画書ができたら見せて」。

## 完了条件
- 計画書 `docs/meo-plan-2026-10.md` に、現状の数字（取得日つき）・過去の調査・一次情報の根拠（URL）・施策・測り方・オーナーの判断事項がそろっている → 済
- オーナーが読める形（整形表示）で見せた
- 実装はオーナーの確認の後（この段階では始めない）

## できていること
- 計画書 `docs/meo-plan-2026-10.md`（段階1 M0〜M4／段階2 M5〜M7／段階3 M8・M9・判断 4 つ）
- backlog と Linear に段階1を起票: MEO-001=P-465（親）・MEO-002〜006=P-466〜P-470。status は blocked（Linear は Todo）＝自動ルーチンが拾わない。オーナーが判断1に「この範囲でよい」と答えたら ready にする
- 別件の不具合を起票: ISSUE-189=P-471（`sync_backlog_to_linear.js --apply` が Linear で完了・中止の 23 件を古い状態に戻す）

## 次にやること
- オーナーの答え（計画書 8 章の判断 1〜4。表示用ページ https://claude.ai/artifact/CzsAogSbKskKq4nb3QiUMc の「返事をつくる」から届く）を待つ → 判断1が OK なら MEO-001〜006 を ready にして段階1（M0→M1→M2→M3→M4）を実装
- 段階2・3 は判断 2〜4 の答えを受けてから起票

## 試したが駄目だったこと
- `orca linear save-issue` の作成時の `--parent-id` は効かなかった（作成後に `save-issue P-xxx --parent-id P-465` で付け直して確認済み）
- `node scripts/sync_backlog_to_linear.js --apply` は使っていない（ISSUE-189 の不具合で 23 件の状態を戻すため）。MEO の 6 件は scratchpad のスクリプトで同じ作り方で作り、`data/linear_sync_state.json` に記録した

## 守るルール・判断メモ
- 「MEO」の解釈: 当サイトは GBP に登録できない（規約）ので、「Google マップ・ローカル検索で店を探す人に選ぶ理由を届け、地図・電話・予約へ運ぶ」と広く取った（計画書 1 章・判断 1 で確認）
- 一番大きな発見: `build.js:1713-1721` がホットペッパーの店ごとの座標を全店エリアの中心点（39 通り）で上書きしている
- place_id の地図リンクは「電話確認」の店（4,237）だけ（紐付けの不一致 1,523 件があるため）
- 目標の数字は段階1の後に基線を 2 週取ってから置く（品質ゲート原則5）
- main への合流はオーナーの確認の後（計画書は作業ブランチ wakuwaku-labs/eelgrass にある）

## 関連ファイル
- docs/meo-plan-2026-10.md（計画書）
- agent-backlog.md の MEO-001〜006・ISSUE-189
- data/linear_sync_state.json（MEO-001〜006・ISSUE-189 の Linear の番号）
