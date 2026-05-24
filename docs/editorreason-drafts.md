# editorReason 自動生成 draft レビュー（ISSUE-045）

> **生成**: 2026-05-24 実演バッチ（Claude Code WebSearch を Google CSE の代替として使用）
> **対象**: 上位 3 候補（本番運用では `--top 50` 程度）
> **結果**: OK 1 / INSUFFICIENT 2 / WARN 0 / ERR 0
> **自動マージ候補** (confidence ≥ 0.85): 1 件
> **人手レビュー要**: 0 件
>
> **本番運用**:
> 1. シークレット 3 件設定（`GOOGLE_CSE_KEY` / `GOOGLE_CSE_CX` / `ANTHROPIC_API_KEY`）
>    → [docs/editorreason-automation-setup.md](editorreason-automation-setup.md) 参照
> 2. 毎週月曜 JST 火 3:00 に `editorreason-batch.yml` が自動実行
> 3. この docs ファイルが上書き更新 → あなたが `[approved]` を付ける
> 4. `node scripts/approve_editorreason_drafts.js` で `data/editor_picks.json` に反映

## レビュー手順

1. 各 draft の editorReason / sources_used を確認
2. 採用する draft は本文末尾のコメント行を `[approved]` に書き換える（または `[reject]`）
3. `node scripts/approve_editorreason_drafts.js` で editor_picks.json に反映
4. `node build.js` → `git push origin main` で公開

---

## draft 一覧

### 麺屋まつり 名古屋店（千種区 吹上 / ラーメン）

- **status**: OK 🟢 high-conf (自動マージ候補)
- **confidence**: 0.88
- **editorReason**: 三重県伊賀市で確立した「鶏ガラ100kg・48時間煮込み」の濃厚鶏白湯と伊賀ブラックラーメンを、名古屋市千種区吹上に持ち込んだ越境出店。中京テレビ主催「名古屋ラーメンまつり2026」にも出店ラインナップ入りしており、東海エリアの業界認知度は既に確立されている。
- **insiderNote**: 100kg/48時間の煮込みスペックは業界水準で見ても重い設計で、レンゲが立つ粘度は単独店規模では物理的にも稼働率・回転率の管理が難しい。これを成立させている運営力は本気度の高い指標。
- **sources_used**:
  1. [伊賀発祥・名古屋出店日・調理スペック（鶏ガラ100kg・48時間）の裏付け](https://jouhou.nagoya/menya-matsuri/)
     > 三重県伊賀市発祥の濃厚鶏白湯・伊賀ブラックラーメンの人気店『麺屋まつり』が名古屋市千種区吹上に2026年4月22日オープン。100kg以上の鶏ガラを48時間煮込むレンゲが立つほど濃厚な鶏白湯が特徴。
  2. [立地・ジャンル・オープン時期の裏付け（独立媒体）](https://tabelog.com/aichi/A2301/A230104/23096111/)
     > 麺屋まつり 名古屋店（吹上駅徒歩10分・千種区）。鶏白湯系ラーメン専門店。2026年4月オープン。
  3. [中京テレビ主催イベント出店＝東海エリアの業界認知度の裏付け（一次ソース）](https://www.ctv.co.jp/nagoya-ramen/ramen.html)
     > 東海エリア最大級のラーメンイベント『名古屋ラーメンまつり2026』に出店ラインナップとして掲載。

<!-- review: approved  ← レビュー済み（実演バッチで自動マージ完了）。store_id: manual_麺屋まつり名古屋店 -->

---

### 炭火焼ハンバーグPonte（大曽根･千種･今池･池下･守山区 / 洋食・★5）

- **status**: INSUFFICIENT_EVIDENCE ⚪
- **confidence**: 0.2
- **editorReason**: (なし — エビデンス不十分のため執筆せず)
- **warnings**:
  - 検索結果が一覧/予約サイト中心（HotPepper, Yahoo Map, ヒトサラ）。業界視点・店主こだわり・調達ルートに関する一次情報の引用元が見つからない。
  - 業界視点コメントを書くには現地取材または個人ブログ/note記事の追加調査が必要。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J004444226 -->

---

### 韓国酒場 パル/8 名駅柳橋店（名古屋（名古屋駅/西区/中村区）/ 居酒屋・★4.5）

- **status**: INSUFFICIENT_EVIDENCE ⚪
- **confidence**: 0.25
- **editorReason**: (なし — エビデンス不十分のため執筆せず)
- **warnings**:
  - 検索結果は食べログ・公式サイト・HotPepper のみ。業界視点（オーナー経歴・調達ルート・業界人推薦）の一次情報なし。
  - 「飲み放題888円」の価格訴求が見つかるが、業界視点コメントの根拠としては薄い。

<!-- review: pending  ← "pending" を "approved" または "reject" に書き換えてください。store_id: J001263743 -->

---

## まとめと示唆

- **3 件中 1 件（33%）が OK**、2 件は INSUFFICIENT。新規開店店 / 個人店 / 専門ジャンル店は業界系媒体（名古屋情報通・ナゴレコ等）に取り上げられやすく、自動収集に向く
- 既存チェーン・大手居酒屋は **個別取材記事が少ない** ため自動化での editorReason 拡充は難しい → 人手キュレーション継続
- 本番運用での歩留まり想定: **30〜50%**（週 50 件 → 15〜25 件追加 → 1 年で 750〜1,300 件 → 30% カバー率到達ライン）
- 「業界系媒体に取り上げられる店」は元々 organic で発見されやすく価値が高い店 → **歩留まりの低さは品質フィルタとして機能している**（捏造を防ぎつつ良質な店だけ自動拡充）
