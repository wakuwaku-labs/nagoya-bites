#!/usr/bin/env node
'use strict';
/**
 * scripts/merge_features.js — 重なった特集を寄せる（基本方針 段階5 S5-3・決定 0069 の7・0077）
 *
 * data/feature_merges.json の各組について、次を行う（2回当てても結果は同じ＝冪等）。
 *   1. 寄せ元（from）への内部リンクを、サイト全体（ルートの HTML・特集・ジャーナル）で寄せ先（to）へ張り替える。
 *      ・同じ「関連する特集」の中に寄せ先へのリンクが既にある／寄せ先自身のページなら、リンクを外す（同じ先への重複を作らない）
 *      ・リンク文が空・寄せ元の旧い文言のときは、寄せ先の文言（toLabel）に替える。それ以外の文言（本文中の言い回し）は触らない
 *      店舗ページ（stores/）とエリアのハブ（stores/area/）は生成物なので、ここでは触らない（生成元 gen-store-pages.js を直して作り直す）
 *   2. features/index.html（特集の一覧）から寄せ元のカードを外す
 *   3. 寄せ元を転送ページにする（canonical + noindex + meta refresh）
 *   4. 寄せ先に「統合した記事から」の一文を足す（冒頭には足さない。関連する特集の直前）
 *   5. data/feature_roles.json・data/feature_rosters.json・sitemap.xml・sitemap-images.xml から寄せ元を外す
 *
 * 使い方:
 *   node scripts/merge_features.js            # 実行
 *   node scripts/merge_features.js --check    # まだ寄せていない・張り替え漏れがあれば exit 1（書かない）
 */
const fs = require('fs');
const path = require('path');
const M = require('./lib/feature_merges');

const ROOT = path.join(__dirname, '..');

function listFiles(dir, re) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => re.test(f) && !f.startsWith('_')).sort().map((f) => path.join(dir, f));
}

/** 作り直されない（孤児の）店舗ページ。生成器が書き直す店舗ページとは違い、ここで張り替えないと古いリンクが残る */
function orphanStorePages(root) {
  const f = path.join(root, 'data', 'store_page_orphans.json');
  if (!fs.existsSync(f)) return [];
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return (j.orphanSlugs || []).map((s) => path.join(root, 'stores', `${s}.html`)).filter((p) => fs.existsSync(p));
}

/** 張り替え・外す対象のページ（作り直される stores/・stores/area/ は含めない。生成元を直して作り直す） */
function targetPages(root) {
  return [
    ...listFiles(root, /\.html$/),
    ...listFiles(path.join(root, 'features'), /\.html$/),
    ...listFiles(path.join(root, 'journal'), /\.html$/),
    ...orphanStorePages(root),
  ];
}

