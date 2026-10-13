#!/usr/bin/env python3
"""P-335（#10）: journal-today.md（と Codex 用の写し）の言い方 3 か所を直す。

使い方: python3 p335_replace.py <ファイル> [<ファイル> ...]
先にすべてのファイルを調べ、3 つの置き換えがどれも「ちょうど 1 回」でなければ（もう直してある・文が変わっている）、
どのファイルも書き換えずに、理由を出して exit 1。全部そろっていれば、すべて書き換える（途中までにはならない）。
直したあとに残る「業界人」「現役」「目利き」の行も出す。
"""
import io
import re
import sys

# (理由, 古い文, 新しい文)。古い文は、ファイルの中にちょうど 1 回だけある
REPLACEMENTS = [
    ("候補の angle の例（業界人視点 → 切り口）",
     "業界人視点の切り口を1行",
     "切り口を1行"),
    ("独自性3要件の「オペの裏側」（業界人視点で → 運営の面から）",
     "回転意識を業界人視点で",
     "回転意識を運営の面から"),
    ("匿名運営の維持（「業界人」「編集部」で統一 → 署名は「編集部」で統一）",
     "- 「業界人」「編集部」で統一",
     "- 署名は「編集部」で統一（個人名・肩書は書かない）"),
]
LEFTOVER = re.compile(r"業界人|現役|目利き")


def main(paths):
    texts = {}
    bad = 0
    for p in paths:
        s = io.open(p, encoding="utf-8").read()
        texts[p] = s
        for why, old, _new in REPLACEMENTS:
            n = s.count(old)
            if n != 1:
                print("NG  %s: 「%s」が %d 回ある（1 回のはず）— %s" % (p, old, n, why))
                bad += 1
    if bad:
        print("どのファイルも書き換えていません。")
        return 1
    for p, s in texts.items():
        for _why, old, new in REPLACEMENTS:
            s = s.replace(old, new)
        io.open(p, "w", encoding="utf-8").write(s)
        left = [(i + 1, l.strip()[:120]) for i, l in enumerate(s.split("\n")) if LEFTOVER.search(l)]
        print("OK  %s: 3 か所を直した。残る「業界人・現役・目利き」の行: %d" % (p, len(left)))
        for n, l in left:
            print("      L%d %s" % (n, l))
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1:]))
