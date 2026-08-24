# GAS レポート反映確認 ランブック（SEO-069）

> **この文書が手順の正本。** `.claude/commands/*.md` は自己改変ブロックで編集できないため、
> 日次 SEO triage ルーチンが実行すべき追加手順をここに置く（`docs/feedback-triage-runbook.md` と同じ設計）。
> 判定の基準は `data/gas_deploy_policy.json`、判定器は `scripts/lib/gas_deploy_trace.js` の1本。

---

## なぜ必要か

毎朝のレポートを作っている GAS は**このリポジトリの外**で動いている。
`.gas-deploy/Code.js` はただのミラーで、CI からのデプロイ経路が無い。

そのため修正をマージしても GAS 側は旧コードのまま動き続け、
**修正済みのバグが出した数値の上で、毎朝のアドバイスが生成され続ける。**

2026-08-23 時点の実害:

| 課題 | 内容 | 滞留 |
|---|---|---|
| SEO-047 | 直帰率アラートの母数ゲート | **24日** |
| SEO-057 | 生成AI流入のラベル分岐 | 12日 |
| SEO-062 | 直帰率が `pagePath` 次元つきで集計されるバグ | 11日 |
| SEO-063 | GA4しきい値で潰れた行が分母を歪める | 4日 |

さらに SEO-057 / SEO-062 / SEO-063 は「コード修正完了」で `done` にしたため
Notion からアーカイブされ、**効果ゼロのまま追跡対象の外に消えていた**
（2026-08-24 に `partial` へ戻して是正済み）。

反映されたかを知る経路は「オーナーが翌朝のレポートを読んで気づく」だけだった。
これは CLAUDE.md の言う検知ではなく**記録**（ISSUE-084 原則3）。

---

## 分担（ISSUE-084 の原則1・2をそのまま適用）

```
[記録] 日次 SEO triage ルーチン（Gmail を読める側）
        取得したレポート本文を渡して痕跡を data/gas_deploy_health.json に書き、コミットで Mac の外へ出す
   ↓
[監視] .github/workflows/gas-deploy-watchdog.yml（毎日 14:00 JST）
        ローカルが丸ごと死んでも動く。判定は scripts/check_gas_deploy_health.js を共有
   ↓
[通知] GitHub Issue → オーナーにメール（届いた実績のある経路）
        原因つき（どの SEO-0NN が未反映か・根拠の行そのもの）で運ぶ
   ↓
[復旧] 反映を確認したら Issue を自動クローズして静かになる（オオカミ少年化させない）
```

---

## 手順（日次 SEO triage ルーチンが毎回実行する）

`/seo-triage` の Step 0 でレポート本文を取得した**直後**に実行する。

### レポートが取得できた日

本文をファイルに落として渡す（日次・週次それぞれ1回ずつ）:

```bash
node scripts/check_gas_deploy_health.js --record \
  --report-file <本文を保存したファイル> \
  --date <レポートの対象日 YYYY-MM-DD> \
  --kind daily      # 週次なら weekly
```

### レポートが見つからなかった日

成果物が無い日も**必ず心拍を残す**。これが無いと「レポートが来ていない」と
「ルーチンが動かなかった」を外から区別できない（ISSUE-089 と同じ失敗クラス）:

```bash
node scripts/check_gas_deploy_health.js --record --no-report \
  --date <今日 YYYY-MM-DD> \
  --reason "日次レポートが Gmail に見つからない（GAS未送信/件名変更を疑う）"
```

### 最後に必ずコミットする

```bash
git add data/gas_deploy_health.json
```

`data/` 配下なので `.gitignore` されない＝**Mac の外へ出る**。
ここを省くと ISSUE-084 の「防音室で鳴る警報」に逆戻りする。

---

## 判定の3値（2値にしない）

| verdict | 意味 | watchdog |
|---|---|---|
| `not_deployed` | 旧コードでしか出ない痕跡が出た。**確定** | 2回連続で Issue 起票 |
| `deployed` | 新コードでしか出ない痕跡が出た。**確定** | 復旧クローズ |
| `indeterminate` | どちらも出なかった。その日のデータが分岐を通らなかっただけ | **絶対に鳴らさない** |

`indeterminate` を `not_deployed` に丸めると、GA4 しきい値が効かなかった日に
誤って警報が鳴りオオカミ少年化する（ISSUE-084 原則6）。

### 何を証拠にしているか（CLAUDE.md 制約10）

主判定は流入元セクションの生文字列 `(not set) / (not set)`。

これは**新コードでは原理的に出力できない**。新しい `sourceToName()` は先頭の
`isGa4Unknown()` で `⚠️ 判別不能（GA4しきい値）` に集約するため、この生文字列は
旧コードの最終行 `return s + ' / ' + m` からしか出ない。
誰でも該当日のレポートメールを開いて同じ行を目視で確認できる＝自己申告ではない。

### 実装上の落とし穴（実測で踏んだ2件・2026-08-24）

1. **散文を拾ってしまう** — セクション終端を「次の `【…】` 見出し」だけで判定すると、
   `💡 今日のアドバイス`（【】を使わない見出し）が流入元セクションに飲み込まれ、
   アドバイス文中の `(not set)` という単語だけで旧コードと誤判定する。
   → 終端条件に空行・区切り線・絵文字見出しを追加し、さらに**行の形**でも絞る。
2. **絵文字で行を判定してはいけない** — Gmail のプレーンテキスト変換で `🥇🥈🥉` は
   U+FFFD に化ける。順位絵文字を条件にすると実運用の入力で全行が落ち、
   **未反映なのに `indeterminate` を返し続けて検知が静かに死ぬ**。
   → 数値+単位の形（`（16訪問 / 31%）` / `（29%）`）で判定する。

どちらも `data/gas_deploy_policy.json` のパターンで表現してあるので、
判定を変えるときは JSON 側を編集し、スクリプトは触らない。

---

## 反映されたら（オーナー操作のあと）

1. 翌朝のレポートで流入元 TOP3 に `(not set)` が出ず
   `⚠️ 判別不能（GA4しきい値）` に変わっていることを確認
2. `node scripts/check_gas_deploy_health.js` が `deployed` を返すことを確認
   （watchdog が Issue を自動クローズする）
3. `data/gas_deploy_policy.json` の `pending_fixes` を**空にする**
4. SEO-047 / SEO-057 / SEO-062 / SEO-063 を `partial` → `done` に戻し、
   効果測定（直帰率の🔴が母数ゲートに従うか・流入元に生文字列が出ないか）を1回で閉じる

`pending_fixes` を空にすると `deployed` 時の警告も消え、watchdog は恒久的に静かになる。

---

## デプロイ手順（オーナー本人の操作・代行不可）

```
1. .gas-deploy/Code.js の中身を GAS エディタ（Google分析オートLINE送信）にコピペして保存
   または clasp push（.gas-deploy/.clasp.json あり。要 clasp login）
2. 重複ファイルを作らない（Code 2.js 等が混ざると top-level 二重宣言で
   コンパイル全体が落ち、レポートが届かなくなる。CLAUDE.md に明記の禁止事項）
```

---

## 健診コマンド

```bash
node scripts/check_gas_deploy_health.js          # 人が読む要約（異常なら exit 1）
node scripts/check_gas_deploy_health.js --json   # 機械可読（CI が読む）
```
