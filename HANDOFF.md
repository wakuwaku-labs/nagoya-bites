status: in_progress

# 11/20 のジャーナル・X・note が出なかった件の後始末と再発防止（Ondine #2337・#2338・2026-11-21）

## 目的
本人「11/20の記事が表示されてない」「Xとnoteもない」。11/21 以降の記事・X・note が毎日きちんと出る状態に戻す。

## 完了条件
- 11/21 の記事が https://nagoya-bites.com/ の「ジャーナル」欄の先頭に出る。X と note にも 11/21 の投稿がある（#2337）
- ローカルの main に未 push のコミットが溜まっても、日次ジャーナルが止まらない（#2338）

## できていること
- 原因: ~/nagoya-bites の main に、origin に無いコミットが4つ残っていた（fix/top-journal-latest のローカル合流 850b31087f・#2146 の修正 d010694362 ほか）。そのため 11/20 09:00 の取り込みが衝突して HOLD になり、記事・X・note がすべて出なかった
- 2026-11-21 02:20: 元のコミットを backup/main-2026-11-20（ローカル）に退避し、main を origin/main に合わせた。HOLD-2026-11-20.md は .resolved.md に改名した
- #2146 の修正（data/manual_stores.json の「カテゴリE」）は PR #784 で出し直し、合流済み
- #2338 完了（PR #785・7b6049831f・判断 0081）: run_journal_local.sh は取り込み前に origin に無いよそのコミットを backup/main-<日時> へ退避して main を origin/main に合わせ、HOLD にせず続行。退避は journal-watchdog.yml のトラック3が Issue に。自分の写しから実行する作りも追加。~/nagoya-bites の main も早送り済み
- これより前の同じ会話: トップの「ジャーナル」欄（#777）と、記事一覧の写真（#779）は本番に反映して確認済み

## 次にやること
1. 11/21 13:00 JST に #2337 が relay される（予約済み・この会話では触らない）。ジャーナル欄・X（x-post.yml）・note（~/nagoya-bites/.local-logs/journal-2026-11-21.log の post_note）を確かめ、report して done にする
2. 11/20 の記事は作らない（実行の仕組みに日付の指定が無い。空いた日を後から埋めない）

## 試したが駄目だったこと
- run_journal_local.sh に日付の指定は無い（TODAY_JST が固定）。過去の日の記事は作れない

## 守るルール・判断メモ
- force push・reset は使わない。main を戻すときは backup ブランチを作ってから `git checkout -B main origin/main` で行う（記憶 journal-main-checkout-diverged-by-design-session）
- この worktree（bluegill）は別の会話（bluegill-35・#2224）も使っている。自分の変更は origin/main から切った別の worktree で出す

## 関連ファイル
- ~/nagoya-bites/.local-logs/HOLD-2026-11-20.resolved.md・journal-2026-11-20.log
- scripts/run_journal_local.sh（取り込みと HOLD の処理）
- 判断 docs/decisions/0079-top-journal-section-shows-latest.md
