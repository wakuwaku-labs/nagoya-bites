# X 自動投稿 計画書（2026-10）

- 作成: 2026-10-12（オーナー依頼「日次ジャーナルをもとに、X への毎日の発信を投稿まで全部自動で」）
- 状態: **段階1の実装済み・試運転中（2026-10-13）**。X には送らない設定（`mode: dry-run`）で動いている。本番は 11 章の確認と鍵の登録（`docs/x-api-setup.md`）の後。実装の状況は 14 章
- 担当: Builder（実装）／Marketer（文面・効果測定）／Editor（文面の言い方）

---

## 0. 要約

1. 毎朝のジャーナル記事が公開されたら、**GitHub Actions（Mac の外）がその直後（数分〜10分後）に1回、X へ「記事の紹介＋リンク」を投稿**する。取りこぼしは 12 時・17 時にやり直す。Mac がスリープしていても動く。
2. 文面は最初は**記事の題名とリンクの定型**で始め（AI に作文させない＝事実と違う文が出ない）、慣れたら AI の一言を足す。どちらも同じ検査（文字数・数字が記事と合うか・使わない言い方）を通ったものだけ投稿する。
3. 費用は **X API の従量課金で月 約6ドル（約900円）**。リンク付きの投稿は1回 0.20 ドル。上限を X 側で月10ドルに設定して使いすぎを防ぐ。
4. 投稿できなかった日は、原因つきで GitHub Issue（＝オーナーにメール）が届き、直れば自動で閉じる。
5. 最初の3日は「投稿せずに、投稿する予定の文面だけ見せる」試運転をしてから本番に切り替える。

---

## 1. 目的と完了条件

### 目的
日次ジャーナル（毎日1本）を X で毎日届け、X 経由の訪問を「ほぼ0」から観測できる量にする。人の手を毎日使わない。

### 完了条件（第三者が確かめられる形）
1. ジャーナルが公開された日は、その日のうちに X に1件投稿され、`data/x_post_log.json` に投稿ID・URL・文面が残る
2. 同じ記事を2回投稿しない（同じ日に何度ワークフローが動いても1件）
3. ジャーナルが公開されなかった日は投稿しない（代わりの記事を作って取り繕わない）
4. 投稿できなかったときは、原因（認証切れ・残高切れ・ページ未公開など）つきの GitHub Issue が当日中に届き、復旧で自動クローズされる
5. 投稿のリンクには `utm_source=x&utm_medium=social&utm_campaign=<記事ID>` が必ず付き、GA4 の流入元で X 経由が数えられる
6. 7日続けて人の操作なしで投稿できている

---

## 2. 現状の調査結果

### 2.1 リポジトリの中

