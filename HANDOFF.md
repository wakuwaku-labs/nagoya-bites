status: in_progress

# 店のデータの正しさ・検索流入・送客の計画（旧 MEO 計画）の実装（2026-10-15〜）

（前のメモ「X 自動投稿」「2026-10-13 自律実行ラン」は status: archived。内容は git 履歴 2038657fa1 の HANDOFF.md）

## 目的
- 計画書 `docs/meo-plan-2026-10.md`（改訂版）をオーナーが承認した（2026-10-15「計画（改訂版）の返事: 1=A / 2=A（先に止める） / 3=A（標本で 1 割以上が別の店だった帯は、確かめが済むまで出さない）」）。計画 9 章の順で実装する
- 順番: B1 の電話の部分（先に止める）→ A1 状態を数える → A2 帯ごとの標本 150 組 → B1 の評価・口コミ信頼度（判断 3）→ B3 スイッチと夜間 QA → B2 地図リンク → C1 計測。A3 は並行

## 完了条件
- 電話: 不一致と一致率 0.3 未満の帯の店に電話ボタンが出ない（本番で実例 5 店を確かめる）。店数・店舗ページ数は変わらない
- A1・A2: 状態ごとの数のコマンド、帯ごとの標本 150 組の記録（根拠つき）、判断 3 の表
- 評価: 判断 3 の基準で帯ごとに出す・出さない。B3・B2・C1 は計画書の確かめ方どおり
- 各段階は PR で 1 本ずつ入れ、ビルドの後に本番で確かめる

## できていること
- 判定を 1 つにまとめた: `scripts/lib/place_binding.js`（状態 confirmed/review/mismatch/none・帯・人の記録 keep/reject）と `data/place_binding_policy.json`（機能ごとの show と許す帯。phone は sim-0・sim-lt-0.3 を許さない）
- `scripts/lib/phone_link.js` に関門を足した（住所か店名で出せても、状態で止める。理由 binding-mismatch・binding-review・switched-off）。`audit_phone_links.js`・`build.js` のログも同じ判定。テスト `tests/place_binding.test.js`（9 件）。phone・binding・audit のテスト 31 件が通る
- 今のデータで電話ボタンが消えるのは 297 店（不一致 32・要確認の低い帯 265）。無作為 28 店を見ると、別の店とみられるのは約 6 店。残りは店名の表記の違い（咲夜島 さくやじま→咲夜島、バーガンディ→Burgundy）。オーナーの判断 2 の説明は「正しい店もある。それでも消える損の方が小さい」で承認済み。A2 で正しい店を戻す（人の記録 keep か、帯を細かく分ける）
- A3（MEO-002）: 別の作業者が `docs/seo-traffic-inventory-2026-10.md` を書いた（ブランチ worktree-agent-a53393ea55498da15・コミット 2b146b8e53）。まだ取り込んでいない。SEO-116 へのコメントもまだ

## 次にやること
- 電話の変更をコミット → 判断の記録 0046（オーナーの判断 1〜3）を書く → backlog と Linear の状態を進める（MEO-001 判断済み・MEO-004 進行中・MEO-003/002/006 を ready）
- A3 の文書を cherry-pick → npm test・監査 → PR → マージ（ビルドが終わるまで次をマージしない）→ 本番で実例 5 店（ホシノシタ・bindi・BAR EVE・CCC・木村屋 錦）の電話ボタンが消えたことを確かめる
- SEO-116（Linear）に棚卸しの要点をコメント
- A1 の `--states`（audit_places_binding.js）→ A2 の標本

## 試したが駄目だったこと
- `orca linear save-issue` の作成時の `--parent-id` は効かない（作成後に付け直す）。書き込みは linear_write_unconfirmed でも反映されていることが多い。必ず読み戻す
- `node scripts/sync_backlog_to_linear.js --apply` は使わない（ISSUE-189＝P-471）
- python3 の標準入力に日本語の長い行を渡すと SyntaxError。スクリプトはファイルに書き、`# -*- coding: utf-8 -*-` を付ける
- zsh で `echo =====` はエラー（= で始まる語）。区切りは `echo "-----"`

## 守るルール・判断メモ
- 判断の記録 0037（近い順は外した）は守る。位置の使いやすさは保留（計画書 8.5 節）
- 判断 3=A: 標本で 30 組のうち 3 組以上（1 割以上）が別の店だった帯は、評価・口コミ信頼度を確かめが済むまで出さない
- 不一致・要確認の店で、ボタンは無効にせず要素ごと出さない（読み上げ）
- 新しい ADR 番号は 0046（origin/main の最新は 0045。マージ前にもう一度確かめる）

## 関連ファイル
- docs/meo-plan-2026-10.md（計画書）・scripts/lib/place_binding.js・data/place_binding_policy.json・scripts/lib/phone_link.js・scripts/audit_phone_links.js・build.js（電話の判定の箇所）・tests/place_binding.test.js
- agent-backlog.md の MEO-001〜006・ISSUE-189・ISSUE-190 ／ data/linear_sync_state.json
- 中間データ: scratchpad の identity/・measure/・impact_phone.js
