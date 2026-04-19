#!/usr/bin/env node
/**
 * GA4 タグを未設置のHTMLページに一括挿入する
 *
 * 対象:
 *   - stores/*.html
 *   - features/*.html
 *   - about.html, contact.html, faq.html, manual_tagging.html
 *
 * index.html には既に設置済みのためスキップ。
 * 既にGA IDが含まれているファイルもスキップ（冪等）。
 *
 * 挿入位置: <meta charset="UTF-8"> の直後
 */

const fs = require('fs');
const path = require('path');

const GA_ID = 'G-3LCZNGZPWJ';
const GA_SNIPPET = `<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');
function trackEvent(name,params){if(typeof gtag==='function')gtag('event',name,params||{});}
</script>`;

const ROOT = path.resolve(__dirname, '..');

function collectTargets() {
  const targets = [];
  // 直下の特定HTML
  ['about.html', 'contact.html', 'faq.html', 'manual_tagging.html'].forEach(f => {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) targets.push(p);
  });
  // features/
  const featuresDir = path.join(ROOT, 'features');
  if (fs.existsSync(featuresDir)) {
    fs.readdirSync(featuresDir)
      .filter(f => f.endsWith('.html'))
      .forEach(f => targets.push(path.join(featuresDir, f)));
  }
  // stores/
  const storesDir = path.join(ROOT, 'stores');
  if (fs.existsSync(storesDir)) {
    fs.readdirSync(storesDir)
      .filter(f => f.endsWith('.html'))
      .forEach(f => targets.push(path.join(storesDir, f)));
  }
  return targets;
}

function injectGA(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  if (original.includes(GA_ID)) return { status: 'skip_existing', file: filePath };

  // <meta charset="UTF-8"> の直後に挿入（大文字小文字・ダブル/シングルクォート両対応）
  const charsetRegex = /(<meta\s+charset\s*=\s*["']UTF-8["']\s*\/?>)/i;
  const match = original.match(charsetRegex);
  if (!match) return { status: 'skip_no_charset', file: filePath };

  const updated = original.replace(charsetRegex, `$1\n${GA_SNIPPET}`);
  fs.writeFileSync(filePath, updated, 'utf8');
  return { status: 'injected', file: filePath };
}

function main() {
  const targets = collectTargets();
  console.log(`対象ファイル: ${targets.length}件`);

  const results = { injected: 0, skip_existing: 0, skip_no_charset: 0 };
  const skipped = [];

  for (const t of targets) {
    const r = injectGA(t);
    results[r.status]++;
    if (r.status === 'skip_no_charset') skipped.push(r.file);
  }

  console.log('');
  console.log('=== 結果 ===');
  console.log(`  ✅ 挿入:            ${results.injected}件`);
  console.log(`  ⏭  既に設置済み:    ${results.skip_existing}件`);
  console.log(`  ⚠️  charset未検出:  ${results.skip_no_charset}件`);

  if (skipped.length > 0) {
    console.log('');
    console.log('charset未検出ファイル:');
    skipped.forEach(f => console.log(`  - ${path.relative(ROOT, f)}`));
  }
}

main();
