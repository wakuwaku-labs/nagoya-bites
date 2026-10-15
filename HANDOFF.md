status: in_progress

# UI・UX のアニメーション（動き）の導入計画（2026-10-16〜）

（前のメモ「X 自動投稿の中身を共有されたくなるものにする」は status: archived。残りの確認〈10/16 09:00 のジャーナルの後に X の文面が保存した文面で出たか・P-476/P-296〉は、git 履歴 67c5e48a56 の HANDOFF.md の「次にやること」2〜3）

## 目的
- サイトに動きを取り入れる。入れる場所と入れない場所を分け、根拠つきで実装計画にする（オーナー 2026-10-16「入れるべきポイントと入れないべきポイントをしっかりと分けて」）

## 完了条件
- 計画書（docs/animation-plan-2026-10.md）に、入れる所・入れない所・既にある動きの直し・段階・測り方・守ること が書かれている
- 既存の決定（docs/decisions/）・UI・UX 改修計画（設計ブランチ wakuwaku-labs/mooneye）・デザインシステムと衝突しない
- 段階 0〜2（P-488〜P-490）を順に実装する。見た目が変わる段階 1・2 はオーナーが前後の動画を見てからマージ

## できていること
- 2026-10-16 01時台: 調査3本（今の動きの棚卸し／既存の決定・デザインシステム・速さの基線／一次情報）→ 計画書 docs/animation-plan-2026-10.md を書いた。行番号は自分で照合済み
- 調査の訂正: 「話題店バッジの点滅」「信頼度の棒が伸びる」は CSS だけで画面に出ていない（死んだ CSS → 消す対象）。端末はスマホと PC がほぼ半々（28 日 685／719）なので、ホバーは残して短く・控えめにする
- Linear: 親 P-487・段階0 P-488・段階1 P-489・段階2 P-490（Todo・期限 2026-10-30）
- npm test 1784 件通過（文書だけの変更）
- PR #617 を作成（ブランチ wakuwaku-labs/coffinfish・push 済み）。Build & Deploy の走行が終わってからマージする（メモリ: ビルド中に次をマージしない）
- 読む用の HTML を scratchpad に作り Chrome で開いた（animation-plan-2026-10.html・marked を CDN から読む）

- 2026-10-16 01:5x: #617 をマージ（efdff51b89）。オーナーの答え: 判断 1＝A（入場の動きをやめる・ホバーは枠と影だけ）、判断 2＝A（段階 0〜2 を順に）。P-487 にコメント、P-488 を In Progress
- 段階 0 を実装中: 計画書の状態と 10 章を更新、判断の記録 0049 を書いた。並列の担当2つ（A: トークン・design_system.json の motion・scripts/lib/motion_audit.js・監査の report・テスト・design-system.md・designer.md・CLAUDE.md の表／B: docs/qa/uiux-2026-10/e2e_motion.js と baseline/motion-2026-10-16-before.json）。どちらもコミットしない約束で同じ木を編集中

- 2026-10-16 02時台: 段階 0 の担当 A の分をコミット（2dd047cdb9・ブランチ wakuwaku-labs/coffinfish・未 push）。0049 は main と重ならない（main の最新は 0048）
- 段階 1 を別の木 `../motion-stage1`（ブランチ wakuwaku-labs/motion-stage1・2dd047cdb9 から）で実装しコミット（5544ba4310・未 push）。F1〜F8・店舗ページの雛形・motion.enforce=true。npm test 1801 件通過・audit --check 通過・店舗ページ 40 本を再生成して動きの違反 0・構文エラー 0（再生成分は戻した）。node_modules は coffinfish へのシンボリックリンク（コミットしない）
- 並行: 担当 B（e2e_motion.js・基線の JSON）は自分の測定の完了待ち。担当 C（`docs/qa/uiux-2026-10/rec_motion.js`・前後の動画を撮る道具）を作成中

## 次にやること
1. 担当 B の結果を確かめる → e2e_motion.js と基線を段階 0 に足す → PR（coffinfish）→ ビルドが止まっている時にマージ → P-488 Done
2. 担当 C の道具で、before（origin/main の木）と after（motion-stage1）を 390/1280 で撮る → オーナーに見せる。F9（クイックビューのぼかし）は CPU 4 倍でコマを測ってから決める
3. 段階 1 は main を取り込み、マージする日に充電器で perf.js の前後を測ってから PR → オーナーの OK でマージ → P-489 Done
4. 段階 2（P-490）

## 試したが駄目だったこと
- なし（効果＝クリックの増減は規模が小さく見分けられないので測らない。計画書 8.1 節）

## 守るルール・判断メモ
- 計画は docs/decisions を先に読み、事実／仮説／未確認を分ける（メモリ plan-review-lessons）
- 制約12: 新しい UI 部品・テンプレート変更は Designer のレビューと audit_design_system.js --check が公開条件
- 速さ（CLS・LCP・TBT）を悪くしない。前後は同じ日・同じ電源で測る
- 0038（閉じる動きは付けない）を守る。UI・UX 計画書 1350 行の「出入り 200ms」より 0038 を優先
- 判断 1＝A の読み方: カード（店・特集・話題店・最新ジャーナル）のホバーは枠と影だけ（持ち上げ・写真の拡大・色の強調・下線や矢印の伸びも外した）。文字のリンク（.nb-more・.nsl-arrow）は transform の小さな動きを残した。ボタンの 1px の持ち上げは残し、@media(hover:hover) の中へ入れた
- ルート直下の about・faq・contact の 300ms 超（8 件）と手書きの特集（4 件）は落とす対象の外（計画 6 章と同じ扱い）

## 関連ファイル
- assets/css/nb.css / data/design_system.json / docs/design-system.md / agents/designer.md
- index.html / gen-store-pages.js / scripts/gen_area_genre_pages.js / journal/_template.html
- docs/qa/uiux-2026-10/（速さの測定の道具と基線）
