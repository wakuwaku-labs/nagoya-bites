# 0002 Linear の Project を KR 単位で4つ作り、課題を category の規則で割り振る

- 日付: 2026-10-06
- 状態: 採用
- 関連: ISSUE-134 / `data/linear_issue_defaults.json` / `scripts/lib/linear_project_map.js` / `scripts/assign_linear_projects.js` / [0001](0001-linear-autonomous-operation.md)

## 背景
Project が0件だったため、新規 Issue は Linear へ作成されずに保留されていた。オーナーは `docs/linear-ai-native-playbook.md` §4-1 の叩き台4つで作成することを承認した（2026-10-06）。

## 決めたこと
1. Project（＝KR）
   - **検索から見つけてもらう**: GSC の discovery クリック
   - **毎日の編集を止めない**: ジャーナル欠番0
   - **実在と信頼を守る**: 架空店・リンク不一致・写真ポリシー違反0
   - **運用を自動で回す**: watchdog 警報の未解決0・定期PRの滞留0
   - 既にあった「Nagoya Bites」は、どれにも当たらない課題の受け皿にする。
2. backlog の category は自由記述でばらつくため、完全一致の対応表はやめた。代わりに**キーワード規則**（`projectRules`）を上から順に評価する。
   - 主分類である先頭の語で評価し、当たらなければ category 全体で評価する。
   - 英字キーワードは語の境界で照合する。
3. 人が既に Project を付けた Issue は上書きしない。Linear 既定のチュートリアル課題（タイトルに [ID] が無いもの）は触らない。
4. 夜間QAの自動起票は受け皿（Nagoya Bites）へ入れる。QA の検出内容は多岐にわたり、1つの KR に固定できないため。

## 選ばなかった案と理由
- **category の完全一致表**: 実在する category が130種類以上あり、新しい表記が出るたびに漏れる。
- **Claude が課題ごとに内容を読んで Project を選ぶ**: 再現できず、後から第三者が検算できない（制約10）。
- **受け皿を作らず、当たらない課題は保留する**: オーナーの依頼は「保留して止めない」ことだった。

## 見直す条件
- 受け皿（Nagoya Bites）に入る課題が全体の2割を超えたら、規則を足す。
- KR を変えるとき（オーナー判断）
