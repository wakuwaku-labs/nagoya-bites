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
事業責任者（AI）の施策 #2（判断 0078・0082）。GSC で伸びている「名古屋 一人飲み」群の隣の話題（栄・金山）に特集を2本足す。

## 完了条件
- 2本を main に合流して push、本番 URL が 200
- #1067 に report（URL・変えたファイル・試験件数・合流 SHA）→ state done

## できていること
- 作業コピー: ~/orca/workspaces/nagoya-bites/work-nerini2t1067（ブランチ wakuwaku-labs/work-nerini2t1067）。3コミット済み（0ff5ae50a4 本体／cd8f5a3778 origin/main 取り込み／その後に金山の見出し写真差し替え）
- 新規: features/sakae-hitori-nomi.html・features/kanayama-hitori-nomi.html（名駅版の型。店は stores.json の営業中で一人客の記載がある6軒ずつ）
- 変更: features/index.html（カード2・ItemList 58/59）・sitemap.xml・llms.txt（gen_llms_txt.js）・features/nagoya-solo-dining.html（本文と関連）・features/meieki-hitori-nomi.html（関連）・features/sakae.html（関連）・HANDOFF.md
- 監査: スキーマ整合 OK・デザイン OK・見出し OK・言い回し 0・実在店 OK。試験 1914 pass・0 fail（main 取り込み後）
- 根拠: GSC 9/3-9/30→10/1-10/28 で「名古屋 一人飲み」31→54 クリック、「名古屋 1人飲み 男」3→13。栄・金山の一人飲みの記事は無かった

## 次にやること
1. gh run list --workflow build.yml -L 2 で #1066 のビルド（run 41047319120）が終わったか確認（走行中は合流しない）
2. git fetch → origin/main に新しいコミットがあれば git merge origin/main → node --test tests/*.test.js が全件 pass を確認
3. git push origin HEAD:main（fast-forward。force しない）→ 合流 SHA を控える
4. ビルド完了後に curl -sI https://nagoya-bites.com/features/sakae-hitori-nomi.html と kanayama-hitori-nomi.html が 200 か確認
5. ondine-agent report 1067 --result ok --body "…" --commit <SHA> → update 1067 --state done。HANDOFF の #1067 節を done に

## 試したが駄目だったこと
- 特集に FAQPage の JSON-LD は禁止（判断 0025・audit_feature_schema_alignment）→ 外した
- 入れ替え対象でない特集に「Google評価N以上」を書くと tests/feature_criteria_wording が落ちる → 選定基準から外した
- add_feature_top_cta.js --all・add_feature_journal_links.js は関係ない特集も書き換える → 関係ない分は git checkout -- で戻した

## 守るルール・判断メモ
- feature_rosters.json には登録しない（月次入れ替えで本文の店名と一覧がずれるため）
- 新しい課題は作らない。価格・予約・告知の新しい記述は書かない（価格帯はデータの値だけ）

## 関連ファイル
features/sakae-hitori-nomi.html・features/kanayama-hitori-nomi.html・生成に使った台本 /private/tmp/claude-501/-Users-katagirijakutou-orca-workspaces-nagoya-bites-work-nerini2t1067/29e5b41e-c3b2-47d7-8d6f-4bdc6d1f179f/scratchpad/build_articles.py と articles.json
