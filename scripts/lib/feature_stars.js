'use strict';
/**
 * 特集の本文にある「★4.x」と、いまのデータ（data/stores.json の Google評価）の照合（基本方針 段階1 S1-1）。
 * ★の直前600字以内で、いちばん近くに出る店名で店を対応づける。対応づけられない★は判定しない。
 * 判定: 'ok'（一致）／'mismatch'（データと違う）／'nodata'（データに評価が無い）。
 */
const fs = require('fs');
const path = require('path');

function loadStores(root) {
  const list = JSON.parse(fs.readFileSync(path.join(root, 'data', 'stores.json'), 'utf8'));
  const byName = new Map();
  for (const s of list) {
    if (!s['店名'] || String(s['店名']).replace(/\s/g, '').length < 4) continue;
    byName.set(String(s['店名']).replace(/\s+/g, ' ').trim(), s);
  }
  return byName;
}

function normRating(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const __namesCache = new WeakMap();
// 別の店名の一部になっている名前（例:「味噌とんちゃん屋」）は、本文中の普通の語と区別できないので対応づけに使わない
function matchNames(byName) {
  if (__namesCache.has(byName)) return __namesCache.get(byName);
  const all = [...byName.keys()];
  const joined = all.join('\n');
  const names = all.filter((n) => joined.indexOf(n) === joined.lastIndexOf(n)).sort((a, b) => b.length - a.length);
  __namesCache.set(byName, names);
  return names;
}

// 本文の各★を判定して返す: [{ line, shown, store, actual, verdict, text }]
function scanFeatureStars(html, byName) {
  const out = [];
  const names = matchNames(byName);
  const re = /★\s?(\d(?:\.\d)?)/g;
  let m;
  while ((m = re.exec(html))) {
    const from = Math.max(0, m.index - 600);
    const before = html.slice(from, m.index).replace(/\s+/g, ' ');
    let best = null;
    for (const n of names) {
      const i = before.lastIndexOf(n);
      if (i >= 0 && (!best || i > best.i)) best = { i, n };
    }
    if (!best) continue;
    const s = byName.get(best.n);
    const actual = normRating(s['Google評価']);
    const shown = parseFloat(m[1]);
    const line = html.slice(0, m.index).split('\n').length;
    let verdict = 'ok';
    if (actual === null) verdict = 'nodata';
    else if (Math.abs(actual - shown) > 0.05) verdict = 'mismatch';
    out.push({ line, shown, store: best.n, actual, verdict, index: m.index });
  }
  return out;
}

module.exports = { loadStores, scanFeatureStars, normRating };
