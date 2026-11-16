# 監査C: AI 記事制作パイプラインの実装の実態（2026-11-16 時点）

- 対象: `/Users/katagirijakutou/orca/workspaces/nagoya-bites/pilotfish`（`origin/main` と差分 0。実行元の `~/nagoya-bites` も同じコミット `0fd2534248`）
- 方法: スクリプト本体・設定・`gh run list`・`~/nagoya-bites/.local-logs/`・`data/` の台帳を読んだ。リポジトリのファイルへの書き込み・ワークフロー起動なし。
- 制約からの逸脱（1件・申告）: 調査の冒頭にワークツリーで `git fetch origin main -q` を1回実行した。「git 状態を変えない」という指示に対し、`origin/main` の追跡参照を更新しうる操作だった。結果は差分 0 で、作業ツリー・ブランチ・コミットは変えていない。ほかに実行したスクリプトは `node scripts/refresh_place_status.js --report`（通信なし・書き込みなしの報告モード）だけ。
- 凡例: 【事実】＝コードか実行記録で確かめた / 【推測】＝状況からの読み / 【未確認】＝確かめられなかった
- 期間: 「直近30日」は 2026-10-17〜11-16（31日）

## 0. 先に結論（新方針との差）

1. **日次ジャーナルは実質「全自動公開」で動いている**（31日中31日公開・欠番0・品質理由の HOLD 0）。人の承認は工程に無い。
2. **公開を止める検査は「形式と写真の帰属」だけ**。本文の事実と出典の照合、推測の目印、訪問を装う表現、注意点・不明点の有無、独自分析の有無は**どの検査も見ていない**。
3. **採点（段階ゲート PASS / PASS_WITH_NOTE / HOLD）は公開条件として強制されていない**。ラッパーは採点結果を見ない。10-22 は書き手が「候補5本の採点は省きました」と報告したまま公開された。10-21・10-22 は採点ファイル自体が無い。
4. **独立した検証の段は無い**。「独立 validator」は同じ決定的スクリプトをラッパーが再実行しているだけ。`agents/reviewer.md` はジャーナルから呼ばれない。
5. **公開後に直す・取り下げる専用の手段は無い**（X 投稿の削除だけ手動ワークフローがある）。
6. 店舗データは毎日自動更新。ただし **editorReason は 152/5,041 店（3.0%）**、Google が「閉業」と返した掲載中の店が **23 店**（人の確認待ち）。

## 機能ごとの実装状況（一覧）

| 機能 | 状況 | 根拠 |
|---|---|---|
| テーマの決定（曜日ローテ・季節・話題） | 実装済み | `scripts/pick_daily_topic.js:46-125` |
| 情報収集（WebSearch/WebFetch） | 実装済み（手順は指示文だけ。実施の検証なし） | `.claude/commands/journal-today.md:30-76` |
| 口コミ本文・SNS 投稿本文の取得 | 未実装（ジャーナルでは取らない。Google 口コミはハッシュ化して信頼度計算にだけ使用） | `scripts/lib/review_fingerprint.js:9-14` |
| 執筆（Claude・無人） | 実装済み | `scripts/run_journal_local.sh:617` |
| 候補の採点・段階ゲート | 部分実装（採点器はあるが、公開条件として強制されない） | `scripts/score_journal_candidates.js:490-494`、`run_journal_local.sh:666-773` |
| 決定的な形式検査（validator） | 実装済み（FAIL 16項目＋WARN 6項目） | `scripts/validate_journal_draft.js:47-381` |
| 写真の帰属・出所の検査 | 実装済み | `scripts/lib/hero_photo_gate.js`、validator 15/15b/15c/15d |
| 本文の事実と出典の照合 | 未実装（X 用文面の数字だけ、記事本文との照合あり） | `scripts/lib/x_post.js:235-239` |
| 推測の目印・訪問を装う表現・注意点・不明点の検査 | 未実装 | `scripts/` 全体に該当コードなし（grep 0件） |
| 独立した検証（別 AI・別プロセス） | 未実装 | `agents/reviewer.md:9`（呼び出し元は /solve-next と BUILD だけ） |
| 人の承認 | 無し（設計として迂回） | `run_journal_local.sh:828-832` |
| 公開（commit→push→Pages） | 実装済み | `run_journal_local.sh:918-955`、`.github/workflows/pages-artifact.yml` |
| X 投稿 | 実装済み（live） | `data/x_post_policy.json` mode=live |
| note 投稿 | 実装済み（live） | `data/note_post_policy.json` mode=live |
| IndexNow | 実装済み | `.github/workflows/build.yml:688-717` |
| 記事の更新・訂正・取り下げ | 未実装（手作業の git だけ） | 該当スクリプトなし |
| 再試行・自己修復 | 実装済み | `run_journal_local.sh:226-273, 606-659, 673-725` |
| 欠番の監視（サーバ側） | 実装済み | `.github/workflows/journal-watchdog.yml:30-31` |
| 特集の掲載店の月次入れ替え | 実装済み（46本） | `scripts/refresh_feature_rosters.js`、`data/feature_rosters.json` |
| 特集の新規作成の自動化 | 未実装（対話セッションで都度作成） | `git log`（後述） |
| 店舗データの日次更新（Hot Pepper） | 実装済み | `build.js:919-953` |
| 閉業の検知 | 部分実装（検知は自動・除外は人の確認後） | `scripts/refresh_place_status.js:10` |
| 新規店の実在検証 | 部分実装（Places で写真が取れなければ非表示、という間接の門） | `build.js:803-807` |
| editorReason の生成 | 部分実装（下書きは自動・反映は人の `[approved]`） | `scripts/approve_editorreason_drafts.js:5` |
| 情報の取得日をデータに残す | 部分実装（信頼度・営業状態だけ。Hot Pepper 由来の項目には無い） | `data/stores.json` の項目（後述） |

