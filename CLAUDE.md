# NAGOYA BITES — エージェント憲法

> **このファイルはプロジェクトのルールブック。**
> エージェントとして動き始めたら、まず `agents/orchestrator.md` を読んで
> CEO（Orchestrator）として振る舞ってください。

---

## 最初にやること（必須）

```
1. agents/orchestrator.md を読む   ← あなたの役職・権限・行動フローが書いてある
2. agent-backlog.md を読む         ← 現在の課題状況を把握する
3. ユーザーの意図を分類し、実行モードを選ぶ
```

Linear課題を指定されたら、[初心者向けLinearガイド](docs/linear-beginner-guide.md)に沿ってLinear Issueとbacklog仕様を照合してから進める。同期運用の詳細は `docs/linear-task-workflow.md` を参照。運用の型と今後の導入順は `docs/linear-ai-native-playbook.md` を参照。

## Linear Issue品質ルール（全起票経路で必須）

人にルールを覚えさせず、ClaudeはIssueを新規作成するたびに次の7項目を確認する。手動作成、backlog同期、日次・週次triage、CI自動起票のすべてに適用する。

1. **タイトルは動詞で書く** — 「検索改善」のような名詞だけにせず、「検索結果から閉店店舗を除外する」のように完了する行為と結果を示す。
2. **担当者と期限を入れる** — Linearユーザーとしての担当者と `YYYY-MM-DD` の期日を設定する。backlogの `owner`（役割）だけでは担当者の指定とみなさない。
3. **初期状態を明示する** — 通常は `Todo`。作成時点で担当者がすぐ着手する場合だけ `In Progress` を選ぶ。
4. **Projectに紐付ける** — 目的に合う既存Projectを選ぶ。適切なProjectが無ければIssueを作らず、Projectの選択・作成をユーザーに確認する。
5. **背景とコンテキストを書く** — 発生状況、なぜ必要か、関連するURL・ファイル・データをIssue本文に残す。
6. **ゴールと達成条件を書く** — 終了時に第三者が確認できる受け入れ条件を記載する。
7. **30分以上の作業はsub-issueへ分割する** — 親Issueには全体ゴールを置き、独立して完了確認できる作業単位を子Issueにする。

作成前に7項目を検査し、不明な担当者・期限・Projectを推測で埋めない。担当者と期限は `data/linear_issue_defaults.json` の既定値（担当＝オーナー、期限＝起票日＋優先度別日数）で補ってよい。これは設定済みの値であり推測ではない。Projectはすべて `projectName`（Nagoya Bites）。KRはラベルで表し、同ファイルの `krLabelRules`（category のキーワード規則・判定器 `scripts/lib/linear_project_map.js`）で付ける（オーナーに質問して作業を止めない・`docs/decisions/0003`）。AIエージェントの役割（Builder・Editor 等）は Linear の担当者ではなく `担当:<役割>` ラベルで表し、backlog の `owner` から同ファイルの `roleLabels` で付ける（オーナー本人の操作が要る課題は `担当:オーナー作業`・`docs/decisions/0005`）。質問できないCIでは不完全なIssueを作らず、課題IDを保留キューに残して不足項目をログへ出す。既存Issueを更新するだけの同期はこの新規作成ゲートの対象外。

## 自動で回す運用（指示を待たない・2026-10-06）

オーナーは「おはよう」「Linearにして」「分解して」「振り返って」「判断を残して」と毎回言わない。Claudeが自分で判断して、そのつど次を行う。根拠と既定値の経緯は `docs/decisions/0001-linear-autonomous-operation.md`、手本は `docs/linear-ai-native-playbook.md`。

1. **始業（ブリーフィング）**: セッション開始時に `.claude/settings.json` のフックが `scripts/session_briefing.js` を実行し、「【自動ブリーフィング】」として文脈に入る。最初の返答では次のように扱う。
   - 期限切れ・緊急未着手・GitHub警報Issueがあるときだけ、1〜2行で触れる。何も無ければ触れない。
   - ブリーフィングが出ていなければ自分で実行する。
   - ユーザーの依頼を差し置いて別の課題に着手しない。
2. **起票**: 作業中に、このセッションで終えない作業が生じたら backlog に起票し、`node scripts/sync_backlog_to_linear.js --apply` でLinearへ送る。対象は、見つけたバグ、後回しにした改善、オーナー本人の操作待ち、会話で「いずれやる」となったもの。
   - 7項目を満たして書く。背景は会話と調査の事実だけで書き、創作しない。
   - 既に同じ課題があれば新規に作らず、その課題に追記する。
3. **分解**: 30分を超えそうな作業は、着手前に親とsub-issue（各々に達成条件）へ分け、1つずつ進める。
4. **振り返り（区切り・終了時）**: 最終チェックと同時に次を行う。
   - 会話で決めたのに未実行のものを洗い出す。すぐできるものはやり、残りは2の手順で起票する。
   - HANDOFF とメモリを更新する。
   - 同じ手作業を3回目に行ったら、スクリプト化またはスキル化を backlog に起票する。
5. **判断記録**: 複数案から選び、その選択が今後を縛るとき（閾値・既定値・構成・運用ルール・やらないと決めたこと）は `docs/decisions/` に記録する。書式は同ディレクトリの README に従う。
6. **自動でやらないこと**:
   - 放置課題を勝手に Canceled にしない（「続けますか」と聞いて判断はオーナー）。
   - Project・KRを決めない。
   - マネタイズ・信頼系の着手（制約7・8）。
   - 取り消せない操作。

---

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| サービス名 | NAGOYA BITES |
| URL | https://nagoya-bites.com/ |
| 内容 | 名古屋の飲食店1100件以上を掲載する発見サイト |
| 構成 | `index.html` 一枚（Vanilla JS/CSS）+ `features/` 特集記事 |
| データ源 | Google Sheets → `build.js` → `index.html` 内 `var LOCAL_STORES = [...]` |
| デプロイ | `git push origin main` → GitHub Pages 自動公開 |

### 競争優位（全エージェントが共有する認識）

> 出典: `docs/competitive-analysis-2026-05-06.md`（2026-05-06 競合ベンチマーク）
> 消費者の選択経路を 6カテゴリで把握し、Moat / Strategic Skip を明示する。

