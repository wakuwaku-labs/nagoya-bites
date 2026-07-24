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

禁止事項:
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
| `build.js` | データ埋め込みスクリプト（DataKeeper管轄） |
| `data/manual_stores.json` | 手動キュレーション店舗マスター（Editor/DataKeeper 共管） |
| `data/trending_stores.json` | 既存店舗への話題フラグ後付けマスター（DataKeeper管轄） |
| `data/featured.json` | 特集鮮度設定。`monthlyScenes`=12ヶ月×需要シーンのカレンダー（月替わりでトップ特集面と見出しが自動更新）。`sceneLeads`=月×特集の季節リード（`build_featured.js` が当月シーンの記事本文冒頭に季節バナーを注入し、使い回し記事＝banquet等が「今月はこの用途」と本文で伴うようにする。当月外は自動削除・冪等）。検証は `node scripts/build_featured.js --check`（Editor/Builder 共管） |
| `data/feature_rosters.json` | シーン特集の掲載店を月次で入れ替える選定基準（ハイブリッド＋バランス型スコア＋ハードゲート＋多様性補正）。`seasonalBias`=月×特集の季節キーワード加点で、同じ banquet.html でも7月は「ビアガーデン/ビール/テラス」寄り・12月は「忘年会/鍋」寄りに掲載店を月替わりで組み替える（ゲートは維持・純加点なので枠割れなし）。`node scripts/refresh_feature_rosters.js`（毎月1〜3日 build.yml が実行）で features/*.html の掲載店を再構成。検証は `--check`/内訳は `--dry-run`（☀=季節適合）（Builder/DataKeeper 共管・全掲載店は実在店のみ） |
| `.claude/commands/seo-triage.md` | `/seo-triage` 日次SEO/LINEアドバイス取り込み（Marketer管轄） |
| `.claude/commands/seo-triage-weekly.md` | `/seo-triage-weekly` 週次レポート（AI週次分析＋今週のアドバイス）取り込み（Marketer管轄） |
| `data/seo_advice_log.json` | SEO改善ループの記憶（採用/却下/重複の全履歴・append-only・`source`で日次/週次を区別） |
| `data/gsc_metrics.json` | GSC 検索実データ（表示/クリック/CTR/掲載順位・トップクエリ/ページ）。日次 build.yml が更新（Marketer管轄） |
| `data/gsc_opportunities.json` | GSC 改善機会の抽出結果（ctr_fix=1ページ目低CTR / rank_push=2-3ページ目高需要）。`node scripts/gsc_opportunities.js`（build.yml が日次実行）。GSC改善ループの配信レイヤー（Marketer/Builder 共管） |

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