---

## 問い1. 日次ジャーナルの一連の流れ

起動: launchd `com.nagoyabites.journal`（毎日 09:00）→ `/bin/bash ~/nagoya-bites/scripts/run_journal_local.sh`【事実: `plutil -p ~/Library/LaunchAgents/com.nagoyabites.journal.plist`】。

### 1-1. 準備（ラッパー）
| 段 | 中身 | 根拠 |
|---|---|---|
| ロック | PID ファイル。90分超はハング扱いで奪う | `run_journal_local.sh:277-304` |
| 同期 | `git fetch` 6回再試行 → ジャーナル固有の残骸だけ stash → rebase（駄目なら merge） | `:360-463` |
| 既公開ならスキップ | `data/journal_published.json` に当日があれば終了 | `:474-483` |
| 認証の事前確認 | `claude --print "ok"`。認証切れなら即 HOLD | `:510-530` |
| 途中再開 | `journal/drafts/<日付>-*.html` があれば執筆を飛ばす／採点済み PASS 候補があれば写真調査から | `:539-579` |

### 1-2. テーマの決め方
- 入力: `data/journal_queue.json`（曜日ローテ。個別の枠は 2026-05-04 で終わっており、今は `rotation_rules` だけが効く【事実: queue 14件・最終 05-04】）、`data/seasonal_events.json`（priority≥80 で季節に上書き）、`data/trending_stores.json`（`buzz_score>=90` かつ未掲載で「今日の1軒」に上書き）、`data/editorial_column_backlog.json`（52本中 29本使用済み）、`data/journal_published.json`。
- 出力: 標準出力の JSON（theme / candidates / column / recent_store_ids）。`scripts/pick_daily_topic.js:46-125`
- 【事実】`trending.stores.find(s => (s.buzz_score||0) >= 90 ...)`（`:72`）は英字キー `buzz_score` を見るが、実データの項目は日本語の `話題スコア`。この上書きは発火しない可能性が高い【推測: データ全件の `buzz_score` の有無までは数えていない】。
- SEO キーワードの関与: 候補の題・リードに「エリア語＋シーン語」があると採点で最大10点（`score_journal_candidates.js:99`・語彙は `data/journal_seo_keywords.json`）。題の前30字の検査は警告だけ（validator 18）。
- 週の題材（SNS分析ツールの `next.json`）は同点時の並べ替えにだけ +2（`score_journal_candidates.js:577-588`）。

### 1-3. 情報収集
- 指示: `scripts/fetch_trending_articles.js suggest-queries` が出す検索語で WebSearch → 上位を WebFetch。順番は X → note → PR TIMES → dressing 等（`journal-today.md:30-51`）。結果は `/tmp/research-notes-<日付>.md`（リポジトリに残らない）。
- 実際に使えている情報源【事実: 直近の記事と gate_note】: ホットペッパーの店舗・コースページ、PR TIMES、東京商工リサーチ等の調査、Retty、食べログ、店の公式サイト。**X・Instagram の投稿は「検索で見つからず」「取得制限で引けなかった」という記録が多い**（10-17・10-18・10-19 の gate_note）。
- 口コミ本文: ジャーナルでは取得していない。Google の口コミは `scripts/fetch_places.js:186-220` が取るが、規約により本文は保存せずハッシュだけ（`review_fingerprint.js:9-14`）。
- Places の写真はジャーナルでは使わない（`generate_daily_draft.js:447-449`・ADR 0045）。
- **調べたことの記録は成果物に残らない**（リサーチノートは /tmp）。残るのは記事の `sources[]`（ラベル・URL・日付）だけ。

### 1-4. 候補 → 採点（段階ゲート）
- 入力: 書き手が `/tmp/journal-candidates-<日付>.json` に5本（題・リード150字・angle・sources）。出力: `data/journal_candidates/<日付>.json`。
- 即失格: 同一店90日・同一コラム180日・題の類似・リードの類似・テーマ＋店＋angle の一致（`score_journal_candidates.js:228-306`）。
- 配点（満点110・`:92-100`）:

