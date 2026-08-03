# 消費者フィードバック triage runbook

> このファイルが運用の**正本**。`.claude/commands/*.md` はエージェント自己改変ブロックで
> 新規作成・編集ができないため、`/feedback-triage` のようなスラッシュコマンド化はできない
> （試みても拒否される想定）。任意で体験を良くしたい場合は、この runbook の内容をユーザーが
> 手動で `.claude/commands/feedback-triage.md` にコピーしてください（機能上の違いは生まない）。
>
> 判定ポリシーの単一の情報源は `data/feedback_policy.json`。運用ルールを変えたい場合は
> このファイルではなく `data/feedback_policy.json` を編集する（journal_gate_policy.json と同じ規約）。

サイト利用者から index.html のフローティング「ご意見」ボタン経由で届く声を、**鵜呑みにせず**
NAGOYA BITES のブランド総合フィルター（Moat / Strategic Skip）に通し、適合分だけを
`agent-backlog.md` に `ready` で起票 → Notion 課題トラッカーへ同期する。却下は理由とともにログへ残す。
既存の `/seo-triage` と同じ思想・同じ部品（`scripts/lib/backlog_ids.js` / `sync_backlog_to_notion.js`）を流用している。

**使い方（手動）**: メール本文や利用者からの生の指摘テキストをこの runbook の手順に沿って渡す。

**使い方（自動・スケジュール起動）**: 引数が空のときは Step 0 で Gmail から Formspree 通知メールを
自動取得し、以降を**全自動**で処理する（人の貼り付け不要）。判定・起票・Notion同期の原理は手動時と完全に同一。

---

## 前提（このループの記憶）

- 採用課題マスター: `agent-backlog.md`（ID 接頭辞 `FB-` / owner=Builder or DataKeeper / category=UX or データ）
- ループの記憶（採用・fact_check・却下・重複・エスカレーションの全履歴）: `data/feedback_log.json`（append-only）
- 判定ポリシー: `data/feedback_policy.json`（3分類ルール・Gmailクエリ・PII規則・起票上限。毎回読む）
- 決定的ヘルパー: `node scripts/feedback_triage.js`（ID採番 / 重複検知 / PIIマスク付きログ追記 / 健診レポート）
- Notion 同期: 既存の `/sync-backlog`（スキーマ変更不要・そのまま流用。`ID_PREFIX_TO_OWNER` に `FB` 登録済み）
- 収集元: index.html のフローティング「ご意見」ボタン → Formspree（`https://formspree.io/f/xaqaygze`、
  `_subject: '[site-feedback] <種類>'`）→ 通知メールが Gmail（wakato1251999@gmail.com）に届く

---

## 実行フロー（必ずこの順番）

### Step 0: 入力の取得（引数が空＝自動運用のときのみ）

引数にフィードバック本文があればそれを使い、この Step をスキップして Step 1 へ。
**引数が空のとき**は Gmail MCP で Formspree 通知メールを取得する:
1. `node scripts/feedback_triage.js --policy` で `gmail_query` を取得し、そのクエリで Gmail を検索。
   既定は `subject:"[site-feedback]" newer_than:2d`。件名が `_subject` と一致しない場合は
   `gmail_query_fallback`（`from:formspree.io` + 本文検索）を試す。
2. 各メールの本文から category / store（あれば）/ body / page（あれば）と **Gmail メッセージID** を抽出する。
3. 該当メールが**0件のときは「新着フィードバックなし」として Step 8 に進まず正常終了**（エラー扱いにしない。
   毎日0件が普通の状態）。
4. 取得できたら1メール=1フィードバックとして通常フローへ。

### Step 1: ブランドフィルターの根拠をロード

`CLAUDE.md` の以下を**毎回読む**（規約が更新されたら判定も自動追従する）:
- 「**我々の Moat**」「**我々が勝つ領域**」 → UX要望の採用の方向
- 「**戦わない領域 — Strategic Skip**」＋「絶対に守る制約」7・8・10（信頼毀損禁止 / マネタイズ承認制 /
  品質ゲートは検証可能な事実のみ） → 却下・慎重対応の方向
