#!/usr/bin/env node
/**
 * scripts/apply_site_chrome.js
 *
 * DSN-003: 既存ページへサイト共通クローム（ヘッダー/ナビ/パンくず/フッター）を
 * 冪等に適用する。正本は scripts/lib/site_chrome.js。apply_design_system.js と
 * 同じ運用モデル（--dry-run / --check / --only）。
 *
 * 処理内容:
 *   1. HEADER: マーカーがあれば区間を再生成値で置換。無ければ nav-overlay を削除し
 *      最初の <header>...</header> を置換（index.html は withFav:true）
 *   2. BREADCRUMB（features / journal のみ）: 既存の3変種を検出して除去し、
 *      BreadcrumbList JSON-LD → 旧パンくず → [TOP, 区分, h1] の順で再生成し
 *      HEADER:END 直後に挿入
 *   3. FOOTER: マーカーがあれば置換。無ければ唯一の <footer>...</footer> を置換し、
 *      直後の年号 <script>（fc-year 型 / yr 型）を削除
 *   4. SCRIPT（index.html 以外）: </body> 直前に chromeScript() をマーカー付きで挿入
 *   5. --strip-legacy-css: 最初の <style> のトップレベルから旧クローム系セレクタを削除
 *
 * 使い方:
 *   node scripts/apply_site_chrome.js --dry-run [--only <root|features|journal|stores>]
 *   node scripts/apply_site_chrome.js --strip-legacy-css [--only <dir>]
 *   node scripts/apply_site_chrome.js --check [--sample N]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const chrome = require('./lib/site_chrome');

const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const checkMode = args.includes('--check');
const stripLegacyCss = args.includes('--strip-legacy-css');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const sampleIdx = args.indexOf('--sample');
const sampleN = sampleIdx >= 0 ? parseInt(args[sampleIdx + 1], 10) : null;

function listHtmlFiles(dir, opts) {
  opts = opts || {};
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .filter(f => !opts.excludeTemplate || !f.startsWith('_'))
    .map(f => path.join(dir, f));
}

function managedStoreFiles() {
  const dir = path.join(ROOT, 'stores');
  const all = listHtmlFiles(dir).filter(f => path.basename(f) !== 'index.html');
  const storesJsonPath = path.join(ROOT, 'data', 'stores.json');
  if (!fs.existsSync(storesJsonPath)) return all;
  try {
    const arr = JSON.parse(fs.readFileSync(storesJsonPath, 'utf8'));
    const ids = new Set(arr.map(s => s['ホットペッパーID'] || s.hotpepperId || s.id).filter(Boolean));
    return all.filter(f => ids.has(path.basename(f, '.html')));
  } catch (e) {
    return all;
  }
}

function collectTargets() {
  const groups = {
    root: ['index.html', 'about.html', 'faq.html', 'contact.html', 'privacy-policy.html']
      .map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f)),
    features: listHtmlFiles(path.join(ROOT, 'features')),
    journal: listHtmlFiles(path.join(ROOT, 'journal'), { excludeTemplate: true })
      .concat(path.join(ROOT, 'journal/_template.html')).filter(f => fs.existsSync(f)),
    stores: [path.join(ROOT, 'stores/index.html')].filter(f => fs.existsSync(f))
      .concat(managedStoreFiles()),
  };
  if (only) return groups[only] || [];
  return [...groups.root, ...groups.features, ...groups.journal, ...groups.stores];
}

function sample(arr, n) {
  if (!n || arr.length <= n) return arr;
  const sorted = [...arr].sort();
  const step = sorted.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(sorted[Math.floor(i * step)]);
  return [...new Set(out)];
}

function relPath(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function groupOf(rel) {
  if (rel.startsWith('features/')) return 'features';
  if (rel.startsWith('journal/')) return 'journal';
  if (rel.startsWith('stores/')) return 'stores';
  return 'root';
}

// ---------------------------------------------------------------------------
// HEADER
// ---------------------------------------------------------------------------

function replaceHeader(html, { depth, active, withFav }) {
  const rendered = chrome.renderHeader({ depth, active, withFav });
  const startMark = chrome.MARK('HEADER', 'START');
  const endMark = chrome.MARK('HEADER', 'END');
  if (html.includes(startMark) && html.includes(endMark)) {
    const re = new RegExp(escapeRe(startMark) + '[\\s\\S]*?' + escapeRe(endMark));
    const next = html.replace(re, rendered);
    return { html: next, changed: next !== html, hadMarker: true };
  }
  // マーカーが無い場合: nav-overlay を削除し、最初の <header ...>...</header> を置換
  let working = html.replace(/<div class="nav-overlay"[^>]*>\s*<\/div>\s*/, '');
  const headerCount = (working.match(/<header[\s>]/g) || []).length;
  if (headerCount === 0) return { html, changed: false, error: 'no_header_found' };
  if (headerCount > 1) return { html, changed: false, error: 'multiple_headers' };
  const re = /<header(?:\s[^>]*)?>[\s\S]*?<\/header>/;
  const next = working.replace(re, rendered);
  return { html: next, changed: next !== html, hadMarker: false };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// BREADCRUMB（features / journal のみ）