| 項目 | 点 | 何を見るか | 分類 |
|---|---|---|---|
| recency | 25 | `sources[].date` の最新日（`:317-331`） | 決定的ルール。ただし日付は書き手の入力で、URL を開いて確かめない |
| topicality | 25 | 独立ドメイン数15＋SNS ドメインの URL 本数10（`:342-372`） | 同上（URL の実在・中身は確かめない） |
| uniqueness | 20 | angle に入っている語彙の数×5（`:380-390`） | 語の有無（中身ではない） |
| brand_fit | 15 | ベース11＋一次情報源ドメイン +4、Strategic Skip 語 −5、氏名＋役職 −15（`:398-424`） | 決定的ルール |
| writability | 10 | 主役店の有無・リードと題の字数（`:431-454`） | 決定的ルール |
| novelty | 5 | 初掲載か（`:462-485`） | 台帳との照合 |
| search_intent | 10 | 題・リードの KW | 決定的ルール |

- 判定: 100点以上 PASS／85〜99 PASS_WITH_NOTE（公開してよい・`gate_note` を残す）／85未満 HOLD（`data/journal_gate_policy.json`、`:490-494`）。
- 【事実】採点器は HTTP 通信を一切しない（`require('https')`・`fetch(` が 0件）。「検証できる事実」と呼ばれているのは「後から人が確かめられる形式」であって、**スクリプトが確かめているわけではない**。
- 【事実】採点の対象は**書く前の候補**（題・リード・出典一覧）で、**書き上がった本文は採点されない**。
- 【事実】指示文 `journal-today.md:110-118` は今も「95点以上」「95点に到達するまで繰り返す」と書いてあり、設定（100/85）・`agents/editor.md:674-680` と食い違う（`.claude/commands/` は自己改変ブロックで直せない、と `journal_gate_policy.json` の description に記載）。

### 1-5. 執筆
- 呼び方: `caffeinate -s -i -d -u claude --print "$PROMPT" --permission-mode dontAsk --allowedTools "Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Bash(node:*),…,Bash(git commit:*)"`（`run_journal_local.sh:30, 617`）。制限時間30分・最大3回（`:72, 607`）。
- プロンプト: 無人実行の前置き＋言葉の決まり（`:586-590`）＋ `.claude/commands/journal-today.md` の5行目以降（`:581`）。書き手は `agents/orchestrator.md`・`agents/editor.md`・`CLAUDE.md` を読むよう指示される。
- モデル: **`--model` の指定なし**。利用者の全体設定（`~/.claude/settings.json` の `model: fable`）に従う【事実】。モデルを変えると記事の書き手も黙って変わる。
- 認証: サブスクの OAuth（`unset ANTHROPIC_API_KEY`・`:41`）。
- 生成: 書き手が `/tmp/journal-input.json` を書き → `node scripts/generate_daily_draft.js` が `journal/_template.html` に差し込み `journal/drafts/<slug>.html` を出力。このとき写真の帰属を検査（`generate_daily_draft.js:727-741, 886`）。
- 所要時間【事実: ログ】: 開始→push まで 5〜25分が大半（中央値 約14分）。10-20 は再試行で66分。

### 1-6. 品質検査（validator の全項目）
`scripts/validate_journal_draft.js`。FAIL が1つでもあれば exit 1。

| 番号 | 内容 | 行 | 止める | 分類 |
|---|---|---|---|---|
| 1 | 店カードの店名が stores.json か pending にある | 47-54 | FAIL | データ照合（pending は書き手が同じ回に追記できる） |
| 2 | ★の数字が 0〜5 | 56-59 | FAIL | 決定的 |
| 3 | 閉店店舗を含まない | 61-64 | FAIL | **実質無効**（下記） |
| 4 | 「オーナー：◯◯」「大将：◯◯」の表記なし | 66-68 | FAIL | 決定的（正規表現） |
| 5 | 「◯円」が1回でも出る | 70-71 | FAIL | 決定的 |
| 5b | 絵文字なし | 73-78 | FAIL | 決定的 |
| 6 | 内部リンク切れなし | 80-86 | FAIL | ファイル照合 |
| 7 | JSON-LD が読める | 88-92 | FAIL | 決定的 |
| 8 | SNS 原稿の字数 | 94-105 | FAIL | 今は md 無しで常にスキップ |
| 9 | 同一店の30日以内再掲なし | 107-118 | FAIL | 台帳照合 |
| 10 | 「今日の1軒」で3観点の語（価格帯／予約・席／シーン）がある | 120-132 | FAIL | 語の有無 |
| 11 | 情報源のリンクが3件以上 | 134-138 | FAIL | 件数（中身は見ない） |
| 12 | 「2026年X月」「直近」「最近」「先週」「今週」のどれかがある | 140-145 | FAIL | 語の有無 |
| 13 | 30日以内の日付の出典がある | 147-156 | WARN | 書き手が書いた日付 |
| 14 | ヒーロー画像がある | 158-179 | FAIL | 決定的 |
| 15 | ストック写真のドメインでない | 181-207 | FAIL | 決定的 |
| 15b | ヒーローが記事の店の写真・使い回しなし | 209-251 | FAIL | 帰属の照合 |
| 15d | Places の写真 URL を書いていない | 253-265 | FAIL | 決定的 |
| 15c | 本文写真の帰属・重複なし | 267-299 | FAIL | 帰属の照合 |
| 15d' | 写真の枚数（目安3枚） | 301-313 | WARN | 決定的 |
| 16 | 題の KW と SNS 原稿の整合 | 315-342 | WARN | 決定的 |
| 17 | 本文で触れた実在店に店舗ページへのリンク | 344-362 | WARN | データ照合 |
| 18 | 題の前30字にエリア・店名・シーン語 | 364-381 | WARN | 決定的 |

