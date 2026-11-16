status: in_progress

# 基本方針の段階1: 読者を誤解させうる表示を直す（Ondine #2048・2026-11-17）

## 目的
計画 docs/plans/media-policy-2026-11/03 の S1-1〜S1-5（掲載歴・訪問済・言い切り・閉業・壊れた写真）を直し、main に合流して本番で確かめる。

## 完了条件
S1-1〜S1-5 の「⑪完了」を満たし、npm test が通り、main 合流後の本番で確かめた結果を report に残す。

## できていること
- S1-1: 掲載歴・編集部訪問済・食べログ点数・内部の項目名・星の食い違い（検査 scripts/audit_feature_facts.js）・Unsplash 由来の顔写真7本を図に
- S1-2: 桜ゼロ宣言等を「編集の約束」に言い換え（assertionWords の検査）
- S1-3: 題・本文の「業界人」等を外した（上位2本の題も 11-17 に変更・記録 data/top_title_changes.json）
- S1-4: 閉業・休業の注記（店舗ページ・特集カード）。記事の閉店検査は記録だけ（WARNING）
- S1-5: 記事の Google 写真を外し、月次の見張り（article-photo-watchdog.yml）
- 判断 docs/decisions/0071

## 次にやること
- main 合流 → build.yml の完了を待ち、本番で stores の再生成後に audit_selection_wording を全数確認
- 上位2本の題のクリックを 2026-12-16 以降に `node scripts/rewrite_selection_wording.js --report` で確認（半減なら --revert）

## 試したが駄目だったこと
- features の復元に git checkout を使うと未コミットの修正も消える（コミットしてから戻す）

## 守るルール・判断メモ
- 本番の自動公開の条件は変えない（閉店検査は WARNING のまま）／削除は本人に一覧を見せてから（assets/features の古い jpg 14枚は参照を外しただけ）

## 関連ファイル
- docs/decisions/0071-stage1-misleading-display.md
