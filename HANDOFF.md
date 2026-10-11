status: in_progress

# 目的
UI・UX全面改修計画（`docs/uiux-overhaul-plan-2026-10.md`）の実装を、段階の順に進める。オーナーの「進めて」（2026-10-11）を、4.4 節 #1（計画全体の承認。推す案は段階0 → 1 → 2）への回答として扱う。#2〜#11（文案・フォント・外部変換サービス・索引・404・FAQPage など）は未決なので、それに関わる改善案は、オーナーの承認を取ってから main に入れる。

# 完了条件
- 段階0（I-01・I-02・I-08）が、改善案ごとに別のプルリクエストになり、`npm test` と関係する監査が通っている
- 段階1a（I-21・I-23・I-07・I-13）以降も、同じ進め方で1つずつ出す（9.4 節）。main への合流は Codex のレビューの後。「要」の改善案はオーナーの承認の後
- 各プルリクエストに Linear の課題があり、結果がコメントに残っている

# できていること
- 設計書の再設計は済み（commit 0c9200e52d・81eeb6a1ec。読みやすい版: https://claude.ai/artifact/E8kRtmcAeNE7VKxznopMDt）。判断の記録 0017（実装の進め方）は追加済み（1175f4ec1f）
- 作業は main から切った別ブランチ＋別 worktree で行う（設計のブランチ wakuwaku-labs/mooneye には混ぜない）。worktree は作業用の一時領域の `wt/i01`・`wt/i08`・`wt/i02`（node_modules は設計のブランチの worktree へのシンボリックリンクなので `git add -A` は使わない）。消えたら `git worktree prune` し、ブランチ名から作り直す
- **四つのプルリクエスト（#470・#471・#472・#473）はすべて OPEN・競合なし（#473 は 2026-10-11 夜に出した）。Codex のレビュー待ち**（依頼先・方法はオーナーに確かめる）
- **I-01（ISSUE-188・P-223）: PR #470**（claude/uiux-i01-stub-links）。`npm test` 495件通過・誘導ページへのリンク0件。バックログの ISSUE-188 は done。マージされたら P-223 を Done にする
- **I-08（計測をそろえる）: PR #471**（claude/uiux-i08-measurement）。Linear P-239（P-235 の子）。GA4 のカスタムディメンション登録（オーナーの操作）は P-240。ハブ約685本は PR に入れない（build.yml が毎日作り直す）。マージ後にやること: `data/measurement_changes.json` に I-08 を追記（PR 本文に下書き。日付はハブを build.yml が作り直して push した日）。計画 7.7 節に journal_store_click・ハブの cta_click・modal_open の store_id・GA4 未登録ディメンションの注を足す（設計のブランチで）
- **I-02（基線）: PR #472**（claude/uiux-i02-baseline・2コミット bab2ddb864・3b4cfa49d3・push 済み）。Linear: **P-241**（親・In Progress・P-235 の子）／**P-242**（子: ワークフローが main に入ってから GA4 を実測・Todo・期限 10-20）／**P-243**（子: 充電器をつないで速さを測り直す・`担当:オーナー作業`・期限 10-18）
  - 入れた物: `scripts/ga4_baseline.js`＋`scripts/lib/ga4_baseline.js`（GA4 の期間指定の取り直し。鍵が JSON でないとき中身を出さない）／`.github/workflows/ga4-baseline.yml`（手動・読み取りのみ）／`docs/qa/uiux-2026-10/perf.js`・`perf_summary.js`（電源・低電力モード・測った URL を1回ごとに残す。描画されなかった回は無効。店舗ページは `store`（同じ店）と `store-sample`（1周ごとに別の店）を測る）／`scripts/measure_typography.js` の `--block-analytics`／基線 `docs/qa/uiux-2026-10/baseline/`（`perf-2026-10-11-battery.json`・`-ac.json`（暫定・7回）・`-store-sample.json`・`typography-2026-10-11.json`・`-search.json`）／テスト `tests/ga4_baseline.test.js` 26件・`tests/perf_summary.test.js` 18件（計44件通過）／`CLAUDE.md` の共有ファイル表3行
  - **速さの測定で分かったこと（二つ）**:
    - ①**TBT は測定機の電源で割れる**。`pmset -g log` で 20:57:31 JST に `Using AC` → `Using Batt`、各行の測定時刻と一致。バッテリー駆動（10周の中央値）はトップ 861ms・特集 1,004ms・ハブ 2,137ms・特集一覧 1,406ms・ジャーナル一覧 3,509ms、充電器（暫定7回）は 53・13・159・6・1,169ms。LCP・通信量・DOM は 0.1s 前後の差。この Mac は低電力モードが「バッテリー駆動のときだけ」入る設定（`pmset -g custom`: Battery `lowpowermode 1`・AC `0`）なので、電源と低電力モードは区別できない。**因果は未確認（時刻の一致と設定のみ）**。設計のときの測定（15:38〜15:41 JST）はバッテリー駆動だったことを確認済み。ハブの CLS（0.013 / 0.652）は電源だけでは決まらない
    - ②**店舗ページの LCP は、同じ店を測り続けると速く出る**。同じ店 10周で中央値 1.8s（設計の 6.1s は再現せず）、店を替えて10店で中央値 7.0s（2.1〜7.5s・9店が目標 2.5s 超・LCP の要素は10店とも `IMG.hero-img`）。写真を直接取ると、変換サービス wsrv.nl 経由は初回 2.9〜4.4s・2回目以降 0.07〜0.4s、HotPepper の配信元を直接は初回 0.2〜0.9s で初回の遅さなし【確認済み・3店／4枚】。設計の 6.1s はキャッシュが無い店の値だった【推測】。実際の訪問の大半が初めて見られる店かは未確認【推測】（GA4 の店舗ページ別の表示数で確かめる）
  - 再現した事実: トップの LCP 約10s・通信 6.2MB・DOM 12,785・フォント 1.3MB/68ファイル、ジャーナルの CLS 0.129（10/10 が目標超）。文字: 12px 以下の割合は既定の表示で 4/3/2 %（375/768/1280）、タップ対象 44px 未満は 4,823/4,856/4,496（うち `#store-index` が 4,775/4,821）
  - **設計のブランチ（このブランチ）で直した物**: 判断の記録 `docs/decisions/0018-speed-comparison-same-day-same-power.md`（同じ日・同じ電源で比べる・基線は電源ごと・標準は充電器・低電力モードを記録）と `0019-store-page-speed-measured-across-stores.md`（店舗ページの LCP の基線は店を替えた値・標本は毎回選び直す）／`docs/uiux-overhaul-plan-2026-10.md`（2.2・3.6 の表を8行に・U-52〜U-54・新 U-84「初めて見られる店の店舗ページの LCP」・I-09 の期待効果・I-12・10.2 #8・8.6 の行1〜2・問題の件数 84）／`docs/qa/uiux-2026-10/perf.js`・`perf_summary.js` を I-02 の最終版に同期
  - 記憶: `perf-measurement-power-low-power-mode.md` は作成済み（MEMORY.md に追記済み）。`uiux-overhaul-plan-2026-10.md` は I-02 の結果を反映して更新する