- 【事実】項目3 は `s['公開フラグ'] === 'FALSE'` の店を閉店とみなすが、`data/stores.json` の 5,041 店に `公開フラグ` の項目は1件も無い（実測）。**この検査は常に通る**。閉店の除外は build.js 側（`data/closed_stores.json` 111件・`build.js:1456`）が担っており、一時休業 26 店・Google が閉業と返した 23 店は記事に載せても止まらない。
- AI の自己申告に頼る項目: 13（日付）、1（pending への自己追記で通る）。「AI が自分を評価して点を付ける」検査は無い。
- 公開後に CI で走る検査: `npm test`（190ファイル・約2,100件。言葉の決まり `audit_selection_wording`、写真の出所表記、紹介店の欄など）と `scripts/audit_journal_photos.js --check`（`build.yml:136-144, 539-549`）。**これらはラッパーの公開条件ではない**（書き手が自発的に `npm test` を回して直した日はある・11-16 のログ）。

### 1-7. 承認
- 人の承認は無い。指示文には「ユーザーに見せて承認」「承認後のみ push」（`journal-today.md:256-272`）が残っているが、ラッパーが「claude の承認待ちフローを迂回」して commit・push する（`run_journal_local.sh:828-832`）。前置きで「質問や確認待ちで止まらないこと」と指示（`:589`）。

### 1-8. 公開
1. `data/journal_published.json` に当日の行があるか（無ければ成果物から自動復旧: validator → `register_journal_entry.js --by-wrapper`・`:673-725`）
2. `journal/<slug>.html` の実在（`:737-747`）
3. validator を再実行（`:770`）
4. `journal/feed.xml` に載っているか（`:776`）
5. 関連記事リンク・サイト紹介文・OG 画像・X 文面・X 画像カード（すべて失敗しても続行・`:789-826`）
6. 当日のファイルと台帳だけを `git add` → commit → `git push origin main`（拒否なら1回だけ取り込み直して再 push）→ origin に記事のコミットがあるか確認（`:884-955`）
7. GitHub Pages: `pages-artifact.yml` が **main への push で即配信**（許可リスト方式・ADR 0061）。`build.yml` の `npm test` の成否を待たない【事実: `on: push: branches:[main]` と `workflow_run … types:[completed]`】。

### 1-9. 公開後
- X: `x-post.yml`（`data/journal_published.json` の push で起動、11:30 JST まで待って投稿）。文面は Mac 側で別の Claude 呼び出し（`claude --print --safe-mode --tools ""`・`write_x_draft.js:258`）が書き、**文面の数字が記事本文の引用にあるか**を検査（`x_post.js:235-239`）。直近31日で31件投稿。
- note: `scripts/post_note.js`（mode=live・失敗時1回やり直し・`run_journal_local.sh:960-975`）。
- IndexNow: `build.yml:688-717`。
- note の数字の取得: `scripts/fetch_note_stats.js`（`:981`）。

### 1-10. 更新・削除・公開停止
- ジャーナル記事を後から直す・取り下げる専用の手段は**無い**（`scripts/` に unpublish・訂正の道具なし）。あるのは X 投稿の削除（`x-delete.yml`・手動のみ・11-13 に2回実行して2回失敗）と、題・説明文の書き直し（`scripts/search_ctr_rewrite.js --revert`）、関連リンクの張り替えだけ。
- 公開後に記事の事実（価格・期間・閉店）が古くなったことを検知する仕組みは無い。閉店店の本文残存の監査（`audit_closed_store_mentions.js`）は他都市店の除外用。

### 1-11. エラー処理・自己修復・監視
- 利用上限: 解除時刻を読んで待つ（最大330分・2回・`:239-273`）。ネットワーク瞬断: 文言一致で最大3回（`:652`）。ハング: 30分で打ち切り（`:99-116`）。push 拒否: 再同期して1回。autopilot ブランチに切られた場合は main へ戻す（`:872-882`）。
- HOLD: `.local-logs/HOLD-<日付>.md` と `data/journal_health.json` を push（`:191-224`）。
- 監視: `journal-watchdog.yml`（1日2回）が `scripts/check_journal_health.js` で欠番を見て Issue（＝メール）。X・note・話題店・フィードバック・GAS・特集ロスター・リンク照合にも同型の見張りがある。

