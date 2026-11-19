status: in_progress

# 記事と X 投稿を親しみやすくし「おすすめ◯選」を足す（Ondine #2224・2026-11-19）

## 目的
本人:「値段やそれに付随することが堅苦しく読むのに抵抗がある。名古屋のランチおすすめ5選のように店の特徴を短く。素人でも分かり興味を持てる文章に」。

## 完了条件
- 書き方の決まりを `data/editorial_standard.json` の voice に置き、journal-today・editor.md・x-post-prompt.md が同じ決まりを指す
- ◯選の型（記事・X の picks）と曜日ローテ（月水土）
- 読みやすさの警告（止めない）・validator 項目10 の3観点の置き換え
- npm test 通過 → main 合流

## できていること
- journal-today.md Step 4 / editor.md / journal_queue.json（ローテ）/ 表示名（おすすめまとめ・店選びのコツ）/ ADR 0080
- 並行: X 側（x-post-prompt.md・x_post.js 等）と基準・validator・採点（editorial_standard.*・validate_journal_draft.js・score_journal_candidates.js）を作業役2つに依頼中

## 次にやること
- 作業役の結果を統合 → npm test → コミット → main 合流 → Ondine #2224 report/done

## 試したが駄目だったこと
- なし

## 守るルール・判断メモ
- 基本方針の原文は書き換えない（本人の確認が要る）。過去記事は書き直さない（0069 決定4）
- ◯選は番号・順位を付けない。読みやすさは警告だけ

## 関連ファイル
- docs/decisions/0080-friendly-voice-and-picks.md
