# 0001 Linear 運用を指示なしで回す

- 日付: 2026-10-06
- 状態: 採用
- 関連: `docs/linear-ai-native-playbook.md` / `CLAUDE.md`「自動で回す運用」/ `scripts/session_briefing.js` / `data/linear_issue_defaults.json`

## 背景
オーナーから「おはよう・Linearにして・分解して・振り返って・判断を残して、をいちいち指示しないで済むようにしてほしい。Claude が判断して逐次やってほしい」と依頼があった。手本は YouTube「ClaudeをLinearに住まわせる」。

## 決めたこと
1. セッション開始時のブリーフィングは `.claude/settings.json` の SessionStart フックで `scripts/session_briefing.js` を毎回実行する。Claude の記憶や心がけには頼らない。
2. 起票・分解・振り返り・判断記録は `CLAUDE.md` の「自動で回す運用」を根拠に、Claude が自分で判断して行う。
3. 新規 Issue の既定値は次のとおり。
   - 担当: 唯一のメンバー（オーナー）
   - 期限: 起票日に優先度ごとの日数を足す（P0=1日 / P1=7日 / P2=14日 / P3=30日）
   - 指定済みの値は既定値より優先する
4. Project は推測で埋めない。設定された規則（0002）だけで決める。

## 選ばなかった案と理由
- **「おはよう」等の合言葉を CLAUDE.md に書くだけ**: オーナーの依頼そのもの（言わなくて済むようにする）を満たさない。
- **Project を Claude が作って割り振る**: Orca CLI に Project 作成機能がなく、ローカルに Linear API キーもない。また KR（何を目標にするか）はオーナーの判断。
- **期限を検出日起点にする**: 古い課題を起票すると作成時点で期限切れになり、ブリーフィングが鳴りっぱなしになる。

## 見直す条件
- 期限切れがブリーフィングに常時5件以上出る（日数が短すぎる）
- Project の割り振り方は [0002](0002-linear-projects-as-krs.md) で決定済み
