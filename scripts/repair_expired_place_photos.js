#!/usr/bin/env node
/**
 * 失効した Google Places の写真 URL を、公開ページから取り除く（P-29・2026-10-15）。
 *
 * 背景: Places の写真は「photo name は期限切れになりうる・キャッシュ不可」
 * （https://developers.google.com/maps/documentation/places/web-service/place-photos ）。
 * 生成時に書いた lh3.googleusercontent.com/place-photos/... の URL が、写真ごとに個別に 403 になり、
 * データ（stores.json・毎日取り直す）は生きているのに、書き込み済みで取り直されない
 * 過去の記事（journal）・特集（features）・孤児の店舗ページ（stores）だけが壊れた写真を出し続けていた。
 *
 * 何をするか（API は呼ばない・画素は加工しない・他店の写真は借りない）:
 *   1. 対象ページ中の Places 写真 URL を実際に HTTP で確かめ、403/404/410 を2回続けて観測したものだけを失効とする（制約10）。
 *   2. 失効 URL を、同じ店の生きた HotPepper 公式写真（data/stores.json の 写真URL）に差し替える。
 *      無ければ写真を外す（特集のカード＝要素ごと削除／店舗ページ＝既定図／og:image＝既定の icon-512.png／
 *      ジャーナルのヒーロー＝figure を外し NB-HERO-EXPIRED の印を残す）。
 *      ジャーナルのヒーロー差し替えは scripts/lib/hero_photo_gate.js の judgePhoto を通ったものだけ。
 *   3. 冪等。失効が無ければ何も書かない。
 *
 * 使い方:
 *   node scripts/repair_expired_place_photos.js --dry-run   # 件数と内訳だけ（書き込まない）
 *   node scripts/repair_expired_place_photos.js             # 直す
 *   node scripts/repair_expired_place_photos.js --check     # 失効が残っていれば exit 1（書き込まない・CI の soft 向け）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const lib = require('./lib/expired_place_photos');
const gate = require('./lib/hero_photo_gate');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const CHECK = argv.includes('--check');

const DEAD_STATUS = new Set([403, 404, 410]);

function probe(url) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve(0); }
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { Range: 'bytes=0-0', 'User-Agent': 'Mozilla/5.0 (compatible; NagoyaBitesPhotoAudit/1.0)' }, timeout: 15000 },
    (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(0); });
    req.end();
  });
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 失効を2回続けて観測できた URL だけを返す（単発の失敗では外さない） */
async function confirmDead(urls) {
  const first = await mapLimit(urls, 12, probe);
  const suspects = urls.filter((u, i) => DEAD_STATUS.has(first[i]));
  if (!suspects.length) return new Set();
  await sleep(1500);
  const second = await mapLimit(suspects, 12, probe);
  return new Set(suspects.filter((u, i) => DEAD_STATUS.has(second[i])));
}

const isHotpepperPhoto = (u) => /^https:\/\/imgfp\.hotp\.jp\//.test(u || '');

function listTargets() {
  const files = [];
  for (const d of ['features', 'journal', 'stores']) {
    const dir = path.join(ROOT, d);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.html') || f === '_template.html') continue;
      files.push(`${d}/${f}`);
    }
  }
  return files;
}

