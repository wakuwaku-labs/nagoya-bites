# 監査E: AI 組織と自動化の連携（NAGOYA BITES）

- 調査日: 2026-11-16（JST 夜）。読み取り専用。変更・起動・停止・起票はしていない。
- 凡例: 【事実】＝設定・コード・ログ・コマンド結果で確かめた／【推測】＝状況証拠からの読み／【未確認】＝確かめられなかった。
- 略記: NB repo ＝ `/Users/katagirijakutou/orca/workspaces/nagoya-bites/pilotfish`（origin/main は 0fd2534248・2026-11-16 20:08 JST）。Ondine CLI ＝ `"$HOME/orca/projects/各種案件＆媒体　管理ツール/tools/ondine-agent.mjs"`。

## 0. 先に結論（監査で見つかった重要な事実）

1. **「9役の AI 組織」は別プロセスの組織ではなく、1つの Claude が読む役割文書**。動いている自動化は役ではなく「起動口（launchd・GitHub Actions・Claude の定期タスク・クラウドのルーチン）＋スクリプト」で決まっている（問い1）。
2. **課題の台帳が3つ＋表示が2つ食い違っている**。同じ日の「未完了」が、backlog 21件／Linear 35件（期限切れ21）／Ondine 8件＋写し9件。セッション開始のブリーフィングは今も Linear を読む（問い4）。
3. **オーナー待ち10件（backlog）が Ondine の本人宛て（you）に1件も無い**。最長86日滞留。Ondine の通知経路に乗っていない（問い4・5）。
4. **警報が鳴りっぱなしの Issue が4件**（22〜40日 未解決）: ルーチン PR 滞留 #401、Linear 期限切れ #628、食べログ照合停止 #665、GAS 心拍 #694。CLAUDE.md の原則6「復旧したら静かにする／鳴りっぱなしは無視される」に反する状態（問い7）。
5. **クラウドの課題消化ルーチンが同じ課題を作り直している**。SEO-152 の PR が 11-03〜11-10 に少なくとも7本、未マージの `claude/*` PR が19本（問い7・8）。
6. **Claude デスクトップアプリが 11-13 15:19 以降動いていない**（プロセス無し・ログ更新無し）。そこに載る SEO トリアージとフィードバック取り込みが3日止まっている。見張りはまだ鳴っていない（問い2・7）。
7. **仕分け役の設定が決定と食い違う**。全体 CLAUDE.md と Ondine 判断 0191 は `auto_relay=false`（〜11/24 は案だけ）だが、実物は `auto_relay=True`・1日30件で、11-16 07:30 に7件を作業役へ渡した（問い8）。
8. **SNS 分析→記事への戻りは「弱い1本」だけ実在**。X の文面には型・題材の実験として効く。記事のテーマ選定には「同点のときの並べ替え +2点」だけ（問い3）。

---

## 1. 現在の AI 組織構造

### 1-1. NB 専任の9役（agents/*.md）の実態

【事実】
- 定義は文書9本（`agents/orchestrator.md` 705行・`editor.md` 735行・`strategist.md` 471行・`marketer.md` 302行・`data-keeper.md` 293行・`inspector.md` 256行・`builder.md` 173行・`designer.md` 119行・`reviewer.md` 98行）。
- **サブエージェント定義は無い**: NB repo に `.claude/agents/` は存在しない（`ls .claude/` → commands・launch.json・plans・settings.json のみ）。9役は Claude Code の「別エージェント」として登録されていない。
- **起動のされ方は「1つの claude に役を名乗らせる」だけ**:
  - `run-agents.sh:27-51` … `claude --print "…1. Inspector: agents/inspector.md の手順に従い… 2. Builder: agents/builder.md の手順に従い…"`。1プロセスが順に演じる。
  - `.github/workflows/weekly-pipeline.yml` … 同じ形（Step 2&3 Inspector + Builder）。**schedule はコメントアウトで停止中**（同ファイル 4-8行「ANTHROPIC_API_KEY 未設定のため」）。
  - 定期タスクの指示文 … 「あなたは NAGOYA BITES の Orchestrator として」（`~/.claude/scheduled-tasks/nagoya-bites-seo-triage-daily/SKILL.md`）「あなたは NAGOYA BITES の Editor エージェントです」（`…/nagoya-bites-journal-daily/SKILL.md`）。
  - `agents/orchestrator.md:219,427,457,492` の「Inspector を起動」「Strategist を起動」は、同じ会話の中で役割文書を読む意味（サブエージェント起動の記述は無い）。
- **`run-agents.sh` は使われていない**: 中の案内は旧パス `~/Desktop/nagoya-bites`（5行目）。`crontab -l` に該当行なし。launchd にも無い。`agent-run.log` の中身は別物で、GitHub Actions の `daily-trending5.yml:129`・`daily-journal.yml:153`・`weekly-pipeline.yml:121` が追記する「◯◯パイプライン完了」の1行ログ（直近は 2026-11-16 09:14 の TOP5）。
- **役ごとの参照数**（`agents/<役>.md` を参照するファイル数。workflows／.claude commands／scripts／docs）:

| 役 | workflows | commands | scripts | docs | 実際の使われ方 |
|---|---|---|---|---|---|
| orchestrator | 0 | 4 | 0 | 3 | 対話セッションと定期タスクの冒頭で読まれる規則集 |
| editor | 0 | 2 | 4 | 6 | 日次ジャーナル（`journal-today.md`・`validate_journal_draft.js` 等が参照）。**唯一、毎日実働している役の文書** |
| marketer | 0 | 3 | 0 | 1 | SEO トリアージの owner 名 |
| strategist | 0 | 3 | 0 | 3 | 文書上の審査観点 |
| inspector | 1 | 1 | 0 | 2 | 停止中の weekly-pipeline だけ |
| builder | 1 | 1 | 0 | 3 | 同上＋backlog の owner 名 |
| data-keeper | 0 | 1 | 0 | 1 | backlog の owner 名。実体は `build.js` と GitHub Actions |
| designer | 0 | 0 | 0 | 4 | CLAUDE.md 制約12 で名指し。実体は `audit_design_system.js` |
| **reviewer** | **0** | **0** | **0** | **0** | `orchestrator.md` から参照されるだけ。backlog の `reviewer:` 欄は3か所（8206・8225・8233行）のみ |

