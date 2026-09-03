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
 *   1. fonts.googleapis.com の href を正本URL（data/design_system.json）に正規化
 *   2. fonts link の直後に assets/css/nb.css への <link> を挿入（未挿入時のみ）
 *   3. 最初の <style> 内の先頭 :root{...} が coreTokens のみで構成されるとき削除
 *      （chrome/base をnb.cssへ委譲するため）
 *   4. legacyRewrites に載る既知セレクタをトークン値へ書き換え
 *
 * 使い方:
 *   node scripts/apply_design_system.js --dry-run [--only <features|journal|stores|root>]
 *   node scripts/apply_design_system.js [--only <dir>]
 *   node scripts/apply_design_system.js --check   # 2回目実行で差分0なら冪等性OK（exit 0）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/design_system.json'), 'utf8'));

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
  };
  if (only) return groups[only] || [];
  return [...groups.root, ...groups.features, ...groups.journal, ...groups.stores];
}

function relDepth(filePath) {
  const rel = path.relative(ROOT, filePath);
  return rel.split(path.sep).length - 1;
}

function cssLinkPrefix(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

function normalizeFontsUrl(html) {
  const re = /<link[^>]+href=["\'](https:\/\/fonts\.googleapis\.com\/[^"\']+)["\'][^>]*>/i;
  const m = html.match(re);
  if (!m) return { html, changed: false };
  if (m[1].replace(/&amp;/g, '&') === DS.fontsUrl) return { html, changed: false };
  const newTag = `<link href="${DS.fontsUrl}" rel="stylesheet">`;
  return { html: html.replace(m[0], newTag), changed: true };
}

function insertNbCssLink(html, depth) {
  const href = cssLinkPrefix(depth) + DS.cssPath;
  const alreadyPresent = new RegExp(DS.cssPath.replace(/\//g, '\\/')).test(html);
  if (alreadyPresent) return { html, changed: false };

  const fontsLinkRe = /<link[^>]+href=["\']https:\/\/fonts\.googleapis\.com\/[^"\']+["\'][^>]*>/i;
  const m = html.match(fontsLinkRe);
  const tag = `\n<link rel="stylesheet" href="${href}">`;
  if (m) {
    const idx = html.indexOf(m[0]) + m[0].length;
    return { html: html.slice(0, idx) + tag + html.slice(idx), changed: true };
  }
  // フォールバック: </head> の直前に挿入
  if (html.includes('</head>')) {
    return { html: html.replace('</head>', tag + '\n</head>'), changed: true };
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

function processFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  let html = original;
  let anyChanged = false;

  const r1 = normalizeFontsUrl(html); html = r1.html; anyChanged = anyChanged || r1.changed;
  const r2 = insertNbCssLink(html, relDepth(file)); html = r2.html; anyChanged = anyChanged || r2.changed;
  const r3 = stripChromeAndRoot(html); html = r3.html; anyChanged = anyChanged || r3.changed;
  const r4 = applyLegacyRewrites(html); html = r4.html; anyChanged = anyChanged || r4.changed;

  if (anyChanged && !dryRun && !checkMode) {
    fs.writeFileSync(file, html);
  }
  return { file: path.relative(ROOT, file), changed: anyChanged };
}

function main() {
  const targets = collectTargets();
  const results = targets.map(processFile);
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
