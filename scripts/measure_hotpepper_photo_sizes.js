#!/usr/bin/env node
'use strict';
/**
 * scripts/measure_hotpepper_photo_sizes.js — ホットペッパー写真の幅を測って data/hotpepper_photo_sizes.json に残す（Ondine #2097）
 *
 * 対象: data/feature_faces.json の顔の写真と、トップの大きな写真の候補（journal/ の最新の記事の顔）。
 * 同じ写真の `_480.jpg` とサフィックス無しの2つの URL の幅を、JPEG の頭だけ取って測る（curl の範囲指定・画像は保存しない）。
 * 測った結果が無い写真は、画面では 480px のまま（引き伸ばさない）。404 は 0 として残す（再び測らない）。
 *
 * 使い方: node scripts/measure_hotpepper_photo_sizes.js [--all]   （--all は測り済みも測り直す）
 * 通信に失敗した写真は残さず（次回また測る）、ビルドは止めない（exit 0）。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const H = require('./lib/hotpepper_photo');

const ROOT = path.resolve(__dirname, '..');

function jpegWidth(buf) {
  let i = 2;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return 0;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return buf.readUInt16BE(i + 7);
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return 0;
}

// 幅(px)。404 は 0。通信できなかったときは null（結果を残さない）
function measure(url) {
  try {
    const out = execFileSync('curl', ['-s', '-m', '20', '-r', '0-299999', '-w', '\n%{http_code}', url], { maxBuffer: 2 << 20 });
    const nl = out.lastIndexOf(0x0a);
    const code = out.slice(nl + 1).toString();
    if (code === '404' || code === '403') return 0;
    if (code !== '200' && code !== '206') return null;
    const w = jpegWidth(out.slice(0, nl));
    return w || null;
  } catch (_) { return null; }
}

function candidateUrls() {
  const urls = new Set();
  try {
    const f = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_faces.json'), 'utf8'));
    for (const v of Object.values(f.faces || {})) if (v && v.photo) urls.add(v.photo);
  } catch (_) { /* 無ければ何もしない */ }
  try {
    const B = require('./build_journal_index');
    for (const u of (B.topHeroCandidateSources ? B.topHeroCandidateSources() : [])) urls.add(u);
  } catch (_) { /* 候補が取れなければ顔だけ */ }
  return [...urls];
}

function main() {
  const all = process.argv.includes('--all');
  let doc = { _comment: 'ホットペッパー写真の幅(px)。s=_480 の URL、l=サフィックス無しの URL（0 は無い）。scripts/measure_hotpepper_photo_sizes.js が測る。scripts/lib/hotpepper_photo.js が読む', sizes: {} };
  try { doc = JSON.parse(fs.readFileSync(H.SIZES_FILE, 'utf8')); } catch (_) { /* 初回 */ }
  doc.sizes = doc.sizes || {};
  let measured = 0;
  let failed = 0;
  for (const url of candidateUrls()) {
    const id = H.idOf(url);
    const v = H.variants(url);
    if (!id || !v || (!all && doc.sizes[id])) continue;
    const s = measure(v.small);
    const l = measure(v.large);
    if (s === null || l === null) { failed++; continue; }
    doc.sizes[id] = { s, l };
    measured++;
  }
  doc.sizes = Object.fromEntries(Object.keys(doc.sizes).sort().map((k) => [k, doc.sizes[k]]));
  fs.writeFileSync(H.SIZES_FILE, JSON.stringify(doc, null, 1) + '\n');
  console.log(`✅ ホットペッパー写真の幅を測った: 新規 ${measured} 件${failed ? `・通信できず ${failed} 件（次回また測る）` : ''}・合計 ${Object.keys(doc.sizes).length} 件`);
}

if (require.main === module) main();
module.exports = { jpegWidth, measure };
