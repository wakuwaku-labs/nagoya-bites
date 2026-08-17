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
  ・業界視点の構造化データ層（editorReason / mediaFeatures / insiderNote / visitStatus）
  ・編集独立性（広告ゼロ・PR 記事ゼロ）
  ・現役飲食人運営による解釈層（ミシュラン型の編集部匿名）
  ・構造化 DB 4,584店 × 特集 20本 × 日次ジャーナルの三層編集
  ・editorial-policy.html による編集規約の透明公開

【我々が勝つ領域】
  ・「名古屋 × シーン × 業界人の目利き」の組み合わせ
  ・宴会・接待・デートなどシーン別の専門性
  ・飲食店側の事情を知っているからこその推薦精度
  ・大手ポータルが書けない独自 KW（「業界人 推薦」「予約困難 理由」等）

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
1. index.html は単一ファイルで維持する（サイト用の新ファイル追加禁止 ※features/配下の特集記事・journal/配下の日次記事は例外）
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
優先3: Google Maps Places API 写真（GOOGLE_MAPS_API_KEY 設定時）
優先4: 店舗オーナーから許諾を得た独自URL / 編集部の取材写真
─────────────────────────────────────────
最終手段: 「記事固有のイメージ図」
  実写がどうしても手配できない場合のみ、その記事専用に作成した
  オリジナルの図解 / イラスト / インフォグラフィック / 構造図 / SVG 等は許容。
  条件:
    - リポジトリ内（/assets/journal-figures/ または記事HTML内インラインSVG）に self-host
    - 汎用ストックの寄せ集めではなく、その記事のテーマを「説明する図」であること
    - 第三者の権利を侵害しない（Unsplash等の写真をベースに加工したものは不可）

品質ゲート（新規店・既存店を問わず、写真がサイトに入る全経路に適用）:
  基準の正本は `data/photo_policy.json`、判定器は `scripts/lib/photo_policy.js` の1本。
  - 優先3（Places）の写真は「クレジット名＝店名」＝オーナーがビジネスプロフィールから
    上げた宣材だけを採用する。個人名クレジット（＝客が上げたスマホ写真）は載せない。
    photos[0] だけを見ると客の写真になる店が半分あるため、上位N枚を走査して
    最初に基準を通った1枚を採り、全部落ちたら「写真なし」に落とす（取り繕わない）。
  - 検知は CI（build.yml）の `node scripts/audit_photo_policy.js --check` で毎日回る。

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

## エージェント構成と役職（7名体制）

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