// ---------------------------------------------------------------------------

function stripExistingBreadcrumb(html) {
  // A: <nav aria-label="パンくずリスト"><div class="breadcrumb">...</div></nav>
  let re = /<nav aria-label="パンくずリスト">\s*<div class="breadcrumb">[\s\S]*?<\/div>\s*<\/nav>\s*/;
  if (re.test(html)) return html.replace(re, '');
  // B: <nav class="breadcrumb" aria-label="パンくずリスト">...</nav>（main 内）
  re = /<nav class="breadcrumb" aria-label="パンくずリスト">[\s\S]*?<\/nav>\s*/;
  if (re.test(html)) return html.replace(re, '');
  // C: 絶対URL型 <div class="breadcrumb">...</div>（nav ラッパー無し）
  re = /<div class="breadcrumb">\s*<a href="https:\/\/nagoya-bites\.com\/"[\s\S]*?<\/div>\s*/;
  if (re.test(html)) return html.replace(re, '');
  return html;
}

function normalizeCrumbTarget(url) {
  if (!url) return null;
  const u = String(url).replace(/^https:\/\/nagoya-bites\.com\//, '');
  if (u === '' || u === 'index.html') return { href: 'index.html', label: 'TOP' };
  if (u === 'features/' || u === 'features/index.html') return { href: 'features/index.html', label: '特集' };
  if (u === 'journal/' || u === 'journal/index.html') return { href: 'journal/index.html', label: 'ジャーナル' };
  if (u === 'stores/' || u === 'stores/index.html') return { href: 'stores/index.html', label: '店舗' };
  return { href: u, label: null };
}

function extractBreadcrumbFromJsonLd(html) {
  const m = html.match(/"@type":\s*"BreadcrumbList"[\s\S]*?"itemListElement":\s*\[([\s\S]*?)\]\s*\}/);
  if (!m) return null;
  let items;
  try {
    items = JSON.parse('[' + m[1] + ']');
  } catch (e) {
    return null;
  }
  if (!Array.isArray(items) || items.length === 0) return null;
  return items
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((it, i) => {
      if (i === 0) return { href: 'index.html', label: 'TOP' };
      if (!it.item) return { label: it.name };
      const norm = normalizeCrumbTarget(it.item);
      return { href: norm.href, label: norm.label || it.name };
    });
}

