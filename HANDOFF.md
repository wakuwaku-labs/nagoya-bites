status: in_progress

# 検索のクリック率が低い記事の題と説明文を書き直す（Ondine #1066・事業責任者の施策 #1・2026-10-30）

## 目的
表示が多いのにクリック率が低い記事の title と説明文を、検索語（GSC の pageQueries）に合わせて書き直し、直近28日の検索クリックを 886 → 950 以上にする（判定は 2026-11-13 に事業責任者）。

## 完了条件
- 書き直しを台帳（data/search_ctr_rewrites.json）に before/after・基線つきで残し、`node scripts/search_ctr_rewrite.js --check` が一致
- node --test tests/*.test.js がすべて通り、main に合流して push・本番で新しい題が出る

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

---

（並行作業・状態: in_progress）

# Ondine #1067 伸びている検索語に近い話題で新しい特集を2本足す（2026-10-30〜）

## 目的
事業責任者（AI）の施策 #2（判断 0078・0082）。GSC で伸びている検索語の隣の話題に特集を2本足し、検索クリックを増やす。

## 完了条件
- 特集2本を features/ に既存の型（meieki-hitori-nomi.html）で追加し、features/index.html・sitemap.xml・llms.txt・関連特集から内部リンク
- node --test tests/*.test.js が全件通過 → main を最新にして合流・push
- #1067 に report（URL・変えたファイル・試験件数・SHA）

## できていること
- 根拠: GSC 9/3-9/30 → 10/1-10/28 でクリック 542→886。伸びの中心は「名古屋 一人飲み」群（31→54、「1人飲み 男」3→13 ほか）で、着地は nagoya-solo-dining.html。名駅版（meieki-hitori-nomi）はあるが、栄・金山の一人飲みの記事は無い
- 題: ① features/sakae-hitori-nomi.html（栄・錦・伏見・新栄の一人飲み）② features/kanayama-hitori-nomi.html（金山の一人飲み）
- 店の選定基準: data/stores.json の営業中の店で、タグ・キャッチ・おすすめポイントに「一人/お一人様/1人OK/カウンター/立ち飲み/ふらっと」がある店。写真は imgfp.hotp.jp（Places 写真は特集で使わない・0045）

## 次にやること
- 2本を書く → 生成系スクリプト（add_feature_top_cta / apply_feature_byline / add_feature_journal_links / apply_site_chrome）を当てる → 監査 → 試験 → 合流

## 守るルール・判断メモ
- feature_rosters.json には登録しない（月次入れ替えで本文の店名と一覧がずれるため。名駅版で実際にずれている）
- 「業界人」「目利き」など選定主体の語は使わない（selection_wording_policy）。価格・予約・告知の新しい記述を書き足さない（データにある価格帯のみ）
- 新しい課題は作らない（#1067 で報告）

## 関連ファイル
features/meieki-hitori-nomi.html（型の手本）、data/gsc_metrics.json、data/stores.json
