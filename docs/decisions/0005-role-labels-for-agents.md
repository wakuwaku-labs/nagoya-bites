# 0005 AI エージェントの役割は「担当:」ラベルで振り分ける

- 日付: 2026-10-06
- 状態: 採用
- 関連: `data/linear_issue_defaults.json` の `roleLabels` / `scripts/lib/linear_project_map.js` の `roleLabelsForOwner()` / ADR 0004

## 背景
オーナーから「担当のエージェントを振り分けられないか」と聞かれた。backlog の各課題には `owner`（Builder・Editor・DataKeeper 等の役割名）があるが、Linear の担当者はオーナー1人になっていた。Linear の担当者になれるのは Linear のユーザーだけ。架空のユーザーを役割ごとに作るには、役割の数だけメールアドレスと席が要る。外部のエージェントをつなぐ案は ADR 0004 で見送った。

## 決めたこと
1. 役割はラベルで表す: `担当:Orchestrator` / `担当:Inspector` / `担当:Builder` / `担当:Designer` / `担当:DataKeeper` / `担当:Marketer` / `担当:Strategist` / `担当:Editor`。
2. backlog の `owner` に現れた役割名を、現れた順にすべて付ける（例「DataKeeper / Builder」→ 2つ）。移行課題で backlog に無いものは説明文の「Notion担当部署」を使う。
3. `owner` に「片桐」「オーナー」を含む課題には `担当:オーナー作業` も付ける。オーナー本人の操作が要る課題を Linear で一目で絞り込めるようにするため。
4. Linear の担当者（assignee）はオーナーのまま（品質ルール2）。
5. 新規起票（`sync_backlog_to_linear.js`）と既存課題の補完（`assign_linear_projects.js`）が同じ判定器を使う。既に役割ラベルがある課題は上書きしない。

## 選ばなかった案と理由
- **役割ごとに Linear ユーザーを作る**: メールアドレスと席が役割の数だけ要り、ログインしない幽霊ユーザーが増える。
- **担当者欄を空にしてラベルだけにする**: 品質ルール2（担当者必須）と、期限・通知の宛先が無くなる。

## 見直す条件
- オーナー以外の人が Linear で作業を受け持つようになったら、その人を担当者にし、役割ラベルは補助に戻す。
