#!/usr/bin/env node
/**
 * 日次ジャーナルと特集の記事末尾に「X をフォロー」1行を当てる（Ondine #1808・冪等）。
 * 部品と判定は scripts/lib/x_follow_cta.js の1本。新しい記事は journal/_template.html にも入っているが、
 * 生成の経路を問わず入るよう、build.yml が日次でこれを回す。
 *
 *   node scripts/apply_x_follow_cta.js            # 書き込む
 *   node scripts/apply_x_follow_cta.js --dry-run  # 変わるファイルを表示するだけ
 *   node scripts/apply_x_follow_cta.js --check    # 当て漏れ・古い部品があれば exit 1
 */
const fs = require('fs');
const path = require('path');
const { kindOf, applyFollowCta } = require('./lib/x_follow_cta');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const check = args.includes('--check');

const changed = [];
let total = 0;
for (const dir of ['journal', 'features']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(n => n.endsWith('.html')).sort()) {
    const rel = `${dir}/${f}`;
    const full = path.join(ROOT, rel);
    const html = fs.readFileSync(full, 'utf8');
    const kind = kindOf(rel, html);
    if (!kind) continue;
    total++;
    const next = applyFollowCta(html, kind);
    if (next === html) continue;
    changed.push(rel);
    if (!dryRun && !check) fs.writeFileSync(full, next);
  }
}
console.log(`X フォローの1行: 対象 ${total} 本 / ${check || dryRun ? '要更新' : '更新'} ${changed.length} 本`);
for (const f of changed.slice(0, 20)) console.log(`  ${f}`);
if (changed.length > 20) console.log(`  … ほか ${changed.length - 20} 本`);
if (check && changed.length) process.exit(1);
