# SEO日次トリアージ 未処理レポートの回収手順

> SEO-152 で発見: 日次の取得は `newer_than:2d` の「最新スレッド」だけなので、
> 定期実行が 1 回抜けるとその日のレポートは窓から落ちて二度と自動で読まれない。
> この手順は、`seo-triage-daily-watchdog` が GitHub Issue を起票したときに
> オーナーが手動で未処理レポートを回収するために使う。

## いつ使うか

`seo-triage-daily-watchdog.yml` が Issue を起票したとき（`stale_daily` 検出）。

---

## ステップ

### 1. 停止期間を確認する

`data/seo_advice_log.json` の最新 `source: "line-daily"` エントリの `date` を確認する。

```bash
node scripts/check_seo_triage_daily_health.js
```

例: 最後の日次処理が `2026-10-22`、今日が `2026-10-28` なら、
`2026-10-23`・`2026-10-24`・`2026-10-25`・`2026-10-26`・`2026-10-27` の 5 通が未処理。

### 2. Gmail で未処理のレポートメールを探す

絵文字を**外した**検索クエリを使う（絵文字あり/なしで結果が変わる日がある・SEO-152 §5）。

```
in:anywhere subject:"NAGOYA BITES 日次レポート" after:2026/10/22
```

- `in:anywhere` を付けることで TRASH に移動したメールも検索対象になる。
- `after:` の日付は最後の処理日の前日にする（翌日以降を全部拾う）。
- `newer_than:2d` は**使わない**（今回はわざと広い窓で探す）。

### 3. 未処理のメール 1 通ずつを `/seo-triage` に貼り付けて処理する

未処理メール 1 通の本文を `/seo-triage` に貼り付けて実行する。
`data/seo_advice_log.json` の fingerprint 重複チェックがあるため、
既存エントリと同じ助言は再起票されない（冪等に使える）。

処理後は `node scripts/check_seo_triage_daily_health.js` で
`line-daily` エントリが追加されたことを確認する。

### 4. 復旧確認

```bash
node scripts/check_seo_triage_daily_health.js
# ✅ 健全（日次処理は定期的に行われている）が出ればOK
```

その後、GitHub Actions の `workflow_dispatch` で watchdog を手動トリガーすると、
開いている Issue が自動でクローズされる。

---

## スケジュールルーチンの再確認

停止が「ルーチン未登録」だった場合は、claude.ai でスケジュールを確認する。
日次トリアージは毎日 21:01 JST に実行されるよう登録されているはず。

---

## 参考: `.claude/commands/seo-triage.md` のGmail検索クエリについて

`seo-triage.md` の Step 0 にある検索クエリ（`subject:"📊 NAGOYA BITES 日次レポート"`）は
絵文字を含むと結果が不安定なため、手動で処理する際は絵文字なしの
`subject:"NAGOYA BITES 日次レポート"` を使うことを推奨する（SEO-152 §5）。

`.claude/commands/seo-triage.md` と `seo-triage-weekly.md` の 2 ファイルについては、
検索クエリの絵文字を外すよう**オーナーの手で修正**することを推奨する。
具体的には以下の行を変更する:

**seo-triage.md**（Step 0 付近）:
```
変更前: subject:"📊 NAGOYA BITES 日次レポート" newer_than:2d
変更後: subject:"NAGOYA BITES 日次レポート" newer_than:2d
```

**seo-triage-weekly.md**（Step 0 付近）:
```
変更前: subject:"📊 NAGOYA BITES 週次レポート" newer_than:9d
変更後: subject:"NAGOYA BITES 週次レポート" newer_than:9d
```
