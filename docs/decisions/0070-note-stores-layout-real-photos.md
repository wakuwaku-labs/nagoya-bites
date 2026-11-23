# 0070 note は店ごとの形にし、店の公式 Instagram の写真カードと街の実写真で画像を入れる（0054 の excerpt を置き換え）

- 日付: 2026-11-23
- 状態: 採用（ADR 0054 の本文の形 excerpt を置き換え。0056・0065 の見出し画像の決まりに「街の写真」を足す）
- 関連: scripts/lib/note_draft.js（storePhotoCard・areaPhoto・body.mode=stores）/ scripts/post_note.js（本文の途中のカード）/ scripts/lib/note_eyecatch.js（overlayAllowed）/ data/note_post_policy.json / data/note_area_photos.json / tests/note_draft.test.js / SNS分析ツール src/analysis/note-next.ts

## 背景
2026-11-23 本人「nagoya bites の note、画像が全くない。トップ画面、投稿の中間など。閲覧数やいいねが増えるように構成や中身を考えて」。
調べた事実: 30本の記事の見出し画像は題だけの文字の図（PR TIMES の写真がある日だけ写真）、本文の画像は0枚、クリエイターページのヘッダー画像は無し、スキは0〜1、フォロワー1。本文は導入＋最初の1節で「この先は元記事で」と切れていた。
AI で作るイメージ画像（月約¥1,350）を提案したところ、本人は「実際の写真を何か使える方法を考えて欲しい」と答えた。

## 決めたこと
1. 本文は店ごとの形（body.mode=stores）: 全部の節を載せ、店の節は「どんな店か（最初の段落）」と「行く前のひとこと」だけ。営業時間・予算などの細かい数字は元記事の店の欄へ。最後に「スキ・フォロー」をお願いする一文（policy.closing）。全文は載せないので、0054 の「同じ文章が2か所」の心配は小さいまま。
2. 店の節の見出しの直後に、店の公式 Instagram の投稿 URL を置く。note の編集画面は URL だけの行を「写真つきのカード」にする（2026-11-23 実測。写真は Instagram から表示され、note のサーバーへの複製ではない＝0056 の『上げてよい写真』の対象外）。
   - 使うのは instagram_resolved.json の公式アカウントと、投稿 URL のアカウントが一致する投稿だけ。投稿が無い店は公式アカウントのページ（店のアイコンのカード）。別の支店と確かめて外したアカウント（failed）と公式が空の店には付けない。
   - カードの下に「写真: 店の公式Instagram（@アカウント）」と出どころを書く。カードにならなかった URL（消された投稿など）は行ごと消す。
   - ホットペッパーの URL は note でカードにならない（実測）ので使わない。
3. 見出し画像: PR TIMES の写真（0056・0065）→ 無い日は、記事の街（題名の地名 → 店のエリア）の実写真（Wikimedia Commons の CC0・パブリックドメイン・CC BY・CC BY-SA だけ。data/note_area_photos.json）に題と日付を重ねる。どれも改変を許すライセンスなので、overlayAllowed に upload.wikimedia.org を足した。クレジット（撮影者・ライセンス・元のページ・題を重ねたこと）を本文の最後に書く。同じ街でも日付で候補を回す。
4. SNS分析ツールの「今週試す1つ」は、節の数が意味を失ったので「題の長さ（full／short）」に替えた。

## 見直す条件
- Instagram の投稿が消える・非公開になる店が増えて、カードが出ない日が続くとき（post_note.js のログ「カードにならず外した URL」）。
- 店ごとの形にして2〜3週たっても、閲覧数・スキが excerpt の頃と変わらないとき（note_metrics.json で比べる）。
