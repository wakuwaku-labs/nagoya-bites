status: done

# 目的
Linear P-236（DSN-014）を実施する。UI・UX全面改修計画をレビューし、指摘を設計書に反映して課題を完了する。

# 完了条件
- Codex の指摘と処置が設計書または Linear コメントに残る
- `node docs/qa/uiux-2026-10/counts.js` の出力が設計書の数値と一致する
- Linear P-236 が Done になる

# できていること
- `docs/uiux-overhaul-plan-2026-10.md` にレビュー節（10.6）を追加。
- T2 を電話から地図を開くタスクへ変更。操作回数の比較に開始状態・対象店・スクロールの数え方を規定。
- `counts.js` の結果は U-01/U-31/U-35/U-71/U-73 と店舗データの該当数値に一致。
- サイトコードは変更していない。

# 次にやること
- 完了（2026-10-11）: レビュー結果をP-236にコメントし、Doneへ変更。設計書の10.6に指摘・処置・counts照合結果を記録した。
- この作業の変更を作業ブランチにコミットする（push・mainへの合流は行わない）。

# 試したが駄目だったこと
- `.linear.json` が未設定だったため初期導入を行った。初回生成は slug `nagoya-bites` の新規Projectを作った。既存の正しい Project 名が `Nagoya Bites` と確認できたため、`.linear.json` は既存 Project を指す名称に修正した。空の重複Projectは削除していない。

# 守るルール・判断メモ
- 設計書レビューのみ。サイトコードの編集・デプロイはしない。
- `.linear.json` は既存 Project「Nagoya Bites」を参照する。
- autopilot のブランチ運用に従い、force push・reset はしない。

# 関連ファイル
- `docs/uiux-overhaul-plan-2026-10.md`
- `docs/qa/uiux-2026-10/counts.js`
- `.linear.json`
- Linear P-236（DSN-014）
