# 0006 Linear 運用を他のリポジトリへ広げる方法

- 日付: 2026-10-07
- 状態: 採用

## 背景
オーナーから「ここで作った Linear 接続を他のプロジェクトでも使いたい」と依頼があった。調べたこと:
- Orca CLI の Linear 接続は Mac 単位なので、どのリポジトリからも使える
- ブリーフィングと監視はチーム P 全体を見ていた。別のアプリの課題（動画生成プロジェクト）が混ざり、誤報 #381（緊急・未着手 16件）が出た

## 決めたこと
1. アプリ・事業ごとに Linear Project を1つ作る。課題の切り分けは Project で行う（ADR 0003 の KR＝ラベルは各 Project の中で使う）
2. このリポジトリのブリーフィングと監視は Project「Nagoya Bites」に絞る（`data/session_briefing_policy.json` の `project`）
3. 共通ルールはグローバル `~/.claude/CLAUDE.md` に置く。各リポジトリには `.linear.json`（team / project / 既定値）だけを置く
4. スクリプトは汎用キット `~/.claude/skills/linear-setup/` にまとめ、`/linear-setup` で各リポジトリへ入れる。冪等で、既存ファイルは上書きしない
5. このリポジトリの既存スクリプトはキットへ移さない。役割ラベルや QA 起票など、ここにしか無い機能を持っているため

## 選ばなかった案
- 共有 npm パッケージ: サイト用の npm 依存追加を禁じる制約4に触れ、リポジトリごとの版管理も増える
- チーム全体を1つのブリーフィングで見る: アプリ間で警報が混ざる（#381 で実際に起きた）

## 見直す条件
キットを入れたリポジトリが3つを超え、テンプレートの手反映が負担になったとき

## 2026-10-07 追記: 全リポジトリへ導入
- 導入先と Project: 自動トークン節約・自動スリープスイッチ・その日の予約まとめ・CPU節約ツール（それぞれ同名）、AI動画作成（動画生成プロジェクト）。Project は削除予定だった空の KR 用4つを改名して使った（新規作成も削除もしない）
- 今後の新しいリポジトリも、最初に複数ステップの作業を始めるときに Claude が指示を待たずに導入する（グローバル CLAUDE.md）
- 作業ブランチの worktree では入れない。main に導入済みならその旨を表示して終わる（二重導入による競合を防ぐ）
- 5つとも GitHub のリモートが無い。そのため毎朝の通知（GitHub Actions）は動かず、知らせる経路はセッション開始時のブリーフィングだけになる。GitHub に置いたら `LINEAR_API_KEY` を登録すれば通知も動く

## 2026-10-07 追記2: 新しいアプリ・Codex にも自動で広げる
- オーナーの依頼「今後 Claude Code や Codex で作るアプリ・フォルダも Linear と連携させ、Project の立ち上げから起票まで任せたい」
- Project が無いときに毎回確認していたのをやめ、導入コマンド（`install.js`）が自分で作る。Orca CLI は Project を作れないため Linear API（`create_project.js`・同名があれば何もしない）を使う。API キー（`~/.config/linear/api_key`）が無い間は、Claude Code は Linear の画面で作り、Codex は利用者に頼む
- git でないフォルダにも入れる（毎朝の GitHub 監視だけ省く）。ホーム直下・Desktop/Documents/Downloads 直下・一時ディレクトリは拒否する
- Codex にも同じルールを `~/.codex/AGENTS.md` に置き、キットは `~/.codex/skills/linear-setup`（`~/.claude/skills/linear-setup` へのリンク）で共有する。ルールの本文は Claude Code と Codex で同じ
