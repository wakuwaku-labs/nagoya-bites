# SEO日次トリアージ — 未判定レポートの回収手順

> **目的**: `newer_than:2d` の制約により通常フローでは取得できなくなった日次レポートを
> 遡って判定し、空白期間のアドバイスを `seo_advice_log.json` に記録する。
> SEO-152 で確認した「日次トリアージの窓の外へ落ちた未判定レポート」に対処するための手順。

## 背景

`/seo-triage` コマンドの Step 0 は Gmail を `newer_than:2d` で検索する。
定期実行が 1 回抜けると、その日のレポートは次の実行時にはすでに 2 日以上経過しており、
通常の検索窓の外に落ちて二度と取得されない。

さらに、件名に `📊` 絵文字を含む検索語は Gmail 検索で **0 件を返す日がある**（2026-11-03 実測）。
検索語から絵文字を外すことが恒久対策だが、過去の空白期間は別途回収が必要。

---

## 手順

### Step 1: 空白期間を把握する

```bash
node scripts/check_seo_triage_daily_health.js
```

出力の「最後の日次処理」から空白の開始日を確認する。
`data/seo_advice_log.json` の最後の `source:"line-daily"` エントリの日付が基点。

### Step 2: 未判定レポートを Gmail で検索する

絵文字を外した件名 + `in:anywhere`（TRASH/SPAM を含む全フォルダ）で検索:

```
subject:"NAGOYA BITES 日次レポート" in:anywhere newer_than:30d
```

> **なぜ `in:anywhere` が必要か**: Gmail フィルタの誤設定でレポートが TRASH に入ることがある（SEO-103 の教訓）。
> `in:anywhere` を付けないと INBOX 以外のメールが見つからない。

### Step 3: 見つかったレポートを順番に処理する

見つかった日次レポートを古い順に並べ、`/seo-triage` コマンドに本文を貼り付けて処理する。

- すでに処理済みの日（`seo_advice_log.json` にエントリあり）はスキップしてよい
- 重複チェック（`seo_triage.js --check-dup`）があるので、二重起票にはならない
- 1 通処理するたびに `data/seo_advice_log.json` にエントリが追記されることを確認する

### Step 4: 生存確認を通す

全件処理後、生存確認スクリプトが健全を返すことを確認:

```bash
node scripts/check_seo_triage_daily_health.js
```

`✅ 健全（日次処理は定期的に行われている）` が出れば完了。
GitHub の watchdog Issue が存在する場合、次の Actions 実行で自動クローズされる。

---

## 恒久対策（`.claude/commands/seo-triage.md` の修正）

`.claude/commands/seo-triage.md` の Step 0 の Gmail 検索語から絵文字を外す:

**変更前**:
```
subject:"📊 NAGOYA BITES 日次レポート" newer_than:2d
```

**変更後**:
```
subject:"NAGOYA BITES 日次レポート" newer_than:2d
```

この変更はスケジュール済みルーチンの指示文にも同様に反映する（3 か所）。

> **注意**: この `.md` ファイルはエージェントが自動編集できないため、オーナーが手動で確認・反映すること。

---

## 参照

- SEO-152: 日次トリアージが動かなかった日を検知して通知し、未判定のレポートを窓の外へ落とさない
- `scripts/check_seo_triage_daily_health.js`: 生存確認スクリプト
- `.github/workflows/seo-triage-daily-watchdog.yml`: GitHub Actions 監視
- `data/seo_advice_log.json`: 採用・却下・重複の全履歴（append-only）
- `scripts/seo_triage.js`: ID 採番・重複検知・ログ追記
