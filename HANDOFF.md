status: in_progress

# note への自動投稿を始める（2026-10-21〜）

## 目的
- 日次ジャーナルを note にも自動で出し、note 経由の流入を作る（オーナー 2026-10-21）

## 完了条件
- 毎朝、記事公開後に note へ下書き（のちに公開）が自動で入り、元記事へ UTM つきで戻れる
- 検査（言い方・数字・UTM）に落ちた日は送らず、理由が残る

## できていること
- 第1段（外部送信なし）: `data/note_post_policy.json`（mode=dry-run）・`scripts/lib/note_draft.js`・`scripts/build_note_draft.js`・`tests/note_draft.test.js`（2件通過）・ADR 0054・registry 行。2026-10-21 の記事で下書き生成・検査通過を確認
- 本文は抜粋（導入＋最初の節＋ポイント）＋元記事リンク。全文の二重掲載を避ける既定

## 次にやること
1. 【本人】note の利用規約の確認と、投稿用アカウントのログイン（公式の投稿 API は見当たらない）
2. 送信部: puppeteer（導入済み）で note エディタに「下書き保存」まで自動化（mode=draft）。ログイン状態は Mac のプロファイルに保存
3. 毎朝の流れへ接続（run_journal_local.sh の公開後）＋見張り役（X 版 x-post-watchdog 相当）
4. 数日 draft で運用し、問題なければ live を本人に確認

## 試したが駄目だったこと
- なし（WebSearch で規約本文は未確認）
- 2026-10-21 Chrome で note.com/notes/new を開いたが未ログイン（ログイン画面）。ログインは本人作業
- 2026-10-21 送信部は書き終えたが未検証。ログイン後に窓を閉じると未ログインに戻る（セッション Cookie とみられる）→ note_login.js が Cookie を ~/.config/nagoya-bites/note-cookies.json に保存し開くたびに復元する形に修正。再ログイン待ち。通ったら `node scripts/post_note.js --date 2026-10-21 --mode draft` で下書き1本を試す

## 守るルール・判断メモ
- Google ログインは自動操作の窓で拒否される（accounts.google.com/v3/signin/rejected・2026-10-21 実測）。メール/パスワードでのログインを既定にした（autopilot の自動回答＝推奨案。本人の明示回答ではない。X/Apple や普段の Chrome を使う方式は未採用）
- 方針転換: 自動操作の窓では Google ログイン不可・パスワード有無は未確認（「できない」の理由への自動回答は本人の回答ではない）。普段の Chrome（Claude in Chrome）で本人が Google ログインし、拡張経由で下書きを作る案に切替中。毎朝の無人運転には不向き（Chrome 起動が前提）→ 後で再設計
- 2026-10-21 夜: Claude in Chrome（別プロファイル）で本人が Google ログイン済みになった。未ログイン時の保存は `draft_save` が 201 で本文に error `not_login`（HTTP が成功でも本文で失敗する・UI は「下書きの保存に失敗しました」）。ログイン後に新規作成 editor.note.com/new を開くと真っ白のまま読み込みが終わらない（3回再現・原因未特定）。エディタへの流し込み（title は textarea に native setter＋input、本文は ProseMirror へ text/html の paste イベント）は動作確認済み。保存は JS の click でなく実クリックが必要かは未確認
- 無人運転は Chrome 起動が前提の拡張方式に不向き。候補: ログイン済み Cookie を専用プロファイルへ複製（認証情報に触れるので実行前に本人の了承）
- 2026-10-22 00:59 下書き保存に成功（下書き ID n05b5a2fb7763・NAGOYA BITES アカウント・Claude in Chrome 経由・公開はしていない）。白い作成画面の原因は、メール認証が未完了の別アカウント（vide太郎・iCloud メール）でログインしていたため。NAGOYA BITES で入り直すと /notes/new が editor.note.com/notes/<id>/edit/ に飛び、流し込み→実クリックの「下書き保存」→ draft_save の本文 result:true で保存できた（HTTP は常に 201 なので本文の result を見る）
- 次: 毎朝の無人運転の方式（puppeteer の専用プロファイルへ Google ログインは拒否される。ログイン済み Cookie の複製は本人の了承が要る）。scripts/post_note.js の画面操作は Claude in Chrome で確かめた部品（textarea・ProseMirror・「下書き保存」「公開に進む」）に合わせて再点検する
- 公開・送信は本人の OK が出るまで mode を上げない。文面に「業界人が選んだ」等を書かない（検査済み）

## 関連ファイル
- data/note_post_policy.json・scripts/lib/note_draft.js・scripts/build_note_draft.js・docs/decisions/0054-note-draft-excerpt.md・docs/daily-posts/README.md

