status: in_progress

# 目的
Linear初心者が課題を選び、内容を理解し、作業を依頼・確認できる橋渡しを整える。移行時の記録と判断もこのメモに保持する。

Linear Issue作成時に画像で示された7つの品質ルールをCLAUDE.mdと起票フローへ適用する。

# 完了条件
- Notionの課題トラッカー全件をLinearへ移し、課題本文・ID・状態・優先度・カテゴリ・担当部署・日付を保持する。
- Linear上で件数・必須フィールド・課題本文を照合する。
- 自動起票・同期ルールをLinearへ向け直し、Notionへの課題書き込みを通常運用から外す。
- 元データは移行検証後も安全なアーカイブとして残す。
- Linear初心者向けに、課題の開き方・IDを使った依頼・進捗と完了の確認方法を案内する。
- 特定のLinear IDから作業に入れる方法と、backlog仕様との対応確認を記載する。
- 新規Issueに動詞タイトル、担当者、期限、初期状態、Project、背景、達成条件を揃え、30分超の作業をsub-issue化する。

# できていること
- Linearワークスペース「片桐若登」、チーム「片桐若登」（key `P`）を確認。Orca CLI経由で接続・操作可能。
- Notionの課題トラッカー`collection://6d73b2cb-579b-4772-8ef5-453ccc16833a`を特定。Notionクエリで48行を確認。重複IDやbacklogとの不一致が含まれるため、単純な現行backlog再作成ではなく48行を一件ずつ照合して移す。
- 48件すべてのページ本文を取得。ID、元Notion URL、状態、優先度、カテゴリ、担当部署、検出日・解決日を説明文に保持したCSVを`/tmp/notion-to-linear.csv`に作成。
- 2026-10-05、Orca CLI `linear save-issue` で48件をLinearチーム`P`に作成。Linearの読み戻しで件数・タイトル・本文中の元Notion URL・ID・属性を全件照合。
- 元データ上の初期状態はTodo 29件、In Progress 17件、Blocked 2件。LinearチームにBlocked状態がないため、初回はTodoへ置き、元状態は説明文に保持。
- Orca CLIのLinear接続が利用可能。`LINEAR_API_KEY` 環境変数は未設定のため、CSVインポーター用APIキーは未用意だが、Orca経由の移行には不要だった。
- Linearで48件を再照合後、現在のBacklog未完了8件もLinearへ作成。backlog IDとLinear Issue IDの対応台帳`data/linear_sync_state.json`を作成。
- backlogの状態・優先度をLinearへ反映し、チーム合計60件（移行48件＋未移行のbacklog未完了8件＋既存4件）。状態内訳はDone 17件、Canceled 1件、In Progress 25件、Todo 13件、Duplicate 4件。
- 重複元ID 4組は4件をDuplicate状態にし、各canonical Issueへのduplicate-of関係を設定。全4組の関係と状態を読み戻して確認。
- `scripts/sync_backlog_to_linear.js`を追加。標準はdry-run、`--apply`でOrca CLI経由の作成・更新。確認時dry-runで差分0件。
- `/sync-backlog`、`/solve-next`、日次・週次triage、Orchestrator、feedback/nightly-QA手順をLinearへ切替。Notion同期スクリプトとstateはアーカイブとして保持し、通常運用で実行しないと明記。
- `.claude/settings.json`とNotion Stop hookは存在しなかったため、古いNotion用hook設定例を廃止し、Linear同期手順へ置換。
- `agent-backlog.md`は課題仕様・受け入れ条件・採番の正本として維持し、Linearを進捗・担当・コメントの作業画面とする。
- Linearで全件照合・運用切替後、Notionの48ページを課題トラッカーのデータソースから親ページ`35826260-227a-81e5-95aa-f5d9fc4caa6c`へ移動。データソースは0件、元ページはNotion fetchで閲覧可能なことを確認。削除せずアーカイブとして保持。
- ユーザーがNotionからLinearへの全件移行を明示した。対象は会話文脈上、Notionの課題トラッカーとそれを維持する運用経路。
- `docs/linear-beginner-guide.md` を追加。Linearの課題選択、ID/URLでの依頼、状態・コメント・ブロック・完了の扱いと、Linear/`agent-backlog.md`の役割を説明。
- `/solve-next` がLinear Issue ID・backlog IDを受け取り、その課題から始める手順を追加。引数なしの既存候補選定は維持。
- `CLAUDE.md` と `docs/linear-task-workflow.md` から初心者ガイドへの導線を追加。
- Orca CLIの接続を確認。チーム「片桐若登」、key `P`。assigned filterは0件。ガイドの例 `P-51` と `ISSUE-032` の対応台帳を照合。
- 最終確認で `npm test` 249件成功、`git diff --check` 成功。主な変更コミットは `d3b79f84c9`、引き継ぎ更新は `01be4fd339` と `19bd7d9548`。作業ブランチへ最新 `origin/main` をマージ済み。

