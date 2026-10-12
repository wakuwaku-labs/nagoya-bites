# NAGOYA BITES デザインシステム

正本チェーン: `data/design_system.json`（機械判定）→ `assets/css/nb.css`（実装）→ このファイル（人向け仕様）。
役職・運用は `agents/designer.md` 参照。背景・実測データは agent-backlog.md の `[DSN-001]` 参照。

---

## 1. なぜ刷新したか

2026-09-03、オーナー本人から「サイトが見にくい。文字が小さい、一画面の情報量が多い、字体が合っていない」
という指摘があり、本番サイトを実測したところ裏付けられた。

- トップページの可視文字の **76%が12px以下**
- モバイル1画面目に **888文字**（新聞の見出し欄より情報が多い）
- 検索結果の店舗カード1枚に **22個のテキスト要素**
- 見出し書体（Cormorant Garamond）に日本語フォールバックがなく、日本語部分はOS任せの明朝に落ちていた

刷新の目標は「読める・静か・揃う」の3つ。

---

## 2. 書体

| 役割 | スタック | 読み込みウェイト | 用途 |
|---|---|---|---|
| 見出し（display） | `'Cormorant Garamond','Shippori Mincho','Hiragino Mincho ProN','Yu Mincho',serif` | Cormorant 400/500/600＋italic 400、Shippori 500/600 | hero h1・セクション h2・モーダル店名・記事タイトル |
| 本文・UI | `'Noto Sans JP','Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic',sans-serif` | 400/500/700 | それ以外すべて |
| 等幅 | `'DM Mono',ui-monospace,Menlo,monospace` | 400/500 | 順位・件数・日付など数字と3語以内の欧文のみ。**日本語には使わない** |

Cormorant Garamond と Shippori Mincho を組み合わせているのは、両方とも線のコントラストが高い
オールドスタイル系の書体で、同じ行に混在しても「一つの声」に聞こえるため。

---

## 3. do / don't

**do**
- 日本語は Noto Sans JP、`letter-spacing:0`
- 意味を持つラベルは日本語（サイト全体の方針）で 13px 以上
- 操作要素（ボタン・リンク・チップ）は 44px 以上。高さは `min-height:var(--tap-min)` で指定する。`div` に委譲クリックを付けた部品（タグ・ジャンルのチップなど）も同じ（`button` / `a` だけを数えると見落とす）。見た目を変えたくない丸ボタン・ロゴ・ヘッダーのナビは、`::after` / `::before` で透明な当たり判定だけを広げる（`display:inline-flex` にすると、ロゴの語の間の空白が消える）。文中のリンクは対象外（WCAG 2.5.8）。確認は `node --test tests/index_tap_and_size.test.js`（トップの CSS・I-26e）
- 読む文字は 13px 以上（`var(--fs-xs)` 以上）。`var(--fs-2xs)`（12px）は写真クレジット・法的表示だけ。トップの CSS に 13px 未満の指定は置かない（同じテストが見る）
- font-size はすべてトークン（`var(--fs-*)`）を参照する
- 文字色のトークン（`--text`・`--ink`・`--muted`・`--dim`・`--gold`・`--gold2`）は、小さい文字に必要な 4.5:1 を、載る背景（`--bg`・`--bg2`・`--surface`・`--card`）のどれの上でも満たす（`--gold2` は `--surface` の上に置かない）。値を変える日は `node --test tests/design_tokens_contrast.test.js` が通ることを確かめる（I-26c・WCAG 2.1 AA 1.4.3）
- 見出しの段を飛ばさない（h1 → h2 → h3。h1 の次に h3、h2 の次に h4 を置かない）。見出しを持たない節（日次ジャーナルの店の一覧など）は、見えない h2（`class="visually-hidden"`）で節にする。確認は `node scripts/audit_heading_levels.js --check`（I-26f・夜間QA の soft）

**don't**
- font-size のリテラル値を新規に書かない（`12px` や `.8rem` を直接書かない）
- `:root` を再定義しない（nb.css の値を上書きしたい場合は `--page-` 接頭辞の新トークンを足す）
- 日本語に等幅フォントや `text-transform:uppercase` を使わない（トップの CSS は `tests/index_mono_font.test.js` が、等幅の規則は数字・記号・欧文だけを出す表のセレクターに限ることを静的に見る。実ブラウザでは `node docs/qa/uiux-2026-10/dmmono.js` が状態ごとに数える）
- 英語と日本語で同じ意味の見出しを二重に出さない
- 読み込んでいないフォントウェイトを指定しない（許可: 400/500/600/700）

