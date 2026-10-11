status: in_progress

# 目的
UI・UX全面改修計画（`docs/uiux-overhaul-plan-2026-10.md`）の実装を、段階の順に進める。オーナーの「進めて」（2026-10-11）を、4.4 節 #1（計画全体の承認。推す案は段階0 → 1 → 2）への回答として扱う。#2〜#11（文案・フォント・外部変換サービス・索引・404・FAQPage など）は未決なので、それに関わる改善案は、オーナーの承認を取ってから main に入れる。

# 完了条件
- 段階0（I-01・I-02・I-08）が、改善案ごとに別のプルリクエストになり、`npm test` と関係する監査が通っている
- 段階1a（I-21・I-23・I-07・I-13）以降も、同じ進め方で1つずつ出す（9.4 節）。main への合流は Codex のレビューの後。「要」の改善案はオーナーの承認の後
- 各プルリクエストに Linear の課題があり、結果がコメントに残っている

# できていること
- 設計書の再設計は済み（commit 0c9200e52d・81eeb6a1ec。読みやすい版: https://claude.ai/artifact/E8kRtmcAeNE7VKxznopMDt）
- **I-01（ISSUE-188・P-223）: PR #470**（claude/uiux-i01-stub-links）。このブランチの 336d4b569c・ec6c4672ab が I-01 そのものの修正だった（前に「設計の外」と書いたのは誤り。P-235 に訂正を書いた）。`npm test` 495件通過・誘導ページへのリンク0件。バックログの ISSUE-188 は done。マージされたら P-223 を Done にする
- 作業は main から切った別ブランチ＋別 worktree で行う（設計のブランチ wakuwaku-labs/mooneye には混ぜない）。worktree は作業用の一時領域の `wt/i01`・`wt/i08`（node_modules は設計のブランチの worktree へのシンボリックリンク）。消えたら `git worktree prune` し、ブランチ名から作り直す
- **I-08（計測をそろえる）: PR #471**（claude/uiux-i08-measurement・origin/main から）。Linear P-239（P-235 の子）。GA4 のカスタムディメンション登録（オーナーの操作）は P-240。実装・テスト・監査まで済み、**Codex のレビュー待ち**
  - 変えたこと: ハブの予約リンクを cta_click（location=hub）へ／modal_open に store_id／特集の feature_store_click の店の値をスラグ（ID）へ（947件すべてリンク先と一致・features/ 54本）／ジャーナルに journal_store_click を新設（別 script・テンプレート＋157本に追加のみ）。テスト tests/measurement_unify.test.js 12件。npm test は506件中505件（失敗1件は main の ISSUE-188 で #470 が直す）。4つの監査は終了コード0
  - ハブ約685本は PR に入れない（build.yml が毎日作り直す）。作り直した日に「データ更新日」・sitemap lastmod・IndexNow の対象が一度だけ進む（テンプレート変更時と同じ動き）。PR 本文に書いた
  - マージ後にやること: `data/measurement_changes.json` に I-08 を追記（PR 本文に下書き。日付はハブを build.yml が作り直して push した日）。計画 7.7 節に journal_store_click・ハブの cta_click・modal_open の store_id・GA4 未登録ディメンションの注を足す（設計のブランチで）
- **I-02（基線）: あと少し**（claude/uiux-i02-baseline・origin/main から・worktree は一時領域の `wt/i02`・**まだコミット前**）。Linear: **P-241**（親・In Progress・P-235 の子）／**P-242**（子: ワークフローが main に入ってから GA4 を実測・Todo・期限 10-20）。P-235 は In Progress にした
  - 作った物（すべて wt/i02 の未コミット）: `scripts/ga4_baseline.js`＋`scripts/lib/ga4_baseline.js`（GA4 の期間指定の取り直し。テスト25件。15通りに壊して確かめ、生き残った2つ＝30件ちょうどと0件のセルは境界のテストを足した）／`.github/workflows/ga4-baseline.yml`（手動・読み取りのみ・Chromium は落とさない）／`docs/qa/uiux-2026-10/perf.js`（ページ種別を一周×回数の順・描画されなかった回は最大2回やり直し・`visibility`／`lcpUrl` を記録・画面が消えても止まらない起動オプション）と `perf_summary.js`（**描画されなかった回＝FCP か LCP が 0 を無効として中央値に入れない**・目標超の回数・LCP の画像 URL。テスト12件）／`CLAUDE.md` に2行
  - **速さの測定で分かったこと**: 1回目（`perf_runs.jsonl`・35回・同じページを続けて測った・有効）。2回目（`perf_runs2.jsonl`）は **35回中22回が画面が見えない状態で FCP・LCP・CLS が 0 になり無効**＝使わない（`perf.js`／`perf_summary.js` の対策の理由）。3回目（`perf_runs3.jsonl`・10周×7ページ=70回・11:53Z 開始・約20分・裏で実行中）が基線になる
  - **計画 3.6 節の1回測定と、1回目の5回中央値が合わない**: 店舗ページの LCP 6.1s→1.7s（写真は縮小版 `_480`。U-58 の切り替えの可能性）／TBT は数秒→0〜0.2s（ジャーナル一覧だけ 1.1〜1.3s で再現）／ハブの CLS 0.65→0.013 と 0.652 に割れる（3回目で割合を見る）／ジャーナルの CLS 0.128 は毎回同じ（再現）／トップの LCP 約10s（4.5〜11.8s で揺れる）・通信 6.2MB・DOM 12,785・フォント 1.3〜1.7MB/ページは再現。原因は未確認。**計画 2.2・3.6・U-53/U-54・4.3 I-14 の期待効果・1119 行・1494 行・10.2 #7 を、10回の中央値と目標超の回数に直す**（設計のブランチで・I-02 の PR を出した後）
  - 残り: ①3回目が終わったら `node docs/qa/uiux-2026-10/perf_summary.js $SCR/baseline/perf_runs3.jsonl --label before-uiux-overhaul --date 2026-10-11 --out docs/qa/uiux-2026-10/baseline/perf-2026-10-11.json`（`$SCR` は一時領域のパス）②速さが終わってから `node scripts/measure_typography.js --url https://nagoya-bites.com/ --viewports 375x812,768x1024,1280x900 --out docs/qa/uiux-2026-10/baseline/typography-2026-10-11.json` ③`pr_i02.md` の `__…__` を埋める（テスト 25+12=37件・数字を直す）④`npm test`・`audit_design_system.js --check`・`audit_inline_js_syntax.js --check` ⑤コミット（末尾 Co-Authored-By）・push・`gh pr create`→P-241 に PR 番号をコメント ⑥設計のブランチで計画を直し、設計のブランチの `perf.js` を I-02 の最終版に合わせる ⑦記憶（uiux-overhaul-plan-2026-10.md）を更新
