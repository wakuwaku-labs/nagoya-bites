#!/usr/bin/env node
/**
 * 特集の掲載数の表記をそろえる（SEO-146・冪等）。
 * 掲載数は各特集の ItemList の件数＝要素数＝店カード枚数が一致したときだけ「確かめられる件数」とし、
 * 自ページの title・説明文・h1・meta 行・JSON-LD・「本特集のN軒」などの表記と、
 * 他の特集へのリンク文（features/index.html のカード・JSON-LD の名前を含む）の「N選」をその数に合わせる。
 * 判定と書き換えは scripts/lib/feature_counts.js の1本。
 *
 *   node scripts/sync_feature_counts.js            # 書き込む
 *   node scripts/sync_feature_counts.js --dry-run  # 変わる表記を表示するだけ
 *   node scripts/sync_feature_counts.js --check    # ずれがあれば exit 1（CI 向け）
 *   node scripts/sync_feature_counts.js --only <語> # ファイル名にその語を含むページだけ
 *   node scripts/sync_feature_counts.js --target journal|stores
 *       # ジャーナル・店舗ページから特集へのリンク文の件数だけをそろえる（SEO-147）
 *
 * build.yml が、特集を書き換えるステップ（build_featured / refresh_feature_rosters /
 * add_feature_top_cta / add_feature_journal_links / apply_feature_byline）の後に日次で回す。
 * 掲載店の入れ替えで件数が変わった日も、同じ実行の中で表記が追いつく。
 * 店舗ページ（--target stores）は build.yml が店舗ページの再生成の後に回す（再生成されない孤児ページと
 * stores/index.html のため）。ジャーナル（journal/）は書き手を1つにするため build.yml では触らず、
 * 日次ジャーナルの流れで動く refresh_journal_related.js が同じ書き換えを呼ぶ。
 */
const { syncAll } = require('./lib/feature_counts');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const check = args.includes('--check');
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? args[onlyAt + 1] || '' : null;
const targetAt = args.indexOf('--target');
const target = targetAt >= 0 ? args[targetAt + 1] || '' : 'features';

const { counts, changed } = syncAll({ target, write: !dryRun && !check, only });
const verb = check || dryRun ? '要更新' : '更新';
const what = target === 'features' ? '特集の掲載数の表記' : `${target}/ から特集へのリンク文の件数`;
console.log(`${what}: 件数を確かめられた特集 ${Object.keys(counts).length} 本 / ${verb} ${changed.length} 本`);
for (const c of changed) {
  const agg = {};
  for (const x of c.changes) agg[x] = (agg[x] || 0) + 1;
  console.log(`  ${c.file}: ${Object.entries(agg).map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(' / ')}`);
}
if (check && changed.length) process.exit(1);