```
【競合カテゴリ — 消費者の選択経路を網羅】
  A. 大手ポータル・予約サイト
     食べログ / ホットペッパー / Retty / ヒトサラ / 一休 / ぐるなび / OZmall / まとめ系
  B. マップ・OS 系
     Google Maps（最大の前提）/ Apple Maps / Yahoo!ロコ
  C. 名古屋・地域専門メディア
     ナゴレコ / WEB大人の名古屋 / 名古屋情報通 / 日刊KELLY / 個人インフルエンサー
  D. SNS（プル型・プッシュ型）
     Instagram / X / TikTok / YouTube — 発見導線の半分以上が SNS に移行
  E. 個人ブログ・note・Vlog
     はてな / WordPress / note / YouTube Vlog
  F. 生成 AI 引用
     Google AI Overviews / Perplexity / ChatGPT / Gemini / Claude

【我々の Moat — 競合 30+ サイトを観察した中で唯一無二】
  ・店ごとの根拠を残す構造化データ層（editorReason / mediaFeatures / insiderNote / visitStatus）
  ・編集独立性（広告ゼロ・PR 記事ゼロ）
  ・飲食業界の知識を踏まえた解釈層（店の選定は AI による情報収集・分析を活用。編集部は匿名）
  ・構造化 DB 4,584店 × 特集 20本 × 日次ジャーナルの三層編集
  ・editorial-policy.html による編集規約の透明公開

【我々が勝つ領域】
  ・「名古屋 × シーン × 業界知識を踏まえた解釈」の組み合わせ
  ・宴会・接待・デートなどシーン別の専門性
  ・飲食店側の事情（席数設計・仕入れ・営業形態など）を踏まえた、根拠つきの推薦
  ・大手ポータルが書けない独自 KW（「業界人 推薦」「予約困難 理由」等＝検索で狙う語。
    店を選んだ・書いた主体の説明には使わない。下の【表現の決まり】）

【表現の決まり — 店の選び方・書き手を書くとき（オーナー指示 2026-10-11・計画 4.4 節 #11）】
  ・オーナーの指示:「店舗の選定にはAIによる情報収集・分析を活用しています。人間の飲食業界関係者が
    すべての店舗を選定しているような表現は使用しないでください。」
  ・「業界人」「現役の店長」「現役の飲食店マネージャー」「現役飲食人」「目利き」などの語を、店を選んだ・
    書いた主体を示す意味で、サイト・記事・特集・SNS 原稿・構造化データに書かない（語の一覧と検査は
    data/selection_wording_policy.json）。選び方は「基準（条件）」で書く
  ・「業界人 推薦」などを検索で狙う語として残すかは別の決定（P-237 #2）。決まるまで、新しい紹介文には足さない

【戦わない領域 — Strategic Skip（追わない判断）】
  ・匿名口コミの大量集積（食べログ型）— 編集独立性と矛盾
  ・クーポン・予約特典経済（ホットペッパー型）— 広告主依存に陥る
  ・高級セグメント特化（一休型）— 全体発見サイトの立ち位置と矛盾
  ・女性向け装飾演出（OZmall 型）— ターゲットを狭めすぎる
  ・雑誌印刷連動（大人の名古屋型）— 鮮度と印刷コストのトレードオフ
  ・月刊スピード — 我々はジャーナル日次でむしろ勝つ
```

---

## 絶対に守る制約（エージェント全員共通）

```
1. index.html は単一ファイルで維持する（サイト用の新ファイル追加禁止 ※例外: features/配下の特集記事・
   journal/配下の日次記事・stores/配下の店舗ページ（gen-store-pages.js が生成）・
   stores/area/配下のエリア×ジャンル×条件一覧ページ（SEO-094・scripts/gen_area_genre_pages.js が
   data/area_genre_pages_policy.json を正本に data/stores.json から決定的に生成する。手書き禁止・
   閾値/マッピング変更はポリシーJSONのみで行う）、サイト直下の 404.html（I-33・
   scripts/gen_404_page.js が生成する 1 ファイル。noindex）、および共有スタイルシート assets/css/nb.css の
   1ファイルのみ。これ以外の .css/.js 分離は引き続き禁止）
2. var LOCAL_STORES = [...]; のパターンを壊さない
3. テキストはすべて日本語
4. サイト用の新npm依存関係を追加しない（CDNリンクはOK）
5. フィルター・検索・モーダル・IGエンベッド・Google評価表示を壊さない
6. QAゲートを通過するまでデプロイしない
7. ユーザーの信頼を毀損する施策は実装しない
8. マネタイズ施策はユーザーの承認を得てから実装する
9. 写真は「実写優先」。汎用ストック写真（Unsplash / Pexels / loremflickr / Pixabay 等）の新規使用は原則禁止
   ※既存の使用箇所は段階的に置き換える。新たに画像を差し込む全ての場面（特集 / 日次ジャーナル
     / トップカード / OG画像 / SNS原稿用 / 店舗詳細 等）で本ルールが適用される
10. 品質ゲート・スコア・監査の類は「検証できる事実」だけで判定する。
    エージェントが自由に書ける自己申告値を合否の分かれ目にしない（下記）
11. 自動処理の失敗は「検知して終わり」にしない。警報は必ず、壊れた当人とは別の場所へ届ける（下記）
12. 全ページはデザインシステムを通す（DSN-001・2026-09）。正本は `data/design_system.json` →
    `assets/css/nb.css` → `docs/design-system.md`。新規ページ・新規ページ種別・新規UI部品・
    テンプレート変更（gen-store-pages.js / journal/_template.html / scripts/gen_industry_features.js）
    は Designer（agents/designer.md）のレビューと `node scripts/audit_design_system.js --check`
    の通過が公開条件。可視テキストの font-size 12px 未満は禁止、ユーザーが読むテキストは
    13px 以上。`:root` の再定義と font-size リテラルの新規追加（トークン `var(--fs-*)` を使わない
    直書き）は禁止。Web フォント（Google Fonts など）は読み込まない。書体は端末にあるものだけを、
    トークン（`var(--font-display)`・`var(--font-body)`・`var(--font-mono)`）で指し、書体名を
    直書きしない（P-318・`docs/decisions/0026-device-fonts-no-webfonts.md`）
```

### 無人自動化の監視を設計するときの原則（ISSUE-084 の教訓・全エージェント共通）

> 2026-08 に、日次ジャーナルが3日連続で止まっていたのにオーナーがサイトを見るまで
> 誰も気づかなかった。検知は完璧に動いていた——HOLD メモを書き、翌朝も警告していた。
> ただしその出力先は全部 `.local-logs/`＝`.gitignore` 対象で、**Mac から一歩も出なかった**。
> **警報は鳴っていたが、防音室の中で鳴っていた。** 同じ発覚遅れは3回連続で起きている。