| 項目 | 今の状態 | 根拠 |
|---|---|---|
| X に投稿するコード・設定・鍵 | **何も無い**（コード・依存・GitHub Secrets・ワークフローのどれも無い） | `api.x.com` 等の検索で投稿コードはヒット0。`package.json` に X 系の依存なし |
| ジャーナルの公開 | 毎朝 9:00 に Mac の launchd（`com.nagoyabites.journal`）が `scripts/run_journal_local.sh` を動かし、生成→検査→`git push` で公開 | `run_journal_local.sh:5`・`:813-903` |
| 公開が終わった確かな印 | `data/journal_published.json` に今日の `date` のエントリがあり、`journal/<slug>.html` がある | `run_journal_local.sh:645-651`。エントリは slug / date / title / description / store_ids / published_at |
| 公開の状態の記録 | `data/journal_health.json`（ok / hold / die / hang と理由）が Mac の外へ push される | `run_journal_local.sh:122-147` |
| SNS 原稿の自動生成 | **2026-09-05 から停止中**（オーナー指示「SNS原稿はサイト外の別の仕組みで作る」）。`docs/daily-posts/` の最新は 2026-09-05 | `data/journal_sns_draft_policy.json` |
| 「SNS はサイトの外の仕組みで運用中」 | 2026-09-14 にオーナー確認済み。**外の仕組みは X には投稿していない**（2026-10-14 オーナー回答・確認事項 #1） | メモリ `sns-posting-outside-repo-utm` |
| 過去の方針 | 「外部への発信は自動化しない・投稿はオーナー操作」（SEO-055 の達成条件④、SEO-098）。`social-watchdog.yml` も「自動投稿はスコープ外」と書いている | `agent-backlog.md:2862`・`:5978`、`.github/workflows/social-watchdog.yml:103` |
| UTM の決まり | X は `utm_source=x`、`utm_medium=social`、`utm_campaign=<記事のファイル名から .html を除いたもの>` | `docs/sns-utm-convention.md` |
| 記事のリンクカード | 全記事が `twitter:card=summary_large_image`。`og:image` は HotPepper 写真・Google の店舗写真の URL・図解の PNG（SVG はカードに出ないため PNG に差し替え済み・ISSUE-095） | `journal/_template.html:17`、`scripts/normalize_og_images.js` |
| 鍵の置き場の慣習 | Mac で動くものは `~/.config/nagoya-bites/journal.env`、CI で動くものは GitHub Secrets | `run_journal_local.sh:51-57`、`build.yml:89,100` |
| 監視の手本 | `journal-watchdog.yml`（欠けたら Issue、直れば自動クローズ）と心拍ファイル `data/feedback_health.json`（0件の日も書く） | CLAUDE.md「無人自動化の監視」 |
| 言い方の決まり | 「業界人が読む」など、人が全店を選んだと読める言い方は使わない（2026-10-11 オーナー指示）。**今のジャーナルの description には「業界人が読む」が残っている**（例: 2026-10-12 の記事） | `data/selection_wording_policy.json`、`data/journal_published.json` |
| 写真の決まり | HotPepper の写真は「複製保存・再配信」が規約で禁止。PR TIMES の写真も自分で持たない（参照のみ） | CLAUDE.md「写真ソースの優先順」「禁止事項」 |

### 2.2 X の条件（2026-10-12 に公式ページで確認）

| 項目 | 内容 | 出典 |
|---|---|---|
| 料金の形 | **月額のプランは無く、使った分だけの従量課金**。2026-02 頃に移行。新しく無料枠を使う道は事実上無い（公益目的のアプリなど例外のみ。二次情報） | https://docs.x.com/x-api/getting-started/pricing |
| 投稿の単価 | 投稿（リンクなし）**0.015 ドル**／**リンク付きの投稿 0.20 ドル** | 同上（「Post: Create」「Post: Create (with URL)」の行） |
| 使いすぎ防止 | 請求期間ごとの上限額を設定でき、上限に達すると API が止まる | 同上 |
| 初回の特典 | 支払いカードを初めて登録すると 20 ドル分のクレジット（前払いのクレジットから引かれる方式。開発者の画面は console.x.com） | 同上 |
| 回数の上限 | アプリ全体で1日 10,000 件・1人 15分 100 件（1日1件には関係ない） | https://docs.x.com/x-api/fundamentals/rate-limits |
| 文字数 | 280（日本語は1文字=2なので全角140字）。URL は長さに関係なく23 | https://docs.x.com/resources/fundamentals/counting-characters |
| リンクカード | `summary_large_image`。**SVG は出ない**（PNG/JPG） | 二次情報（既存の ISSUE-095 の判断と一致） |
| 自動投稿のルール | 運用者を明示し、自動であることをプロフィール等で示す（X の「自動化アカウントのラベル」） | https://docs.x.com/developer-terms/agreement-and-policy 、https://help.x.com/en/using-x/automated-account-labels |
| エラー | 401＝鍵が無効、403＝権限が無い（重複投稿もこの形で返る例あり）、429＝回数の上限（`x-rate-limit-reset` まで待つ） | https://docs.x.com/x-api/fundamentals/response-codes-and-errors |
| リンク付き投稿の表示のされにくさ | 報道によって「30%〜94% 減る」と幅が大きく、公式の数字は無い | 確定できず。効果は自分の数字で測る（9章） |

**未確認のまま残るもの**（段階0・1で実物で確かめる）: 従量課金のアプリで OAuth 1.0a の鍵が投稿に使えるか・有効期限があるか（一般に「取り消すまで有効」と言われる）、残高切れ・上限到達のときのエラーの形、画像アップロードの単価（今回は使わない）。

---

## 3. 設計の原則（このプロジェクトの決まりから）

