# -*- coding: utf-8 -*-
# #528（P-313）の確認: 店舗ページの下の帯の読み上げ名（aria-label）が、帯に実際にあるボタンと一致するか。
# 標本 80 本（urls.txt）を curl で読み、帯の中の予約・電話・地図のボタンの有無から期待の名前を作って突き合わせる。
import subprocess, re, sys, collections, os, html
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
urls = [l.strip() for l in open(HERE + '/urls.txt') if l.strip()]

def get(u):
    r = subprocess.run(['curl', '-s', '-m', '25', u], capture_output=True)
    return u, r.stdout.decode('utf-8', 'replace')

with ThreadPoolExecutor(8) as ex:
    res = list(ex.map(get, urls))

kinds = collections.Counter()
bad = []
nobar = 0
small = 0
for u, h in res:
    if len(h) < 3000:
        small += 1
        continue
    m = re.search(r'<div class="nb-action-bar" role="region" aria-label="([^"]*)">', h)
    if not m:
        nobar += 1
        continue
    label = html.unescape(m.group(1))
    seg = h[m.end():h.index('</div>', m.end())]
    has_reserve = 'nb-bar-reserve' in seg
    has_tel = 'nb-bar-tel' in seg
    has_map = 'nb-bar-map' in seg
    names = '・'.join([n for n, ok in (('予約', has_reserve), ('電話', has_tel), ('地図', has_map)) if ok])
    kinds[names] += 1
    if not label.endswith('の' + names):
        bad.append((u, label, names))
print('pages fetched:', len(res), '| small/failed:', small, '| no action bar:', nobar)
print('bar kinds (ボタンの組み合わせ):', dict(kinds))
print('label/button mismatches:', len(bad))
for u, label, names in bad[:20]:
    print('  ', u, '| label =', label, '| buttons =', names)
sys.exit(1 if bad or small else 0)