### 本文中の強調（DSN-004・2026-09）

journal / features の本文（`.art-body` / `.content`）が地の文だけで続くと読みにくいという
オーナー指摘を受けて追加。太字・マーカー・色・文字サイズの4種を用意し、要点にだけ絞って使う。

| 用途 | マークアップ | 見え方 |
|---|---|---|
| 事実・数字を強く見せる | `<strong>` | `var(--ink)` の黒 + font-weight 700 |
| その段落の結論を読み飛ばされないようにする | `<mark>` | gold のうっすらしたハイライト背景 |
| 判断軸・キーワードを地の文の色で目立たせる | `<span class="art-accent">` | `var(--gold2)` の文字色 + 600 |
| 価格・数量など見出し級に見せたい数字 | `<span class="art-num">` | 表示体（Cormorant Garamond）+ `var(--fs-lg)` + `var(--gold2)` |

**do**
- 1段落につき強調は1〜2箇所まで。効かせたい要点（数字・判断・結論）だけに絞る
- `<mark>` はその段落の「結論の一文」にのみ使う。複数使うと目が迷う
- 色はすべて `var(--gold2)` 系（サイトの唯一のアクセントカラー）。強調のたびに違う色を足さない

**don't**
- ほぼ全文を太字/マーカーにする（強調が効かなくなる = 何も強調していないのと同じ）
- 新しい色（赤・青など）を強調用に持ち込む。CTA配色（予約=gold、地図=blue）と混同させない
- font-size をリテラルで書く。`.art-num` 以外で文字サイズを変えたいときは既存トークンを使う

実装は `assets/css/nb.css` の `.art-body strong,.content strong` 以下（`.art-accent`/`.art-num` 定義の直前）。

---

## 4. 部品の解剖: 店舗カード（検索結果）

```
[写真 4:3]  左上: ジャンル 13px            右上: フラグ1つだけ
            左下: 撮影クレジット 12px       右下: 距離バッジ（距離ソート時のみ）
店名        17px/600 2行クランプ
メタ1行     エリア・価格帯・評価・信頼度を1行に
リード      14px/1.7 2行（編集部/業界人/プロの目利き、いずれか1つの接頭辞）
CTA         44px 予約 or 地図
media行     アイコンのみ、aria-labelでラベル維持
```

フラグの優先順位: 話題沸騰 > 注目上昇中/じわじわ人気 > 編集部推薦 > 業界人N名推薦 > プロの目利き。
実装は `index.html` の `buildCardHtml` 関数を参照。

### 特集の公開日・更新日・書き手（SEO-145・2026-10）

```
h1（題）
導入文
[部品] 公開 2026年4月15日   更新 2026年10月9日   執筆 NAGOYA BITES 編集部（現役の飲食店マネージャー）
meta 行  2026年版 / 現役飲食店マネージャー監修 / 名駅・栄・金山エリア対応
```

- 見た目は `assets/css/nb.css` の `.nb-byline`。13px（`--fs-xs`）、色は見出しまわりの地色を継承し、不透明度 .8。見出しを中央に寄せた特集でも左に揃える（隣の導入文・meta 行と同じ）。
- 中身は `scripts/lib/feature_byline.js` が JSON-LD の datePublished・dateModified から出す。画面に日付を手で書かない（`docs/decisions/0010-feature-dates-single-source.md`）。
- 更新日は公開日より後のときだけ出す。meta 行が空になった特集では、部品が見出しまわりの最後の行になり、下の余白が meta 行と同じになる（`.nb-byline--end`）。
- 狭い画面では「（現役の飲食店マネージャー）」が1つのかたまりで折り返す（`.nb-byline-note`）。

### 特集の「先に結論」（SEO-122・2026-10）

```
[部品] 先に結論：予算で選ぶなら                       ← 見出し 15〜16px・太字
       まずは気軽に（〜5,000円）                      ← ラベル 13px・金
       店名（店舗ページへのリンク）                    ← 15〜16px・太字・下線
       栄 / ダイニングバー・バル / 4001～5000円        ← 事実 14px
       …（2〜3行）
       下の掲載店から、価格帯ごとに…選んでいます       ← 注記 13px
       エリアとジャンルで探す  [名駅のイタリアン・フレンチ] [錦・伏見の…]   ← ハブへのリンク（高さ44px）
```

