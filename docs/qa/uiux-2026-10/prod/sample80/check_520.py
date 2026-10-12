# -*- coding: utf-8 -*-
import subprocess, re, collections
from concurrent.futures import ThreadPoolExecutor
import os
HERE = os.path.dirname(os.path.abspath(__file__))
urls=[l.strip() for l in open(HERE + '/urls.txt') if l.strip()]
def get(u):
    return u, subprocess.run(['curl','-s','-m','25',u],capture_output=True).stdout.decode('utf-8','replace')
with ThreadPoolExecutor(8) as ex:
    res=list(ex.map(get,urls))
c=collections.Counter(); bad=[]
for u,h in res:
    if len(h)<3000: c['short']+=1; continue
    has_tb='<div class="trust-breakdown">' in h
    det=len(re.findall(r'<details class="trust-details">',h))
    opened=bool(re.search(r'<details class="trust-details"[^>]*\bopen\b',h))
    old=bool(re.search(r'trust-axis-row',h)) and det==0
    if has_tb: c['has_breakdown']+=1
    if det==1: c['one_details']+=1
    if det>1: bad.append((u,'details>1'))
    if opened: bad.append((u,'open'))
    if has_tb and det==0: bad.append((u,'breakdown without details'))
    if '口コミ信頼度の内訳' in h and '<h2>口コミ信頼度</h2>' not in h: bad.append((u,'old h2'))
print(dict(c)); print('anomalies:',bad[:6])
