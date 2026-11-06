# SEO日次トリアージ 復旧手順（SEO-152）

> seo-triage-daily-watchdog.yml が Issue を起票したとき、またはログを見て手動確認するときに参照する。

---

## 生存確認の確認方法

```bash
node scripts/check_seo_triage_daily_health.js
```

`line-daily` の最新エントリが3日より古い（または存在しない）と異常を返す。

---

## 窓から落ちた未判定レポートを回収する

`/seo-triage` の自動取得は `newer_than:2d` の窓しか見ない。定期実行が1回抜けると
そのメールは窓の外に落ちて二度と自動取得されない。

**落ちたメールを回収する手順:**

1. Gmail で次のクエリを使って未処理のメールを探す:
   ```
   subject:"NAGOYA BITES 日次レポート" in:anywhere
   ```
   （絵文字なし版。`subject:"📊 NAGOYA BITES 日次レポート"` は日によって0件を返す実測あり）

2. 未処理のメール本文の「💡今日のアドバイス」セクションを `/seo-triage` に貼り付けて手動実行する。

3. 台帳突合（fingerprint 重複チェック）があるため、同じメールを複数回処理しても二重起票にはならない（冪等）。

4. 処理後に生存確認が緑になることを確認:
   ```bash
   node scripts/check_seo_triage_daily_health.js
   ```

---

## 定期実行の確認

1. Claude.ai のスケジュール設定で、日次SEOトリアージのタスク（毎日 21:01 JST 相当）が登録されているか確認する。
2. 登録されていない場合は再登録する。

---

## オーナーへの依頼: コマンドファイルの検索語から絵文字を外す

下記3か所の Gmail 検索クエリを更新することで、絵文字の有無によるメール取得漏れを防げる。
（2026-11-03 実測: 絵文字あり検索が0件を返したがなし検索は2件を返した。日によって結果が変わる）

### 1. `.claude/commands/seo-triage.md` の Step 0

変更前:
```
Gmail を `subject:"📊 NAGOYA BITES 日次レポート" newer_than:2d` で検索し
```

変更後:
```
Gmail を `subject:"NAGOYA BITES 日次レポート" newer_than:2d` で検索し
```

### 2. `.claude/commands/seo-triage-weekly.md` の Step 0

変更前:
```
Gmail を `subject:"📊 NAGOYA BITES 週次レポート" newer_than:9d` で検索し
```

変更後:
```
Gmail を `subject:"NAGOYA BITES 週次レポート" newer_than:9d` で検索し
```

### 3. Claude.ai の定期実行タスクの指示文

タスクの中に `件名「📊 NAGOYA BITES 日次レポート <日付>」` という記述がある場合、
検索クエリ部分（Step 0 参照箇所）の絵文字を外す。

---

## 参考: 窓の中の未判定件数を確認する

```bash
# 判定済みエントリの日付一覧（line-daily）を出す
node -e "
const d = require('./data/seo_advice_log.json');
const days = [...new Set(d.entries.filter(e=>e.source==='line-daily').map(e=>e.date))].sort();
console.log('判定済みの日付一覧（新しい順）:');
days.slice(-14).reverse().forEach(d => console.log(' ', d));
"
```

---

> SEO-152 / 2026-11-06 — Builder 実装。生存監視スクリプトは `scripts/check_seo_triage_daily_health.js`、
> GitHub Actions ワークフローは `.github/workflows/seo-triage-daily-watchdog.yml`。
