status: in_progress

# note のログインを普段の Chrome から切り離し、切れていたら自分で入り直す（2026-10-24〜）

## 目的
本人が普段の Chrome で note を別アカウント（vide太郎）に切り替えたりログアウトしたりしても、毎朝の note 投稿が止まらないようにする。

## 完了条件
- 専用プロファイルのログインが普段の Chrome と別のもの（_note_session_v5 の作成時刻が違う）
- 未ログイン・別アカウントのとき、投稿の前に自分で NAGOYA BITES に入り直す。入れなければ投稿せずに理由つきで止まる
- テストが通り、main に入っている

## できていること
- 原因: 専用プロファイルのログインは Default の複製（作成時刻 05:30:46 が一致）。写しで実験し、note のログアウトは「そのログインと複製」だけを切ることを確認（copy3 は 401・Google から別に入った copy2 は残った）
- 専用プロファイルは Chrome 自体が Google にログイン済み（Google の Cookie を消しても入れた）→ note の「Google」を押すだけで NAGOYA BITES に入れる
- 実装: scripts/lib/note_browser.js に currentUser / loginWithGoogle / ensureAccount。post_note.js は投稿前に ensureAccount。note_login.js に --google、--check はアカウント名も見る。ADR 0057
- 写しで確認: 未ログイン→入り直し成功／vide太郎→入り直し成功（本人の Profile 1 の vide太郎 は切れていない）／Google を止めると投稿せず理由つきで止まる
- 本番の専用プロファイルを --google で入り直し（作成 15:40:20・Default は 05:30:46 のまま）。--check と投稿前の確認を本番で1回ずつ実行して NAGOYA BITES
- npm test 1888/1888

## 次にやること
- PR を作ってマージ（ビルドが止まっていないか確認してから）
- P-638（note 投稿の失敗を GitHub Issue で知らせる見張り役・~/nagoya-bites の feat/note-post-watchdog に未 push の d28ac56d08）を main に合わせて入れる。#676〜#686 と post_note.js・run_journal_local.sh が重なるので取り込み直しが要る

## 試したが駄目だったこと
- clickByText(['Google']) では押せない（ボタンは絵だけで、文字は別の要素）。aria-label・href まで見て探す

## 守るルール・判断メモ
- note の Cookie は手元で消すだけ。note のログアウトは押さない（本人の Chrome のログインを切らない）
- 自動 commit（Autopilot）が前の作業の文面でコミットした（ae984a6eb1）。PR はスカッシュで入れるので main には残らない

## 関連ファイル
scripts/lib/note_browser.js / scripts/post_note.js / scripts/note_login.js / docs/decisions/0057-note-login-own-google-session.md / docs/decisions/0054-note-draft-excerpt.md

# 前の作業（note の見出し画像を店の実物写真にする・done）

# note の見出し画像を店の実物写真にする（2026-10-24〜）

## 目的
- オーナー指摘（2026-10-24）「今日のハウス・オブ・モンの投稿は、画像が昨日と同じで全く関係のない画像。店の実際の画像を使うようにしてほしい」

## 完了条件
- note の見出し画像が、規約で使える店の実物写真（記事に載せたプレスリリースの写真）になり、無い日は店と関係の無い写真を出さない
- 今日（10-24）の note 記事 n11f684d2cdfc の見出し画像がハウス・オブ・モンの実物写真に替わっている（API の eyecatch で確認）
- テストが通り、main に入り、ビルドが成功している

## できていること
- 原因: #676 の見出し画像は assets/note-eyecatch/izakaya.jpg（焼き鳥とビール・※写真はイメージです）の1枚だけを毎日使っていた。10-23・10-24 の note はどちらもこの写真（scratchpad/eyecatch/a.png・b.png で確認）
- 規約（調査役が一次情報で確認）: PR TIMES 企業規約 第6条3項＝報道目的の利用を許諾（加工・複製の定めなし）／ホットペッパー Webサービス規約＝加工・再配信・複製保存を禁止／Google Places＝保存を禁止／note 規約は 403 で読めず
- 直近45本で、プレスリリースの写真が記事にあった日は13日
- 実装（ブランチ wakuwaku-labs/note-eyecatch-real-photo）: note_draft.js の articlePhoto（記事のヒーロー → 本文の順に press の写真・配信元とクレジットの URL が必須）、本文にクレジットの行、note_eyecatch.js の downloadPhoto（PR TIMES の配信元の縮小版・画像でなければ止める・一時ファイル）、写真が無い日は題だけの図、izakaya.jpg を削除、post_note.js で付いている画像を外して入れ替える（--update で写真に替えられなければ更新しない）。ADR 0056・CLAUDE.md の優先3 に1行・registry・backlog SNS-008

