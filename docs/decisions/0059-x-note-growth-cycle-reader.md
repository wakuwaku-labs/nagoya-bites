# 0059 分析の割り当てを X の文面と note に効かせる・note の数字を読む（Nagoya Bites 側）

- 日付: 2026-11-08
- 状態: 採用（本人の決定 2026-11-08: 決定2「今から両アカウントとも・探索は5割→3割→下限2割」、決定3「1日1回、既存のログインで自分の記事の数字を読むだけ」）
- 関連: SNS分析ツール docs/design/x-note-growth-cycle-plan.md（NB-1〜NB-3・④）/ 0058（URL の実験）/ data/x_post_policy.json の `planExperiment` / scripts/write_x_draft.js / scripts/lib/sns_analyzer.js / scripts/fetch_note_stats.js / scripts/build_note_draft.js

## 背景
- 分析（SNS分析ツール）の結果は、これまで X の文面にも note にも効いていなかった。型は「記事にいちばん合うものを Claude が選ぶ」だけだった。
- 計画書の当初案は NB の割り当てを URL の実験（〜11-21）の後（11-22）にオンにするものだったが、本人の決定2で「今から」に変わった。分析側が、型の各値を URL あり・なしの日の両方に配り、URL の比較を同じ型の中で行う。
- note の数字は取っていなかった。公式の窓口は無く、管理画面の統計の取得は規約上グレー（計画書 4-1）。

## 決めたこと
1. 文面づくり（Mac 側 write_x_draft.js）は iCloud の nagoya_bites/next.json の `plan`（schema x-next/1）を読み、今日（JST の曜日・月=0）の枠の型 `nb_kind`・1行目 `first_line`・長さ `length` を Claude への指示の後ろに「今日の指定」として足す。使う条件: ファイルが有る・壊れていない・generated_at が8日以内・schema 一致・`plan.week` が記事の日の週。満たさなければ指定なし（今までどおり）。`planExperiment.enabled=false` なら指示も保存した文面も今までと同一。
2. 長さの帯（本文、全角）: short=50字まで／mid=51〜80字／long=81〜110字（110字は既存の上限）。1行目: question=問いかけ／number=記事の数字を置く／assertion=記事の事実の言い切り。型の指定と違う型で書かれたら1回だけ書き直させ、最後の回は通った案を使う。指定は決まりより弱い（数字の出典・言い方・長さの検査は一切弱めない）。
3. 使った枠は保存した文面（data/x_post_drafts/<date>.json の `plan`）に残り、投稿が保存した文面を使ったときだけ台帳に `plan_cell`・`plan_experiment`・`plan_followed`（指定の型で書けたか。型の指定が無い枠では付かない）が付く。URL の実験の `experiment`・`url_variant` とは別のキーで、独立に動く。
4. note の数字（scripts/fetch_note_stats.js）: 専用プロファイルのログインで、自分のアカウントの統計 `/api/v1/stats/pv`（最大5ページ）とプロフィール `/api/v2/creators/<urlname>`（フォロワー数）を読むだけ。1回の実行で最大6リクエスト。保存先は iCloud の note_metrics.json（note-metrics/1、公開リポジトリには置かない）。同じ日の再実行は行を置き換える。台帳（data/note_post_log.json）にある公開済みの記事だけを保存する。401/403・形の違い・空・未ログイン・別アカウントはその日は何も保存せず、再ログインを試さず、終了コード1を返す（run_journal_local.sh が Mac の通知を出す。理由は保存先の `last_run` にも残る）。取れない項目（フォロワー数など）は null と理由。Claude Code の中では本物の通信をしない（--dry-run と偽の応答の試験だけ）。
5. note-next.json の `try`: `sections`（1〜4の整数）は抜粋する節の数、`title_style` は `full`（今まで）か `short`（最初の「、」「｜」より前。12字未満になるなら今まで）。範囲外・知らない値は今までどおり。
6. iCloud が launchd から読めない実測（2026-11-08）があるため、置き場は環境変数 SNS_ANALYZER_X_DIR で変えられ、無ければ iCloud → ~/.config/sns-analyzer-x/nagoya_bites の順に探す。

## 戻し方
- 割り当て: `planExperiment.enabled` を `false` に戻す1行。note の数字: run_journal_local.sh の末尾の1ブロックを消す。note-next: iCloud の note-next.json を消すか `try` を null にする。台帳に足したキーは残しても既存の読み手は無視する。

## 選ばなかった案と理由
- 11-22 までオンにしない（計画書の当初案）: 本人の決定2で「今から」に変わった。URL の比較は分析側が型の中で層に分ける。
- 型の指定に従えない日は文面を作らない: 事実を曲げる／定型に落ちるので、書き直しは1回、最後の回は使って `plan_followed=false` を残す。
- 統計の取得に Cookie の直接利用や HTTP クライアントを使う: 既存の専用プロファイルのログインの外に認証情報が広がる。

## 見直す条件
- note の統計エンドポイントの形が変わった（`shape` で止まった）とき。実際の応答の形は本物の1回目まで未確認（偽の応答でしか試験していない）。
- 規約や note 側の制限（403 が続く）で止められたとき。
