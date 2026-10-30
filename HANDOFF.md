status: done

# 検索のクリック率が低い記事の題と説明文を書き直す（Ondine #1066・事業責任者の施策 #1・2026-10-30）

## 目的
表示が多いのにクリック率が低い記事の title と説明文を、検索語（GSC の pageQueries）に合わせて書き直し、直近28日の検索クリックを 886 → 950 以上にする（判定は 2026-11-13 に事業責任者）。

## 完了条件
- 書き直しを台帳（data/search_ctr_rewrites.json）に before/after・基線つきで残し、`node scripts/search_ctr_rewrite.js --check` が一致
- node --test tests/*.test.js がすべて通り、main に合流して push・本番で新しい題が出る（済: 1914件 pass・a27d416492・本番6本で確認・Ondine 報告 #1326）

## できていること
- 6本: ジャーナル5本（ひものや官兵衛・さく蛸・ちひろ菓子店・炭火酒場COWCOW・お台所 六六堂）は title・og:title・description・og:description、手羽先特集は説明文だけ（題は ADR 0033 で P-334 まで持ち越し）
- 道具 scripts/search_ctr_rewrite.js（--apply/--revert/--check/--report）と tests/search_ctr_rewrite.test.js。取り消しで元に戻ることを実ファイルで確認
- SEO-137（11-06 の比較）の new_articles から5本を除く（data/journal_title_experiment.json の excludeFromNewArticles）
- main のビルドを止めていた stub_links（炭火焼肉 flower の店 ID が J004699058 → J001258795）を特集5本で今の店舗ページにそろえた

## 次にやること
- 2026-11-13: `node scripts/search_ctr_rewrite.js --report ondine-1066` で止める条件を見る。当たれば `--revert ondine-1066` → 台帳の status を reverted

## 試したが駄目だったこと
- 最初の題でひものや・さく蛸が前30字のシーン語（記事の「コスパ」）を欠いた → 題の前半に「のコスパ」を入れた

## 守るルール・判断メモ
- SEO-137 の比較中の20本（リサールコーヒー・札幌らーめん戸倉など）は書き換えない。特集の題は変えない（0033）
- 事実は記事にあるものだけ。手羽先の「★4.9」は今のデータで確かめていないので説明文から外した

## 関連ファイル
data/search_ctr_rewrites.json / scripts/search_ctr_rewrite.js / tests/search_ctr_rewrite.test.js / data/journal_title_experiment.json / scripts/journal_title_experiment.js
