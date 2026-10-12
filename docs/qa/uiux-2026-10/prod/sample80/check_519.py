# -*- coding: utf-8 -*-
import subprocess, re, sys, collections
from concurrent.futures import ThreadPoolExecutor
import os
HERE = os.path.dirname(os.path.abspath(__file__))
urls=[l.strip() for l in open(HERE + '/urls.txt') if l.strip()]
def get(u):
    r=subprocess.run(['curl','-s','-m','25',u],capture_output=True)
    return u, r.stdout.decode('utf-8','replace')
with ThreadPoolExecutor(8) as ex:
    res=list(ex.map(get,urls))
bars=collections.Counter(); phone=0; two=0; noloc=0; small=0; stub=0; nobtn=0
rows=[]
for u,h in res:
    if len(h)<3000: small+=1; continue
    if 'http-equiv="refresh"' in h or 'rel="canonical"' in h and 'noindex' in h and len(h)<6000: stub+=1
    n=len(re.findall(r'class="nb-action-bar"',h)); bars[n]+=1
    if n:
        seg=h[h.index('class="nb-action-bar"'):]
        seg=seg[:seg.index('</div>')+6] if '</div>' in seg else seg
        btn=len(re.findall(r'nb-bar-btn',h))
        ph='data-call-loc="store_page_bar"' in h
        if ph: phone+=1
        if 'store_page_bar' not in h: noloc+=1
        if btn<2: nobtn+=1
print('pages fetched:',len(res),'small/failed:',small,'stub-like:',stub)
print('action-bar count per page:',dict(bars))
print('pages with phone button in bar:',phone,'| pages w/o store_page_bar string:',noloc,'| bars with <2 buttons:',nobtn)
# --- 追加: ボタンが 2 個未満の帯の中身を出す（API キーは伏せる）
for u,h in res:
    if len(h)<3000 or 'class="nb-action-bar"' not in h: continue
    i=h.index('class="nb-action-bar"')
    j=h.index('</div>', i)
    seg=h[i-30:j+6]
    k=len(re.findall(r'<(?:a|button)\b[^>]*nb-bar-btn',seg))
    if k<2:
        print('---',u,'buttons in bar =',k)
        print(re.sub(r'A' + r'Iza[0-9A-Za-z_-]+','[KEY]',seg)[:900])