```
1. 監視は「監視される対象」と別の場所で動かす
   ローカル実行の監視をローカルに置くと、ローカルごと死んだとき監視も死ぬ。
   例: launchd の生成を GitHub Actions が監視する（Mac がスリープでも発火する）
2. 通知は out-of-band（当人の外）に出す
   ログファイル・gitignore 配下・同じ画面の中で完結させない。
   届いた実績のある経路を使う（本プロジェクトでは GitHub Issue → メール）
3. 「気づけるはず」を検知と数えない
   人が能動的に見に行かないと分からないものは、検知ではなく記録。
   検知とは、人が何もしなくても届くことを指す
4. 復旧に人手が要る失敗（認証切れ等）ほど、通知が唯一の復旧経路になる
   コードで直せない失敗こそ、真っ先に人へ届ける設計にする
5. 通知は原因つきで出す（何が壊れたかまで運べば、人はログを読みに行かなくて済む）
6. 復旧したら自動で静かにする（オオカミ少年化させない。鳴りっぱなしは無視される）
```

### 品質ゲートを設計するときの原則（ISSUE-077 の教訓・全エージェント共通）

> 2026-07 に、日次ジャーナルの 95点ゲートが「正直に申告すると上限94点で1点届かず、
> **出典のない数字（buzz_score）を大きく書くと通る**」構造になっていたことが判明した。
> 過去にゲートを超えた候補は全てその数字を積んでおり、正直に申告した日だけが未達だった。
> ゲート自体が、盛る動機を生む装置になっていた。

```
1. 合否を分ける入力は「後から第三者が確認できるもの」に限る
   良い例: ソースのURL・日付・独立ドメイン数・一次情報源の有無・DBに実在するか
   悪い例: 「話題度90」「言及50件」など、出典もなく誰も検算できない自己申告値
2. 「主張させる」のではなく「証跡を出させる」
   （例: 話題だと書かせるのではなく、話題の言及URLを sources に入れさせる）
3. ゲートは、正直な最良の成果物が余裕を持って通る位置に置く
   正直な上限がゲートを下回っていると、盛るか止まるかの二択になる
4. 満点でない日の逃げ道を必ず用意する（段階ゲート）
   「捏造」か「その日の成果ゼロ」かの二択を、自動化されたエージェントに迫らない
5. 閾値をいじる前に、代表ケースで分布を実測する
   数字を動かして全部通るようにするのは、ゲートを壊すのと同じ
6. ヘッドレス実行のワークフローで、エージェントに人間の承認を求めさせない
   応答できる人がいないため、質問＝その日の成果物が失われることを意味する
```

### 写真ソースの優先順（全エージェント共通・全領域適用）

```
優先1: 店舗公式 Instagram の embed（embed.js 経由・規約上明示的に許可）
優先2: HotPepper 公式写真（LOCAL_STORES の 写真URL）
優先3: プレスリリースの報道用写真（PR TIMES 等・報道目的の無償利用が規約で明示許諾）
       根拠: PR TIMES 企業規約 第6条3項「ご利用企業は、パートナーメディアと報道関係者に対し、
       報道目的で利用する限り、企業コンテンツを無償で非独占的に利用することを許諾する
       （パートナーメディア以外において有償目的で利用する行為を除く）」。
       当サイトは広告ゼロ・PR記事ゼロのため「有償目的」に当たらない。
       新店・新メニューはほぼ必ずリリースが出るため、**開店直後で実写が存在しない店**
       （HotPepper に写真が無く Places にも口コミ写真しか無い）を救える唯一の合法経路。
       条件（1つでも欠けたら使わない）:
         a. その記事が扱う店・企業のリリースであること
         b. 記事の sources[] にそのリリースURLを入れる（＝報道目的である証跡。ゲートが照合）
         c. クレジットに発行企業名とリリースURLを明記する
         d. 加工しない・self-host しない（参照に留める＝複製保存を避ける）
            ※ note の見出し画像だけは、記事に載せたリリース写真を加工せずに note へ上げる（クレジットは本文・
              ホットペッパー/Places の写真は規約で上げられない・docs/decisions/0056）
         e. CGパースは実写として扱わない（使うならキャプションに「イメージパース」と明記）
       取得: `node scripts/fetch_press_release_photo.js <リリースURL>`
       ⚠️ 規約を確認していない配信元（digitalpr.jp 等）の画像を「報道だから使える」と
          推定して使わないこと。対応配信元は fetch_press_release_photo.js の SUPPORTED が正本。
優先4: Google Maps Places API 写真（GOOGLE_MAPS_API_KEY 設定時）
       書いた後に取り直さない面（ジャーナル・特集・sitemap-images.xml）では使わない（URL が失効するため・P-29・docs/decisions/0045）。
       ⚠️ 日次ジャーナルは launchd のローカル実行で生成されるため、GitHub Secrets の
          キーは届かない。`~/.config/nagoya-bites/journal.env` に置く（docs/journal-photo-sources-setup.md）。
          2026-08-17 まで未配線で、この優先順は**一度も発火したことがなかった**（ISSUE-091）。
優先5: 店舗オーナーから許諾を得た独自URL / 編集部の取材写真
─────────────────────────────────────────
最終手段: 「記事固有のイメージ図」
  実写がどうしても手配できない場合のみ、その記事専用に作成した
  オリジナルの図解 / イラスト / インフォグラフィック / 構造図 / SVG 等は許容。
  条件:
    - リポジトリ内（/assets/journal-figures/ または記事HTML内インラインSVG）に self-host
    - 汎用ストックの寄せ集めではなく、その記事のテーマを「説明する図」であること
    - 第三者の権利を侵害しない（Unsplash等の写真をベースに加工したものは不可）

記事の「顔」になる写真の絶対条件（ISSUE-090 の教訓・2026-08-17）:

> 記事の主役2店がどちらも新店で写真を持たなかった日に、記事へ一行触れただけの別店の
> 販促バナー（「ドリンク全品94円」の文字が全面）が記事のヒーロー写真になって公開された。
> validator は「汎用ストック写真でないこと」は検証していたが、**「その記事の店の写真で
> あること」は誰も検証していなかった**。ストック禁止だけを課したことが、
> 「実写でありさえすれば何でもいい」＝他店の写真を借りる動機を生んでいた。

```
1. ヒーロー写真は、その記事が主役として扱う店に帰属していなければならない
   記事に一行触れただけの店の写真を「顔」にしない。読者から見て記事と写真の対応が壊れる
