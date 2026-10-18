# 0051 Google Places API の保存・表示と規約の適合状況

- 日付: 2026-10-18
- 状態: 採用
- 関連: backlog [[ISSUE-190]] / [[ISSUE-192]] / [[MEO-001]] / 判断の記録 0042・0045

## 背景

当サイトは Google Maps Places API から取得した店名・住所・評価・口コミ数を
`data/places_resolved.json`（名前・住所・placeId・取得日）と `data/stores.json`（Google評価・口コミ数）
に保存し、公開 GitHub リポジトリ経由で毎日表示している。
[[MEO-001]]（MEO 計画 2026-10）の規約調査で保存の可否が論点になった（計画書 12.2 節）が、
2026-10-15 の WebFetch で Service Specific Terms が途中で切れて確かめられなかった。
ISSUE-190 で正式に調査した結果を記録する。

## 調査した規約の出典

| 文書 | URL | 確認日 |
|------|-----|--------|
| Places API ポリシー（policies ページ） | https://developers.google.com/maps/documentation/places/web-service/policies | 2026-10-18（本文に "Last updated: October 13, 2026" と記載） |
| Maps Platform Service Specific Terms | https://cloud.google.com/maps-platform/terms/maps-service-terms | 2026-10-18（WebFetch で途中から取得不能・内容未確認） |

## 確認できた規約（原文引用）

Places API ポリシー（policies ページ）より:

> "You must not pre-fetch, cache, or store Places API content beyond the allowed exceptions."

> "Note that the place ID, used to uniquely identify a place, is exempt from the caching restrictions.
> You can therefore store place ID values indefinitely."

「allowed exceptions（保存が許される例外）」の具体的な内容（例: 表示用 30 日キャッシュ等）は
Service Specific Terms に記載されているはずだが、同文書を完全には取得できなかったため
本記録の時点では確認できていない。

## 当サイトが保存している Places 由来の項目

### data/places_resolved.json（非公開ビルド中間ファイル・公開リポジトリにコミット）

| 項目 | Places API の出どころ | 更新頻度 | 公開 |
|------|----------------------|---------|------|
| placeId | `place_id` フィールド | build.js が毎日 fetch_places.js で更新 | Git コミット経由で公開 |
| name | `displayName.text` | 同上 | 同上 |
| formatted_address | `formattedAddress` | 同上 | 同上 |
| fetchedAt | スクリプトが生成するメタデータ | 同上 | 同上（Places 由来ではない） |
| rejected | スクリプトが付与するフラグ | 変更時のみ | 同上（Places 由来ではない） |

### data/stores.json（build.js の出力・公開リポジトリにコミット）

| 項目 | Places API の出どころ | 更新頻度 | 公開 |
|------|----------------------|---------|------|
| Google評価 | `rating` フィールド | build.js が毎日更新 | Git コミット経由で公開 |
| 口コミ数 | `userRatingCount` フィールド | 同上 | 同上 |

## 項目ごとの適合判定

| 項目 | 判定 | 根拠 |
|------|------|------|
| placeId | **合う** | policies ページが明示的に exempt・indefinitely 可と記載 |
| fetchedAt | **合う** | Places API が返すフィールドではなく、スクリプトが生成するメタデータ |
| rejected | **合う** | 同上（スクリプトが付与するフラグ） |
| name | **決められない** | policies の一般禁止（"must not ... store"）が適用されるが、"allowed exceptions" の内容が Service Specific Terms に書かれており確認できていない |
| formatted_address | **決められない** | 同上 |
| Google評価 | **決められない** | 同上 |
| 口コミ数 | **決められない** | 同上 |

## 決めたこと

1. **Service Specific Terms を確認するまで表示は変えない**（方針: 調べるだけ・変えるならオーナーの判断・制約5）
2. この研究結果を [[ISSUE-192]] としてオーナーへの判断依頼課題に起票し、以下の情報を揃える:
   - Service Specific Terms の該当節の全文（人がブラウザで直接確認するか、別の取得方法）
   - 「allowed exceptions」が当サイトの使い方をカバーするかどうかの判定
   - カバーしない場合の選択肢と費用（下記）

## 合わない場合の選択肢（ISSUE-192 の判断材料として）

| 選択肢 | 内容 | 費用・影響 |
|--------|------|------------|
| A. 表示のたびに取る（キャッシュしない） | Places Basic Data SKU をユーザーアクセスのたびに呼ぶ | 推定 月50,000 PV × 0.3 呼び出し率 ≒ 15,000 req/月 → $255/月（Free $200 超過分）。1,100 店がすべて新規なら $0.017×1,100 ≒ $18.7/月だが毎 PV に不向き |
| B. places_resolved.json の name・formatted_address を外す | 紐付けの判定（buildContext）が再度 Places API を呼ぶかキャッシュなし動作に変わる | 判定精度が下がる可能性。工数: 中 |
| C. Google評価・口コミ数を表示しない（Places 無しで運用） | build.js の applyRatingGate で全店 blocked | 評価・信頼度が全消え。SEO・CVR への影響大 |
| D. 現状維持（Service Specific Terms の例外に収まる可能性） | "allowed exceptions" が毎日更新の表示用キャッシュを含む場合は合法 | Service Specific Terms の確認待ち |

## 見直す条件

- Service Specific Terms の該当節が読めた時点で判定を更新する（[[ISSUE-192]]）
- Google が policies ページを更新したとき（本記録の更新日 2026-10-18 以降）
