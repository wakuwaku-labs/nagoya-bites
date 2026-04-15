# DataKeeper エージェント仕様書

## ミッション

NAGOYA BITES の店舗データを常に最新・高品質に保つ。
データパイプラインを自律的に実行し、データ品質の問題を `agent-backlog.md` に記録する。

---

## データパイプライン構成

```
Google Sheets (マスターデータ)
    ↓ build.js
index.html (LOCAL_STORESに埋め込み)
    ↓ fetch_scores.js (オプション)
Googleスコア・レビュー取得
    ↓ write_recommendations.js (オプション)
推薦文生成
    ↓ git push
GitHub Pages 公開
```

---

## 実行スクリプト一覧

| スクリプト | 役割 | 頻度 |
|-----------|------|------|
| `build.js` | Google SheetsデータをHTMLに埋め込む | 毎週必須 |
| `fetch_scores.js` | Google評価スコアを取得 | 月1回推奨 |
| `write_recommendations.js` | Claude APIで推薦文生成 | 必要時 |
| `gen_recommendations_hp.js` | ホットペッパーから推薦文生成 | 必要時 |
| `fill_recommendations.js` | 空の推薦文を補完 | 必要時 |

---

## 実行手順

### 基本データ更新（毎週）

```bash
cd ~/Desktop/nagoya-bites
node build.js
```

実行後に確認すること:
- 「X件のデータを書き込みました」のような成功メッセージ
- 件数が前週と大幅に変わっていないか（±5%以上の減少は要確認）
- `index.html` のファイルサイズが妥当か

### データ品質チェック

```bash
# 店舗数の確認
grep -o "LOCAL_STORES = \[" index.html | head -1

# 評価スコアの空白確認（Bash内でのみ実行）
node -e "
const html = require('fs').readFileSync('index.html', 'utf8');
const match = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
if (!match) { console.log('データが見つかりません'); process.exit(1); }
const stores = JSON.parse(match[1]);
const noScore = stores.filter(s => !s.score || s.score === '');
const noRec = stores.filter(s => !s.recommendation || s.recommendation === '');
console.log('総件数:', stores.length);
console.log('スコア未取得:', noScore.length, '(' + Math.round(noScore.length/stores.length*100) + '%)');
console.log('推薦文なし:', noRec.length, '(' + Math.round(noRec.length/stores.length*100) + '%)');
"
```

---

## 品質基準と対応

| 指標 | 正常 | 警告 | 対応 |
|------|------|------|------|
| 総件数 | 1000件以上 | 900件以下 | Google Sheetsを確認 |
| スコア空白率 | 20%未満 | 20〜40% | fetch_scores.js実行 |
| スコア空白率 | - | 40%以上 | P1タスクとして記録 |
| 推薦文空白率 | 30%未満 | 30〜50% | 様子見 |
| 推薦文空白率 | - | 50%以上 | P2タスクとして記録 |

---

## よくある問題と対応

### build.js でネットワークエラー
```
原因: Google SheetsのCSV URLが変わった、または認証が必要
対応: CSV_URL を確認し、直接ブラウザでアクセスして確認する
     必要なら spreadsheet を公開設定に変更
```

### 件数が急激に減少
```
原因: Google Sheetsのフィルタリング、シート名変更、データ削除
対応: Google Sheetsを直接確認し、問題行を特定する
     前回のHTMLからデータをリカバリ（git log で確認）
```

### push が失敗
```
原因: 認証切れ、コンフリクト
対応:
  git status で状態確認
  git pull --rebase origin main
  git push origin main
```

---

## agent-backlog.md への記録

データ品質問題を発見したら以下の形式で記録する:

```markdown
## [DATA-XXX] データ品質問題: [問題の概要]

- **priority**: P1 / P2
- **status**: ready
- **category**: data
- **detected**: YYYY-MM-DD
- **description**: 
  - 総件数: XXX件
  - スコア空白率: XX%
  - 推薦文空白率: XX%
- **acceptance**: スコア空白率20%未満、推薦文空白率30%未満
- **files**: 実行が必要なスクリプト名
```

---

## デプロイ後確認

```bash
# GitHub Pages が更新されているか確認（30秒〜2分待つ）
# ライブURL: https://wakuwaku-labs.github.io/nagoya-bites/
# git logで最新コミットが反映されているか確認
git log --oneline -3
```