- `reviewer.md:18-25` は自分で限界を書いている: 「提案も実装もレビューも同一モデルである以上、真に独立した監査は原理的に不可能…緩和策にすぎない」。
- `AGENTS.md`（697行・90KB）は CLAUDE.md の Codex 向けの写し（「Claude」→「Codex」、`.Codex/settings.json` という置換の跡あり＝`AGENTS.md:28`）。Codex は使わない方針（後述 D1）なので読み手がいない。11-09 にもこの写しを揃える PR #729 が出ている＝保守だけ発生。

【推測】役の文書の実質的な価値は「観点のチェックリスト」と「backlog の owner ラベル」。Editor 以外は、その文書を読まなくても動く自動化（スクリプト＋ワークフロー）に置き換わっている。

### 1-2. 全社共通の側（NB にも効く）

【事実】
| 仕組み | 置き場 | 何をするか | NB との関係 |
|---|---|---|---|
| Claude Code のサブエージェント6種 | `~/.claude/agents/`（Explore=haiku／ap-worker=sonnet／ap-consult=opus・読み取り／ap-deep=opus・読み取り／design-qa=opus・読み取り＋Bash／general-purpose） | 会話の中から呼ぶ別文脈の担当 | 対話セッションでだけ使える。launchd の日次ジャーナル（`claude --print` ＋最小の道具）からは呼ばれない |
| chiton（Session Autopilot） | `~/.claude/autopilot/`（hook.py・guard.py・gitauto.py・runner.py・final-check.md） | 引き継ぎ、最終チェックの差し込み、自動コミット、無人運転 | 全セッションのフックで効く（`~/.claude/settings.json` の SessionStart/Stop/PreToolUse 等） |
| 学習（learn.py） | launchd `com.autopilot.learn`（8:05・9:05・10:05） | CLAUDE.md の「学習した方針」へ自動追記 | **今は無効**（`config.json` の `learning.enabled=False`。ログは毎回「学習は無効」）。健全化計画 Phase0 で止めたまま |
| 仕分け役（issue_triage.py） | launchd `com.claude-autopilot.issue-triage`（7:30・12:10） | 全 repo の開いている課題（11-16 は175件）を読み、消す案・やる案・本人の番を仕分け | NB の課題も対象（例: #420・#1263 が案に出ている＝`issue-triage/latest.md`） |
| Ondine の秘書 | `~/.ondine-release/current/server/domain/secretary/`（notify.js・independent_verify.js・issue_triage.js ほか） | 通知、完了時の独立検証、仕分け（案だけ）、朝のまとめ | NB の課題の正本。常駐 `com.ondine.server`（稼働中 PID あり） |
| Ondine の作業役（relay） | `ondine-agent.mjs relay` → Ondine が別会話の Claude を起動 | 会話から仕事を別会話へ渡す | NB 関連で稼働中（例: #2041「基本方針を X投稿・記事に反映」が awaiting_result） |
| 事業責任者（部署パック） | `~/orca/projects/AI組織設計/packs/business-owner/nagoya-bites/`（README・pack.json）＋ Ondine `business_owner.js` | 週1回・KPI の外れ値・評価日に起動し施策案を最大3つ出す。実行はしない | **NB 用が既に在る**。枠の中（記事の題材・文面・投稿時間・記事の追加と改善・サイト内部の改善）は自動で課題化、枠の外（新媒体・お金・店とお客様・目標変更）は承認待ち |
| design-qa | `~/.claude/agents/design-qa.md` ＋ 記録 `~/orca/projects/AI組織設計/design/qa-log/` | 画像・画面の目視検査 | NB の記録が5件（11-13: X カード、IG 表紙2、note 見出し画像2） |

### 1-3. 役割の重複

【事実】
- **検証役が4系統**: ① NB の Reviewer（同じ会話・文書だけ・実績ほぼ無し）② chiton の最終チェック（同じ会話の自己点検。`final-check.md`、`final_review.mode=conditional`・3ファイル以上か4000字以上＋1割抜き取り）③ Ondine の独立検証（別会話の Claude・完了時。判断 0190）④ design-qa（見た目だけ）。①だけが実働の裏付けを持たない。
- **Inspector と監査スクリプト**: Inspector の「サイト全方位監査」は停止中の週次パイプラインにしか載っていない。実際の監査は `scripts/audit_*.js` 42本＋`nightly_qa.js` が毎日機械で回している（問い6）。
- **Orchestrator と Ondine の司令塔**: 「次の仕事を選ぶ・優先度・done を決める書き手は Ondine に一本化」（AI組織設計 判断 0009・Ondine 判断 0191/0193）。一方 NB の `orchestrator.md` と `/solve-next` は Linear と backlog を見て次を選ぶ（`orchestrator.md` に linear 20回・ondine 0回）。
- **事業責任者（Ondine）と Strategist／Marketer（NB）**: KPI→施策案の循環は Ondine 側に実装済み。NB の Strategist は文書だけ。

---

## 2. NB の自動化の全一覧

時刻は JST。GitHub Actions の cron は実際には数時間遅れる（例: TOP5 は 05:30 指定だが `agent-run.log` の実績は 08:50〜11:55）。

### 2-1. Mac の launchd

