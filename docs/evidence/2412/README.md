# #2412 画面の地図・代表画面の基準値（2026-11-21）

足した物: `docs/ui-map.md`（画面のファイル・型・ナビの定義・代表画面・代表操作）、CLAUDE.md の短い節、
`scripts/measure_ui_baseline.js`、`data/ui_baseline_ratio.json`、`tests/measure_ui_baseline.test.js`、registry の1行。
`scripts/audit_design_system.js`・`scripts/audit_ui_extra.js`・`data/design_system.json` は変更なし（`git diff origin/main` 0行）。

## 書いたパスの実在
`docs/ui-map.md` のバッククォートで書いたファイルのパス 29件を `[ -e ]` で確かめ、29件すべて実在（このファイル自身を除く）。
CLAUDE.md の新しい節のパスも同じく実在。

## 割合の基準値が2回測って一致
`node scripts/measure_ui_baseline.js --write`（1回目＝`data/ui_baseline_ratio.json`）と、2回目の出力 `measure-run2.json` を `cmp` で比べて完全一致。
主な値（基準 main 59c7d2036d）: 既存の検査の違反がある代表画面 0/6・動きの数がある代表画面 1/6（特集一覧）・
`audit_ui_extra` の何かがある代表画面 6/6・読んだ CSS 規則あたり 16/1222・nb.css 3/296。

## 目的の確かめ: audit_design_system.js --check の前後一致
変更前（`before-commit.txt` の HEAD・作業ツリーに変更なし）と変更後で、既定の範囲（6095ページ）に `--check` を1回ずつ。
`before-check.json` と `after-check.json` は `cmp` で完全一致、終了コードも 0 で一致（`*.exit`）。ok=true・違反0・motion.total=14。
