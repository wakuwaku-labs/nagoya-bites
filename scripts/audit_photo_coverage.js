#!/usr/bin/env node
// 店舗写真カバレッジ監査（観測・退行防止）
//
// 目的:
//   1. canonical カタログ(data/stores.json)の写真ソース内訳を可視化する
//      （Google Places実写 / HotPepper _480 / 縮小サムネ残留 / SVGプレースホルダー / 写真なし）
//   2. HotPepper 縮小サムネ(_238等)の「残留」を検知する
//      → build.js の normalizePhotoUrl() が昇格するため通常ゼロ。非ゼロは退行。
//   3. 実写ゼロの店舗リストを出す（Google Places 三重検証ゲート未通過の店。
//      実在検証(架空店ブロック)を通らない限り実写は付かない仕様 — ゲートは緩めないこと）
//
// 使い方:
//   node scripts/audit_photo_coverage.js           # レポート表示
//   node scripts/audit_photo_coverage.js --strict  # 縮小サムネ残留が非ゼロなら exit 1（CI向け）

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));

const buckets = { google: [], hp480: [], hpSmall: [], svg: [], other: [], none: [] };
for (const s of stores) {
  const u = String(s['写真URL'] || '').trim();
  if (!u) buckets.none.push(s);
  else if (u.includes('googleusercontent.com')) buckets.google.push(s);
  else if (/imgfp\.hotp\.jp\/.+_480\.jpg/.test(u)) buckets.hp480.push(s);
  else if (/imgfp\.hotp\.jp/.test(u)) buckets.hpSmall.push(s);
  else if (u.includes('/assets/store-figures/')) buckets.svg.push(s);
  else buckets.other.push(s);
}

const total = stores.length;
const realPhoto = buckets.google.length + buckets.hp480.length;
const igEmbed = stores.filter(s => /instagram\.com\/[^/]+\/(p|reel)\//.test(s['Instagram投稿URL'] || '')).length;

console.log('── 店舗写真カバレッジ ─────────────────────────');
console.log(`総店舗数            : ${total}`);
console.log(`実写あり            : ${realPhoto} (${(realPhoto / total * 100).toFixed(1)}%)`);
console.log(`  Google Places実写 : ${buckets.google.length}`);
console.log(`  HotPepper _480    : ${buckets.hp480.length}`);
console.log(`縮小サムネ残留(退行): ${buckets.hpSmall.length}`);
console.log(`SVGプレースホルダー : ${buckets.svg.length}`);
console.log(`その他URL           : ${buckets.other.length}`);
console.log(`写真なし            : ${buckets.none.length}`);
console.log(`IG投稿embed可       : ${igEmbed} (店舗ページに公式Instagram実写を埋め込み表示)`);

const noReal = [...buckets.svg, ...buckets.none];
if (noReal.length) {
  console.log('\n── 実写ゼロの店舗（Google Places 三重検証ゲート未通過）──');
  console.log('   ※ 実在検証を通過するまで実写は付けない（CLAUDE.md 架空店ブロック）');
  for (const s of noReal) {
    const hints = [
      s['Instagram'] ? 'IG有' : '',
      s['食べログURL'] ? '食べログ有' : '',
      s['ホットペッパーID'] ? 'HP有' : '',
    ].filter(Boolean).join('/') || '一次情報リンクなし';
    console.log(`  - ${s['店名']}（${s['エリア']}・${s['追加日'] || '?'}追加）[${hints}]`);
  }
}

if (buckets.hpSmall.length) {
  console.log('\n⚠️ HotPepper縮小サムネが残留しています。build.js normalizePhotoUrl の退行か、');
  console.log('   旧データ混入です。node scripts/upgrade_photo_quality.js で修繕してください。');
  if (STRICT) process.exit(1);
}