---
# 前の作業（GA4 閲覧数の調査・未完。次の手順は下に残す）

# 閲覧数の下がりの調査と、日次レポートの対象日の是正（2026-10-21〜）

（前のメモ「UI・UX のアニメーション導入計画」は status: done。中身は git 履歴の直前の HANDOFF.md と docs/animation-plan-2026-10.md）

## 目的
- 「ここ二日間の閲覧数が下がった」原因を調べる。あわせて SEO を分析し、改善できる所を直す（オーナー 2026-10-21）

## 完了条件
- 原因が、確定した GA4 の数字で説明できている
- 日次レポートが確定した日（D-2）の数字を出し、GAS に反映されている
- 10/20 の確定値で、二日間の見直しが終わっている

## できていること
- 原因: 主因は、毎朝のメールの「昨日」が集計途中で少なく出ること（10/19 はメール 52PV・確定 112PV）。確定値は 10/12 128・10/13 169・10/14 153・10/15 171・10/16 112・10/17 121・10/18 91・10/19 112。10/13〜15 の山は Google・Bing・Yahoo の検索流入で、そこからの戻りが実際の部分
- 検索（GSC 28 日）は表示回数約 4 万・クリック 733→779 で横ばい〜微増。サイト・robots・sitemap・計測タグは正常
- 是正: #647（ADR 0053）で対象日を確定日に統一。`npm test` 1864 件通過。GAS への反映はオーナーが clasp push 済み。`clasp pull` で GAS のコードが origin/main と一致することを確認（2026-10-21）
- 日別の確定値は `ga4-baseline.yml`（workflow_dispatch・読み取りのみ）を 1 日ずつ回して取った

## 次にやること
1. 10/22 以降に 10/20 の確定値を取り、二日間の見直しを完了する（`gh workflow run ga4-baseline.yml -f mode=window -f start=2026-10-20 -f end=2026-10-20 -f internal_filter=active`）
2. 反映後の最初のメール（件名の日付が 2 日前になる）が届いたか確かめる
3. メールと確定値の差が日によって違う理由（10/16〜18 は 84〜94%・10/19 は約 46%）は未特定。新しい形ではこの差は出ない
4. 11/6 のジャーナル題の比較の後、手羽先・一人飲みの特集の題（P-334）を見直す

## 試したが駄目だったこと
- 手元の認証（gcloud ADC）では GSC の日別は読めない（スコープ不足）。GSC は `data/gsc_metrics.json` の git 履歴の 28 日ローリングで見た
- 特集の題の書き換え（手羽先・一人飲み）は ADR 0033 の持ち越しと衝突するので入れなかった

## 守るルール・判断メモ
- 閲覧数の増減は、メールでなく確定値（今日の 2 日前まで）で見る
- 店名での検索（他店の名前を探す人）は追わない（Strategic Skip）
- 範囲外で残した既存の失敗: `audit_image_sources`（wsrv.nl 経由の画像 4,850 ページ）、`audit_feature_stores`（喰海 2 店の名前照合・店舗ページは存在）

## 関連ファイル
- .gas-deploy/Code.js（sendDailyReport）・docs/decisions/0053-daily-report-settled-day.md・docs/decisions/0033-feature-wording-title-family-deferred.md・data/gsc_metrics.json・.github/workflows/ga4-baseline.yml

## 2026-10-19 話題店の情報不足（ブランチ wakuwaku-labs/coho・未push）
- 住所補完: scripts/lib/store_detail_backfill.js（build.js）。ホットペッパー照合: scripts/enrich_hotpepper_details.js → data/hotpepper_trending_details.json（IDは入れずURL不変）。食べログは403のため保留（ADR 0013）。
- 次: 合流・初回ビルド後に見つかった店数と、話題店ページの表示を確認。

- 2026-10-19 夜: Linear 課題消化。P-567/471/446/184/472/473/445/177 を Done（#633〜#639）。P-177 は place-status.yml を本番で1回実行済み（100件・閉業1件=日々担々 守山店は『決められない』で記録）。P-169 はオーナーが推奨（ブランド共通は残す）で進めると回答、350件の判定が未着手＝次回子課題に分けて着手
- 2026-10-19 深夜: P-169 を実装（#641）。アカウント名が別支店の地名を含み掲載店に無い48件のみ外す（data/ig_account_reviewed.json・scripts/clear_wrong_ig_accounts.js・夜間QA ig-account-review）。残り約265件は掲載続行。P-601（日々担々 守山店の再確認・11-18）を起票
