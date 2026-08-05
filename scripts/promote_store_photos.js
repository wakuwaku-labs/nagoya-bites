#!/usr/bin/env node
/**
 * 店舗写真を「実測で大きいと確認できた原寸マスター」に昇格する（画質改善・冪等）
 *
 * 問題:
 *   data/stores.json の写真URLの 97% が imgfp.hotp.jp の _480.jpg（480px マスター）。
 *   モーダルは幅 680pt / DPR3 = 実質 2040px の枠に表示するため、480px 画像が
 *   4倍前後に引き伸ばされてボケていた（画像CDN wsrv.nl は元画像より大きくしないため、
 *   w=1600 を要求しても 480px しか返ってこない）。
 *
 * 方針（CLAUDE.md 制約10: 検証できる事実だけで判定する）:
 *   サフィックスなしURL（..._480.jpg → ....jpg）は投稿時の原寸を返すが、
 *     - 約21% は 404（原寸が非公開）
 *     - 約6%  は原寸のほうが小さい（150px 等が実在）
 *   ため「URLの一括置換」は画質を下げる。よって
 *   scripts/probe_hotpepper_master.js が1件ずつ HTTP で実測した寸法を唯一の根拠とし、
 *   **実測幅が現在より大きいものだけ** を昇格する。推測では昇格しない。
 *
 * 冪等性:
 *   既に昇格済みのURLは対象外。新規追加店（weekly の fetch_hotpepper_popular.js 等）は
 *   実行時に自動で追加実測されるため、build に組み込めば以後も自動追従する。
 *
 * 使い方:
 *   node scripts/promote_store_photos.js --dry-run   # 変更せず内訳だけ表示
 *   node scripts/promote_store_photos.js             # data/stores.json を更新
 *   node scripts/promote_store_photos.js --check     # 昇格漏れがあれば非0終了（CI用）
 */
const fs = require('fs');
const path = require('path');
const { masterUrl, loadCache, ensureProbed, saveCache } = require('./probe_hotpepper_master.js');

const ROOT = path.join(__dirname, '..');
const STORES = path.join(ROOT, 'data', 'stores.json');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const CHECK = argv.includes('--check');

// wsrv.nl が確実に扱える上限。極端に重い原寸は変換タイムアウトの恐れがあるため昇格しない。
const MAX_MASTER_BYTES = 12 * 1024 * 1024;

/** URL に埋め込まれた現在の幅（_480.jpg → 480）。サフィックスなしは null。 */
function currentWidth(url) {
  const m = (url || '').match(/_(\d+)\.jpg$/);
  return m ? parseInt(m[1], 10) : null;
}

(async () => {
  const stores = JSON.parse(fs.readFileSync(STORES, 'utf8'));

  const cache = loadCache();
  const before = Object.keys(cache).length;
  await ensureProbed(stores.map((s) => s['写真URL']), cache);
  if (!DRY && Object.keys(cache).length !== before) saveCache(cache);

  const stat = { candidates: 0, promoted: 0, skipMissing: 0, skipNotBigger: 0, skipHeavy: 0, skipError: 0 };
  const gains = [];

  for (const s of stores) {
    const url = s['写真URL'];
    if (!masterUrl(url)) continue; // Hot Pepper の _NNN.jpg 以外（Google Places / 昇格済み）は対象外
    stat.candidates++;

    const r = cache[url];
    if (!r) { stat.skipError++; continue; }
    if (r.status === 404) { stat.skipMissing++; continue; }
    if (r.status !== 200 && r.status !== 206) { stat.skipError++; continue; }
    if (!r.w) { stat.skipError++; continue; }

    const cur = currentWidth(url) || 480;
    if (r.w <= cur) { stat.skipNotBigger++; continue; }
    if (r.bytes && r.bytes > MAX_MASTER_BYTES) { stat.skipHeavy++; continue; }

    gains.push({ name: s['店名'], from: cur, to: r.w, oldUrl: url, newUrl: masterUrl(url) });
    if (!DRY) {
      // 昇格しても _480 は生き続けるため、nbImage() 側で default フォールバックに使える
      s['写真URL'] = masterUrl(url);
      s['写真幅'] = r.w; // 実測値。srcset の上限決定と退行検知に使う
    }
    stat.promoted++;
  }

  const bucket = (w) => (w >= 1200 ? '1200px以上' : w >= 960 ? '960-1199px' : w >= 720 ? '720-959px' : '481-719px');
  const dist = {};
  for (const g of gains) dist[bucket(g.to)] = (dist[bucket(g.to)] || 0) + 1;

  console.log('=== 店舗写真の解像度昇格（実測ベース） ===');
  console.log(`対象（Hot Pepper 縮小画像）: ${stat.candidates} 件`);
  console.log(`昇格${DRY ? '可能' : '実施'}          : ${stat.promoted} 件`);
  console.log(`  内訳: ${Object.entries(dist).sort().map(([k, v]) => `${k} ${v}件`).join(' / ')}`);
  console.log(`据え置き（原寸なし404）  : ${stat.skipMissing} 件`);
  console.log(`据え置き（原寸が同等以下）: ${stat.skipNotBigger} 件`);
  if (stat.skipHeavy) console.log(`据え置き（原寸が過大）   : ${stat.skipHeavy} 件`);
  if (stat.skipError) console.log(`据え置き（取得エラー）   : ${stat.skipError} 件`);

  if (CHECK) {
    if (stat.promoted > 0) {
      console.error(`\nNG: 未昇格の高解像度写真が ${stat.promoted} 件あります。node scripts/promote_store_photos.js を実行してください。`);
      process.exit(1);
    }
    console.log('\nOK: 昇格漏れなし');
    return;
  }

  if (DRY) { console.log('\n--dry-run のため data/stores.json は変更していません'); return; }

  if (stat.promoted === 0) { console.log('\n変更なし（すべて昇格済み）'); return; }

  fs.writeFileSync(STORES, JSON.stringify(stores), 'utf8');
  console.log(`\n-> data/stores.json を更新しました`);

  // index.html のインライン LOCAL_STORES（TOP50）は build.js が埋め込むが、build.js は
  // Hot Pepper API 再取得を伴うため本スクリプトの後段では再実行できない。
  // ここで同じ置換を index.html にも適用し、build.js の実行順に依存しないようにする。
  const map = new Map();
  for (const g of gains) map.set(g.oldUrl, g.newUrl);
  const htmlPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  let hits = 0;
  for (const [o, n] of map) if (html.includes(o)) { html = html.split(o).join(n); hits++; }
  if (hits) { fs.writeFileSync(htmlPath, html, 'utf8'); }
  console.log(`-> index.html のインラインURL ${hits} 件を更新しました`);
  console.log('   次の手順: node gen-store-pages.js で stores/*.html を再生成してください');
})();
