'use strict';
/**
 * scripts/lib/published_pages.js — 公開ページの一覧と種別の唯一の情報源（I-35）
 *
 * 後戻りを止める検査（audit_selection_wording.js・audit_image_sources.js・audit_page_weight.js）が、
 * 「どのファイルを・どの種別として」数えるかを同じにするための部品。
 *
 * 対象（audit_inline_js_syntax.js の section と同じ分け方）:
 *   root      ルート直下の *.html（先頭 _ の補助ページを除く）
 *   features  features/*.html（先頭 _ を除く）
 *   journal   journal/*.html（先頭 _ の _template を除く）
 *   stores    stores/*.html（店舗ページ・誘導ページ・stores/index.html）
 *   area      stores/area/ 配下（エリア×ジャンル×条件のハブ）
 *
 * 種別（type）はページの重さの上限（data/page_weight_policy.json）を分ける単位:
 *   top / static / feature-index / journal-index / stores-index / feature / journal / store / hub
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.join(__dirname, '..', '..');
const SECTIONS = ['root', 'features', 'journal', 'stores', 'area'];

function listHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.html') && !f.startsWith('_'))
    .sort()
    .map((f) => path.join(dir, f));
}

function listHtmlRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) out = out.concat(listHtmlRecursive(p));
    else if (f.endsWith('.html') && !f.startsWith('_')) out.push(p);
  }
  return out;
}

function pageTypeOf(rel) {
  if (rel === 'index.html') return 'top';
  if (rel === 'features/index.html') return 'feature-index';
  if (rel === 'journal/index.html') return 'journal-index';
  if (rel === 'stores/index.html') return 'stores-index';
  if (rel.startsWith('stores/area/')) return 'hub';
  if (rel.startsWith('stores/')) return 'store';
  if (rel.startsWith('features/')) return 'feature';
  if (rel.startsWith('journal/')) return 'journal';
  return 'static';
}

function sectionOf(rel) {
  if (rel.startsWith('stores/area/')) return 'area';
  if (rel.startsWith('stores/')) return 'stores';
  if (rel.startsWith('features/')) return 'features';
  if (rel.startsWith('journal/')) return 'journal';
  return 'root';
}

/** @returns {{rel:string, abs:string, section:string, type:string}[]} */
function listPublishedPages({ root = DEFAULT_ROOT, only = null } = {}) {
  const abs = [
    ...listHtml(root),
    ...listHtml(path.join(root, 'features')),
    ...listHtml(path.join(root, 'journal')),
    ...listHtml(path.join(root, 'stores')),
    ...listHtmlRecursive(path.join(root, 'stores', 'area')),
  ];
  const pages = abs.map((a) => {
    const rel = path.relative(root, a).split(path.sep).join('/');
    return { rel, abs: a, section: sectionOf(rel), type: pageTypeOf(rel) };
  });
  return only ? pages.filter((p) => p.section === only) : pages;
}

module.exports = { DEFAULT_ROOT, SECTIONS, listPublishedPages, pageTypeOf, sectionOf };
