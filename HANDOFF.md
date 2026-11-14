status: done

# LINE 日次レポート（11/11）の誤りを直す（2026-11-14）

## 目的
本人「これLINEに届いたけど間違ってない？修正して」（2026-11-11 分の日次レポート）。

## 完了条件
- 誤りの原因を GA4 の実数で特定し、GAS（.gas-deploy/Code.js）を直して本番 GAS に反映・main に合流

## できていること
- 原因: 11/11 は直接アクセス 692 回（直前14日の中央値 約18回）・PC 91% の機械的な訪問の疑い。普段は訪問 100〜200・直帰 21〜48%。それで「苦戦中」と誤判定し、施策も出していた
- 急増の日は判定・読まれ方・流入元・助言を直接アクセスを除いた値で出す（ADR 0066・tests/gas_direct_spike.test.js）
- 助言の禁止語（現役の飲食人が厳選・業界人の一言）、8回押されたのに「ほぼ未クリック」、件/回の不一致を修正。AI 用の指示文も表現の決まりに合わせた
- clasp push 済み。clasp pull で本番＝main の Code.js 一致を確認
- 別件: main の build.yml が 11/13 夕方から note 見出し画像の描画試験（Mac の Chrome 前提）で落ちていたのを、Chrome の無い CI では飛ばすよう修正

## 次にやること
- Ondine #1940（11/14 09:30 に自動実行）: 朝の 11/12 分のレポートで新コードの動作を確認
- LINE トークン: 本人が 11/14 14:55 に再発行（旧トークン 401 を確認）し、スクリプト プロパティ LINE_CHANNEL_TOKEN に保存。Code.js から消して clasp push・本番一致を確認（c9f0df11e1）。LINE 送信の実地確認は本人（clasp run は API 実行未設定で不可）。#1940 は 11/12 分のレポートで3点合格・done

## 試したが駄目だったこと
- GA4 の生データ（地域・ブラウザ別）は手元に鍵が無く見られない。ボットの相手は未特定

## 守るルール・判断メモ
- 閾値: 直前14日の中央値の3倍以上かつ＋100回以上（Code.js 冒頭の DIRECT_SPIKE_*）
- 見張りの直帰率照合は、本文が「直接アクセスを除いた値」と名乗る日は判定しない（data/gas_deploy_policy.json）

## 関連ファイル
- .gas-deploy/Code.js / data/gas_deploy_policy.json / scripts/lib/gas_deploy_trace.js / docs/decisions/0066-gas-report-direct-spike-exclusion.md

## 追記 2026-11-14 午後
- 本人「文字化け・急増分が含まれている」→ 急増の日は GA4 の全取得で当日の (direct) を除く形に変更（withDirectExclusion・ADR 0066 追記・cb5021e4fa・clasp push 本番一致）。
- 送り直しは resendDailyReportToLine（作り直して LINE だけ）。メール本文の転送は絵文字が化けたので廃止。
- 確認済み: GA4 は除外条件つきの7本の取得をすべて受け付けた（2026-11-14 CI の一時ブランチで本番 GA4 に実行・run 43581972181）。11/12 は除外後 訪問した人 115人・ページ 156・直帰 30%（除外前 899人・946）。
- メールの文字化け: GmailApp が4バイトの絵文字を化けさせていた。sendReportEmail で件名・テキスト版から絵文字を外し、HTML 版は文字参照で残す（tests/gas_direct_spike.test.js）。
