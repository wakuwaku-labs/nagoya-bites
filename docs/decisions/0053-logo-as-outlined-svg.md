# 0053 ロゴを文字の輪郭にした SVG にする（nb.css の背景として）

- 日付: 2026-10-21
- 状態: 採用（見た目が変わるため、公開はオーナーが前後の画面を見てから）
- 関連: Linear P-321（親 P-235）/ 計画 I-12・5.3 節 / 判断の記録 0026（Web フォントをやめた。ロゴは文字のまま→別の課題）/ `scripts/gen_logo_svg.py` / `assets/css/nb.css`（`.logo`）

## 背景
- 0026 でロゴは文字のまま端末の明朝に任せた。端末ごとに字形と幅が変わる（390px の画面で約 220px）。計画 5.3 節は「ロゴ＝SVG」。

## 決めたこと
1. 「NAGOYA BITES」の12文字を、Cormorant Garamond（400・SIL Open Font License 1.1・Cormorant Project Authors）の輪郭にした SVG にし、`assets/css/nb.css` の `.logo` の背景（data URI・約 8 KB・CSS と一緒に1回だけ読む）にする。
2. 新しいファイルは増やさない（CLAUDE.md 制約1。サイト用の追加は nb.css のみ可）。書体ファイルも置かない。輪郭の SVG だけを CSS に入れる（書体を配ることにならない＝0026 の見直す条件に当たらない）。
3. 文字（`Nagoya <em>Bites</em>`）は HTML に残し、`font-size:0` で見えなくするだけ。読み上げ・検索・リンクの押す範囲（44px の `::after`）は変えない。
4. 色は固定（NAGOYA＝`--ink` の値・BITES＝`--gold` の値）。ダークモードは無い。色を変えるなら `scripts/gen_logo_svg.py` の色を変えて作り直す。
5. 作り直し: `python3 scripts/gen_logo_svg.py <Cormorant Garamond の可変 TTF> <出力 SVG>`（fontTools が要る。サイトの依存ではない）。出力を `.logo` の `background:url(...)` に貼る。

## 選ばなかった案
- 別ファイル `assets/img/logo.svg`: 制約1（新ファイル禁止）に反する。
- 各ページに SVG を埋め込む: 約 8 KB × 約 6,000 ページ。