| 何を | 定義 | 頻度 | 成果物 | 止まったときの検知 |
|---|---|---|---|---|
| 日次ジャーナル生成〜公開〜note 投稿〜note の数字 | `com.nagoyabites.journal` → `~/nagoya-bites/scripts/run_journal_local.sh`（985行） | 毎日 09:00 | `journal/*.html`・`docs/daily-posts/*.md`・X の文面（`data/x_post_drafts/`）・X 画像カード・main へ push・note 公開・`data/journal_health.json`・`data/note_post_health.json` | `journal-watchdog.yml`（欠番）・`note-post-watchdog.yml`。Mac の通知（osascript）も出す |
| X の日次分析・週次・見張り | `com.snsanalyzer.x-daily`（06:30）・`x-weekly`（月 08:00）・`x-watch`（09:00）。置き場は `~/orca/projects/SNS分析ツール` | 日次／週次 | iCloud の `sns-analyzer-x/nagoya_bites/next.json`・`note-next.json`、Ondine の課題・LINE | `x-watch` が「結果が無い・古い」なら本人担当の課題を Ondine に1日1件（`src/cli.ts:58-59`） |
| X の返信参加 | `com.snsanalyzer.x-engage`（10:30） | 毎日 | 返信案カード（Ondine） | 【未確認】 |
| Instagram の投稿・見張り | `com.snsanalyzer.ig-post`（5分ごと）・`ig-watch`（09:05） | 常時／日次 | リール投稿 | `ig-watch` |
| 動画の台本 | `com.snsanalyzer.video-scripts`（月 10:00） | 週次 | 本人担当の課題（例: Ondine #2037） | 【未確認】 |
| 課題の仕分け | `com.claude-autopilot.issue-triage`（07:30・12:10） | 1日2回 | `~/.claude/autopilot/issue-triage/latest.md`・作業役への relay | 【未確認】 |
| Linear の自動アーカイブ | `com.claude-autopilot.linear-archive`（08:20・14:20・20:20） | 1日3回 | Linear 側の整理 | 【未確認】 |
| Ondine 本体・監査・目標実行・昇格 | `com.ondine.server`（常駐）・`audit`（06:10）・`goal-run`／`k2-promote`（10分ごと） | — | 課題・通知 | Ondine の内部 |

### 2-2. Claude の定期タスク

| 何を | どこで | 頻度 | 成果物 | 検知 | 今の状態 |
|---|---|---|---|---|---|
| SEO トリアージ（日次＋週次） | Claude デスクトップアプリ（`~/.claude/scheduled-tasks/nagoya-bites-seo-triage-daily`。cron `30 8 * * *`） | 毎日 08:30 | `data/seo_advice_log.json`（504件: 重複316・却下116・採用71）・backlog の [SEO-NNN]・Ondine 起票 | `seo-triage-daily-watchdog.yml`・`seo-triage-weekly-watchdog.yml`・`gas-deploy-watchdog.yml` | **11-13 が最後**（ログの最終記録 11-13）。CLAUDE.md は「毎日 21:01」と書くが実物は 08:30 |
| フィードバック取り込み | 同上（`…feedback-triage-daily`。cron `31 21 * * *`） | 毎日 21:31 | `data/feedback_log.json`・[FB-NNN]・`data/feedback_health.json` | `feedback-watchdog.yml` | **心拍は 11-13 が最後** |
| 話題店の発掘 | クラウドのルーチン（ブランチ `claude/tender-carson-*`） | 毎日 04:10 ごろ | `data/trending_stores.json`・`data/trending_scout_health.json`・PR | `trending-scout-watchdog.yml` | 稼働（11-16 分 PR #743 マージ済み） |
| 課題の自動消化（solve-next） | クラウドのルーチン（ブランチ `claude/wizardly-ramanujan-*`） | 毎日 09:10 ごろ | PR（backlog の ready を実装） | `routine-pr-automerge.yml` が24時間超の滞留で Issue | 稼働しているが PR が溜まる（問い7） |
| Formspree 月次突合のリマインド | `…feedback-formspree-crosscheck-monthly` | 毎月1日 | オーナーへの促し | なし | 【未確認】アプリのログに登録の記録が見当たらない |
| （使われていない定義） | `…journal-daily`（06-18 作成・worktree 前提）、`…solve-next-daily`（説明に「[無効化]」） | — | — | — | launchd とクラウドに置き換え済みの残骸 |

【事実】アプリのログで動いている定期タスクは `seo-triage-daily` と `feedback-triage-daily` の2つだけ（`~/Library/Logs/Claude/main.log` の `[CCDScheduledTasks]`）。
【未確認】クラウドのルーチンの設定そのもの（claude.ai 側）は読めない。存在と時刻は PR の作成時刻・ブランチ名からの読み。

### 2-3. GitHub Actions（32本。詳細は別担当）

| 分類 | ワークフロー（JST） |
|---|---|
| 公開 | `build.yml`（push と毎日 03:00）・`pages-artifact.yml`（push／workflow_run） |
| データ更新 | `daily-trending5`（05:30）・`daily-store-add`（09:00）・`place-status`（04:30）・`weekly-places`（火 03:00）・`weekly-media`（月 06:00）・`editorreason-batch`（火 03:00） |
| SNS | `x-post`（記事の push 起点＋12:00・17:00 のやり直し）・`x-metrics`（06:40）・`x-competitors`（月 07:00）・`x-delete`（手動） |
| 検査 | `nightly-qa`（06:00）・`routine-pr-automerge`（PR 起点＋毎時17分） |
| 見張り（14本） | `journal-watchdog`（09:00・12:00）・`note-post-watchdog`（13:00・21:00）・`x-post-watchdog`（21:00）・`x-metrics-watchdog`（07:50）・`feedback-watchdog`（13:00）・`seo-triage-daily-watchdog`（15:00）・`seo-triage-weekly-watchdog`（16:00）・`gas-deploy-watchdog`（14:00）・`trending-scout-watchdog`（14:00）・`feature-roster-watchdog`（15:00）・`photo-watchdog`（15:00）・`link-audit-watchdog`（16:30）・`social-watchdog`（14:00）・`linear-watchdog`（08:00） |
| 手動・停止中 | `ga4-baseline`・`ga4-fragment-counts`（手動）／`daily-journal.yml`・`weekly-pipeline.yml`（schedule 停止。API キー前提の旧経路） |