---

## 問い2. 品質検査が今見ていないもの（新方針との照合）

| 新方針の要求 | 現状 | 根拠 |
|---|---|---|
| 本文の事実主張と出典の照合（数字以外も） | **見ていない**。出典は「リンクが3件以上」だけ。URL を開く検査なし | validator 11（`:134-138`）。採点器・validator とも HTTP 通信 0件 |
| 本文の数字と出典の照合 | **見ていない**（X の文面→記事本文の照合だけ） | `x_post.js:235-239` |
| 確認済み情報と推測の区別（推測の目印） | 見ていない | 該当コードなし |
| 訪問を装う表現（実食・来店したように書く） | 見ていない | `scripts/` と `data/*policy*.json` を「実食／訪れた／食べてみ／来店した／訪問し」で検索して 0件 |
| 注意点（魅力だけでなく） | 見ていない | 該当コードなし |
| 不明点の明示 | 見ていない | 同上 |
| サクラ・サービス品質の断定 | ジャーナルでは見ていない（信頼度表示の文言監査 `audit_trust_wording.js` は店舗ページ側） | `build.yml:623-631` |
| 情報源と確認日の追跡 | 部分的。出典に日付を付けられるが「掲載日」表示で、**確認日（閲覧日）の欄は無い**。日付なしでも通る（WARN のみ）。10-22 は書き手が「閲覧日（今日）」を出典の日付に使った | `generate_daily_draft.js:190-197`、validator 13、10-22 のログ |
| 独自の点数・星で序列化しない | 見ていない。記事は★を書ける（検査2 は範囲だけ）。特集は Google 評価などの加重スコアで店を選び★を表示 | `refresh_feature_rosters.js:10-12`、`features/banquet.html:185` |
| 転載・要約で終わらない独自分析 | 語の有無だけ（今日の1軒の3観点・validator 10）。他テーマは検査なし | `:120-132` |
| 利用条件（追加料金など）の記載 | 見ていない（「円」が1回出れば通る） | validator 5 |
| 文章の引用量・転載（写真以外の権利） | 見ていない | 該当コードなし |
| 人が選んだと読める言い方 | 見ている（ただし公開後の CI。ラッパーは見ない） | `data/selection_wording_policy.json`（error 10語）、`tests/selection_wording_*.test.js` |
| 写真の権利・帰属 | 見ている | validator 15・15b・15c・15d |
| 架空店 | 部分的（店カードの店名がデータにあるか。本文中の店名は警告のみ） | validator 1・17 |

補足【事実】: 実際の記事（11-16）は、推測を「〜と考えられる」「店は理由を書いていない」と書き分け、掲載情報の食い違い（個室の有無）を明記している。ただしこれは**プロンプトとモデルの振る舞いの結果**で、検査が担保しているものではない。

---

## 問い3. 独立した検証の有無

- **無い**【事実】。
  - ラッパーの「独立 validator」（`run_journal_local.sh:768-773`）は、書き手が回したのと同じ `validate_journal_draft.js` を別プロセスで再実行するもの。別の AI は入らない。
  - `agents/reviewer.md` はコード変更（/solve-next の QA ゲートと BUILD）のための役で、ジャーナルの経路（`run_journal_local.sh`・`journal-today.md`）から参照されない。リポジトリ内の参照は `agents/orchestrator.md`・`agents/designer.md`・backlog だけ。reviewer.md 自身が「真に独立した監査は原理的に不可能」「緩和策にすぎない」と明記（`:17-27`）。
  - 別プロセスの Claude 呼び出しは X 文面づくりだけ（道具なし・検査は決定的ルール）。
- CI（`build.yml`・`nightly-qa.yml`）は公開の後に走る決定的検査。

---

## 問い4. 特集記事

- 本数: `features/` に 73 ファイル（一覧・方針ページ含む）。初回追加は 2026-04 に20本・05 に46本・06〜11 に計7本【事実: `git log --diff-filter=A`】。
- 作り方: **本文は対話セッションで作った手書き（AI 生成）**。直近の新規は 10-30 の一人飲み2本（Ondine #1067）、11-13 の冬もの2本（Ondine #1865）で、どちらも作業セッションのコミット。定期的に新しい特集を作る仕組みは無い。`scripts/gen_industry_features.js`（3本を `data/editor_picks.json` から生成）はどのワークフローからも呼ばれない。
- 店の入れ替え: `scripts/refresh_feature_rosters.js` が 46 本を対象に月1回（`build.yml:283-292` が毎日 `--if-stale`）。固定コア＋月替わりの枠を、crossCheck・Google 評価・口コミ数・トレンド等の加重スコアで選ぶ。最終反映は 2026-11-01（45/46 更新・枠割れ3・status=partial・`data/feature_roster_health.json`）。
- 日次の自動整形（`build.yml:278-365`）: 旬のリード、店カードのリンク、★の同期、冒頭の結論（`apply_feature_conclusions.js`）、公開日・更新日、掲載数の表記、計測。
- 最終更新の分布: 全73ファイルが 11-13〜11-16 に機械の一括整形で触られており、`git log` の日付は中身の鮮度を示さない【事実】。本文（導入・解説）を定期的に見直す仕組みは無い。
- `weekly-pipeline.yml`（週次のエージェント実行）は手動起動だけで、最後の実行は 2026-05-18。`build_features.js` もどのワークフローからも呼ばれない（テスト2本が関数を読むだけ）。

