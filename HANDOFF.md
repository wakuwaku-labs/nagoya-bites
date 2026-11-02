status: done

# SEO トリアージ（定期実行・2026-11-03 01:05 JST）

## 目的
日次レポート 10-31 分と週次レポート 10-25〜10-31 の助言を、CLAUDE.md の Moat と Strategic Skip で判定し、採用分を課題にする。

## 完了条件
全項目が `data/seo_advice_log.json` に理由つきで残り、採用分が `agent-backlog.md` と Linear にある。

## できていること
- 7 項目を判定した: 採用 1（課題 2 本: SEO-150＝P-779、SEO-151＝P-780・P-779 の子）、却下 3、重複 3
- 判明: 記事の主役でも、写真の照合で落ちると店舗データから外れる（非表示 31 店・記事 14 本・直近 28 日の検索クリックの 9.2% 以上）。過去のログの「さく蛸は stores/ にページがある」は誤りで、今回のログで訂正した

## 次にやること
- SEO-150 → SEO-151 は `/solve-next` の別ゲートで着手する（このループでは実装しない）
- 同期の不具合 2 件は別タスクとして提案済み（下記）

## 試したが駄目だったこと
- `sync_backlog_to_linear.js --apply` は `mark-duplicate` の P-28（Linear でアーカイブ済み）で止まる。作成と更新はその前に終わるので今回の課題は反映済み。残りの 5 件はそのまま

## 守るルール・判断メモ
- `[ISSUE-192]` が backlog に 2 つあり（会席 done／Places 規約 ready）、どちらも P-474 に対応する。`--apply` すると題と状態を上書きするので `--skip P-474` で外した。P-474 は Linear で Todo のまま（会席は完了済み）
- 起票先はこの定期タスクの指示どおり Linear にした（このリポジトリに `.ondine.json` は無い）
- 写真の無い店を出さないオーナー判断（2026-09-02）と照合の基準は変えない

## 関連ファイル
`agent-backlog.md`、`data/seo_advice_log.json`、`data/linear_sync_state.json`、`scripts/merge_pending_stores.js`、`scripts/fetch_manual_store_photos.js`