- npm test 1887/1887。10-24 の note 記事 n11f684d2cdfc を `--update` で差し替え、API の eyecatch がハウス・オブ・モンの実物写真（屋上の夕景とカクテル）に替わり、クレジットの行・元記事のカード・タグ5個・UTM が残ることを確認
- PR #685 をマージ（20a28b19fe）。SNS-008 は Linear P-669（担当・期限 11-07・Todo・ラベルあり）
- ~/nagoya-bites の main は前の作業の取り込み記録（c10aaeafb9・autopilot の合流とみられる）で origin より2つ先だが、中身は同じ。明朝の pull --rebase を別の作業場所で試し、origin/main（#685 込み）と同じになることを確認（reset はしない）
- 追い直し（#686）: 新しく投稿する朝は本文を書く前に見出し画像の素材を用意し、記事の写真を取れなかった日は本文からクレジットの行を外す（無い写真のクレジットを載せない）。素材づくりの失敗では投稿を止めない
- 居酒屋写真が残るのは 10-23 の記事 n1a04370ade88 だけ（10-22 は見出し画像なし）。題だけの図の見本: scratchpad/eyecatch/card_1023.png

## 次にやること
1. 10-25 朝の note を確認（記事に press の写真があれば実物写真、無ければ題だけの図。~/nagoya-bites/data/note_post_log.json と API の eyecatch）
2. 本人が了承したら 10-23 の記事を `node scripts/post_note.js --date 2026-10-23 --update n1a04370ade88` で題だけの図に替える
3. 11-07 に P-664（効果比較）・P-669（実物写真を使えた日の割合）

## 試したが駄目だったこと
- なし

## 守るルール・判断メモ
- 見出し画像の写真は加工しない（題を重ねない）。PR TIMES の規約は加工を禁じていないが、CLAUDE.md の条件 d に合わせた（ADR 0056）
- 写真が無い日は題だけの図（生成画像・共通の写真は使わない＝店の実物ではない）
- 昨日（10-23）の note 記事も居酒屋写真のまま。ホットペッパーの写真なので実物には替えられない。題だけの図に替えるかは本人に確認する（公開中の記事の変更・依頼の範囲外）

## 関連ファイル
- data/note_post_policy.json（eyecatchPhoto）・scripts/lib/note_draft.js・scripts/lib/note_eyecatch.js・scripts/post_note.js・tests/note_draft.test.js・tests/note_eyecatch.test.js・docs/decisions/0056-note-eyecatch-real-store-photo.md

---
# 前の作業（note と X を、媒体ごとの多く見られる出し方に合わせる・done）

# note と X を、媒体ごとの「多く見られる出し方」に合わせる（2026-10-24〜）

## 目的
- オーナー依頼（2026-10-24）「note や X の投稿は媒体ごとに多く見られる方法がある。しっかり調べた上で実践して」

## 完了条件
- 一次情報（公式・政府統計・公開アルゴリズム）で根拠を集め、出典つきで docs に残す
- 根拠のある変更を自動投稿の仕組みに入れ、テストが通り、main に入っている
- 本人の判断が要るもの（外部配信の許諾など）は選択肢で確認する

