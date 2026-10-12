# X 自動投稿の準備（オーナー向けの手順・SNS-002 / Linear P-294）

X に自動で投稿するための鍵を作り、GitHub に登録する手順です。所要 30 分ほど。
X のアカウントと支払いカードを使うので、オーナー本人の操作が要ります。
計画の全体は `docs/x-auto-posting-plan-2026-10.md`。

> X の画面の名前や配置は変わることがあります。見つからないときは、近い名前のメニューを探してください。

## 1. 開発者向けの画面に入る
1. 投稿に使う X アカウント（NAGOYA BITES のアカウント）でログインした状態で、https://developer.x.com を開く
2. 開発者の登録（利用目的の入力）を求められたら、次のように書く（英語で求められたら下の英文をそのまま使ってよい）
   - 「自社の飲食店ガイドサイト nagoya-bites.com の毎日の記事を、自社アカウントから1日1回紹介する。いいね・フォロー・リプライの自動化や、他人の投稿の取得はしない」
   - "We post one link per day from our own account to introduce the daily article on our restaurant guide site, nagoya-bites.com. No automated likes, follows, replies, or collection of other users' data."

## 2. アプリを作り、権限を「読み書き」にする
1. 開発者の画面でアプリ（App）を作る。名前は `nagoya-bites-journal` など
2. アプリの設定の **User authentication settings**（ユーザー認証の設定）を開き、次のようにする
   - App permissions: **Read and write**（読み書き）
   - Type of App: **Web App, Automated App or Bot**
   - Callback URI / Website URL: どちらも `https://nagoya-bites.com/`（必須の欄を埋めるためで、使わない）
3. 保存する

## 3. 鍵を4つ作る（権限を変えた**後**に作る）
アプリの **Keys and tokens** で次の4つを作る。表示は一度きりなので、そのまま 5 の登録まで続けてください。メモ帳などに貼らないでください。
| 画面の名前 | GitHub に登録する名前 |
|---|---|
| API Key（Consumer Key） | `X_API_KEY` |
| API Key Secret（Consumer Secret） | `X_API_SECRET` |
| Access Token | `X_ACCESS_TOKEN` |
| Access Token Secret | `X_ACCESS_TOKEN_SECRET` |

- Access Token の横に **Read and Write** と出ていることを確かめる。**Read only** と出ていたら、2 の権限を直してから作り直す（権限を変える前に作ったトークンでは投稿できない）

## 4. 支払いと上限
1. 開発者の画面の **Billing**（請求）で支払いカードを登録する（初回の登録で 20 ドル分のクレジットが付く）
2. **Spending limit**（請求期間ごとの上限）を **10 ドル** にする
   - 見込みは 1日1件 × 0.20 ドル（リンク付きの投稿の単価）＝ 月約 6 ドル

## 5. GitHub に鍵を登録する
どちらかの方法で。値は画面に出さず、コミットやチャットにも書かないでください。

- **方法A（推奨・ターミナル）**: この Claude Code のセッションで、次を1行ずつ入力し、聞かれたら値を貼り付ける（`!` から始めるとこのセッションで実行される。値は画面に残らない）
  ```
  ! gh secret set X_API_KEY
  ! gh secret set X_API_SECRET
  ! gh secret set X_ACCESS_TOKEN
  ! gh secret set X_ACCESS_TOKEN_SECRET
  ```
- **方法B（ブラウザ）**: https://github.com/wakuwaku-labs/nagoya-bites/settings/secrets/actions → **New repository secret** で、名前と値を4回登録する

## 6. 「自動化アカウント」のラベルを付ける
X のルールで、自動で投稿するアカウントには表示が求められます。
1. 投稿に使うアカウントで X にログインし、**設定とプライバシー → アカウント → アカウント情報 → 自動化（Automation）** を開く
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