- **I-21（URL と「戻る」・段階1a の1つ目）: プルリクエスト #473 を出した・Codex のレビュー待ち**（ブランチ claude/uiux-i21-url-back・コミット 1782d32a2a・origin/main 8041f61369 から・worktree は一時領域の `wt/i21`）。Linear: **P-244**（親・In Progress・P-235 の子・期限 10-18）／**P-245**（検索の実行で履歴を足す・条件の復元（popstate）・Todo・期限 10-25）／**P-246**（ID の無い編集部の店に共有リンクを作る・店舗ページ M0000xx の口コミ導線・Todo・期限 10-25）。P-244 と P-245/P-246 は related。承認の要否は計画の表で「不要」
  - 範囲: ①`#store=` が全店で開く（原因: 最初の50店の読み込みで `applyFilters→pushHash` が URL の `store=` を消し、全店読み込み後の `readHash` では store が無かった）②モーダルを開くと履歴を1つ足し（`{nbM:1}`・URL に `store=ID`）、×・背景・Esc・下スワイプ・「戻る」のどれでも1回で閉じる③壊れたハッシュ（`%` の不正・`"` で `querySelector` が SyntaxError）で初期化が止まらない。保存の画面（`#view=saved`）は I-23、検索で履歴を足す・条件の復元は別の改善案（popstate で条件を戻す作りが要るため）
  - 作り: index.html の `// NB-HISTORY:START 〜 END` の区画＋ `openM`・`closeM(opts)`・似たお店の onclick（`closeM({swap:true})`）。**ブラウザの確認で見つけた既存の不具合を同じ PR で直した**: 閲覧履歴の記録のために `openM` を包む処理（index.html の `Patch openM to record history`）が **2つ目の引数 source を捨てていた**ため、main では **modal_open の source が全部 `unknown`**（grid・trend_today・ranking・history・modal_reco・deeplink の区別が一度も付いていなかった）。直し方は `openM = function(i, source){ _origOpenM(i, source); … }`。これで source が本物の値になる＝**計測が変わる**（マージ後に `data/measurement_changes.json` へ）。共有リンク（deeplink）で履歴を足してしまう不具合も、この source が届かなかったことが原因だった
  - 確認の結果: 単体 `tests/index_history.test.js` 41件・変異 14件すべて検出／実ブラウザ `docs/qa/uiux-2026-10/e2e_history.js` は **改修後 148/148（390px・1280px とも 74件ずつ）、main の index.html では 81/148**（S1 共有リンク 29/40→40/40・S2 一覧から開く 8/18→18/18・S3 閉じ方 12/22→22/22・S4 似たお店 6/14→14/14・S5 絞り込み・検索 6/10→10/10・S6 壊れたハッシュ 8/24→24/24・S7 ID の無い店 10/14→14/14・S8 スクロール位置 2/6→6/6）／`npm test` 534/535（残り1件は main でも失敗する `stub_links.test.js`＝PR #470）／`audit_design_system.js --check`・`audit_inline_js_syntax.js --check` は exit 0／GA4: history の変更では page_view は出ない（ローカル・送信は通信の層で遮断して記録。**本番は未確認**）。ID の無い店（約150店＝3%・今日の話題店5件すべて）は履歴は足すが URL に store= を載せられず、「進む」では開き直さない（制約）
  - E2E の道具の注意: 新しい headless Chrome は、この Mac で夜（画面の状態によると思われる）に **タッチ操作（`Input.dispatchTouchEvent`）が応答しなくなった**（単純なページでも発生。chrome-headless-shell なら即応答）→ E2E は `chrome-headless-shell` があればそれを既定で使う（`--headless auto|shell|new`）。1280px で一度だけ「戻る」後のスクロールが 0 になった実行があったが、70回超の再実行で再現せず＝原因未特定の一過性（診断情報を詳しくした）。E2E はスプラッシュ・ホーム画面追加の案内を出ない状態にして回す（I-13 の範囲）
  - 残り: ①Codex のレビュー結果を見て直す（依頼先・方法はオーナーに確かめる）②マージ後: `data/measurement_changes.json` に I-21（modal_open の source が本物になる＋deeplink の modal_open が全店で出る＝計測の段差）を追記し、GA4 で modal_open の source の内訳と page_view を確かめる（P-244 の達成条件 4・5）③P-244 を Done に
  - **気づき（I-21 とは別）**: Linear に **P-225**（緊急・Todo・期限 2026-10-12・「トップの URL から入る検索語をエスケープし、細工した URL でスクリプトが動かないようにする」）がある。`readHash`／検索語の経路が I-21 と近い（I-21 は `readHash` の復元を書き換えたので、どちらが先に入っても競合の解消が要る）。公開リポジトリなので詳細は PR に書かない。着手はオーナーの指示で