2. 主役店の実写が手配できないときの正解は「他店の写真を借りる」ではない
   → 優先1〜4 を尽くしてなお無理なら、その記事専用のイメージ図に倒す（最終手段・下記）
   → 取り繕わない。無関係な実写より、記事を説明する図の方が読者に対して誠実
3. 文字が主役の販促バナー（「◯◯円」「グランドオープン」等の大きな文字入り画像）は顔にしない
   実写ではあるが、料理でも店でもなく広告。消費者の目を引くのは料理と空間であって値札ではない
   ※ 画素解析でバナーを自動判別することは試みて断念した（2026-08-17 に46枚で実測。
     料理写真の方がバナーより高い値を出す例が複数あり分離不能）。分離できない指標を
     合否ゲートにするのは制約10 違反なので、機械判定ではなく人の目と候補の多重化で担保する
4. 同じ画像を複数の記事の顔に使い回さない（過去180日・data/journal_photo_policy.json）
5. 出所を書けない写真は載せない
   「出所不明（要確認）」と書いて公開するのは禁止。出典を確定させるか、図に倒す
6. 帰属の証跡は成果物自身に刻む
   figure タグに data-hero-source / data-hero-store を付ける。Places CDN の URL からは
   店名を逆引きできないため、証跡が無いと第三者が後から検算できない（品質ゲート原則2）

判定器は scripts/lib/hero_photo_gate.js の1本。生成時（generate_daily_draft.js）・
公開前QA（validate_journal_draft.js 項目15b）・日次CI監査（audit_journal_photos.js）が
同じ判定を共有する。基準の変更は data/journal_photo_policy.json で行いスクリプトは触らない。
確認は `node scripts/audit_journal_photos.js`（Editor/Builder 共管）
```

記事の写真は1枚で終わらせない（本文にも散らす・2026-09-20）:

> ジャーナルの写真はヒーロー1枚だけで、本文は最後まで文字が続いていた。読者の目が休まらず、
> 店の様子も1枚でしか伝わらない。本文の途中にも写真を挿す。

```
1. 増やすのは「枚数」であって「基準」ではない
   本文写真もヒーローと同じ帰属の判定（scripts/lib/hero_photo_gate.js の judgePhoto）を通す。
   その記事が扱う店の写真であること・出所を書けない写真は載せないこと、はどちらも変わらない
2. 候補が足りない日は増やさない（取り繕わない）
   枚数は合否ゲートにしない。枚数で落とすと「他店の写真を借りる」「図で水増しする」動機が生まれる
   （CLAUDE.md 品質ゲート原則1・4）。validator は警告でしか言わない
3. 写真を取りに行けなかったことを「候補なし」と同じ顔にしない
   Places のクォータ切れ・認証エラーは理由つきで出す（写真が無い店と区別できないと後から分からない）
4. 目安は data/journal_photo_policy.json の bodyPhotos（targetTotal=3）。閾値変更はJSONで行う
5. 中身（販促バナー・ロゴ画像でないか）は機械で判定しない。目で見て差し替える（判定器を賢くしない）
```

品質ゲート（新規店・既存店を問わず、写真がサイトに入る全経路に適用）:
  基準の正本は `data/photo_policy.json`、判定器は `scripts/lib/photo_policy.js` の1本。
  - 優先3（Places）の写真は「クレジット名＝店名」＝オーナーがビジネスプロフィールから
    上げた宣材だけを採用する。個人名クレジット（＝客が上げたスマホ写真）は載せない。
    photos[0] だけを見ると客の写真になる店が半分あるため、上位N枚を走査して
    最初に基準を通った1枚を採り、全部落ちたら「写真なし」に落とす（取り繕わない）。
  - 検知は CI（build.yml）の `node scripts/audit_photo_policy.js --check` で毎日回る。

プレスリリース写真も「販促バナー率」が高いので必ず中身を見る（2026-08-17 実測）:
  ゆず庵 名古屋山王店のリリースは画像4枚中**3枚が販促バナー**（10%割引クーポン / アプリ広告 /
  文字入り外観）で、使えるのは料理写真1枚だけだった。解像度順に機械で選ぶと当たることもあるが、
  保証はない（より大きいバナーが入っていれば1位になる）。**必ず Editor が目で1枚選ぶこと。**

禁止事項:
  - AI超解像・生成AIによる解像度の水増し（2026-08-16 決定）
    理由1: リクルートWEBサービス利用規約が「編集、加工、翻案その他の変更」「複製保存」
           「再配信」を禁じており、HotPepper 写真の加工・自ホストは規約違反にあたる
    理由2: AI超解像は実在しないディテールを生成する。実在保証を Moat とするサイトで
           「無いものを作って載せる」のは 2026-05 の架空店事故と同じ失敗クラス
    → 解像度が足りないときは「画素を発明する」のではなく「出典を替える」（優先1〜4）か、
      引き伸ばさない見せ方にする。粗いまま伸ばすのも、水増しするのも、どちらも選ばない
  - 他メディア（dressing / macaroni / retrip / 食べログ / ヒトサラ等）の記事内写真の転用
  - 店舗公式サイトの写真の無許諾転載
  - Instagram のスクリーンショット・画像ダウンロード（embed.js 経由のみ可）
  - 汎用ストック写真の新規追加（規約違反でなくても、編集独立性・信頼担保のため避ける）

例外: 規約違反になる選択肢しか残らない場合は実装前に Orchestrator/ユーザーへ相談する。
```

---

## エージェント構成と役職（8名体制）

```
Orchestrator（CEO）← agents/orchestrator.md
│  ビジョン設定・資源配分・KPI管理・QAゲート・最終意思決定
│
├── 技術部門（プロダクト品質）
│   ├── Inspector           ← agents/inspector.md
│   │   └── サイト全方位監査・競合ベンチマーク・CVR分析
│   │
│   ├── Builder             ← agents/builder.md
│   │   └── 実装・UX最適化・成長ドリブン開発
│   │
│   ├── Designer            ← agents/designer.md
│   │   └── 可読性・タイポグラフィ・デザインシステムの最終責任者（DSN-001で新設）
│   │
│   └── DataKeeper          ← agents/data-keeper.md
│       └── データパイプライン・データ拡充戦略
│
├── 事業部門（成長・収益）
│   ├── Marketer            ← agents/marketer.md
│   │   └── SEO・SNS・トラフィック獲得・コンテンツ配信
│   │
│   └── Strategist          ← agents/strategist.md
│       └── ブランド戦略・マネタイズ・KPI設計・パートナーシップ
│
└── 編集部門（独自価値の創出）
    └── Editor              ← agents/editor.md
        └── 特集記事・季節コンテンツ・レビュワー獲得・コミュニティ
```