- 「架空店ブロック」節 → 店舗事実の指摘を扱う際の実在検証の考え方

加えて `node scripts/feedback_triage.js --policy` を読み、3分類ごとの owner/category/優先度の既定値を確認する。

### Step 2: フィードバックを分解

1件のフィードバックに複数の論点が混ざっていれば施策単位に分割する。

### Step 3: 重複チェック（二重処理防止）

各項目について:
```bash
node scripts/feedback_triage.js --check-dup "<本文>" --msg-id "<Gmailメッセージid>"
```
- `same_message: true` → **同一メールの再処理**。ログ追記も不要で完全スキップ（同じメールを
  何度処理しても安全＝冪等）。
- `same_message: false` かつ `duplicate: true` → 別メールだが同内容。起票せず
  `verdict: "duplicate"` で軽量追記のみ。
- どちらも false → Step 4 へ

### Step 4: 3分類判定

各項目を、利用者が選んだ「種類」と本文を踏まえて次の3つに分類する（詳細は `feedback_policy.json` の
`classification`）:

**(a) UX/機能改善**（種類: 使いづらい・わかりにくい / 表示がおかしい / こんな機能がほしい / その他）
→ Moat フィルターを通し `adopted` または `rejected`。
- 「一利用者の好み」ではなく「構造的な使いづらさ」かを見極める。疑わしきは**要検討メモ付きで採用**に
  寄せる（消費者の声は SEO 助言より一次情報に近いため）。
- Strategic Skip 抵触（匿名口コミ掲載要望・クーポン/予約特典要望・広告主誘導等）は却下。
- 体感バグ・信頼毀損に関わるものは優先度 P1。

**(b) 店舗事実の指摘**（種類: 店舗情報が間違っている）
→ `fact_check`。**この場でデータを一切修正しない**。
- 閉店・電話番号・営業時間などの指摘は、起票の acceptance に実在検証ゲートを必須で書く
  （Step 5 のテンプレ参照）。虚偽の閉店報告（例: 競合による妨害）で信頼を毀損しないための防波堤
  （`data/dispute_requests.json` の「自動反映はしない」先例と同じ思想）。

**(c) スパム・誹謗・個人情報**
→ `rejected`（宣伝・スパム・無意味な内容）または `escalated`（誹謗中傷・名誉毀損・法的懸念があるもの）。
どちらも起票せずログのみ。escalated は Step 8 の冒頭で必ずユーザーに明示する。

### Step 5: 起票（(a) adopted と (b) fact_check のみ）

採番:
```bash
node scripts/feedback_triage.js --next-id   # 例: FB-001。2件目以降は連番
```

`agent-backlog.md` の「## 進行中・完了タスク」直下に、既存パーサ準拠の形式で追記する
（`**priority** / **status** / **detected** / **category** / **owner**` を必ず含める）:

UX改善（(a)）:
```markdown
### [FB-001] <要望を一言で・効果が伝わる動詞で>
- **priority**: P2 → **status**: ready
- **detected**: <今日の日付 YYYY-MM-DD>
- **category**: UX
- **owner**: Builder
- **source**: サイトフィードバック <日付> 「<本文を短く引用>」
- **brand-filter**: ✅ 適合 — <Moat のどこを伸ばすか / なぜ一利用者の好みでなく構造的課題か>
- **acceptance**: <受け入れ条件>
```

店舗事実の指摘（(b)）:
```markdown
### [FB-002] <店名>の<指摘内容>を検証・反映
- **priority**: P1 → **status**: ready
- **detected**: <今日の日付 YYYY-MM-DD>
- **category**: データ
- **owner**: DataKeeper
- **source**: サイトフィードバック <日付> 「<本文を短く引用>」対象店舗: <店名>
- **brand-filter**: ✅ 適合 — 実在保証・情報正確性は Moat の根幹
- **acceptance**: 一次情報（公式サイト/公式SNS/Google Places等）で指摘内容を検証する。
  検証成立時のみ manual_stores.json や該当データを更新し、audit_store_liveness 系の監査を通過させる。
  一次情報で検証できない場合は status を wont_fix にし、その旨をオーナーに報告する
  （自動でデータを書き換えない。dispute_requests.json の運用に準拠）。
```