- 検証済みの事実: `gen_area_genre_pages.js --check` はテストでは回らない（CI の生成だけ）。`tests/area_genre_pages.test.js` は stores/area の存在を見る

# 次にやること
1. P-241 に、店を替えて測った結果（`store-sample`・判断の記録 0019）のコメントを足す（前のコメントは PR #472 の1回目の push の時点で、この発見の前）
2. Codex のレビュー（#470・#471・#472・#473）を待つ。レビューの依頼先・方法はオーナーに確かめる。マージされたら: P-223 を Done／I-08 の `data/measurement_changes.json`／#472 は P-242（GA4 の実測。ワークフローを dispatch できるようになってから・内部トラフィックの除外の状態をオーナーに確かめる）／店舗ページの 28日窓は 2026-11-06 以降
3. オーナーの操作（報告し続ける）: P-240（GA4 のカスタムディメンション登録）・P-243（充電器をつないで測り直す。バッテリー駆動のまま低電力モードを切って測るのは、システム設定の変更なのでオーナーの判断）・P-237（#2〜#11 の決定）
4. 段階1a（1つ1PR・1つ1Linear・画面は 390px と 1280px で見る・Codex のレビューの後に main）: I-21（URL と戻る・PR #473 済み）→ **次は I-23**（保存した店が見えない。`showFavs` index.html:11578〜11593）→ I-07（英語の表示を日本語に）→ I-13（スプラッシュ・アプリ追加の案内）。トップだけ
5. Linear: 次の改善案に着手するときに、P-235 の子として起票（7項目: 動詞のタイトル・担当と期限・状態・Project=Nagoya Bites・背景・達成条件・30分超は sub-issue。ラベルは KR:検索から見つけてもらう＋担当:Builder）
6. Codex の 4ab7ea556a（Linear 導入ファイル4つ: `.claude/settings.json`・`.linear.json`・`scripts/linear/briefing.js`・`scripts/linear/watchdog.js`）の扱いは、オーナーの判断待ち（P-235 に記録済み）

