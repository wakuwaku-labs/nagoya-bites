#!/usr/bin/env node
/**
 * apply_design_system.js
 *
 * DSN-001: 既存ページへデザインシステムを一括適用する（冪等）。
 * <head> と最初の <style> ブロックの先頭 :root のみを触り、それ以外の
 * マーカー（FEATURED/SHOWCASE/LATEST_JOURNAL/STORE-INDEX/SCENE-INDEX/
 * REVIEW_TRUST_BOX/SEO-042 TOP-CTA/SEASONAL_NOTE）や本文構造には触れない。
 *
 * 処理内容:
 *   1. Web フォント（fonts.googleapis.com / fonts.gstatic.com）の <link> を外し、<style> に直書きされた
 *      書体名（'Cormorant Garamond'・'Noto Sans JP'・'DM Mono'）をトークン（var(--font-*)）へ書き換える
 *      （P-318・判断の記録 0026。判定と書き換えは scripts/lib/web_fonts.js の1本）
 *   2. <style> の手前（無ければ </head> の直前）に assets/css/nb.css への <link> を挿入（未挿入時のみ）
 *   3. 最初の <style> 内の先頭 :root{...} が coreTokens のみで構成されるとき削除
 *      （chrome/base をnb.cssへ委譲するため）
 *   4. legacyRewrites に載る既知セレクタをトークン値へ書き換え
 *   孤児ページ（旧テンプレートの単独ページ・data/store_page_orphans.json）には 1 だけを行う。nb.css を読み込まない
 *   ページは、トークンの代わりに端末の書体の並びを直接書く（トークンが定義されていないため）。
 *
 * 使い方:
 *   node scripts/apply_design_system.js --dry-run [--only <features|journal|stores|root|orphans>]
 *   node scripts/apply_design_system.js [--only <dir>]
 *   node scripts/apply_design_system.js --check   # 2回目実行で差分0なら冪等性OK（exit 0）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/design_system.json'), 'utf8'));
const webFonts = require('./lib/web_fonts');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const checkMode = args.includes('--check');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

function listHtmlFiles(dir, opts) {
  opts = opts || {};
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .filter(f => !opts.excludeTemplate || !f.startsWith('_'))
    .map(f => path.join(dir, f));
}

function collectTargets() {
  const groups = {
    root: ['index.html', 'about.html', 'faq.html', 'contact.html', 'privacy-policy.html']
      .map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f)),
    features: listHtmlFiles(path.join(ROOT, 'features')),
    journal: listHtmlFiles(path.join(ROOT, 'journal'), { excludeTemplate: true })
      .concat(path.join(ROOT, 'journal/_template.html')).filter(f => fs.existsSync(f)),
    stores: [path.join(ROOT, 'stores/index.html')].filter(f => fs.existsSync(f)),
    orphans: orphanStorePages(),
  };
  if (only) return groups[only] || [];
  return [...groups.root, ...groups.features, ...groups.journal, ...groups.stores, ...groups.orphans];
}

// gen-store-pages.js が作り直さない店舗ページ（data/stores.json に無い旧テンプレートの「孤児」と、誘導ページ）。
// 台帳 data/store_page_orphans.json（gen-store-pages.js --check-orphans が書く）が唯一の情報源。
function orphanStorePages() {
  const p = path.join(ROOT, 'data', 'store_page_orphans.json');
  if (!fs.existsSync(p)) return [];
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const slugs = new Set([...(j.orphanSlugs || []), ...(j.redirectStubSlugs || [])]);
    return [...slugs].sort().map(s => path.join(ROOT, 'stores', s + '.html')).filter(f => fs.existsSync(f));
  } catch (e) {
    return [];
  }
}

function relDepth(filePath) {
  const rel = path.relative(ROOT, filePath);
  return rel.split(path.sep).length - 1;
}

function cssLinkPrefix(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

// Web フォントの <link> を外し、直書きの書体名を書き換える（P-318）。
// nb.css を読み込まないページ（孤児ページ）はトークンが無いので、端末の書体の並びを直接書く。
function removeWebFonts(html) {
  const r1 = webFonts.removeWebFontLinks(html);
  const r2 = webFonts.rewriteFamilyLiterals(r1.html, { useTokens: webFonts.loadsNbCss(r1.html) });
  return { html: r2.html, changed: r1.changed || r2.changed };
}

function insertNbCssLink(html, depth) {
  const href = cssLinkPrefix(depth) + DS.cssPath;
  const alreadyPresent = new RegExp(DS.cssPath.replace(/\//g, '\\/')).test(html);
  if (alreadyPresent) return { html, changed: false };

  // ページ固有の <style> より前に置く（ページ側が nb.css を上書きできる読み込み順にする）。無ければ </head> の直前
  const tag = `<link rel="stylesheet" href="${href}">\n`;
  const styleIdx = html.search(/<style\b/i);
  const headEnd = html.indexOf('</head>');
  if (styleIdx >= 0 && (headEnd < 0 || styleIdx < headEnd)) {
    return { html: html.slice(0, styleIdx) + tag + html.slice(styleIdx), changed: true };
  }
  if (headEnd >= 0) {
    return { html: html.slice(0, headEnd) + tag + html.slice(headEnd), changed: true };
  }
  return { html, changed: false };
}

// selector-block ペアを雑にパースする（audit_design_system.js と同じアルゴリズム）。
// @media(...) のようなat-ruleはその中身を1つのbodyとして扱う（入れ子のセレクタは分解しない）ため、
// 「トップレベルのnav{}」だけを対象にでき、「@media内のnav{display:none}」を誤って消さない。
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
        // selBuf には直前の /* コメント */ が混入し得る（次のセレクタ名にくっつく）。
        // マッチング用に取り除いた cleanSelector を別途持たせる（rawは復元用に保持）。
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

