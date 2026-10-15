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
- 段階 0 は #619 でマージ（bf80020b3b）・P-488 Done。段階 1 に F9（クイックビューの背景のぼかしを外す・620191a1a2）を足し、origin/main を取り込んだ（80ebc9955b・衝突は段階 1 の側を採った）。npm test 1801 件通過・audit --check 通過
- 直した後の e2e_motion: 「動きを減らす」のスクロールは 6 回中 6 回合格（前は 0 回）。押してから変わるまでは録画と同時に測ったので比べない（測り直す）
- 担当 C（rec_motion.js）は 02:07 から止まっていたので止め、自分で引き取った。前＝coffinfish を origin/main（bf80020b3b）に切り離して置いた木、後＝motion-stage1 で 22 本撮った。PC の「上へ戻る」が 1 回だけ時間切れ（撮り直し 2 回とも成功＝段階 1 の不具合ではない）→ 場面ごとに 1 回撮り直すようにした。スマホの読み込みの場面が左上に小さく写る（about:blank が幅 980）→ 幅を合わせた白紙から始めるようにした（293b3e37d3）
- 確認ページ: scratchpad の motion-rec/compare.html（前後 22 本を並べた。Chrome で開いた）
- 03時台: taps を前後交互に測り直した（バッテリー駆動・前→後→前→後・各 5 回）。前後で同じ程度で悪化なし（クイックビューの最大は前 208/232ms・後 192/200ms）。measure_typography（375/768/1280）は前後で同じ値。画面写真ははみ出し 0px・崩れなし
- PR #620 を作成（https://github.com/wakuwaku-labs/nagoya-bites/pull/620・Designer の QA-5 は承認）。P-489 に進み具合をコメント。前後の動画の確認ページは scratchpad の motion-rec/compare.html（Chrome で開いた）

## 次にやること
1. オーナーが前後の動画（compare.html・PR #620）と実機（iOS・Android）を見て OK を出すのを待つ
2. OK が出たら: 充電器につないで perf.js の前後を測る → Build & Deploy が走っていないことを確かめて #620 をマージ → 本番の nb.css・index.html を確かめる → P-489 Done
3. 段階 2（P-490: A1 押した瞬間の見た目・A2 ♡ の弾み・A3 チップの ✓・A6 件数の切り替え・A7 待ちの表示・トークンへの置き換え）を motion-stage1 から新しいブランチで。段階 2 も前後の動画を見せてからマージ
4. 全部終わったら status: done

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
