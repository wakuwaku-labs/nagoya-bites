'use strict';
/**
 * 特集の「見出しの N選」と実際の掲載数の一致を検査する唯一の判定器（ISSUE-141）。
 * 判定は検証できる事実だけ（h1 の数字・JSON-LD ItemList の numberOfItems と要素数・
 * 店カード枚数）で行い、自己申告値は見ない（制約10）。
 * refresh_feature_rosters.js --check と tests/feature_counts.test.js が共有する。
 */
const fs = require('fs');
const path = require('path');

const FEATURES_DIR = path.join(__dirname, '..', '..', 'features');

function stripTags(s) { return String(s || '').replace(/<[^>]+>/g, ''); }

// h1 の「N選」を返す（無ければ null）
function h1Count(html) {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  if (!m) return null;
  const n = /(\d+)\s*選/.exec(stripTags(m[1]));
  return n ? parseInt(n[1], 10) : null;
}

// 店 ItemList（店ページへの要素を持つ、または name が「…N選」）の numberOfItems と要素数
function itemListInfo(html) {
  const re = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    let j; try { j = JSON.parse(m[1]); } catch (_) { continue; }
    if (j && j['@type'] === 'ItemList') {
      const els = Array.isArray(j.itemListElement) ? j.itemListElement : [];
      return { numberOfItems: j.numberOfItems, elements: els.length, name: j.name || '' };
    }
  }
  return null;
}

function cardCount(html) {
  return (html.match(/<div class="(?:shop-card|store-card)">/g) || []).length;
}

// 1ページの不整合を文字列配列で返す（空＝整合）
function inspect(html) {
  const problems = [];
  const n = h1Count(html);
  const il = itemListInfo(html);
  const cards = cardCount(html);
  if (n === null || !il) return { n, il, cards, problems };
  if (il.numberOfItems !== n) problems.push(`h1 は ${n}選 だが ItemList numberOfItems=${il.numberOfItems}`);
  if (il.elements !== il.numberOfItems) problems.push(`ItemList numberOfItems=${il.numberOfItems} だが要素数=${il.elements}`);
  if (cards > 0 && cards !== n) problems.push(`h1 は ${n}選 だが店カード=${cards}枚`);
  return { n, il, cards, problems };
}

function inspectAll(dir) {
  const d = dir || FEATURES_DIR;
  const out = [];
  for (const f of fs.readdirSync(d).filter(x => x.endsWith('.html') && x !== 'index.html')) {
    const r = inspect(fs.readFileSync(path.join(d, f), 'utf8'));
    if (r.problems.length) out.push({ file: f, problems: r.problems });
  }
  return out;
}

module.exports = { h1Count, itemListInfo, cardCount, inspect, inspectAll };