【事実】11-13 以降の実行結果: 失敗は `Build & Deploy` 29回中3回と、`gas-deploy-watchdog` 3回中3回（＝見張りが異常を検知して赤になる作り）。ほかは成功。

### 2-4. GAS

| 何を | 正本 | 頻度 | 成果物 | 検知 |
|---|---|---|---|---|
| 日次・週次レポートの配信 | `.gas-deploy/Code.js` | 毎朝 | Gmail と LINE（Messaging API）へ送信 | `gas-deploy-watchdog.yml`（`data/gas_deploy_health.json` の心拍） |

【事実】`data/gas_deploy_health.json` の `last_run.date` は **2026-10-21 のまま**（26日前）。SEO トリアージ自体は 11-13 まで `seo_advice_log.json` を更新しているので、「トリアージは動くがこの心拍だけ書かれない」状態。Issue #694 が 10-25 から開いたまま（コメント21件）。

---

## 3. SNS との連携

【事実】
- **X の投稿・note の投稿は NB repo の中**: `x-post.yml`＋`scripts/post_journal_to_x.js`（GitHub Actions）／`scripts/post_note.js`（Mac の launchd ラッパー内）。台帳は `data/x_post_log.json`・`data/x_post_health.json`・`data/note_post_health.json`。11-16 は両方成功（X: posted・返信3、note: live）。
- **X の数字の取得も NB repo**: `x-metrics.yml` → `data/x_metrics.json`（コメントに「Ondine の SNS 画面が読む」）。
- **分析・Instagram・X の返信・動画台本は別プロジェクト**: `~/orca/projects/SNS分析ツール`（launchd `com.snsanalyzer.*` 7本）。NB の公開リポジトリの `data/x_post_log.json` と `data/x_metrics.json` を raw URL で読む（`config/x-accounts.json:21`・`src/platforms/x.ts:3`）。
- **分析→NB へ戻る経路（実在するもの）**:
  1. 分析側が iCloud の `sns-analyzer-x/nagoya_bites/next.json`（予備 `~/.config/sns-analyzer-x/nagoya_bites/`。実在を確認）へ週の予定と候補を書く。
  2. NB の `scripts/write_x_draft.js` が読んで、**X の文面**に型・1行目・長さ（ADR 0059）と題材の実験（ADR 0067・2026-11-22 から自動で有効）を「今日の指定」として足す。
  3. NB の `scripts/lib/journal_plan_topic.js` が読んで、**記事の候補選び**に「題材が明確に一致する候補へ +2点（並べ替えだけ。採点・判定・失格は不変。満点110）」（`journal-today.md:107`・`score_journal_candidates.js`）。
  4. note は `note-next.json` の `try`（抜粋する節の数・題の短縮）だけ（ADR 0059 決定5）。
- **`data/x_metrics.json` の読み手**: NB repo 内では取得（`fetch_x_metrics.js`）・競合（`fetch_x_competitors.js`）・見張り（`check_x_metrics_health.js`）だけ。記事づくりは直接読まない。読み手は外（SNS分析ツールと Ondine の SNS 画面）。
- Ondine #2025「投稿を作る側（Nagoya Bites・動画太郎）が、分析の題材の実験と話題の提案を使うようにする」は 11-16 時点で「一部」（relay 結果: コミット eae8c74・awaiting_result）。
- Instagram と TikTok: 11-16 に本人が「金肉の Instagram・名古屋バイツ TikTok の接続は外す」と決定（`~/.ondine/context/sns.md` #2027）。

【結論（事実の範囲）】SNS の結果は X の文面には効く。**記事のテーマ選定には、同点のときの並べ替え +2 という弱い1本だけ**で、「読まれた題材を次の記事に増やす」強さの戻りは無い。

---

## 4. Ondine での案件管理

### 4-1. 仕組み

【事実】
- 決まり（`~/.claude/CLAUDE.md`「Ondine 運用」・NB ADR 0060）: 課題は Ondine。Linear は読むだけの写し。Linear に新規起票しない。
- NB repo の `.ondine.json`: repo=`nagoya-bites`、担当既定 `ai:claude-code`、期限 P0=1日／P1=7／P2=14／P3=30。`.linear.json` は無い。
- relay: `ondine-agent.mjs relay <id>` → Ondine が別会話の Claude（作業役）を起動。結果は次の発言かセッション開始に出る。お金・新しい外部公開・店とお客様・取り消せない操作は渡しても確認の門で止まる（AI組織設計 判断 0006）。`relay-status` で直近の状態が読める（NB 関連: #2041 awaiting_result、#1838 待ち）。
- 完了の判定: AI の `update --state done` は、本番に見えるもの等（V2 以上）は独立検証の行が要る。無ければ 409 で断る（Ondine 判断 0190）。

### 4-2. 実態（3つの台帳の数字が合わない）

【事実・2026-11-16 のコマンド結果】
| 台帳 | 未完了 | 中身 | 出どころ |
|---|---|---|---|
| `agent-backlog.md`（10,479行・404見出し・1.6MB） | **21件**（ready 13・in_progress 8）。`next_task.js` の数え方では未処理18（AI が解ける8＋オーナー待ち10） | done 369・wont_fix 22・superseded 4 | `grep '**status**'`・`node scripts/next_task.js` |
| Linear | **35件**（進行中5・**期限切れ21**・14日以上放置21） | 最後の同期コミットは 11-09（`data/linear_sync_state.json`・165件） | `node scripts/session_briefing.js` |
| Ondine repo `nagoya-bites`（新規起票分） | **7〜8件**（調査中に1件増えた。全24件: done 14・void 2） | SEO・X・手羽先特集など | `ondine-agent.mjs list` |
| Ondine repo `Nagoya Bites`（Linear の写し） | **9件**（全279件）。うち doing 3 | 例 #420 [MEO-001]（Linear P-465 の写し） | `list --repo "Nagoya Bites"` |