1. **Mac の外で動かす**（制約11・ISSUE-084 の教訓）。ジャーナルは Mac で作られるが、投稿は GitHub Actions に置く。Mac が落ちても「ジャーナルが無いので投稿しなかった」と外から分かる。
2. **事実だけで判断する**（制約10）。「公開済みか」は `data/journal_published.json` と本番 URL が 200 を返すかで決める。文面の数字は記事の本文にある数字だけを許す。
3. **取り繕わない**。ジャーナルが無い日は投稿しない。AI の文面が検査に落ちたら、定型の文面に下げる（その日の投稿をゼロにも、でっち上げにもしない＝品質ゲート原則4）。
4. **人の承認を待たない**（品質ゲート原則6）。本番では誰の返事も待たずに投稿まで進む。止める手段は「投稿の停止スイッチ」1つ（`data/x_post_policy.json` の `enabled`）。
5. **写真は X にアップロードしない**。HotPepper の写真は再配信が規約違反になるため。見せ方は記事のリンクカード（X が記事の `og:image` を読みに来る＝リンクを貼るのと同じ扱い）だけにする。
6. **新しい npm 依存を足さない**。署名（OAuth 1.0a の HMAC-SHA1）は Node 標準の `crypto` で書く。
7. **言い方の決まりを守る**。「業界人」「目利き」など `data/selection_wording_policy.json` の語は X の文面に出さない（同じ判定器を使う）。

---

## 4. 仕組みの全体

```
[毎朝 9:00 Mac] run_journal_local.sh が記事を作って push（今のまま。変えない）
        │   data/journal_published.json に今日のエントリ
        ▼
[公開の push の直後 GitHub Actions] x-post.yml（やり直し: 12:00・17:00 JST の定時実行）
   1. 停止スイッチを見る（data/x_post_policy.json の enabled / mode）
   2. 今日のエントリがあるか          → 無ければ「ジャーナル無し」と心拍に書いて終了
   3. 投稿台帳に今日の分があるか      → あれば何もしない（二重投稿を防ぐ）
   4. 本番の記事 URL が 200 か        → 最大10分待つ。まだなら終了し、次の回でやり直す
   5. og:image が画像として取れるか   → 取れなくても投稿はする（カードの画像が無いだけ）。理由を記録
   6. 文面を作る（定型 or AI の一言）→ 検査（5.3）→ 落ちたら定型に下げる
   7. POST /2/tweets → 投稿ID を台帳に書き、心拍を更新して commit
        │
        ▼
[21:00 JST GitHub Actions] x-post-watchdog.yml（新規）
   今日ジャーナルがあるのに投稿が無い・認証エラー・残高切れ → Issue（原因つき）
   直ったら自動で閉じる
```

- 定時の起動（12:00・17:00）は「公開直後にページがまだ無かった」「X が一時的に落ちていた」ときのやり直し専用。台帳を見るので、投稿済みなら何もしない。
- 起点を定時実行ではなく公開の push にしたのは、GitHub の定時実行が混雑で数時間遅れるため（journal-watchdog.yml の実測 4〜6 時間）。
- 台帳の commit は、日次ビルド（build.yml）の bot コミットと同時に起きることがある。ワークフローは同時に1つだけ動かし（concurrency）、push は取り込み直してやり直す（ISSUE-161 と同じ型）。
- 急いで止めたいときは、GitHub の Actions 画面でワークフローを「Disable」にする（コミット不要）か、停止スイッチを `false` にする。
- 送った直後に落ちて台帳が残らなかった場合も二重にはならない。同じ記事からは同じ文面が作られ、次の回は X が「重複」として拒むので、それを届いた印として台帳に `duplicate` と書き、もう送らない（当初は投稿の直前に「送信中」をコミットする案だったが、仕組みが重くなるのでこちらにした・判断の記録 0027）。

---

## 5. 投稿の中身

### 5.1 段階1: 定型の文面（AI の作文なし）

```
【今日の名古屋ジャーナル】
中川区「なかがわ 街仲食堂」開店、シニアが握るおむすび550円と3時間営業を読む

https://nagoya-bites.com/journal/2026-10-12-nakagawa-machinaka-shokudo-omusubi.html?utm_source=x&utm_medium=social&utm_campaign=2026-10-12-nakagawa-machinaka-shokudo-omusubi
#名古屋グルメ #中川区
```