function hrefResolvesTo(href, dirKind, slug) {
  // dirKind: 'root' | 'features' | 'journal'
  const h = href.replace(/[#?].*$/, '');
  const full = new RegExp(`^(?:https://nagoya-bites\\.com)?/features/${slug}\\.html$`);
  if (full.test(h)) return true;
  if (dirKind === 'root') return h === `features/${slug}.html`;
  if (dirKind === 'features') return h === `${slug}.html` || h === `./${slug}.html`;
  if (dirKind === 'journal') return h === `../features/${slug}.html`;
  return false;
}

function swapSlug(s, from, to) {
  return s.split(`${from}.html`).join(`${to}.html`);
}

/** 1ページの内部リンクを張り替える。{html, rewritten, removed} を返す */
function rewriteLinks(html, { dirKind, selfSlug, merge, isStore = false }) {
  const { from, to } = merge;
  // 店舗ページ（孤児で作り直されないもの）の「載っている特集」は、特集の題そのものの文言なので別の対応表を使う
  const oldLabels = new Set(isStore ? (merge.storeFromLabels || []) : (merge.oldLabels || []));
  const toLabel = isStore ? (merge.storeToLabel || merge.toLabel) : merge.toLabel;
  let rewritten = 0;
  let removed = 0;
  // 外したリンクの行に空白だけが残らないように、リンクの前の改行＋字下げも一緒に扱う
  const anchorRe = /(\n[ \t]*)?(<a\b[^>]*>[\s\S]*?<\/a>)/g;
  const hrefOf = (a) => { const m = a.match(/\bhref="([^"]*)"/); return m ? m[1] : null; };
  const textOf = (a) => a.replace(/^<a\b[^>]*>/, '').replace(/<\/a>$/, '').replace(/<[^>]*>/g, '').trim();
  const hasTarget = (text) => [...text.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].some((m) => hrefResolvesTo(hrefOf(m[0]) || '', dirKind, to));
  // index.html の「シーンから探す」のような <ul> の中の <li>: 同じ <ul> に寄せ先のリンクが既にあれば <li> ごと外す
  let out = html;
  if (dirKind === 'root' || isStore) {
    out = out.replace(/(\n[ \t]*)?<li><a\b[^>]*>[^<]*<\/a><\/li>/g, (li, lead, offset) => {
      const href = hrefOf(li);
      if (!href || !hrefResolvesTo(href, dirKind, from)) return li;
      const ulStart = out.lastIndexOf('<ul', offset);
      const ulEnd = out.indexOf('</ul>', offset);
      if (ulStart < 0 || ulEnd < 0 || !hasTarget(out.slice(ulStart, ulEnd))) return li;
      removed += 1;
      return '';
    });
  }
  // 「関連する特集」の区画（<div class="related"> から、その中の <div class="related-links"> の閉じまで）
  const relatedBlocks = [];
  for (const b of out.matchAll(/<div class="related">[\s\S]*?<\/div>\s*<\/div>/g)) {
    relatedBlocks.push({ start: b.index, end: b.index + b[0].length, text: b[0] });
  }
  const blockAt = (idx) => relatedBlocks.find((b) => idx >= b.start && idx < b.end) || null;
  out = out.replace(anchorRe, (all, lead, a, offset) => {
    const href = hrefOf(a);
    if (!href || !hrefResolvesTo(href, dirKind, from)) return all;
    const b = blockAt(offset + (lead ? lead.length : 0));
    if (b && (selfSlug === to || hasTarget(b.text))) { removed += 1; return ''; }
    let next = swapSlug(a, from, to);
    const t = textOf(a);
    const core = t.replace(/\s*→$/, '');
    if (core === '' || oldLabels.has(core)) {
      const arrow = t.endsWith('→') ? ' →' : '';
      next = next.replace(/(<a\b[^>]*>)[\s\S]*?(<\/a>)$/, `$1${toLabel}${arrow}$2`);
    }
    rewritten += 1;
    return (lead || '') + next;
  });
  // JavaScript の中の規則（index.html の u:'features/<slug>.html'）。リンクの要素ではないので文字列で替える
  if (dirKind === 'root') {
    const js = `'features/${from}.html'`;
    if (out.includes(js)) {
      rewritten += out.split(js).length - 1;
      out = out.split(js).join(`'features/${to}.html'`);
    }
  }
  return { html: out, rewritten, removed };
}

function removeIndexCard(html, from) {
  const re = new RegExp(`[ \\t]*<a class="article-card" href="${from}\\.html">[\\s\\S]*?</a>\\n(?:[ \\t]*\\n)?`);
  return html.replace(re, '');
}

function readTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m ? m[1].replace(/\s*[｜|]\s*NAGOYA BITES\s*$/, '').trim() : '';
}

function addNote(html, merge) {
  const note = M.mergedFromNote(merge);
  const existing = new RegExp(`<p class="nb-note" data-nb-merged-from="${merge.from}">[^\\n]*?</p>\\n`);
  // 位置は、読者の声の区画の直前（サイト共通の整え直し apply_site_chrome.js が置く場所と同じ。ここに置くと整え直しで動かない）。
  // 読者の声が無い特集は「関連する特集」の直前、それも無ければ記事の終わりの直前
  const base = html.replace(existing, '');
  for (const anchor of ['<!-- NB-READER-VOICE:START -->', '<div class="related">']) {
    const at = base.indexOf(anchor);
    if (at >= 0) return base.slice(0, at) + note + '\n' + base.slice(at);
  }
  const art = base.lastIndexOf('</article>');
  if (art >= 0) return base.slice(0, art) + note + '\n' + base.slice(art);
  throw new Error(`寄せ先に「統合した記事から」を足す位置が見つかりません: ${merge.to}`);
}

function dropFromRoles(root, merge) {
  const f = path.join(root, 'data', 'feature_roles.json');
  const raw = fs.readFileSync(f, 'utf8');
  const j = JSON.parse(raw);
  const g = j.groups.find((x) => x.members.includes(merge.from));
  if (!g) return false;
  const rest = g.members.filter((s) => s !== merge.from);
  if (rest.length < 2) {
    // 1本だけになる組は役割表から外す。元の書式を保つため、その組のブロックだけを取り除く
    const re = new RegExp(`\\n    \\{\\n      "theme": "${g.theme}",[\\s\\S]*?\\n    \\},?`);
    let next = raw.replace(re, '');
    next = next.replace(/,(\s*\n\s*\])/g, '$1');
    JSON.parse(next);
    fs.writeFileSync(f, next);
    return true;
  }
  g.members = rest;
  g.edges = (g.edges || []).filter((e) => e.from !== merge.from && e.to !== merge.from);
  if (g.main === merge.from) g.main = rest[0];
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
  return true;
}

function dropFromRosters(root, merge) {
  const f = path.join(root, 'data', 'feature_rosters.json');
  const raw = fs.readFileSync(f, 'utf8');
  const j = JSON.parse(raw);
  const bucket = j.features || j.rosters || null;
  if (!bucket || !(merge.from in bucket)) return false;
  // 元の書式（1行ずつ）を保つため、該当エントリのブロックだけを取り除く
  const re = new RegExp(`\\n\\s*"${merge.from}": \\{[\\s\\S]*?\\n    \\},?`);
  let next = raw.replace(re, '');
  next = next.replace(/,(\s*\n\s*\})/g, '$1'); // 末尾のカンマを残さない
  JSON.parse(next);
  fs.writeFileSync(f, next);
  return true;
}