- **三重管理は今も続いている**:
  - セッション開始のフック `.claude/settings.json` → `scripts/session_briefing.js` は **Linear を読む**（`orca` CLI 経由・`session_briefing.js:92`）。出力は「Linear: 未完了35件…期限切れ29日: P-243…」。Ondine の briefing は「未完了7件・期限切れ0」。同じ日に正反対の絵が出る。
  - `linear-watchdog.yml` が毎朝 Linear を判定し、Issue #628「🟡 Linear: 期限切れ21件・放置21件」が 10-17 から開いたまま。毎週月曜は「📊 Linear 週次振り返り」Issue（#745 ほか計7回）。
  - `nightly-qa.yml:64-65` は今も `sync_qa_findings_to_linear.js` を `LINEAR_API_KEY` つきで実行（＝Linear への新規起票の経路が残る）。
  - `docs/feedback-triage-runbook.md` は Linear 同期のまま（linear 9回・ondine 0回。Step 7「Linearへ同期」）。`.claude/commands/solve-next.md`・`sync-backlog.md`・`agents/orchestrator.md` も Linear 前提（ondine 0回）。Ondine に揃っているのは `/seo-triage`・`/seo-triage-weekly` だけ。
  - NB の CLAUDE.md 自身も前半は「Linear Issue品質ルール（全起票経路で必須）」「`sync_backlog_to_linear.js --apply` でLinearへ送る」、後半（SEO ループ）は「Ondine へ起票」と、1ファイルの中で食い違う。
  - backlog は 11月だけで18回コミットされており、クラウドの課題消化ルーチンと SEO トリアージの「実質の作業台帳」になっている。
- **オーナー待ちが Ondine に載っていない**: backlog のオーナー待ち10件（SEO-067 滞留86日、SEO-098 63日、ISSUE-165・SEO-129・ISSUE-151・SEO-142 各38日、ISSUE-194 29日、SNS-006・SNS-007 23日、SEO-154 3日）に対し、Ondine の NB の本人宛て（you）は全8件がすべて done か void で、**開いているものは0件**。

### 4-3. 本人宛ての課題と通知

【事実】
- Ondine の通知（`secretary/notify.js`）: Web Push。種類は 朝のまとめ（7:50〜正午に1回）／待たせている／今日が期限／期限切れ／AI からのお願い（ask）／Orca の会話が答え待ち（orca_ask）／依頼した作業の結果（work_end）／LINE 連携の見張り。静かな時間 22:00〜07:30、まとめ系は1日5通まで。
- 本人宛てで確認系の題なのに確認する物（`--ref`）が無い起票は 422 で断る（Ondine CLAUDE.md）。
- 【未確認】Ondine の Web Push が実際に本人の端末へ届いているか（購読数・受信の印）は読んでいない。

---

## 5. 判断依頼・通知の流れ

### 5-1. 経路（実在を確かめたもの）

| 経路 | 何が届くか | 根拠 |
|---|---|---|
| 会話の返答の最後「🙋 あなたにお願いしたいこと」 | 対話セッションの残り作業 | `~/.claude/CLAUDE.md`・`final-check.md` 6項 |
| Ondine の本人宛て課題＋Web Push | 承認・選択・確認（選択肢ボタン） | `notify.js`・`ondine-agent.mjs ask` |
| GitHub Issue → メール | 自動化の停止（見張り14本＋PR 滞留） | 各 `*-watchdog.yml`。ラベル別の実績は問い7 |
| LINE | GAS の日次・週次レポート、SNS分析ツールの毎朝の報告 | `.gas-deploy/Code.js:6`・SNS分析ツール README |
| Gmail | GAS レポート（SEO トリアージの入力）、Formspree の通知 | CLAUDE.md・`feedback_policy.json` |
| Mac の通知（osascript） | ジャーナルの HOLD・note 失敗 | `run_journal_local.sh:185,222` |
| セッション開始のブリーフィング | Linear の期限切れ（NB のフック）と Ondine の件数（全体） | 問い4 |

【事実】入口が7つあり、同じ「本人の判断待ち」が経路ごとに別の台帳に載る（backlog のオーナー待ち10件は Ondine に無い／GitHub の警報4件は Ondine に無い／Linear の期限切れ21件は Ondine の briefing に出ない）。

### 5-2. 人の確認が必須と決められている条件

| 条件 | 出どころ |
|---|---|
| 課金・費用の発生、購入 | 全体 CLAUDE.md（作業前に聞く／止まるのは取り消せない操作・外部送信・公開・購入の直前） |
| 取り消せない操作、外部への送信、公開 | 同上 |
| 目的や対象範囲が変わる大きな前提 | 同上 |
| 健全化計画の Phase をまたぐ移行 | 同上（D6） |
| 課題の void・優先度変更（本人の名指しか承認） | 同上（D7）。仕分け役は提案まで |
| 昔の todo を材料として着手・relay しない | 同上（2026-11-01） |
| マネタイズ施策（制約8）、信頼を毀損しうる施策（制約7） | NB CLAUDE.md |
| QA ゲート通過前のデプロイ禁止（制約6） | 同上 |
| Project・KR を決める、放置課題の Canceled | 同上「自動でやらないこと」 |
| 信頼スコアの算出式の変更（分布を実測して承認） | メモリ `trust-algorithm-changes-need-confirmation.md` |
| 規約違反になる写真しか残らないとき | NB CLAUDE.md 写真の節 |
| design-qa が2回不合格の公開物（出すかは本人） | NB CLAUDE.md（G1） |
| 新しい媒体・新しい企画や文体の大きな変更・お金・店とお客様・目標値の変更 | 事業責任者パックの「枠の外」 |
| editorReason の下書きの承認 | `editorreason-batch.yml`（人手レビュー後に反映） |

逆に「人に聞かない」と決まっているもの: 日次ジャーナルの無人実行（品質ゲート原則6）、SEO トリアージ・フィードバックの起票（「確認なしで即追記」承認済み）、クラウドの課題消化（安全フィルタ・1日の上限。`solve_next_policy.json`）。