function extractH1Text(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function buildBreadcrumbItems(html, group) {
  const fromJsonLd = extractBreadcrumbFromJsonLd(html);
  if (fromJsonLd && fromJsonLd.length >= 2) return fromJsonLd;
  const section = group === 'features' ? '特集' : group === 'journal' ? 'ジャーナル' : '店舗';
  const sectionHref = group === 'features' ? 'features/index.html' : group === 'journal' ? 'journal/index.html' : 'stores/index.html';
  const h1 = extractH1Text(html) || '';
  return [
    { href: 'index.html', label: 'TOP' },
    { href: sectionHref, label: section },
    { label: h1 },
  ];
}

function applyBreadcrumb(html, { depth, group }) {
  if (group !== 'features' && group !== 'journal') return { html, changed: false };
  const items = buildBreadcrumbItems(html, group);
  const rendered = chrome.renderBreadcrumb(items, { depth });
  const bStart = chrome.MARK('BREADCRUMB', 'START');
  const bEnd = chrome.MARK('BREADCRUMB', 'END');
  if (html.includes(bStart) && html.includes(bEnd)) {
    const re = new RegExp(escapeRe(bStart) + '[\\s\\S]*?' + escapeRe(bEnd));
    const next = html.replace(re, rendered);
    return { html: next, changed: next !== html };
  }
  const stripped = stripExistingBreadcrumb(html);
  const startMark = chrome.MARK('HEADER', 'END');
  const idx = stripped.indexOf(startMark);
  if (idx < 0) return { html: stripped, changed: stripped !== html, error: 'header_end_marker_missing' };
  const insertAt = idx + startMark.length;
  const next = stripped.slice(0, insertAt) + '\n' + rendered + stripped.slice(insertAt);
  return { html: next, changed: true };
}

// ---------------------------------------------------------------------------
// FOOTER
// ---------------------------------------------------------------------------

function replaceFooter(html, { depth }) {
  const rendered = chrome.renderFooter({ depth });
  const startMark = chrome.MARK('FOOTER', 'START');
  const endMark = chrome.MARK('FOOTER', 'END');
  if (html.includes(startMark) && html.includes(endMark)) {
    const re = new RegExp(escapeRe(startMark) + '[\\s\\S]*?' + escapeRe(endMark));
    const next = html.replace(re, rendered);
    return { html: next, changed: next !== html };
  }
  const footerCount = (html.match(/<footer[\s>]/g) || []).length;
  if (footerCount === 0) return { html, changed: false, error: 'no_footer_found' };
  if (footerCount > 1) return { html, changed: false, error: 'multiple_footers' };
  const re = /<footer(?:\s[^>]*)?>[\s\S]*?<\/footer>/;
  let next = html.replace(re, rendered);
  // 直後の年号スクリプトを削除（fc-year 型 / yr 型）
  next = next.replace(/\s*<script>\s*document\.getElementById\('yr'\)\.textContent\s*=\s*new Date\(\)\.getFullYear\(\);\s*<\/script>/, '');
  next = next.replace(/\s*<script>\s*\(function\(\)\s*\{\s*var fc\s*=\s*document\.getElementById\('fc-year'\);[\s\S]*?\}\)\(\);\s*<\/script>/, '');
  return { html: next, changed: next !== html };
}

// ---------------------------------------------------------------------------
// SCRIPT（index.html 以外）
// ---------------------------------------------------------------------------

function applyScript(html, rel) {
  if (rel === 'index.html') return { html, changed: false };
  const startMark = chrome.MARK('SCRIPT', 'START');
  const endMark = chrome.MARK('SCRIPT', 'END');
  const rendered = chrome.chromeScript();
  if (html.includes(startMark) && html.includes(endMark)) {
    const re = new RegExp(escapeRe(startMark) + '[\\s\\S]*?' + escapeRe(endMark));
    const next = html.replace(re, rendered);
    return { html: next, changed: next !== html };
  }
  if (!html.includes('</body>')) return { html, changed: false, error: 'no_body_close' };
  const next = html.replace('</body>', rendered + '\n</body>');
  return { html: next, changed: true };
}

// ---------------------------------------------------------------------------
// --strip-legacy-css
// ---------------------------------------------------------------------------

const TOP_LEVEL_LEGACY_SELECTORS = new Set([
  'nav a:hover,nav a.active', 'nav a.active,nav a:hover',
  'footer a', 'footer a:hover',
  '.site-header', '.header-inner', '.nav-back', '.nav-back:hover',
  '.site-footer', '.site-footer a', '.back-link', '.back-link:hover',
  '.breadcrumb span',
]);
const MEDIA_LEGACY_SELECTORS = new Set([
  'nav', 'nav a', 'nav.open', '.hamburger', '.nav-overlay', '.nav-overlay.open',
]);

// apply_design_system.js の splitRules と同一アルゴリズム（トップレベルの {} のみ分解し、
// @media(...) はその中身をまるごと 1 つの body として扱う）
function splitRules(css) {
  const rules = [];
  let depth = 0, buf = '', selBuf = '', inSelector = true;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) { inSelector = false; buf = ''; }
      depth++;
      if (depth > 1) buf += ch;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        const cleanSelector = selBuf.replace(/\/\*[\s\S]*?\*\//g, '').trim();
        rules.push({ selector: cleanSelector, rawSelector: selBuf, body: buf });
        selBuf = '';
        inSelector = true;
      } else {
        buf += ch;
      }
      continue;
    }
    if (inSelector) selBuf += ch;
    else buf += ch;
  }
  return rules;
}