- 題名は記事の `title` をそのまま使う（記事と同じ文なので事実の食い違いが起きない）
- description は使わない（長すぎる＋「業界人が読む」が残っているため）
- 題名の「〜を業界人が読む」は X の文面に限って「〜を読む」に置き換える（`data/x_post_policy.json` の `titleRewrites`。直近60本の題名のうち17本がこの形で、そのままだと言い方の検査で毎回止まる。2026-10-13 実測。記事の題名は変えない）
- ハッシュタグは最大2個: `#名古屋グルメ` ＋ 記事のエリア名（取れるときだけ）
- 280 を超えるときは、ハッシュタグ → 見出しの順に削る。題名は途中で切らない

### 5.2 段階2: AI の一言を足す（任意・段階1が安定してから）

- ジャーナルを作る Mac 側で、公開の後に `claude --print` を1回だけ呼び、「記事の本文だけを根拠に、X 用の一言（全角60字以内）」を JSON で出させ、`data/x_post_queue.json` に書いて push する
- ジャーナル本体の公開は終わった後なので、ここが失敗してもジャーナルには影響しない。失敗した日は段階1の定型で投稿する
- `.claude/commands/journal-today.md` は Claude が編集できない（自己改変ブロック）ため、指示は `docs/x-post-prompt.md` に置き、`run_journal_local.sh` から読む

### 5.3 投稿前の検査（文面の種類によらず全部通す・判定器は1本）

| 検査 | 落ちたとき |
|---|---|
| X の数え方で 280 以下（日本語=2、URL=23） | 削れる部分を削る。それでも超えたら定型に下げる |
| 文面に出る数字（550円・3時間 等）が、すべて記事の本文にある | 定型に下げる |
| `data/selection_wording_policy.json` の error の語が0件 | 定型に下げる（定型でも出るなら、その語を含む題名なので投稿を止めて Issue） |
| リンクに UTM 3つが付いている・リンク先がその日の記事 | 投稿しない（作り手の不具合なので Issue） |
| 過去 30 日の投稿と同じ文面ではない | 投稿しない（X の重複禁止に当たるため） |

---

## 6. いつ・どこで動かすか

| 項目 | 推奨 | 理由 |
|---|---|---|
| 場所 | GitHub Actions | Mac のスリープ・認証切れと切り離す。鍵は GitHub Secrets に置ける |
| 時刻 | 公開の直後（だいたい 9:30〜10:30）。やり直しは 12:00・17:00 | GitHub の定時実行は数時間遅れることがあり（実測 4〜6 時間）、時刻を約束できない。公開の push を起点にすれば数分で動ける。昼の店探しの前に届く |
| 鍵 | OAuth 1.0a（API Key/Secret＋Access Token/Secret の4つ） | 一般に取り消すまで有効で、更新の保存が要らない。OAuth 2.0 はトークンが2時間で切れ、更新のたびに新しい鍵を保存し直す必要があり、Actions では扱いにくい |
| 鍵の名前 | `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET` | ログ・コミットに出さない（公開リポジトリ） |

---

## 7. 監視と警報（制約11 の型どおり）

- 心拍: `data/x_post_health.json` に毎回（投稿しなかった日も）`{date, result: posted|no_journal|skipped_disabled|failed, reason, tweet_id}` を書いて commit
- 警報: `x-post-watchdog.yml` が 21:00 JST に見て、次のときだけ Issue を1件出す（続く間は本文を書き換えるだけ）
  - 今日ジャーナルが公開されたのに投稿が無い
  - 401（鍵が無効）・403（権限が無い）・残高切れ・上限額への到達など、人が直すしかない失敗 → **原因と直し方を本文に書く**（残高・上限のときに X が返すエラーの形は段階1で実物を確かめて判定に入れる）
  - 文面の検査に落ちて送っていない（題名に使わない言い方が残っている等）
- 鳴らさないとき: ジャーナルが休み（HOLD）の日。それは `journal-watchdog.yml` の役目で、二重に鳴らさない
- 直ったら自動で閉じる（オオカミ少年にしない）
- 夜間 QA に soft で「直近7日の投稿の欠け」を載せる

---

## 8. 費用