---

## 6. 既存の品質検査

### 6-1. 全社共通

| 検査 | 誰がいつ呼ぶ | 性質 |
|---|---|---|
| 最終チェック（`final-check.md`） | chiton の Stop フックが、コード変更が大きいとき（3ファイル以上か4000字以上）と1割の抜き取りで差し込む | 同じ会話の自己点検。1回まで |
| guard.py・devq.py | PreToolUse フック（Bash・Edit・Write） | 危険な操作の門 |
| 自動コミット・合流（gitauto） | `autonomy.git`: commit=auto／merge_to_main=on_green／push=branch_only | テスト通過時だけ main へ |
| design-qa | 作った会話が、見た目を外に出す前に呼ぶ | 別文脈・opus・読み取り専用。記録は qa-log（NB 5件） |
| Ondine の独立検証（V2 以上） | AI が課題を done にするとき Ondine が自動で | 別会話の Claude・道具なし・達成条件と差分と試験を照合。上限で呼べないときは「判断できない」で通す |
| Ondine の目的の確かめ（判断 0126） | 達成条件に「目的の確かめ」行がある課題を、後で AI が確かめる | 完了とは別の段 |
| `/code-review`・`/security-review` | 対話で任意 | Reviewer 文書が使うと書くが、定期経路には無い |

### 6-2. NB 固有

| 検査 | 誰がいつ呼ぶ | 止めるか |
|---|---|---|
| `validate_journal_draft.js` | 日次ジャーナルのラッパー（生成した claude とは別に、シェルが独立に実行＝`run_journal_local.sh:768`「claude が PASS を主張しても、ラッパーが独立に検証」）と `build.yml` | 落ちたら HOLD（公開しない） |
| 採点ゲート（`score_journal_candidates.js`・`data/journal_gate_policy.json`） | 記事の候補選びの段 | PASS／PASS_WITH_NOTE／HOLD の段階ゲート |
| `hero_photo_gate.js` | 生成時・公開前・日次 CI が同じ判定を共有 | 止める |
| X の文面の数字照合（`write_x_draft.js`・ADR 0047） | ラッパーの 5i の段 | 通らなければ定型に戻す |
| `npm test`（tests 190ファイル） | `build.yml`（意図的にブロッキング）・`routine-pr-automerge.yml` | 止める |
| `audit_*.js` 42本 | `build.yml` が24本、`nightly_qa.js` が約19本（ファイル名の出現で数えた）。**ワークフローにも夜間 QA にも載っていないものが6本**（`audit_crosscheck_v3`・`audit_gas_mirror`・`audit_other_prefecture_stores` は参照なし。`audit_crosscheck_v22`・`audit_empty_image_frames`・`audit_store_reachability` はテストから名前が出るだけ） | build の多くは `continue-on-error: true`（検知だけ）。止めるのは `npm test`・`audit_isnagoya_filter`・`audit_store_liveness`・`audit_other_prefecture_matches`・`audit_closed_store_mentions`・`audit_inline_js_syntax`・デザインシステム監査など |
| `nightly_qa.js` | `nightly-qa.yml` 毎日 06:00 | 止めない。発見は backlog と Linear に起票 |
| `qa_gate.js`（QA-1〜4） | Reviewer 文書と `orchestrator.md` が指す | **workflows・`solve-next.md` からの呼び出しは0**（対話で手動だけ） |
| `audit_design_system.js --check` | `build.yml`・自動マージ・夜間 QA | 止める |
| 見張り14本（`check_*_health.js` 12本ほか） | GitHub Actions | 止めない。Issue→メール |

【事実】記事の中身（事実・数字・店の説明が正しいか）を、**書いた claude と別の目で読む検査は無い**。機械の検査が見るのは「店が実在データにあるか・評価の範囲・写真の帰属・出典の形・語の禁止」など形で判定できる項目。

---

## 7. 自動化が止まる原因の実績

### 7-1. 見張りの Issue の実績（`gh issue list --state all`・ラベル別）

| ラベル | 回数 | 期間 | 備考 |
|---|---|---|---|
| journal-watchdog | 17 | 08〜11-01 | ほぼ当日〜2日で閉じる |
| gas-deploy-watchdog | 8 | 08-24〜 | **1件が 10-25 から未解決（22日）** |
| nightly-qa | 7 | 06〜10-30 | 最長 07-23→09-17（56日） |
| linear-retro | 7 | 毎週 | 情報の Issue（毎週開く） |
| ga4-reference-stale | 4 | 09〜10 | |
| journal-run-died | 2 | 09-16・10-09 | |
| linear-watchdog | 2 | | **1件が 10-17 から未解決（30日）** |
| link-audit-watchdog | 1 | | **10-22 から未解決（25日）。最後に取得できたのは 09-20** |
| routine-pr-automerge | 1 | | **10-07 から未解決（40日）** |
| feedback／note-post／social／trending-scout／x-metrics／x-post | 各1 | | social は 08-25→09-29（35日） |

### 7-2. 原因の型（メモリ・ADR・コード内コメント）

