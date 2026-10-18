#!/usr/bin/env node
/**
 * 話題店のうち、ホットペッパーIDを持たない店の「営業時間・定休日・ホットペッパーのページ」を
 * グルメサーチ API で見つけて data/hotpepper_trending_details.json に残す（2026-10-19）。
 *
 * 背景: 外部記事から取り込んだ話題店は営業時間・リンクが空だった。ホットペッパーID を欄に入れると
 * 店舗ページのURL（スラグ）と予約送客の計測が変わるため、ID は入れず、別ファイルに持つ。
 * build.js が営業時間・定休日・「ホットペッパー掲載URL」だけを店に載せる（予約送客には数えない）。
 *
 * 採用は検証できる事実だけ（制約10）: 店名が namesMatch で合い、かつ住所が compareJpAddress で same のときだけ。
 * 住所を持たない店は照合できないので見送る。見つからなかった店は 14 日あけてから探し直す。
 * HOTPEPPER_API_KEY が無いときは何もせず正常終了する。
 *   node scripts/enrich_hotpepper_details.js [--limit N] [--dry-run]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { namesMatch } = require('./lib/store_name_match');
const { compareJpAddress } = require('./lib/store_link_identity');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'hotpepper_trending_details.json');
const RETRY_DAYS = 14;

function searchName(name) {
  return String(name || '').replace(/【[^】]*】/g, ' ').replace(/[（(][^）)]*[）)]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** API の shop 群から、店名・住所の両方が合う1件を選ぶ（合う店が複数でも先頭ではなく、1件に決まるときだけ） */
function pickShop(store, shops) {
  const hits = (shops || []).filter((sh) =>
    namesMatch(store['店名'], sh.name) && compareJpAddress(store['住所'], sh.address) === 'same');
  return hits.length === 1 ? hits[0] : null;
}

function toEntry(shop, now) {
  return {
    id: shop.id,
    url: (shop.urls && shop.urls.pc) || `https://www.hotpepper.jp/str${shop.id}/`,
    営業時間: shop.open || '',
    定休日: String(shop.close || '').trim().slice(0, 80),
    checkedAt: now,
  };
}

async function main() {
  const key = process.env.HOTPEPPER_API_KEY;
  if (!key) { console.log('HOTPEPPER_API_KEY 未設定のため何もしません'); return; }
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry-run');
  const li = argv.indexOf('--limit');
  const limit = li >= 0 ? parseInt(argv[li + 1], 10) : 60;

  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
  const stores = Array.isArray(raw) ? raw : raw.stores;
  const cache = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const now = new Date().toISOString();
  const stale = (c) => !c || (!c.id && (Date.now() - Date.parse(c.checkedAt || 0)) > RETRY_DAYS * 864e5);

  const targets = stores
    .filter((s) => s['話題フラグ'] && !s['ホットペッパーID'] && s['住所'] && stale(cache[s['店名']]))
    .slice(0, limit);
  console.log(`対象 ${targets.length}店`);
  let found = 0;
  for (const s of targets) {
    const url = `https://webservice.recruit.co.jp/hotpepper/gourmet/v1/?key=${key}&format=json&count=10&keyword=${encodeURIComponent(searchName(s['店名']))}`;
    let shops;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.results && data.results.error) throw new Error(JSON.stringify(data.results.error).replace(key, '***'));
      shops = (data.results && data.results.shop) || [];
    } catch (e) {
      console.log(`✗ ${s['店名']}: ${String(e.message).replace(key, '***')}（記録せず次回に回す）`);
      continue;
    }
    const shop = pickShop(s, shops);
    cache[s['店名']] = shop ? toEntry(shop, now) : { id: '', checkedAt: now };
    if (shop) found++;
    console.log(`${shop ? '✓' : '－'} ${s['店名']}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`見つかった ${found} / ${targets.length}`);
  if (!dry) fs.writeFileSync(OUT, JSON.stringify(cache, null, 2) + '\n');
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { pickShop, toEntry, searchName };