| 項目 | 金額（目安） |
|---|---|
| リンク付き投稿 1日1件 × 30日 | 0.20 ドル × 30 = **月 6 ドル**（1ドル150円で約900円） |
| 試しの投稿（初日に1〜2件） | 1件 0.20 ドル |
| 画像のアップロード | 使わない（0） |
| GitHub Actions | 公開リポジトリのため無料 |
| AI の一言（段階2） | Mac の Claude の定額の範囲（追加の API 料金なし） |
| 初回特典 | カード登録で 20 ドル分 → 最初の約3か月はほぼ実質0 |

- X の開発者画面で **請求期間ごとの上限を 10 ドル** にする（毎日2回送ってしまう不具合があっても月12ドルで止まる）
- 単価は X が変えることがある。月1回、X の開発者画面の請求額と `data/x_post_log.json` の件数を突き合わせる（Marketer）

---

## 9. 効果の測り方

- GA4 の `sourceBreakdown` の `x / social` の行（UTM で数える）。週次レポートの流入元に出る
- 比べ方: 開始前の4週と開始後の4週。X 経由のセッション・その後に店舗ページへ進んだ割合
- リンク付き投稿が表示されにくい問題は、段階3で「リンクを本文に入れる日」と「リプライに入れる日」を交互にして、表示回数とクリックを比べてから決める（リプライにも URL が入るので単価は同じ 0.20 ドル。表示回数を取るには読み取りの料金が別にかかる）

---

## 10. 段階と作業の分け方

| 段階 | 作業 | 誰が | 目安 |
|---|---|---|---|
| 0 | 確認事項（11章）を決める | オーナー | — |
| 0 | X の開発者アカウント作成・アプリ作成・権限を「Read and write」・カード登録・上限10ドル・鍵4つの発行・GitHub Secrets への登録・自動化ラベルの設定 | オーナー（手順書は Builder が用意） | 30分 |
| 1 | 文面づくりと検査の部品 `scripts/lib/x_post.js`（文字数の数え方・数字の照合・言い方の検査・UTM）と単体テスト | Builder | 1〜2時間 |
| 1 | 投稿スクリプト `scripts/post_journal_to_x.js`（既定は送らない。`--yes` のときだけ送る）・台帳 `data/x_post_log.json`・停止スイッチ `data/x_post_policy.json` | Builder | 1〜2時間 |
| 1 | `x-post.yml`（公開の push の直後・やり直し 12:00/17:00・手動実行あり）を「試運転」で動かし、送る予定の文面を Actions の要約に出す | Builder | 30分 |
| 2 | 試運転3日 → オーナーが文面を見て OK → 手動実行で初回投稿 → 定時の本番へ | オーナー確認 → Builder | 3日 |
| 3 | `x-post-watchdog.yml`・心拍・夜間 QA の soft | Builder | 1時間 |
| 3 | 判断の記録 `docs/decisions/0027-x-auto-posting.md`（「外部発信は自動化しない」を X に限って覆す理由と条件）、SEO-055・SEO-098・`social-watchdog.yml` の文言の更新 | Builder / Marketer | 30分 |
| 4（任意） | AI の一言（5.2）、リンクの置き場所の比較（9章）、4週後の効果のまとめ | Marketer / Editor | — |

---

## 11. オーナーに確認したいこと（推奨つき）

| # | 決めること | 推奨 | なぜ今決めるか |
|---|---|---|---|
| 1 | 今「サイトの外の別の仕組み」で X に投稿しているか | **回答済み（2026-10-14）: 投稿していない**。X はこの仕組みだけが投稿する（止める作業は無い） | 両方動くと同じ記事が2回出る（X の重複禁止にも当たる） |
| 2 | 使う X アカウント（@名前）と、そのアカウントに「自動化アカウント」のラベルを付けてよいか | NAGOYA BITES の公式アカウントで、ラベルを付ける | X のルールで自動投稿には表示が求められる。付けないと凍結の恐れ |
| 3 | 費用（月 約6ドル・上限10ドル）の承認 | 承認する（最初の約3か月は特典の20ドルでまかなえる） | 課金はオーナーのカードでしか始められない |
| 4 | 投稿する時刻 | 公開の直後（だいたい 9:30〜10:30） | GitHub の定時実行は数時間遅れることがあり、12時ちょうどは約束できない。昼・夜にそろえたい場合は、Actions の中で待つ形にできる |
| 5 | 文面は定型（題名＋リンク）から始めてよいか | 定型から始め、安定してから AI の一言を足す | AI の文は事実と違う数字を書く危険がある。定型は記事と同じ文なので安全 |
| 6 | 試運転（投稿せず文面だけ見せる）の日数 | 3日 | 本番の前に文面の見え方を確かめるため |
| 7 | ジャーナルが休みの日 | 投稿しない | 代わりの投稿を自動で作ると、記事のない投稿や同じ特集の繰り返しになる |
| 8 | ハッシュタグ | `#名古屋グルメ` ＋ エリア名の最大2個 | 多すぎると宣伝っぽく見える |