function dropFromSitemap(root, file, merge) {
  const f = path.join(root, file);
  if (!fs.existsSync(f)) return false;
  const xml = fs.readFileSync(f, 'utf8');
  const re = new RegExp(`\\n?[ \\t]*<url>\\s*<loc>https://nagoya-bites\\.com/features/${merge.from}\\.html</loc>[\\s\\S]*?</url>`);
  if (!re.test(xml)) return false;
  fs.writeFileSync(f, xml.replace(re, ''));
  return true;
}

function applyMerge(root, merge, { dry = false } = {}) {
  const report = { from: merge.from, to: merge.to, rewritten: 0, removed: 0, files: [], stub: false, note: false };
  const fromFile = path.join(root, 'features', `${merge.from}.html`);
  const toFile = path.join(root, 'features', `${merge.to}.html`);
  if (!fs.existsSync(toFile)) throw new Error(`寄せ先がありません: features/${merge.to}.html`);
  const toHtmlOrig = fs.readFileSync(toFile, 'utf8');
  const toTitle = readTitle(toHtmlOrig);

  for (const file of targetPages(root)) {
    if (path.resolve(file) === path.resolve(fromFile)) continue;
    const rel = path.relative(root, file).split(path.sep).join('/');
    const isStore = rel.startsWith('stores/');
    const dirKind = rel.startsWith('features/') ? 'features' : (rel.startsWith('journal/') || isStore) ? 'journal' : 'root';
    const selfSlug = dirKind === 'features' ? path.basename(file, '.html') : null;
    const orig = fs.readFileSync(file, 'utf8');
    if (M.isMergedStub(orig)) continue;
    let html = orig;
    if (rel === 'features/index.html') html = removeIndexCard(html, merge.from); // 一覧のカードは、張り替えの前に外す
    const r = rewriteLinks(html, { dirKind, selfSlug, merge, isStore });
    html = r.html;
    if (selfSlug === merge.to) html = addNote(html, merge);
    if (html !== orig) {
      report.rewritten += r.rewritten;
      report.removed += r.removed;
      report.files.push(rel);
      if (!dry) fs.writeFileSync(file, html);
    }
  }
  if (selfNoteAdded(report, merge)) report.note = true;

  if (fs.existsSync(fromFile) && !M.isMergedStub(fs.readFileSync(fromFile, 'utf8'))) {
    report.stub = true;
    if (!dry) fs.writeFileSync(fromFile, M.renderFeatureStub(merge.to, toTitle));
  }
  if (!dry) {
    dropFromRoles(root, merge);
    dropFromRosters(root, merge);
    dropFromSitemap(root, 'sitemap.xml', merge);
    dropFromSitemap(root, 'sitemap-images.xml', merge);
  }
  return report;
}

function selfNoteAdded(report, merge) {
  return report.files.includes(`features/${merge.to}.html`);
}

/** --check 用: 張り替え漏れ・転送ページ化漏れ */
function check(root) {
  const errs = [];
  for (const m of M.loadMerges(root)) {
    const f = path.join(root, 'features', `${m.from}.html`);
    if (!fs.existsSync(f) || !M.isMergedStub(fs.readFileSync(f, 'utf8'))) errs.push(`features/${m.from}.html が転送ページになっていません`);
    for (const file of targetPages(root)) {
      if (path.resolve(file) === path.resolve(f)) continue;
      const rel = path.relative(root, file).split(path.sep).join('/');
      const html = fs.readFileSync(file, 'utf8');
      if (M.isMergedStub(html)) continue;
      if (new RegExp(`href="[^"]*features/${m.from}\\.html|href="${m.from}\\.html`).test(html)) errs.push(`${rel} に ${m.from} へのリンクが残っています`);
    }
  }
  return errs;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const errs = check(ROOT);
    errs.forEach((e) => console.log('  ✗ ' + e));
    console.log(errs.length ? `寄せ方の不備: ${errs.length} 件` : '寄せ方の不備なし');
    process.exit(errs.length ? 1 : 0);
  }
  for (const m of M.loadMerges(ROOT)) {
    const r = applyMerge(ROOT, m, { dry: args.includes('--dry-run') });
    console.log(`${r.from} → ${r.to}: 張り替え ${r.rewritten} 件・外したリンク ${r.removed} 件・変更 ${r.files.length} ファイル・転送ページ化 ${r.stub ? '今回' : '済み'}`);
    r.files.forEach((f) => console.log('   ' + f));
  }
}

if (require.main === module) main();
module.exports = { rewriteLinks, applyMerge, check, removeIndexCard, hrefResolvesTo };
