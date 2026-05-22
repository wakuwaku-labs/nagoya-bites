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

const norm = (s) => String(s || '').replace(/\s|　/g, '').replace(/&amp;/g, '&').toLowerCase();

function loadRealNames() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const L = JSON.parse(html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/)[1]);
  return new Set(L.map(s => norm(s['店名'])));
}

function main() {
  const toJson = process.argv.includes('--json');
  const realNames = loadRealNames();
  const result = {};
  let totalSuspect = 0, totalBroken = 0;

  for (const f of fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.html') && f !== 'index.html')) {
    const src = fs.readFileSync(path.join(FEATURES_DIR, f), 'utf8');
    const names = [...src.matchAll(/class="(?:shop-name|store-name)"[^>]*>(?:<a[^>]*>)?([^<]+)/g)]
      .map(m => m[1].trim());
    const suspect = [...new Set(names.filter(n => !realNames.has(norm(n))))];
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