## できていること
- 調査の出典と始める前の数字: docs/sns-reach-research-2026-10.md／判断: docs/decisions/0055-sns-reach-practices.md
- 原因特定: 10/21・10/22 の X が定型に落ちたのは、記事の公開と X 用文面が別 push で届き、投稿が文面より先に動いたため
- 実装（PR #680 で main に入った）: X 平日12:00待ち（上限300分・手動 post_now）＋文面を最大15分待つ・ハッシュタグ1個／note タグ5個前後。X・note のテスト62件通過
- 2026-10-24 05:44 main のビルドが 10-23 01時から止まっていた（tests/stub_links.test.js・とんかつ特集の とんかつ朱寿 が転送ページを指す）→ #679 で直してマージ・ビルド成功
- Linear P-664（SNS-006・2026-11-07 に効果を比べる）を作成。同期は --skip で他の課題に触れずに作成だけ
- note 専用の窓のログインを NAGOYA BITES に戻した（10-24 朝・普段の Chrome Default から複製）
- PR #680 をマージ（1eda6c14b6）。マージ後のビルド 40025472962 成功
- 06:02 Mac の node が起動しなくなった（05:57 に別セッションとみられる brew install node@22 で simdjson だけ 5.0.5 に上がった）→ 本人の了承で brew upgrade node（v26.12.1・libsimdjson.34）。応急処置の2ファイルは削除済み。npm test 1881 件・note のログイン確認とも node 26 で通過
- 本人の回答（06:08・選択式）: ①note と X のプロフィール文を提案文に直す ②5月の旧記事2本の題とタグを直す ③note の外部配信の許諾をオン ④brew upgrade node を実行
- ①note・X のプロフィール文を変更（X の元の文は scratchpad の note/x_bio_before.txt）。X は NAGOYA BITES で直して vide太郎 に戻した
- ②旧記事 ne0697f4a39e2（題「2026年初夏の名古屋ビアガーデンは柳橋市場直結」・本文7か所）・n79659b041af5（題「GW本番、予約なしで滑り込める名古屋の店 — 当日勝負のコツ」・本文6か所・タグ #業界人→#名古屋グルメ）。API で題・タグ・本文に 業界人/中の人/目利き/現役 が無いこと、段落数が変わらないことを確認
- ③外部配信の許諾は元からオンだった（変更なし）
- 未了: ne0697f4a39e2 の見出し画像に「業界人が選ぶ！」の文字が入っている。外す操作は承認範囲外として自動操作の判定に止められた → 本人に判断を依頼（SNS-007 / Linear P-668・期限 11-07・担当:オーナー作業）
- X の手動実行（10-23・投稿済みの日・run 40029383264）成功: 待つ段階は「投稿済みのため待ちません」、投稿の段階は「投稿済み」で X には送っていない
- 直近5記事の note タグを実データで確認（例: 名古屋グルメ 名古屋 栄 一人飲み グルメ）
- 10-24（土）の実投稿: X は「待たずに進みます（weekend）」→ 保存した文面で 09:12 に投稿（run 40043729993）。note は 09:11 に「タイトル、本文を入力してください」で公開に進めず下書きのまま残った
- note の原因: 見出し画像（#676）を入れた直後の画面は、題・本文が見えていても note 側では空のまま。updatePublished の sleep(3000) の注記と同じ症状。10-22・23 は見出し画像なしで公開できていた。保存済みの下書きは題・本文 902 字・見出し画像ありで完全だった
- 直し: post_note.js が下書き保存の後に下書きを開き直し、題・本文（100 字以上）を確かめてから公開する（openDraft）。進めないときは note の表示文を理由に出す。保存後に離れる確認ダイアログは受ける。13:58 に同じ下書きから公開し直して成功: https://note.com/nagoya_bites/n/n11f684d2cdfc （タグ5個・見出し画像・UTM）。台帳は ~/nagoya-bites にも書き戻した
- 失敗しても拾えるように: run_journal_local.sh が note の送信に失敗したら 60 秒後に1回だけやり直す。やり直しでは note の API で公開済みかを先に見て、公開済みなら台帳だけ直す（台帳を draft にした写しで実地確認・公開はしていない）

## 次にやること
1. 10-25 朝、新規投稿の経路で openDraft が初めて動く。~/nagoya-bites/data/note_post_log.json の 10-25 が live かを見る（落ちたら `node scripts/post_note.js --date 2026-10-25` を ~/nagoya-bites で実行すると同じ下書きから公開し直す）。note の見張り役（GitHub Issue 通知）は P-638 で未完
2. 10-26（月）が X の平日 12:00 待ちの初回。落ちれば x-post-watchdog が Issue で知らせる
3. 2026-11-07 に P-664（効果比較）。P-668（見出し画像の文字）は本人の判断待ち

