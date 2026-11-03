# SEO 日次トリアージ 復旧手順書（SEO-152）

> この文書は `.claude/commands/seo-triage.md` を自動で編集できないため、
> 窓の外に落ちた日次レポートを手動で回収する手順を別ファイルとして用意したもの。
> **オーナーへの依頼**: 下記「`seo-triage.md` への追記案」を `.claude/commands/seo-triage.md` の
> Step 0 のメール取得部分に反映してください（Claude Code では自動編集できないため）。

---

## 問題の構造（SEO-152）

日次トリアージの Gmail 取得クエリは `newer_than:2d`（最新2日のスレッド）だけを読む。
定期実行が 1 回抜けると、その日のレポートは次回の `newer_than:2d` 窓の外へ落ち、
**二度と自動取得されない**。

実測（2026-10）: 10-23・10-25・10-28 の 3 通が 11-03 まで未判定。
重複チェック（fingerprint）により遡って処理しても二重起票にはならない。

---

## 窓の外に落ちたレポートを読む手順

### Step 1: 取りこぼした日を特定する

```bash
# seo_advice_log.json の line-daily エントリの日付一覧を出す
node -e "
const log = JSON.parse(require('fs').readFileSync('data/seo_advice_log.json','utf8'));
const dates = [...new Set(log.entries.filter(e=>e.source==='line-daily').map(e=>e.date))].sort();
console.log(dates.slice(-14).join('\n'));
"
```

上記と Gmail の日次レポートメール一覧を照合し、`data/seo_advice_log.json` に無い日が取りこぼし。

### Step 2: 窓の外のメールを取得する

Gmail MCP で手動取得するときは `newer_than:2d` の代わりに日付を指定する:

```
件名: 📊 NAGOYA BITES 日次レポート 2026-10-23
sender: から
```

または Gmail の検索クエリ:

```
subject:"NAGOYA BITES 日次レポート" after:2026/10/22 before:2026/10/24
```

### Step 3: `/seo-triage` を手動で実行する

取得したメール本文を `.claude/commands/seo-triage.md` の入力として渡し、通常どおり実行する。
fingerprint による重複チェックが効くため、同じ助言を二重起票しない。

### Step 4: 生存確認が通ることを確かめる

```bash
node scripts/check_seo_triage_daily_health.js
```

`✅ 健全` になれば `seo-triage-daily-watchdog.yml` の次回発火で Issue が自動クローズされる。

---

## `seo-triage.md` への追記案（オーナーへの依頼）

`.claude/commands/seo-triage.md` の Step 0「Gmail からメールを取得する」に以下を追記してください:

```markdown
### 窓の外のレポートが疑われる場合

`node scripts/check_seo_triage_daily_health.js` で異常を検出した場合、
または GitHub Issue `🔴 SEO日次トリアージが処理されていません` が開いている場合、
`newer_than:2d` ではなく日付指定で取りこぼしたメールを取得し直す。

Gmail 検索クエリの例:
  subject:"NAGOYA BITES 日次レポート" after:2026/10/22 before:2026/10/25

取得後は通常どおり `/seo-triage` を実行する（fingerprint 重複チェックが二重起票を防ぐ）。
```

---

## 監視の仕組み（参考）

| 確認場所 | スクリプト | ワークフロー |
|----------|-----------|-------------|
| 日次 | `scripts/check_seo_triage_daily_health.js` | `.github/workflows/seo-triage-daily-watchdog.yml`（毎日 17:00 JST）|
| 週次 | `scripts/check_seo_triage_weekly_health.js` | `.github/workflows/seo-triage-weekly-watchdog.yml`（毎日 16:00 JST）|

異常を検出すると GitHub Issue が起票され、オーナーにメール通知が届く。
復旧すると自動でクローズされる（CLAUDE.md 監視の原則 6）。
