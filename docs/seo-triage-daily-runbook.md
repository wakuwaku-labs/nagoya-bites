# SEO日次トリアージ — 運用ランブック（SEO-152）

> このドキュメントは、日次トリアージが止まったときの対処手順を記載します。
> 生存監視は `.github/workflows/seo-triage-watchdog.yml` → GitHub Issue →
> オーナーメール の経路で届きます。

---

## 窓の外に落ちたレポートを遡って処理する

### なぜレポートが「落ちる」のか

`/seo-triage` の自動実行（Step 0）は
`subject:"NAGOYA BITES 日次レポート" newer_than:2d` で Gmail を検索します。
定期実行が1回抜けると、その日のレポートは **48時間後に窓の外に出て二度と自動取得されません**。

### 手順

1. **停止期間の特定**

   `data/seo_advice_log.json` の最新の `source: "line-daily"` エントリの `date` を確認する。
   例: 最後の処理が `2026-11-05` なら `2026-11-06` 以降が未処理。

   ```bash
   node scripts/check_seo_triage_health.js
   ```

2. **Gmail で未処理レポートを検索**

   Gmail で以下のクエリを実行する（絵文字なし・`in:anywhere` で TRASH も含む）:

   ```
   in:anywhere subject:"NAGOYA BITES 日次レポート" after:2026-11-05
   ```

   > **注意**: `subject:` に 📊 などの絵文字を入れると Gmail の実装によって
   > 0件になることがある（2026-11-03/04 実測）。絵文字なしのクエリを使うこと。

3. **各レポートを処理**

   未処理レポートを古い順に1通ずつ開き、「💡今日のアドバイス」セクション（`🔴`/`🟡`/`🟢`/`💡` + `👉`）をコピーして
   `/seo-triage` コマンドに貼り付ける。

   - 台帳突合（fingerprint 重複チェック）があるため **二重起票にはなりません**。
   - 採用/却下0件でも `data/seo_advice_log.json` にエントリが追記されます。

4. **復旧確認**

   処理後にスクリプトを実行し、健全と出ることを確認する:

   ```bash
   node scripts/check_seo_triage_health.js
   ```

5. **生存監視の Issue がある場合**

   `.github/workflows/seo-triage-watchdog.yml` を手動実行するか、
   翌日の自動実行を待つと Issue が自動クローズされます。

---

## `/seo-triage` コマンドの Gmail 検索クエリについて（オーナーへの依頼）

> **【オーナーへのお願い】**
> 下記の変更を `.claude/commands/seo-triage.md` と `.claude/commands/seo-triage-weekly.md` に
> 手動で反映してください（自動編集は行いません）。
>
> 変更内容:
> - Step 0 の Gmail 検索クエリから件名の 📊 絵文字を削除する
> - `subject:"📊 NAGOYA BITES 日次レポート"` → `subject:"NAGOYA BITES 日次レポート"`
> - `subject:"📊 NAGOYA BITES 週次レポート"` → `subject:"NAGOYA BITES 週次レポート"`
>
> 理由: 2026-11-03 実測で、`subject:"📊 NAGOYA BITES 日次レポート"` は
> `newer_than:2d` を外しても0件を返した。
> `subject:"NAGOYA BITES 日次レポート"` では同じ条件で2件取得できた。
> 絵文字入りクエリは Gmail の実装により不安定で、メールがあるのに
> 「見つからない」と判定されることがある（SEO-152）。

---

## 参照

- スクリプト: `scripts/check_seo_triage_health.js`
- ワークフロー: `.github/workflows/seo-triage-watchdog.yml`
- 週次版: `.github/workflows/seo-triage-weekly-watchdog.yml`
- 参考: SEO-103（週次が TRASH 誤振り分けで止まった事例）
