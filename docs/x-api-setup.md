# X 自動投稿の準備（オーナー向けの手順・SNS-002 / Linear P-294）

X に自動で投稿するための鍵を作り、GitHub に登録する手順です。所要 30 分ほど。
X のアカウントと支払いカードを使うので、オーナー本人の操作が要ります。
計画の全体は `docs/x-auto-posting-plan-2026-10.md`。

> X の画面の名前や配置は変わることがあります。見つからないときは、近い名前のメニューを探してください。
> 2026-10-14 に X の公式の説明（https://docs.x.com/fundamentals/developer-portal ・ https://docs.x.com/x-api/getting-started/pricing ）で確かめた内容です。開発者の画面は **https://console.x.com** に移っています（古い developer.x.com ではありません）。

## 1. 開発者の画面に入る
1. 投稿に使う X アカウント（NAGOYA BITES のアカウント）でログインした状態で、**https://console.x.com** を開く
2. 開発者の規約（Developer Agreement）に同意する
3. 利用目的の入力を求められたら、次の文をそのまま使ってよい
   - 「自社の飲食店ガイドサイト nagoya-bites.com の毎日の記事を、自社アカウントから1日1回紹介する。いいね・フォロー・リプライの自動化や、他人の投稿の取得はしない」
   - "We post one link per day from our own account to introduce the daily article on our restaurant guide site, nagoya-bites.com. No automated likes, follows, replies, or collection of other users' data."

## 2. アプリを作り、権限を「読み書き」にする
1. **New App** を押し、名前（例 `nagoya-bites-journal`）と説明（上の文でよい）を入れて作る
   - このとき鍵が表示されることがありますが、**まだ使いません**（権限を変える前の鍵では投稿できないため）。閉じてかまいません
2. 作ったアプリの設定で、認証の設定（User authentication settings など）を開き、次のようにして保存する
   - App permissions（OAuth 1.0a の権限）: **Read and write**（読み書き）
   - Type of App: **Web App, Automated App or Bot**
   - Callback URI / Website URL: どちらも `https://nagoya-bites.com/`（必須の欄を埋めるためで、使わない）

## 3. 鍵を4つ作る（権限を変えた**後**に作る）
アプリの **Keys and tokens** で、次の4つを作り直す（Regenerate / Generate）。表示は一度きりなので、そのまま 5 の登録まで続けてください。メモ帳などに貼らないでください。
| 画面の名前 | GitHub に登録する名前 |
|---|---|
| API Key（Consumer Key） | `X_API_KEY` |
| API Key Secret（Consumer Secret） | `X_API_SECRET` |
| Access Token | `X_ACCESS_TOKEN` |
| Access Token Secret | `X_ACCESS_TOKEN_SECRET` |

- Access Token の横に **Read and Write** と出ていることを確かめる。**Read only** と出ていたら、2 の権限を直してから Access Token を作り直す
- 作る順番は **API Key（コンシューマーキー）が先、Access Token が後**。API Key を作り直すと、それより前の Access Token は使えなくなる
- 鍵の値が画面に出ている間は、Claude に画面を撮らせない（値を Claude に渡さない）
- 画面の **「OAuth 1.0 キー」の欄の2行（コンシューマーキー・アクセストークン）だけ**を使う。下の「OAuth 2.0 キー」の欄（クライアントID・クライアントシークレット・その下のアクセストークン）は使わない。OAuth 2.0 のアクセストークンを `X_ACCESS_TOKEN` に貼ると「形が違う」と出る（2026-10-15 に実際に起きた）
- Client ID / Client Secret / Bearer Token は使わない（この仕組みは OAuth 1.0a で自分のアカウントから投稿するため）

## 4. 支払いと上限
X API は月額なしの前払い（クレジット）です。クレジットから1回ずつ引かれます。
1. Developer Console の請求（Billing）で、支払いカードを登録する
   - 初めてカードを登録すると **20 ドル分の無料クレジット** が付く。1日1件 × 0.20 ドルなので約100日分（約3か月）。**最初はクレジットを買い足さなくてよい**
2. **Spending limit**（請求期間ごとの上限）を **10 ドル** にする（上限に達すると、次の請求期間まで投稿が止まる）
3. **Auto-recharge**（残高が減ったら自動で買い足す）は、最初は **オフのまま** にする
   - 残高が無くなると投稿が止まり、見張り役が「残高切れ」の Issue（＝メール）で知らせる。そのとき買い足すか、自動の買い足しを入れるかを決めればよい

## 5. GitHub に鍵を登録する
どちらかの方法で。値は画面に出さず、コミットやチャットにも書かないでください。

- **方法A（推奨・ブラウザ）**: https://github.com/wakuwaku-labs/nagoya-bites/settings/secrets/actions → **New repository secret** で、名前と値を4回登録する（同じ名前がもうあるときは、その行の鉛筆の印から値を入れ直す）
- **方法B（Mac の「ターミナル」アプリ）**: 次を1行ずつ入力し、`? Paste your secret` と聞かれたら値を貼り付けて Enter（値は画面に出ない）
  ```
  gh secret set X_API_KEY -R wakuwaku-labs/nagoya-bites
  gh secret set X_API_SECRET -R wakuwaku-labs/nagoya-bites
  gh secret set X_ACCESS_TOKEN -R wakuwaku-labs/nagoya-bites
  gh secret set X_ACCESS_TOKEN_SECRET -R wakuwaku-labs/nagoya-bites
  ```
  - ⚠️ Claude Code の画面で `! gh secret set …` と打つのは**使わない**。値を聞く画面が出ず、そのまま空の値が登録される（2026-10-14 に実際に起きた）

**登録できたかの確かめ方**（値は誰にも見えないまま確かめられる）: Claude に「鍵を確かめて」と伝えるか、Actions の「NAGOYA BITES — X 自動投稿」を **Run workflow**（force_live のチェックは入れない）で動かし、Summary の「鍵（値は出さない）」の行が4つとも「登録済み」になっているかを見る。「空」「形が違う」「Access Token の値が入っている疑い」「ほかの名前と同じ値」があれば、その名前の値を入れ直す。コンシューマーキーの行を上書きしてしまったときは、3 の順番（コンシューマーキー → アクセストークン）で4つとも作り直す。

## 6. 「自動化アカウント」のラベルを付ける
X のルールで、自動で投稿するアカウントには表示が求められます。
1. 投稿に使うアカウントで X（https://x.com ）にログインし、**設定とプライバシー → アカウント → アカウント情報 → 自動化（Automation）** を開く
2. 管理するアカウント（オーナーの個人アカウントなど）を選んで設定する
3. プロフィールに「Automated by @（管理アカウント）」の表示が出ることを確かめる

## 7. 終わったら
Claude に「X の鍵を登録した」と伝えてください。次の順で進めます。
1. 試運転の文面（Actions の「NAGOYA BITES — X 自動投稿」の実行の Summary）を一緒に確かめる
2. Actions → X 自動投稿 → **Run workflow** で `force_live` にチェックを入れて、初回の1件を投稿する（Claude が実行してもよい）
3. X 上で投稿とリンクカードの見え方を確かめる
4. `data/x_post_policy.json` の `mode` を `live`、`liveSince` を当日にして、毎日の自動投稿に切り替える

## 止めたいとき
- すぐ止める: GitHub の Actions → 「NAGOYA BITES — X 自動投稿」→ 右上の「…」→ **Disable workflow**
- 運用として止める: `data/x_post_policy.json` の `mode` を `off`（何もしない）か `dry-run`（文面だけ作る）にする
- 鍵を無効にする: X の開発者画面でアプリの Access Token を **Revoke** する
