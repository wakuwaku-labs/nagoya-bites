# SNS投稿リンクの UTM 規約

SNS（Instagram / X / note / Threads 等）からサイトへ貼るリンクには、必ず UTM パラメータを付ける。

## なぜ必要か

- Instagram・X・LINE のアプリ内ブラウザで開かれると、GA4 に流入元が残らず「直接アクセス」に混ざることがある
- UTM を付けると GA4 の `sessionSource` / `sessionMedium` が UTM の値で上書きされ、SNS 経由だと確実に判別できる
- 2026-09-14 まで、SNS 流入は流入元の誤分類（chatgpt.com が t.co と誤一致）と上位10行しか保存しない仕様に埋もれて観測できていなかった（PR #241）

## 付け方

```
<記事URL>?utm_source=<媒体>&utm_medium=social&utm_campaign=<記事の識別子>
```

| 項目 | 値 | 例 |
|---|---|---|
| `utm_source` | 下表の**決まった値だけ**を使う | `instagram` |
| `utm_medium` | 常に `social` | `social` |
| `utm_campaign` | 記事の識別子（URL の末尾から `.html` を除いたもの） | `2026-09-14-sakae-xxx` / `nagoya-solo-dining` |

| 媒体 | `utm_source` |
|---|---|
| Instagram（プロフィールリンク・ストーリーズのリンクスタンプ） | `instagram` |
| X | `x` |
| note | `note` |
| Threads | `threads` |
| LINE | `line` |
| TikTok | `tiktok` |
| YouTube | `youtube` |
| Facebook | `facebook` |

例:

```
https://nagoya-bites.com/features/nagoya-solo-dining.html?utm_source=instagram&utm_medium=social&utm_campaign=nagoya-solo-dining
```

## 守ること

- **`utm_source` は上表以外の表記にしない**（`Instagram` `insta` `IG_story` 等の揺れを作らない）。SNS 判定は `scripts/lib/traffic_source.js` の語彙との完全一致で行うため、表にない値は SNS として数えられない。媒体を増やすときは、先に同ファイルの `SOCIAL_BARE` と `.gas-deploy/Code.js` の `SOCIAL_SOURCE_BARE` に追加する（`tests/traffic_source.test.js` が両者の一致を検査する）
- 全ページに `rel="canonical"` があるため、UTM 付き URL が検索結果で重複ページ扱いされることはない
- 効果は `data/site_metrics.json` の `channels.social` と `sourceBreakdown` の `medium: "social"` 行で見る
