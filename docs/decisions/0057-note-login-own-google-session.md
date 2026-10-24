# 0057 note の自動投稿は、専用プロファイルが自分の Google ログインで入り、切れていたら投稿の前に自分で入り直す

- 日付: 2026-10-24
- 状態: 採用（0054 の「ログイン: 普段の Chrome の Cookie を複製」を置き換える）
- 関連: scripts/lib/note_browser.js（loginWithGoogle・ensureAccount）/ scripts/post_note.js / scripts/note_login.js（--google）/ data/note_post_policy.json（account.nickname）/ ADR 0054

## 背景
毎朝の note 投稿（`~/.config/nagoya-bites/note-profile-own`）のログインは、`note_login.js --from-chrome` で普段の Chrome（Default）の note の Cookie を複製したものだった。複製なので、本人の Chrome と同じログインを共有していた。本人が普段の Chrome で note からログアウトしたり、別のアカウント（vide太郎）に切り替えたりすると、専用プロファイルのログインも一緒に切れた。10-22 の夜までに3回止まり、10-24 の朝も未ログインになっていた。
2026-10-24 に、本人から「note が違うアカウントになっていても、ログインを切り替えて自動投稿が止まらないようになっているか」と聞かれた。

2026-10-24 に確かめたこと（専用プロファイルの写しを使い、本人の Chrome には触れていない）:
- 専用プロファイルの `_note_session_v5` の作成時刻は普段の Chrome（Default）と同じ 05:30:46 だった（同じログインの複製）。
- 専用プロファイルは Chrome 自体が Google アカウントにログインしている。note のログイン画面で「Google」を押すと、パスワードを入れずに NAGOYA BITES に入れた（Google の Cookie を消した写しでも入れた）。
- 片方の写しで note のログアウトを押すと、同じログインを写したもう一方も未ログインになった（401）。Google から別に入った写しは NAGOYA BITES のままだった。＝ note のログアウトは、そのログインだけを切る。
- vide太郎 のログインを入れた写しでも、投稿の前の確認で note の Cookie を手元で消して Google から入り直し、NAGOYA BITES になった。本人の Chrome（Profile 1）の vide太郎 はログインしたままだった。
- Google への通信を止めた写しでは、入り直せずに理由つきで止まった（投稿はしない）。

## 決めたこと
1. 専用プロファイルのログインは、普段の Chrome から複製しない。専用プロファイルの中で「Google」を押して入る（`node scripts/note_login.js --google`）。こうすると普段の Chrome とは別のログインになり、本人が普段の Chrome で切り替えたりログアウトしたりしても切れない。
2. 投稿の前（`post_note.js`）にアカウント名を確かめる（policy の `account.nickname`）。未ログイン・別アカウントなら、note の Cookie を手元で消して（note のログアウトは押さない＝本人の Chrome のログインは切らない）Google から入り直し、もう一度確かめる。それでも違えば、投稿せずに止めて理由を出す（10-22 に vide太郎 で公開したため）。
3. `--from-chrome`（複製）は予備に残す。専用プロファイルの Chrome の Google ログインが切れたときは `node scripts/note_login.js --own` で本人が窓からログインする。

## 選ばなかった案と理由
- 普段の Chrome の別プロフィール（Profile 1）を NAGOYA BITES 専用にして複製する（10-23 の案）: 複製なので、そのプロフィールでログアウトすると切れるのは同じ。Profile 1 には本人が vide太郎 で入っていた。
- 本人に「普段の Chrome で切り替えないで」と頼む: 守れなかった日に止まる。人に覚えさせる運用は採らない。
- メールとパスワードで入る: NAGOYA BITES は Google で入るアカウントで、パスワードは本人しか扱えない。
- 普段の Chrome の Google の Cookie を複製する: 本人の了承（方式A）は note の Cookie だけだった。いまの方法では不要。

## 見直す条件
- 専用プロファイルの Chrome の Google ログインが切れて、入り直しが続けて失敗したとき（`--own` で本人のログインが要る）。
- note がログアウトのときに全部の端末のログインを切る仕様に変わったとき、またはログイン画面の「Google」ボタンの形が変わったとき。