優先度の目安: UX要望は基本 **P2**（体感バグ・信頼毀損に関わるものは P1）。店舗事実の指摘は基本 **P1**
（実在保証・情報正確性はブランドの根幹のため）。1日の新規起票は `feedback_policy.json` の
`max_new_tickets_per_day`（既定3件）まで。超えた分は主旨が近いものへ統合するか翌日に回す。

### Step 6: 全項目をログに記録

adopted・fact_check・rejected・duplicate・escalated の**全項目**を1回でログ追記（配列で渡せる）:
```bash
node scripts/feedback_triage.js --log-append '[
  {"id":"FB-001","date":"<日付>","source":"site-widget","msg_id":"<gmail msg id>","category":"使いづらい・わかりにくい","feedback":"<本文>","verdict":"adopted","brand_reason":"<採用理由>","backlog_category":"UX"},
  {"id":null,"date":"<日付>","source":"site-widget","msg_id":"<gmail msg id>","category":"その他","feedback":"<本文>","verdict":"rejected","brand_reason":"<却下理由>"}
]'
```
`--log-append` がメールアドレスの自動マスクと本文500字への切詰めを行う（決定的処理・手作業でのマスク不要）。
`fingerprint` は省略可（スクリプトが正規化して自動付与）。

### Step 7: Notion へ同期

起票が1件以上あれば:
```bash
node scripts/sync_backlog_to_notion.js --if-changed
```
`changed: true` なら `/sync-backlog` の手順で MCP 経由 create/update を実施。
（起票ゼロ＝backlog 無変更なら同期はスキップしてよい。）

### Step 8: トリアージ表を提示（可視化＋上書き余地）

```
## 🧭 消費者フィードバック トリアージ（<日付>）

### ✅ UX/機能改善 → ready で起票（N件）
| ID | 要望 | ブランド適合理由 | 優先度 |
|----|------|------------------|--------|

### 🔍 店舗事実の指摘 → 検証ゲート付きで起票（M件）
| ID | 店舗 | 指摘内容 | 検証方法 |
|----|------|----------|----------|

### ⛔ 却下 → ログのみ（K件）
| 内容 | 却下理由 |
|------|----------|

### 🔁 重複スキップ（L件）
### 🚨 エスカレーション（あれば冒頭で強調・0件なら省略）

---
次アクション:
- このまま実装に回すなら `/solve-next`（FB-001 等が ready 候補）
- 判定を変えたい場合は「FB-001 は外して」と言ってください → 即修正します
- ループの健診は `node scripts/feedback_triage.js --report --days 30`
```

---

## 重要な原則

- **鵜呑み禁止**: フィードバックは必ず Step 1 の根拠を通す。却下・fact_check には必ず理由を残す
- **店舗事実は自動反映しない**: (b) は起票のみ。データ修正は検証ゲート通過後、別の実装ステップで行う
- **実装は別ゲート**: ここで作るのは `ready` まで。実装着手は `/solve-next` の YES ゲートを通る。
  マネタイズ・信頼に関わる施策は CLAUDE.md 制約7・8により**さらにユーザー承認が必須**
- **1ファイル制約は不変**: サイト本体は `index.html` 単一ファイル維持
- **ヘッドレスで止まらない**: 応答できる人がいない前提で動く。0件日は正常終了。判断に迷っても
  承認待ちで停止せず、「要検討メモ付き採用」か「理由付き却下」のどちらかに倒す（ISSUE-077 教訓）

---

## エラー時

- 引数が空、かつ Step 0 の Gmail 取得でも該当メールが0件 → 「新着フィードバックなし」として正常終了
  （エラーではない。承認待ちで停止しない）
- `--check-dup` / `--log-append` がエラー JSON を返す → 内容を記録し、その回のフィードバックは
  スキップして次に進む（ループ全体を止めない）
- Step 7 の Notion 同期失敗 → backlog 起票は完了しているので、その旨を残して正常終了
  （後で `/sync-backlog` 再実行で回収できる）
