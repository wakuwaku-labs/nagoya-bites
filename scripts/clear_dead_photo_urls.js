#!/usr/bin/env node
/**
 * ISSUE-124: CDN側で配信終了が「確定」した写真URLを、データの正本と手書きページから取り除き
 * 「写真なし」へ倒す（clear_broken_tabelog_links.js / clear_unverified_urls.js と同じ
 * 「安全側に倒し取り繕わない」思想）。他店・他記事の写真で埋めない・画素を発明しない。
 *
 * 入力: data/photo_url_liveness_report.json の dead[]
 *       （scripts/audit_photo_url_liveness.js が 404/410 を2回連続観測した確定分だけ。
 *        unknown＝タイムアウト/5xx/403 は対象外＝推測で消さない・制約10）
 * 台帳: data/dead_photo_urls.json（写真アセットID単位・追記専用）。build.js の
 *       normalizePhotoUrl が引くので、毎日の API 再取得で壊れたURLが蘇らない。
 *       レポートは次回の監査で上書きされる（クリア後は dead が0になる）ため、確定の記憶は台帳が持つ。
 *
 * クリアする層（台帳の全エントリを毎回照合＝冪等・再発時も同じコマンドで処理できる）:
 *   1. data/stores.json / data/manual_stores.json … 該当店の 写真URL を空に
 *   2. features/*.html … 該当店カードの <div class="store-photo">…</div> を除去
 *   3. data/featured.json … 該当する thumb を持つカードは --report に出す（自動で他の写真へは差し替えない）
 *   stores/*.html は gen-store-pages.js の生成物。この後に `node gen-store-pages.js` を回せば
 *   空の 写真URL から再生成される（build.yml は本スクリプトを gen-store-pages.js の前に置く）。
 *   journal/*.html（公開済みの過去記事）は取材・出所の帰属を含むため自動では触らず、--report に列挙する。
 *
 * 使い方:
 *   node scripts/clear_dead_photo_urls.js --dry-run   # 対象件数のみ表示（書き込まない）
 *   node scripts/clear_dead_photo_urls.js             # 台帳へ追記し各層をクリア
 *   --max 300 を超える新規確定は止める（誤爆防止・--force-large で解除）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { REGISTRY_PATH, hotpepperPhotoId, loadRegistry } = require('./lib/dead_photo_urls');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'photo_url_liveness_report.json');
const STORES_PATH = path.join(ROOT, 'data', 'stores.json');
const MANUAL_PATH = path.join(ROOT, 'data', 'manual_stores.json');
const FEATURES_DIR = path.join(ROOT, 'features');
const JOURNAL_DIR = path.join(ROOT, 'journal');
const FEATURED_PATH = path.join(ROOT, 'data', 'featured.json');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const forceLarge = argv.includes('--force-large');
const MAX_NEW = 300;

const jstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

/** レポートの確定deadを台帳へ追記する（assetIDで冪等）。新規追加分を返す。 */
function updateRegistry() {
  const registry = loadRegistry();
  const known = new Set(registry.entries.map((e) => e.assetId));
  const report = loadJson(REPORT_PATH, { dead: [] });
  const added = [];
  for (const d of report.dead || []) {
    if (d.host !== 'hotpepper') continue; // 判定器が確定させた HotPepper CDN 分のみ
    if (d.status !== 404 && d.status !== 410) continue;
    const assetId = d['写真アセットID'] || hotpepperPhotoId(d.url);
    if (!assetId || known.has(assetId)) continue;
    known.add(assetId);
    added.push({
      assetId,
      url: d.url,
      店名: d['店名'] || '',
      status: d.status,
      firstDetected: d.firstDetected || d.lastChecked || jstToday(),
      clearedAt: jstToday(),
    });
  }
  if (added.length > MAX_NEW && !forceLarge) {
    console.error(`新規の確定dead ${added.length}件は上限 ${MAX_NEW}件を超えています。内容を確認し --force-large で再実行してください。`);
    process.exit(2);
  }
  if (!dryRun && added.length) {
    registry.entries.push(...added);
    registry.entries.sort((a, b) => a.assetId.localeCompare(b.assetId));
    registry.note = 'CDN配信終了が確定（404/410を2回連続観測）した HotPepper 写真アセットの台帳。追記専用。scripts/clear_dead_photo_urls.js が更新し build.js の normalizePhotoUrl が参照する（ISSUE-124）。';
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  }
  return { registry, added };
}

function isDead(url, ids) {
  const id = hotpepperPhotoId(url);
  return !!id && ids.has(id);
}

/** 店舗レコード配列の、台帳に載った写真URLを空にする。 */
function clearStoreRecords(stores, ids) {
  let n = 0;
  const names = [];
  for (const s of stores) {
    let hit = false;
    for (const k of Object.keys(s)) {
      if (typeof s[k] === 'string' && /imgfp\.hotp\.jp/.test(s[k]) && isDead(s[k], ids)) {
        s[k] = '';
        hit = true;
      }
    }
    if (hit) { n++; names.push(s['店名'] || ''); }
  }
  return { n, names };
}