### 優先度基準（全エージェント共通）

| 優先度 | 内容 | 対応 |
|--------|------|------|
| P0 | バグ・クラッシュ・データ消失・ブランド毀損 | 即時修正 |
| P1 | UX劣化・CVR低下・SEO順位下落・競合に明確に負けている領域 | 次の実装サイクルで必ず修正 |
| P2 | SEO改善・パフォーマンス・A11y・コンテンツ拡充 | 計画的に改善 |
| P3 | デザイン磨き・文言調整・nice-to-have | 時間があれば |

---

## 共有ファイル一覧

**役割の説明は `docs/shared-files-registry.md` が正本**（2026-10-19 に移設。行の内容は原文のまま）。ファイルの役割・使い方・既存の仕組みの有無を知りたいときは、推測せず、**registry を Grep/Read してから**作る・直す・答える（同じ働きのスクリプトを重複して作らないため）。新しい共有ファイルを追加したら registry の表に行を追記し、下の索引にはファイル名だけ足す。

| ファイル | 役割 |
|---------|------|
| `CLAUDE.md` | この憲法（全エージェントが参照） |
| `agent-backlog.md` | 課題トラッキング・実行ログ（全エージェントが読み書き） |
| `agents/orchestrator.md` | CEO の行動フロー・QAゲート定義 |
| `agents/inspector.md` | Inspector のチェックリスト |
| `agents/builder.md` | Builder の実装ルール |
| `agents/designer.md` | Designer の役割・QA-5チェックリスト・新規ページの作り方（DSN-001） |
| `agents/data-keeper.md` | DataKeeper の実行手順 |
| `agents/marketer.md` | Marketer のマーケティング戦略 |
| `agents/strategist.md` | Strategist の事業戦略 |
| `agents/editor.md` | Editor の編集方針・コンテンツ基準 |
| `data/design_system.json` | **デザインシステムの判定基準の正本**（Web フォントを使わない方針 `webFonts`＝禁止する配信元と退役した書体名・font-size床12px・許可フォントウェイト・共通トークン一覧・legacyRewrites）。閾値変更はここで行いスクリプトは触らない |

### 索引（上記以外の共有ファイル。役割は registry）

`assets/css/nb.css` ・ `docs/design-system.md` ・ `scripts/audit_design_system.js` ・ `scripts/lib/motion_audit.js` ・ `scripts/lib/web_fonts.js` ・ `scripts/audit_inline_js_syntax.js` ・ `scripts/apply_ga_snippet.js` ・ `scripts/apply_design_system.js` ・ `scripts/lib/site_chrome.js` ・ `data/area_genre_pages_policy.json` ・ `data/area_genre_pages_manifest.json` ・ `scripts/lib/area_genre_pages.js` ・ `scripts/gen_area_genre_pages.js` ・ `scripts/apply_site_chrome.js` ・ `404.html` / `scripts/gen_404_page.js` ・ `scripts/apply_feature_byline.js` ・ `scripts/sync_feature_counts.js` ・ `scripts/measure_typography.js` ・ `scripts/audit_selection_wording.js` / `data/selection_wording_policy.json` ・ `scripts/audit_image_sources.js` / `data/image_source_policy.json` ・ `scripts/audit_page_weight.js` / `data/page_weight_policy.json` ・ `scripts/lib/published_pages.js` ・ `scripts/audit_heading_levels.js` / `scripts/lib/heading_levels.js` ・ `scripts/lib/related_label.js` ・ `scripts/lib/related_stores.js` ・ `scripts/lib/store_listings.js` ・ `scripts/lib/store_count.js` / `scripts/sync_store_count.js` ・ `scripts/lib/phone_link.js` / `scripts/audit_phone_links.js` / `scripts/lib/call_button_snippet.js` ・ `scripts/lib/store_facts.js` ・ `scripts/lib/photo_credit.js` ・ `scripts/lib/journal_git_sync.sh` ・ `docs/qa/uiux-2026-10/` ・ `scripts/ga4_baseline.js` ・ `scripts/ga4_fragment_counts.js` ・ `docs/qa/uiux-2026-10/perf.js`・`perf_summary.js` ・ `index.html` ・ `features/` ・ `journal/` ・ `docs/daily-posts/` ・ `.claude/commands/journal-today.md` ・ `data/journal_gate_policy.json` ・ `data/journal_source_diversity_policy.json` ・ `data/journal_sns_draft_policy.json` ・ `data/journal_seo_keywords.json` ・ `scripts/journal_seo_kw.js` ・ `scripts/lib/journal_topics.js` ・ `data/journal_title_experiment.json` ・ `scripts/journal_title_experiment.js` ・ `scripts/register_journal_entry.js` ・ `scripts/check_journal_health.js` ・ `.github/workflows/journal-watchdog.yml` ・ `data/journal_health.json` ・ `build.js` ・ `scripts/lib/spreadsheet_address_gate.js` ・ `data/photo_policy.json` ・ `data/journal_photo_policy.json` ・ `scripts/lib/reservation_exits.js` ・ `scripts/lib/store_actions.js` / `scripts/check_metrics_freshness.js` ・ `scripts/audit_journal_photos.js` ・ `scripts/lib/journal_photos.js` ・ `scripts/add_journal_body_photos.js` ・ `scripts/fetch_press_release_photo.js` ・ `docs/journal-photo-sources-setup.md` ・ `scripts/lib/og_figure_png.js` ・ `scripts/render_og_figures.js` ・ `scripts/normalize_og_images.js` ・ `data/manual_stores.json` ・ `scripts/lib/store_link_identity.js` ・ `scripts/audit_store_link_identity.js` ・ `.github/workflows/link-audit-watchdog.yml` ・ `scripts/clear_broken_tabelog_links.js` ・ `scripts/audit_tabelog_branch_mismatch.js` ・ `data/store_liveness_reviews.json` ・ `scripts/refresh_place_status.js` / `data/place_status_policy.json` ・ `scripts/clear_wrong_ig_accounts.js` / `data/ig_account_reviewed.json` ・ `scripts/audit_page_store_links.js` ・ `scripts/audit_places_binding.js` / `data/places_binding_reviewed.json` ・ `scripts/lib/place_binding.js` / `data/place_binding_policy.json` ・ `scripts/lib/map_link.js` ・ `scripts/audit_stub_links.js` ・ `scripts/audit_internal_links.js` ・ `scripts/lib/hotpepper_fetch.js` ・ `data/trust_display_policy.json` ・ `scripts/lib/trust_display.js` ・ `scripts/audit_trust_wording.js` ・ `data/ig_post_policy.json` ・ `scripts/select_ig_posts.js` ・ `data/ig_post_evidence.json` ・ `data/trending_stores.json` ・ `scripts/pick_daily_trending5.js` ・ `data/daily_trending5.json` ・ `data/trending_url_history.json` ・ `scripts/fetch_trending_articles.js` ・ `scripts/lib/trending_queries.js` ・ `data/trending_scout_policy.json` ・ `scripts/trending_scout.js` ・ `data/trending_scout_health.json` ・ `.github/workflows/trending-scout-watchdog.yml` ・ `.github/workflows/routine-pr-automerge.yml` ・ `docs/trending-scout-runbook.md` ・ `data/featured.json` ・ `data/feature_rosters.json` ・ `data/feature_conclusions.json` ・ `scripts/apply_feature_conclusions.js` ・ `scripts/lib/feature_tracking.js` ・ `scripts/lib/journal_store_link_tracking.js` ・ `data/feature_roster_health.json` ・ `scripts/check_feature_roster_health.js` ・ `.github/workflows/feature-roster-watchdog.yml` ・ `scripts/session_briefing.js` ・ `.github/workflows/linear-watchdog.yml` ・ `scripts/assign_linear_projects.js` ・ `docs/decisions/` ・ `data/solve_next_policy.json` ・ `scripts/next_task.js` ・ `.claude/commands/seo-triage.md` ・ `.claude/commands/seo-triage-weekly.md` ・ `docs/feedback-triage-runbook.md` ・ `data/seo_advice_log.json` ・ `data/gsc_metrics.json` ・ `scripts/probe_index_status.js` ・ `data/gsc_opportunities.json` ・ `scripts/gsc_query_intent.js` ・ `docs/seo-strategy-2026-10.md` ・ `data/search_channel_metrics.json` ・ `scripts/lib/traffic_source.js` ・ `docs/ga4-internal-traffic-verification.md` ・ `scripts/post_journal_to_x.js` / `scripts/lib/x_post.js` / `data/x_post_policy.json` / `scripts/x_post_wait.js` ・ `scripts/check_note_post_health.js` / `data/note_post_health.json` / `.github/workflows/note-post-watchdog.yml` ・ `scripts/indexnow_ping.js` ・ `data/gas_deploy_policy.json` ・ `scripts/check_gas_deploy_health.js` ・ `.github/workflows/gas-deploy-watchdog.yml` ・ `data/feedback_policy.json` ・ `data/feedback_log.json` ・ `scripts/feedback_triage.js` ・ `data/feedback_health.json` ・ `.github/workflows/feedback-watchdog.yml`

