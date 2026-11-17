# 0074 事実台帳と記事の検査は shadow（記録だけ）で入れ、止める配線は別に承認を取る

- 日付: 2026-11-17
- 状態: 採用
- 関連: 0069 決定6／docs/plans/media-policy-2026-11/03-implementation-plan.md 段階4（S4-1〜S4-5）／PR #760・#763・#754（S4-4）／`scripts/lib/claims.js`・`scripts/verify_article_claims.js`・`scripts/review_article_independent.js`・`scripts/journal_lane.js`・`scripts/claims_gate_calibrate.js`・`scripts/journal_withdraw.js`・`scripts/journal_correct.js`

## 背景
- 記事の事実（数字・営業情報など）を出典と照合する仕組みが無かった。止める検査を最初から入れると、誤保留で日次の公開が止まる恐れがある（品質ゲート原則5: 分布を実測してから）。

## 決めたこと
1. 検査は `claims_gate`（off/shadow/enforce）の1か所で切り替える。最初は shadow（記録だけ）。enforce の配線は、S4-5 の線を満たし本人が承認した後の別変更で入れる。今の `journal_lane.js` は enforce と書かれても shadow として動く。
2. 「食い違い」は、出典に同じ項目があり数字が違うときだけ。見つからない・計算で出した数字は「照合不能」（自動修正の道）にする。誤保留を抑えるための決定で、改ざん検出が下がる代償がある。
3. 事実の照合は、書き手が出す台帳（`data/journal_claims/<日付>.ledger.json`・文と出典の該当記述の対）を正とする。機械の推測は台帳が無い日の代わり。台帳の無い日は警告だけで止めない。
4. 自動修正の道に回す照合不能の文は、来店前に重要な文に絞る（沿革・件数・計算の数字は対象外）。
5. 取り下げは URL を残し、noindex・注記・履歴を入れる（記事は消さない）。自動では実行せず、予行が既定。X の実削除は `--delete-x --yes` のときだけ。取り下げた記事はサイトマップから外す（`gen-store-pages.js`）。
6. 訂正は本文の置き換え・履歴・dateModified を残す。題・冒頭は `--force-head` のときだけ変える。

## 選ばなかった案と理由
- 最初から enforce → S4-5 の測定（壊した20本・正しい30本の見本）が線を満たす前に止めると、正しい記事を保留するおそれがある。
- 台帳を機械の推測だけで作る → 出典の該当記述を書き手が対で出す方が検算できる。

## 見直す条件
- S4-5 の再測定が線を満たし、本人が enforce を承認したとき。
