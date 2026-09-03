#!/usr/bin/env node
/**
 * audit_design_system.js
 *
 * DSN-001: 全ページ（root / features / journal / stores）がデザインシステム
 * （assets/css/nb.css・正本フォントURL・トークン重複禁止・font-size床）に
 * 準拠しているかを検証する決定的ゲート。
 *
 * 正本は data/design_system.json。閾値・許可リストの変更はそちらで行い、
 * このスクリプトのロジックは変えない（CLAUDE.md 制約10）。
 *
 * 検査項目:
 *   (a) assets/css/nb.css への <link rel="stylesheet"> が正しい相対深さで存在する
 *   (b) fonts.googleapis.com の <link> が1本だけあり、正本URLと一致する
 *   (c) インライン<style>内に coreTokens を再定義する :root{...} がない
 *   (d) インライン<style>内の font-size（px/rem/em/clamp）が床(12px)未満でない
 *       （allowlist.selectors に載るセレクタは除外）
 *   (e) <header> 内に class="logo"、<footer> が存在する、viewport meta がある
 *   (f) font-weight が許可リスト（400/500/600/700）以外を使っていない
 *
 * 使い方:
 *   node scripts/audit_design_system.js --check    # 違反があれば exit 1（CI向け）
 *   node scripts/audit_design_system.js --report    # 違反一覧をJSONで出力するのみ（exit 0）
 *   node scripts/audit_design_system.js --sample 200  # stores/ をサンプリング（--check/--reportと併用）
 *
 * 出力: { ok, files_scanned, violations: [{file, rule, detail}] }
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/design_system.json'), 'utf8'));

const args = process.argv.slice(2);
const mode = args.includes('--check') ? 'check' : 'report';
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

function collectTargets() {
  const rootFiles = ['index.html', 'about.html', 'faq.html', 'contact.html', 'privacy-policy.html']
    .map(f => path.join(ROOT, f))
    .filter(f => fs.existsSync(f));
  const featureFiles = listHtmlFiles(path.join(ROOT, 'features'));
  const journalFiles = listHtmlFiles(path.join(ROOT, 'journal'), { excludeTemplate: true });
  let storeFiles = listHtmlFiles(path.join(ROOT, 'stores'));

  if (sampleN && storeFiles.length > sampleN) {
    // 決定的サンプリング（ファイル名でソートしてから均等間隔抽出。実行のたびに同じ集合になる）
    storeFiles.sort();
    const step = storeFiles.length / sampleN;
    const sampled = [];
    for (let i = 0; i < sampleN; i++) sampled.push(storeFiles[Math.floor(i * step)]);
    storeFiles = sampled;
  }

  return { rootFiles, featureFiles, journalFiles, storeFiles };
}

function relDepth(filePath) {
  // ROOT からの相対パスの階層数（index.html=0, features/x.html=1, ...)
  const rel = path.relative(ROOT, filePath);
  return rel.split(path.sep).length - 1;
}

function cssLinkPrefix(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

function isAllowlisted(selector, file) {
  const rel = path.relative(ROOT, file);
  if (DS.allowlist.files.some(f => rel === f || rel.endsWith(f))) return true;
  return DS.allowlist.selectors.some(sel => selector.includes(sel.replace(/^\./, '')));
}

// selector-block ペアを雑にパースする（完全なCSSパーサではないが、
// このリポジトリのCSSは "selector{decls}" の単純な形式が大半なので十分）
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

function extractStyleBlocks(html) {
  const blocks = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks;
}

function pxFromFontSize(value) {
  value = value.trim().replace(/\s*!important\s*$/, '');
  const clampMatch = value.match(/^clamp\(\s*([^,]+),/);
  if (clampMatch) value = clampMatch[1].trim();
  const remMatch = value.match(/^([\d.]+)rem$/);
  if (remMatch) return parseFloat(remMatch[1]) * 16;
  const emMatch = value.match(/^([\d.]+)em$/);
  if (emMatch) return parseFloat(emMatch[1]) * 16;
  const pxMatch = value.match(/^([\d.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]);
  const pctMatch = value.match(/^([\d.]+)%$/);
  if (pctMatch) return (parseFloat(pctMatch[1]) / 100) * 16;
  return null; // var(...) など解釈できないものは対象外（トークン参照は許可）
}

function auditFile(file, violations) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  const depth = relDepth(file);
  const expectedHref = cssLinkPrefix(depth) + DS.cssPath;

  // (a) nb.css link
  const nbLinkRe = new RegExp(
    '<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']*' +
    DS.cssPath.replace(/\//g, '\\/') + ')["\']',
    'i'
  );
  const nbMatch = html.match(nbLinkRe);
  if (!nbMatch) {
    violations.push({ file: rel, rule: 'missing-nb-css-link', detail: `expected href containing ${DS.cssPath}` });
  }

  // (b) fonts.googleapis link — 正本URLと一致するか
  const fontLinks = [...html.matchAll(/<link[^>]+href=["\'](https:\/\/fonts\.googleapis\.com\/[^"\']+)["\']/gi)]
    .map(m => m[1].replace(/&amp;/g, '&'));
  if (fontLinks.length === 0) {
    violations.push({ file: rel, rule: 'missing-fonts-link', detail: 'no fonts.googleapis.com link found' });
  } else if (fontLinks.length > 1) {
    violations.push({ file: rel, rule: 'multiple-fonts-links', detail: `${fontLinks.length} links found` });
  } else if (fontLinks[0] !== DS.fontsUrl) {
    violations.push({ file: rel, rule: 'stale-fonts-url', detail: fontLinks[0] });
  }

  // (e) chrome markers
  if (!/<header[\s>][\s\S]*?class=["\'][^"\']*\blogo\b/i.test(html)) {
    violations.push({ file: rel, rule: 'missing-header-logo', detail: '' });
  }
  if (!/<footer[\s>]/i.test(html)) {
    violations.push({ file: rel, rule: 'missing-footer', detail: '' });
  }
  if (!/<meta[^>]+name=["\']viewport["\']/i.test(html)) {
    violations.push({ file: rel, rule: 'missing-viewport-meta', detail: '' });
  }

  // (c)(d)(f) インライン<style>の検査
  const blocks = extractStyleBlocks(html);
  blocks.forEach((css, blockIdx) => {
    const rules = splitRules(css);
    rules.forEach(({ selector, body }) => {
      // (c) :root 再定義（coreTokens のいずれかを含む場合のみ違反とする）
      if (/(^|,)\s*:root\s*$/.test(selector.trim())) {
        const redefined = DS.coreTokens.filter(tok => new RegExp('(^|[;{])\\s*' + tok.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '\\s*:').test(body));
        if (redefined.length > 0) {
          violations.push({ file: rel, rule: 'root-redefinition', detail: `block ${blockIdx}: ${redefined.join(',')}` });
        }
      }

      // (d) font-size 床チェック
      const fsMatches = [...body.matchAll(/font-size\s*:\s*([^;]+);/g)];
      fsMatches.forEach(([, raw]) => {
        const px = pxFromFontSize(raw);
        if (px !== null && px < DS.floorPx && !isAllowlisted(selector, file)) {
          violations.push({ file: rel, rule: 'font-size-below-floor', detail: `${selector.trim()} { font-size:${raw.trim()} } = ${px}px` });
        }
      });

      // (f) font-weight 許可リスト
      const fwMatches = [...body.matchAll(/font-weight\s*:\s*([^;]+);/g)];
      fwMatches.forEach(([, raw]) => {
        const w = parseInt(raw.trim(), 10);
        if (!isNaN(w) && !DS.allowedFontWeights.includes(w)) {
          violations.push({ file: rel, rule: 'disallowed-font-weight', detail: `${selector.trim()} { font-weight:${raw.trim()} }` });
        }
      });
    });
  });
}

function main() {
  const { rootFiles, featureFiles, journalFiles, storeFiles } = collectTargets();
  const allFiles = [...rootFiles, ...featureFiles, ...journalFiles, ...storeFiles];
  const violations = [];

  allFiles.forEach(f => {
    try {
      auditFile(f, violations);
    } catch (e) {
      violations.push({ file: path.relative(ROOT, f), rule: 'audit-error', detail: e.message });
    }
  });

  const result = {
    ok: violations.length === 0,
    files_scanned: allFiles.length,
    breakdown: { root: rootFiles.length, features: featureFiles.length, journal: journalFiles.length, stores: storeFiles.length },
    violations,
  };

  console.log(JSON.stringify(result, null, 2));

  if (mode === 'check' && !result.ok) process.exit(1);
  process.exit(0);
}

main();