---

## SEOアドバイス改善ループ（`/seo-triage` 日次 / `/seo-triage-weekly` 週次）

SEO/アクセス解析のアドバイスを、**鵜呑みにせず**ブランドの総合フィルターに
通して改善に回す仕組み。日次・週次の**2系統が同じスクリプト・同じLinear同期**を共有する。

### 全自動の運用モデル（人の貼り付け不要）

> 2026-06-01 から **完全自動**（ユーザーが「確認なしで即追記」を承認）。入力取得は
> GAS のメール送信、判定は Claude（このCLAUDE.md が唯一の根拠）、課題はLinearへ登録。
> **判定ロジックは GAS に持たせない**（GAS は配信だけ・Linear認証情報も持たせない）。
> 日次レポートの原理と週次は**完全に同一**。

```
[配信] GAS（正本 `.gas-deploy/Code.js`）が日次/週次レポートを Gmail 送信
        ・日次 件名「📊 NAGOYA BITES 日次レポート <日付>」
        ・週次 件名「📊 NAGOYA BITES 週次レポート <期間>」
        ※ GASは単一ファイル Code.js で運用。重複ファイル（"Code 2.js"等）混入は
          top-level二重宣言でコンパイル全体が落ちる → レポート不送信になるので厳禁。
   ↓
[起動] スケジュール済み Claude ルーティン（毎日 21:01・タスクID nagoya-bites-seo-triage-daily）
        Gmail MCP でレポートメールを取得し /seo-triage と /seo-triage-weekly を引数なし実行
        （各コマンドの Step 0 が自動取得を担う。週次メールが未着の日は週次をスキップ）
   ↓
[判定] CLAUDE.md の Moat / Strategic Skip を根拠に採用/却下（次節）
   ↓
[同期] 採用分を agent-backlog.md に起票し、Orca CLI経由でLinearへcreate/update（人の確認を挟まず登録）
```

手動でも全く同じ: LINE 本文を `/seo-triage`（💡今日のアドバイス・source=line-daily）/
`/seo-triage-weekly`（🤖AI週次分析＋💡今週のアドバイス・source=line-weekly）に貼り付ければよい。
取得元が「人の貼り付け」か「Gmail自動取得」かだけの違いで、判定・起票・同期は同一。

### 判定と記録

```
2. CLAUDE.md の Moat / Strategic Skip を根拠にエージェントが採用/却下を判定
   ・採用 → agent-backlog.md に [SEO-NNN] を status: ready で起票（owner=Marketer / category=SEO）
   ・却下 → data/seo_advice_log.json に理由付きで記録（backlog/Linearには出さない）
   ・重複 → 過去判定済みは再起票しない（日次/週次を横断して衝突検知。数値違いは正規化で同種扱い）
           → 同じメールを再処理しても二重起票しない（冪等。スケジュール多重起動も安全）
3. 採用分はLinearへ自動同期（backlogの詳細を保ちつつ、進捗はLinearで確認する）
4. 実装は /solve-next の YES ゲート経由（マネタイズ・信頼系は制約7・8でさらに承認必須）
   → このループが作るのは status:ready まで。コード実装・デプロイは別ゲート。
5. ループ健診: node scripts/seo_triage.js --report --days 30           （全体）
              node scripts/seo_triage.js --report --days 90 --source line-weekly （週次のみ）
```

