# SEO日次トリアージ 復旧手順（SEO-152）

GitHub Issue 「🔴 SEO日次トリアージが処理されていません」が開かれたときに参照する手順書。

---

## なぜ止まるのか

日次トリアージは Gmail の `newer_than:2d` で「最新スレッド」だけを取得する。
定期実行が1回抜けると、その日のレポートは窓から漏れ、**二度と自動取得されない**。

よくある原因:

| 原因 | 確認方法 |
|------|----------|
| スケジュール未登録または停止 | claude.ai のスケジュール一覧で「nagoya-bites-seo-triage-daily」を確認 |
| Gmail の TRASH 誤振り分け | Gmail で下記の検索を実行し、INBOX にあるか確認 |
| 認証切れ | claude.ai の接続 → Gmail 連携が有効か確認 |
| GAS のコンパイルエラー | `.gas-deploy/Code.js` の重複宣言は `npm test` で検知される |

---

## 手順 1: 未処理のメールを探す

Gmail で以下を検索する（**絵文字なし**で検索すること）:

```
subject:"NAGOYA BITES 日次レポート" in:anywhere
```

> **注意**: `subject:"📊 NAGOYA BITES 日次レポート"` のように絵文字を含む検索は
> Gmail で0件を返すことがある（2026-11-03 実測）。絵文字なしで検索すること。

期待される件名の例:
- `📊 NAGOYA BITES 日次レポート 2026-11-01`
- `📊 NAGOYA BITES 日次レポート 2026-11-02`

---

## 手順 2: 未処理のメールを処理する

未処理のメール本文を `/seo-triage` コマンドに貼り付けて処理する。

- 台帳突合（fingerprint 重複チェック）があるため、同じレポートを複数回処理しても二重起票にはならない（冪等）。
- 1日に何通あっても安全に処理できる。

---

## 手順 3: スケジュールを確認・再登録する

1. claude.ai のスケジュール一覧を開く。
2. `nagoya-bites-seo-triage-daily`（毎日 21:01 JST）が存在するか確認する。
3. 存在しない場合は再登録する。登録後、翌日の実行を待って watchdog が自動クローズするのを確認する。

---

## 手順 4: 復旧確認

復旧後に以下を実行して健全かどうかを確認する:

```bash
node scripts/check_seo_triage_daily_health.js
```

`✅ 健全` と表示されれば OK。次の watchdog 実行（毎日 15:00 JST）で GitHub Issue が自動クローズされる。

---

## オーナーへのお願い（SEO-152 acceptance 3・5）

以下の2点は Claude が自動では変更できないファイルへの変更です。
手動で `.claude/commands/seo-triage.md` と定期実行の指示文を更新してください。

### 変更点 A: Gmail 検索語から絵文字を外す

現在の検索語（絵文字あり）:
```
subject:"📊 NAGOYA BITES 日次レポート"
```

変更後（絵文字なし）:
```
subject:"NAGOYA BITES 日次レポート"
```

**理由**: `📊` を含む検索語は Gmail で0件を返すことがある（2026-11-03/04 実測で結果が日によって変わる）。絵文字なしの方が安定して件名一致する。

対象ファイル:
- `.claude/commands/seo-triage.md` の Step 0（Gmail 検索クエリ）
- `.claude/commands/seo-triage-weekly.md` の Step 0（同様）
- スケジュール済みルーチン（claude.ai の定期実行の指示文）の Gmail 検索クエリ

### 変更点 B: 週次の窓も in:anywhere にする（参考）

週次が TRASH へ誤振り分けされた場合のために（SEO-103 の教訓）、
週次の検索クエリも `in:anywhere` を追加することを検討してください:

```
subject:"NAGOYA BITES 週次レポート" in:anywhere newer_than:9d
```
