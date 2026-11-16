status: done

# 名古屋バイツの基本方針を X 投稿・記事・投稿案の仕組みに入れる（Ondine #2041・2026-11-16）

## 目的
本人の「名古屋バイツ 基本方針」（2026-11-16）に沿った文面だけが作られ・出るようにする。

## 完了条件
①原文がリポジトリにあり editor.md から参照 ②X 投稿と記事の指示文に要点 ③避ける言い回しの下書きが投稿前の検査で止まる試験が通る ④既存の試験が全部通る

## できていること
- 原文 docs/brand-policy/nagoya_bites.md・要点 data/brand_policy/nagoya_bites.json（SNS分析ツールから写し）
- 判定 scripts/lib/brand_policy.js → x_post.js・note_draft.js・validate_journal_draft.js 5c
- 指示文: docs/x-post-prompt.md・write_x_draft.js・run_journal_local.sh・journal-today.md・agents/editor.md
- 試験 tests/brand_policy.test.js 8件 pass。判断 docs/decisions/0068

## 次にやること
- なし（main af67d9234b に合流・CI 成功）

## 試したが駄目だったこと
- なし

## 守るルール・判断メモ
- 記事では★4.1（Google評価）は対象外、順位の語は警告だけ（実測 47 本中 3 本が事実の引用）。X は全部止める

## 関連ファイル
- docs/decisions/0068-brand-policy-in-generators.md