- 見た目は `assets/css/nb.css` の `.nb-conclusion`。白地に金の左線で、すぐ下の「選び方のポイント」（`.tips-box`・灰地）と区別する。文字はすべてトークン（13px 以上）。
- 中身は `scripts/apply_feature_conclusions.js` が `data/feature_conclusions.json` の行の条件（価格帯）で、その日の一覧（ItemList）から選んで書く。手で書かない。月次の掲載店の入れ替えにも同じ日のビルドで追従する。
- 店について書くのは `data/stores.json` の事実（エリア・ジャンル・価格帯・個室）だけ。条件に合う店が無い行は出さず、2行未満なら部品ごと出さない。
- 置き場所は `.art-body` の先頭（`<!-- NB_CONCLUSION:START -->` 〜 `END`）。

### 電話するボタンの結果の行（I-36・2026-10）

```
[部品] [HotPepperで予約]
       [電話する]  [Googleマップ]
       この店の電話番号は Google に登録がありません。Googleマップで確かめられます。   ← 13px・本文色
```

- 見た目は `assets/css/nb.css` の `.nb-call-status`。13px（`--fs-xs`）、本文の色。ボタンの下に1行だけ出す。トップのクイックビュー・スマホの追従バー・店舗ページの3か所で同じ部品。
- 押したあと、確かめている間は「電話番号を確かめています…」、取れなかったときは理由と次の手（Googleマップ）を出す。文は `scripts/lib/call_button_snippet.js` の1か所にある（`index.html` と店舗ページが同じものを読む）。番号を取れて発信するときは何も出さない。
- 空のときは画面に場所を取らず（余白も増やさない）、読み上げのためにページの中には置いておく（`role="status"`）。文が入ると1行を取る。アイコンだけのボタン（追従バー）でも、結果はこの行で見える。
- 色は赤にしない（店の落ち度ではなく、電話番号を確かめられなかっただけ。叱る色にしない）。

---

## 5. 新規ページの雛形

新しい静的ページ（root 直下、または `features/`）を作るときは以下の `<head>` をベースにする。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ページタイトル｜NAGOYA BITES</title>
<meta name="description" content="...">
<link rel="canonical" href="https://nagoya-bites.com/....html">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#7a5c10">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Shippori+Mincho:wght@500;600&family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/nb.css">
<style>
/* ページ固有のCSSのみ。トークンはnb.cssのものを参照する。font-sizeのリテラル値は書かない */
</style>
</head>
<body>
<a class="skip-link" href="#main-content">本文へスキップ</a>
<header>
  <a class="logo" href="/index.html">Nagoya <em>Bites</em></a>
  <nav>
    <a href="/index.html">店舗一覧</a>
    <a href="/journal/index.html">ジャーナル</a>
    <a href="/features/index.html">特集</a>
    <a href="/features/editorial-policy.html">編集規約</a>
    <a href="/about.html">運営について</a>
  </nav>
</header>
<main id="main-content">
  <!-- ページ本体 -->
</main>
<footer>
  <div class="fl2">Nagoya <em>Bites</em></div>
  <div class="footer-links">
    <a href="/about.html">運営について</a>
    <a href="/faq.html">よくある質問</a>
    <a href="/contact.html">お問い合わせ</a>
    <a href="/privacy-policy.html">プライバシー</a>
  </div>
  <div class="fc">© 2026 Nagoya Bites. All Rights Reserved.</div>
