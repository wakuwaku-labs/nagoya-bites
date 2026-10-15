status: in_progress

# UI・UX のアニメーション（動き）の導入計画（2026-10-16〜）

（前のメモ「X 自動投稿の中身を共有されたくなるものにする」は status: archived。残りの確認〈10/16 09:00 のジャーナルの後に X の文面が保存した文面で出たか・P-476/P-296〉は、git 履歴 67c5e48a56 の HANDOFF.md の「次にやること」2〜3）

## 目的
- サイトに動きを取り入れる。入れる場所と入れない場所を分け、根拠つきで実装計画にする（オーナー 2026-10-16「入れるべきポイントと入れないべきポイントをしっかりと分けて」）

## 完了条件
- 計画書（docs/animation-plan-2026-10.md）に、入れる所・入れない所・既にある動きの直し・段階・測り方・守ること が書かれている
- 既存の決定（docs/decisions/）・UI・UX 改修計画（設計ブランチ wakuwaku-labs/mooneye）・デザインシステムと衝突しない
- 実装は計画の承認の後（この回は計画まで）

## できていること
- 2026-10-16 01:1x: 調査を3本並列で開始（今の動きの棚卸し／既存の決定・デザインシステム・速さの基線／一次情報の事実確認）

## 次にやること
1. 調査結果を突き合わせて計画書を書く
2. Linear に親課題と段階ごとの子課題を起票

## 試したが駄目だったこと
- なし

## 守るルール・判断メモ
- 計画は docs/decisions を先に読み、事実／仮説／未確認を分ける（メモリ plan-review-lessons）
- 制約12: 新しい UI 部品・テンプレート変更は Designer のレビューと audit_design_system.js --check が公開条件
- 速さ（CLS・LCP・TBT）を悪くしない。前後は同じ日・同じ電源で測る

## 関連ファイル
- assets/css/nb.css / data/design_system.json / docs/design-system.md / agents/designer.md
- index.html / gen-store-pages.js / scripts/gen_area_genre_pages.js / journal/_template.html
- docs/qa/uiux-2026-10/（速さの測定の道具と基線）