**決めなくてよいこと（こちらの既定で進める）**: 鍵の方式（OAuth 1.0a）、動かす場所（GitHub Actions）、警報の届け先（GitHub Issue＝メール）、写真をアップロードしないこと（規約）、「業界人」などの言い方を出さないこと（2026-10-11 の指示どおり）。

---

## 12. やらないこと

- ブラウザの自動操作で投稿する（X の規約で永久凍結の対象になりうる）
- Buffer などの外部の予約投稿サービスを挟む（X 連携の料金・可否が未確認で、鍵を外部に預けることになる。X API 直接の方が安く単純）
- 写真を X にアップロードする（HotPepper の規約・PR TIMES の条件に反する）
- いいね・フォロー・リプライの自動化（今回は投稿だけ。自動化ルールの対象が広がる）
- ジャーナル以外（特集・店舗）の自動投稿（効果を見てから別に決める）
- 投稿の数字を合否の分かれ目に使う（いいね数で文面を選ぶ等はしない・制約10）

---

## 13. 関連ファイル

- 既存: `scripts/run_journal_local.sh` / `data/journal_published.json` / `data/journal_health.json` / `docs/sns-utm-convention.md` / `data/selection_wording_policy.json` / `scripts/lib/traffic_source.js` / `.github/workflows/journal-watchdog.yml` / `.github/workflows/social-watchdog.yml` / `data/journal_sns_draft_policy.json`
- 新規（予定）: `scripts/lib/x_post.js` / `scripts/post_journal_to_x.js` / `data/x_post_policy.json` / `data/x_post_log.json` / `data/x_post_health.json` / `.github/workflows/x-post.yml` / `.github/workflows/x-post-watchdog.yml` / `docs/x-api-setup.md`（オーナー向けの手順書）/ `docs/decisions/0027-x-auto-posting.md`

---

## 14. 実装の状況（2026-10-13）

オーナーの「進められる分は進めて」（2026-10-12 夜）を受けて、X に送らない形で段階1と段階3の一部を作った。

| もの | 状態 | 確かめ方 |
|---|---|---|
| 運用ルール `data/x_post_policy.json` | ✅ `mode: dry-run`（X に送らない） | ファイルを見る |
| 文面づくりと検査 `scripts/lib/x_post.js` | ✅ | `node --test tests/x_post.test.js`（OAuth 署名は X の公式の例と一致） |
| 投稿 `scripts/post_journal_to_x.js` | ✅ 直近60本の記事で試運転し、60本とも検査を通過（最長 179／280） | `node scripts/post_journal_to_x.js --date 2026-10-12` |
| ワークフロー `.github/workflows/x-post.yml` | ✅ 試運転で動く（鍵が無くても動く） | Actions の「NAGOYA BITES — X 自動投稿」の Summary に、送る予定の文面が出る |
| 見張り役 `scripts/check_x_post_health.js` と `.github/workflows/x-post-watchdog.yml` | ✅ `live` のときだけ鳴る | `node scripts/check_x_post_health.js` |
| オーナー向けの手順書 `docs/x-api-setup.md` | ✅ | — |
| 判断の記録 `docs/decisions/0027-x-auto-posting.md` | ✅ | — |
| 鍵の登録・課金・自動化ラベル（P-294） | ⏳ オーナーの操作待ち | — |
| 初回の投稿と本番への切り替え（P-296） | ⏳ 鍵の登録と試運転の確認の後 | — |
| `social-watchdog.yml` の「自動投稿はスコープ外」の文言（P-297） | ✅ 2026-10-15 に本番へ切り替えるのと同時に直した | — |
