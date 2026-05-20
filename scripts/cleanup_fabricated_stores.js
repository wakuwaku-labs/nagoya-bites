#!/usr/bin/env node
// 実在検証で「架空 / 名古屋以外」と判定された手動店を、サイト全体から除去する。
// 削除対象は /tmp/remove_names.json（店名配列）。保持する実在12店は manual_stores.json に残っている。
//
// 処理:
//   1) index.html の LOCAL_STORES から削除対象を除外（build.js と同じ compact JSON.stringify で再書き込み）
//      残す手動店は manual_stores.json の最新（エリア修正・実写URL）で上書き
//   2) stores/M*.html のうち削除対象店のページを削除
//   3) features/*.html の shop-card から削除対象店を除去
//   4) data/daily_trending5.json / trending_stores.json から削除対象を除去
//
// 使い方: node scripts/cleanup_fabricated_stores.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const STORES_DIR = path.join(ROOT, 'stores');
const FEATURES_DIR = path.join(ROOT, 'features');

const removeNames = new Set(JSON.parse(fs.readFileSync('/tmp/remove_names.json', 'utf8')));
const manual = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'manual_stores.json'), 'utf8')).stores;
const keepMap = new Map(); // 店名 → {エリア, 写真URL}
for (const s of manual) keepMap.set(s['店名'], { area: s['エリア'] || '', photo: s['写真URL'] || '' });

const norm = (s) => String(s || '').replace(/\s|　/g, '');
const removeNormSet = new Set([...removeNames].map(norm));

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const report = { localStoresRemoved: 0, localStoresUpdated: 0, pagesDeleted: 0, featureCardsRemoved: 0, featureFilesTouched: 0, trendingRemoved: 0 };

  // ── 1) index.html LOCAL_STORES ────────────────────────────────
  let html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('LOCAL_STORES not found');
  const stores = JSON.parse(m[1]);
  const filtered = [];
  for (const s of stores) {
    const nm = norm(s['店名']);
    const isManual = !s['ホットペッパーID']; // 手動店は HP ID なし
    if (isManual && removeNormSet.has(nm)) { report.localStoresRemoved++; continue; }
    // 保持する手動店はエリア・写真を最新化
    if (isManual && keepMap.has(s['店名'])) {
      const k = keepMap.get(s['店名']);
      if (k.area) s['エリア'] = k.area;
      if (k.photo) s['写真URL'] = k.photo;
      report.localStoresUpdated++;
    }
    filtered.push(s);
  }
  const jsonStr = JSON.stringify(filtered);
  html = html.replace(/var LOCAL_STORES = \[[\s\S]*?\];/, 'var LOCAL_STORES = ' + jsonStr + ';');
  if (!dryRun) fs.writeFileSync(INDEX, html, 'utf8');

  // ── 2) stores/M*.html 削除 ────────────────────────────────────
  if (fs.existsSync(STORES_DIR)) {
    for (const f of fs.readdirSync(STORES_DIR)) {
      if (!/^M\d+\.html$/.test(f)) continue;
      const content = fs.readFileSync(path.join(STORES_DIR, f), 'utf8');
      const nameM = content.match(/<h1[^>]*>([^<]+)<\/h1>/);
      const nm = nameM ? norm(nameM[1]) : '';
      if (nm && removeNormSet.has(nm)) {
        if (!dryRun) fs.unlinkSync(path.join(STORES_DIR, f));
        report.pagesDeleted++;
      }
    }
  }

  // ── 3) features/*.html の shop-card 除去 ──────────────────────
  // shop-card / store-card ブロック内の店名(alt または store-name)が削除対象なら、そのカードブロックを除去
  for (const f of fs.readdirSync(FEATURES_DIR)) {
    if (!f.endsWith('.html') || f === 'index.html') continue;
    const file = path.join(FEATURES_DIR, f);
    let src = fs.readFileSync(file, 'utf8');
    let touched = 0;
    // <div class="shop-card"> ... </div>（detail-link まで含む単位）と <div class="store-card"> 両対応
    for (const cls of ['shop-card', 'store-card']) {
      const re = new RegExp(`<div class="${cls}">[\\s\\S]*?</div>\\s*</div>`, 'g');
      src = src.replace(re, (block) => {
        // ブロック内の店名候補（alt / shop-name / store-name）
        const names = [];
        const altM = block.match(/alt="([^"]+)"/); if (altM) names.push(altM[1]);
        const snM = block.match(/class="(?:shop-name|store-name)"[^>]*>([^<]+)/); if (snM) names.push(snM[1]);
        const linkM = block.match(/class="(?:shop-name|store-name)"[^>]*><a[^>]*>([^<]+)/); if (linkM) names.push(linkM[1]);
        if (names.some(n => removeNormSet.has(norm(n)))) { touched++; return ''; }
        return block;
      });
    }
    if (touched > 0) {
      if (!dryRun) fs.writeFileSync(file, src, 'utf8');
      report.featureCardsRemoved += touched;
      report.featureFilesTouched++;
    }
  }

  // ── 4) trending データ ────────────────────────────────────────
  for (const tf of ['data/daily_trending5.json', 'data/trending_stores.json']) {
    const p = path.join(ROOT, tf);
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const arr = data.stores || (Array.isArray(data) ? data : null);
    if (!arr) continue;
    const before = arr.length;
    const kept = arr.filter(s => !removeNormSet.has(norm(s['店名'] || s.name)));
    report.trendingRemoved += (before - kept.length);
    if (data.stores) data.stores = kept;
    // daily_trending5 は順位を振り直す
    if (tf.includes('daily_trending5')) data.stores.forEach((s, i) => { s['順位'] = i + 1; });
    if (!dryRun) fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  console.log(`(dry-run: ${dryRun})`);
  console.log(JSON.stringify(report, null, 2));
}

main();
