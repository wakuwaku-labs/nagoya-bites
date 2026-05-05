#!/usr/bin/env node
/**
 * <a target="_blank"> に rel="noopener noreferrer" が無いものを補完する。
 * - 既に rel="..." がある場合: noopener / noreferrer がなければ追記
 * - rel が無い場合: 新規に rel="noopener noreferrer" を追加
 *
 * 対象: index.html / features/*.html / journal/*.html / stores/*.html
 *      テンプレ: gen-store-pages.js / journal/_template.html / scripts/refresh_journal_related.js
 *
 * JS 文字列内の onclick やテンプレリテラルにある target="_blank" もそのまま処理。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const TARGETS = [
  path.join(ROOT, 'index.html'),
  ...listFiles('features', /\.html$/),
  ...listFiles('journal', /\.html$/),
  ...listFiles('stores', /\.html$/),
  path.join(ROOT, 'gen-store-pages.js'),
  path.join(ROOT, 'about.html'),
  path.join(ROOT, 'contact.html'),
  path.join(ROOT, 'faq.html'),
].filter(p => fs.existsSync(p));

function listFiles(dir, re) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => re.test(f)).map(f => path.join(d, f));
}

// <a ... target="_blank" ...> を見つけて rel を補完
// HTML 属性順は不定なので、target="_blank" を含む <a ...> タグを captured.
function processHtml(text) {
  return text.replace(/<a\b([^>]*?)\btarget=["']_blank["']([^>]*)>/g, (full, before, after) => {
    const all = before + after;
    const relMatch = all.match(/\brel=["']([^"']*)["']/);
    if (relMatch) {
      const rel = relMatch[1];
      const has = (k) => rel.split(/\s+/).includes(k);
      if (has('noopener') && has('noreferrer')) return full; // 既に揃っている
      const next = [...new Set([...rel.split(/\s+/).filter(Boolean), 'noopener', 'noreferrer'])].join(' ');
      // before/after どちらに rel があるか不明なので置換は全文で
      return full.replace(/\brel=["'][^"']*["']/, `rel="${next}"`);
    }
    // rel 属性がない → 末尾 ">" の直前に挿入
    return full.replace(/>$/, ' rel="noopener noreferrer">');
  });
}

let totalFiles = 0;
let totalChanges = 0;
for (const fp of TARGETS) {
  const before = fs.readFileSync(fp, 'utf8');
  const after = processHtml(before);
  if (after !== before) {
    fs.writeFileSync(fp, after);
    const diff = (after.match(/rel="[^"]*noopener/g) || []).length - (before.match(/rel="[^"]*noopener/g) || []).length;
    totalFiles++;
    totalChanges += Math.max(diff, 0);
    console.log(`  ${path.relative(ROOT, fp)} (+${Math.max(diff,0)})`);
  }
}
console.log(`\n変更ファイル: ${totalFiles}件 / 追加rel: ${totalChanges}箇所`);
