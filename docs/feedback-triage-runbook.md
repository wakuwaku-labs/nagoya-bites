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
- 判定ポリシー: `data/feedback_policy.json`（3分類ルール・Gmail取得規則・PII規則・起票上限。毎回読む）
- 決定的ヘルパー: `node scripts/feedback_triage.js`（ID採番 / 重複検知 / 台帳突合 / PIIマスク付きログ追記 /
  心拍書き込み / 健診レポート）
- 生存確認（このループが動いているかの記録）: `data/feedback_health.json`（心拍・毎日更新してコミット）
- サーバ側監視: `.github/workflows/feedback-watchdog.yml`（毎日 13:00 JST。心拍が滞ると Issue 起票＝
  オーナーにメール。復旧で自動クローズ）。判定器は `node scripts/check_feedback_health.js`
- Notion 同期: 既存の `/sync-backlog`（スキーマ変更不要・そのまま流用。`ID_PREFIX_TO_OWNER` に `FB` 登録済み）
- 収集元: index.html のフローティング「ご意見」ボタン → Formspree（`https://formspree.io/f/xaqaygze`、
  `_subject: '[site-feedback] <種類>'`）→ 通知メールが Gmail（wakato1251999@gmail.com）に届く

---

## 実行フロー（必ずこの順番）

### Step 0: 入力の取得（引数が空＝自動運用のときのみ）

引数にフィードバック本文があればそれを使い、この Step をスキップして Step 1 へ。

> ⚠️ **1回の Gmail 検索を信じてはいけない**（2026-08-17 実測・ISSUE-089）
>
> 同一セッション内で同じクエリを2回投げ、**1回目は0件・2回目は実在する新着メールがヒット**した。
> 1回目は窓を `newer_than:7d` に広げても新着だけが出ず、より古い 08-11 のメールは出ていた。
> ＝ クエリ構文の問題でも窓の境界の問題でもなく、**検索インデックスの鮮度側の偽陰性**。
> 無人実行では 0件＝「新着なし」で静かに正常終了するため、この取りこぼしは誰にも届かない。
> 以下の手順は「取りこぼしても翌日以降に自動で回収される」ことを目的に組んである。

**引数が空のとき**は Gmail MCP で Formspree 通知メールを取得する:

1. `node scripts/feedback_triage.js --policy` を読み、`gmail_retrieval` の各値を取得する
   （クエリ・窓・リトライ規則の**単一の情報源**。ここに書かれた値をそのまま使い、暗記した値を使わない）。
2. `primary_query`（既定 `subject:"[site-feedback]" newer_than:7d`）で Gmail を検索する。
   **窓が7日なのは「7日分を処理するため」ではなく「1日取りこぼしても翌日以降に拾い直すため」**。
   再処理は 4 の台帳突合で完全に防げるので、窓を狭める利点は無い。
3. **0件だったら、そこで終わらせない**:
   - a. `sweep_query`（既定 `from:formspree.io newer_than:14d in:anywhere`）で引き直す。
     Gmail の検索は既定で**迷惑メール／ゴミ箱を除外する**ため、`in:anywhere` でそこも見る。
     件名タグの表記ゆれも `from:` なら拾える。
   - b. それでも0件なら、**時間差を空けて `primary_query` をもう一度**投げる（`retry_on_empty`）。
     `sleep` で待たず、**Step 1（CLAUDE.md の読み込み）と `--report` の健診を先に済ませてから**
     投げ直すこと。実測ではこの程度の時間差で復旧した。
   - c. a・b すべて0件で初めて「新着なし」と確定する。
4. 拾えたメールの **Gmail メッセージID** を集め、台帳と突合して未処理分だけを処理対象にする:
   ```bash
   node scripts/feedback_triage.js --unseen-msg-ids '["<msg-id-1>","<msg-id-2>"]'
   ```
   - `unseen` → 通常フローへ（1メール=1フィードバック）
   - `seen` → 処理済み。**本文を読む必要すらない**（広い窓で毎日引き直しても無害＝冪等）
   - `unseen` に**数日前の日付のメール**が混ざっていたら、それは過去に取りこぼしていた証拠。
     通常どおり処理したうえで、Step 9 の心拍に `late_recovered` として件数を計上する
5. 各メールの本文から category / store（あれば）/ body / page（あれば）と **Gmail メッセージID** を抽出する。
6. 3-c で0件が確定した場合は「新着フィードバックなし」として Step 1〜7 をスキップし、
   **Step 9（心拍の記録）だけは必ず実行して**正常終了する（エラー扱いにしない。毎日0件が普通の状態）。
