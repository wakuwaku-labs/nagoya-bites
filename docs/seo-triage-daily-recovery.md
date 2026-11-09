# SEO日次トリアージ 手動復旧手順（SEO-152）

**対象**: `seo-triage-daily-watchdog.yml` が Issue を起票したとき（日次トリアージが N 日間止まっている）

---

## 1. 状況の確認

```bash
node scripts/check_seo_triage_daily_health.js
```

`stale_daily` が出ていれば、最後に日次処理が行われた日からの日数がわかります。

---

## 2. 窓から漏れたレポートを遡って取得する

### 注意：絵文字を含む検索語の不安定性（SEO-152 実測 2026-11-03/04）

`.claude/commands/seo-triage.md` の Step 0 では  
```
subject:"📊 NAGOYA BITES 日次レポート" newer_than:2d
```
という検索語を使っています。しかし実測では：

- 2026-11-03: `subject:"📊 NAGOYA BITES 日次レポート"` → 期間を外しても **0 件**  
- 同日: `subject:"NAGOYA BITES 日次レポート"` → **2 件** ヒット  
- 2026-11-04: 絵文字あり同じ語で **2 件** ヒット（同じ語でも日によって結果が変わる）

**対応**: 絵文字なしの検索語を使う。  
例: `subject:"NAGOYA BITES 日次レポート" in:anywhere`

### 推奨される遡り手順

1. Gmail で以下の検索を実行する（`in:anywhere` で TRASH も含む）:  
   ```
   subject:"NAGOYA BITES 日次レポート" in:anywhere
   ```
2. 未処理の日次レポートを古い順に `/seo-triage` に貼り付けて実行する。  
   台帳突合（fingerprint 重複チェック）があるため **二重起票にはならない**。
3. 全件処理後に再度確認:  
   ```bash
   node scripts/check_seo_triage_daily_health.js
   ```
   `✅ 健全` が出れば復旧完了。watchdog が翌日自動でクローズします。

---

## 3. `.claude/commands/seo-triage.md` の絵文字問題の修正（オーナーへの依頼）

**これは自動実行できないため、オーナーの手での修正をお願いします。**

`.claude/commands/seo-triage.md` の Step 0 の検索語を以下のとおり変更してください：

### 変更前
```
Gmail を `subject:"📊 NAGOYA BITES 日次レポート" newer_than:2d` で検索し、最新スレッドを取得。
```

### 変更後
```
Gmail を `subject:"NAGOYA BITES 日次レポート" newer_than:2d` で検索し、最新スレッドを取得。
絵文字（📊）を含む検索語は Gmail MCP で 0 件を返すことがあるため外す（SEO-152 実測 2026-11-03）。
```

同様に `.claude/commands/seo-triage-weekly.md` の Step 0 の検索語（`subject:"📊 NAGOYA BITES 週次レポート"`）からも絵文字を外してください。

また、スケジュール済みの定期実行の指示文の中にも絵文字入りの検索語があれば同様に修正してください。

---

## 4. 生存監視スクリプトの閾値

デフォルト: **4日間**（1日スキップ + バッファ3日 = 3回連続スキップで検知）

変更が必要なときは引数で指定します（コードは変更不要）：
```bash
node scripts/check_seo_triage_daily_health.js --max-silence-days 3
```

---

## 5. 関連ファイル

| ファイル | 役割 |
|---------|------|
| `scripts/check_seo_triage_daily_health.js` | 生存確認スクリプト |
| `.github/workflows/seo-triage-daily-watchdog.yml` | GitHub Actions による毎日の監視（17:00 JST） |
| `data/seo_advice_log.json` | 日次・週次の判定記録（append-only） |
| `.claude/commands/seo-triage.md` | 日次トリアージの手順（絵文字問題あり → 手動で修正が必要） |
| `docs/seo-triage-daily-recovery.md` | このファイル |