function stripChromeAndRoot(html) {
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) return { html, changed: false };
  const styleBody = styleMatch[1];
  const rules = splitRules(styleBody);

  let changed = false;
  const kept = rules.filter(({ selector, body }) => {
    // :root は宣言が全て coreTokens の場合のみ削除（未知のページ固有トークンが混じる場合は保持）
    if (/^:root$/.test(selector.trim())) {
      const decls = body.split(';').map(d => d.trim()).filter(Boolean);
      const declNames = decls.map(d => d.split(':')[0].trim());
      const allCore = decls.length > 0 && declNames.every(name => DS.coreTokens.includes(name));
      if (allCore) { changed = true; return false; }
      return true;
    }
    // 単一セレクタ（カンマ区切りなし）が chromeSelectors に完全一致する場合のみ削除
    if (DS.chromeSelectors.includes(selector.trim())) { changed = true; return false; }
    return true;
  });

  if (!changed) return { html, changed: false };

  const newStyleBody = kept.map(r => `${r.rawSelector.trim()}{${r.body}}`).join('\n');
  const newHtml = html.replace(styleMatch[1], newStyleBody);
  return { html: newHtml, changed: true };
}

function applyLegacyRewrites(html) {
  let changed = false;
  let out = html;
  (DS.legacyRewrites.rules || []).forEach(rule => {
    const needle = `${rule.selector}{${rule.match}}`;
    if (out.includes(needle)) {
      out = out.split(needle).join(`${rule.selector}{${rule.replace}}`);
      changed = true;
    }
  });
  return { html: out, changed };
}

function processFile(file, opts) {
  opts = opts || {};
  const original = fs.readFileSync(file, 'utf8');
  let html = original;
  let anyChanged = false;

  const r1 = removeWebFonts(html); html = r1.html; anyChanged = anyChanged || r1.changed;
  if (!opts.fontsOnly) {
    const r2 = insertNbCssLink(html, relDepth(file)); html = r2.html; anyChanged = anyChanged || r2.changed;
    const r3 = stripChromeAndRoot(html); html = r3.html; anyChanged = anyChanged || r3.changed;
    const r4 = applyLegacyRewrites(html); html = r4.html; anyChanged = anyChanged || r4.changed;
  }

  if (anyChanged && !dryRun && !checkMode) {
    fs.writeFileSync(file, html);
  }
  return { file: path.relative(ROOT, file), changed: anyChanged };
}

function main() {
  const targets = collectTargets();
  const orphanSet = new Set(orphanStorePages());
  const results = targets.map(f => processFile(f, { fontsOnly: orphanSet.has(f) }));
  const changedFiles = results.filter(r => r.changed);

  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : (checkMode ? 'check' : 'apply'),
    files_scanned: results.length,
    files_changed: changedFiles.length,
    changed: changedFiles.map(r => r.file),
  }, null, 2));

  if (checkMode && changedFiles.length > 0) {
    console.error(`[FAIL] --check expects idempotence (0 changes) but found ${changedFiles.length}`);
    process.exit(1);
  }
  process.exit(0);
}

main();