---

## 問い5. 店舗データの更新フロー

- 取得: `build.js` が Google Sheets の CSV と Hot Pepper グルメ API（名古屋の中エリア12・1,000件超は小エリアで取り直し）を**ビルドのたびに全件取得**（`build.js:18, 561-573, 919-953`）。直近の取得は 5,834 件（`data/hotpepper_fetch_log.json`）。
- Hot Pepper から取る項目（`build.js:599-655`）: 店名・ジャンル・サブジャンル・エリア・住所・緯度経度・価格帯・平均予算・営業時間・定休日・最寄駅・アクセス・キャッチ・席数・宴会収容・個室・カード・禁煙・駐車場・ランチ・コース・飲み放題・食べ放題・ID・写真。電話は API が返さない。口コミは無い。
- 頻度: `build.yml` は毎日 03:00 JST＋main への push のたび（直近31日で 205 回）。
- 自動のもの: 話題店の自動追加（`daily-store-add.yml`・毎日・Gemini＋検索グラウンディングで `data/manual_stores.json` に追記。10月21店・11月13店）、今日の話題店 TOP5（`daily-trending5.yml`）、営業状態の取り直し（`place-status.yml`・1日100店）、Places の評価（`weekly-places.yml`・週1）、メディア掲載（`weekly-media.yml`・週1）、話題店発掘（Claude の定期ルーチン・心拍 31日中24日）。
- 閉店・移転の検知: `refresh_place_status.js` が Google の営業状態を取る。**自動では外さない**（`:10`）。現在「取り直した店 3,003／閉業 23／一時休業 19」が掲載中のまま【事実: `--report` の出力】。除外は人が一次情報で確かめ `data/store_liveness_reviews.json`（37件）→ `data/closed_stores.json`（111件）。
- 実在検証: 新規の手動店は必須項目・愛知県・出典 URL が http で1件以上、で `manual_stores.json` に入る（`daily_store_discovery.js:103-143`。**URL の中身は確かめない**）。その後 `fetch_manual_store_photos.js`（店名一致＋住所＋業態の三重検証）で写真が取れなかった店は非表示（`build.js:803-807`）。取得を試す前の新着は表示される。ジャーナル経由の `data/pending_stores.json` は 148 件（`merged` が true は1件。build.js が毎回合流させる方式）。
- editorReason: `editorreason-batch.yml`（週1・Gemini）が下書きを作り、**人が `docs/editorreason-drafts.md` に `[approved]` を付けて** `approve_editorreason_drafts.js` を実行すると反映。下書きのキャッシュ 174 件、`data/editor_picks.json` 166 店。**stores.json 上のカバー率は editorReason 152/5,041（3.0%）・mediaFeatures 149・insiderNote 141・visitStatus 152**（内訳: desk 85／desk_automated 53／industry_known 10／visited 4）。
- 取得日がデータに残るか: 残るのは `reviewTrust.d`（信頼度の算出日）、`data/place_status.json` の `checkedAt`、手動店の `追加日`（210店）だけ。Hot Pepper 由来の営業時間・価格帯などに項目ごとの取得日は無い（毎ビルドで上書き）。

---

## 問い6. 直近30日の実行履歴（2026-10-17〜11-16）

### ジャーナル
- 公開 31/31 日。`data/journal_published.json` に 08-01 以降の欠番なし。
- 採点ファイルがある 29 日の内訳: **PASS 8 日／PASS_WITH_NOTE 21 日／HOLD 0 日**。採点ファイルが無い日: 10-21・10-22。
- 品質理由の HOLD: 0。ラッパーの自動復旧（未登録を救う経路）の発動: 0。再試行: 10-20 に1回。利用上限での待ち: 0。
- 遅れ: 10-29（開始 13:45）・11-05（開始 12:49）は Mac の起動が遅れた日【推測: スリープ】。10-31 は autopilot が作業ブランチを切り、戻した後の再同期で ssh が失敗（`journal-2026-10-31.log:874, 1019`）。同日中に公開され、watchdog の Issue #709・#703 は自動クローズ。
- 10-22【事実: ログ】: 生成が約2分半で終わり、書き手の報告に「手順にある候補5本の採点は省きました」「ホットペッパーの店舗ページ自体は開いて確かめていません」「出典のうち30日以内の日付は閲覧日（今日）だけ」。それでも公開された。当時は `--dangerously-skip-permissions`（10-29 に最小の道具だけに変更・`run_journal_local.sh:28-30`）。
- `gate_note` は書き手の自由記述で、台帳の項目名も揺れている（`gate`・`score`・`gate_score`・`gate_verdict`・`gate_status`・`verdict` が混在）。