7. **Gmail 自体を引けなかった場合**（認証切れ・MCP エラー・タイムアウト）は、
   **0件と報告してはいけない**。Step 9 で `status: "gmail_error"` と理由を記録して終了する
   （watchdog が拾ってオーナーにメールで届く）。「引けなかった」を「無かった」に混ぜないこと。

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

### Step 9: 心拍を記録する（**新着0件の日も必ず・スキップ禁止**）

```bash
node scripts/feedback_triage.js --health-write '{
  "status": "ok",
  "queries": [{"q":"<実際に投げたクエリ>","matched":<件数>}],
  "retried_on_empty": <true/false>,
  "new_processed": <今回処理した新着メール数>,
  "already_seen": <台帳突合でスキップした数>,
  "late_recovered": <数日前の日付なのに未処理だったメールの数>
}'
```
Gmail を引けなかった場合はこちら（**0件と報告しない**）:
```bash
node scripts/feedback_triage.js --health-write '{"status":"gmail_error","reason":"<エラー内容>"}'
```

そのうえで `data/feedback_health.json` を**コミットする**。

**なぜ0件の日こそ書くのか**: フィードバックが無い日はコミットする成果物が何も無い。心拍を書かないと
「ルーチンが動いて0件だった」と「ルーチンが動かなかった／Gmail を引けなかった」が**外から区別できない**。
このファイルがリポジトリに push されて初めて、`.github/workflows/feedback-watchdog.yml` が
サーバ側（＝このループの全故障モードから独立した場所）で鮮度を見て、滞ったら Issue を起票できる
（＝オーナーにメールが届く）。CLAUDE.md「無人自動化の監視を設計するときの原則」原則1・2・4 の適用。

---

## 重要な原則

- **鵜呑み禁止**: フィードバックは必ず Step 1 の根拠を通す。却下・fact_check には必ず理由を残す
- **店舗事実は自動反映しない**: (b) は起票のみ。データ修正は検証ゲート通過後、別の実装ステップで行う
- **実装は別ゲート**: ここで作るのは `ready` まで。実装着手は `/solve-next` の YES ゲートを通る。
  マネタイズ・信頼に関わる施策は CLAUDE.md 制約7・8により**さらにユーザー承認が必須**
- **1ファイル制約は不変**: サイト本体は `index.html` 単一ファイル維持
- **ヘッドレスで止まらない**: 応答できる人がいない前提で動く。0件日は正常終了。判断に迷っても
  承認待ちで停止せず、「要検討メモ付き採用」か「理由付き却下」のどちらかに倒す（ISSUE-077 教訓）
- **0件を確定させるまでの手順を省略しない**: 検知器が1本しかないループでは、検知器の偽陰性が
  そのまま「無かったこと」になる。Step 0 の sweep とリトライは省略可能な保険ではなく**手順の一部**
- **「引けなかった」を「無かった」に混ぜない**: Gmail エラーは 0件ではない。`status: "gmail_error"` で残す
- **心拍を書かずに終了しない**: 0件の日も Step 9 は実行する。書かない終了は「静かな失敗」と区別がつかない

---

## この設計が守れていない失敗（残存リスク）

- **Formspree には届いたが Gmail に一度も配送されなかった投稿**は、Gmail 側をどれだけ広く引いても
  検出できない（検知器と収集経路が同じ系統のため）。独立した突合には Formspree の submissions API が要り、
  それにはオーナー本人による API キー発行と Secret 登録が必要 → **ISSUE-090**（owner=片桐）。
  現状はこのリスクが残っていることを承知のうえで運用する。

---

## エラー時

- 引数が空、かつ Step 0 の Gmail 取得（primary → sweep → 時間差リトライ）を**すべて消化して**0件
  → 「新着フィードバックなし」として正常終了（エラーではない。承認待ちで停止しない）。
  **ただし Step 9 の心拍記録とコミットは必ず行う**
- Gmail MCP がエラーを返す／認証切れ → 0件と報告せず `status: "gmail_error"` で心拍を書いて終了。
  復旧は対話ログインが必要でコードでは直せないため、watchdog の Issue が唯一の復旧経路になる
- `--check-dup` / `--log-append` がエラー JSON を返す → 内容を記録し、その回のフィードバックは
  スキップして次に進む（ループ全体を止めない）
- Step 7 の Notion 同期失敗 → backlog 起票は完了しているので、その旨を残して正常終了
  （後で `/sync-backlog` 再実行で回収できる）
