status: done

# SEO トリアージ（定期実行・2026-11-03 01:05 JST）

## 目的
日次レポート 10-31 分と週次レポート 10-25〜10-31 の助言を、CLAUDE.md の Moat と Strategic Skip で判定し、採用分を課題にする。

## 完了条件
全項目が `data/seo_advice_log.json` に理由つきで残り、採用分が `agent-backlog.md` と Linear にある。

## できていること
- 7 項目を判定した: 採用 1（課題 2 本: SEO-150＝P-779、SEO-151＝P-780・P-779 の子）、却下 3、重複 3
- 定期実行が動かず判定されていなかった日次レポート 10-23・10-25・10-28 の 9 項目も判定した。すべて重複で、新しい採用なし
- 判明: 記事の主役でも、写真の照合で落ちると店舗データから外れる（非表示 31 店・記事 14 本・直近 28 日の検索クリックの 9.2% 以上）。過去のログの「さく蛸は stores/ にページがある」は誤りで、今回のログで訂正した
- 同期の不具合 2 件を直した: アーカイブ済みの課題で `--apply` が止まらない（`duplicateNeedsSync`）／同じ番号だった Places の課題を `[ISSUE-194]`（P-781）に振り直し、P-474 は会席の題で Done になった

## 次にやること
- SEO-150 → SEO-151 は `/solve-next` の別ゲートで着手する（このループでは実装しない）
- 日次の判定が止まっても誰にも届かない問題は SEO-152 に起票した

## 試したが駄目だったこと
- なし（`--apply` は `--skip` なしで最後まで通る。同期後の差分は 0 件）

## 守るルール・判断メモ
- 起票先はこの定期タスクの指示どおり Linear にした（このリポジトリに `.ondine.json` は無い）
- 写真の無い店を出さないオーナー判断（2026-09-02）と照合の基準は変えない
- 突き合わせた範囲: Gmail で見つかった日次レポート 26 通（件名 10-02〜10-31）。判定ログと件数が合い、未判定は残っていない。件名 10-11・10-19 は Gmail で見つからず未確認（10-12・10-13 も見つからないが、この 2 日分はログに判定がある）

## 関連ファイル
`agent-backlog.md`、`data/seo_advice_log.json`、`data/linear_sync_state.json`、`scripts/merge_pending_stores.js`、`scripts/fetch_manual_store_photos.js`、`scripts/sync_backlog_to_linear.js`、`docs/decisions/0051-places-api-caching-compliance.md`
