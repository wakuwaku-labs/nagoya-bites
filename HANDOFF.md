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
- **I-08（計測をそろえる）: 調べ終わり、実装はこれから**（claude/uiux-i08-measurement・origin/main から切った）。分かったこと:
  - ハブの予約リンクは `scripts/gen_area_genre_pages.js:239` の `storeCard()` が `hub_store_click` を送っている → `(window.nbReserveExit||trackEvent)('cta_click',{store_name,store_id=HotPepper ID,link_domain:'www.hotpepper.jp',location:'hub',hub:location.pathname})` に替える。`jsq` は `scripts/lib/feature_tracking.js` から使える。`storeCard` は exports に無いので足す。ハブのページ（683本）は build.yml が毎日作り直すので、PR には入れない（生成器の出力を単体テストで見る）
  - `modal_open` は `index.html:10218` の `openM(i, source)`。source は既に入っている（grid・ranking・trend_today・history・modal_reco・deeplink・unknown）。足りないのは `store_id`（`r['ホットペッパーID'] || ''`。ほかの cta_click と同じ決まり）だけ
  - `feature_store_click` の store が店名（725件）になるのは `scripts/refresh_feature_rosters.js:323,357`。ID（222件）は `scripts/lib/feature_tracking.js` の `featureStoreOnclick`。生成器を後者に替え、`scripts/add_feature_tracking.js`（build.yml が毎日回す）に「店名の旧形式を、同じ <a> の href の stores/<slug>.html に書き換える」手順を足す。特集 features/*.html は書き換えた結果をコミットし、不変条件のテストを足す
  - ジャーナル→店舗ページは未計測（167本）。新しい `journal_store_click`（store・journal）を、別の `<script class="nb-journal-store-link">` として足す（`journal/_template.html` に入れ、既存の記事には `scripts/add_journal_store_link_tracking.js` で後追い。`add_journal_engagement_tracking.js` と同じ冪等の作り）。既存のスクリプトは書き換えない
  - `data/measurement_changes.json` への追記は、マージした日が決まってから（台帳は「commit や PR で確かめられる変更だけ」。書式は date・id・affects・summary・evidence）。PR の本文に下書きを書き、マージ後に追記のコミットを出す
  - 7.7 節（計測）と `docs/reservation-measurement.md` の記述も合わせて直す
- 検証済みの事実: `gen_area_genre_pages.js --check` はテストでは回らない（CI の生成だけ）。`tests/area_genre_pages.test.js` は stores/area の存在を見る

# 次にやること
1. I-08 を実装 → テスト（hub の storeCard・refresh_feature_rosters のカード・add_feature_tracking の書き換え・index.html の modal_open・ジャーナルの後追いの冪等）→ `npm test`・`audit_design_system.js --check`・`audit_inline_js_syntax.js --check` → PR → Linear に起票とコメント
2. I-02（基線）: GA4 の決まった期間を取り直すスクリプト（認証は CI の Secrets のみの可能性。取れないときはスクリプトとテストまで作り、実行は CI）。速さの基線は `docs/qa/uiux-2026-10/perf.js`（この環境の puppeteer は時間切れになることがある）
3. 段階1a: I-21（URL と戻る）・I-23・I-07（英語の表示）・I-13（スプラッシュ）。トップだけ。画面は 390px と 1280px で見る
4. Linear: 実装の課題を起票（7項目: 動詞のタイトル・担当と期限・Todo・Project=Nagoya Bites・背景・達成条件・30分超は sub-issue）。ISSUE-188 は P-223 に結果をコメント済み
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
