# -*- coding: utf-8 -*-
import subprocess, re, collections, html
from concurrent.futures import ThreadPoolExecutor
import os
HERE = os.path.dirname(os.path.abspath(__file__))
urls=[l.strip() for l in open(HERE + '/urls.txt') if l.strip()]
def get(u):
    return u, subprocess.run(['curl','-s','-m','25',u],capture_output=True).stdout.decode('utf-8','replace')
with ThreadPoolExecutor(8) as ex:
    res=list(ex.map(get,urls))
c=collections.Counter(); facts=[]; chips_all=collections.Counter(); bad=[]
for u,h in res:
    if len(h)<3000: c['short']+=1; continue
    m=re.search(r'<div class="store-glance">(.*?)</div>\s*(?=<)',h,re.S)
    if '<div class="store-glance">' not in h: c['no_glance']+=1; continue
    c['glance']+=1
    seg=h[h.index('<div class="store-glance">'):]
    seg=seg[:seg.index('<h2')] if '<h2' in seg else seg[:2500]
    f=re.search(r'<p class="store-facts">(.*?)</p>',seg,re.S)
    if f: c['facts']+=1; facts.append(html.unescape(f.group(1)))
    ch=re.findall(r'<li>(.*?)</li>',re.search(r'<ul class="store-chips".*?</ul>',seg,re.S).group(0),re.S) if '<ul class="store-chips"' in seg else []
    if ch: c['chips']+=1
    if len(ch)>4: bad.append((u,'chips>4'))
    for x in ch: chips_all[html.unescape(x)]+=1
    if re.search(r'<a\b|<button\b',seg): bad.append((u,'clickable in glance'))
    if re.search(r'undefined|null|NaN|不明',seg): bad.append((u,'bad text'))
    if 'class="score-note"' in seg: c['score_note']+=1
print(dict(c)); print('anomalies:',bad[:6])
print('chips:',dict(chips_all.most_common(12)))
import random
random.seed(3); print('facts sample:'); [print('  -',x) for x in random.sample(facts,min(14,len(facts)))]
