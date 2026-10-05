# 0004 Linear に AI エージェントはつながない（課題IDを Claude Code に伝える運用を続ける）

- 日付: 2026-10-06
- 状態: 採用
- 関連: ISSUE-136（P-63）/ `docs/linear-ai-native-playbook.md` §4-6

## 背景
「担当がなぜ全部オーナーになっているか」という問いから、AI エージェントを Linear の担当にする案が出た。Linear ではエージェントは担当者ではなく委任先（delegate）になる。Anthropic 公式の Claude エージェントは Linear に無く、Claude Code を動かすのは第三者製の Cyrus。Cyrus には無料の自前運用（Community）と有料プラン（Pro $50/月〜）がある。

## 決めたこと
1. エージェントはつながない。課題IDを Claude Code に伝えて作業させる今の運用を続ける（オーナー選択「A」）。
2. 担当者は引き続きオーナー（`data/linear_issue_defaults.json` の既定値）。実際に作業したのが Claude であることは、PR とコメントで分かる。

## 選ばなかった案と理由
- **Cyrus を無料で自前運用する**: Mac を起こしたままにする必要があり、日次ジャーナルが止まったのと同じ故障（スリープ）を抱える。Linear と GitHub の連携アプリの作成・保守も増える。増える利点は「Linear の画面から直接頼める」ことだけ。
- **Cyrus 有料プラン**: 収益化前のサイトで、月 $50 に見合う使い道がまだない。

## 見直す条件
- Mac 以外の常時稼働の実行場所ができたとき。
- オーナー以外の人（Claude Code を使わない人）が Linear から作業を頼むようになったとき。
