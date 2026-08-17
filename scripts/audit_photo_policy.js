#!/usr/bin/env node
/**
 * 店舗写真の採用基準の退行検知（CI）
 *
 * 「新規店にも基準を設ける」を、宣言ではなく仕組みで担保するためのゲート。
 * 取得スクリプト側にゲートを入れても、別経路（手書き・別スクリプト・巻き戻し）から
 * 基準外の写真が入り込めば意味がないので、canonical を毎回検査して退行を止める。
 *
 * 判定は data/photo_policy.json（唯一の情報源）と scripts/lib/photo_policy.js（唯一の判定器）
 * に委ね、このスクリプトは走査と集計だけを行う。
 *
 * 検査対象（写真がサイトに出る全経路）:
 *   data/stores.json         … canonical カタログ
 *   data/manual_stores.json  … 手動キュレーション店
 *   data/pending_stores.json … ジャーナル経由の話題店
 *
 * 検査項目（すべて検証できる事実のみ）:
 *   1. Places 写真に客投稿（クレジット名≠店名）が混ざっていないか
 *   2. Places 写真のクレジットが欠落していないか（＝判定根拠なしで載っていないか）
 *   3. 禁止ストックホスト（Unsplash 等）が混ざっていないか
 *   4. AI超解像の痕跡（自ホストの派生画像）が混ざっていないか
 *
 * 使い方:
 *   node scripts/audit_photo_policy.js            # レポート
 *   node scripts/audit_photo_policy.js --check    # 違反があれば exit 1（CI用）
 *   node scripts/audit_photo_policy.js --list     # 違反店を全件表示
 */
const fs = require('fs');
const path = require('path');
const { loadPolicy, isOwnerAttribution, isPlacesPhotoUrl } = require('./lib/photo_policy');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const LIST = argv.includes('--list');

function readStores(file, key) {
  const p = path.join(ROOT, 'data', file);
  if (!fs.existsSync(p)) return [];
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const arr = key ? (j[key] || []) : (Array.isArray(j) ? j : []);
  return arr.map((s) => ({ ...s, __src: file }));
}

const policy = loadPolicy();
const stores = [
  ...readStores('stores.json', null),
  ...readStores('manual_stores.json', 'stores'),
  ...readStores('pending_stores.json', 'pending'),
];

const violations = { notOwner: [], noCredit: [], stockHost: [], selfHostedDerivative: [] };
let placesTotal = 0;

const STOCK = policy.prohibited.stockPhotoHosts || [];

for (const s of stores) {
  const url = String(s['写真URL'] || '');
  if (!url) continue;
  const label = `${s['店名'] || '(名称なし)'} [${s.__src}]`;

  if (STOCK.some((h) => url.includes(h))) { violations.stockHost.push(`${label} → ${url.slice(0, 60)}`); continue; }

  // AI超解像で作った派生画像を自ホストしていないか（禁止・data/photo_policy.json 参照）。
  // 実写を self-host できるのは「編集部の取材写真／店から許諾を得た写真」に限られ、
  // それらは /assets/store-photos/ 配下に置く運用。派生画像置き場の混入を検知する。
  if (policy.prohibited.aiUpscale && /\/assets\/(upscaled|enhanced|sr)\//.test(url)) {
    violations.selfHostedDerivative.push(`${label} → ${url}`);
    continue;
  }

  if (!isPlacesPhotoUrl(url)) continue;
  placesTotal++;

  const credit = String(s['写真クレジット'] || '').trim();
  if (!credit) { violations.noCredit.push(label); continue; }

  const r = isOwnerAttribution(credit, s['店名'], s['英語名']);
  if (!r.owner) violations.notOwner.push(`${label} → credit="${credit}" (sim ${r.sim})`);
}

const total = Object.values(violations).reduce((n, a) => n + a.length, 0);

console.log('=== 店舗写真 採用基準の監査 ===');
console.log(`基準: data/photo_policy.json v${policy.version}（${policy.updated} 更新）`);
console.log(`検査対象: ${stores.length}件（うち Places 写真 ${placesTotal}件）\n`);
console.log(`  客投稿の混入（クレジット名≠店名）    : ${violations.notOwner.length}件`);
console.log(`  判定根拠なし（クレジット欠落）        : ${violations.noCredit.length}件`);
console.log(`  禁止ストック写真                      : ${violations.stockHost.length}件`);
console.log(`  AI超解像の派生画像を自ホスト          : ${violations.selfHostedDerivative.length}件`);

if (LIST) {
  for (const [k, arr] of Object.entries(violations)) {
    if (!arr.length) continue;
    console.log(`\n[${k}]`);
    arr.forEach((x) => console.log(`  - ${x}`));
  }
} else if (total) {
  const sample = [...violations.notOwner, ...violations.noCredit, ...violations.stockHost, ...violations.selfHostedDerivative].slice(0, 8);
  console.log('\n[例]');
  sample.forEach((x) => console.log(`  - ${x}`));
  if (total > sample.length) console.log(`  … 他 ${total - sample.length}件（--list で全件）`);
}

if (CHECK) {
  if (total > 0) {
    console.error(`\nNG: 採用基準に反する写真が ${total}件あります。`);
    console.error('   Places 由来の客投稿は GOOGLE_MAPS_API_KEY=... node scripts/fetch_manual_store_photos.js --force で');
    console.error('   基準を満たす写真に取り直すか、基準を満たす写真が無ければ写真なし（SVG）に落としてください。');
    process.exit(1);
  }
  console.log('\nOK: 基準違反なし');
}
