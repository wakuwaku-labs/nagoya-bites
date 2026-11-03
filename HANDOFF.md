status: done

# SEO トリアージ（定期実行・2026-11-04）

## 目的
未判定だった日次レポート 11-02 分の助言を、CLAUDE.md の Moat と Strategic Skip で判定する。週次は新着があれば同様に判定する。

## 完了条件
全項目が `data/seo_advice_log.json` に理由つきで残り、採用があれば `agent-backlog.md` と Linear にある。

## できていること
- 日次 11-02 の 3 項目を判定: 採用 0、却下 0、重複 3。週次 10-25〜10-31 は 11-03 に判定済みの再取得（重複 1 として記録）
- 採用が無いので Linear 同期は行っていない

## 次にやること
- なし（次の日次レポートは次回の定期実行で処理する）。題の比較は SEO-148（11-06）と #1066（11-13）

## 試したが駄目だったこと
- `--check-dup` は語が違うと同じ主旨でも false を返す。ログの過去の判定と実データで確かめて重複と判断した

## 守るルール・判断メモ
- 比較中の記事（さく蛸・リサール）の題は比較が済むまで変えない
- 絵文字つきの Gmail 検索は 11-03 に 0 件、11-04 に結果あり。0 件でも未着と決めない

## 関連ファイル
`data/seo_advice_log.json`、`agent-backlog.md`、`data/journal_title_experiment.json`、`data/search_ctr_rewrites.json`
