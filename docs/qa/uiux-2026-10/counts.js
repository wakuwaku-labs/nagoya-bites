'use strict';
// UI・UX 改修計画（docs/uiux-overhaul-plan-2026-10.md）の数字を、手元のファイルだけで数え直す。
// 外部へは何も送らない。サイトのファイルは読むだけ。
// 使い方: node docs/qa/uiux-2026-10/counts.js   （リポジトリの直下で実行）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ls = d => fs.readdirSync(path.join(ROOT, d));
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : '-');

const storesRaw = JSON.parse(rd('data/stores.json'));
const stores = Array.isArray(storesRaw) ? storesRaw : (storesRaw.stores || Object.values(storesRaw));

// 店舗ページ（誘導ページを除く）
const storePages = ls('stores')
  .filter(f => f.endsWith('.html') && f !== 'index.html')
  .map(f => ({ slug: f.replace(/\.html$/, ''), html: rd('stores/' + f) }))
  .filter(p => !p.html.includes('nb-orphan-redirect'));

const out = {};

// U-01 選び方の言い方（人が選んだ・書いたと読める語）を含む HTML
const PHRASES = ['現役の飲食店マネージャー', '現役飲食店マネージャー', '現役の店長', '飲食のプロ', '業界人', '飲食業界の中の人', '現役飲食人', '業界視点'];
{
  const walk = (d, acc) => {
    for (const f of ls(d)) {
      const p = path.join(d, f);
      if (/^(node_modules|\.git|docs|tests|scripts|\.github|\.claude|agents|data)$/.test(f)) continue;
      const st = fs.statSync(path.join(ROOT, p));
      if (st.isDirectory()) walk(p, acc);
      else if (f.endsWith('.html')) acc.push(p);
    }
    return acc;
  };
  const files = walk('.', []);
  let hit = 0;
  const byPhrase = {};
  for (const f of files) {
    const h = rd(f);
    let any = false;
    for (const w of PHRASES) {
      const n = h.split(w).length - 1;
      if (n) { byPhrase[w] = (byPhrase[w] || 0) + n; any = true; }
    }
    if (any) hit++;
  }
  out['U-01 言い方を含む HTML'] = { html: files.length, hit, pct: pct(hit, files.length), byPhrase };
}

// U-31 「この店舗が登場する特集」のうち、その特集が実際にその店を載せているもの
{
  const featStores = {};
  for (const f of ls('features').filter(f => f.endsWith('.html'))) {
    const s = new Set();
    for (const m of rd('features/' + f).matchAll(/stores\/([A-Za-z0-9_-]+)\.html/g)) s.add(m[1]);
    featStores[f] = s;
  }
  let pages = 0, links = 0, hit = 0, zero = 0;
  for (const p of storePages) {
    const m = p.html.match(/<div class="related-features">([\s\S]*?)<\/div>/);
    if (!m) continue;
    pages++;
    let ph = 0, pl = 0;
    for (const a of m[1].matchAll(/features\/([^"#]+\.html)/g)) {
      pl++; links++;
      if (featStores[a[1]] && featStores[a[1]].has(p.slug)) { hit++; ph++; }
    }
    if (pl && !ph) zero++;
  }
  out['U-31 載っている特集の案内'] = { pages, links, actuallyListed: hit, pct: pct(hit, links), pagesWithNone: zero, pctPages: pct(zero, pages) };
}

// U-35 似た店のリンクの集まり方
{
  const cnt = {};
  let links = 0;
  for (const p of storePages) {
    const i = p.html.indexOf('class="related-stores"');
    if (i < 0) continue;
    let j = p.html.indexOf('class="back-section"', i);
    if (j < 0) j = i + 6000;
    for (const a of p.html.slice(i, j).matchAll(/href="(?:\.\.\/stores\/|\.\/)?([A-Za-z0-9_-]+)\.html"/g)) {
      cnt[a[1]] = (cnt[a[1]] || 0) + 1; links++;
    }
  }
  const v = Object.values(cnt).sort((a, b) => b - a);
  const top50 = v.slice(0, 50).reduce((a, b) => a + b, 0);
  out['U-35 似た店のリンク'] = { links, targets: v.length, pctTargets: pct(v.length, storePages.length), top50Share: pct(top50, links), max: v[0] };
}

// U-71 店舗ページの title の長さ（文字参照は1文字として数える）
{
  const L = [];
  for (const p of storePages) {
    const m = p.html.match(/<title>([^<]*)<\/title>/);
    if (m) L.push([...m[1].replace(/&[a-z]+;|&#\d+;/g, 'x')].length);
  }
  L.sort((a, b) => a - b);
  const over = L.filter(x => x > 60).length;
  out['U-71 title の長さ'] = { pages: L.length, median: L[L.length >> 1], over60: over, pct: pct(over, L.length), max: L[L.length - 1] };
}

// U-73 構造化データの geo
{
  const c = {};
  let g = 0;
  for (const p of storePages) {
    const m = p.html.match(/"geo"\s*:\s*\{[^}]*?"latitude"\s*:\s*"?([\d.]+)"?\s*,\s*"longitude"\s*:\s*"?([\d.]+)/);
    if (m) { g++; const k = m[1] + ',' + m[2]; c[k] = (c[k] || 0) + 1; }
  }
  const top = Object.entries(c).sort((a, b) => b[1] - a[1]);
  out['U-73 geo'] = { pages: storePages.length, withGeo: g, distinct: top.length, mostShared: top[0] };
}

// U-32・U-33・U-36 データ
{
  const has = k => stores.filter(s => s[k] !== undefined && s[k] !== null && String(s[k]).trim() !== '').length;
  const fields = {};
  for (const k of ['定休日', '席数', '禁煙', 'カード可', '宴会収容', '駐車場', '営業ステータス', '電話']) fields[k] = has(k);
  const closedTemp = stores.filter(s => s['営業ステータス'] === 'CLOSED_TEMPORARILY').length;
  const halfKana = stores.filter(s => /[｡-ﾟ]/.test(s['エリア'] || '')).length;
  const places = stores.filter(s => /googleusercontent|maps\.googleapis/.test(s['写真URL'] || ''));
  const origin = {};
  for (const s of places) { const k = s['写真出所'] || '(記録なし)'; origin[k] = (origin[k] || 0) + 1; }
  out['データ'] = { stores: stores.length, fields, closedTemp, halfKanaArea: halfKana, pctHalfKana: pct(halfKana, stores.length), googlePhotoStores: places.length, googlePhotoOrigin: origin };
}

console.log(JSON.stringify(out, null, 1));
