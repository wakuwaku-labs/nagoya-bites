#!/usr/bin/env node
/**
 * audit_tabelog_branch_mismatch.js
 *
 * 店舗データの食べログリンクのうち、名前は合っているのに別の支店・別の店のページを指すものを、
 * 照合キャッシュ（data/store_link_identity_checked.json）の事実だけで数える（ISSUE-159）。
 *
 * 照合器は食べログの題名に支店名が無いと、どの支店とも一致と判定していた（ISSUE-157:
 * 丸の内店に泉本店のページ）。照合器は ISSUE-159 から住所も比べるが、キャッシュは60日持ち越すため、
 * それより前に「一致」と記録したリンクは次の照合まで残る。ここでは、キャッシュに残っている
 * ページの住所（matchedAddressRaw か matchedAddress）と HotPepper の掲載住所（data/stores.json の
 * 「住所」）を compareJpAddress() で比べ直す。外部へは問い合わせない（制約10）。
 *
 * 数えるのは verdict が different のものだけ（市町村・区・町名・番地の頭の数字が表記ゆれでは説明
 * できないほど違う）。unknown（町名の表記ゆれ・番地が同じで町名が違う）は人の確認に残す。
 * 住所を持たない店（手動キュレーション店）・ページの住所が記録されていないものは数えない。
 *
 * 使い方:
 *   node scripts/audit_tabelog_branch_mismatch.js                 # 一覧を表示
 *   node scripts/audit_tabelog_branch_mismatch.js --check         # 1件でもあれば exit 1
 *   node scripts/audit_tabelog_branch_mismatch.js --json          # 一覧を JSON で出す
 *   node scripts/audit_tabelog_branch_mismatch.js --show-unknown  # 決められない組も表示する
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { compareJpAddress, linkCacheKey } = require('./lib/store_link_identity');
const { loadStores } = require('./lib/load_stores');

const ROOT = path.join(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'store_link_identity_checked.json');

/**
 * 店ごとに判定する（純関数・テスト対象）。
 * 戻り値: { different: [...], unknown: [...], counts: { linked, checked, compared, same, unknown, different } }
 */
function collect(cache, stores) {
  const out = { different: [], unknown: [], counts: { linked: 0, checked: 0, compared: 0, same: 0, unknown: 0, different: 0 } };
  for (const s of stores) {
    const url = String(s['食べログURL'] || '').trim();
    if (!/tabelog\.com\/[a-z]+\/A\d+\/A\d+\/\d+\/?$/i.test(url)) continue;
    out.counts.linked++;
    const name = s['店名'] || '';
    const entry = cache[linkCacheKey('tabelog', url, name)];
    if (!entry) continue;
    out.counts.checked++;
    const row = { id: s['ホットペッパーID'] || '', storeName: name, url, ourAddress: s['住所'] || '' };
    if (entry.ok === false && entry.reason === 'branch-address-mismatch') {
      out.counts.compared++;
      out.counts.different++;
      out.different.push({ ...row, pageAddress: entry.matchedAddressRaw || entry.matchedAddress || '', reason: entry.addressReason || 'judged', matchedName: entry.matchedName || '' });
      continue;
    }
    if (entry.ok !== true) continue;
    const pageAddress = entry.matchedAddressRaw || entry.matchedAddress || '';
    if (!row.ourAddress || !pageAddress) continue;
    const r = compareJpAddress(row.ourAddress, pageAddress);
    out.counts.compared++;
    out.counts[r.verdict]++;
    if (r.verdict === 'different') out.different.push({ ...row, pageAddress, reason: r.reason, matchedName: entry.matchedName || '' });
    else if (r.verdict === 'unknown') out.unknown.push({ ...row, pageAddress, reason: r.reason, matchedName: entry.matchedName || '' });
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  if (!fs.existsSync(CACHE_PATH)) {
    console.error(`照合キャッシュが無い: ${path.relative(ROOT, CACHE_PATH)}`);
    process.exit(2);
  }
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  const r = collect(cache, loadStores());
  if (args.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    for (const d of r.different) {
      console.log(`  ✗ ${d.id} ${d.storeName}（${d.reason}）`);
      console.log(`      我々の住所: ${d.ourAddress} → リンク先: ${d.pageAddress}  ${d.url}`);
    }
    if (args.includes('--show-unknown')) {
      for (const u of r.unknown) console.log(`  ? ${u.id} ${u.storeName}（${u.reason}）: ${u.ourAddress} ↔ ${u.pageAddress}`);
    }
    const c = r.counts;
    console.log(`名前は合っているが別の場所を指す食べログリンク: ${c.different} 件（食べログリンク ${c.linked} 件・照合済み ${c.checked} 件・住所を比べた ${c.compared} 件・同じ ${c.same} 件・決められない ${c.unknown} 件）`);
  }
  if (args.includes('--check') && r.counts.different > 0) process.exit(1);
}

if (require.main === module) main();
module.exports = { collect };