| ファイル | 役割 |
|---------|------|
| `CLAUDE.md` | この憲法（全エージェントが参照） |
| `agent-backlog.md` | 課題トラッキング・実行ログ（全エージェントが読み書き） |
| `agents/orchestrator.md` | CEO の行動フロー・QAゲート定義 |
| `agents/inspector.md` | Inspector のチェックリスト |
| `agents/builder.md` | Builder の実装ルール |
| `agents/data-keeper.md` | DataKeeper の実行手順 |
| `agents/marketer.md` | Marketer のマーケティング戦略 |
| `agents/strategist.md` | Strategist の事業戦略 |
| `agents/editor.md` | Editor の編集方針・コンテンツ基準 |
| `index.html` | サイト本体（編集対象） |
| `features/` | 特集記事ディレクトリ（Editor管轄） |
| `journal/` | 日次記事ディレクトリ（Editor管轄・毎日1本公開） |
| `docs/daily-posts/` | 日次SNS原稿（Note/Instagram/X 3種、コピペ投稿用） |
| `.claude/commands/journal-today.md` | `/journal-today` スラッシュコマンド（日次起動） |
| `data/journal_gate_policy.json` | 日次ジャーナルの公開ゲート方針（PASS / PASS_WITH_NOTE / HOLD の閾値）。**運用ルールの唯一の情報源**。`.claude/commands/*.md` は自己改変ブロックで編集できないため、挙動の変更はこのファイルで行う。確認は `node scripts/score_journal_candidates.js --policy`（Editor/Orchestrator 共管） |
| `data/journal_seo_keywords.json` | 日次ジャーナルの**入口（検索意図）**を担保するシーンKWマスタ。各KWは `features/` の実在記事に紐づく。採点器の `search_intent`（10点）がこれを使う。生成/検証は `node scripts/journal_seo_kw.js --build` / `--verify`、KW提案は `--suggest`（Marketer/Editor 共管・SEO-011） |
| `scripts/journal_seo_kw.js` | シーンKWの単一の情報源。`--verify` で「特集ファイルが実在し、そのタイトルにその語が実際に使われている」ことを機械検証（自己申告値を使わないための担保）。`--check "<title>"` でタイトルの検索意図カバレッジを判定 |
| `scripts/register_journal_entry.js` | 記事HTMLから published.json エントリを復元登録（冪等）。「記事はあるのに未登録」で止まった日の自動復旧に使う |
| `scripts/check_journal_health.js` | 日次ジャーナルの**欠番検出の単一の情報源**。判定は検証できる事実だけ（published.json のエントリ実在＋記事HTMLの実在）で行い自己申告値を見ない（制約10）。`node scripts/check_journal_health.js --days 7`（欠番あり=exit 1）。CI とローカルで同じ判定器を共有（Orchestrator/Editor 共管・ISSUE-084） |
| `.github/workflows/journal-watchdog.yml` | **日次ジャーナル欠番のサーバ側監視**。毎日12:00 JST に検査し、欠番があれば GitHub Issue を起票（＝オーナーにメール）、復旧で自動クローズ。**ローカルの全故障モードから独立**しており、「Mac がスリープで launchd が一度も動かなかった」というローカル警報では原理的に検出できない穴も塞ぐ（ISSUE-084） |
| `data/journal_health.json` | ローカル実行（launchd）の最終状態（ok / hold ＋ 理由）。**Mac の外へ push される**ため、watchdog の Issue が「認証切れ／品質HOLD／接続断」のどれかを原因つきで表示できる。`.local-logs/` は gitignore 対象で外に出ないことへの対策（ISSUE-084） |
| `build.js` | データ埋め込みスクリプト（DataKeeper管轄） |
| `data/photo_policy.json` | **店舗写真の採用基準の唯一の情報源**。Google Places の写真には「オーナーが上げた宣材」と「客が上げたスマホ写真」が混在し、実測で半々（2026-08-16・132件中66件が客投稿）。判定根拠は `authorAttributions`（写真クレジット）＝後から第三者が検算できる事実だけを使う（制約10）。判定器は `scripts/lib/photo_policy.js` の1本に集約し、取得（`fetch_manual_store_photos.js`）と監査（`audit_photo_policy.js`）が同じ判定を共有する。閾値変更はこのJSONで行いスクリプトは触らない。確認は `node scripts/audit_photo_policy.js`（Builder/DataKeeper 共管） |
| `data/manual_stores.json` | 手動キュレーション店舗マスター（Editor/DataKeeper 共管） |
| `data/trending_stores.json` | 既存店舗への話題フラグ後付けマスター（DataKeeper管轄） |
| `data/featured.json` | 特集鮮度設定。`monthlyScenes`=12ヶ月×需要シーンのカレンダー（月替わりでトップ特集面と見出しが自動更新）。`sceneLeads`=月×特集の季節リード（`build_featured.js` が当月シーンの記事本文冒頭に季節バナーを注入し、使い回し記事＝banquet等が「今月はこの用途」と本文で伴うようにする。当月外は自動削除・冪等）。検証は `node scripts/build_featured.js --check`（Editor/Builder 共管） |
| `data/feature_rosters.json` | シーン特集の掲載店を月次で入れ替える選定基準（ハイブリッド＋バランス型スコア＋ハードゲート＋多様性補正）。`seasonalBias`=月×特集の季節キーワード加点で、同じ banquet.html でも7月は「ビアガーデン/ビール/テラス」寄り・12月は「忘年会/鍋」寄りに掲載店を月替わりで組み替える（ゲートは維持・純加点なので枠割れなし）。`node scripts/refresh_feature_rosters.js`（毎月1〜3日 build.yml が実行）で features/*.html の掲載店を再構成。検証は `--check`/内訳は `--dry-run`（☀=季節適合）（Builder/DataKeeper 共管・全掲載店は実在店のみ） |
| `.claude/commands/seo-triage.md` | `/seo-triage` 日次SEO/LINEアドバイス取り込み（Marketer管轄） |
| `.claude/commands/seo-triage-weekly.md` | `/seo-triage-weekly` 週次レポート（AI週次分析＋今週のアドバイス）取り込み（Marketer管轄） |
| `docs/feedback-triage-runbook.md` | 消費者フィードバック triage の手順書（正本）。`.claude/commands/*.md` は自己改変ブロックで作成できないためここに置く（Builder/DataKeeper 共管） |
| `data/seo_advice_log.json` | SEO改善ループの記憶（採用/却下/重複の全履歴・append-only・`source`で日次/週次を区別） |
| `data/gsc_metrics.json` | GSC 検索実データ（表示/クリック/CTR/掲載順位・トップクエリ/ページ）。日次 build.yml が更新（Marketer管轄） |
| `data/gsc_opportunities.json` | GSC 改善機会の抽出結果（ctr_fix=1ページ目低CTR / rank_push=2-3ページ目高需要）。`node scripts/gsc_opportunities.js`（build.yml が日次実行）。GSC改善ループの配信レイヤー（Marketer/Builder 共管） |
| `scripts/gsc_query_intent.js` | GSC クエリを **discovery（シーン語/エリア語×ジャンル語＝取りに行く面）/ navigational（店名＝Strategic Skip の面）/ brand / other** に分類。辞書は `data/journal_seo_keywords.json` と共通で、**SEO-011 の効果はここの `discovery` の表示・クリックで判定する**（総クリックは指名検索の増減と混ざるため使わない）。確認は `node scripts/gsc_query_intent.js`（Marketer管轄・SEO-043） |
| `data/search_channel_metrics.json` | **検索・AI流入のエンジン別内訳**（Bing / Google / 生成AI / Yahoo / DDG / SNS / 直接）。`node scripts/search_channel_metrics.js --report`。**GSC は Google しか映さないが、実測では検索経由の 48.5% が Bing・33.3% が生成AI・Google は 13.8%** のため、GSCループだけでは流入の大半が観測外になる。その盲点を `blind_spots` として自動で明示する（Marketer管轄・SEO-039） |
| `scripts/indexnow_ping.js` | IndexNow（Bing/Yandex 対応のプッシュ型インデックス通知）。**外部送信は既定 dry-run**で `--yes` を付けたときだけ送信する。`--init` でキー生成、`--status` で設定確認。Bing Webmaster Tools への登録はクレデンシャルを伴うため**オーナー本人の操作**が必要 |
| `data/feedback_policy.json` | 消費者フィードバック改善ループの運用ポリシー（唯一の情報源。3分類ルール・Gmailクエリ・PII規則・起票上限）。手順の正本は `docs/feedback-triage-runbook.md`（Builder/DataKeeper 共管） |
| `data/feedback_log.json` | 消費者フィードバック改善ループの記憶（採用/fact_check/却下/重複/エスカレーションの全履歴・append-only。書き込みは `scripts/feedback_triage.js --log-append` 経由のみ） |
| `scripts/feedback_triage.js` | 消費者フィードバック triage の決定的ヘルパー（ID採番/重複検知/PIIマスク付きログ追記/健診レポート）。健診: `node scripts/feedback_triage.js --report --days 30` |

---

## SEOアドバイス改善ループ（`/seo-triage` 日次 / `/seo-triage-weekly` 週次）

SEO/アクセス解析のアドバイスを、**鵜呑みにせず**ブランドの総合フィルターに
通して改善に回す仕組み。日次・週次の**2系統が同じスクリプト・同じ Notion 同期**を共有する。

### 全自動の運用モデル（人の貼り付け不要）

> 2026-06-01 から **完全自動**（ユーザーが「確認なしで即追記」を承認）。入力取得は
> GAS のメール送信、判定は Claude（このCLAUDE.md が唯一の根拠）、起票は Notion MCP。
> **判定ロジックは GAS に持たせない**（GAS は配信だけ・Notionトークンも持たせない）。
> 日次レポートの原理と週次は**完全に同一**。

```
[配信] GAS（Google分析オートLINE送信.js）が日次/週次レポートを Gmail 送信
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
[同期] 採用分を Notion MCP で課題トラッカーへ create/update（人の確認を挟まず即追記）
```

手動でも全く同じ: LINE 本文を `/seo-triage`（💡今日のアドバイス・source=line-daily）/
`/seo-triage-weekly`（🤖AI週次分析＋💡今週のアドバイス・source=line-weekly）に貼り付ければよい。
取得元が「人の貼り付け」か「Gmail自動取得」かだけの違いで、判定・起票・同期は同一。

### 判定と記録

```
2. CLAUDE.md の Moat / Strategic Skip を根拠にエージェントが採用/却下を判定
   ・採用 → agent-backlog.md に [SEO-NNN] を status: ready で起票（owner=Marketer / category=SEO）
   ・却下 → data/seo_advice_log.json に理由付きで記録（backlog/Notion には出さない）
   ・重複 → 過去判定済みは再起票しない（日次/週次を横断して衝突検知。数値違いは正規化で同種扱い）
           → 同じメールを再処理しても二重起票しない（冪等。スケジュール多重起動も安全）
3. 採用分は Notion 課題トラッカーに自動同期（自分の目で必要可否を判断できる）
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

- **鵜呑みにしない**: 数値が示すのは「症状」。打ち手が Moat を強めるか（業界視点・実在保証・
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
   ↓
[判定] CLAUDE.md の Moat / Strategic Skip / 制約7・8・10 + data/feedback_policy.json を根拠に3分類
        ・UX/機能改善 → 採用なら agent-backlog.md に [FB-NNN] ready（owner=Builder）
        ・店舗情報の誤り指摘 → fact_check として [FB-NNN] ready（owner=DataKeeper）。
          **この場ではデータを直接修正しない**。acceptance に実在検証ゲート
          （一次情報での確認 → 検証成立時のみ反映 → audit_store_liveness 等の監査通過）を必須で書く
        ・スパム/誹謗/個人情報 → data/feedback_log.json に理由付きで記録のみ（起票しない）
   ↓
[同期] 採用・fact_check 分を Notion 課題トラッカーへ自動同期
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
node scripts/feedback_triage.js --report --days 30
```

---

## 手動キュレーション店舗の追加運用（`data/manual_stores.json`）

Hot Pepper / Google Sheets に載っていない高品質店（新店・隠れ家・インフル露出店・予約困難店）は、
`data/manual_stores.json` の `stores` 配列に直接エントリを追加して `node build.js` を実行するだけで反映される。

- **必須フィールド**: 店名 / エリア / 都道府県 / ジャンル / アクセス / キュレーター / 追加日 / おすすめポイント
- **フラグ**: `話題フラグ`（既存の🔥話題沸騰に合流）/ `編集部推薦`（新バッジ「✦ 編集部推薦」を表示）。両方 true 可
- **衝突解決**: ホットペッパーID または 店名+エリア 一致で既存店を上書き拡充、なければ新規追加
- **追加条件**: メディア・インフル露出の裏付け / Google評価4.2以上 or 明確な差別化要素 / 業界人目利きの観点
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
