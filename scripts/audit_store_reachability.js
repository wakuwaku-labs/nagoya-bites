#!/usr/bin/env node
'use strict';
/**
 * scripts/audit_store_reachability.js（I-25・判断の記録 0039）
 *
 * トップから店舗ページまで、<a href> を何回たどれば着くか（クリックの深さ）を数える読み取り専用の監査。
 * トップの「全店の索引」（店舗ページへのリンク 4,848 本）をエリア別の一覧ページへのリンクに置き換えると、
 * 店舗ページへの道が「トップ → 店」から「トップ → 一覧 → 店」に変わる。そのとき、どの店が何回で着くか・
 * どの店に着けなくなるかを、置き換えの前後で同じ数え方で比べるための道具（サイトマップには全店が残る）。
 *
 * 数え方（検証できる事実だけ・制約10）:
 *   ・公開ページ（scripts/lib/published_pages.js の一覧）の <a href> だけをたどる。JSON-LD・sitemap.xml は数えない
 *   ・トップ（index.html）が深さ 0。店舗ページは「現役のページ」だけを数える（誘導ページ＝古い ID の軽いページは数えない）
 *   ・「掲載中の店」は data/stores.json の店のうち、現役の店舗ページ（stores/<ホットペッパーID>.html）を持つもの。
 *     掲載から外れた店の孤児ページは「現役の店舗ページ全体」のほうにだけ入る
 *
 * 使い方:
 *   node scripts/audit_store_reachability.js                      # 深さの分布
 *   node scripts/audit_store_reachability.js --list               # 届かない掲載中の店の一覧も出す
 *   node scripts/audit_store_reachability.js --json               # JSON だけ
 *   node scripts/audit_store_reachability.js --top-file <path>    # トップだけ別の版（例: git show main:index.html の保存先）で数える
 */
const fs = require('fs');
const path = require('path');
const { listPublishedPages } = require('./lib/published_pages');
const { isRedirectStub } = require('./lib/store_orphans');

const ROOT = path.join(__dirname, '..');
const START = 'index.html';

/** href を、公開ページの相対パス（例 stores/J001.html）にする。サイト内のリンクでなければ null */
function resolveHref(fromRel, href) {
  if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return null;
  let target;
  const site = href.match(/^https?:\/\/(?:www\.)?nagoya-bites\.com(\/[^#?]*)?/i);
  if (site) target = (site[1] || '/').replace(/^\//, '');
  else if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return null;
  else {
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) return null;
    target = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), clean));
  }
  if (target === '' || target === '.' || target === './') target = START;
  if (target.endsWith('/')) target += 'index.html';
  return target;
}

/** @returns {{adj: Map<string, Set<string>>, stubs: Set<string>}} 公開ページ同士の <a href> のつながり */
function buildGraph(pages, { topFile = null, read = (abs) => fs.readFileSync(abs, 'utf8') } = {}) {
  const rels = new Set(pages.map((p) => p.rel));
  const adj = new Map();
  const stubs = new Set();
  const re = /<a\b[^>]*?\bhref="([^"]*)"/g;
  for (const p of pages) {
    const html = read(p.rel === START && topFile ? topFile : p.abs);
    if (p.type === 'store' && isRedirectStub(html)) stubs.add(p.rel);
    const out = new Set();
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(html))) {
      const t = resolveHref(p.rel, m[1].replace(/&amp;/g, '&'));
      if (t && t !== p.rel && rels.has(t)) out.add(t);
    }
    adj.set(p.rel, out);
  }
  return { adj, stubs };
}

/** 幅優先探索。start からの深さ（start = 0）。届かないページは入らない */
function bfsDepths(adj, start = START) {
  const depth = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of adj.get(cur) || []) {
      if (depth.has(next)) continue;
      depth.set(next, depth.get(cur) + 1);
      queue.push(next);
    }
  }
  return depth;
}

/** 深さの分布 { '1': n, '2': n, …, unreachable: n }（キーは小さい順・unreachable は最後） */
function distribution(rels, depth) {
  const d = {};
  for (const rel of rels) {
    const k = depth.has(rel) ? String(depth.get(rel)) : 'unreachable';
    d[k] = (d[k] || 0) + 1;
  }
  const keys = Object.keys(d).sort((a, b) => (a === 'unreachable') - (b === 'unreachable') || Number(a) - Number(b));
  return Object.fromEntries(keys.map((k) => [k, d[k]]));
}

/**
 * @param {{rel:string,type:string}[]} pages
 * @param {{adj:Map, stubs:Set}} graph
 * @param {Set<string>} publicRels 掲載中の店の店舗ページのパス（stores/<ID>.html）
 */
function summarize(pages, graph, publicRels) {
  const depth = bfsDepths(graph.adj);
  const active = pages.filter((p) => p.type === 'store' && !graph.stubs.has(p.rel)).map((p) => p.rel);
  const publicActive = active.filter((rel) => publicRels.has(rel));
  const otherByType = {};
  for (const p of pages) {
    if (p.type === 'store') continue;
    (otherByType[p.type] = otherByType[p.type] || []).push(p.rel);
  }
  return {
    publicStorePages: publicActive.length,
    depthOfPublicStorePages: distribution(publicActive, depth),
    activeStorePages: active.length,
    depthOfActiveStorePages: distribution(active, depth),
    otherPagesDepthByType: Object.fromEntries(Object.entries(otherByType).map(([t, rels]) => [t, distribution(rels, depth)])),
    unreachablePublic: publicActive.filter((rel) => !depth.has(rel)),
  };
}

function main() {
  const args = process.argv.slice(2);
  const ti = args.indexOf('--top-file');
  const topFile = ti >= 0 ? path.resolve(args[ti + 1] || '') : null;
  if (ti >= 0 && (!args[ti + 1] || !fs.existsSync(topFile))) {
    console.error('--top-file にはトップの HTML のパスを渡してください');
    process.exit(2);
  }
  const { loadStores } = require('./lib/load_stores');
  const stores = loadStores();
  const names = new Map(stores.filter((s) => s['ホットペッパーID']).map((s) => [`stores/${s['ホットペッパーID']}.html`, s['店名'] || '']));
  const pages = listPublishedPages({ root: ROOT });
  const graph = buildGraph(pages, { topFile });
  const r = summarize(pages, graph, new Set(names.keys()));
  if (args.includes('--json')) {
    console.log(JSON.stringify({ topFile: topFile ? path.basename(topFile) : START, ...r }, null, 2));
    return;
  }
  const line = (d) => Object.entries(d).map(([k, n]) => `${k === 'unreachable' ? '届かない' : `深さ ${k}`}: ${n}`).join(' / ');
  console.log(`トップから店舗ページまで、リンクを何回たどれば着くか（<a href> だけ・トップ: ${topFile ? path.basename(topFile) : START}）`);
  console.log(`  掲載中の店の現役の店舗ページ ${r.publicStorePages} 本 → ${line(r.depthOfPublicStorePages)}`);
  console.log(`  現役の店舗ページ全体（掲載外の孤児を含む）${r.activeStorePages} 本 → ${line(r.depthOfActiveStorePages)}`);
  for (const [t, d] of Object.entries(r.otherPagesDepthByType)) console.log(`  ${t}: ${line(d)}`);
  if (args.includes('--list')) for (const rel of r.unreachablePublic) console.log(`  ✗ ${rel}  ${names.get(rel) || ''}`);
}

if (require.main === module) main();
module.exports = { resolveHref, buildGraph, bfsDepths, distribution, summarize };
