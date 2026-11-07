# SEO日次トリアージ — 復旧ランブック（SEO-152）

> このドキュメントは `seo-triage-daily-watchdog.yml` が Issue を起票したときの
> 対処手順と、窓の外へ落ちたレポートを遡って処理する方法を記す。

---

## よくある停止原因と対処

### 1. スケジュールが止まっている

claude.ai のスケジュールで日次トリアージが登録されているか確認する。
- タスク ID: `nagoya-bites-seo-triage-daily`
- 実行時刻: 毎日 21:01 JST
- 動作確認: `node scripts/check_seo_triage_daily_health.js`

登録されていなければ再登録し、翌日の実行を待つ。

### 2. Gmail 認証切れ

Gmail MCP の認証が切れているとメール取得で失敗する。
claude.ai の接続設定（Gmail）を再認証する。

### 3. GAS が止まっている（メールが届いていない）

GAS のダッシュボードで `Google分析オートLINE送信.js` のトリガー設定を確認する。
メールが届いていない場合は日次トリアージの入力自体がないため、
その日はスキップとして扱い、GAS を再起動して次回分から自動処理を再開する。

---

## 窓の外へ落ちたレポートの遡り処理

`/seo-triage` の自動取得は `newer_than:2d` のため、2日以上前のメールは
自動では取得できない。停止が長引いた場合は手動で遡って処理する。

### 手順

1. **未処理メールを洗い出す**

   Gmail で以下のクエリを使って対象期間のレポートを一覧する
   （`newer_than` を外し、`in:anywhere` で TRASH も含める）:

   ```
   subject:"NAGOYA BITES 日次レポート" in:anywhere
   ```

   対象は最後の line-daily エントリの日付の翌日から今日まで。
   `node scripts/check_seo_triage_daily_health.js` で最終処理日を確認できる。

2. **1通ずつ `/seo-triage` で処理する**

   各メールの「💡今日のアドバイス」セクションを手動で `/seo-triage` に貼り付けて実行する。
   台帳突合（fingerprint 重複チェック）があるため、同じ内容を再処理しても二重起票にはならない。

3. **完了確認**

   ```bash
   node scripts/check_seo_triage_daily_health.js
   ```

   `✅ 健全` が出れば復旧完了。

4. **watchdog ワークフローを手動実行してクローズ**

   GitHub Actions の `seo-triage-daily-watchdog.yml` を `workflow_dispatch` で
   手動実行すると、健全と判定されて自動で Issue がクローズされる。

---

## 定期実行の指示文への emoji 削除の反映（SEO-152 criterion 3）

**オーナーへの依頼**: スケジュール済みルーチンの実行指示文に Gmail 検索クエリが
含まれている場合、その `subject:"📊 NAGOYA BITES 日次レポート"` を
`subject:"NAGOYA BITES 日次レポート"` に変更してください。

変更が必要な箇所:
- claude.ai のスケジュールタスク `nagoya-bites-seo-triage-daily` の実行指示文
- 同様に `nagoya-bites-seo-triage-weekly` の実行指示文の `subject:"📊 NAGOYA BITES 週次レポート"`

理由: 2026-11-03/04 の実測で、絵文字を含む検索クエリは同じ条件でも日によって
0件を返すことがある（`subject:"📊..."` → 0件、`subject:"NAGOYA BITES..."` → 2件）。
`.claude/commands/seo-triage.md` と `seo-triage-weekly.md` は修正済み（SEO-152・2026-11-07）。
定期実行の指示文はオーナーのみが変更できるため、この依頼を添える。

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `scripts/check_seo_triage_daily_health.js` | 生存確認スクリプト（CI・手動） |
| `.github/workflows/seo-triage-daily-watchdog.yml` | GitHub Actions 監視（毎日 17:00 JST） |
| `data/seo_advice_log.json` | 判定ログ（append-only。`source:"line-daily"` エントリが心拍） |
| `.claude/commands/seo-triage.md` | 日次トリアージの実行コマンド |
| `scripts/check_seo_triage_weekly_health.js` | 週次トリアージの生存確認（同じ構造） |
| `.github/workflows/seo-triage-weekly-watchdog.yml` | 週次トリアージの GitHub Actions 監視 |
