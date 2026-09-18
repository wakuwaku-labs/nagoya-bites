# GA4 内部トラフィック除外の検証（2026-09-18新設）

## 背景

オーナーから「LINEで届く日次/週次レポートの生成AI流入に、自分の閲覧が混ざっているのでは」という
報告があった。調査の結果、以下の混入経路が実装上確認できた:

1. `scripts/lib/traffic_source.js` と `.gas-deploy/Code.js` の両方で `claude.ai` は
   「🤖 生成AI（ChatGPT等）」判定ドメインに含まれている（本来は ChatGPT/Perplexity/Gemini 等の
   AIアシスタントが紹介した正規の流入を捕捉するため）。
2. オーナーがこのプロジェクトの Claude セッション（chat.claude.ai / Claude Code）で貼られた
   `https://nagoya-bites.com/...` のリンクをそのままクリックして改修結果を確認すると、
   ブラウザの参照元が `https://claude.ai/...` になり、GA4 上は「生成AIに紹介されて来た訪問」と
   区別がつかない形で `claude.ai` 経由のセッションとして記録される。
3. これは実際にはオーナー自身の確認行動であり、外部ユーザーがAIに紹介されて訪れた実質的な流入
   ではない。しかし GA4 の `sessionSource` だけでは両者を判定できない
   （どちらも `source=claude.ai` になるため、ドメイン単位で機械的に除外すると本物のAI経由流入
   まで消えてしまう＝制約10違反）。

## 既存の対策コード（index.html）

`index.html` には既にオーナー除外の仕組みが入っている（`feat: 自分の閲覧を除外`、コミット
`9c42a11bf7`）:

```
https://nagoya-bites.com/?nb_owner=1  ← このパラメータ付きで一度アクセスすると
  → localStorage に nb_internal=1 が立つ（以後そのブラウザでは自動で効く）
  → gtag('config', 'G-3LCZNGZPWJ', {traffic_type: 'internal'}) が送られる
  → trackEvent() 経由のカスタムイベントも内部トラフィック時は送信自体をスキップする
```

これに合わせて、エージェント側の完了報告テンプレート（`agents/orchestrator.md` の
「作業完了レポート」、`.claude/commands/solve-next.md` の完了レポート）が生成する確認用URLにも
`?nb_owner=1` を付けるようにした。オーナーがチャット上の「デプロイ完了しました、ご確認ください」
リンクをそのままクリックしても、そのセッションは内部トラフィックとして印がつく。

## ⚠️ これだけでは効かない — GA4 管理画面側の設定が必須

`traffic_type: internal` はブラウザから送られるだけの「印」であり、**GA4 管理画面で
「内部トラフィックの定義（データフィルタ）」が「有効」になっていない限り、レポートからは
一切除外されない**。`.gas-deploy/Code.js` の `HOST_FILTER` は `hostName` でしか絞り込んでおらず、
`traffic_type` をクエリ側で明示的に除外していない（GA4 Data API は内部トラフィックを
ディメンションとしてクエリできる仕組みではなく、管理画面のデータフィルタが Active の場合のみ
データ取り込み時点で除外される設計のため）。

このデータフィルタが未設定・または「テスト」モードのままだと、`?nb_owner=1` を付けたアクセスも
普通に生成AI流入・直帰率などの集計に混ざり続ける。**この確認と有効化はオーナー本人の
Google アカウント操作が必要で、コード側からは検証できない。**

### 確認手順（オーナー本人が実施）

1. https://analytics.google.com を開き、対象プロパティ（NAGOYA BITES）を選択
2. 管理（歯車アイコン）→ プロパティ列 →「データ設定」→「データフィルタ」を開く
3. 「内部トラフィック」という名前のフィルタが存在するか確認する
   - 存在しない場合:「作成」→ フィルタタイプ「内部トラフィック」を選択して作成する
     （IPアドレスのルールは空でよい。本サイトは IP ではなく `?nb_owner=1` 経由で
     `traffic_type=internal` を直接送っているため、IPルールが未設定でもこのフィルタ自体があれば
     `traffic_type=internal` の付いたイベントは対象になる）
4. フィルタの状態が「テスト」になっている場合は「有効」に切り替える
   - 「テスト」のままだとレポートには通常どおり表示され、除外は行われない
5. 検証: `https://nagoya-bites.com/?nb_owner=1` にアクセスした後、GA4 の
   「レポート」→「リアルタイム」で自分のアクセスが表示されないこと（または
   DebugView で `traffic_type=internal` が付いていること）を確認する
   - 反映まで最大24〜48時間かかることがある

### 有効化した後の期待効果

- LINE/メールで届く日次・週次レポートの「🤖 生成AI（ChャットGPT等）」「訪問者数」等から、
  オーナー自身の確認クリック・改修後の目視確認が除外され、外部ユーザーの実質的な流入のみが
  残るようになる。
- `data/search_channel_metrics.json`（`scripts/search_channel_metrics.js`）も同じ
  `traffic_source.js` 判定を使っているため、同様に恩恵を受ける（ただしこちらは GA4 の
  生データではなく別経路の集計であれば別途確認要）。

## 手動で追随が必要な箇所（自己改変ブロックのため）

`.claude/commands/*.md` はエージェントによる自己改変がブロックされているため、以下は
オーナー本人が手動で1行だけ直す必要がある（内容は既に `agents/orchestrator.md` に適用済みの
変更と同じ）:

- `.claude/commands/solve-next.md`:145
  `- URL: https://nagoya-bites.com/` → `- URL: https://nagoya-bites.com/?nb_owner=1`
- `.claude/commands/journal-today.md`:277
  `✅ ジャーナル公開完了: https://nagoya-bites.com/journal/YYYY-MM-DD-slug.html`
  → 末尾に `?nb_owner=1` を追加（このURLはSNS投稿用ではなく確認用。SNS投稿本文は
  `docs/daily-posts/*.md` 側の別URLを使うため、そちらは変更不要）
