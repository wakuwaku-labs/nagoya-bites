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
ORDER=['営業時間','定休日','席数','宴会の収容人数','禁煙・喫煙','カード','駐車場','アクセス・特徴']
c=collections.Counter(); bad=[]; vals=collections.defaultdict(list)
for u,h in res:
    if len(h)<3000: c['short']+=1; continue
    cells=re.findall(r'<div class="info-cell"><label>(.*?)</label><span>(.*?)</span></div>',h,re.S)
    labels=[html.unescape(a) for a,b in cells]
    for a,b in cells:
        a=html.unescape(a); b=html.unescape(re.sub(r'<[^>]+>','',b)).strip()
        c['label:'+a]+=1
        if not b or re.search(r'undefined|null|NaN',b): bad.append((u.split('/')[-1],a,b))
        if a in ('定休日','席数','宴会の収容人数','禁煙・喫煙','カード','駐車場'): vals[a].append(b)
    idx=[labels.index(l) for l in ORDER if l in labels]
    if idx!=sorted(idx): bad.append((u.split('/')[-1],'order',labels))
    if '定休日' in labels and labels.index('定休日')!=labels.index('営業時間')+1: bad.append((u.split('/')[-1],'定休日 not after 営業時間',labels))
    if labels and labels[-1]!='アクセス・特徴' and 'アクセス・特徴' in labels: bad.append((u.split('/')[-1],'access not last',labels))
print({k:v for k,v in sorted(c.items())}); print('anomalies:',bad[:6])
for k in ('定休日','席数','宴会の収容人数','禁煙・喫煙','カード','駐車場'):
    cnt=collections.Counter(vals[k]); print(k,len(vals[k]),'pages;',dict(cnt.most_common(5)) if k!='駐車場' else [x[:30] for x in list(cnt)[:4]])