### GitHub Actions（件数は 10-17 以降）
| ワークフロー | 成功 | 失敗 | 主な原因 |
|---|---|---|---|
| build.yml | 167 | 31（他に取消7） | `npm test` の1件落ち。10-21〜23 と 10-29〜30 は「確かめていない誘導ページへのリンク」（店舗更新で特集のリンク先が転送ページ化）、11-13 は Pages 切り替え時の workflow_run 一覧のテスト。11-02 は bot コミットの rebase 衝突 |
| journal-watchdog.yml | 59 | 3 | 欠番検知＝意図どおりの失敗（10-29・10-31） |
| x-post.yml | 93 | 2 | 11-13 は投稿できず、11-09 は定時分 |
| pages-artifact.yml | 103 | 0 | 11-13 開始 |
| routine-pr-automerge.yml | 182 | 6 | — |
| daily-store-add.yml | 30 | 1 | — |
| daily-trending5.yml | 30 | 0 | — |
| place-status.yml | 29 | 0 | — |
| nightly-qa.yml | 27 | 3 | 夜間 QA の検知（Issue #654・#706） |
| gas-deploy-watchdog.yml | 5 | **25** | GAS レポートが旧コードのまま（Issue #694 が 10-25 から開いたまま） |
| editorreason-batch.yml / weekly-places.yml / weekly-media.yml | 4 / 4 / 5 | 0 | — |
| daily-journal.yml | 実行なし | — | 最終 2026-05-20 |
| weekly-pipeline.yml | 実行なし | — | 最終 2026-05-18 |

- 開いたままの警報: #694（GAS・22日）、#665（食べログのリンク照合が 09-20 から止まっている）、#628（Linear の期限切れ21件）、#704（写真の店名照合の誤一致）。
- フィードバックの心拍は 11-13 が最後（31日中15日）。

---

## 問い7. 実行コスト

| 項目 | 形態・量 | 費用の記録 |
|---|---|---|
| Claude（執筆・X 文面・定期ルーチン） | サブスクの OAuth。API キーは使わない（`run_journal_local.sh:41`）。1日あたりジャーナル1回（5〜25分）＋X 文面1〜2回＋プリフライト1回 | **トークン量・回数の台帳は無い**（記録なし）。利用上限に当たった記録は直近31日で0 |
| Anthropic API | `daily-journal.yml`・`weekly-pipeline.yml` が鍵を前提にするが 5月から未実行 | 記録なし（実質0）【推測】 |
| Places API | 11月の累計: Text Search 104・Details 84・Photo 78（店舗写真）＋営業状態の取り直し 1,598（10月 1,405）。月の自制枠は 4,000/4,000/800 と 3,000 | 回数の台帳あり（`data/photo_pipeline_health.json`・`data/place_status.json`）。**円の記録は無い**。メモでは無料枠内（旧 SKU 各5,000件/月）だが、旧 API と New のどちらで請求されるかは未確認と明記 |
| X API | 投稿 31件/31日（URL 付き）。数字の取得は毎日・競合は週1 | 円の台帳は無い。メモの単価は URL 付き投稿 0.20 ドル/回 → 投稿だけで月 約6ドル【推測: 単価×件数。返信・読み取りの分は未計上】 |
| Hot Pepper API | 1ビルドで全件取得×1日 約7回 | 無料。回数の上限に対する記録なし |
| Gemini API | 話題店の自動追加（毎日）・editorReason 下書き（週1） | 無料枠と記載（`daily_store_discovery.js:10-13`）。実績の記録なし |
| GitHub Actions | 31日で主要ワークフロー 約1,400 回 | 記録なし |

- ジャーナル用の Places 台帳 `data/photo_pipeline_health_local.json` はリポジトリに無い（ジャーナルは Places の写真を使わなくなったため未作成と見られる【推測】）。

---

## 問い8. 自動公開の条件と、人が関与する箇所

### 今、人を介さず公開される条件（すべてラッパーの判定）
1. `data/journal_published.json` に当日の行がある（書き手が書くか、ラッパーが成果物から登録）
2. `journal/<slug>.html` がある
3. `validate_journal_draft.js` が exit 0（上表の FAIL 項目すべて）
4. `journal/feed.xml` に slug がある
5. commit に記事 HTML が含まれ、push が通る

**条件に入っていないもの**: 採点の判定（PASS／PASS_WITH_NOTE／HOLD）、採点を実施したか、`npm test`、言葉の決まりの監査、出典の実在、Web 調査を実施したか。

