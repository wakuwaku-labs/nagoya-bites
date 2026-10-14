# 0041 ローカル実行の Places 消費は別ファイルに積み、月の判定は「CI 分＋ローカル分」で行う

- 日付: 2026-10-15
- 状態: 採用
- 関連: Linear P-436 / `scripts/lib/places_usage_local.js` / `scripts/lib/journal_photos.js` / `scripts/fetch_manual_store_photos.js` / `scripts/run_journal_local.sh` / `.github/workflows/photo-watchdog.yml`

## 背景
- 2026-10-14 の日次ジャーナルが本文写真のために Places を使い、`data/photo_pipeline_health.json` の月の回数を書き換えた。このファイルは build.yml が毎日書き換えるが、ラッパーのコミット対象には無く、残すと作業ツリーが汚れ、翌朝の取り込みで衝突するおそれがある。
- そのときは生成したセッションが変更を戻したため、ローカルで使った回数が月の集計に入らず、無料枠の見張りが少なめに数えた。

## 決めたこと
1. ローカル実行（日次ジャーナル）の Places 消費は `data/photo_pipeline_health_local.json` に積む。書き手はジャーナルの実行（`flushSkuUsage`）だけで、CI は読むだけ。
2. 月の上限の判定（店舗写真の取得 `readSpentMonth`・本文写真の `readLedger`）は「`photo_pipeline_health.json` の places ＋ローカル分」を足して行う。月が替われば両方とも数え直す。
3. ラッパーは `TRACKED_UPDATES` と `push_health`（失敗・HOLD の日）の両方でこのファイルをコミットする。前回の失敗実行の分が残っていても退避せず、次のコミットに同乗させる（消すと回数が欠ける）。
4. 移行前の旧形式（`photo_pipeline_health.json` の `journal_photos`）は、本文写真の取り分の計算にだけ足して読む（書かない）。

## 選ばなかった案と理由
- ラッパーが `photo_pipeline_health.json` 自体をコミットする案: CI（build.yml）と同じファイルを 2 か所が書くことになり、pull で毎日衝突しうる。書き手を分ける方が衝突しない。

## 見直す条件
- ローカルの Places 利用が無くなったとき（ファイルごと不要）。
- photo-watchdog が月の消費を警報に使うようになったとき（現状は鮮度と状態だけを見ており、読み手の追加は不要）。
