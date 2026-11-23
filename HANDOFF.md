status: in_progress

# 引き継ぎ（2026-11-23 夕）

## 目的
本人の依頼: ①「毎日LINEで送られてきている数字は合っている？急に増えたので」 ②「ジャーナルの件をすすめて」 ③（Ondine の返事）「2日分出して」＝欠番の 11/20・11/22 のジャーナル記事を後から公開する。

## 完了条件
- journal/2026-11-20-*.html と journal/2026-11-22-*.html が本番 https://nagoya-bites.com/journal/ で 200 を返し、`node scripts/check_journal_health.js --days 7` が欠番 0。GitHub Issue #782 が閉じる。
- main の build.yml が成功のまま。

## できていること
- ① 済: 海外（シンガポール・中国）からの直接アクセスを LINE の日次・週次の全数字から常に除く（PR #801・GAS へ clasp で反映・取り直して main と一致を確認）。明朝の確認は Ondine #2579（2026-11-24 09:30 に relay 予約済み）。site_metrics.json 側は Ondine #2580。#1901 は done。
- ② 済: 11/22 欠番の原因＝scripts/lib/journal_git_sync.sh の空配列展開（bash 3.2 + set -u）。11/23 のビルド停止＝月曜の台帳作り直しが古い記事一覧で上書き。両方 PR #802 で修正・main 合流・ビルド成功（2c898c80f8）。~/nagoya-bites の main も pull 済み。11/20 は別会話の未 push コミットとの衝突（#785 で対策済み）。

## 次にやること（③）
1. 本人の承認済み（Ondine の返事「2日分出して」）。X・note にも自動で出る前提で進めてよい。
2. 11/20・11/22 の記事を `/journal-today` を対象日を指定して1日ずつ作る（ラッパー run_journal_local.sh は今日の日付固定なので使えない）。手順はメモリ journal-today-manual-run-checklist（register → column used → build_journal_index → normalize_og --only → refresh_related → pull --rebase → push）。作業場所は ~/nagoya-bites の main（ビルド中に次をマージしない）。
3. 題材は当日以前の出来事・出典の日付が対象日以前のものに限る（後出しで未来の情報を混ぜない）。記事の日付・published.json の日付は対象日。
4. X・note の投稿: 公開後に `node scripts/post_note.js --date <対象日>`・X は x-post.yml の動き（journal_published.json の push で動く）を確認。過去日付で自動投稿が動かない場合は理由を書いて本人へ（無理に投稿しない）。
5. 公開後に `gh workflow run journal-watchdog.yml` で #782 を閉じ、本番 URL の 200 を確かめる。

## 試したが駄目だったこと
- なし

## 守るルール・判断メモ
- 記事は CLAUDE.md の写真・実在検証・表現の決まり（業界人表現禁止）を守る。基準に届かない日は出さない（0069 決定6）→ 届かなければ本人に理由を報告。
- 対話シェルから claude を呼ぶときは env -i（メモリ journal-manual-run-needs-clean-env）。

## 関連ファイル
- docs/decisions/0066-gas-report-direct-spike-exclusion.md（11-23 追記）
- scripts/lib/journal_git_sync.sh・.github/workflows/build.yml（#802）
- ~/nagoya-bites/.local-logs/journal-2026-11-2{0,2}.log