</footer>
</body>
</html>
```

作成後は `node scripts/audit_design_system.js --check` を必ず通す。手順の全体は `agents/designer.md` 参照。

---

## 6. 密度の目安（数値目標）

| 指標 | 目標 |
|---|---|
| 可視文字が12px未満 | 0件 |
| 12px以下の割合 | 10%以下 |
| モバイル1画面目の文字数 | 500文字以下 |
| 検索結果カードの要素数 | 12以下 |
| 操作要素の高さ | 44px以上 |

計測は `node scripts/measure_typography.js` で行う。

## 7. サイト共通クローム（DSN-003・2026-09）

ヘッダー（ロゴ・ハンバーガー・ナビ）・パンくず・フッターは、`scripts/lib/site_chrome.js` を唯一の正本とする。**ナビ項目・フッターのリンク先はここだけに書く**。HTML に直接書かない。

```
主要ナビ（5項目）: 店舗を探す / 特集 / ジャーナル / 編集規約 / 運営について
補助ナビ（≤900px ドロワーのみ）: よくある質問 / お問い合わせ
フッター3群: 探す / 読む / 編集部
```

既存ページへの適用は `scripts/apply_site_chrome.js`（`apply_design_system.js` と同じ冪等スイープモデル）。

```bash
node scripts/apply_site_chrome.js --dry-run [--only root|features|journal|stores]
node scripts/apply_site_chrome.js [--only <dir>]
node scripts/apply_site_chrome.js --check          # 冪等性確認（CI 向け）
node scripts/lib/site_chrome.js --render header --depth 1 --active features   # 雛形出力
```

ヘッダー/パンくず/フッターは `<!-- NB-CHROME:HEADER|BREADCRUMB|FOOTER|SCRIPT:START/END -->` マーカーで囲む。新規ページ・新規生成器はこのマーカーを維持し、`renderHeader`/`renderBreadcrumb`/`renderFooter`/`chromeScript` を呼ぶこと。ナビの該当項目には `aria-current="page"` を付け、`class="active"` は使わない。

**「本文へスキップ」と `<main>` もクロームが出す（I-26a・2026-10-12）。** `renderHeader` は先頭に `<a href="#main-content" class="skip-link">本文へスキップ</a>`、最後（`</header>` の直後）に `<main id="main-content">` の開きを出し、`renderFooter` は最初に `</main>` を出す。ヘッダーとフッターは `<body>` の直下で隣り合うので、その間の本文がそのまま `<main>` の中に入る。ページ側で `<main>` を書かない。例外が2つある。

* **ページ自身が `<main>` を持つ**（`contact.html`・`privacy-policy.html` など）: `renderHeader({ main: false })`・`renderFooter({ main: false })` にして、自前の `<main>` に `id="main-content"` を付ける。`apply_site_chrome.js` はこれを自動で判定して揃える（`id` が別の値なら `main_id_conflict` で知らせる）。
* **トップ（`index.html`）**: `<body>` の先頭に自前の「本文へスキップ」を持つので、ヘッダーのブロックでは出さない（`renderHeader({ skipLink: false })`）。

`<main>` で包むために、ヘッダーの終わりとフッターの始まりで**開いている要素の並びが同じ**でなければならない（`<article>` を開けたまま閉じ忘れると、フッターが article の中に入って `<main>` と交差する）。`tests/skip_link_main.test.js` が静的ページ（トップ・運営系・特集）と、生成器の出力（店舗ページ・ハブ・日次ジャーナル）でこれを検査する。スキップリンクは `nb.css` の `.skip-link`（画面の外に置き、フォーカスが当たると左上に出る）が持つ。

**`<nav>` の規則はヘッダーの `#main-nav` だけに当てる（DSN-007・2026-10-09）。** パンくず・フッターのリンク群（`nav.nb-footer-group`）・目次（`nav.nb-toc`）も `<nav>` 要素なので、素の `nav{…}` にレイアウト（横並び・間隔・中央寄せ）やドロワー（`position:fixed`）を書くと、それらまで同じ形になる。DSN-003 から 2026-10-09 まで、幅 900px 以下ではパンくずとフッターのリンク群が画面外に置かれて見えず、スマホのレイアウト幅も 375px で 750px に広がっていた。素の `nav a` に残してよいのは文字の見た目（書体・太さ・色）だけ。

閉じたドロワーは `display:none` にする。画面の外に置いておくだけ（`right:-100%` でも `transform` でも）だと、スマホのレイアウト幅がその分広がる。開くときのスライドは `@starting-style` と `transition-behavior:allow-discrete` で出す（未対応のブラウザでは即時に開閉する）。確かめるときは、幅 375px の `isMobile` 表示で `document.documentElement.scrollWidth` が 375 であることを見る。

記事系ページ（journal・features）の本文組版は `assets/css/nb.css` の記事システム（`.art-hero` / `.art-title` / `.art-body` / `.store-card` / `.related` / `.topcta` 等）が所有する。ページ固有の `<style>` にはこれらのセレクタのトップレベル定義を書かない。journal は `journal/_template.html` の `<style>` を正本とし、既存記事へは冪等スイープで揃える。features は SEO-042 TOP-CTA（`add_feature_top_cta.js`）・SEASONAL_NOTE（`build_featured.js`）・新顔バッジ（`refresh_feature_rosters.js`）の注入 CSS をマーカー行のみにし、実装は nb.css 側に置く。
