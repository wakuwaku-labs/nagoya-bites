'use strict';
/**
 * scripts/lib/internal_links.js — 内部リンクのリンク先が実在するかの判定（P-383）
 *
 * 公開 HTML の <a href> のうち、サイト内（相対・ルート相対・nagoya-bites.com の絶対）を指すものが、
 * リポジトリ内のファイルとして実在するかだけを見る。判定は検証できる事実（ファイルの有無）だけ（制約10）。
 * 2026-05 から 5 か月、一度も公開されていない記事へのリンクが 404 のまま公開されていたのに、
 * リンク先の実在を数える検査がリポジトリのどこにも無かった（P-382・P-383）。
 *
 * 数えないもの: 外部 URL・mailto:・tel:・javascript: など・# だけのもの・query だけのもの（そのページ自身）・
 *   <script>/<style>/コメントの中・JS の文字列のつなぎ（' + x + '）・{{ }} や ${ } の残り
 * 実在の見方（GitHub Pages が返すものに合わせる）:
 *   - 末尾が / または空 → その下の index.html
 *   - 拡張子なし → そのファイル／そのパス + .html／そのパス/index.html のどれか
 *   - 大文字小文字は区別する（GitHub Pages は区別するのに、macOS のファイルシステムは区別しない）
 *   - query（?…）と fragment（#…）は外して見る
 */

const fs = require('fs');
const path = require('path');

const SITE_HOSTS = new Set(['nagoya-bites.com', 'www.nagoya-bites.com']);

// <script>・<style>・コメントを外す（JS の文字列の中の href="' + x + '" などを数えないため）
function stripNonMarkup(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '');
}

const A_HREF = /<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function decodeBasicEntities(s) {
  return s.replace(/&amp;/gi, '&').replace(/&#38;/g, '&').replace(/&#x26;/gi, '&');
}

/** HTML 文字列 → <a href> の値の配列（出てきた順・重複あり） */
function extractHrefs(html) {
  const src = stripNonMarkup(html);
  const out = [];
  A_HREF.lastIndex = 0;
  let m;
  while ((m = A_HREF.exec(src))) out.push(decodeBasicEntities(m[1] !== undefined ? m[1] : m[2]));
  return out;
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

/**
 * href と、それを書いたページ（ルートからの相対パス）→ 判定の対象。
 * @returns {{ kind: 'skip', reason: string } | { kind: 'internal', target: string }}
 *   target はルートからのパス（posix・先頭に / を付けない）。末尾が / なら「その下の index.html」の意味。
 */
function classifyHref(href, fromRel) {
  let h = String(href == null ? '' : href).trim();
  if (!h) return { kind: 'skip', reason: 'empty' };
  if (h[0] === '#') return { kind: 'skip', reason: 'fragment' };
  // JS の文字列のつなぎ・テンプレートの残り
  if (/['"`]|\$\{|\{\{|\}\}|\s\+\s/.test(h)) return { kind: 'skip', reason: 'template' };
  let pathPart = h;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(h);
  if (scheme) {
    if (!/^https?$/i.test(scheme[1])) return { kind: 'skip', reason: 'scheme' };
    const m = /^https?:\/\/([^/?#]*)([^?#]*)/i.exec(h);
    if (!m || !SITE_HOSTS.has(m[1].toLowerCase().replace(/:\d+$/, ''))) return { kind: 'skip', reason: 'external' };
    pathPart = m[2] || '/';
  } else if (h.startsWith('//')) {
    const m = /^\/\/([^/?#]*)([^?#]*)/.exec(h);
    if (!m || !SITE_HOSTS.has(m[1].toLowerCase())) return { kind: 'skip', reason: 'external' };
    pathPart = m[2] || '/';
  } else {
    pathPart = h.replace(/[?#].*$/, '');
    if (!pathPart) return { kind: 'skip', reason: 'self' };
  }
  pathPart = safeDecode(pathPart);
  let abs;
  if (pathPart.startsWith('/')) {
    abs = path.posix.normalize(pathPart.replace(/^\/+/, '') || '.');
  } else {
    abs = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), pathPart));
  }
  // 'stores/' から '../' → './'、ルートそのもの → ''（どちらもトップの index.html を指す）
  abs = abs.replace(/^(\.\/)+/, '');
  if (abs === '.') abs = '';
  if (/\/$/.test(pathPart) && abs && !abs.endsWith('/')) abs += '/';
  return { kind: 'internal', target: abs };
}

/** ルート直下から辿れるファイル・ディレクトリの実在を、大文字小文字を区別して調べる（ディレクトリ一覧は使い回す） */
function createFs(root) {
  const listings = new Map();
  function listing(dirAbs) {
    let l = listings.get(dirAbs);
    if (l !== undefined) return l;
    l = null;
    try {
      l = new Map();
      for (const e of fs.readdirSync(dirAbs, { withFileTypes: true })) l.set(e.name, e.isDirectory());
    } catch (e) { l = null; }
    listings.set(dirAbs, l);
    return l;
  }
  // 'a/b/c.html' → 'file' | 'dir' | null
  function kindOf(rel) {
    if (rel === '' || rel === '.') return 'dir';
    const segs = rel.split('/').filter((s) => s !== '');
    let dir = root;
    for (let i = 0; i < segs.length; i++) {
      const l = listing(dir);
      if (!l || !l.has(segs[i])) return null;
      const isDir = l.get(segs[i]);
      if (i === segs.length - 1) return isDir ? 'dir' : 'file';
      if (!isDir) return null;
      dir = path.join(dir, segs[i]);
    }
    return null;
  }
  return { kindOf };
}

/** target（classifyHref の internal）が、GitHub Pages で 200 になるファイルとして実在するか */
function targetExists(fsx, target) {
  if (target.startsWith('../') || target === '..') return false; // ルートの外
  if (target === '' || target.endsWith('/')) return fsx.kindOf(target + 'index.html') === 'file';
  const k = fsx.kindOf(target);
  if (k === 'file') return true;
  if (k === 'dir') return fsx.kindOf(target + '/index.html') === 'file';
  // 拡張子なし: GitHub Pages は /foo を foo.html から返す
  if (!/\.[A-Za-z0-9]+$/.test(path.posix.basename(target))) return fsx.kindOf(target + '.html') === 'file';
  return false;
}

/**
 * ページの一覧 → 実在しないリンクの一覧。
 * @param {{rel:string, abs:string}[]} pages
 * @returns {{ pages:number, internalLinks:number, broken:{page:string, href:string, target:string, count:number}[] }}
 */
function auditPages(pages, root) {
  const fsx = createFs(root);
  const exists = new Map();
  const broken = new Map();
  let internalLinks = 0;
  for (const p of pages) {
    const html = fs.readFileSync(p.abs, 'utf8');
    for (const href of extractHrefs(html)) {
      const c = classifyHref(href, p.rel);
      if (c.kind !== 'internal') continue;
      internalLinks++;
      let ok = exists.get(c.target);
      if (ok === undefined) { ok = targetExists(fsx, c.target); exists.set(c.target, ok); }
      if (ok) continue;
      const key = p.rel + '\u0000' + c.target;
      const cur = broken.get(key);
      if (cur) cur.count++;
      else broken.set(key, { page: p.rel, href, target: c.target || '/', count: 1 });
    }
  }
  return { pages: pages.length, internalLinks, broken: [...broken.values()] };
}

module.exports = { extractHrefs, classifyHref, targetExists, createFs, auditPages, stripNonMarkup, SITE_HOSTS };