| 型 | 実績 | 発覚まで | 今の対策 | 人手 |
|---|---|---|---|---|
| claude CLI のログイン切れ（サブスク OAuth） | 再発する種類。08-12 以前は3回連続でオーナーがサイトを見て発覚（07-24 の停止は 07-27 に発覚＝3日） | 以前3日→今は当日 | 認証プリフライト＋HOLD＋`journal-watchdog`（PR #119） | **要る**（Mac で `claude` を対話起動して入り直す） |
| 蓋閉じスリープで接続が切れる | 8月に7日（08-05・07・08・09・13・16・18） | 原因特定まで約2週間 | `caffeinate -s -i -d -u`（PR #144）。電源状態を HOLD 理由に記録 | **要る**（AC 電源につなぐ。バッテリー時は防げない） |
| メインの checkout の汚れ・未 push コミットで pull が衝突 | 06-04〜・06-22・07-24（本番404事故）・10-06・10-10・10-12・10-15 | 当日〜2日 | pull 前の退避・自己修復。**手元 main への merge を止めるガードは未実装**（メモリ `journal-main-checkout-diverged…`） | ときどき要る |
| リポジトリ移転・ブランチ違い | 06-04〜（旧 Desktop パス）、10-03（autopilot ブランチ） | 数日 | ラッパーで main 復帰 | 不要 |
| プリフライトが普通のセッションとして動く | 10-23（約8分停止） | 当日 | 許可を最小にした（`run_journal_local.sh:510`）。**`--safe-mode` は今も付いていない** | 不要 |
| デスクトップアプリの定期実行の取りこぼし | 09-17・09-20・10-10・10-16（取り戻しが捨てられる）／10-19〜22（アプリのログイン切れ・4日）／**11-13〜（アプリが起動していない・3日目）** | 1〜4日 | 心拍＋見張り（3日以上で Issue）。取り込みは7日の窓で拾い直す | **要る**（アプリを開く・入り直す） |
| クラウドのルーチンが push できない | 06-04〜06-15 の12日間、成果ゼロ（真因は push 権限のトグル OFF＝403） | 12日 | 権限 ON（06-17） | 設定は本人 |
| ルーチンの PR が誰にもマージされない | 09-24〜10-04 に31件滞留・同じ課題の重複 PR 7本／**今も `claude/*` の未マージ 19本（10-06〜11-14）。SEO-152 の PR が 11-03〜11-10 に7本（#717・#718・#720・#722・#724・#726・#731）** | — | `routine-pr-automerge.yml`（QA 失敗・競合・ワークフロー変更を含む PR は止まる） | **要る**（止まった PR の判断）。Issue #401 は40日放置 |
| 外部 API の枠・上限 | Places の日次上限で写真取得が9日間ゼロ（08-29 発覚。ジョブは緑のまま）／X の利用上限（Ondine #1899） | 9日 | `photo-watchdog`・Places の利用台帳（ADR 0042） | 予算の判断 |
| 供給の定期実行が誰にも回されない | 話題店の新規が4月〜09-11 の約5か月ゼロ | 約5か月（オーナーの報告） | 発掘ルーチン＋心拍＋見張り | 不要 |
| note のログイン | 10-22 までに3回・10-24 | 当日 | 専用プロファイルの Google ログイン（ADR 0057）・投稿前に自分で入り直す | まれに要る（Chrome の Google ログイン切れ） |
| 道具の破損 | 10-24 node が起動しない（brew の依存更新） | 09:00 の前に発見 | `brew upgrade node` | 本人の了承 |
| 記事追加で標本テストがずれる／店舗更新で転送ページ化 | 10-12・10-13・10-23〜24（main が8回失敗） | 当日 | テスト修正 | 不要 |
| GAS が旧コードのまま／心拍が書かれない | Issue 8回。今は心拍が 10-21 で止まったまま | — | `gas-deploy-watchdog` | 【未確認】GAS の反映に本人の操作が要るか |
| 食べログのリンク照合が止まる | 09-20 が最後。Issue #665（10-22〜） | 32日 | `link-audit-watchdog` | 【未確認】原因 |

### 7-3. 今も人手が要る復旧

claude CLI の再ログイン／デスクトップアプリの起動と再ログイン／Mac の電源（AC）と蓋／note 用 Chrome の Google ログイン／クラウドのルーチンの権限設定／止まった PR の判断／外部サービスの上限と鍵（X・Places・LINE のトークン再発行は 11月の HANDOFF コミットに記録あり）。
【事実】自動化の中核3つ（ジャーナル＝launchd、トリアージ＝デスクトップアプリ、X の分析＝launchd）が **1台の Mac のログイン状態と電源** に乗っている。Mac の外で動くのは GitHub Actions とクラウドのルーチン2本。

---

## 8. 重複・複雑さ

### 8-1. 同じ働きの仕組みが複数ある箇所

【事実】
1. **課題の台帳**: backlog／Linear／Ondine（新規）／Ondine（Linear の写し）。問い4。
2. **始業のブリーフィング**: NB のフック（Linear）と Ondine の briefing。数字が合わない。
3. **次の仕事を選ぶ役**: `scripts/next_task.js`＋`/solve-next`（backlog）／クラウドの課題消化ルーチン／chiton の仕分け役／Ondine の秘書の仕分け（案だけ）／Ondine の goal-run・事業責任者。Ondine 判断 0191 自身が「書き手が3つに分かれている」と書き、一本化の途中。
4. **放置・期限切れの見張り**: `linear-watchdog.yml`（Linear）／Ondine の briefing・通知（期限・放置）／仕分け役。
5. **日次ジャーナルの起動口の定義が3つ**: launchd（実働）／定期タスク `nagoya-bites-journal-daily`（未使用）／`daily-journal.yml`（停止）。
6. **週次パイプラインが2つ**: `run-agents.sh`（未使用・旧パス）／`weekly-pipeline.yml`（停止）。中の Hot Pepper 人気順の収集・Marketer 週次チェックも一緒に止まっている。メディア掲載の取得だけ `weekly-media.yml` に切り出して救済済み（同ファイルのコメント）。
7. **検証役4系統**（問い1-3）。
8. **指示書の写し**: `CLAUDE.md` と `AGENTS.md`（Codex 用・読み手なし）。メインの checkout に未追跡の `.agents/skills/source-command-solve-next/` も残る。`.claude/plans/orchestrator-upgrade.md` と `orchestrator-upgrade 2.md` の重複。
9. **SNS の欠けの見張り**: `social-watchdog`（SNS 由来の流入）／`x-post-watchdog`／`x-metrics-watchdog`／SNS分析ツールの `x-watch`・`ig-watch`。

### 8-2. 使われていない役・スクリプト