### 人が関与する箇所
| 場面 | 人の作業 |
|---|---|
| Mac の電源・スリープ | AC 接続・起動（バッテリー時の蓋閉じは防げない） |
| Claude の認証切れ | 対話ログインのやり直し |
| HOLD・die の後 | 手動で再実行（`.local-logs/HOLD-*.md` の手順） |
| 警報 Issue（メール） | 読んで対処 |
| 閉業の確定・除外 | 一次情報で確認し台帳に記録（今 23 店が待ち） |
| editorReason の反映 | 下書きに `[approved]` を付ける |
| 新しい特集 | 対話セッションで依頼 |
| note のログイン切れ・X の鍵 | 再ログイン・鍵の登録 |
| 記事の訂正・取り下げ | 手作業の git |
| マネタイズ・信頼系の変更 | 承認（制約7・8） |

---

## 問い9. 重複・不要になっていそうな処理（削減候補）

| 候補 | 根拠 | 確度 |
|---|---|---|
| `.github/workflows/daily-journal.yml` | 手動起動だけ・API キー前提・最終実行 2026-05-20。launchd 経路と二重 | 高 |
| `.github/workflows/weekly-pipeline.yml` | 手動起動だけ・最終実行 2026-05-18。中の Hot Pepper 人気順・メディア取得は別ワークフローが担当 | 高 |
| `~/.claude/scheduled-tasks/nagoya-bites-journal-daily` | 6月の旧経路。作業先 `.claude/worktrees/journal-daily` が存在しない。有効かどうかは未確認 | 中 |
| `~/.claude/scheduled-tasks/nagoya-bites-solve-next-daily` | 説明に「[無効化]」 | 高 |
| ルート直下 `debug_bing*.js`・`debug_ddg2.js`・`debug_google.js`・`debug_ig*.js`・`debug_scrape.js`・`debug_yahoo.js`（9本） | 最終更新 2026-04-21・参照 0件 | 高 |
| `cleanup_ig.js`・`fetch_ig_photos.js`・`fetch_scores.js`・`fill_recommendations.js`・`fix_tags.js`・`write_recommendations.js`・`run-agents.sh`・`run_ig_all.sh`・`run_ig_posts_all.sh`・`run_ig_posts_resolved_all.sh`・`setup.sh`・`setup_sa.sh`・`_extract_stores.js`・`gen_recommendations_hp.js` | 参照 0件。大半は 2026-04-21 のまま | 高 |
| `sprint-1〜3-report.md`・`sprint-*-feedback.md`・`spec.md`・`build-report.md` | 4月の初期開発の記録。現行の経路から読まれない | 中 |
| ルートの `hotpepper_fetch.js`（Sheets へタグを書く旧スクリプト） | `package.json` の `hotpepper` からだけ。現行の取得は `build.js`＋`scripts/lib/hotpepper_fetch.js` | 中 |
| `build_features.js` | どのワークフローからも呼ばれない。テスト2本が関数を読むだけ。掲載店の入れ替えは `refresh_feature_rosters.js` が担当 | 中（テスト依存の整理が要る） |
| `scripts/gen_industry_features.js` | ワークフロー・スクリプトからの呼び出しなし。対象3本はその後ロスターと手直しが入っている（ファイル冒頭の注記） | 中 |
| `generate_daily_draft.js` の Unsplash 部分（`GENRE_PHOTO_MAP`・`tryUnsplashApi`・`pickCuratedPhoto`・`:205-358`） | `fetchPhotoForArticle` はもう呼ばない（`:451-457`）。スキーマ説明にも Unsplash が残る | 高 |
| SNS 原稿（`docs/daily-posts/*.md`）関連 | 2026-09-05 から生成停止。validator 8・16、`audit_journal_sns_pairing.js`、指示文 Step 11 が残る | 中 |
| validator 項目3（閉店チェック） | 上記のとおり常に通る。直すか外すか | 高 |
| `pick_daily_topic.js:72` の話題店上書き | キー名の不一致で発火しない可能性 | 中（要確認） |
| `journal-today.md` の「95点」「承認後のみ push」「Unsplash でフリー素材」 | 実装・設定と食い違う。自己改変ブロックで直せないため、ラッパーの前置きで上書きしている | 高（人の手で直す必要） |
| 1日約7回の全件ビルド | push のたびに Hot Pepper 全件取得と約70ステップ。31日で 205 回・失敗 31 回 | 中（頻度の見直し候補） |

---

## 確認できなかったこと
- Web 調査を各日どこまで実施したか（リサーチノートが /tmp にしか無く、ログには最終報告しか残らない）。
- 出典 URL が実在し、記事の記述と合っているか（今回は照合していない）。
- 定期ルーチン（SEO・フィードバック・話題店発掘）の実行基盤の設定画面と有効・無効（心拍のコミットで動作だけ確認）。
- Places・X の実請求額（請求画面は見ていない）。
- `pick_daily_topic.js` の話題店上書きが実データで発火するか（全件は数えていない）。
