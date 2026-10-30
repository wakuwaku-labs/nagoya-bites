status: in_progress

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