## 試したが駄目だったこと
- help-note.com / terms.help-note.com は curl・調査役の取得で 403。Exa の取得で読めた

## 守るルール・判断メモ
- X の夜（21時台が最多）は、GitHub の1ジョブ6時間の上限と定時実行の約5時間の遅れで確実に狙えないため採らない。平日12:00・土日は待たない
- X の文面にリンクは残す（返信に移しても費用同じ・減点の根拠なし）。画像は付けない（付けると写真つきのリンクカードが消える・HotPepper 写真は規約で不可）
- note のタグは記事の題名か店のデータにある語だけ（関係の無いタグはスパム扱いの恐れ）
- 2026-10-24 07:0x 見出し画像（ne0697f4a39e2）の扱いを選択式で聞いたが、autopilot が推奨案「外す」を自動回答した。公開中の記事を変える操作で本人の明示の了承ではないため実行せず、P-668 で本人の判断を待つ

## 関連ファイル
- data/x_post_policy.json・scripts/lib/x_post.js・scripts/x_post_wait.js・.github/workflows/x-post.yml・data/note_post_policy.json・scripts/lib/note_draft.js

---
# 前の作業（note への自動投稿を始める・この作業の土台）

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
- 2026-10-22 方式A（本人了承）: `node scripts/note_login.js --from-chrome` で普段の Chrome の note.com の Cookie だけを専用プロファイルへ複製（暗号化のまま・値は読まない）。_note_session_v5 は永続（期限 2027-01）で、以前の「閉じると消える」推測は誤り（本当の原因は Google ログイン拒否）。puppeteer は --use-mock-keychain を外さないと復号できない
- 2026-10-22 `node scripts/post_note.js --date 2026-10-21 --mode draft` が通った（下書き nb20482482b6b・応答 result:true を確認・台帳 data/note_post_log.json）。画面なし（headless）は下書き作成 API が 403 で拒否されるため窓ありで動かす（30秒ほど窓が出る）。editor.note.com/new 直打ちは白いまま→note.com/notes/new から入る。note に同じ記事の下書きが3本（n05b5a2fb7763・nb20482482b6b・空の n62962c4b7829）→本人が1本残して削除
- 2026-10-22 run_journal_local.sh の最終 push 後に post_note.js を非ブロッキングで接続（policy mode=draft）。失敗は macOS 通知（GitHub Issue の見張り役は未実装）。台帳は .gitignore（作業ツリーを汚さないため）。窓が毎朝30秒ほど出る→本人の許容は未確認
- 次(旧): 毎朝の記事公開の流れへ接続（run_journal_local.sh の後ろ）＋見張り役。Cookie の更新（期限 2027-01 または note 側の失効）で未ログインになったら Issue で知らせる
- 公開・送信は本人の OK が出るまで mode を上げない。文面に「業界人が選んだ」等を書かない（検査済み）

- 2026-10-22 本人が「B」（試運転なしで翌朝から公開まで自動）を選択。policy mode=live（#658）。公開画面は実機で部品確認のみ（投稿は未実施）。公開失敗時は同じ下書きから再試行。未了: 初回の実機結果の確認・GitHub Issue の見張り・reCAPTCHA が出た場合は自動で突破せず止まる

- 2026-10-22 15:30 本人の「今投稿して」で初の公開に成功: https://note.com/notes/n8fc72c27db14 （published・タグ2件）。落ちた原因は誘導文の『残りN節』が記事に無い数字として検査に落ちたこと→数字を外した。Cookie が一度失効していたため --from-chrome で再複製。

- 2026-10-22 事故: 普段の Chrome が vide太郎(bide_taro) で入っており、Cookie 複製で別アカウントに公開された。#662 で投稿前にアカウント名(NAGOYA BITES)を検査。今日の分は NAGOYA BITES に入り直し後 `node scripts/note_login.js --from-chrome` → `node scripts/post_note.js --date 2026-10-22` で出し直す

