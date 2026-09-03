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
- 操作要素（ボタン・リンク・チップ）は 44px 以上
- font-size はすべてトークン（`var(--fs-*)`）を参照する

**don't**
- font-size のリテラル値を新規に書かない（`12px` や `.8rem` を直接書かない）
- `:root` を再定義しない（nb.css の値を上書きしたい場合は `--page-` 接頭辞の新トークンを足す）
- 日本語に等幅フォントや `text-transform:uppercase` を使わない
- 英語と日本語で同じ意味の見出しを二重に出さない
- 読み込んでいないフォントウェイトを指定しない（許可: 400/500/600/700）

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
