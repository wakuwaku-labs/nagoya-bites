# 0003 Project は「Nagoya Bites」1つ、KR はラベルで表す

- 日付: 2026-10-06
- 状態: 採用（[0002](0002-linear-projects-as-krs.md) を置き換え）
- 関連: `data/linear_issue_defaults.json` / `scripts/lib/linear_project_map.js` / `scripts/assign_linear_projects.js`

## 背景
0002 では KR ごとに Project を4つ作り、課題を割り振った。その直後、オーナーから「まとめた課題はすべて Nagoya Bites というプロジェクトの中の課題」との指摘があった。Linear 上の Project はサイトという事業1つで、KR はその中の分け方にすぎない。

## 決めたこと
1. すべての課題を Project「Nagoya Bites」に入れる（新規作成時の既定値・夜間QAとも）。
2. KR は Issue ラベルで表す: `KR:検索から見つけてもらう` / `KR:毎日の編集を止めない` / `KR:実在と信頼を守る` / `KR:運用を自動で回す`
   - 付け方は 0002 と同じ category のキーワード規則（`krLabelRules`）を使う。
   - どの規則にも当たらなければラベルは付けない（受け皿は作らない）。
3. 既存の未完了33件を Nagoya Bites へ戻し、KR ラベルを付けた（`scripts/assign_linear_projects.js --apply`）。
   - ラベルは追加のみで、人が付けた別の Project・既存の KR ラベルは上書きしない。
4. 0002 で作った KR 別 Project 4つは空になった。オーナーは削除を承認したが、自動操作の権限設定で削除が止められたため、オーナーが Linear 画面で削除する（`retiredProjects` に名前を残し、誤って課題が入っても次回の実行で Nagoya Bites へ戻す）。

5. 担当者が空の既存 Issue（33件）は、オーナーの承認を得て既定の担当（オーナー）で埋めた。期限は一斉に付けない。起点が無く、全件に同時に期限が来て始業確認が鳴りっぱなしになるため。新規 Issue だけ起票日＋優先度の日数で期限を付ける。

## 選ばなかった案と理由
- **KR 別 Project のまま、Nagoya Bites を Initiative（Project の上位）にする**: オーナーの認識（Nagoya Bites がプロジェクト）と Linear の画面上の呼び方が食い違い、混乱のもとになる。
- **Project 内のマイルストーンで KR を表す**: マイルストーンは時系列の区切りを前提にした機能で、並行して走る KR には合わない。

## 見直す条件
- Nagoya Bites 以外の事業（別サイト・別案件）を Linear で扱い始めたら、事業ごとに Project を分ける。
