#!/usr/bin/env node
// 全特集記事の掲載店を監査し、LOCAL_STORES（実在データ）に存在しない店を洗い出す。
// 「存在しない」＝必ずしも架空ではない（HotPepper 未掲載の実在有名店を含む）ため、
// 出力は「要・実在検証」の候補リストとして使う。
//
// 使い方: node scripts/audit_feature_stores.js [--json]
//   --json: /tmp/feature_audit.json に {file: [店名,...]} を書き出す

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const STORES_DIR = path.join(ROOT, 'stores');

const { loadStores } = require('./lib/load_stores');
// SEO-106: 掲載店の実在判定は scripts/lib/feature_store_match.js の1本に集約
// （店舗カードへの「掲載特集」ラベル付与＝build.js と、この監査が同じロジックを共有する）
const { buildResolver, extractFeatureStoreNames } = require('./lib/feature_store_match');

function main() {
  const toJson = process.argv.includes('--json');
  // ISSUE-015-P2: data/stores.json 優先・index.html フォールバック
  const stores = loadStores();
  const resolver = buildResolver(stores);
  const result = {};
  let totalSuspect = 0, totalBroken = 0;

  for (const f of fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.html') && f !== 'index.html')) {
    const src = fs.readFileSync(path.join(FEATURES_DIR, f), 'utf8');
    const names = extractFeatureStoreNames(src);
    const suspect = [...new Set(names.filter(n => !resolver.resolve(n)))];
    const broken = [...new Set(
      [...src.matchAll(/href="\.\.\/stores\/([A-Za-z0-9]+)\.html"/g)].map(m => m[1])
        .filter(id => !fs.existsSync(path.join(STORES_DIR, id + '.html')))
    )];
    if (suspect.length || broken.length) {
      result[f] = { suspect, broken };
      totalSuspect += suspect.length;
      totalBroken += broken.length;
    }
  }

  if (toJson) {
    const flat = {};
    for (const [f, d] of Object.entries(result)) flat[f] = d.suspect;
    fs.writeFileSync('/tmp/feature_audit.json', JSON.stringify(flat, null, 2));
    console.log('→ /tmp/feature_audit.json に書き出し');
  }
  for (const [f, d] of Object.entries(result)) {
    console.log(`■ ${f}`);
    if (d.suspect.length) console.log(`   実在不明(${d.suspect.length}): ${d.suspect.join(' / ')}`);
    if (d.broken.length) console.log(`   リンク切れ: ${d.broken.join(', ')}`);
  }
  console.log(`\n合計 実在不明掲載店: ${totalSuspect} / リンク切れ: ${totalBroken} / 対象特集: ${Object.keys(result).length}`);
  process.exit(totalSuspect > 0 ? 1 : 0);
}

main();