async function main() {
  const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
  const byName = new Map();
  for (const s of stores) {
    const n = lib.normName(s['店名']);
    if (!n || !isHotpepperPhoto(s['写真URL'])) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(s);
  }
  const hpStores = stores.filter((s) => isHotpepperPhoto(s['写真URL']));
  const policy = gate.loadPolicy();
  const th = policy.attribution.matchThreshold;

  // 対象ページと Places URL
  const pages = new Map(); // file -> html
  const urlSet = new Set();
  for (const f of listTargets()) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const us = lib.findPlaceUrls(html);
    if (!us.length) continue;
    pages.set(f, html);
    us.forEach((u) => urlSet.add(u));
  }
  const sitemapPath = path.join(ROOT, 'sitemap-images.xml');
  const sitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '';
  lib.findPlaceUrls(sitemap).forEach((u) => urlSet.add(u));

  const dead = await confirmDead([...urlSet]);
  console.log(`Places 写真 URL: ${urlSet.size} 件を確認 → 失効 ${dead.size} 件`);

  // 差し替え候補の生死（HotPepper）を必要になった分だけ確かめる
  const aliveHp = new Map(); // url -> boolean
  let need = new Set();
  const aliveOf = (u) => { if (aliveHp.has(u)) return aliveHp.get(u); need.add(u); return false; };

  const makeResolve = (file) => (name, opts = {}) => {
    if (opts.journal) {
      const m = file.match(/journal\/(\d{4}-\d{2}-\d{2})-(.+)\.html$/);
      const cands = hpStores.filter((s) => gate.namesMatch(s['店名'], name, th));
      const exactFirst = cands.sort((a, b) => (lib.normName(b['店名']) === lib.normName(name)) - (lib.normName(a['店名']) === lib.normName(name)));
      const html = opts.html || '';
      const storeNames = Array.from(html.matchAll(/class="store-name">([^<]+)</g)).map((x) => x[1].trim());
      for (const s of exactFirst) {
        const url = s['写真URL'];
        if (html.includes(url)) continue; // 本文に同じ写真が既にある（記事内の重複になる）
        if (!aliveOf(url)) continue;
        const j = gate.judgePhoto({ slug: m ? `${m[1]}-${m[2]}` : '', date: m ? m[1] : '', heroUrl: url, heroSource: 'hotpepper',
          heroStore: name, caption: '', storeNames, html });
        if ((j.findings || []).some((f) => f.level === 'fail') || j.ok === false) continue;
        return { url, label: s['店名'], pageUrl: s['ホットペッパーID'] ? `https://www.hotpepper.jp/str${s['ホットペッパーID']}/` : '' };
      }
      return null;
    }
    const c = byName.get(lib.normName(name)) || [];
    const urls = [...new Set(c.map((s) => s['写真URL']))];
    if (urls.length !== 1) return null; // 同名の別店が混ざるなら決めない
    return aliveOf(urls[0]) ? urls[0] : null;
  };

  const results = [];
  for (const [file, html] of pages) {
    const kind = file.split('/')[0];
    let r;
    for (let pass = 0; pass < 2; pass++) {
      need = new Set();
      r = lib.repairHtml(html, { kind, dead, resolve: makeResolve(file) });
      if (!need.size) break;
      const list = [...need];
      const st = await mapLimit(list, 12, probe);
      list.forEach((u, i) => aliveHp.set(u, st[i] >= 200 && st[i] < 400));
    }
    if (r.changes.length) results.push({ file, kind, ...r, before: html });
  }

  // 集計
  const byKind = {};
  for (const r of results) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  const tally = {};
  for (const r of results) for (const c of r.changes) { const k = c.replace(/:.*$/, ''); tally[k] = (tally[k] || 0) + 1; }
  console.log('直す対象のページ:', byKind);
  console.log('内訳:', tally);

  let sm = { xml: sitemap, removed: 0 };
  if (sitemap) sm = lib.repairSitemapImages(sitemap, dead);
  console.log(`sitemap-images.xml: 外す ${sm.removed} 件`);

  const invalid = [];
  for (const r of results) {
    const bad = lib.jsonLdValid(r.html);
    if (bad.length && !lib.jsonLdValid(r.before).length) invalid.push(`${r.file}: ${bad[0]}`);
  }
  if (invalid.length) { console.error('JSON-LD が壊れる変更があるため中止:', invalid); process.exit(2); }

  if (DRY || CHECK) {
    for (const r of results.slice(0, 200)) console.log(`  ${r.file}\n    ` + r.changes.join('\n    '));
    if (CHECK && (results.length || sm.removed)) { console.error('失効した Places 写真が公開ページに残っています'); process.exit(1); }
    return;
  }
  for (const r of results) fs.writeFileSync(path.join(ROOT, r.file), r.html);
  if (sm.removed) fs.writeFileSync(sitemapPath, sm.xml);
  console.log(`書き込み: ${results.length} ページ`);
}

main().catch((e) => { console.error(e); process.exit(2); });