- 判断の記録 0017（実装の進め方）は設計のブランチに追加済み（1175f4ec1f）
- 検証済みの事実: `gen_area_genre_pages.js --check` はテストでは回らない（CI の生成だけ）。`tests/area_genre_pages.test.js` は stores/area の存在を見る

# 次にやること
1. （済）I-08 は PR #471・Linear P-239。P-240（GA4 のカスタムディメンション登録・オーナー作業・期限 2026-10-18）を起票済み。Codex のレビューを待つ（レビューの依頼先・方法はオーナーに確かめる）
2. I-02（基線）: スクリプト・ワークフロー・テスト・速さの道具は済み。上の「残り」①〜⑦を順に（速さの3回目の測定が終わるのを待つ。測定中は puppeteer を使う作業・重いテストを走らせない）。PR を出したら P-241 にコメント。P-242（GA4 の実測）は、PR が main に入り、ワークフローが dispatch できるようになってから
3. 段階1a: I-21（URL と戻る）・I-23・I-07（英語の表示）・I-13（スプラッシュ）。トップだけ。画面は 390px と 1280px で見る
4. Linear: 次の改善案に着手するときに、P-235 の子として起票（7項目: 動詞のタイトル・担当と期限・状態・Project=Nagoya Bites・背景・達成条件・30分超は sub-issue。ラベルは KR:検索から見つけてもらう＋担当:Builder）。起票済み: P-239（I-08）・P-240（GA4 登録）。ISSUE-188 は P-223 に結果をコメント済み
5. 判断の記録: docs/decisions/ に「実装は改善案ごとの PR。main への合流は Codex のレビューの後、『要』はオーナーの承認の後」を残す
6. Codex の 4ab7ea556a（Linear 導入ファイル4つ）の扱いは、オーナーの判断待ち（P-235 に記録済み）

# 試したが駄目だったこと
- `.linear.json` が未設定だったため初期導入を行った（Codex）。初回生成は slug `nagoya-bites` の新規 Project を作った。既存の正しい Project 名が `Nagoya Bites` と確認できたため、`.linear.json` は既存 Project を指す名称に直した。空の重複 Project は削除していない
- puppeteer の画面の書き出しは、この環境では白紙のページでも時間切れになる。DOM の確認で代えた（実際の画面は Chrome 拡張のツールで見られるかもしれない）
- 電話の紐付けを店名だけで確かめると、同じ住所の同じ店でも表記の違いで1,578店が落ちた。住所を先に比べる規則に変えた

# 守るルール・判断メモ
- 改善案ごとに別のプルリクエスト。1つずつ出し、効果と副作用を見てから次へ（9.1 節）。main へは Codex のレビューの後。4.4 節の「要」の改善案はオーナーの承認の後。自分では main に入れない
- 電話番号はデータに持たない。電話を出す店の規則・番号を取れなかったときの表示は 7.3 節と I-36
- リポジトリは公開なので、鍵の値やセキュリティの詳細を公開のファイルに書かない
- 店の選び方は、人間が全店を選んだように書かない（オーナーの指示）
- コミットの末尾: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`。force push・reset はしない
- 共有の stash（`git stash list`）には触らない

# 関連ファイル
- `docs/uiux-overhaul-plan-2026-10.md`（4.2 一覧・4.3 改善案・4.4 決めてもらうこと・7.7 計測・第9章 順序・10.4 タスク）
- `scripts/gen_area_genre_pages.js`・`scripts/refresh_feature_rosters.js`・`scripts/add_feature_tracking.js`・`scripts/lib/feature_tracking.js`・`scripts/add_journal_engagement_tracking.js`・`journal/_template.html`・`index.html`
- `data/measurement_changes.json`・`scripts/lib/reservation_exits.js`・`docs/reservation-measurement.md`
- Linear P-235（親）・P-236（Codexレビュー・Done）・P-237（オーナーの決定）・P-223（ISSUE-188）
