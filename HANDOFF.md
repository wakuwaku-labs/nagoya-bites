status: in_progress

# 目的
Linear P-236（DSN-014）の Codex レビューの結果をもとに、UI・UX全面改修計画（`docs/uiux-overhaul-plan-2026-10.md`）を設計し直す。設計書だけを直す。サイトのコードは変えない（実装は承認後）。

# 完了条件
- 設計書の電話の扱いを事実（番号はデータに持たず、押したときに Google から取る）に合わせ、全箇所で直す
- 第10章のすべての指標に、再現できる測り方（期間・区切り・自分の閲覧の扱い・イベント名）を書く
- 10.6 節に Claude の応答（指摘ごとの処置と理由）を残す
- `node docs/qa/uiux-2026-10/counts.js` と構造の検査が通る。アーティファクトを同じパスで作り直す。コミットし、Linear にコメントする

# できていること（2026-10-11 に調べた事実）
- 電話の仕組み: 番号はデータに持たない（Google の規約で保存できない）。押したときだけ Places Details（`international_phone_number`）を取り、`tel:` を開く。取った番号はページを閉じると消える一時記憶（`NB_PHONE_MEM`）にだけ置く。場所は `index.html:10129-10210` と `gen-store-pages.js:1041-1052`
- 電話のボタンが出る条件:
  - モーダル: placeId のある店すべて（4,677/5,004店。うち予約リンクもある店は4,614）。`nbCallBtnHtml`（`index.html:10138`）。HotPepper がある店では、下の固定の帯にもアイコンで出る（:10476-10480）。導入は #224（2026-09-07）
  - 店舗ページ: 予約リンク（HotPepper・食べログ）が無く placeId がある店だけ（63店）。`gen-store-pages.js:798`。導入は SEO-105（#289・2026-09-22）
  - 予約リンクも placeId も無い店は14店で、地図だけになる。地図のリンクは店名とエリアから常に作れる
- 上限: 端末ごとに1日20回（localStorage）。GCP のプロジェクト全体の1日の上限は、写真の取得などと共有する。上限の値はコードの注記が300件、メモリ（places-api-quota-and-budget）が250件で食い違うため要確認。枠が戻るのは JST 16:00
- 新しく見つけた問題（U-83 として書く）: Places が上限切れや拒否で答えなくても「電話番号なし」と出す（OK 以外の状態をすべて同じ表示にしている）。写真で決めている「取りに行けなかった」と「候補なし」を分ける原則と同じ考え方で直す
- 計測: `cta_call_click` は番号を取りに行く前に送るので、押した回数を数えており、発信できた回数ではない。`EXIT_EVENTS` に入っている（`scripts/lib/reservation_exits.js:20`）。10.2 節の予約送客の行は `cta_call_click` を書き漏らしている
- 使われ方（`data/store_referrals.json`）: 直近30日（〜10-10）の予約送客55回のうち、電話は2回（HotPepper 50・食べログ3）。10月1〜10日の電話は0回
- 自分の閲覧: `?nb_owner=1` の端末は独自のイベント（`cta_click` など）を送らないが、セッションは `traffic_type=internal` を付けて送る。GA4 のデータフィルタが「有効」でないと除外されないため、率の分母に混ざる（`docs/ga4-internal-traffic-verification.md`）

# 次にやること
- 済み（2026-10-11）: 設計書の電話の箇所・U-32・U-83・I-36・5.6 節（データが欠けた店での出し方）・7.3 節の表・10.2 節「数字の取り方」・10.4 節（始める所・T6）・10.6 節の Claude の応答。`counts.js` に「設計が使うデータ」を追加
- 電話を出す規則: 住所を先に比べ（`compareJpAddress`）、住所が無い店だけ店名（`namesMatch`）。出せる店は4,274（予約先あり4,215・なし59）、出せない店は730
- 残り:
  1. ISSUE-147 に「予約先の無い4店（鮨 結・かき氷 うと・中国料理 旬彩・旬彩）の電話のボタンが別の店の番号を取る」を追記し、Linear P-142 にコメントする
  2. 構造の検査（I-ブロックの4項目・U-01〜U-83・言い方・鍵の値が無いこと）と counts.js の再実行
  3. アーティファクトを同じパスで作り直す → コミット → Linear P-236 にコメント → 最終チェック

# 試したが駄目だったこと
- `.linear.json` が未設定だったため初期導入を行った（Codex）。初回生成は slug `nagoya-bites` の新規 Project を作った。既存の正しい Project 名が `Nagoya Bites` と確認できたため、`.linear.json` は既存 Project を指す名称に直した。空の重複 Project は削除していない
- puppeteer の画面の書き出しは、この環境では白紙のページでも時間切れになる。DOM の確認で代えた

# 守るルール・判断メモ
- 設計書のみ。サイトのコードの編集・デプロイはしない
- リポジトリは公開なので、鍵の値やセキュリティの詳細を公開のファイルに書かない
- 電話を行動バーに残す理由（既定の判断）:
  - 今のモーダルが帯に出している
  - 食べログや HotPepper のスマホ版も、固定の帯に電話と予約を並べている【一般知識・未確認】
  - 今の利用は少ない（30日で2回）ので、上限への影響は小さい
  - 予約リンクのある店で電話を基本情報へ下げる案は、電話で予約したい人の操作を増やすので採らなかった
- Codex が 4ab7ea556a に入れた範囲外のファイル（`.claude/settings.json`・`.linear.json`・`scripts/linear/briefing.js`・`scripts/linear/watchdog.js`）はオーナーに報告する。勝手には戻さない。理由: 作業ブランチの worktree では入れない決まりがあり、既存の `scripts/session_briefing.js` と `linear-watchdog.yml` とも重なる
- force push・reset はしない

# 関連ファイル
- `docs/uiux-overhaul-plan-2026-10.md`（第10章は 1528 行から）
- `docs/qa/uiux-2026-10/counts.js`
- `index.html:10129-10210`・`gen-store-pages.js:798,961,1041-1052`（読むだけ）
- `scripts/lib/reservation_exits.js`・`data/store_referrals.json`
- `docs/ga4-internal-traffic-verification.md`
- Linear P-235（DSN-013）・P-236（DSN-014）・P-237（DSN-015）
