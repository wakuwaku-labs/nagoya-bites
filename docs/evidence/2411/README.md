# #2411 audit_ui_extra.js 前後比較の記録（2026-11-21）

別の出力 `scripts/audit_ui_extra.js`（明暗差・押せる大きさ・入力欄16px・100vh・safe-area・viewport-fit）を足した。
`scripts/audit_design_system.js` と `data/design_system.json` は変更なし（`git diff` 0行）。

## 既存の出力の前後一致
- 代表4ページ（index.html・features/banquet.html・journal/2026-04-21-yabamisen-nagoya-insider.html・stores/J000015064.html）で
  `audit_design_system.js --check` と `--report` を、変更前（`git archive HEAD` の scripts）と変更後で1回ずつ。
  `before-*.json` と `after-*.json` は `cmp` で完全一致、終了コードも 0 で一致（`*.exit`）。ok=true・files_scanned=4・violations=0・motion.total=0。
- 公開サイト全体（6095ページ）でも `--check` を前後で比較: ok=true・違反0・motion.total=14・終了コード0 で一致。

## 足した別の出力（代表ページ・ui-extra-representative.json）
5ファイル（4ページ+nb.css）: 17件 = low-contrast 2 / tap-target-24 2 / tap-target-44 2 / input-font-16 2 / vh-100 3 / safe-area-bottom 2 / safe-area-no-viewport-fit 4 / viewport-zoom-locked 0。同じ入力で2回走らせて一致。
合否は決めない（数えるだけ・終了コードは常に0）。
