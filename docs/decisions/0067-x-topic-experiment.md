# 0067 X の文面に「題材の実験」を効かせる（URL の実験の後・11-22 から）

- 日付: 2026-11-16
- 状態: 採用（0059 の3の延長。SNS分析ツール docs/design/x-note-growth-cycle-plan.md の NB 実験。Ondine #2025）
- 関連: 0058（URL の実験・〜2026-11-21）/ 0059（型の割り当て）/ data/x_post_policy.json の `topicExperiment` / scripts/write_x_draft.js（`loadTopicExperiment`）/ scripts/post_journal_to_x.js

## 背景
- 分析側が iCloud の next.json の `candidates[]` に、題材と書き方の組（`experiment_id` 付き）を出す。台帳の `experiment` を「その投稿の実験の印」として読み、`experiment_id` と完全一致で数える。今は URL の実験が `experiment` を使っている。

## 決めたこと
1. 2026-11-22（URL の実験の翌日）から自動で有効（`topicExperiment.since`）。戻すのは `enabled` を false にする1行。next.json が無い・古い（8日超）ときは今までどおり。
2. 使う候補は、`experiment_id` が文字列・`skip` に無い・`format.media` が none か無いもの。投稿時刻の実験（x-nb-evening-post-time）は投稿時刻が 11:30 固定のため `skip`。
3. 題材: 記事の題名が候補の題材に当たるとき（特定の題材）は上限なしで使う。`anyTopics`（名古屋ジャーナルの紹介。どの記事にも当たる）は、同じ週（JST 月〜日）の保存済みの文面で実験を守れた物が `weeklyTarget`（3）本に届くまで。
4. 文面づくりの指示に「今日の題材の実験」を足す（返信なし・1行目の書き方）。守れなかったら1回書き直させ、最後の回は通った案を `followed:false` で残す。型の割り当て（0059）と1行目が食い違うときは、実験を優先して型の割り当ては使わない。
5. 台帳: 保存した文面を使い、`followed` が false でない日だけ `topic_experiment` を残す。URL の実験がある日は `experiment`（URL の実験の id）を上書きしない。無い日は `experiment` に実験の id を入れる。定型に落ちた日は付けない。

## 見直し
- 実験の結果は分析側が読む。週3本の上限と since は policy の値で変える。
