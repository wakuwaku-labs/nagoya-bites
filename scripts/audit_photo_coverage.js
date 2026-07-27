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
//   4. 【重要】写真URLの「生死」を確かめる（ISSUE-074）
//      Google Places の lh3.googleusercontent.com の写真URLは、保存後に 403 になることが
//      ある（2026-07-26 実測: 96件中49件が失効）。URL が入っていても表示されないので、
//      「写真URLあり」の件数だけ見ると実態を過大評価する。--check-liveness で
//      Places URL を全件、HotPepper URL を抽出検査して「実際に見えている数」を出す。
//      ※ 失効は時間経過による一律の期限切れではなく写真ごとに個別に起きる（同日書込みの
//        URLが生存/失効に分かれた）。HotPepper の imgfp URL は恒久で失効しない。
//
// 使い方:
//   node scripts/audit_photo_coverage.js                   # 構造レポート（HTTP検査なし・高速）
//   node scripts/audit_photo_coverage.js --check-liveness  # 実配信を検査して実態カバレッジを出す
//   node scripts/audit_photo_coverage.js --strict          # 縮小サムネ残留/失効が非ゼロなら exit 1（CI向け）

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');
const CHECK_LIVENESS = process.argv.includes('--check-liveness') || STRICT;

// 1バイトだけ要求して配信されているかを確かめる。タイムアウトは「死んでいる」と断定しない。
function isUrlAlive(url) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve(true); }
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers: { Range: 'bytes=0-0' }, timeout: 10000 },
      (res) => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 400); }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(true); });
    req.end();
  });
}

async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    while (idx < items.length) { const i = idx++; out[i] = await fn(items[i]); }
  }));
  return out;
}

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
const hasUrl = buckets.google.length + buckets.hp480.length;
const igEmbed = stores.filter(s => /instagram\.com\/[^/]+\/(p|reel)\//.test(s['Instagram投稿URL'] || '')).length;

console.log('── 店舗写真カバレッジ ─────────────────────────');
console.log(`総店舗数            : ${total}`);
console.log(`写真URLあり         : ${hasUrl} (${(hasUrl / total * 100).toFixed(1)}%)`);
console.log(`  Google Places     : ${buckets.google.length}  ※期限付きURL・失効しうる`);
console.log(`  HotPepper _480    : ${buckets.hp480.length}  ※恒久URL`);
console.log(`縮小サムネ残留(退行): ${buckets.hpSmall.length}`);
console.log(`SVGプレースホルダー : ${buckets.svg.length}`);
console.log(`その他URL           : ${buckets.other.length}`);
console.log(`写真なし            : ${buckets.none.length}`);
console.log(`IG投稿embed可       : ${igEmbed} (店舗ページに公式Instagram実写を埋め込み表示)`);

// 写真ゼロ店の由来を示す（ISSUE-076: pending 由来が写真取得の対象外だった経緯があるため、
// 「どのマスターを直せば写真が付くか」が一目で分かるようにする）
const srcNames = { manual: new Set(), pending: new Set() };
try {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'manual_stores.json'), 'utf8'));
  (m.stores || []).forEach(s => srcNames.manual.add(s['店名']));
} catch { /* 無ければ由来注記を省くだけ */ }
try {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pending_stores.json'), 'utf8'));
  (p.pending || []).forEach(s => srcNames.pending.add(s['店名']));
} catch { /* 同上 */ }
const originOf = (n) => srcNames.manual.has(n) ? 'manual' : srcNames.pending.has(n) ? 'pending' : '由来不明';

const noReal = [...buckets.svg, ...buckets.none];
if (noReal.length) {
  console.log('\n── 実写ゼロの店舗（Google Places 三重検証ゲート未通過）──');
  console.log('   ※ 実在検証を通過するまで実写は付けない（CLAUDE.md 架空店ブロック）');
  const byOrigin = {};
  noReal.forEach(s => { const o = originOf(s['店名']); byOrigin[o] = (byOrigin[o] || 0) + 1; });
  console.log(`   由来内訳: ${Object.entries(byOrigin).map(([k, v]) => `${k}=${v}`).join(' / ')}`);
  for (const s of noReal) {
    const hints = [
      s['Instagram'] ? 'IG有' : '',
      s['食べログURL'] ? '食べログ有' : '',
      s['ホットペッパーID'] ? 'HP有' : '',
    ].filter(Boolean).join('/') || '一次情報リンクなし';
    console.log(`  - ${s['店名']}（${s['エリア']}・${s['追加日'] || '?'}追加）[${hints}]〈${originOf(s['店名'])}〉`);
  }
}

(async () => {
  let expiredCount = 0;
  if (CHECK_LIVENESS) {
    // Places URL は失効するので全件検査。HotPepper は恒久URLなので抽出検査で足りる。
    const HP_SAMPLE = 40;
    const hpSample = buckets.hp480.filter((_, i) => i % Math.max(1, Math.ceil(buckets.hp480.length / HP_SAMPLE)) === 0);

    console.log(`\n── 実配信検査（Places 全${buckets.google.length}件 / HotPepper 抽出${hpSample.length}件）──`);
    const gAlive = await mapWithConcurrency(buckets.google, 8, (s) => isUrlAlive(s['写真URL']));
    const hAlive = await mapWithConcurrency(hpSample, 8, (s) => isUrlAlive(s['写真URL']));

    const gDead = buckets.google.filter((_, i) => !gAlive[i]);
    const hDead = hpSample.filter((_, i) => !hAlive[i]);
    expiredCount = gDead.length;

    const gOk = buckets.google.length - gDead.length;
    console.log(`Google Places  : 表示OK ${gOk} / 失効 ${gDead.length}`);
    console.log(`HotPepper(抽出): 表示OK ${hpSample.length - hDead.length} / 失効 ${hDead.length}`);

    // 実態カバレッジ（Places は実測、HotPepper は抽出検査の生存率で外挿）
    const hpRate = hpSample.length ? (hpSample.length - hDead.length) / hpSample.length : 1;
    const actual = gOk + Math.round(buckets.hp480.length * hpRate);
    console.log(`\n実際に表示される写真: 約${actual}件 (${(actual / total * 100).toFixed(1)}%)  ← これが実態`);
    console.log(`（「写真URLあり ${hasUrl}件」との差 ${hasUrl - actual}件 が失効分）`);

    if (gDead.length) {
      console.log('\n失効している店（上位20件）:');
      gDead.slice(0, 20).forEach(s => console.log(`  ✗ ${s['店名']}（${s['エリア']}）`));
      if (gDead.length > 20) console.log(`  … 他 ${gDead.length - 20}件`);
      console.log('\n⚠️ Google Places の署名付きURLが失効しています。復旧手順:');
      console.log('   GOOGLE_MAPS_API_KEY=... node scripts/fetch_manual_store_photos.js');
      console.log('   → 生死判定で失効分だけ再取得され、node build.js && node gen-store-pages.js で反映されます。');
    }
  } else {
    console.log('\n※ 表示実態（Places署名URLの失効）は未検査です。--check-liveness で実配信を確かめられます。');
  }

  if (buckets.hpSmall.length) {
    console.log('\n⚠️ HotPepper縮小サムネが残留しています。build.js normalizePhotoUrl の退行か、');
    console.log('   旧データ混入です。node scripts/upgrade_photo_quality.js で修繕してください。');
  }

  if (STRICT && (buckets.hpSmall.length || expiredCount)) process.exit(1);
})();