- 2026-10-22 NAGOYA BITES で公開成功（https://note.com/nagoya_bites/n/n52ce457c2e17）。アカウント切替は私がやる: Claude in Chrome で note をログアウト→/login の Google ボタン→自動で NAGOYA BITES→`node scripts/note_login.js --from-chrome`（最大4回再試行）。パスワード入力は不可なので Google 側が切れたら本人作業

- 2026-10-22 note: 本文は HTML 貼り付けで見出し・箇条書きに整形し、元記事は写真つきリンクカード（#666）。見出し画像は題から自前生成して自動アップロード（#667・scripts/lib/note_eyecatch.js）。公開済みの更新は `post_note.js --date D --update <note key>`。他者の写真は規約上アップロードしない。残り: 翌朝の実行確認・GitHub Issue の見張り

- 2026-10-22 夜 判断(autopilot の自動回答＝本人の回答ではない): 見出し画像は図解が不評のため A（付けない・末尾の写真カードのみ・policy eyecatch=false）。ログイン方式を変更: 普段の Chrome の Cookie 複製は本人のアカウント切替で無効になり3回止まったため、専用プロファイル note-profile-own に普通の Chrome 窓で本人が NAGOYA BITES にログイン（`node scripts/note_login.js --own` → ログイン後 `--own-close`）。残: 本人のログイン・10-22 の記事から見出し画像を外す（`post_note.js --date 2026-10-22 --update n52ce457c2e17`）

- 2026-10-23 見出し画像の方針（本人: 図解でなく写真入りのこだわった画像が希望・既存画像は外さなくてよい）。案: ジャンル別の AI 生成『イメージ』写真6〜8枚を Canva で作り、題を重ねて自動合成。詰まり: Canva の生成結果は縮小版(198x100)しか取れず原寸の書き出しは本人のダウンロードが要る／ブラウザ拡張が未接続。policy eyecatch=false のまま。ログイン: 専用窓(note-profile-own)での NAGOYA BITES ログインがまだ保存されていない（匿名セッションのまま）→ 本人が窓で再ログイン後、窓を開いたまま Cookie を確認

- 2026-10-23 ログイン復旧は私が Claude in Chrome で実施（vide太郎ログアウト→/login の Google ボタン→自動で NAGOYA BITES→`node scripts/note_login.js --from-chrome`）。パスワード入力は不要。切れる原因は本人が普段の Chrome で note を別アカウントへ切替えること。専用窓方式(--own)は保存されず廃止扱い。10/22 の見出し画像は policy eyecatch=false で外れた。未決: 見出し画像の写真案の可否

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

- 2026-10-23 アカウント切替の独立化: Chrome に別プロフィール「Profile 1」を作成済み（note 未ログイン）。本人が Profile 1 で NAGOYA BITES にログイン後、policy の account.chromeProfile=\"Profile 1\" にして `node scripts/note_login.js --from-chrome`。以後 Default で vide太郎に切り替えても投稿は影響を受けない。Profile 1 には Claude in Chrome 拡張が無く私は操作できない。複製元の指定は #672 で対応済み。それまでは Default が NAGOYA BITES の状態を保つ（現在 NAGOYA BITES を確認）

- 2026-10-23 本人の「今投稿して」で 10/23 分を NAGOYA BITES で公開: https://note.com/nagoya_bites/n/n878c4d62136a

- 2026-10-23 夜: 見出し画像を写真入りに変更（policy eyecatch=true）。写真は Canva で作った AI 画像を assets/note-eyecatch/ に置き、日付で1枚選んで題を重ねる（※写真はイメージです）。Canva の無料枠が尽き写真は居酒屋1枚のみ。create-design(LinkedIn Post)の jpg 書き出しは原寸(2880x2304)で取れる（generate-image は縮小のみ）。枠が戻ったら ジャンル別に追加。朝9時の自動投稿(n1a04370ade88)に見出しを反映済み。事故: 朝の自動投稿に気づかず手動で二重に公開(n878c4d62136a)→note側の公開済み題と照合して重複を止める処理を追加。重複記事の削除は本人判断（公開済みは UI から消せない）