# 試したが駄目だったこと
- `.linear.json` が未設定だったため初期導入を行った（Codex）。初回生成は slug `nagoya-bites` の新規 Project を作った。既存の正しい Project 名が `Nagoya Bites` と確認できたため、`.linear.json` は既存 Project を指す名称に直した。空の重複 Project は削除していない
- puppeteer の画面の書き出しは、この環境では白紙のページでも時間切れになる。DOM の確認で代えた（実際の画面は Chrome 拡張のツールで見られるかもしれない）
- 電話の紐付けを店名だけで確かめると、同じ住所の同じ店でも表記の違いで1,578店が落ちた。住所を先に比べる規則に変えた
- 速さの測定: Mac の画面が消えると描画されない回（FCP・LCP・CLS=0）が出る＝測る間は `(caffeinate -u -d -i -t 秒 &)`。Node の計算時間（hostBench≒245ms）は電源の違いを説明できず廃止。Chrome の描画側ベンチ `rendererBenchMs`（≒145ms）もバッテリー駆動の間はほぼ一定で区別の役に立たない。店舗ページを同じ店で10周する測り方は、wsrv.nl のキャッシュで実態より速く出る（判断の記録 0019）
- `( コマンド ) &` を run_in_background の中に書くと、すぐ「完了」と返る＝出力ファイルの `exit=` の行を待つ

# 守るルール・判断メモ
- 改善案ごとに別のプルリクエスト。1つずつ出し、効果と副作用を見てから次へ（9.1 節）。main へは Codex のレビューの後。4.4 節の「要」の改善案はオーナーの承認の後。自分では main に入れない・デプロイしない
- 速さ・TBT・CLS の前後は、同じ日・同じ電源（標準は充電器）で比べる。店舗ページの LCP は `store-sample`（店を替えて測る）で比べ、標本は毎回選び直す（判断の記録 0018・0019）
- 電話番号はデータに持たない。電話を出す店の規則・番号を取れなかったときの表示は 7.3 節と I-36
- リポジトリは公開なので、鍵の値やセキュリティの詳細（GA4 のプロパティ ID など）を公開のファイルに書かない
- 店の選び方は、人間が全店を選んだように書かない（オーナーの指示）
- クリック数や滞在時間を増やすための不要な操作、回遊だけのための無関係な推薦は入れない。画面遷移を減らすことだけを目的にしない（オーナーの指示）
- コミットの末尾: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`。force push・reset はしない
- 共有の stash（`git stash list`）には触らない

# 関連ファイル
- `docs/uiux-overhaul-plan-2026-10.md`（3.6 速さの基線・4.2 一覧・4.3 改善案・4.4 決めてもらうこと・7.7 計測・第9章 順序・10.2 比較の規則・10.4 タスク）
- `docs/decisions/0017`（実装の進め方）・`0018`（速さの比較は同じ日・同じ電源）・`0019`（店舗ページの速さは店を替えて測る）
- `docs/qa/uiux-2026-10/perf.js`・`perf_summary.js`（本番の速さ。基線は I-02 のブランチの `docs/qa/uiux-2026-10/baseline/`）
- `scripts/gen_area_genre_pages.js`・`scripts/refresh_feature_rosters.js`・`scripts/add_feature_tracking.js`・`scripts/lib/feature_tracking.js`・`scripts/add_journal_engagement_tracking.js`・`journal/_template.html`・`index.html`
- `data/measurement_changes.json`・`scripts/lib/reservation_exits.js`・`docs/reservation-measurement.md`
- Linear P-235（親）・P-236（Codexレビュー・Done）・P-237（オーナーの決定）・P-223（ISSUE-188）・P-239/P-240（I-08・GA4 登録）・P-241/P-242/P-243（I-02・GA4 実測・充電器で測り直し）