function stripLegacyChromeCss(html) {
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) return { html, changed: false };
  const rules = splitRules(styleMatch[1]);
  let changed = false;
  const rebuilt = [];
  for (const r of rules) {
    const sel = r.selector.trim();
    if (TOP_LEVEL_LEGACY_SELECTORS.has(sel)) { changed = true; continue; }
    if (/^@media/.test(sel)) {
      const inner = splitRules(r.body);
      const keptInner = inner.filter(ir => {
        if (MEDIA_LEGACY_SELECTORS.has(ir.selector.trim())) { changed = true; return false; }
        return true;
      });
      if (keptInner.length === 0) { changed = true; continue; }
      if (keptInner.length !== inner.length) {
        const newBody = keptInner.map(ir => `${ir.rawSelector.trim()}{${ir.body}}`).join('');
        rebuilt.push(`${r.rawSelector.trim()}{${newBody}}`);
        continue;
      }
    }
    rebuilt.push(`${r.rawSelector.trim()}{${r.body}}`);
  }
  if (!changed) return { html, changed: false };
  const newStyleBody = rebuilt.join('\n');
  const newHtml = html.replace(styleMatch[1], newStyleBody);
  return { html: newHtml, changed: true };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function processFile(file) {
  const rel = relPath(file);
  const group = groupOf(rel);
  const depth = chrome.depthFor(rel);
  const active = chrome.activeKeyFor(rel);
  const withFav = rel === 'index.html';

  const original = fs.readFileSync(file, 'utf8');
  let html = original;
  const errors = [];

  if (group === 'stores' && path.basename(file) !== 'index.html') {
    // 店舗詳細ページは gen-store-pages.js のテンプレート側で site_chrome を呼ぶ
    // （このスクリプトでは header/footer 差し替えを行わず、legacy-css strip のみ対象外にする）
    return { file: rel, changed: false, skipped: 'store_detail_handled_by_generator' };
  }

  const h = replaceHeader(html, { depth, active, withFav });
  html = h.html;
  if (h.error) errors.push(h.error);

  const b = applyBreadcrumb(html, { depth, group });
  html = b.html;
  if (b.error) errors.push(b.error);

  const f = replaceFooter(html, { depth });
  html = f.html;
  if (f.error) errors.push(f.error);

  const s = applyScript(html, rel);
  html = s.html;
  if (s.error) errors.push(s.error);

  if (stripLegacyCss) {
    const c = stripLegacyChromeCss(html);
    html = c.html;
  }

  const changed = html !== original;
  if (changed && !dryRun && !checkMode) {
    fs.writeFileSync(file, html);
  }
  return { file: rel, changed, errors: errors.length ? errors : undefined };
}

function main() {
  let targets = collectTargets();
  if (checkMode && sampleN) targets = sample(targets, sampleN);
  const results = targets.map(processFile);
  const changedFiles = results.filter(r => r.changed);
  const errored = results.filter(r => r.errors);
  const skipped = results.filter(r => r.skipped);

  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : (checkMode ? 'check' : (stripLegacyCss ? 'strip-legacy-css' : 'apply')),
    files_scanned: results.length,
    files_changed: changedFiles.length,
    files_skipped: skipped.length,
    errors: errored.map(r => ({ file: r.file, errors: r.errors })),
    changed: changedFiles.map(r => r.file).slice(0, 50),
  }, null, 2));

  if (checkMode && changedFiles.length > 0) {
    console.error(`[FAIL] --check expects idempotence (0 changes) but found ${changedFiles.length}`);
    process.exit(1);
  }
  if (errored.length > 0 && !checkMode) {
    console.error(`[WARN] ${errored.length} file(s) had errors — see errors[] above`);
  }
  process.exit(0);
}

main();
