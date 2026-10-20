# ロゴ（NAGOYA BITES）の文字を輪郭にした SVG を作る（P-321・判断の記録 0053）。
# 使い方: python3 scripts/gen_logo_svg.py <Cormorant Garamond の可変 TTF> <出力 SVG>
# 出力はそのまま assets/css/nb.css の .logo の background-image（data URI）に貼る。色は固定（ダークモードは無い）
# 書体は SIL Open Font License 1.1（Cormorant Project Authors）。輪郭にした SVG だけをリポジトリに置く。
# fontTools は作る時だけ使う（サイトの依存ではない）。
import re, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

SRC, OUT = sys.argv[1], sys.argv[2]
font = instantiateVariableFont(TTFont(SRC), {"wght": 400})
gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
upm = font["head"].unitsPerEm
TRACK = 0.2 * upm  # CSS の letter-spacing:.2em と同じ
asc = 0.75 * upm   # 大文字の高さに少し余白
def run(text, x):
    parts = []
    for ch in text:
        if ch == " ":
            x += hmtx[cmap[32]][0] + TRACK; continue
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        parts.append(re.sub(r"-?\d+\.\d+", lambda m: str(round(float(m.group()))), pen.getCommands()))
        x += hmtx[name][0] + TRACK
    return " ".join(parts), x
a, x = run("NAGOYA", 0)
x0 = x
b, end = run("BITES", x + hmtx[cmap[32]][0] - 0)
w = end - TRACK
top = -0.72 * upm; h = 0.72 * upm + 0.02 * upm
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {top:.0f} {w:.0f} {h:.0f}" role="img" aria-label="NAGOYA BITES">'
       f'<path fill="#0a0a08" d="{a}"/><path fill="#7a5c10" d="{b}"/></svg>')
open(OUT, "w").write(svg + "\n")
print(len(svg), "bytes; viewBox", f"{w:.0f}x{h:.0f}")