# 次にやること
- 2026-10-06 オーナー依頼で「おはよう/Linearにして/分解/振り返り/判断記録」を指示不要化。SessionStartフック(.claude/settings.json)→scripts/session_briefing.js、CLAUDE.md「自動で回す運用」、docs/decisions/0001、defaults(担当=me・期限P0/1/2/3=1/7/14/30日)。PR #347 マージ済み。ISSUE-134 完了。オーナー指摘で構成を Project=Nagoya Bites・KR=ラベル に修正（ADR 0003・33件移行済み）。既存33件の担当を一括設定済み。空になったKR別Project4つの削除はオーナーが承認したが、自動操作の権限設定で削除が止められたため、オーナーがLinear画面で削除する。残: ISSUE-135(P-62) 夜間サーバ側通知。
- 2026-10-06 YouTube（ClaudeをLinearに住まわせる）の要点を `docs/linear-ai-native-playbook.md` に整理済み。推奨順: ①KRをLinear Projectにする（オーナー判断・自動起票のProject既定値もこれで決まる）②夜間Linear健康診断（14日放置/Urgent未着手/期限切れ→GitHub Issue通知）③おはよう・振り返り手順のdocs化 ④ADR置き場 ⑤着手可能ラベルでAI自動着手。
- 自動起票のProject・期限の既定値を決め、CIと同期スクリプトへ反映する。
- 初心者向けガイドを起点に、Linear課題IDを伝えて作業を依頼する。必要なら候補課題の担当をLinearで割り当てる。

# 試したが駄目だったこと
- この実行環境にLinear専用MCPコネクタは見当たらない。Orca CLIの接続で移行・運用できる。
- NotionのAI検索と複数データソースクエリは現プランで利用不可。課題DBの単一データソースqueryと通常の検索/fetchは利用可能。
- `@linear/import` CLIはLinear APIで401となったため使用せず、Orca CLI経由で移行した。
- 1回目の一括更新はOrca CLIの「更新時にteam指定不可」で最初の書き込み前に停止。修正後の再実行では途中に503の未確定応答が発生したため、指定のP-41を読み戻し、変更済みを確認して再送を避けた。残りは再開して完了。
- Duplicate状態はduplicate-of関係を先に作る必要があり、4件すべて関係作成後にDuplicateへ移した。

# 守るルール・判断メモ
- Notionの課題トラッカーを削除・アーカイブするのは、Linear側の全件照合と運用切替が完了してからにする。元データを先に消さない。
- 元課題IDはLinearのタイトル/説明に残す。Notion 48件には同一ID重複が確認されているため、Linear内で衝突を隠さずNotion URLも移行記録に含める。
- LinearにBlocked状態はない。元Blockedの2件はTodoにマップし、blockerの詳細とNotion状態は説明文に保持した。
- 夜間QA→LinearのGitHub Actions同期スクリプトとworkflow接続を実装。未同期IDは `data/linear_sync_pending.json` に保持し、再実行時に再試行する。
- 7つのIssue品質ルールを `CLAUDE.md`、Linear運用文書、triage・同期コマンドに追加。backlog同期は担当者・有効な期日・Projectがない新規Issueを拒否し、CIはdefaults未設定時にIDをpendingへ保持する。
- Linearの現状を読み取り確認: チームProjectは0件、team memberは1人。唯一の担当者IDはdefaultsへ設定済み。Projectと期限方針は未設定のため、自動新規Issueは意図的に保留する。
- 新規QA IDはLinear API呼び出し前に保留キューへ保存し、同期台帳保存後に1件ずつキューから除く。API失敗や中断後の再実行でも重複を避けて回復する。
- `QA-SEC-...` のようにハイフンを複数含むIDも見出し境界として認識し、隣の課題本文を説明に混ぜない。
- 利用者が `LINEAR_API_KEY` をGitHub Actions secretに登録済み。実装ブランチで最新workflowを実行し、`viewer` API queryによるキー認証を確認。Linearへの新規起票対象が0件であることも確認。
- CIからLinearへ直接書き込む場合は、Linear APIキーをGitHub Actions secretとして利用者が登録する。認証情報を会話やログに出さない。
- mainへrebase後の `npm test`: 249件成功。Linear同期キューと複数セグメントQA IDの境界テストを追加。`node --check scripts/sync_qa_findings_to_linear.js` と `git diff --check` も成功。
- Nightly QA workflowは既存QAハード失敗で赤くなる（Linear同期step成功とは別の失敗）。
- 既存backlogは選定器と詳細仕様の正本として使われる。Linearを唯一の進捗管理先にしつつ、双方向二重更新を避ける片方向連携を設計する。

# 関連ファイル
- `docs/linear-ai-native-playbook.md`
- `docs/linear-beginner-guide.md`
- `agent-backlog.md`
- `scripts/next_task.js`
- `scripts/sync_backlog_to_notion.js`
- `data/.notion_sync_state.json`
- `CLAUDE.md`
- `docs/feedback-triage-runbook.md`
- `scripts/sync_backlog_to_linear.js`
- `data/linear_sync_state.json`
- `docs/linear-task-workflow.md`