【事実】Reviewer（参照0）／Inspector・Strategist（定期経路なし）／`run-agents.sh`／`weekly-pipeline.yml`・`daily-journal.yml`／定期タスク2定義（journal-daily・solve-next-daily）／`qa_gate.js`（自動の呼び出し0）／定期で呼ばれない audit 6本／`AGENTS.md`。

### 8-3. 健全化計画（AI組織の健全化 Phase0〜6）の現在地

【事実】
- 計画書 `~/orca/_org-audit/PLAN.md`（2026-11-09）。監査報告 `REPORT.md`。変更の記録 `changes.md`（最後の行は 11-16・Phase1,3 の後片づけ）。`_org-audit/HANDOFF.md` の先頭は `status: done`。
- 本人の指示（11-09〜10）: 「Codex は使わない／あとは全て推奨で計画完了まで／完了まで止まらず、承認は完了後にまとめて」。Phase4・5 は予定（11/16・11/27 の後）を待たず前倒しで実施（`_org-audit/HANDOFF.md:81`）。
- NB に関係する決定:
  - **D1 Codex を使わない**（AI組織設計 判断 0009・Ondine 0153）。検証役は別会話の Claude（V2）。→ NB の `AGENTS.md` と Linear の P-300（Codex の事後レビュー・期限切れ28日）は宙に浮いている。
  - **D5 司令塔は Ondine の秘書に一本化**（0009・Ondine 0191/0193）。入口は Orca のまま。
  - **D7 自動の void は仕分け役だけ・提案まで**（`auto_void=false`）。
  - **D6 健全化計画は Phase ごとに承認**。
  - 学習（CLAUDE.md への自動追記）は Phase0 で止めたまま（`learning.enabled=False`）。
  - 完了の証拠（Ondine 0190）: V2 以上は独立検証の行が無いと done を断る。
  - 承認待ちの一覧は `~/orca/_org-audit/pending-approvals.md`。
- **決定と実物の食い違い（要確認）**: Ondine 判断 0191-3 と全体 CLAUDE.md は「chiton の仕分け役は `auto_relay=false`、〜11/24 は案だけ」。実物の `~/.claude/autopilot/config.json`（更新 11-16 00:03）は `issue_triage.auto_relay=True`・`auto_relay_per_day=30`（コードの既定は2）。`issue-triage/launchd.log` に 11-15 は「渡した0件」、**11-16 07:30 は「渡した7件」**（#1695・#1780・#1845・#1862・#1414・#1935 を作業役へ、#1424 は失敗）。`changes.md` にこの切り替えの行は見当たらない。
  - 【未確認】誰がいつ決めて戻したか。本人の指示による可能性はある（11-15 に本人の「推奨で」の記録が複数ある）が、記録からは追えなかった。
- 並べて比べる2週間の期限は 11/24。その後、本人の承認で Ondine 側を apply にし、chiton の launchd を止める予定（0191-4）。

---

## 9. 「記事の独立した検証役」に、新設せず使える既存の役

【事実として在るもの・できること】
| 既存の物 | 何ができるか | 記事の検証に対する限界 |
|---|---|---|
| 日次ジャーナルのラッパーの検証の段（`run_journal_local.sh:768` 付近） | 書いた claude とは別に、シェルが `validate_journal_draft.js` を独立に実行し、落ちたら HOLD。**「生成と検証を別プロセスにする」型が既にある** | 機械の項目だけ。本文の事実の読み直しはしない |
| ラッパーの中の「2回目の claude 呼び出し」（`write_x_draft.js`。道具なしの別起動・時間切れつき・失敗しても公開は止めない） | 記事を入力に別の claude を1回呼ぶ実装の型。数字は記事の引用と照合（ADR 0047） | 用途は X の文面 |
| Ondine の独立検証（`secretary/independent_verify.js`） | 別会話の Claude・道具なしで「達成条件・差分・試験」を照合し 合格／不合格／判断できない を残す。1日の上限あり | 対象は「課題の完了」。記事1本ごとではない。上限で呼べないと「判断できない」で通る |
| design-qa（`~/.claude/agents/design-qa.md`） | 別文脈・opus・読み取り専用で、自分で撮って見て合否と所見を返す。記録の場所と「不合格は1回だけ直す」運用が決まっている | 見た目専用。対話セッションからしか呼べない |
| NB の Reviewer 文書（`agents/reviewer.md`） | 「Editor の成果物は Inspector の視点で、独自性・実在検証・JSON-LD 整合を見る」という観点表と、証跡を残す決まり | 実行の仕組みが無い（参照0）。同じ会話では独立にならないと自分で書いている |
| ap-consult／Explore（読み取り専用のサブエージェント） | 別文脈で読んで結論だけ返す | 対話セッション専用。無人の launchd 経路には無い |
| 夜間 QA（`nightly_qa.js`・`audit_journal.js`） | 公開後に、その日の差分を機械で監査し起票 | 公開の後。機械の項目 |

【提案（1〜2行）】新しい役は足さず、ラッパーに既にある「別プロセスの検証の段」に、`write_x_draft.js` と同じ型の読み取り専用の claude 呼び出しを1回足し、観点は `reviewer.md` の「Editor→Inspector」の行を使うのが、既存の型にいちばん近い。合否は自己申告にせず、指摘ごとに出典 URL か `data/stores.json` の該当箇所を出させる（制約10）。

---

## 付録: 確かめられなかったこと

- クラウドのルーチン2本の設定そのもの（指示文・権限・時刻）。PR からの読みだけ。
- デスクトップアプリが 11-13 以降動いていない理由（終了・再起動待ち・ログの場所の変更のどれか）。プロセスが無いこととログの最終時刻だけ確認。
- Ondine の Web Push が本人の端末に届いているか。
- `auto_relay` を true に戻した経緯。
- GAS の心拍が 10-21 で止まった原因、食べログ照合が 09-20 で止まった原因（Issue 本文は読んだが原因の調査はしていない）。
- SNS分析ツールの各ジョブの直近の成否（ログ末尾に `nagoya_bites` の行があることだけ確認）。