**週次の肝**: 週次は「🤖 AI週次分析（前週比）」の総括も施策化対象。前週比で続く悪化/改善は
単日のブレではなく**週トレンド**なので、落ちトレンドは原因調査を優先度高め（P1〜P2）に寄せる。

却下は必ず理由を残す（後の監査・再評価のため）。「全部間に受けない」がこのループの根幹。

---

## GSC 検索実データ改善ループ（Google の生データを起点にした改善・ISSUE-072）

上の「SEOアドバイス改善ループ」が**外部からのアドバイス**を triage するのに対し、こちらは
**Google Search Console の自社の実測データ**（クエリ別・ページ別の 表示回数 / クリック / CTR / 掲載順位）を
起点に「今どこを直せば一番効くか」を機械的に洗い出し、同じ Moat フィルタで施策化するループ。
GSC 開通（ISSUE-068①）で初めて回せるようになった。

### 全自動の配信レイヤー（人の集計不要）

```
[取得] build.yml が日次で scripts/fetch_gsc_metrics.js を実行 → data/gsc_metrics.json
   ↓
[抽出] 同ジョブが scripts/gsc_opportunities.js を実行 → data/gsc_opportunities.json
        ・ctr_fix   … 1ページ目(pos≤10)なのに期待CTRを大きく下回るページ/クエリ
                      → タイトル/メタ改善で拾える（低リスク・速効）
        ・rank_push … 2〜3ページ目(pos 11〜30)で高表示のページ/クエリ
                      → 順位を上げれば大きく伸びる（内容拡充・内部リンク）
        ・優先度 = 取りこぼしクリック推定 =（期待CTR − 実CTR）× 表示回数
   ↓
[判定] エージェントが CLAUDE.md の Moat / Strategic Skip を根拠に採否を triage
        ・採用 → agent-backlog.md に起票（owner=Marketer/Builder・category=SEO）
        ・却下 → data/seo_advice_log.json に理由付きで記録（例: 純ナビゲーショナルな
                他店名クエリは Strategic Skip＝公式サイトに譲る）
   ↓
[実装] /solve-next の YES ゲート経由。効果は翌週以降の GSC の CTR/順位の前後比で測る
        （このループ自身が効果測定器になる）
```

### 原則（既存ループと同じ思想）

- **鵜呑みにしない**: 数値が示すのは「症状」。打ち手が Moat を強めるか（根拠つきの解釈・実在保証・
  シーン専門性）で採否を判断する。ナビゲーショナルな他店名の1位争いは追わない（Strategic Skip）。
- **低リスクから**: まず ctr_fix（タイトル/メタ）で拾えるものを優先。順位改善は計画的に。
- **効果は数字で閉じる**: 施策 → 翌週 GSC で CTR/順位を確認、のループを回す。
  体感ではなく `gsc_metrics.json` の前後比で判断する。

### 健診コマンド

```
node scripts/gsc_opportunities.js   # data/gsc_opportunities.json を再生成（CI が日次実行）
```

---

## 消費者フィードバック改善ループ（サイト利用者の声を起点にした改善）

上の2つのループが SEO 助言・自社検索実測データを起点にするのに対し、こちらは**サイト利用者本人の
生の声**（「ここが使いづらい」「情報が違う」等）を起点に、同じ Moat フィルタで施策化するループ。

### 全自動の配信レイヤー

```
[収集] index.html のフローティング「ご意見」ボタン → ミニフォーム
        → Formspree（既存 https://formspree.io/f/xaqaygze、_subject: '[site-feedback] <種類>'）
   ↓ Formspree 通知メールが Gmail（wakato1251999@gmail.com）に届く
[起動] スケジュール済み Claude ルーチンが docs/feedback-triage-runbook.md の手順を引数なしで実行
        （Step 0 が Gmail MCP でメールを取得。新着0件の日は正常終了）
        ※ Gmail 検索は実在するメールに 0件を返すことがある（2026-08-17 実測・ISSUE-089）。
          0件は「primary → sweep(in:anywhere) → 時間差リトライ」を消化して初めて確定させる。
          窓は広く取り、再取得は msg_id 台帳との突合で無害化する（＝取りこぼしを翌日以降に自動回収）
   ↓
[生存] 実行のたびに（新着0件の日も）data/feedback_health.json に心拍を書いてコミット
        → feedback-watchdog.yml がサーバ側で鮮度を監視し、滞れば Issue 起票＝オーナーにメール
   ↓
[判定] CLAUDE.md の Moat / Strategic Skip / 制約7・8・10 + data/feedback_policy.json を根拠に3分類
        ・UX/機能改善 → 採用なら agent-backlog.md に [FB-NNN] ready（owner=Builder）
        ・店舗情報の誤り指摘 → fact_check として [FB-NNN] ready（owner=DataKeeper）。
          **この場ではデータを直接修正しない**。acceptance に実在検証ゲート
          （一次情報での確認 → 検証成立時のみ反映 → audit_store_liveness 等の監査通過）を必須で書く
        ・スパム/誹謗/個人情報 → data/feedback_log.json に理由付きで記録のみ（起票しない）
   ↓
[同期] 採用・fact_check 分をLinearへ自動同期
   ↓
[実装] /solve-next の YES ゲート経由（マネタイズ・信頼系は制約7・8でさらに承認必須）
```

### 原則

- **鵜呑みにしない**: SEOアドバイスループと同じく、Moat / Strategic Skip を根拠に採否を判断する。
  「一利用者の好み」と「構造的な使いづらさ」を区別し、疑わしきは要検討メモ付きで採用に寄せる
  （消費者の声は外部アドバイスより一次情報に近いため）。
- **店舗事実は自動反映しない**: 閉店・電話番号等の指摘は`data/dispute_requests.json` の運用
  （必ず編集部モデレーション経由）と同じ思想で、実在検証ゲートを通ったものだけデータに反映する。
  虚偽の通報（例: 競合による妨害）で信頼を毀損しないための防波堤。
- **個人情報を残さない**: ウィジェットにメール欄を置かない（匿名前提）＋ ログ追記時にメールアドレスを
  機械的にマスクする二重防壁。フィードバック本文はサイト上に一切表示しない。
- **判定ロジックはウィジェット側に持たせない**（配信だけ）。判定は Claude ルーチンが
  `docs/feedback-triage-runbook.md` を根拠に行う。

### 健診コマンド

```
node scripts/feedback_triage.js --report --days 30   # ループの中身（採用/却下/滞留）
node scripts/check_feedback_health.js                # ループが動いているか（生存確認・CI と共有）
```

