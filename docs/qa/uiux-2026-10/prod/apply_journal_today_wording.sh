#!/bin/zsh
# P-335（計画 4.4 節 #10）: journal-today.md の言い方を、オーナーの指示に合わせて直し、PR を出す。
#
# なぜオーナーが実行するのか: .claude/commands/journal-today.md は、Claude の自己改変ブロックで Claude が編集できない。
# このスクリプトはオーナーの端末で、オーナーが 1 回だけ実行する（Claude は実行しない）。
#
# 使い方（Claude Code の入力欄に、次の 1 行をそのまま貼る）:
#   ! zsh /Users/katagirijakutou/orca/workspaces/nagoya-bites/mooneye/docs/qa/uiux-2026-10/prod/apply_journal_today_wording.sh
# 先に確かめるだけなら、末尾に --dry-run を付ける（直した差分を見せて、コミットも push もしない）。
#
# やること:
#   1. origin/main から一時の作業用 worktree を作る（いまの作業ツリーには触れない）
#   2. journal-today.md と Codex 用の写し（.agents/skills/source-command-journal-today/SKILL.md）の 3 か所ずつを直す
#      （p335_replace.py。文がちょうど 1 回ずつ見つからなければ、どちらも書き換えずに止まる）
#        ・「業界人視点の切り口を1行」→「切り口を1行」
#        ・「回転意識を業界人視点で」→「回転意識を運営の面から」
#        ・「- 「業界人」「編集部」で統一」→「- 署名は「編集部」で統一（個人名・肩書は書かない）」
#   3. ブランチ wakuwaku-labs/p335-journal-today-wording をコミットして push し、PR を出す（マージは Claude が行う）
# 直したあと、生成ラッパー（scripts/run_journal_local.sh）の「言葉の決まり」のうち、読み替えの一文は消してよい（Claude が行う）。
set -u
dry=0; [[ ${1:-} == --dry-run ]] && dry=1
REPO=wakuwaku-labs/nagoya-bites
BR=wakuwaku-labs/p335-journal-today-wording
# 直すファイル。P335_TARGETS で替えられるのは、流れ（worktree・差分・片付け）だけを試すときのため
targets=(.claude/commands/journal-today.md .agents/skills/source-command-journal-today/SKILL.md)
[[ -n ${P335_TARGETS:-} ]] && targets=(${=P335_TARGETS})
here=${0:A:h}
cd "$here" || exit 1
top=$(git rev-parse --show-toplevel) || exit 1
cd "$top" || exit 1

git fetch origin -q || { echo "git fetch に失敗した"; exit 1; }
if git show-ref --verify --quiet "refs/heads/$BR" || git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then
  echo "ブランチ $BR は既にあります。前回の実行の PR が出ていないか確かめてください: gh pr list --repo $REPO --head $BR"
  exit 1
fi
tmp=$(mktemp -d "${TMPDIR:-/tmp}/nb-p335.XXXXXX") || exit 1
wt=$tmp/wt
git worktree add -q -b "$BR" "$wt" origin/main || { rmdir "$tmp" 2>/dev/null; exit 1; }
cleanup() {
  cd "$top" && git worktree remove --force "$wt" >/dev/null 2>&1
  rm -rf "$tmp"
  (( dry )) && git branch -D "$BR" >/dev/null 2>&1
}
trap cleanup EXIT

cd "$wt" || exit 1
python3 "$top/docs/qa/uiux-2026-10/prod/p335_replace.py" "${targets[@]}" || { echo "止まりました（何も書き換えていません）"; exit 1; }
echo "---- 差分 ----"
git --no-pager diff --stat
git --no-pager diff -U0 | grep -E '^[-+]' | grep -vE '^(\+\+\+|---) ' | cut -c1-160
if (( dry )); then echo "dry-run: ここまで。コミットも push もしていません。"; exit 0; fi

cat > "$tmp/msg.txt" <<'MSG'
docs(P-335): journal-today.md の言い方を、店の選び方の決まりに合わせる（業界人視点 → 切り口、署名は編集部で統一）

オーナーの指示（2026-10-11）「店舗の選定にはAIによる情報収集・分析を活用しています。人間の飲食業界関係者が
すべての店舗を選定しているような表現は使用しないでください。」に合わせ、日次ジャーナルの手順書にあった
人が選んだ・書いたと読める言い方を直す（計画 4.4 節 #10）。.claude/ は Claude の自己改変ブロックで編集できないため、
オーナーが p335_replace.py を実行して直した。Codex 用の写しも同じ 3 か所を直した。

- 候補の angle の例: 「業界人視点の切り口を1行」→「切り口を1行」
- 独自性3要件の「オペの裏側」: 「回転意識を業界人視点で」→「回転意識を運営の面から」（agents/editor.md と同じ）
- 匿名運営の維持: 「『業界人』『編集部』で統一」→「署名は『編集部』で統一（個人名・肩書は書かない）」（agents/editor.md と同じ）

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
MSG
git add "${targets[@]}" || exit 1
git commit -q -F "$tmp/msg.txt" -- "${targets[@]}" || exit 1
git push -q -u origin "$BR" || { echo "push に失敗した"; exit 1; }

cat > "$tmp/body.md" <<'BODY'
## 概要

Linear P-335（親 P-235・計画 4.4 節 #10）。`.claude/commands/journal-today.md`（日次ジャーナルの手順書）に残っていた、人が選んだ・書いたと読める言い方 3 か所を直します。`.claude/` は Claude の自己改変ブロックで Claude が編集できないため、オーナーが `docs/qa/uiux-2026-10/prod/apply_journal_today_wording.sh` を実行して作った PR です。Codex 用の写し（`.agents/skills/source-command-journal-today/SKILL.md`）も同じ 3 か所を直しています。

## 直した 3 か所

- 候補の angle の例: 「業界人視点の切り口を1行」→「切り口を1行」
- 独自性3要件の「オペの裏側」: 「回転意識を業界人視点で」→「回転意識を運営の面から」（`agents/editor.md` と同じ）
- 匿名運営の維持: 「『業界人』『編集部』で統一」→「署名は『編集部』で統一（個人名・肩書は書かない）」（`agents/editor.md` と同じ）

## 関係すること

- 採点の「語を入れると点が上がる」加点は #544（P-333）で廃止済み。生成ラッパーの「言葉の決まり」は #545（P-335 の橋渡し）。この PR をマージしたら、ラッパーの読み替えの一文だけを消してよい（Claude が行う）。
- 手順書の文面以外（手順・ゲート・採点）は変えていません。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
gh pr create --repo "$REPO" --base main --head "$BR" --title "docs(P-335): journal-today.md の言い方を、店の選び方の決まりに合わせる（業界人視点 → 切り口、署名は編集部で統一）" --body-file "$tmp/body.md" || { echo "PR の作成に失敗した（ブランチは push 済み）"; exit 1; }
echo "完了: PR を出しました。Claude にそう伝えてください（マージは Claude が行います）。"
