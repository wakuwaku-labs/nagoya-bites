# S6-2 編集規約の文と実装の突き合わせ表（2026-11-17）

編集規約（`features/editorial-policy.html`）の各文が、実装・運用と1行ずつ対応していることを確かめた記録。食い違いは0件。「実態」の列は、確かめたファイルまたは運用の事実。

| 規約の文（要旨） | 実態 | 対応 |
|---|---|---|
| 情報収集・執筆・検査・公開はAIが行う（lead・02-B・05） | 日次ジャーナルは `scripts/run_journal_local.sh`（launchd）が Claude で生成・公開。店データは `scripts/fetch_*`・build.yml が毎日自動更新 | 一致 |
| 運営者は基準と止める条件を決め、指摘と例外に対応する | `data/journal_gate_policy.json`・`data/*_policy.json` は運営者が決める。指摘窓口は editor@ | 一致 |
| 公開される記事を人が1本ずつ読んで承認しない | 日次ジャーナルは HOLD 判定を通れば自動公開（`journal_gate_policy.json`） | 一致 |
| 日次ジャーナルは出典3件以上 | `scripts/validate_journal_draft.js` 項目 `11_sources_required`（3件未満は不合格） | 一致 |
| 載せる店は掲載データにあるものだけ（見つからなければ載せない） | 同 項目1（`stores.json`・`pending_stores.json` に無い店名は不合格）。特集は build.yml の `audit_feature_stores.js` | 一致 |
| 閉店・一時休業の記録がある店は警告として記録する（まだ公開は止めない） | 同 項目3（`warn: true`・`ok: true`。ADR 0069 決定6で記録だけ） | 一致（「止めない」と明記） |
| 写真は記事が扱う店のものだけ・出どころ不明は載せない | `scripts/lib/hero_photo_gate.js` を validate・生成・日次監査が共有 | 一致 |
| 避ける表現を全ページで検査する | `scripts/audit_selection_wording.js`（`tests/i35_guards.test.js` が npm test で実行） | 一致 |
| 基準に届かない日は出さない | `journal_gate_policy.json` の `HOLD`（公開しない） | 一致 |
| 「訪問済」は訪れた日の記録を示せる店だけ。いまは付けている店なし | `scripts/lib/editor_reason.js` の `effectiveVisitStatus`（ADR 0069 決定8・`tests/feature_facts.test.js`） | 一致 |
| 「公開情報ベース（自動収集）」は人が個別に見ないまま載せた店 | 承認待ち48件をやめて自動にする（決定8）。S3-2 以降の実装が入るまで、文面が先行しないよう「見ないまま」と実態側に合わせた | 一致 |
| 訂正・取り下げの方針（直す・外す・更新日を変える） | 運用の約束（運営者が実行）。更新日は JSON-LD `dateModified` と `apply_feature_byline.js` | 約束（実装不要） |
| 各記事の冒頭に状態の帯を順次出す | 帯は S3-2（別ワーカー）の実装。規約は「順次出していく」と書き、全記事にあるとは書いていない | 一致（先行しない書き方） |
| レビュワーの募集は停止中 | `features/become-reviewer.html` の募集ボタンを外し停止を明記（決定8） | 一致 |
| 記事の書き手は編集部＝運営者とAIエージェントの合わせた呼び名で、実態はAI | 構造化データ `author.description` を全特集に付与（`tests/feature_frozen_parts.test.js`） | 一致 |

## 残した食い違いの候補（このPRで直していないもの）
- 規約 07「点数の順に並べている」説明・特集の番号（決定1・別ワーカーの施策）。
- ジャーナル・店舗ページの構造化データの `author` と画面の書き手の表記（`journal/_template.html`・`gen-store-pages.js` は持ち分外）。
