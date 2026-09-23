# SEO週次トリアージ 手順書（SEO-103）

## 概要

週次レポートメール（件名「📊 NAGOYA BITES 週次レポート <期間>」）を Gmail から取得し、
`/seo-triage-weekly` コマンドを実行して SEO施策を triage する手順。

`.claude/commands/seo-triage-weekly.md` はエージェントの自己改変ブロックで編集できないため、
運用ルールの変更はこのファイルと `data/seo_advice_log.json` で管理する。

---

## Step 0 — Gmail からのメール取得（TRASH 対応・必須）

週次レポートは GAS が Gmail 送信するが、Gmail フィルタが誤って **TRASH へ移動**させる
ことがある（SEO-103、2026-09 に判明）。

### NG（INBOX のみ検索・TRASH のメールを見逃す）

```
subject:"NAGOYA BITES 週次レポート" newer_than:9d
```

### OK（INBOX + TRASH の両方を検索）

```
subject:"NAGOYA BITES 週次レポート" newer_than:9d in:anywhere
```

- `in:anywhere` を必ず付けること。これが無いと TRASH のメールが 0件になる
- Gmail MCP の検索クエリにそのまま渡す

---

## Step 1 — 通常の処理フロー

```
1. Gmail MCP で上記クエリを使ってメールを取得
2. 最新の週次レポートメールを特定（複数ある場合は最新のみ）
3. /seo-triage-weekly を本文に貼り付けて実行
   ※ 自動実行（スケジュール済みルーチン）の場合はコマンドが Step 0 の取得も担う
```

---

## Step 2 — 遡り処理（停止期間からの回収）

停止期間中（TRASH に溜まっていた期間）のメールを遡って処理するとき:

```
subject:"NAGOYA BITES 週次レポート" in:anywhere
```

期間を指定して古いものから順に処理する。
`data/seo_advice_log.json` の fingerprint による重複チェックがあるため二重起票にはならない。

---

## Step 3 — 生存確認

週次処理が正常に行われているか確認:

```bash
node scripts/check_seo_triage_weekly_health.js
```

- 最後の週次処理から 14日以上経過すると異常と判定（GitHub Issue 起票 → メール通知）
- 監視は `.github/workflows/seo-triage-weekly-watchdog.yml`（毎日 16:00 JST）

---

## Gmail TRASH 誤振り分けへの対処（オーナー操作が必要）

Gmail が自動でメールを TRASH へ移動させている場合、コードでは直せない。

1. Gmail の「フィルタとブロック済みアドレス」設定を開く
2. 「NAGOYA BITES 週次レポート」に関連するフィルタを探す
3. 「削除する」または TRASH 行きになっているルールを修正する
4. `in:anywhere` クエリで過去のメールを回収して遡り処理する

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `data/seo_advice_log.json` | triage の全記録（line-weekly エントリ）|
| `scripts/check_seo_triage_weekly_health.js` | 生存確認スクリプト |
| `.github/workflows/seo-triage-weekly-watchdog.yml` | サーバ側生存監視（毎日16:00 JST）|
| `.claude/commands/seo-triage-weekly.md` | `/seo-triage-weekly` コマンド定義（自己改変ブロック・変更不可）|
