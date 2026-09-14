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
| Instagram（ストーリーズのリンクスタンプ） | `instagram` |
| X | `x` |
| note | `note` |
| Threads | `threads` |
| LINE | `line` |
| TikTok | `tiktok` |
| YouTube | `youtube` |
| Facebook | `facebook` |

Instagram の**プロフィールリンクには付けない**。Instagram が自動で `utm_source=ig&utm_medium=social` を付与しており（2026-09-14 の GA4 で `ig / social` 4件を確認）、自分で付けると二重になる。`ig` も SNS として数える。

例:

```
https://nagoya-bites.com/features/nagoya-solo-dining.html?utm_source=instagram&utm_medium=social&utm_campaign=nagoya-solo-dining
```

## 守ること

- **`utm_source` は上表以外の表記にしない**（`Instagram` `insta` `IG_story` 等の揺れを作らない）。SNS 判定は `scripts/lib/traffic_source.js` の語彙との完全一致で行うため、表にない値は SNS として数えられない。媒体を増やすときは、先に同ファイルの `SOCIAL_BARE` と `.gas-deploy/Code.js` の `SOCIAL_SOURCE_BARE` に追加する（`tests/traffic_source.test.js` が両者の一致を検査する）
- 全ページに `rel="canonical"` があるため、UTM 付き URL が検索結果で重複ページ扱いされることはない
- 効果は `data/site_metrics.json` の `channels.social` と `sourceBreakdown` の `medium: "social"` 行で見る

## 原稿を別のAI・予約投稿ツールで作る場合

SNS原稿はリポジトリ外の仕組みで作っている（2026-09-14 オーナー確認）。その原稿作成AIの指示文（システムプロンプト等）に、次のブロックをそのまま追加する。

```
【リンクのルール】
nagoya-bites.com へのリンクを書くときは、URLの末尾に必ず次の3つを付ける。
  ?utm_source=<媒体>&utm_medium=social&utm_campaign=<記事ID>
- <媒体> は投稿先で決まる固定値。次以外の表記は使わない:
    X → x ／ Instagramストーリーズ → instagram ／ note → note ／ Threads → threads ／
    LINE → line ／ TikTok → tiktok ／ YouTube → youtube ／ Facebook → facebook
- <記事ID> はURLの最後の「/」より後ろから「.html」を除いた文字列
    例: https://nagoya-bites.com/features/nagoya-solo-dining.html → nagoya-solo-dining
- トップページ（https://nagoya-bites.com/）の記事IDは top
- 元のURLにすでに「?」がある場合は「?」ではなく「&」でつなぐ
- Instagramのプロフィール欄のリンクには付けない（Instagramが自動で付ける）
- 1つの投稿の中で、同じ媒体の値を使い回す（X用の原稿に instagram を混ぜない）
```

完成例（X 用）:

```
https://nagoya-bites.com/features/nagoya-solo-dining.html?utm_source=x&utm_medium=social&utm_campaign=nagoya-solo-dining
```

投稿前に目で確認するのは次の2点だけ: `utm_medium=social` が入っているか／`utm_source` が上の表の値か。

## リール動画（Instagram / TikTok）を自動生成ツールで作る場合

リールのキャプション内の URL は**タップできない**（Instagram・TikTok とも）。読者がサイトへ来る経路は**プロフィール欄のリンク**だけなので、UTM はキャプションではなくプロフィールリンクで効かせる。

| 場所 | 対応 |
|---|---|
| Instagram プロフィールリンク | 付けない（Instagram が `ig / social` を自動付与） |
| TikTok プロフィールリンク | 一度だけ手で設定: `https://nagoya-bites.com/?utm_source=tiktok&utm_medium=social&utm_campaign=profile` |
| リンク集サービス（lit.link 等）を挟む場合 | その中の各リンクに `utm_source=<媒体>&utm_medium=social&utm_campaign=<記事ID>` を付ける |
| リールのキャプション | URL を書かない（タップできず、URL 入りキャプションは読みにくくなるだけ） |

プロフィールリンク経由では「どのリールから来たか」までは分からない。計測できるのは媒体単位（Instagram / TikTok）まで。

動画生成ツールの指示文には次を追加する:

```
【サイトへの誘導ルール（リール動画・キャプション共通）】
- キャプションに URL を書かない（リールのキャプション内リンクはタップできない）
- サイトへの誘導は「プロフィールのリンクから見られます」の一文で行う
- 誘導文の直後に、サイトで探すときの手がかりを1つだけ書く
    例: 「NAGOYA BITES で『一人飲み』と検索」「特集『名古屋の一人飲み』で紹介中」
  手がかりには、その動画が扱う記事のタイトルに実際に含まれる語を使う（記事に無い語を作らない）
- 動画内のテロップにも URL は入れない（読み取れず、画面の情報量を減らすだけ）
```
