#!/usr/bin/env node
'use strict';
/**
 * scripts/update_feature_face_hashes.js — 特集の顔の写真の「中身の指紋」を data/feature_face_hashes.json に記録する（Ondine #2097）
 *
 * 顔の写真を替えたら実行する。URL が違っても中身が同じ（md5 一致）・ほぼ同じ（縮小画像の平均ハッシュが近い）写真を、
 * 別の特集の顔にしない（CLAUDE.md 写真4）ための検査材料。検査は tests/feature_faces.test.js（通信なし・記録を読む）。
 * 通信は curl で行う（Node の https は環境で詰まるため）。ハッシュの計算に python3 + PIL を使う。
 *
 *   node scripts/update_feature_face_hashes.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FACES = path.join(ROOT, 'data', 'feature_faces.json');
const OUT = path.join(ROOT, 'data', 'feature_face_hashes.json');

const AHASH = `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('L').resize((8, 8))
px = list(im.getdata()); m = sum(px) / 64
print(''.join('1' if p > m else '0' for p in px))
`;

function main() {
  const faces = JSON.parse(fs.readFileSync(FACES, 'utf8')).faces;
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')).hashes || {}; } catch (_) { /* 初回 */ }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'face-hash-'));
  const hashes = {};
  for (const [slug, f] of Object.entries(faces)) {
    const id = (f.photo.match(/P\d{6,}/) || [])[0];
    if (prev[slug] && prev[slug].photo === f.photo) { hashes[slug] = prev[slug]; continue; } // 写真が同じなら取り直さない
    const file = path.join(tmp, `${slug}.jpg`);
    execFileSync('curl', ['-sf', '--max-time', '30', '-o', file, f.photo]);
    const buf = fs.readFileSync(file);
    const ahash = execFileSync('python3', ['-c', AHASH, file]).toString().trim();
    hashes[slug] = { photo: f.photo, id, md5: crypto.createHash('md5').update(buf).digest('hex'), ahash };
    console.log('記録', slug, id);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  const out = { _comment: '特集の顔の写真の中身の指紋。scripts/update_feature_face_hashes.js が data/feature_faces.json から作る。tests/feature_faces.test.js が重複（md5 一致・平均ハッシュが近い）0 を確かめる', hashes };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`✅ ${Object.keys(hashes).length}件 → data/feature_face_hashes.json`);
}
if (require.main === module) main();