function patchStoresJson(ids) {
  const stores = loadJson(STORES_PATH, []);
  const r = clearStoreRecords(stores, ids);
  if (!dryRun && r.n) fs.writeFileSync(STORES_PATH, JSON.stringify(stores), 'utf8');
  return r;
}

function patchManualStores(ids) {
  const raw = loadJson(MANUAL_PATH, { stores: [] });
  const r = clearStoreRecords(raw.stores || [], ids);
  if (!dryRun && r.n) fs.writeFileSync(MANUAL_PATH, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  return r;
}

// features/*.html で壊れた写真が出てくる形。いずれも「写真ブロックごと除去＝写真なし表示」に倒す。
//  1. 店カードの <div class="store-photo"><img …></div>
//  2. 種別カードの <a class="type-photo" …><img …><span …>写真: …</span></a>
//  3. 単独行の <img …>（shop-card-photo / store-card-photo-top / card-img / 特集ヒーロー）
//  4. 3 の結果できた空の <div class="art-hero-image"></div>
const IMG = '<img [^>]*src="(https:\\/\\/imgfp\\.hotp\\.jp\\/[^"]+)"[^>]*>';
const PATTERNS = [
  new RegExp('[ \\t]*<div class="store-photo">' + IMG + '</div>\\r?\\n?', 'g'),
  new RegExp('[ \\t]*<a class="type-photo"[^>]*>' + IMG + '(?:<span class="type-photo-credit">[^<]*</span>)?</a>\\r?\\n?', 'g'),
  new RegExp('^[ \\t]*' + IMG + '[ \\t]*\\r?\\n', 'gm'),
];
const EMPTY_HERO_RE = /[ \t]*<div class="art-hero-image">\s*<\/div>\r?\n?/g;

/** features/*.html の、壊れた写真の画像ブロックを除去する（写真なし表示に倒す）。 */
function patchFeatures(ids) {
  let blocks = 0;
  const files = [];
  for (const f of fs.readdirSync(FEATURES_DIR).filter((x) => x.endsWith('.html'))) {
    const p = path.join(FEATURES_DIR, f);
    const html = fs.readFileSync(p, 'utf8');
    let n = 0;
    let out = html;
    for (const re of PATTERNS) {
      out = out.replace(re, (m, url) => {
        if (!isDead(url, ids)) return m;
        n++;
        return '';
      });
    }
    if (n) out = out.replace(EMPTY_HERO_RE, '');
    if (n) {
      blocks += n;
      files.push(f);
      if (!dryRun) fs.writeFileSync(p, out, 'utf8');
    }
  }
  return { blocks, files };
}

/** 自動では触らない残件（人が見て判断する）を列挙する。 */
function scanRemaining(ids) {
  const found = [];
  const scan = (dir, label) => {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(dir, f), 'utf8');
      const urls = html.match(/https:\/\/imgfp\.hotp\.jp\/[^"'\s<>)]+/g) || [];
      if (urls.some((u) => isDead(u, ids))) found.push(`${label}/${f}`);
    }
  };
  scan(JOURNAL_DIR, 'journal');
  scan(FEATURES_DIR, 'features');
  scan(path.join(ROOT, 'stores'), 'stores（gen-store-pages.js の再生成で解消。孤児ページは手当て）');
  const featured = fs.existsSync(FEATURED_PATH) ? fs.readFileSync(FEATURED_PATH, 'utf8') : '';
  const fu = featured.match(/https:\/\/imgfp\.hotp\.jp\/[^"'\s<>)]+/g) || [];
  if (fu.some((u) => isDead(u, ids))) found.push('data/featured.json(thumb)');
  return found;
}

function main() {
  console.log(`=== 配信終了写真URLのクリア${dryRun ? '（dry-run）' : ''} ===`);
  const { registry, added } = updateRegistry();
  const ids = new Set([...registry.entries.map((e) => e.assetId), ...added.map((e) => e.assetId)]);
  console.log(`台帳: 既存 ${registry.entries.length}件 / 今回新規 ${added.length}件`);

  const a = patchStoresJson(ids);
  console.log(`data/stores.json: ${a.n}店の写真URLを空に`);
  const b = patchManualStores(ids);
  console.log(`data/manual_stores.json: ${b.n}店の写真URLを空に`);
  const c = patchFeatures(ids);
  console.log(`features/*.html: 店カード画像 ${c.blocks}件を除去（${c.files.length}ファイル）`);

  const remaining = scanRemaining(ids);
  if (remaining.length) {
    console.log(`\n要確認の残件（自動では触らない）:`);
    for (const r of remaining) console.log(`  - ${r}`);
  }
  console.log('\nstores/*.html は `node gen-store-pages.js` で再生成してください。');
}

main();