---

## 話題店発掘ループ（「今日の話題店」の材料を枯らさない・2026-09-11新設）

`scripts/pick_daily_trending5.js` によるTOP5の**選定ロジック**は毎朝正しく動いていても、
その**材料**である `data/trending_stores.json` に新規の話題店が供給され続けなければ、
候補プールが静的な母集団になり「日替わりで店名は変わるが同じような顔ぶれ」に戻る。
2026-09-11、オーナーからの報告でこれが実際に発生していたと判明した（4月から新規0件・
編集部推薦167店中121店が8月21日の一括登録から更新なし）。原因は「新規話題店を発掘して
取り込む半自動パイプライン（`scripts/fetch_trending_articles.js`）が誰にも定期的に
回されていなかった」こと。このループはその供給を構造的に保証する。

```
[実行] スケジュール済み Claude ルーチンが docs/trending-scout-runbook.md の手順を実行
        （WebSearchで新規候補を探す → WebFetchで裏取り → ingest-jsonで取り込み）
   ↓
[段階ゲート] LOCAL_STORES に実在する店だけ自動反映対象（_auto:true・話題フラグ=false）。
        検出から3日以上＋出典URL2件以上貯まったものだけ auto-promote で話題フラグ=true化。
        LOCAL_STORES に無い店は candidates[] に留め置くだけで自動追加しない
        （実在検証を経ずに manual_stores.json へは入れない・架空店ブロックと同じ規律）
   ↓
[生存] 実行のたびに（新規0件の日も）data/trending_scout_health.json に心拍を書いてコミット
        → trending-scout-watchdog.yml がサーバ側で鮮度を監視し、滞れば Issue 起票＝オーナーにメール
   ↓
[消費] 翌朝5:30 JST の daily-trending5.yml（pick_daily_trending5.js）が、太った
        trending_stores.json を材料にTOP5を選ぶ。このループは選定ロジックには触れない
```

### 原則

- **鵜呑み禁止**: WebSearchのタイトル・スニペットだけで店名を確定させない。WebFetchによる
  裏取りは省略可能な保険ではなく手順の一部（架空店ブロックと同じ規律）
- **架空店を作らない**: LOCAL_STORES に無い新規店は `candidates[]` に留め置くだけ。
  実在検証（`GOOGLE_MAPS_API_KEY`経由の三重検証）を経ずに自動で正式掲載しない
- **選定ロジックには触れない**: このループは`trending_stores.json`を太らせる**供給側**。
  TOP5の選び方（鮮度・多媒体露出のスコアリング）は`pick_daily_trending5.js`の責務のまま

### 健診コマンド

```
node scripts/trending_scout.js --report              # ループの中身（心拍・候補数の要約）
node scripts/check_trending_scout_health.js           # ループが動いているか（生存確認・CI と共有）
node scripts/pick_daily_trending5.js dryrun            # 供給結果が明日のTOP5候補にどう効くか確認
```

---

## 手動キュレーション店舗の追加運用（`data/manual_stores.json`）

Hot Pepper / Google Sheets に載っていない高品質店（新店・隠れ家・インフル露出店・予約困難店）は、
`data/manual_stores.json` の `stores` 配列に直接エントリを追加して `node build.js` を実行するだけで反映される。

- **必須フィールド**: 店名 / エリア / 都道府県 / ジャンル / アクセス / キュレーター / 追加日 / おすすめポイント
- **フラグ**: `話題フラグ`（既存の🔥話題沸騰に合流）/ `編集部推薦`（新バッジ「✦ 編集部推薦」を表示）。両方 true 可
- **衝突解決**: ホットペッパーID または 店名+エリア 一致で既存店を上書き拡充、なければ新規追加
- **追加条件**: メディア・インフル露出の裏付け / Google評価4.2以上 or 明確な差別化要素 / 業界知識を踏まえた差別化の観点（根拠を書けるもの）
- `アクセス` には必ず「名古屋」または名古屋固有駅名を含める（品質フィルタ通過条件）

### 🚫 架空店ブロック（実在検証ゲート・絶対遵守・全エージェント共通）

> 2026-05 に「実在しない店」がAIにより大量生成され掲載される事故が発生した。再発を防ぐため、
> **店舗を追加・記事に掲載する前に、必ず実在検証を通すこと。** 検証なしの掲載は禁止（P0違反）。

```
1. 手動店（manual_stores.json）を追加したら、必ず実在検証スクリプトを通す:
     GOOGLE_MAPS_API_KEY=... node scripts/fetch_manual_store_photos.js
   → 店名一致(Dice≥0.85) + 名古屋/愛知の住所 + 飲食店業態(types) の三重検証を満たした店だけ
     実写が付く。検証に通らない店は「実在が確認できない」ため掲載しない（SVG止まりは要再検証）。

2. 特集記事（features/*.html）に店を載せるときは、原則 LOCAL_STORES（実在データ）に
   ある店だけを使う。LOCAL_STORES に無い店を載せたい場合は、先に manual_stores.json へ
   追加して上記1の検証を通すこと。

3. 監査: いつでも以下で「実在不明の掲載店」を検出できる:
     node scripts/audit_feature_stores.js          # 特集の掲載店 vs LOCAL_STORES 照合
   → 検出ゼロを維持する。CI でも実行して退行を防ぐ。

【架空店の典型サイン（これらは即・実在検証する）】
  ・説明的・テンプレ的な店名（「個室居酒屋 和の宴」「中国料理 個室コース」「和食 秋月」「Bar 夜更け」等）
  ・同一日に同一キュレーターが大量追加（ジャンル網羅の不自然さ）
  ・他都市の有名店名（京都/大阪/東京/横浜/福岡の店を名古屋として掲載）
  ・Google/食べログ/ホットペッパー等の一次情報にヒットしない

【禁止】
  ・WebSearch / Places で実在確認できていない店を掲載すること
  ・「もっともらしい店名」をAIが創作して掲載すること
  ・実在確認できない店に写真（実写でもイメージ図でも）を付けて取り繕うこと
    → 実在しないなら掲載しない。これがサイトの信頼（サクラ排除・実在保証）の根幹。
```

<!-- autopilot:learned:start -->
## 学習した方針（毎朝の振り返りで自動追記。取り消し: `learn.py undo`）
- 店の記事・SNS投稿の画像はその店の実物写真を使い、前日以前の投稿と同じ画像は使わない。 〔L63〕
<!-- autopilot:learned:end -->
