status: archived

# 2026-10-13 自律実行ラン（solve-next）

**結果: 実装0件**。全 ready タスクが以下のいずれかに該当し、安全フィルタで除外された:
- **future-dated**: SEO-125（10-15）、SEO-126（11-15）、SEO-128/130（11-20）、SEO-140（11-15）、SEO-141（11-30）、SEO-148（11-06）、SEO-118（10-20・ポスト修正データ 4日分のみ・7日必要）、ISSUE-183（10-17・ポスト修正データ 4日分のみ・8日必要）
- **owner-gated**: SEO-132（about.html 運営者プロフィール確認待ち）、SEO-142（Organization sameAs URL提供待ち）、SEO-129（editorReason 承認待ち）、ISSUE-133（22店舗の閉店確認・手動）、SEO-098（X プロフ/ストーリーズ変更・オーナー操作）
- **API-key-gated**: ISSUE-116（GOOGLE_MAPS_API_KEY/HOTPEPPER_API_KEY・ローカルのみ）、ISSUE-110（npm 脆弱性修正・実APIキーで検証必要）

**次のエージェントアクション**:
- 2026-10-15: SEO-125 — `data/gsc_metrics.json` の `pageTypes.area_hub` 表示回数を `docs/kpi-weekly.md` に基線として記録
- 2026-10-17: ISSUE-183 — `node scripts/hotpepper_fetch_report.js --churn --days 8` で HotPepper 出入り検証
- 2026-10-20: SEO-118 — GA4 基線再取得（修正から7日以上経過後）

**次のオーナーアクション**:
- SNS-002: `docs/x-api-setup.md` の手順で X API キーを GitHub Secrets に登録 → X 自動投稿 live 化
- SEO-132: `about.html` に記載する運営者プロフィール（業界経験・肩書）を確認
- SEO-142: Organization JSON-LD の sameAs に入れる公式アカウント URL（Twitter/Instagram/etc）を提供

---

# 目的
オーナーの依頼（2026-10-12）「日次ジャーナルをもとに X へ毎日の発信を投稿まで全自動にしたい」。計画書を作った後、「今から寝るので進める分は進めて」（同日夜）を受けて、X に送らない試運転の形で実装した。
（前のメモ「GA4 訪問者増の検証」は status: done。内容は git 履歴 c49bf60faf の HANDOFF.md）

# 完了条件
- ジャーナルが公開された日に X に1件だけ投稿され、台帳 data/x_post_log.json に残る（7日連続・人の操作なし）
- 失敗は原因つき Issue、復旧で自動クローズ

# できていること
- 計画書 docs/x-auto-posting-plan-2026-10.md（PR #526 で main）。14 章に実装の状況
- 実装: scripts/lib/x_post.js / scripts/post_journal_to_x.js / data/x_post_policy.json（mode=dry-run）/ scripts/check_x_post_health.js / .github/workflows/x-post.yml / x-post-watchdog.yml / tests/x_post.test.js（18件）/ docs/x-api-setup.md / docs/decisions/0027-x-auto-posting.md / CLAUDE.md の共有ファイル表
- 直近60本の記事で試運転し60本とも検査を通過（最長 179／280）。npm test 1197 件通過
- Linear: P-293（親）・P-294（オーナーの鍵の登録）・P-295（スクリプト・done）・P-296（試運転→本番）・P-297（見張り・partial）

# 次にやること
- オーナーが docs/x-api-setup.md の手順で鍵を登録（P-294）し、計画書 11 章 #1（外の仕組みとの二重投稿）・#3（費用）に答える
- 試運転の Summary を一緒に見る → Actions の Run workflow（force_live）で初回投稿 → policy の mode=live・liveSince=当日
- 本番に切り替えるとき social-watchdog.yml の「自動投稿はスコープ外」の文言を直す（P-297）

# 試したが駄目だったこと
- `node scripts/sync_backlog_to_linear.js --apply` は使わない: SNS 以外に 86 件の更新・5 件の重複処理が出る（Linear 側で進んだ状態を戻す恐れ）。SNS の課題だけを orca linear save-issue で個別に更新する
- 記事の題名に依存するテスト（直近60本が全部通る）は入れない: 今後の題名しだいで build.yml の npm test（blocking）が止まる
- 判断の記録の番号 0023 は他のブランチで使われている恐れがあり 0027 にした（main には 0024〜0026 がある）

# 守るルール・判断メモ
- mode=live への切り替えはオーナーの OK の後（外部への送信・課金）
- 写真は X にアップロードしない（HotPepper 規約）。リンクカードで見せる
- 題名の「〜を業界人が読む」は X の文面に限って「〜を読む」に置き換える（60本中17本がこの形）
- 起点は公開の push。GitHub の定時実行は数時間遅れる（実測 4〜6 時間）ので時刻は約束しない
- 二重投稿の防止: 台帳＋concurrency＋X の重複拒否（duplicate を届いた印として記録）
- X API は従量課金。リンク付き投稿 0.20 ドル/回（docs.x.com 2026-10-12 確認）

# 関連ファイル
- docs/x-auto-posting-plan-2026-10.md / docs/x-api-setup.md / docs/decisions/0027-x-auto-posting.md
- scripts/post_journal_to_x.js / scripts/lib/x_post.js / scripts/check_x_post_health.js / data/x_post_policy.json
- .github/workflows/x-post.yml / .github/workflows/x-post-watchdog.yml / tests/x_post.test.js
