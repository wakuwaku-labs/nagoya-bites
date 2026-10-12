# -*- coding: utf-8 -*-
import subprocess, re, collections, html, json
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor
import os
HERE = os.path.dirname(os.path.abspath(__file__))
urls=[l.strip() for l in open(HERE + '/urls.txt') if l.strip()]
def get(u):
    return u, subprocess.run(['curl','-s','-m','25','-L',u],capture_output=True).stdout.decode('utf-8','replace')
with ThreadPoolExecutor(8) as ex:
    res=list(ex.map(get,urls))
c=collections.Counter(); bad=[]; hubs={}
rows=[]
for u,h in res:
    if len(h)<3000: c['short']+=1; continue
    m=re.search(r'<div class="breadcrumb">(.*?)</div>',h,re.S)
    if not m: c['no_breadcrumb']+=1; continue
    links=re.findall(r'<a href="([^"]+)">(.*?)</a>',m.group(1),re.S)
    hub=[(href,html.unescape(re.sub(r'<[^>]+>','',t)).strip()) for href,t in links if 'stores/area/' in href]
    if not hub:
        c['no_hub_link']+=1; continue
    href,text=hub[0]
    hubu=urljoin(u,href)
    # JSON-LD の2番目の名前
    ld=None
    for blk in re.findall(r'<script type="application/ld\+json">(.*?)</script>',h,re.S):
        try:
            j=json.loads(blk)
        except Exception: continue
        for o in (j if isinstance(j,list) else [j]):
            if o.get('@type')=='BreadcrumbList':
                ld=o['itemListElement'][1]['name']
    more=re.search(r'<a href="[^"]*stores/area/[^"]*">\s*(?:←\s*)?([^<]*?)をもっと見る</a>',h,re.S)
    rows.append((u,hubu,text,ld,html.unescape(more.group(1)).strip() if more else None))
uh=sorted({r[1] for r in rows})
with ThreadPoolExecutor(8) as ex:
    hh=dict(ex.map(get,uh))
for u,hubu,text,ld,more in rows:
    t=hh.get(hubu,'')
    m=re.search(r'<h1[^>]*>(.*?)</h1>',t,re.S)
    h1=html.unescape(re.sub(r'<[^>]+>','',m.group(1))).strip() if m else None
    ok_hub = (h1 is not None and re.sub(r'\s+','',h1)==re.sub(r'\s+','',text))
    c['crumb_eq_hub_h1' if ok_hub else 'crumb_ne_hub_h1']+=1
    c['ld_eq' if ld==text else 'ld_ne']+=1
    c['more_eq' if more==text else 'more_ne']+=1
    if not ok_hub or ld!=text or more!=text: bad.append((u.split('/')[-1],text,h1,ld,more))
print(dict(c)); print('anomalies:',len(bad))
for b in bad[:6]: print('  ',tuple(str(x)[:60] for x in b))
print('sample labels:',[r[2] for r in rows[:6]])
